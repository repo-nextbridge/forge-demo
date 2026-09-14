// pk7/D2 — THE DATASET THIS BOX SEEDS FROM IS THE ONE ITS IMAGES WERE BUILT WITH, OR THE BIRTH REFUSES.
//
// THE DEFECT, MEASURED ON THE BIRTH OF 2026-09-03 (`DIARIO-CAIXA-NOVA.md`, F4). `.env` said
//
//   FORGE_SEED_DATASET_HOST_DIR=…/wt-v03/t-forno/instances/demo/dataset
//
// and `t-forno` was a worktree 166 commits behind the tree the four images were baked from. The box came up
// green and the admin's stock panel was born empty (`out 0/3 · partial 0/4 · low 0/6`) WITH ALL OF `pk6/m10`
// inside the image: the idle shelf existed in the code, in the image and in the tests, and did not exist in
// the DATA the box read. The whole demo — 2 790 products, its categories, its brands — came from yesterday's
// checkout, and nothing anywhere said so.
//
// ⚠️ A HOST PATH IN A `.env` HAS NO WAY OF AGEING LOUDLY. It is the one input of this box that `forge.lock`
// does not pin, because the dataset deliberately does NOT ride in the image (see below). So the noise has to
// be made on purpose, and this is it.
//
// WHY THE DATASET IS NOT SIMPLY BAKED IN, which is the other exit and the one that would have killed the
// class outright. MEASURED: the dataset is 40 MB (a 36 MB `catalog.json` + 4 MB of shared art) — the 3.6 GB
// of per-product photographs are NOT in it, they are pulled from a bucket at hydrate time. So it would FIT.
// It is refused for a different reason: there is one `infra/Dockerfile` and the demo's kernel image is the
// platform's kernel image, so baking would put ONE instance's shoe catalogue into EVERY customer's kernel —
// which is the exact defect `scripts/publishing/instance-content.guard.test.ts` was written for and asserts
// against in both directions. Hence the comparison, not the bake.
//
// WHAT IS COMPARED. `forge-seed-dataset.json` already carries a CONTENT hash per payload
// (`packages/seed-dataset/src/pointer.ts`: "a content hash over the payload's bytes"), so nobody has to
// remember to stamp anything by hand — `pnpm pack:dataset` writes it. `bin/build-local.sh` copies that stamp
// into `forge.lock` as it bakes; `bin/box-up.sh` compares it against the dataset the box actually mounts.
//
//   node --test bin/dataset-provenance.test.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { POINTER_FILE, boxSide, lockSide, provenanceVerdict } from './dataset-provenance.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const scratch = [];
after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});
function scratchDir() {
  const dir = mkdtempSync(join(tmpdir(), 'forge-provenance-'));
  scratch.push(dir);
  return dir;
}

/** The two catalogue hashes as they were measured on the night of the defect. The byte counts are the real
 *  ones' shape at a size a test can write (41 552 643 against 41 549 350 — a 3 293-byte difference).
 *
 *  ⚠️ THESE ARE SYNTHETIC FIXTURE VALUES AND ARE MEANT TO BE STALE. They are frozen at that night's pair on
 *  purpose — this file writes its own datasets and grades the refusal, so it never reads this box's real
 *  stamp and must never be "corrected" to it. The demo's actual `catalog.version` moved on (`pk18/p1`) and
 *  lives in `forge.lock` → `dataset.catalog.version`; `README.md`'s example prints the same frozen pair for
 *  the same reason. Two places showing `81bd9fb7658719db` are one story, not a disagreement. */
const BAKED = { catalog: '81bd9fb7658719db', bytes: 4123 };
const MOUNTED = { catalog: 'c51b5e4b49324fa9', bytes: 4118 };
const PHOTOS = '9aa8af0d782b82ec';

/** A dataset directory that is CONSISTENT with its own pointer — the payload really is `bytes` long. */
function writeDataset(stamp) {
  const dir = join(scratchDir(), 'dataset');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'catalog.json'), 'x'.repeat(stamp.bytes));
  writeFileSync(
    join(dir, POINTER_FILE),
    JSON.stringify({
      formatVersion: 1,
      id: 'demo',
      name: 'Loja Demo (calcados, PT-BR)',
      baseUrl: 'https://example.invalid/demo-catalog',
      catalog: { version: stamp.catalog, count: 1, totalBytes: stamp.bytes, files: ['catalog.json'] },
      photos: { version: PHOTOS, count: 18582, totalBytes: 3627725256 },
      generatedAt: '2026-09-03T21:48:38.466Z',
    }),
  );
  return dir;
}

