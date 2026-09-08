// ★★ THE RETRY LOOP ITSELF, DRIVEN AGAINST A `docker` THAT FAILS ON PURPOSE.
//
// `bin/registry-transient.test.mjs` proves the VERDICT; this proves the LOOP that acts on it, which is a
// different thing and the one that would rot in silence. A classifier nobody calls, a `PIPESTATUS` read from
// the wrong element, a ceiling that is off by one — none of those change a single verdict and all of them
// break the bake.
//
// So `docker` here is a five-line shell script on PATH that counts its own invocations in a file and decides
// what to print from that count. Nothing is mocked inside bash: `bin/docker-retry.sh` is SOURCED exactly as
// `bin/build-local.sh` sources it, and it runs its real `tee`, its real classifier subprocess and its real
// `sleep` (with the waits turned down, which is what those variables exist for).
//
//   node --test bin/docker-retry.test.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from './release-tree.mjs';

/** The two outputs, kept identical to the fixtures in `bin/registry-transient.test.mjs` in SHAPE — the
 *  point here is not the string, it is what the loop does with the verdict it produces. */
const TRANSIENT_500 =
  'ERROR: failed to build: failed to solve: node:24-slim: failed to resolve source metadata for ' +
  'docker.io/library/node:24-slim: unexpected status from HEAD request to ' +
  'https://registry-1.docker.io/v2/library/node/manifests/24-slim: 500 Internal Server Error';
const CONTENT_STEP_FAILED =
  'ERROR: failed to build: failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1';

/**
 * Run `docker_build_retry` with a fake `docker` that fails `failures` times with `body`, then succeeds.
 * @returns {{ code: number, stderr: string, calls: number }}
 */
function drive({ body, failures, attempts = 3 }) {
  const dir = mkdtempSync(join(tmpdir(), 'pk24-d2-retry-'));
  const counter = join(dir, 'calls');
  writeFileSync(counter, '');
  const fake = join(dir, 'docker');
  writeFileSync(
    fake,
    [
      '#!/usr/bin/env bash',
      `echo "call $*" >> "${counter}"`,
      `n=$(wc -l < "${counter}")`,
      `if [ "$n" -le ${failures} ]; then`,
      `  printf '%s\\n' ${JSON.stringify(body)} >&2`,
      '  exit 1',
      'fi',
      'echo "built"',
      'exit 0',
    ].join('\n'),
    { mode: 0o755 },
  );
  chmodSync(fake, 0o755);

  const script = [
    'set -uo pipefail',
    `. "${join(ROOT, 'bin', 'docker-retry.sh')}"`,
    'docker_build_retry -t probe:local .',
    'echo "exit=$?"',
  ].join('\n');

  // ⚠️ `spawnSync` AND NOT `execFileSync`: the interesting half of this test is what the loop SAYS, and it
  // says it on stderr — which `execFileSync` only hands back when the child fails. The first version of
  // this file passed its two red cases for exactly that reason and asserted against an empty string.
  const child = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      FORGE_DOCKER_RETRY_ATTEMPTS: String(attempts),
      // The waits exist so a pipeline can lower them; lowering them is exactly what a test is.
      FORGE_DOCKER_RETRY_WAITS: '0 0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const both = (child.stdout ?? '') + (child.stderr ?? '');
  // The function's own exit code, echoed by the script — the bash process itself always ends 0.
  const inner = /exit=(\d+)/.exec(both);
  return {
    code: inner ? Number(inner[1]) : (child.status ?? -1),
    stderr: both,
    calls: readFileSync(counter, 'utf8').split('\n').filter(Boolean).length,
  };
}

// ── ① a registry that blinks once and then answers — the caderno §B2 outage, in miniature ───────────────

