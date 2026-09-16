// ★★★ THE DEPLOY REFUSES A LOCK WHOSE PROVENANCE DOES NOT MATCH THIS BOX'S COMPOSITION — and it refuses
// BEFORE it touches the host.
//
// ── WHAT IS BEING GRADED, AND WHY IT IS NOT THE FENCE ───────────────────────────────────────────────────────
//
// The comparison itself belongs to the PRODUCT (`forge-lock-provenance`, INFRA-EXEMPLAR decision 9: «a guard
// in the instance repository would only protect whoever writes guards»), and it has its own sabotage over
// there. What is graded HERE is the only half this repository owns: that `bin/deploy.sh` asks the question at
// all, that it asks it FIRST, and that a refusal stops the deploy rather than being printed and stepped over.
//
// ⚠️ "FIRST" IS THE WHOLE POINT AND IT IS WHY THE ASSERTION IS ABOUT WHAT DID **NOT** HAPPEN. A deploy that
// asked after the images were on the host, or after the compose files were written, would leave that host in a
// state nobody chose: half of one version, half of another, and a lock on disk that the box has already been
// told to believe. So every scenario below runs against a host address that CANNOT answer, and the pass
// condition includes the absence of the line `bin/deploy.sh` prints when it reaches the host.
//
// ── ⟂ THE CONTROL THAT KEEPS THIS FROM BEING VACUOUS ────────────────────────────────────────────────────────
//
// A test that only proves "red lock ⇒ exit 1" would also pass if `bin/deploy.sh` refused every lock, which is
// a script nobody can deploy with. So the SAME tree, with the same apps, pinned the way the demo really pins
// it today, has to get PAST the fence and die at the host instead. Both halves, or neither means anything.
//
// ── HOW THE TREE IS BUILT ───────────────────────────────────────────────────────────────────────────────────
//
// A scratch instance, not this one: `composition.json` + the three app manifests + `forge.lock` + the two
// `deploy/` files + the two scripts `bin/deploy.sh` sources. Copying the real repository would make the
// scenario depend on the state of a bench, and a guard that reads the bench grades the bench.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The fence itself lives in the product. Where this machine has it is the same question `bin/deploy.sh`
 *  answers, asked the same way — see its §1. A machine with none cannot grade this, and says so. */
function fenceOnThisMachine() {
  for (const p of [
    process.env.FORGE_PROVENANCE_BIN,
    join(ROOT, 'storefront-coffee/node_modules/.bin/forge-lock-provenance'),
    join(ROOT, 'totem/node_modules/.bin/forge-lock-provenance'),
    join(ROOT, 'node_modules/.bin/forge-lock-provenance'),
  ]) {
    if (!p) continue;
    try {
      execFileSync('test', ['-e', p]);
      return p;
    } catch {
      /* next */
    }
  }
  return null;
}

const FENCE = fenceOnThisMachine();

/** An app manifest of THIS box: `forge.origin: "instance"` is the axis the fence counts on (no Forge release
 *  ever baked such an app), and `surface` decides which builds have to compile it. */
const instanceApp = (blocks) => ({
  name: '@forge/ext-probe',
  version: '0.0.0',
  private: true,
  type: 'module',
  forge: { origin: 'instance', wiring: { blocks } },
  // ⚠️ `./manifest` IS PART OF THE SHAPE AND ITS ABSENCE REFUSES THE WHOLE RUN — measured while writing this
  // file: without it the fence exits 1 saying «@forge/ext-probe has no "./manifest" export», which made the
  // sabotage below pass for the WRONG REASON. The two controls are what caught it, which is the only thing
  // that makes them worth their lines. Every app of this box declares it (apps/*/package.json).
  exports: Object.fromEntries([
    ['./manifest', './manifest.ts'],
    ...Object.values(blocks).map((b) => [b.module, `${b.module}.tsx`]),
  ]),
});

