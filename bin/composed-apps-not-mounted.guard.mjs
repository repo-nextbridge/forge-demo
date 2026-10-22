// ⛔⛔ A COMPOSED APP MAY NOT BE MOUNTED — THE KERNEL REFUSES TO BOOT, AND THE WHOLE BOX GOES DOWN WITH IT.
//
//   node --test bin/composed-apps-not-mounted.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT BOUGHT THIS FILE, MEASURED IN PRODUCTION ON 2026-09-18 ───────────────────────────────────────────
//
// This box's apps were COMPOSED INTO THE IMAGES from `fd018ff` until KP-D2 (v0.3.4, below). The kernel scans
// `$FORGE_EXTENSIONS_DIR` at boot and REFUSES TO START if it finds an app the platform already provides:
//
//     Error: refusing to boot: the extension at /app/extensions/<id> claims id "<id>",
//     which is already provided by the platform. An external extension may not shadow another.
//
// The sequence that took the public demo down had three steps, and not one of them is obviously wrong alone:
//
//   1. `bin/deploy.sh` refused the deploy because `extensions/` did not exist (it DELIVERS the path, so it
//      demands it). It did not exist because `fd018ff` removed the contents and git does not track an empty
//      directory.
//   2. The natural reaction was to run `bin/pack-apps.sh` — the tool whose job is to fill that directory, and
//      which is RIGHT for an instance model that MOUNTS apps and wrong for this box, which COMPOSES them.
//   3. A `git add -A` inside a slice about something else carried the three apps onto `main`, and the next
//      deploy delivered them. `store` and `outlet` answered 500 with the kernel in a restart loop.
//
// ⚠️ AND THIS HAD ALREADY BEEN WRITTEN DOWN, AND THE NOTE PROTECTED NOBODY. The risk of `git add -A`
// sweeping up an untracked directory was recorded in a report hours before it happened. That is the whole
// distance between knowing a thing and having a mechanism for it; this file is the conversion of one into
// the other.
//
// ── ★★ KP-D2 (2026-10-22, Forge v0.3.4) — THE MOUNT IS NOW THE WAY IN, FOR THE APPS THAT SAY SO ─────────────
//
// v0.3.4 lets an app of `instanceApps` reach the RELEASE's kernel as a packed directory: `"kernel": "mounted"`
// in composition.json, `extensions/<id>` written by `bin/pack-apps.sh` and committed, the kernel pulled by
// digest (bin/bake.sh). Both of this box's apps are declared so. The 2026-09-18 refusal above did not go away —
// it moved: a COMPOSED app on the mount still kills the boot, and now so does a MOUNTED app that is also baked
// into the kernel (the product's fence refuses that lock before anything ships). So the rule has three parts:
//   · an app the images COMPOSE (`apps`, and an `instanceApps` entry WITHOUT `"kernel": "mounted"`) is never on
//     the mount — the original rule, unchanged;
//   · an app DECLARED mounted IS on the mount, as a packed artifact — without it the pulled kernel has never
//     heard of the app: `payment-pos` offers no method, `demo-setup`'s blocks have no manifest behind them;
//   · and nothing else is: a directory no list declares is code the kernel loads that nobody asked for.
// Freshness (an artifact OLDER than its source) is the product's fence's, run in bin/mounted-apps.guard.mjs.
//
// ── THE RULE, DERIVED FROM BOTH SIDES ─────────────────────────────────────────────────────────────────────
//
// Neither the app list nor the directory contents are typed here: the first comes from `composition.json`
// (`apps` + `instanceApps`, and each entry's `kernel`) and the second from disk. A new app in the composition
// and a new directory in `extensions/` are both in scope by existing, with nobody remembering to add a case.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOUNT = join(ROOT, 'extensions');

function composition() {
  return JSON.parse(readFileSync(join(ROOT, 'composition.json'), 'utf8'));
}

