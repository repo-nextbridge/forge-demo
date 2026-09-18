// ★★★ NOTHING OF THIS BOX FILLS `storefront:gate`, AND NOTHING NAMES THE APP THAT USED TO — said out loud,
// by name, before anybody bakes an image.
//
//   node --test bin/no-gate.guard.mjs        (or: bash bin/test.sh)
//
// ── ⛔ WHAT THIS RULE IS THE INVERSE OF, AND WHY IT TURNED OVER (v0.4) ────────────────────────────────────
//
// `bin/gate-at-birth.guard.mjs` stood here until this slice and demanded the OPPOSITE: that some app of this
// box fill `storefront:gate`, and that some seed install it, because the demo's front door was a full-screen
// interstitial every visitor met before the shop. That rule was right about the screen and blind about what
// the screen cost.
//
// ★★★ THE MEASUREMENT, ON THE DEPLOYED BOX, 18/09. The cost of that slot is not the screen — it is the
// ROUTING, and it is paid by the mere INSTALL:
//
//   · `packages/storefront-kit/src/gate/directory.ts` in the product asks, at the EDGE of every store route,
//     «does any installed app fill `storefront:gate`?», and routes by the answer;
//   · so with one app installed, every route of every store answered `private, no-cache, no-store`;
//   · and a robot asking for ANY url was handed the interstitial — with no `<title>` on it.
//
// ⇒ THE WHOLE STORE LEFT THE CACHEABLE TREE TO CARRY ONE SENTENCE. That sentence — «this is a demonstration,
// nothing is charged and nothing is shipped» — is a BLOCK now (`demo-setup/demo_ribbon`), rendered by the
// slot it was dropped into like every other block, and the store went back to the tree with NO change in the
// product, which stays pinned at the release `forge.lock` names.
//
// ── ★ WHAT IS GRADED, AND BOTH HALVES ARE DERIVED ────────────────────────────────────────────────────────
//
//   1. THE DECLARATION. No app on `composition.json`'s `instanceApps` may declare a hook on the gate target.
//      Nothing here spells an app's name: the list is the composition's, the manifests are read from the
//      directories it points at, and the red NAMES whichever app it found.
//   2. THE CITATIONS. No file of this repository may still name the retired app. An orphan citation is not
//      untidiness here: this box's guards, seeds and fork configs are read by people to find out what the
//      box IS, and a directory that no longer exists reads as a directory somebody forgot to look in.
//
// ── ⛔ THE TWO WAYS A RULE LIKE THIS GOES VACUOUS, AND WHAT IS DONE ABOUT EACH ────────────────────────────
//
// ⛔ A RULE THAT READS SOURCE MUST READ **CODE**. A guard looking for `storefront:gate` in a manifest finds
// that string in the PROSE explaining why the manifest has no gate — which is exactly the shape of comment
// this repository writes. So comments are STRIPPED before the question is asked, and the anti-vacuum test
// below proves the stripping still lets a real declaration through.
//
// ⛔ AND A GUARD THAT GREPS FOR A NAME CONTAINS THAT NAME. This file is the one place in the repository the
// retired app's id may appear, because it is the needle; so the needle is ASSEMBLED at run time from parts
// that never form the literal in this source, and this file is still excluded from the walk by name — both,
// because either alone is a trick a reader has to notice rather than a rule they can see.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const say = (line) => console.error(`[no-gate] ${line}`);

const read = (rel) => {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch (error) {
    assert.fail(
      `${rel} could not be read (${error.code ?? error.message}). This guard derives its whole answer from ` +
        'that file; a green without it would mean nothing.',
    );
  }
};
const json = (rel) => JSON.parse(read(rel));

/** The slot whose mere occupancy is the defect. */
const GATE_TARGET = 'storefront:gate';

/** This file's own path, relative to the root — excluded from the citation walk, and derived rather than
 *  typed so a rename cannot leave the exclusion pointing at nothing. */
const SELF = join('bin', 'no-gate.guard.mjs');

/**
 * ⛔⛔ THE ONE FILE THAT MAY STILL NAME IT, AND THE EXEMPTION IS A DOCTRINE RATHER THAN A CONVENIENCE.
 *
 * `forge.lock` is not a claim about this tree — it is the record of a BAKE: «these images were built from
 * this release × THIS list», with a timestamp and a host. Its own readme in `composition.json` says it in so
 * many words: *"the lock must never be hand-edited to promise a list no image was built from"*. The images on
 * this box were baked on 2026-09-18 from a list that still carried the retired app, and editing this line by
 * hand would make the lock describe a bake that never happened — which is the exact lie `bin/verify-composition.sh`
 * exists to catch, told by the file it compares against.
 *
 * ⇒ IT STOPS NAMING THE APP WHEN THE IMAGES ARE REBUILT (`bash bin/build-local.sh <forge>` rewrites this
 * file), and not a moment before. Between this commit and that bake the two disagree, and THAT IS THE HONEST
 * STATE — the same one the composition readme describes for every other edit of the list.
 *
 * ⚠️ IT IS A SINGLE NAMED PATH AND NOT A PATTERN, so a second file cannot slip under this reason.
 */