const lock = (adminOrigin) => ({
  forgeVersion: 'v0.0.0-probe',
  node: { minMajor: 24, engines: '>=24' },
  composition: { id: 'probe', apps: ['probe'] },
  images: {
    kernel: { ref: 'probe-kernel@sha256:' + 'a'.repeat(64), origin: 'own build' },
    storefront: { ref: 'probe-storefront@sha256:' + 'b'.repeat(64), origin: 'own build' },
    checkout: { ref: 'probe-checkout@sha256:' + 'c'.repeat(64), origin: 'own build' },
    admin: { ref: 'reg.example/probe-admin@sha256:' + 'd'.repeat(64), origin: adminOrigin },
  },
});

/** A whole scratch instance in a temp dir, and the deploy driver pointed at a host that cannot answer. */
function scratch({ adminOrigin, blocks }) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-deploy-guard-'));
  mkdirSync(join(dir, 'bin'), { recursive: true });
  mkdirSync(join(dir, 'deploy'), { recursive: true });
  mkdirSync(join(dir, 'apps/probe'), { recursive: true });

  cpSync(join(ROOT, 'bin/deploy.sh'), join(dir, 'bin/deploy.sh'));
  cpSync(join(ROOT, 'bin/images-from-lock.sh'), join(dir, 'bin/images-from-lock.sh'));
  // ⚠️ AND THE NODE FLOOR, because `bin/deploy.sh` reads it before it starts the fence — the scratch tree has
  // to carry every piece the driver sources or the scenario measures a missing file instead of a provenance.
  cpSync(join(ROOT, 'bin/require-node.sh'), join(dir, 'bin/require-node.sh'));
  // ★ AND THE VEHICLE, since pk43/d2: the environment loader, the ssh command and `remote_compose` moved out
  // of this script into `bin/remote-box.sh` so that the birth and the deploy cannot hold two opinions about
  // where the box is. A scratch tree without it measures a missing file instead of a provenance.
  cpSync(join(ROOT, 'bin/remote-box.sh'), join(dir, 'bin/remote-box.sh'));

  writeFileSync(
    join(dir, 'composition.json'),
    JSON.stringify(
      { version: 1, apps: [], instanceApps: [{ id: 'probe', package: '@forge/ext-probe', source: './apps/probe' }] },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, 'apps/probe/package.json'), JSON.stringify(instanceApp(blocks), null, 2));
  writeFileSync(join(dir, 'forge.lock'), JSON.stringify(lock(adminOrigin), null, 2));

  writeFileSync(join(dir, 'deploy/box.env'), 'FORGE_ADMIN_TENANT=\n');
  // ⚠️ 240.0.0.1 is reserved and unroutable, so the ssh in step 3 fails without waiting on a name server or
  // a firewall's silence. If the fence ever stopped stopping things, this is what the run would reach.
  writeFileSync(
    join(dir, 'deploy/probe.env'),
    [
      'FORGE_DEPLOY_HOST=240.0.0.1',
      'FORGE_DEPLOY_USER=nobody',
      'FORGE_DEPLOY_DIR=/opt/forge-probe',
      'FORGE_DOMAIN=probe.invalid',
      'FORGE_ADMIN_DOMAIN=admin.probe.invalid',
      'FORGE_PUBLIC_ORIGIN=https://probe.invalid',
      // A guard that waits 20 s per scenario for an address that cannot answer is a guard people stop running.
      'FORGE_DEPLOY_SSH_TIMEOUT=2',
      '',
    ].join('\n'),
  );
  return dir;
}

