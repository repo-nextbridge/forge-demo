// ★★ v031/G (item 26) — THE OVEN BAKES THIS REPOSITORY'S OWN LIST, AND NOTHING READS THE PRODUCT'S MIRROR.
//
//   node --test bin/build-local-own-list.guard.mjs        (or: bash bin/test.sh)
//
// ⛔ WHAT ENDED, MEASURED ON `dd7b8c3` (2026-10-07). `bin/build-local.sh:95-108` baked the monorepo's COPY of
// this box's list (`infra/fleet/lists/demo-instance.json`) and refused to build unless it equalled
// `composition.json` — two copies of one decision kept in step by hand across repositories, the product
// carrying a fact about an instance. The product drops that copy in v0.3.1 (its fleet list becomes
// `full-instance`). A build-local that still read it would die on the first v0.3.1 checkout; one that
// silently fell back to it would bake a list this box never asked for.
//
// ★ WHAT IS HELD, IN TWO HALVES:
//   1 · BY TEXT, COMMENTS STRIPPED — the script's CODE names no path under `infra/fleet/lists/` and no
//       `instances/` directory of the product (its comments may: they are the history). The dataset pointer is
//       read from this repo's `seed/dataset/`.
//   2 · BY RUNNING the block between `# >>> THE LIST HANDED TO THE OVEN` markers over a fabricated repo: what it
//       writes into the context is `composition.json` (instance apps first, then `apps`, in order), and a block
//       that hands the oven anything else exits 1 naming both lists.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = readFileSync(join(ROOT, 'bin', 'build-local.sh'), 'utf8');

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
  assert.ok(m, 'bin/build-local.sh no longer marks THE LIST HANDED TO THE OVEN — this guard cannot run it');
  return m[1];
}

/** Run the marked block with `here` = a fabricated repo holding `composition`, and `staging` = a scratch dir. */
function runBlock(body, composition) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-own-list-'));
  const staging = join(dir, 'context');
  try {
    writeFileSync(join(dir, 'composition.json'), JSON.stringify(composition));
    mkdirSync(staging);
    writeFileSync(join(dir, 'block.sh'), `set -uo pipefail\nhere=${JSON.stringify(dir)}\nstaging=${JSON.stringify(staging)}\n${body}\necho STAGED\n`);
    try {
      const out = execFileSync('bash', [join(dir, 'block.sh')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, out, staged: JSON.parse(readFileSync(join(staging, 'composition.json'), 'utf8')) };
    } catch (error) {
      return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const FABRICATED = {
  version: 1,
  apps: [
    { id: 'b-app', package: '@x/b' },
    { id: 'a-app', package: '@x/a' },
  ],
  instanceApps: [{ id: 'own', package: '@me/own', source: 'apps/own' }],
};

test('★★ the CODE of build-local.sh reads no product mirror and no product instance directory', () => {
  const code = codeOf(SCRIPT);
  // ⟂ ANTI-VACUUM: the stripping must leave the script's code, and must remove the prose that names the past.
  assert.ok(code.includes('composition.json'), 'the stripped script lost its code');
  assert.ok(SCRIPT.includes(MIRROR_DIR), '⟂ control: the comments no longer tell the history this guard is about');
  const hits = code.split('\n').flatMap((line, i) =>
    line.includes(MIRROR_DIR) || line.includes(PRODUCT_INSTANCES) ? [`bin/build-local.sh:${i + 1}: ${line.trim()}`] : [],
  );
  assert.deepEqual(hits, [], 'build-local.sh reads a path the product is dropping in v0.3.1');
  assert.match(code, /\$here\/seed\/dataset\/forge-seed-dataset\.json/, 'the dataset pointer is not read from this repo');
});

test('⟂ the comment stripper is not vacuous — a needle in CODE survives it, the same needle in a comment does not', () => {
  assert.ok(codeOf(`theirs="$forge/${MIRROR_DIR}/x.json"\n`).includes(MIRROR_DIR));
  assert.ok(!codeOf(`# reads $forge/${MIRROR_DIR}/x.json\n`).includes(MIRROR_DIR));
  assert.ok(!codeOf(`x=1  # reads ${MIRROR_DIR}\n`).includes(MIRROR_DIR));
  assert.ok(codeOf('n=${#arr[@]}\n').includes('${#arr[@]}'));
});

test('★★★ the block hands the oven EXACTLY composition.json — instance apps first, then `apps`, in order', () => {
  const r = runBlock(block(SCRIPT), FABRICATED);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(r.staged.apps, [
    { id: 'own', package: '@me/own' },
    { id: 'b-app', package: '@x/b' },
    { id: 'a-app', package: '@x/a' },
  ]);
});

test('★★ SABOTAGE — a block that drops the instance apps (or re-sorts the list) is refused by the comparison', () => {
  const dropped = block(SCRIPT).replace("((.instanceApps // []) | map({id, package})) + ", '');
  assert.notEqual(dropped, block(SCRIPT), 'the sabotage target is not in the block any more');
  const r = runBlock(dropped, FABRICATED);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /THE LIST HANDED TO THE OVEN IS NOT composition\.json/);

  const sorted = block(SCRIPT).replace('(.apps | map({id, package}))', '(.apps | map({id, package}) | sort_by(.id))');
  assert.notEqual(sorted, block(SCRIPT));
  assert.equal(runBlock(sorted, FABRICATED).code, 1);
});

test('this repo\'s own composition.json goes through the block unchanged', () => {
  const mine = JSON.parse(readFileSync(join(ROOT, 'composition.json'), 'utf8'));
  const r = runBlock(block(SCRIPT), mine);
  assert.equal(r.code, 0, r.out);
  assert.equal(r.staged.apps.length, (mine.instanceApps ?? []).length + mine.apps.length);
});
