// ★★★ THE FORGE PACKAGES THIS BOX INSTALLS ARE `@forgeco/*`, AND THE RETIRED SCOPE MUST NOT COME BACK.
//
//   node --test bin/published-scope.guard.mjs        (or: bash bin/test.sh)
//
// ── WHY THE NAME MOVED (pk43, 16/09) ─────────────────────────────────────────────────────────────────────
//
// v0.3.0 was cut and the nineteen publishable packages went to npm. npm only accepts a scope that maps to an
// org the publisher owns, and the org spelled after `forge` with the whole word `commerce` was NOT available
// — the one that exists is `forgeco`. Nothing had ever been published under the retired name, so there is no
// history to keep and no redirect to honour: the rename is total. Measured here on 2026-09-16, on the public
// registry:
//
//     npm view @forgeco/storefront-kit version  -> 0.3.0      ← the nineteen are real now
//     npm view @forgeco/contracts version       -> 0.3.0
//     npm view <the retired scope>/contracts    -> E404 Not Found
//
// ── ⛔ WHY THIS IS A FENCE AND NOT A ONE-OFF SWEEP ───────────────────────────────────────────────────────
//
// Measured on this repository's base (`95e0f99`): 866 occurrences of the retired scope across 343 tracked
// files, plus 72 more wearing the TARBALL shape. A rename of that radius fails exactly one way — partially —
// and the partial failure is SILENT here in a way it is not upstream. This box installs the packages from
// `vendor/*.tgz` by PATH, so a leftover import resolves to nothing and the error a person sees is
// `Cannot find package`, three layers away from the line that is wrong. And the product half already
// shipped: `bin/build-local.sh:97-98` compares `[.apps[] | {id, package}]` against the monorepo's copy and
// REFUSES to bake while the two lists disagree — which is how this was found, and which is the one symptom
// that is loud.
//
// ── ★★ THE FOUR SHAPES THE RETIRED NAME WEARS *HERE*, ALL MEASURED ON THE BASE ───────────────────────────
//
//   1. THE SCOPE — `<retired>/storefront-kit`, 866 hits. The obvious one, and 851 of them are an import.
//   2. THE TARBALL PREFIX — `<retired>-storefront-kit-0.3.0.tgz`, 72 hits, and they carry NO `@` at all.
//      `pnpm pack` DERIVES a tarball's filename from the package name, so the 38 files in the two `vendor/`
//      directories renamed themselves the moment the product's manifests did. What did NOT rename itself is
//      every place that spells the derived name out: both forks' `package.json` + `package-lock.json`
//      (`file:vendor/<retired>-…tgz`), `bin/install-storefront.sh:67` — which REBUILDS the package name from
//      the filename, so both halves of that line had to move together — and the prose that quotes a path.
//      A fence that only looked for the scope would have walked past all 72.
//   3. THE SCOPE INSIDE A REGEX — `/<retired>\//`, in `storefront-coffee/vitest.config.ts:41` and
//      `totem/vitest.config.ts:31`, which is what tells vitest to INLINE the kit instead of externalising
//      it. A pattern left behind there does not throw: it simply stops matching, and the fork's suite fails
//      somewhere else entirely. Same class as the alternation shape the product's own fence names
//      (`@forge(commerce)?`) — that one has ZERO occurrences in this repository, measured, and is still
//      forbidden below because it is the shape a person writes while making a rename "compatible".
//   4. ⛔ WHAT IS NOT THE SCOPE AND MUST NOT MOVE — the BRAND DOMAIN. 108 hits of `<retired>.pro`:
//      `store.<retired>.pro`, `demo.cafe.<retired>.pro`, `totem.cafe.<retired>.pro`, the mailbox
//      `hi+<tag>@<retired>.pro` in `seed/commerce.mjs`, the four `deploy/*.env` files and every door
//      `bin/prove-doors.mjs` opens. THE NPM ORG CHANGED; THE DOMAIN DID NOT. A blind
//      `sed s/<retired>/forgeco/g` would have moved every address this box publishes and every mailbox the
//      seed writes to, and the box would still have built.
//
// So the rule is: the retired word followed by a DOT (escaped or not) is a DNS name and is allowed; in any
// other position it was the npm scope and is forbidden.
//
// ── ⚠️ AND IF SOMEBODY UNDOES THIS, THE COUNTER-FENCE AT THE BOTTOM IS THE HALF THAT MATTERS ─────────────
//
// The rename that this fence alone would NOT catch is `s/@forge/@forgeco/`. It is green above and it is
// wrong: `@forge/*` is the INTERNAL scope, it is never published, and the distinction is the whole reason a
// reader can tell which side of the border a package is on. This box owns two apps under it
// (`@forge/ext-demo-setup`, `@forge/ext-payment-pos`) and composes seven more of the
// product's that are also internal. Renaming them would make `composition.json` name packages no release
// carries, and `bin/build-local.sh`'s list comparison would go red against the monorepo — after the fact.
// The counter-fence says so BEFORE.
//
// ⚠️ THIS FILE EXCLUDES ITSELF FROM ITS OWN SCAN, because it has to spell what it forbids. A reintroduction
// of the retired name INSIDE this file is therefore not caught — the known price of every self-referent
// fence. That is also why the retired word is never written here as one literal: it is assembled from two
// halves below, so the prose above can talk about it as `<retired>` and stay readable.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { readJson, ROOT } from './release-tree.mjs';

