// THE RULE BEHIND `bin/front-app-reach.guard.mjs`, GRADED ON FIXTURES — because the guard itself runs against
// this tree, and a tree where everything is fine proves only that the rule is quiet.
//
// ⛔ THIS FILE EXISTS FOR ONE REASON: ANTI-VACUUM. A rule that compares a declaration to a reality goes green
// in three different ways — because both sides agree, because the declaration was empty, and because the
// reality was never read. The second and third are the failure this house keeps shipping (pk31 had two guards
// born blind), and the tree cannot distinguish them: it is HEALTHY, so the rule is silent either way.
//
// So the rule is a pure function over facts, and these fixtures hand it the cases the tree cannot:
//   · an app declaring a block and a front in jurisdiction that names it NOWHERE   → it must SEE it
//   · the same pair, fully wired                                                   → it must stay quiet
//   · no declaration at all / no front at all                                      → the caller must refuse
//
//   node --test bin/front-apps.test.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import test from 'node:test';
import { frontComponents, inJurisdiction, reach, valueImports } from './front-apps.mjs';

/** A front whose facts are stated rather than read. `imports` is what the real `frontFacts` derives from the
 *  fork's own source files. */
const front = (over = {}) => ({
  dir: 'fixture-front',
  surface: 'storefront',
  dependencies: {},
  transpiles: [],
  tracingRoot: '/repo',
  path: '/repo/fixture-front',
  imports: new Map(),
  ...over,
});

/** A block an app of the instance declares, in the shape `frontComponents` derives from `forge.wiring`. */
const block = (over = {}) => ({
  app: 'my-app',
  package: '@forge/ext-my-app',
  component: 'header_brand',
  seam: 'block',
  specifier: '@forge/ext-my-app/block/marks',
  export: 'HeaderBrand',
  servedBy: ['storefront'],
  appPath: '/repo/apps/my-app',
  ...over,
});

// ── ★ THE CASE THE TREE CANNOT SHOW: the rule must SEE a declared block that nothing renders ──────────────

test('★★ a block declared for a surface this front is a cut of, and named NOWHERE in it, is a finding', () => {
  const { findings, pairs } = reach({
    components: [block()],
    fronts: [front({ dependencies: { '@forge/ext-my-app': 'file:../apps/my-app' }, transpiles: ['@forge/ext-my-app'], imports: new Map() })],
  });
  assert.equal(pairs, 1, 'the pair has to be GRADED — a rule that skipped it would be green by silence');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'unreached');
  // The message names all three, because "something is unreachable" sends a reader hunting.
  assert.match(findings[0].why, /fixture-front/);
  assert.match(findings[0].why, /@forge\/ext-my-app\/block\/marks/);
  assert.match(findings[0].why, /GENERATED surface/);
});

test('★ the same pair, fully wired, is silent — a rule that cannot be satisfied gets turned off', () => {
  const { findings, pairs } = reach({
    components: [block()],
    fronts: [
      front({
        dependencies: { '@forge/ext-my-app': 'file:../apps/my-app' },
        transpiles: ['@forge/ext-my-app'],
        imports: new Map([['@forge/ext-my-app/block/marks', 'src/lib/extensions/generated/registry.tsx']]),
      }),
    ],
  });
  assert.equal(pairs, 1);
  assert.deepEqual(findings, []);
});

// ── the three gestures, each on its own, because each has its own measured failure ────────────────────────

test('★ a front that does not NAME the package reports that first, and nothing else', () => {
  const { findings } = reach({ components: [block()], fronts: [front()] });
  assert.equal(findings.length, 1, 'one verdict per pair: three complaints about one missing line is noise');
  assert.equal(findings[0].kind, 'not-a-dependency');
  assert.match(findings[0].why, /file:\.\.\/apps\/my-app/, 'the message carries the line to write');
});

test('★ a front that installs the app and does not transpile it would die at BUILD, and is told so', () => {
  const { findings } = reach({
    components: [block()],
    fronts: [front({ dependencies: { '@forge/ext-my-app': 'file:../apps/my-app' } })],
  });
  assert.equal(findings[0].kind, 'not-transpiled');
  assert.match(findings[0].why, /Module parse failed/);
});

