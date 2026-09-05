// ★★ THE HOST'S NODE IS CHECKED BEFORE ANYTHING HAPPENS, AND THE NUMBER IS NOT OURS TO TYPE.
//
// F13 of the from-zero install rehearsal (04/09). Two `node` binaries live on that machine and the
// interactive PATH resolves to the smaller one:
//
//     the shell resolves   ->  ~/.local/bin/node                        v22.22.3
//     nvm holds            ->  ~/.nvm/versions/node/v24.18.0/bin/node   v24.18.0  (+ pnpm 11.5.0)
//     the product declared ->  the monorepo's package.json: "node": ">=24"
//
// Every birth of that night ran under the floor the product declares, and every one of them WORKED. That is
// what makes it worth a guard: `it ran` is not `it is supported`, and nothing on the box could tell the two
// apart. The seeders (`bin/seed-box.mjs`, `bin/seed.mjs`, `bin/verify-seed.mjs`) run on the HOST, not in a
// container, so the host's node is the one that decides.
//
// ★ WHAT CHANGED (pk8/d2), AND IT IS THE WHOLE POINT OF THIS FILE NOW. The first version of the check had to
// TYPE the floor — the number lived in the monorepo's root package.json and in no artifact this box receives.
// The product then put it in the artifact this box PINS: `forge.lock` carries `node.minMajor` (an integer
// already resolved, because every consumer that acts on it is a shell) alongside `node.engines` (the range it
// was resolved from, as evidence). So the guard no longer polices a digit written here. It polices:
//
//   1. THE FLOOR IS THE PIN'S — the same node passes under one lock and is refused under another, proven by
//      RUNNING the check against two fixture locks, not by reading its source.
//   2. A PIN WITH NO FLOOR DOES NOT GET ONE INVENTED — a lock stamped before releases carried the field is a
//      valid pin (the lifecycle is forward-only), so the box says it has no floor to check and refuses
//      nothing on account of it. That is the product's own decided behaviour, matched here on purpose.
//   3. ONE TRUTH — no tracked file states a floor of its own, and the prose does not restate the digit.
//   4. WIRING — the check runs first, everywhere node runs on the host, and `bin/build-local.sh` (the one
//      script here that is handed the monorepo) STAMPS the floor rather than comparing against a typed one.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const REQUIRE_SH = join(HERE, 'require-node.sh');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A directory holding a fake `node` that answers `-v` with whatever we say. */
function fakeNodeDir(answer) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-node-floor-'));
  const bin = join(dir, 'node');
  writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' ${JSON.stringify(answer)}\n`);
  chmodSync(bin, 0o755);
  return dir;
}

/**
 * A `forge.lock` holding whatever `node` block we hand it — `undefined` writes a lock with NO node key, which
 * is exactly the shape of every lock stamped before the product carried the floor. The rest of the file is
 * present because a lock is read by other scripts too and a fixture that is not a lock proves less.
 */
