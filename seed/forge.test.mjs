// The seed's own tests — `node --test 'seed/**/*.test.mjs'`. No runner is installed in this repo and none
// is added here:
// Node ships one, these are pure functions, and a dependency to assert four things would be the heavier
// choice.
//
// WHAT IS WORTH TESTING HERE, and it is deliberately not "the seed works". The seed is proven by running it
// against a box and counting what is in the store. What CANNOT be proven that way is the class of defect
// this slice found twice: a mechanism that is correct by coincidence and fails silently when the coincidence
// ends. So every test below breaks a coincidence:
//   · the paginator, against a read whose second page exists (the single-page version passed for a year);
//   · the mime, against a JPEG (the hard-coded `image/png` passed for six PNGs);
//   · the media resolver, against a key the manifest does not place (the alternative is an orphan ref);
//   · the category order, against a child declared before its parent.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  awaitQuietCatalogue,
  categoriesByDepth,
  mediaKeysOf,
  mimeOf,
  planProducts,
  resolveMediaFile,
} from './forge.mjs';
import { createReadAll } from './paginate.mjs';

/** The envelope reader `bin/seed.mjs` uses, and the failure it refuses to turn into an empty list. */
const rows = (payload) => {
  if (Array.isArray(payload)) return payload;
  for (const key of ['items', 'rows', 'data']) if (Array.isArray(payload?.[key])) return payload[key];
  throw new Error('unknown envelope');
};
const throwingFail = (message) => {
  throw new Error(message);
};

/** A read that answers `count` rows over pages of `limit`, the way the kernel's paginated reads do. */
function fakeRead(count, { withTotal = true } = {}) {
  const calls = [];
  const read = async (_name, params) => {
    const limit = Number(params.limit);
    const page = Number(params.page);
    calls.push({ limit, page });
    const start = (page - 1) * limit;
    const items = Array.from({ length: Math.max(0, Math.min(limit, count - start)) }, (_, i) => ({
      handle: `p${start + i}`,
    }));
    return withTotal ? { items, page, limit, total: count } : { items, page, limit };
  };
  return { read, calls };
}

// ── the paginator ──────────────────────────────────────────────────────────────────────────────────────

test('readAll walks EVERY page — the defect was a first page read as the whole catalogue', async () => {
  const { read, calls } = fakeRead(2790);
  const readAll = createReadAll({ read, rows, fail: throwingFail });
  const all = await readAll('products_admin');
  assert.equal(all.length, 2790);
  assert.equal(calls.length, 28); // 27 full pages of 100 + the short one
  assert.equal(all[0].handle, 'p0');
  assert.equal(all.at(-1).handle, 'p2789');
});

test('readAll ends on a SHORT page when the envelope carries no total', async () => {
  const { read } = fakeRead(250, { withTotal: false });
  const readAll = createReadAll({ read, rows, fail: throwingFail });
  assert.equal((await readAll('products_admin')).length, 250);
});

test('readAll asks for ONE page when everything fits — the old callers stay as cheap as they were', async () => {
  const { read, calls } = fakeRead(8);
  const readAll = createReadAll({ read, rows, fail: throwingFail });
  assert.equal((await readAll('products', { store: 'sto_x' })).length, 8);
  assert.equal(calls.length, 1);
});

test('readAll honours a caller limit (stock_levels caps at 200, not 100)', async () => {
  const { read, calls } = fakeRead(450);
  const readAll = createReadAll({ read, rows, fail: throwingFail });
  assert.equal((await readAll('stock_levels', { limit: '200' })).length, 450);
  assert.deepEqual(
    calls.map((c) => c.limit),
    [200, 200, 200],
  );
});

test('readAll REFUSES a read that never ends, instead of looping forever', async () => {
  const read = async (_name, params) => ({
    items: Array.from({ length: Number(params.limit) }, () => ({ handle: 'x' })),
    // no `total`, and every page is full — a read this script does not understand
  });
  const readAll = createReadAll({ read, rows, fail: throwingFail });
  await assert.rejects(() => readAll('endless'), /Refusing to loop/);
});

