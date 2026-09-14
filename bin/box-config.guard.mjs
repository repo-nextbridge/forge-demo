// ★★ THE TWO ARRANGEMENTS THAT DIED AT EVERY REBIRTH, AND THE ONE THAT MUST NEVER BE COMMITTED.
//
// A44 and A15 are the same defect twice: something real was configured on the bench BY HAND — the admin's
// sibling switcher, and this box's addresses on a private network — and the next `bash bin/box-up.sh` wiped
// both. Neither loss was loud. An unset `FORGE_ADMIN_SIBLINGS` yields an EMPTY LIST and the admin shell
// renders exactly as it did before the feature existed (`apps/admin/src/lib/siblings.ts` promises that, on
// purpose); a rebirth on `localhost` simply answers 404 to the tailnet and 200 to the laptop.
//
// So the repair is "it is born from the repository", and this file grades that claim in the three places it
// has to be true at once — and grades the ONE thing that must stay false.
//
//   node --test bin/box-config.guard.mjs        (or: bash bin/test.sh)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { declaredFaces, readBox } from './box-domains.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const BOX_UP = read('bin/box-up.sh');
const ENV_EXAMPLE = read('.env.example');
const OVERRIDE = read('compose.override.yml');

// ── A44 · THE ADMIN'S SIBLING SWITCHER ────────────────────────────────────────────────────────────────────
//
// ⚠️ THREE PLACES, AND ANY ONE OF THEM MISSING IS SILENT. The value has to be DERIVED (box-up), DECLARED
// (.env.example, so a human copying the file knows the variable exists) and DELIVERED (compose, to the admin
// container). The third was the one actually missing when this was measured: `compose.yml` hands the admin
// sixteen variables and this is not one of them, so a correct `.env` would have reached nothing.

test('★★ A44 — box-up DERIVES the sibling list from seed/box.json, and the result is what the admin accepts', () => {
  assert.match(
    BOX_UP,
    /admin_siblings_json\(\)/,
    'bin/box-up.sh no longer derives FORGE_ADMIN_SIBLINGS. Hand-writing it is what A44 is about: it is env, ' +
      'so every rebirth erases it, and an erased switcher is invisible.',
  );

  // ★ THE RESULT, not the shell. The function is run for real against this repository's own topology and the
  //   output is graded by the SAME rules `siblings.ts` applies — absolute http(s), a name, a url. An entry the
  //   admin would silently drop has to be red HERE, because over there it is an empty dropdown and no message.
  const json = execFileSync(
    'bash',
    ['-c', `BOX="${join(ROOT, 'seed/box.json')}"; source <(sed -n '/^admin_siblings_json()/,/^}/p' "${join(ROOT, 'bin/box-up.sh')}"); admin_siblings_json`],
    { encoding: 'utf8' },
  ).trim();
  const parsed = JSON.parse(json);

  const tenants = JSON.parse(read('seed/box.json')).tenants;
  assert.ok(tenants.length >= 2, 'seed/box.json declares fewer than two tenants — there is nothing to switch between.');
  assert.equal(
    parsed.length,
    tenants.length,
    `the switcher lists ${parsed.length} door(s) for ${tenants.length} tenant(s). A tenant added to ` +
      'seed/box.json is supposed to arrive in the dropdown with no second edit.',
  );
  for (const entry of parsed) {
    assert.ok(typeof entry.name === 'string' && entry.name.trim(), `an entry has no name: ${JSON.stringify(entry)}`);
    assert.match(
      entry.url,
      /^https?:\/\/[^/]+$/,
      `${JSON.stringify(entry.url)} is not the shape siblings.ts keeps (absolute http(s), no trailing slash). ` +
        'A bad entry is DROPPED there and nothing says so.',
    );
  }
  // Two brands must not share one door: the port is what `read.admin.by_host` keys on, and a duplicate would
  // put both names on the same admin.
  assert.equal(new Set(parsed.map((e) => e.url)).size, parsed.length, 'two tenants point at the same admin url.');
});

test('★★ A44 — …and the value actually REACHES the admin container', () => {
  const admin = OVERRIDE.match(/^ {2}admin:\n([\s\S]*?)(?=^ {2}\S|\Z)/m);
  assert.ok(
    admin,
    'compose.override.yml declares no `admin:` service. `compose.yml` (the product\'s file) does not pass ' +
      'FORGE_ADMIN_SIBLINGS, so without this block the variable is correct in .env and absent in the process.',
  );
  assert.match(admin[1], /FORGE_ADMIN_SIBLINGS:\s*\$\{FORGE_ADMIN_SIBLINGS/, 'the admin service does not receive FORGE_ADMIN_SIBLINGS.');
});

test('★ A44 — and .env.example names the variable, so a human copying the file knows it exists', () => {
  assert.match(ENV_EXAMPLE, /^FORGE_ADMIN_SIBLINGS=/m, '.env.example does not declare FORGE_ADMIN_SIBLINGS.');
});

// ── A15 · THE TAILNET, AS A PROMOTION ─────────────────────────────────────────────────────────────────────

test('★★ A15/§B5 — the promotion is a NAMED step with a destination, and the two old modes still work', () => {
  // ★ pk24/§B5 — the destination stopped being the name of the mode. `--tailnet` used to BE the promotion;
  //   online there is no tailnet and the box needs the same thing, so the address is now an argument and the
  //   tailnet is one of its values. The two aliases stay: every runbook, comment and script here types them.
  assert.match(BOX_UP, /--promote\)/, 'bin/box-up.sh has no --promote step; §B5 asks for one a CI can invoke.');
  assert.match(BOX_UP, /--tailnet\)\s*MODE=promote; PROMOTE_TO=tailnet/, 'the --tailnet alias is gone.');
  assert.match(BOX_UP, /--localhost\)\s*MODE=promote; PROMOTE_TO=localhost/, 'the promotion has no way back; A15 asks for reversible.');
  assert.match(
    BOX_UP,
    /FORGE_TAILNET_HOST:-\}"?\s*\]\s*\|\|\s*die/,
    'the promotion does not DIE when FORGE_TAILNET_HOST is unset. Without the refusal it would write ' +
      '`http://:8200` into FORGE_PUBLIC_ORIGIN — the origin the kernel mints every product-image URL from.',
  );
});

test('★★ A15 — the promotion is idempotent: every .env value is REWRITTEN, never appended', () => {
  // The block ends at its own `exit`, whatever that exit now carries — pk7·D1 made it a variable, because a
  // promotion that claimed one door of two must not exit 0.
  const block = BOX_UP.match(/if \[ "\$MODE" = promote \]; then([\s\S]*?)\n  exit [^\n]+\nfi/);
  assert.ok(block, 'the promotion block moved — re-read this guard before believing it.');
  // Anti-vacuity: the block has to be the real thing, not an empty branch.
  assert.ok(block[1].length > 1000, `the promotion block parsed to ${block[1].length} characters.`);
  const appends = [...block[1].matchAll(/>>\s*"\$HERE\/\.env"/g)];
  assert.equal(
    appends.length,
    0,
    'the promotion appends to .env. Run twice, that leaves two lines for one variable — and the LAST one ' +
      'wins for compose while `source` also takes the last, so the box would look right and drift on the ' +
      'third run. Every write goes through `put_env`, which rewrites in place.',
  );
  for (const name of ['FORGE_STORE_HOSTS', 'FORGE_PUBLIC_ORIGIN', 'FORGE_GATE_ADMIN_URL', 'FORGE_ADMIN_SIBLINGS']) {
    assert.match(block[1], new RegExp(`put_env ${name}`), `the promotion never rewrites ${name} — A15 lists it as one of the values a rebirth loses.`);
  }
  // The admin doors are claimed THROUGH THE PORT. A cutover that wrote admin_directory by hand would be a
  // second write path, which is the one thing the kernel's whole shape forbids.
  assert.match(block[1], /dist\/admin-host\.js set/, 'the promotion never claims the admin hostnames.');
  assert.match(block[1], /dist\/admin-host\.js remove/, 'the reverse never releases them.');
});

