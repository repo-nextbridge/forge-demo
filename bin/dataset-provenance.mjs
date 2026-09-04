// ★★ IS THE DATASET THIS BOX WOULD SEED FROM THE ONE ITS IMAGES WERE BUILT WITH?
//
//   node bin/dataset-provenance.mjs        → 0 when they agree (or cannot be compared), 1 when they diverge
//
// Read by `bin/box-up.sh` between the promotion block and step 1 — before a single container starts, because
// the answer costs milliseconds and being wrong costs the 74 minutes the seed takes to fill a whole store
// with the wrong catalogue.
//
// ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────────────────────────────────────
// The birth of 2026-09-03 (`DIARIO-CAIXA-NOVA.md`, F4). `.env` pointed at
// `…/wt-v03/t-forno/instances/demo/dataset` — a worktree 166 commits behind the tree the four images were
// baked from — and the box came up GREEN with the admin's stock panel empty, with all of the work that fills
// it inside the image. The idle shelf existed in the code, in the image and in the tests; it did not exist in
// the DATA. And it was not only that panel: 2 790 products, the categories and the brands all came from
// yesterday's checkout.
//
// ⚠️ EVERY OTHER INPUT OF THIS BOX IS PINNED. The four images are pinned BY DIGEST in `forge.lock`, and
// `bin/images-from-lock.sh` refuses even a tag. The dataset is the one input that is not — deliberately, see
// below — so it is the one input that can age in silence. A host path in a `.env` has no way of ageing loudly
// unless somebody makes the noise, and this is the noise.
//
// ── WHY THE DATASET IS NOT SIMPLY BAKED INTO THE IMAGE, which would have killed the class outright ─────────
// MEASURED before choosing: the dataset directory is 40 MB — a 36 MB `catalog.json` plus 4 MB of shared art.
// The 3.6 GB of per-product photographs are NOT inside it; they live in a public bucket and are hydrated on
// demand. So SIZE was never the obstacle: 40 MB would ride in an image without anybody noticing.
//
// What refuses it is the boundary. There is one `infra/Dockerfile`, and the demo's kernel image IS the
// platform's kernel image with a composition — so baking the demo's dataset bakes ONE instance's shoe
// catalogue into EVERY customer's kernel. That is not a hypothetical: it is the defect
// `packages/seed-dataset/src/pointer.ts` and `scripts/publishing/instance-content.guard.test.ts` were written
// for ("every customer's kernel image shipped our shoe catalog"), and that guard asserts it in BOTH
// directions — nothing declaring itself a dataset in the production closure, and the demo's dataset still
// present OUTSIDE every workspace package. Baking would turn that guard red, on purpose, in the product repo.
// So: compare, do not bake.
//
// ── WHAT IS COMPARED, AND WHY IT NEEDS NOBODY'S DISCIPLINE ─────────────────────────────────────────────────
// The worry with a comparison is that it only works if someone stamps the provenance correctly. Here nobody
// has to: `forge-seed-dataset.json` ALREADY carries a content hash per payload — `pointer.ts` calls it "a
// content hash over the payload's bytes", written by `pnpm pack:dataset` and committed. This file only moves
// that stamp from where it is authored to where it is read:
//
//   bin/build-local.sh   copies the pointer's stamp into `forge.lock` as it bakes the four images
//   this file           compares that record against the pointer of the directory the box actually mounts
//
// Both payloads are compared. They version independently on purpose (a price fix must not invalidate a warm
// 3.6 GB photo cache), and both are provenance: a box hydrating a different photo tree is a box showing
// different pictures. `generatedAt` is deliberately NOT compared — it is a clock, not content, and a re-pack
// of identical bytes must not fail a birth.
//
// AND THE STAMP IS GRADED AGAINST ITS OWN DIRECTORY FIRST (`catalogFreshness` below), because a comparison is
// worth exactly what the stamp is worth: nothing upstream keeps the pointer in step with the bytes, so an edit
// without a re-pack would make this file answer "same tree" about a tree that is gone.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The file that DECLARES a directory to be a seed dataset (`packages/seed-dataset/src/pointer.ts`). */
export const POINTER_FILE = 'forge-seed-dataset.json';

/** How a payload's version reads when the payload was never published. `pointer.ts` allows `version: null`. */
const UNPUBLISHED = '(unpublished)';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** The stamp, reduced to the fields that ARE the provenance. Kept in one place so the lock and the mounted
 *  pointer are compared as the same shape rather than as two hand-matched field lists. */
function stampOf(source) {
  return {
    id: source?.id ?? null,
    catalog: {
      version: source?.catalog?.version ?? null,
      totalBytes: source?.catalog?.totalBytes ?? null,
    },
    photos: {
      version: source?.photos?.version ?? null,
      totalBytes: source?.photos?.totalBytes ?? null,
    },
  };
}