test('readAll treats a BARE ARRAY as the whole list — the reads that answer one have no page 2', async () => {
  // ⚠️ MEASURED, and it would have hung the second run. `read.internal.brands_admin` answers a plain array
  // and ignores `limit`/`page`: 351 brands come back whole, which is never "shorter than the limit" and
  // carries no `total`. Without the short circuit the walk asks page 2, is handed the same 351, and loops.
  let calls = 0;
  const read = async () => {
    calls += 1;
    return Array.from({ length: 351 }, (_, i) => ({ slug: `b${i}` }));
  };
  const readAll = createReadAll({ read, rows, fail: throwingFail });
  const all = await readAll('brands_admin');
  assert.equal(all.length, 351);
  assert.equal(calls, 1);
});

test('readAll never turns an unknown envelope into an empty list', async () => {
  const readAll = createReadAll({ read: async () => ({ nope: 1 }), rows, fail: throwingFail });
  await assert.rejects(() => readAll('weird'), /unknown envelope/);
});

// ── the mime ───────────────────────────────────────────────────────────────────────────────────────────

test('mimeOf reads the FILE, so the dataset JPEGs are not announced as PNG', () => {
  assert.equal(mimeOf('cover.jpg'), 'image/jpeg');
  assert.equal(mimeOf('color-marinho-1.JPEG'), 'image/jpeg');
  assert.equal(mimeOf('icon-tenis.png'), 'image/png');
  assert.equal(mimeOf('banner.webp'), 'image/webp');
});

test('mimeOf refuses what it does not know rather than guessing a content-type', () => {
  assert.equal(mimeOf('catalog.json'), null);
  assert.equal(mimeOf('no-extension'), null);
});

// ── the media resolver ─────────────────────────────────────────────────────────────────────────────────

const manifest = {
  icons: { tenis: '../categories/icon-tenis.png' },
  categoryBanners: { corrida: '../banners/banner-strip-corrida-1200x150.jpg' },
  products: {
    'adidas-golf-braided-stretch-belt': {
      cover: 'cover.jpg',
      gallery: ['gallery-2.jpg'],
      colors: { Marinho: ['color-marinho-1.jpg'] },
    },
  },
};
const where = { namespace: 'demo', manifest, artDir: '/ds/assets/catalog', photoDir: '/photos' };

test('a product photo key resolves into the PHOTO tree, a category icon into the SHARED art', () => {
  assert.equal(
    resolveMediaFile('demo/adidas-golf-braided-stretch-belt-cover.jpg', where),
    '/photos/adidas-golf-braided-stretch-belt/cover.jpg',
  );
  assert.equal(
    resolveMediaFile('demo/adidas-golf-braided-stretch-belt-color-marinho-1.jpg', where),
    '/photos/adidas-golf-braided-stretch-belt/color-marinho-1.jpg',
  );
  // ★ The split the platform's photos.ts header records: the override moves the tree, NEVER the shared art.
  assert.equal(resolveMediaFile('demo/category-tenis-icon.png', where), '/ds/assets/categories/icon-tenis.png');
  assert.equal(
    resolveMediaFile('demo/category-banner-corrida.jpg', where),
    '/ds/assets/banners/banner-strip-corrida-1200x150.jpg',
  );
});

test('a handle that is a PREFIX of another does not steal its photos — 99 pairs in the real dataset', () => {
  // ⚠️ MEASURED, and it killed a run. `…-little-kid-big-kid` is a strict prefix of
  // `…-little-kid-big-kid-adult`, so a scan that returns on the FIRST prefix match looks for the adult's
  // `cover.jpg` in the kid's file list, does not find it, and answers null — a refusal for a photo that is
  // on disk. The longer handle wins, and the caller's own handle wins over both.
  const twins = {
    icons: {},
    categoryBanners: {},
    products: {
      'bed-stu-aiken': { cover: 'cover.jpg' },
      'bed-stu-aiken-9554019': { cover: 'cover.jpg', gallery: ['gallery-2.jpg'] },
    },
  };
  const w = { namespace: 'demo', manifest: twins, artDir: '/ds/assets/catalog', photoDir: '/photos' };

  assert.equal(resolveMediaFile('demo/bed-stu-aiken-cover.jpg', w), '/photos/bed-stu-aiken/cover.jpg');
  assert.equal(
    resolveMediaFile('demo/bed-stu-aiken-9554019-cover.jpg', w),
    '/photos/bed-stu-aiken-9554019/cover.jpg',
  );
  assert.equal(
    resolveMediaFile('demo/bed-stu-aiken-9554019-gallery-2.jpg', w),
    '/photos/bed-stu-aiken-9554019/gallery-2.jpg',
  );
  // The caller's own handle is the exact answer and never has to guess.
  assert.equal(
    resolveMediaFile('demo/bed-stu-aiken-9554019-cover.jpg', { ...w, hint: 'bed-stu-aiken-9554019' }),
    '/photos/bed-stu-aiken-9554019/cover.jpg',
  );
});

