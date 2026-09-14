// ★★★ THE EDGE'S HOSTNAMES — WHO DERIVES THEM, WHO WRITES THEM, AND WHO EVER SEES THEM.
//
// ⛔ THE GAP THIS SLICE CLOSES. Since pk34/d1 a face of this box has three ends — `seed/box.json` declares
// the hostname, `caddy/Caddyfile` decides which container answers there, compose delivers the variable that
// joins them — and `bin/box-domains.guard.mjs` grades all three. What nothing did was WRITE THE VALUE: a
// deployment of this instance typed six hostnames into a `.env` beside a file that already declared them.
//
// ⚠️ AND THE FAILURE OF GETTING IT HALF RIGHT IS NOT A CRASH. Every address in `caddy/Caddyfile` carries a
// `<something>.unset.localhost` sentinel (pk34, measured), so a missing variable costs ONE face on a name
// nothing resolves while the other five serve. That is why the rule here is COMPLETE-OR-REFUSE.
//
// ── ★★ AND THE HALF THAT MAKES ANY OF IT REACH A CONTAINER ──────────────────────────────────────────────
//
// ⛔ MEASURED ON THE LIVE BENCH 2026-09-13, and it is the quietest defect in this file: `.env` held
// `FORGE_ADMIN_SIBLINGS='[…"https://<tailnet>:8443"…]'` and the admin container — recreated by this script
// TEN SECONDS after that line was written — held the birth's `[…"http://localhost:8201"…]`. The file was
// right and the box was wrong.
//
// ★ THE CAUSE IS NOT THE ORDER OF THE RECREATE, which is what the card suspected. `bin/box-up.sh` sources
// `.env` under `set -a`, so every value is EXPORTED into that shell, and compose's interpolation prefers the
// SHELL over `.env`. Measured with a throwaway project: `docker compose config` answers `from-dotenv` with
// nothing exported and `from-shell` with the variable exported. So any value `put_env` writes mid-run reaches
// the file and NOT the containers recreated after it. Six more such values were about to be added here.
//
//   node --test bin/promotion-faces.guard.mjs        (or: bash bin/test.sh)

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { declaredFaces, envSitesOf, faceCoverage, readBox } from './box-domains.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'bin/promotion-faces.mjs');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const BOX_UP = read('bin/box-up.sh');

const FACES = declaredFaces(readBox(ROOT));
const ENV_SITES = envSitesOf(read('caddy/Caddyfile'));

/** The module run as `bin/box-up.sh` runs it: stdout is the plan, stderr is the operator's sentence. */
function plan({ destination, root = ROOT, env = {} }) {
  const args = [SCRIPT, '--root', root];
  if (destination !== undefined) args.push('--destination', destination);
  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    // ⚠️ A CLEAN ENVIRONMENT, because `current` is read from it: inheriting this shell's would make the
    // before → after line depend on whoever ran the suite.
    env: { PATH: process.env.PATH ?? '', ...env },
  });
  return {
    status: r.status ?? -1,
    writes: (r.stdout ?? '').split('\n').filter(Boolean).map((l) => l.split('\t')),
    said: r.stderr ?? '',
  };
}

/** A box of one's own: whatever declaration and whatever edge a case needs. */
function fixture({ box, caddyfile = read('caddy/Caddyfile') }) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-faces-'));
  mkdirSync(join(dir, 'seed'), { recursive: true });
  mkdirSync(join(dir, 'caddy'), { recursive: true });
  writeFileSync(join(dir, 'seed/box.json'), typeof box === 'string' ? box : JSON.stringify(box, null, 2));
  writeFileSync(join(dir, 'caddy/Caddyfile'), caddyfile);
  return dir;
}

// ── 0 · THE VACUUM ──────────────────────────────────────────────────────────────────────────────────────

test('⛔ THE VACUUM CHECK — this box really declares faces and its edge really reads variables', () => {
  assert.ok(FACES.length >= 2, `seed/box.json declares ${FACES.length} face(s); every rule below would pass over nothing.`);
  assert.ok(ENV_SITES.length >= 2, `caddy/Caddyfile yielded ${ENV_SITES.length} variable-addressed site block(s) — the PARSER, not the edge.`);
  const { unrouted, undeclared } = faceCoverage(FACES, ENV_SITES);
  assert.deepEqual(unrouted.map((f) => f.env), [], 'this repository already has a face with no site block — fix that before reading anything below.');
  assert.deepEqual(undeclared.map((s) => s.env), [], 'this repository already has a site block no face declares.');
});

// ── 1 · THE PLAN ────────────────────────────────────────────────────────────────────────────────────────

test('★★★ promoted to a hostname it DECLARES, the plan is every face, taken from the file', () => {
  const arrival = FACES.find((f) => f.kind === 'store');
  const { status, writes, said } = plan({ destination: arrival.host });
  assert.equal(status, 0, said);
  assert.deepEqual(
    writes,
    FACES.map((f) => [f.env, f.host]),
    `the plan is not the declaration. It must be derived from seed/box.json and from nothing else:\n${said}`,
  );
  assert.match(said, new RegExp(`is this box's ${arrival.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} face`), said);
});

