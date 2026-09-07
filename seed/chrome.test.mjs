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
import { blocksFor, imagesOf, markless, planChrome, seedChrome } from './chrome.mjs';

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
  // ⚠️ pk21 NARROWED THIS. It used to accept `servable: false` as an alternative, and that flag is gone —
  // servability is derived from the port now (`bin/servable.mjs`). An expectation that a retired spelling
  // can satisfy is an expectation about nothing, so only the reason that is still true is accepted.
  assert.match(DATA._balcao_why.join(' '), /whole-host app/);
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

test('★ the café was the FIRST store dressed with a logo, and pk20 stopped it being the only one', () => {
  // Kept as its own line because the café is the store the A10 item was about: its funnel wore the reference
  // mark until that pass. What changed in pk20 is the count, not this store — the shoe shops joined it.
  const cafe = blocksFor(DATA, 'cafe');
  assert.ok(
    cafe.some((b) => typeof b.config?.logo === 'string'),
    'the café has no logo configured, which is the whole reason this item names it',
  );
});

test('★★ the picture list is SCOPED to the tenant’s own stores — a library is a tenant’s', () => {
  // Deriving over the whole file would upload the coffee shop's logo into the shoe brand's library, where
  // nothing references it — and since pk20 it would ALSO put the two shoe marks into the café's, which is the
  // same defect in the other direction. The shoe brand named no picture at all until this pass; it now names
  // exactly its own two, and that is the assertion, not a count.
  const shoe = BOX.tenants.find((t) => t.id === 'forgeco').stores.map((s) => s.handle);
  const coffee = BOX.tenants.find((t) => t.id === 'forgecafe').stores.map((s) => s.handle);
  assert.deepEqual(imagesOf(DATA, shoe), ['forge-store-logo.png', 'forge-outlet-logo.png']);
  assert.deepEqual(imagesOf(DATA, coffee), ['forge-co-logo.png']);
});

// ══ pk19/D1 — WHAT THE BLOCKS SAY, and why a second table is worth its own weight ═════════════════════════
//
// Everything above grades the SHAPE: five blocks, real slots, no invented key, nothing placed empty. All of
// it stayed green through the state the owner asked us to replace — three institutional sentences he called
// bad, a security claim in the header he wanted in the footer, and `Sacola` written over a shoe store whose
// vitrine says `Carrinho`. A shape test cannot tell those from the words he dictated, so the words are
// pinned here, by store, verbatim (07/09).
//
// ⛔ AND THE TABLE COVERS THE WHOLE TOPOLOGY, INCLUDING THE STORE WITH NO CHROME. Every rule below is driven
// off `DICTATED`, and `DICTATED` is asserted to name EXACTLY the stores `seed/chrome.json` declares —
// `balcao` included, as `null`. A loop over a store that quietly went missing would iterate zero times and
// report success, which is the one failure this repository has already paid for twice.

/** The owner's own words, 07/09, per store. `null` = a store deliberately without chrome (see `_balcao_why`).
 *  A field he did not touch is absent here: this table grades what he dictated, not the whole config.
 *
 *  ★★ pk20/D1 adds the MARK to the same table — the second dictation of the same day: *"O logo de outlet na
 *  vitrina normal está errado, o certo é forge.outlet"*, *"E o da storefront demo tbm é forge.store"*,
 *  *"minúsculo"*, and *"Não aparece o logo no checkout e minha conta nas lojas de sapato e outlet"*. The café's
 *  mark is pinned here too although he did not change it: leaving it alone was itself the instruction, and the
 *  same shape already worked once in this file for `cart: 'Sacola'`. */
const DICTATED = {
  forge: {
    brand: { text: 'forge', tail: '.store' },
    checkout_header: { logo: 'forge-store-logo.png', seal: '' },
    checkout_footer: {
      start_text: 'Pix · Cartão de crédito',
      middle_text: '',
      end_text: 'Compra Segura',
    },
    account_header: { logo: 'forge-store-logo.png', cart: 'Carrinho' },
    account_footer: { start_text: '(11) 4000-1000', middle_text: 'contato@forge.example' },
  },
  outlet: {
    brand: { text: 'forge', tail: '.outlet' },
    checkout_header: { logo: 'forge-outlet-logo.png', seal: '' },
    checkout_footer: {
      start_text: 'Pix · Cartão de crédito',
      middle_text: '',
      end_text: 'Compra Segura',
    },
    account_header: { logo: 'forge-outlet-logo.png', cart: 'Carrinho' },
    account_footer: { start_text: '(11) 4000-2000', middle_text: 'contato@outlet.example' },
  },
  cafe: {
    // ★ THE STORE HE DID NOT TOUCH, pinned so that "já está certo" survives the next pass.
    brand: { logo: 'forge-co-logo.png', text: 'forge.co' },
    checkout_header: { logo: 'forge-co-logo.png', seal: '' },
    checkout_footer: {
      start_text: 'Pix · Cartão de crédito',
      middle_text: '',
      end_text: 'Compra Segura',
    },
    // ★ THE ONE STORE THAT KEEPS THE OLD WORD, and it is a quotation: «na de café deixa como está».
    account_header: { logo: 'forge-co-logo.png', cart: 'Sacola' },
    account_footer: { start_text: '(11) 4000-3000', middle_text: 'contato@cafe.example' },
  },
  balcao: null,
};

