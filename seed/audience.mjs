// A22 — THE SHOE BRAND'S CUSTOMER CLUSTERS AND THE PROMOTIONS THAT CONDITION ON THEM, driven through the
// port. `seed/audience.json` holds the data and the reasons; this file is only the hand.
//
// ★★ IT RUNS IN THE **WINDOW** PHASE, AND THAT IS LOAD-BEARING RATHER THAN TIDY.
//
// A cluster's membership is MATERIALIZED: `customer_cluster.create` recomputes the group inside its own
// transaction, over the customers that exist AT THAT MOMENT. Run in the curated phase (step 8) this tenant has
// no customers at all — the 2 790-product catalogue arrives at step 9 and the 180-day past, with every buyer
// in it, at step 10. Four clusters created before them would all be born EMPTY, look correct, and stay empty
// until something happened to touch each customer. The window (step 11) is the first moment the question
// «who has spent more than a thousand reais?» has an honest answer.
//
// ⚠️ AND «EMPTY» IS NOT AN ERROR HERE. A cluster with no members is a legal state — a rule about a shop that
// has not sold anything yet. So this file REPORTS the counts rather than asserting them: a number in the log
// is what tells a reader whether the box came up with a demonstrable cluster or with four empty lists, and
// neither is a reason to fail a seed.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(SEED, 'audience.json'), 'utf8'));

/**
 * ⛔ THE DECLARATION THAT WOULD DIE ON THE BOX — checked here, with the file name in the message, before a
 * single command is sent.
 *
 * A promotion names its cluster by NAME, because a cluster id is minted by the box being seeded and cannot be
 * written down here. A name with no cluster behind it is therefore a typo that would otherwise surface as
 * `validation_failed · cluster not found` halfway through the run, having already created three clusters and
 * one promotion — a half-written shop nobody asked for.
 */
export function unresolvedClusters(spec = data) {
  const known = new Set((spec.clusters ?? []).map((c) => c.name));
  return (spec.promotions ?? []).filter((p) => !known.has(p.cluster)).map((p) => p.name);
}

/**
 * ⛔ AND THE OTHER HALF OF THE SAME CHECK: a promotion pointing at a store this tenant does not have.
 *
 * `promotion.create` takes a NULLABLE `store_id` and null means TENANT-WIDE. So a handle that does not resolve
 * must not fall back to «no store» — that is not a smaller mistake, it is a promotion silently pricing every
 * shop of the brand instead of the one it names.
 */
export function unresolvedStores(spec, handles) {
  const known = new Set(handles);
  return (spec.promotions ?? []).filter((p) => !known.has(p.store)).map((p) => p.name);
}

/**
 * THE CONDITION THAT TIES ONE PROMOTION TO ONE CLUSTER — the kernel's own vocabulary, in one place.
 *
 * ★ IT IS A LOOKUP AND NOT A RULE EVALUATION, which is the whole reason the cluster road exists on the
 * customer axis: membership is materialized and the pricing context resolves it to `cluster_ids` before the
 * engine runs, so a cart pays ONE indexed array test rather than running a merchant-authored rule on the
 * hottest path in the store.
 */
export const clusterCondition = (clusterId) => ({
  kind: 'customer_in_cluster',
  cluster_id: clusterId,
});

