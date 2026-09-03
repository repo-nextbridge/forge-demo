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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

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

test('★★ A15 — the promotion exists, is opt-in, and refuses to run without being told WHERE', () => {
  assert.match(BOX_UP, /--tailnet\)\s*MODE=tailnet/, 'bin/box-up.sh has no --tailnet mode.');
  assert.match(BOX_UP, /--localhost\)\s*MODE=localhost/, 'the promotion has no way back; A15 asks for reversible.');
  assert.match(
    BOX_UP,
    /FORGE_TAILNET_HOST:-\}"?\s*\]\s*\|\|\s*die/,
    'the promotion does not DIE when FORGE_TAILNET_HOST is unset. Without the refusal it would write ' +
      '`http://:8200` into FORGE_PUBLIC_ORIGIN — the origin the kernel mints every product-image URL from.',
  );
});

test('★★ A15 — the promotion is idempotent: every .env value is REWRITTEN, never appended', () => {
  const block = BOX_UP.match(/if \[ "\$MODE" != birth \]; then([\s\S]*?)\n  exit 0\nfi/);
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
// looked like writing Renan's own tailnet name into a tracked file, which is the same mistake as the personal
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

function runPromotion({ mode, serve, httpsProbeOk = false, withIp = true }) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-promotion-'));
  const stub = join(dir, 'stub');
  const log = join(dir, 'docker.log');
  mkdirSync(join(dir, 'bin'), { recursive: true });
  mkdirSync(join(dir, 'seed'), { recursive: true });
  mkdirSync(stub, { recursive: true });

  writeFileSync(join(dir, 'bin/box-up.sh'), BOX_UP);
  writeFileSync(join(dir, 'seed/box.json'), read('seed/box.json'));
  // Sourced by box-up before anything else; on the real box it reaches a secret store.
  writeFileSync(join(dir, 'env-source.sh'), 'export DATABASE_URL=postgres://stub/stub\n');
  writeFileSync(join(dir, 'bin/images-from-lock.sh'), ':\n');
  writeFileSync(
    join(dir, '.env'),
    [
      'FORGE_HTTP_PORT=8200',
      'FORGE_ADMIN_HTTP_PORT=8201',
      'FORGE_ADMIN2_HTTP_PORT=8202',
      'FORGE_PUBLIC_ORIGIN=http://localhost:8200',
      `FORGE_STORE_HOSTS='{"localhost":"sto_01TEST","localhost:8200":"sto_01TEST"}'`,
      `FORGE_TAILNET_HOST=${FAKE_TAILNET_HOST}`,
      withIp ? `FORGE_TAILNET_IP=${FAKE_TAILNET_IP}` : 'FORGE_TAILNET_IP=',
      '',
    ].join('\n'),
  );

  const sh = (name, body) => writeFileSync(join(stub, name), `#!/usr/bin/env bash\n${body}`, { mode: 0o755 });
  // READ-ONLY, and the stub proves it: anything but `serve status` exits non-zero, so a promotion that tried
  // to CONFIGURE the network would fail here rather than pass quietly.
  sh('tailscale', `[ "$1 $2" = "serve status" ] || exit 64\ncat <<'JSONEOF'\n${serve}\nJSONEOF\n`);
  sh('docker', `printf '%s\\n' "$*" >> "$DOCKER_LOG"\nexit 0\n`);
  sh(
    'curl',
    `case " $* " in *" -w "*) printf 200; exit 0;; esac\n` +
      `[ "\${STUB_HTTPS_OK:-0}" = 1 ] && exit 0\nexit 22\n`,
  );

  let stdout = '';
  try {
    // `2>&1` on purpose: `note`/`say` write to stderr, and what the operator READS is one stream.
    stdout = execFileSync('bash', ['-c', `bash ${JSON.stringify(join(dir, 'bin/box-up.sh'))} --${mode} 2>&1`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${stub}:${process.env.PATH}`,
        FORGE_DOCKER_SH: 'bash -c',
        DOCKER_LOG: log,
        STUB_HTTPS_OK: httpsProbeOk ? '1' : '0',
        COMPOSE_PROJECT_NAME: 'forge-promotion-guard',
      },
    });
  } catch (error) {
    throw new Error(`the promotion exited ${error.status}:\n${error.stdout ?? ''}${error.stderr ?? ''}`);
  }

  const env = Object.fromEntries(
    readFileSync(join(dir, '.env'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  const calls = readFileSync(log, 'utf8')
    .split('\n')
    .filter((l) => l.includes('admin-host.js'))
    .map((l) => l.slice(l.indexOf('admin-host.js') + 'admin-host.js'.length).trim());
  rmSync(dir, { recursive: true, force: true });
  return { env, calls, stdout };
}

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
  assert.ok(map.localhost, 'localhost lost its store. That is how Renan works on the machine, and it must keep working.');

  // 7 · …and the promotion NEVER touches a `localhost` claim. `localhost:8201` / `:8202` are written at
  //     BIRTH and they are the door Renan works through on the machine; a promotion that released or
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

test('★★ pk6·D2 — with nothing published, the promotion behaves exactly as it always did', () => {
  // The operator who never ran `tailscale serve` (or a box where `tailscale` cannot be read) must not get a
  // WORSE box than before this change: the direct ports really are reachable over a tailnet.
  const { env, calls } = runPromotion({ mode: 'tailnet', serve: SERVE_NOTHING });
  assert.ok(calls.includes(`set ${FAKE_TAILNET_HOST}:8201 forgeco`), `the fallback stopped claiming the direct port. Calls:\n  ${calls.join('\n  ')}`);
  assert.ok(calls.includes(`set ${FAKE_TAILNET_HOST}:8202 forgecafe`), `the fallback stopped claiming the direct port. Calls:\n  ${calls.join('\n  ')}`);
  assert.equal(env.FORGE_PUBLIC_ORIGIN, `http://${FAKE_TAILNET_HOST}:8200`, 'with no published door and no TLS on 443, the origin is the port this box listens on.');
  assert.equal(env.FORGE_GATE_ADMIN_URL, `http://${FAKE_TAILNET_HOST}:8201`);
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