test('a key the manifest does not place resolves to NULL — the caller refuses instead of writing an orphan ref', () => {
  assert.equal(resolveMediaFile('demo/adidas-golf-braided-stretch-belt-gallery-9.jpg', where), null);
  assert.equal(resolveMediaFile('demo/never-heard-of-it-cover.jpg', where), null);
  assert.equal(resolveMediaFile('demo/category-sandalias-icon.png', where), null);
  // Another dataset's namespace is not ours to place.
  assert.equal(resolveMediaFile('outra/adidas-golf-braided-stretch-belt-cover.jpg', where), null);
});

// ── the category order ─────────────────────────────────────────────────────────────────────────────────

test('categories come out parents-first — an ltree child written first is a child of nothing', () => {
  const out = categoriesByDepth([
    { path: 'botas.chelsea' },
    { path: 'tenis' },
    { path: 'acessorios.bolsas' },
    { path: 'botas' },
    { path: 'acessorios' },
  ]).map((c) => c.path);
  assert.deepEqual(out, ['acessorios', 'botas', 'tenis', 'acessorios.bolsas', 'botas.chelsea']);
  for (const [i, path] of out.entries()) {
    if (!path.includes('.')) continue;
    const parent = path.slice(0, path.lastIndexOf('.'));
    assert.ok(out.indexOf(parent) < i, `${parent} must be written before ${path}`);
  }
});

// ── the media list of one product ──────────────────────────────────────────────────────────────────────

test('mediaKeysOf collects product and SKU media, and uploads a shared photo once', () => {
  const keys = mediaKeysOf({
    media: [{ provider_key: 'demo/p-cover.jpg' }, { provider_key: 'demo/p-gallery-2.jpg' }],
    skus: [
      { media: [{ provider_key: 'demo/p-color-preto-1.jpg' }] },
      { media: [{ provider_key: 'demo/p-color-preto-1.jpg' }] }, // the same file on two SKUs
      {}, // a SKU with no photo of its own — 4171 of them in the dataset
    ],
  });
  assert.deepEqual(keys, ['demo/p-cover.jpg', 'demo/p-gallery-2.jpg', 'demo/p-color-preto-1.jpg']);
});

// ── whose product is it ────────────────────────────────────────────────────────────────────────────────

test('a product ALREADY ON SALE in another store is listed here and NOT re-stocked', () => {
  // ⚠️ MEASURED, ON THE BENCH, AFTER IT HAPPENED. The D2 slice built the outlet from EIGHT products of this
  // same dataset. This module reused them by handle and set their stock to the seed figure — and the outlet
  // declares SOLD-OUT SIZES (`[2,1,0,3,0,1,0,0]`). 100 units in every size erased the store's only story.
  const plan = planProducts(
    [{ handle: 'a' }, { handle: 'b' }, { handle: 'c' }, { handle: 'd' }],
    { publishedHere: new Set(['a']), ownedElsewhere: new Set(['b']) },
  );
  assert.deepEqual(
    plan.map((p) => [p.handle, p.mine]),
    [
      // 'a' is gone: already on sale here, so a re-run writes nothing at all for it.
      ['b', false], // the outlet's case — listed, never touched
      ['c', true],
      ['d', true],
    ],
  );
});

