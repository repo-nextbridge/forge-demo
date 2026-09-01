// PERF-B — the executable proof that catalog HTML is served from the edge and by-possession HTML never is.
//
// It is not a unit test and does not run in CI: it needs a production build (`next build`) and a running
// server, which is exactly why it is worth having — the thing being proven is a RUNTIME behaviour of Next's
// route cache, and only a real response header can show it. The structural guards (src/lib/edge-cache.test.ts,
// src/edge-cache.guard.test.ts) are the cheap CI half; this is the half that produces the numbers.
//
//   HOW TO RUN
//     pnpm --filter @forge/storefront build
//     node apps/storefront/scripts/edge-cache-proof.mjs
//
//   It boots a FAKE read port (fixtures below — no kernel, no database) and `next start` on free ports, then
//   asserts every case and prints the timings. Exit code 0 = all cases hold.
//
// ★ PK2-POST added a third subject (cases 13a–13c): the requests that belong to NEITHER tree. A root-level
// route handler — an app's public endpoint, a `.well-known` file — is not under `s/` or `c/`, and the only
// place the difference between "the handler answered" and "a page answered in its stead" is visible is here.
//
// The fake port also counts reads, which is the other half of the story: the second visit to a cached page
// must reach the port ZERO times. That is the load the CDN takes off the box.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT_READ = 4399;
const PORT_NEXT = 4310;
// Two ADDRESSES for the same server, so the two stores are told apart by the Host header the client sends on
// its own: fetch refuses to let us set `host` by hand (it is a forbidden header), and a rewritten one would
// not prove anything anyway — this is how a real second store arrives.
const HOST_PLAIN = `localhost:${PORT_NEXT}`; // → the plain store (no gate: cacheable)
const HOST_GATED = `127.0.0.1:${PORT_NEXT}`; // → the gated store  (a gate fills the slot: never cacheable)

// A MISS has to be a REAL miss. Next's incremental cache survives in `.next/cache` between runs, and both the
// route cache and the fetch cache are keyed by the store, so a fresh store id per run is what makes every run
// start cold — without deleting caches out from under a server that may still be writing them.
const RUN = process.hrtime.bigint().toString(36).slice(-6);
const STORE_PLAIN = `demo${RUN}`;
const STORE_GATED = `gated${RUN}`;

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────────
// Shaped exactly as the read port answers. `price` is mutable: the invalidation case changes it mid-run.
let price = 19990;
const CATEGORY_PATH = 'tenis';

const product = () => ({
  product_id: 'prod_1',
  title: 'Tênis Esportivo',
  description: 'Calçado preto para corrida',
  handle: 'tenis-esportivo',
  status: 'active',
  metadata: {},
  content_sections: [],
  meta_title: null,
  meta_description: null,
  available: true,
  options: [
    {
      id: 'opt_size',
      name: 'Tamanho',
      position: 0,
      values: [{ id: 'v_40', value: '40', position: 0 }],
    },
  ],
  skus: [
    {
      id: 'sku_1',
      code: 'TEN-1',
      amount: price,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      compare_at_amount: null,
      is_default: true,
      metadata: {},
      option_values: [
        { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'v_40', value: '40' },
      ],
      media: [],
      // PROMO — the badge: anonymous-safe by construction (the kernel previews it with no buyer and no
      // payment method), which is what makes it the ONE promotion fact a cached page may carry.
      promotional_price: {
        unit_amount: price,
        promotional_amount: Math.round(price * 0.8),
        discount_bp: 2000,
        label: 'BADGE-PUBLICO',
        promotion_id: 'prom_badge',
      },
    },
  ],
  categories: [{ category_id: 'cat_tenis', path: CATEGORY_PATH, is_primary: true }],
  media: [
    {
      provider_key: 'cdn/tenis.jpg',
      url: '/media/tenis.jpg',
      kind: 'image',
      role: 'hero',
      position: 0,
    },
  ],
});

const uncategorized = () => ({
  ...product(),
  product_id: 'prod_2',
  handle: 'sem-categoria',
  categories: [],
});

// SF-404-STUCK — EXISTENCE is mutable the way `price` is, and for the same reason: the only way to prove what
// a cached 404 does is to stop it being true mid-run. Unpublishing and republishing is what the shopkeeper
// actually does, and it is the half of the story the 14 cases above never touch — every one of them asserts
// the POSITIVE path, so nothing here has ever proven that a 404 the storefront cached ever stops being served.
const published = new Set([
  'tenis-esportivo',
  'sem-categoria',
  'lancamento',
  'lancamento-solto',
  'lancamento-tag',
  'lancamento-store',
]);

/** The two `notFound()` sites of the cacheable tree live in DIFFERENT FILES and only one of them is under
 * `app/c` — so one product per address is the minimum that covers both:
 *   • CATEGORIZED   → its canonical address is the catch-all `/<cat>/<handle>` (templates/catalog/CatalogView)
 *   • UNCATEGORIZED → its canonical address is the alias `/p/<handle>` (app/c/[store]/p/[handle]/page.tsx),
 *     because a categorized product 301s away from the alias and would never reach its notFound(). */
