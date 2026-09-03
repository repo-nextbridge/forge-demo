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
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolveMediaFile } from './forge.mjs';
import {
  brl,
  freeShippingFloor,
  planPlacements,
  planProgressBars,
  sameConfig,
  selectPromotions,
} from './vitrine.mjs';

/** The instance's own declarations, read from the file the seed reads — never retyped here. */
const vitrine = JSON.parse(readFileSync(new URL('./vitrine.json', import.meta.url), 'utf8'));

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

// ── ★★ L24 · THE ANNOUNCEMENT BAND, AND THE NUMBER IN IT ────────────────────────────────────────────────
//
// His instruction was one clause: "Frete grátis para compras acima de… SÓ CONFERE SE EXISTE ALGUMA PROMO DE
// FRETE GRÁTIS." The band is a promise on the first line of every page, and nothing in this repository
// compares a sentence to a price — so a typed number is advertising that stays green forever.
//
// ⚠️ THE COINCIDENCE THESE BREAK is that this store has TWO active free-shipping promotions with different
// rules (floors R$ 300 and R$ 299), and the one a person would notice first is the one that is NOT free
// shipping in the sense a shopper means it.

const CAPPED = {
  name: 'PROMO-06-FREE-SHIPPING-CAPPED',
  state: 'active',
  store_id: 'sto_forge',
  benefit: { kind: 'free_shipping', max_covered_amount: 1000, shipping_method_ids: [] },
  conditions: [{ kind: 'min_subtotal', amount: 30_000, base: 'before' }],
};
const UNCAPPED = {
  name: 'DEMO-HIST-01-FORGE',
  state: 'active',
  store_id: 'sto_forge',
  benefit: { kind: 'free_shipping', max_covered_amount: null, shipping_method_ids: [] },
  conditions: [{ kind: 'min_subtotal', amount: 29_900, base: 'after' }],
};

test('★★ the floor is the UNCAPPED promotion’s — R$ 299, never the capped one’s R$ 300', () => {
  // The capped one covers at most R$ 10,00 of the freight: above that the shopper pays the difference, and
  // "frete grátis" would be false for any freight over ten reais.
  assert.equal(freeShippingFloor([CAPPED, UNCAPPED], 'sto_forge'), 29_900);
  assert.equal(freeShippingFloor([UNCAPPED, CAPPED], 'sto_forge'), 29_900, 'the ORDER of the read decided it');
});

test('★ a store with only a CAPPED free shipping gets NO band — silence beats a promise nobody keeps', () => {
  assert.equal(freeShippingFloor([CAPPED], 'sto_forge'), null);
});

test('★ free shipping restricted to some carriers is not "frete grátis", and the sentence cannot say so', () => {
  const someCarriers = {
    ...UNCAPPED,
    benefit: { kind: 'free_shipping', max_covered_amount: null, shipping_method_ids: ['shm_1'] },
  };
  assert.equal(freeShippingFloor([someCarriers], 'sto_forge'), null);
});

test('a promotion with no min_subtotal has no "acima de" to print', () => {
  assert.equal(freeShippingFloor([{ ...UNCAPPED, conditions: [] }], 'sto_forge'), null);
});

test('a paused or draft promotion promises nothing', () => {
  for (const state of ['draft', 'paused', 'expired', 'scheduled'])
    assert.equal(freeShippingFloor([{ ...UNCAPPED, state }], 'sto_forge'), null, state);
});

test('another store’s promotion is not this store’s promise; a TENANT-WIDE one is', () => {
  assert.equal(freeShippingFloor([{ ...UNCAPPED, store_id: 'sto_outlet' }], 'sto_forge'), null);
  assert.equal(freeShippingFloor([{ ...UNCAPPED, store_id: null }], 'sto_forge'), 29_900);
});