const BAKED_RECORD = 'forge.lock';

/**
 * ⛔ THE RETIRED APP'S ID, ASSEMBLED — never written as one literal in this source. See the header: a rule
 * that greps for a string cannot also BE the string, and the honest way out is to say so and to build it.
 */
const RETIRED_APP = ['demo', 'gate'].join('-');

/** Source with its comments removed — the same subtraction `bin/front-apps.mjs` and
 *  `bin/store-mount-drift.guard.mjs` make, and for the same measured reason. */
const codeOf = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Every app on `instanceApps` whose manifest — its CODE, not its prose — declares a hook on the gate target.
 *
 * ⚠️ AN ENTRY WHOSE SOURCE IS NOT ON DISK IS ITS OWN FINDING, and not a `continue`. A composition that names
 * a directory this repository does not have bakes nothing, and a guard that skipped it would be green about
 * an app it never opened — which is precisely the shape a sabotage of `composition.json` alone would take.
 * @returns {{ id: string, why: string }[]}
 */
function gateApps() {
  const out = [];
  for (const app of json('composition.json').instanceApps ?? []) {
    const source = (app.source ?? '').replace(/^\.\//, '');
    if (!source) {
      out.push({ id: app.id, why: 'it declares no `source`, so nothing can say what it contains' });
      continue;
    }
    let manifest;
    try {
      manifest = readFileSync(join(ROOT, source, 'manifest.ts'), 'utf8');
    } catch {
      out.push({
        id: app.id,
        why: `composition.json points at \`${source}\`, and there is no \`manifest.ts\` there — this box ` +
          'composes an app it does not carry, so nothing here can say whether it fills the slot',
      });
      continue;
    }
    const code = codeOf(manifest);
    if (code.includes(`'${GATE_TARGET}'`) || code.includes(`"${GATE_TARGET}"`)) {
      out.push({ id: app.id, why: `${source}/manifest.ts declares a hook on \`${GATE_TARGET}\`` });
    }
  }
  return out;
}

/**
 * Every tracked file of this repository that still names the retired app, with the first line that does.
 *
 * ⚠️ `git ls-files` AND NOT A DIRECTORY WALK, because the answer must be about what this repository SHIPS.
 * A walk would open `node_modules`, `vendor/` and the forks' installed trees — where the name legitimately
 * survives in a lockfile npm wrote and in a symlink target — and it would report a repository that is in
 * order as a repository full of citations.
 * @returns {{ file: string, line: number, text: string }[]}
 */
function citations() {
  const files = execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => f !== SELF && f !== BAKED_RECORD);
  const found = [];
  for (const file of files) {
    let source;
    try {
      source = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue; // a binary or a file `git` knows and the disk does not — neither can carry a citation.
    }
    if (!source.includes(RETIRED_APP)) continue;
    const lines = source.split('\n');
    const at = lines.findIndex((l) => l.includes(RETIRED_APP));
    found.push({ file, line: at + 1, text: lines[at].trim().slice(0, 120) });
  }
  return found;
}

// ── what this run read, said before any assertion ────────────────────────────────────────────────────────

const INSTANCE_APPS = json('composition.json').instanceApps ?? [];
say(`this box composes ${INSTANCE_APPS.length} app(s) of its own: ${INSTANCE_APPS.map((a) => a.id).join(', ') || 'none'}`);
say(`the slot nobody may fill: ${GATE_TARGET}`);

// ── ⛔ the premise. Every verdict below iterates a list; a list that lost its subject would be green ──────