const reappearing = (handle, categorized) => ({
  ...product(),
  product_id: `prod_${handle}`,
  handle,
  title: `Lançamento ${handle}`,
  categories: categorized
    ? [{ category_id: 'cat_tenis', path: CATEGORY_PATH, is_primary: true }]
    : [],
});

const GATE_HOOK = [
  {
    extension_id: 'demo-gate',
    hooks: [{ target: 'storefront:gate', component: 'gate', position: 0 }],
  },
];

let reads = 0;
/** Which reads were made, by name — a HIT that still talks to the port is not a HIT worth having. */
const readsByName = new Map();
function readBody(name, params) {
  readsByName.set(name, (readsByName.get(name) ?? 0) + 1);
  const store = params.get('store');
  switch (name) {
    case 'categories':
      return { cat_tenis: { name: 'Tênis', path: CATEGORY_PATH, status: 'active' } };
    case 'brands':
      return {};
    // DECISIONS — the middleware asks this before letting a path 404. The real port answers `null` (200), and
    // the caller caches that miss; answering 404 here would make it look like a per-request cost it is not.
    case 'route_resolve':
      return { to: null };
    case 'extensions':
      return store === STORE_GATED ? GATE_HOOK : [];
    case 'shipping_summary':
      return { free_shipping_threshold: 30000 };
    case 'payment_methods':
      return { methods: ['pix'], providers: [] };
    case 'store_flags':
      return {};
    case 'availability':
      return { sku_id: params.get('sku_id') ?? 'sku_1', warehouse_id: 'wh_1', available: 10 };
    case 'product.by_handle': {
      const handle = params.get('handle');
      // SF-404-STUCK — the kernel's public face scopes this read with `requireActiveSku`, so an unpublished
      // product, a product out of the store and a product with no active SKU are all the SAME answer here:
      // 404 → null → notFound(). Unpublishing is modelled as leaving `published`, which is what the admin does.
      if (!published.has(handle)) return undefined;
      if (handle === 'tenis-esportivo') return product();
      if (handle === 'sem-categoria') return uncategorized();
      if (handle === 'lancamento') return reappearing('lancamento', true);
      if (handle === 'lancamento-solto') return reappearing('lancamento-solto', false);
      if (handle === 'lancamento-tag') return reappearing('lancamento-tag', false);
      if (handle === 'lancamento-store') return reappearing('lancamento-store', false);
      return undefined; // 404 → null
    }
    // PROMO — a cart that HAS a discount, a coupon and a gift. Nothing cacheable should ever ask for it; the
    // case below proves the cached HTML carries no trace of it even when the shopper has one.
    case 'checkout':
    case 'cart':
      return {
        cart_id: 'cart_1',
        store_id: store,
        currency: 'BRL',
        status: 'open',
        lines: [
          { line_id: 'ln_1', sku_id: 'sku_1', qty: 1, unit_amount: price, line_total: price },
        ],
        subtotal: price,
        totalizers: [
          { id: 'subtotal', name: 'Subtotal', amount: price },
          { id: 'discount:prom_1', name: 'CUPOM-SECRETO-DO-FULANO', amount: -5000 },
        ],
        total_amount: price - 5000,
        pricing: {
          discount_lines: [
            { id: 'discount:prom_1', name: 'CUPOM-SECRETO-DO-FULANO', amount: -5000 },
          ],
          discount_total: 5000,
          shipping_discount: 0,
          near_misses: [
            {
              promotion_id: 'prom_ship',
              label: 'BARRA-SECRETA-DO-FULANO',
              gap: { metric: 'subtotal', current: 100, threshold: 30000, missing: 29900 },
            },
          ],
          applied_coupons: [
            { code: 'SEGREDO10', promotion_id: 'prom_1', label: 'CUPOM-SECRETO-DO-FULANO' },
          ],
          gift_lines: [],
        },
      };
    case 'products':
      return {
        items: [product()],
        page: 1,
        limit: 20,
        total: 1,
        facets: { options: [], custom_fields: [], price: { min: price, max: price }, brands: [] },
      };
    case 'page.by_slug':
      return params.get('slug') === 'sobre'
        ? {
            slug: 'sobre',
            title: 'Sobre a loja',
            template_key: 'default',
            meta_title: null,
            meta_description: null,
          }
        : undefined;
    default:
      return undefined;
  }
}

function startReadPort() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      reads += 1;
      const url = new URL(req.url, 'http://x');
      const name = url.pathname.replace('/v1/read/', '');
      const body = readBody(name, url.searchParams);
      res.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body ?? {}));
    });
    server.listen(PORT_READ, () => resolve(server));
  });
}