test('★★ the dictation table names EVERY store the declaration does — a vanished store cannot pass in silence', () => {
  // ⛔ THE VÁCUO GUARD. Every rule below loops over `DICTATED`; a store dropped from `chrome.json` would make
  // those loops shorter and greener. So the two key sets are compared first, and `balcao` — the store with no
  // chrome at all — is skipped BY NAME rather than by being absent from anything.
  assert.deepEqual(Object.keys(DICTATED).sort(), Object.keys(DATA.stores).sort());
  assert.equal(DICTATED.balcao, null);
  assert.equal(DATA.stores.balcao, null);
});

test('★★★ every word the owner dictated on 07/09 is the word the box is born with', () => {
  for (const [handle, blocks] of Object.entries(DICTATED)) {
    if (blocks === null) continue;
    const configs = Object.fromEntries(
      blocksFor(DATA, handle).map((b) => [b.component, b.config ?? {}]),
    );
    for (const [component, fields] of Object.entries(blocks)) {
      for (const [key, value] of Object.entries(fields)) {
        assert.equal(
          configs[component]?.[key],
          value,
          `store "${handle}", block ${component}: "${key}" is ${JSON.stringify(
            configs[component]?.[key],
          )} and the owner dictated ${JSON.stringify(value)} on 07/09.`,
        );
      }
    }
  }
});

test('⛔ an emptied field is DECLARED empty — a key this file drops is a key no birth ever corrects', () => {
  // ★ THE MECHANISM, PROVEN RATHER THAN ASSERTED. `sameConfig` asks «is every key THIS FILE states already
  // stored with that value?». It has to: the kernel stamps `<field>_url` beside every `type:'id'` field, so a
  // deep-equal would rewrite all fifteen placements at every birth. The cost of that shape is that SILENCE IS
  // CONSENT — the declaration cannot un-say something by leaving it out.
  const slot = MANIFEST_SLOTS.checkout_footer;
  const stale = [
    {
      placement_id: 'hp_9',
      component: 'checkout_footer',
      config: { start_text: 'Pix · Cartão de crédito', middle_text: 'Trocas em até 30 dias' },
    },
  ];
  // Dropping the key: the old sentence survives, and the plan is EMPTY — nothing to read in any log.
  assert.deepEqual(
    planChrome(
      [{ component: 'checkout_footer', slot, config: { start_text: 'Pix · Cartão de crédito' } }],
      stale,
    ),
    [],
  );
  // Declaring it empty: the birth re-asserts the absence.
  const wanted = {
    component: 'checkout_footer',
    slot,
    config: { start_text: 'Pix · Cartão de crédito', middle_text: '' },
  };
  assert.deepEqual(planChrome([wanted], stale), [
    { action: 'update', placement_id: 'hp_9', ...wanted },
  ]);
  // ⇒ so every area the owner emptied is spelled `''` in the declaration, never removed from it.
  for (const [handle, blocks] of Object.entries(DICTATED)) {
    if (blocks === null) continue;
    const configs = Object.fromEntries(
      blocksFor(DATA, handle).map((b) => [b.component, b.config ?? {}]),
    );
    for (const [component, fields] of Object.entries(blocks)) {
      for (const [key, value] of Object.entries(fields)) {
        if (value !== '') continue;
        assert.ok(
          key in configs[component],
          `store "${handle}", block ${component}: "${key}" was emptied by dropping it. A dropped key is ` +
            'invisible to `sameConfig`, so the old text would stay on every box that already has this ' +
            'placement — forever, and with no line in the birth log. Write `""`.',
        );
      }
    }
  }
});

