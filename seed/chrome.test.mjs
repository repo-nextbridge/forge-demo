// A10 (the DEMO half) — THE `chrome` APP BORN INSTALLED, PLACED AND FILLED IN.
//
// ★★ WHAT IS WORTH TESTING, and none of it is "the file has five keys":
//   · a `brand` block with an empty config DELETES the shop's mark. The slot REPLACES the theme's wordmark
//     and the app draws nothing when nothing is configured, so the failure is a header with no mark on every
//     page and nothing anywhere going red;
//   · a block PLACED and EMPTY is invisible — the app writes no default word anywhere on purpose. So «the
//     app is born configured» is a claim about CONTENT, and a test that only counted placements would stay
//     green on exactly the state the achado complained about (`"back":"a"`, `"seal":"c"`);
//   · the pictures are DERIVED from the configs. A second list of files to upload is a list that can
//     disagree, and it disagrees silently: the config stores a filename where the kernel expects an asset id
//     and the header draws nothing;
//   · a store the file has never heard of is NAMED, never skipped.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blocksFor, imagesOf, markless, planChrome } from './chrome.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(SEED, 'chrome.json'), 'utf8'));
const BOX = JSON.parse(readFileSync(join(SEED, 'box.json'), 'utf8'));

/** The five blocks the app declares, and the slot each is allowed in — read off `extensions/chrome/manifest.ts`
 *  and confirmed against the `target_override` column of placements a human made on the bench (04/09). */
const MANIFEST_SLOTS = {
  checkout_header: 'storefront:checkout.header',
  checkout_footer: 'storefront:checkout.footer',
  account_header: 'storefront:account.header',
  account_footer: 'storefront:account.footer',
  brand: 'storefront:header.brand',
};

/** Which config keys each block declares (`config_schema`). A key this file invents is dropped by the kernel's
 *  own validation, so it would be a sentence nobody ever reads. */
const CONFIG_KEYS = {
  checkout_header: ['logo', 'back', 'title', 'seal'],
  account_header: ['logo', 'back', 'account', 'cart'],
  brand: ['logo', 'text', 'tail'],
  checkout_footer: ['start_text', 'start_image', 'middle_text', 'middle_image', 'end_text', 'end_image'],
  account_footer: ['start_text', 'start_image', 'middle_text', 'middle_image', 'end_text', 'end_image'],
};

const dressed = Object.entries(DATA.stores).filter(([, spec]) => spec !== null);

test('★★ the slot map is the app’s own — a slot this file invented would be refused at place time', () => {
  assert.deepEqual(DATA.slots, MANIFEST_SLOTS);
});

test('★★★ every dressed store declares ALL FIVE blocks — a half-dressed shop is the state this replaces', () => {
  for (const [handle] of dressed) {
    assert.deepEqual(
      blocksFor(DATA, handle).map((b) => b.component).sort(),
      Object.keys(MANIFEST_SLOTS).sort(),
      `store "${handle}" does not declare all five chrome blocks`,
    );
  }
});

test('★★★ and every block is FILLED IN — placed-and-empty draws nothing at all', () => {
  // The achado was «não sei bem pra onde arrastar», and the answer is a finished example. A block placed
  // with `{}` adds a row to the Compose board and changes no pixel, which teaches less than no app.
  for (const [handle] of dressed) {
    for (const block of blocksFor(DATA, handle)) {
      const values = Object.values(block.config ?? {}).filter(
        (v) => typeof v === 'string' && v.trim().length > 0,
      );
      assert.ok(
        values.length > 0,
        `store "${handle}" places ${block.component} with nothing in it — the app writes no default word ` +
          'anywhere, so that block renders as absence.',
      );
    }
  }
});

test('★★ no config key is invented — every one is in the block’s own `config_schema`', () => {
  for (const [handle] of dressed) {
    for (const block of blocksFor(DATA, handle)) {
      for (const key of Object.keys(block.config ?? {})) {
        assert.ok(
          CONFIG_KEYS[block.component].includes(key),
          `store "${handle}", block ${block.component}: "${key}" is not one of ` +
            `${CONFIG_KEYS[block.component].join('/')}. The kernel validates config against the schema, so ` +
            'an invented key is a sentence nobody ever reads.',
        );
      }
    }
  }
});

test('⛔ a `brand` block with neither a logo nor a word would DELETE the shop’s mark', () => {
  assert.deepEqual(markless(DATA), []);
  // …and the refusal is capable of red, which is the only reason to trust it.
  assert.deepEqual(
    markless({
      slots: MANIFEST_SLOTS,
      stores: { x: { brand: {} }, y: { brand: { tail: '   ' } } },
    }),
    ['x', 'y'],
  );
});

