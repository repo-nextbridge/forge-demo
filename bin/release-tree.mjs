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

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Read JSON, throwing the way the caller wants: a malformed lock is a failure, never a skip. */
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** The commit this box's images were baked from — `pk6/integra@cb2154ef7` shaped. It is `null` once this box
 *  stops being pre-release and the lock names registry digests instead of a branch; at that same moment the
 *  kit comes from npm and the tarballs (and this question) are gone. */
export function pinnedCommit() {
  const lock = readJson(join(ROOT, 'forge.lock'));
  const from = lock.provenance?.built_from;
  if (typeof from !== 'string') {
    // ★★ v032/C — A LOCK THAT PINS A RELEASE. From v0.3.2 this box is baked in its own CI from the release's
    // published oven (`.github/workflows/bake.yml`) and the lock has no `provenance` block: every image is
    // `{ ref, origin: "own build", built_from: <tag> }`. The pin is then the TAG, which names the same tree
    // a commit did — `sha` carries it too, so every caller that prints `PINNED.sha` keeps working and every
    // git question (`git show <tag>:<path>`) still has an answer in a clone that fetched the tag.
    const tag = typeof lock.forgeVersion === 'string' ? lock.forgeVersion : '';
    return RELEASE_TAG.test(tag) ? { ref: tag, sha: tag, release: tag } : null;
  }
  const at = from.lastIndexOf('@');
  return at < 0 ? null : { ref: from, sha: from.slice(at + 1) };
}

/** A release tag as the product cuts them (`infra/cicd/stamp-oven.sh` refuses anything else). */
export const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

/** ★ v032/C — THE ONE NAME OF THE BENCH OVERRIDE. Every other file says "the release tree" and asks this one;
 *  only here is the variable read, so `grep -rl FORGE_MONOREPO bin/` answers with this file alone (spec
 *  v032, DoD 6). A guard that wants to tell a human how to override says `${BENCH_OVERRIDE}=…`. */
export const BENCH_OVERRIDE = 'FORGE_MONOREPO';

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
    env[BENCH_OVERRIDE],
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
  if (pinned?.release) {
    return {
      kind: 'release-unreachable',
      sentence:
        `VERDICT — THE ${pinned.release} TREE COULD NOT BE READ HERE. It comes from the release's oven: give this ` +
        `machine one (FORGE_OVEN_IMAGE=<an oven stamped ${pinned.release}>, or \`gh\` access to the ` +
        `${releaseRepo(env)} Release plus registry access to the oven it names), or point ${BENCH_OVERRIDE} at a ` +
        `clean clone at the tag. Nothing about the installed kit is in question — it comes from npm at that version.`,
    };
  }
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
        `(bin/bake.sh, which rewrites forge.lock).`,
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

// ── ★★★ v032/C — THE TREE OF A RELEASE, WITHOUT A CLONE OF THE PRODUCT ────────────────────────────────────
//
// Until v0.3.2 every guard below found the product by looking for a CHECKOUT of it on this machine, because
// the images were baked from one (`bin/build-local.sh <monorepo>`). From v0.3.2 the images are baked from the
// release's published OVEN (`forge-oven:<tag>`: the monorepo at the tag, `pnpm install --frozen-lockfile`
// done — `infra/oven/Dockerfile`, stage `oven`, in the product), and that same image is the tree the guards
// grade against: the bytes the bake read are the bytes the comparison reads. Nothing here needs git, a
// clone, or `FORGE_MONOREPO` (spec v032, decision 8).
//
// HOW, MEASURED 2026-10-09 on an oven built from `v0.3.2` (`3b5e552b9`): `docker run --entrypoint tar <oven>
// -C /app --exclude=node_modules -cf - .` streams 90 MB in 1.8 s, and the tree lands in `.forge-release/
// <tag>/tree/` under the user's cache (`RELEASE_CACHE`), once per oven. node_modules is left in the image on purpose: it is ~2.5 GB of
// it, and what this repository compiles against is what IT installs from npm (`@forgeco/*@<release>`), not
// the monorepo's workspace links.
//
// ⛔ THE OVEN MUST SAY WHICH RELEASE IT IS. A published oven carries its tag at `/forge-oven/release`
// (`infra/cicd/stamp-oven.sh` in the product — one layer on top of the tested oven). An oven with no stamp,
// or another tag, is refused by name: the tree is never guessed, which is the rule this file was born with.
//
// WHICH OVEN — in order, each one said in `how`:
//   1. `FORGE_OVEN_IMAGE` — a bench that built or pulled one itself (`docker build … --target oven` plus
//      `stamp-oven.sh`, or a `docker pull` with registry access).
//   2. `images.oven.ref` of the RELEASE's own `forge.lock`, downloaded once into `RELEASE_CACHE/<tag>/`
//      (`gh release download <tag> -R $FORGE_RELEASE_REPO -p forge.lock`). ⚠️ THE REF IS NEVER WRITTEN INTO
//      THIS REPOSITORY: the product's registry has no public name (spec v032, decision 2 as amended), and
//      this repository is public. It lives in the per-machine cache and in the release.

