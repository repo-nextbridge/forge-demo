// ★★ THE ROOT OF THIS FORK IS THIS SHOP — the rule a CUT of a multi-store vitrine does not come with.
//
// ── THE OWNER'S RULE, 2026-09-09 ─────────────────────────────────────────────────────────────────────────
//
//   "o storefront usado é um fork, é ele que será acessado pelo subdomínio … acessar uma home de café de
//    storefront vanilla nem deveria existir, afinal o fork do storefront assume esse papel."
//
// This image is the café's vitrine. Not "a storefront that can render the café" — the café's. So the address
// it answers at is the café's address, and `/` is the café's home. There is no request this deployable can
// receive that belongs to another shop.
//
// ── WHAT WAS MEASURED BEFORE THE FIX, ON THE LIVE BENCH (forge-preseed, 2026-09-09) ──────────────────────
//
// `docker inspect forge-preseed-storefront-coffee-1` — the café's own container:
//
//     FORGE_COFFEE_STORE_ID = sto_01M21XCFZ…        ← the café: the store this image is the fork OF
//     FORGE_STORE_HOSTS     = { "localhost": "sto_01M21XCED…", "localhost:8200": "sto_01M21XCED…",
//                               "127.0.0.1": …, "<this machine>": …, "<its tailnet name>": … }
//                                              ↑ EVERY hostname of this box → sto_01M21XCED…, the SHOE shop
//                    (the tailnet name is $FORGE_TAILNET_HOST and lives only in `.env` — never in a tracked
//                     file; `bin/box-config.guard.mjs` caught this comment carrying it, and it was right.)
//
// Every address this container can be reached at resolved to somebody else's store, so `/` on the café's own
// front was the shoe shop's home wearing the café's chrome. And `read.store.by_host` cannot rescue it: only
// the ROOT store claims an origin in the kernel's directory (`bin/store-host.mjs`, and the key is globally
// unique), so the café claims none — a request to `cafe.cliente.com.br` answered the fork's clean 404
// (measured: `curl -H 'Host: cafe.cliente.com.br' http://<container>:3000/` → 404 "Página não encontrada").
//
// ⇒ Wrong shop when the host resolves, nothing at all when it does not. Neither is this shop.
//
// ── ⚠️ THE CARD'S PREMISE, WHICH IS FALSE, AND WHY IT MATTERS TO THIS FILE ───────────────────────────────
//
// `FORK-RAIZ-SEM-CHROME` says the root "uses the reference vitrine's chrome". It does not, and never did:
// `src/app/page.tsx` was the reference's landing stub (`<h1>Forge</h1><p>Storefront-base.</p>`), it wore no
// chrome at all, and the middleware rewrites `/` before Next can reach it — so it was UNREACHABLE and could
// not have been the thing anybody saw. Anyone sent after "the reference's chrome at the root" hunts a file
// that is not the defect. The stub is deleted by this slice for the same reason: a decoy in the one place a
// reader looks first is worse than an empty directory.
//
// ── WHY THE RULE LIVES IN THE MIDDLEWARE AND NOT IN A ROOT PAGE ──────────────────────────────────────────
//
// A root `page.tsx` cannot fix this: `/` never reaches it. The store is chosen at the edge, so that is where
// the shop has to be named — and it is named through `ownStoreId()`, the variable `bin/box-up.sh` (step 3c)
// already writes and `compose.override.yml` already delivers. THIRD consumer of one mechanism, not a fourth
// mechanism: `bin/coffee-store-id.guard.mjs` grades all its legs at once.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { OWN_STORE_ENV, PENDING_STORE_SENTINEL } from './lib/own-store';

/** The store this image is the fork of. */
const CAFE = 'sto_01M1DE555TJ36TQB6E9PR5VSJ4';
/** What every hostname of the bench resolves to instead — a store that is not this shop. */
const SHOE_SHOP = 'sto_01M1DE555DZ2Q0V9NQ9EB6S1XW';

const { resolveStoreForHost, storeHasGate } = vi.hoisted(() => ({
  resolveStoreForHost: vi.fn(async () => SHOE_SHOP as string | undefined),
  storeHasGate: vi.fn(async () => false),
}));

vi.mock('@forgecommerce/storefront-kit/config', () => ({ resolveStoreForHost }));
vi.mock('@forgecommerce/storefront-kit/gate/directory', () => ({ storeHasGate }));

const { middleware } = await import('./middleware');
const { NextRequest } = await import('next/server');

const request = (path: string, host = 'cafe.cliente.com.br') =>
  new NextRequest(new URL(path, `https://${host}`), { headers: { host } });

/** Where the edge sent it: the internal path, or '' when it passed the request through untouched. */
const routedTo = (res: Response) => {
  const rewrite = res.headers.get('x-middleware-rewrite');
  return rewrite ? new URL(rewrite).pathname : '';
};

const before = process.env[OWN_STORE_ENV];

beforeEach(() => {
  process.env[OWN_STORE_ENV] = CAFE;
});

