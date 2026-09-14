// A10 (the DEMO half) — THE `chrome` APP BORN INSTALLED, PLACED AND FILLED IN.
//
// ⛔ pk26/D2 — AND THE SHOP'S OWN MARK IS NOT ONE OF THEM ANY MORE. `brand` was the fifth block of this app
// and the only one that was a single slot read in FOUR renders; it is `demo-setup`'s now, three components,
// graded in `seed/demo-setup.test.mjs`. What moved WITH it: the empty-mark refusal, the exclusivity rule and
// the whitespace note about a glued `text`+`tail`. What stayed here and had to be RE-POINTED rather than
// deleted: the footer's SIGNATURE rule, which derives the shop's name from the mark — it now reads the file
// that holds it, because nothing else in this repository compares the two.
//
// ★★ WHAT IS WORTH TESTING, and none of it is "the file has four keys":
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
import { blocksOf, configKeysOf, surfaceSlots } from '../bin/app-manifest.mjs';
import { blocksFor, imagesOf, planChrome, seedChrome } from './chrome.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(SEED, 'chrome.json'), 'utf8'));
const BOX = JSON.parse(readFileSync(join(SEED, 'box.json'), 'utf8'));
// ★★ pk26/D2 — THE SHOP'S OWN MARK LEFT THIS APP, and one rule in this file still needs it: the account
// footer SIGNS the shop, and it must sign with the name the mark spells. That is now a CROSS-FILE fact, so
// it is read from the file that holds it rather than assumed.
const MARKS = JSON.parse(readFileSync(join(SEED, 'demo-setup.json'), 'utf8'));

/**
 * ★★★ pk29/D1 — THE APP'S OWN DECLARATION, READ, AND NO LONGER RE-TYPED HERE.
 *
 * ⛔ WHAT USED TO BE HERE, AND WHY IT HAD TO GO. Three tables — the slot map, the config keys, the word
 * fields — each a hand copy of `extensions/chrome/manifest.ts`. Moving ONE block into this app (pk28, the
 * sign-in mark) meant editing all three plus two more elsewhere, and one of them failed as
 * `TypeError: WORD_KEYS[block.component] is not iterable` — a red that does not name the block whose fields
 * nobody declared. A list that is a copy of a declaration is a list that can disagree with it, silently, in
 * the direction of grading less.
 *
 * `bin/app-manifest.mjs` reads the manifest at the commit `forge.lock` pins — the commit the running image
 * was baked from, so it is the same declaration the kernel validates placements against. A machine with no
 * Forge clone gets `{ tried }`, and the rules that need it say NOT CHECKED instead of passing over nothing.
 *
 * ⚠️ AND THE RULES THAT DO NOT NEED IT STILL RUN. "Which blocks exist" has a second answer that is always
 * here — `DATA.slots`, this box's own declaration — so the rules ABOUT THE STORES are graded against it, and
 * the manifest is what grades `DATA.slots` ITSELF. One cross-repo link instead of three copies.
 */
const APP = blocksOf('chrome');
const NOT_CHECKED = APP.tried ? `NOT CHECKED — the pinned chrome manifest: ${APP.tried.join(' · ')}` : null;
const CONFIG_KEYS = APP.blocks ? configKeysOf(APP.blocks) : null;

/** The components this declaration places, which is what every rule about the STORES loops over. */
const COMPONENTS = Object.keys(DATA.slots);

const dressed = Object.entries(DATA.stores).filter(([, spec]) => spec !== null);

test('★★ the slot map names the app’s OWN blocks — a component it does not ship is refused at place time', (t) => {
  // `composition.place` validates the component against the INSTALLED manifest and refuses one it does not
  // know, which costs a birth to find out. This is that refusal, read off the same manifest, in milliseconds.
  if (NOT_CHECKED) return t.skip(NOT_CHECKED);
  assert.deepEqual(
    Object.keys(DATA.slots).sort(),
    APP.blocks.map((b) => b.component).sort(),
    `seed/chrome.json places components the pinned image's manifest does not declare, or misses one it does`,
  );
});

