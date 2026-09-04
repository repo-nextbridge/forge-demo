// A22 — THE CLUSTERS AND THE PROMOTIONS THAT CONDITION ON THEM.
//
// ★★ WHAT IS ACTUALLY WORTH TESTING HERE, and it is none of "there are four clusters":
//   · every RULE is written in the vocabulary the KERNEL declares, with an operator that type admits. A rule
//     the vocabulary refuses dies on the box, halfway through a run, having already created half a shop;
//   · every promotion RESOLVES its cluster and its store. A store handle that does not resolve is worse than
//     a crash: `promotion.create` takes a nullable store and null means TENANT-WIDE, so the fallback would
//     price every shop of the brand instead of the one named;
//   · the PAIR exists at all — a cluster nothing prices from is a saved search, not a capability, and the
//     admin has carried an empty clusters screen since the wave that built it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { clusterCondition, unresolvedClusters, unresolvedStores } from './audience.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(SEED, 'audience.json'), 'utf8'));
const BOX = JSON.parse(readFileSync(join(SEED, 'box.json'), 'utf8'));

/**
 * ★ THE CLUSTER VOCABULARY, COPIED BY MEASUREMENT FROM `packages/core/src/cluster/definition.ts`, and the
 * copy is the point: this repository cannot import the kernel, so the only alternative to restating it is
 * discovering a typo as a `validation_failed` on a box after eleven minutes of seeding. The pair
 * (attribute → type) is what decides which operators are legal, so both halves are here.
 */
const ATTRIBUTES = {
  order_count: 'number',
  total_spent: 'number',
  first_order_at: 'date',
  last_order_at: 'date',
  has_account: 'bool',
  origin_store: 'select',
  city: 'text',
  region: 'select',
  created_at: 'date',
};

/** `operatorsByType`, from the same file. */
const OPERATORS = {
  text: ['is', 'starts_with', 'contains'],
  number: ['eq', 'gt', 'lt', 'between'],
  select: ['is_one_of'],
  bool: ['is'],
  date: ['before', 'after', 'more_than_days_ago', 'less_than_days_ago'],
};

/** The two operators whose answer changes without the data changing — they cost the DAILY TICK. */
const RELATIVE = ['more_than_days_ago', 'less_than_days_ago'];

test('★★★ every rule is written in the vocabulary the kernel declares', () => {
  for (const cluster of DATA.clusters) {
    for (const condition of cluster.rule ?? []) {
      const type = condition.attribute.startsWith('cf.')
        ? null // a customer custom field: the key space is the merchant's, so the name cannot be checked here
        : ATTRIBUTES[condition.attribute];
      assert.ok(
        type !== undefined,
        `cluster "${cluster.name}" reads "${condition.attribute}", which the cluster vocabulary does not ` +
          `declare. It knows: ${Object.keys(ATTRIBUTES).join(', ')} (plus cf.<key>).`,
      );
      if (type === null) continue;
      assert.ok(
        OPERATORS[type].includes(condition.operator),
        `cluster "${cluster.name}": "${condition.attribute}" is a ${type} and a ${type} admits only ` +
          `${OPERATORS[type].join('/')} — not "${condition.operator}".`,
      );
    }
  }
});

test('★★ a `select` takes an ARRAY and a `number` takes a number — the shape, not just the operator', () => {
  // `is_one_of` with a bare string is the mistake this catches, and on the box it is a rule that matches
  // nobody while looking perfectly saved.
  for (const cluster of DATA.clusters) {
    for (const condition of cluster.rule ?? []) {
      const type = ATTRIBUTES[condition.attribute];
      if (type === 'select') {
        assert.ok(
          Array.isArray(condition.value) && condition.value.length > 0,
          `cluster "${cluster.name}": ${condition.attribute} is a select, so its value is a non-empty array`,
        );
      }
      if (type === 'number' || RELATIVE.includes(condition.operator)) {
        assert.equal(
          typeof condition.value,
          'number',
          `cluster "${cluster.name}": ${condition.attribute} ${condition.operator} wants a number`,
        );
      }
    }
  }
});

test('★ exactly one cluster depends on the CLOCK, and it is deliberate', () => {
  // A demo made only of event-driven clusters hides the half of the mechanism that needs a schedule; a demo
  // where every cluster is relative makes the daily tick rebuild everything. One is the point.
  const relative = DATA.clusters.filter((c) =>
    (c.rule ?? []).some((r) => RELATIVE.includes(r.operator)),
  );
  assert.equal(relative.length, 1, 'expected exactly one clock-dependent cluster');
  assert.match(String(relative[0].why ?? ''), /clock/i);
});

test('★★★ every promotion resolves its cluster — the link is by NAME because the id is minted by the box', () => {
  assert.deepEqual(unresolvedClusters(DATA), []);
  // …and the check is capable of RED.
  assert.deepEqual(
    unresolvedClusters({
      clusters: [{ name: 'A' }],
      promotions: [{ name: 'P', cluster: 'B' }],
    }),
    ['P'],
  );
});

test('★★★ every promotion names a store this tenant HAS — omitting it would go TENANT-WIDE', () => {
  const handles = BOX.tenants
    .find((t) => t.id === 'forgeco')
    .stores.map((s) => s.handle);
  assert.deepEqual(unresolvedStores(DATA, handles), []);
  assert.deepEqual(unresolvedStores(DATA, ['nowhere']), DATA.promotions.map((p) => p.name));
});

test('★★ every cluster is USED — a cluster nothing prices from is a saved search, not a capability', () => {
  // The whole item is the PAIR. This deliberately allows a cluster with no promotion (see the message): what
  // it refuses is the whole file drifting into a list of unused groups.
  const used = new Set(DATA.promotions.map((p) => p.cluster));
  const idle = DATA.clusters.filter((c) => !used.has(c.name)).map((c) => c.name);
  assert.ok(
    idle.length <= 1,
    `${idle.length} clusters are priced from by nothing (${idle.join(', ')}). One unused group shows that a ` +
      'cluster is useful on its own; a file of them shows a capability nobody connected.',
  );
});

test('★ the coupon has a CODE and the automatics do not — the trigger follows from it', () => {
  // A coupon promotion with no code is a discount nobody can reach; an automatic one with a code is a
  // promotion that fires without being asked for. `seed/audience.mjs` derives `trigger` from this field, so
  // the two can never disagree — this asserts the declaration still makes the derivation meaningful.
  const coded = DATA.promotions.filter((p) => p.code);
  assert.equal(coded.length, 1, 'expected exactly one coupon among the cluster promotions');
  assert.match(coded[0].code, /^[A-Z0-9]+$/, 'a code a person types out loud is upper-case and unspaced');
});

test('the condition is the kernel’s own vocabulary, spelled once', () => {
  assert.deepEqual(clusterCondition('clu_x'), {
    kind: 'customer_in_cluster',
    cluster_id: 'clu_x',
  });
});

test('names are unique in both families — the name is the idempotence key', () => {
  for (const family of ['clusters', 'promotions']) {
    const names = DATA[family].map((row) => row.name);
    assert.equal(new Set(names).size, names.length, `two rows share a name in ${family}`);
  }
});

test('⚠️ no cluster promotion carries a `min_subtotal` — the shop window’s freight band reads those', () => {
  // The Forge home's announcement band derives its number from the active uncapped free-shipping promotions
  // that carry a `min_subtotal`. A cluster promotion that grew one would silently change the sentence on the
  // first line of the shop, for everybody, because of a rule about SOME people.
  for (const promo of DATA.promotions) {
    assert.equal(promo.conditions, undefined, `"${promo.name}" declares conditions of its own`);
  }
});