test('★★ promoted somewhere the declaration does not name, the plan is EMPTY and the reason is printed', () => {
  const { status, writes, said } = plan({ destination: 'box.example.test' });
  assert.equal(status, 0, said);
  assert.deepEqual(writes, [], `a destination this box does not declare had a face plan built for it:\n${said}`);
  // ⛔ IT MAY NOT ASSERT ABOUT THE BOX WHAT IT ONLY KNOWS ABOUT THE DESTINATION — the defect-thread of this
  // arc, named in pk34: an instrument saying "not found" where the truth is "I did not look".
  assert.match(said, /is not one of the \d+ face/, said);
  assert.doesNotMatch(said, /declares no face at all/, `it blamed the declaration for a fact about the destination:\n${said}`);
});

test('★★ the way BACK writes nothing, and names the hostnames it is leaving on the edge', () => {
  const declaredHost = FACES[0];
  const { status, writes, said } = plan({
    destination: 'localhost',
    env: { [declaredHost.env]: declaredHost.host },
  });
  assert.equal(status, 0, said);
  assert.deepEqual(writes, [], `the demotion rewrote an edge hostname:\n${said}`);
  assert.match(said, new RegExp(`still declared: ${declaredHost.env}=`), said);
});

test('★ …and a way back from a box whose faces are all at loopback says there is nothing to leave', () => {
  // ★ THE ADDRESS, NEVER THE VARIABLE — the pk34 repair. `FORGE_DOMAIN=localhost` has shipped in
  // `.env.example` since the first box, so "the variable is set" is not "the face is published".
  const { said } = plan({
    destination: 'localhost',
    env: Object.fromEntries(FACES.map((f) => [f.env, '127.0.0.1'])),
  });
  assert.match(said, /names no published hostname/, said);
});

// ── 2 · THE REFUSAL ─────────────────────────────────────────────────────────────────────────────────────

