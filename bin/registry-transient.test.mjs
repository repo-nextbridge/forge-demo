// ★★ THE RETRY'S CONSCIENCE, TESTED ON WHAT DOCKER ACTUALLY PRINTS.
//
// A retry classifier is only as good as its fixtures, and a fixture somebody remembered is a fixture that
// argues with a version of buildkit nobody runs. So the four CONTENT cases below are verbatim output of
// four-line Dockerfiles built on this workstation on 2026-09-08 (docker buildkit, `docker build -f … .`),
// one per failure shape, and the commands that produced them are written above each one so the next person
// can reproduce rather than trust.
//
// The TRANSIENT side is measured where a bench can measure it — `connection refused` against a dead port is
// the same probe — and otherwise built from buildkit's own envelope, which those probes fixed exactly:
//
//     ERROR: failed to build: failed to solve: <ref>: failed to resolve source metadata for <ref>: <cause>
//
// with `<cause>` supplied by the registry client. The 500 case is the one from the caderno (§B2, 2026-09-07):
// Docker Hub answered 500 to the HEAD for `node:24-slim`, the admin image did not rebuild, and a human ran
// `docker pull` and repeated the command.
//
//   node --test bin/registry-transient.test.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { classify } from './registry-transient.mjs';
import { ROOT } from './release-tree.mjs';

// ── MEASURED: `FROM node:this-tag-does-not-exist-24` ─────────────────────────────────────────────────────
const TAG_DOES_NOT_EXIST = `
#2 [internal] load metadata for docker.io/library/node:this-tag-does-not-exist-24
#2 ERROR: docker.io/library/node:this-tag-does-not-exist-24: not found
------
 > [internal] load metadata for docker.io/library/node:this-tag-does-not-exist-24:
------
Dockerfile.notag:1
--------------------
   1 | >>> FROM node:this-tag-does-not-exist-24
--------------------
ERROR: failed to build: failed to solve: node:this-tag-does-not-exist-24: failed to resolve source metadata for docker.io/library/node:this-tag-does-not-exist-24: docker.io/library/node:this-tag-does-not-exist-24: not found
`;

// ── MEASURED: `FROM alpine:3` + `RUN exit 7` ────────────────────────────────────────────────────────────
const STEP_EXITED_NONZERO = `
#5 [2/2] RUN exit 7
#5 ERROR: process "/bin/sh -c exit 7" did not complete successfully: exit code: 7
------
 > [2/2] RUN exit 7:
------
Dockerfile.contentfail:2
--------------------
   2 | >>> RUN exit 7
--------------------
ERROR: failed to build: failed to solve: process "/bin/sh -c exit 7" did not complete successfully: exit code: 7
`;

// ── MEASURED: `FROM alpine:3` + `COPY missing-file /x` ──────────────────────────────────────────────────
const COPY_OF_NOTHING = `
#6 [2/2] COPY missing-file /x
#6 ERROR: failed to calculate checksum of ref ovdnld0jmzbncuz320yh6tfqf::arbulbightdfaz2w1zm9rs4a5: "/missing-file": not found
------
ERROR: failed to build: failed to solve: failed to compute cache key: failed to calculate checksum of ref ovdnld0jmzbncuz320yh6tfqf::arbulbightdfaz2w1zm9rs4a5: "/missing-file": not found
`;

// ── MEASURED: `FROM 127.0.0.1:1/nope:1` — nothing is listening on that port ─────────────────────────────
const NOTHING_LISTENING = `
#2 [internal] load metadata for 127.0.0.1:1/nope:1
#2 ERROR: failed to do request: Head "https://127.0.0.1:1/v2/nope/manifests/1": dial tcp 127.0.0.1:1: connect: connection refused
------
ERROR: failed to build: failed to solve: 127.0.0.1:1/nope:1: failed to resolve source metadata for 127.0.0.1:1/nope:1: failed to do request: Head "https://127.0.0.1:1/v2/nope/manifests/1": dial tcp 127.0.0.1:1: connect: connection refused
`;

// ── THE ONE FROM THE CADERNO (§B2, 2026-09-07): Docker Hub answered 500 to the HEAD for `node:24-slim` ──
const HUB_ANSWERED_500 = `
#2 [internal] load metadata for docker.io/library/node:24-slim
#2 ERROR: unexpected status from HEAD request to https://registry-1.docker.io/v2/library/node/manifests/24-slim: 500 Internal Server Error
------
ERROR: failed to build: failed to solve: node:24-slim: failed to resolve source metadata for docker.io/library/node:24-slim: unexpected status from HEAD request to https://registry-1.docker.io/v2/library/node/manifests/24-slim: 500 Internal Server Error
`;

const RATE_LIMITED = `
ERROR: failed to build: failed to solve: node:24-slim: failed to resolve source metadata for docker.io/library/node:24-slim: failed to copy: httpReadSeeker: failed open: unexpected status code https://registry-1.docker.io/v2/library/node/blobs/sha256-abc: 429 Too Many Requests - Server message: toomanyrequests: You have reached your pull rate limit.
`;

const TLS_TIMED_OUT = `
ERROR: failed to build: failed to solve: node:24-slim: failed to resolve source metadata for docker.io/library/node:24-slim: failed to do request: Head "https://registry-1.docker.io/v2/library/node/manifests/24-slim": net/http: TLS handshake timeout
`;

