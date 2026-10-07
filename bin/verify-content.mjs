#!/usr/bin/env node
// ★★ v031/G (item 25) — WHAT THE DEMO'S CONTENT PROMISES, ASKED OF THE BOX THAT WAS BORN FROM IT.
//
//   FORGE_OPERATOR_TOKEN=… node bin/verify-content.mjs --api http://localhost:8200 --tenant forgeco
//
// One tenant per run, like `bin/verify-seed.mjs` and for the same reason: the internal read face resolves the
// tenant from the CREDENTIAL. Step 12 of `bin/box-up.sh` and `bin/birth-remote.sh` runs it after verify-seed,
// once per tenant.
//
// ── WHY IT EXISTS ─────────────────────────────────────────────────────────────────────────────────────────
// Until v0.3.1 the PRODUCT carried seven tests that asserted the CONTENT of this demo — not a mechanism of the
// product, but facts about one shoe shop's catalogue (decision 12 of `docs/specs/v04/v031-fixes-e-demo-sai.md`):
//
//   demo-close.demo · demo-close.e2e.demo · demo-coherence.e2e.demo · demo-facets.e2e.demo · idle-shelf.demo ·
//   seed-curation-inventory.demo · admin-widget-order-per-tenant.e2e
//
// The product stops carrying the demo, so they would have stopped existing. Their INTENT is re-made here — not
// their harness (Testcontainers, a seeded Postgres): each one now asks the dataset this repository tracks
// (`seed/dataset/`) AND the box that was born from it, through the same read door `bin/verify-seed.mjs` uses.
// That is strictly more than the originals graded: four of them were dataset-only, and the three e2e ones ran
// on a database a test had seeded, never on the box a person opens.
//
// ★ EVERY EXPECTATION IS DERIVED FROM THE DATASET, never typed — with ONE deliberate exception, the curation
// inventory (check 6), which IS a measurement of the old tree and says so.
//
// ⚠️ THE JUDGEMENT IS PURE (`judge`, below) and the HTTP half only gathers (`gather`). The pure half is what
// `bin/verify-content.test.mjs` grades over fabricated boxes, so a check can be proven red without a box.
//
// ⚠️ NAMES OFF A LIVE ANSWER GO THROUGH `field()`, the rule `bin/verify-seed.mjs` paid for on 03/09: a key the
// read did not publish is THIS FILE's wrong question (⚑, exit 2), never a ✗ about the box.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TRACKED_DATASET_DIR } from './dataset-provenance.mjs';
import { ADMIN_WIDGETS_SLOT, adminWidgetsIn, widgetName, widgetPrefixProblem } from '../seed/widgets.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── the dataset ─────────────────────────────────────────────────────────────────────────────────────────────

/** The tracked dataset, read once. `dir` is a parameter so a test can stage a sabotaged copy. */
export function loadDataset(dir = join(ROOT, TRACKED_DATASET_DIR)) {
  const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
  return {
    catalog: read('catalog.json'),
    storefront: read('storefront.json'),
    showcase: read('showcase.json'),
    customers: read('customers.json'),
    promotions: read('promotions.json'),
    customFields: read('custom-fields.json'),
  };
}

/** The store-assortment rule, re-stated from the product's `packages/seed-dataset/src/assortment.ts`
 *  (`assortmentOf`): idle handles never; listed handles; or a categoryPath matching the `categories` regex.
 *  ⚠️ A second copy of a product rule — accepted because this repository cannot import that package, and it is
 *  four lines; `bin/verify-content.test.mjs` pins it against the documented shape (`.` sells everything). */
export function assortmentOf(store, products, idle = []) {
  const skip = new Set(idle);
  const wanted = new Set(store.assortment?.handles ?? []);
  const rule = store.assortment?.categories !== undefined ? new RegExp(store.assortment.categories) : null;
  return products.filter((p) => !skip.has(p.handle) && (wanted.has(p.handle) || (rule?.test(p.categoryPath) ?? false)));
}

const idleOf = (ds) => ds.catalog.idle_shelf?.handles ?? [];
const owner = (ds) => ds.storefront.owner;
const inSubtree = (path, root) => path === root || path.startsWith(`${root}.`);

/** handle → the products this dataset says that shop publishes. Only the dataset's OWN products (the café's
 *  coffees are listed by handle but defined elsewhere, and belong to another tenant). */
export function expectedPublished(ds) {
  const out = new Map();
  for (const store of ds.catalog.stores ?? []) out.set(store.handle, assortmentOf(store, ds.catalog.products, idleOf(ds)));
  return out;
}

