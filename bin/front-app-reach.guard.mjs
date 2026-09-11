// ★★★ "MY COMPOSITION DECLARES A BLOCK OF FRONT THAT NO FRONT OF MINE REACHES" — said OUT LOUD, by name.
//
//   node --test bin/front-app-reach.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/front-app-reach.guard.mjs
//
// ── ⛔ THE SILENCE THIS ENDS (caderno pk32 §15, measured on this bench 2026-09-10/11) ─────────────────────
//
// `apps/demo-setup` declares three storefront blocks — the shop's mark in the header bar, in the mobile
// drawer and in the footer. `seed/demo-setup.json` places all three on FOUR stores, the café's among them.
// The placements are real and `enabled`, `read.extension_composition` publishes them, the admin shows the
// app's card. And `storefront-coffee/` — the café's forked vitrine — names the app nowhere: not in its
// `package.json`, not in `transpilePackages`, not in any registry. So the café's vitrine CANNOT draw the mark
// its own box tells it to draw, and before this file nothing anywhere said so. Not the build, not the suite,
// not the box's own verifier, not a log line at runtime.
//
// ★ THAT IS THE DEFECT, AND IT IS THE DEFECT EVEN IF THE FORK DOES NOT WANT THE BLOCK. The café has chrome of
// its own (`CoffeeChrome`) and draws a mark by its own hand — so nothing on screen looks wrong. The placement
// still exists, is still enabled, is still published by the port, and the fork's owner is still entitled to
// DECIDE. What he is not entitled to is not to know; the `DIVERGENCES` list below is where a decision goes.
//
// ★★ AND WHY THE RULE IS THIS REPOSITORY'S, not the product's — the owner's own verdict (10/09):
// *"se o app é da instância e o front é da instância, não é a instância que tem que declarar mesmo? não tem
// como o produto saber."* It is stronger than "cannot": the product MUST NOT know. Reaching inside a fork it
// does not own is the opposite of trava 4. This box holds BOTH ends — the composition and the forks — so it is
// the only party that can compare them, and the comparison is its obligation.
//
// ── WHAT IS GRADED, AND THE SHAPE IS BORROWED ON PURPOSE ─────────────────────────────────────────────────
//
// `bin/verify-seed.mjs` section 3e (pk31/d1) grades *declaration and reality in the same answer*, deriving
// both from the box instead of from a list of names. This is that sentence, statically: the DECLARATION is
// `composition.json` + each app's `forge.wiring`, the REALITY is each front's manifest, its Next config and
// its source. The rule itself lives in `bin/front-apps.mjs` and is graded on fixtures in
// `bin/front-apps.test.mjs` — because this tree is HEALTHY wherever the waivers below are, and a rule proven
// only against a healthy tree is a rule proven to be quiet.
//
// ⛔ AND IT IS THREE GESTURES, NOT ONE: the dependency, `transpilePackages`, the tracing root, and the import
// itself. Each has its own measured failure mode; `bin/front-apps.mjs` carries the measurements.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { forks, surfaceForks } from './forks.mjs';
import { composedInstanceApps, frontComponents, frontFacts, reach } from './front-apps.mjs';
import { pinnedCommit, releaseTree } from './release-tree.mjs';

const say = (line) => console.error(`[front-app-reach] ${line}`);

/**
 * ★ THE DIVERGENCES THIS BOX HAS DECIDED NOT TO CLOSE YET — the affordance that makes the failure honest.
 * Without it, a red has nowhere to go but `rm` of the rule, which silences the next one too. Same shape, and
 * the same two safeguards, as `bin/store-mount-drift.guard.mjs`'s list:
 *   · every entry is PRINTED on every run, so a divergence can never become quietly permanent;
 *   · an entry that matches NO finding is RED, so a waiver outlives its reason for exactly one run.
 *
 * One entry per (fork, app) or (fork, app, component). `why` is not decoration.
 */
