// ★ MZ-DEMO (2026-10-22) — THE BAKE SAYS WHERE THE IMAGES WENT ONCE, NOT TWICE.
//
//   node --test bin/bake-where.guard.mjs        (or: bash bin/test.sh)
//
// `bin/bake.sh` ended its run with `${registry:+in $registry}${registry:-ONLY in this daemon …}`. The second
// expansion is "$registry when it is set", so with `--registry` both halves printed and bake.yml's log of
// 2026-10-22 read `[bake] wrote … in ghcr.io/repo-nextbridgeghcr.io/repo-nextbridge`. What is graded here,
// without docker: the block between `# >>> WHERE THE IMAGES LIVE` markers is RUN with and without a registry,
// and the closing `say` must use what it computed. Put the old expression back into the block and the first
// test is red (sabotage in RESULTADOS-demo.md).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = readFileSync(join(ROOT, 'bin', 'bake.sh'), 'utf8');
const codeOf = (shell) => shell.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

function block() {
  const m = SCRIPT.match(/# >>> WHERE THE IMAGES LIVE\n([\s\S]*?)# <<< WHERE THE IMAGES LIVE/);
  assert.ok(m, 'bin/bake.sh no longer marks WHERE THE IMAGES LIVE — this guard cannot run it');
  return codeOf(m[1]);
}

const whereWith = (registry) =>
  execFileSync('bash', ['-c', `set -euo pipefail\nregistry=${JSON.stringify(registry)}\n${block()}\nprintf '%s' "$where"`], {
    encoding: 'utf8',
  });

test('★ with --registry the registry is named ONCE', () => {
  assert.equal(whereWith('ghcr.io/repo-nextbridge'), 'in ghcr.io/repo-nextbridge');
});

test('★ without a registry it says the images live only in this daemon', () => {
  assert.match(whereWith(''), /^ONLY in this daemon \(no registry host/);
});

test('the closing line prints what the block computed, and nothing re-expands the registry with `:-`', () => {
  const code = codeOf(SCRIPT);
  assert.match(code, /^say "wrote .*mounted, \$where"$/m, 'the closing `say` of bin/bake.sh no longer prints $where');
  assert.ok(!code.includes('${registry:-'), '`${registry:-…}` is back — it expands to the registry when one is set');
});
