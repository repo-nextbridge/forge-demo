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
// ⚠️ AND THE COMMIT IS NOT THE WHOLE QUESTION — the fold this file learned last. A working tree can sit at
// the pinned commit and still not be the release's bytes, because a slice is running in it; a cut packed out
// of one of those reported drift that was the slice's own edits. So `releaseTree` PREFERS a clean tree among
// the ones at that commit and says which it took.
//
// A caller that gets `{ tried }` back has no tree and must say NOT CHECKED, loudly. A silent green there
// would mean "measured against whatever was lying around", which is not a measurement.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
 *  enough — a half-cloned or renamed tree would make every comparison argue about an empty tree.
 *
 *  ★ pk24/D3 — EXPORTED when `bin/instance-apps.mjs` became a reader that needs A checkout rather than THE
 *  pinned one: an app of this box is linked against a Forge tree the way `bin/pack-apps.sh` links its
 *  contracts, and that caller has to be able to fall back and SAY it fell back. Exporting was the alternative
 *  to a second copy of "where is the monorepo", which is the drift this file exists to prevent. */
export function checkout(base) {
  if (!base || !existsSync(join(base, 'packages', 'storefront-kit', 'package.json'))) return null;
  const head = gitOut(base, ['rev-parse', 'HEAD']);
  return head ? { path: base, head } : null;
}

/** Where a Forge checkout might be. Same first door as this repo's other guards — `FORGE_MONOREPO` — and the
 *  rest are the layouts this repository is actually cloned in, as a plain checkout and as a worktree.
 *  ★ pk24/D3 — exported for the same reason `checkout` above is.
 *
 *  ⚠️ THE ENVIRONMENT IS AN ARGUMENT, NOT AN AMBIENT FACT (pk38/d9). A caller that runs one of these guards as
 *  a CHILD gives that child an environment of its own, and then has to ask this same question the way the
 *  CHILD will answer it — not the way this process would. Reading `process.env` here and nowhere else made
 *  that impossible to state, and `bin/composition-pin.test.mjs` went red whenever the shell happened to export
 *  `FORGE_MONOREPO`: it compared a child pointed at a fixture against an answer computed from the caller's
 *  own shell. Defaulting to `process.env` keeps every other caller written exactly as it was. */
export function candidates(env = process.env) {
  return [
    env.FORGE_MONOREPO,
    join(ROOT, '..', 'forge'),
    join(ROOT, '..', '..', 'forge'),
    join(ROOT, '..', '..', '..', 'forge'),
  ].filter(Boolean);
}

/**
 * ★★ UNCOMMITTED CHANGES, COUNTED — the question that separates "the right commit" from "the right tree".
 *
 * ⛔ MEASURED AT THE pk36 CUT. A release was packed out of a worktree sitting at the pinned commit with a
 * slice still running in it, and the drift it reported was the SLICE's edits, not a difference between the
 * box and the release. The tree had the right commit and still lied — which is why `--porcelain` and not
 * `rev-parse` is the second question. Untracked files count: `node_modules/`, `dist/` and every build output
 * here are gitignored, so an untracked path at this level is a file somebody added and nobody packed.
 *
 * @returns the number of changed paths, `0` for a clean tree, or `null` when git cannot answer — which is
 * NEVER read as clean, because "I could not look" and "I looked and there was nothing" are different answers.
 */
function uncommitted(base) {
  const status = gitOut(base, ['status', '--porcelain']);
  if (status === null) return null;
  return status === '' ? 0 : status.split('\n').length;
}

