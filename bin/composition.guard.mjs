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
// ── ⛔ pk35/D6 — AND *WHICH* CHECKOUT IS NOT "the first one lying around" ────────────────────────────────
//
// Until 2026-09-14 this file took the FIRST directory holding `extensions/composition.base.json`, out of
// `FORGE_MONOREPO` and three hard-coded neighbours, and never asked which COMMIT it was at. Measured on this
// branch with `FORGE_MONOREPO=…/wt-v03/d2-onda1` (pk3/integra, hundreds of commits behind the pinned
// `v03/integra@e8fc602d4`): TWO red rules — "content — the release carries no such app (rule not-carried)"
// and the fleet mirror out of order — and BOTH are false about this box. At the pinned commit
// `extensions/content` exists and `infra/fleet/lists/demo-instance.json` matches `composition.json` entry
// for entry. A tree further back produces more of them; the number is not the point, the confidence is.
//
// ⇒ A GUARD THAT ACCUSES THE BOX BECAUSE IT IS READING THE WRONG TREE IS WORSE THAN NO GUARD: it sends a
// human to fix what is not broken. It is this house's species — a signal that does not know it cannot know —
// and the answer is the one the siblings already use, copied rather than reinvented:
// `releaseTree(pinnedCommit())` (bin/release-tree.mjs), which accepts a tree ONLY when its HEAD is the
// commit `forge.lock` says these images were baked from, expands a clone's worktrees looking for it, and
// hands back `{ tried }` — what it looked at and why each was rejected — when the machine has none.
// `bin/instance-app.guard.mjs` and `bin/app-blocks.guard.mjs` grade through the same door.
//
// ⚠️ AND IT SAYS SO OUT LOUD BEFORE ANY ASSERTION, because "NOT CHECKED" is only an answer when it names
// what would fix it. `bin/composition-pin.test.mjs` holds both halves as a property, by running this file.
//
//   node --test bin/composition.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/composition.guard.mjs

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

import { pinnedCommit, readJson as read, releaseTree, ROOT } from './release-tree.mjs';

const say = (line) => console.error(`[composition] ${line}`);

const COMPOSITION = read(join(ROOT, 'composition.json'));

/** Where the product's own list lives, relative to a Forge checkout. */
const BASE_LIST = join('extensions', 'composition.base.json');
/** The monorepo's copy of THIS list — the one the fleet oven bakes. */
const MIRROR = join('infra', 'fleet', 'lists', 'demo-instance.json');

/**
 * ★★ THE RELEASE THESE IMAGES WERE BAKED FROM, or nothing. Not "a Forge checkout" — see the header: the tree
 * is asked for through `releaseTree(pinnedCommit())`, which accepts one only when its HEAD is the commit
 * `forge.lock` pins, so every accusation below is about the product this box actually runs.
 */
const PINNED = pinnedCommit();
const TREE = PINNED
  ? releaseTree(PINNED)
  : { tried: ['forge.lock names registry digests, not a branch@sha — there is no release tree to grade against'] };
const FORGE = TREE.path ?? null;

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

say(`forge.lock pins: ${PINNED ? PINNED.ref : 'no branch@sha — this lock names registry digests'}`);
if (FORGE) {
  say(`grading against: ${FORGE} (${TREE.how})`);
} else {
  say(`⚠️ NOT CHECKED — no Forge checkout at ${PINNED ? PINNED.ref : 'the pinned commit'} on this machine.`);
  for (const line of TREE.tried) say(`   tried: ${line}`);
  say('   set FORGE_MONOREPO=<a Forge clone at that commit, or one with a worktree of it>.');
}

/** The sentence a skipped rule carries. ⚠️ It names the PIN and what would fix it — a skip that says only
 *  "not checked" is the silence this repository's strict mode exists to refuse (bin/test.sh). What was tried
 *  is on the `[composition]` lines above, once, instead of being repeated onto every skipped rule. */
const skip = FORGE
  ? false
  : `NOT CHECKED — no Forge checkout at ${PINNED ? PINNED.ref : 'the pinned commit'} on this machine ` +
    '(set FORGE_MONOREPO=<a clone at that commit>; the [composition] lines above list what was tried)';

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

