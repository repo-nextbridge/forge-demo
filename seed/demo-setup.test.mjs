// pk26/D2 — THE SHOP'S MARK, DECLARED BY THIS BOX'S OWN APP. What is worth testing, and none of it is "the
// file has three keys":
//   · a brand block with NEITHER a logo NOR a word DELETES the shop's mark. All three of these slots replace
//     the front's own wordmark and the app draws nothing when nothing is configured, so the failure is a
//     header — or a footer column — with no name on it, on every page, and nothing anywhere going red;
//   · «Leve. Inteligente. Sua.» used to be a LITERAL of the Forge kit, ceded as one node with the mark. From
//     this file on the demo says it because it CONFIGURED it, and only in the two named shops. A
//     declaration that drops it puts the shops' footers back to a mark with nothing under it — and a test
//     that only counted placements would stay green on exactly that;
//   · the mark is the SAME mark the funnel wears, spelled the same way. Two files, one shop: a shopper
//     crossing from the header to the checkout does not change brand;
//   · a store the file has never heard of is NAMED, never skipped;
//   · ★★★ and since v0.4 the declaration carries a block that is NOT a mark — the demonstration notice —
//     so every rule here that says «every block of a dressed store» had to say which KIND it means. The one
//     that must not be weakened by that is `markless()`: it stays red for a mark with no mark in it, and it
//     is silent about a block that cannot carry one. Both halves are asserted below, the second as the
//     control that proves the first is still looking.
//
// ⚠️ WHERE THE NOTICE'S OWN RULE LIVES, AND IT IS NOT HERE: «every store on the street is born wearing it»
// is `bin/ribbon-at-birth.guard.mjs`, because its subject is the BOX (`seed/box.json`) and not this
// declaration. What is graded here is what is true of this file's blocks.
//
// ⚠️ THE ENGINE ITSELF IS TESTED IN `seed/chrome.test.mjs`, which drives the same `seed/blocks.mjs` over the
// other declaration. What is here is what is true of THESE blocks.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blocksOf, configKeysOf, surfaceSlots } from '../bin/app-manifest.mjs';
import { blocksFor, imagesOf } from './blocks.mjs';
import { markComponents, markless, seedDemoSetup } from './demo-setup.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(SEED, 'demo-setup.json'), 'utf8'));
const CHROME = JSON.parse(readFileSync(join(SEED, 'chrome.json'), 'utf8'));

/**
 * ★★★ THE APP'S OWN DECLARATION, READ — never a table re-typed beside it.
 *
 * ⛔ WHAT USED TO BE HERE: `MANIFEST_SLOTS` and `CONFIG_KEYS`, two hand copies of `apps/demo-setup/manifest.ts`.
 * The same shape cost five edits in this repository when ONE block moved between two apps (pk29/D1 measured
 * it), and one of those edits failed as `TypeError` rather than as a sentence naming the block. Adding the
 * fourth block here would have been the same bill again: a list that is a copy of a declaration disagrees
 * with it silently, and always in the direction of grading LESS.
 *
 * ⚠️ AND IT NEEDS NO CHECKOUT. `demo-setup` is an app of THIS box — `apps/demo-setup/manifest.ts` is right
 * here — so `blocksOf` always answers, and no rule in this file has a NOT CHECKED branch to take. The one
 * question that does leave this repository is «does the surface really publish that slot», and only that
 * rule waits for the pinned tree.
 */
const APP = blocksOf('demo-setup');
const CONFIG_KEYS = configKeysOf(APP.blocks);

/** The components that ARE the shop's mark, derived by `seed/demo-setup.mjs` off the same manifest: a block
 *  whose `config_schema` offers somewhere to put a logo or a word. The notice is not one of them. */
const MARKS = markComponents('demo-setup');

/**
 * ★★ THE FOURTH MARK, WHICH LEFT IN pk28 — `account_brand` → `storefront:account.brand`, the login box. It
 * went on the axis of the DEPLOYABLE and not because anything about it was wrong: the vitrine is FORKABLE and
 * a customer makes it theirs, so identity there may live in an app of that customer's own; the CHECKOUT is
 * hosted by us and nobody forks it, so identity there has to be configurable without a fork and is the
 * PRODUCT's. Named here so that putting it back is RED in the declaration as well as in the manifest — a
 * store that declared it again would place a block this app no longer ships, and `composition.place` would
 * refuse the birth with `no block 'account_brand' declared by extension`.
 */
