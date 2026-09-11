// ★★★ WHICH FRONT COMPONENTS THIS INSTANCE'S OWN APPS SHIP, AND WHETHER THIS INSTANCE'S OWN FRONTS CAN REACH
// THEM — the declaration, the reality, and the rule that compares them. Asked by
// `bin/front-app-reach.guard.mjs`, answered here, in ONE place.
//
// It is the third sibling of `bin/forks.mjs` ("which trees of this repo are a fork of a Forge front") and
// `bin/instance-apps.mjs` ("which directories are apps of this box"). Those two answer who the parties are;
// this one answers the question that only exists because BOTH parties belong to the same instance.
//
// ── ⛔ THE DEFECT THIS FILE EXISTS FOR, MEASURED ON THIS TREE (caderno pk32 §15) ──────────────────────────
//
// The UI of an app has two halves, and only one of them travels through the port:
//
//   the DECLARATION — the placement, the composition, the config. It is DATA: it crosses the port and
//     reaches ANY front, ours or a customer's, with no build step anywhere.
//   the IMPLEMENTATION — the React component. It has to be COMPILED INTO THE BUNDLE of whoever renders it.
//
// A platform app crosses that second gap because it travels as a package (`bin/vendor-packages.sh` puts the
// tarball inside the fork, and the fork's `package.json` names it). An app of THIS REPOSITORY travels as a
// DIRECTORY OF SOURCE — `composition.json`'s `instanceApps[].source` is `./apps/<id>` — so a fork that does
// not name it cannot import it, and a block it cannot import is a block it silently does not draw.
//
// Measured here, and this is the specimen: `apps/demo-setup` declares three storefront blocks (the shop's
// mark in the header, the mobile drawer and the footer), `seed/demo-setup.json` places all three on FOUR
// stores including the café's — and `storefront-coffee/`, the café's forked vitrine, names the app nowhere.
// The placement exists, it is enabled, `read.extension_composition` publishes it, the admin shows the app's
// card, AND NOTHING ANYWHERE SAYS THE BLOCK WILL NOT BE DRAWN.
//
// ★★ THE OBLIGATION IS THE INSTANCE'S, and that is the owner's own verdict (10/09): *"se o app é da instância
// e o front é da instância, não é a instância que tem que declarar mesmo? não tem como o produto saber."* The
// product owes the SLOT, the contract and the generator; this repository owns the apps AND the forks, so it is
// the only party holding both ends of the comparison — which is why the rule lives here and not upstream.
//
// ── ★ WHAT "REACHABLE" MEANS, AND IT IS THREE GESTURES, NOT ONE ──────────────────────────────────────────
//
// Derived from the fork that already does it. `totem/` reaches `apps/demo-gate` today, and it takes all three:
//
//   1. `totem/package.json`      `"@forge/ext-demo-gate": "file:../apps/demo-gate"`   npm installs a SYMLINK
//   2. `totem/next.config.mjs`   `transpilePackages: [… '@forge/ext-demo-gate']`      it ships as .tsx + CSS
//   3. `totem/next.config.mjs`   `outputFileTracingRoot: '..'`                        the standalone tracer
//                                                                                     has to reach outside
//
// ⚠️ AND THE SECOND AND THIRD ARE NOT PEDANTRY — each has its own measured failure. Without (2) the build dies
// on the first `export type` ("Module parse failed: Unexpected token", the measurement written into
// `storefront-coffee/next.config.mjs`); without (3) the app compiles and the IMAGE is missing it, because the
// tracer never copies a file from above its root. A rule that checked only the dependency would pass a tree
// that cannot build and a tree whose container is short a module.
//
// ⚠️ ⛔ AND A TARBALL IS NOT THE PATH, WHICH IS THE PREMISE THIS FILE HAD TO DISCARD. `bin/pack-apps.sh` packs
// an app for the KERNEL and the obvious twin would pack one for the front — it does not work, and the failure
// is immediate. An app of this box writes its dependencies in the monorepo's vocabulary, and `npm pack` ships
// those specifiers verbatim (the product's own `scripts/pack-publishable.sh` says so: it uses `pnpm pack`
// precisely because pnpm resolves them). Measured on 2026-09-11, `npm pack apps/demo-setup` then installing
// the tarball into an empty project:
//
//     npm error code EUNSUPPORTEDPROTOCOL
//     npm error Unsupported URL Type "workspace:": workspace:*
//
// The directory dependency has no such problem — npm links it and never resolves its specs — and it is already
// committed, locked and working in `totem/package-lock.json`. So the front-side twin of `pack-apps.sh` is NOT
// a packing script: there is nothing to pack. The kernel needs a packed artifact because it READS manifests
// from a mounted directory at boot; a front needs a module its bundler can resolve, and three lines of
// configuration give it that. ⇒ WHAT WAS MISSING WAS NEVER THE MECHANISM. It was the rule that says when a
// fork has not used it.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { readJson, ROOT } from './release-tree.mjs';

