// ★★★ THE BIRTH REALLY PLACES THE DEMONSTRATION NOTICE — the static half of a rule that was, until this
// slice, nowhere at all.
//
//   node --test bin/ribbon-at-birth.guard.mjs        (or: bash bin/test.sh)
//
// ── ⛔ THE SILENCE, AND IT IS THE SAME ONE TWICE ────────────────────────────────────────────────────────
//
// `bin/gate-at-birth.guard.mjs` was written on 2026-09-11 because the demo's front door «was installed by NO
// step of the birth»: the app's README said «install it for the tenant», which is a hand gesture somebody had
// to remember, and nobody had — the demo served its shops with the door wide open for days while every birth
// reported green. That fence retired in v0.4 together with the app it graded.
//
// The sentence the door used to carry did not retire. It became a BLOCK — the app declares it, both forks
// were wired to draw it — and the PLACEMENT was left to a hand in Compose, per store. A `hook_placement` row
// survives a deploy and does NOT survive a reset, and this box resets itself: the notice would be there until
// the next reset and then silently not, on shops a customer is looking at, with every birth reporting green.
// ⇒ THE HOLE WAS INHERITED WITHOUT THE FENCE. This file is the fence, standing where the other one stood.
//
// ── WHAT IS DERIVED, AND EVERYTHING HERE IS ─────────────────────────────────────────────────────────────
//
//   WHICH APP        `seed/demo-setup.json`'s own `app` field — the declaration the birth drives.
//   WHICH BLOCK      the block of that app whose manifest declares NO config at all. That is not a proxy: it
//                    is the app's own way of saying «this block exists to be TRUE, not to be filled in» —
//                    a sentence an operator can edit is a sentence an operator can EMPTY. Every other block
//                    of this app exists to be configured, and each declares the fields to configure it with.
//   WHICH STORES     every store `seed/box.json` keeps ON THE STREET. A store the vitrine serves is a store a
//                    visitor opens, and a visitor who opens one is owed the sentence. The counter is the one
//                    that is off it (`status: "private"`), so the vitrine 404s it and there is no footer of
//                    ours to hang a bar in — its own front (`totem/`) carries the notice by hand.
//
// ⛔ NOTHING HERE SPELLS THE COMPONENT, THE APP OR A STORE HANDLE. The defect this grades is a line deleted
// from a declaration weeks from now, on a laptop, and a guard that carried its own copy of the answer would
// have gone green over the deletion it exists to catch.
//
// ⚠️ AND IT ACCUSES ITSELF FIRST. Each of the three derivations above can come back empty, and an empty one
// makes every rule below pass over nothing — so the first test grades the DERIVATION, and the last one hands
// the rule a fabricated box that BREAKS it, because a rule that has never been seen to redden is a rule
// nobody has measured.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { blocksOf } from './app-manifest.mjs';
import { OFF_THE_STREET } from './servable.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (rel) => {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch (error) {
    assert.fail(
      `${rel} could not be read (${error.code ?? error.message}). This guard derives its whole answer from ` +
        'that file; a green without it would mean nothing.',
    );
  }
};

const DECLARATION = 'seed/demo-setup.json';
const DATA = json(DECLARATION);

/**
 * The block of this box's own app that is the NOTICE: the one its manifest ships with no config at all.
 *
 * ⛔ IT ANSWERS A LIST AND NOT A NAME, so that «none» and «two» are visible states rather than a silent pick.
 * The first test is what turns anything other than exactly one into a red that names what it found.
 */
function noticeComponents(app) {
  const read = blocksOf(app);
  assert.ok(
    !read.tried,
    `the manifest of app "${app}" could not be read (${(read.tried ?? []).join(' · ')}). An app of THIS box ` +
      'is a directory here, so this is not a machine that lacks a checkout — it is a parse or a path that ' +
      'broke, and every rule below would grade nothing.',
  );
  return read.blocks.filter((block) => block.config_schema.length === 0).map((block) => block.component);
}

/**
 * Every store of a box that is ON THE STREET — `{ tenant, handle }`, in the declaration's order.
 *
 * ★ THE RULE IS THE KERNEL'S AND IS SPELLED ONCE, IN `bin/servable.mjs`: a status that is not `private` is a
 * store with a public page, and an UNDECLARED status is the column's own default, which is on the street.
 * That is why this reads `!== OFF_THE_STREET` and never `=== 'active'`: three of the four stores here declare
 * no status at all, and a positive test would classify all three as shops nobody has to warn.
 */
