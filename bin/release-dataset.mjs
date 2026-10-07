// ★★ pk36/D2 — THE INSTANCE'S OWN DECLARATION, READ OUT OF ITS TRACKED DATASET (out of the release until v031/G).
//
// ⛔ THE HOLE THIS FILE CLOSES, MEASURED 2026-09-14. `bin/app-blocks.mjs` carries `ADMIN_WIDGETS` — the seven
// names the admin home opens on — and `bin/app-blocks.guard.mjs` graded them against
// `extensions/admin-dashboard/manifest.ts`, the MANIFEST, and against nothing else. But the seven are ALSO
// written in `<instance>/dataset/storefront.json` → `admin_widgets`, which is what `seed/widgets.mjs` hands
// `composition.reorder` on the real box and what `bin/verify-seed.mjs` grades a live tenant against. At the
// pinned commit `f67ce7660` the two lists are BYTE-IDENTICAL — so the rule passed by coincidence, and the day
// somebody reordered ONLY the dataset the fixture would have gone on describing the manifest's order, GREEN,
// while every box born from that dataset opened on another one.
//
// ── ★★★ THE ORDER HAS THREE OWNERS, AND THIS FILE EXISTS TO KNOW WHICH ONE IS SPEAKING ────────────────────
//
//   manifest   the PRODUCT's    — the default: what a board opens on when nobody said anything.
//   dataset    the INSTANCE's   — this box's arrangement, applied AT BIRTH (seeding), never after.
//   Compose    the MERCHANT's   — the last word, and ⛔ nothing here or upstream rewrites it.
//
// The decision of 2026-09-14, after a stronger one was withdrawn ("the dataset wins, it overrides what
// was placed before"): the dataset arranges the box AS IT IS BORN and never over a gesture that came later.
// ⛔ SO THIS FILE READS AND COMPARES; it moves nothing and it is not a migration.
//
// ⇒ THE RULE THE GUARD APPLIES: the fixture answers to the DATASET when the dataset declares, and to the
// MANIFESTS when it does not — and `boardAuthority` below makes it SAY WHICH. ⛔ Never both silently: "the
// instrument states about the WORLD what it only knows about ITSELF" is the defect this arc is named after,
// and a comparison that cannot name its own source is exactly that.
//
// ── WHERE THE DATASET IS READ FROM — ★ v031/G: THIS REPOSITORY, NOT THE RELEASE ─────────────────────────────
//
// Until 2026-10-07 this file read `<forge.lock → dataset.source>/storefront.json` as a git BLOB at the pinned
// commit of the PRODUCT, because the dataset lived there (`instances/demo/dataset`). The product stops carrying
// it in v0.3.1 (`DEMO-SAI-DO-PRODUTO`), and the demo tracks its own copy in `seed/dataset/` — the same path
// `deploy/box.env` and `compose.yml` mount on the box. So the declaration is read from THAT tracked file: the
// one this instance owns, the one the box is born from, and one a machine with no Forge clone can still read
// (so this rule stopped being NOT CHECKED there). Whether the box's IMAGES were baked alongside the same
// stamp is a different question, and `bin/dataset-provenance.mjs` answers it at step 0c.
//
// ⚠️ THE PATH IS NOT TYPED HERE: `TRACKED_DATASET_DIR` is exported once, by `bin/dataset-provenance.mjs`.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_WIDGETS_KEY, adminWidgetsIn, STOREFRONT_DECL_FILE } from '../seed/widgets.mjs';
import { TRACKED_DATASET_DIR } from './dataset-provenance.mjs';
import { ROOT } from './release-tree.mjs';

/**
 * ★ THE ADMIN BOARD AS THIS INSTANCE'S TRACKED DATASET DECLARES IT.
 *
 * Four answers, and the first two are kept apart on purpose (the third is `adminWidgetsIn`'s refusal):
 *
 *   `{ tried: […] }`               I COULD NOT LOOK — the tracked file is not there. The caller must say so out
 *                                  loud; a fallback that did not mention it would be a manifest-graded fixture
 *                                  wearing a dataset-graded face.
 *   `{ declared: [], where }`      the file IS there and declares no `admin_widgets`. The manifests answer.
 *   `{ declared: [names…], where }` this instance's arrangement, in order.
 *   `{ declared: null, why }`      it is there and it is not a declaration. ⛔ never read as "empty".
 */