function startNext() {
  const child = spawn(
    'node',
    [join(APP_DIR, 'node_modules/next/dist/bin/next'), 'start', '-p', String(PORT_NEXT)],
    {
      cwd: APP_DIR,
      env: {
        ...process.env,
        FORGE_READ_BASE_URL: `http://localhost:${PORT_READ}`,
        FORGE_STORE_HOSTS: JSON.stringify({ [HOST_PLAIN]: STORE_PLAIN, [HOST_GATED]: STORE_GATED }),
        FORGE_REVALIDATE_SECRET: 'proof-secret',
        FORGE_PUBLIC_ORIGIN: `https://${HOST_PLAIN}`,
        // PERF-C's image pipeline only emits derivative URLs when the instance has a media base; setting it
        // here is what lets the case below prove the two features compose instead of assuming it.
        FORGE_MEDIA_BASE_URL: 'https://media.example',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const log = [];
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));
  return { child, log };
}

async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not become ready: ${url}`);
}

async function hit(path, { host = HOST_PLAIN, init = {} } = {}) {
  const started = process.hrtime.bigint();
  const res = await fetch(`http://${host}${path}`, { redirect: 'manual', ...init });
  // SF-404-STUCK — the body is read on EVERY status, not just 200. It used to be `res.status === 200 ? … : ''`,
  // which made this helper structurally blind to every negative case: a 404 has a body (the not-found shell),
  // and whether that body is the store's 404 or a soft 200 is exactly what a negative case has to look at.
  const body = await res.text();
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  return {
    status: res.status,
    type: (res.headers.get('content-type') ?? '-').split(';')[0],
    cache: res.headers.get('x-nextjs-cache') ?? '-',
    cacheControl: res.headers.get('cache-control') ?? '-',
    // The etag is how you tell "the entry was re-rendered" from "the entry was served again" — the Staging
    // measurement that opened this card saw the etag move while the status stayed 404.
    etag: res.headers.get('etag') ?? '-',
    tree: res.headers.get('x-middleware-rewrite') ?? '-',
    location: res.headers.get('location'),
    ms,
    body,
  };
}

/** POST the invalidation hook the admin posts. Returns the Response. */
function purgeTag(tag) {
  return fetch(`http://${HOST_PLAIN}/api/revalidate?tag=${encodeURIComponent(tag)}`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': 'proof-secret' },
  });
}

/** The `s-maxage` a response asks a shared cache for, or -1 when it asked for none. */
function smaxage(r) {
  const m = /s-maxage=(\d+)/.exec(r.cacheControl);
  return m ? Number(m[1]) : -1;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** SF-404-STUCK — the window a negative entry gets, READ OUT OF THE ROUTE rather than copied here: it is the
 * page's own `revalidate`, because nothing in a negative render lowers it (the reads that cap the POSITIVE at
 * 60s never run — the render short-circuits before the product view). A second literal would be a second thing
 * to keep in step, and the day they drifted this file would wait the wrong number of seconds and report the
 * drift as a bug in the code. */
/** ★ PK2-POST — the URLs an app serves from a ROOT-LEVEL route handler, READ OUT OF THE GENERATED LIST rather
 * than typed here. Typing one would make this file name an app, which is the weld the composition list exists
 * to prevent — and it would also stop proving the thing the case is about: that a path nobody told the edge
 * about still reaches its handler. An instance whose list has no such app simply skips the cases. */
const APP_ROUTE_PATHS = [
  ...readFileSync(join(APP_DIR, 'src/lib/extensions/generated/public-routes.ts'), 'utf8').matchAll(
    /^\s*'(\/[^']+)',$/gm,
  ),
].map((m) => m[1]);

const NEGATIVE_WINDOW = (() => {
  const src = readFileSync(join(APP_DIR, 'src/app/c/[store]/[...catpath]/page.tsx'), 'utf8');
  const m = /export const revalidate\s*=\s*(\d+)/.exec(src);
  if (!m) throw new Error('could not read `revalidate` from the cacheable catch-all route');
  return Number(m[1]);
})();

/** What was read since `before`, by name — a HIT that still talks to the port is not a HIT worth having. */
function diffNames(before) {
  return [...readsByName]
    .map(([name, n]) => [name, n - (before.get(name) ?? 0)])
    .filter(([, n]) => n > 0);
}

/** "19990" → "159,92"-style pt-BR cents, to look for a price in rendered HTML. */
function formatCents(cents) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(cents / 100);
}