function fakeLock(node) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-node-lock-'));
  const path = join(dir, 'forge.lock');
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        forgeVersion: 'v0.0.0-fixture',
        ...(node === undefined ? {} : { node }),
        composition: { id: 'fixture', apps: ['none'] },
        images: {},
      },
      null,
      2,
    )}\n`,
  );
  return path;
}

/**
 * Source the check and call it, with PATH and the lock under our control. Returns { code, out, err }.
 *
 * ⚠️ STDERR GOES TO A FILE, and that is not a detail: `execFileSync` hands back stderr only when the child
 * FAILS. The interesting case here is the one that SUCCEEDS while saying something — a lock with no floor
 * proceeds and prints why — and reading `e.stderr` would have measured that as silence.
 */
function runCheck(pathValue, lockPath) {
  const env = { PATH: pathValue };
  if (lockPath !== undefined) env.FORGE_LOCK = lockPath;
  const errFile = join(mkdtempSync(join(tmpdir(), 'forge-node-err-')), 'stderr');
  let code = 0;
  let out = '';
  try {
    out = execFileSync(
      '/bin/bash',
      ['-c', 'set -uo pipefail; . "$1"; require_node 2>"$2"', '_', REQUIRE_SH, errFile],
      { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (e) {
    code = e.status ?? -1;
    out = e.stdout ?? '';
  }
  let err = '';
  try {
    err = readFileSync(errFile, 'utf8');
  } catch {
    err = '';
  }
  return { code, out, err };
}

/** The floor this repository's own pin states, if any. Read, never typed. */
function pinnedFloor() {
  const lock = JSON.parse(read('forge.lock'));
  return lock.node?.minMajor;
}

const withJq = (dir) => `${dir}:/usr/bin:/bin`;

// ── 1 · THE FLOOR IS THE PIN'S, proven by running it against two locks ───────────────────────────────────

test('★★ the floor comes from the LOCK: one node, two locks, two answers', () => {
  // The sabotage in both directions, in one measurement. Nothing about this node changes between the two
  // runs — only the number in the file it pins — so a check that had kept a copy of its own would answer
  // the same twice.
  const dir = fakeNodeDir('v26.4.0');
  const low = runCheck(withJq(dir), fakeLock({ minMajor: 24, engines: '>=24' }));
  const high = runCheck(withJq(dir), fakeLock({ minMajor: 30, engines: '>=30' }));

  assert.equal(low.code, 0, `a v26 node was refused by a lock whose floor is 24:\n${low.err}`);
  assert.equal(high.code, 1, 'a v26 node was let through by a lock whose floor is 30 — the floor is not read');
  assert.ok(high.err.includes('30'), `the refusal does not name the floor the lock states:\n${high.err}`);
  assert.ok(!high.err.includes('24'), `the refusal names a floor no lock in this run stated:\n${high.err}`);
});

test('a node UNDER the pinned floor is refused, naming the version, the path, the floor and the lock', () => {
  const floor = 28;
  const version = `v${floor - 2}.22.3`;
  const dir = fakeNodeDir(version);
  const lock = fakeLock({ minMajor: floor, engines: `>=${floor}` });
  const { code, err } = runCheck(withJq(dir), lock);
  assert.equal(code, 1, `a node ${version} was let through — the pinned floor is ${floor}`);
  assert.ok(err.includes(version), `the refusal does not name the version it found:\n${err}`);
  assert.ok(err.includes(join(dir, 'node')), `the refusal does not name WHERE that node came from:\n${err}`);
  assert.ok(err.includes(String(floor)), `the refusal does not name the floor it wants:\n${err}`);
  assert.ok(err.includes(lock), `the refusal does not name the lock the floor came from:\n${err}`);
});

test('a node AT the pinned floor is let through, in silence', () => {
  const floor = 28;
  const dir = fakeNodeDir(`v${floor}.0.0`);
  const { code, err, out } = runCheck(withJq(dir), fakeLock({ minMajor: floor, engines: `>=${floor}` }));
  assert.equal(code, 0, `a node exactly at the floor was refused:\n${err}`);
  assert.equal(`${out}${err}`.trim(), '', 'the check is noisy on the happy path');
});

test('a node OVER the pinned floor is let through — the floor is a floor, not an equality', () => {
  const floor = 28;
  const dir = fakeNodeDir(`v${floor + 9}.1.0`);
  assert.equal(runCheck(withJq(dir), fakeLock({ minMajor: floor, engines: `>=${floor}` })).code, 0);
});

test('a version this check cannot read is refused, not assumed to be fine', () => {
  const dir = fakeNodeDir('who knows');
  const { code, err } = runCheck(withJq(dir), fakeLock({ minMajor: 24, engines: '>=24' }));
  assert.equal(code, 1, 'an unreadable `node -v` was treated as good enough');
  assert.ok(err.includes('who knows'), `the refusal does not quote what node answered:\n${err}`);
});

// ── 2 · A PIN WITH NO FLOOR DOES NOT GET ONE INVENTED ────────────────────────────────────────────────────
//
// The product decided this and its own verifier says it in the same words: a lock stamped before releases
// carried the field is a VALID pin — the field is additive and the lifecycle forward-only — so it "has no
// floor to check and must not invent one". A box that refused such a lock would turn every instance pinned
// on an older release red over a field it could not possibly carry; a box that quietly assumed a number
// would be back to the second truth this whole change exists to kill. So: it says so, and it proceeds.

test('★★ a lock with NO node field refuses nothing, and SAYS the box has no floor to check', () => {
  const dir = fakeNodeDir('v18.0.0'); // under any floor a Forge release has ever declared
  const lock = fakeLock(undefined);
  const { code, err } = runCheck(withJq(dir), lock);
  assert.equal(code, 0, `a lock that states no floor refused a birth anyway:\n${err}`);
  assert.match(err, /no floor/i, `the box is silent about having no floor to check:\n${err}`);
  assert.match(err, /invent/i, `the notice does not say the number is not the box's to invent:\n${err}`);
  assert.ok(err.includes(lock), `the notice does not name the lock it read:\n${err}`);
  assert.ok(!/refus/i.test(err), `a notice that reads like a refusal:\n${err}`);
});