/** This box's own composition — the list the oven bakes and the list this repository maintains. Its
 *  `instanceApps` is the DECLARATION half of everything below: an app of ours that is not on it reaches no
 *  image at all, so a front not reaching it would be the smaller problem. */
export const COMPOSITION = join(ROOT, 'composition.json');

/** Where a block's module lives inside its package, as an import specifier — the same derivation the
 *  product's generator uses (`packages/codegen/src/composition.ts`: `pkg.name + module.slice(1)`), so what
 *  this file looks for is what a generated registry would write. */
const specifierOf = (pkg, module) => `${pkg}${module.replace(/^\./, '')}`;

/**
 * Every app this repository writes, as `composition.json` declares it, with its manifest read from disk.
 *
 * ⚠️ THE LIST IS THE COMPOSITION'S, NEVER A DIRECTORY WALK: `apps/` could hold a half-written app, and the
 * question here is what this box COMPOSES — the same list the oven adopts with `--instance-apps`.
 * ⚠️ AND THE NAME IS `composed…` ON PURPOSE, because `bin/instance-apps.mjs` exports an `instanceApps(script)`
 * that answers a DIFFERENT question — which directories under `apps/` declare an npm script a runner is about
 * to call. Two functions with one name in sibling modules is the drift these files exist to catch.
 * @returns {{ id: string, package: string, source: string, path: string, manifest: object }[]}
 */