test('★ THE RELEASE WAS REALLY READ — a walk that finds no app passes every rule below', { skip }, () => {
  // ⛔ ANTI-VACUUM, AND IT IS THE FIRST RULE THAT NEEDS THE PRODUCT ON PURPOSE. Every rule under this line is
  // "this list agrees with the release": an empty `extensions/` or an empty OOTB list satisfies all of them
  // by having no subject, and the run would be green while grading nothing. It is not hypothetical — the
  // tree used to be accepted on the strength of one filename, so a half-cloned or partially checked-out
  // monorepo was a tree this file was willing to argue about.
  assert.ok(
    existsSync(join(FORGE, BASE_LIST)),
    `${FORGE} is checked out at ${PINNED.ref} and has no ${BASE_LIST} — that is a release this box cannot ` +
      'be graded against, not a machine without a checkout.',
  );
  const base = read(join(FORGE, BASE_LIST)).apps;
  assert.ok(Array.isArray(base) && base.length > 0, `${BASE_LIST} offers no app at all — there is nothing to require`);
  const carriedDirs = carried(FORGE);
  // Derived, never a number typed here: the release must at least CARRY everything its own list offers. A
  // count would be a ceiling with a size inside it, which this house has paid for twice.
  const offeredButAbsent = base.filter((entry) => !carriedDirs.has(entry.id)).map((entry) => entry.id);
  assert.deepEqual(
    offeredButAbsent,
    [],
    `${BASE_LIST} offers apps that ${FORGE}/extensions does not hold — this walk is reading a tree that is ` +
      'not the release, and every rule below would be arguing about the difference.',
  );
  assert.ok(
    [...carriedDirs.values()].some((app) => app.origin === 'platform'),
    'no directory under extensions/ declares `forge.origin: "platform"` — the leak rule has no subject',
  );
  say(`${FORGE}/extensions holds ${carriedDirs.size} app(s); ${BASE_LIST} offers ${base.length}`);
});

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

// ── the pixels an instance app promises the admin ───────────────────────────────────────────────────────
/**
 * ★★ AN APP ICON IN THIS BOX IS 128 SQUARE AND FULLY OPAQUE, BECAUSE THE PIXELS UNDER ITS ALPHA ARE BLACK.
 *
 * ⚠️ MEASURED HERE, 2026-09-09, BEFORE THE RULE WAS WRITTEN: `demo-setup`'s placeholder icon carried 2 879 of
 * 16 384 pixels below full alpha — 2 731 of them at alpha 0 with (0,0,0) underneath. Anywhere that fourth
 * channel is dropped — a flatten, a thumbnail, a composite onto a dark ground, a consumer that decodes RGB —
 * those pixels paint a BLACK SQUARE while `demo-gate` and `payment-pos` paint the artwork somebody drew. It
 * is the same image rendering as two different pictures depending on who decodes it.
 *
 * ⛔ THE MONOREPO'S OWN GUARD CANNOT SEE THESE APPS — `scripts/publishing/icon-opacity.guard.test.ts` walks
 * the product's `extensions/` directory, which is exactly why `apps/payment-pos/manifest.test.ts` duplicates
 * its half of the i18n rule here. This is the same duplication for the same measured reason, and it runs
 * ALWAYS: it needs no Forge checkout, only this repository's own bytes.
 *
 * ★ IT ASSERTS THE PIXELS, NOT THE HEADER. A colour-type check would be the cheap version and the wrong one:
 * `demo-gate` IS RGBA and every one of its alpha bytes is 255. Carrying an alpha channel is harmless;
 * carrying transparency is what paints black.
 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** The size every app icon is drawn at source: the admin's card renders it at 34px, the sheet at 44px. */
const ICON_SIDE = 128;

/** Un-filter one PNG scanline in place, spec §9.2. `above` is the already-reconstructed previous line. */
function unfilter(filter, line, above, target, channels) {
  for (let x = 0; x < line.length; x += 1) {
    const left = x >= channels ? target[x - channels] : 0;
    const up = above[x];
    const upLeft = x >= channels ? above[x - channels] : 0;
    let value;
    switch (filter) {
      case 0:
        value = line[x];
        break;
      case 1:
        value = line[x] + left;
        break;
      case 2:
        value = line[x] + up;
        break;
      case 3:
        value = line[x] + ((left + up) >> 1);
        break;
      case 4: {
        const p = left + up - upLeft;
        const dLeft = Math.abs(p - left);
        const dUp = Math.abs(p - up);
        const dUpLeft = Math.abs(p - upLeft);
        value = line[x] + (dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft);
        break;
      }
      default:
        throw new Error(`unsupported PNG scanline filter ${filter}`);
    }
    target[x] = value & 0xff;
  }
}

