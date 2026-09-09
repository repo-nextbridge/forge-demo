// ★★ THIS BOX'S SIDE OF THE EDGE EXTENSION DOOR — one directory, one reader, and the generated file lands
// where that reader looks.
//
// ── WHAT HAPPENED, AND WHY HALF THE FIX COULD NOT BE MADE UPSTREAM (A10) ────────────────────────────────
//
// The edge we inherit ends with `import /etc/caddy/extra/*.caddy` at TOP level, so every file it matches is
// parsed as a SITE BLOCK. This repository's bench overlay pointed a SECOND glob at the SAME directory —
// `import /etc/caddy/extra/*.local.caddy`, from INSIDE a site block — and dropped a file there for it that is
// a FRAGMENT: bare `handle` blocks, legal inside a site block and meaningless outside one.
//
//     `*.caddy` matches `coffee.local.caddy`.
//
// A `.local.` in the name is a strict SUBSET of the wider glob, never an escape from it. So the production
// Caddyfile imported that fragment at top level and answered:
//
//     caddy validate → Error: … /etc/caddy/extra/coffee.local.caddy:62: parsed 'handle' as a site address
//
// ⚠️ AND AN INVALID CADDYFILE IS NOT A BROKEN EXTRA HOST — IT IS A DEAD EDGE. Nothing on the box answers:
// not the store, not the checkout, not the admin. The bench never showed it because the bench reads a
// different top-level file; the failure was waiting for the first production load of THIS instance.
//
// The product fixed the half it owns (`scripts/ci/caddy-extra-door.guard.test.ts`, slice `pk2/p4-dividas`):
// the DOOR, in the Caddyfiles it ships. It said so itself — *"the file that broke and the file that broke it
// both live in the INSTANCE's repository, which this one cannot see"*. This file is that repository.
//
// ── WHAT THIS GUARD ASKS, AND WHY IT IS FOUR QUESTIONS AND NOT ONE ──────────────────────────────────────
//
// Moving `coffee.local.caddy` out of `caddy/extra/` is one line. What makes the move SAFE is that four
// separate legs agree, and every one of them is silent on its own:
//
//   1. ONE READER PER DIRECTORY. Two globs over one folder means one file is legal for one reader and fatal
//      for the other. This is the rule the outage broke, and the subset fact is EXECUTED below against a
//      real matcher rather than asserted in prose — "surely `.local` is skipped" is the belief that cost the
//      edge.
//   2. EVERY IMPORTED DIRECTORY IS MOUNTED. A `import /etc/caddy/<dir>/*` whose host folder reaches no
//      volume matches nothing, forever, with one `warn` line nobody reads: the door is simply shut.
//   3. THE GENERATED FILE LANDS WHERE A READER THAT WANTS ITS SHAPE LOOKS. `bin/box-up.sh` (step 3c) WRITES
//      the café's rule from the store id it has just provisioned, and what it writes is a FRAGMENT. Written
//      where nothing reads it, the café's whole front is unreachable while every page still answers 200 (the
//      request falls through to the vanilla storefront, which paints the store with its own theme) — the
//      defect that fooled two people here. Written where the TOP-LEVEL reader finds it, it is the outage
//      above, all over again.
//      ⚠️ THAT SECOND HALF WAS MISSING FOR ONE COMMIT AND A SABOTAGE FOUND IT: pointing step 3c back at
//      `caddy/extra/` left exactly ONE reader — the production edge — and "exactly one reader" was green
//      about the very outage this file exists for. Which shape a reader wants is the `indented` flag; which
//      shape a file IS, is derived below from the directives this repository's own Caddyfiles use.
//   4. NOTHING A GENERATOR WRITES IS COMMITTED. The rule carries a store id, and a store id is a fresh ULID
//      on every birth: a committed copy is correct for exactly one box and a lie for every other.
//
// Everything is DERIVED — the Caddyfiles are walked, the imports are parsed, the mounts are read out of
// compose, and the generated paths, bodies and even Caddy's own directive vocabulary are read out of files
// this repository already ships. This file names no directory, no filename and no directive, so the next
// fragment (or the next fork) is graded by it without being told about.
//
//   node --test bin/caddy-extra-door.guard.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const say = (line) => console.error(`[caddy-door] ${line}`);

