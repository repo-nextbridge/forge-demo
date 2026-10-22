// ⛔ `.env.example` HAS TO SURVIVE `source`, AND ONE LINE PROVED IT DID NOT.
//
//   node --test bin/env-example-sourceable.guard.mjs        (or: bash bin/test.sh)
//
// THE DEFECT, MEASURED 2026-09-18. `FORGE_ADMIN_SEED_NAME=Marina Alves` — a value with a space and no
// quotes. Every script in this repository that reads the box's configuration does it with `set -a; . ./.env`,
// and bash then reads the second word as a COMMAND:
//
//     <this box>/.env: line 117: Alves: command not found
//
// ⚠️ IT IS NOT FATAL, AND THAT IS THE WHOLE PROBLEM. The variable still ends up holding `Marina`, the script
// carries on, and the birth goes green. What it costs is not correctness, it is SIGNAL: an operator who runs
// a gesture and sees a `command not found` scrolling past learns to ignore that line — and the next one,
// which is a real failure, scrolls past the same way. A file that is sourced must be sourceable in silence.
//
// ★ THE RULE IS ABOUT THE EXAMPLE, NOT ABOUT `.env`. The `.env` of a box is written by a human and by
// `bin/deploy.sh`; the EXAMPLE is what every new box is copied from, so a defect here is a defect that
// arrives pre-installed in every instance that follows the README.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = join(ROOT, '.env.example');

/** Assignments whose value carries whitespace and is not quoted — the shape bash splits into words. */
function unquotedWithSpaces() {
  return readFileSync(EXAMPLE, 'utf8')
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => /^[A-Z_][A-Z0-9_]*=/.test(line))
    .filter(({ line }) => {
      const value = line.slice(line.indexOf('=') + 1);
      if (value.startsWith("'") || value.startsWith('"')) return false;
      return /\s/.test(value.trimEnd()) && value.trim() !== '';
    })
    .map(({ line, n }) => `${n}: ${line}`);
}

test('★★★ every value with a space is QUOTED — the file is sourced, and bash splits on words', () => {
  assert.deepEqual(
    unquotedWithSpaces(),
    [],
    'these lines carry a space in an unquoted value. `set -a; . ./.env` reads the second word as a command\n' +
      '     and prints "command not found" — not fatal, which is worse: it teaches an operator to ignore the\n' +
      '     one line that will matter. Wrap the value in single quotes.',
  );
});

test("★★★ …and the file really IS sourceable — asked of bash, not of a regex", () => {
  // The rule above is a pattern; this is the thing itself. A quoting mistake the regex has not learned yet
  // still shows up here, because bash is the reader this file exists to satisfy.
  const out = execFileSync('bash', ['-c', `set -a; . ${JSON.stringify(EXAMPLE)}; set +a`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(out.trim(), '', `sourcing .env.example printed something, and it must print nothing:\n${out}`);
});

test('⛔ ANTI-VACUUM — the file was really read, and it really declares variables', () => {
  const declared = readFileSync(EXAMPLE, 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l));
  assert.ok(
    declared.length > 30,
    `.env.example declares ${declared.length} variable(s) — the walk broke or the file shrank, and the rules ` +
      'above would be judging almost nothing',
  );
});

// ── ★★ v0.3.4 — AND A BOX'S OWN `.env` IS HELD TO THE SAME RULE, BY env-source.sh AND BY THE DEPLOY ──────────
//
// The template's v0.3.4 `env-source.sh` FAILS on a `.env` with an unquoted value with a space, naming the line and
// the variable, never the value. This box's `env-source.sh` takes the template's scan as is, and `bin/deploy.sh`
// runs the same pattern over the `.env` it assembles, BEFORE delivering — so a `deploy/*.env` line of that shape
// is refused on the laptop instead of stopping every compose command on the box. Graded by running them.
const SCAN = /grep -nE '(\^\[\[:space:\]\]\*\(export[^']*)'/;

function sourceEnv(envText) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-env-shell-'));
  try {
    cpSync(join(ROOT, 'env-source.sh'), join(dir, 'env-source.sh'));
    writeFileSync(join(dir, '.env'), envText);
    const r = spawnSync('bash', ['-c', `. ${JSON.stringify(join(dir, 'env-source.sh'))}; echo "rc=$?"`], { encoding: 'utf8' });
    return `${r.stdout}${r.stderr}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('⛔ SABOTAGE — env-source.sh REFUSES a .env with an unquoted value with a space, naming line and NAME, never the value', () => {
  const out = sourceEnv('FORGE_A=1\nFORGE_REF_STORE_NAME=Forge Cafezinho\n');
  assert.match(out, /rc=1/, out);
  assert.match(out, /unquoted value with a space: line 2 \(FORGE_REF_STORE_NAME\)/, out);
  assert.doesNotMatch(out, /Cafezinho/, `the refusal printed the value:\n${out}`);
});

test('★ CONTROL — the same value QUOTED passes the scan (the source goes on, to the secrets it then asks for)', () => {
  const out = sourceEnv('FORGE_A=1\nFORGE_REF_STORE_NAME="Forge Cafezinho"\nFORGE_B=x # a comment is not a second word\n');
  assert.doesNotMatch(out, /unquoted value with a space/, out);
  assert.match(out, /missing required secret 'forge-postgres-password'/, `the control did not reach the step after the scan:\n${out}`);
});

test('★★ bin/deploy.sh scans the .env it assembles with THE SAME pattern, and refuses before anything is sent', () => {
  const ours = readFileSync(join(ROOT, 'env-source.sh'), 'utf8').match(SCAN);
  const deploy = readFileSync(join(ROOT, 'bin', 'deploy.sh'), 'utf8');
  const theirs = deploy.match(SCAN);
  assert.ok(ours && theirs, 'the scan pattern is not found in env-source.sh and bin/deploy.sh');
  assert.equal(theirs[1], ours[1], 'bin/deploy.sh and env-source.sh scan with different patterns — the deploy would pass a .env the box refuses');
  const scan = deploy.indexOf(theirs[0]);
  const deliver = deploy.search(/^tar -C "\$HERE" -czf - "\$\{DELIVER\[@\]\}"/m);
  assert.ok(scan > -1 && deliver > scan, 'the deploy scans the .env after the delivery — it must refuse before it');
});