const describe = (stamp) =>
  `${stamp.id ?? '(no id)'} · catalog ${stamp.catalog.version ?? UNPUBLISHED} · photos ${
    stamp.photos.version ?? UNPUBLISHED
  }`;

/**
 * What `forge.lock` says about the dataset its images were baked alongside. THREE states, and the difference
 * between the last two is the whole reason this is not a boolean:
 *   recorded   — a stamp. Compare it.
 *   none       — `"dataset": null`: an ANSWER, "these images were built with no example data".
 *   unrecorded — the key is absent: the lock is SILENT. A lock downloaded from a promoted release says
 *                nothing about anybody's instance content, and refusing there would teach an operator to
 *                delete the check.
 */
export function lockSide(lockPath) {
  const lock = readJson(lockPath);
  if (!lock) return { state: 'unrecorded', why: `no readable lock at ${lockPath}`, release: null, builtFrom: null };
  const release = lock.forgeVersion ?? null;
  const builtFrom = lock.provenance?.built_from ?? null;
  if (!('dataset' in lock)) return { state: 'unrecorded', why: `${lockPath} records no \`dataset\``, release, builtFrom };
  if (lock.dataset === null) return { state: 'none', release, builtFrom };
  return { state: 'recorded', stamp: stampOf(lock.dataset), source: lock.dataset.source ?? null, release, builtFrom };
}

/**
 * ★ IS THE POINTER STILL TELLING THE TRUTH ABOUT ITS OWN DIRECTORY?
 *
 * The one weakness of comparing instead of baking: a stamp is only worth what it describes. Nobody types this
 * one — `pnpm pack:dataset` writes it — but NOTHING upstream keeps it in step with the bytes. The order of the
 * day is stated in prose (`instances/demo/README.md`: "write the dataset → check:dataset → pack:dataset →
 * mount") and enforced by no test, so an edit to `catalog.json` without a re-pack leaves a stamp naming a tree
 * that no longer exists — and the comparison below would call that a match.
 *
 * `catalog.totalBytes` is EXACTLY the sum of the files the pointer lists (measured on the baked tree:
 * 41 552 643 declared, 41 552 643 on disk, delta 0), so the question costs 26 `stat`s.
 *
 * ⚠️ WHAT THIS DOES NOT DO: it does not re-derive the content hash. That algorithm lives in the platform
 * (`packages/seed-dataset`), and a second implementation here would be a second source of one fact — the
 * species this whole file exists to kill. So a byte-preserving edit still passes, and the photo payload
 * (whose files are in a bucket, not in this directory) is not checked at all.
 */
function catalogFreshness(dir, pointer) {
  const files = Array.isArray(pointer?.catalog?.files) ? pointer.catalog.files : null;
  const declared = pointer?.catalog?.totalBytes;
  if (!files || files.length === 0 || typeof declared !== 'number') return null; // nothing declared to grade
  let onDisk = 0;
  const missing = [];
  for (const rel of files) {
    try {
      onDisk += statSync(join(dir, rel)).size;
    } catch {
      missing.push(rel);
    }
  }
  if (missing.length === 0 && onDisk === declared) return null;
  const gap =
    missing.length > 0
      ? `${missing.length} file(s) the pointer lists are not there (${missing.slice(0, 3).join(', ')}${
          missing.length > 3 ? ', …' : ''
        })`
      : `it declares ${declared} byte(s) of catalogue and the directory holds ${onDisk}`;
  return `${gap} — the stamp was written before this directory was last edited. Re-run \`pnpm pack:dataset\`.`;
}

/**
 * What the box would actually seed from — the directory `FORGE_SEED_DATASET_HOST_DIR` mounts.
 *   mounted    — a pointer was read and it still describes this directory.
 *   unmounted  — no directory configured. The platform's own no-op state.
 *   broken     — a directory was configured and is not a dataset. Never read as "an empty one".
 *   stale      — it IS a dataset, and its stamp no longer describes it. Comparing that stamp would be theatre.
 */
export function boxSide(hostDir) {
  const dir = (hostDir ?? '').trim();
  if (dir === '') return { state: 'unmounted' };
  const pointer = join(dir, POINTER_FILE);
  if (!existsSync(pointer)) return { state: 'broken', dir, why: `there is no ${POINTER_FILE} in ${dir}` };
  const parsed = readJson(pointer);
  if (!parsed) return { state: 'broken', dir, why: `${pointer} is not valid JSON` };
  const stale = catalogFreshness(dir, parsed);
  if (stale) return { state: 'stale', dir, why: stale, stamp: stampOf(parsed) };
  return { state: 'mounted', dir, stamp: stampOf(parsed) };
}

