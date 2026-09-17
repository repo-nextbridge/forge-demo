// ★★★ THE SEED'S PUT CARRIES EVERY HEADER THE PORT SIGNED — dropping one is a 403 nothing else catches.
//
//   node --test bin/seed-upload.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT HAPPENED, MEASURED 2026-09-17 ─────────────────────────────────────────────────────────────────────
//
// `media.request_upload` answers `{provider_key, upload_url, headers}` — `apps/api/src/media-adapter.ts`
// composes the third field out of what the connector SIGNED. A bucket driver signs `cache-control;host`, so
// a PUT that omits Cache-Control presents a signature for a request nobody made. R2 answers
// `403 SignatureDoesNotMatch`, and the first photograph of the first bucket this box ever wrote to is where
// it says so.
//
// ⛔ AND NOTHING WAS RED FOR AS LONG AS THE BUG EXISTED, WHICH IS THE POINT OF THIS FILE. The `local`
// driver's upload_url points back at the kernel's own route: it signs nothing, so it misses nothing. Every
// birth this repository has ever run — every bench, every CI lane — ran on that driver. The defect was not
// rare; it was UNREACHABLE, until the day a bucket arrived.
//
// ⇒ SO THE RULE IS ABOUT THE SHAPE AND NOT ABOUT ONE HEADER NAME. `cache-control` is what today's two bucket
// drivers sign. A guard that demanded that word would be a guard about R2, and would stay green the day a
// driver signs `x-amz-storage-class` instead. What must hold is that whatever the port SAYS it signed is
// what the PUT SENDS.
//
// ── WHY IT READS THE SOURCE ────────────────────────────────────────────────────────────────────────────────
//
// `bin/seed.mjs` is a script with top-level effects, not a module: there is no uploader to import and call.
// The honest options were to read the source or to stand up a fake port and a fake edge and run a whole seed
// against them — which would grade a hundred other things and report this one as "the seed failed". So this
// reads the source, and it pays for that choice with the CONTROL NEGATIVE below: the same check is run
// against a copy of the file with the fix removed, and it has to go RED there. A source check that cannot
// fail is a comment.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = readFileSync(join(HERE, 'bin', 'seed.mjs'), 'utf8');

/** The PUT that places the bytes: the one `fetch` in this file whose method is PUT. */
function uploadCall(source) {
  const i = source.indexOf("method: 'PUT'");
  assert.notEqual(i, -1, 'bin/seed.mjs no longer contains a PUT — this guard is about one that does');
  const start = source.lastIndexOf('fetch(', i);
  const end = source.indexOf('});', i);
  return source.slice(start, end);
}

/** Does the PUT forward what the port answered, rather than a header list typed here? */
function forwardsSignedHeaders(source) {
  const call = uploadCall(source);
  // The name is derived, not assumed: whatever variable is assigned from `plan.headers` is the one that has
  // to appear, spread, inside the PUT's headers object.
  const assigned = source.match(/const\s+(\w+)\s*=\s*plan\.headers\b/);
  if (!assigned) return false;
  return new RegExp(`headers:\\s*\\{[^}]*\\.\\.\\.${assigned[1]}\\b`).test(call);
}

describe('★★★ the bytes arrive carrying what the port signed', () => {
  test('the PUT spreads the headers `media.request_upload` answered with', () => {
    assert.ok(
      forwardsSignedHeaders(SEED),
      'the upload PUT does not forward the port\'s `headers`. A bucket driver signs headers (today:\n' +
        'cache-control), and a PUT that omits one presents a signature for a request that was never made —\n' +
        '403 SignatureDoesNotMatch, on the first photograph, with no clue in it.',
    );
  });

  test('★ CONTROL NEGATIVE — the same check goes RED on a copy with the forwarding removed', () => {
    const sabotaged = SEED.replace(/headers:\s*\{([^}]*)\.\.\.\w+,?\s*\}/, 'headers: {$1}');
    assert.notEqual(sabotaged, SEED, 'the sabotage did not change the file — the check below proves nothing');
    assert.equal(
      forwardsSignedHeaders(sabotaged),
      false,
      'the check passes on a file with the forwarding removed, so it is not measuring the forwarding',
    );
  });

  test('★★ a refusal reports the store\'s own words, not only the number', () => {
    const near = SEED.slice(SEED.indexOf("method: 'PUT'"), SEED.indexOf("method: 'PUT'") + 1400);
    assert.match(
      near,
      /put\.text\(\)/,
      'the PUT failure path does not read the response body. Every refusal an object store issues is a 403 —\n' +
        'a wrong key, a key with no write, a missing bucket and a signature over a different request are the\n' +
        'same three digits. Only the body tells them apart, and this one cost an hour of a birth.',
    );
  });
});