const GONE_TO_THE_PRODUCT = 'account_brand';

/** THE INSTRUCTION, verbatim: a content block saying «Leve. Inteligente. Sua.» under the footer's logo, in
 *  the shoe shop and the outlet. */
const TAGLINE = 'Leve. Inteligente. Sua.';
const SIGNS = ['forge', 'outlet'];

/** Every store this declaration writes rows for. Since v0.4 that is not the same set as the one below. */
const dressed = Object.entries(DATA.stores).filter(([, spec]) => spec !== null);

/** ★★★ THE STORES THAT WEAR A MARK, which is the subject of almost every rule in this file and stopped being
 *  «the dressed ones» when the café came back for the notice alone. Derived from the declaration against the
 *  manifest's own idea of a mark, so a shop that arrives or vanishes changes this and nothing else. */
const marked = dressed.filter(([, spec]) => MARKS.some((component) => component in spec));

/** The MARK blocks one store declares — what «every block of this shop» used to mean, said explicitly now
 *  that a dressed shop may also be wearing something that is not a mark. */
const marksOf = (handle) => blocksFor(DATA, handle).filter((b) => MARKS.includes(b.component));

test('★★ the slot map names the app’s OWN blocks — a component it does not ship is refused at place time', () => {
  // `composition.place` validates the component against the INSTALLED manifest and refuses one it does not
  // know, which costs a birth to find out. This is that refusal, read off the same manifest, in milliseconds.
  assert.equal(DATA.app, 'demo-setup');
  assert.deepEqual(
    Object.keys(DATA.slots).sort(),
    APP.blocks.map((b) => b.component).sort(),
    'seed/demo-setup.json places components apps/demo-setup/manifest.ts does not declare, or misses one it ' +
      'does. A block the app ships and this file never places is a block no store of this box can ever wear.',
  );
});

test('★★★ each slot is in the AREA its block declares — and the notice declares none, which is the point', () => {
  // ⛔ AREAS CONFINE BY PREFIX (trava 7): a block with `area: 'header'` may only be placed in a slot whose
  // page prefix is `header`, and the kernel enforces it. So the three marks' slots are not free choices —
  // they are the only ones their own manifest allows — and `demo_ribbon` declaring NO area is what lets the
  // notice be placed in a footer slot at all. A block that grew an `area` tomorrow would pin itself here.
  let confined = 0;
  for (const block of APP.blocks) {
    const declared = DATA.slots[block.component];
    const [surface, name] = String(declared).split(':');
    assert.equal(
      surface,
      block.surface,
      `${block.component} is placed on the "${surface}" surface and the app declares "${block.surface}"`,
    );
    if (block.area === undefined) continue;
    confined += 1;
    assert.equal(
      name.split('.')[0],
      block.area,
      `${block.component} declares \`area: "${block.area}"\` and this file places it in "${declared}", ` +
        'whose page prefix is something else. The kernel confines a block to its area by that prefix, so ' +
        'this placement is refused at birth.',
    );
  }
  assert.ok(confined > 0, 'no block of this app declares an area, so the rule above graded nothing at all');
});

test('★★ …and every slot it names is a slot the SURFACE really publishes', (t) => {
  // ⛔ THE HALF THAT LEAVES THIS REPOSITORY. A slot string is `<surface>:<name>`: the surface is the block's
  // own, the name belongs to the deployable that draws it — the catalogue the admin's Composição reads. A
  // name nothing publishes places a block that is stored and drawn by nobody: 200 everywhere, invisible.
  // ⚠️ AND THIS IS THE RULE THE NOTICE NEEDED MOST. `footer.end` is a slot no block of this app used before
  // v0.4, and «the operator drags it there» was, until this slice, the only thing that had ever checked it.
  const catalogue = surfaceSlots();
  if (catalogue.tried) return t.skip(`NOT CHECKED — the pinned slot catalogue: ${catalogue.tried.join(' · ')}`);
  for (const [component, declared] of Object.entries(DATA.slots)) {
    const name = String(declared).split(':')[1];
    assert.ok(
      catalogue.slots.includes(name),
      `${component} is placed in "${declared}" and the storefront surface publishes no slot called ` +
        `"${name}". The block would be stored, and drawn by nobody.`,
    );
  }
});