const say = (line) => console.error(`[published-scope] ${line}`);

/** The scope a customer — and this box — installs, today. */
const SCOPE = '@forgeco';

/** The internal scope, which did NOT move and must not. */
const INTERNAL = '@forge/';

/** The retired word, built from parts so this file is not a hit for its own fence by accident. */
const OLD = `forge${'commerce'}`;

/** This file's own path, relative to the repo root — the one exclusion, and the reason is in the header. */
const SELF = 'bin/published-scope.guard.mjs';

/** Files git tracks. `git ls-files` is what keeps `node_modules/`, the gitignored `vendor/*.tgz` and any
 *  untracked scratch out of the count — the scan is about what a clone of this repository contains. */
function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

/** The extensions that have lines to report. The jpgs, pngs and woff2s of this repo have none, and reading
 *  them as utf8 only produces noise. `.env`, `Dockerfile` and `.gitignore` are in because all three carry
 *  the scope or the domain here. */
const TEXTUAL =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|sh|ya?ml|env|txt|html|example|local|lock)$|(^|\/)(Dockerfile|\.gitignore|\.dockerignore|\.npmrc)(\.[a-z-]+)?$/;

/**
 * The retired word immediately followed by a dot — optionally an ESCAPED one, because the domain is written
 * inside a regex in `seed/commerce.test.mjs:1047` (`/^hi\+[a-z.]+@<retired>\.pro$/`). That is a DNS name,
 * never the npm scope, and it is the only shape of the retired string that survives on purpose.
 */
const DNS = new RegExp(`${OLD}\\\\?\\.`, 'gi');

/**
 * The retired scope in every written shape: bare (`<retired>/storefront-kit`), as a tarball prefix
 * (`<retired>-contracts-0.3.0.tgz`), inside a regex (`/<retired>\//`) — and, the shape that contains no
 * `<retired>` substring at all, as the REGEX ALTERNATION `@forge(commerce)?` / `@forge(?:commerce)?`. The
 * group opener is the only thing allowed between the two halves, so a sentence that merely says "forge" and
 * "commerce" in one line is not a hit.
 */
const RETIRED = new RegExp(`forge(?:\\(\\??:?)?${'commerce'}`, 'i');

/** The single rule, shared by the scan and by its own self-test below. */
function forbidden(line) {
  return RETIRED.test(line.replace(DNS, ''));
}

/** Every line still carrying the retired scope, with the DNS names removed from the line first — a line that
 *  holds both (there are several: `deploy/stag.env` names the domain and, before this slice, the scope) is
 *  judged on what is left. */