test('★★ one store, ONE word for the cart — the account header and the vitrine are the same shop', () => {
  // ⚠️ THE DEFECT THIS REPLACED, MEASURED 07/09: `forge` and `outlet` declare an empty `vocabulary` in
  // seed/catalog.json, so their vitrine draws the kit's default `Carrinho`
  // (packages/storefront-kit/src/vocabulary/vocabulary-keys.ts:52) — while this file wrote `Sacola` over the
  // account header of the same store. Two words for one thing, in one shop, and nothing was red.
  //
  // ⚠️ AND `KIT_DEFAULT_CART` IS A COPY THAT LIVES IN ANOTHER REPOSITORY. Nothing crosses the two repos, so
  // this constant can only be kept honest by hand — and it going red because the kit changed its default IS
  // the report we want, not a false alarm: the day the vitrine's word changes, this header's has to follow.
  const KIT_DEFAULT_CART = 'Carrinho';
  const CATALOG = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));
  const vocabulary = new Map(CATALOG.stores.map((s) => [s.handle, s.vocabulary ?? {}]));
  for (const [handle, blocks] of Object.entries(DICTATED)) {
    if (blocks === null) continue;
    assert.ok(vocabulary.has(handle), `seed/catalog.json has no store "${handle}"`);
    const shopWord = vocabulary.get(handle).cart ?? KIT_DEFAULT_CART;
    const headerWord = blocksFor(DATA, handle).find((b) => b.component === 'account_header')?.config
      ?.cart;
    assert.equal(
      headerWord,
      shopWord,
      `store "${handle}": the account header says "${headerWord}" and the shop says "${shopWord}". ` +
        'A shopper crosses from one to the other in one click.',
    );
  }
});

test('★★ no contact detail is a REAL one — this dataset shipped the owner’s personal address once', () => {
  // ⛔ IT HAPPENED, IN FIFTEEN FILES. Everything a shopper could dial or write to here is reserved by RFC
  // 2606 (`.example`) or is a number nobody answers. The rule is checked over the WHOLE declaration and not
  // just over the fields this pass wrote, because the next e-mail will be added somewhere else.
  const text = JSON.stringify(
    Object.fromEntries(
      Object.entries(DATA.stores).map(([h, spec]) => [
        h,
        spec === null ? null : Object.fromEntries(blocksFor(DATA, h).map((b) => [b.component, b.config])),
      ]),
    ),
  );
  for (const address of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
    assert.match(
      address,
      /\.example$/,
      `seed/chrome.json puts "${address}" on a shopper's screen. Contact details in this dataset are ` +
        'fictional by rule: use the RFC 2606 `.example` TLD.',
    );
  }
});

// ══ pk20/D1 — THE MARK: what it SAYS in the shop, and that it REACHES the funnel ═══════════════════════════
//
// The table above pins the words. These three rules pin the two things a table of literals cannot see:
//   · WHY the outlet's tail is `.outlet` and not `" Outlet"` — the separator has to survive `wordOf`'s trim;
//   · that every shop wears its OWN mark in BOTH bars the owner named (checkout and account);
//   · that a declared FILENAME actually becomes an ASSET ID in the placement, which is the whole silent
//     failure this file's own header describes ("the config would keep a filename where the kernel expects an
//     asset id, and the header would draw nothing").

/** The word fields of each block, by component — the ones `wordOf` reads. `logo` is an asset ref, not a word. */
const WORD_KEYS = {
  brand: ['text', 'tail'],
  checkout_header: ['back', 'title', 'seal'],
  account_header: ['back', 'account', 'cart'],
  checkout_footer: ['start_text', 'middle_text', 'end_text'],
  account_footer: ['start_text', 'middle_text', 'end_text'],
};

test('★★ no configured word leans on WHITESPACE — `wordOf` trims, so a space never reaches a screen', () => {
  // ⛔ THE MEASUREMENT BEHIND THE OWNER'S "o certo é forge.outlet". The outlet's mark used to be
  // `text: "Forge"` + `tail: " Outlet"` and the shop's header read `ForgeOutlet`, glued: every configured word
  // goes through `wordOf`, which returns `raw.trim()` (extensions/chrome/logic.ts:38, in the product repo), and
  // `brand.tsx:46-49` concatenates `text` and `tail` with NOTHING between them. So a leading or trailing space
  // is not "styling that might be fragile" — it is a character that is deleted before render, every time, and
  // the only separator that survives is a printable one. That is why the fix is `.outlet` and not `" Outlet"`.
  for (const [handle, blocks] of Object.entries(DICTATED)) {
    if (blocks === null) {
      assert.equal(DATA.stores[handle], null, `"${handle}" is skipped by name here and must be null in the data`);
      continue;
    }
    for (const block of blocksFor(DATA, handle)) {
      for (const key of WORD_KEYS[block.component]) {
        const raw = block.config?.[key];
        if (typeof raw !== 'string' || raw.length === 0) continue;
        assert.equal(
          raw,
          raw.trim(),
          `store "${handle}", block ${block.component}: "${key}" is ${JSON.stringify(raw)} — it carries ` +
            'leading or trailing whitespace, and `wordOf` TRIMS every word before it is drawn ' +
            '(extensions/chrome/logic.ts:38). The space is deleted, not rendered' +
            (block.component === 'brand'
              ? `, and \`brand.tsx\` concatenates text+tail with nothing between them, so this mark reaches ` +
                `the shop's header as "${(block.config.text ?? '').trim()}${(block.config.tail ?? '').trim()}" ` +
                '— glued. Separate the two with a PRINTABLE character (a point), never with a space.'
              : '.'),
        );
      }
    }
  }
});

