// ★★★ "MY COMPOSITION DECLARES A BLOCK OF FRONT THAT NO FRONT OF MINE REACHES" — said OUT LOUD, by name.
//
//   node --test bin/front-app-reach.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/front-app-reach.guard.mjs
//
// ── ⛔ THE SILENCE THIS ENDS (caderno pk32 §15, measured on this bench 2026-09-10/11) ─────────────────────
//
// `apps/demo-setup` declares three storefront blocks — the shop's mark in the header bar, in the mobile
// drawer and in the footer. `seed/demo-setup.json` placed all three on THREE stores, the café's among them.
// The placements were real and `enabled`, `read.extension_composition` published them, the admin showed the
// app's card. And `storefront-coffee/` — the café's forked vitrine — names the app nowhere: not in its
// `package.json`, not in `transpilePackages`, not in any registry. So the café's vitrine COULD NOT draw the
// mark its own box told it to draw, and before this file nothing anywhere said so. Not the build, not the
// suite, not the box's own verifier, not a log line at runtime.
//
// ★★ pk35/d7 — AND THE CAFÉ'S HALF OF THAT IS NOW DECIDED RATHER THAN PENDING: `seed/demo-setup.json` says
// `"cafe": null`, so the instance places nothing there at all. The fork draws its own mark and its account
// screens draw `chrome`'s — measured, zero `demo-setup-*` marks on either — which is the owner's rule of
// 11/09 («o fork é do cliente, 100% liberdade» ⇒ the instance removes that store's placement). What this
// file still grades is the OTHER question, and it is not about stores: the fork cannot reach this app's CODE
// at all, so the day a café operator drops one of these blocks in Compose it would still draw nothing.
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
import { pinnedCommit, readJson, releaseTree } from './release-tree.mjs';

const say = (line) => console.error(`[front-app-reach] ${line}`);

/**
 * ★ THE DIVERGENCES THIS BOX HAS DECIDED NOT TO CLOSE YET — the affordance that makes the failure honest.
 * Without it, a red has nowhere to go but `rm` of the rule, which silences the next one too. Same shape, and
 * the same two safeguards, as `bin/store-mount-drift.guard.mjs`'s list:
 *   · every entry is PRINTED on every run, so a divergence can never become quietly permanent;
 *   · an entry that matches NO finding is RED, so a waiver outlives its reason for exactly one run.
 *
 * One entry per (fork, app) or (fork, app, component). `why` is not decoration.
 *
 * ★★★ pk35/d2 — AND A THIRD SAFEGUARD, BECAUSE THE SECOND ONE DOES NOT COVER THE WAY THESE TWO ROTTED.
 * Both entries below were written waiting on ONE artifact of the product, and both said so in prose: *"the
 * tool is owed by the product and is being fiado by pk32/p1-parto"*. The tool LANDED — measured 2026-09-13,
 * `@forgecommerce/surface-codegen` is a package of the pinned release and is on its `publishable.json` — and
 * nothing here moved, because a blocker written in prose is a blocker nobody can grade. The waivers went on
 * matching a finding, so safeguard two stayed green, and went on PRINTING a reason that had stopped being
 * true. Two weeks of "somebody else owes this" over an artifact already in the box's own vendor directory.
 *
 * ⇒ `until` is that sentence made checkable: the conditions THIS BOX would have to meet for the waiver to
 * die, written as things on disk rather than as a story. When every one of them holds, the entry is RED and
 * names them — so a waiver may outlive its reason for exactly one run in THIS direction too, and the reason
 * it prints is a reason a run can still disprove.
 */
