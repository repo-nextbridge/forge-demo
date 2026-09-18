// ⛔ `.env.example` HAS TO SURVIVE `source`, AND ONE LINE PROVED IT DID NOT.
//
//   node --test bin/env-example-sourceable.guard.mjs        (or: bash bin/test.sh)
//
// THE DEFECT, MEASURED 2026-09-18. `FORGE_ADMIN_SEED_NAME=Marina Alves` — a value with a space and no
// quotes. Every script in this repository that reads the box's configuration does it with `set -a; . ./.env`,
// and bash then reads the second word as a COMMAND:
//
//     /home/.../forge-demo/.env: line 117: Alves: command not found
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
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
