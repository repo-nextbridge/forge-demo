// ★★ v031/G (item 25) — THE SEVEN CONTENT CHECKS, PROVEN AGAINST BOXES THAT ARE RIGHT AND BOXES THAT ARE NOT.
//
//   node --test bin/verify-content.test.mjs        (or: bash bin/test.sh)
//
// ⛔ NEVER AGAINST A REAL BOX. Every box here is FABRICATED from the tracked dataset by a fake read face written
// in THIS file — and written independently of `bin/verify-content.mjs`: publication and facet counting are
// re-implemented below on purpose, because a fake that called the verifier's own `assortmentOf`/
// `expectedFacets` would agree with any bug in them and prove nothing.
//
// What is held:
//   1 · a box born right from `seed/dataset/` is GREEN, end to end, through the real CLI over HTTP;
//   2 · a box born WITHOUT the idle shelf is RED — and the run names exactly which checks see it, and why the
//       others cannot (they grade things the idle shelf does not touch; see the test's own comment);
//   3 · each of the seven checks has its own sabotage, and goes red alone;
//   4 · a read that stops publishing a name is the verifier's ⚑ (exit 2), never a ✗ about the box.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { assortmentOf, CHECKS, gather, judge, loadDataset } from './verify-content.mjs';
import { ADMIN_WIDGETS_SLOT } from '../seed/widgets.mjs';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = join(HERE, 'verify-content.mjs');
const DS = loadDataset();
const OWNER = DS.storefront.owner;
const clone = (x) => structuredClone(x);

// ── the fake kernel — INDEPENDENT of the verifier ──────────────────────────────────────────────────────────

/** Publication as the seeder does it, re-written here: idle never; a handle list, or a category regex. */
function publish(store, products, idle) {
  const out = [];
  for (const p of products) {
    if (idle.includes(p.handle)) continue;
    if ((store.assortment.handles ?? []).includes(p.handle)) out.push(p);
    else if (store.assortment.categories !== undefined && new RegExp(store.assortment.categories).test(p.categoryPath)) out.push(p);
  }
  return out;
}

/** What `read.products?facets=1` counts, re-written here: per facetable key, products per String(value). */
function facetsOver(products, facetable) {
  const custom_fields = [];
  for (const key of facetable) {
    const tally = {};
    for (const p of products) {
      const v = p.metadata?.[key];
      if (v === undefined || v === null || v === '') continue;
      tally[String(v)] = (tally[String(v)] ?? 0) + 1;
    }
    const values = Object.entries(tally).map(([value, count]) => ({ value, count }));
    if (values.length) custom_fields.push({ key, values });
  }
  return { options: [], custom_fields, price: null, brands: [] };
}

const doc = (p, i) => ({
  product_id: `prod_${i}`,
  handle: p.handle,
  title: p.title,
  status: 'active',
  metadata: p.metadata ?? {},
  media: p.media?.length ? p.media : p.skus.flatMap((s) => s.media ?? []),
  skus: p.skus.map((s, j) => ({ id: `sku_${i}_${j}`, code: s.code, amount: s.amount, is_default: Boolean(s.is_default) })),
  categories: [{ category_id: `cat_${p.categoryPath}`, path: p.categoryPath, is_primary: true }],
  available: true,
});

const SEEDER_SCOPES = ['catalog.category.write', 'catalog.product.publish', 'catalog.product.write', 'shipping.write', 'inventory.adjust'];