// ── reading the edge ────────────────────────────────────────────────────────────────────────────────────

/** Every Caddyfile this box ships, FOUND rather than listed: a bench overlay is exactly the file a written
 *  list would not have, and it is the one that broke the edge. */
function caddyfiles(dir = join(HERE, 'caddy'), out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) caddyfiles(full, out);
    else if (entry.name === 'Caddyfile' || entry.name.startsWith('Caddyfile.')) out.push(full);
  }
  return out;
}

/** The `import` directives of one Caddyfile, with the fact the outage turned on: whether the line is
 *  indented, i.e. whether the files it pulls are read INSIDE a site block (fragments) or at top level
 *  (site blocks). The two shapes cannot share a folder. */
function importsOf(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((raw, i) => ({ raw, i }))
    .filter(({ raw }) => /^\s*import\s+\S/.test(raw))
    .map(({ raw, i }) => ({
      file: relative(HERE, file),
      line: i + 1,
      pattern: raw.trim().replace(/^import\s+/, '').split(/\s+/)[0] ?? '',
      indented: /^\s/.test(raw),
    }));
}

/** Go's `filepath.Match`, the matcher Caddy's `import` glob actually runs: `*` matches any run of
 *  non-separator characters. Written out rather than imported so the subset claim is EXECUTED. */
const globMatches = (pattern, name) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`).test(name);

const dirOf = (pattern) => pattern.slice(0, pattern.lastIndexOf('/'));
const baseOf = (p) => p.slice(p.lastIndexOf('/') + 1);

const GLOBS = caddyfiles().flatMap(importsOf).filter((i) => i.pattern.includes('*'));

// ── reading the mounts ──────────────────────────────────────────────────────────────────────────────────

/** `${VAR:-./caddy/extra}` → `./caddy/extra`. A mount whose host side is a bare variable has no default and
 *  cannot be resolved from source; it is reported as unresolved rather than guessed at. */
const hostDefault = (spec) => spec.match(/^\$\{[A-Za-z_][A-Za-z0-9_]*:-([^}]+)\}$/)?.[1] ?? (spec.includes('$') ? undefined : spec);

/** Every `<host>:/etc/caddy/<something>` bind this box declares, from every compose file it ships. Read from
 *  compose rather than from a list here, so a mount added in the override file is seen for free. */
function caddyMounts() {
  const out = new Map(); // container path → host path (relative to this repo)
  for (const name of ['compose.yml', 'compose.override.yml']) {
    const file = join(HERE, name);
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const m = raw.match(/^\s*-\s*(\S+):(\/etc\/caddy\/[^:\s]+)(?::\w+)?\s*$/);
      if (!m) continue;
      const host = hostDefault(m[1]);
      if (host) out.set(m[2], host.replace(/^\.\//, ''));
    }
  }
  return out;
}

const MOUNTS = caddyMounts();

// ── reading the birth ───────────────────────────────────────────────────────────────────────────────────

/** Every Caddy file `bin/box-up.sh` GENERATES: its path relative to this repository, and the BODY of the
 *  heredoc it writes. Derived from the redirection itself (`cat > "$HERE/…" <<TAG … TAG`), so a second one
 *  written next year is graded without being added anywhere. */
function generatedFiles() {
  const src = readFileSync(join(HERE, 'bin', 'box-up.sh'), 'utf8');
  const out = [];
  for (const m of src.matchAll(/(?:cat|tee)\s*>+\s*"\$HERE\/([^"]+\.caddy)"\s*<<-?\s*'?(\w+)'?\n/g)) {
    const from = m.index + m[0].length;
    const end = src.indexOf(`\n${m[2]}\n`, from);
    out.push({ path: m[1], body: end === -1 ? '' : src.slice(from, end) });
  }
  return out;
}

const GENERATED = generatedFiles();

/**
 * ★★ THE SHAPE OF A FILE, DERIVED FROM THIS REPOSITORY'S OWN EDGE AND NEVER FROM A TYPED LIST OF DIRECTIVES.
 *
 * Caddy's error names the discriminator exactly — *"parsed 'handle' as a site address, but it is a known
 * directive"* — so what tells a FRAGMENT from a SITE BLOCK is whether its top-level keyword is a DIRECTIVE.
 * A list of Caddy's directives typed here would rot the day one is added; this reads the answer out of the
 * Caddyfiles this repository already ships: every keyword they use INSIDE a site block is, by construction,
 * a directive. `handle`, `reverse_proxy`, `header`, `route`, `respond` — all of them, for free.
 */
function directivesInUse() {
  const found = new Set();
  for (const file of caddyfiles()) {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      if (!/^\s+\S/.test(raw)) continue; // indented: inside a site block
      const word = raw.trim().split(/[\s{]/)[0];
      if (/^[a-z][a-z_]*$/.test(word)) found.add(word);
    }
  }
  return found;
}

const DIRECTIVES = directivesInUse();

/** Is this generated body a FRAGMENT (bare directives, legal only INSIDE a site block) rather than a site
 *  block of its own? Comments and blank lines are not the file's shape. */
function isFragment(body) {
  for (const raw of body.split('\n')) {
    if (!/^\S/.test(raw) || raw.startsWith('#')) continue; // only TOP-LEVEL, non-comment lines
    const word = raw.trim().split(/[\s{]/)[0];
    if (word) return DIRECTIVES.has(word);
  }
  return false;
}

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

for (const i of GLOBS) say(`${i.file}:${i.line} imports ${i.pattern}${i.indented ? '  (indented → fragments)' : '  (top level → site blocks)'}`);
for (const [container, host] of MOUNTS) say(`mounted: ${host} → ${container}`);
for (const g of GENERATED) say(`bin/box-up.sh generates: ${g.path}  (${isFragment(g.body) ? 'FRAGMENT — needs an indented reader' : 'site block — needs a top-level reader'})`);

// ── the rules ───────────────────────────────────────────────────────────────────────────────────────────

test('⛔ THE VACUUM CHECK — there is a door, and something writes through it', () => {
  // A guard whose corpus went empty passes every rule below in silence, and this repository has paid for
  // that shape before. Both halves are asserted: the imports AND the generator.
  assert.ok(GLOBS.length > 0, 'no glob import found in any Caddyfile under caddy/ — the parse, not the edge, is broken');
  assert.ok(GENERATED.length > 0, 'bin/box-up.sh generates no *.caddy file — either step 3c left, or the derivation above lost it');
  assert.ok(GENERATED.every((g) => g.body.length > 0), 'a generated file was found but its heredoc body was not — the shape rule below would grade nothing');
  // The shape rule reads Caddy's directives out of the edge this repo ships. An empty set makes every file
  // look like a site block, which is the quiet way that rule would stop seeing the outage it exists for.
  assert.ok(DIRECTIVES.has('handle') && DIRECTIVES.has('reverse_proxy'), `the directives derived from this repo's Caddyfiles do not include handle/reverse_proxy: ${[...DIRECTIVES].join(', ')}`);
});

