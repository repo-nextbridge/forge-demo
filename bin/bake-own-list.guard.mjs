// ★★ v031/G (item 26) → v032/C — THE OVEN BAKES THIS REPOSITORY'S OWN LIST, AS IS, AND NOTHING READS THE
// PRODUCT'S MIRROR.
//
//   node --test bin/bake-own-list.guard.mjs        (or: bash bin/test.sh)
//
// ⛔ WHAT ENDED IN v031/G, MEASURED ON `dd7b8c3` (2026-10-07): `bin/build-local.sh` baked the monorepo's COPY of
// this box's list (`infra/fleet/lists/demo-instance.json`) and refused to build unless it equalled
// `composition.json` — two copies of one decision kept in step by hand across repositories.
//
// ★ v032/C — THE BAKE MOVED TO `bin/bake.sh` AND THE LIST STOPPED BEING GENERATED. `build-local.sh` wrote a
// derived list into the context (instance apps folded into `apps`) because the oven of v0.3.1 took the axis on
// the command line; the oven of v0.3.2 reads `"axis": "instance"` and `instanceApps` from the list itself, so
// `bin/bake.sh` hands over `composition.json` byte for byte. This file followed the bake (renamed from
// `build-local-own-list.guard.mjs`); what it holds is the same sentence:
//   1 · BY TEXT, COMMENTS STRIPPED — the script's CODE names no path under `infra/fleet/lists/` and no
//       `instances/` directory of the product. The dataset pointer is read from this repo's `seed/dataset/`.
//   2 · BY RUNNING the block between `# >>> THE LIST HANDED TO THE OVEN` markers over a fabricated repo: what
//       lands in the `list` context is `composition.json`, byte for byte; a list without `"axis": "instance"`
//       is refused before docker; and a block that hands the oven anything else exits 1.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = readFileSync(join(ROOT, 'bin', 'bake.sh'), 'utf8');

/** The script with every `#` comment removed — whole-line and trailing — so a needle in the prose that explains
 *  the history cannot pass for (or hide) code. A `#` inside quotes or `${#…}` is left alone. */
export function codeOf(shell) {
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
    })
    .join('\n');
}

// The needles are assembled at run time so this file's own source never matches them (the `no-gate.guard`
// trick): a rule that grep'd for a literal it also contains would accuse itself.
const MIRROR_DIR = ['infra', 'fleet', 'lists'].join('/');
const PRODUCT_INSTANCES = ['instances', ''].join('/');

function block(shell) {
  const m = shell.match(/# >>> THE LIST HANDED TO THE OVEN\n([\s\S]*?)# <<< THE LIST HANDED TO THE OVEN/);
  assert.ok(m, 'bin/bake.sh no longer marks THE LIST HANDED TO THE OVEN — this guard cannot run it');
  return m[1];
}

/** Run the marked block with `here` = a fabricated repo holding `composition` (as TEXT, so byte-identity is a
 *  real question), and `work` = a scratch dir. `die` is the script's own shape: a message and exit 1. */
function runBlock(body, compositionText) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-own-list-'));
  const work = join(dir, 'work');
  try {
    writeFileSync(join(dir, 'composition.json'), compositionText);
    mkdirSync(join(work, 'list'), { recursive: true });
    writeFileSync(
      join(dir, 'block.sh'),
      `set -uo pipefail\nhere=${JSON.stringify(dir)}\nwork=${JSON.stringify(work)}\n` +
        `die() { printf '[bake] ⛔ %s\\n' "$*" >&2; exit 1; }\n${body}\necho STAGED\n`,
    );
    try {
      const out = execFileSync('bash', [join(dir, 'block.sh')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, out, staged: readFileSync(join(work, 'list', 'composition.json'), 'utf8') };
    } catch (error) {
      return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const FABRICATED = `${JSON.stringify(
  {
    _readme: ['a list with prose in it, which the oven ignores and this bake must not strip'],
    version: 1,
    axis: 'instance',
    apps: [
      { id: 'b-app', package: '@x/b' },
      { id: 'a-app', package: '@x/a' },
    ],
    instanceApps: [{ id: 'own', package: '@me/own', source: './apps/own' }],
  },
  null,
  2,
)}\n`;

test('★★ the CODE of bake.sh reads no product mirror and no product instance directory', () => {
  const code = codeOf(SCRIPT);
  // ⟂ ANTI-VACUUM: the stripping must leave the script's code.
  assert.ok(code.includes('composition.json'), 'the stripped script lost its code');
  const hits = code.split('\n').flatMap((line, i) =>
    line.includes(MIRROR_DIR) || line.includes(PRODUCT_INSTANCES) ? [`bin/bake.sh:${i + 1}: ${line.trim()}`] : [],
  );
  assert.deepEqual(hits, [], 'bake.sh reads a path the product no longer carries');
  assert.match(code, /\$here\/seed\/dataset\/forge-seed-dataset\.json/, 'the dataset pointer is not read from this repo');
});

test('⟂ the comment stripper is not vacuous — a needle in CODE survives it, the same needle in a comment does not', () => {
  assert.ok(codeOf(`theirs="$forge/${MIRROR_DIR}/x.json"\n`).includes(MIRROR_DIR));
  assert.ok(!codeOf(`# reads $forge/${MIRROR_DIR}/x.json\n`).includes(MIRROR_DIR));
  assert.ok(!codeOf(`x=1  # reads ${MIRROR_DIR}\n`).includes(MIRROR_DIR));
  assert.ok(codeOf('n=${#arr[@]}\n').includes('${#arr[@]}'));
});

test('★★★ the block hands the oven EXACTLY composition.json — byte for byte, prose and order included', () => {
  const r = runBlock(block(SCRIPT), FABRICATED);
  assert.equal(r.code, 0, r.out);
  assert.equal(r.staged, FABRICATED);
});

test('★★ a list that carries instanceApps without "axis": "instance" is refused BEFORE docker, naming the key', () => {
  const noAxis = FABRICATED.replace('  "axis": "instance",\n', '');
  assert.notEqual(noAxis, FABRICATED, 'the sabotage target is not in the fixture any more');
  const r = runBlock(block(SCRIPT), noAxis);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /"axis": "instance"/);
});

test('★★ SABOTAGE — a block that hands the oven a DERIVED list (the v0.3.1 shape) is refused by the comparison', () => {
  const derived = block(SCRIPT).replace(
    'cp "$here/composition.json" "$work/list/composition.json"',
    `jq '{version: 1, apps: ((.instanceApps // []) | map({id, package})) + (.apps | map({id, package}))}' "$here/composition.json" > "$work/list/composition.json"`,
  );
  assert.notEqual(derived, block(SCRIPT), 'the sabotage target is not in the block any more');
  const r = runBlock(derived, FABRICATED);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /THE LIST HANDED TO THE OVEN IS NOT composition\.json/);
});

test("this repo's own composition.json goes through the block unchanged", () => {
  const mine = readFileSync(join(ROOT, 'composition.json'), 'utf8');
  const r = runBlock(block(SCRIPT), mine);
  assert.equal(r.code, 0, r.out);
  assert.equal(r.staged, mine);
});