export async function seedAudience({ command, readAll, rows, read, log, fail }) {
  const orphanClusters = unresolvedClusters(data);
  if (orphanClusters.length > 0) {
    fail(
      `audience — seed/audience.json: promotion(s) ${orphanClusters.join(', ')} name a cluster this file ` +
        'does not declare. A cluster id is minted by the box, so the link is by NAME and a typo has nothing ' +
        'to resolve against.',
    );
  }

  const stores = rows(await read('stores'));
  const orphanStores = unresolvedStores(data, stores.map((s) => s.handle));
  if (orphanStores.length > 0) {
    fail(
      `audience — seed/audience.json: promotion(s) ${orphanStores.join(', ')} name a store this tenant does ` +
        `not have (it has: ${stores.map((s) => s.handle).join(', ')}). Omitting the store would make the ` +
        'promotion TENANT-WIDE, which is a bigger mistake than the typo, so this refuses instead.',
    );
  }
  const storeIdOf = new Map(stores.map((s) => [s.handle, s.id]));

  // ── the clusters ─────────────────────────────────────────────────────────────────────────────────────
  // IDEMPOTENT BY NAME. `customer_cluster.create` does not enforce uniqueness — two clusters called
  // "Clientes VIP" are legal at the kernel and indistinguishable at the admin, which is precisely why the
  // name has to be the key HERE.
  const known = new Map(
    (await readAll('clusters_admin', { state: 'all' })).map((c) => [c.name, c]),
  );
  const clusterId = new Map();
  let created = 0;
  for (const cluster of data.clusters) {
    const found = known.get(cluster.name);
    if (found) {
      // Left ALONE, not updated — the same reasoning `seed/vitrine.mjs` states about promotions: whoever is
      // testing this bench may have edited the rule from the admin, and re-writing it undoes their move.
      clusterId.set(cluster.name, found.cluster_id ?? found.id);
      log(`audience — cluster "${cluster.name}" already there (${found.cluster_id ?? found.id})`);
      continue;
    }
    const out = await command('customer_cluster.create', {
      name: cluster.name,
      description: cluster.description ?? null,
      match: cluster.match ?? 'all',
      rule: cluster.rule ?? [],
    });
    clusterId.set(cluster.name, out.cluster_id);
    created += 1;
    log(`audience — cluster "${cluster.name}" created (${out.cluster_id})`);
  }

  // ★ THE MEMBER COUNTS, READ BACK. The create recomputes membership in its own transaction, so this is not
  // a second computation — it is the report. A box that came up with four empty clusters is a box whose
  // history did not land, and that is worth one line in a log rather than an hour of clicking.
  const counted = await readAll('clusters_admin', { state: 'all' });
  const sizeOf = (name) => {
    const row = counted.find((c) => c.name === name);
    if (!row) return '?';
    // ⚠️ THE FIELD IS `customer_count`, and the list carries THREE numbers on purpose — `rule_count` (whom
    // the rule reaches), `pinned_count` (whom a merchant pinned) and the union. This seed pins nobody, so
    // the three agree today; naming the union anyway is what keeps the line true if somebody pins.
    return row.customer_count ?? '?';
  };
  log(
    `audience — ${data.clusters.length} cluster(s), ${created} created: ` +
      data.clusters.map((c) => `${c.name} = ${sizeOf(c.name)}`).join(' · '),
  );

  // ── the promotions that condition on them ────────────────────────────────────────────────────────────
  // IDEMPOTENT BY NAME, the same key `seed/vitrine.mjs` and `seed/totem.mjs` use, and the lookup is
  // tenant-wide because `promotions_admin` is: two stores may not carry the same promotion NAME.
  const existing = new Map((await readAll('promotions_admin')).map((p) => [p.name, p]));
  let priced = 0;
  for (const promo of data.promotions) {
    if (existing.has(promo.name)) {
      log(`audience — promotion "${promo.name}" already there (${existing.get(promo.name).id})`);
      continue;
    }
    const out = await command('promotion.create', {
      name: promo.name,
      label: promo.label,
      store_id: storeIdOf.get(promo.store),
      benefit: promo.benefit,
      target: { kind: 'all' },
      conditions: [clusterCondition(clusterId.get(promo.cluster))],
      // ★ STACKABLE, and `seed/audience.json`'s `_promotions_why` carries the argument: an exclusive
      // customer promotion would DISPLACE the merchandising the shopper can see on the shelf.
      stackable: true,
      trigger: promo.code ? 'coupon' : 'automatic',
      // Born ACTIVE, unlike the command's own default: a draft promotion is a shop that prints a discount on
      // the product page and charges full price at the till.
      status: 'active',
    });
    if (promo.code) {
      // ⚠️ THE CODE IS A SECOND COMMAND AND THE PROMOTION IS INERT WITHOUT IT — a coupon nobody can type. It
      // is tolerated as already-taken so a run that died between the two converges instead of dying on the
      // kernel being right, exactly as the counter's coupon does.
      const added = await command(
        'promotion.code.add',
        { promotion_id: out.promotion_id, code: promo.code },
        { tolerate: ['code_taken'] },
      );
      if (added.refused) {
        fail(
          `audience — the code ${promo.code} already belongs to another promotion ` +
            `(${added.error?.details?.promotion_id ?? 'unknown'}). A code is unique tenant-wide; this seed ` +
            'will not steal one. Remove it there, or rename the coupon in seed/audience.json.',
        );
      }
    }
    priced += 1;
    log(
      `audience — promotion "${promo.name}" created on ${promo.store}, ` +
        `conditioned on "${promo.cluster}"${promo.code ? ` with code ${promo.code}` : ''}`,
    );
  }
  log(`audience — ${data.promotions.length} cluster promotion(s): ${priced} created`);
}
