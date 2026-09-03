// ★★ THIS BOX PROMISES EVERY APP THE PLATFORM OFFERS. THIS GRADES THE PROMISE AGAINST THE PLATFORM.
//
// THE DEFECT IT EXISTS FOR, AND IT HAPPENED. `composition.json` named SEVEN apps while the product offered
// seventeen. Nothing was red: the list was well-formed, the oven baked it, the box came up, and the ten
// missing apps were missing in the only way an app can be missing from an image — no screen, no command, no
// row in the admin's Apps area, no error anywhere. It was found by a HUMAN asking "where did the other ones
// go?", weeks later, in front of the box the apps were supposed to be demonstrated on.
//
// A list that is a SUBSET is a legitimate thing for a customer's box to be (`image = release × list` exists
// for exactly that). It is not a legitimate thing for THIS box to be, and the difference is a rule somebody
// has to write down, because no mechanism can guess it. The rule is in `composition.json`'s `_readme` and it
// is this: the demo composes everything the product offers, and an app it does NOT compose is named in
// `notComposed` with a reason.
//
// ⚠️ WHAT MAKES THIS A GUARD ON THE RESULT AND NOT ON THE INTENTION. It does not check that somebody
// remembered to update this list; it derives the ANSWER from the monorepo — the OOTB list, and every app
// directory under `extensions/` — and fails naming the app. A product app added upstream tomorrow turns this
// red the next time it runs, with nobody having to remember this file exists. That is the whole point: the
// seven-app box was written by people who each did their part correctly.
//
// ⚠️ IT SKIPS WITHOUT A FORGE CHECKOUT RATHER THAN FAILING, the same decision (and for the same reason) as
// `bin/dev-mail-promise.guard.mjs`: this repository does not vendor the monorepo, and a guard that is red on
// a machine that legitimately has no checkout is a guard people learn to ignore. The checks that need
// nothing but this repo run ALWAYS, and they are the ones about the species split.
//
//   node --test bin/composition.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/composition.guard.mjs

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

const COMPOSITION = read(join(ROOT, 'composition.json'));

/** Where the product's own list lives, relative to a Forge checkout. */
const BASE_LIST = join('extensions', 'composition.base.json');
/** The monorepo's copy of THIS list — the one the fleet oven bakes. */
const MIRROR = join('infra', 'fleet', 'lists', 'demo-instance.json');

/**
 * A Forge checkout, if this machine has one. Candidates are tried in order and the FIRST that actually holds
 * the product's list wins — `existsSync` on the directory is not enough, because a half-cloned or renamed
 * tree would make every rule below argue about an empty `extensions/`.
 */
function monorepo() {
  for (const base of [
    process.env.FORGE_MONOREPO,
    join(ROOT, '..', '..', 'wt-v03', 'd2-onda1'),
    join(ROOT, '..', '..', 'wt-v03', 't-forno'),
    join(ROOT, '..', '..', 'forge'),
  ]) {
    if (base && existsSync(join(base, BASE_LIST))) return base;
  }
  return null;
}

const FORGE = monorepo();
const skip = FORGE
  ? false
  : 'no Forge checkout on this machine (set FORGE_MONOREPO=<path>) — the rules that need the product\'s own list cannot run';

/** Every app directory this release CARRIES, read the way `scripts/fleet/release.ts` reads it: a directory
 *  under `extensions/` with a readable `package.json`. A directory left behind with only `node_modules` in it
 *  (which is what `extensions/demo-gate` is today, after D1 moved that app to this repository) is not an app
 *  and must not be counted as one. */
function carried(forge) {
  const dir = join(forge, 'extensions');
  const out = new Map();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let manifest;
    try {
      manifest = read(join(dir, entry.name, 'package.json'));
    } catch {
      continue;
    }
    if (!manifest.name) continue;
    out.set(entry.name, { package: manifest.name, origin: manifest.forge?.origin });
  }
  return out;
}

const ids = (list) => list.map((entry) => entry.id);

// ── what needs nothing but this repository ──────────────────────────────────────────────────────────────