/** The facet axes a listing of `products` must show: facetable key → (String(value) → product count). */
export function expectedFacets(ds, products) {
  const keys = ds.customFields.filter((f) => f.owner_entity === 'product' && f.facetable).map((f) => f.key);
  const axes = new Map();
  for (const key of keys) {
    const counts = new Map();
    for (const p of products) {
      const v = p.metadata?.[key];
      if (v === undefined || v === null || v === '') continue;
      counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
    }
    if (counts.size > 0) axes.set(key, counts);
  }
  return axes;
}

/** The category paths whose facets are asked of the box: the whole store (''), every root, and every category
 *  a shelf of the window reads. Derived, so a re-curation moves the questions with it. */
export function facetPaths(ds) {
  const roots = ds.catalog.categories.filter((c) => !c.path.includes('.')).map((c) => c.path);
  const shelves = (ds.storefront.shelves ?? []).filter((s) => s.config?.source === 'category').map((s) => s.config.source_category);
  return ['', ...new Set([...roots, ...shelves])];
}

// ── 5 · the idle shelf's criterion (re-derived, as the original did) ───────────────────────────────────────

/** Whether a leaf is off limits to the idle shelf — rule 2 of `catalog.json#idle_shelf._why`, read off the
 *  features that read those leaves, never typed: a home shelf's LIVE category (exact path, as the original
 *  test held it), and every leaf the buy-together generator draws partners from (`showcase.pairing.rules[].with`,
 *  a regex — the same one the app applies). */
function offLimits(ds) {
  const shelves = new Set((ds.storefront.shelves ?? []).filter((s) => s.config?.source === 'category').map((s) => s.config.source_category));
  const partners = (ds.showcase.pairing?.rules ?? []).map((r) => new RegExp(r.with));
  return (path) => shelves.has(path) || partners.some((re) => re.test(path));
}

/** Every product handle the instance's curation names anywhere — rule 3. */
export function curatedHandles(ds) {
  const named = new Set(Object.keys(ds.showcase.reviews ?? {}));
  for (const pair of ds.showcase.pairs ?? []) {
    named.add(pair.base);
    named.add(pair.paired);
  }
  for (const shelf of ds.storefront.shelves ?? []) {
    const handles = shelf.config?.source_handles;
    if (typeof handles === 'string') for (const h of handles.split(',')) named.add(h.trim());
  }
  for (const promo of ds.promotions ?? []) {
    if (promo.product) named.add(promo.product);
    for (const item of promo.benefit?.items ?? []) if (item.handle) named.add(item.handle);
  }
  for (const store of ds.catalog.stores ?? []) for (const h of store.assortment?.handles ?? []) named.add(h);
  return named;
}

/** The criterion of `catalog.json#idle_shelf._why`, executed: the most crowded leaves outside the off-limits
 *  ones (ties by path), and in each the eligible product with the fewest variants (ties by handle). */
export function deriveIdleShelf(ds, size) {
  const products = ds.catalog.products;
  const count = new Map();
  for (const p of products) count.set(p.categoryPath, (count.get(p.categoryPath) ?? 0) + 1);
  const banned = offLimits(ds);
  const leaves = [...count.keys()]
    .filter((path) => !banned(path))
    .sort((a, b) => count.get(b) - count.get(a) || (a < b ? -1 : 1))
    .slice(0, size);
  const curated = curatedHandles(ds);
  return leaves.map((leaf) => {
    const pick = products
      .filter((p) => p.categoryPath === leaf && !curated.has(p.handle) && p.metadata?.genero !== 'Infantil' && p.skus.length > 1)
      .sort((a, b) => a.skus.length - b.skus.length || (a.handle < b.handle ? -1 : 1))[0];
    return pick?.handle ?? `(no eligible product in ${leaf})`;
  });
}

// ── 6 · the curation inventory — a MEASUREMENT of the old tree, kept as such ───────────────────────────────
//
// Taken by the product's `seed-curation-inventory.demo.test.ts` off `main @ d29e7f6f` (the commit before the
// curation left the kernel), as it stood at `release/v0.3.0`. It is the one list in this file that is typed,
// because it is not an expectation derived from anything: it is what the old tree HELD, and the question is
// whether it all still arrives. ⚠️ WHEN THE CURATION LEGITIMATELY CHANGES this goes red, and that is the
// point: update the list in the SAME commit and say what changed.
export const INVENTORY = {
  hero_email: 'hero.demo@example.com',
  hero_order_states: ['paid', 'paid', 'preparing', 'shipped', 'delivered'],
  hero_tracking_codes: ['BR584201377SP', 'BR112233445SP'],
  origin_name: 'CD Barueri',
  shopper_count: 17,
  shopper_orders_total: 34,
  shelf_titles: ['Corra para não perder', 'Seus pequenos vão amar', 'Botas que acabaram de chegar', 'Promoção para os pequenos'],
  banner_names: ['grande-jordan', 'grande-rosa', 'social2-quadrado', 'sportswear', 'bota'],
  page_slugs: ['sobre', 'trocas-e-devolucoes', 'entrega', 'faq', 'contato', 'privacidade', 'termos'],
  qa_draft_slug: 'rascunho-qa',
  card_suffixes: ['0001', '0002', '0003', '0004', '0005', '0006'],
  card_outcomes: ['decline', 'decline', 'decline', 'decline', 'decline', 'timeout'],
  card_decline_reasons: ['insufficient_funds', 'card_rejected', 'invalid_data', 'expired', 'fraud_suspected'],
  promotion_count: 16,
};

