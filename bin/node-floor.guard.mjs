// ★★ THE HOST'S NODE IS CHECKED BEFORE ANYTHING HAPPENS, AND THE NUMBER IS WRITTEN ONCE.
//
// F13 of the from-zero install rehearsal (04/09). Two `node` binaries live on that machine and the
// interactive PATH resolves to the smaller one:
//
//     the shell resolves   ->  ~/.local/bin/node                        v22.22.3
//     nvm holds            ->  ~/.nvm/versions/node/v24.18.0/bin/node   v24.18.0  (+ pnpm 11.5.0)
//     the product declares ->  the monorepo's package.json: "node": ">=24"
//
// Every birth of that night ran on v22 — under the floor the product declares — and every one of them
// WORKED. That is what makes it worth a guard: `it ran` is not `it is supported`, and nothing on the box
// could tell the two apart. The seeders (`bin/seed-box.mjs`, `bin/seed.mjs`, `bin/verify-seed.mjs`) run on
// the HOST, not in a container, so the host's node is the one that decides.
//
// This guard holds two promises, and the second is the one that ages badly if nobody watches it:
//
//   1. BEHAVIOUR — a node under the floor is refused, naming the version it found, the path it came from
//      and the floor; a node at or over the floor is let through in silence. Proven by RUNNING the check
//      against fake `node` binaries in both directions, not by reading its source.
//   2. ONE TRUTH — the number is typed in exactly one file, every script that starts node on the host
//      goes through that file, and the prose does not restate the digit. `bin/require-node.sh` says at
//      length why the demo cannot DERIVE it from the product today; a second copy here would be the very
//      disease that file's header describes.
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

/** The floor, read from the one file that states it — never typed again in this guard. */
function declaredFloor() {
  const src = readFileSync(REQUIRE_SH, 'utf8');
  const hits = [...src.matchAll(/^FORGE_DEMO_NODE_MIN_MAJOR=(\d+)$/gm)];
  assert.equal(hits.length, 1, 'bin/require-node.sh must state the floor exactly once, unquoted');
  return Number(hits[0][1]);
}

/** A directory holding a fake `node` that answers `-v` with whatever we say. */
function fakeNodeDir(answer) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-node-floor-'));
  const bin = join(dir, 'node');
  writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' ${JSON.stringify(answer)}\n`);
  chmodSync(bin, 0o755);
  return dir;
}