function writeLock(dataset) {
  const dir = scratchDir();
  const lock = {
    forgeVersion: 'v0.3.0-pre.cb2154ef7',
    provenance: { origin: 'local build', built_from: 'pk6/integra@cb2154ef7' },
    images: { kernel: 'forge-demo-kernel@sha256:aa' },
  };
  if (dataset !== undefined) lock.dataset = dataset;
  const path = join(dir, 'forge.lock');
  writeFileSync(path, JSON.stringify(lock));
  return path;
}

const stampFor = (s) => ({
  source: 'instances/demo/dataset',
  id: 'demo',
  catalog: { version: s.catalog, totalBytes: s.bytes },
  photos: { version: PHOTOS, totalBytes: 3627725256 },
});

test('★★ THE NIGHT OF 03/09 — a dataset from another tree is REFUSED, and the refusal names BOTH stamps', () => {
  const verdict = provenanceVerdict(lockSide(writeLock(stampFor(BAKED))), boxSide(writeDataset(MOUNTED)));

  assert.equal(verdict.verdict, 'diverged');
  // ⛔ THE DoD. "They diverge" is what the two `catalog.json` files said for a whole night without anybody
  // hearing it. The only sentence that shortens the hunt names the two versions side by side.
  assert.match(verdict.message, /81bd9fb7658719db/, 'the refusal must name the stamp the IMAGES carry');
  assert.match(verdict.message, /c51b5e4b49324fa9/, 'the refusal must name the stamp the DATASET declares');
  // And where each one came from, because a hash alone sends nobody anywhere.
  assert.match(verdict.message, /pk6\/integra@cb2154ef7/);
  assert.match(verdict.message, /dataset/);
});

test('the same tree on both sides is a match, and says nothing alarming', () => {
  const verdict = provenanceVerdict(lockSide(writeLock(stampFor(BAKED))), boxSide(writeDataset(BAKED)));
  assert.equal(verdict.verdict, 'match');
  assert.match(verdict.message, /81bd9fb7658719db/);
});

test('★ the PHOTO payload is compared too — the two payloads version independently, both are provenance', () => {
  const lock = lockSide(writeLock({ ...stampFor(BAKED), photos: { version: 'deadbeefdeadbeef', totalBytes: 1 } }));
  const verdict = provenanceVerdict(lock, boxSide(writeDataset(BAKED)));
  assert.equal(verdict.verdict, 'diverged');
  assert.match(verdict.message, /deadbeefdeadbeef/);
  assert.match(verdict.message, new RegExp(PHOTOS));
});

test('a dataset of a DIFFERENT id is divergence even when the hashes are silent about it', () => {
  const dir = writeDataset(BAKED);
  writeFileSync(
    join(dir, POINTER_FILE),
    JSON.stringify({
      formatVersion: 1,
      id: 'outlet',
      name: 'other',
      baseUrl: 'https://example.invalid/x',
      catalog: { version: BAKED.catalog, count: 1, totalBytes: BAKED.bytes, files: ['catalog.json'] },
      photos: { version: PHOTOS, count: 1, totalBytes: 3627725256 },
    }),
  );
  const verdict = provenanceVerdict(lockSide(writeLock(stampFor(BAKED))), boxSide(dir));
  assert.equal(verdict.verdict, 'diverged');
  assert.match(verdict.message, /outlet/);
  assert.match(verdict.message, /demo/);
});

test('⛔ mounting NOTHING while the lock names a dataset is divergence, not silence', () => {
  // This is the same defect wearing its quietest face: step 9 would print "nothing to seed", exit 0, and the
  // box would be born with 2 790 products missing and BOXUP=0.
  const verdict = provenanceVerdict(lockSide(writeLock(stampFor(BAKED))), boxSide(''));
  assert.equal(verdict.verdict, 'diverged');
  assert.match(verdict.message, /81bd9fb7658719db/);
  assert.match(verdict.message, /FORGE_SEED_DATASET_HOST_DIR/);
});