/** Every app this box's IMAGES compose — the platform's, and the box's own that are not declared mounted. */
function composedIds() {
  const c = composition();
  return [...(c.apps ?? []), ...(c.instanceApps ?? []).filter((a) => a.kernel !== 'mounted')].map((a) => a.id).filter(Boolean);
}

/** The apps of this box that reach the pulled kernel on its mount (`"kernel": "mounted"`). */
function declaredMountedIds() {
  return (composition().instanceApps ?? []).filter((a) => a.kernel === 'mounted').map((a) => a.id).filter(Boolean);
}

/** What is mounted today: one directory per app, the shape `bin/pack-apps.sh` writes. */
function mountedIds() {
  if (!existsSync(MOUNT)) return [];
  return readdirSync(MOUNT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

test('★★★ the extensions directory EXISTS — without it `bin/deploy.sh` refuses the whole delivery', () => {
  assert.ok(
    existsSync(MOUNT),
    'there is no `extensions/` — `bin/deploy.sh` will refuse with "this repository has no \'extensions\'",\n' +
      '     and the pulled kernel would not receive the apps composition.json declares mounted.',
  );
});

test('⛔⛔ NO COMPOSED app is mounted — this is the kernel\'s boot refusal, caught before the deploy', () => {
  const composed = new Set(composedIds());
  const shadowing = mountedIds().filter((id) => composed.has(id));
  assert.deepEqual(
    shadowing,
    [],
    `these apps are in extensions/ AND composed into the images: ${shadowing.join(', ')}\n` +
      '     The kernel REFUSES TO BOOT when a mounted app shadows a composed one. The box does not come up\n' +
      '     half-working: it enters a restart loop and the storefronts answer 500.\n' +
      '     ⇒ an app of THIS box: declare it `"kernel": "mounted"` in composition.json#instanceApps (the kernel is\n' +
      '     the release\'s — bin/bake.sh). A platform app: `rm -rf` that directory; the release already carries it.',
  );
});

test('★★ EVERY app declared `"kernel": "mounted"` IS on the mount, as a packed artifact', () => {
  const missing = declaredMountedIds().filter((id) => !existsSync(join(MOUNT, id, 'forge-extension.json')));
  assert.deepEqual(
    missing,
    [],
    `composition.json declares ${missing.join(', ')} mounted, and extensions/<id>/forge-extension.json is not there.\n` +
      '     The pulled kernel has never seen this code: without the artifact the app does not exist on the box.\n' +
      '     ⇒ bash bin/pack-apps.sh   and commit extensions/<id>.',
  );
});

test('⛔ NOTHING on the mount that the list does not declare mounted', () => {
  const declared = new Set(declaredMountedIds());
  const stray = mountedIds().filter((id) => !declared.has(id) && !composedIds().includes(id));
  assert.deepEqual(
    stray,
    [],
    `extensions/ holds ${stray.join(', ')}, which composition.json neither composes nor declares mounted —\n` +
      '     code the kernel would load at boot that no list of this box asked for (verify-composition.sh: EXTRA (mounted)).',
  );
});

test('⛔ ANTI-VACUUM — the composition really lists apps, and the disk read really sees', () => {
  // The rules above pass against an empty composition and against a broken walk. Without this, deleting
  // `composition.json` would leave this file green while the box is undefended.
  const c = composition();
  const all = [...(c.apps ?? []), ...(c.instanceApps ?? [])].map((a) => a.id);
  assert.ok(
    all.length > 10,
    `composition.json declares ${all.length} app(s) — the list shrank or was not read, and the rules\n` +
      '     above would be comparing against almost nothing',
  );
  for (const id of ['demo-setup', 'payment-pos']) {
    assert.ok(all.includes(id), `${id} left the composition — it is an app of THIS box`);
  }
  assert.ok(Array.isArray(mountedIds()), 'the read of extensions/ did not return a list');
  assert.ok(mountedIds().length >= declaredMountedIds().length, 'the walk of extensions/ saw fewer directories than are declared mounted');
});
