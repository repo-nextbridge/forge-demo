// ★★ THE DERIVATION, AND THE DUPLICATION IT REPLACED — proved in the same file, because they are one item.
//
// WHAT THIS FILE PROVES, stated so the next person knows what broke when it breaks:
//
//   1 · `servability()` answers from the PORT's `storefront_enabled`, and answers with a SENTENCE, so a
//       caller can never skip a store silently.
//   2 · An ABSENT field means the store is on the street. This is the assertion that catches the one
//       plausible rewrite — `!row.storefront_enabled` — which would blank a whole box the day it runs
//       against a kernel older than the capability.
//   3 · `seed/box.json` DOES NOT declare servability. That is the duplication this slice removed: the file
//       used to carry a hand-written `servable: false` for a fact the port already published, with nothing
//       to keep the two in agreement.
//   4 · Both steps that classify stores read THIS module. A second copy of the rule is how the box got two
//       truths in the first place.
//
// ⚠️ AND IT ACCUSES ITSELF ON THE VACUUM: a `seed/box.json` with no store in it would satisfy §3 by having
// nothing to check, which is the shape every dead guard decays into.
//
//   node --test bin/servable.test.mjs      (or: bash bin/test.sh)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { OFF_THE_STREET, ON_THE_STREET, STOREFRONT_ENABLED, servability, statusPatch } from './servable.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const BOX = JSON.parse(read('seed/box.json'));
/** WHICH STORE THE TOTEM SERVES — declared once, in the file that stands that store up. `bin/box-up.sh`
 *  resolves `FORGE_TOTEM_STORE_ID` from this same handle (step 6), so this is the box's own answer to "whose
 *  front is not the vitrine" and not a name typed into a guard. */
const TOTEM = JSON.parse(read('seed/totem.json'));

// ── 1 · THE DERIVATION ──────────────────────────────────────────────────────────────────────────────────

test('★★★ a store the port says has no public page is NOT servable — and the answer carries the reason', () => {
  const { servable, reason } = servability({ handle: 'balcao', [STOREFRONT_ENABLED]: false });
  assert.equal(servable, false);
  assert.ok(reason, 'a skip with no reason is a store that vanishes from a report');
  // The reason must name the PORT and the field, so a reader can go and ask the box the same question.
  assert.match(reason, new RegExp(STOREFRONT_ENABLED));
  assert.match(reason, /read\.internal\.stores/);
  // …and it must say what is NOT switched off, or an operator reads "no public page" as "the store is dead".
  assert.match(reason, /catalogue|orders/i);
});

test('★★ a store the port says IS on the street is servable, and there is nothing to announce', () => {
  assert.deepEqual(servability({ handle: 'cafe', [STOREFRONT_ENABLED]: true }), {
    servable: true,
    reason: null,
  });
});

test('★★★ THE FIELD ABSENT MEANS ON THE STREET — the rule is `=== false`, never a truthiness test', () => {
  // ⛔ THE SABOTAGE THIS CATCHES: `!row.storefront_enabled`. Against a kernel older than pk9 — which is what
  //    a pinned image can be, and `forge.lock` is where the pin lives — every row arrives WITHOUT the field.
  //    A truthiness test would then call every store of that box unservable, warm nothing, open no door, and
  //    print a green over an empty report. The product's own consumer of the same fact takes the same care:
  //    `apps/storefront/src/app/sitemap.ts:35` reads `?.storefront_enabled === false`.
  assert.deepEqual(servability({ handle: 'legacy' }), { servable: true, reason: null });
  assert.deepEqual(servability({ handle: 'legacy', [STOREFRONT_ENABLED]: undefined }), {
    servable: true,
    reason: null,
  });
});

// ── 2 · THE DUPLICATION THAT IS GONE ────────────────────────────────────────────────────────────────────