test('the two lists are two lists — no app is on both, by id or by package', () => {
  // The species split, asserted on the only artifact that can break it here. An app on BOTH is the collision
  // the oven refuses at build time (`… would land on extensions/<id>, which this release already carries`),
  // and it costs a full image build to find out.
  const composed = COMPOSITION.apps;
  const own = COMPOSITION.instanceApps ?? [];
  for (const app of own) {
    assert.ok(
      !ids(composed).includes(app.id),
      `"${app.id}" is on BOTH \`apps\` and \`instanceApps\`. An instance app is ADOPTED into the build context, never composed from the release; the oven refuses the collision by name.`,
    );
    assert.ok(
      !composed.some((entry) => entry.package === app.package),
      `${app.package} is on BOTH lists under two ids — the oven composes it twice.`,
    );
  }
});

test("every instance app is real, is HERE, and declares itself instance-owned", () => {
  // `bin/build-local.sh` copies `source` into the build context and the oven checks `forge.origin` before it
  // adopts anything. Both failures are late and both are avoidable by reading three files.
  for (const app of COMPOSITION.instanceApps ?? []) {
    const dir = join(ROOT, app.source);
    assert.ok(existsSync(dir), `instanceApps names "${app.source}", which is not a directory in this repo`);
    const manifest = read(join(dir, 'package.json'));
    assert.equal(
      manifest.name,
      app.package,
      `${app.source}/package.json is called "${manifest.name}" and composition.json calls it "${app.package}"`,
    );
    assert.equal(
      manifest.forge?.origin,
      'instance',
      `${app.package} must declare \`forge.origin: "instance"\` — the oven refuses to adopt an app that does not say it belongs to one box`,
    );
    assert.ok(
      typeof app.why === 'string' && app.why.length > 0,
      `${app.package} is on this box's own list with no reason written next to it`,
    );
  }
});

test('no id is listed twice', () => {
  const all = [...ids(COMPOSITION.apps), ...ids(COMPOSITION.instanceApps ?? [])];
  assert.deepEqual([...new Set(all)].sort(), [...all].sort());
});

// ── what the product's own tree decides ─────────────────────────────────────────────────────────────────

test('★★ NOTHING LESS THAN THE PRODUCT OFFERS — every app on the OOTB list is composed here', { skip }, () => {
  // THE RULE THE SEVEN-APP BOX BROKE. Derived from `extensions/composition.base.json` and never from a list
  // typed in here, because a list typed in here would be exactly as stale as the one it is grading.
  const base = read(join(FORGE, BASE_LIST)).apps;
  const mine = new Map(COMPOSITION.apps.map((entry) => [entry.id, entry.package]));
  const missing = base.filter((entry) => mine.get(entry.id) !== entry.package);
  assert.deepEqual(
    missing.map((entry) => `${entry.id} (${entry.package})`),
    [],
    'the product offers these apps and this box does not compose them. The demo takes MORE than a customer would, never less — add them to `apps` in composition.json (and to the monorepo mirror).',
  );
});

test('★★ NOTHING LEAKS — a platform app is composed here, or it is named with a reason', { skip }, () => {
  // ⚠️ THE RULE THAT CATCHES AN APP THE PRODUCT ITSELF FORGOT. `chrome` reached the monorepo on 02/09 and
  // never reached `composition.base.json`, so the rule above cannot see it: it is a product app on no list
  // anywhere, which is a stronger defect than the one this guard was written for. Walking `extensions/` sees
  // it, and forces this repository to say out loud that it is not composing it and why.
  const excused = COMPOSITION.notComposed ?? {};
  const composed = new Set(ids(COMPOSITION.apps));
  const unexplained = [];
  for (const [dir, app] of carried(FORGE)) {
    if (app.origin !== 'platform') continue; // an instance-owned app of somebody else's box is not ours to compose
    if (composed.has(dir)) continue;
    const reason = excused[dir];
    if (typeof reason === 'string' && reason.trim().length > 0) continue;
    unexplained.push(`${dir} (${app.package})`);
  }
  assert.deepEqual(
    unexplained,
    [],
    'the release carries these platform apps, this box composes none of them, and composition.json says nothing about why. Compose them, or write the reason in `notComposed`.',
  );
});