test('★★ ONE READER PER DIRECTORY — a second glob makes one file legal and fatal at once', () => {
  const byDir = new Map();
  for (const i of GLOBS) {
    const list = byDir.get(dirOf(i.pattern)) ?? [];
    list.push(`${i.file}:${i.line} ${i.pattern}`);
    byDir.set(dirOf(i.pattern), list);
  }
  const disagreeing = [...byDir].filter(([, readers]) => readers.length > 1);
  assert.deepEqual(
    disagreeing.map(([dir, readers]) => `${dir} ← ${readers.join(' + ')}`),
    [],
    'two readers over one directory. One of them reads its files at top level (site blocks) and the other ' +
      'inside a site block (fragments), and a file can only be one of those — so whichever reader was not ' +
      'meant for it kills the whole edge, not just that host. The fix is a directory of its own, never a ' +
      'narrower suffix (see the subset test below).',
  );
});

test('"narrower" is an illusion: a *.local.caddy name is a SUBSET of *.caddy, not an escape from it', () => {
  // The measured fact behind the rule above, and the reason the fix is a separate DIRECTORY. Both
  // directions, so the matcher itself is under test and not only its optimistic half.
  assert.equal(globMatches('*.caddy', 'coffee.local.caddy'), true);
  assert.equal(globMatches('*.caddy', 'admin-second-tenant.caddy'), true);
  assert.equal(globMatches('*.local.caddy', 'coffee.local.caddy'), true);
  assert.equal(globMatches('*.local.caddy', 'admin-second-tenant.caddy'), false);
  assert.equal(globMatches('*.caddy', 'README.md'), false);
});

