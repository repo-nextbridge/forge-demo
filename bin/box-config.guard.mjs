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
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

test('★★ A15 — it never runs `tailscale`: getting on the network is the operator\'s gesture', () => {
  assert.doesNotMatch(
    BOX_UP,
    /^[^#\n]*\btailscale\b/m,
    'bin/box-up.sh invokes tailscale. This step wires the BOX to a network that already reaches it; it does ' +
      'not configure that network, and a script that did would be changing state nobody asked it to touch.',
  );
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
  const CGNAT = /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/; // Tailscale's 100.64.0.0/10
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