/** Where a release's tree and its lock are cached — OUTSIDE this repository, on purpose: measured 2026-10-09,
 *  a cache under the repo root put eight of the product's Dockerfiles in front of `bin/container-health.guard.mjs`'s
 *  walk, and every guard that walks this tree would have had to learn to skip it. It is per machine, like any
 *  cache; `FORGE_RELEASE_CACHE` moves it. */
export const RELEASE_CACHE =
  process.env.FORGE_RELEASE_CACHE || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'forge-demo', 'release');

/** The product's repository — where its GitHub Releases live. Overridable for a fork of the product. */
const releaseRepo = (env) => env.FORGE_RELEASE_REPO || 'repo-nextbridge/forge';

/** The file a materialised tree carries, naming what it was cut from. Its presence is what makes a directory
 *  a release tree rather than a directory that happens to hold a `packages/` folder. */
const TREE_MARK = '.forge-release-tree.json';

const STAMP_PATH = '/forge-oven/release';

const run = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim();
  } catch {
    return null;
  }
};

/** The release's own `forge.lock`, from the cache or downloaded into it. `{ lock, path }` or `{ error }`. */
export function releaseLock(tag, env = process.env) {
  const dir = join(RELEASE_CACHE, tag);
  const path = join(dir, 'forge.lock');
  if (!existsSync(path)) {
    mkdirSync(dir, { recursive: true });
    const got = run('gh', ['release', 'download', tag, '-R', releaseRepo(env), '-p', 'forge.lock', '-D', dir, '--clobber']);
    if (got === null || !existsSync(path)) {
      return {
        error:
          `the ${tag} Release's forge.lock could not be downloaded (gh release download ${tag} -R ${releaseRepo(env)} ` +
          `-p forge.lock — gh missing, not logged in, or no read access to that repository)`,
      };
    }
  }
  try {
    const lock = readJson(path);
    if (lock.forgeVersion !== tag) return { error: `${path} is the lock of ${lock.forgeVersion}, not of ${tag}` };
    return { lock, path };
  } catch (error) {
    return { error: `${path} is not a readable lock: ${error.message}` };
  }
}

/** Which oven to read the release from, and how that was decided. `{ ref, how }` or `{ error }`. */
export function ovenRef(tag, env = process.env) {
  if (env.FORGE_OVEN_IMAGE) return { ref: env.FORGE_OVEN_IMAGE, how: 'FORGE_OVEN_IMAGE' };
  const found = releaseLock(tag, env);
  if (found.error) return { error: found.error };
  const ref = found.lock.images?.oven?.ref;
  if (typeof ref !== 'string' || !ref.includes('@sha256:')) {
    return { error: `the ${tag} Release's forge.lock names no oven by digest (images.oven.ref) — a release older than v0.3.2 has none` };
  }
  return { ref, how: `images.oven of the ${tag} Release's forge.lock` };
}

/** The image id of `ref` on this daemon, pulling it once if it is not here. `{ id }` or `{ error }`. */
function ovenImage(ref) {
  const inspect = () => run('docker', ['image', 'inspect', '--format', '{{.Id}}', ref]);
  let id = inspect();
  if (!id) {
    if (run('docker', ['version', '--format', '{{.Server.Version}}']) === null) return { error: 'no docker daemon answers here' };
    run('docker', ['pull', '-q', ref], { timeout: 15 * 60_000 });
    id = inspect();
  }
  return id ? { id } : { error: `the oven is not on this daemon and \`docker pull\` did not bring it (no registry access?)` };
}

/**
 * ★★ THE TREE OF `tag`, CUT OUT OF ITS OVEN — `{ path, head, how, clean: true }` or `{ error }`.
 * Reused while the oven it came from is the same image; re-cut when it is not.
 */
