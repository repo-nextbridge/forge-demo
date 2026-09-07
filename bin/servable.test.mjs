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

import { STOREFRONT_ENABLED, servability } from './servable.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const BOX = JSON.parse(read('seed/box.json'));

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