test('an app the product OFFERS cannot be excused by prose', { skip }, () => {
  // The escape hatch above is for apps that CANNOT be composed (a hand-weld) or that the product itself does
  // not compose. It must never become the place a capability is quietly dropped from the showcase.
  const base = new Set(read(join(FORGE, BASE_LIST)).apps.map((entry) => entry.id));
  const excused = Object.keys(COMPOSITION.notComposed ?? {}).filter((id) => base.has(id));
  assert.deepEqual(
    excused,
    [],
    'these apps are on the product\'s OOTB list AND in `notComposed`. A written reason does not outrank the rule: put them on `apps`.',
  );
});

test('every entry of `notComposed` is about an app that still exists', { skip }, () => {
  // A reason for an app nobody carries any more is a paragraph that reads as a decision and is really a
  // fossil — and it is the kind that survives forever, because nothing ever contradicts it.
  const carriedDirs = carried(FORGE);
  const fossils = Object.keys(COMPOSITION.notComposed ?? {}).filter((dir) => !carriedDirs.has(dir));
  assert.deepEqual(fossils, [], 'composition.json explains why it does not compose apps this release does not carry');
});

test('this box composes only apps the release CARRIES, and only platform ones', { skip }, () => {
  // The reverse direction of the first rule, and it catches the accident that would otherwise be found by the
  // oven: an entry moved from `instanceApps` to `apps`, or an id typed with a typo.
  const carriedDirs = carried(FORGE);
  const wrong = [];
  for (const entry of COMPOSITION.apps) {
    const app = carriedDirs.get(entry.id);
    if (!app) {
      wrong.push(`${entry.id} — the release carries no such app (rule \`not-carried\`)`);
      continue;
    }
    if (app.package !== entry.package) {
      wrong.push(`${entry.id} — composed as ${entry.package}, carried as ${app.package}`);
      continue;
    }
    if (app.origin !== 'platform') {
      wrong.push(`${entry.id} — \`forge.origin: "${app.origin}"\`, which is not the platform's to offer (rule \`not-offered\`)`);
    }
  }
  assert.deepEqual(wrong, []);
});

test("★ this box's OWN apps are not carried by the release — that is what makes them ours", { skip }, () => {
  // ⚠️ THE COLLISION, PROVEN STILL IMPOSSIBLE RATHER THAN REMEMBERED. D1 moved `demo-gate` out of the
  // monorepo; if a copy of it ever came back upstream, the oven would refuse this build with
  // `@forge/ext-demo-gate would land on extensions/demo-gate, which this release already carries` — after a
  // full image build. This says it in a second.
  const carriedDirs = carried(FORGE);
  const collisions = [];
  for (const app of COMPOSITION.instanceApps ?? []) {
    const byId = carriedDirs.get(app.id);
    if (byId) collisions.push(`${app.id} — the release carries extensions/${app.id} (${byId.package})`);
    for (const [dir, carriedApp] of carriedDirs) {
      if (carriedApp.package === app.package && dir !== app.id) {
        collisions.push(`${app.package} — the release carries it as extensions/${dir}`);
      }
    }
  }
  assert.deepEqual(collisions, []);
});

test('★ the monorepo mirror is this list, in this order', { skip }, () => {
  // `bin/build-local.sh` refuses to build when the two disagree — but only once somebody is at the oven with
  // docker warmed up. This is the same comparison, made by `bash bin/test.sh` in a second, and it is
  // deliberately a SEQUENCE comparison because that is what build-local.sh does (`jq -S` sorts object keys,
  // not the array), so a re-ordered mirror is a refused build.
  const mirrorPath = join(FORGE, MIRROR);
  assert.ok(existsSync(mirrorPath), `the monorepo has no ${MIRROR} — the fleet oven bakes this box's list from it`);
  const theirs = read(mirrorPath).apps.map((entry) => ({ id: entry.id, package: entry.package }));
  const mine = COMPOSITION.apps.map((entry) => ({ id: entry.id, package: entry.package }));
  assert.deepEqual(
    theirs,
    mine,
    `${MIRROR} in the monorepo is a COPY of this repo's \`apps\`, kept in step by hand because CI does not cross repositories, and \`bin/build-local.sh\` REFUSES TO BUILD until they agree. Copy this repo's \`apps\` array over that file's and commit it there:\n` +
      `  jq --slurpfile mine <(jq '{apps}' composition.json) '.apps = $mine[0].apps' $FORGE/${MIRROR}`,
  );
});