// ── the judgement — pure: (dataset, box) → lines ─────────────────────────────────────────────────────────────

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (xs) => [...xs].sort();
const missingFrom = (want, have) => want.filter((x) => !have.has(x));
const list = (xs, n = 6) => `${xs.slice(0, n).join(', ')}${xs.length > n ? `, … (${xs.length})` : ''}`;

/**
 * The seven checks, in the order of the originals' names. Each returns `{ ok, label, detail }` lines; a check
 * that has no business on this tenant returns `{ skip: why }` (reported, never counted as green).
 *
 * `box` is what `gather` collected:
 *   carriesDataset, stores [{id,handle}], published {handle: ProductDoc[]}, categories {id: {path,icon_media,…}},
 *   reviews [{product_id}], simulator (extension_config row | null), installed [{extension_id,scopes}],
 *   customFields [{key,source,facetable}], facets {path: {total, custom_fields}}, composition {handle: rows},
 *   pages [{store_id,slug,title,published}], promotions [{name}]
 */
export const CHECKS = [
  {
    id: 'demo-close',
    title: 'the close: tile icons, curated reviews, the card matrix',
    judge(ds, box) {
      const out = [];
      const roots = ds.catalog.categories.filter((c) => !c.path.includes('.'));
      const iconless = roots.filter((c) => !c.icon_provider_key).map((c) => c.path);
      out.push({ ok: roots.length > 0 && iconless.length === 0, label: 'every root category declares a tile icon', detail: roots.length === 0 ? 'the dataset declares NO root category' : iconless.length ? `without: ${list(iconless)}` : `${roots.length} root(s)` });
      const served = new Map(Object.values(box.categories).map((c) => [c.path, c]));
      const dark = roots.filter((c) => !served.get(c.path)?.icon_media).map((c) => c.path);
      if (box.carriesDataset) out.push({ ok: dark.length === 0, label: 'the box serves every root WITH its icon («Compre por categoria» is never a text tile)', detail: dark.length ? `missing or iconless on the box: ${list(dark)}` : `${roots.length} root(s) served with an icon` });
      const catalog = new Set(ds.catalog.products.map((p) => p.handle));
      const curated = Object.keys(ds.showcase.reviews ?? {});
      const orphans = curated.filter((h) => !catalog.has(h));
      out.push({ ok: curated.length > 0 && orphans.length === 0, label: 'every curated review handle is a catalogue product', detail: curated.length === 0 ? 'the dataset curates NO review volume' : orphans.length ? `orphans: ${list(orphans)}` : `${curated.length} handle(s)` });
      const rules = ds.storefront.payment_simulator?.card_rules ?? [];
      const matrix = rules.map((r) => `${r.suffix}:${r.outcome}${r.decline_reason ? `/${r.decline_reason}` : ''}`);
      const declines = rules.filter((r) => r.outcome === 'decline');
      const wellFormed = rules.length > 0 && declines.every((r) => r.decline_reason) && new Set(rules.map((r) => r.suffix)).size === rules.length;
      out.push({ ok: wellFormed && ds.storefront.payment_simulator?.card_default_outcome === 'approve', label: 'the simulator card matrix: distinct suffixes, every decline gives a reason, anything else approves', detail: matrix.join(' · ') || 'the dataset declares NO card rule' });
      return out;
    },
  },
  {
    id: 'demo-close.e2e',
    title: 'the close, on the box: reviews were seeded, the simulator ficha was written',
    judge(ds, box) {
      if (!box.carriesDataset) return { skip: 'this tenant does not carry the dataset (seed/box.json)' };
      const out = [];
      const mine = box.published[owner(ds)] ?? [];
      const idByHandle = new Map(mine.map((p) => [p.handle, p.product_id]));
      const reviewed = new Set(box.reviews.map((r) => r.product_id));
      const curated = Object.keys(ds.showcase.reviews ?? {});
      const silent = curated.filter((h) => !reviewed.has(idByHandle.get(h)));
      out.push({ ok: curated.length > 0 && silent.length === 0, label: 'every curated review handle carries reviews on the box', detail: silent.length ? `no review for: ${list(silent)}` : `${curated.length} product(s), ${box.reviews.length} review row(s)` });
      const declared = ds.storefront.payment_simulator ?? {};
      const row = box.simulator;
      let live = null;
      try {
        live = row ? (typeof row.card_rules === 'string' ? JSON.parse(row.card_rules) : row.card_rules) : null;
      } catch {
        live = '(unparseable)';
      }
      out.push({ ok: row !== null && same(live, declared.card_rules), label: "the simulator's ficha holds the dataset's card rules", detail: row === null ? 'payment-reference has NO config on the box — the checkout cannot decline in the browser' : same(live, declared.card_rules) ? `${declared.card_rules.length} rule(s)` : `the box holds ${JSON.stringify(live)}` });
      out.push({ ok: row !== null && row.card_default_outcome === declared.card_default_outcome, label: 'and its default outcome', detail: `box ${row?.card_default_outcome ?? '(none)'} · dataset ${declared.card_default_outcome}` });
      return out;
    },
  },
  {
    id: 'demo-coherence.e2e',
    title: 'coherence: the window resolves, every product has its photo and its star, nothing extra',
    judge(ds, box) {
      if (!box.carriesDataset) return { skip: 'this tenant does not carry the dataset (seed/box.json)' };
      const out = [];
      const mine = box.published[owner(ds)] ?? [];
      const want = expectedPublished(ds).get(owner(ds)) ?? [];
      const have = new Set(mine.map((p) => p.handle));
      const wantSet = new Set(want.map((p) => p.handle));
      const absent = missingFrom([...wantSet], have);
      const extra = missingFrom([...have], wantSet);
      out.push({ ok: want.length > 0 && absent.length === 0 && extra.length === 0, label: `${owner(ds)} publishes exactly its assortment (no hand-made product, none missing)`, detail: `box ${have.size} · dataset ${wantSet.size}${absent.length ? ` · MISSING ${list(absent)}` : ''}${extra.length ? ` · NOT IN THE ASSORTMENT ${list(extra)}` : ''}` });
      const paths = (ds.storefront.shelves ?? []).filter((s) => s.config?.source === 'category').map((s) => s.config.source_category);
      const empty = paths.filter((path) => !mine.some((p) => p.categories.some((c) => inSubtree(c.path, path))));
      out.push({ ok: paths.length > 0 && empty.length === 0, label: 'every category shelf of the window resolves to products', detail: paths.length === 0 ? 'the window places NO category shelf' : empty.length ? `EMPTY: ${list(empty)}` : paths.join(', ') });
      const pairs = [...new Set((ds.showcase.pairs ?? []).flatMap((p) => [p.base, p.paired]))];
      const unpublished = pairs.filter((h) => !have.has(h));
      out.push({ ok: pairs.length > 0 && unpublished.length === 0, label: 'every curated buy-together handle is published', detail: unpublished.length ? `not published: ${list(unpublished)}` : `${pairs.length} handle(s)` });
      const bare = mine.filter((p) => p.media.length === 0).map((p) => p.handle);
      out.push({ ok: mine.length > 0 && bare.length === 0, label: 'no published product reaches the window without a photo', detail: bare.length ? `${bare.length} without media: ${list(bare)}` : `${mine.length} product(s)` });
      const declared = new Map(ds.catalog.products.map((p) => [p.handle, p.skus.find((s) => s.is_default)?.code]));
      const wrong = mine.flatMap((p) => {
        const stars = p.skus.filter((s) => s.is_default).map((s) => s.code);
        return stars.length === 1 && stars[0] === declared.get(p.handle) ? [] : [`${p.handle} (${stars.join('+') || 'none'} ≠ ${declared.get(p.handle)})`];
      });
      out.push({ ok: wrong.length === 0, label: 'every published product has exactly one default SKU, the declared one', detail: wrong.length ? list(wrong, 4) : 'all stars where the dataset put them' });
      return out;
    },
  },
  {
    id: 'demo-facets.e2e',
    title: 'facets: the vocabulary is the app\'s, and every listing facets by what its products carry',
    judge(ds, box) {
      if (!box.carriesDataset) return { skip: 'this tenant does not carry the dataset (seed/box.json)' };
      const out = [];
      const declared = ds.customFields.filter((f) => f.owner_entity === 'product');
      const registry = new Map(box.customFields.map((d) => [d.key, d]));
      const wrongDefs = declared.filter((f) => registry.get(f.key)?.source !== 'app:demo-data' || registry.get(f.key)?.facetable !== Boolean(f.facetable)).map((f) => f.key);
      out.push({ ok: declared.length > 0 && wrongDefs.length === 0, label: 'every declared field is in the registry, materialized by the app, with its facetable flag', detail: wrongDefs.length ? `wrong or absent: ${list(wrongDefs)}` : `${declared.length} field(s), ${declared.filter((f) => f.facetable).length} facetable` });
      const seeder = box.installed.find((i) => i.extension_id === 'demo-data');
      out.push({ ok: Boolean(seeder) && !seeder.scopes.includes('custom_fields.write'), label: 'LEAST PRIVILEGE — the Seeder holds no custom_fields.write (the facets cost it no write scope)', detail: seeder ? sorted(seeder.scopes).join(' · ') : 'demo-data is not installed on this tenant' });
      const want = expectedPublished(ds).get(owner(ds)) ?? [];
      for (const path of facetPaths(ds)) {
        const products = path === '' ? want : want.filter((p) => inSubtree(p.categoryPath, path));
        const expected = expectedFacets(ds, products);
        const got = box.facets[path];
        const where = path || '(the whole store)';
        if (!got) {
          out.push({ ok: false, label: `facets of ${where}`, detail: 'the box answered no listing for it' });
          continue;
        }
        const gotAxes = new Map(got.custom_fields.map((c) => [c.key, new Map(c.values.map((v) => [v.value, v.count]))]));
        const wrong = [];
        if (got.total !== products.length) wrong.push(`total ${got.total} ≠ ${products.length}`);
        for (const key of new Set([...expected.keys(), ...gotAxes.keys()])) {
          const a = expected.get(key);
          const b = gotAxes.get(key);
          if (!a || !b) wrong.push(`${key} ${a ? 'ABSENT on the box' : 'is not an axis these products carry'}`);
          else if (!same(sorted([...a].map(([v, n]) => `${v}=${n}`)), sorted([...b].map(([v, n]) => `${v}=${n}`))))
            wrong.push(`${key}: box ${sorted([...b].map(([v, n]) => `${v}=${n}`)).join(',')} · dataset ${sorted([...a].map(([v, n]) => `${v}=${n}`)).join(',')}`);
        }
        out.push({ ok: products.length > 0 && wrong.length === 0, label: `facets of ${where}`, detail: wrong.length ? list(wrong, 3) : `${products.length} product(s) over ${expected.size} axis(es)` });
      }
      return out;
    },
  },
  {
    id: 'idle-shelf',
    title: 'the idle shelf: chosen by its stated criterion, and on sale in no shop',
    judge(ds, box) {
      if (!box.carriesDataset) return { skip: 'this tenant does not carry the dataset (seed/box.json)' };
      const out = [];
      const declared = idleOf(ds);
      out.push({ ok: declared.length > 0, label: 'the dataset declares an idle shelf', detail: declared.length ? `${declared.length} handle(s)` : 'catalog.json#idle_shelf is ABSENT — the stock screen\'s three alert states have no pool' });
      if (declared.length > 0) {
        const derived = deriveIdleShelf(ds, declared.length);
        out.push({ ok: same(derived, declared), label: 'the criterion of idle_shelf._why reproduces the list, in order', detail: same(derived, declared) ? 'derived = declared' : `derived ${list(derived, 3)} · declared ${list(declared, 3)}` });
        const leaves = new Set(declared.map((h) => ds.catalog.products.find((p) => p.handle === h)?.categoryPath));
        out.push({ ok: leaves.size === declared.length, label: 'no two come from the same category', detail: `${leaves.size} leaf(s) for ${declared.length} product(s)` });
        const curated = curatedHandles(ds);
        const named = declared.filter((h) => curated.has(h));
        out.push({ ok: named.length === 0, label: 'none of them is named by any curation', detail: named.length ? list(named) : 'none' });
      }
      // ★ THE BOX HALF, and the one a box born without the shelf fails: the pool `seed-history` builds the stock
      // screen from is "products NO shop publishes", so a published idle product is a pool that shrank.
      const idle = new Set(declared);
      const sold = box.stores.flatMap((s) => (box.published[s.handle] ?? []).filter((p) => idle.has(p.handle)).map((p) => `${p.handle}@${s.handle}`));
      out.push({ ok: declared.length > 0 && sold.length === 0, label: 'no shop of this tenant publishes an idle product', detail: sold.length ? `ON SALE: ${list(sold)}` : declared.length ? `${box.stores.length} shop(s) checked` : 'there is no shelf to keep off sale' });
      return out;
    },
  },
  {
    id: 'seed-curation-inventory',
    title: 'the curation inventory: what the old tree held is all still declared, and on the box',
    judge(ds, box) {
      const out = [];
      const I = INVENTORY;
      const c = ds.customers;
      const sf = ds.storefront;
      const facts = [
        ['the hero shopper', c.hero?.email === I.hero_email && same(c.hero?.orders.map((o) => o.advance_to), I.hero_order_states) && same(c.hero?.orders.flatMap((o) => (o.tracking ? [o.tracking.code] : [])), I.hero_tracking_codes)],
        ['the ship-from origin', c.origin?.name === I.origin_name],
        ['the seventeen and their order books', (c.shoppers ?? []).length === I.shopper_count && (c.shoppers ?? []).reduce((n, s) => n + s.orders.length, 0) === I.shopper_orders_total],
        ['the curated shelves', same((sf.shelves ?? []).map((s) => s.config.title), I.shelf_titles)],
        ['the banner tiles', same((sf.banners ?? []).flatMap((b) => b.media).map((t) => t.banner), I.banner_names)],
        ['the institutional pages', same((sf.pages ?? []).map((p) => p.slug), I.page_slugs)],
        ['the QA draft page (unpublished)', sf.qa_draft_page?.slug === I.qa_draft_slug && sf.qa_draft_page?.published === false],
        ['the card matrix', same((sf.payment_simulator?.card_rules ?? []).map((r) => r.suffix), I.card_suffixes) && same(sf.payment_simulator.card_rules.map((r) => r.outcome), I.card_outcomes) && same(sf.payment_simulator.card_rules.flatMap((r) => (r.decline_reason ? [r.decline_reason] : [])), I.card_decline_reasons)],
        ['the promotion bench', (ds.promotions ?? []).length === I.promotion_count && ds.promotions.every((p) => p.label?.length > 0 && p.benefit?.kind)],
      ];
      const lost = facts.filter(([, ok]) => !ok).map(([what]) => what);
      out.push({ ok: lost.length === 0, label: 'the dataset still declares everything the old tree held', detail: lost.length ? `CHANGED: ${lost.join(' · ')}` : `${facts.length} dimension(s)` });
      if (!box.carriesDataset) return out;
      const store = box.stores.find((s) => s.handle === owner(ds));
      const pages = box.pages.filter((p) => p.store_id === store?.id);
      const live = new Map(pages.map((p) => [p.slug, p]));
      const unpublished = (sf.pages ?? []).filter((p) => live.get(p.slug)?.published !== true || live.get(p.slug)?.title !== p.title).map((p) => p.slug);
      out.push({ ok: unpublished.length === 0, label: `${owner(ds)}'s institutional pages are published, with their titles`, detail: unpublished.length ? `wrong or absent: ${list(unpublished)}` : `${(sf.pages ?? []).length} page(s)` });
      const draft = live.get(sf.qa_draft_page?.slug);
      out.push({ ok: Boolean(draft) && draft.published === false, label: 'the QA draft exists and is NOT published', detail: draft ? `published=${draft.published}` : 'absent from the box' });
      const names = new Set(box.promotions.map((p) => p.name));
      const gone = (ds.promotions ?? []).map((p) => p.name).filter((n) => !names.has(n));
      out.push({ ok: gone.length === 0, label: 'every promotion scenario is on the box', detail: gone.length ? `absent: ${list(gone)}` : `${(ds.promotions ?? []).length} scenario(s)` });
      const placed = (box.composition[owner(ds)] ?? []).filter((r) => r.placement_id !== null && r.enabled === true && r.extension_id === 'shelves').map((r) => r.config?.title);
      const shelvesGone = (sf.shelves ?? []).map((s) => s.config.title).filter((t) => !placed.includes(t));
      out.push({ ok: shelvesGone.length === 0, label: 'every curated shelf is placed on the window, by title', detail: shelvesGone.length ? `not placed: ${list(shelvesGone)}` : `${placed.length} shelf block(s)` });
      return out;
    },
  },
  {
    id: 'admin-widget-order-per-tenant.e2e',
    title: 'the admin home opens on the declared order — for THIS tenant, whatever order its apps were installed in',
    judge(ds, box) {
      const read = adminWidgetsIn(ds.storefront, `${TRACKED_DATASET_DIR}/storefront.json`);
      if (read.declared === null) return [{ ok: false, label: 'the dataset\'s admin_widgets', detail: read.why }];
      const declared = read.declared ?? [];
      if (declared.length === 0) return [{ ok: false, label: 'the dataset declares an admin board', detail: 'admin_widgets is EMPTY — the order would be the install accident again' }];
      const anyStore = box.stores[0]?.handle;
      const rows = (box.composition[anyStore] ?? [])
        .filter((r) => r.target === ADMIN_WIDGETS_SLOT && r.placement_id !== null && r.enabled === true)
        .sort((a, b) => a.position - b.position);
      const board = rows.map(widgetName);
      const problem = board.length === 0 ? 'the board is EMPTY' : widgetPrefixProblem(rows, declared);
      return [{ ok: !problem, label: `${box.tenant}'s admin home opens with the declared ${declared.length}`, detail: problem ? `${problem} — board: ${list(board, 9)}` : board.slice(0, declared.length).join(' · ') }];
    },
  },
];