/**
 * ★★★ WHY THERE IS NO TREE — AND IT IS TWO DIFFERENT SENTENCES, NOT ONE (pk42/s2).
 *
 * ⛔ THE DEFECT, MEASURED THREE WAYS ON THIS TREE, 2026-09-16. `releaseTree` answered a machine with no tree
 * at the pin with `… @ <other sha> — a different commit`, and every caller turned that into ONE NOT CHECKED.
 * But the same words cover two states that call for opposite reactions:
 *
 *   · THE LOCK AGED. The pin is an ANCESTOR of the product's branch next door — the images were baked, the
 *     product moved on, and nothing about the installed kit is in question. Measured here: the lock pins
 *     `a8bef5f5a`, the clone holds it, and `v03/integra` is 34 commits ahead of it. 37 of the 45 tests this
 *     repository reported NOT CHECKED were that, and the repair is a rebake, not an investigation.
 *   · THE KIT IS NOT THE RELEASE'S. No clone on this machine holds the commit at all, so nothing can be said
 *     about what is installed. That is the state provenance was built for, and it stays as strict as it was:
 *     a fork once ran 174 lines behind the release, green and silent, and this is the question that catches
 *     it.
 *
 * ⇒ THE RIGOUR IS UNCHANGED — both still say NOT CHECKED, and nothing is graded against a tree that is not
 * the release's. What changes is the DIAGNOSIS: git can answer which of the two it is, and it is asked.
 *
 * @returns {{ kind: string, sentence: string, ahead?: number, clone?: string }}
 *   `lock-behind`     the pin is an ancestor of a tip in a clone here — the product moved on
 *   `pin-orphaned`    the clone holds the pin and no branch contains it — it was rewritten or dropped
 *   `pin-here-no-tree` a clone is AT the pin and is not a checkout this resolver accepts
 *   `pin-unreachable` no clone on this machine holds the commit — the grave one
 *   `no-clone`        there is no Forge clone here at all, so the question cannot be put
 *   `unpinned`        the lock names registry digests and there is no commit to diagnose
 */
export function pinDiagnosis(pinned, env = process.env) {
  if (!pinned?.sha) {
    return {
      kind: 'unpinned',
      sentence: 'VERDICT — forge.lock names registry digests and not a branch@sha, so there is no commit to diagnose.',
    };
  }
  const short = pinned.sha.slice(0, 9);
  /** Every candidate that git will answer questions about — a clone, whether or not it is a Forge checkout. */
  const clones = candidates(env).filter((base) => base && existsSync(base) && gitOut(base, ['rev-parse', '--git-dir']) !== null);
  if (clones.length === 0) {
    return {
      kind: 'no-clone',
      sentence:
        `VERDICT — THE QUESTION COULD NOT BE PUT: no git clone of the product was found here, so "the product ` +
        `moved on" and "the installed kit is not the release's" cannot be told apart. Set FORGE_MONOREPO=<a Forge clone>.`,
    };
  }
  // ⚠️ `cat-file -e` PRINTS NOTHING AND SUCCEEDS, so the answer is `!== null` and never a truthy string.
  const holder = clones.find((base) => gitOut(base, ['cat-file', '-e', `${pinned.sha}^{commit}`]) !== null);
  if (!holder) {
    return {
      kind: 'pin-unreachable',
      sentence:
        `⛔ VERDICT — NO CLONE ON THIS MACHINE HOLDS ${short}. The release these images name cannot be read here at ` +
        `all, so nothing can show that the installed kit IS the release's — which is the state this gate exists for. ` +
        `Fetch the branch in a clone, or point FORGE_MONOREPO at one that has the commit. ⛔ This is NOT "the product moved on".`,
    };
  }
  // The pin's own branch first — the clone next door is usually parked on something else — then its remote,
  // then whatever is checked out. The first tip that CONTAINS the pin answers the question.
  const at = pinned.ref?.lastIndexOf('@') ?? -1;
  const branch = at > 0 ? pinned.ref.slice(0, at) : null;
  for (const tip of [branch, branch ? `origin/${branch}` : null, 'HEAD'].filter(Boolean)) {
    if (gitOut(holder, ['rev-parse', '--verify', `${tip}^{commit}`]) === null) continue;
    const ahead = gitOut(holder, ['rev-list', '--count', `${pinned.sha}..${tip}`]);
    const behind = gitOut(holder, ['rev-list', '--count', `${tip}..${pinned.sha}`]);
    if (ahead === null || behind === null || behind !== '0') continue;
    if (ahead === '0') {
      return {
        kind: 'pin-here-no-tree',
        clone: holder,
        sentence:
          `VERDICT — ${holder} IS at ${short} and was still refused, so what is missing is a working tree this ` +
          `resolver accepts (packages/storefront-kit/package.json, and a commit git can name). The kit is not in question.`,
      };
    }
    return {
      kind: 'lock-behind',
      clone: holder,
      ahead: Number(ahead),
      sentence:
        `VERDICT — THE LOCK AGED, THE KIT DID NOT: ${holder} holds ${short} and \`${tip}\` is ${ahead} commit(s) AHEAD ` +
        `of it, so the pin is an ANCESTOR of the product next door. These images were baked before those ${ahead} ` +
        `commits; nothing here says the installed kit is wrong. Park a tree at the pin ` +
        `(git -C ${holder} worktree add <dir> ${short}) to grade this run, or rebake to move the pin ` +
        `(bash bin/build-local.sh ${holder}, which rewrites forge.lock).`,
    };
  }
  return {
    kind: 'pin-orphaned',
    clone: holder,
    sentence:
      `⛔ VERDICT — THE PIN IS ON NO BRANCH: ${holder} holds ${short} and no tip of it contains that commit, so the ` +
      `branch it was baked from was rewritten or dropped. A rebake is the only thing that makes this lock honest again.`,
  };
}