function runDeploy(dir) {
  try {
    const out = execFileSync('bash', [join(dir, 'bin/deploy.sh'), 'probe'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORGE_PROVENANCE_BIN: FENCE ?? '' },
      timeout: 120_000,
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

// The line `bin/deploy.sh` prints when it starts asking the HOST anything. Its ABSENCE is the assertion.
const REACHED_THE_HOST = '3 · the host';

test('★ SABOTAGE — an app of this box that draws in the ADMIN, with the admin pinned as `release`, stops the deploy and names the admin', { skip: FENCE ? false : 'the product fence is not on this machine (see FORGE_PROVENANCE_BIN)' }, () => {
  const dir = scratch({
    adminOrigin: 'release',
    blocks: { probe_panel: { surface: 'admin', module: './block/panel', export: 'Panel' } },
  });
  try {
    const { code, out } = runDeploy(dir);
    assert.equal(code, 1, 'a deploy whose lock cannot carry this box’s apps must exit non-zero');
    assert.match(out, /admin/, 'the refusal has to NAME the surface to move — a refusal without a name is a puzzle');
    assert.ok(
      !out.includes(REACHED_THE_HOST),
      'the refusal came AFTER the deploy started asking the host. Everything about this guard is that it comes first:\n' + out,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('⟂ CONTROL — the same tree with the admin baked in this box’s own oven gets PAST the fence', { skip: FENCE ? false : 'the product fence is not on this machine (see FORGE_PROVENANCE_BIN)' }, () => {
  const dir = scratch({
    adminOrigin: 'own build',
    blocks: { probe_panel: { surface: 'admin', module: './block/panel', export: 'Panel' } },
  });
  try {
    const { code, out } = runDeploy(dir);
    // It still fails — the host is unroutable — but it fails LATER, and where it fails is the whole answer.
    assert.equal(code, 1);
    assert.ok(
      out.includes(REACHED_THE_HOST),
      'the fence refused a lock it had no reason to refuse. A deploy driver that refuses everything is not a\n' +
        'guard, it is a wall — and the sabotage above would pass against it:\n' +
        out,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('⟂ CONTROL — an app that draws only in the STOREFRONT does not care that the admin is pinned as `release`', { skip: FENCE ? false : 'the product fence is not on this machine (see FORGE_PROVENANCE_BIN)' }, () => {
  // This is the shape of the demo itself, and of a vanilla customer who pulls the admin and installs an app
  // with no admin screen. If it went red, every such box would be told to bake an image for nothing.
  const dir = scratch({
    adminOrigin: 'release',
    blocks: { probe_shelf: { surface: 'storefront', module: './block/shelf', export: 'Shelf' } },
  });
  try {
    const { code, out } = runDeploy(dir);
    assert.equal(code, 1);
    assert.ok(out.includes(REACHED_THE_HOST), 'a pulled admin with zero admin blocks must stay legal:\n' + out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the deploy asks the fence before it asks anything else — the ORDER, read off the script itself', () => {
  const src = execFileSync('cat', [join(ROOT, 'bin/deploy.sh')], { encoding: 'utf8' });
  const fenceAt = src.indexOf('--root "$HERE" --lock "$HERE/forge.lock"');
  const firstSsh = src.indexOf('"${SSH[@]}"');
  assert.ok(fenceAt > 0, 'bin/deploy.sh no longer invokes the provenance fence at all');
  assert.ok(firstSsh > 0, 'bin/deploy.sh no longer talks to a host — has this file moved?');
  assert.ok(
    fenceAt < firstSsh,
    'the first use of ssh in bin/deploy.sh comes BEFORE the fence. The scenarios above would still pass ' +
      '(they assert on output), but a deploy that reached the host first has already changed something there.',
  );
});

test('the fence has no off switch', () => {
  const src = execFileSync('cat', [join(ROOT, 'bin/deploy.sh')], { encoding: 'utf8' });
  // A flag, an env var, anything that lets the question be skipped. The refusal when the binary is ABSENT is
  // the one legal exit, and it is a refusal.
  assert.doesNotMatch(
    src.replace(/^#.*$/gm, ''),
    /--(no-fence|skip-fence)|FORGE_SKIP_PROVENANCE|SKIP_FENCE/,
    'bin/deploy.sh grew a way to skip the provenance fence. A guard with a switch is off on the day it matters.',
  );
});

// ── ★★ THE LOCK'S TWO FORMS, READ BY THE PIECE THIS BOX ACTUALLY RUNS ──────────────────────────────────────
//
// ⛔ THIS WAS RED, AND IT WAS FOUND BY THE CONTROLS ABOVE RATHER THAN BY THIS TEST. `bin/images-from-lock.sh`
// is a COPY of the model's file (`templates/instance/bin/images-from-lock.sh`), and the model learned the
// object form in the product slice that gave an image its provenance while this copy did not. Measured
// 2026-09-16, with an object entry and the reader as it stood:
//
//     [forge-lock] the kernel image's digest is malformed: 'sha256:aaaa…", "origin": "own build" }'
//
// ⇒ the day this instance pins ONE image from a release and bakes the rest — which is the whole of decision 9
// — the box stops booting, on a message that says nothing about provenance. The forms are graded here because
// this repository is where the copy lives; the product grades its own.

import { readFileSync } from 'node:fs';

function readerOn(images) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-lock-forms-'));
  mkdirSync(join(dir, 'bin'), { recursive: true });
  cpSync(join(ROOT, 'bin/images-from-lock.sh'), join(dir, 'bin/images-from-lock.sh'));
  // ⚠️ AND THE NODE FLOOR, because `bin/deploy.sh` reads it before it starts the fence — the scratch tree has
  // to carry every piece the driver sources or the scenario measures a missing file instead of a provenance.
  cpSync(join(ROOT, 'bin/require-node.sh'), join(dir, 'bin/require-node.sh'));
  writeFileSync(
    join(dir, 'forge.lock'),
    JSON.stringify({ forgeVersion: 'v0-probe', composition: { id: 'probe', apps: ['probe'] }, images }, null, 2),
  );
  try {
    const out = execFileSync(
      'bash',
      ['-c', `set -u; . '${dir}/bin/images-from-lock.sh' || exit 1; printf '%s\n%s\n' "$FORGE_IMAGE" "$FORGE_ADMIN_IMAGE"`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const D = (c) => `sha256:${c.repeat(64)}`;

test('bin/images-from-lock.sh reads BOTH forms in one lock — a bare ref beside an object with a provenance', () => {
  const { code, out } = readerOn({
    kernel: { ref: `own-kernel@${D('a')}`, origin: 'own build' },
    storefront: { ref: `own-storefront@${D('b')}`, origin: 'own build' },
    checkout: { ref: `own-checkout@${D('c')}`, origin: 'own build' },
    admin: `reg.example/forge-admin@${D('d')}`,
  });
  assert.equal(code, 0, `the reader refused a lock in the shape decision 9 requires:\n${out}`);
  assert.match(out, new RegExp(`own-kernel@${D('a')}`), 'the object form did not yield its ref');
  assert.match(out, new RegExp(`reg\\.example/forge-admin@${D('d')}`), 'the bare form stopped working');
});

test('⟂ CONTROL — the object form does NOT buy a tag a way past the pin', () => {
  // The leniency added above is about the SHAPE of an entry and nothing else. If it had been written as
  // "an object is trusted", this is the lock that would boot: a label its owner can repoint, under a box.
  const { code, out } = readerOn({
    kernel: { ref: 'own-kernel:latest', origin: 'own build' },
    storefront: { ref: `own-storefront@${D('b')}`, origin: 'own build' },
    checkout: { ref: `own-checkout@${D('c')}`, origin: 'own build' },
    admin: `reg.example/forge-admin@${D('d')}`,
  });
  assert.notEqual(code, 0, 'a tag inside an object entry was accepted as a pin');
  assert.match(out, /pinned by TAG/, `the refusal should still be the tag one:\n${out}`);
});

test('⟂ CONTROL — an entry that is an object with no `ref` is a missing pin, not an empty one', () => {
  const { code, out } = readerOn({
    kernel: { origin: 'own build' },
    storefront: { ref: `own-storefront@${D('b')}`, origin: 'own build' },
    checkout: { ref: `own-checkout@${D('c')}`, origin: 'own build' },
    admin: `reg.example/forge-admin@${D('d')}`,
  });
  assert.notEqual(code, 0);
  assert.match(out, /does not pin the kernel image/, `\n${out}`);
});
