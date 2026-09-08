// ★★★ ONE VALUE, ONE HOME — AND WHEN A BOX HAS TWO, THE SHELL AGREES WITH THE CONTAINERS.
//
// ⛔ THE TRAP, MEASURED ON THE LIVE BENCH 2026-09-08. `FORGE_REVALIDATE_SECRET` was declared in `.env`
// (`714ec372…`) and, under its secret-store name `forge-revalidate-secret`, in `.secrets` (`z687G3sq…`).
// Both were live at once and nothing said so:
//
//   · `bin/box-up.sh` sources `env-source.sh` and THEN `.env` (bin/box-up.sh:587-589), so the birth's shell
//     — and every container that birth starts — carries `.env`'s value;
//   · a human who runs `source env-source.sh` carries the secret store's, and compose PREFERS a shell value
//     over the file (env-source.sh's own header says so), so a `docker compose up` from that shell would put
//     a THIRD state on the box.
//
// The measured symptom was a step accusing an innocent box: `node bin/warm-box.mjs` answered 401 — «this
// host's FORGE_REVALIDATE_SECRET is not the one the storefront container holds» — which is exactly right and
// impossible to act on when the operator has no idea there are two.
//
// ★ WHY `.env` OWNS THIS ONE, and it is not a preference: this value is MINTED by the box rather than given
// to it (`bin/box-up.sh` step 3c-bis writes it into `.env`, and nothing in this repository ever writes it to
// a secret store). So the file the containers are interpolated from is the only place that can be right.
//
// ⚠️ THIS GUARD RUNS `env-source.sh` ITSELF, in a temporary directory, against fixtures it writes. It never
// reads this machine's `.env` or `.secrets` — a guard whose verdict depended on the laptop it ran on would
// be green on the one box where it matters and unrunnable everywhere else.
//
//   node --test bin/purge-secret-one-home.guard.mjs      (or: bash bin/test.sh)

import { execFile } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'env-source.sh');
const run_ = promisify(execFile);

/** The two secrets `env-source.sh` REFUSES to continue without, so a fixture is a box that can be sourced. */
const BASE_SECRETS = ['forge-postgres-password=pw', 'forge-vault-key=vk'];

/**
 * Source `env-source.sh` in a box of our own making and report what one variable came out as.
 *
 * The file resolves `.env` and `.secrets` from its OWN directory (`BASH_SOURCE`), so a copy in a temp dir is
 * a whole box — no environment of this machine reaches it.
 */
async function sourced({ env = [], secrets = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-one-home-'));
  try {
    copyFileSync(SOURCE, join(dir, 'env-source.sh'));
    writeFileSync(join(dir, '.env'), `${env.join('\n')}\n`);
    writeFileSync(join(dir, '.secrets'), `${[...BASE_SECRETS, ...secrets].join('\n')}\n`);
    const { stdout, stderr } = await run_(
      'bash',
      ['-c', 'source ./env-source.sh >/dev/null; printf "%s" "${FORGE_REVALIDATE_SECRET-<unset>}"'],
      { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: dir } },
    );
    return { value: stdout, stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('★★★ when the two disagree, the shell carries the value THE CONTAINERS were interpolated from', async () => {
  const { value, stderr } = await sourced({
    env: ['FORGE_REVALIDATE_SECRET=from-dot-env'],
    secrets: ['forge-revalidate-secret=from-the-secret-store'],
  });
  assert.equal(
    value,
    'from-dot-env',
    'sourcing this file hands the shell a purge secret the running containers do not hold — every ' +
      '`node bin/warm-box.mjs` from that shell answers 401, and a `docker compose up` from it would put a ' +
      'third value on the box.',
  );
  // …and the leftover is NAMED, because a value silently shadowed is a value nobody ever deletes.
  assert.match(stderr, /TWO places/i, `the disagreement was not reported:\n${stderr}`);
  assert.match(stderr, /forge-revalidate-secret/, `the secret-store copy is not named:\n${stderr}`);
});

test('★★ a box that keeps it ONLY in the secret store still works — this is precedence, not a removal', async () => {
  const { value, stderr } = await sourced({ env: [], secrets: ['forge-revalidate-secret=only-here'] });
  assert.equal(value, 'only-here', 'the secret store stopped being read at all');
  assert.ok(!/TWO places/i.test(stderr), `a box with ONE home was warned about two:\n${stderr}`);
});

test('★★ a box that keeps it only in .env is exported from there, with no warning', async () => {
  const { value, stderr } = await sourced({ env: ["FORGE_REVALIDATE_SECRET=minted-at-birth"], secrets: [] });
  assert.equal(value, 'minted-at-birth');
  assert.ok(!/TWO places/i.test(stderr), `a box with ONE home was warned about two:\n${stderr}`);
});

test('★★ the single quotes `put_env` writes are not part of the value', async () => {
  // ⚠️ `.env` is read by TWO parsers and `box-up.sh` quotes values for that reason. A shell that exported
  //    the quotes would send `'abc'` where the container holds `abc` — a 401 with a value that LOOKS right.
  const { value } = await sourced({ env: ["FORGE_REVALIDATE_SECRET='quoted'"], secrets: [] });
  assert.equal(value, 'quoted');
});

test('★★ a box with neither exports the EMPTY string, never the word "unset"', async () => {
  const { value } = await sourced({ env: [], secrets: [] });
  assert.equal(value, '', 'the variable came out unset, and `bin/warm-box.mjs` reads an absent one as "could not ask"');
});

// ── ★ THE ANTI-VACUUM: this guard has to be running the file it claims to grade ──────────────────────────

test('★ …and the file this guard sources is the one this repository ships', () => {
  const body = readFileSync(SOURCE, 'utf8');
  assert.match(
    body,
    /export FORGE_REVALIDATE_SECRET=/,
    'env-source.sh no longer exports FORGE_REVALIDATE_SECRET at all — the tests above would pass by ' +
      'exporting nothing, which is the vacuum this line exists to catch.',
  );
  assert.match(
    body,
    /_forge_env_declares/,
    'env-source.sh no longer reads the value back from .env, so the precedence the tests above assert is an ' +
      'accident of the fixtures rather than a rule of this file.',
  );
});
