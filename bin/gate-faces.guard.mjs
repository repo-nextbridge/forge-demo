// ★★★ THE HUB'S DESTINATIONS ARE THE BOX'S DECLARATION, AND THEY CANNOT DRIFT FROM IT.
//
//   node --test bin/gate-faces.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT THIS GRADES, AND WHY IT IS A DRIFT-CHECK RATHER THAN A COMPARISON OF NAMES ─────────────────────
//
// The gate's first screen is a HUB over every face this box publishes — the hub layout ported in
// pk35/d1. Its addresses are DATA (`seed/box.json`: one `domain` per store, one `admin_domain` per tenant),
// and the screen that draws them is baked into the kernel image ALONE, without the file. `bin/gate-faces.mjs`
// is the wire between the two; `apps/demo-gate/faces.generated.ts` is what it writes.
//
// A generated file that nothing re-derives is a file somebody edits, and an edited one is a hostname typed by
// hand with a comment on top claiming it was not. So the rule is the product's own doctrine, one layer down:
// REGENERATE AND COMPARE. A fifth store, a changed hostname, a `domain` deleted — each is one red line here
// and `node bin/gate-faces.mjs --write` away from green.
//
// ⛔ AND THE ANTI-VACUUM IS THE FIRST RULE, not the last: a derivation that yields nothing looks exactly like
// a tree in order. Six faces are asserted to BE six, by counting the declaration itself — never by a number
// typed here.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { ROOT, readBox } from './box-domains.mjs';
import { GENERATED_FILE, hubFaces, hubTenants, onDisk, render } from './gate-faces.mjs';

const say = (line) => console.error(`[gate-faces] ${line}`);

const BOX = readBox();
const TENANTS = hubTenants(BOX);
const FACES = hubFaces(BOX);

for (const face of FACES) {
  say(`${face.key.padEnd(22)} ${face.kind.padEnd(5)} ${face.host ?? '⚠️ NO ADDRESS DECLARED'}`);
}

test('⛔ THE VACUUM CHECK — the declaration yields tenants, and every tenant yields faces', () => {
  assert.ok(TENANTS.length > 0, 'seed/box.json declares no tenant, so the hub would draw an empty screen and every rule below would pass over nothing.');
  const empty = TENANTS.filter((t) => t.faces.length === 0).map((t) => t.id);
  assert.deepEqual(empty, [], 'a tenant contributes no face at all — not even its admin. The derivation lost a shape of the file.');
  assert.ok(
    FACES.some((f) => f.kind === 'shop') && FACES.some((f) => f.kind === 'admin'),
    `the hub would draw only one kind of destination: ${FACES.map((f) => `${f.key}(${f.kind})`).join(', ')}`,
  );
});

test('★ every face this box DECLARES is one the hub can count — shops + one admin per tenant', () => {
  // Derived from the file on both sides, so a store added to `seed/box.json` is a card without a second edit.
  const declared =
    (BOX.tenants ?? []).reduce((n, t) => n + (t.stores ?? []).length, 0) + (BOX.tenants ?? []).length;
  assert.equal(
    FACES.length,
    declared,
    `seed/box.json declares ${declared} face(s) (every store, plus one admin per tenant) and the hub would ` +
      `draw ${FACES.length}. A destination that never reaches the screen is a demo with a door nobody finds.`,
  );
  const dup = FACES.map((f) => f.key).filter((k, i, all) => all.indexOf(k) !== i);
  assert.deepEqual(dup, [], 'two faces share one key, so the copy written for one of them is drawn twice and the other never.');
});

test('★★★ the generated module IS what the declaration renders — regenerate, never edit', () => {
  const file = join(ROOT, GENERATED_FILE);
  assert.ok(
    existsSync(file),
    `${GENERATED_FILE} is missing. The hub imports it, so the app does not compile: run \`node bin/gate-faces.mjs --write\`.`,
  );
  assert.equal(
    onDisk(),
    render(BOX),
    `${GENERATED_FILE} is not what seed/box.json renders. Either the declaration changed and nobody ` +
      `regenerated — run \`node bin/gate-faces.mjs --write\` — or somebody EDITED the generated file, which ` +
      'is a hostname typed by hand under a comment saying it was not.',
  );
  say(`${GENERATED_FILE} agrees with seed/box.json (${FACES.length} face(s))`);
});

test('★ and it is really generated: its first line says so, and the app imports it', () => {
  // ⚠️ ANTI-VACUUM for the rule above. `onDisk() === render()` is also satisfied by two identical EMPTY files,
  // and by a module nothing imports — a drift-check over a file nobody reads grades a decoration.
  const text = readFileSync(join(ROOT, GENERATED_FILE), 'utf8');
  assert.match(text.split('\n')[0], /GENERATED/, `${GENERATED_FILE} does not announce itself as generated on its first line`);
  assert.ok(text.length > 200, `${GENERATED_FILE} is ${text.length} byte(s) — the renderer produced almost nothing`);
  const app = join(ROOT, 'apps/demo-gate/block');
  const importers = readFileSync(join(app, 'hub.tsx'), 'utf8');
  assert.match(
    importers,
    /from '\.\.\/faces\.generated'/,
    'apps/demo-gate/block/hub.tsx does not import the generated faces, so the screen is drawing something else',
  );
});

test('★★ a face the box declares an address for carries BOTH halves — a host with no variable cannot be deployed', () => {
  // The same sentence `bin/box-domains.guard.mjs` holds for the edge, held here for the SCREEN: the hub prints
  // the hostname under the admin row (the design does), so half a declaration is half a promise.
  const broken = FACES.filter((f) => (f.host === null) !== (f.env === null)).map(
    (f) => `${f.key} → host=${f.host ?? '(none)'} env=${f.env ?? '(none)'}`,
  );
  assert.deepEqual(
    broken,
    [],
    'a face declares a hostname with no variable, or a variable with no hostname. The hub would show an ' +
      'address the edge cannot serve, or hide one it can.',
  );
});
