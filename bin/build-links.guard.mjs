// ★★ v032/P4 — EVERY BUILD SCRIPT THAT COMPILES A FORK LINKS THIS BOX'S APPS FIRST, so a fresh clone builds
// without `bin/test.sh` having run before it.
//
//   node --test bin/build-links.guard.mjs        (or: bash bin/test.sh)
//
// ⛔ WHAT THIS HOLDS, MEASURED 2026-10-08 IN A FRESH CLONE AT 37f9b8f: `bash bin/build-coffee.sh <forge>`
// failed inside `next build` resolving `@forgeco/storefront-kit/media/src` from `apps/demo-setup/`, because
// that app's `node_modules/` was only ever written by `bin/instance-app.guard.mjs`. The fix is one line per
// build script (`node bin/link-instance-apps.mjs "$forge" "$app"`); this file is what keeps the line there.
//
// ★ WHAT IS HELD:
//   1 · THE SET IS DERIVED — every `bin/build-*.sh` whose CODE (comments stripped) runs `npm run build` compiles
//       a fork, and the set may not be empty (a rename of the build step would otherwise make this vacuous).
//   2 · each of them calls `bin/link-instance-apps.mjs` with the checkout and the fork it builds, on a line that
//       comes BEFORE its `npm run build` — a link written after the build links nothing the build saw.
//   3 · the forks those scripts build really do install an app of this box (`appsOfFork`), so the step is not a
//       ritual: when no fork names `file:../apps/<id>` any more, this rule says so instead of passing.
//   4 · the CLI refuses, loudly, what would otherwise surface as a webpack error: no arguments, a tree that is
//       not a Forge checkout.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { appsOfFork } from './instance-apps.mjs';
import { ROOT } from './release-tree.mjs';

const LINKER = join(ROOT, 'bin', 'link-instance-apps.mjs');

/** A shell script with every `#` comment removed — whole-line and trailing — so the history in the prose
 *  (which names `npm run build` and this linker freely) can neither pass for code nor hide it. A `#` inside
 *  quotes or `${#…}` is left alone. */
function codeOf(shell) {
  return shell
    .split('\n')
    .map((line) => {
      let quote = null;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
          if (c === quote) quote = null;
          continue;
        }
        if (c === "'" || c === '"') quote = c;
        else if (c === '#' && line[i - 1] !== '$' && line[i - 1] !== '{' && (i === 0 || /\s/.test(line[i - 1])))
          return line.slice(0, i);
      }
      return line;
    });
}

const BUILDS = readdirSync(join(ROOT, 'bin'))
  .filter((name) => /^build-.*\.sh$/.test(name))
  .sort()
  .map((name) => ({ name, code: codeOf(readFileSync(join(ROOT, 'bin', name), 'utf8')) }))
  .filter((script) => script.code.some((line) => /\bnpm run build\b/.test(line)));

console.error(`[build-links] build scripts that compile a fork: ${BUILDS.map((s) => s.name).join(', ') || 'none'}`);

test('1 · at least one build script compiles a fork — otherwise every rule below is vacuous', () => {
  assert.ok(BUILDS.length > 0, 'no bin/build-*.sh runs `npm run build` in its code — this guard grades nothing');
});

for (const script of BUILDS) {
  test(`2 · ${script.name} links this box's apps before it runs \`npm run build\``, () => {
    const link = script.code.findIndex((line) =>
      /node\s+"\$here\/bin\/link-instance-apps\.mjs"\s+"\$forge"\s+"\$app"/.test(line),
    );
    const build = script.code.findIndex((line) => /\bnpm run build\b/.test(line));
    assert.notEqual(
      link,
      -1,
      `${script.name} compiles a fork and never runs \`node "$here/bin/link-instance-apps.mjs" "$forge" "$app"\`` +
        ' — in a fresh clone its `next build` cannot resolve what apps/<id> imports until bin/test.sh has run',
    );
    assert.ok(
      link < build,
      `${script.name} links on line ${link + 1}, AFTER \`npm run build\` on line ${build + 1} — the build never saw the links`,
    );
  });

  test(`3 · the fork ${script.name} builds installs an app of this box, so the link step is not a ritual`, () => {
    const dir = script.code.map((line) => line.match(/^app="\$here\/([\w.-]+)"\s*$/)?.[1]).find(Boolean);
    assert.ok(dir, `${script.name} no longer sets app="$here/<fork>" — this rule cannot tell which fork it builds`);
    const apps = appsOfFork(join(ROOT, dir));
    console.error(`[build-links] ${dir} installs: ${apps.map((a) => a.dir).join(', ') || 'none'}`);
    assert.ok(
      apps.length > 0,
      `${dir} names no \`file:../apps/<id>\` app of this instance any more — the link step in ${script.name} links ` +
        'nothing; drop it (and this rule) together, on purpose',
    );
  });
}

test('4 · the linker refuses a missing argument and a tree that is not a Forge checkout', () => {
  const none = spawnSync(process.execPath, [LINKER], { encoding: 'utf8' });
  assert.equal(none.status, 2, `no arguments should exit 2, got ${none.status}: ${none.stderr}`);
  assert.match(none.stderr, /usage: link-instance-apps\.mjs/);

  const empty = mkdtempSync(join(tmpdir(), 'build-links-'));
  try {
    const bad = spawnSync(process.execPath, [LINKER, empty, join(ROOT, 'storefront-coffee')], { encoding: 'utf8' });
    assert.equal(bad.status, 1, `a non-checkout should exit 1, got ${bad.status}: ${bad.stderr}`);
    assert.match(bad.stderr, /is not a Forge checkout/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