function sameStamp(a, b) {
  return (
    a.id === b.id &&
    a.catalog.version === b.catalog.version &&
    a.catalog.totalBytes === b.catalog.totalBytes &&
    a.photos.version === b.photos.version &&
    a.photos.totalBytes === b.photos.totalBytes
  );
}

const REBAKE = 'bash bin/build-local.sh <path to the forge monorepo> — re-bakes the images and rewrites forge.lock.';

/**
 * The verdict, and its MESSAGE is the deliverable. "They diverge" is what the two `catalog.json` files said
 * for a whole night without anybody hearing it; the only sentence that shortens the hunt names the two
 * versions side by side, and says where each one came from.
 */
export function provenanceVerdict(lock, box) {
  const images = `the IMAGES   ${[lock.release, lock.builtFrom].filter(Boolean).join(' · ') || '(unnamed build)'}`;

  if (lock.state === 'unrecorded') {
    const mounted =
      box.state === 'mounted' || box.state === 'stale'
        ? `this box mounts ${box.dir}\n                  which declares  ${describe(box.stamp)}`
        : box.state === 'broken'
          ? `and ${box.why}`
          : 'and this box mounts none either';
    return {
      verdict: 'uncomparable',
      message: `${lock.why}, so the dataset cannot be checked against them — ${mounted}\n     ${REBAKE}`,
    };
  }

  const lockLine =
    lock.state === 'none'
      ? `     ${images}\n                  were built with  NO dataset`
      : `     ${images}\n                  were built with  ${describe(lock.stamp)}${
          lock.source ? `   (${lock.source})` : ''
        }`;

  if (box.state === 'broken') {
    return {
      verdict: 'diverged',
      message: `${lockLine}\n     the DATASET  ${box.dir}\n                  is not a dataset: ${box.why}\n     A directory that does not declare itself a dataset is not read as an empty one — the box would be born\n     with the whole catalogue missing and exit 0.`,
    };
  }

  if (box.state === 'stale') {
    // Refused BEFORE the comparison, and that order is the point: a stamp that no longer describes its own
    // directory would answer "same tree" for a tree that is not there any more.
    return {
      verdict: 'diverged',
      message: `${lockLine}\n     the DATASET  ${box.dir}\n                  declares         ${describe(
        box.stamp,
      )}\n                  BUT ${box.why}`,
    };
  }

  if (lock.state === 'none' && box.state === 'unmounted') {
    return { verdict: 'match', message: 'no dataset on either side — this box seeds no example catalogue.' };
  }

  if (box.state === 'unmounted') {
    return {
      verdict: 'diverged',
      message: `${lockLine}\n     the DATASET  NONE — FORGE_SEED_DATASET_HOST_DIR is unset or empty in .env\n     Step 9 would print "nothing to seed" and exit 0, and the box would be born without its catalogue.`,
    };
  }

  if (lock.state === 'none') {
    return {
      verdict: 'diverged',
      message: `${lockLine}\n     the DATASET  ${box.dir}\n                  declares         ${describe(box.stamp)}`,
    };
  }

  const mountedLine = `     the DATASET  ${box.dir}\n                  declares         ${describe(box.stamp)}`;
  if (sameStamp(lock.stamp, box.stamp)) {
    return { verdict: 'match', message: `${describe(box.stamp)} — the same tree the images were built from.` };
  }
  return {
    verdict: 'diverged',
    message: `${lockLine}\n${mountedLine}\n     Point FORGE_SEED_DATASET_HOST_DIR at the dataset of the tree named above, or re-bake:\n     ${REBAKE}`,
  };
}

// ── the CLI half ───────────────────────────────────────────────────────────────────────────────────────────
// Exit 1 on divergence ONLY. An uncomparable lock exits 0 and says why: a check that refuses what it cannot
// judge is a check people route around.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  // The lock is named by the caller (`bin/box-up.sh` passes its own), then FORGE_LOCK — the same variable
  // `bin/images-from-lock.sh` and `bin/verify-composition.sh` already honour — then the working directory.
  const lockPath = process.argv[2] || process.env.FORGE_LOCK || join(process.cwd(), 'forge.lock');
  const verdict = provenanceVerdict(lockSide(lockPath), boxSide(process.env.FORGE_SEED_DATASET_HOST_DIR));
  if (verdict.verdict === 'diverged') {
    process.stderr.write(
      `\n[dataset-provenance] THIS BOX WOULD SEED FROM A DATASET THAT IS NOT THE ONE ITS IMAGES WERE BUILT WITH.\n\n${verdict.message}\n\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`${verdict.message}\n`);
}