export function composedInstanceApps() {
  const list = readJson(COMPOSITION).instanceApps ?? [];
  return list
    .map((entry) => {
      const path = resolve(ROOT, entry.source);
      return { id: entry.id, package: entry.package, source: entry.source, path, manifest: readJson(join(path, 'package.json')) };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * ★ EVERY FRONT COMPONENT THOSE APPS SHIP, and WHICH SURFACE RENDERS IT — derived from `forge.wiring`, the
 * same field the product's own generator reads and the only place an app says this about itself.
 *
 * Three seams, because the product has three and they are not interchangeable:
 *   · `block`      — the surface's generic block seam (`generated/registry.tsx`). `surface` says which front.
 *   · `payment-ui` — a block with a ROLE. It declares `surface: storefront` and is CALLED by the payment
 *                    screens, which are the CHECKOUT's deployable — measured in caderno §15: the four payment
 *                    apps declare `storefront:checkout.*` hooks and the vitrine serves none of them.
 *   · `gate`       — the `storefront:gate` slot, which BOTH shopper-facing fronts mount.
 *
 * ⚠️ A DRIVER IS NOT HERE, AND THAT IS THE WHOLE POINT OF THE SPLIT (caderno §16). `apps/payment-pos` declares
 * `forge.wiring.drivers.payment`; that code runs INSIDE THE KERNEL and reaches every front through the port,
 * as data, for free — which is exactly why the totem renders its PIX screen while importing nothing. Only a
 * component has to be physically present in a bundle, so only a component can be out of reach.
 * @returns {{ app: string, package: string, component: string, seam: string, specifier: string, export: string, servedBy: string[] }[]}
 */
export function frontComponents(apps = composedInstanceApps()) {
  const out = [];
  for (const app of apps) {
    const wiring = app.manifest.forge?.wiring ?? {};
    for (const [component, block] of Object.entries(wiring.blocks ?? {})) {
      const surface = block.surface ?? 'storefront';
      const seam = block.role ? 'payment-ui' : 'block';
      // A role-bearing block renders on the storefront SURFACE and is served by the checkout DEPLOYABLE.
      const servedBy = seam === 'payment-ui' ? ['checkout'] : [surface];
      out.push({
        app: app.id,
        package: app.package,
        // Where the app is ON DISK, carried rather than guessed: the tracing-root question below is about a
        // real path, and `composition.json` is the only thing that says which one.
        appPath: app.path,
        component,
        seam,
        specifier: specifierOf(app.package, block.module ?? `./block/${component}`),
        export: block.export ?? 'default',
        servedBy,
      });
    }
    const gate = wiring.gate;
    if (gate) {
      for (const [face, declared] of Object.entries(gate)) {
        if (declared === false) continue;
        out.push({
          app: app.id,
          package: app.package,
          appPath: app.path,
          component: `gate.${face}`,
          seam: 'gate',
          specifier: specifierOf(app.package, declared?.module ?? `./block/${face}`),
          export: declared?.export ?? 'default',
          // The slot is mounted by the store-scoped root layout, which wraps BOTH route groups — so the
          // vitrine and the checkout each need their own copy of the implementation.
          servedBy: ['storefront', 'checkout'],
        });
      }
    }
  }
  return out.sort((a, b) => `${a.app}/${a.component}`.localeCompare(`${b.app}/${b.component}`));
}

// ── the REALITY half: what a front of this repository can actually reach ──────────────────────────────────

/** Every source file of a front, excluding its tests and its own node_modules. A hand-welded registry counts
 *  as reaching it — this asks whether the component is IN THE GRAPH, not how it got there. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(path, out);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
    if (/\.(test|spec)\.[tj]sx?$/.test(entry.name)) continue;
    out.push(path);
  }
  return out;
}

/**
 * ★ WHAT A FILE ACTUALLY PULLS INTO THE BUNDLE — and two things are deliberately NOT that.
 *
 * ⛔ COMMENTS ARE STRIPPED FIRST. Prose naming a module is prose; this house has gone green on a grep that
 * matched a comment before (`bin/store-mount-drift.guard.mjs` strips them for the same reason), and the
 * `storefront-coffee` layout's own header happens to name a registry path in prose.
 * ⛔ AND `import type` IS NOT A REACH. A type is erased at build time: a front that only annotates against an
 * app compiles fine and renders nothing, which is precisely the silence being graded.
 * @returns {[string, string][]} specifier → a short note saying how it arrived (`` or ` (dynamic)`)
 */
export function valueImports(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  for (const [, typeOnly, spec] of code.matchAll(/import\s+(type\s+)?[^;']*?from\s*'([^']+)'/g)) {
    if (!typeOnly) out.push([spec, '']);
  }
  for (const [, spec] of code.matchAll(/import\(\s*'([^']+)'\s*\)/g)) out.push([spec, ' (dynamic)']);
  return out;
}

/**
 * The three facts about one front, read from the tree rather than assumed.
 * @param {{ dir: string, path: string }} fork
 * @param {string | null} surface the Forge surface this fork is a CUT OF, or null when it is a cut of nothing
 * @param {object} config the fork's already-imported `next.config.mjs` default export
 */
export function frontFacts(fork, surface, config) {
  const manifest = readJson(join(fork.path, 'package.json'));
  const src = existsSync(join(fork.path, 'src')) ? sourceFiles(join(fork.path, 'src')) : [];
  /** specifier -> the file of this front that imports it. */
  const imports = new Map();
  for (const file of src) {
    for (const [specifier, where] of valueImports(readFileSync(file, 'utf8'))) {
      if (!imports.has(specifier)) imports.set(specifier, `${relative(fork.path, file)}${where}`);
    }
  }
  return {
    dir: fork.dir,
    surface,
    dependencies: { ...manifest.dependencies },
    transpiles: config.transpilePackages ?? [],
    // The tracer's root, as a real path. Next defaults it to the app itself, which is exactly the value that
    // silently drops a `file:../` dependency from the standalone output.
    tracingRoot: config.outputFileTracingRoot ? resolve(config.outputFileTracingRoot) : resolve(fork.path),
    path: fork.path,
    imports,
  };
}

// ── the RULE ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ★ WHOSE PROBLEM IS THIS COMPONENT — and the answer has two shapes because this repository has two kinds of
 * front. A fork that is a CUT OF one of our surfaces inherits that surface's obligations: whatever an app
 * declares for `storefront` is the vitrine's business whether the vitrine knows it or not. A front that is a
 * cut of NOTHING (`totem/` — ours, and a cut of no Forge app) declares its own seams, so its jurisdiction is
 * what it asked for: the apps it names. ⚠️ That second branch is deliberately narrow and it is not a hole —
 * the counter's store places no mark, and a rule that demanded every block in every front would need a typed
 * exception list, which is the thing this house keeps being bitten by.
 */
export function inJurisdiction(front, component) {
  if (front.surface) return component.servedBy.includes(front.surface);
  return Object.hasOwn(front.dependencies, component.package);
}

/** Is `path` inside `root`? The tracer's question, asked without string arithmetic on lengths. */
const inside = (root, path) => path === root || path.startsWith(root.endsWith('/') ? root : `${root}/`);

/** The gestures, in the order a build needs them — so the first missing one is the one a reader must fix. */
const GESTURES = [
  {
    kind: 'not-a-dependency',
    holds: (front, c) => Object.hasOwn(front.dependencies, c.package),
    say: (front, c) =>
      `${front.dir}/package.json does not name ${c.package}, so \`${c.specifier}\` resolves to nothing — ` +
      `add it as \`"${c.package}": "file:${relative(front.path, c.appPath)}"\` (npm installs a symlink; ` +
      `totem/package.json already does exactly this for @forge/ext-demo-gate)`,
  },
  {
    kind: 'not-transpiled',
    holds: (front, c) => front.transpiles.includes(c.package),
    say: (front, c) =>
      `${front.dir} installs ${c.package} but does not list it in \`transpilePackages\` — the app ships as ` +
      `.tsx + CSS Modules, so the build dies on its first \`export type\` ("Module parse failed: Unexpected ` +
      `token")`,
  },
  {
    kind: 'unreached',
    holds: (front, c) => front.imports.has(c.specifier),
    say: (front, c) =>
      `no source file of ${front.dir} imports \`${c.specifier}\` — the app is installed and compilable and ` +
      `NOTHING RENDERS IT. ` +
      (front.surface
        ? 'The seam that would is `src/lib/extensions/generated/`, a GENERATED surface, so the fix is to ' +
          'regenerate it and never to weld an import by hand'
        : 'This front is a cut of no Forge surface, so its registry is its own — and a registry written by ' +
          'hand is the thing that rots quietly (see totem/src/lib/gate/registry.tsx)'),
  },
  {
    // LAST, because it is the only one that is invisible until an image runs: everything above is a red build
    // or a blank page on this machine, and this one is a container that is short a module.
    kind: 'untraced',
    holds: (front, c) => inside(front.tracingRoot, c.appPath),
    say: (front, c) =>
      `${front.dir} reaches ${c.package} at ${c.appPath}, which is OUTSIDE \`outputFileTracingRoot\` ` +
      `(${front.tracingRoot}) — the standalone tracer never copies a file from above its root, so the BUILD ` +
      `passes and the IMAGE is missing the module (totem/next.config.mjs sets it to '..' for this reason)`,
  },
];

/**
 * ★★ DECLARATION × REALITY, IN ONE ANSWER — the shape `bin/verify-seed.mjs`'s section 3e established: never a
 * list of names, always both sides derived and compared.
 *
 * @param {object} input
 * @param {ReturnType<typeof frontComponents>} input.components what this box's apps declare
 * @param {ReturnType<typeof frontFacts>[]} input.fronts what this box's fronts can reach
 * @param {{ fork: string, app: string, component?: string, why: string }[]} input.waivers declared divergences
 * @returns {{ findings: object[], waived: object[], pairs: number, unmatched: object[] }}
 */
export function reach({ components, fronts, waivers = [] }) {
  const findings = [];
  let pairs = 0;
  for (const front of fronts) {
    for (const component of components) {
      if (!inJurisdiction(front, component)) continue;
      pairs += 1;
      // `appPath` comes from the composition (`frontComponents`); a fixture states it itself. It is REQUIRED
      // rather than defaulted: the tracing-root verdict is about a real directory, and a guessed one would
      // produce a confident answer about a path nobody declared.
      if (!component.appPath) {
        throw new Error(`${component.app}/${component.component} carries no appPath — nothing can say whether a front's tracing root covers it`);
      }
      const subject = component;
      for (const gesture of GESTURES) {
        if (gesture.holds(front, subject)) continue;
        findings.push({
          fork: front.dir,
          app: component.app,
          component: component.component,
          kind: gesture.kind,
          why: gesture.say(front, subject),
        });
        // One verdict per pair: the gestures are ordered, and reporting "also not transpiled" about a package
        // that is not even a dependency is noise that hides the one thing to do next.
        break;
      }
    }
  }
  const matched = new Set();
  const waived = [];
  const kept = [];
  for (const finding of findings) {
    const waiver = waivers.find(
      (w) =>
        w.fork === finding.fork &&
        w.app === finding.app &&
        (w.component === undefined || w.component === finding.component),
    );
    if (waiver) {
      matched.add(waiver);
      waived.push({ ...finding, waiver });
    } else kept.push(finding);
  }
  return { findings: kept, waived, pairs, unmatched: waivers.filter((w) => !matched.has(w)) };
}