export function datasetAdminWidgets(root = ROOT) {
  const where = `${TRACKED_DATASET_DIR}/${STOREFRONT_DECL_FILE}`;
  const path = join(root, where);
  if (!existsSync(path)) return { tried: [`${where} — not in this repository`] };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    // ⛔ NOT `{ tried }`. "I found the file and it is not JSON" is a broken dataset, not a machine that could
    // not look, and routing it through the skip would make a corrupt dataset look like a missing file.
    return { declared: null, why: `${where} could not be parsed: ${error.message}` };
  }
  const read = adminWidgetsIn(parsed, where);
  return { ...read, where, from: 'tracked' };
}

/**
 * ★★★ WHICH OF THE TWO DECLARATIONS THE FIXTURE ANSWERS TO — and the verdict CARRIES THE SENTENCE that says
 * which one answered and why the other did not.
 *
 * Pure on purpose: it takes the two candidate lists already read and decides between them, so the decision
 * itself is graded on every machine, including one with no Forge clone at all. Everything that can go silent
 * here is a branch of this function.
 *
 * @param dataset {{declared?: string[]|null, where?: string, why?: string, tried?: string[]}} `datasetAdminWidgets()`
 * @param manifest {{declared: string[], where: string}} what the pinned manifests place at the slot
 * @returns {{ expected: string[], source: 'dataset'|'manifest', sentence: string }}
 */
export function boardAuthority(dataset, manifest) {
  if (dataset?.declared === null) {
    // A malformed declaration must not fall back — falling back would be this repository quietly grading a
    // default while the box it describes refuses to seed (`seedAdminWidgets` fails on the same shape).
    throw new Error(
      `the release's instance dataset declares an unusable admin board: ${dataset.why}. Fix the dataset, or ` +
        'remove the key — an absent declaration is a legitimate state and this is not one.',
    );
  }
  if (dataset?.declared?.length > 0) {
    // ★ AND THE LOSER IS NAMED TOO, which is the half that keeps a manifest reorder from becoming invisible.
    // The dataset outranking the default is correct — it is the arrangement this box is born with — but a run
    // that said only "the dataset answers" would be silent about the product moving underneath it. So the
    // sentence says whether this instance still AGREES with the default or has departed from it, and where.
    const same = dataset.declared.join('|') === manifest.declared.join('|');
    const departure = same
      ? `and it is IDENTICAL to the product default (${manifest.where}), so nothing here depends on the ` +
        'difference today — which is exactly why it had to be graded: the two were identical on the day this ' +
        'rule was written and that is what made the old manifest-only comparison pass by coincidence.'
      : `and it DEPARTS from the product default: the manifests place ${manifest.declared.join(' · ')} ` +
        `(${manifest.where}). The departure is legitimate — the dataset is the instance's arrangement — ` +
        'but it is stated rather than absorbed.';
    return {
      expected: dataset.declared,
      source: 'dataset',
      sentence:
        `THE DATASET ANSWERS: ${dataset.where} declares ${dataset.declared.length} widget(s), so this ` +
        `instance's arrangement is what the fixture must carry, ${departure}`,
    };
  }
  const why = dataset?.tried
    ? `the instance dataset could not be read (${dataset.tried.join(' · ')})`
    : `${dataset.where} declares no ${ADMIN_WIDGETS_KEY}`;
  return {
    expected: manifest.declared,
    source: 'manifest',
    sentence:
      `THE MANIFESTS ANSWER — ${why}, so the board is the product's default and the fixture must carry ` +
      `${manifest.declared.length} widget(s) from ${manifest.where}. ⛔ This is a fallback and it is said out ` +
      'loud: a run that graded the default while believing it graded this instance is the silence pk36/D2 closed.',
  };
}