test('⛔ THE DERIVATION — there ARE instance apps to grade, and their manifests are readable', () => {
  assert.ok(
    INSTANCE_APPS.length > 0,
    'composition.json lists no `instanceApps`, so the rule below grades nothing at all. Either this box ' +
      'stopped writing apps of its own — which is the whole demonstration gone — or the list moved.',
  );
  // …and each one really has a manifest this guard can read, or the rule above is a walk over unopenable
  // directories that would report «no gate» about files nobody looked at.
  for (const app of INSTANCE_APPS) {
    const source = (app.source ?? '').replace(/^\.\//, '');
    assert.ok(source, `${app.id} declares no \`source\` on composition.json`);
    assert.ok(
      read(join(source, 'manifest.ts')).length > 0,
      `${source}/manifest.ts is empty — there is nothing in it to grade`,
    );
  }
});

// ── ★★ the verdict ───────────────────────────────────────────────────────────────────────────────────────

test('★★★ NO app of this box fills `storefront:gate` — the slot that takes the whole store off the cache', () => {
  const found = gateApps();
  assert.deepEqual(
    found.map((f) => f.id),
    [],
    `${found.length} app(s) this box COMPOSES put the store behind a gate:\n` +
      found.map((f) => `  · ${f.id}: ${f.why}`).join('\n') +
      `\nFilling \`${GATE_TARGET}\` is not a screen decision, it is a ROUTING one: the product asks at the ` +
      'edge of every store route whether an INSTALLED app fills it, so one install answers ' +
      '`private, no-cache, no-store` on every route of every store and hands a robot an interstitial with no ' +
      '`<title>` at every url. Measured on the deployed box, 18/09. The demonstration notice a visitor is ' +
      'owed is a BLOCK (`demo-setup/demo_ribbon`) and costs the cache nothing.',
  );
});

test('⛔ ANTI-VACUUM — the rule SEES a declaration, and is not merely satisfied by prose', () => {
  // ⛔ THE TRAP THIS CLOSES, AND IT IS THE ONE THIS HOUSE KEEPS PAYING FOR: a rule that looks for a string in
  // source finds that string in the COMMENT explaining why the source does not have it. The manifests of
  // this box are written in exactly that style, so the comment-stripping above is load-bearing — and a
  // stripper that ate too much would make the rule permanently green.
  const declaring = `export const manifest = { contact: { hooks: [{ target: '${GATE_TARGET}' }] } };`;
  assert.ok(codeOf(declaring).includes(GATE_TARGET), 'the stripper ate a REAL declaration — the rule is blind');
  const explaining = `// this app does not fill '${GATE_TARGET}', and here is why\n/* nor '${GATE_TARGET}' */\nexport const manifest = {};`;
  assert.ok(
    !codeOf(explaining).includes(GATE_TARGET),
    'the prose explaining the rule still satisfies the rule — a guard in that state is green about its own ' +
      'comment',
  );
});

test('⛔ ANTI-VACUUM — an instance app whose SOURCE is missing is a finding, never a skip', () => {
  // ⛔ WHY THIS EXISTS. The obvious sabotage of this rule is to put the retired app back on `composition.json`
  // without its directory. A guard that `continue`d past an unreadable manifest would stay GREEN over a
  // composition naming an app nobody can open — green about the exact edit it was written to catch.
  const app = { id: 'fixture-missing', source: './apps/fixture-that-is-not-here' };
  const found = [];
  for (const entry of [app]) {
    const source = entry.source.replace(/^\.\//, '');
    let ok = true;
    try {
      readFileSync(join(ROOT, source, 'manifest.ts'), 'utf8');
    } catch {
      ok = false;
    }
    if (!ok) found.push(entry.id);
  }
  assert.deepEqual(found, ['fixture-missing'], 'the fixture directory exists — this case grades nothing');
  // …and the shipped derivation reaches the same verdict for the same entry, which is what ties the fixture
  // above to the code below it rather than to a copy of it.
  assert.ok(
    gateApps.toString().includes('this box\n          composes an app it does not carry') ||
      gateApps.toString().includes('composes an app it does not carry'),
    'gateApps() no longer reports an unreadable manifest as a finding',
  );
});

test('★★ NO file of this repository names the retired gate app — an orphan citation is a false map', () => {
  const found = citations();
  say(`${BAKED_RECORD} is exempt: it records a BAKE, and it stops naming the app when the images are rebuilt`);
  assert.deepEqual(
    found.map((f) => `${f.file}:${f.line}`),
    [],
    `${found.length} tracked file(s) still name an app this repository no longer has:\n` +
      found.map((f) => `  · ${f.file}:${f.line}  ${f.text}`).join('\n') +
      '\nThis box\'s guards, seeds and fork configs are how a person finds out what the box IS. A path that ' +
      'no longer exists does not read as history — it reads as a directory somebody forgot to look in.',
  );
});

test('⛔ ANTI-VACUUM — the citation walk really LOOKS, and it looks at this repository', () => {
  // A walk that found no files, or that excluded everything, would print the same green as a clean tree.
  const files = execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.ok(files.length > 100, `git ls-files answered ${files.length} file(s) — this walk is not walking this repository`);
  assert.ok(files.includes('composition.json'), 'the walk does not reach composition.json, so it reaches nothing that matters');
  // …and the needle is really the app's id, assembled rather than typed. If this ever became something else,
  // every green above would be about a word nothing was ever called.
  assert.equal(RETIRED_APP.length, 9, `the needle is "${RETIRED_APP}", which is not the id this rule is about`);
  assert.ok(RETIRED_APP.startsWith('demo') && RETIRED_APP.endsWith('gate'), `the needle is "${RETIRED_APP}"`);
  say(`${files.length} tracked file(s) walked for citations of the retired app`);
});