const onTheStreet = (box) =>
  (box.tenants ?? []).flatMap((tenant) =>
    (tenant.stores ?? [])
      .filter((store) => (store.status ?? null) !== OFF_THE_STREET)
      .map((store) => ({ tenant: tenant.id, handle: store.handle })),
  );

/**
 * THE RULE, as a function of a box and a declaration rather than of THE box: every store on the street is
 * declared wearing the notice. Returns the offenders, each with the sentence that names what it would cost.
 */
function undressed(box, spec, component) {
  const out = [];
  for (const { tenant, handle } of onTheStreet(box)) {
    const declared = spec.stores?.[handle];
    if (declared === undefined) {
      out.push(
        `${tenant}/${handle} — ${DECLARATION} has never heard of this store, so the birth skips it with one ` +
          'line in a log nobody reads',
      );
      continue;
    }
    if (declared === null) {
      out.push(
        `${tenant}/${handle} — ${DECLARATION} declares it \`null\`, which is this box saying «this shop ` +
          'wears nothing». That is a decision about MARKS; the notice is not a mark and not this shop’s ' +
          'content to opt out of',
      );
      continue;
    }
    if (!(component in declared)) {
      out.push(
        `${tenant}/${handle} — ${DECLARATION} dresses this store and does not declare \`${component}\`, so ` +
          'it is born with a shop window and no notice in it',
      );
    }
  }
  return out;
}

test('⛔ THE DERIVATION — there IS one notice block, and there ARE stores on the street to wear it', () => {
  const notices = noticeComponents(DATA.app);
  assert.equal(
    notices.length,
    1,
    `app "${DATA.app}" ships ${notices.length} block(s) with no \`config_schema\` and this guard is about ` +
      `exactly one — the demonstration notice. Found: ${notices.join(', ') || '(none)'}. Either the notice ` +
      'left this app (in which case every rule below grades nothing and should go with it) or a second ' +
      'unconfigurable block arrived and nobody said which of the two a store is owed — and picking one here ' +
      'would be this file inventing the answer.',
  );
  const street = onTheStreet(json('seed/box.json'));
  assert.ok(
    street.length > 0,
    'no store in seed/box.json is on the street — every one of them declares `status: "private"`. That is a ' +
      'decision nobody has recorded, and it would make this whole file quiet.',
  );
});

test('★★★ every store ON THE STREET is born wearing the notice — named, one by one', () => {
  // ⇒ SABOTAGE: delete `demo_ribbon` from any dressed store of the declaration, or put a store back to
  //   `null`, and this names the tenant and the handle. What it is standing in front of is a shop a customer
  //   is looking at that says nothing about being a demonstration — prices that are not real, with nothing on
  //   the page admitting it — for as long as it takes somebody to notice by eye.
  const [component] = noticeComponents(DATA.app);
  assert.deepEqual(
    undressed(json('seed/box.json'), DATA, component),
    [],
    `a store this box puts on the street is NOT declared wearing "${component}" in ${DECLARATION}.\n` +
      '  Nothing else places it: the block is drawn by the slot it was dropped into, the drop is a\n' +
      '  `hook_placement` row, and the only hand that writes one is this declaration or an operator in\n' +
      '  Compose. A row a hand wrote survives a deploy and does NOT survive a reset, and this box resets.',
  );
});

test('★★ the notice lands in a slot the declaration NAMES — an undeclared one throws at birth, per store', () => {
  // `blocksFor` refuses a component the declaration's own `slots` map does not name, which is right and is
  // also a birth that has already started. This is the same refusal, before anything runs.
  const [component] = noticeComponents(DATA.app);
  const slot = DATA.slots?.[component];
  assert.equal(
    typeof slot,
    'string',
    `${DECLARATION} declares stores wearing "${component}" and its \`slots\` map does not say where it goes. ` +
      'The seed throws mid-birth on that, after the app is installed and some marks are already placed.',
  );
});