/** The forgeco tenant as a birth from `ds` leaves it. `idleShelf: false` = the box of a dataset with no shelf. */
function bornBox(ds = DS, { idleShelf = true } = {}) {
  const idle = idleShelf ? (ds.catalog.idle_shelf?.handles ?? []) : [];
  const ids = new Map(ds.catalog.products.map((p, i) => [p.handle, i]));
  const tenantStores = ['forge', 'outlet'];
  const stores = tenantStores.map((h) => ({ id: `sto_${h}`, handle: h }));
  const published = {};
  for (const s of ds.catalog.stores.filter((s) => tenantStores.includes(s.handle))) {
    published[`sto_${s.handle}`] = publish(s, ds.catalog.products, idle).map((p) => doc(p, ids.get(p.handle)));
  }
  const forgeDocs = published[`sto_${OWNER}`];
  const admin = (ds.storefront.admin_widgets ?? []).concat('subscriptions/latest_subscriptions').map((name, i) => ({
    extension_id: name.split('/')[0], component: name.split('/')[1], declared_target: ADMIN_WIDGETS_SLOT, target: ADMIN_WIDGETS_SLOT,
    position: i, enabled: true, has_placement: true, placement_id: `plc_admin_${i}`, config: {}, active: true,
  }));
  const shelves = (ds.storefront.shelves ?? []).map((s, i) => ({
    extension_id: 'shelves', component: 'shelf', declared_target: s.slot, target: s.slot, position: i, enabled: true,
    has_placement: true, placement_id: `plc_shelf_${i}`, config: { ...s.config }, active: true,
  }));
  return {
    stores,
    published,
    categories: Object.fromEntries(ds.catalog.categories.map((c, i) => [`cat_${i}`, { name: c.name, path: c.path, status: 'active', icon_media: c.icon_provider_key ?? null, icon_kind: c.icon_provider_key ? 'image' : null }])),
    reviews: Object.keys(ds.showcase.reviews ?? {}).flatMap((h) => {
      const d = forgeDocs.find((p) => p.handle === h);
      return d ? [{ id: `rev_${h}`, created_at: '2026-10-07T00:00:00Z', product_id: d.product_id, rating: 5, body: 'ok', author: 'A', verified: true, status: 'approved' }] : [];
    }),
    simulator: { card_rules: JSON.stringify(ds.storefront.payment_simulator.card_rules), card_default_outcome: ds.storefront.payment_simulator.card_default_outcome, pix_mode: 'manual' },
    installed: [{ installation_id: 'ins_1', extension_id: 'demo-data', status: 'active', scopes: [...SEEDER_SCOPES] }],
    customFields: ds.customFields.map((f, i) => ({ id: `cfd_${i}`, owner_entity: 'product', key: f.key, type: f.type, required: false, options: [], facetable: Boolean(f.facetable), source: 'app:demo-data', status: 'active', label: f.key, pii: null })),
    facetable: ds.customFields.filter((f) => f.facetable).map((f) => f.key),
    composition: { [`sto_${OWNER}`]: [...shelves, ...admin], sto_outlet: [...admin] },
    pages: [
      ...(ds.storefront.pages ?? []).map((p, i) => ({ id: `pg_${i}`, store_id: `sto_${OWNER}`, slug: p.slug, title: p.title, template_key: null, published: true, archived_at: null })),
      { id: 'pg_qa', store_id: `sto_${OWNER}`, slug: ds.storefront.qa_draft_page.slug, title: ds.storefront.qa_draft_page.title, template_key: null, published: false, archived_at: null },
    ],
    promotions: (ds.promotions ?? []).map((p, i) => ({ id: `promo_${i}`, name: p.name, label: p.label, state: 'active' })),
  };
}