test('the lowest qualifying floor wins — it is the cheapest threshold the shop actually honours', () => {
  const higher = { ...UNCAPPED, conditions: [{ kind: 'min_subtotal', amount: 50_000 }] };
  assert.equal(freeShippingFloor([higher, UNCAPPED], 'sto_forge'), 29_900);
});

// ── ⛔ p1-3 · THE CART'S PROGRESS BAR ANNOUNCED THE OTHER HALF OF THAT SAME PAIR ─────────────────────────
//
// MEASURED 03/09 on the shoe shop: the band said "Frete grátis acima de R$ 299" (derived, correct) and the
// bar under the cart said "Faltam R$ 20,10 para Frete com desconto de até R$ 10,00" — the CAPPED promotion,
// a higher floor and a weaker benefit, in the same flow. The bar draws whatever carries `show_progress`, and
// that flag came from the dataset's pricing bench, where the capped rule was the only freight rule there was.
//
// The fixtures are the two rows above: `CAPPED` is the dataset's, `UNCAPPED` is the one the kernel's history
// seed creates. `show_progress` is added per test, because it is the field under measurement.

const withBar = (promotion) => ({ ...promotion, id: `promo_${promotion.name}`, show_progress: true });
const withoutBar = (promotion) => ({ ...promotion, id: `promo_${promotion.name}`, show_progress: false });

test('★★ the bar moves to the promotion that actually ZEROES the freight, and off the one that does not', () => {
  const { raise, lower } = planProgressBars([withBar(CAPPED), withoutBar(UNCAPPED)], 'sto_forge');
  assert.deepEqual(
    raise.map((p) => p.name),
    ['DEMO-HIST-01-FORGE'],
  );
  assert.deepEqual(
    lower.map((p) => p.name),
    ['PROMO-06-FREE-SHIPPING-CAPPED'],
  );
});

test('★ and it says WHY in the shop’s own numbers — a log line nobody has to decode', () => {
  const { lower } = planProgressBars([withBar(CAPPED), withoutBar(UNCAPPED)], 'sto_forge');
  assert.match(lower[0].why, /R\$ 10\b/, 'the cap is the reason, and it is quoted from the benefit');
});

test('★★ already right is NOTHING to do — the pass is idempotent, run after run', () => {
  const { raise, lower } = planProgressBars([withoutBar(CAPPED), withBar(UNCAPPED)], 'sto_forge');
  assert.deepEqual(raise, []);
  assert.deepEqual(lower, []);
});

test('★ a shop whose ONLY freight promise is capped keeps its bar — a weak promise is better than none', () => {
  // Nothing here zeroes the freight, so there is no truer bar to move to; lowering this one would delete a
  // capability rather than correct it. Same posture as `announce`, one step down: it places no band at all
  // in this shop, because a band is a sentence and this bar is the promotion's own label.
  const { raise, lower } = planProgressBars([withBar(CAPPED)], 'sto_forge');
  assert.deepEqual(raise, []);
  assert.deepEqual(lower, []);
});

test('★ free shipping on SOME carriers is not the promise either — the same three conditions as the band', () => {
  const partial = {
    ...UNCAPPED,
    benefit: { kind: 'free_shipping', max_covered_amount: null, shipping_method_ids: ['shm_1'] },
  };
  const { raise, lower } = planProgressBars([withBar(partial)], 'sto_forge');
  assert.deepEqual(raise, []);
  assert.deepEqual(lower, [], 'nothing better exists, so this bar stays');
});

test('★ a promotion with no threshold is invisible to the bar — neither raised nor lowered', () => {
  const noFloor = { ...UNCAPPED, conditions: [] };
  const { raise, lower } = planProgressBars([withBar(noFloor), withoutBar(CAPPED)], 'sto_forge');
  assert.deepEqual(raise, []);
  assert.deepEqual(lower, []);
});