const DIVERGENCES = [
  {
    fork: 'storefront-coffee',
    app: 'demo-setup',
    why:
      'THE SPECIMEN, AND IT IS WAITING ON A PRODUCT ARTIFACT RATHER THAN ON A DECISION. The three marks are ' +
      'reachable only once this fork can REGENERATE `storefront-coffee/src/lib/extensions/generated/' +
      'registry.tsx`, which is a GENERATED surface (its own first line says "do not edit") and which nothing ' +
      'in this repository regenerates: `bin/build-coffee.sh` and `bin/build-totem.sh` mention no codegen, and ' +
      'the 18 tarballs in `storefront-coffee/vendor/` do not include one. Welding the import by hand is ' +
      'exactly what `totem/src/lib/gate/registry.tsx` did, and that file\'s prose had already rotted by the ' +
      'time pk31/d1 read it. The tool is owed by the product and is being fiado by pk32/p1-parto (pack:surface ' +
      'born with the codegen vendored + the regeneration step wired); when it lands, the fix here is the three ' +
      'gestures plus `npm run codegen`, and this entry goes away.',
  },
  {
    fork: 'storefront-coffee',
    app: 'demo-gate',
    why:
      'THE SAME MISSING TOOL, PLUS A SECOND HOLE THAT IS THE PRODUCT\'S: this cut (2026-09-01, commit 0d1c37f) ' +
      'predates the gate seam by hours, so it has NEITHER `src/lib/extensions/generated/gate-registry.tsx` NOR ' +
      '`src/lib/extensions/gate.ts` — the reference grew both on 2026-09-01 (ff2006e9d). Its ' +
      '`src/app/s/[store]/layout.tsx:22` still resolves the gate through `@forgecommerce/storefront-kit/gate/' +
      'registry`, whose map is EMPTY and whose header tells a forker to weld his entry into that very file — ' +
      'which a `pack:surface` fork CANNOT do, because it installs the kit as a tarball and owns no copy of it. ' +
      '⇒ reported upstream, not patchable from here (repo boundary): ' +
      'packages/storefront-kit/src/gate/registry.tsx:20-26 and :42-48.',
  },
];

// ── what this run could read, said before any assertion ──────────────────────────────────────────────────

const PINNED = pinnedCommit();
const TREE = PINNED ? releaseTree(PINNED) : { tried: [] };
const APPS = composedInstanceApps();
const COMPONENTS = frontComponents(APPS);
const BUILDING_FORKS = forks('build');
/** Which of those is a CUT OF a Forge surface, and of which one — only the release can say. */
const SURFACE_OF = new Map(surfaceForks(TREE).map((f) => [f.dir, f.surface.surface]));

say(`this box composes ${APPS.length} app(s) of its own: ${APPS.map((a) => a.id).join(', ') || 'none'}`);
for (const component of COMPONENTS) {
  say(`   declares ${component.app}/${component.component} · ${component.seam} · served by ${component.servedBy.join(' + ')}`);
}
say(`fronts that build: ${BUILDING_FORKS.map((f) => f.dir).join(', ') || 'none'}`);
if (TREE.path) {
  say(`surfaces read from: ${TREE.path} @ ${TREE.head.slice(0, 9)} (${TREE.how})`);
} else if (PINNED) {
  say(`⚠️ NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine.`);
  for (const line of TREE.tried) say(`   tried: ${line}`);
  say('   set FORGE_MONOREPO=<the release\'s checkout>: without it nothing here knows which front is a cut of');
  say('   which surface, and a jurisdiction guessed is a verdict invented.');
}
for (const divergence of DIVERGENCES) {
  say(`★ DIVERGENCE declared: ${divergence.fork} does not reach ${divergence.app} — ${divergence.why.slice(0, 96)}…`);
}

/** Every front, with the three facts read from disk. Its Next config is IMPORTED rather than grepped: a
 *  `transpilePackages` that is computed, or present and handed to nobody, must not pass as a value. */
async function fronts() {
  const out = [];
  for (const fork of BUILDING_FORKS) {
    const config = join(fork.path, 'next.config.mjs');
    assert.ok(existsSync(config), `${fork.dir} declares a build script and has no next.config.mjs`);
    const loaded = (await import(pathToFileURL(config).href)).default;
    out.push(frontFacts(fork, SURFACE_OF.get(fork.dir) ?? null, loaded));
  }
  return out;
}

// ── ⛔ the premises. Every verdict below iterates a list; a list that lost its subject would be green ─────

test('⛔ this box composes at least one app of its own that ships a front component', () => {
  assert.ok(
    APPS.length > 0,
    'composition.json lists no `instanceApps` — either this box writes no app of its own (and then the whole ' +
      'demonstration of «how do I extend Forge?» is gone) or the list moved, and this rule graded nothing',
  );
  assert.ok(
    COMPONENTS.length > 0,
    `${APPS.length} app(s) of this box declare no front component at all (no \`forge.wiring.blocks\`, no ` +
      '`forge.wiring.gate`). That is possible — a DRIVER reaches every front through the port — but it is ' +
      'also what a manifest whose wiring moved looks like, and the two must not be indistinguishable',
  );
});

test('⛔ this box owns at least one front that produces a bundle', () => {
  assert.ok(BUILDING_FORKS.length > 0, 'no directory of this repo installs the kit and declares a `build` script');
});