test('★★ …and every slot it names is a slot the SURFACE really publishes', (t) => {
  // ⛔ THE OTHER HALF, AND IT IS THE ONE THE OLD HAND-COPY WAS SECRETLY DOING. A slot string is
  // `<surface>:<name>`: the surface is the block's own (the manifest says it), the name belongs to the
  // deployable that draws it — `apps/storefront/.../generated/sibling-slots.ts`, the catalogue the admin's
  // Composição reads. A typo here places a block in a slot nothing renders: 200 everywhere, drawn nowhere.
  const catalogue = surfaceSlots();
  if (NOT_CHECKED || catalogue.tried)
    return t.skip(NOT_CHECKED ?? `NOT CHECKED — the pinned slot catalogue: ${catalogue.tried.join(' · ')}`);
  for (const block of APP.blocks) {
    const declared = DATA.slots[block.component];
    const [surface, name] = String(declared).split(':');
    assert.equal(surface, block.surface, `${block.component} is placed on the "${surface}" surface and the app declares "${block.surface}"`);
    assert.ok(
      catalogue.slots.includes(name),
      `${block.component} is placed in "${declared}" and the ${block.surface} surface publishes no slot ` +
        `called "${name}". The block would be stored, and drawn by nobody.`,
    );
  }
});

test('★★★ every dressed store declares EVERY block — a half-dressed shop is the state this replaces', () => {
  // ⚠️ NO NUMBER, IN THE TITLE OR IN THE BODY. It said «ALL FIVE» and was «ALL FOUR» one pass earlier: what
  // this grades is «every block this declaration places, in every dressed store», and that sentence has no
  // number in it. The number was a second thing to edit whenever a block moved.
  for (const [handle] of dressed) {
    assert.deepEqual(
      blocksFor(DATA, handle).map((b) => b.component).sort(),
      [...COMPONENTS].sort(),
      `store "${handle}" does not declare every chrome block this file places`,
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

test('★★ no config key is invented — every one is in the block’s own `config_schema`', (t) => {
  // The schema is the APP's, so this is the one rule here that genuinely cannot be answered without it.
  if (NOT_CHECKED) return t.skip(NOT_CHECKED);
  for (const [handle] of dressed) {
    for (const block of blocksFor(DATA, handle)) {
      for (const key of Object.keys(block.config ?? {})) {
        assert.ok(
          CONFIG_KEYS[block.component]?.includes(key),
          `store "${handle}", block ${block.component}: "${key}" is not one of ` +
            `${CONFIG_KEYS[block.component]?.join('/') ?? 'a block the manifest does not declare at all'}. ` +
            'The kernel validates config against the schema, so ' +
            'an invented key is a sentence nobody ever reads.',
        );
      }
    }
  }
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
      slots: DATA.slots,
      stores: {
        a: { account_header: { logo: 'one.png' }, checkout_footer: { end_image: 'two.png' } },
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
  const wanted = [{ component: 'checkout_header', slot: DATA.slots.checkout_header, config: { back: 'Voltar à loja' } }];
  const placed = [{ placement_id: 'hp_1', component: 'checkout_header', config: { back: 'a', seal: 'c' } }];
  assert.deepEqual(planChrome(wanted, placed), [
    { action: 'update', placement_id: 'hp_1', ...wanted[0] },
  ]);
});

test('★★ …and a placement that already says the declaration costs NOTHING, `_url` stamps included', () => {
  // ⚠️ THE TRAP: a `type:'id'` field comes back with a `<field>_url` beside it. A deep-equal would find a
  // difference on every run and rewrite all fifteen placements at every birth, forever.
  // ⚠️ `account_brand`, and it used to say `brand` — a component this app has not shipped since pk26/D2,
  // with `MANIFEST_SLOTS.brand` resolving to `undefined` beside it. The rule was about `_url` stamps and went
  // on being about them over a placement of a block nobody ships.
  const wanted = [{ component: 'account_brand', slot: DATA.slots.account_brand, config: { logo: 'ast_1', text: 'forge.co' } }];
  const placed = [
    {
      placement_id: 'hp_2',
      component: 'account_brand',
      config: { logo: 'ast_1', logo_url: 'https://cdn.example/x.png', text: 'forge.co' },
    },
  ];
  assert.deepEqual(planChrome(wanted, placed), []);
});

test('a block nothing has placed yet is PLACED, in the slot the file names', () => {
  const wanted = blocksFor(DATA, 'cafe');
  const plan = planChrome(wanted, []);
  // DERIVED, not typed: this line said `4` and had to be hand-edited the day the fifth block arrived
  // (pk28, the sign-in mark). What it grades is "every wanted block becomes one step", and that sentence
  // does not have a number in it.
  assert.equal(plan.length, wanted.length);
  assert.ok(plan.every((step) => step.action === 'place'));
  assert.equal(
    plan.find((s) => s.component === 'account_header').slot,
    'storefront:account.header',
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
  // same defect in the other direction. The shoe brand named no picture at all until pk20; it now names
  // exactly its own four, and that is the assertion, not a count.
  //
  // ★ pk21/D3 ADDED THE TWO PADLOCKS TO THIS SAME LIST WITHOUT A LINE OF CODE, which is the whole point of
  // `imagesOf` deriving: a second list would have been the place the seals were forgotten, and a config that
  // kept the FILENAME renders nothing at all (`assetOf` needs the `<field>_url` the kernel stamps beside a
  // ref it recognises — extensions/chrome/logic.ts:19-27).
  const shoe = BOX.tenants.find((t) => t.id === 'forgeco').stores.map((s) => s.handle);
  const coffee = BOX.tenants.find((t) => t.id === 'forgecafe').stores.map((s) => s.handle);
  assert.deepEqual(imagesOf(DATA, shoe), [
    'forge-store-logo.png',
    'compra-segura-lockup-escuro.png',
    'forge-outlet-logo.png',
    'compra-segura-lockup-claro.png',
  ]);
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
    checkout_header: { logo: 'forge-store-logo.png', back: 'Voltar à loja', seal: '' },
    checkout_footer: {
      start_text: 'Pix · Cartão de crédito',
      middle_text: '',
      end_text: 'Compra Segura',
      // ★ pk21/D3 — the seal, in the ink of THIS footer. ★★ pk22/D4 made it the LOCKUP: the padlock AND the
      // words in one art, because the image wins the text. See `bin/chrome-seal-ink.guard.mjs`.
      end_image: 'compra-segura-lockup-escuro.png',
    },
    account_header: { logo: 'forge-store-logo.png', back: 'Voltar à loja', cart: 'Carrinho' },
    account_footer: {
      start_text: '(11) 4000-1000',
      middle_text: 'contato@forge.example',
      end_text: 'forge.store · calçados e acessórios',
    },
  },
  outlet: {
    // ★★ pk21/D3 — «Voltar ao Outlet» STAYS, and the capital is the decision. See the régua below.
    checkout_header: { logo: 'forge-outlet-logo.png', back: 'Voltar ao Outlet', seal: '' },
    checkout_footer: {
      start_text: 'Pix · Cartão de crédito',
      middle_text: '',
      end_text: 'Compra Segura',
      end_image: 'compra-segura-lockup-claro.png',
    },
    account_header: { logo: 'forge-outlet-logo.png', back: 'Voltar ao Outlet', cart: 'Carrinho' },
    account_footer: {
      start_text: '(11) 4000-2000',
      middle_text: 'contato@outlet.example',
      end_text: 'forge.outlet',
    },
  },
  cafe: {
    // ★ THE STORE HE DID NOT TOUCH, pinned so that "já está certo" survives the next pass. ★★ pk26/D2 — its
    // MARK is pinned in `seed/demo-setup.test.mjs` now, for the same reason and by the same table.
    checkout_header: { logo: 'forge-co-logo.png', seal: '' },
    checkout_footer: {
      start_text: 'Pix · Cartão de crédito',
      middle_text: '',
      end_text: 'Compra Segura',
    },
    // ★ THE ONE STORE THAT KEEPS THE OLD WORD, and it is a quotation: «na de café deixa como está».
    account_header: { logo: 'forge-co-logo.png', back: 'Voltar à loja', cart: 'Sacola' },
    account_footer: {
      start_text: '(11) 4000-3000',
      middle_text: 'contato@cafe.example',
      // ★ pk21/D3 — this shop was already spelled the way the régua asks, and that is why the régua exists:
      // the rule below was DERIVED from what the store the owner did not touch already said.
      end_text: 'forge.co · café de origem',
    },
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

test('★★★ every DICTATED word is the word the box is born with', () => {
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
          )} and the DICTATED table states ${JSON.stringify(value)}.`,
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
  const slot = DATA.slots.checkout_footer;
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

test('★★ no contact detail is a REAL one — this dataset shipped a real personal address once', () => {
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
//   · that every shop wears its OWN mark in BOTH bars (checkout and account);
//   · that a declared FILENAME actually becomes an ASSET ID in the placement, which is the whole silent
//     failure this file's own header describes ("the config would keep a filename where the kernel expects an
//     asset id, and the header would draw nothing").

/**
 * ⛔ pk29/D1 — THERE IS NO LIST HERE ANY MORE, AND THE RULE GOT WIDER RATHER THAN NARROWER.
 *
 * `WORD_KEYS` named, per component, the fields `wordOf` reads — so that the whitespace rule below could skip
 * `logo`, which is an asset reference and not a word. It was the fifth hand copy of the manifest and the one
 * that failed WORST when the sign-in mark arrived: `TypeError: WORD_KEYS[block.component] is not iterable`,
 * a red that names neither the block nor the missing declaration.
 *
 * ⇒ THE DISTINCTION IT ENCODED EARNED NOTHING. A `logo` with a leading space is not "a filename with
 * harmless whitespace": `bin/seed.mjs` resolves a bare name inside `seed/photos/`, and " forge-co-logo.png"
 * is not a file. So EVERY configured string is graded, the loop needs no table, and there is one less copy of
 * somebody else's declaration to keep in step.
 */

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
      for (const [key, raw] of Object.entries(block.config ?? {})) {
        if (typeof raw !== 'string' || raw.length === 0) continue;
        assert.equal(
          raw,
          raw.trim(),
          `store "${handle}", block ${block.component}: "${key}" is ${JSON.stringify(raw)} — it carries ` +
            'leading or trailing whitespace, and `wordOf` TRIMS every word before it is drawn ' +
            '(extensions/chrome/logic.ts:38). The space is deleted, not rendered.',
        );
      }
    }
  }
});

test('★★★ every dressed shop wears its OWN mark in BOTH bars — checkout AND account', () => {
  // ⛔ THE ACHADO, VERBATIM: «Não aparece o logo no checkout e minha conta nas lojas de sapato e outlet». Two
  // bars, named separately, because they are two placements and one of them can be forgotten in silence: the
  // app writes no default anywhere, so a bar with no `logo` renders a bar with no mark and nothing goes red.
  //
  // ⚠️ AND THE MARK IS THE STORE'S OWN FILE. Two shops sharing one is the exact state this app exists to
  // remove — the README's own words: "our wordmark, in somebody else's shop". ★ pk26/D2: the SHOP's mark is
  // no longer one of the blocks this rule can reach, and it never wanted to be — there a logo REPLACES the
  // words, which is the opposite of the two bars, where a logo and the way back stand side by side since R4.
  // Its own exclusivity rule lives in `seed/demo-setup.test.mjs`.
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
        `store "${handle}", block ${bar}: no logo. This bar has shipped unmarked before, and the ` +
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
    // Only this tenant's own pictures were uploaded — never the café's, whose library is another tenant's.
    assert.deepEqual(uploaded, [
      'forge-store-logo.png',
      'compra-segura-lockup-escuro.png',
      'forge-outlet-logo.png',
      'compra-segura-lockup-claro.png',
    ]);
    const config = (store, component) =>
      placed.find((p) => p.store === store && p.component === component)?.config;
    // ★★ pk21/D3 — AND THE PADLOCK TRAVELS THE SAME CHAIN, asserted on the SAME placements. It is the
    // second `type:'id'` field in this file and it fails the same way and in the same silence: the footer's
    // `end` area draws the picture when the kernel stamped an `end_image_url`, and draws NOTHING when it
    // could not resolve the ref (`footerArea` → `assetOf`; extensions/chrome/logic.test.ts:67 pins exactly
    // that case). A filename stored here is a footer whose right-hand area is empty on a live box.
    for (const [store, seal] of [
      ['sto_forge', 'ast_2'],
      ['sto_outlet', 'ast_4'],
    ]) {
      assert.equal(
        config(store, 'checkout_footer')?.end_image,
        seal,
        `${store}/checkout_footer was placed with ${JSON.stringify(
          config(store, 'checkout_footer')?.end_image,
        )} — a filename is a ref the kernel cannot resolve, so no \`end_image_url\` is stamped and the ` +
          'footer draws no seal at all.',
      );
      // ⛔ …and the word is still there beside it, because it is the picture's accessible name.
      assert.equal(config(store, 'checkout_footer')?.end_text, 'Compra Segura');
    }
    for (const [store, mark] of [
      ['sto_forge', 'ast_1'],
      ['sto_outlet', 'ast_3'],
    ]) {
      for (const bar of ['checkout_header', 'account_header']) {
        assert.equal(
          config(store, bar)?.logo,
          mark,
          `${store}/${bar} was placed with ${JSON.stringify(config(store, bar)?.logo)} — a filename here is ` +
            'a ref the kernel cannot resolve, so no `logo_url` is stamped and the bar draws no mark.',
        );
      }
      // ⛔ AND NOTHING SLIPPED INTO A MARK ON THE WAY THROUGH — which since pk26/D2 is a stronger statement
      // than it used to be: this app has no block that can carry one. A `brand` placement coming out of THIS
      // seed would be `chrome` reaching into an app that is no longer its own.
      assert.equal(
        config(store, 'brand'),
        undefined,
        `${store}: this seed placed a \`brand\` block. The shop's mark left this app in pk26/D2 — it is ` +
          '`demo-setup`\'s, three components, and `seed/demo-setup.mjs` is what places it.',
      );
    }
  });
});

// ══ pk21/D3 — THE SEAL, AND THE SHOP'S NAME SPELLED ONE WAY ══════════════════════════════════════════════
//
// Two owner's instructions of 07/09, and the rules they need are of different kinds:
//   · *"compra segura precisa usar o do app, precisa preencher pois quero mostrar isso na demo"* — the
//     `end_image` half of the footer area, which until this pass no store in this dataset used at all. The
//     demo therefore demonstrated the words of a block and never its PICTURE. The ink of that picture is
//     graded where it can be measured — `bin/chrome-seal-ink.guard.mjs`, off the PNG's own pixels;
//   · the mark, minúsculo, everywhere it is a MARK. `pk20` lowercased the header (`forge.outlet`) and left
//     the footer of the same shop reading `Forge Outlet` — one shop, two spellings of one name.
//
// ⚠️ AND THE SECOND RULE IS A RÉGUA, NOT A SEARCH-AND-REPLACE, because this dataset also writes `Forge
// Outlet` in nine other places on purpose: the store's registered NAME (`seed/box.json:122`,
// `seed/catalog.json:55`) and ten CMS titles («Sobre o Forge Outlet», `seed/outlet.json:410-453`). Those are
// prose and entity names, not the mark. So the régua is:
//
//     THE MARK IS LOWERCASE WHERE IT STANDS ALONE AS A MARK; PROSE KEEPS PORTUGUESE CAPITALISATION.
//
// ⇒ `account_footer.end_text` is a mark standing alone (the footer's right-hand signature) and is graded
//   against `brand`, below. ⇒ `back` — «Voltar ao Outlet» — is a SENTENCE whose noun is the shop, and «o
//   Outlet» is a proper noun that takes a capital in Portuguese; lowercasing it there would read as a typo
//   and «Voltar ao forge.outlet» puts a domain-shaped token inside a clause where it has no grammar. It
//   STAYS, and it is pinned in `DICTATED` above so that staying is a decision somebody made and not a field
//   nobody looked at.

test('★★★ a picture in a footer area never travels alone — the word beside it is its only accessible name', () => {
  // ⛔ THE MEASUREMENT THAT MAKES THIS A RULE AND NOT A PREFERENCE: an area carries both fields and the block
  // CHOOSES — `footerArea` returns `{kind:'image', url, alt: text ?? ''}` when the image resolved
  // (extensions/chrome/logic.ts:53-61), and `footer-block.tsx:38-43` renders `<img alt={area.alt}>`. So the
  // word does NOT stand beside the picture on the screen: it BECOMES the picture's description, which the
  // app's own Compose hint says out loud («A imagem vence o texto; o texto passa a ser a descrição dela»).
  // Dropping `end_text` once `end_image` is set therefore costs nothing visible and ships `alt=""` — a
  // picture that a screen reader announces as nothing at all, in the one footer that exists to reassure.
  //
  // ⚠️ pk22/D4 DID NOT MAKE THIS RULE REDUNDANT, it made it the last line of defence. The art now SPELLS
  // «Compra Segura», so the sighted shopper reads it — which is exactly the argument somebody will use for
  // dropping the `end_text` as a duplicate. It is not one: those letters are pixels. Drop the word and the
  // phrase leaves the DOM entirely, and the only reader who loses it is the one who most needs it.
  let checked = 0;
  for (const [handle, blocks] of Object.entries(DICTATED)) {
    if (blocks === null) {
      assert.equal(DATA.stores[handle], null, `"${handle}" is skipped by name here and must be null in the data`);
      continue;
    }
    for (const block of blocksFor(DATA, handle)) {
      if (!block.component.endsWith('_footer')) continue;
      for (const area of ['start', 'middle', 'end']) {
        const picture = block.config?.[`${area}_image`];
        if (typeof picture !== 'string' || picture.trim().length === 0) continue;
        const word = block.config?.[`${area}_text`];
        assert.ok(
          typeof word === 'string' && word.trim().length > 0,
          `store "${handle}", block ${block.component}: "${area}_image" is set and "${area}_text" is ` +
            `${JSON.stringify(word)}. The image WINS over the text and the text becomes its \`alt\` — so an ` +
            'empty word here is not a tidier footer, it is an unnamed picture.',
        );
        checked += 1;
      }
    }
  }
  assert.equal(
    checked,
    2,
    'two footer pictures were expected (the two shoe shops’ lockups). A different number means a store ' +
      'gained or lost one and this rule graded a set nobody decided.',
  );
});

test('★★★ the shop signs its footer with its OWN mark, spelled the way its header spells it', () => {
  // ★ THE RULE IS DERIVED FROM THE MARK AND NOT TYPED TWICE. A shop's mark is `text + tail` concatenated
  // (each trimmed), so the mark of a shop is a fact that is DECLARED somewhere and never re-typed here. The
  // footer's right-hand area is where the same shop signs its name — so it must START with that mark, and
  // anything after it is the shop's own descriptor.
  //
  // ⚠️ AND SINCE pk26/D2 THE TWO HALVES LIVE IN TWO FILES OWNED BY TWO APPS, which is exactly why this rule
  // had to move rather than be deleted: `seed/demo-setup.json` holds the mark and `seed/chrome.json` holds
  // the signature, and NOTHING else in this repository compares them. A shopper crossing from the header to
  // this footer does not change page. (Its twin lives in `seed/demo-setup.test.mjs`, asked from the other
  // side — one of the two files can lose a store, and each rule catches the loss in its own.)
  //
  // ⚠️ IT WOULD HAVE GONE RED ON BOTH SHOE SHOPS BEFORE THIS PASS («Forge Outlet», «Forge · calçados e
  // acessórios») AND GREEN ON THE CAFÉ («forge.co · café de origem») — the store the owner told us was
  // already right. That is where the rule comes from: it was read off the shop nobody had to correct, not
  // invented to justify an edit.
  let signed = 0;
  for (const [handle, blocks] of Object.entries(DICTATED)) {
    if (blocks === null) {
      assert.equal(DATA.stores[handle], null, `"${handle}" is skipped by name here and must be null in the data`);
      continue;
    }
    const configs = Object.fromEntries(blocksFor(DATA, handle).map((b) => [b.component, b.config ?? {}]));
    // ★★ WHERE A SHOP'S MARK IS DECLARED IS ITSELF A FACT ABOUT THE SHOP, and since pk35/d7 there are two
    // answers rather than one. A shop the REFERENCE vitrine dresses declares it in `seed/demo-setup.json`
    // (`header_brand`); the café's vitrine is a FORK that draws its own, so the instance removed those rows
    // and the mark it wears on the screens WE host is the `chrome` app's `account_brand`. Asking the first
    // that answers is the derivation; naming one file would have made this rule silent for the café exactly
    // when the café stopped being in it.
    const brand =
      blocksFor(MARKS, handle).find((b) => b.component === 'header_brand')?.config ??
      configs.account_brand ??
      {};
    const mark = `${(brand.text ?? '').trim()}${(brand.tail ?? '').trim()}`;
    assert.ok(
      mark.length > 0,
      `store "${handle}" declares no wordmark in seed/demo-setup.json (header_brand) nor in ` +
        'seed/chrome.json (account_brand), so there is nothing for its footer to sign with',
    );
    const signature = configs.account_footer?.end_text ?? '';
    assert.ok(
      signature === mark || signature.startsWith(`${mark} `),
      `store "${handle}": the shop's header says "${mark}" and its account footer signs off as ` +
        `"${signature}". One shop, one spelling — a shopper crosses from the header to the footer without ` +
        'changing page. Write the mark exactly, optionally followed by this shop’s own descriptor.',
    );
    signed += 1;
  }
  assert.equal(signed, 3, 'three dressed shops sign their footers — a shorter loop is a shop that vanished');
});
