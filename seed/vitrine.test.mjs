// The shop window's own tests — `node --test 'seed/**/*.test.mjs'`, the same runner seed/forge.test.mjs uses
// and for the same reason (Node ships one; these are pure functions).
//
// WHAT IS WORTH TESTING HERE, and it is deliberately not "the window is composed". That is proven by running
// the seed against a box and counting the placements, which the slice report does. What CANNOT be proven that
// way is the class of defect this slice had to design around: a mechanism that is correct by coincidence and
// stops being correct the moment the coincidence ends. Every test below breaks one:
//
//   · the placement plan, against TWO blocks in ONE slot — the shape seed/outlet.mjs never met, and whose
//     `extension:component:target` key silently collapses to one;
//   · the plan again, against the state its own first pass produced — which is what "running it twice is a
//     no-op" MEANS, as opposed to what a second exit code 0 proves;
//   · config equality, against a difference NESTED inside a media list — a top-level key sort sees none;
//   · the banner resolver, against a `-M` the curator did not ship — where guessing the desktop file is how
//     a phone silently gets a 1600px lifestyle frame;
//   · the promotion selection, against an allow-list entry the dataset stopped carrying — a list of names
//     that rots in silence is how a shop quietly loses a promotion.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMediaFile } from './forge.mjs';
import { planPlacements, sameConfig, selectPromotions } from './vitrine.mjs';

const throwingFail = (message) => {
  throw new Error(message);
};

/** A composition row as `read.internal.extension_composition` answers it — `target`, never `slot`. */
const row = (extension_id, component, target, position, config, placement_id) => ({
  extension_id,
  component,
  target,
  position,
  config,
  placement_id,
});

// ── the placement plan ─────────────────────────────────────────────────────────────────────────────────

test('TWO blocks in ONE slot are two placements — the key that collapses them is the bug', () => {
  // ⚠️ THE COINCIDENCE THIS BREAKS. seed/outlet.mjs indexes what is already placed by
  // `${extension_id}:${component}:${target}` and it is correct there — the Outlet's four blocks sit in four
  // different slots, so the key is unique by accident of that curation. The dataset's `storefront.json` puts
  // TWO shelves in `storefront:home.below_shelf` ("Corra para não perder" and "Seus pequenos vão amar"), and
  // under that key the second shelf finds the first one's row, decides it is "already there with a different
  // config", and OVERWRITES it. The result is a home with ONE shelf and a seed reporting success twice.
  const wanted = [
    { extension_id: 'shelves', component: 'shelf', slot: 'storefront:home.below_shelf', config: { title: 'A' }, what: 'A' },
    { extension_id: 'shelves', component: 'shelf', slot: 'storefront:home.below_shelf', config: { title: 'B' }, what: 'B' },
  ];
  // What an `extension.install` of `shelves` leaves behind: one EMPTY instance per manifest hook.
  const existing = [row('shelves', 'shelf', 'storefront:home.below_shelf', 0, {}, 'hp_1')];

  const plan = planPlacements(wanted, existing);
  assert.equal(plan.length, 2);
  assert.deepEqual(
    plan.map((p) => p.action),
    ['update', 'place'],
  );
  // The FIRST wanted block takes over the install's empty default; the second is a new row.
  assert.equal(plan[0].placement_id, 'hp_1');
  assert.equal(plan[0].block.config.title, 'A');
  assert.equal(plan[1].placement_id, undefined);
  assert.equal(plan[1].block.config.title, 'B');
});

test('the SECOND run over the state the first produced is entirely skip — this is what no-op means', () => {
  const wanted = [
    { extension_id: 'shelves', component: 'shelf', slot: 'storefront:home.below_shelf', config: { title: 'A' }, what: 'A' },
    { extension_id: 'shelves', component: 'shelf', slot: 'storefront:home.below_shelf', config: { title: 'B' }, what: 'B' },
    { extension_id: 'banners', component: 'banner', slot: 'storefront:home.hero', config: { style: 'carousel' }, what: 'hero' },
  ];
  // The store as the first run left it: the reconfigured default, the appended second shelf, the new hero.
  const settled = [
    row('shelves', 'shelf', 'storefront:home.below_shelf', 0, { title: 'A' }, 'hp_1'),
    row('shelves', 'shelf', 'storefront:home.below_shelf', 1, { title: 'B' }, 'hp_2'),
    row('banners', 'banner', 'storefront:home.hero', 0, { style: 'carousel' }, 'hp_3'),
  ];
  const plan = planPlacements(wanted, settled);
  assert.deepEqual(
    plan.map((p) => p.action),
    ['skip', 'skip', 'skip'],
  );
});