test('★★★ every dressed shop wears its OWN mark in BOTH bars the owner named — checkout AND account', () => {
  // ⛔ THE ACHADO, VERBATIM: «Não aparece o logo no checkout e minha conta nas lojas de sapato e outlet». Two
  // bars, named separately, because they are two placements and one of them can be forgotten in silence: the
  // app writes no default anywhere, so a bar with no `logo` renders a bar with no mark and nothing goes red.
  //
  // ⚠️ AND THE MARK IS THE STORE'S OWN FILE. Two shops sharing one is the exact state this app exists to
  // remove — the README's own words: "our wordmark, in somebody else's shop". `brand` is deliberately NOT
  // included: there the logo would REPLACE the text (brand.tsx:40-50), which is what the owner asked us to fix.
  const BARS = ['checkout_header', 'account_header'];
  const seen = new Map();
  for (const [handle, blocks] of Object.entries(DICTATED)) {
    if (blocks === null) {
      // ⛔ SKIPPED BY NAME, never by being absent — and the skip asserts its own reason. Pointing this rule at
      // a store with no chrome at all must ACCUSE (it declares none of these blocks), never pass quietly.
      assert.equal(DATA.stores[handle], null, `"${handle}" is skipped here and seed/chrome.json must say null`);
      continue;
    }
    const configs = Object.fromEntries(blocksFor(DATA, handle).map((b) => [b.component, b.config ?? {}]));
    const marks = new Set();
    for (const bar of BARS) {
      assert.ok(configs[bar], `store "${handle}" declares no ${bar} block at all — there is no bar to mark`);
      const logo = configs[bar].logo;
      assert.ok(
        typeof logo === 'string' && logo.trim().length > 0,
        `store "${handle}", block ${bar}: no logo. The owner reported this bar as unmarked on 07/09, and the ` +
          'app draws no default mark anywhere — an absent `logo` is a bar with nothing in it, silently.',
      );
      assert.ok(
        existsSync(join(SEED, 'photos', logo)),
        `store "${handle}", block ${bar}: names "${logo}" and seed/photos/ does not have it`,
      );
      marks.add(logo);
    }
    assert.equal(
      marks.size,
      1,
      `store "${handle}" wears ${[...marks].join(' and ')} — the checkout and the account screens are the ` +
        'same shop to a shopper who crosses between them in one click.',
    );
    const [mark] = marks;
    assert.ok(
      !seen.has(mark),
      `stores "${seen.get(mark)}" and "${handle}" wear the same mark ("${mark}"). One shop wearing another's ` +
        'wordmark is the exact outcome this app exists to remove.',
    );
    seen.set(mark, handle);
  }
  assert.equal(seen.size, 3, 'three dressed shops, three marks — one of them going missing would shorten this loop');
});

