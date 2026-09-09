// ★★★ pk29/D1 — THE BIRTH SAYS WHEN THE PROMOTION IS STILL OWED, AND SAYS IT ONLY WHEN IT IS.
//
// ⛔ THE TROPEÇO, 2026-09-09. The box was born, every step green, and the owner opened
// `https://<tailnet>:8443/login` and got `?error=unknown_host` — «This address is not registered on this
// instance». Measured on that box: `forge_control.admin_directory` held `localhost:8201` and
// `localhost:8202` and nothing else. `bash bin/box-up.sh --promote tailnet` fixed it in seconds, hours later,
// and only because he asked what was wrong.
//
// ⛔⛔ AND THE REPAIR IS NOT «PROMOTE AT BIRTH». The box is born on `localhost` by decision — §0b of
// `box-up.sh` says at length why (the addresses of a private network may not live in a versioned file), and
// pk24/§B5 made the promotion a NAMED step of the pipeline rather than a mode of this bench. What is repaired
// is the SILENCE. So this guard has to prove BOTH directions, and the second is the one a careless fix
// breaks: it must be LOUD when a door is unclaimed and MUTE on every birth where nothing is owed.
//
// ── HOW IT GRADES BASH ─────────────────────────────────────────────────────────────────────────────────────
//
// `box-up.sh` is 2 200 lines that execute a birth; it cannot be sourced (its own first line says so) and a
// real birth costs ~19 minutes. So the functions are LIFTED OUT OF THE SOURCE BY NAME and run in a shell of
// their own, against a fake `tailscale` and a `.env` written for the case. That makes this a behavioural
// test — the decision really runs — and it makes a RENAMED or DELETED function a red that names it, which a
// grep-shaped guard over the same file would not give.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'bin', 'box-up.sh'), 'utf8');

/** One shell function of `box-up.sh`, by name, from `name() {` to the `}` in column zero that closes it.
 *  ⛔ ANTI-VACUUM: a function this guard cannot find is a FAILURE, never an empty string to run. */
function shellFunction(name) {
  const head = `${name}() {`;
  const at = SRC.indexOf(`\n${head}`);
  assert.ok(
    at >= 0,
    `bin/box-up.sh no longer defines \`${name}\`. This guard runs that function; without it every rule below ` +
      'would grade an empty script and pass.',
  );
  const end = SRC.indexOf('\n}\n', at);
  assert.ok(end > at, `\`${name}\` in bin/box-up.sh is not closed by a \`}\` in column zero — cannot lift it`);
  return SRC.slice(at + 1, end + 3);
}

const LIFTED = ['tailnet_published_ports', 'authority_for', 'origin_for', 'store_host_names', 'promotion_gap_doors'];

/**
 * Run `promotion_gap_doors` in a shell that has exactly the five functions above, a `.env` holding the given
 * host → store map, and a `tailscale` that answers with the given serve document (or is absent entirely).
 */
function ask({ tailnetHost, storeHosts, serve }) {
  const box = mkdtempSync(join(tmpdir(), 'promotion-gap-'));
  writeFileSync(
    join(box, '.env'),
    storeHosts === undefined ? '' : `FORGE_STORE_HOSTS='${JSON.stringify(storeHosts)}'\n`,
  );
  const bin = join(box, 'bin');
  mkdirSync(bin);
  if (serve !== undefined) {
    // A `tailscale` that answers `serve status --json` and nothing else — which is the only call the lifted
    // function makes. Its absence is the "no tailscale on this machine" case, tested below.
    writeFileSync(join(bin, 'tailscale'), `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(serve)}\nJSON\n`);
    chmodSync(join(bin, 'tailscale'), 0o755);
  }
  const script = `set -uo pipefail\nHERE=${JSON.stringify(box)}\n${LIFTED.map(shellFunction).join('\n')}\npromotion_gap_doors\n`;
  return execFileSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: serve === undefined ? '/usr/bin:/bin' : `${bin}:${process.env.PATH}`,
      FORGE_TAILNET_HOST: tailnetHost ?? '',
    },
  }).trim();
}