test('position ORDERS the match — a slot read back out of order still pairs 1st with 1st', () => {
  // The read is not promised in position order, and pairing "the Nth wanted with the Nth row as it arrived"
  // would swap the two shelves' configs against each other on a re-run: two updates, forever, both writing
  // the config the other one already had.
  const wanted = [
    { extension_id: 'shelves', component: 'shelf', slot: 's:x', config: { title: 'A' }, what: 'A' },
    { extension_id: 'shelves', component: 'shelf', slot: 's:x', config: { title: 'B' }, what: 'B' },
  ];
  const shuffled = [
    row('shelves', 'shelf', 's:x', 1, { title: 'B' }, 'hp_2'),
    row('shelves', 'shelf', 's:x', 0, { title: 'A' }, 'hp_1'),
  ];
  assert.deepEqual(
    planPlacements(wanted, shuffled).map((p) => p.action),
    ['skip', 'skip'],
  );
});

test('a block whose slot holds MORE rows than wanted leaves the extras alone — additive, never a remove', () => {
  // ⚠️ THE PLATFORM'S OWN SEEDER DOES THE OPPOSITE and it is right for it: `placeDemoShelves`
  // (apps/api/src/seed-storefront.ts) removes every shelf instance first so a wipe-and-reseed produces a
  // pristine board. This one runs against a box somebody is testing on. An extra row is a human's, and
  // deleting a human's block to make a count match is the one thing a seed may never do.
  const wanted = [{ extension_id: 'shelves', component: 'shelf', slot: 's:x', config: { title: 'A' }, what: 'A' }];
  const existing = [
    row('shelves', 'shelf', 's:x', 0, { title: 'A' }, 'hp_1'),
    row('shelves', 'shelf', 's:x', 1, { title: 'somebody else' }, 'hp_2'),
  ];
  const plan = planPlacements(wanted, existing);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].action, 'skip');
});

// ── config equality ────────────────────────────────────────────────────────────────────────────────────

test('a difference NESTED in a media list is a difference — a top-level key sort cannot see it', () => {
  // The banner blocks carry their whole personality inside `media`, a list of objects. Equality that
  // normalises only the outer object compares two media lists as JSON strings whose key ORDER decides the
  // answer: same content, keys emitted differently by the kernel's echo → "changed", and the seed rewrites
  // every banner on every run (an audit row per run, forever). Different asset → "unchanged", and a
  // re-pointed banner never lands.
  const a = { style: 'carousel', media: [{ asset_id: 'x', duration: 6, link: '/tenis' }] };
  const keysSwapped = { media: [{ link: '/tenis', asset_id: 'x', duration: 6 }], style: 'carousel' };
  const otherAsset = { style: 'carousel', media: [{ asset_id: 'y', duration: 6, link: '/tenis' }] };
  assert.equal(sameConfig(a, keysSwapped), true);
  assert.equal(sameConfig(a, otherAsset), false);
  // Order WITHIN the list is meaning — the carousel's slide order — and must never normalise away.
  const twoSlides = { media: [{ asset_id: 'x' }, { asset_id: 'y' }] };
  const reversed = { media: [{ asset_id: 'y' }, { asset_id: 'x' }] };
  assert.equal(sameConfig(twoSlides, reversed), false);
  // An install's empty default against a real config: the whole reason step 1 is an update and not a skip.
  assert.equal(sameConfig({}, a), false);
});

// ── the banner half of the media resolver ──────────────────────────────────────────────────────────────