function scan() {
  const hits = [];
  let filesScanned = 0;
  for (const file of trackedFiles()) {
    if (!TEXTUAL.test(file) || file === SELF) continue;
    let text;
    try {
      text = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    filesScanned += 1;
    // ⚠️ THE CHEAP PRE-FILTER IS THE SECOND HALF OF THE RETIRED NAME, NOT THE WHOLE OF IT. The alternation
    // shape never spells the two halves adjacent, so filtering on the joined string would walk past it —
    // which is exactly how the product's own DoD grep was blind to fourteen live regexes.
    if (!text.toLowerCase().includes('commerce')) continue;
    text.split('\n').forEach((line, i) => {
      if (forbidden(line)) hits.push({ file, line: i + 1, text: line.trim().slice(0, 160) });
    });
  }
  return { hits, filesScanned };
}

const { hits, filesScanned } = scan();
say(`${filesScanned} textual tracked file(s) read · ${hits.length} carrying the retired scope`);

test('★★ no tracked file of this repository mentions the retired npm scope', () => {
  const report = hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join('\n');
  assert.equal(
    hits.length,
    0,
    `the retired scope survives in ${hits.length} place(s). The packages are published as ${SCOPE}/* and ` +
      `nothing answers to the old name — an import left behind resolves to nothing, and a \`package\` left ` +
      `behind in composition.json stops the oven (bin/build-local.sh:97-98).\n${report}`,
  );
});

test('★ the scan is not vacuous — it read the repository, and the rule can still say no', () => {
  // A scan that found nothing because it OPENED nothing is the quietest way a fence dies. Measured
  // 2026-09-16 on this tree: 898 tracked files, of which ~690 are textual.
  assert.ok(
    filesScanned > 500,
    `the scan opened only ${filesScanned} file(s) — its extension filter is broken`,
  );

  // The rule itself, exercised on BOTH sides. Without this, deleting the body of `forbidden()` would leave
  // the assertion above green forever.
  assert.equal(forbidden(`import { Cart } from '@${OLD}/storefront-kit/cart';`), true, 'the scope must be caught');
  assert.equal(forbidden(`"file:vendor/${OLD}-contracts-0.3.0.tgz"`), true, 'the tarball prefix must be caught');
  assert.equal(forbidden(`inline: [/@${OLD}\\//]`), true, 'the scope inside a regex must be caught');
  assert.equal(
    forbidden(`noExternal: [/^@forge(${'commerce'})?\\/ext-/]`),
    true,
    'the alternation must be caught — it contains no occurrence of the retired word as one string',
  );
  assert.equal(forbidden(`FORGE_STORE_DOMAIN=store.${OLD}.pro`), false, 'the brand domain must be spared');
  assert.equal(forbidden(`(tag) => \`hi+\${tag}@${OLD}.pro\``), false, 'the mailbox must be spared');
  assert.equal(forbidden(`/^hi\\+[a-z.]+@${OLD}\\.pro$/`), false, 'the domain inside a regex must be spared');
});

test(`★★ the new scope is actually in use — a tree that renamed NOTHING would also pass the fence above`, () => {
  // The anti-vacuum half from the other direction. Measured on the base of this slice: 343 tracked files
  // carried the retired scope, so a correct rename leaves at least that many wearing the new one.
  const wearing = trackedFiles().filter((file) => {
    if (!TEXTUAL.test(file) || file === SELF) return false;
    try {
      return readFileSync(join(ROOT, file), 'utf8').includes(`${SCOPE}/`);
    } catch {
      return false;
    }
  });
  say(`${wearing.length} tracked file(s) name ${SCOPE}/*`);
  assert.ok(
    wearing.length > 250,
    `only ${wearing.length} file(s) name ${SCOPE}/* — this tree did not rename anything, and a fence that ` +
      'asks only "is the old name gone?" would call that a pass',
  );
});

// ── ⟂ THE COUNTER-FENCE: THE INTERNAL SCOPE DID NOT MOVE ────────────────────────────────────────────────
//
// `@forge/*` is not published and needs no npm org. Leaving it alone is the POINT, not an omission: one
// import tells a reader which side of the border a package is on. A rename that swept it along
// (`s/@forge/@forgeco/`) is green above and destroys that — and this box is where it would hurt first,
// because `composition.json` is compared, package by package, against a list in the monorepo.

const composition = readJson(join(ROOT, 'composition.json'));

test('⟂ the composed list still carries BOTH scopes — that is the distinction, not an accident', () => {
  const published = composition.apps.filter((a) => a.package.startsWith(`${SCOPE}/`));
  const internal = composition.apps.filter((a) => a.package.startsWith(INTERNAL));
  say(`composition.json: ${published.length} app(s) ${SCOPE}/*, ${internal.length} app(s) ${INTERNAL}*`);
  assert.equal(
    published.length + internal.length,
    composition.apps.length,
    'an app of this list is under neither scope — every Forge app wears one of the two',
  );
  // Measured 2026-09-16 against `infra/fleet/lists/demo-instance.json` in the v0.3.0 tree: 13 published, 7
  // internal, 20 apps. Both numbers are asserted because a sweep in EITHER direction moves one of them.
  assert.equal(published.length, 13, `the published scope lost or gained members on this box's list`);
  assert.equal(internal.length, 7, `the internal scope moved — was \`${INTERNAL}\` renamed along with it?`);
});

test('⟂ this box\'s OWN apps are internal, and each declares the name the list gives it', () => {
  // The three instance apps are the strongest control available here: their package name lives in TWO files
  // (this list and their own manifest), so a blind sweep that touched one and not the other is visible, and
  // a sweep that touched both is still caught by the scope assertion.
  assert.ok(composition.instanceApps.length > 0, 'this box owns no app — the control below grades nothing');
  for (const app of composition.instanceApps) {
    assert.ok(
      app.package.startsWith(INTERNAL),
      `${app.id} is written by THIS repository and no release carries it, so it must stay ${INTERNAL}* — ` +
        `it is ${app.package}`,
    );
    const manifest = readJson(join(ROOT, app.source, 'package.json'));
    assert.equal(
      manifest.name,
      app.package,
      `${app.source}/package.json calls itself ${manifest.name} while composition.json asks for ` +
        `${app.package} — the oven mounts by the manifest's name`,
    );
  }
  say(`${composition.instanceApps.length} instance app(s) still under ${INTERNAL}*`);
});

test('⟂ the forks still install the kit under the published scope, by the name every guard derives from', async () => {
  // `bin/forks.mjs` names the kit in ONE place and every loop in `bin/` starts from it. If that constant and
  // the forks' manifests ever disagree, `forks()` returns an EMPTY list — and an empty list turns
  // fork-typecheck, fork-suite, fork-codegen and vendor-drift green while proving nothing. So the fence has
  // to grade the constant against the manifests, not just its spelling.
  const { KIT, forks } = await import('./forks.mjs');
  assert.ok(KIT.startsWith(`${SCOPE}/`), `the kit constant is ${KIT} — the published scope is ${SCOPE}/*`);
  const found = forks('build');
  say(`forks that install ${KIT}: ${found.map((f) => f.dir).join(', ') || 'NONE'}`);
  assert.ok(
    found.length > 0,
    `no fork of this repository depends on ${KIT}. Either every guard in bin/ that loops over forks is now ` +
      'vacuous, or the rename moved the constant and not the manifests (or the other way round).',
  );
});