export function ovenTree(tag, env = process.env) {
  const oven = ovenRef(tag, env);
  if (oven.error) return { error: oven.error };
  const image = ovenImage(oven.ref);
  if (image.error) return { error: `${oven.how}: ${image.error}` };
  const path = join(RELEASE_CACHE, tag, 'tree');
  const how = `cut from the ${tag} oven (${oven.how}, image ${image.id.slice(7, 19)})`;
  try {
    const mark = readJson(join(path, TREE_MARK));
    if (mark.release === tag && mark.image === image.id) return { path, head: tag, how, clean: true };
  } catch {
    /* no tree yet, or one from another oven — cut it below */
  }
  const stamp = run('docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'cat', image.id, STAMP_PATH]);
  if (stamp !== tag) {
    return {
      error:
        `${oven.how} names an oven stamped '${stamp || '<none>'}' at ${STAMP_PATH}, and this lock pins ${tag}. ` +
        `An oven that does not say it IS this release is not the tree these images were baked from ` +
        `(stamp a bench oven with the product's infra/cicd/stamp-oven.sh)`,
    };
  }
  // Cut into a sibling and RENAME, so a reader never sees half a tree and two guards cutting at once (node
  // --test runs files in parallel) cannot interleave: the loser's rename fails and it takes the winner's.
  const staging = `${path}.${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const cut = spawnSync(
    'sh',
    ['-c', 'docker run --rm --network none --entrypoint tar "$1" -C /app --exclude=node_modules -cf - . | tar -xf - -C "$2"', 'cut', image.id, staging],
    { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' },
  );
  if (cut.status !== 0 || !existsSync(join(staging, 'package.json'))) {
    rmSync(staging, { recursive: true, force: true });
    return { error: `${oven.how}: cutting /app out of the oven failed — ${(cut.stderr || '').trim().split('\n').pop()}` };
  }
  writeFileSync(join(staging, TREE_MARK), `${JSON.stringify({ release: tag, oven: oven.how, image: image.id }, null, 2)}\n`);
  rmSync(path, { recursive: true, force: true });
  try {
    renameSync(staging, path);
  } catch {
    rmSync(staging, { recursive: true, force: true });
  }
  return existsSync(join(path, TREE_MARK)) ? { path, head: tag, how, clean: true } : { error: `${path} could not be written` };
}

/** Does `base` hold `tag`'s tree? A cut of its oven (it carries the mark), or a CLONE whose HEAD is the tag's
 *  commit. `{ path, head, how, clean }`, or a sentence saying why not. */
function overrideTree(base, tag) {
  try {
    const mark = readJson(join(base, TREE_MARK));
    if (mark.release === tag) return { path: base, head: tag, how: `${BENCH_OVERRIDE} (a cut of the ${tag} oven)`, clean: true };
    return `${base} — a cut of the ${mark.release} oven, not of ${tag}`;
  } catch {
    /* not a cut — maybe a clone */
  }
  const found = checkout(base);
  if (!found) return `${base} — neither a cut of the ${tag} oven nor a Forge checkout`;
  const at = gitOut(base, ['rev-parse', `${tag}^{commit}`]);
  if (!at) return `${base} — a Forge clone that has not fetched the tag ${tag}`;
  if (found.head !== at) return `${base} @ ${found.head.slice(0, 9)} — a different commit (${tag} is ${at.slice(0, 9)})`;
  const changed = uncommitted(base);
  if (changed !== 0) return `${base} @ ${tag} — ⚠️ NOT THE RELEASE'S BYTES, ${changed ?? 'unknown'} uncommitted change(s)`;
  return { path: base, head: at, how: `${BENCH_OVERRIDE} (a clean clone at ${tag})`, clean: true };
}

/** `releaseTree` for a lock that pins a release: the bench override when one is set, else the oven. */
function releaseTreeOfTag(pinned, env) {
  const tag = pinned.release;
  const tried = [];
  if (env[BENCH_OVERRIDE]) {
    const found = overrideTree(env[BENCH_OVERRIDE], tag);
    if (typeof found !== 'string') return found;
    tried.push(found);
  }
  const cut = ovenTree(tag, env);
  if (cut.path) return cut;
  tried.push(`the ${tag} oven — ${cut.error}`);
  const diagnosis = pinDiagnosis(pinned, env);
  tried.push(diagnosis.sentence);
  return { tried, diagnosis };
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
  if (pinned?.release) return releaseTreeOfTag(pinned, env);
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
  if (pinned?.release) return fileOfRelease(pinned, relPath);
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

/**
 * ★ v032/C — `fileAtPinned` for a lock that pins a release: the file read out of the release tree. A
 * DIRECTORY answers the way `git show <rev>:<dir>` does — `tree <rev>:<dir>`, a blank line, one entry per
 * line with `/` after a directory — because callers (`bin/app-manifest.mjs#templatesOf`) parse that shape.
 */
function fileOfRelease(pinned, relPath) {
  const tree = releaseTree(pinned);
  if (!tree.path) return { tried: tree.tried };
  const full = join(tree.path, relPath);
  if (!existsSync(full)) return { tried: [`${tree.path} — has no ${relPath} at ${pinned.ref}`, ...(tree.tried ?? [])] };
  const from = `${tree.path} @ ${pinned.ref}`;
  if (!statSync(full).isDirectory()) return { text: readFileSync(full, 'utf8'), from };
  const entries = readdirSync(full, { withFileTypes: true })
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .sort();
  return { text: `tree ${pinned.ref}:${relPath}\n\n${entries.join('\n')}\n`, from };
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