const manifest = {
  banners: {
    'grande-jordan': {
      desktop: '../banners/banner-grande-jordan.jpg',
      mobile: '../banners/banner-grande-jordan-M.jpg',
    },
    sportswear: { desktop: '../banners/banner-sportswear.jpg' },
  },
  categoryBanners: { corrida: '../banners/banner-strip-corrida-1200x150.jpg' },
  icons: {},
  products: {},
};
const where = { namespace: 'demo', manifest, artDir: '/ds/assets/catalog', photoDir: '/photos' };

test('a home banner resolves into the SHARED art, desktop and mobile as separate files', () => {
  assert.equal(
    resolveMediaFile('demo/banner-grande-jordan.jpg', where),
    '/ds/assets/banners/banner-grande-jordan.jpg',
  );
  assert.equal(
    resolveMediaFile('demo/banner-grande-jordan-M.jpg', where),
    '/ds/assets/banners/banner-grande-jordan-M.jpg',
  );
});

test('a `-M` the curator did not ship is NULL, never the desktop file wearing the phone\'s name', () => {
  // ⚠️ THE COINCIDENCE. Seven of the dataset's banners have a `-M`; three do not, and the block's contract is
  // that a blank mobile ref means "use the desktop art at narrow widths". Falling back HERE instead — handing
  // the desktop path back for a `-M` key — uploads the same 1600px frame a second time under a phone's name,
  // so the block stops falling back and starts serving the wide art deliberately. Null lets the caller decide
  // (this one simply omits `asset_id_mobile`), which is the contract the block already has.
  assert.equal(resolveMediaFile('demo/banner-sportswear-M.jpg', where), null);
  assert.equal(resolveMediaFile('demo/banner-sportswear.jpg', where), '/ds/assets/banners/banner-sportswear.jpg');
  // A name the manifest does not carry at all — the caller refuses BY NAME rather than publishing a ref to
  // nothing, which is the whole reason this function answers null instead of throwing.
  assert.equal(resolveMediaFile('demo/banner-nao-existe.jpg', where), null);
});

test('a CATEGORY strip is still a category strip — the two `banner-` vocabularies do not collide', () => {
  // `category-banner-corrida.jpg` and `banner-grande-jordan.jpg` are different species living in one folder,
  // and the second pattern was added after the first. A regex that matched `banner-` anywhere in the key
  // would answer the strip out of `manifest.banners`, where it is not, and the seed would refuse art it has.
  assert.equal(
    resolveMediaFile('demo/category-banner-corrida.jpg', where),
    '/ds/assets/banners/banner-strip-corrida-1200x150.jpg',
  );
});

// ── the promotion selection ────────────────────────────────────────────────────────────────────────────

const bench = [
  { name: 'PROMO-01A-ADISTAR-20', label: '20% off' },
  { name: 'PROMO-04-SOCKS-BUY3PAY2', label: 'Leve 3, pague 2' },
  { name: 'PROMO-05-GIFT-SHINE-SPONGE', label: 'Brinde' },
];

test('the selection is the allow-list, in the DATASET\'s order, and nothing else', () => {
  const chosen = selectPromotions(bench, ['PROMO-05-GIFT-SHINE-SPONGE', 'PROMO-04-SOCKS-BUY3PAY2'], throwingFail);
  assert.deepEqual(
    chosen.map((p) => p.name),
    ['PROMO-04-SOCKS-BUY3PAY2', 'PROMO-05-GIFT-SHINE-SPONGE'],
  );
});

test('an allow-list name the dataset no longer carries FAILS, naming it — a list of names rots in silence', () => {
  // ⚠️ THE COINCIDENCE THIS BREAKS is the ordinary one for every allow-list ever written: it is correct on
  // the day it is written and there is no moment at which it stops being correct loudly. Rename a scenario in
  // the dataset and a filter would quietly select one fewer promotion — the shop loses a discount and every
  // exit code stays 0. The guard is cheap and it is the only thing standing between this file and that.
  assert.throws(
    () => selectPromotions(bench, ['PROMO-04-SOCKS-BUY3PAY2', 'PROMO-99-GONE'], throwingFail),
    /PROMO-99-GONE/,
  );
});
