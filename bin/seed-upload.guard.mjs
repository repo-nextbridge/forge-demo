// ★★★ EVERY UPLOADER IN THIS REPOSITORY CARRIES WHAT THE PORT SIGNED — dropping one is a 403 nothing else
// catches, and there is MORE THAN ONE UPLOADER.
//
//   node --test bin/seed-upload.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT HAPPENED, MEASURED 2026-09-17, TWICE ──────────────────────────────────────────────────────────────
//
// `media.request_upload` answers `{provider_key, upload_url, headers}` — `apps/api/src/media-adapter.ts`
// composes the third field out of what the connector SIGNED. A bucket driver signs `cache-control;host`, so
// a PUT that omits Cache-Control presents a signature for a request nobody made. R2 answers
// `403 SignatureDoesNotMatch`.
//
// ⛔ AND NOTHING WAS RED FOR AS LONG AS THE BUG EXISTED, WHICH IS THE POINT OF THIS FILE. The `local`
// driver's upload_url points back at the kernel's own route: it signs nothing, so it misses nothing. Every
// birth this repository had ever run used that driver. The defect was not rare; it was UNREACHABLE, until
// the day a bucket arrived.
//
// ⛔⛔ AND THE FIRST VERSION OF THIS GUARD NAMED **ONE FILE**, WHICH IS WHY IT IS WRITTEN THIS WAY NOW.
// `bin/seed.mjs` was repaired and graded green; four hours later the production box failed on its first
// banner, because `seed/outlet.mjs` holds a SECOND uploader and the guard could not see it. A rule about a
// repository, written about a path, is a rule with exactly as many holes as it has copies.
//
// ⇒ THE LIST IS DERIVED. Any tracked script that reads an `upload_url` out of a plan is an uploader and is
// graded — the third one costs no edit here. And the rule is about the SHAPE, not a header name: `cache-
// control` is what today's two bucket drivers sign, and a guard demanding that word would be a guard about
// R2 that stayed green the day a driver signs something else. What must hold is that whatever the port SAYS
// it signed is what the PUT SENDS.
//
// ── WHY IT READS SOURCE, AND WHAT IT PAYS FOR THAT ─────────────────────────────────────────────────────────
//
// These are scripts with top-level effects, not modules: there is no uploader to import and call. The honest
// alternative was to stand up a fake port and a fake edge and run whole seeds against them, which would
// grade a hundred other things and report this one as "the seed failed". So it reads source, and pays with
// the CONTROL NEGATIVE below: each file is re-checked with its forwarding removed and has to go RED. A
// source check that cannot fail is a comment.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'bin/seed-upload.guard.mjs';

/** Every tracked script that places bytes through a signed URL. Derived from the tree, never typed. */
function uploaders() {
  const tracked = execFileSync('git', ['ls-files', '*.mjs', '*.js'], { cwd: HERE, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((p) => p !== SELF && !p.includes('node_modules/'));
  return tracked
    .map((path) => ({ path, source: readFileSync(join(HERE, path), 'utf8') }))
    .filter(({ source }) => /\bupload_url\b/.test(source) && /method:\s*'PUT'/.test(source));
}

/** The PUT that places the bytes, as text: the fetch call around `method: 'PUT'`. */
function uploadCall(source) {
  const i = source.indexOf("method: 'PUT'");
  const start = source.lastIndexOf('fetch(', i);
  const end = source.indexOf('});', i);
  return source.slice(start === -1 ? i : start, end === -1 ? source.length : end);
}

/** Does the PUT forward what the port answered, rather than a header list typed at the call site?
 *
 * ⛔ THE DERIVATION READS FROM THE PUT OUTWARDS, and it used to read the other way — measured 2026-09-18.
 *
 * It used to find the FIRST `const <name> = <x>.headers` in the file and then look for that name spread
 * inside the PUT. That worked only while no other line in the file read a `.headers` off anything, and the
 * day `seed/outlet.mjs` grew a `const length = res.headers.get('content-length')` — a RESPONSE header, in a
 * completely unrelated HEAD request — the guard picked `length`, looked for `...length` inside the PUT, and
 * went red about a file whose forwarding had not changed at all.
 *
 * ⚠️ AND IT WAS ALREADY FRAGILE, WHICH IS THE PART WORTH KEEPING IN MIND: `bin/seed.mjs` has carried
 * `const after = Number(res.headers.get('retry-after'))` for a long time and never tripped it — only because
 * `Number(` sits between the `=` and the `.headers`. The rule was surviving on the shape of an unrelated
 * line. A guard that depends on what ELSE a file happens to contain is a guard that goes red on innocent
 * work, and the cost of that is worse than a miss: it teaches people to edit the guard.
 *
 * So the question is asked from the thing under test: find what the PUT SPREADS into its headers, then ask
 * whether THAT name was assigned from somebody's `.headers`. Same rule, read from the other end, and immune
 * to every `.headers` the rest of the file may legitimately touch. */
function forwardsSignedHeaders(source) {
  const put = uploadCall(source);
  const spread = put.match(/headers:\s*\{[^}]*\.\.\.(\w+)\b/);
  if (!spread) return false;
  return new RegExp(`const\\s+${spread[1]}\\s*=\\s*[^;]*\\.headers\\b`).test(source);
}

const FILES = uploaders();

describe('★★★ the bytes arrive carrying what the port signed', () => {
  test('★★ ANTI-VACUUM — there is at least one uploader, and the list was derived from the tree', () => {
    assert.ok(
      FILES.length > 0,
      'no tracked script reads an `upload_url` and PUTs to it. Either the uploaders moved (fix the\n' +
        'derivation above) or this guard is now grading nothing while reporting green.',
    );
    // Recorded so a run says how much it looked at. Two on 2026-09-17: bin/seed.mjs and seed/outlet.mjs.
    console.log(`[seed-upload] graded ${FILES.length} uploader(s): ${FILES.map((f) => f.path).join(', ')}`);
  });

  for (const { path, source } of FILES) {
    test(`${path} spreads the headers \`media.request_upload\` answered with`, () => {
      assert.ok(
        forwardsSignedHeaders(source),
        `${path}: the upload PUT does not forward the port's \`headers\`. A bucket driver signs headers\n` +
          '(today: cache-control), and a PUT that omits one presents a signature for a request that was\n' +
          'never made — 403 SignatureDoesNotMatch, on the first photograph, with no clue in it.',
      );
    });

    test(`★ CONTROL NEGATIVE — the check goes RED on ${path} with the forwarding removed`, () => {
      const sabotaged = source.replace(/headers:\s*\{([^}]*)\.\.\.\w+,?\s*\}/, 'headers: {$1}');
      assert.notEqual(sabotaged, source, `the sabotage did not change ${path} — the check proves nothing`);
      assert.equal(
        forwardsSignedHeaders(sabotaged),
        false,
        `the check passes on a ${path} with the forwarding removed, so it is not measuring the forwarding`,
      );
    });

    test(`★★ ${path} reports the store's own words, not only the number`, () => {
      const i = source.indexOf("method: 'PUT'");
      assert.match(
        source.slice(i, i + 1400),
        /\.text\(\)/,
        `${path}: the PUT failure path does not read the response body. Every refusal an object store\n` +
          'issues is a 403 — a wrong key, a key with no write, a missing bucket and a signature over a\n' +
          'different request are the same three digits. Only the body tells them apart.',
      );
    });
  }
});