const UNAUTHORIZED = `
ERROR: failed to build: failed to solve: ghcr.io/acme/private:1: failed to resolve source metadata for ghcr.io/acme/private:1: failed to authorize: failed to fetch anonymous token: unexpected status from GET request to https://ghcr.io/token: 401 Unauthorized
`;

// ── ① the failure that repeats itself into a green — the one this file exists to refuse ─────────────────

test('★★ a failure INSIDE a build step is never transient, whatever else the output says', () => {
  assert.equal(classify(STEP_EXITED_NONZERO).transient, false);
  assert.equal(classify(COPY_OF_NOTHING).transient, false);

  // ⚠️ AND IT WINS OVER A TRANSIENT MARKER IN THE SAME RUN. A multi-stage build can hit a sick registry in
  // one stage and a real defect in another; retrying that one repeats the defect until it passes by luck.
  // This is the rule that makes "prefer to fail" a property of the code and not of the comment.
  const both = `${HUB_ANSWERED_500}\n${STEP_EXITED_NONZERO}`;
  const verdict = classify(both);
  assert.equal(verdict.transient, false, `a step failure alongside a 500 must NOT be retried:\n${verdict.reason}`);
  assert.match(verdict.reason, /BUILD STEP/);
});

// ── ② the registry answering correctly — repeating the question gets the same answer ────────────────────

test('★ a tag that does not exist is the registry being RIGHT, and is refused on the first answer', () => {
  const verdict = classify(TAG_DOES_NOT_EXIST);
  assert.equal(verdict.transient, false, verdict.reason);
  assert.match(verdict.reason, /registry ANSWERED/);
});

test('★ 401/unauthorized is a credential, not weather', () => {
  assert.equal(classify(UNAUTHORIZED).transient, false);
});

// ── ③ the ones worth a ceiling ──────────────────────────────────────────────────────────────────────────

test('★★ Docker Hub answering 500 to a HEAD — the caderno §B2 failure — IS transient', () => {
  const verdict = classify(HUB_ANSWERED_500);
  assert.equal(verdict.transient, true, verdict.reason);
  assert.match(verdict.reason, /5xx/);
});

test('★ rate limiting, a TLS timeout and a refused connection are transient', () => {
  assert.equal(classify(RATE_LIMITED).transient, true);
  assert.equal(classify(TLS_TIMED_OUT).transient, true);
  assert.equal(classify(NOTHING_LISTENING).transient, true);
});

// ── ④ the default, which is the half that keeps this honest ─────────────────────────────────────────────

test('★★ an output with no marker this file knows is NOT transient — silence is not permission', () => {
  assert.equal(classify('ERROR: failed to build: failed to solve: something nobody has seen yet').transient, false);
  assert.equal(classify('').transient, false);
  assert.equal(classify(undefined).transient, false);
});

test('every verdict carries a reason — a retry that cannot say why hides a sick registry', () => {
  for (const output of [TAG_DOES_NOT_EXIST, STEP_EXITED_NONZERO, HUB_ANSWERED_500, RATE_LIMITED, '']) {
    const { reason } = classify(output);
    assert.equal(typeof reason, 'string');
    assert.ok(reason.length > 20, `a one-word reason is not a sentence an operator can act on: ${reason}`);
  }
});

// ── ⑤ the door the SHELL uses, exercised as the shell uses it ───────────────────────────────────────────

test("★★ the CLI's exit code is the verdict — this is the only thing `bin/docker-retry.sh` reads", () => {
  const dir = mkdtempSync(join(tmpdir(), 'pk24-d2-'));
  const cli = join(ROOT, 'bin', 'registry-transient.mjs');
  const run = (name, body) => {
    const file = join(dir, name);
    writeFileSync(file, body);
    try {
      const stdout = execFileSync(process.execPath, [cli, file], { encoding: 'utf8' });
      return { code: 0, stdout };
    } catch (error) {
      return { code: error.status, stdout: error.stdout ?? '' };
    }
  };

  const transient = run('hub500.txt', HUB_ANSWERED_500);
  assert.equal(transient.code, 0, 'a transient failure must exit 0 so the shell repeats it');
  assert.match(transient.stdout, /5xx/, 'the reason goes to stdout for the shell to echo');

  const content = run('step.txt', STEP_EXITED_NONZERO);
  assert.equal(content.code, 1, 'a content failure must exit non-zero so the shell gives up NOW');
  assert.match(content.stdout, /BUILD STEP/);

  // A missing file is neither verdict: exit 2, so a broken call site cannot read as "not transient" and
  // quietly lose the retry.
  let missing;
  try {
    execFileSync(process.execPath, [cli, join(dir, 'nothing-here.txt')], { encoding: 'utf8', stdio: 'pipe' });
    missing = 0;
  } catch (error) {
    missing = error.status;
  }
  assert.equal(missing, 2);
});

test('importing this module does NOT run its CLI — a suite that exits mid-run proves nothing', () => {
  // The import at the top of this file already happened. If the entry-point test were a suffix match on the
  // URL rather than a realpath comparison, `node --test bin/registry-transient.test.mjs` would have exited
  // before reaching here. Reaching here IS the assertion, and it is written down so nobody deletes it.
  assert.ok(true);
});
