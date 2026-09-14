// ★★★ THE BIRTH REALLY INSTALLS THE FRONT DOOR — the static half of a rule that was, until pk33, nowhere.
//
//   node --test bin/gate-at-birth.guard.mjs        (or: bash bin/test.sh)
//
// ── ⛔ THE SILENCE, MEASURED 2026-09-11 ──────────────────────────────────────────────────────────────────
//
// `apps/demo-gate` — the demo's front door, the "Loja demo." screen a visitor must meet before the shop — was
// installed by NO step of the birth. Not `bin/seed-box.mjs`, not `seed/vitrine.mjs`, not `seed/coffee.mjs`,
// not `seed/outlet.mjs`. The app's own README said "Install the app for the tenant", i.e. a HAND GESTURE
// somebody had to remember, and nobody had: the demo served its shops with the door wide open for days while
// every birth reported green.
//
// pk33 wired the install and taught step 14-bis to open every door on BOTH sides of the dismissal cookie, so a
// box where the gate is missing is red at birth. THIS FILE IS THE OTHER HALF, and it exists because the
// realistic way the gate goes missing again is not a broken box: it is one line deleted from a seed, weeks
// from now, on a laptop, where no box is running at all. `bash bin/test.sh` sees that; a birth cannot, because
// the birth is exactly what would stop happening.
//
// ── WHAT IS DERIVED, AND EVERYTHING HERE IS ─────────────────────────────────────────────────────────────
//
//   WHICH APP IS THE GATE   the app on `composition.json`'s `instanceApps` whose own manifest declares a hook
//                           on `storefront:gate`. Nothing here spells `demo-gate`.
//   WHICH STORES WANT ONE   `seed/box.json`: every store, unless it declares `gate: false` (the exception
//                           carries its reason). Same default `bin/prove-doors.mjs` grades against — they read
//                           the same field of the same file. ★★★ pk36/d1 — AND TODAY NO STORE DECLARES THE
//                           EXCEPTION: `cafe` was the last one, and it lost it when its fork learned to
//                           regenerate its own gate registry. The rule survives its subject, and the reason
//                           test below is graded against a FIXTURE so that it cannot go quietly blind.
//   WHO INSTALLS IT         the four lists this repository drives `extension.install` from, each tied to the
//                           store whose seed module owns it (`bin/seed.mjs` runs each `here('<handle>')`).
//
// ⚠️ AND IT ACCUSES ITSELF. A derivation that quietly returns nothing is indistinguishable from a tree in
// order, so the first test grades the DERIVATION: no gate app found, or no store wanting one, is a RED that
// names the file it could not read — never a quiet pass.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { APPS as COFFEE_APPS } from '../seed/coffee.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch (error) {
    assert.fail(
      `${rel} could not be read (${error.code ?? error.message}). This guard derives its whole answer from ` +
        'that file; a green without it would mean nothing.',
    );
  }
};
const json = (rel) => JSON.parse(read(rel));

const GATE_TARGET = 'storefront:gate';

/**
 * The app of THIS repository that fills the gate slot, learned from its own manifest. An instance app is a
 * source directory on `composition.json`'s `instanceApps` (`source: ./apps/<id>`), and its manifest is the
 * same declaration the kernel reads at boot — so this is the app the kernel will place on every store when it
 * is installed, by construction rather than by name.
 */