test('no lock file at all is the same answer — no floor, no invention, no refusal', () => {
  const dir = fakeNodeDir('v18.0.0');
  const missing = join(mkdtempSync(join(tmpdir(), 'forge-node-nolock-')), 'forge.lock');
  const { code, err } = runCheck(withJq(dir), missing);
  assert.equal(code, 0, `a missing lock refused the birth over the node floor:\n${err}`);
  assert.match(err, /no floor/i, `nothing said the floor could not be read:\n${err}`);
});

test('★ a floor the lock states but this cannot grade is REFUSED, never rounded', () => {
  // `"24"` and `24.5` are the two ways a hand-edited lock lies quietly: a shell comparing either of them
  // means something different by each. The pin claiming a floor is a claim to honour or to refuse — the one
  // thing it may not become is the absent case, which proceeds.
  const dir = fakeNodeDir('v18.0.0');
  for (const bad of ['24', 24.5, 'twenty-four', null]) {
    const lock = fakeLock({ minMajor: bad, engines: '>=24' });
    const { code, err } = runCheck(withJq(dir), lock);
    assert.equal(code, 1, `node.minMajor ${JSON.stringify(bad)} was accepted or ignored:\n${err}`);
    assert.ok(err.includes(lock), `the refusal does not name the lock it could not grade:\n${err}`);
  }
});

test('a lock that is not JSON is refused, not read past', () => {
  const dir = fakeNodeDir('v18.0.0');
  const path = join(mkdtempSync(join(tmpdir(), 'forge-node-badlock-')), 'forge.lock');
  writeFileSync(path, '{ this is not json\n');
  const { code, err } = runCheck(withJq(dir), path);
  assert.equal(code, 1, 'a corrupt lock was treated as a lock without a floor');
  assert.ok(err.includes(path), `the refusal does not name the file:\n${err}`);
});

test('NO node at all is refused whether or not the pin states a floor — it is the cron case', () => {
  // ⚠️ The PATH here holds nothing, so `jq` is not reachable either. That is the real cron environment, and
  // it is why this refusal is decided BEFORE the lock is read: a box with no node cannot be born no matter
  // what the pin says, and the operator must be told about the PATH rather than about a JSON tool.
  const empty = mkdtempSync(join(tmpdir(), 'forge-node-floor-empty-'));
  for (const lock of [fakeLock({ minMajor: 24, engines: '>=24' }), fakeLock(undefined)]) {
    const { code, err } = runCheck(empty, lock);
    assert.equal(code, 1, 'a box with no node on PATH was allowed to start');
    assert.ok(/PATH/.test(err), `the refusal does not mention the PATH it searched:\n${err}`);
    assert.ok(!/jq/.test(err), `the operator is told about jq when the problem is that there is no node:\n${err}`);
  }
});

// ── 3 · ONE TRUTH: the number is typed NOWHERE in this repository ────────────────────────────────────────

test('★★ no tracked file states a node floor of its own', () => {
  const tracked = execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).trim().split('\n');
  const owners = tracked.filter((f) => {
    let src;
    try {
      src = read(f);
    } catch {
      return false;
    }
    return /FORGE_DEMO_NODE_MIN_MAJOR\s*=/.test(src);
  });
  assert.deepEqual(owners, [], 'the floor is declared in this repository again — that is the second truth');
});