test('★★ …and the declared FILENAME becomes an ASSET ID in the placement — the whole chain, driven', () => {
  // ⚠️ THE FAILURE THIS PROVES AGAINST IS SILENT AND ENDS ON A SCREEN: `logo` is a `type:'id'` field, so a
  // config that kept the filename would be stored, validated, placed — and the header would draw nothing,
  // because `assetOf` reads the `logo_url` the kernel stamps beside a REF it recognises. The café's placement
  // is the precedent that already works; this drives the same code over the shoe tenant.
  //
  // The last mile lives in the other repository and is covered there rather than re-asserted here:
  // `extensions/chrome/checkout-header.test.tsx:29` ("a logo AND a back word draw BOTH") and
  // `brand.test.tsx:15/28` (the mark is the image OR the words, never both).
  const stores = [
    { id: 'sto_forge', handle: 'forge' },
    { id: 'sto_outlet', handle: 'outlet' },
  ];
  const library = [];
  const placed = [];
  let minted = 0;
  const uploaded = [];

  const run = () =>
    seedChrome({
      command: async (name, input) => {
        if (name === 'composition.place') placed.push(input);
        return {};
      },
      read: async (name, params) => {
        if (name === 'installed_extensions') return [{ extension_id: 'chrome', status: 'active' }];
        if (name === 'stores') return stores;
        if (name === 'extension_composition') {
          assert.ok(params?.store, 'the composition read is per STORE');
          return [];
        }
        throw new Error(`unexpected read "${name}"`);
      },
      readAll: async (name) => (name === 'assets' ? [...library] : []),
      rows: (payload) => (Array.isArray(payload) ? payload : (payload?.items ?? [])),
      log: () => {},
      fail: (message) => {
        throw new Error(message);
      },
      uploadAsset: async (file) => {
        uploaded.push(file);
        minted += 1;
        library.push({ id: `ast_${minted}`, filename: file });
      },
    });

  return run().then(() => {
    // Only this tenant's two marks were uploaded — never the café's, whose library is another tenant's.
    assert.deepEqual(uploaded, ['forge-store-logo.png', 'forge-outlet-logo.png']);
    const config = (store, component) =>
      placed.find((p) => p.store === store && p.component === component)?.config;
    for (const [store, mark] of [
      ['sto_forge', 'ast_1'],
      ['sto_outlet', 'ast_2'],
    ]) {
      for (const bar of ['checkout_header', 'account_header']) {
        assert.equal(
          config(store, bar)?.logo,
          mark,
          `${store}/${bar} was placed with ${JSON.stringify(config(store, bar)?.logo)} — a filename here is ` +
            'a ref the kernel cannot resolve, so no `logo_url` is stamped and the bar draws no mark.',
        );
      }
      // ⛔ AND NOTHING SLIPPED INTO `brand` ON THE WAY THROUGH: a logo there REPLACES the wordmark.
      assert.equal(
        config(store, 'brand')?.logo,
        undefined,
        `${store}/brand was placed WITH a logo. \`brand.tsx:40-50\` draws \`logo.url ? <img> : (text + tail)\`, ` +
          'so that placement deletes the very wordmark this pass exists to write.',
      );
      assert.equal(config(store, 'brand')?.text, 'forge');
    }
    assert.equal(config('sto_forge', 'brand').tail, '.store');
    assert.equal(config('sto_outlet', 'brand').tail, '.outlet');
  });
});

test('⛔ in `brand`, the picture and the words are EXCLUSIVE — so each shop declares the one it draws', () => {
  // ★ THE POINT THE WHOLE ITEM TURNS ON. `extensions/chrome/brand.tsx:40-50` is `logo.url ? <img> : (text +
  // tail)` — the shop's header draws ONE of the two, never both. So dropping the new marks into `brand` as
  // well as into the bars would have DELETED `forge.store` and `forge.outlet` from every page of the vitrine,
  // which is the other half of what the owner asked for on the same day. The two shoe shops therefore keep a
  // WORD mark (it re-tints itself with the theme's accent — `.tail` is `var(--color-accent)`, and a raster
  // does not), and the café keeps the PICTURE it already had.
  //
  // ⚠️ NEITHER BRANCH IS A SKIP. Which of the two a store wants is read off the dictation table, and the
  // opposite case is asserted rather than passed over: a `logo` that appears beside a wordmark and a wordmark
  // that quietly loses its picture are the same class of silent change.
  for (const [handle, blocks] of Object.entries(DICTATED)) {
    if (blocks === null) {
      assert.equal(DATA.stores[handle], null, `"${handle}" is skipped by name here and must be null in the data`);
      continue;
    }
    const brand = blocksFor(DATA, handle).find((b) => b.component === 'brand')?.config ?? {};
    const wordmark = typeof blocks.brand?.tail === 'string';
    if (wordmark) {
      assert.equal(
        brand.logo,
        undefined,
        `store "${handle}", block brand: a logo is configured beside the words. brand.tsx:40-50 draws the ` +
          `IMAGE OR the words, never both — so this deletes "${brand.text ?? ''}${brand.tail ?? ''}" from ` +
          'every page of the shop. The mark belongs in `checkout_header` and `account_header`, where the app ' +
          'has had a position for it AND for the way back since R4.',
      );
    } else {
      assert.equal(
        typeof brand.logo,
        'string',
        `store "${handle}", block brand: the dictation says this shop's mark is a PICTURE (no tail), and ` +
          'the declaration carries none. The block would fall back to the words, silently.',
      );
    }
  }
});
