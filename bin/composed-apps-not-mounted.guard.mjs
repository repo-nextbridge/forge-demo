// ⛔⛔ A COMPOSED APP MAY NOT BE MOUNTED — THE KERNEL REFUSES TO BOOT, AND THE WHOLE BOX GOES DOWN WITH IT.
//
//   node --test bin/composed-apps-not-mounted.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT BOUGHT THIS FILE, MEASURED IN PRODUCTION ON 2026-09-18 ───────────────────────────────────────────
//
// This box's apps are COMPOSED INTO THE IMAGES since `fd018ff` — `composition.json#instanceApps` says so in
// as many words, in each app's `why`: *"Composed, not mounted"*. The kernel scans `$FORGE_EXTENSIONS_DIR` at
// boot and REFUSES TO START if it finds an app the platform already provides:
//
//     Error: refusing to boot: the extension at /app/extensions/demo-gate claims id "demo-gate",
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
// ── THE RULE, DERIVED FROM BOTH SIDES ─────────────────────────────────────────────────────────────────────
//
// Neither the app list nor the directory contents are typed here: the first comes from `composition.json`
// (`apps` + `instanceApps`) and the second from disk. A new app in the composition and a new directory in
// `extensions/` are both in scope by existing, with nobody remembering to add a case.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOUNT = join(ROOT, 'extensions');

/** Every app this box's images compose — the platform's and the ones this box wrote for itself. */
function composedIds() {
  const c = JSON.parse(readFileSync(join(ROOT, 'composition.json'), 'utf8'));
  return [...(c.apps ?? []), ...(c.instanceApps ?? [])].map((a) => a.id).filter(Boolean);
}

/** What is mounted today: one directory per app, the shape `bin/pack-apps.sh` writes. */
function mountedIds() {
  if (!existsSync(MOUNT)) return [];
  return readdirSync(MOUNT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

test('★★★ the extensions directory EXISTS — without it `bin/deploy.sh` refuses the whole delivery', () => {
  // The other half of the rule, and the half that carried the trap: whoever meets the deploy's refusal will
  // fill the directory, because filling it is the obvious gesture. Keeping it present and empty is what
  // removes the question before it is asked.
  assert.ok(
    existsSync(MOUNT),
    'there is no `extensions/` — `bin/deploy.sh` will refuse with "this repository has no \'extensions\'",\n' +
      '     and whoever meets that refusal will run `bin/pack-apps.sh` and take the box down.\n' +
      '     `extensions/.gitkeep` is what keeps the directory in a fresh clone; it was deleted or never arrived.',
  );
});

test('⛔⛔ NO COMPOSED app is mounted — this is the kernel\'s boot refusal, caught before the deploy', () => {
  const composed = new Set(composedIds());
  const shadowing = mountedIds().filter((id) => composed.has(id));
  assert.deepEqual(
    shadowing,
    [],
    `these apps are in extensions/ AND in the composition: ${shadowing.join(', ')}\n` +
      '     The kernel REFUSES TO BOOT when a mounted app shadows a composed one. The box does not come up\n' +
      '     half-working: it enters a restart loop and the storefronts answer 500.\n' +
      '     ⇒ `rm -rf` those directories. If you created them with `bin/pack-apps.sh`, that script is for an\n' +
      '     instance that MOUNTS apps; this one COMPOSES them (composition.json#instanceApps, field `why`).',
  );
});

test('⛔ ANTI-VACUUM — the composition really lists apps, and the disk read really sees', () => {
  // Both rules above pass against an empty composition and against a broken walk. Without this, deleting
  // `composition.json` would leave this file green while the box is undefended.
  const composed = composedIds();
  assert.ok(
    composed.length > 10,
    `composition.json declares ${composed.length} app(s) — the list shrank or was not read, and the rule\n` +
      '     above would be comparing against almost nothing',
  );
  for (const id of ['demo-gate', 'demo-setup', 'payment-pos']) {
    assert.ok(composed.includes(id), `${id} left the composition — it is an app of THIS box`);
  }
  assert.ok(Array.isArray(mountedIds()), 'the read of extensions/ did not return a list');
});