test('★★ a handle on the IDLE SHELF is never published here, however the other filters fall', () => {
  // ★★ pk6 · M10 — THE SHELF IS DECLARED IN THE CATALOG AND SUBTRACTED BY TWO AUTHORS. The monorepo's
  // `populate` withholds these handles; THIS module is the other author of this shop's assortment, and an
  // author that publishes what the other withholds wins in silence — the stock-alert pool would stay at 2
  // and the dashboard's three states would stay empty, with nothing red anywhere.
  //
  // The idle handle is passed here as a product on sale NOWHERE, which is the case that otherwise reads as
  // "this run is the one to finish it": the shelf has to beat the heal path, not merely coexist with it.
  const plan = planProducts([{ handle: 'idle' }, { handle: 'live' }], {
    publishedHere: new Set(),
    ownedElsewhere: new Set(),
    idleShelf: new Set(['idle']),
  });
  assert.deepEqual(plan, [{ handle: 'live', mine: true }]);
});

test('a dataset with NO idle shelf behaves exactly as before', () => {
  // The knob is optional, and an absent one must not become an empty publication.
  const plan = planProducts([{ handle: 'a' }], { publishedHere: new Set(), ownedElsewhere: new Set() });
  assert.deepEqual(plan, [{ handle: 'a', mine: true }]);
});

test('a product on sale NOWHERE is this run to finish — the heal path after a run that died', () => {
  const plan = planProducts([{ handle: 'half-made' }], {
    publishedHere: new Set(),
    ownedElsewhere: new Set(),
  });
  assert.deepEqual(plan, [{ handle: 'half-made', mine: true }]);
});

test('a re-run over a finished store plans NOTHING — idempotence, as a value', () => {
  const handles = [{ handle: 'a' }, { handle: 'b' }];
  const plan = planProducts(handles, {
    publishedHere: new Set(['a', 'b']),
    ownedElsewhere: new Set(),
  });
  assert.equal(plan.length, 0);
});

// ── the read has to be QUIET before it is believed ─────────────────────────────────────────────────────

/** A catalogue read that climbs `steps` times and then holds — the projection catching up after a seed. */
function climbingRead(totals) {
  let i = 0;
  const seen = [];
  return {
    read: async () => {
      const total = totals[Math.min(i++, totals.length - 1)];
      seen.push(total);
      return { items: [], page: 1, limit: 1, total };
    },
    seen,
  };
}

test('awaitQuietCatalogue waits out a climbing projection and returns the settled total', async () => {
  // ⚠️ MEASURED ON THE BENCH: straight after publishing 2 790 products the projection answered 2 402 and
  // climbed at ~3.5 rows/s. The run that trusted that number re-uploaded 388 products' photographs and then
  // died on `catalog.product.create → 409 handle_taken`.
  const { read, seen } = climbingRead([2402, 2500, 2700, 2790, 2790, 2790, 2790]);
  const total = await awaitQuietCatalogue(
    { read, log: () => {}, fail: (m) => { throw new Error(m); } },
    { sleep: async () => {}, intervalMs: 0 },
  );
  assert.equal(total, 2790);
  assert.ok(seen.length >= 5, `should have polled past the climb, polled ${seen.length}`);
});

test('awaitQuietCatalogue costs THREE requests on a store that is already settled', async () => {
  const { read, seen } = climbingRead([2790]);
  await awaitQuietCatalogue(
    { read, log: () => {}, fail: (m) => { throw new Error(m); } },
    { sleep: async () => {}, intervalMs: 0 },
  );
  assert.equal(seen.length, 3);
});

test('awaitQuietCatalogue REFUSES a number that never settles, instead of seeding against it', async () => {
  let n = 0;
  const read = async () => ({ items: [], total: n++ }); // never the same twice
  let clock = 0;
  await assert.rejects(
    () =>
      awaitQuietCatalogue(
        { read, log: () => {}, fail: (m) => { throw new Error(m); } },
        { sleep: async () => { clock += 1000; }, intervalMs: 0, timeoutMs: 5000, now: () => clock },
      ),
    /never settled/,
  );
});