/** Run every check; the lines, and the count of failures. A check that throws is a failure that names itself —
 *  a judge must not be able to go quiet by crashing. */
export function judge(ds, box) {
  const report = [];
  let failures = 0;
  for (const check of CHECKS) {
    let result;
    try {
      result = check.judge(ds, box);
    } catch (error) {
      result = [{ ok: false, label: 'the check itself', detail: `threw: ${error?.message ?? error}` }];
    }
    if (!Array.isArray(result)) {
      report.push({ check, skip: result.skip });
      continue;
    }
    const bad = result.filter((l) => !l.ok).length;
    failures += bad;
    report.push({ check, lines: result, bad });
  }
  return { report, failures };
}

export function render({ report, failures }) {
  const out = [];
  for (const { check, skip, lines, bad } of report) {
    out.push(`${skip ? '·' : bad ? '✗' : '✓'} [${check.id}] ${check.title}`);
    if (skip) out.push(`    · not judged here — ${skip}`);
    for (const l of lines ?? []) out.push(`    ${l.ok ? '✓' : '✗'} ${l.label}${l.detail ? ` — ${l.detail}` : ''}`);
  }
  const red = report.filter((r) => r.bad).map((r) => r.check.id);
  out.push('');
  out.push(failures === 0 ? 'VERDICT: the content is what the dataset declares.' : `VERDICT: ${failures} ✗ in ${red.length} check(s): ${red.join(', ')}.`);
  return out.join('\n');
}