/** Source the check and call it, with PATH under our control. Returns { code, err }. */
function runCheck(pathValue) {
  try {
    const out = execFileSync(
      '/bin/bash',
      ['-c', 'set -uo pipefail; . "$1"; require_node', '_', REQUIRE_SH],
      { env: { PATH: pathValue }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { code: 0, out, err: '' };
  } catch (e) {
    return { code: e.status ?? -1, out: e.stdout ?? '', err: e.stderr ?? '' };
  }
}

// ── 1 · BEHAVIOUR, proven by running it ─────────────────────────────────────────────────────────────────

test('a node UNDER the floor is refused, naming the version, the path it came from and the floor', () => {
  const floor = declaredFloor();
  const version = `v${floor - 2}.22.3`;
  const dir = fakeNodeDir(version);
  const { code, err } = runCheck(`${dir}:/usr/bin:/bin`);
  assert.equal(code, 1, `a node ${version} was let through — the floor is ${floor}`);
  assert.ok(err.includes(version), `the refusal does not name the version it found:\n${err}`);
  assert.ok(err.includes(join(dir, 'node')), `the refusal does not name WHERE that node came from:\n${err}`);
  assert.ok(err.includes(String(floor)), `the refusal does not name the floor it wants:\n${err}`);
});

test('a node AT the floor is let through, in silence', () => {
  const floor = declaredFloor();
  const dir = fakeNodeDir(`v${floor}.0.0`);
  const { code, err, out } = runCheck(`${dir}:/usr/bin:/bin`);
  assert.equal(code, 0, `a node exactly at the floor was refused:\n${err}`);
  assert.equal(`${out}${err}`.trim(), '', 'the check is noisy on the happy path');
});

test('a node OVER the floor is let through — the floor is a floor, not an equality', () => {
  const floor = declaredFloor();
  const dir = fakeNodeDir(`v${floor + 9}.1.0`);
  assert.equal(runCheck(`${dir}:/usr/bin:/bin`).code, 0);
});

test('a version this check cannot read is refused, not assumed to be fine', () => {
  const dir = fakeNodeDir('who knows');
  const { code, err } = runCheck(`${dir}:/usr/bin:/bin`);
  assert.equal(code, 1, 'an unreadable `node -v` was treated as good enough');
  assert.ok(err.includes('who knows'), `the refusal does not quote what node answered:\n${err}`);
});

test('NO node at all is refused, and the refusal is about a PATH — which is the cron case', () => {
  const empty = mkdtempSync(join(tmpdir(), 'forge-node-floor-empty-'));
  const { code, err } = runCheck(empty);
  assert.equal(code, 1, 'a box with no node on PATH was allowed to start');
  assert.ok(/PATH/.test(err), `the refusal does not mention the PATH it searched:\n${err}`);
});

// ── 2 · ONE TRUTH ───────────────────────────────────────────────────────────────────────────────────────

test('the floor is typed in exactly ONE tracked file', () => {
  const tracked = execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).trim().split('\n');
  const owners = tracked.filter((f) => {
    let src;
    try {
      src = read(f);
    } catch {
      return false;
    }
    return /^FORGE_DEMO_NODE_MIN_MAJOR=\d+$/m.test(src);
  });
  assert.deepEqual(owners, ['bin/require-node.sh'], 'the floor is stated somewhere else too — two truths');
});

test('no other script compares a node version against a literal of its own', () => {
  const offenders = [];
  for (const name of readdirSync(HERE)) {
    if (name === 'require-node.sh' || name === 'node-floor.guard.mjs') continue;
    const src = readFileSync(join(HERE, name), 'utf8');
    // A digit next to a node-version comparison is the shape that rots: `-lt 24`, `>=24`, `node@24`, `v24.`.
    for (const [i, line] of src.split('\n').entries()) {
      if (/^\s*(#|\/\/)/.test(line)) continue;
      if (/(-lt|-ge|-gt|-le|>=|<)\s*['"]?2[0-9]\b/.test(line) || /\bnode[@ ]v?2[0-9]\b/i.test(line)) {
        offenders.push(`bin/${name}:${i + 1}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `a second copy of the floor:\n${offenders.join('\n')}`);
});

test('the README points at the file instead of restating the number', () => {
  const readme = read('README.md');
  assert.ok(readme.includes('bin/require-node.sh'), 'the README never names the file that owns the floor');
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

// ── 3 · WIRING: the check runs FIRST, and it runs everywhere node does ───────────────────────────────────

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

test('build-local.sh reconciles the declared floor with the monorepo it is pointed at', () => {
  // The ONE moment this repository holds the product in its hands. If the floor here has drifted from the
  // `engines.node` over there, this is the only place that can notice — so it must.
  const src = read('bin/build-local.sh');
  assert.ok(
    src.includes('require-node.sh'),
    'build-local.sh does not source the file that owns the floor, so it cannot compare anything',
  );
  assert.match(
    src,
    /engines\.node[\s\S]{0,600}FORGE_DEMO_NODE_MIN_MAJOR/,
    "build-local.sh never reads the monorepo's engines.node and holds it against the declared floor",
  );
});

// ── 4 · the refusal a human will actually read ──────────────────────────────────────────────────────────

test('the refusal tells the operator what to DO, not only what is wrong', () => {
  const floor = declaredFloor();
  const dir = fakeNodeDir(`v${floor - 2}.0.0`);
  const { err } = runCheck(`${dir}:/usr/bin:/bin`);
  assert.match(err, /nvm/i, 'the refusal names no way out — on this bench the right node is only under nvm');
  assert.match(
    err,
    /nothing (has been|was) (read|written|started)/i,
    'the refusal does not say the box is untouched, which is the first thing an operator wants to know',
  );
});

test('the guard fixture is a real directory, not a name — a fake node that never ran would prove nothing', () => {
  const dir = fakeNodeDir('v99.0.0');
  mkdirSync(dir, { recursive: true });
  const answer = execFileSync(join(dir, 'node'), ['-v'], { encoding: 'utf8' }).trim();
  assert.equal(answer, 'v99.0.0');
});