const DIVERGENCES = [
  {
    fork: 'storefront-coffee',
    app: 'demo-setup',
    // ★ pk35, o corte — ESTA ENTRADA NÃO ESPERA POR NADA DESTE REPO. A ferramenta chegou (d3) e o café
    // deixou de receber as marcas (d7): o que resta é DECISÃO do dono do fork, que desenha a marca por
    // conta. ⛔ Por isso ela não carrega `until`: um `until` aqui prometeria uma morte que nenhuma
    // condição de disco pode cumprir.
    waitsOn: null,
    why:
      'THE TOOL LANDED AND THIS ONE IS NOW A DECISION, WHICH IS THE OPPOSITE OF WHAT THIS ENTRY USED TO SAY. ' +
      'It used to blame a missing product artifact ("the tool is owed by the product and is being fiado by ' +
      'pk32/p1-parto"); that tool SHIPPED — `@forgecommerce/surface-codegen` is in the release, the fork ' +
      'installs it and carries its own `composition.json` since pk35/d3. What holds this open is nobody\'s ' +
      'oversight: the café draws its mark BY ITS OWN HAND (`CoffeeChrome`), so composing `demo-setup` here ' +
      'would draw a second one. His own rule decides it — 11/09, «o fork é do cliente, 100% liberdade» ⇒ when ' +
      'a fork draws for itself what a declared block would draw, the INSTANCE removes the placement (the ' +
      'shape `seed/outlet.mjs` already uses). ⇒ the fix is a seed change, not three gestures, and it is not ' +
      'this slice\'s to make. ★ pk35/d7 MADE IT: `seed/demo-setup.json` now declares `"cafe": null`, after ' +
      'MEASURING that the three marks drew on ZERO screens there — the checkout account layout replaces both ' +
      'regions, so the reference chrome only ever arrives as a fallback that never renders. ⇒ this costs a ' +
      'shopper nothing today, and the entry stays because the REACH is still absent: the day an operator ' +
      'drops one of these blocks on the café in Compose it would draw nothing, and nobody is entitled to ' +
      'not know that.',
  },
  // ⛔ AQUI VIVIA A DIVERGÊNCIA `storefront-coffee × demo-gate`, E ELA MORREU EM 14/09 (pk35).
  // Ela dizia que o fork não alcançava a portaria porque `src/lib/extensions/generated/` é superfície GERADA e
  // a ferramenta que a escreve não conseguia rodar contra um fork que instala os tarballs do RELEASE — o
  // gerador do lado FRONT exigia os exports do lado KERNEL, que o tarball de front tira de propósito.
  // ★ Os muros caíram na mesma leva (pk35/p6, no produto), o fork ganhou `composition.json` + `codegen` +
  // dependência de verdade (pk35/d3), `npm run codegen` escreveu `generated/gate-registry.tsx`, e
  // `src/lib/extensions/gate.ts` o lê antes do registro soldado. ⇒ o alcance existe, e uma dispensa que
  // sobrevive ao próprio motivo é a tampa que este arquivo inteiro existe para impedir.
  // ⚠️ Se o café voltar a não desenhar a portaria, a regra abaixo fica VERMELHA sozinha — que é o certo.
];

/**
 * ★ THE CONDITIONS A WAIVER NAMED FOR ITS OWN DEATH, each answered from disk rather than from the entry.
 *
 * A waiver with no `until` produces none, and that is legal — some divergences are a DECISION and wait on
 * nothing. What is not legal is an `until` that names a fork this box does not build, or a condition list
 * that is empty: both would make the verdict below vacuously true, which is the shape this whole file exists
 * to refuse. The premise test grades exactly that.
 *
 * @returns {{ what: string, holds: boolean }[]}
 */
function conditionsOf(divergence) {
  const until = divergence.until;
  if (!until) return [];
  const fork = BUILDING_FORKS.find((f) => f.dir === until.fork);
  if (!fork) return [{ what: `${until.fork} is not a front this box builds`, holds: false }];
  const manifestPath = join(fork.path, 'package.json');
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : {};
  const out = [];
  for (const file of until.files ?? []) {
    out.push({ what: `${until.fork}/${file} exists`, holds: existsSync(join(fork.path, file)) });
  }
  for (const script of until.scripts ?? []) {
    out.push({
      what: `${until.fork}/package.json declares the \`${script}\` script`,
      holds: Boolean(manifest.scripts?.[script]),
    });
  }
  for (const dep of until.dependencies ?? []) {
    out.push({
      what: `${until.fork} depends on ${dep}`,
      // ⚠️ A DEPENDENCY, NOT AN `overrides` ENTRY, AND THE DIFFERENCE IS THE WHOLE MEASUREMENT OF pk35/d2:
      // `storefront-coffee/package.json` has carried `@forgecommerce/surface-codegen` under `overrides` for
      // days — which pins a version npm would only reach for if something ELSE asked for it, and nothing
      // does. An override is not an install; grading it would call this waiver dead while the tool is absent.
      holds: Boolean(manifest.dependencies?.[dep] ?? manifest.devDependencies?.[dep]),
    });
  }
  return out;
}

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
  for (const condition of conditionsOf(divergence)) {
    say(`   until: ${condition.holds ? '✔' : '✗'} ${condition.what}`);
  }
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