// ── the gathering — the box, through the read door ──────────────────────────────────────────────────────────

class WrongQuestion extends Error {
  constructor(read, key, row) {
    super(`read.${read} does not publish \`${key}\` (it published: ${row && typeof row === 'object' ? Object.keys(row).join(', ') : typeof row})`);
  }
}
/** One name off one live row — and a name that did not come back is this file's defect, never the box's. */
const field = (read) => (row, key) => {
  if (row === null || typeof row !== 'object' || !Object.hasOwn(row, key)) throw new WrongQuestion(read, key, row);
  return row[key];
};

/** Collect what `judge` needs. `door` = { internal(name, params) → json|null (null on 404), publicRead(…) }. */
export async function gather(ds, door, { tenant, carriesDataset }) {
  const rows = (p) => (Array.isArray(p) ? p : (p?.items ?? []));
  const store$ = field('stores');
  const stores = rows(await door.internal('stores')).map((s) => ({ id: store$(s, 'id'), handle: store$(s, 'handle') }));
  const box = { tenant, carriesDataset, stores, published: {}, categories: {}, reviews: [], simulator: null, installed: [], customFields: [], facets: {}, composition: {}, pages: [], promotions: [] };

  const product$ = field('products');
  const pages = async (read, params, pageSize = 100) => {
    const all = [];
    for (let page = 1; page <= 1000; page++) {
      const payload = await read({ ...params, limit: String(pageSize), page: String(page) });
      const batch = rows(payload);
      if (page > 1 && Number(payload?.page) !== page) throw new Error(`a read did not page by \`page\` (asked ${page})`);
      all.push(...batch);
      if (batch.length < pageSize) return all;
    }
    throw new Error('a read never ran out of pages');
  };
  for (const s of stores) {
    const items = await pages((q) => door.publicRead('products', { store: s.id, ...q }), {});
    box.published[s.handle] = items.map((p) => ({
      product_id: product$(p, 'product_id'),
      handle: product$(p, 'handle'),
      media: product$(p, 'media'),
      skus: product$(p, 'skus').map((k) => ({ code: field('products.skus')(k, 'code'), is_default: field('products.skus')(k, 'is_default') })),
      categories: product$(p, 'categories').map((c) => ({ path: field('products.categories')(c, 'path') })),
      metadata: product$(p, 'metadata'),
    }));
    box.composition[s.handle] = rows(await door.internal('extension_composition', { store: s.id })).map((r) => {
      const r$ = field('extension_composition');
      return { extension_id: r$(r, 'extension_id'), component: r$(r, 'component'), target: r$(r, 'target'), position: r$(r, 'position'), enabled: r$(r, 'enabled'), placement_id: r$(r, 'placement_id'), config: r$(r, 'config') };
    });
  }
  if (!carriesDataset) return box;

  const mine = stores.find((s) => s.handle === owner(ds));
  if (!mine) throw new Error(`this tenant carries the dataset and holds no store \`${owner(ds)}\` (it holds: ${stores.map((s) => s.handle).join(', ')})`);
  const cat$ = field('categories');
  for (const [id, c] of Object.entries((await door.publicRead('categories', { store: mine.id })) ?? {})) {
    box.categories[id] = { path: cat$(c, 'path'), icon_media: cat$(c, 'icon_media') };
  }
  box.reviews = (await pages((q) => door.internal('extension_records', { extension: 'reviews', model: 'review', ...q }), {}, 1000)).map((r) => ({ product_id: field('extension_records')(r, 'product_id') }));
  box.simulator = await door.internal('extension_config', { extension: 'payment-reference' });
  box.installed = rows(await door.internal('installed_extensions')).map((i) => ({ extension_id: field('installed_extensions')(i, 'extension_id'), scopes: field('installed_extensions')(i, 'scopes') }));
  box.customFields = rows(await door.internal('custom_field_definitions', { owner_entity: 'product' })).map((d) => {
    const d$ = field('custom_field_definitions');
    return { key: d$(d, 'key'), source: d$(d, 'source'), facetable: d$(d, 'facetable') };
  });
  for (const path of facetPaths(ds)) {
    const answer = await door.publicRead('products', { store: mine.id, facets: '1', limit: '1', ...(path ? { category: path } : {}) });
    const f = field('products.facets')(answer, 'facets');
    box.facets[path] = { total: field('products')(answer, 'total'), custom_fields: field('products.facets')(f, 'custom_fields') };
  }
  box.pages = (await pages((q) => door.internal('pages', { store_id: mine.id, ...q }), {})).map((p) => {
    const p$ = field('pages');
    return { store_id: p$(p, 'store_id'), slug: p$(p, 'slug'), title: p$(p, 'title'), published: p$(p, 'published') };
  });
  // `promotions_admin` pages by OFFSET (verify-seed measured it): a `page` it does not declare is dropped.
  for (let offset = 0; offset < 100_000; offset += 100) {
    const batch = rows(await door.internal('promotions_admin', { limit: '100', offset: String(offset) }));
    box.promotions.push(...batch.map((p) => ({ name: field('promotions_admin')(p, 'name') })));
    if (batch.length < 100) break;
  }
  return box;
}

