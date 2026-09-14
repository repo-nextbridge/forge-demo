// ★★ THIS BOX PROMISES A MAILBOX. THIS GRADES THE PROMISE AGAINST THE CODE THAT WOULD HAVE TO KEEP IT.
//
// The sibling of `apps/api/src/dev-mail-promise.guard.test.ts` in the monorepo, which grades the monorepo's
// OWN `docker-compose.yml` and cannot see this file. The defect it was written for happened here too:
//
//   `compose.yml` told a reader that leaving `FORGE_SMTP_*` unset makes "the kernel LOG the code instead of
//   sending it — `docker compose logs kernel` is the inbox", while the SAME file declares `NODE_ENV:
//   production` four blocks up, and the transport that does the logging is constructible ONLY under
//   `!production` (apps/api/src/smtp-channel-driver.ts, on purpose: printing a credential to a terminal has
//   to be impossible in production BY CONSTRUCTION, not by a flag somebody can set).
//
// What a production box with no mail actually gets is the transport that FAILS BY NAME on every message. Not
// "the code goes to the log" — NOBODY CAN LOG IN. That cost an afternoon on this bench.
//
// ★ THE RULE HERE IS THE INVERSE OF THE MONOREPO'S, and that is what makes it honest rather than copied. Over
// there the box is a developer's and the fix is to drop `production`. Here the box WANTS production and has a
// real mailbox (Resend), so the thing that must not survive is the PROMISE. The two guards therefore assert
// different things about the same contradiction, and neither one's red means the other's subject moved.
//
// ⚠️ IT GRADES THE PREMISE FIRST. If the driver ever stops gating the terminal transport on `!production`,
// the rule below is arguing about a door that moved — so a failure there says "re-read this guard", never
// "the compose is wrong".
//
//   node --test bin/dev-mail-promise.guard.mjs        (or: bash bin/test.sh)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { fileAtPinned, pinnedCommit, ROOT } from './release-tree.mjs';
const COMPOSE = join(ROOT, 'compose.yml');
const ENV_SOURCE = join(ROOT, 'env-source.sh');

/** Where this repo reads the kernel's mail driver from. The premise test SKIPS rather than fails when this
 * machine cannot reach it: this repository does not vendor the kernel's source, and a guard that goes red on
 * a machine without a checkout is a guard people learn to ignore.
 *
 * ⛔ pk35/D6 — AND IT IS THE PINNED COMMIT, NOT "a Forge checkout". Until 2026-09-14 this took the first
 * directory that happened to hold the file, out of `FORGE_MONOREPO` and two hard-coded neighbours, and never
 * asked which commit it was — so the PREMISE of this whole file could be graded against a driver these
 * images were never built from, and a stale worktree would have said the gate below was gone. `fileAtPinned`
 * reads the blob AT the commit `forge.lock` names, from any clone that has fetched it. */
const DRIVER = 'apps/api/src/smtp-channel-driver.ts';
function driverSource() {
  const pinned = pinnedCommit();
  if (!pinned) return { tried: ['forge.lock names registry digests, not a branch@sha — there is no commit to read'] };
  return fileAtPinned(pinned, DRIVER);
}

/** The `NODE_ENV:` this compose hands the KERNEL, with a `${VAR:-default}` reduced to its default. The kernel's
 * is the first one in the file; the fronts declare their own further down and are not this rule's subject. */
function kernelNodeEnv() {
  const line = readFileSync(COMPOSE, 'utf8')
    .split('\n')
    .find((l) => /^\s*NODE_ENV:/.test(l));
  assert.ok(line, 'compose.yml declares no NODE_ENV — this guard has lost its subject');
  const value = line.split(':').slice(1).join(':').trim();
  return (value.match(/^\$\{[^:}]+:-([^}]*)\}$/)?.[1] ?? value).trim();
}

test('★ the PREMISE holds — the terminal mail transport is still gated on !production', (t) => {
  const found = driverSource();
  if (found.tried) {
    t.skip(
      `NOT CHECKED — cannot read ${DRIVER} at ${pinnedCommit()?.ref ?? 'the pinned commit'} ` +
        `(tried: ${found.tried.join(' · ')}). Set FORGE_MONOREPO=<a Forge clone that has fetched it>.`,
    );
    return;
  }
  const driver = found.text;
  assert.ok(
    driver.includes("const production = env.NODE_ENV === 'production'"),
    'smtp-channel-driver.ts no longer derives `production` from NODE_ENV — re-read this guard before trusting it',
  );
  assert.match(
    driver,
    /if \(!production\) return \{ channel, send: devSend\(/,
    'the terminal transport is no longer returned under `!production` — the rule below may be arguing about a door that moved',
  );
});

test('★★ THE RULE — this compose may not promise a terminal mailbox while declaring production', () => {
  const compose = readFileSync(COMPOSE, 'utf8');
  // The promise, in the shapes it has actually been written in here and upstream. Matching PROSE is right for
  // this guard: the defect IS a sentence, and the sentence is what has to stop existing.
  const promisesTerminal =
    /LOGS the code instead of sending it|logs the code to the terminal|writes the message to its own stdout|`docker compose logs kernel` is the inbox/.test(
      compose,
    );
  const declaresProduction = kernelNodeEnv() === 'production';
  assert.equal(
    promisesTerminal && declaresProduction,
    false,
    'compose.yml both declares NODE_ENV=production AND promises the terminal receives the login code. The two ' +
      'cannot be true together: under production the terminal transport is never constructed and every message ' +
      'FAILS BY NAME — no OTP reaches anyone and nobody can log in. Drop the promise, or drop production.',
  );
});

test('★ it still says WHERE the code arrives — a rule that only deletes leaves a reader with nothing', () => {
  // Anti-vacuity, and the half the monorepo's sibling cannot assert: over there the answer is a terminal, here
  // it is a mailbox. Without this, deleting the false sentence would pass the rule above and leave the next
  // person with no idea where to look for their own login code.
  const compose = readFileSync(COMPOSE, 'utf8');
  assert.match(
    compose,
    /WHERE THE CODE ARRIVES/,
    'compose.yml no longer explains where the login code is delivered on this box',
  );
});

test('★ the four SMTP variables are assembled in ONE place', () => {
  // The other way this defect comes back. Three values in `.env` and a conditional password meant a box whose
  // owner had not added the key yet declared three of four and REFUSED TO BOOT, naming the missing one. The
  // set has to be built where the password's presence can decide whether it exists at all.
  const env = existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8') : '';
  const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
  for (const [name, body] of [['.env', env], ['.env.example', example]]) {
    for (const key of ['FORGE_SMTP_HOST', 'FORGE_SMTP_USER', 'FORGE_SMTP_FROM', 'FORGE_SMTP_PASS']) {
      assert.ok(
        !new RegExp(`^${key}=`, 'm').test(body),
        `${name} declares ${key}. The four are assembled in env-source.sh, where the password's presence ` +
          'decides whether the set exists — a partial set is a fatal boot error.',
      );
    }
  }
  const source = readFileSync(ENV_SOURCE, 'utf8');
  assert.match(
    source,
    /if \[ -n "\$FORGE_SMTP_PASS" \]/,
    'env-source.sh no longer gates the SMTP set on the password being present',
  );
});