afterEach(() => {
  if (before === undefined) delete process.env[OWN_STORE_ENV];
  else process.env[OWN_STORE_ENV] = before;
  vi.clearAllMocks();
  resolveStoreForHost.mockResolvedValue(SHOE_SHOP);
  storeHasGate.mockResolvedValue(false);
});

/** Every offender at once: "which addresses of this shop serve another shop" is the whole answer, and
 * reporting the first one sends somebody to fix `/` and rediscover `/expresso-do-dia`. */
function offenders(routes: string[], results: string[]): string[] {
  return routes
    .map((route, i) => ({ route, to: results[i] as string }))
    .filter(({ to }) => !to.includes(CAFE))
    .map(({ route, to }) => `${route} → ${to}`);
}

test('★ every clean address of this fork serves THIS shop, whatever the host map says', async () => {
  // The bench's shape: the hostname resolves, and it resolves to somebody else.
  const routes = ['/', '/expresso-do-dia', '/p/coado-500g', '/cafes/moidos', '/sobre'];
  const results = await Promise.all(routes.map(async (r) => routedTo(await middleware(request(r)))));

  expect(
    offenders(routes, results),
    `these addresses of the café's own vitrine were routed into another store.\n` +
      `  This image is the fork of ${CAFE} (${OWN_STORE_ENV}); the request host resolved to ${SHOE_SHOP}\n` +
      '  instead, which on the bench is the shoe shop — every hostname of the box maps to it.\n' +
      '  Fix: the store this image is the fork of wins host resolution (src/middleware.ts).',
  ).toEqual([]);
});

test('★ the root answers this shop even when NO host claims a store — the production shape', async () => {
  // `read.store.by_host` resolves ONE store per authority, and the ROOT store of the box claims it
  // (bin/store-host.mjs). The café therefore claims none, and before this rule its own subdomain answered
  // the clean 404 below instead of its home.
  resolveStoreForHost.mockResolvedValue(undefined);

  const to = routedTo(await middleware(request('/')));

  expect(
    to,
    `the café's own hostname answered ${to || '(passed through)'} instead of ${CAFE}'s home. ` +
      'A store that claims no host in the kernel directory is the NORMAL case for every store but the ' +
      "box's root one, so this is what a customer's subdomain actually gets.",
  ).toContain(CAFE);
  expect(to, 'the root of the shop must not be the not-found page').not.toContain('/404');
});

test('the own store WINS host resolution — it is not a fallback for when the host fails', async () => {
  // The distinction is the whole fix: a fallback leaves the bench (and any box whose map names another
  // store) serving the wrong shop, because there the host DOES resolve — to somebody else.
  await middleware(request('/'));
  expect(
    resolveStoreForHost,
    'the host was consulted although this image already names the shop it is the fork of',
  ).not.toHaveBeenCalled();
});

test('a path-scoped URL is still passed through untouched — that is how the bench reaches this shop', async () => {
  // The edge routes `/s/<café>/…` here (caddy/extra-local/coffee.caddy). The fork must not seize a URL
  // that already names its store, nor rewrite one that names another: `/s/…` is answered by the tree itself.
  for (const path of [`/s/${CAFE}/`, `/s/${SHOE_SHOP}/tenis`]) {
    expect(routedTo(await middleware(request(path))), path).toBe('');
  }
});

test('a box that has not been born yet degrades to host resolution, exactly as before', async () => {
  // `own-store.ts`'s doctrine, and this rule adopts it rather than inventing a second one: an absent or
  // sentinel id costs the shop its own address, never a page. Taking the vitrine down over a variable
  // `bin/box-up.sh` writes at step 3c would trade a visible defect for an outage.
  for (const value of [undefined, PENDING_STORE_SENTINEL, 'cafe']) {
    if (value === undefined) delete process.env[OWN_STORE_ENV];
    else process.env[OWN_STORE_ENV] = value;

    expect(routedTo(await middleware(request('/'))), `${OWN_STORE_ENV}=${value}`).toContain(
      SHOE_SHOP,
    );

    resolveStoreForHost.mockResolvedValueOnce(undefined);
    expect(
      routedTo(await middleware(request('/'))),
      `${OWN_STORE_ENV}=${value}, and no host claims a store either`,
    ).toContain('/404');
  }
});

test("★ the reference's landing stub is gone — a decoy at the root is worse than an empty one", async () => {
  const { existsSync, readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const appDir = join(import.meta.dirname, 'app');

  expect(
    existsSync(join(appDir, 'page.tsx')),
    'src/app/page.tsx is back. The root of this fork is served by the middleware, which rewrites `/` into ' +
      "this shop's tree before Next can reach a root page — so a file here renders for nobody and is the " +
      'exact decoy that sent the FORK-RAIZ-SEM-CHROME card after "the reference vitrine\'s chrome".',
  ).toBe(false);

  // Anti-vacuity, and the half that survives a rename: the stub's own words must not be anywhere under app/.
  const stub = readdirSync(appDir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
    .filter((f) => readFileSync(f, 'utf8').includes('Storefront-base'));
  expect(stub, 'the reference landing stub is still rendered from somewhere under app/').toEqual([]);
});