test('⛔ a directory that declares no dataset is refused BY NAME, not read as an empty one', () => {
  const dir = join(scratchDir(), 'not-a-dataset');
  mkdirSync(dir, { recursive: true });
  const verdict = provenanceVerdict(lockSide(writeLock(stampFor(BAKED))), boxSide(dir));
  assert.equal(verdict.verdict, 'diverged');
  assert.match(verdict.message, new RegExp(POINTER_FILE));
  assert.match(verdict.message, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('★ a lock that RECORDS NO dataset cannot be compared — and that is a note, never a refusal', () => {
  // A `forge.lock` downloaded from a promoted release legitimately says nothing about anybody's example data.
  // Refusing there would teach an operator to delete the check; saying what is missing teaches them to re-bake.
  const verdict = provenanceVerdict(lockSide(writeLock(undefined)), boxSide(writeDataset(MOUNTED)));
  assert.equal(verdict.verdict, 'uncomparable');
  assert.match(verdict.message, /c51b5e4b49324fa9/, 'it still names what the box mounts');
  assert.match(verdict.message, /build-local\.sh/, 'and how the lock gets a stamp');
});

test('a lock that records `dataset: null` is an ANSWER — "built with none" — and disagrees with a mount', () => {
  const verdict = provenanceVerdict(lockSide(writeLock(null)), boxSide(writeDataset(MOUNTED)));
  assert.equal(verdict.verdict, 'diverged');
  assert.match(verdict.message, /c51b5e4b49324fa9/);
});

test('neither side has one → match: a box that wants no example data is a supported box', () => {
  assert.equal(provenanceVerdict(lockSide(writeLock(null)), boxSide('')).verdict, 'match');
});

test('★★ THIS repo — `forge.lock` carries a dataset stamp, and `bin/build-local.sh` is what writes it', () => {
  // Anti-vacuity in the other direction: every assertion above passes on a lock with no stamp at all, so the
  // committed lock is graded here. If a re-bake ever stops recording it, the check above degrades to a note
  // and the class comes back silently.
  const side = lockSide(join(ROOT, 'forge.lock'));
  assert.equal(side.state, 'recorded', 'forge.lock records no `dataset` — re-run bin/build-local.sh');
  assert.match(side.stamp.catalog.version, /^[0-9a-f]{16}$/);
  assert.match(side.stamp.photos.version, /^[0-9a-f]{16}$/);
});

// ── THE HALF THE BRIEF WARNED ABOUT: a comparison is only worth what the stamp is worth ────────────────────
// (b) — compare rather than bake — "is a guard that depends on somebody stamping the provenance correctly".
// The stamp itself is machine-written (`pnpm pack:dataset`), so nobody types it. But NOTHING upstream keeps it
// in step with the bytes: `instances/demo/README.md` states the order of the day ("write the dataset →
// check:dataset → pack:dataset → mount") and no test enforces it. An edit to `catalog.json` without a re-pack
// leaves a stamp that names a tree that no longer exists — and the comparison above would call it a match.
//
// So the pointer is graded against its own directory first. `catalog.totalBytes` is EXACTLY the sum of the
// files the pointer lists (measured on the baked tree: 41 552 643 on both sides, delta 0), which makes this a
// 26-stat question. It does NOT re-derive the content hash — that algorithm lives in the platform and
// re-implementing it here would be a second source of one fact.

test('★★ a dataset EDITED after it was packed is refused as STALE — the stamp names a tree that is gone', () => {
  const dir = writeDataset(BAKED);
  writeFileSync(join(dir, 'catalog.json'), 'x'.repeat(BAKED.bytes + 40)); // a hand edit, no re-pack
  const side = boxSide(dir);
  assert.equal(side.state, 'stale');
  const verdict = provenanceVerdict(lockSide(writeLock(stampFor(BAKED))), side);
  assert.equal(verdict.verdict, 'diverged');
  assert.match(verdict.message, new RegExp(String(BAKED.bytes)), 'it names what the pointer DECLARES');
  assert.match(verdict.message, new RegExp(String(BAKED.bytes + 40)), 'and what the directory HOLDS');
  assert.match(verdict.message, /pack:dataset/, 'and the command that would make them agree');
});

test('a dataset MISSING a file the pointer lists is stale too, and the file is named', () => {
  const dir = writeDataset(BAKED);
  rmSync(join(dir, 'catalog.json'));
  const side = boxSide(dir);
  assert.equal(side.state, 'stale');
  assert.match(side.why, /catalog\.json/);
});

test('★ anti-vacuity — a dataset that agrees with its own pointer is NOT called stale', () => {
  // Without this, the assertion above passes for a `boxSide` that calls everything stale.
  assert.equal(boxSide(writeDataset(BAKED)).state, 'mounted');
});