/** The read door over a fabricated box — the same routes the CLI calls. `drop` removes one key from one read. */
function doorOver(box, { drop } = {}) {
  const strip = (read, rows) => (drop?.read === read ? rows.map((r) => { const c = { ...r }; delete c[drop.key]; return c; }) : rows);
  const page = (all, q) => {
    const limit = Number(q.limit ?? 24);
    const p = Number(q.page ?? 1);
    return { items: all.slice((p - 1) * limit, p * limit), page: p, limit, total: all.length };
  };
  return {
    internal: async (name, q = {}) => {
      if (name === 'stores') return strip('stores', box.stores.map((s) => ({ ...s, name: s.handle })));
      if (name === 'extension_composition') return strip('extension_composition', box.composition[q.store] ?? []);
      if (name === 'extension_records') return page(strip('extension_records', q.extension === 'reviews' ? box.reviews : []), q);
      if (name === 'extension_config') return q.extension === 'payment-reference' ? box.simulator : null;
      if (name === 'installed_extensions') return strip('installed_extensions', box.installed);
      if (name === 'custom_field_definitions') return strip('custom_field_definitions', box.customFields);
      if (name === 'pages') return page(strip('pages', box.pages.filter((p) => !q.store_id || p.store_id === q.store_id)), q);
      if (name === 'promotions_admin') {
        const off = Number(q.offset ?? 0);
        return { items: strip('promotions_admin', box.promotions).slice(off, off + Number(q.limit ?? 25)), total: box.promotions.length };
      }
      throw new Error(`the fake face does not serve internal/${name}`);
    },
    publicRead: async (name, q = {}) => {
      if (name === 'categories') return Object.fromEntries(Object.entries(box.categories).map(([k, v]) => [k, drop?.read === 'categories' ? (({ [drop.key]: _, ...rest }) => rest)(v) : v]));
      if (name === 'products') {
        let rows = box.published[q.store] ?? null;
        if (!rows) return null;
        if (q.category) rows = rows.filter((p) => p.categories.some((c) => c.path === q.category || c.path.startsWith(`${q.category}.`)));
        const answer = page(strip('products', rows), q);
        if (q.facets === '1') answer.facets = box.facetsOverride?.[q.category ?? ''] ?? facetsOver(rows, box.facetable);
        return answer;
      }
      throw new Error(`the fake face does not serve ${name}`);
    },
  };
}

/** `gather` + `judge` in process: what the CLI does, without HTTP. Returns the judgement, keyed by check id. */
async function verdictOf(box, ds = DS, { carriesDataset = true, drop } = {}) {
  const collected = await gather(ds, doorOver(box, { drop }), { tenant: 'forgeco', carriesDataset });
  const { report, failures } = judge(ds, collected);
  const by = Object.fromEntries(report.map((r) => [r.check.id, r]));
  return { by, failures, red: report.filter((r) => r.bad).map((r) => r.check.id) };
}