test('★★★ seed/box.json declares NOTHING about servability — the port is the only author of that fact', () => {
  const stores = (BOX.tenants ?? []).flatMap((t) => (t.stores ?? []).map((s) => ({ tenant: t.id, ...s })));

  // ⚠️ AGAINST THE VACUUM, FIRST. A declaration with no store in it passes the loop below by having nothing
  //    to look at, which is exactly how a guard goes green while grading an empty set.
  assert.ok(
    stores.length > 0,
    'seed/box.json declares no store at all — this guard is grading an empty set and proves nothing.',
  );

  for (const store of stores) {
    for (const key of ['servable', '_servable_why']) {
      assert.ok(
        !(key in store),
        `THE DUPLICATION IS BACK: seed/box.json writes \`${key}\` on "${store.tenant}/${store.handle}". ` +
          'Servability is DERIVED from the port — `read.internal.stores[].storefront_enabled`, itself ' +
          "derived from the store's `status` — and a hand-written copy is a SECOND TRUTH about one store " +
          'with nothing to synchronise the two: flip the store through the port and this file keeps saying ' +
          'what it said. Take the store off the street with `tenant.store.update {"status":"private"}` and ' +
          'both steps follow by themselves. See bin/servable.mjs.',
      );
    }
  }
});

test('★★ and the two steps that classify stores read the SAME module — a second copy is how this started', () => {
  for (const step of ['bin/warm-box.mjs', 'bin/prove-doors.mjs']) {
    assert.match(
      read(step),
      /from '\.\/servable\.mjs'/,
      `${step} no longer imports the derivation. Two steps deciding servability apart is the shape of the ` +
        'defect this slice removed, one level down.',
    );
  }
});

// ── ★★★ pk22 · 3 · THE OTHER DIRECTION: THE BOX SAYS IT, THROUGH THE PORT ───────────────────────────────
//
// WHAT THE REST OF THIS FILE PROVES, stated so the next person knows what broke when it breaks:
//
//   5 · `statusPatch()` turns what `seed/box.json` DECLARES into the input of one `tenant.store.update`,
//       idempotent by the DERIVED boolean — because the port never answers the raw word.
//   6 · An UNDECLARED status is «no opinion», never `active`. That is what lets three stores say nothing.
//   7 · An UNKNOWN word THROWS instead of writing nothing. `"Private"` derives «on the street», matches a
//       store that is, and produces an empty patch: a typo that reads as a decision.
//   8 · The store the TOTEM serves is declared off the street in `seed/box.json` — with the handle taken
//       from `seed/totem.json`, so no guard here types a store's name.
//   9 · The vitrine's refusal has NO PATH into the totem: it resolves its store from the environment and
//       reads no servability fact at all.

test('★★★ what the box DECLARES becomes one command — and idempotent by the boolean, because the word never comes back', () => {
  // The counter's shape: the file says `private`, the port still says the page is served ⇒ write it.
  assert.deepEqual(statusPatch({ handle: 'balcao', status: OFF_THE_STREET }, { [STOREFRONT_ENABLED]: true }), {
    status: OFF_THE_STREET,
  });
  // Converged: the same declaration against a box that already says so ⇒ NO command, no audit row.
  assert.deepEqual(
    statusPatch({ handle: 'balcao', status: OFF_THE_STREET }, { [STOREFRONT_ENABLED]: false }),
    {},
  );
  // And back the other way, which is how a counter is put on the street: `"status": "active"` in the file.
  assert.deepEqual(statusPatch({ handle: 'balcao', status: ON_THE_STREET }, { [STOREFRONT_ENABLED]: false }), {
    status: ON_THE_STREET,
  });
  assert.deepEqual(
    statusPatch({ handle: 'balcao', status: ON_THE_STREET }, { [STOREFRONT_ENABLED]: true }),
    {},
  );
});

