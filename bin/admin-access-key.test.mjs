// WHO THE GATE'S FRONT DOOR OPENS AS — the one decision `bin/admin-access-key.mjs` makes without asking.
//
//   node --test bin/admin-access-key.test.mjs        (or: bash bin/test.sh)
//
// Everything else that file does is a call to the port; what is graded here are the two RULES, and both are
// about who a redeemable session belongs to:
//
//   WHOSE SESSION a key mints — the three shapes a tenant is ever in: born (one invited owner), grown
//                               (colleagues beside the owner), and ambiguous (two owners).
//   WHOSE ENTRY a brand gets   — ★★★ an entry is whole or ABSENT. A tenant missing a key or a store must
//                               fall through to its own login screen and can NEVER take its neighbour's,
//                               which would sign a visitor on one brand's hostname into the other's tenant.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  KEY_LABEL,
  accessKeySecretName,
  chooseOperator,
  declaredAccessKeys,
} from './admin-access-key.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const owner = (over = {}) => ({ id: 'adu_owner', role: 'owner', status: 'invited', ...over });

test('★★★ A FRESHLY BORN TENANT IS THE CASE THIS EXISTS FOR — its owner is `invited`, not `active`', () => {
  // ⛔ THE TRAP. `provision-ref` INVITES the first operator; the status flips to `active` on the first
  // sign-in, and signing in with no login screen is precisely what this key is for. A rule written as
  // `status === 'active'` refuses every box on the only day it is asked.
  const chosen = chooseOperator([owner()]);
  assert.equal(chosen.ok, true, `the invited owner was refused: ${chosen.why}`);
  assert.equal(chosen.user.id, 'adu_owner');
});

test('★★ the OWNER is picked out of a tenant with colleagues — never whoever sorts first', () => {
  const chosen = chooseOperator([
    { id: 'adu_marketing', role: 'marketing', status: 'active' },
    owner({ status: 'active' }),
    { id: 'adu_support', role: 'support', status: 'active' },
  ]);
  assert.equal(chosen.ok, true, `the owner was not found: ${chosen.why}`);
  assert.equal(chosen.user.id, 'adu_owner', 'the key would redeem into a colleague of the owner.');
});

test('★★ a DISABLED owner is not a door — the kernel would refuse it, and so does this', () => {
  const chosen = chooseOperator([owner({ status: 'disabled' })]);
  assert.equal(chosen.ok, false);
  assert.match(chosen.why, /loginable owner/);
});

test('⛔ TWO loginable owners REFUSE — a silent pick puts a redeemable session on a person nobody named', () => {
  const chosen = chooseOperator([owner(), owner({ id: 'adu_second', status: 'active' })]);
  assert.equal(chosen.ok, false);
  assert.match(chosen.why, /2 loginable owners/);
});

test('⛔ a tenant with no operator at all is a box that was never born, and it SAYS so', () => {
  for (const rows of [[], undefined, null]) {
    const chosen = chooseOperator(rows);
    assert.equal(chosen.ok, false);
    assert.match(chosen.why, /no operator at all/);
  }
});

test('★ the label is a sentence a human reads in the Team listing, and it is stable', () => {
  // It is what the next run REVOKES by, so a label that drifts leaves the previous door open for ever while
  // every run reports success.
  assert.ok(KEY_LABEL.length > 10, `the revoke key is ${JSON.stringify(KEY_LABEL)} — too thin to recognise.`);
  assert.doesNotMatch(KEY_LABEL, /[A-Z_]{4,}/, 'the label is a slug; the Team screen shows it to a person.');
});

// ── THE MAP THE ADMIN READS — and the one rule that makes a missing entry SAFE ────────────────────────────

const TENANTS = ['brand_a', 'brand_b', 'brand_c'];
const store = (tenant) => `sto_${tenant}`;
const secretsOf = (entries) => new Map(entries);

test('★★★ the shape is `{tenant: {store, key}}`, keyed by the REGISTRY tenant id', () => {
  const map = declaredAccessKeys(
    secretsOf([
      ['forge-admin-access-key', 'fopk_a'],
      ['forge-admin-access-key-brand_b', 'fopk_b'],
    ]),
    { brand_a: store('a'), brand_b: store('b') },
    TENANTS,
  );
  assert.deepEqual(map, {
    brand_a: { store: store('a'), key: 'fopk_a' },
    brand_b: { store: store('b'), key: 'fopk_b' },
  });
});

test('★★★ A TENANT WITH NO KEY IS ABSENT — it NEVER inherits the neighbour’s', () => {
  // ⛔ THE LEAK THIS FORBIDS. The first tenant's secret is filed under the UNSUFFIXED name, so a lookup with
  // any fallback at all — positional, "the first one", "the only one filed" — would hand brand_b the key
  // that signs a session into brand_a, on brand_b's own hostname. Both halves are looked up under the
  // tenant's own name and nowhere else, and this is the box that proves it: everything is configured for
  // brand_a and nothing for brand_b.
  const map = declaredAccessKeys(
    secretsOf([['forge-admin-access-key', 'fopk_a']]),
    { brand_a: store('a'), brand_b: store('b') },
    TENANTS,
  );
  assert.deepEqual(map, { brand_a: { store: store('a'), key: 'fopk_a' } });
  assert.equal(map.brand_b, undefined, 'brand_b took an entry it has no key for.');
});

test('★★ …and a tenant with a key but NO STORE is absent too — half an entry is not an entry', () => {
  // The store is what fixes the tenant on the public redeem face. An entry carrying a key and no store would
  // be redeemed against nothing, and one carrying another tenant's store answers `unauthorized`.
  const map = declaredAccessKeys(
    secretsOf([
      ['forge-admin-access-key', 'fopk_a'],
      ['forge-admin-access-key-brand_b', 'fopk_b'],
    ]),
    { brand_a: store('a') },
    TENANTS,
  );
  assert.deepEqual(Object.keys(map), ['brand_a']);
});

test('★★ each tenant’s store is ITS OWN — the map never pairs one brand’s key with another brand’s store', () => {
  const map = declaredAccessKeys(
    secretsOf([
      ['forge-admin-access-key', 'fopk_a'],
      ['forge-admin-access-key-brand_b', 'fopk_b'],
    ]),
    { brand_a: store('a'), brand_b: store('b') },
    TENANTS,
  );
  for (const [tenant, entry] of Object.entries(map)) {
    assert.equal(entry.store, store(tenant.replace('brand_', '')), `${tenant} was paired with another tenant's store.`);
  }
});

test('★ the secret name rule has ONE author, and `bin/box-up.sh` implements the same one', () => {
  // The birth files the key; this file reads it back. Two spellings of one name is a key that looks filed and
  // reads back missing — and, for the tenant after the first, a lookup that could fall on the unsuffixed one.
  assert.equal(accessKeySecretName(TENANTS, 'brand_a'), 'forge-admin-access-key');
  assert.equal(accessKeySecretName(TENANTS, 'brand_b'), 'forge-admin-access-key-brand_b');
  const boxUp = readFileSync(join(ROOT, 'bin/box-up.sh'), 'utf8');
  assert.match(
    boxUp,
    /access\)\s*base=forge-admin-access-key\s*;;/,
    'bin/box-up.sh no longer files the gate key under `forge-admin-access-key` — the birth and this reader ' +
      'disagree about where the key lives, and nothing else would say so.',
  );
  assert.match(
    boxUp,
    /printf '%s-%s' "\$base" "\$t"/,
    'bin/box-up.sh no longer suffixes the secret name with the tenant for every tenant after the first.',
  );
});