/** The same box behind a real HTTP server, for the CLI. */
async function serve(box, opts) {
  const door = doorOver(box, opts);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const q = Object.fromEntries(url.searchParams);
    const internal = url.pathname.startsWith('/v1/read/internal/');
    const name = url.pathname.replace(internal ? '/v1/read/internal/' : '/v1/read/', '');
    try {
      const body = internal ? await door.internal(name, q) : await door.publicRead(name, q);
      if (body === null) {
        res.writeHead(404, { 'content-type': 'application/json' });
        return res.end('{"error":{"kind":"not_found"}}');
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    } catch (error) {
      res.writeHead(500);
      res.end(String(error?.message ?? error));
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { api: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

async function cli(api, tenant = 'forgeco') {
  try {
    const { stdout } = await run(process.execPath, [VERIFIER, '--api', api, '--tenant', tenant], {
      env: { ...process.env, FORGE_OPERATOR_TOKEN: 'tok_fake' },
      maxBuffer: 16 * 1024 * 1024,
    });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

// ── the tests ──────────────────────────────────────────────────────────────────────────────────────────────

test('⟂ ANTI-VACUUM — seven checks, named after the seven tests that left the product', () => {
  assert.deepEqual(CHECKS.map((c) => c.id), [
    'demo-close', 'demo-close.e2e', 'demo-coherence.e2e', 'demo-facets.e2e', 'idle-shelf', 'seed-curation-inventory', 'admin-widget-order-per-tenant.e2e',
  ]);
  assert.ok(DS.catalog.products.length > 2000, 'the tracked dataset is not the shoe catalogue');
  assert.ok((DS.catalog.idle_shelf?.handles ?? []).length > 0, 'the tracked dataset declares no idle shelf');
});

test('the assortment rule: `.` sells everything but the idle shelf, a handle list sells exactly itself', () => {
  const products = [{ handle: 'a', categoryPath: 'x' }, { handle: 'b', categoryPath: 'y.z' }, { handle: 'c', categoryPath: 'y' }];
  assert.deepEqual(assortmentOf({ assortment: { categories: '.' } }, products, ['b']).map((p) => p.handle), ['a', 'c']);
  assert.deepEqual(assortmentOf({ assortment: { handles: ['c'] } }, products).map((p) => p.handle), ['c']);
});

test('★★★ a box born RIGHT from seed/dataset is green — every one of the seven, end to end through the CLI', async () => {
  const face = await serve(bornBox());
  try {
    const { code, out } = await cli(face.api);
    for (const id of CHECKS.map((c) => c.id)) assert.match(out, new RegExp(`✓ \\[${id.replace('.', '\\.')}\\]`), out);
    assert.match(out, /VERDICT: the content is what the dataset declares\./, out);
    assert.equal(code, 0, out);
  } finally {
    face.close();
  }
});

test('★★★ DoD G·8 — a box born WITHOUT the idle shelf is RED, and the run says which checks saw it', async () => {
  // ⚠️ THE SPEC SAYS "the 7 checks red on a box without the idle_shelf". MEASURED HERE: the box publishes the
  // thirteen it should hold back, and THREE checks see that, because three of them grade what is published:
  // `idle-shelf` (thirteen on sale), `demo-coherence.e2e` (the window is not the assortment) and
  // `demo-facets.e2e` (every listing counts thirteen too many). The other four grade icons, reviews and the
  // card ficha (`demo-close`, `demo-close.e2e`), the curation inventory and the admin board — none of which the
  // idle shelf touches. Making them red on this box would take a shared precondition that turns every check
  // red together, i.e. ONE check wearing seven names. So the run is red, the three are named, the four are
  // asserted GREEN (so a change that silently made them depend on it would show), and each of the seven has
  // its OWN sabotage below.
  const face = await serve(bornBox(DS, { idleShelf: false }));
  try {
    const { code, out } = await cli(face.api);
    assert.equal(code, 1, out);
    for (const id of ['idle-shelf', 'demo-coherence.e2e', 'demo-facets.e2e']) assert.match(out, new RegExp(`✗ \\[${id.replace('.', '\\.')}\\]`), out);
    for (const id of ['demo-close', 'demo-close.e2e', 'seed-curation-inventory', 'admin-widget-order-per-tenant.e2e'])
      assert.match(out, new RegExp(`✓ \\[${id.replace('.', '\\.')}\\]`), out);
    assert.match(out, /no shop of this tenant publishes an idle product — ON SALE:/, out);
    assert.match(out, /NOT IN THE ASSORTMENT/, out);
  } finally {
    face.close();
  }
});

test('★★ and a DATASET with no idle shelf is red at its own check — the declaration itself is gone', async () => {
  const ds = clone(DS);
  delete ds.catalog.idle_shelf;
  const { red, by } = await verdictOf(bornBox(ds), ds);
  assert.ok(red.includes('idle-shelf'), JSON.stringify(by['idle-shelf']));
  assert.match(JSON.stringify(by['idle-shelf'].lines), /idle_shelf is ABSENT/);
});

// ── one sabotage per check, each alone ─────────────────────────────────────────────────────────────────────

const onlyRed = async (box, ds, id) => {
  const v = await verdictOf(box, ds);
  assert.deepEqual(v.red, [id], `expected ONLY ${id} red, got ${v.red.join(', ') || 'nothing'}`);
  return v.by[id];
};

test('SABOTAGE 1 · demo-close — a root category served WITHOUT its icon', async () => {
  const box = bornBox();
  const root = Object.values(box.categories).find((c) => c.path === 'botas');
  root.icon_media = null;
  const r = await onlyRed(box, DS, 'demo-close');
  assert.match(JSON.stringify(r.lines), /iconless on the box: botas/);
});

test('SABOTAGE 2 · demo-close.e2e — the simulator ficha was never written', async () => {
  const box = bornBox();
  box.simulator = null;
  const r = await onlyRed(box, DS, 'demo-close.e2e');
  assert.match(JSON.stringify(r.lines), /payment-reference has NO config/);
});

test('SABOTAGE 3 · demo-coherence.e2e — one published product lost its photo', async () => {
  const box = bornBox();
  box.published[`sto_${OWNER}`][0].media = [];
  const r = await onlyRed(box, DS, 'demo-coherence.e2e');
  assert.match(JSON.stringify(r.lines), /1 without media/);
});

test('SABOTAGE 4 · demo-facets.e2e — a listing that lost an axis', async () => {
  const box = bornBox();
  const forge = box.published[`sto_${OWNER}`].filter((p) => p.categories[0].path.startsWith('tenis.'));
  const f = facetsOver(forge, box.facetable);
  f.custom_fields = f.custom_fields.filter((c) => c.key !== 'genero');
  box.facetsOverride = { tenis: f };
  const r = await onlyRed(box, DS, 'demo-facets.e2e');
  assert.match(JSON.stringify(r.lines), /genero ABSENT on the box/);
});

test('SABOTAGE 5 · idle-shelf — a hand-picked shelf the criterion would not choose', async () => {
  const ds = clone(DS);
  const handles = ds.catalog.idle_shelf.handles;
  const stranger = ds.catalog.products.find((p) => p.categoryPath === ds.catalog.products.find((q) => q.handle === handles[0]).categoryPath && p.handle !== handles[0] && p.skus.length > 1);
  handles[0] = stranger.handle;
  const r = await onlyRed(bornBox(ds), ds, 'idle-shelf');
  assert.match(JSON.stringify(r.lines), /derived .* declared/);
});

test('SABOTAGE 6 · seed-curation-inventory — a curated page that quietly stopped being declared', async () => {
  const ds = clone(DS);
  ds.storefront.pages = ds.storefront.pages.filter((p) => p.slug !== 'faq');
  const r = await onlyRed(bornBox(ds), ds, 'seed-curation-inventory');
  assert.match(JSON.stringify(r.lines), /CHANGED: the institutional pages/);
});

test('SABOTAGE 6b · seed-curation-inventory — the QA draft is PUBLISHED on the box', async () => {
  const box = bornBox();
  box.pages.find((p) => p.slug === DS.storefront.qa_draft_page.slug).published = true;
  await onlyRed(box, DS, 'seed-curation-inventory');
});

test('SABOTAGE 7 · admin-widget-order — the install order decided the board (subscriptions on top)', async () => {
  const box = bornBox();
  const rows = box.composition[`sto_${OWNER}`].filter((r) => r.target === ADMIN_WIDGETS_SLOT);
  for (const r of rows) r.position = r.extension_id === 'subscriptions' ? -1 : r.position;
  const r = await onlyRed(box, DS, 'admin-widget-order-per-tenant.e2e');
  assert.match(JSON.stringify(r.lines), /forgeco's admin home/);
});

test('★ a read that stops publishing `icon_media` is the verifier\'s WRONG QUESTION (exit 2), never a ✗', async () => {
  const face = await serve(bornBox(), { drop: { read: 'categories', key: 'icon_media' } });
  try {
    const { code, out } = await cli(face.api);
    assert.match(out, /⚑ WRONG QUESTION — read\.categories does not publish `icon_media`/, out);
    assert.ok(!out.includes('✗'), out);
    assert.equal(code, 2, out);
  } finally {
    face.close();
  }
});

test('a tenant that does not carry the dataset is judged on what IS its own: the inventory and its admin board', async () => {
  const v = await verdictOf(bornBox(), DS, { carriesDataset: false });
  for (const id of ['demo-close.e2e', 'demo-coherence.e2e', 'demo-facets.e2e', 'idle-shelf']) assert.ok(v.by[id].skip, `${id} was judged`);
  assert.equal(v.failures, 0);
  assert.ok(v.by['admin-widget-order-per-tenant.e2e'].lines[0].ok);
});