test('★★★ THE CREATE: a store that does not exist yet is on the street, so the word rides on `tenant.store.create`', () => {
  // ⛔ WHY THIS MATTERS AND IS NOT A DETAIL (the kernel's pk13/C6 argument, applied here): created without
  //    the word, a counter is a store WITH a public page for the window between create and update — public
  //    at the exact moment nobody has checked it. `bin/seed-box.mjs` spreads this into the create input.
  assert.deepEqual(statusPatch({ handle: 'balcao', status: OFF_THE_STREET }, undefined), {
    status: OFF_THE_STREET,
  });
  // …and a store the box has no opinion about is created exactly as it always was.
  assert.deepEqual(statusPatch({ handle: 'cafe' }, undefined), {});
});

test('★★★ AN UNDECLARED STATUS IS «NO OPINION», NEVER `active` — the rule the checkout flags already live by', () => {
  // ⛔ THE SABOTAGE THIS CATCHES: `const wanted = declared?.status ?? ON_THE_STREET`. Every store this file
  //    is silent about would then be ASSERTED onto the street on every birth — including a store somebody
  //    took off it through the admin, which would come back on the next run with nothing saying so.
  assert.deepEqual(statusPatch({ handle: 'cafe' }, { [STOREFRONT_ENABLED]: false }), {});
  assert.deepEqual(statusPatch({ handle: 'cafe', status: undefined }, { [STOREFRONT_ENABLED]: false }), {});
  assert.deepEqual(statusPatch({}, {}), {});
});

test('★★★ AN UNKNOWN WORD THROWS, and it throws NAMING the store — silence here is a typo that reads as a decision', () => {
  // `"Private"` derives «on the street» (it is not the literal `private`), matches a store that is on the
  // street, and produces `{}` — a counter seeded onto the vitrine with nothing failing anywhere. The port
  // would refuse the word (`z.enum`), but only if something ever sent it.
  assert.throws(() => statusPatch({ handle: 'balcao', status: 'Private' }, { [STOREFRONT_ENABLED]: true }), {
    message: /balcao/,
  });
  assert.throws(() => statusPatch({ handle: 'balcao', status: 'archived' }, {}), { message: /"active"/ });
});

// ── ★★★ 4 · AND THE DECLARATION ITSELF: THE STORE THE TOTEM SERVES IS OFF THE STREET ────────────────────

test('★★★ the store the TOTEM serves is declared off the street — and this guard accuses ITSELF on the vacuum', () => {
  // ⚠️ AGAINST THE VACUUM, FIRST, AND IN THREE PLACES, because this rule has three ways of grading nothing:
  //    a `seed/totem.json` that names no store, a `seed/box.json` that does not hold it, and a box where no
  //    store is declared off the street at all — the last of which is the state this repository was in
  //    yesterday, and the one a future edit would silently return it to.
  const counter = TOTEM.store?.handle;
  assert.ok(
    counter,
    'seed/totem.json declares no `store.handle` — this guard does not know which store the totem serves and ' +
      'is grading nothing. `bin/box-up.sh` resolves FORGE_TOTEM_STORE_ID from that same handle.',
  );

  const stores = (BOX.tenants ?? []).flatMap((t) => (t.stores ?? []).map((s) => ({ tenant: t.id, ...s })));
  const declared = stores.find((s) => s.handle === counter);
  assert.ok(
    declared,
    `seed/box.json declares no store "${counter}", which is the store seed/totem.json says the totem serves. ` +
      'One of the two files is wrong, and until they agree this guard is grading an empty set.',
  );

  const offTheStreet = stores.filter((s) => s.status === OFF_THE_STREET);
  assert.ok(
    offTheStreet.length > 0,
    'NO STORE IN seed/box.json IS DECLARED OFF THE STREET. This guard exists to say that a store whose front ' +
      'is somebody else\'s is not served by the reference vitrine, and on this box there is now no such ' +
      'store to say it about — so it proves nothing. That is the shape every dead guard decays into.',
  );

  // ⛔ THE SABOTAGE: the counter back to `active`, or the key simply dropped. Either way the reference
  //    vitrine serves a shop whose front is the totem, the warming step warms pages nobody reaches, and the
  //    doors step opens them — all green, because every one of those steps reads the PORT and the port would
  //    be telling the truth. This file is the only place that grades the DECISION.
  assert.equal(
    declared.status,
    OFF_THE_STREET,
    `"${declared.tenant}/${counter}" IS BACK ON THE VITRINE: seed/box.json declares ` +
      `\`status: ${JSON.stringify(declared.status ?? null)}\`, and seed/totem.json says the totem is that ` +
      'store\'s front. A store whose merchant chose another front must not be served by the reference ' +
      'vitrine: `status: "private"` is how that is said, it is written through the port by `bin/seed-box.mjs` ' +
      '(`tenant.store.create`/`.update`), and `storefront_enabled` — which the warming step and the doors ' +
      'step both read — is DERIVED from it. ⚠️ Removing the word does not «leave it undecided»: an ' +
      'undeclared status is «no opinion» and the column keeps `active`, which is the shop on the street.',
  );
});