// ── the cases ───────────────────────────────────────────────────────────────────────────────────────────
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`);
}

const isEdgeCacheable = (r) =>
  /s-maxage=\d+/.test(r.cacheControl) && /stale-while-revalidate/.test(r.cacheControl);
const isPrivate = (r) => /no-store/.test(r.cacheControl) && /private/.test(r.cacheControl);

async function main() {
  const readPort = await startReadPort();
  const { child, log } = startNext();
  try {
    await waitFor(`http://${HOST_PLAIN}/`);

    // 1 — the home, twice: the second visit comes from the edge cache, and the port is not touched.
    const home1 = await hit('/');
    const readsAfterFirst = reads;
    const home2 = await hit('/');
    check(
      'catalog HOME is served from the edge on the second visit',
      home1.status === 200 && home2.cache === 'HIT' && isEdgeCacheable(home2),
      `1st ${home1.cache} ${home1.ms.toFixed(1)}ms · 2nd ${home2.cache} ${home2.ms.toFixed(1)}ms · ${home2.cacheControl} · port reads on 2nd visit: ${reads - readsAfterFirst}`,
    );

    // 2 — the PDP at its canonical category path (the catch-all's product branch).
    const pdpPath = `/${CATEGORY_PATH}/tenis-esportivo`;
    const pdp1 = await hit(pdpPath);
    const pdp2 = await hit(pdpPath);
    // SF-404-STUCK — the positive's TTL, recorded BEFORE any negative has been rendered on this route. Case
    // 12f compares against it: Next indexes a page's revalidate by CONCRETE path, so a short-lived negative
    // must not shorten a sibling PDP of the same route pattern. That is a claim, and this is its baseline.
    const pdpSmaxageBefore = smaxage(pdp2);
    check(
      'catalog PDP (canonical path) is served from the edge',
      pdp1.status === 200 && pdp2.cache === 'HIT' && isEdgeCacheable(pdp2),
      `1st ${pdp1.cache} ${pdp1.ms.toFixed(1)}ms · 2nd ${pdp2.cache} ${pdp2.ms.toFixed(1)}ms · ${pdp2.cacheControl} · tree ${pdp2.tree}`,
    );

    // 3 — the clean category PLP.
    const plp1 = await hit(`/${CATEGORY_PATH}`);
    const plp2 = await hit(`/${CATEGORY_PATH}`);
    check(
      'catalog PLP (clean URL) is served from the edge',
      plp1.status === 200 && plp2.cache === 'HIT' && isEdgeCacheable(plp2),
      `1st ${plp1.cache} · 2nd ${plp2.cache} · ${plp2.cacheControl} · tree ${plp2.tree}`,
    );

    // 4 — the institutional CMS page.
    const cms = await hit('/sobre');
    const cms2 = await hit('/sobre');
    check(
      'institutional page is served from the edge',
      cms.status === 200 && cms2.cache === 'HIT',
      `1st ${cms.cache} · 2nd ${cms2.cache} · ${cms2.cacheControl}`,
    );

    // 5 — a campaign link must not fall out of the cache.
    const utm = await hit('/?utm_source=instagram&utm_campaign=verao');
    check(
      'a tracking-only query still hits the edge cache',
      utm.cache === 'HIT' && isEdgeCacheable(utm),
      `${utm.cache} · ${utm.cacheControl}`,
    );

    // 6 — a MEANINGFUL query must not be answered by the cached page-1 HTML.
    const paged = await hit(`/${CATEGORY_PATH}?page=2`);
    check(
      'a paginated PLP is rendered dynamically (never the cached page 1)',
      paged.status === 200 && isPrivate(paged),
      `${paged.cacheControl}`,
    );

    // 7 — BY-POSSESSION: never cached, on any visit.
    for (const path of ['/checkout', '/account', '/search?q=tenis']) {
      const r1 = await hit(path);
      const r2 = await hit(path);
      check(
        `by-possession ${path} is never cached`,
        isPrivate(r1) && isPrivate(r2) && r1.cache === '-' && r2.cache === '-',
        `${r1.cacheControl}`,
      );
    }

    // 8 — a store with a GATE installed is by-possession on every route.
    const gated1 = await hit('/', { host: HOST_GATED });
    const gated2 = await hit('/', { host: HOST_GATED });
    check(
      'a gated store is never served from the edge',
      isPrivate(gated1) && isPrivate(gated2),
      `${gated2.cacheControl}`,
    );

    // 9 — the PDP alias: a categorized product 301s, an uncategorized one renders and caches.
    const alias = await hit('/p/tenis-esportivo');
    check(
      'the /p/<handle> alias still redirects to the canonical path',
      alias.status === 301 || alias.status === 308,
      `${alias.status} → ${alias.location}`,
    );
    const orphan1 = await hit('/p/sem-categoria');
    const orphan2 = await hit('/p/sem-categoria');
    check(
      'an uncategorized product renders at its alias and is cached',
      orphan1.status === 200 && orphan2.cache === 'HIT',
      `1st ${orphan1.cache} · 2nd ${orphan2.cache} · ${orphan2.cacheControl}`,
    );

    // 9b — the internal tree is not an address. `/c/<store>/…` is a rewrite target, and a request that asks
    // for it literally must NOT be able to name a store: that would let anyone read another store's HTML by
    // guessing its id. The middleware rewrites it like any other path, so it resolves to nothing.
    const smuggled = await hit(`/c/${STORE_GATED}/tenis`);
    check(
      'the cacheable tree cannot be addressed from outside (no store-id smuggling)',
      smuggled.status === 404,
      `/c/<other-store>/tenis → ${smuggled.status} (rewritten to ${smuggled.tree})`,
    );

    // 9c — PERF-B and PERF-C have to COMPOSE, not merely coexist: the image driver is chosen from the env in
    // the ROOT layout and crosses to the client as data, and the root layout wraps the cacheable tree too. So
    // a cached PDP must still carry the format-in-URL derivatives — if the provider were missing, or if the
    // driver read something dynamic, this page would either lose its <picture> or stop being cacheable.
    const withImages = await hit(pdpPath);
    check(
      'the image driver (PERF-C) works INSIDE a cached page',
      withImages.cache === 'HIT' &&
        withImages.body.includes('<picture>') &&
        withImages.body.includes('/api/img/webp/') &&
        withImages.body.includes('/api/img/orig/'),
      `${withImages.cache} · <picture>: ${withImages.body.includes('<picture>')} · webp srcset: ${withImages.body.includes('/api/img/webp/')} · orig srcset: ${withImages.body.includes('/api/img/orig/')}`,
    );

    // 9d — PROMO × the edge: a cached page must carry NO trace of a shopper's cart, cookie in hand.
    //
    // This is the failure that would be worst and quietest: the catalog's HTML is rendered once and served to
    // everyone, so one shopper's discount baked into it is every shopper's discount. The static guard
    // (src/promo-contract.guard.test.ts) forbids the imports; this proves the behaviour, with a cart cookie
    // ON the request and a port that would happily answer with a coupon, a discount line and a progress bar.
    const withCart = await fetch(`http://${HOST_PLAIN}${pdpPath}`, {
      headers: { cookie: 'forge_cart=cart_1' },
      redirect: 'manual',
    });
    const cartHtml = await withCart.text();
    const leaked = ['CUPOM-SECRETO-DO-FULANO', 'BARRA-SECRETA-DO-FULANO', 'SEGREDO10'].filter((t) =>
      cartHtml.includes(t),
    );
    check(
      'a cached catalog page carries NO trace of the shopper cart, even with the cookie on the request',
      withCart.headers.get('x-nextjs-cache') === 'HIT' && leaked.length === 0,
      `${withCart.headers.get('x-nextjs-cache')} · leaked: ${leaked.length === 0 ? 'nothing' : leaked.join(', ')}`,
    );

    // 9e — the other half of 9d: what a cached page SHOULD carry. The badge is a promotion, and it belongs in
    // the cached HTML precisely because it is true for every anonymous visitor. Proving both directions in one
    // run is what keeps "no promotion on a cached page" from being over-applied into "no badge either".
    const badged = await hit(pdpPath);
    const discounted = formatCents(Math.round(price * 0.8));
    check(
      'the anonymous-safe BADGE is in the cached HTML (the cart never is)',
      badged.cache === 'HIT' && badged.body.includes(discounted),
      `${badged.cache} · the promotional price (${discounted}) is rendered: ${badged.body.includes(discounted)}`,
    );

    // 10 — INVALIDATION BY EVENT IS THE AUTHORITY: change the price, purge the tag, next visit shows the new
    // one — with the TTL nowhere near expired (300s), so nothing but the purge can explain it.
    const before = await hit(pdpPath);
    const showsOld = before.body.includes('199,90');
    price = 24990;
    const stale = await hit(pdpPath);
    const stillOld = stale.body.includes('199,90');
    const purge = await fetch(
      `http://${HOST_PLAIN}/api/revalidate?tag=${encodeURIComponent('product:tenis-esportivo')}`,
      { method: 'POST', headers: { 'x-revalidate-secret': 'proof-secret' } },
    );
    // The first request after a purge re-renders (Next serves stale-while-revalidating on the following one).
    await hit(pdpPath);
    await new Promise((r) => setTimeout(r, 500));
    const after = await hit(pdpPath);
    check(
      'invalidation by event drops the cached HTML (price change → next visit shows the new price)',
      showsOld && stillOld && purge.ok && after.body.includes('249,90'),
      `cached showed R$ 199,90 (still stale before the purge: ${stillOld}) · purge ${purge.status} · after purge shows R$ ${after.body.includes('249,90') ? '249,90' : '??? (still stale)'}`,
    );

    // 11 — THE NUMBER, before/after, on the SAME page: the PDP served from the cache versus the identical
    // PDP rendered by the dynamic tree (a meaningful query is what routes it there). The ms gap here is the
    // FLOOR of the real one — this fake port answers in microseconds, where a real kernel talks to Postgres —
    // so the honest headline is the port reads, which is the load the box stops taking.
    const namesBefore = new Map(readsByName);
    const readsBefore = reads;
    const cached = [];
    for (let i = 0; i < 20; i += 1) cached.push((await hit(pdpPath)).ms);
    const readsCached = reads - readsBefore;
    const cachedBreakdown = diffNames(namesBefore);

    const namesBeforeDynamic = new Map(readsByName);
    const readsBeforeDynamic = reads;
    const dynamic = [];
    for (let i = 0; i < 20; i += 1) dynamic.push((await hit(`${pdpPath}?page=1&n=${i}`)).ms);
    const readsDynamic = reads - readsBeforeDynamic;
    const dynamicBreakdown = diffNames(namesBeforeDynamic);

    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95) - 1];
    console.log(
      `\nTHE SAME PDP, 20 requests each` +
        `\n  from the edge cache : ${avg(cached).toFixed(1)}ms avg · ${p95(cached)?.toFixed(1)}ms p95 · ${readsCached} port reads` +
        `\n  rendered per request: ${avg(dynamic).toFixed(1)}ms avg · ${p95(dynamic)?.toFixed(1)}ms p95 · ${readsDynamic} port reads` +
        `\n  (this port is a stub on localhost — a real kernel + Postgres widens the gap, never narrows it)` +
        `\n  reads, cached run : ${JSON.stringify(Object.fromEntries(cachedBreakdown))}` +
        `\n  reads, dynamic run: ${JSON.stringify(Object.fromEntries(dynamicBreakdown))}`,
    );

    // ── 12 — SF-404-STUCK: THE NEGATIVE ─────────────────────────────────────────────────────────────────
    //
    // Everything above proves the POSITIVE: a page that exists is cached, and an event drops it. This block
    // proves the other half, which nothing did before: what a page that does NOT exist leaves behind, and
    // whether it stops being served once it stops being true. The failure it guards is asymmetric and that
    // asymmetry is the whole point — a product going off the air expires by the route's own TTL (bounded, and
    // someone notices), while a product COMING BACK is invisible for as long as the cached 404 lives, in a
    // public store, with the admin saying `active`. Nobody reports the page they cannot see.
    //
    // WHAT THESE CASES ESTABLISHED, so nobody has to re-derive it:
    //   · A `notFound()` in the App Router is NOT an absent entry. It is an ordinary APP_PAGE entry with
    //     `status: 404` and the render's cache tags — which is why a stale 404 answers `x-nextjs-cache: HIT`,
    //     and why `revalidateTag` reaches it (12d) with the very tag the admin already posts (12e).
    //   · The window it gets is the PAGE's full revalidate, because nothing in a negative render lowers it —
    //     so the 404 outlives the product page it replaced (12).
    //   · And the window is beside the point: the entry's STATUS never comes back (12b). Only invalidation
    //     clears it.
    //
    // These run LAST, after the timing block, so a negative can never perturb the number that block prints.

    // 12 — the shape of the entry, measured as a number. `s-maxage` is what the entry (and any shared cache in
    // front of it) was told, and comparing it against the positive PDP's is what turns "the 404 is cached"
    // into the thing that actually bites.
    const canonPath = `/${CATEGORY_PATH}/lancamento`;
    published.delete('lancamento');
    const neg1 = await hit(canonPath);
    const neg2 = await hit(canonPath);
    check(
      'the 404 is a cache entry, and it OUTLIVES the product page it replaced',
      neg1.status === 404 &&
        neg2.status === 404 &&
        neg2.cache === 'HIT' &&
        smaxage(neg2) === NEGATIVE_WINDOW &&
        NEGATIVE_WINDOW > pdpSmaxageBefore,
      `1st ${neg1.status} ${neg1.cache} · 2nd ${neg2.status} ${neg2.cache} · s-maxage=${smaxage(neg2)}` +
        ` against the positive PDP's ${pdpSmaxageBefore}s · etag ${neg2.etag}` +
        ` — the negative render short-circuits before the reads that cap the positive, so the answer we are` +
        ` least sure of gets the LONGEST life`,
    );

    // 12b — THE DEFECT, pinned. This is the one that explains the 40 minutes on Staging, and it is upstream:
    //
    //   Next stores a page's status as `res.statusCode` OF THE REQUEST THAT TRIGGERED THE RENDER
    //   (base-server.js:1639). A stale-while-revalidate re-render is triggered by a request that is itself
    //   serving the cached 404, so that request's `res.statusCode` is 404 — and NOTHING in the App Router
    //   ever writes 200 back (app-render.js only assigns res.statusCode on the notFound/redirect/error
    //   paths). So the revalidation regenerates the BODY correctly — the product's HTML is written to
    //   `.next/server/app/c/<store>/…​.html`, with the positive render's own cache tags in the `.meta` — and
    //   re-stores it under `"status":404`. Forever. Every later revalidation is triggered by another 404
    //   response, which re-seeds the same wrong status.
    //
    // That is the whole asymmetry, and it is not about TTLs: 200 → 404 has a writer (the notFound() catch),
    // 404 → 200 has none. A TTL cannot fix it, and neither can a shorter one — measured, both.
    // The only escape is a BLOCKING invalidation, which is what cases 12d/12e exercise.
    //
    // Pinned as an assertion so a Next upgrade that fixes it makes this case FAIL and we find out.
    console.log(
      `      … waiting ${NEGATIVE_WINDOW}s for the negative entry to go stale and regenerate`,
    );
    published.add('lancamento');
    const immediately = await hit(canonPath);
    await sleep((NEGATIVE_WINDOW + 2) * 1000);
    await hit(canonPath); // stale → serves the cached copy once and kicks the background re-render
    await sleep(2500);
    const regenerated = await hit(canonPath);
    check(
      'UPSTREAM DEFECT — a regenerated 404 gets the product BODY back and keeps the 404 STATUS',
      immediately.status === 404 &&
        regenerated.status === 404 &&
        regenerated.body.includes('Lançamento lancamento') &&
        regenerated.etag !== neg2.etag,
      `right after republishing: ${immediately.status} · after ${NEGATIVE_WINDOW}s: ${regenerated.status} ${regenerated.cache}` +
        ` · etag moved: ${regenerated.etag !== neg2.etag} · body now carries the product: ${regenerated.body.includes('Lançamento lancamento')}` +
        ` — if this case FAILS with a 200, Next fixed it upstream and this whole card can shrink`,
    );

    // 12c — the OTHER notFound(): the alias page under app/c. Different file, different route, and only this
    // one is inside the cacheable tree's own directory — a fix that covers one and not the other is half a
    // fix, and this is the half a directory-shaped guard would miss. Checked WITHOUT the long wait: what
    // matters here is that the second site caches its negative the same way, and that the purge clears it.
    const aliasPath = '/p/lancamento-solto';
    published.delete('lancamento-solto');
    await hit(aliasPath);
    const aliasNeg = await hit(aliasPath);
    published.add('lancamento-solto');
    const aliasPurge = await purgeTag('product:lancamento-solto');
    const aliasBack = await hit(aliasPath);
    check(
      'the /p/<handle> alias caches its negative too, and the purge clears it',
      aliasNeg.status === 404 &&
        aliasNeg.cache === 'HIT' &&
        smaxage(aliasNeg) === NEGATIVE_WINDOW &&
        aliasPurge.ok &&
        aliasBack.status === 200 &&
        aliasBack.body.includes('Lançamento lancamento-solto'),
      `cached 404 (${aliasNeg.cache}, s-maxage=${smaxage(aliasNeg)}) · purge ${aliasPurge.status} · after purge: ${aliasBack.status} ${aliasBack.cache}`,
    );

    // 12d — THE AUTHORITY IS THE ONLY WAY OUT. PERF decision 2 says invalidation by event is the authority
    // and the TTL is only a backstop; case 10 proved that for a 200. For a 404 it is stronger than a
    // preference — after 12b, invalidation is the ONLY thing that clears the entry, because a tag purge makes
    // the cache handler answer "miss" and Next renders BLOCKING, on a fresh request whose status is not
    // already 404. The backstop does not exist here, so this case is load-bearing, not a nicety.
    const tagPath = '/p/lancamento-tag';
    published.delete('lancamento-tag');
    await hit(tagPath);
    const tagNeg = await hit(tagPath);
    published.add('lancamento-tag');
    const tagPurge = await purgeTag('product:lancamento-tag');
    const tagBack = await hit(tagPath);
    check(
      'revalidateTag drops a cached 404 (the product tag)',
      tagNeg.status === 404 && tagNeg.cache === 'HIT' && tagPurge.ok && tagBack.status === 200,
      `cached 404 ${tagNeg.cache} · purge ${tagPurge.status} · after purge: ${tagBack.status} ${tagBack.cache}` +
        ` (200 ⇒ an App Router 404 is a tagged entry the channel already reaches; 404 ⇒ it is not)`,
    );

    // 12f — the positive must not pay for the negative. Next indexes a page's revalidate by CONCRETE path
    // (`incremental-cache/index.js` keys `revalidateTimings` by the rewritten URL, not by the route pattern),
    // so a negative on `/tenis/lancamento` must leave `/tenis/tenis-esportivo` at its OWN TTL, still a HIT,
    // and still reading the port ZERO times. That is the PERF-B number this card must not spend.
    //
    // It re-warms first, and that is not a fudge: 12b deliberately spends more than a positive TTL waiting,
    // so measuring straight after would be measuring the clock, not the leak. The warm hit re-establishes the
    // entry; the assertion is on the visit AFTER it. It also runs BEFORE 12e, which purges `store:<id>` —
    // a tag on every read, so it drops this page too, by design.
    // Re-warm: the first hit after a lapsed TTL is served STALE and only KICKS the re-render, so one hit is
    // not a warm cache — it is the same trap 12b is about, seen from the positive side.
    await hit(pdpPath);
    await sleep(2000);
    await hit(pdpPath);
    const marks = new Map(readsByName);
    const pos = await hit(pdpPath);
    check(
      'the negative never leaks onto a positive PDP of the same route (TTL, HIT, zero port reads)',
      pos.cache === 'HIT' && smaxage(pos) === pdpSmaxageBefore && diffNames(marks).length === 0,
      `${pos.cache} · s-maxage=${smaxage(pos)} (was ${pdpSmaxageBefore} before any negative) · port reads on the repeat visit: ${JSON.stringify(Object.fromEntries(diffNames(marks)))}`,
    );

    // 12e — the same with the tag the KERNEL ACTUALLY POSTS. One `store:<id>` per store on a catalog write and
    // nothing finer, so this — not 12d — is the tag that has to land for a republish to reach a shopper. A fix
    // that works only under the product tag would be green here and dead in production.
    //
    // ★ SF-INVALIDATE-OUTBOX — this case is now the STOREFRONT HALF of that card's DoD, and it grew teeth.
    // It used to describe what the ADMIN posts; the purge is now driven by the OUTBOX, so the same tag arrives
    // for a write through ANY face of the port (CLI, API, MCP, an app). The kernel half — that a real command
    // produces exactly this request — is apps/api/src/storefront-invalidation.e2e.test.ts, and the tag string
    // itself is pinned to read-client.ts by packages/core's store-cache-tag-parity guard. Together they are the
    // chain; separately neither would be.
    const storePath = '/p/lancamento-store';
    published.delete('lancamento-store');
    await hit(storePath);
    const storeNeg = await hit(storePath);
    published.add('lancamento-store');
    const storePurge = await purgeTag(`store:${STORE_PLAIN}`);
    const storeBack = await hit(storePath);
    check(
      'the tag the KERNEL posts on a catalog write (store:<id>) drops a cached 404',
      storeNeg.status === 404 &&
        storeNeg.cache === 'HIT' &&
        storePurge.ok &&
        storeBack.status === 200,
      `cached 404 ${storeNeg.cache} · purge ${storePurge.status} · after purge: ${storeBack.status} ${storeBack.cache}`,
    );

    // 12g — and it is still a REAL 404. The cheapest way to make every case above green is to stop answering
    // 404 at all; this is the case that makes that fraud fail. Status AND the store's own not-found body —
    // matched on the VISIBLE copy, not on `data-testid`: Next serves a not-found render as a flight payload
    // inside `<html id="__next_error__">`, where the attribute appears as the JSON key `"data-testid"` and a
    // markup-shaped probe silently never matches. Matching the copy measures the page; matching the testid
    // would have measured the transport.
    published.delete('lancamento');
    const realNeg = await hit(canonPath);
    check(
      'the negative is still a real 404 with the store 404 page (never a soft 200)',
      realNeg.status === 404 &&
        realNeg.body.includes('Página não encontrada') &&
        realNeg.body.includes('Voltar à loja') &&
        !realNeg.body.includes('This page could not be found'),
      `${realNeg.status} · store 404 copy: ${realNeg.body.includes('Página não encontrada')}` +
        ` · store 404 CTA: ${realNeg.body.includes('Voltar à loja')}` +
        ` · Next's built-in 404: ${realNeg.body.includes('This page could not be found')}`,
    );
    // ── 13 · PK2-POST — THE TWO TREES ARE FOR PAGES ────────────────────────────────────────────────────────
    //
    // Everything above this line is about WHICH tree a document is served from. These three are about the
    // requests that belong to NEITHER, and they are here because only a running server can tell "the handler
    // answered" from "a page answered where a handler should have": both come back over the same socket, and
    // the difference is a content-type and a body the size of a storefront.
    //
    // Measured on this tree before the fix (2026-08-27): `POST /apps/reviews/submit` → 500 "Failed to find
    // Server Action" (the rewrite landed on a page and Next read the form POST as an action submission),
    // `GET` → 404 with 36 KB of the storefront's not-found shell, and — the one that makes a monitor lie —
    // the SAME request asked for as an RSC payload → **200**, `text/x-component`, 29 690 bytes, carrying that
    // same not-found shell. Three faces, one cause, and not one of them was the app's endpoint.

    // 13a — a POST never enters the cacheable tree. Asserted on the RESPONSE, not on the rewrite header: what
    // must never happen is a write-shaped request being answered out of (or into) an edge-cacheable entry.
    const postHome = await hit('/', {
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'a=1',
      },
    });
    check(
      'a POST is never answered from the edge-cacheable tree',
      !isEdgeCacheable(postHome) && postHome.cache !== 'HIT',
      `POST / → ${postHome.status} · ${postHome.cacheControl} · x-nextjs-cache ${postHome.cache}`,
    );

    // 13b — an app's own endpoint is REACHABLE, and it is the app that answers. The empty POST is deliberate:
    // the handler refuses it in one line, before any port call, so what this measures is routing and nothing
    // else. A rewritten request cannot produce this — it produces HTML by the tens of kilobytes.
    for (const path of APP_ROUTE_PATHS) {
      const post = await hit(path, { init: { method: 'POST', body: new FormData() } });
      const get = await hit(path);
      // The discriminator is WHO answered, never the status: a route handler is entitled to refuse (405 for a
      // verb it does not export, 400 for an empty form, 404 for a feed this fixture has no catalog for), and
      // reading the status alone would call those failures. The storefront's not-found shell is the thing that
      // must not come back — it is what a rewritten request produces, by the tens of kilobytes.
      const shell = (r) => r.type.includes('text/html') && r.body.includes('Página não encontrada');
      check(
        `an app's public route answers from its HANDLER (${path})`,
        !shell(post) && post.status !== 500 && !shell(get),
        `POST → ${post.status} ${post.type} ${post.body.length}B · GET → ${get.status} ${get.type} ${get.body.length}B`,
      );
    }

    // 13c — and the soft 200 is gone at the source. An RSC-shaped POST is the request that used to come back
    // 200 with a not-found payload inside it; on a path that reaches a handler there is no page to render.
    for (const path of APP_ROUTE_PATHS) {
      const rsc = await hit(path, {
        init: { method: 'POST', headers: { rsc: '1' }, body: new FormData() },
      });
      check(
        `an RSC-shaped POST no longer gets a soft 200 with a not-found payload (${path})`,
        !rsc.type.includes('text/x-component') && !rsc.body.includes('Página não encontrada'),
        `POST + RSC:1 → ${rsc.status} ${rsc.type} ${rsc.body.length}B`,
      );
    }
  } catch (error) {
    console.error(error);
    console.error(log.join(''));
    process.exitCode = 1;
  } finally {
    child.kill();
    readPort.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} cases hold`);
  if (failed.length > 0) {
    // The server log is where a failure explains itself: a route that silently stopped being cacheable says
    // so there ("Page changed from static to dynamic at runtime, reason: …") and nowhere else.
    console.log(`\n── server log ──\n${log.join('').split('\n').slice(-40).join('\n')}`);
    process.exitCode = 1;
  }
}

await main();
