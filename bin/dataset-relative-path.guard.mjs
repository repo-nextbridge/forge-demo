// ★★ DX-I1 — A RELATIVE DATASET PATH MAY NOT KILL THE BIRTH.
//
// ⛔ MEASURED 2026-10-10 (RESULTADOS-dx0 N1): a clean clone that followed README §2 literally — `cp .env.example
// .env`, untouched — died at step 11 after 35 minutes with
//
//     ENOENT …/seed/photos/seed/dataset/assets/banners/banner-grande-jordan.jpg
//
// `.env.example` says `FORGE_SEED_DATASET_HOST_DIR=./seed/dataset`; `host_node` handed that RELATIVE value to the
// seeder as `FORGE_SEED_DATASET_DIR`; `seed/vitrine.mjs` built its art dir from it; `resolveMediaFile` joined a
// relative path; and `bin/seed.mjs::upload()` reads anything not starting with `/` as a bare name under
// `seed/photos/`. It only bites on a box's FIRST birth, when the banner is not yet in the media library — so
// every bench that had already been born once stayed green over it.
//
// The fix lives in `bin/box-up.sh::host_node`, which now resolves a relative host sibling against the repository
// (how compose reads the same value). This guard drives THAT function — lifted out of the script, not copied —
// with `.env.example`'s LITERAL values, from a cwd that is NOT the repository, and asks the path step 11 would
// upload for every banner, icon and strip the dataset's manifest names: each must be an existing file.
//
// Sabotage, proven when this was written: deleting the `case "$value" in ''|/*) …` line in `host_node` turns the
// first test red, naming `…/seed/photos/seed/dataset/assets/banners/banner-…jpg`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOX_UP = join(ROOT, 'bin/box-up.sh');
const stripComments = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// What step 11 does with a media key, end to end on the host side: the dataset dir it was GIVEN, the art dir
// `seed/vitrine.mjs` composes from it, `resolveMediaFile`, and then `upload()`'s own rule for "path or bare
// name" (pinned against bin/seed.mjs's code by the last test, so this copy cannot drift silently).
const PROBE = `
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogArtDir, datasetDir, resolveMediaFile } from ${JSON.stringify(pathToFileURL(join(ROOT, 'seed/forge.mjs')).href)};
const SEED = ${JSON.stringify(join(ROOT, 'seed'))};
const dir = datasetDir();
const artDir = catalogArtDir(dir);
// The manifest is read from the tracked tree, on purpose: the question is where the FILES resolve, and a red
// that only said "no manifest" would not name the file the birth dies on.
const manifest = JSON.parse(readFileSync(${JSON.stringify(join(ROOT, 'seed/dataset/assets/catalog/catalog-manifest.json'))}, 'utf8'));
const keys = [];
for (const [name, b] of Object.entries(manifest.banners ?? {})) {
  keys.push('banner-' + name + '.jpg');
  if (b.mobile) keys.push('banner-' + name + '-M.jpg');
}
for (const handle of Object.keys(manifest.icons ?? {})) keys.push('category-' + handle + '-icon.png');
for (const name of Object.keys(manifest.categoryBanners ?? {})) keys.push('category-banner-' + name + '.jpg');
const missing = [];
for (const key of keys) {
  const file = resolveMediaFile(key, { manifest, artDir, photoDir: artDir });
  if (!file) { missing.push(key + ' -> (manifest names no file)'); continue; }
  const path = file.startsWith('/') ? file : join(SEED, 'photos', file);
  if (!existsSync(path)) missing.push(key + ' -> ' + path);
}
console.log(JSON.stringify({ cwd: process.cwd(), given: dir, hostDir: process.env.FORGE_SEED_DATASET_HOST_DIR, checked: keys.length, missing }));
`;

function step11Paths({ hostDirOverride } = {}) {
  const work = mkdtempSync(join(tmpdir(), 'dx-i1-'));
  try {
    writeFileSync(join(work, 'probe.mjs'), PROBE);
    const script = `
set -uo pipefail
set -a; . ${JSON.stringify(join(ROOT, '.env.example'))}; set +a
${hostDirOverride ? `export FORGE_SEED_DATASET_HOST_DIR=${JSON.stringify(hostDirOverride)}` : ''}
HERE=${JSON.stringify(ROOT)}
note() { :; }
die() { printf 'DIE %s\\n' "$*" >&2; exit 9; }
source <(grep -m1 '^CONTAINER_PATH_VARS=' ${JSON.stringify(BOX_UP)})
source <(sed -n '/^host_node() {/,/^}/p' ${JSON.stringify(BOX_UP)})
type host_node >/dev/null || { echo 'host_node was not lifted out of bin/box-up.sh' >&2; exit 8; }
cd ${JSON.stringify(work)}
host_node ${JSON.stringify(join(work, 'probe.mjs'))}
`;
    const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', cwd: work });
    assert.equal(r.status, 0, `the probe did not run (rc ${r.status}):\n${r.stdout}${r.stderr}`);
    return JSON.parse(r.stdout.trim().split('\n').pop());
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

test("★★★ .env.example's LITERAL relative dataset path resolves, from a foreign cwd, to files that exist", () => {
  const envExample = readFileSync(join(ROOT, '.env.example'), 'utf8');
  const literal = /^FORGE_SEED_DATASET_HOST_DIR=(.*)$/m.exec(envExample)?.[1];
  assert.ok(literal && !literal.startsWith('/'), `.env.example no longer ships a RELATIVE dataset path (${literal}); this guard grades the relative case and would be vacuous`);
  const out = step11Paths();
  assert.notEqual(out.cwd, ROOT, 'the probe ran from the repository root, which is the case that hides the defect');
  assert.ok(out.checked >= 8, `only ${out.checked} media key(s) were checked — the manifest no longer names the banners?`);
  assert.deepEqual(out.missing, [], `step 11 would upload file(s) that do not exist (dataset dir given: ${out.given}):\n  ${out.missing.join('\n  ')}`);
  assert.equal(out.given, join(ROOT, literal.replace(/^\.\//, '')), 'the host process was not given the repository-relative dataset dir');
});

test('★★ the HOST_DIR itself reaches the process UNCHANGED — compose and dataset-provenance read it as written', () => {
  const out = step11Paths();
  assert.equal(out.hostDir, './seed/dataset');
});

test('★ negative control: an ABSOLUTE dataset path passes through untouched and still resolves', () => {
  const abs = join(ROOT, 'seed/dataset');
  const out = step11Paths({ hostDirOverride: abs });
  assert.equal(out.given, abs);
  assert.deepEqual(out.missing, []);
});

test("the probe's copy of upload()'s path rule is still bin/seed.mjs's own (code, comments stripped)", () => {
  const code = stripComments(readFileSync(join(ROOT, 'bin/seed.mjs'), 'utf8'));
  assert.match(code, /const path = file\.startsWith\('\/'\) \? file : join\(SEED, dir, file\);/);
});
