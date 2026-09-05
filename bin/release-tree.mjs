// ★★ WHICH FORGE CHECKOUT THIS BOX'S IMAGES WERE BAKED FROM — the one question every guard that compares
// this repository to the product has to answer before it is allowed to say anything.
//
// It was written inside `bin/fork-typecheck.guard.mjs` (2026-09-03) and lives here since pk12/D2 gave it a
// SECOND reader (`bin/store-mount-drift.guard.mjs`). Nothing about it changed in the move; what changed is
// that the answer is now derived in ONE place, which is the whole reason a second reader was not allowed to
// copy it. Two copies of "where is the monorepo" is exactly the shape of drift these guards exist to catch.
//
// ⚠️ THE TREE IS NEVER GUESSED. On the night this was written, TWO separate false conclusions on this bench
// came from reading the WRONG TREE (`forge-materials/DIARIO-CAIXA-NOVA.md`, F4: the box seeded from a
// worktree 166 commits behind, frozen into a `.env` path). So `forge.lock`'s `built_from` names the commit,
// and a checkout is accepted only if its HEAD IS that commit — a candidate that is the wrong tree is not
// silently accepted, it is EXPANDED through `git worktree list`, and a machine that does not have the
// release's tree says so.
//
// A caller that gets `{ tried }` back has no tree and must say NOT CHECKED, loudly. A silent green there
// would mean "measured against whatever was lying around", which is not a measurement.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Read JSON, throwing the way the caller wants: a malformed lock is a failure, never a skip. */
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** The commit this box's images were baked from — `pk6/integra@cb2154ef7` shaped. It is `null` once this box
 *  stops being pre-release and the lock names registry digests instead of a branch; at that same moment the
 *  kit comes from npm and the tarballs (and this question) are gone. */
export function pinnedCommit() {
  const from = readJson(join(ROOT, 'forge.lock')).provenance?.built_from;
  if (typeof from !== 'string') return null;
  const at = from.lastIndexOf('@');
  return at < 0 ? null : { ref: from, sha: from.slice(at + 1) };
}

export const gitOut = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

/** Does this directory hold the Forge monorepo, and at which commit? `existsSync` on the directory is not
 *  enough — a half-cloned or renamed tree would make every comparison argue about an empty tree. */
function checkout(base) {
  if (!base || !existsSync(join(base, 'packages', 'storefront-kit', 'package.json'))) return null;
  const head = gitOut(base, ['rev-parse', 'HEAD']);
  return head ? { path: base, head } : null;
}

/** Where a Forge checkout might be. Same first door as this repo's other guards — `FORGE_MONOREPO` — and the
 *  rest are the layouts this repository is actually cloned in, as a plain checkout and as a worktree. */
function candidates() {
  return [
    process.env.FORGE_MONOREPO,
    join(ROOT, '..', 'forge'),
    join(ROOT, '..', '..', 'forge'),
    join(ROOT, '..', '..', '..', 'forge'),
  ].filter(Boolean);
}

/** The checkout whose HEAD is the pinned commit, and the sentence that says how it was found. Returns
 *  `{ path, head, how }` when one exists and `{ tried }` — the list of what was looked at and why each was
 *  rejected — when none does. */
export function releaseTree(pinned) {
  const tried = [];
  for (const base of candidates()) {
    const found = checkout(base);
    if (!found) {
      tried.push(
        existsSync(join(base, 'packages', 'storefront-kit', 'package.json'))
          ? `${base} — a Forge tree that git cannot name a commit for`
          : `${base} — not a Forge checkout`,
      );
      continue;
    }
    if (found.head.startsWith(pinned.sha)) return { ...found, how: 'checked out here' };
    tried.push(`${base} @ ${found.head.slice(0, 9)} — a different commit`);
    const list = gitOut(base, ['worktree', 'list', '--porcelain']) ?? '';
    for (const block of list.split('\n\n')) {
      const path = block.match(/^worktree (.+)$/m)?.[1];
      const head = block.match(/^HEAD ([0-9a-f]+)$/m)?.[1];
      if (!path || !head || !head.startsWith(pinned.sha)) continue;
      const sibling = checkout(path);
      if (sibling) return { ...sibling, how: `a worktree of ${base}` };
    }
  }
  return { tried };
}