test('⛔ AND THE STORE THAT IS OFF THE STREET IS EXCLUDED BY THE PORT’S RULE, not by a handle typed here', () => {
  // ★ The exclusion has to be REAL, or the rule above is «every store, always» wearing a derivation as a
  // costume. This box keeps exactly one store off the street and that store is the counter, whose own front
  // carries the notice by hand — so the set the rule loops over is genuinely smaller than «the stores».
  const box = json('seed/box.json');
  const all = (box.tenants ?? []).flatMap((t) => (t.stores ?? []).map((s) => `${t.id}/${s.handle}`));
  const street = onTheStreet(box).map((s) => `${s.tenant}/${s.handle}`);
  assert.ok(
    street.length < all.length,
    'every store of seed/box.json is on the street, so the rule above is grading «all of them» and the ' +
      'derivation it uses has never subtracted anything. If that is really the box, say so here — and then ' +
      'this line is the one that noticed.',
  );
  for (const handle of all.filter((h) => !street.includes(h))) {
    const store = (box.tenants ?? [])
      .flatMap((t) => (t.stores ?? []).map((s) => ({ ...s, at: `${t.id}/${s.handle}` })))
      .find((s) => s.at === handle);
    assert.equal(store.status, OFF_THE_STREET, `${handle} is excluded for a reason that is not its status`);
    assert.ok(
      typeof store._servability_why === 'string' && store._servability_why.length > 80,
      `${handle} is taken off the street with no \`_servability_why\` worth reading. A store the vitrine ` +
        'does not serve is a store this rule stops asking about; an exception with no reason is how ' +
        '"temporarily" becomes permanent in silence.',
    );
  }
});

test('⛔ ANTI-VACUUM — the rule SEES: it is handed a box and a declaration that break it', () => {
  // ★★★ The lesson `gate-at-birth` learned the hard way: its equivalent rule went green over an EMPTY LOOP
  // the day its subject disappeared, and a guard that passes because it found nothing is worse than no guard.
  // So the rule is a function, and here it is given three shapes of the defect at once.
  const box = json('seed/box.json');
  const [component] = noticeComponents(DATA.app);
  // ⛔ AND THIS RULE MAY NOT RUN WITHOUT A SUBJECT EITHER. With the notice gone, `component` is `undefined`
  // and every comparison below answers something — which is a green over a derivation the test above has
  // already reddened, i.e. exactly the second opinion nobody should read.
  assert.equal(typeof component, 'string', 'there is no notice block to fabricate against');
  const tenant = box.tenants[0];
  assert.ok(tenant?.stores?.length, 'seed/box.json declares no store to fabricate against.');
  tenant.stores = [
    ...tenant.stores,
    { handle: 'fixture-undeclared' },
    { handle: 'fixture-null' },
    { handle: 'fixture-bare' },
    // …and one that is off the street, which must NOT be accused: the exclusion is the half that would
    // silently turn this rule into «every store», and a fixture that never exercises it proves nothing.
    { handle: 'fixture-private', status: OFF_THE_STREET },
  ];
  // «dressed in something else» is the third shape, and the something else is another block of this same
  // declaration rather than a name invented here.
  const other = Object.keys(DATA.slots).find((c) => c !== component);
  assert.ok(other, `${DECLARATION} places only "${component}", so there is no second block to dress with.`);
  const spec = {
    ...DATA,
    stores: { ...DATA.stores, 'fixture-null': null, 'fixture-bare': { [other]: { text: 'x' } } },
  };
  // ⚠️ SCOPED TO THE FABRICATED STORES. This rule is about whether the FUNCTION sees, and it must answer the
  // same thing whether or not the real declaration happens to be broken at the same moment — otherwise a
  // genuine defect reddens here too and its own rule's message is read as one of two.
  const caught = (spec) =>
    undressed(box, spec, component)
      .map((line) => line.split(' — ')[0])
      .filter((at) => at.includes('fixture-'));
  assert.deepEqual(
    caught(spec),
    [`${tenant.id}/fixture-undeclared`, `${tenant.id}/fixture-null`, `${tenant.id}/fixture-bare`],
    'the rule did not catch a store the declaration never heard of, a store declared `null`, and a store ' +
      'dressed in something else — or it accused the store that is off the street. One of those is the ' +
      'shape the real defect arrives in.',
  );
  // …and the same three, each given the block, are clean again — so what it catches is the ABSENCE of the
  // notice and not the presence of a fixture.
  spec.stores['fixture-undeclared'] = { [component]: {} };
  spec.stores['fixture-null'] = { [component]: {} };
  spec.stores['fixture-bare'] = { [other]: { text: 'x' }, [component]: {} };
  assert.deepEqual(caught(spec), [], 'the rule reddens a store that DOES wear it.');
});
