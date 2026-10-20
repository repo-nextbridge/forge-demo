// ★ NO FORK OF THIS BOX CALLS A NAME THE KIT IT INSTALLS HAS DEPRECATED.
//
// v0.3.3 shipped the product's first deprecation: `coverMediaOf` (`@forgeco/storefront-kit/sku`), replaced by
// `shownMediaOf` / `coverImageOf`, removed in v0.5. The café's fork called it in its product card and its home,
// and nothing here would have said so before the release that deletes it — `tsc` is green on a deprecated name,
// and the kit's own warning is printed once per process, in development, into a dev server nobody runs here.
// The first loop that would have noticed was the oven of v0.5, as a missing export.
//
// ── WHERE THE LIST COMES FROM, AND WHY IT IS NOT WRITTEN HERE ───────────────────────────────────────────
//
// Every deprecated export of the kit calls `warnDeprecated('<name>', '<replacement>', '<removed in>')` on its
// first line (`src/deprecation.ts` in the kit: the product holds every such call to its deprecations registry).
// So the INSTALLED kit's own source is the list, read at the version this fork pins — a name deprecated by the
// next release reaches this guard with the `npm ci` that brings it, and nobody edits this file.
//
// ⚠️ A WORD, NOT AN IMPORT. The rule is the one the slice was asked to hold — «no deprecated name is left (grep)»
// — so a comment naming the old function counts too. A fork that needs to talk about it can say «the old name».
//
//   node --test bin/kit-deprecations.guard.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { forks, KIT } from './forks.mjs';

const say = (line) => console.error(`[kit-deprecations] ${line}`);

const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage']);

/** Every source file under `dir`, skipping installs and build output. */
export function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (SOURCE.test(entry.name)) out.push(path);
  }
  return out;
}

/** The names a kit source deprecates: the first argument of every `warnDeprecated(` call outside its definition. */
export function deprecatedNames(sources) {
  const names = new Map();
  for (const { file, text } of sources) {
    for (const m of text.matchAll(/\bwarnDeprecated\(\s*(['"`])([A-Za-z_$][\w$]*)\1\s*,\s*(['"`])([^'"`]*)\3\s*,\s*(['"`])([^'"`]*)\5/g)) {
      names.set(m[2], { replacement: m[4], removedIn: m[6], declaredIn: file });
    }
  }
  return names;
}

/** Every `file:line` of `sources` that names one of `names` as a whole word. */
export function uses(sources, names) {
  const wanted = [...names]; // an iterator (a Map's keys) would be spent on the first line
  const found = [];
  for (const { file, text } of sources) {
    text.split('\n').forEach((line, i) => {
      for (const name of wanted) {
        if (new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(line)) {
          found.push({ name, at: `${file}:${i + 1}` });
        }
      }
    });
  }
  return found;
}

const read = (root, files) => files.map((path) => ({ file: relative(root, path), text: readFileSync(path, 'utf8') }));

// ── the detector, against inputs whose answer is known (the negative control) ──────────────────────────

test('the detector reads a deprecation off the kit and finds it — and only it — in a fork', () => {
  const kit = [
    {
      file: 'src/sku.ts',
      text:
        "export function oldName(p) {\n  warnDeprecated('oldName', 'newName (or other)', 'v0.5');\n  return p;\n}\n" +
        'export function warnDeprecated(name, replacement, removedIn) {}\n',
    },
  ];
  const names = deprecatedNames(kit);
  assert.deepEqual([...names.keys()], ['oldName']);
  assert.equal(names.get('oldName').removedIn, 'v0.5');
  const fork = [
    { file: 'a.tsx', text: "import { oldName } from '@forgeco/storefront-kit/sku';\nconst c = oldName(p);\n" },
    { file: 'b.tsx', text: 'const c = oldNameOf(p) + myoldName + newName(p);\n' },
  ];
  assert.deepEqual(uses(fork, names.keys()), [
    { name: 'oldName', at: 'a.tsx:1' },
    { name: 'oldName', at: 'a.tsx:2' },
  ]);
  assert.deepEqual(uses([fork[1]], names.keys()), []);
});

// ── the rule, per fork, against the kit that fork installed ─────────────────────────────────────────────

const FORKS = forks('typecheck');
say(`forks that install the kit: ${FORKS.map((f) => f.dir).join(', ') || 'none'}`);

test('this repository owns at least one fork of the kit', () => {
  assert.ok(FORKS.length > 0, `no directory of this repo depends on ${KIT} and declares a \`typecheck\` script`);
});

for (const fork of FORKS) {
  test(`★ ${fork.dir} calls no name its installed kit deprecates`, (t) => {
    const kitDir = join(fork.path, 'node_modules', ...KIT.split('/'));
    if (!existsSync(join(kitDir, 'src'))) {
      t.skip(`NOT CHECKED — ${fork.dir} is not installed: \`cd ${fork.dir} && npm ci\` (the list is the kit's own source).`);
      return;
    }
    const version = JSON.parse(readFileSync(join(kitDir, 'package.json'), 'utf8')).version;
    const names = deprecatedNames(read(kitDir, sourceFiles(join(kitDir, 'src'))));
    say(`${fork.dir}: kit ${version} deprecates ${[...names.keys()].join(', ') || 'nothing'}`);
    // Not an assertion that the list is non-empty: a future kit may have retired every deprecated name, and a
    // fork that is clean against an empty list is clean. What IS asserted is the instrument — above.
    const found = uses(read(fork.path, sourceFiles(fork.path)), names.keys());
    assert.deepEqual(
      found.map((f) => `${f.at} → ${f.name}`),
      [],
      `${fork.dir} still names what ${KIT} ${version} deprecates. Each line names the replacement and the ` +
        `release that removes it:\n` +
        [...new Set(found.map((f) => f.name))]
          .map((n) => `  ${n} → ${names.get(n).replacement}, removed in ${names.get(n).removedIn}`)
          .join('\n'),
    );
  });
}