test('⛔ the jurisdictions are not empty — a rule that grades no PAIR is a rule that is merely quiet', async (t) => {
  if (!TREE.path) {
    t.skip('no Forge checkout to read `scripts/publishing/surfaces.json` from — see the NOT CHECKED lines above');
    return;
  }
  const { pairs } = reach({ components: COMPONENTS, fronts: await fronts() });
  assert.ok(
    pairs > 0,
    `${COMPONENTS.length} declared component(s) × ${BUILDING_FORKS.length} front(s) produced ZERO graded ` +
      'pairs. Every verdict below would be vacuously true. Either no front of this box is a cut of a surface ' +
      'any of these components is served by, or `surfaces.json` stopped naming them',
  );
  say(`${pairs} (component × front) pair(s) graded`);
});

// ── ★★ the verdict ───────────────────────────────────────────────────────────────────────────────────────

test('★★★ every front component this box declares is REACHABLE by the fronts that must draw it', async (t) => {
  if (!TREE.path) {
    t.skip('no Forge checkout on this machine — jurisdiction cannot be derived; see the NOT CHECKED lines above');
    return;
  }
  const { findings, waived, unmatched } = reach({
    components: COMPONENTS,
    fronts: await fronts(),
    waivers: DIVERGENCES,
  });

  // ⚠️ THE STALE WAIVER IS GRADED FIRST, because a waiver that matches nothing is the one way this list can
  // become a lid: the finding it was written for is gone (fixed, or renamed, or the app left) and the entry
  // now covers whatever arrives next under the same name.
  assert.deepEqual(
    unmatched.map((w) => `${w.fork} × ${w.app}${w.component ? `/${w.component}` : ''}`),
    [],
    `${unmatched.length} declared DIVERGENCE(s) match no finding — they were written for something that no ` +
      'longer happens. Delete them; a waiver nobody needs is a waiver waiting to hide the next defect',
  );

  for (const entry of waived) {
    say(`waived: ${entry.fork} × ${entry.app}/${entry.component} — ${entry.kind}`);
  }

  assert.deepEqual(
    findings.map((f) => `${f.fork} × ${f.app}/${f.component} [${f.kind}]`),
    [],
    `${findings.length} front component(s) this box DECLARES and no front of this box can DRAW:\n` +
      findings.map((f) => `  · ${f.fork} × ${f.app}/${f.component}: ${f.why}`).join('\n') +
      '\nThe placement is real, the port publishes it and the page shows nothing. Close it with the three ' +
      'gestures (dependency · transpilePackages · tracing root) plus a REGENERATED registry — or declare the ' +
      'divergence in DIVERGENCES at the top of this file, with a reason.',
  );
  say(`${COMPONENTS.length} declared component(s); ${waived.length} waived, the rest reachable`);
});

// ── ★ and the other half of the same sentence: a front that reached one is NOT a front that drew it ───────

test('★ a front that names an app of this box must also transpile it, trace it and import it', async (t) => {
  if (!TREE.path) {
    t.skip('no Forge checkout on this machine — see the NOT CHECKED lines above');
    return;
  }
  // The narrow question the broad one cannot ask: a front outside every jurisdiction (`totem/`, a cut of no
  // Forge surface) still owes the remaining gestures for an app it DID ask for. This is the rule's own second
  // branch, stated as a test so the day `totem/` drops its hand-welded registry is a red day.
  const own = (await fronts()).filter((f) => f.surface === null);
  say(`fronts that are a cut of no surface: ${own.map((f) => f.dir).join(', ') || 'none'}`);
  const asked = COMPONENTS.filter((c) => own.some((f) => Object.hasOwn(f.dependencies, c.package)));
  assert.ok(
    own.length === 0 || asked.length > 0,
    `${own.map((f) => f.dir).join(', ')} is a cut of no Forge surface, so its jurisdiction is the apps it ` +
      'NAMES — and it names none of them. Either it stopped wanting the app (then take the dependency out) ' +
      'or the package name drifted, and this branch of the rule now grades nothing',
  );
  const { findings } = reach({ components: asked, fronts: own, waivers: DIVERGENCES });
  assert.deepEqual(
    findings.map((f) => `${f.fork} × ${f.app}/${f.component} [${f.kind}]`),
    [],
    findings.map((f) => `  · ${f.why}`).join('\n'),
  );
  for (const component of asked) {
    const where = own.find((f) => f.imports.has(component.specifier))?.imports.get(component.specifier);
    say(`${component.app}/${component.component} reached by its own front at ${where}`);
  }
});