test('★ every imported directory is MOUNTED — an unmounted one is a door that is simply shut', () => {
  const unmounted = GLOBS.filter((i) => !MOUNTS.has(dirOf(i.pattern)));
  assert.deepEqual(
    unmounted.map((i) => `${i.file}:${i.line} ${i.pattern}`),
    [],
    'this pattern points at a path no compose volume delivers, so it matches nothing on every box, ' +
      'forever — Caddy writes one `warn` line and carries on serving. Add the bind to the caddy service.',
  );
});

test('★★ every generated fragment lands where its reader looks, and where NO other reader can see it', () => {
  const offenders = [];
  for (const { path, body } of GENERATED) {
    const hostDir = dirname(path);
    const readers = GLOBS.filter(
      (i) => MOUNTS.get(dirOf(i.pattern)) === hostDir && globMatches(baseOf(i.pattern), baseOf(path)),
    );
    if (readers.length === 0) {
      offenders.push(`${path} — written by bin/box-up.sh and read by NOTHING (no import matches it there)`);
      continue;
    }
    if (readers.length > 1) {
      offenders.push(`${path} — read by ${readers.map((r) => `${r.file}:${r.line}`).join(' and ')}`);
      continue;
    }
    // ★★ AND THE READER MUST WANT THE SHAPE THIS FILE IS. This half was missing for one commit and a
    // sabotage found it: moving step 3c's write back to `caddy/extra/` left exactly ONE reader — the
    // PRODUCTION edge, at top level — and the rule above was green about the very outage it exists for.
    const reader = readers[0];
    const fragment = isFragment(body);
    if (fragment !== reader.indented) {
      offenders.push(
        `${path} is a ${fragment ? 'FRAGMENT (bare directives)' : 'SITE BLOCK'} and its only reader ` +
          `${reader.file}:${reader.line} imports ${reader.indented ? 'INSIDE a site block (it wants fragments)' : 'at TOP LEVEL (it wants site blocks)'}`,
      );
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a file the birth writes is not paired with exactly one import that wants its shape.\n' +
      "  · read by NOBODY → the café's whole front is unreachable, and every page still answers 200 (the " +
      'request falls through to the vanilla storefront, which paints the store with its own theme).\n' +
      '  · read by TWO → see rule 1.\n' +
      '  · read at the WRONG LEVEL → a fragment parsed as a site block is `parsed \'handle\' as a site ' +
      'address`, which refuses the WHOLE Caddyfile: store, checkout and admin down together.',
  );
});

test('★ nothing a generator writes is COMMITTED — a store id is a fresh ULID on every birth', () => {
  const tracked = execFileSync('git', ['ls-files', 'caddy'], { cwd: HERE, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const offenders = [];
  for (const file of tracked) {
    for (const i of GLOBS) {
      if (MOUNTS.get(dirOf(i.pattern)) !== dirname(file)) continue;
      if (globMatches(baseOf(i.pattern), baseOf(file))) offenders.push(`${file} (imported by ${i.file}:${i.line})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a committed file is imported by the edge. If a generator writes it, the copy in git is correct for one ' +
      'box and a lie for every other: it routes to a store that does not exist, the request falls through, ' +
      'and the page still looks right because the theme comes from the store. That is the original defect. ' +
      'Ship the SHAPE under a name the glob does not match (`.example`) and gitignore the real one.',
  );
});

test('★ the anti-vacuity of the rule above: the shape a reader can see IS shipped, and is not imported', () => {
  // Without this, deleting every example file would make the rule above pass by having no subject — and the
  // folder a person is supposed to learn from would be empty.
  const examples = execFileSync('git', ['ls-files', 'caddy'], { cwd: HERE, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.example'));
  assert.ok(
    examples.length > 0,
    'no `.example` fragment is committed anywhere under caddy/. The real files are generated and absent ' +
      'from git, so with no example a reader has no way to see the shape of what the edge imports.',
  );
  for (const f of examples) say(`shipped shape: ${f}`);
});