test('★★ a front whose tracing root excludes the app BUILDS GREEN and ships a container short a module', () => {
  const { findings } = reach({
    components: [block()],
    fronts: [
      front({
        dependencies: { '@forge/ext-my-app': 'file:../apps/my-app' },
        transpiles: ['@forge/ext-my-app'],
        imports: new Map([['@forge/ext-my-app/block/marks', 'src/lib/extensions/generated/registry.tsx']]),
        // Next's own default: the app itself. `apps/my-app` is a SIBLING of the front, so it is above it.
        tracingRoot: '/repo/fixture-front',
      }),
    ],
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'untraced');
  assert.match(findings[0].why, /outputFileTracingRoot/);
});

// ── jurisdiction: who answers for what ───────────────────────────────────────────────────────────────────

test('★ a cut of a surface answers for every component declared FOR that surface, asked or not', () => {
  assert.equal(inJurisdiction(front({ surface: 'storefront' }), block()), true);
  assert.equal(inJurisdiction(front({ surface: 'checkout' }), block()), false);
});

test('★ a front that is a cut of NOTHING answers only for the apps it names — and for those, fully', () => {
  const own = front({ surface: null, dir: 'totem-like' });
  assert.equal(inJurisdiction(own, block()), false, 'it never asked for this block');
  const asked = front({ surface: null, dir: 'totem-like', dependencies: { '@forge/ext-my-app': 'file:../apps/my-app' } });
  assert.equal(inJurisdiction(asked, block()), true);
  // …and having asked, it owes the remaining gestures.
  assert.equal(reach({ components: [block()], fronts: [asked] }).findings[0].kind, 'not-transpiled');
});

test('★ a payment block declares the storefront SURFACE and is served by the CHECKOUT deployable', () => {
  const role = block({ component: 'payment-options', seam: 'payment-ui', servedBy: ['checkout'] });
  assert.equal(inJurisdiction(front({ surface: 'storefront' }), role), false);
  assert.equal(inJurisdiction(front({ surface: 'checkout' }), role), true);
});

// ── ⛔ THE VACUUM ITSELF ──────────────────────────────────────────────────────────────────────────────────

test('⛔ with no component declared the rule grades NOTHING, and says so through `pairs`', () => {
  // It does not throw: the RULE has nothing to say about an empty declaration, and it is the GUARD's job to
  // refuse. What matters is that the refusal is possible — `pairs: 0` is the only signal that distinguishes
  // "everything is reachable" from "nothing was asked".
  const { findings, pairs } = reach({ components: [], fronts: [front()] });
  assert.deepEqual(findings, []);
  assert.equal(pairs, 0);
});

test('⛔ with no front the rule is equally vacuous, and `pairs` is again the only witness', () => {
  const { findings, pairs } = reach({ components: [block()], fronts: [] });
  assert.deepEqual(findings, []);
  assert.equal(pairs, 0);
});

// ── waivers: a fork's owner may refuse, and may not go quiet ──────────────────────────────────────────────

test('★★ a waiver moves a finding out of the red and KEEPS it visible', () => {
  const waiver = { fork: 'fixture-front', app: 'my-app', why: 'because X, and it is owed by Y' };
  const { findings, waived } = reach({ components: [block()], fronts: [front()], waivers: [waiver] });
  assert.deepEqual(findings, []);
  assert.equal(waived.length, 1);
  assert.equal(waived[0].waiver, waiver, 'the caller prints it — a silent waiver is a permanent one');
});

test('★★ a waiver that matches nothing is REPORTED, so it outlives its reason by one run', () => {
  const stale = { fork: 'fixture-front', app: 'an-app-nobody-declares', why: '…' };
  const { unmatched } = reach({ components: [block()], fronts: [front()], waivers: [stale] });
  assert.deepEqual(unmatched, [stale]);
});

test('★ a waiver is per (fork, app) or per (fork, app, component) — never a blanket', () => {
  const components = [block(), block({ component: 'footer_brand' })];
  const one = { fork: 'fixture-front', app: 'my-app', component: 'footer_brand', why: '…' };
  const { findings, waived } = reach({ components, fronts: [front()], waivers: [one] });
  assert.equal(waived.length, 1);
  assert.deepEqual(
    findings.map((f) => f.component),
    ['header_brand'],
    'waiving one component must not waive its sibling',
  );
});

// ── ⛔ what counts as REACHING it, and two things that look like it and are not ───────────────────────────

test('⛔ prose naming the module is NOT a reach — a comment would make this rule green while blind', () => {
  const source = [
    "// The mark comes from '@forge/ext-my-app/block/marks', which the registry wires up.",
    '/* import { HeaderBrand } from "@forge/ext-my-app/block/marks"; — kept for reference */',
    "import { Something } from './local';",
  ].join('\n');
  assert.deepEqual(
    valueImports(source).map(([spec]) => spec),
    ['./local'],
  );
  // Not hypothetical: `storefront-coffee/src/app/s/[store]/layout.tsx:8` names a registry module in prose,
  // and `bin/store-mount-drift.guard.mjs` strips comments for exactly this reason.
});

test('⛔ `import type` is NOT a reach either — a type is erased, so nothing lands in the bundle', () => {
  const source = [
    "import type { Mark } from '@forge/ext-my-app/block/marks';",
    "import { HeaderBrand } from '@forge/ext-other/block/marks';",
    "const lazy = await import('@forge/ext-third/block/marks');",
  ].join('\n');
  assert.deepEqual(valueImports(source), [
    ['@forge/ext-other/block/marks', ''],
    ['@forge/ext-third/block/marks', ' (dynamic)'],
  ]);
});

// ── the declaration half, derived from `forge.wiring` the way the product's generator reads it ────────────

test('★★ `frontComponents` derives the seam from the manifest, and a DRIVER is not a front component', () => {
  const apps = [
    {
      id: 'pos',
      package: '@forge/ext-pos',
      path: '/repo/apps/pos',
      manifest: {
        forge: {
          wiring: {
            blocks: {
              'payment-options': { surface: 'storefront', role: 'options', module: './payment-options', export: 'default' },
              panel: { surface: 'admin', module: './panel', export: 'Panel' },
            },
            // ★ caderno §16: this runs INSIDE THE KERNEL and reaches every front through the port, as data.
            // It can never be out of reach, so it must never be graded.
            drivers: { payment: { module: './provider', export: 'provider' } },
          },
        },
      },
    },
    {
      id: 'gate',
      package: '@forge/ext-gate',
      path: '/repo/apps/gate',
      manifest: { forge: { wiring: { gate: { interstitial: { module: './block/entry', export: 'GateInterstitial' }, ribbon: false } } } },
    },
  ];
  const components = frontComponents(apps);
  assert.deepEqual(
    components.map((c) => `${c.app}/${c.component}:${c.seam}:${c.servedBy.join('+')}`),
    [
      'gate/gate.interstitial:gate:storefront+checkout',
      'pos/panel:block:admin',
      'pos/payment-options:payment-ui:checkout',
    ],
  );
  assert.equal(components.find((c) => c.component === 'payment-options').specifier, '@forge/ext-pos/payment-options');
  // `"ribbon": false` is the app saying its gate has no ribbon — a declared ABSENCE, never a missing block.
  assert.equal(components.some((c) => c.component === 'gate.ribbon'), false);
});