test('⛔ a GIFT-over-a-threshold bar is a different promise and is never touched', () => {
  // PROMO-05 carries `show_progress` too, and it is right: "faltam R$ X para o brinde" contradicts nothing.
  // A plan that lowered every bar but one would have deleted it while looking like a freight fix.
  const gift = {
    name: 'PROMO-05-GIFT-SHINE-SPONGE',
    id: 'promo_gift',
    state: 'active',
    store_id: 'sto_forge',
    show_progress: true,
    benefit: { kind: 'gift', items: [{ sku_id: 'sku_1', qty: 1 }] },
    conditions: [{ kind: 'min_subtotal', amount: 50_000 }],
  };
  const { lower } = planProgressBars([gift, withBar(CAPPED), withoutBar(UNCAPPED)], 'sto_forge');
  assert.deepEqual(
    lower.map((p) => p.name),
    ['PROMO-06-FREE-SHIPPING-CAPPED'],
  );
});

test('another store’s bar is not this store’s to move; a TENANT-WIDE one is', () => {
  const elsewhere = planProgressBars([withBar({ ...CAPPED, store_id: 'sto_outlet' })], 'sto_forge');
  assert.deepEqual(elsewhere.lower, []);
  const tenantWide = planProgressBars(
    [withBar({ ...CAPPED, store_id: null }), withoutBar({ ...UNCAPPED, store_id: null })],
    'sto_forge',
  );
  assert.deepEqual(
    tenantWide.lower.map((p) => p.name),
    ['PROMO-06-FREE-SHIPPING-CAPPED'],
  );
});

test('a paused promotion draws nothing and is left alone', () => {
  const { raise, lower } = planProgressBars(
    [withBar({ ...CAPPED, state: 'paused' }), withoutBar({ ...UNCAPPED, state: 'paused' })],
    'sto_forge',
  );
  assert.deepEqual(raise, []);
  assert.deepEqual(lower, []);
});

test('★ two uncapped promises: the LOWEST floor carries the bar, and a tie is broken deterministically', () => {
  const higher = { ...UNCAPPED, name: 'AAA-HIGHER', conditions: [{ kind: 'min_subtotal', amount: 50_000 }] };
  const { raise } = planProgressBars([withoutBar(higher), withoutBar(UNCAPPED)], 'sto_forge');
  assert.deepEqual(
    raise.map((p) => p.name),
    ['DEMO-HIST-01-FORGE'],
  );
  // Same floor, two rows: the id decides, so a second run of the seed agrees with the first.
  const twin = { ...UNCAPPED, name: 'ZZZ-TWIN' };
  const tie = planProgressBars([withoutBar(twin), withoutBar(UNCAPPED)], 'sto_forge');
  assert.deepEqual(
    tie.raise.map((p) => p.name),
    ['DEMO-HIST-01-FORGE'],
    'promo_DEMO… sorts before promo_ZZZ…',
  );
});

test('★★ the declared sentence carries a PLACEHOLDER and no number — a typed floor is the defect', () => {
  const declared = vitrine.announcement;
  assert.ok(declared, 'seed/vitrine.json must declare the band');
  assert.match(declared.free_shipping_text, /\{floor\}/, 'the number comes from the promotion, not from here');
  assert.doesNotMatch(
    declared.free_shipping_text,
    /R\$\s*\d/,
    'a figure typed beside the sentence is a promise with an expiry date nobody wrote down',
  );
  assert.equal(declared.slot, 'storefront:header.announcement');
});

test('the rendered sentence is the declared one with the floor in it', () => {
  assert.equal(
    vitrine.announcement.free_shipping_text.replace('{floor}', brl(29_900)),
    'Frete grátis acima de R$ 299',
  );
});

test('money is CENTS, and a shop window prints reais the way a person writes them', () => {
  assert.equal(brl(29_900), 'R$ 299');
  assert.equal(brl(30_050), 'R$ 300,50');
  assert.equal(brl(129_900), 'R$ 1.299');
  assert.equal(brl(5), 'R$ 0,05');
});