/** What `tailscale serve` really answers on this bench: TLS terminated on 8443/8444, proxied to the box. */
const SERVING = (host) => ({
  TCP: { 8443: { HTTPS: true }, 8444: { HTTPS: true } },
  Web: {
    [`${host}:8443`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8201' } } },
    [`${host}:8444`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8202' } } },
  },
});

const HOST = 'bench.example-tailnet.ts.net';

test('★★★ a box born on `localhost` while this machine publishes it says so, NAMING the doors', () => {
  // ⇒ THE BIRTH OF 09/09, EXACTLY: the map holds `localhost` keys, `tailscale serve` is already in front.
  const said = ask({
    tailnetHost: HOST,
    storeHosts: { 'localhost:8200': 'sto_1', localhost: 'sto_1' },
    serve: SERVING(HOST),
  });
  assert.equal(
    said,
    `https://${HOST}:8443 https://${HOST}:8444`,
    'the birth learnt nothing about the doors this machine publishes — which is the silence that let ' +
      '`?error=unknown_host` be the first thing anybody read',
  );
});

test('⛔ …and it is MUTE once the box has claimed that name — a report that always fires is a report nobody reads', () => {
  const said = ask({
    tailnetHost: HOST,
    storeHosts: { [`${HOST}:8443`]: 'sto_1', [HOST]: 'sto_1' },
    serve: SERVING(HOST),
  });
  assert.equal(said, '', `a promoted box was told to promote itself: ${said}`);
});

test('⛔ THE VARIABLE IS NOT THE ANSWER — a name nothing serves is not an unclaimed door', () => {
  // ⚠️ THE FIX THIS RULE FORBIDS, and it is the obvious one: "warn whenever FORGE_TAILNET_HOST is set". That
  // variable sits in `.env` on this laptop whether or not anything is serving, so that version of the report
  // fires on every local birth and is trained away within a week.
  assert.equal(ask({ tailnetHost: HOST, storeHosts: { 'localhost:8200': 'sto_1' }, serve: {} }), '');
  assert.equal(ask({ tailnetHost: HOST, storeHosts: { 'localhost:8200': 'sto_1' }, serve: undefined }), '');
});

test('⛔ a machine that declares no other name is silent — nothing here is guessed', () => {
  assert.equal(ask({ tailnetHost: '', storeHosts: { 'localhost:8200': 'sto_1' }, serve: SERVING(HOST) }), '');
});

test('★ a door published on the scheme’s DEFAULT port is named without one, the way a browser sends it', () => {
  // The same rule `authority_for` states for the promotion itself: a browser omits `:443` on https.
  const said = ask({
    tailnetHost: HOST,
    storeHosts: { 'localhost:8200': 'sto_1' },
    serve: {
      TCP: { 443: { HTTPS: true } },
      Web: { [`${HOST}:443`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8200' } } } },
    },
  });
  assert.equal(said, `https://${HOST}`);
});

test('⛔ a door published under a PATH prefix is not an origin and is not named', () => {
  // `tailnet_published_ports` only reads the `/` handler, and the promotion says why: this box has no service
  // that survives being mounted under a prefix. A report naming one would send somebody to a broken address.
  const said = ask({
    tailnetHost: HOST,
    storeHosts: { 'localhost:8200': 'sto_1' },
    serve: {
      TCP: { 8443: { HTTPS: true } },
      Web: { [`${HOST}:8443`]: { Handlers: { '/admin': { Proxy: 'http://127.0.0.1:8201' } } } },
    },
  });
  assert.equal(said, '');
});

// ── what the birth DOES with the answer ──────────────────────────────────────────────────────────────────

test('★★★ the birth REPORTS it and does NOT gate on it — the promotion is not forced, by decision', () => {
  // ⛔ THE LINE THAT MUST NOT BE ADDED. Making this red would make every correct local birth red: the box is
  // born on `localhost` on purpose (§0b), and pk24/§B5 kept the promotion a step of the PIPELINE. The report
  // is loud; the exit code is not its business.
  const conjunction = SRC.slice(SRC.lastIndexOf('if [ -n "${SHUT:-}" ]'));
  assert.ok(
    !conjunction.includes('PROMOTION_OWED'),
    'the unclaimed-door report reached the exit-code conjunction — a birth on this laptop, which is a CORRECT ' +
      'birth, would now be red. §0b of box-up.sh is the decision this breaks.',
  );
  assert.match(
    SRC,
    /PROMOTION_OWED:-\}" \]; then\n {2}printf '\[box-up\] ⚠️ {2}REPORT/,
    'the answer is computed and nothing prints it — the silence would be back with a variable holding the cure',
  );
});

test('★★ the report is fed from what is PUBLISHED and from the box’s own map, not from a hostname anywhere', () => {
  const fn = shellFunction('promotion_gap_doors');
  assert.match(fn, /tailnet_published_ports/, 'it does not read what this machine publishes');
  assert.match(fn, /store_host_names/, 'it does not read what the box claims');
  assert.ok(
    !/\.ts\.net|localhost:84/.test(fn),
    'a hostname or a port of this bench is written into the function — the next box has other ones',
  );
});

test('⛔ `store_host_names` reads the MAP alone — the tailnet variables are the other question', () => {
  // ⚠️ THE BUG THIS SPLIT REPAIRS, and it is why the two functions exist. `promoted_hosts` prints
  // `FORGE_TAILNET_HOST` before it reads the map, on purpose: a box promoted by the older script has the
  // variable and a map that may not carry the name. Asking IT «has this box claimed the tailnet?» answers YES
  // on a box that was never promoted at all — the check would be permanently mute, which is the defect.
  assert.ok(
    !shellFunction('store_host_names').includes('FORGE_TAILNET_HOST'),
    'store_host_names reads the environment, so "the box claims this name" is true whenever the name is set',
  );
  assert.match(
    shellFunction('promoted_hosts'),
    /store_host_names/,
    'promoted_hosts stopped reading the map through the shared reader — there are two copies of it again',
  );
});