test('★★ …and the refusal has NO PATH INTO THE TOTEM — it resolves its store from the environment, by id', () => {
  // ⛔ WHAT THIS IS AGAINST: the other half of «private is not off». The vitrine refuses the PAGE; nothing
  //    may make the counter's own front refuse the SHOP. The totem holds no service token, makes no
  //    `store_flags` read and never asks `store.by_host` — so `storefront_enabled` has no route into it at
  //    all. That is a property of the source, so it is asserted over the source. (The product proves the
  //    same thing from the other end: `apps/checkout/.../private-store-keeps-the-counter.test.tsx`.)
  const store = read('totem/src/lib/store.ts');
  assert.match(
    store,
    /FORGE_TOTEM_STORE_ID/,
    'totem/src/lib/store.ts no longer resolves the counter from FORGE_TOTEM_STORE_ID — this guard is ' +
      'grading a file that has stopped being the totem\'s answer to "which store".',
  );
  for (const forbidden of ['storefront_enabled', 'store_flags', 'requirePublicStorefront']) {
    assert.ok(
      !store.includes(forbidden),
      `totem/src/lib/store.ts reads \`${forbidden}\`. The totem is the counter's FRONT: if the fact that ` +
        'takes a store off the reference vitrine can reach it, taking the counter off the street stops the ' +
        'till from selling — which is the one thing `private` must never mean (see `servability()`\'s reason).',
    );
  }
});

test('★★★ and the WRITER really drives the port with it — a declaration nothing sends is a decision nothing applies', () => {
  // ⛔ THE SABOTAGE THIS CATCHES, and it is the quietest one in the slice: delete the two `statusPatch` calls
  //    from `bin/seed-box.mjs`. `seed/box.json` keeps saying `private`, every test above keeps passing (they
  //    grade the FUNCTION and the FILE), and the box is born with the counter on the street — the exact
  //    state this slice was written to end. Nothing else in this repository would notice until `prove-doors`
  //    ran against a real box, which is the last step of a 17-minute birth.
  const writer = read('bin/seed-box.mjs');
  assert.match(
    writer,
    /import \{ statusPatch \} from '\.\/servable\.mjs'/,
    'bin/seed-box.mjs no longer imports the derivation — the box declares a status nothing writes.',
  );
  // ★ BOTH CALL SITES, AND THEY ARE NOT INTERCHANGEABLE. The CREATE closes the window in which a store the
  // box wants private is public (the kernel put `status` on `tenant.store.create` for exactly that, pk13/C6);
  // the UPDATE is what makes a second birth, and a re-provision, converge.
  assert.match(
    writer,
    /tenant\.store\.create[\s\S]{0,400}?\.\.\.statusPatch\(store, undefined\)/,
    '`tenant.store.create` no longer carries the status: the counter would be a PUBLIC store for the window ' +
      'between the create and the update that fixes it.',
  );
  assert.match(
    writer,
    /Object\.assign\(patch, statusPatch\(store, found\)\)/,
    'the update no longer converges the status: a box whose column was reset (a re-provision, a hand in the ' +
      'admin) would stay wrong through every subsequent birth.',
  );
});