test('★★★ every MARKED store declares ALL the marks — a shop missing one lost its name in that place', () => {
  // ⛔ ONE COMPONENT PER PLACE, WHICH IS THE KERNEL'S RULE AND NOT A PREFERENCE: `placement: 'single'` is per
  // (store, app, component), so the three places can only be filled by three components. A store that
  // declared two would have one of them wearing the FORGE fallback — the exact half-substitution («`acme.` at
  // the top and `forge.` at the bottom of the same page») that pk26 exists to end.
  // ⚠️ NO NUMBER IN THE TITLE OR IN THE BODY, and there used to be one («ALL THREE»). What this grades is
  // «every mark this app ships, in every shop that wears one», and that sentence has no number in it — the
  // number was a second thing to edit the day a mark arrived or left.
  for (const [handle] of marked) {
    assert.deepEqual(
      blocksFor(DATA, handle)
        .map((b) => b.component)
        .filter((component) => MARKS.includes(component))
        .sort(),
      [...MARKS].sort(),
      `store "${handle}" does not declare every mark this app ships`,
    );
  }
  // ⛔ TWO SINCE pk35/d7, AND THE NUMBER IS THE DECISION. The café's vitrine is a FORK that draws its own
  // mark, and its account screens replace the kit's whole header and footer with `chrome/account_header` and
  // `chrome/account_footer` — measured live on the bench: ZERO `demo-setup-*` marks on either. So its three
  // rows drew nothing anywhere, and this repository's rule — a fork belongs to the customer, with 100%
  // freedom — says the INSTANCE removes the placement of a store whose fork draws it.
  // `seed/demo-setup.json` carries the measurement in full. ⇒ a THIRD dressed shop here is a shop somebody
  // dressed without saying why.
  assert.equal(marked.length, 2, 'two shops wear a mark — a different count is a shop that arrived or vanished');
  // ⚠️ AND THE CAFÉ IS NO LONGER `null` — IT IS DRESSED IN THE NOTICE AND IN NO MARK, which is a stronger
  // statement than absence and is why this rule is spelled this way rather than `stores.cafe === null`.
  assert.deepEqual(
    MARKS.filter((component) => component in (DATA.stores.cafe ?? {})),
    [],
    'the café wears a mark again. Its vitrine is a fork with its own chrome and its account screens draw the ' +
      '`chrome` app\u2019s instead of the kit\u2019s, so those rows render on no screen of that store — ' +
      'rows an operator can drag and never see the effect of. The NOTICE is the exception and the reason is ' +
      'in the declaration: it is not the customer\u2019s content, it is this box saying its prices are not real.',
  );
});

test('★★ the LOGIN BOX is not this file’s — the block moved to the product on the deployable axis', () => {
  // ⇒ SABOTAGE: give any store back an `account_brand` and this names the store. It is not a tidy-up: the app
  //   no longer ships that component, so `composition.place` would refuse it at birth with
  //   `validation_failed: no block 'account_brand' declared by extension 'demo-setup'` — and a birth that
  //   fails on the mark of one shop is a box that does not come up.
  assert.equal(
    DATA.slots[GONE_TO_THE_PRODUCT],
    undefined,
    `the \`slots\` map still names "${GONE_TO_THE_PRODUCT}". The login box is the CHECKOUT's screen — the ` +
      'deployable we host and nobody forks — so its mark is configured by the OOTB `chrome` app, never by an ' +
      'app of one instance: those three blocks are the STOREFRONT\u2019s and the login box the CHECKOUT\u2019s.',
  );
  for (const [handle, spec] of Object.entries(DATA.stores)) {
    if (spec === null) continue;
    assert.equal(
      spec[GONE_TO_THE_PRODUCT],
      undefined,
      `store "${handle}" declares "${GONE_TO_THE_PRODUCT}". The login box is the CHECKOUT's screen — the ` +
        'deployable we host and nobody forks — so its mark is configured by the OOTB `chrome` app, never by ' +
        'an app of one instance: those three blocks are the STOREFRONT\u2019s and the login box the CHECKOUT\u2019s.',
    );
  }
});