/**
 * The checkout whose HEAD is the pinned commit, and the sentence that says how it was found. Returns
 * `{ path, head, how, clean }` when one exists and `{ tried }` — the list of what was looked at and why each
 * was rejected — when none does.
 *
 * ★★ A CLEAN TREE IS PREFERRED OVER A DIRTY ONE AT THE SAME COMMIT (pk38/d9), and the one that was used is
 * said out loud in `how`. A dirty tree is still an answer — a developer editing the monorepo next door must
 * not be told the release is missing — but it is the LAST answer, never the first one found, and it arrives
 * carrying the count of what is uncommitted in it so a reader of a red can see the tree is not the release.
 */
export function releaseTree(pinned, env = process.env) {
  const tried = [];
  /** Trees AT the pinned commit that are not clean — the fallback, weighed only after the search is over. */
  const dirty = [];
  const seen = new Set();
  /** Accept `found` if it is clean; otherwise remember it and keep looking. */
  const weigh = (found, how) => {
    if (seen.has(found.path)) return null;
    seen.add(found.path);
    const changed = uncommitted(found.path);
    if (changed === 0) return { ...found, how, clean: true };
    dirty.push({
      ...found,
      clean: false,
      how:
        `${how}, ⚠️ NOT THE RELEASE'S BYTES — ` +
        (changed === null
          ? 'git cannot read a status from it'
          : `${changed} uncommitted change(s) sit on top of the pinned commit`),
    });
    return null;
  };

  for (const base of candidates(env)) {
    const found = checkout(base);
    if (!found) {
      tried.push(
        existsSync(join(base, 'packages', 'storefront-kit', 'package.json'))
          ? `${base} — a Forge tree that git cannot name a commit for`
          : `${base} — not a Forge checkout`,
      );
      continue;
    }
    if (found.head.startsWith(pinned.sha)) {
      const answer = weigh(found, 'checked out here');
      if (answer) return answer;
    } else {
      tried.push(`${base} @ ${found.head.slice(0, 9)} — a different commit`);
    }
    // ⚠️ THE EXPANSION RUNS EVEN WHEN THE BASE ITSELF IS AT THE PIN, which it did not before: a sibling
    // worktree of the same clone can hold the same commit CLEAN while this one is mid-slice, and that sibling
    // is the tree the question was about.
    const list = gitOut(base, ['worktree', 'list', '--porcelain']) ?? '';
    for (const block of list.split('\n\n')) {
      const path = block.match(/^worktree (.+)$/m)?.[1];
      const head = block.match(/^HEAD ([0-9a-f]+)$/m)?.[1];
      if (!path || !head || !head.startsWith(pinned.sha)) continue;
      const sibling = checkout(path);
      if (!sibling) continue;
      const answer = weigh(sibling, `a worktree of ${base}`);
      if (answer) return answer;
    }
  }
  if (dirty.length > 0) return dirty[0];
  // ★★ AND THE LIST ENDS WITH A VERDICT. Every caller of this function already prints `tried` line by line
  // (`for (const line of TREE.tried) say(...)`), so the diagnosis reaches all fourteen of them by being the
  // last thing in that list — one mechanism rather than fourteen edited call sites, the same shape
  // `bin/test.sh`'s strict mode took for the same reason.
  const diagnosis = pinDiagnosis(pinned, env);
  tried.push(diagnosis.sentence);
  return { tried, diagnosis };
}