test('★★ every picture the declaration names is a file this repository actually has', () => {
  const files = imagesOf(DATA);
  assert.ok(files.length > 0, 'no store uses a logo — the `type:id` half of the app is then undemonstrated');
  for (const file of files) {
    assert.ok(
      existsSync(join(SEED, 'photos', file)),
      `seed/chrome.json names "${file}" and seed/photos/ does not have it. The seed would upload nothing, ` +
        'the config would keep a filename where the kernel expects an asset id, and the header would draw ' +
        'nothing — silently.',
    );
  }
});

test('★ the picture list is DERIVED from the configs, not typed beside them', () => {
  // A second list is a list that can disagree. Proven by driving the derivation over a made-up declaration.
  assert.deepEqual(
    imagesOf({
      slots: MANIFEST_SLOTS,
      stores: {
        a: { brand: { logo: 'one.png' }, checkout_footer: { end_image: 'two.png' } },
        b: { checkout_header: { logo: 'one.png' } },
      },
    }),
    ['one.png', 'two.png'],
  );
});

test('★★ every store of the box is DECIDED — dressed, or explicitly null with a reason', () => {
  // A store simply missing from this file would be skipped at a birth with a line nobody reads. The counter
  // is the one exclusion and it is `null` rather than absent, which is what makes it visible.
  const handles = BOX.tenants.flatMap((t) => (t.stores ?? []).map((s) => s.handle));
  for (const handle of handles) {
    assert.ok(
      handle in DATA.stores,
      `seed/box.json has a store "${handle}" that seed/chrome.json says nothing about`,
    );
  }
  assert.equal(DATA.stores.balcao, null);
  assert.match(DATA._balcao_why.join(' '), /servable: false|whole-host app/);
});

test('★★ a placement whose config still holds somebody’s test content is RE-ASSERTED, not left alone', () => {
  // The bench state this file exists to replace, verbatim: seven placements carrying `{"back":"a"}`. A plan
  // that treated «already placed» as «already right» would leave exactly that on the box forever.
  const wanted = [{ component: 'checkout_header', slot: MANIFEST_SLOTS.checkout_header, config: { back: 'Voltar à loja' } }];
  const placed = [{ placement_id: 'hp_1', component: 'checkout_header', config: { back: 'a', seal: 'c' } }];
  assert.deepEqual(planChrome(wanted, placed), [
    { action: 'update', placement_id: 'hp_1', ...wanted[0] },
  ]);
});

test('★★ …and a placement that already says the declaration costs NOTHING, `_url` stamps included', () => {
  // ⚠️ THE TRAP: a `type:'id'` field comes back with a `<field>_url` beside it. A deep-equal would find a
  // difference on every run and rewrite all fifteen placements at every birth, forever.
  const wanted = [{ component: 'brand', slot: MANIFEST_SLOTS.brand, config: { logo: 'ast_1', text: 'forge.co' } }];
  const placed = [
    {
      placement_id: 'hp_2',
      component: 'brand',
      config: { logo: 'ast_1', logo_url: 'https://cdn.example/x.png', text: 'forge.co' },
    },
  ];
  assert.deepEqual(planChrome(wanted, placed), []);
});

test('a block nothing has placed yet is PLACED, in the slot the file names', () => {
  const wanted = blocksFor(DATA, 'cafe');
  const plan = planChrome(wanted, []);
  assert.equal(plan.length, 5);
  assert.ok(plan.every((step) => step.action === 'place'));
  assert.equal(
    plan.find((s) => s.component === 'brand').slot,
    'storefront:header.brand',
  );
});

test('★ the café is the one store dressed with a LOGO — its funnel wore the reference mark until now', () => {
  const cafe = blocksFor(DATA, 'cafe');
  assert.ok(
    cafe.some((b) => typeof b.config?.logo === 'string'),
    'the café has no logo configured, which is the whole reason this item names it',
  );
});

test('★★ the picture list is SCOPED to the tenant’s own stores — a library is a tenant’s', () => {
  // Deriving over the whole file would upload the coffee shop's logo into the shoe brand's library, where
  // nothing references it. Measured against the real declaration: the shoe brand names no picture at all.
  const shoe = BOX.tenants.find((t) => t.id === 'forgeco').stores.map((s) => s.handle);
  const coffee = BOX.tenants.find((t) => t.id === 'forgecafe').stores.map((s) => s.handle);
  assert.deepEqual(imagesOf(DATA, shoe), []);
  assert.deepEqual(imagesOf(DATA, coffee), ['forge-co-logo.png']);
});