// ── the CLI ───────────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const argOf = (name) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : undefined;
  };
  const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
  const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? '';
  const token = process.env.FORGE_OPERATOR_TOKEN ?? '';
  const fail = (m) => {
    process.stderr.write(`[verify-content] ${m}\n`);
    process.exit(2);
  };
  if (!api) fail('no API base. Pass --api http://… (or set FORGE_PUBLIC_ORIGIN).');
  if (!tenant) fail('no tenant. Pass --tenant <id>.');
  if (!token) fail('no FORGE_OPERATOR_TOKEN — the read face resolves the tenant from the credential.');
  const call = async (path, params, headers) => {
    const qs = new URLSearchParams(params ?? {}).toString();
    let res;
    try {
      res = await fetch(`${api}${path}${qs ? `?${qs}` : ''}`, { headers });
    } catch (error) {
      fail(`cannot reach ${api} — ${error?.message ?? error}. Nothing was measured.`);
    }
    if (res.status === 404) return null;
    if (!res.ok) fail(`${path} → HTTP ${res.status}. Nothing was measured.`);
    return res.json();
  };
  const door = {
    internal: (name, params) => call(`/v1/read/internal/${name}`, params, { authorization: `Bearer ${token}`, 'x-forge-tenant': tenant }),
    publicRead: (name, params) => call(`/v1/read/${name}`, params, {}),
  };
  const boxDecl = JSON.parse(readFileSync(join(ROOT, 'seed', 'box.json'), 'utf8'));
  const carriesDataset = boxDecl.tenants.find((t) => t.id === tenant)?.dataset === true;
  const ds = loadDataset();
  let box;
  try {
    box = await gather(ds, door, { tenant, carriesDataset });
  } catch (error) {
    if (error instanceof WrongQuestion) fail(`⚑ WRONG QUESTION — ${error.message}. The question is wrong, not the data.`);
    fail(`nothing was judged: ${error?.message ?? error}`);
  }
  const verdict = judge(ds, box);
  process.stdout.write(`THE CONTENT — ${tenant}${carriesDataset ? ` (carries ${TRACKED_DATASET_DIR})` : ''}\n${render(verdict)}\n`);
  process.exit(verdict.failures === 0 ? 0 : 1);
}