// ── the bytes an instance app promises the admin ────────────────────────────────────────────────────────
/**
 * The asset path a manifest DECLARES, read from its source.
 *
 * ⚠️ BY TEXT, AND EVERY ALTERNATIVE IS WORSE HERE. A manifest is TypeScript importing `@forgecommerce/contracts`,
 * which in this repository is a gitignored symlink `bin/pack-apps.sh` writes from a monorepo checkout — so
 * importing one would make this rule skip on the machine that has no checkout, which is the machine most
 * likely to be wrong. The field is a string literal in a file this repository owns.
 *
 * It refuses to guess: no `icon:` line at all → `null` (an app may legitimately ship none), a line that does
 * not parse → a failure, never a silent skip.
 */
function declaredIcon(dir) {
  const source = readFileSync(join(dir, 'manifest.ts'), 'utf8');
  const named = /^\s*icon:\s*'([^']+)'\s*,/m.exec(source);
  if (named) return named[1];
  assert.ok(
    !/^\s*icon:/m.test(source),
    `${dir}/manifest.ts has an \`icon:\` this guard cannot read — write it as a single-quoted literal, or this rule goes green while saying nothing`,
  );
  return null;
}

/** The base64 an `icon.ts` module exports, or null when the module is not of that shape. */
function exportedIconBase64(file) {
  const found = /export const icon\s*=\s*'([^']*)'/.exec(readFileSync(file, 'utf8'));
  return found ? found[1] : null;
}

test('★★ an instance app that DECLARES an icon also EXPORTS it — the composition solders the export, not the path', () => {
  // ⛔ THE REGRESSION THIS EXISTS FOR, MEASURED ON THE BENCH 2026-09-03: `GET /v1/extensions/demo-gate/icon`
  // → 404 (`banners`, a composed platform app, → 200 image/png, 5111 bytes). `demo-gate` declared
  // `icon: 'icon.png'` and shipped the file, and neither of those is what a COMPOSED app is read by:
  // `packages/codegen/src/composition.ts` solders an icon into the image only when the package EXPORTS
  // `./icon`, and it never imports the app to notice the manifest disagrees. So the app went from MOUNTED
  // (an artifact directory, where the declared PATH is the icon) to COMPOSED (a bundled module, where the
  // EXPORT is), and lost its icon with nothing turning red — the admin's Apps area fell back to the name
  // initial, which is exactly what an app with no icon looks like.
  //
  // The rule is on the RESULT and it is the bytes: the module must decode to the file the manifest names, so
  // an icon that is redrawn and not re-encoded is red too.
  for (const app of COMPOSITION.instanceApps ?? []) {
    const dir = join(ROOT, app.source);
    const declared = declaredIcon(dir);
    if (!declared) continue;

    const asset = join(dir, declared);
    assert.ok(existsSync(asset), `${app.package} declares icon "${declared}", which is not a file in ${app.source}`);

    const subpath = read(join(dir, 'package.json')).exports?.['./icon'];
    assert.ok(
      subpath,
      `${app.package} declares an icon and does NOT export "./icon". A composed app's icon travels as a bundled module: add \`"./icon": "./icon.ts"\` to its exports and an \`icon.ts\` carrying the base64 of ${declared}. Without it the image builds, the app installs, and every visit to /apps 404s on its icon.`,
    );

    const base64 = exportedIconBase64(join(dir, subpath.replace(/^\.\//, '')));
    assert.ok(
      base64,
      `${app.package} exports "./icon" at ${subpath}, which does not export a string constant named \`icon\` — that is the shape \`pngIconRegistry\` decodes.`,
    );
    assert.deepEqual(
      Buffer.from(base64, 'base64'),
      readFileSync(asset),
      `${app.package}: the bytes ${subpath} exports are not the bytes of ${declared}. The module is what the kernel serves; the file is what everything else reads.`,
    );
  }
});