test('★★ a TRANSITORY registry failure is repeated, and the bake CONCLUDES', () => {
  const run = drive({ body: TRANSIENT_500, failures: 1 });
  assert.equal(run.calls, 2, `docker should have been called twice, was called ${run.calls}\n${run.stderr}`);
  assert.equal(run.code, 0, `the bake must end green once the registry answers\n${run.stderr}`);
  // ⚠️ AND IT SAID SO. A silent retry hides a sick registry: the builds go green and nobody learns the
  // mirror has been failing one call in five.
  assert.match(run.stderr, /\[docker-retry\] attempt 1 of 3 failed/);
  assert.match(run.stderr, /5xx/);
  assert.match(run.stderr, /being repeated in 0s/);
});

// ── ② the half that makes it a decision and not `|| true` ───────────────────────────────────────────────

test('★★ a CONTENT failure is NOT repeated — one call, red on the spot', () => {
  const run = drive({ body: CONTENT_STEP_FAILED, failures: 1 });
  assert.equal(run.calls, 1, `a failed build step must never be repeated; docker ran ${run.calls}x\n${run.stderr}`);
  assert.notEqual(run.code, 0, 'the failure must reach the caller');
  assert.match(run.stderr, /\[docker-retry\] NOT retrying/);
  assert.match(run.stderr, /BUILD STEP/);
});

test('★ an unrecognised failure is not repeated either — silence is not permission', () => {
  const run = drive({ body: 'ERROR: failed to build: something nobody has written a rule for', failures: 1 });
  assert.equal(run.calls, 1, run.stderr);
  assert.notEqual(run.code, 0);
  assert.match(run.stderr, /NOT retrying/);
});

// ── ③ the ceiling, and the sentence that says which kind of red this was ────────────────────────────────

test('★★ a registry that never comes back is given up on, LOUDLY, at the ceiling', () => {
  const run = drive({ body: TRANSIENT_500, failures: 99, attempts: 3 });
  assert.equal(run.calls, 3, `the ceiling is 3 attempts, docker ran ${run.calls}x\n${run.stderr}`);
  assert.notEqual(run.code, 0, 'a build that never succeeded is still red — a retry is not `|| true`');
  assert.match(run.stderr, /GIVING UP after 3 attempt\(s\)/);
  // "we ran out of attempts" and "this was never going to work" are different sentences.
  assert.match(run.stderr, /points at the registry, not/);
});

test('a build that succeeds first time calls docker ONCE and says nothing', () => {
  const run = drive({ body: TRANSIENT_500, failures: 0 });
  assert.equal(run.calls, 1);
  assert.equal(run.code, 0);
  assert.doesNotMatch(run.stderr, /\[docker-retry\]/, 'a quiet path must stay quiet, or the noise stops being read');
});

// ── ④ the wiring, because a helper nobody calls is decoration ───────────────────────────────────────────

test('★★ every `docker build` of this repository goes through the retry', () => {
  // The anti-vacuum rule for this half: the loop above can be perfect and reach nothing. The subject is
  // derived — every script here that bakes an image — so a fifth bake script tomorrow is covered without
  // anybody remembering this file exists.
  const scripts = execFileSync('bash', ['-c', `grep -ln 'docker build\\|docker_build_retry' ${join(ROOT, 'bin')}/*.sh`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((path) => !path.endsWith('docker-retry.sh'));

  assert.ok(scripts.length > 0, 'no script in bin/ builds an image — this rule lost its subject');
  const bare = [];
  for (const path of scripts) {
    const source = readFileSync(path, 'utf8');
    // A commented line is prose, not a call. Only lines that would run are the subject.
    const runs = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .filter((line) => /(^|[^-\w])docker build\b/.test(line));
    if (runs.length > 0) bare.push(`${path}: ${runs.map((l) => l.trim()).join(' | ')}`);
  }
  assert.deepEqual(
    bare,
    [],
    'these call `docker build` directly, so a 500 from the registry fails their bake with no cause of its ' +
      `own. Source \`bin/docker-retry.sh\` and call \`docker_build_retry\`:\n  ${bare.join('\n  ')}`,
  );
});