/**
 * Decode enough of a PNG to answer "how big is it, and is any pixel transparent?".
 *
 * Only what this repository's icons actually are is supported — 8-bit, non-interlaced, truecolour with or
 * without alpha, and no `tRNS` — and anything else THROWS. A decoder that silently answers "opaque" for an
 * encoding it did not understand is a guard that passes by not looking.
 */
function decodePng(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], PNG_SIGNATURE, 'not a PNG');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colourType = bytes[25];
  const interlace = bytes[28];
  if (bitDepth !== 8 || interlace !== 0 || (colourType !== 2 && colourType !== 6)) {
    throw new Error(`unsupported PNG: bitDepth ${bitDepth}, colourType ${colourType}, interlace ${interlace}`);
  }

  const idat = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    // `tRNS` makes even a truecolour image transparent by naming one colour as the hole. No icon here uses
    // it, so it is refused rather than guessed: a hole this decoder cannot see is a hole the guard misses.
    if (type === 'tRNS') throw new Error('unsupported PNG: tRNS transparency');
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  // Colour type 2 has no fourth channel at all: opaque by construction, nothing to scan.
  if (colourType === 2) return { width, height, alpha: null };

  const channels = 4;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  const zeroes = Buffer.alloc(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = raw.subarray(cursor, cursor + stride);
    cursor += stride;
    const above = y > 0 ? out.subarray((y - 1) * stride, y * stride) : zeroes;
    unfilter(filter, line, above, out.subarray(y * stride, (y + 1) * stride), channels);
  }
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = out[i * 4 + 3];
  return { width, height, alpha };
}

/** Every instance app that ships icon bytes as a module — derived from the composition, never listed. */
function iconApps() {
  return (COMPOSITION.instanceApps ?? [])
    .map((app) => ({ id: app.id, dir: join(ROOT, app.source) }))
    .filter((app) => existsSync(join(app.dir, 'icon.ts')));
}

test('★ the icon rule SEES the apps — a scanner that finds nothing passes everything', () => {
  const apps = iconApps();
  assert.equal(
    apps.length,
    (COMPOSITION.instanceApps ?? []).length,
    `every instance app ships an \`icon.ts\`; ${apps.map((a) => a.id).join(', ')} is a shorter list than the composition's`,
  );
  assert.ok(apps.length >= 3, 'this box owns three apps — a shorter loop is an app that vanished');
  for (const app of apps) {
    const base64 = exportedIconBase64(join(app.dir, 'icon.ts'));
    assert.ok(
      base64 && base64.length > 100,
      `${app.id}: \`icon.ts\` exports no base64 worth decoding`,
    );
  }
});

test('★★ every instance app icon is 128×128 and FULLY OPAQUE — transparency here paints BLACK', () => {
  // ⇒ SABOTAGE: put back the 1 003-byte placeholder `demo-setup` carried until pk28/D1 and this names the
  //   app and counts its holes — 2 879 of 16 384 pixels below full alpha, 2 731 of them alpha 0 over black.
  const transparent = [];
  for (const app of iconApps()) {
    const png = decodePng(Buffer.from(exportedIconBase64(join(app.dir, 'icon.ts')), 'base64'));
    assert.deepEqual(
      [png.width, png.height],
      [ICON_SIDE, ICON_SIDE],
      `${app.id}: the icon is ${png.width}x${png.height}. The admin draws it at 34px and 44px, so ${ICON_SIDE} square is what covers a 3x screen without being resampled up.`,
    );
    if (png.alpha === null) continue; // no alpha channel: opaque by construction.
    const holes = png.alpha.reduce((count, byte) => (byte < 255 ? count + 1 : count), 0);
    if (holes > 0) transparent.push(`${app.id}: ${holes} of ${png.alpha.length} pixels are not opaque`);
  }
  assert.deepEqual(
    transparent,
    [],
    'an icon with transparent pixels paints a BLACK SQUARE anywhere the fourth channel is dropped, because the RGB under those pixels is (0,0,0). Flatten the art onto its own white ground and re-encode BOTH `icon.png` and the base64 in `icon.ts`.',
  );
});