test('★★★ A15/A44 — `put_env` is idempotent AND lossless, RUN rather than read', () => {
  // ★ THE CHECK ABOVE READS THE SCRIPT; THIS ONE EXECUTES IT. "Rewrites in place" and "no appends" are both
  //   greppable claims, and a helper can satisfy both while corrupting the value it writes — which is exactly
  //   what the shape it replaced did — `sed -i "s|^X=.*|X=$v|"`, the idiom already on this box.
  //
  // ⚠️ AND THE VALUE IT WRITES CARRIES THE CHARACTERS THAT BREAK THAT SHAPE, WHICH IS THE WHOLE TEST. The
  //   first version of this check used a realistic sibling list — and a realistic sibling list contains no
  //   `|`, no `&` and no backslash, so it passed against a sed implementation too. A guard that cannot fail
  //   is not a guard: it was measured green on the sabotage before this line was written. The values here are
  //   GENERATED (a store id, seed/box.json, a hostname somebody types), so "they never contain an `&`" is a
  //   property nobody is enforcing — this pins the helper as lossless instead of pinning the values as tame.
  const dir = mkdtempSync(join(tmpdir(), 'forge-put-env-'));
  try {
    const envFile = join(dir, '.env');
    writeFileSync(envFile, 'FORGE_PUBLIC_ORIGIN=http://localhost:8200\nOTHER=kept\n');
    // Shaped like what a promotion writes — single-quoted JSON, for the two parsers that read `.env` — and
    // carrying sed's three: `&` (expands to the matched line), `|` (the delimiter) and a backslash.
    const value = `'{"name":"Forge & Caf\u00e9","url":"http://a:8201?x=1&y=2","note":"a|b\\\\c"}'`;
    const script =
      `HERE=${JSON.stringify(dir)}\n` +
      `${(BOX_UP.match(/^put_env\(\) \{[\s\S]*?\n\}$/m) ?? [])[0]}\n` +
      // THREE times: once is a write, twice is a rewrite, three times is the drift a `>>` would show.
      `put_env FORGE_ADMIN_SIBLINGS ${JSON.stringify(value)}\n`.repeat(3) +
      `put_env FORGE_PUBLIC_ORIGIN 'http://elsewhere:8200'\n`;
    execFileSync('bash', ['-c', script], { encoding: 'utf8' });

    const lines = readFileSync(envFile, 'utf8').split('\n').filter(Boolean);
    const siblings = lines.filter((l) => l.startsWith('FORGE_ADMIN_SIBLINGS='));
    assert.equal(siblings.length, 1, `three runs left ${siblings.length} FORGE_ADMIN_SIBLINGS line(s):\n${lines.join('\n')}`);
    assert.equal(siblings[0], `FORGE_ADMIN_SIBLINGS=${value}`, 'the JSON came back changed — the value is not written verbatim.');
    assert.ok(lines.includes('FORGE_PUBLIC_ORIGIN=http://elsewhere:8200'), 'an EXISTING line was not rewritten in place.');
    assert.ok(lines.includes('OTHER=kept'), 'a line this helper had no business touching was lost.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ★★ THIS TEST USED TO SAY "IT NEVER RUNS `tailscale`", AND pk6·D2 NARROWED IT — deliberately, with the
// measurement in `tailnet_published_ports`. The line A15 draws is between CHANGING that machine's network and
// KNOWING what it publishes, and the old assertion drew it one notch too wide: it also forbade the read, so
// the promotion had to ASSUME the published ports were the box's own. They are not — `tailscale serve`
// terminates TLS on ports of its own — and the assumption is what made the admin unreachable from anywhere
// but the laptop. So the read is allowed and the write is still forbidden, by name.
test("★★ A15 — it READS what the tailnet publishes and never WRITES it: getting on the network is the operator's gesture", () => {
  // ⚠️ COMMAND POSITION, not the word. `tailscale` also appears in the prose this script prints, and a guard
  // that flagged a `note` string would be a guard people edit around. What is graded is an INVOCATION:
  // the name at the start of a line, after a pipe, a `;`, an `&&`/`||`, or inside a `$( … )`.
  const INVOCATION = /(?:^|[|;&(]|\$\()\s*tailscale\b/;
  const lines = BOX_UP.split('\n')
    .map((l) => l.trim())
    .filter((l) => !l.startsWith('#') && INVOCATION.test(l));
  assert.ok(
    lines.length > 0,
    'bin/box-up.sh never asks tailscale what it publishes. Without that read the promotion is back to ' +
      'gluing this machine\'s name onto the box\'s INTERNAL ports — the addresses a browser never uses.',
  );
  for (const line of lines) {
    assert.match(
      line,
      /command -v tailscale|tailscale serve status --json/,
      `this line invokes tailscale in a shape that is not the read-only status query:\n    ${line.trim()}`,
    );
    assert.doesNotMatch(
      line,
      /\btailscale\s+(up|down|login|logout|set|cert|funnel|switch|serve\s+(?!status))/,
      'bin/box-up.sh CONFIGURES tailscale. This step wires the BOX to a network that already reaches it; it ' +
        'does not configure that network, and a script that did would be changing state nobody asked it to ' +
        `touch:\n    ${line.trim()}`,
    );
  }
});

// ── THE ONE THING THAT MUST STAY FALSE ────────────────────────────────────────────────────────────────────
//
// ★★ NO PRIVATE ADDRESS IN A VERSIONED FILE. This is why A15 was left undone in the first place — the fix
// looked like writing a private tailnet name into a tracked file, which is the same mistake as the personal
// e-mail in the dataset, with another kind of value. The variables are named; the values live in `.env`,
// which is gitignored. This is the check that keeps that true after the next person edits it.
test('★★ no tailnet hostname or address is committed anywhere in this repository', () => {
  const files = execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.ok(files.length > 20, `git listed ${files.length} tracked file(s) — this guard is not looking at the repo.`);
  const MAGICDNS = /\b[a-z0-9-]+\.tail[0-9a-f]{5,}\.ts\.net\b/i;   // the MagicDNS shape
  const CGNAT = /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/; // Tailscale's CGNAT range (RFC 6598, 100.64/10 — written WITHOUT the four octets on
  // purpose: this guard scans every tracked file INCLUDING ITSELF, and a full dotted quad in this very
  // comment made it accuse its own source. A guard blind to its own file would be worse than this line.
  const offenders = [];
  for (const rel of files) {
    const abs = join(ROOT, rel);
    let text;
    try {
      if (statSync(abs).size > 2_000_000) continue;
      text = readFileSync(abs, 'utf8');
    } catch {
      continue; // binary or unreadable: a photograph carries no hostname
    }
    if (MAGICDNS.test(text)) offenders.push(`${rel} (a MagicDNS name)`);
    else if (CGNAT.test(text)) offenders.push(`${rel} (a tailnet address)`);
  }
  assert.deepEqual(
    offenders,
    [],
    'these tracked file(s) carry an address of somebody\'s private network:\n  ' + offenders.join('\n  ') +
      '\n  The promotion reads FORGE_TAILNET_HOST / FORGE_TAILNET_IP from `.env`, which is gitignored. ' +
      'Name the variable, never the value.',
  );
});

test('★ .env.example names the two variables and gives neither a value', () => {
  for (const name of ['FORGE_TAILNET_HOST', 'FORGE_TAILNET_IP']) {
    const line = ENV_EXAMPLE.match(new RegExp(`^${name}=(.*)$`, 'm'));
    assert.ok(line, `.env.example does not declare ${name}.`);
    assert.equal(line[1].trim(), '', `${name} carries a value in a tracked file: it must be empty here.`);
  }
});

// ── pk6·D2 · THE PROMOTION CLAIMS THE ADDRESS A BROWSER REALLY USES ───────────────────────────────────────
//
// ⛔ THE DEFECT, MEASURED ON THE LIVE BENCH OF 2026-09-03. `--tailnet` glued this machine's tailnet name onto
// each door's INTERNAL port, so it claimed `<tailnet>:8201` / `<tailnet>:8202` and pointed the gate and the
// sibling switcher at `http://<tailnet>:8201`. Neither address is one an operator can hold a session on:
//
//   `read.admin.by_host?host=<tailnet>:8201` → 200 forgeco   ← claimed, and unusable
//   `read.admin.by_host?host=<tailnet>:8443` → 404           ← the address `tailscale serve` answers on
//   `read.admin.by_host?host=<tailnet>:8444` → 404
//
// …because the admin's session cookie is `Secure` (`apps/admin/src/lib/session.ts`, NODE_ENV=production in
// the image) and a browser will not store a `Secure` cookie over http anywhere but `localhost`. Over http the
// login "works" and the next request bounces to /login with an empty jar; over https it refuses with
// `unknown_admin_host`. Both silent, from outside the laptop, in both directions.
//
// ★ SO THESE TESTS RUN THE PROMOTION FOR REAL — not grep it. The published map, docker and curl are stubs on
// PATH; `seed/box.json` and `bin/box-up.sh` are this repository's own. What is graded is the `.env` it wrote
// and the `admin-host.js` calls it made, which is exactly the pair that was wrong on the bench.
//
// ⚠️ THE FIXTURE HOST IS FAKE ON PURPOSE (`box.example.test`, `10.9.9.9`): the last test in this file forbids
// a real tailnet name or address in any tracked file, and it scans this one too.

const FAKE_TAILNET_HOST = 'box.example.test';
const FAKE_TAILNET_IP = '10.9.9.9';

/** What this bench's `tailscale serve status --json` really looks like: TLS on ports of ITS choosing, each
 *  forwarding to one of the box's. 443 → the vitrine, 8443 → T1's admin, 8444 → T2's, 8445 → the totem. */
const SERVE_PUBLISHING = JSON.stringify({
  TCP: { 443: { HTTPS: true }, 8443: { HTTPS: true }, 8444: { HTTPS: true }, 8445: { HTTPS: true } },
  Web: {
    [`${FAKE_TAILNET_HOST}:443`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8200' } } },
    [`${FAKE_TAILNET_HOST}:8443`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8201' } } },
    [`${FAKE_TAILNET_HOST}:8444`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8202' } } },
    [`${FAKE_TAILNET_HOST}:8445`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8203' } } },
  },
});

/** An operator who never ran `tailscale serve` — the case that must keep behaving exactly as it always did. */
const SERVE_NOTHING = JSON.stringify({ TCP: {}, Web: {} });

/** ★★ THE CLAIM THAT DOES NOT TAKE, WHICH IS THE ONLY WAY THE PROMOTION EVER LIES (pk7·D1).
 *
 *  `admin-host.js set <door> <tenant>` fails when the tenant is not there — which is precisely what a box
 *  that was never born looks like from up here. Until this option existed the stub said yes to everything,
 *  so every test in this file measured the happy path and the two defects of 03/09 (a green promotion on an
 *  EMPTY box, and a screen listing a door the directory refused) could not be written down.
 *
 *  `setFails` holds shell glob patterns matched against the whole compose command line; `['*']` fails them
 *  all, `['*forgecafe*']` fails one tenant's.
 *
 *  ★ pk24/d4 — `benchBind` is the host interface `compose.yml` publishes this box's doors on. The DEFAULT
 *  here is absent, which is the box these tests were written against: doors on every interface, so the
 *  fallback to the direct ports really is reachable. Pass `'127.0.0.1'` for the box `.env.example` now ships,
 *  where that fallback is a port that refuses to connect.
 */
function runPromotion({
  mode,
  args = [`--${mode}`],
  serve,
  httpsProbeOk = false,
  withIp = true,
  withTailnetHost = true,
  storeHosts = `'{"localhost":"sto_01TEST","localhost:8200":"sto_01TEST"}'`,
  setFails = [],
  // ★ pk35/d4 — THE DECLARATION THE BOX IS STANDING ON. The default is this repository's own file, which is
  // the point (see the copy below); an override is how the sabotage — a store that lost its `domain` — is a
  // permanent case instead of a gesture somebody has to remember to repeat.
  box = null,
  benchBind = null,
  expectStatus = 0,
}) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-promotion-'));
  const stub = join(dir, 'stub');
  const log = join(dir, 'docker.log');
  mkdirSync(join(dir, 'bin'), { recursive: true });
  mkdirSync(join(dir, 'seed'), { recursive: true });
  mkdirSync(stub, { recursive: true });

  writeFileSync(join(dir, 'bin/box-up.sh'), BOX_UP);
  writeFileSync(join(dir, 'seed/box.json'), box ?? read('seed/box.json'));
  // Sourced by box-up before anything else; on the real box it reaches a secret store.
  writeFileSync(join(dir, 'env-source.sh'), 'export DATABASE_URL=postgres://stub/stub\n');
  writeFileSync(join(dir, 'bin/images-from-lock.sh'), ':\n');
  // The REAL floor check, not a stub: box-up sources it as its very first act, and a fixture that stubbed it
  // would be measuring a box-up this repository does not ship. It passes here because `bin/test.sh` refuses
  // to run this suite on a node under the floor in the first place.
  writeFileSync(join(dir, 'bin/require-node.sh'), read('bin/require-node.sh'));
  // ★★ AND THE REAL VERDICT, for the same reason and not as a stub: the promotion's EXIT STATUS is derived
  // there (pk30/§2), so a fixture that stubbed it would grade a box-up whose status means nothing. Every
  // `expectStatus` below is this module's answer, over the facts the run really measured.
  writeFileSync(join(dir, 'bin/promotion-verdict.mjs'), read('bin/promotion-verdict.mjs'));
  // ★★ AND THE FACES, REAL FOR THE SAME REASON (pk35/d4). The promotion derives the edge's hostnames from
  // `seed/box.json` through `bin/promotion-faces.mjs`, and it REFUSES when the derivation cannot be complete
  // — so a fixture that stubbed it would grade a promotion whose refusal cannot fire. The declaration and
  // the edge are this repository's own files, which is what makes "it wrote store.forgecommerce.pro" an
  // assertion about the file rather than about a string typed in this test.
  writeFileSync(join(dir, 'bin/promotion-faces.mjs'), read('bin/promotion-faces.mjs'));
  writeFileSync(join(dir, 'bin/box-domains.mjs'), read('bin/box-domains.mjs'));
  mkdirSync(join(dir, 'caddy'), { recursive: true });
  writeFileSync(join(dir, 'caddy/Caddyfile'), read('caddy/Caddyfile'));
  // ⚠️ AND THE PIN IT READS, because the floor is not typed anywhere any more: `require-node.sh` takes it
  // from `forge.lock` (pk8/d2). A fixture without one would exercise the "this pin states no floor" branch
  // — a real branch, but not the one a born box is on, and its notice would land in the output measured here.
  writeFileSync(join(dir, 'forge.lock'), read('forge.lock'));
  writeFileSync(
    join(dir, '.env'),
    [
      'FORGE_HTTP_PORT=8200',
      'FORGE_ADMIN_HTTP_PORT=8201',
      'FORGE_ADMIN2_HTTP_PORT=8202',
      'FORGE_PUBLIC_ORIGIN=http://localhost:8200',
      `FORGE_STORE_HOSTS=${storeHosts}`,
      // ★ pk24/§B5 — a box promoted to a PUBLIC hostname has neither of these, and it still has to be
      //   demotable. `withTailnetHost: false` is that box.
      withTailnetHost ? `FORGE_TAILNET_HOST=${FAKE_TAILNET_HOST}` : 'FORGE_TAILNET_HOST=',
      withIp && withTailnetHost ? `FORGE_TAILNET_IP=${FAKE_TAILNET_IP}` : 'FORGE_TAILNET_IP=',
      ...(benchBind === null ? [] : [`FORGE_BENCH_BIND=${benchBind}`]),
      '',
    ].join('\n'),
  );

  const sh = (name, body) => writeFileSync(join(stub, name), `#!/usr/bin/env bash\n${body}`, { mode: 0o755 });
  // READ-ONLY, and the stub proves it: anything but `serve status` exits non-zero, so a promotion that tried
  // to CONFIGURE the network would fail here rather than pass quietly.
  sh('tailscale', `[ "$1 $2" = "serve status" ] || exit 64\ncat <<'JSONEOF'\n${serve}\nJSONEOF\n`);
  sh(
    'docker',
    // ⚠️ `set -f` IS LOAD-BEARING. `for pat in $STUB_SET_FAILS` is an unquoted expansion, so without noglob
    //    the pattern `*` is PATHNAME-expanded to the files of the working directory and matches nothing —
    //    measured: the stub said yes to every claim while this file believed it was failing them all.
    //    `case` keeps pattern-matching under `set -f`; only filename expansion is off.
    `set -f\nprintf '%s\\n' "$*" >> "$DOCKER_LOG"\n` +
      `case "$*" in\n` +
      `  *"admin-host.js set"*)\n` +
      `    for pat in \${STUB_SET_FAILS:-}; do\n` +
      `      case "$*" in $pat) exit 1;; esac\n` +
      `    done ;;\n` +
      `esac\n` +
      `exit 0\n`,
  );
  sh(
    'curl',
    `case " $* " in *" -w "*) printf 200; exit 0;; esac\n` +
      `[ "\${STUB_HTTPS_OK:-0}" = 1 ] && exit 0\nexit 22\n`,
  );

  let stdout = '';
  let status = 0;
  try {
    // `2>&1` on purpose: `note`/`say` write to stderr, and what the operator READS is one stream.
    stdout = execFileSync('bash', ['-c', `bash ${JSON.stringify(join(dir, 'bin/box-up.sh'))} ${args.join(' ')} 2>&1`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // ⚠️ A CEILING, because a promotion that HANGS must be red rather than a suite that never ends —
      //    measured while sabotaging pk24/§B5: an argument loop that stopped refusing spun forever on
      //    `--promote` with no destination, and this file sat there for 130 s instead of failing.
      timeout: 60_000,
      env: {
        ...process.env,
        PATH: `${stub}:${process.env.PATH}`,
        FORGE_DOCKER_SH: 'bash -c',
        DOCKER_LOG: log,
        STUB_SET_FAILS: setFails.join(' '),
        STUB_HTTPS_OK: httpsProbeOk ? '1' : '0',
        COMPOSE_PROJECT_NAME: 'forge-promotion-guard',
      },
    });
  } catch (error) {
    stdout = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    status = error.status ?? -1;
  }
  // ★ THE EXIT STATUS IS GRADED, NOT SWALLOWED. `BOXUP=0` on a promotion that claimed nothing is half of the
  //   03/09 defect — an operator (and any script wrapping this) reads the status before the prose.
  assert.equal(
    status,
    expectStatus,
    `the promotion exited ${status}, expected ${expectStatus}:\n${stdout}`,
  );

  const env = Object.fromEntries(
    readFileSync(join(dir, '.env'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  // ⚠️ THE LOG ONLY EXISTS ONCE THE STUB HAS BEEN RUN, and a run that REFUSES before it touches the box
  //    never runs it — which is exactly the case pk24/§B5 measures ("no destination", "nothing to release").
  //    Reading it unconditionally turned those into an ENOENT instead of the empty call list they are.
  // ★ pk24/d4 — AN ABSENT LOG IS A RESULT, NOT A CRASH. A run that refuses before it reaches the first
  // `docker compose` never touches the stub, so the file is not there at all — which is itself the strongest
  // form of "it wrote nothing", and the tests that assert `calls` is empty depend on being able to see it.
  const calls = (existsSync(log) ? readFileSync(log, 'utf8') : '')
    .split('\n')
    .filter((l) => l.includes('admin-host.js'))
    .map((l) => l.slice(l.indexOf('admin-host.js') + 'admin-host.js'.length).trim());
  rmSync(dir, { recursive: true, force: true });
  return { env, calls, stdout, status };
}

/** The admin doors this run ANNOUNCED, as `host:port` — the block a human reads to know what to type. */
const announcedDoors = (stdout) => [...stdout.matchAll(/^\s*admin\s+https?:\/\/([^\s/]+)/gm)].map((m) => m[1]);

test('★★★ pk6·D2 — `--tailnet` claims the PUBLISHED door, not the internal port', () => {
  const { env, calls, stdout } = runPromotion({ mode: 'tailnet', serve: SERVE_PUBLISHING });

  // 1 · the admin directory. `tailscale serve` puts T1 on 8443 and T2 on 8444; those are the two `Host`
  //     headers the admin will ever see from a browser on this tailnet.
  assert.ok(
    calls.includes(`set ${FAKE_TAILNET_HOST}:8443 forgeco`),
    `the first tenant's admin was not claimed on its published port. Calls:\n  ${calls.join('\n  ')}`,
  );
  assert.ok(
    calls.includes(`set ${FAKE_TAILNET_HOST}:8444 forgecafe`),
    `the second tenant's admin was not claimed on its published port. Calls:\n  ${calls.join('\n  ')}`,
  );
  // 2 · and the internal-port spelling is NOT claimed. It is the address that opens the login page and then
  //     cannot keep the session — claiming it is what made the failure silent.
  for (const stale of [`set ${FAKE_TAILNET_HOST}:8201 forgeco`, `set ${FAKE_TAILNET_HOST}:8202 forgecafe`]) {
    assert.ok(!calls.includes(stale), `the promotion still claims an http door a browser cannot hold a session on: \`${stale}\``);
  }
  // 3 · …it is RELEASED, because a box promoted by the old script is holding it.
  assert.ok(
    calls.includes(`remove ${FAKE_TAILNET_HOST}:8201`) && calls.includes(`remove ${FAKE_TAILNET_HOST}:8202`),
    `the superseded spelling is left behind. A stale front door is worse than no front door. Calls:\n  ${calls.join('\n  ')}`,
  );
  // 4 · the tailnet IP is the same node and the same listeners, so it gets the same published ports.
  assert.ok(
    calls.includes(`set ${FAKE_TAILNET_IP}:8443 forgeco`),
    `FORGE_TAILNET_IP was not given the published port. Calls:\n  ${calls.join('\n  ')}`,
  );

  // 5 · the three .env values a front reads at boot.
  assert.equal(env.FORGE_PUBLIC_ORIGIN, `https://${FAKE_TAILNET_HOST}`, 'the vitrine is published on 443, so the origin is the bare https host (a browser omits 443).');
  assert.equal(env.FORGE_GATE_ADMIN_URL, `https://${FAKE_TAILNET_HOST}:8443`, "the gate's link to the admin still points at a door that cannot hold a session.");
  const siblings = JSON.parse(env.FORGE_ADMIN_SIBLINGS.replace(/^'|'$/g, ''));
  assert.deepEqual(
    siblings.map((s) => s.url).sort(),
    [`https://${FAKE_TAILNET_HOST}:8443`, `https://${FAKE_TAILNET_HOST}:8444`],
    'the sibling switcher sends the operator to an address the browser cannot keep a session on.',
  );
  // 6 · and the host → store map answers for the address the vitrine is actually opened at.
  const map = JSON.parse(env.FORGE_STORE_HOSTS.replace(/^'|'$/g, ''));
  assert.ok(map[FAKE_TAILNET_HOST], 'the tailnet host resolves to no store — every page would 404.');
  assert.ok(map.localhost, 'localhost lost its store. That is the local working door, and it must keep working.');

  // 7 · …and the promotion NEVER touches a `localhost` claim. `localhost:8201` / `:8202` are written at
  //     BIRTH and they are the door the box is worked through locally; a promotion that released or
  //     re-pointed them would take the laptop away to give the tailnet back.
  assert.ok(
    !calls.some((c) => /\blocalhost\b|\b127\.0\.0\.1\b/.test(c)),
    `the promotion touched a local claim:\n  ${calls.join('\n  ')}`,
  );

  // 8 · …and the run PRINTS the doors, because the port an operator has to type changed. Somebody who
  //     re-types yesterday's `:8201` gets a login page that refuses, and the terminal is where they look.
  assert.match(
    stdout,
    new RegExp(`admin\\s+https://${FAKE_TAILNET_HOST}:8443`),
    `the promotion never printed the admin's new address:\n${stdout}`,
  );
});

test('★★ pk6·D2 — with nothing published AND the doors on the network, the promotion behaves as it always did', () => {
  // The operator who never ran `tailscale serve` (or a box where `tailscale` cannot be read) must not get a
  // WORSE box than before this change: the direct ports really are reachable over a tailnet.
  //
  // ⚠️ pk24/d4 NARROWED THE CONDITION OF THAT SENTENCE, and this test is what says so. "The direct ports
  // really are reachable" is true only of a box that publishes them on the network — `FORGE_BENCH_BIND`
  // absent or empty. The box `.env.example` now ships binds them to `127.0.0.1`, and there the same fallback
  // is a port that refuses to connect; the two tests below own that case. The fixture leaves the variable
  // out on purpose, so this one keeps grading the configuration it was written for.
  const { env, calls } = runPromotion({ mode: 'tailnet', serve: SERVE_NOTHING });
  assert.ok(calls.includes(`set ${FAKE_TAILNET_HOST}:8201 forgeco`), `the fallback stopped claiming the direct port. Calls:\n  ${calls.join('\n  ')}`);
  assert.ok(calls.includes(`set ${FAKE_TAILNET_HOST}:8202 forgecafe`), `the fallback stopped claiming the direct port. Calls:\n  ${calls.join('\n  ')}`);
  assert.equal(env.FORGE_PUBLIC_ORIGIN, `http://${FAKE_TAILNET_HOST}:8200`, 'with no published door and no TLS on 443, the origin is the port this box listens on.');
  assert.equal(env.FORGE_GATE_ADMIN_URL, `http://${FAKE_TAILNET_HOST}:8201`);
});

// ── pk24/d4 · A PROMOTION TO AN ADDRESS NOTHING ANSWERS IS NOT A PROMOTION ────────────────────────────────
//
// ⛔ THE DEFECT, MEASURED 2026-09-08. Every door of this box is plain http and every front runs
// `NODE_ENV=production`, so the cookies are `Secure` and a browser refuses them on any plain-http origin but
// `localhost` — the shop loses the cart, the admin loses the session, both in silence. `compose.yml` now
// publishes all five doors on `${FORGE_BENCH_BIND?…}` and `.env.example` ships `127.0.0.1`, so the plain-http
// tailnet address is not merely a trap any more: nothing answers on it at all.
//
// The promotion is the one thing on this box that HANDS ADDRESSES OUT — it prints them, claims them in the
// admin directory, and writes three of them into `.env`. So it is the place that must not offer one.

test('★★★ pk24/d4 — nothing published + doors on loopback ⇒ the promotion REFUSES, and writes nothing', () => {
  const { env, calls, stdout } = runPromotion({
    mode: 'tailnet',
    serve: SERVE_NOTHING,
    benchBind: '127.0.0.1',
    expectStatus: 1,
  });
  assert.match(
    stdout,
    /tailscale publishes nothing for box\.example\.test/,
    `the refusal does not name the host it could not promote to:\n${stdout}`,
  );
  assert.match(
    stdout,
    /would refuse to connect/,
    `the refusal does not say WHY the fallback address is not an address any more:\n${stdout}`,
  );
  assert.match(
    stdout,
    /FORGE_BENCH_BIND=/,
    `the refusal does not name the one variable that changes the answer, so an operator with a real reason ` +
      `(a LAN device, no tailnet) is told to stop and not how to proceed:\n${stdout}`,
  );
  // ★★ ATOMIC, and this is the half that matters more than the message. The refusal lands BEFORE the first
  // `.env` write: a box refused here is byte-for-byte the box that ran the command. Half a promotion leaves
  // FORGE_STORE_HOSTS pointing at a network while FORGE_PUBLIC_ORIGIN mints image URLs somewhere else.
  assert.equal(env.FORGE_PUBLIC_ORIGIN, 'http://localhost:8200', 'the refusal rewrote FORGE_PUBLIC_ORIGIN.');
  assert.equal(
    env.FORGE_STORE_HOSTS,
    `'{"localhost":"sto_01TEST","localhost:8200":"sto_01TEST"}'`,
    'the refusal rewrote the host → store map.',
  );
  assert.equal(env.FORGE_ADMIN_SIBLINGS, undefined, 'the refusal wrote a sibling list for a network it refused.');
  assert.deepEqual(calls, [], `the refusal claimed admin doors on ports that refuse to connect:\n  ${calls.join('\n  ')}`);
});

test('★★ pk24/d4 — a PARTIAL publication names the doors that are not doors, and does not exit 0', () => {
  // The quiet half: `tailscale serve` fronts the shop and both admins but never got a rule for the counter.
  // Three doors are real, the fourth falls back to `http://<host>:8203` — a port bound to loopback. A list of
  // doors that contains one that is not a door is worse than a short list.
  const SERVE_WITHOUT_THE_COUNTER = JSON.stringify({
    TCP: { 443: { HTTPS: true }, 8443: { HTTPS: true }, 8444: { HTTPS: true } },
    Web: {
      [`${FAKE_TAILNET_HOST}:443`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8200' } } },
      [`${FAKE_TAILNET_HOST}:8443`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8201' } } },
      [`${FAKE_TAILNET_HOST}:8444`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:8202' } } },
    },
  });
  const { stdout } = runPromotion({
    mode: 'tailnet',
    serve: SERVE_WITHOUT_THE_COUNTER,
    benchBind: '127.0.0.1',
    expectStatus: 1,
  });
  assert.match(
    stdout,
    new RegExp(`UNREACHABLE http://${FAKE_TAILNET_HOST}:8203\\s+\\(totem\\)`),
    `the counter's dead door was printed among the live ones with nothing marking it:\n${stdout}`,
  );
  // …and the three that ARE published are not accused, or the rule is just noise.
  assert.ok(
    !/UNREACHABLE .*8443|UNREACHABLE .*8444|UNREACHABLE https/.test(stdout),
    `a door \`tailscale serve\` really publishes was called unreachable:\n${stdout}`,
  );
});

test('★★ pk6·D2 — `--localhost` releases BOTH spellings and puts the box back', () => {
  const { env, calls } = runPromotion({ mode: 'localhost', serve: SERVE_PUBLISHING });
  for (const door of [`${FAKE_TAILNET_HOST}:8443`, `${FAKE_TAILNET_HOST}:8201`, `${FAKE_TAILNET_HOST}:8444`, `${FAKE_TAILNET_HOST}:8202`]) {
    assert.ok(calls.includes(`remove ${door}`), `the reverse leaves \`${door}\` claimed for a network the box no longer serves. Calls:\n  ${calls.join('\n  ')}`);
  }
  assert.ok(!calls.some((c) => c.startsWith('set ')), 'the reverse claimed something.');
  assert.ok(
    !calls.some((c) => /\blocalhost\b|\b127\.0\.0\.1\b/.test(c)),
    `the reverse touched a local claim, which is the door it is putting the box back onto:\n  ${calls.join('\n  ')}`,
  );
  assert.equal(env.FORGE_PUBLIC_ORIGIN, 'http://localhost:8200');
  assert.equal(env.FORGE_GATE_ADMIN_URL, '');
  const siblings = JSON.parse(env.FORGE_ADMIN_SIBLINGS.replace(/^'|'$/g, ''));
  assert.deepEqual(siblings.map((s) => s.url).sort(), ['http://localhost:8201', 'http://localhost:8202']);
});

test('★★★ pk30/§2 — the way BACK exits 0 on the FIRST pass and never reports an admin-door count', () => {
  // ⛔ THE DEFECT, MEASURED ON THE BOX 09/09. `--promote localhost` exited non-zero on its first pass with
  // `the promotion is INCOMPLETE: 0 of 0 admin door(s) claimed. See the REFUSED line(s) above.` — and that
  // sentence could not have been the cause: on this direction `$claimed` and `$expected` are STRUCTURALLY zero
  // (the loop that fills them is inside the `out` branch), so it was a fixed string printed over a failure in
  // the SHOP'S ADDRESS check, pointing the operator at REFUSED lines that were never printed.
  //
  // ★ `expectStatus: 0` IS THE DEFAULT AND IT WAS ALREADY TRUE HERE — which is itself the measurement: the
  // repo's own fixture has always demoted this box to exit 0, so `0 of 0` was never what graded the direction.
  // What this test adds is the sentence: the verdict may not mention a door count on a direction that owes none.
  const { stdout } = runPromotion({ mode: 'localhost', serve: SERVE_PUBLISHING });
  assert.match(stdout, /the promotion is COMPLETE/, stdout);
  assert.match(stdout, /no admin door to claim on the way back/, stdout);
  assert.doesNotMatch(
    stdout,
    /admin door\(s\) claimed/,
    `the way back is reporting an admin-door count again:\n${stdout}`,
  );
  assert.doesNotMatch(stdout, /See the REFUSED line\(s\) above/, stdout);
});

test('★★★ pk30/§2 — …and the way OUT still REDS when it claims fewer doors than it owes, naming them', () => {
  // ⚠️ THE HALF THAT KEEPS THE REPAIR HONEST. Deriving the expectation per destination must not soften the
  // other direction: a promotion outwards that left one brand's admin unclaimed is still INCOMPLETE, still
  // exits 1, and still says `N of M`. `setFails` makes the directory refuse the café's door.
  const { stdout } = runPromotion({
    mode: 'tailnet',
    serve: SERVE_PUBLISHING,
    setFails: ['*forgecafe*'],
    expectStatus: 1,
  });
  assert.match(stdout, /the promotion is INCOMPLETE/, stdout);
  assert.match(stdout, /the admin doors: 2 of 4 claimed/, stdout);
  assert.match(stdout, /unknown_admin_host/, stdout);
});

// ── pk24·§B5 · THE PROMOTION IS A NAMED STEP WITH A DESTINATION, AND THE TAILNET IS ONE OF THEM ───────────
//
// ⛔ WHAT WAS WRONG. `bash bin/box-up.sh --tailnet` was a MODE of this bench, so the only address this box
// could be pointed at was a private network read out of `tailscale serve`. Online there is no tailnet — and
// the thing that has to happen there is the SAME thing: the origin every front mints image URLs from, the
// host → store map, and each tenant's admin door claimed through the port. That was the last piece of the
// pipeline that only existed as a gesture somebody remembered to make.
//
// ★ SO THE DESTINATION IS AN ARGUMENT. These two tests run the promotion for real against a destination that
// is NOT a tailnet — the tailscale stub is never asked, because nothing here can read what publishes a
// public hostname — and then put the box back with no tailnet variable in `.env` at all.

const FAKE_PUBLIC_HOST = 'demo.example.test';

test('★★★ pk24·§B5 — `--promote <hostname>` points the box at a public address, with no tailnet anywhere', () => {
  const { env, calls, stdout } = runPromotion({
    args: ['--promote', FAKE_PUBLIC_HOST],
    serve: SERVE_PUBLISHING, // published, and DELIBERATELY irrelevant: this destination is not the tailnet
    withTailnetHost: false,
  });

  // 1 · each tenant's admin door, claimed on the port this box itself listens on. Nothing here can read what
  //     publishes a public hostname, so the honest door is the box's own — and the run says so out loud.
  assert.ok(
    calls.includes(`set ${FAKE_PUBLIC_HOST}:8201 forgeco`) && calls.includes(`set ${FAKE_PUBLIC_HOST}:8202 forgecafe`),
    `the public destination's admin doors were not claimed. Calls:\n  ${calls.join('\n  ')}`,
  );
  // 2 · and NOT on the tailnet's published ports: this run never asked tailscale anything.
  assert.ok(
    !calls.some((c) => c.includes(FAKE_TAILNET_HOST) || c.includes('8443') || c.includes('8444')),
    `the promotion used the tailnet table for a destination that is not the tailnet:\n  ${calls.join('\n  ')}`,
  );
  // 3 · the three values a front reads at boot, pointed at the public address.
  assert.equal(env.FORGE_PUBLIC_ORIGIN, `http://${FAKE_PUBLIC_HOST}:8200`, 'the kernel would keep minting image URLs at localhost.');
  assert.equal(env.FORGE_GATE_ADMIN_URL, `http://${FAKE_PUBLIC_HOST}:8201`);
  const map = JSON.parse(env.FORGE_STORE_HOSTS.replace(/^'|'$/g, ''));
  assert.ok(map[FAKE_PUBLIC_HOST], '`store.host` is what ROUTES — a hostname the box does not hold is a 404 with nothing saying why.');
  assert.ok(map.localhost, 'localhost lost its store; the laptop is how this box is worked on.');
  // 4 · …and the laptop's own admin claims are untouched, exactly as with the tailnet.
  assert.ok(
    !calls.some((c) => /\blocalhost\b|\b127\.0\.0\.1\b/.test(c)),
    `the promotion touched a local claim:\n  ${calls.join('\n  ')}`,
  );
  assert.match(stdout, new RegExp(`admin\\s+http://${FAKE_PUBLIC_HOST}:8201`), `the promotion never printed the admin's address:\n${stdout}`);
});

// ── pk35/d4 · THE EDGE'S SIX HOSTNAMES, WRITTEN BY THE PROMOTION AND NOT BY HAND ─────────────────────────
//
// ⛔ THE GAP. Since pk34/d1 every face of this box is DECLARED — one `domain` per store, one `admin_domain`
// per tenant, each naming the variable `caddy/Caddyfile` reads it from — and `bin/box-domains.guard.mjs`
// grades all three ends of that wire. Nothing ever WROTE the value: the promotion rewrote four variables and
// none of the six, so a deployment of this instance typed its own hostnames into a `.env` beside a file that
// already declared them. The failure of a half-filled edge is not a crash — every address carries a
// `.unset.localhost` sentinel — it is one shop answering on a name nothing resolves, and no log.
//
// ★ THESE RUN THE PROMOTION FOR REAL, against this repository's own `seed/box.json` and `caddy/Caddyfile`.
// Nothing below types a hostname: the expectation IS the declaration, so a store renamed in that file moves
// this test with it and a store that loses its declaration turns it red.

const FACES = declaredFaces(readBox(ROOT));

test("★★★ pk35/d4 — promoted to a hostname it DECLARES, the box writes every face of the edge from seed/box.json", () => {
  // ANTI-VACUUM FIRST: an assertion loop over an empty declaration would pass having graded nothing, and the
  // whole point of this slice is that the declaration is where the hostnames live.
  assert.ok(FACES.length >= 2, `seed/box.json declares ${FACES.length} face(s) — there is nothing to write.`);
  const arrival = FACES.find((f) => f.kind === 'store');
  assert.ok(arrival, 'no store face is declared, so no destination here is one of this box\'s own addresses.');

  const { env, stdout } = runPromotion({
    args: ['--promote', arrival.host],
    serve: SERVE_NOTHING,
    withTailnetHost: false,
  });

  const wrong = FACES.filter((f) => env[f.env] !== f.host).map(
    (f) => `${f.env}=${env[f.env] ?? '(absent)'} and seed/box.json declares ${f.host} for ${f.label}`,
  );
  assert.deepEqual(
    wrong,
    [],
    'the promotion did not write this face into .env, so the edge falls back to its `.unset.localhost` ' +
      'sentinel: Caddy loads, the other faces serve, and that hostname answers on a name nothing resolves ' +
      `with nothing in any log.\n${stdout}`,
  );
  assert.match(stdout, /face\(s\) written from seed\/box\.json/, `the run never said it wrote them:\n${stdout}`);
});

test('★★ pk35/d4 — promoted SOMEWHERE ELSE, it writes none of them, and says so instead of going quiet', () => {
  // ⚠️ THE BENCH, MEASURED 2026-09-13: `.env` holds a tailnet origin with `FORGE_DOMAIN=localhost`. The
  // declared hostnames are not addresses that box answers at, so writing them would publish names nothing
  // routes to and hand `bin/verify-config.mjs` six "published" faces to fail. A promotion elsewhere leaves
  // the edge alone — and the negative has to be a line on the screen, because a face silently not written is
  // exactly the state this slice exists to end.
  const { env, stdout } = runPromotion({
    args: ['--promote', FAKE_PUBLIC_HOST],
    serve: SERVE_NOTHING,
    withTailnetHost: false,
  });
  assert.ok(
    !FACES.some((f) => f.host === FAKE_PUBLIC_HOST),
    `the fixture hostname is one of this box's declared faces, so this test grades the other branch.`,
  );
  assert.deepEqual(
    FACES.filter((f) => env[f.env] !== undefined).map((f) => `${f.env}=${env[f.env]}`),
    [],
    `a destination this box does not declare had its edge hostnames rewritten anyway:\n${stdout}`,
  );
  assert.match(
    stdout,
    new RegExp(`is not one of the ${FACES.length} face`),
    `the run wrote nothing and did not say why:\n${stdout}`,
  );
});

test('★★★ pk35/d4 — a face the edge READS and the declaration LOST is a refusal, named, with nothing written', () => {
  // THE SABOTAGE, AS A CASE. A store that loses its `domain` leaves `caddy/Caddyfile` with a site block for a
  // variable nothing declares — and the tempting behaviour is to write the other five and let that one fall
  // back to `outlet.unset.localhost`. That is the silent half-published edge with a nicer coat on, so the
  // promotion refuses and names it, BEFORE the first `.env` write.
  const box = JSON.parse(read('seed/box.json'));
  const victim = box.tenants.flatMap((t) => t.stores ?? []).find((st) => st.domain);
  assert.ok(victim, 'no store in seed/box.json declares a `domain` — this case cannot be built.');
  const lost = victim.domain;
  delete victim.domain;

  const arrival = FACES.find((f) => f.kind === 'store' && f.env !== lost.env);
  assert.ok(arrival, 'the declaration has only one store face, so there is no destination left to arrive at.');

  const { env, stdout, calls } = runPromotion({
    args: ['--promote', arrival.host],
    serve: SERVE_NOTHING,
    withTailnetHost: false,
    box: JSON.stringify(box, null, 2),
    expectStatus: 1,
  });

  assert.match(stdout, new RegExp(`\\{\\$${lost.env}\\}`), `the refusal never named the variable:\n${stdout}`);
  assert.match(stdout, /unset\.localhost/, `the refusal never named the sentinel the operator would have got:\n${stdout}`);
  assert.match(stdout, /caddy\/Caddyfile:\d+/, `the refusal never named the line that reads it:\n${stdout}`);
  // ⛔ AND IT IS ATOMIC. The refusal happens among the reads, so the box is byte-for-byte the box that ran
  // the command: no face written, no other value rewritten, no door claimed.
  assert.equal(env.FORGE_PUBLIC_ORIGIN, 'http://localhost:8200', `the refusal wrote FORGE_PUBLIC_ORIGIN anyway:\n${stdout}`);
  assert.deepEqual(
    FACES.filter((f) => env[f.env] !== undefined).map((f) => `${f.env}=${env[f.env]}`),
    [],
    `a refused promotion wrote a face anyway:\n${stdout}`,
  );
  assert.deepEqual(calls, [], `a refused promotion touched the admin directory:\n${stdout}`);
});

test('★★ pk35/d4 — a box that declares NO face at all is still promoted, as a bench, out loud', () => {
  // THE ANTI-VACUUM OF THE RULE ABOVE. "Every declared face is written" is also true of a box that declares
  // none, and that box must not be refused: the host → store map, the origin and the admin doors ARE the
  // promotion; the faces are the edge. A deployment that has not chosen its hostnames yet is this box.
  const box = JSON.parse(read('seed/box.json'));
  for (const tenant of box.tenants) {
    delete tenant.admin_domain;
    for (const store of tenant.stores ?? []) delete store.domain;
  }
  const { env, stdout } = runPromotion({
    args: ['--promote', FAKE_PUBLIC_HOST],
    serve: SERVE_NOTHING,
    withTailnetHost: false,
    box: JSON.stringify(box, null, 2),
  });
  assert.equal(env.FORGE_PUBLIC_ORIGIN, `http://${FAKE_PUBLIC_HOST}:8200`, `the promotion itself did not happen:\n${stdout}`);
  assert.match(stdout, /declares no face at all/, `a box with no declared face was promoted in silence:\n${stdout}`);
});

test('★★★ pk24·§B5 — the way BACK reads the addresses off the BOX, not out of FORGE_TAILNET_HOST', () => {
  // The box this describes was promoted to a public hostname: `.env` holds the map that promotion wrote and
  // NO tailnet variable. Before pk24 the reverse refused here — it could only release a name it was told —
  // so a box promoted by a pipeline could not be put back by one.
  const { env, calls } = runPromotion({
    args: ['--promote', 'localhost'],
    serve: SERVE_NOTHING,
    withTailnetHost: false,
    storeHosts: `'{"localhost":"sto_01TEST","localhost:8200":"sto_01TEST","${FAKE_PUBLIC_HOST}":"sto_01TEST","${FAKE_PUBLIC_HOST}:8200":"sto_01TEST"}'`,
  });

  for (const door of [`${FAKE_PUBLIC_HOST}:8201`, `${FAKE_PUBLIC_HOST}:8202`]) {
    assert.ok(
      calls.includes(`remove ${door}`),
      `the reverse leaves \`${door}\` claimed for an address the box no longer serves. Calls:\n  ${calls.join('\n  ')}`,
    );
  }
  assert.ok(!calls.some((c) => c.startsWith('set ')), 'the reverse claimed something.');
  assert.equal(env.FORGE_PUBLIC_ORIGIN, 'http://localhost:8200');
  const map = JSON.parse(env.FORGE_STORE_HOSTS.replace(/^'|'$/g, ''));
  assert.ok(!map[FAKE_PUBLIC_HOST], 'the host → store map still routes the public hostname the box was just taken off.');
});

test('★★ pk24·§B5 — a box that was never promoted has nothing to release, and says so instead of guessing', () => {
  // ⚠️ THE VACUUM CASE. With no tailnet variable and a map holding only this machine, there is no hostname to
  //    release — and "released 0" printed cheerfully is the shape of a green that proves nothing.
  const { stdout } = runPromotion({
    args: ['--promote', 'localhost'],
    serve: SERVE_NOTHING,
    withTailnetHost: false,
    expectStatus: 1,
  });
  assert.match(stdout, /does not look promoted/i, `the refusal does not say what is wrong:\n${stdout}`);
});

test('★★ pk24·§B5 — `--promote` with no destination REFUSES and names the destinations', () => {
  // The ruler of this sprint: a step that works only because somebody knew what to type is not ready. A
  // missing destination must not fall through to "the tailnet", which is what a default would mean.
  const { stdout, calls } = runPromotion({ args: ['--promote'], serve: SERVE_NOTHING, expectStatus: 1 });
  assert.match(stdout, /needs a DESTINATION/, `the refusal does not name what is missing:\n${stdout}`);
  assert.match(stdout, /tailnet/, `the refusal does not name the destinations it accepts:\n${stdout}`);
  assert.equal(calls.length, 0, 'a refused invocation still talked to the box.');
});

// ── pk7·D1 · THE SUMMARY IS DERIVED FROM WHAT WAS DONE, NEVER FROM WHAT WAS ASKED ─────────────────────────
//
// ⛔ TWO DEFECTS OF THE BIRTH OF 03/09, AND THEY ARE ONE DEFECT OF FORM. Both blocks that speak at the end of
// the promotion read `seed/box.json` again instead of reading what the run achieved:
//
//   F2 — `--tailnet` on a box that had just been TORN DOWN printed the whole green summary and exited 0:
//        `admin https://<tailnet>:8443 (forgeco)`, `admin https://<tailnet>:8444 (forgecafe)`,
//        `edge → 200`, `BOXUP=0` — with `admin directory · 0 claim(s) set · 0 released` buried among the
//        green lines. The two tenant names came from the file; the directory held nothing. An operator who
//        ran the runbook out of order left believing the box was promoted.
//
//   F7 — the claim loop ended after ONE tenant (`docker compose run` was draining the here-doc; fixed in
//        pk6·D2's sibling slice) and the door block, re-reading the same here-doc from the start, printed
//        BOTH doors anyway. The counter said 1 and was RIGHT — nobody compared it with the two it expected,
//        and the screen derived from the other source.
//
// So: zero of N is a refusal, a partial claim is loud and non-zero, and the door block prints the doors the
// DIRECTORY ACCEPTED. These three tests are the only ones in this file where a claim is allowed to fail.

test('★★★ pk7·D1 — a box that was never born REFUSES the promotion instead of printing a green summary', () => {
  // Every `set` fails, which is what an empty directory does: the tenants those doors point at do not exist.
  const { env, calls, stdout, status } = runPromotion({
    mode: 'tailnet',
    serve: SERVE_PUBLISHING,
    setFails: ['*'],
    expectStatus: 1,
  });

  assert.ok(calls.some((c) => c.startsWith('set ')), 'the promotion never even tried to claim — this test is measuring nothing.');
  assert.notEqual(status, 0, 'a promotion that claimed nothing exited 0.');
  assert.match(
    stdout,
    /has not been born/i,
    `the refusal does not say what is wrong. The operator ran the runbook out of order and the only honest ` +
      `sentence is "this box has not been born yet":\n${stdout}`,
  );
  assert.match(stdout, /bin\/box-up\.sh/, 'the refusal never names the command that fixes it.');
  assert.deepEqual(
    announcedDoors(stdout),
    [],
    `the promotion announced admin doors that answer for no tenant:\n${stdout}`,
  );
  assert.doesNotMatch(
    stdout,
    /health → 200/,
    'the run reached its green health line. `edge → 200` after zero claims is the sentence that made F2 read as success.',
  );

  // ★★ AND THE REFUSAL IS ATOMIC. A `--tailnet` that refuses must leave `.env` untouched, because BIRTH
  //    rewrites FORGE_STORE_HOSTS and NEVER rewrites FORGE_PUBLIC_ORIGIN: a half-promoted box would then be
  //    born on localhost while the kernel minted every product-image URL on a tailnet origin. Silent, and
  //    the same mixed-content evening the promotion's own comments record.
  assert.equal(
    env.FORGE_PUBLIC_ORIGIN,
    'http://localhost:8200',
    'the refused promotion re-pointed FORGE_PUBLIC_ORIGIN at a network this box cannot serve.',
  );
  assert.equal(
    env.FORGE_STORE_HOSTS,
    `'{"localhost":"sto_01TEST","localhost:8200":"sto_01TEST"}'`,
    'the refused promotion rewrote the host → store map.',
  );
  assert.ok(!('FORGE_GATE_ADMIN_URL' in env), 'the refused promotion wrote FORGE_GATE_ADMIN_URL.');
  assert.ok(!('FORGE_ADMIN_SIBLINGS' in env), 'the refused promotion wrote FORGE_ADMIN_SIBLINGS.');
});

test('★★★ pk7·D1 — two tenants claimed means two doors printed, and the count says two of two', () => {
  const { calls, stdout } = runPromotion({ mode: 'tailnet', serve: SERVE_PUBLISHING });
  const tenants = JSON.parse(read('seed/box.json')).tenants.map((t) => t.id);
  assert.ok(tenants.length >= 2, 'seed/box.json declares fewer than two tenants — there is nothing to compare.');

  for (const t of tenants) {
    assert.ok(
      calls.includes(`set ${FAKE_TAILNET_HOST}:${t === tenants[0] ? 8443 : 8444} ${t}`),
      `${t}'s door was not claimed on the published port. Calls:\n  ${calls.join('\n  ')}`,
    );
  }
  assert.deepEqual(
    announcedDoors(stdout).sort(),
    [`${FAKE_TAILNET_HOST}:8443`, `${FAKE_TAILNET_HOST}:8444`],
    `the door block does not print exactly the two doors that were claimed:\n${stdout}`,
  );
  // The count is stated against the number EXPECTED — a bare "1 claim(s) set" is a number nobody can grade.
  assert.match(
    stdout,
    /admin directory · \d+ of \d+ claim\(s\) set/,
    `the claim count is not stated against what was expected, so "1" and "2" read the same:\n${stdout}`,
  );
});

test('★★★ pk7·D1 — a door the directory REFUSED is not announced, and the run does not exit 0', () => {
  // The second tenant's claim fails; the first's holds. This is F7's shape with the here-doc bug repaired:
  // the loop reaches both, and only one of them takes.
  const { calls, stdout, status } = runPromotion({
    mode: 'tailnet',
    serve: SERVE_PUBLISHING,
    setFails: ['*forgecafe*'],
    expectStatus: 1,
  });

  assert.ok(calls.includes(`set ${FAKE_TAILNET_HOST}:8443 forgeco`), `the tenant that CAN be claimed was not. Calls:\n  ${calls.join('\n  ')}`);
  assert.ok(calls.includes(`set ${FAKE_TAILNET_HOST}:8444 forgecafe`), `the loop never reached the second tenant. Calls:\n  ${calls.join('\n  ')}`);

  assert.deepEqual(
    announcedDoors(stdout),
    [`${FAKE_TAILNET_HOST}:8443`],
    `the promotion announced a door the directory refused. That address opens a login page and then answers ` +
      `\`unknown_admin_host\` — the silent failure this whole block exists to kill:\n${stdout}`,
  );
  assert.match(
    stdout,
    /forgecafe/,
    `the refused tenant is not named anywhere. Missing from the door list is not a message:\n${stdout}`,
  );
  assert.notEqual(status, 0, 'a promotion that claimed one door of two exited 0.');
});