function gateApps() {
  const out = [];
  for (const app of json('composition.json').instanceApps ?? []) {
    const source = (app.source ?? '').replace(/^\.\//, '');
    if (!source) continue;
    let manifest;
    try {
      manifest = readFileSync(join(ROOT, source, 'manifest.ts'), 'utf8');
    } catch {
      continue;
    }
    if (manifest.includes(`'${GATE_TARGET}'`) || manifest.includes(`"${GATE_TARGET}"`)) out.push(app.id);
  }
  return out;
}

/**
 * Every `extension.install` list this repository drives, and the STORE whose seed module owns it. The tenant
 * is never written here: `bin/seed.mjs` runs each module for the tenant that HOLDS that store (`here(...)`),
 * so the store handle is what ties a list to a tenant, and `seed/box.json` is what resolves it.
 *
 * ⚠️ `seed/coffee.mjs`'s list is IMPORTED, not grepped. It is the only one of the four that lives in code,
 * and a regex over source would go green the day somebody builds the array instead of writing it.
 */
const INSTALLERS = [
  { store: 'forge', where: 'seed/vitrine.json → apps', apps: () => json('seed/vitrine.json').apps ?? [] },
  { store: 'outlet', where: 'seed/outlet.json → apps', apps: () => json('seed/outlet.json').apps ?? [] },
  { store: 'cafe', where: 'seed/coffee.mjs → APPS', apps: () => COFFEE_APPS },
];

test('⛔ THE DERIVATION — there IS a gate app, and there ARE stores that want one', () => {
  const gates = gateApps();
  assert.notDeepEqual(
    gates,
    [],
    'no app on `composition.json`\'s `instanceApps` declares a hook on `storefront:gate`. Either the gate app ' +
      'left this repository (in which case every rule below is grading nothing and should go with it), or its ' +
      'manifest stopped declaring the hook — which is how a gate becomes installed, enabled and invisible.',
  );
  const wanting = json('seed/box.json').tenants.flatMap((t) =>
    (t.stores ?? []).filter((s) => s.gate !== false).map((s) => `${t.id}/${s.handle}`),
  );
  assert.ok(
    wanting.length > 0,
    'no store in seed/box.json wants a gate — every one of them declares `gate: false`. That is a decision ' +
      'nobody has recorded, and it would make this whole file quiet.',
  );
});

test('★★★ every tenant whose stores want a gate has a seed that INSTALLS it', () => {
  const gates = gateApps();
  const box = json('seed/box.json');
  for (const tenant of box.tenants) {
    const handles = new Set((tenant.stores ?? []).map((s) => s.handle));
    const wanting = (tenant.stores ?? []).filter((s) => s.gate !== false).map((s) => s.handle);
    if (wanting.length === 0) continue;

    // What this repository installs for THIS tenant: the box's own list, plus every seed module that runs for
    // it (the module runs where its store lives).
    const installed = new Map();
    for (const id of tenant.apps ?? []) installed.set(id, `seed/box.json → tenants[${tenant.id}].apps`);
    for (const installer of INSTALLERS) {
      if (!handles.has(installer.store)) continue;
      for (const id of installer.apps()) installed.set(id, installer.where);
    }

    for (const gate of gates) {
      assert.ok(
        installed.has(gate),
        `NOTHING IN THE BIRTH INSTALLS "${gate}" FOR "${tenant.id}", and its store(s) ${wanting
          .map((h) => `"${h}"`)
          .join(', ')} want a gate (seed/box.json declares no \`gate: false\` on them).\n` +
          `  A composed app that nobody installs fills no slot: the shops open with no front door, and the\n` +
          '  only thing that would say so is step 14-bis, on a box, at birth. The lists this repository\n' +
          `  installs from for this tenant are: ${[
            `seed/box.json → tenants[${tenant.id}].apps`,
            ...INSTALLERS.filter((i) => handles.has(i.store)).map((i) => i.where),
          ].join(', ')}.`,
      );
    }
  }
});

/**
 * The rule, as a function of a box rather than of THE box: every store that takes itself out of the gate rule
 * with `gate: false` must write a `_gate_why` worth reading. An exception with no reason is how "temporarily,
 * until the fork catches up" becomes permanent in silence. Returns the offenders, named.
 */
const gatelessWithoutReason = (box) =>
  (box.tenants ?? []).flatMap((tenant) =>
    (tenant.stores ?? [])
      .filter((store) => store.gate === false)
      .filter((store) => !(typeof store._gate_why === 'string' && store._gate_why.length > 80))
      .map((store) => `${tenant.id}/${store.handle}`),
  );

test('★★ a store DECLARED gateless is declared with a REASON — a bare `false` is a decision nobody can read', () => {
  assert.deepEqual(
    gatelessWithoutReason(json('seed/box.json')),
    [],
    'a store above is taken out of the gate rule with `gate: false` and writes no `_gate_why` worth reading. ' +
      'Every other exception in this file carries its measurement; this one decides what a visitor meets at ' +
      'the front door.',
  );
});

test('⛔ ANTI-VACUUM — that rule SEES: today no real store declares the exception, so it is shown one', () => {
  // ★★★ pk36/d1 — THE TEST ABOVE WENT GREEN OVER AN EMPTY LOOP the moment the café stopped declaring itself
  // gateless, and a guard that passes because it found nothing is worse than no guard: it reports on a rule
  // it never applied. So the rule is a function now, and here it is handed a box that breaks it.
  const box = json('seed/box.json');
  const tenant = box.tenants[0];
  assert.ok(tenant, 'seed/box.json declares no tenant at all — there is nowhere to put the fixture store.');
  tenant.stores = [...(tenant.stores ?? []), { handle: 'fixture-bare-false', gate: false }];
  assert.deepEqual(
    gatelessWithoutReason(box),
    [`${tenant.id}/fixture-bare-false`],
    'a store declaring a bare `gate: false` with no reason was NOT caught. The rule above is looking at ' +
      'something else — or at nothing.',
  );
  // …and the same box with a reason written is clean again, so what it catches is the SILENCE and not the key.
  tenant.stores.at(-1)._gate_why = `x${'y'.repeat(80)}`;
  assert.deepEqual(gatelessWithoutReason(box), [], 'the rule reddens a declared exception that DOES carry its reason.');
});

test('★ the gate app is ADOPTED, never composed — an instance app, which is why the install is ours to make', () => {
  // A platform app arrives installed-able because the release carries it; this one exists only here. The
  // distinction is what makes "who installs it" a question this repository has to answer at all, and
  // `bin/composition.guard.mjs` already refuses the collision — this asserts the side that matters here.
  const composition = json('composition.json');
  const platform = new Set((composition.apps ?? []).map((a) => a.id));
  for (const gate of gateApps()) {
    assert.ok(
      !platform.has(gate),
      `"${gate}" is on \`apps\` as well as \`instanceApps\`. The oven refuses that collision by name, and ` +
        'this rule would then be grading an app two lists claim.',
    );
  }
});