test('no script here compares a node version against a literal of its own', () => {
  const offenders = [];
  for (const name of readdirSync(HERE)) {
    if (!name.endsWith('.sh')) continue;
    const src = readFileSync(join(HERE, name), 'utf8');
    // A digit next to a node-version comparison is the shape that rots: `-lt 24`, `>=24`, `node@24`, `v24.`.
    for (const [i, line] of src.split('\n').entries()) {
      if (/^\s*(#|\/\/)/.test(line)) continue;
      if (/(-lt|-ge|-gt|-le|>=|<)\s*['"]?2[0-9]\b/.test(line) || /\bnode[@ ]v?2[0-9]\b/i.test(line)) {
        offenders.push(`bin/${name}:${i + 1}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `a copy of the floor lives here:\n${offenders.join('\n')}`);
});

test('the README points at the pin instead of restating the number', () => {
  const readme = read('README.md');
  assert.ok(readme.includes('bin/require-node.sh'), 'the README never names the file that reads the floor');
  assert.ok(readme.includes('forge.lock'), 'the README never names where the floor comes from');
  const restated = readme
    .split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\bnode\b[^\n]{0,24}\b(>=\s*)?2[0-9]\b/i.test(l));
  assert.deepEqual(
    restated.map(([i, l]) => `README.md:${i}: ${l.trim()}`),
    [],
    'the README spells the floor out — it would age in silence the day the product raises it',
  );
});

test('★★ THIS repo — `forge.lock` states the host node floor, and it states it as a whole number', () => {
  // A lock WITHOUT the floor is valid (see section 2) — but this box's lock is written by
  // `bin/build-local.sh` against a monorepo that declares one, so an absent floor here means the stamp was
  // lost, and this bench would go back to being born on whatever node the shell happened to resolve.
  const floor = pinnedFloor();
  assert.equal(typeof floor, 'number', 'forge.lock states no node.minMajor — re-run bin/build-local.sh');
  assert.ok(Number.isInteger(floor) && floor > 0, `node.minMajor is not a whole major version: ${floor}`);
  const range = JSON.parse(read('forge.lock')).node?.engines;
  assert.equal(
    range,
    `>=${floor}`,
    'node.engines is the EVIDENCE the integer was resolved from, and it does not agree with it',
  );
});

// ── 4 · WIRING: the check runs FIRST, it runs everywhere node does, and the floor is STAMPED ─────────────

test('box-up.sh checks the floor before it reads, starts or writes ANYTHING', () => {
  const src = read('bin/box-up.sh');
  const at = src.indexOf('\nrequire_node ||');
  assert.ok(at > 0, 'box-up.sh never calls require_node');
  const sourced = src.indexOf('bin/require-node.sh');
  assert.ok(sourced > 0 && sourced < at, 'box-up.sh calls require_node without sourcing the file first');
  // Everything this box does to the machine, and the first line of it must come AFTER the refusal.
  const sideEffects = [
    "command -v jq >/dev/null || die 'jq is required.'", // the first preflight it used to open with
    '. "$HERE/env-source.sh"', // reading the operator's environment
    'TENANTS="$(jq', // reading the topology
    'dc up', // the first container
    'mktemp', // the first file this script creates
  ];
  for (const marker of sideEffects) {
    const i = src.indexOf(marker);
    assert.ok(i > 0, `the marker "${marker}" is gone — this guard is measuring an order that changed`);
    assert.ok(i > at, `box-up.sh does "${marker}" BEFORE it checks the host's node`);
  }
});

/**
 * Every `bin/*.sh` that starts node/npm/npx/pnpm ON THIS MACHINE. Derived, never listed: a script added
 * later that runs node is caught the first time this guard runs, which is the half a hand-written list
 * cannot do. Continuation lines are joined first, so a `dc run … \\\n kernel node dist/x.js` reads as the
 * one container command it is.
 */
function hostNodeRunners() {
  const runners = new Map();
  for (const name of readdirSync(HERE)) {
    if (!name.endsWith('.sh') || name === 'require-node.sh') continue;
    const joined = readFileSync(join(HERE, name), 'utf8').replace(/\\\n\s*/g, ' ');
    for (const [i, raw] of joined.split('\n').entries()) {
      if (/^\s*#/.test(raw)) continue;
      const line = raw.replace(/\s#\s.*$/, '');
      if (/\b(dc|docker)\s+(run|exec|compose)\b/.test(line)) continue;
      if (/(^|[;&|(]|\bthen|\bdo)\s*(\w+=(?:"[^"]*"|\S)*\s+)*(host_node|node|npm|npx|pnpm)\s/.test(line)) {
        if (!runners.has(name)) runners.set(name, `bin/${name}:${i + 1}: ${line.trim()}`);
      }
    }
  }
  return runners;
}

test('every script here that starts node on the HOST refuses an old one first', () => {
  const runners = hostNodeRunners();
  assert.ok(runners.size >= 5, `only ${runners.size} host-node scripts found — the scan stopped seeing them`);
  const unguarded = [];
  for (const [name, where] of runners) {
    const src = readFileSync(join(HERE, name), 'utf8');
    const sourced = src.indexOf('require-node.sh');
    const called = src.search(/^require_node \|\|/m);
    if (sourced < 0 || called < 0 || sourced > called) unguarded.push(where);
  }
  assert.deepEqual(unguarded, [], `these start node on the host without checking it:\n${unguarded.join('\n')}`);
});

test('★★ build-local.sh STAMPS the floor into the lock, derived from the product it is handed', () => {
  // The one script here that is handed the monorepo, so the one place that can put the release's own floor
  // into the pin. It must not re-derive it: `infra/cicd/node-floor.sh` is the product's single derivation,
  // and a second `sed` over `engines.node` living here would be the drift this change removed.
  const src = read('bin/build-local.sh');
  assert.ok(
    src.includes('infra/cicd/node-floor.sh'),
    "build-local.sh does not source the product's node-floor derivation",
  );
  assert.ok(src.includes('forge_node_engines'), 'build-local.sh never asks the product for its engines range');
  assert.ok(src.includes('forge_node_min_major'), 'build-local.sh never resolves the range to a major');
  assert.match(
    src,
    /node:\s*\{\s*minMajor:/,
    'the lock template build-local.sh writes has no `node` block — the floor would not travel with the pin',
  );
  const drift = [...src.matchAll(/^(?!\s*#).*engines\.node.*$/gm)].filter((m) => /sed|=~|\bcut\b/.test(m[0]));
  assert.deepEqual(drift, [], `build-local.sh derives the floor a second time:\n${drift.join('\n')}`);
});

// ── 5 · the refusal a human will actually read ──────────────────────────────────────────────────────────

test('the refusal tells the operator what to DO, not only what is wrong', () => {
  const floor = 28;
  const dir = fakeNodeDir(`v${floor - 2}.0.0`);
  const { err } = runCheck(withJq(dir), fakeLock({ minMajor: floor, engines: `>=${floor}` }));
  assert.match(err, /nvm/i, 'the refusal names no way out — on this bench the right node is only under nvm');
  assert.match(
    err,
    /nothing (has been|was) (read|written|started)/i,
    'the refusal does not say the box is untouched, which is the first thing an operator wants to know',
  );
});

test('★★ NO `jq` IS A REFUSAL ABOUT JQ — it must never send the operator to look at node', () => {
  // C6 (04/09), measured on a machine without jq: the box refused under a `[node]` tag while the paragraph
  // was about a JSON tool, and an operator reads the tag before the paragraph. `box-up.sh` carries its own
  // `command -v jq || die 'jq is required.'` and NEVER reaches it, because the node floor is graded first on
  // purpose (see the header of require-node.sh, and `box-up.sh checks the floor before anything` above).
  //
  // ★ SO THE REPAIR IS THE SENTENCE AND NOT THE ORDER, and the cron test above is why: with an empty PATH
  // there is neither node nor jq, and that case must keep answering about the PATH. Two refusals, two
  // subjects; this one is the second.
  const version = 'v99.0.0'; // far ABOVE any floor a release has declared: nothing is wrong with this node
  const dir = fakeNodeDir(version);
  // ⚠️ PATH is the fixture ALONE — no /usr/bin, so `jq` is genuinely unreachable. This is the whole
  // difference from `withJq(dir)`, which every other test in this file uses.
  const { code, err } = runCheck(dir, fakeLock({ minMajor: 24, engines: '>=24' }));

  assert.equal(code, 1, `a box that cannot read its own pin was allowed to start:\n${err}`);
  assert.ok(/jq/.test(err), `the refusal never names the tool that is missing:\n${err}`);
  assert.ok(
    !/\[node\]/.test(err),
    `the refusal wears the [node] tag while the missing thing is jq — that is the defect:\n${err}`,
  );
  // The node it found, said out loud and called fine: without it the operator has no way to tell that the
  // thing named in the tag is not the thing to fix.
  assert.ok(err.includes(version), `the refusal does not name the node it found:\n${err}`);
  assert.ok(err.includes(join(dir, 'node')), `the refusal does not name WHERE that node came from:\n${err}`);
  assert.ok(
    /apt install jq|brew install jq/.test(err),
    `the refusal names no way out — the one thing an operator can act on:\n${err}`,
  );
  assert.ok(
    !/nvm|older than|node major >=/.test(err),
    `the refusal reads like a node-version problem, which is exactly the wrong errand:\n${err}`,
  );
  assert.match(
    err,
    /nothing (has been|was) (read|written|started)/i,
    `the refusal does not say the box is untouched:\n${err}`,
  );
});

test('the guard fixture is a real directory, not a name — a fake node that never ran would prove nothing', () => {
  const dir = fakeNodeDir('v99.0.0');
  mkdirSync(dir, { recursive: true });
  const answer = execFileSync(join(dir, 'node'), ['-v'], { encoding: 'utf8' }).trim();
  assert.equal(answer, 'v99.0.0');
});