test('⛔ every divergence SAYS what it waits on — silence is a lid', () => {
  // ★ pk35, o corte — A REGRA VIROU DERIVADA, e a razão é que o corte a quebrou de propósito. A pk35/d2 deu a
  // estas entradas um `until` de condições em disco; a pk35/d3 CUMPRIU essas condições e trocou o instrumento
  // por um guard que RODA o gerador. Manter o `until` faria a espera morrer pelo motivo errado; tirá-lo sem
  // mais nada deixaria a lista muda. ⇒ toda entrada declara UMA das duas formas, e a ausência das duas é o
  // defeito: `until` (as condições que a matam) ou `waitsOn` (null = é decisão; uma string = quem mede a espera).
  const undeclared = DIVERGENCES.filter((d) => !d.until && !('waitsOn' in d));
  assert.deepEqual(
    undeclared.map((d) => `${d.fork} × ${d.app}`),
    [],
    'a divergence that declares neither `until` nor `waitsOn` says nothing about when it ends, and a waiver ' +
      'that cannot end is a lid. Write the disk conditions in `until`, or declare `waitsOn`: null when it is a ' +
      'DECISION, or the instrument that measures the wait when somebody else measures it.',
  );
  // ⚠️ ANTI-VÁCUO: as duas formas têm de ser exercitadas por esta lista, senão a regra passa por não haver sujeito.
  assert.ok(
    DIVERGENCES.some((d) => d.until) || DIVERGENCES.some((d) => 'waitsOn' in d),
    'no divergence declares either shape — this rule graded nothing at all',
  );
  const withUntil = DIVERGENCES.filter((d) => d.until);
  for (const divergence of withUntil) {
    const conditions = conditionsOf(divergence);
    assert.ok(
      conditions.length > 0,
      `${divergence.fork} × ${divergence.app} declares an \`until\` that produced NO condition — it names no ` +
        'file, no script and no dependency, so "the waiver outlived its reason" can never become true. An ' +
        'empty condition list reads like a promise and behaves like a comment.',
    );
    const known = BUILDING_FORKS.some((f) => f.dir === divergence.until.fork);
    assert.ok(
      known,
      `${divergence.fork} × ${divergence.app} points its \`until\` at "${divergence.until.fork}", which is ` +
        'not a front this box builds. A condition measured against a directory that is not there is a ' +
        'condition that is permanently unmet, which is how a waiver becomes permanent.',
    );
  }
});

test('★★ a waiver whose OWN conditions are all met is RED — it outlived its reason, and says so', () => {
  // ⛔ WHY THIS IS NOT THE SAME TEST AS "a waiver that matches no finding". That one fires when the finding
  // disappears — the app left, the fork renamed, somebody closed the gap. This one fires while the finding is
  // still there and the REASON is gone: the box now has everything the entry said it was waiting for, so the
  // remaining gap is nobody's blocker but the author's. Both entries of this list rotted in exactly that
  // window, for two weeks, printing a product artifact that had already shipped.
  const dead = DIVERGENCES.filter((d) => {
    const conditions = conditionsOf(d);
    return conditions.length > 0 && conditions.every((c) => c.holds);
  });
  assert.deepEqual(
    dead.map((d) => `${d.fork} × ${d.app}`),
    [],
    `${dead.length} declared DIVERGENCE(s) have met every condition they set for their own death:\n` +
      dead
        .map(
          (d) =>
            `  · ${d.fork} × ${d.app}: ${conditionsOf(d)
              .map((c) => c.what)
              .join('; ')}`,
        )
        .join('\n') +
      '\nThe thing this waiver was waiting for is here. Close the gap and DELETE the entry — or, if the ' +
      'gap is now waiting on something else, write the new conditions; a reason that has become untrue is ' +
      'worse than no reason, because it is still printed on every run.',
  );
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