test('★★★ a site block whose face the declaration LOST is a refusal that NAMES it — never a silent sentinel', () => {
  const box = JSON.parse(read('seed/box.json'));
  const victim = box.tenants.flatMap((t) => t.stores ?? []).find((st) => st.domain);
  const lost = victim.domain;
  delete victim.domain;
  const survivor = box.tenants.flatMap((t) => t.stores ?? []).find((st) => st.domain);
  assert.ok(survivor, 'the sabotage removed the only store face — there would be no destination to arrive at.');

  const dir = fixture({ box });
  try {
    const { status, writes, said } = plan({ destination: survivor.domain.host, root: dir });
    assert.equal(status, 1, `a plan that would leave a face on its sentinel was not refused:\n${said}`);
    assert.deepEqual(writes, [], `a refusal printed a plan anyway:\n${said}`);
    assert.match(said, new RegExp(`\\{\\$${lost.env}\\}`), `the refusal did not name the variable:\n${said}`);
    assert.match(said, /unset\.localhost/, `the refusal did not name the sentinel the box would have published on:\n${said}`);
    assert.match(said, /caddy\/Caddyfile:\d+/, `the refusal did not name the line that reads it:\n${said}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('★★ a box that declares NO face at all is a BENCH — it plans nothing and is not refused', () => {
  // ⚠️ THE ANTI-VACUUM OF THE RULE ABOVE, and it is a real state: the box is born on `localhost` (§0b) and a
  // deployment that has not chosen its hostnames yet declares none. "Every declared face is written" is also
  // true of zero faces, so the difference between that and the refusal above has to be a decided one.
  const box = JSON.parse(read('seed/box.json'));
  for (const tenant of box.tenants) {
    delete tenant.admin_domain;
    for (const store of tenant.stores ?? []) delete store.domain;
  }
  const dir = fixture({ box });
  try {
    const { status, writes, said } = plan({ destination: 'box.example.test', root: dir });
    assert.equal(status, 0, said);
    assert.deepEqual(writes, [], said);
    assert.match(said, /declares no face at all/, `a box with no face was promoted in silence:\n${said}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('★★★ "I could not read it" is exit 2 and is NOT a verdict about the box', () => {
  // The split every instrument in this box makes (`verify-seed`, `verify-config`, `store-host`, `warm-box`,
  // `promotion-verdict`): a step that learned nothing may not be published as either answer.
  const dir = fixture({ box: read('seed/box.json'), caddyfile: 'localhost {\n\treverse_proxy kernel:3000\n}\n' });
  try {
    const blind = plan({ destination: 'store.example.test', root: dir });
    assert.equal(blind.status, 2, `an edge with no variable-addressed site block was graded anyway:\n${blind.said}`);
    assert.match(blind.said, /never about the box/, blind.said);
    assert.deepEqual(blind.writes, [], blind.said);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const nowhere = plan({ destination: undefined });
  assert.equal(nowhere.status, 2, `a run with no destination planned something:\n${nowhere.said}`);
});

// ── 3 · THE WIRE — the promotion calls it, ABOVE its first write ────────────────────────────────────────

test('★★★ the promotion DERIVES the faces before it writes anything, and writes what it derived', () => {
  const block = BOX_UP.match(/if \[ "\$MODE" = promote \]; then([\s\S]*?)\n  exit [^\n]+\nfi/);
  assert.ok(block, 'the promotion block moved — re-read this guard before believing it.');
  const body = block[1];
  // ⚠️ COMMAND POSITION, NEVER THE WORD — and this guard was MEASURED GREEN on the sabotage before this line
  // existed. The first version compared `indexOf('bin/promotion-faces.mjs')` with `indexOf('put_env ')`, and
  // the block's own COMMENT names the module five lines above the call: moving the real invocation below
  // every write left the comment where it was, so the "before" it graded was a sentence about the code.
  // A rule that a comment can satisfy is not grading the program.
  const derive = body.search(/^\s*faces_plan="\$\(host_node "\$HERE\/bin\/promotion-faces\.mjs"/m);
  assert.ok(derive > -1, 'the promotion never RUNS bin/promotion-faces.mjs — the edge\'s hostnames are back to being typed into a .env by hand.');
  const firstWrite = body.search(/^\s*put_env \S/m);
  assert.ok(firstWrite > -1, 'the promotion writes no .env value at all.');
  assert.ok(
    derive < firstWrite,
    'the faces are derived AFTER the first `put_env`, so a refusal would leave a half-written .env behind. ' +
      'The whole refusal is only atomic while everything above the first write is a read.',
  );
  assert.match(body, /put_env "\$face_env" "\$face_host"/, 'the derived plan is never written — the module would be decoration.');
});

// ── 4 · AND WHAT A WRITTEN VALUE REACHES ────────────────────────────────────────────────────────────────

test('★★★ `put_env` updates the RUNNING SHELL as well as the file — compose reads the shell first', () => {
  // ⛔ THE BENCH DEFECT, REPRODUCED AS A UNIT. `.env` right, container wrong, ten seconds apart: compose
  // interpolates from the environment before it looks at `.env`, and `bin/box-up.sh` exports the whole file
  // at step 0 under `set -a`. A `put_env` that touched only the file therefore wrote a value that the
  // recreate two hundred lines down could not see.
  //
  // ★ THE REAL FUNCTION, EXTRACTED FROM THE REAL SCRIPT, not a copy of it here.
  const fn = (BOX_UP.match(/^put_env\(\) \{[\s\S]*?\n\}$/m) ?? [])[0];
  assert.ok(fn && fn.includes('python3'), 'put_env could not be extracted from bin/box-up.sh — this test would grade nothing.');

  const dir = mkdtempSync(join(tmpdir(), 'forge-put-env-export-'));
  try {
    const envFile = join(dir, '.env');
    writeFileSync(envFile, 'FORGE_DOMAIN=localhost\n');
    // Single-quoted, the way the promotion writes JSON (step 3b: the quotes are what keeps bash's `source`
    // from eating the inner double quotes) — and BOTH readers hand the value on without them, so an export
    // that kept them would make this shell the one reader that disagrees.
    const json = `'{"name":"Forge & Café","url":"http://a:8201"}'`;
    const script =
      `HERE=${JSON.stringify(dir)}\n${fn}\n` +
      `put_env FORGE_DOMAIN store.example.test\n` +
      `put_env FORGE_ADMIN_SIBLINGS ${JSON.stringify(json)}\n` +
      `printf 'SHELL_DOMAIN=%s\\n' "$FORGE_DOMAIN"\n` +
      `printf 'SHELL_SIBLINGS=%s\\n' "$FORGE_ADMIN_SIBLINGS"\n` +
      // The proof that it is EXPORTED and not merely set: a child process is what `docker compose` is.
      `printf 'CHILD_DOMAIN=%s\\n' "$(bash -c 'printf %s "$FORGE_DOMAIN"')"\n`;
    const out = execFileSync('bash', ['-c', script], { encoding: 'utf8' });

    assert.match(readFileSync(envFile, 'utf8'), /^FORGE_DOMAIN=store\.example\.test$/m, 'the file was not written.');
    assert.match(out, /^SHELL_DOMAIN=store\.example\.test$/m, `put_env wrote the file and left this shell holding the old value:\n${out}`);
    assert.match(
      out,
      /^CHILD_DOMAIN=store\.example\.test$/m,
      `the value is set in this shell and NOT exported, so \`docker compose\` — a child process — never sees it:\n${out}`,
    );
    assert.match(
      out,
      /^SHELL_SIBLINGS=\{"name":"Forge & Café","url":"http:\/\/a:8201"\}$/m,
      `the single quotes `.concat("`put_env` writes for the FILE leaked into the exported value, so this shell disagrees with both readers of `.env`:\n", out),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