/**
 * ★★ ONE FILE OF THE RELEASE, AT THE PINNED COMMIT, FROM ANY CLONE THAT HOLDS THE OBJECT (pk29/D1).
 *
 * `releaseTree` above answers a different question and answers it correctly: it wants a WORKING TREE checked
 * out at the pinned commit, because its callers typecheck a fork against it and run its suites. Reading ONE
 * FILE needs no working tree — git is the index, and `git show <sha>:<path>` answers from any clone that has
 * fetched the branch, whatever that clone currently has checked out.
 *
 * ⚠️ AND THE DIFFERENCE IS NOT ACADEMIC. MEASURED on this machine, 2026-09-09: `forge.lock` pins
 * `v03/integra@38db5f3a1`, NO worktree of the monorepo sat at that commit (the branch had moved on), so
 * `releaseTree` returned `{ tried }` and every rule that needs the product said NOT CHECKED — 27 skipped in
 * one run. `git show 38db5f3a1:extensions/chrome/manifest.ts` answered instantly from the same clone that had
 * just been rejected as "a different commit". A rule that only needs to READ a declaration should not be
 * silenced by which branch somebody left checked out.
 *
 * Returns `{ text, from }` — the bytes AT the pinned commit and the clone that served them — or `{ tried }`,
 * the list of what was looked at, for a caller that must then say NOT CHECKED out loud.
 */
export function fileAtPinned(pinned, relPath) {
  const tried = [];
  for (const base of candidates()) {
    if (!existsSync(join(base, '.git')) && !existsSync(join(base, 'packages', 'storefront-kit', 'package.json'))) {
      tried.push(`${base} — not a Forge checkout`);
      continue;
    }
    // ⛔ `git show` AND NOT `git cat-file -p`, because the first takes `<rev>:<path>` — which is the whole
    // point: the path is resolved INSIDE that commit's tree, so a file that has since moved or been deleted
    // is still read as the baked image saw it.
    const text = gitOut(base, ['show', `${pinned.sha}:${relPath}`]);
    if (text === null || text === '') {
      tried.push(`${base} — has no ${relPath} at ${pinned.sha} (unfetched commit, or the path is not there)`);
      continue;
    }
    return { text, from: `${base} @ ${pinned.sha}` };
  }
  // ★ THE SAME VERDICT AS `releaseTree`'s, for the same reason: this door fails for two different causes too
  // — a clone that does not hold the commit (grave) and a commit whose branch simply moved on with the path
  // still present (a rebake). Its callers print `tried` the same way, so the diagnosis reaches them the
  // same way.
  tried.push(pinDiagnosis(pinned).sentence);
  return { tried };
}

// ── ★ THE SAME ANSWER, FOR A HUMAN AND FOR A SHELL ──────────────────────────────────────────────────────────
//
//   node bin/release-tree.mjs
//
// ⚠️ IT IS A REPORT AND NEVER A GATE — it exits 0 on every verdict, including the grave one. What grades the
// provenance is the guards that import this file; this door exists because "why did 37 of my tests not run?"
// was a question whose answer was scattered across thirty `tried:` lines in a 900-line run, and
// `bin/test.sh` now closes every run with it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pinned = pinnedCommit();
  const tree = pinned ? releaseTree(pinned) : null;
  process.stdout.write(`pin       ${pinned?.ref ?? '<none: forge.lock names registry digests>'}\n`);
  if (tree?.path) {
    process.stdout.write(`tree      ${tree.path}  (${tree.how})\n`);
    process.stdout.write('verdict   the release these images were baked from is HERE — the guards that need it will grade.\n');
  } else {
    const diagnosis = tree?.diagnosis ?? pinDiagnosis(pinned);
    process.stdout.write(`tree      <none on this machine>\n`);
    for (const line of tree?.tried ?? []) process.stdout.write(`looked at ${line}\n`);
    process.stdout.write(`kind      ${diagnosis.kind}\n`);
  }
}
