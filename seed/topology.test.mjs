// A13 — THE TWO FILES THAT ANSWER "WHICH STORE IS THIS TENANT'S BOOTSTRAP ONE".
//
// What is worth testing here is not "the box comes up" — it does, today, because `bin/seed.mjs` runs at
// step 8 when both stores already exist. It is the BAD DAY: the run where the bootstrap store is genuinely
// missing, when the seed's failure has to send a reader to the right place. It used to send them to the
// wrong one, and that kind of defect is only ever met by somebody already in trouble.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bootstrapStoreOf, topologyDisagreement } from './topology.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const box = JSON.parse(readFileSync(join(SEED, 'box.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));

test('★★ every tenant the box declares has exactly one bootstrap store', () => {
  // A tenant with none is a box `bin/box-up.sh` refuses to build (`die "declares no bootstrap store"`);
  // a tenant with two is a box that builds a different shop depending on jq's row order.
  for (const spec of box.tenants) {
    const boot = spec.stores.filter((s) => s.bootstrap);
    assert.equal(boot.length, 1, `${spec.id} declares ${boot.length} bootstrap store(s)`);
    assert.equal(bootstrapStoreOf(box, spec.id).handle, boot[0].handle);
  }
});

test('★ the .env.example default agrees with box.json — they are the same fact in two places', () => {
  // `provision-ref` reads FORGE_REF_STORE_HANDLE; `bin/box-up.sh` overrides it per tenant from box.json. A
  // default that disagreed would build the first tenant differently depending on which path ran.
  const env = readFileSync(join(SEED, '..', '.env.example'), 'utf8');
  const declared = /^FORGE_REF_STORE_HANDLE=(.+)$/m.exec(env)?.[1]?.trim();
  assert.equal(declared, bootstrapStoreOf(box, box.tenants[0].id).handle);
});

test('⛔ A13 — the disagreement between box.json and catalog.json is REPORTED, not silently resolved', () => {
  // ⚠️ THIS TEST IS GREEN WHILE THE FILES DISAGREE, on purpose. The `stores` array in catalog.json is
  // declared SUPERSEDED by box.json's own header and is being restructured by another slice; flipping the
  // flag here is not a no-op either (`stores()` applies a bootstrap store's theme and skips a non-bootstrap
  // one that already exists, so `outlet` would silently stop getting `theme_key`). What this slice owes is
  // that nothing LIES about it — so the helper names both answers and says which one the box is built from.
  const clash = topologyDisagreement(box, catalog.stores, 'forgeco');
  assert.ok(clash, 'the two files agree now — delete this test and the workaround it guards');
  assert.equal(clash.authority, 'forge');
  assert.deepEqual(clash.claimed, ['outlet']);
  assert.match(clash.sentence, /box\.json WINS/);
  assert.match(clash.sentence, /bin\/box-up\.sh/);
});

test('the coffee tenant does NOT disagree — the defect is one tenant wide, not a habit', () => {
  assert.equal(topologyDisagreement(box, catalog.stores, 'forgecafe'), null);
});

test('a tenant whose files agree reports nothing at all', () => {
  const agreeing = { tenants: [{ id: 't', stores: [{ handle: 'a', bootstrap: true }] }] };
  assert.equal(topologyDisagreement(agreeing, [{ handle: 'a', tenant: 't', bootstrap: true }], 't'), null);
});