test('★★ no config key is invented — every one is in the block’s own `config_schema`', () => {
  // ⛔ AND THE NOTICE IS THE HARD CASE THIS COVERS FOR FREE: its `config_schema` is EMPTY, on purpose (a
  // sentence an operator can edit is a sentence an operator can empty), so ANY key written under it here is
  // a key the kernel drops on the floor — a sentence nobody ever reads, written in a file that looks like it
  // said something. The derived table is what makes that an assertion instead of a hope.
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

test('⛔ a mark with neither a logo nor a word would DELETE the shop’s name from that place', () => {
  assert.deepEqual(markless(DATA), []);
  // …and the refusal is capable of red, which is the only reason to trust it. It asks the question of every
  // block that CAN carry a mark, not of component names written here — a fifth mark added tomorrow is
  // covered without anybody remembering, and that is what `markComponents` buys.
  assert.deepEqual(
    markless({
      app: 'demo-setup',
      slots: DATA.slots,
      stores: {
        x: { header_brand: {} },
        y: { footer_brand: { tail: '   ' } },
        // ⛔ AND A TAGLINE IS NOT A MARK: a sentence standing where the shop's name should be is the same
        // defect one element to the right, which is the kit's own reason for ceding the node as a unit.
        z: { footer_brand: { tagline: TAGLINE } },
      },
    }),
    ['x/header_brand', 'y/footer_brand', 'z/footer_brand'],
  );
});

test('★★★ …and it is SILENT about the block that cannot carry a mark — the control that proves it looks', () => {
  // ⛔ THE PRECISION THIS SLICE HAD TO GET RIGHT. Before v0.4 every block of this declaration was a mark, so
  // «refuse a block with no config» and «refuse a MARK with no mark» were the same sentence. The notice broke
  // that: it declares NO `config_schema` at all — the app ships its sentence in three languages precisely so
  // an operator cannot empty it — so `{}` is the only config it can ever have, and the reason the refusal
  // states («a header, a drawer or a footer column with NO MARK AT ALL») is not a sentence about it.
  //
  // ⚠️ THE TWO HALVES ARE ASSERTED IN ONE SPEC, ON PURPOSE. A loosened refusal and a refusal that stopped
  // looking are the same green if you only check the notice; here the SAME store carries an empty notice and
  // an empty mark, and exactly one of them comes back.
  const notice = APP.blocks.find((b) => b.config_schema.length === 0);
  assert.ok(notice, 'this app ships no unconfigurable block, so the control below is grading nothing.');
  assert.ok(!MARKS.includes(notice.component), `${notice.component} is counted as a MARK — the derivation is wrong`);
  assert.deepEqual(
    markless({
      app: 'demo-setup',
      slots: DATA.slots,
      stores: { x: { [notice.component]: {} }, y: { [notice.component]: {}, header_brand: {} } },
    }),
    ['y/header_brand'],
    'the refusal either accused the notice — which would make the birth fail on a block that is correct — ' +
      'or it stopped accusing an empty mark, which is the defect it exists for standing right beside it.',
  );
});

test('★★ and WHICH blocks are marks comes off the manifest — hand it another answer and the subject moves', () => {
  // ⛔ THE VÁCUO THE DERIVATION COULD HIDE. `markless` returning `[]` is the right answer for this file and
  // also the answer a refusal that looks at NOTHING gives. So it is driven here with the subject supplied
  // explicitly: told the notice is a mark, it accuses the notice; told nothing is, it accuses nobody — which
  // is what the anti-vacuum in `markComponents` refuses to let the real call reach.
  const notice = APP.blocks.find((b) => b.config_schema.length === 0);
  const spec = { app: 'demo-setup', slots: DATA.slots, stores: { x: { [notice.component]: {} } } };
  assert.deepEqual(markless(spec, [notice.component]), [`x/${notice.component}`]);
  assert.deepEqual(markless(spec, []), []);
  // …and the real subject is the manifest's, which is the same list `seed/demo-setup.mjs` derives.
  assert.deepEqual(
    [...MARKS].sort(),
    APP.blocks
      .filter((b) => b.config_schema.some((f) => ['logo', 'text', 'tail'].includes(f.name)))
      .map((b) => b.component)
      .sort(),
  );
});

test('★★★ the two shoe shops SAY the sentence the kit used to give them for free', () => {
  // ★★ THE POINT OF THE WHOLE ENTRY. «Leve. Inteligente. Sua.» is not new — it is the Forge fallback of
  // `footer.brand`, and that fallback cedes the node as a UNIT: mark AND sentence together, deliberately,
  // because the sentence is OURS and «leaving it standing under somebody else's logo would be the same
  // defect one element to the right». ⇒ placing a mark in that column DELETES the sentence. From this
  // declaration on the demo says it because it CONFIGURED it, which is what a customer needs to see.
  //
  // ⇒ SABOTAGE: drop `tagline` from either shop and this goes red naming the shop AND naming what the
  //   sentence used to be — a literal of the Forge kit that the placement silently takes away.
  for (const handle of SIGNS) {
    const footer = blocksFor(DATA, handle).find((b) => b.component === 'footer_brand')?.config ?? {};
    assert.equal(
      footer.tagline,
      TAGLINE,
      `store "${handle}": its footer places a mark and declares no \`tagline\`. That slot's fallback is the ` +
        `Forge wordmark AND "${TAGLINE}" as ONE node, so a placed mark takes the sentence with it — the ` +
        'shop would come out of a birth with a name and nothing under it, silently. The sentence was a ' +
        'literal of the kit until pk26/D2; here it exists BY CONFIGURATION, which is the half worth showing.',
    );
  }
});

test('⛔ and ONLY those two say it — the café has a footer of its own and the counter has no shop window', () => {
  // ⇒ SABOTAGE: give the café or the counter a tagline and this names it. The instruction named TWO shops,
  //   the shoe shop and the outlet; a sentence in the café's footer would be this box writing copy for
  //   a store whose whole vitrine is a fork, and the counter draws neither a footer nor an account screen.
  for (const [handle, spec] of Object.entries(DATA.stores)) {
    if (SIGNS.includes(handle)) continue;
    if (spec === null) continue;
    for (const block of blocksFor(DATA, handle)) {
      assert.equal(
        block.config?.tagline,
        undefined,
        `store "${handle}", block ${block.component}: a tagline. The instruction named the two shoe shops ` +
          'and no other; this one did not ask for a sentence.',
      );
    }
  }
  assert.equal(
    DATA.stores.balcao,
    null,
    'the counter is a whole-host app with no store in its URL: it mounts neither the kit chrome nor our ' +
      'account screens, so three placements there would be three rows an operator can drag and never see. It ' +
      'is declared `null` — named, never silently absent.',
  );
});

test('★★ in every mark the picture and the words are EXCLUSIVE, so each shop declares the one it draws', () => {
  // ★ THE POINT THE MIGRATION TURNS ON. The block draws `logo ? <img> : (text + tail)` — one of the two,
  // never both — so dropping a logo into the two shoe shops would DELETE `forge.store` and `forge.outlet`
  // from every page of their vitrines. They keep a WORD mark because a word re-tints itself with the theme's
  // accent and a raster does not; the café keeps the PICTURE it already had, with `text` as its alt.
  //
  // ⚠️ NEITHER BRANCH IS A SKIP: a logo appearing beside a wordmark and a wordmark quietly losing its picture
  // are the same class of silent change, so the opposite case is asserted rather than passed over.
  // ⚠️ pk35/d7 — THE PICTURE BRANCH HAS NO LIVE SPECIMEN HERE ANY MORE, and that is said rather than left as
  // a dead `else`. The café was the one store of this declaration with art, and the instance removed its
  // placements (see the rule above). The block's own picture/word exclusivity is still GRADED where it can
  // be: `apps/demo-setup/block/marks.test.tsx` renders all three marks with a logo and asserts the words
  // disappear. What this rule keeps is the half that can still go wrong HERE — a logo dropped into a shop
  // whose mark is a word, which deletes that word from every page of its vitrine.
  const WORDMARK = { forge: true, outlet: true };
  assert.deepEqual(
    Object.keys(WORDMARK).sort(),
    marked.map(([handle]) => handle).sort(),
    'this table and the shops that wear a mark disagree, so the loop below is grading something else',
  );
  for (const [handle] of marked) {
    for (const block of marksOf(handle)) {
      const config = block.config ?? {};
      if (WORDMARK[handle]) {
        assert.equal(
          config.logo,
          undefined,
          `store "${handle}", ${block.component}: a logo is configured beside the words. The block draws the ` +
            `IMAGE OR the words, never both — so this deletes "${config.text ?? ''}${config.tail ?? ''}" ` +
            'from every page of the shop.',
        );
        assert.ok(typeof config.text === 'string' && config.text.length > 0);
      } else {
        assert.equal(
          typeof config.logo,
          'string',
          `store "${handle}", ${block.component}: this shop's mark is a PICTURE and the declaration carries ` +
            'none. The block would fall back to the words, silently.',
        );
        assert.ok(
          typeof config.text === 'string' && config.text.length > 0,
          `store "${handle}", ${block.component}: a logo with no \`text\`. The word is the picture's only ` +
            'accessible name — a logo IS the store\'s name to a screen reader, and an empty alt on the only ' +
            'mark in a header leaves the anchor unnamed.',
        );
      }
    }
  }
});

test('★★ no configured word leans on WHITESPACE — the two halves are glued, so a space is deleted', () => {
  // ⛔ THE MEASUREMENT BEHIND `forge.outlet` BEING THE RIGHT MARK. The outlet's mark used to be `text: "Forge"` +
  // `tail: " Outlet"` and its header read `ForgeOutlet`: every configured word is trimmed before it is drawn
  // and the two halves are concatenated with NOTHING between them. So a leading space is not fragile
  // styling — it is a character deleted every time, and the only separator that survives is a printable one.
  for (const [handle] of dressed) {
    for (const block of blocksFor(DATA, handle)) {
      for (const key of ['text', 'tail', 'tagline']) {
        const raw = block.config?.[key];
        if (typeof raw !== 'string' || raw.length === 0) continue;
        assert.equal(
          raw,
          raw.trim(),
          `store "${handle}", ${block.component}: "${key}" is ${JSON.stringify(raw)} — it carries leading or ` +
            'trailing whitespace, which is TRIMMED before it is drawn. Separate a name from its tail with a ' +
            'PRINTABLE character (a point), never with a space.',
        );
      }
    }
  }
});

test('★★★ one shop, ONE mark — the three places of a store all spell it the same way', () => {
  // ⇒ SABOTAGE: change the tail of one of the three and this names the shop and the two spellings. The
  //   liberty pk26 bought is the liberty to put a DIFFERENT mark in each place; this box does not want one,
  //   and the difference between "we may" and "we did by accident" is this rule.
  for (const [handle] of marked) {
    const marks = new Set(
      marksOf(handle).map((b) => {
        const c = b.config ?? {};
        return JSON.stringify([c.logo ?? null, c.text ?? null, c.tail ?? null]);
      }),
    );
    assert.equal(
      marks.size,
      1,
      `store "${handle}" spells its mark ${marks.size} different ways across its places: ` +
        `${[...marks].join(' vs ')}. A component per place is what lets a shop CHOOSE that; this box did not.`,
    );
  }
});

test('★★★ the mark the vitrine wears is the mark the FUNNEL wears — two apps, one shop', () => {
  // ⚠️ THE RULE THE SPLIT MADE NECESSARY. Until pk26 the mark and the funnel's bars lived in one file, so
  // "the same shop" was a glance. They are now two declarations owned by two apps, and nothing but this line
  // ties them: `seed/chrome.json`'s account footer SIGNS the shop, and it must sign with the name the mark
  // spells. A shopper crossing from the header to the footer does not change page.
  let signed = 0;
  for (const [handle] of marked) {
    const mark = blocksFor(DATA, handle).find((b) => b.component === 'header_brand')?.config ?? {};
    const word = `${(mark.text ?? '').trim()}${(mark.tail ?? '').trim()}`;
    assert.ok(word.length > 0, `store "${handle}" has no word in its mark to sign anything with`);
    const signature =
      blocksFor(CHROME, handle).find((b) => b.component === 'account_footer')?.config?.end_text ?? '';
    assert.ok(
      signature === word || signature.startsWith(`${word} `),
      `store "${handle}": its mark says "${word}" (seed/demo-setup.json) and its account footer signs off ` +
        `as "${signature}" (seed/chrome.json). One shop, one spelling. Write the mark exactly, optionally ` +
        'followed by this shop’s own descriptor.',
    );
    signed += 1;
  }
  assert.equal(signed, 2, 'two dressed shops sign their footers — a different count is a shop that arrived or vanished');
});

test('★★ every picture the declaration names is a file this repository actually has', () => {
  // ⚠️ pk35/d7 — THE LIST IS EMPTY TODAY, AND THAT IS DATA RATHER THAN A HOLE. The café was the only store
  // here with art and the instance removed its placements; the two shoe shops keep WORDS on purpose, because
  // `tail` takes the theme's accent and a raster does not. So this loop grades whatever is named, and what
  // must not go silent is the CHAIN behind a name — filename here, asset id in the placement — which is
  // driven for real against the SAME hand (`seed/blocks.mjs`) in `seed/chrome.test.mjs`, whose declaration
  // still names three pictures, the café's among them.
  const files = imagesOf(DATA);
  assert.deepEqual(
    files,
    [],
    'a store of this declaration names a picture again. Good — say so here, and keep the line below: a ' +
      'filename the seed cannot upload becomes a ref the kernel cannot resolve, no `logo_url` is stamped, ' +
      'and the mark draws nothing at all.',
  );
  for (const file of files) {
    assert.ok(
      existsSync(join(SEED, 'photos', file)),
      `seed/demo-setup.json names "${file}" and seed/photos/ does not have it. The seed would upload ` +
        'nothing, the config would keep a filename where the kernel expects an asset id, and the mark would ' +
        'draw nothing — silently.',
    );
  }
});

test('★★ the two declarations name the SAME stores — a shop dressed by one and not the other is half-dressed', () => {
  // ⛔ THE VÁCUO OF THE SPLIT ITSELF. Every rule in this file loops over `DATA.stores`, and every rule in
  // `seed/chrome.test.mjs` loops over `chrome.json`'s: a store dropped from one file would make one set of
  // loops shorter and greener, and the shop would come out of a birth wearing half its identity.
  assert.deepEqual(Object.keys(DATA.stores).sort(), Object.keys(CHROME.stores).sort());
  assert.equal(DATA.stores.balcao, null);
  assert.equal(CHROME.stores.balcao, null);
});

test('★★★ …and the whole thing DRIVEN: install, upload, place — with the filename becoming an asset id', () => {
  // The chain this file's header calls silent: a `logo` is a FILENAME here and an asset-library ID in the
  // placement, and a run that wrote the filename would leave the kernel unable to stamp a `logo_url`, so the
  // mark draws nothing at all. Driven over a fake port rather than asserted about.
  const calls = [];
  const uploaded = [];
  const assets = [];
  let nextAsset = 0;

  const run = async () =>
    seedDemoSetup({
      command: async (name, input) => {
        calls.push({ name, input });
        return { ok: true };
      },
      read: async (what, params) => {
        if (what === 'installed_extensions') return { items: [] };
        if (what === 'stores') {
          return {
            items: [
              { id: 'sto_forge', handle: 'forge' },
              { id: 'sto_outlet', handle: 'outlet' },
              { id: 'sto_cafe', handle: 'cafe' },
              { id: 'sto_balcao', handle: 'balcao' },
              { id: 'sto_ghost', handle: 'ghost' },
            ],
          };
        }
        if (what === 'extension_composition') {
          assert.ok(params?.store, 'the composition read is per STORE');
          return { items: [] };
        }
        throw new Error(`unexpected read "${what}"`);
      },
      readAll: async (what) => (what === 'assets' ? assets : []),
      rows: (answer) => answer.items ?? [],
      log: () => {},
      fail: (message) => {
        throw new Error(message);
      },
      uploadAsset: async (file) => {
        uploaded.push(file);
        nextAsset += 1;
        assets.push({ id: `ast_${nextAsset}`, filename: file });
      },
    });

  return run().then(() => {
    assert.deepEqual(
      calls.filter((c) => c.name === 'extension.install').map((c) => c.input.extension_id),
      ['demo-setup'],
      'the app is installed once, by id — installing is not composing and not placing',
    );
    // ⛔ NOTHING IS UPLOADED, because no store of this declaration names a picture since pk35/d7. The
    // filename → asset-id chain is driven for real against the SAME hand (`seed/blocks.mjs`) in
    // `seed/chrome.test.mjs`, whose declaration still names three.
    assert.deepEqual(uploaded, []);

    const placed = calls.filter((c) => c.name === 'composition.place');
    // ⛔ THE EXACT ROWS, NAMED, RATHER THAN A COUNT. A number said «two dressed shops × three marks» and was
    //   a second thing to edit the day a block arrived; worse, it cannot tell «the café got the notice» from
    //   «the shoe shop got one row too many». This is the whole plan of a birth, spelled out.
    assert.deepEqual(
      placed.map((c) => `${c.input.store}/${c.input.component}`).sort(),
      [
        'sto_cafe/demo_ribbon',
        'sto_forge/demo_ribbon',
        'sto_forge/drawer_brand',
        'sto_forge/footer_brand',
        'sto_forge/header_brand',
        'sto_outlet/demo_ribbon',
        'sto_outlet/drawer_brand',
        'sto_outlet/footer_brand',
        'sto_outlet/header_brand',
      ],
      'the birth does not write exactly the rows this declaration states',
    );
    // ★★★ AND THE CAFÉ IS THE ROW THIS SLICE IS ABOUT: the NOTICE and no mark. Its fork draws its own chrome
    //   and its account screens draw the `chrome` app's, so a mark there would land on a screen that never
    //   renders it — but the notice is not the fork's content to opt out of, it is this box saying out loud
    //   that its prices are not real, and the fork COMPOSES this app precisely so it can be drawn.
    const notice = APP.blocks.find((b) => b.config_schema.length === 0).component;
    assert.deepEqual(
      placed.filter((c) => c.input.store === 'sto_cafe').map((c) => c.input.component),
      [notice],
      'the café is dressed in something other than the notice alone',
    );
    // ⛔ AND THE COUNTER, AND A STORE THIS FILE HAS NEVER HEARD OF, GET NOTHING.
    assert.deepEqual(
      placed.filter((c) => ['sto_balcao', 'sto_ghost'].includes(c.input.store)),
      [],
      'the counter has no shop window and `ghost` is a store this declaration has never heard of; a birth ' +
        'that dressed either of them wrote rows nobody can find the effect of.',
    );
    for (const call of placed) {
      assert.equal(call.input.extension_id, 'demo-setup');
      assert.equal(
        call.input.slot,
        DATA.slots[call.input.component],
        `${call.input.component} was placed in ${call.input.slot}, which is not the slot it declares`,
      );
    }
    // ⛔ THE WHOLE POINT OF THE DRIVING: a FILENAME in a placed config is a ref the kernel cannot resolve, so
    // no `logo_url` is stamped and the mark draws nothing. Asked of EVERY placement rather than of one
    // store's — the café's was the only picture and it is gone, and a rule tied to it would have gone with it.
    for (const call of placed) {
      assert.ok(
        call.input.config.logo === undefined || /^ast_/.test(String(call.input.config.logo)),
        `${call.input.store}/${call.input.component} was placed with ` +
          `${JSON.stringify(call.input.config.logo)} — a filename here is a ref the kernel cannot resolve, ` +
          'so no `logo_url` is stamped and the mark draws nothing.',
      );
    }
    // …and the sentence reached exactly the two named footers.
    const tagged = placed.filter((c) => c.input.config.tagline === TAGLINE);
    assert.deepEqual(
      tagged.map((c) => `${c.input.store}/${c.input.component}`).sort(),
      ['sto_forge/footer_brand', 'sto_outlet/footer_brand'],
    );
  });
});
