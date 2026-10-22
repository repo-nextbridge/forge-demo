// ★★★ KP-D2 (2026-10-22, Forge v0.3.4) — THIS BOX'S APPS REACH THE RELEASE'S KERNEL MOUNTED, AND EVERY LINK OF
// THAT CHAIN IS GRADED HERE.
//
//   node --test bin/mounted-apps.guard.mjs        (or: bash bin/test.sh)
//
// v0.3.4 lets an app of `instanceApps` reach a PULLED kernel as a packed directory: composition.json declares it
// `"kernel": "mounted"`, `bin/pack-apps.sh` packs it into `extensions/<id>` (committed), `bin/bake.sh` stops
// baking the kernel and writes `composition.mounted` into the lock, and the box mounts `extensions/` at
// FORGE_EXTENSIONS_DIR. Five things can be wrong, and each one is a box that comes up and lies:
//
//   1 · the list stops saying `mounted` for an app (the bake would pull a kernel that never heard of it) —
//       refused by the bake, NAMING the app (the marked block of bin/bake.sh, run here over fabricated lists);
//   2 · `extensions/<id>` is OLDER than `apps/<id>` (the fronts baked from the new source, the kernel serving the
//       old manifest) — refused by the PRODUCT's fence (`forge-lock-provenance` 0.3.4, `forge.sourceDigest`),
//       run here over a copy of this repository with one byte of an app changed;
//   3 · the lock carries no `composition.mounted` — refused by `lock_gate_mounted` (bin/lock-gate.sh, before the
//       deploy touches anything) and, on the box, by the release's `bin/verify-composition.sh` (MISSING);
//   4 · the bake writes a lock without the key — graded by TEXT, comments stripped;
//   5 · a delivery that changes `extensions/` and leaves the running kernel on the old code — the real
//       bin/deploy.sh against a FAKE host must recreate the kernel when, and only when, the mount changed.
//
// The fence's GREEN on this repository with the lock the bake writes is bin/bake-pulls-admin.guard.mjs's; the
// mount's own shape (no composed app on it, every mounted app on it) is bin/composed-apps-not-mounted.guard.mjs.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BAKE = readFileSync(join(ROOT, 'bin', 'bake.sh'), 'utf8');
const COMPOSITION = JSON.parse(readFileSync(join(ROOT, 'composition.json'), 'utf8'));
const FENCE = join(ROOT, 'node_modules', '.bin', 'forge-lock-provenance');
const NO_TOOLS = existsSync(FENCE) ? false : 'NOT CHECKED — the release’s tools are not installed: `npm ci` at the root';
const PIN = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies['@forgeco/cli'];
const RELEASE = `v${PIN}`;
const D = (c) => `sha256:${c.repeat(64)}`;
const AR = 'southamerica-east1-docker.pkg.dev/probe/forge-kernel';
const MOUNTED = COMPOSITION.instanceApps.filter((a) => a.kernel === 'mounted').map((a) => a.id);
const codeOf = (shell) => shell.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

/** The lock the bake writes (its shape), over this repository's list: release kernel, the mount declared. */
function bakedLock(over = {}) {
  return {
    forgeVersion: RELEASE,
    node: { minMajor: 24, engines: '>=24' },
    composition: {
      id: 'demo-instance',
      apps: [...COMPOSITION.instanceApps.map((a) => a.id), ...COMPOSITION.apps.map((a) => a.id)],
      mounted: MOUNTED,
    },
    images: {
      kernel: { ref: `${AR}/forge-kernel@${D('a')}`, origin: 'release' },
      storefront: { ref: `ghcr.io/probe/forge-demo-storefront@${D('b')}`, origin: 'own build', built_from: RELEASE },
      checkout: { ref: `ghcr.io/probe/forge-demo-checkout@${D('c')}`, origin: 'own build', built_from: RELEASE },
      admin: { ref: `${AR}/forge-admin@${D('d')}`, origin: 'release' },
      'storefront-coffee': { ref: `ghcr.io/probe/forge-demo-storefront-coffee@${D('e')}`, origin: 'own build', built_from: RELEASE },
      totem: { ref: `ghcr.io/probe/forge-demo-totem@${D('f')}`, origin: 'own build', built_from: RELEASE },
    },
    extensions: [],
    ...over,
  };
}

// ── 1 · THE BAKE'S MOUNTED BLOCK, RUN OVER FABRICATED LISTS ─────────────────────────────────────────────────
function mountedBlock() {
  const m = BAKE.match(/# >>> THE APPS THE PULLED KERNEL RECEIVES MOUNTED\n([\s\S]*?)# <<< THE APPS THE PULLED KERNEL RECEIVES MOUNTED/);
  assert.ok(m, 'bin/bake.sh no longer marks THE APPS THE PULLED KERNEL RECEIVES MOUNTED — this guard cannot run it');
  return m[1];
}

/** Run the block in a scratch `here` holding `composition` and the packed manifests named by `packed`. */
function runMountedBlock({ composition = COMPOSITION, packed = MOUNTED, releaseApps = COMPOSITION.apps.map((a) => a.id) } = {}) {
  const here = mkdtempSync(join(tmpdir(), 'forge-bake-mounted-'));
  try {
    writeFileSync(join(here, 'composition.json'), JSON.stringify(composition));
    for (const id of packed) {
      mkdirSync(join(here, 'extensions', id), { recursive: true });
      writeFileSync(join(here, 'extensions', id, 'forge-extension.json'), JSON.stringify({ id }));
    }
    writeFileSync(join(here, 'release.lock'), JSON.stringify({ forgeVersion: RELEASE, composition: { id: 'base', apps: releaseApps } }));
    writeFileSync(
      join(here, 'block.sh'),
      `set -euo pipefail\nhere=${JSON.stringify(here)}\nrelease=${RELEASE}\nrelease_lock="$here/release.lock"\n` +
        `die() { printf '[bake] ⛔ %s\\n' "$*" >&2; exit 1; }\n${mountedBlock()}\nprintf 'MOUNTED %s\\n' "$mounted_json"\n`,
    );
    return run('bash', [join(here, 'block.sh')]);
  } finally {
    rmSync(here, { recursive: true, force: true });
  }
}

const withoutMounted = (id) => ({
  ...COMPOSITION,
  instanceApps: COMPOSITION.instanceApps.map(({ kernel, ...rest }) => (rest.id === id ? rest : { ...rest, kernel })),
});

test('★★ the bake reads the mount FROM THE LIST — both apps of this box, nothing typed', () => {
  assert.deepEqual(MOUNTED, ['demo-setup', 'payment-pos'], `composition.json declares mounted: ${MOUNTED.join(', ') || 'nothing'}`);
  const r = runMountedBlock();
  assert.equal(r.code, 0, r.out);
  assert.equal(r.out.trim(), `MOUNTED ${JSON.stringify(MOUNTED)}`);
});

test('⛔ SABOTAGE — an app that stops saying `"kernel": "mounted"` is refused BY NAME before anything is baked', () => {
  for (const id of MOUNTED) {
    const r = runMountedBlock({ composition: withoutMounted(id) });
    assert.equal(r.code, 1, `the bake accepted ${id} composed into a pulled kernel:\n${r.out}`);
    assert.match(r.out, new RegExp(`declares ${id} as COMPOSED into the kernel`));
  }
});

test('⟂ an app declared mounted with no packed artifact is refused by name — `bash bin/pack-apps.sh`', () => {
  const r = runMountedBlock({ packed: MOUNTED.slice(1) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, new RegExp(`"${MOUNTED[0]}" mounted, and extensions/${MOUNTED[0]} holds no packed manifest`));
});

test('⟂ a list whose `apps` is not the release’s, entry for entry, is refused (the pulled kernel composes the release’s)', () => {
  const r = runMountedBlock({ releaseApps: COMPOSITION.apps.map((a) => a.id).slice(1) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /are not the v[0-9.]+ release's list/);
});

// ── 4 · THE LOCK THE BAKE WRITES CARRIES THE MOUNT ──────────────────────────────────────────────────────────
test('★★ the CODE writes `composition.mounted` from the list into the lock', () => {
  const code = codeOf(BAKE);
  assert.match(code, /--argjson mounted "\$mounted_json"/, 'the lock is not handed the mounted list');
  assert.match(code, /composition: \{ id: \$id, apps: \$apps, mounted: \$mounted \}/, 'the lock’s composition has no `mounted`');
});

// ── 2 · THE PRODUCT'S FENCE: AN ARTIFACT OLDER THAN ITS SOURCE, OR ABSENT, IS RED ───────────────────────────
/** A copy of what the fence reads: the list, the apps' sources, the packed artifacts. */
function fenceTree() {
  const dir = mkdtempSync(join(tmpdir(), 'forge-mounted-fence-'));
  cpSync(join(ROOT, 'composition.json'), join(dir, 'composition.json'));
  for (const a of COMPOSITION.instanceApps) {
    cpSync(join(ROOT, a.source), join(dir, a.source), { recursive: true, filter: (src) => !src.includes('node_modules') });
  }
  cpSync(join(ROOT, 'extensions'), join(dir, 'extensions'), { recursive: true });
  writeFileSync(join(dir, 'forge.lock'), JSON.stringify(bakedLock(), null, 2));
  return dir;
}
const fence = (dir) => run(FENCE, ['--root', dir, '--lock', join(dir, 'forge.lock')]);

test('★ CONTROL — the copy the sabotages below start from is GREEN (the fence reads it as this repository)', { skip: NO_TOOLS }, () => {
  const dir = fenceTree();
  try {
    const r = fence(dir);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /mounted into the pulled kernel .*: demo-setup, payment-pos/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('⛔ SABOTAGE — an app edited and NOT repacked: the fence names it, OLDER than its source', { skip: NO_TOOLS }, () => {
  for (const a of COMPOSITION.instanceApps.filter((x) => x.kernel === 'mounted')) {
    const dir = fenceTree();
    try {
      appendFileSync(join(dir, a.source, 'manifest.ts'), '\n// one byte of new source, never packed\n');
      const r = fence(dir);
      assert.notEqual(r.code, 0, `the fence accepted a stale extensions/${a.id}:\n${r.out}`);
      assert.match(r.out, new RegExp(`extensions/${a.id} is OLDER than its source`));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('⟂ an app declared mounted and never packed: the fence names it', { skip: NO_TOOLS }, () => {
  const dir = fenceTree();
  try {
    rmSync(join(dir, 'extensions', 'payment-pos'), { recursive: true, force: true });
    const r = fence(dir);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /"payment-pos" is declared mounted and there is no artifact at extensions\/payment-pos/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('⟂ the mount beside a BAKED kernel (the lock of every bake before KP-D2): the fence refuses the duplicate', { skip: NO_TOOLS }, () => {
  const dir = fenceTree();
  try {
    const lock = bakedLock();
    lock.images.kernel = { ref: `ghcr.io/probe/forge-demo-kernel@${D('9')}`, origin: 'own build', built_from: RELEASE };
    writeFileSync(join(dir, 'forge.lock'), JSON.stringify(lock));
    const r = fence(dir);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /declared "kernel": "mounted", and forge\.lock pins the kernel as "own build"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 3 · A LOCK WITHOUT `composition.mounted` ─────────────────────────────────────────────────────────────────
const GATE = join(ROOT, 'bin', 'lock-gate.sh');
function gateMounted(lock, composition = COMPOSITION) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-gate-mounted-'));
  try {
    writeFileSync(join(dir, 'forge.lock'), JSON.stringify(lock));
    writeFileSync(join(dir, 'composition.json'), JSON.stringify(composition));
    return run('bash', ['-c', `. '${GATE}' && lock_gate_mounted "$1" "$2"`, 'gate', join(dir, 'forge.lock'), join(dir, 'composition.json')]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('★★ lock_gate_mounted: the lock the bake writes passes', () => {
  const r = gateMounted(bakedLock());
  assert.equal(r.code, 0, r.out);
});

test('⛔ SABOTAGE — a lock WITHOUT composition.mounted is refused, naming the apps the list mounts', () => {
  const lock = bakedLock();
  delete lock.composition.mounted;
  const r = gateMounted(lock);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /carries no composition\.mounted, and composition\.json declares demo-setup payment-pos "kernel": "mounted"/);
});

test('⟂ a lock that mounts a different set than the list declares is refused, naming both', () => {
  const lock = bakedLock();
  lock.composition.mounted = ['payment-pos'];
  const r = gateMounted(lock);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /mounts \[payment-pos\], and composition\.json declares \[demo-setup payment-pos\]/);
});

test('★ CONTROL — a list that mounts nothing and a lock without the key (every lock before v0.3.4) pass unchanged', () => {
  const lock = bakedLock();
  delete lock.composition.mounted;
  const r = gateMounted(lock, { ...COMPOSITION, instanceApps: COMPOSITION.instanceApps.map(({ kernel, ...rest }) => rest) });
  assert.equal(r.code, 0, r.out);
});

test('★★ bin/deploy.sh asks lock_gate_mounted before anything is sent; the CI asks it of the lock it bakes', () => {
  const deploy = codeOf(readFileSync(join(ROOT, 'bin', 'deploy.sh'), 'utf8'));
  const gate = deploy.search(/^lock_gate_mounted "\$HERE\/forge\.lock" "\$HERE\/composition\.json" \\\n\s*\|\| die /m);
  const fence = deploy.search(/^"\$\{fence_cmd\[@\]\}" --root/m);
  assert.ok(gate > -1, 'bin/deploy.sh does not refuse on lock_gate_mounted');
  assert.ok(fence > gate, 'lock_gate_mounted runs after the fence — it must come first, with the other lock gate');
  const yml = readFileSync(join(ROOT, '.github', 'workflows', 'bake.yml'), 'utf8');
  assert.match(yml, /lock_gate_mounted "\$RUNNER_TEMP\/forge\.lock" composition\.json/);
});

// ── 3b · ON THE BOX: THE RELEASE'S verify-composition.sh, OFFLINE ────────────────────────────────────────────
const VERIFY = join(ROOT, 'bin', 'verify-composition.sh');
function verify(lock, health = { status: 'ok', extensions: { mounted: MOUNTED.length, failed: [] } }) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-verify-mounted-'));
  try {
    writeFileSync(join(dir, 'forge.lock'), JSON.stringify(lock));
    // What the RELEASE's kernel declares (`/app/composition.json` of the v0.3.4 image): the release's list, which
    // is this box's `apps` entry for entry — the mounted apps are not in it.
    writeFileSync(
      join(dir, 'declaration.json'),
      JSON.stringify({ forgeRelease: RELEASE, compositionId: 'base', apps: COMPOSITION.apps.map((a) => ({ id: a.id, package: a.package })) }),
    );
    writeFileSync(join(dir, 'health.json'), JSON.stringify(health));
    return run('bash', [VERIFY, '--declaration', join(dir, 'declaration.json'), '--health', join(dir, 'health.json'), '--mounted-dir', join(ROOT, 'extensions')], {
      env: { ...process.env, FORGE_LOCK: join(dir, 'forge.lock') },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('★★ verify-composition.sh (the release’s copy): the pulled kernel + this mount match the lock the bake writes', () => {
  const r = verify(bakedLock());
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /the kernel serves, mounted: demo-setup payment-pos/);
});

test('⛔ SABOTAGE — the same box with a lock WITHOUT composition.mounted: verify-composition.sh says MISSING', () => {
  const lock = bakedLock();
  delete lock.composition.mounted;
  const r = verify(lock);
  assert.equal(r.code, 1, r.out);
  for (const id of MOUNTED) assert.match(r.out, new RegExp(`MISSING: ${id}`));
});

test('⟂ a kernel that holds the mount and failed to load an app: FAILED (mounted), naming it', () => {
  const r = verify(bakedLock(), { status: 'ok', extensions: { mounted: 1, failed: [{ where: 'payment-pos', reason: 'the range was NOT checked' }] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAILED \(mounted\): payment-pos/);
});

test('★ the copy IS the release’s KP-3 verify-composition.sh (a lock with composition.mounted read by an older copy is MISSING)', () => {
  const text = readFileSync(VERIFY, 'utf8');
  assert.match(text, /KP-3 — AND THE APPS THE KERNEL RECEIVES MOUNTED/);
  assert.match(text, /want_kernel_apps="\$\(jq -r '\(\.composition\.apps - \.composition\.mounted\) \| sort \| join\(" "\)' "\$FORGE_LOCK"\)"/);
});

// ── 5 · THE DEPLOY RECREATES THE KERNEL WHEN, AND ONLY WHEN, THE MOUNT CHANGED ──────────────────────────────
const SHIMS = {
  ssh: `#!/usr/bin/env bash
cmd="\${@: -1}"
exec bash -c "$cmd"
`,
  // Compose succeeds and writes down what it was asked; the box serves no container, so step 6a measures nothing.
  docker: `#!/usr/bin/env bash
case "$1 $2" in
  'compose version') echo 2.99.0; exit 0 ;;
esac
case "$1" in
  image) exit 0 ;;
  version) exit 0 ;;
  compose)
    echo "compose $*" >> "$PROBE_LOG/docker.log"
    case " $* " in *' config '*|*' ps '*) exit 0 ;; esac
    exit 0 ;;
esac
echo "$*" >> "$PROBE_LOG/docker.log"
exit 0
`,
  curl: `#!/usr/bin/env bash
printf '000 -'
`,
};

/** A scratch instance whose box (a directory here) already holds `onBox` as its extensions/. */
function deployScratch({ onBox }) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-deploy-mount-'));
  const host = join(dir, 'host');
  for (const d of ['bin', 'deploy', 'apps/probe', 'caddy/certs', 'caddy/extra', 'extensions/probe-app', 'i18n', 'themes', 'log', 'shims', 'host'])
    mkdirSync(join(dir, d), { recursive: true });
  for (const f of ['deploy.sh', 'images-from-lock.sh', 'require-node.sh', 'remote-box.sh', 'lock-gate.sh'])
    cpSync(join(ROOT, 'bin', f), join(dir, 'bin', f));
  for (const f of ['compose.yml', 'compose.override.yml', 'caddy/Caddyfile', 'bin/verify-composition.sh']) writeFileSync(join(dir, f), '# probe\n');
  writeFileSync(join(dir, 'env-source.sh'), "optional_secret() { printf ''; }\n");
  writeFileSync(join(dir, 'composition.json'), JSON.stringify({ version: 1, apps: [], instanceApps: [{ id: 'probe', package: '@forge/ext-probe', source: './apps/probe' }] }));
  writeFileSync(
    join(dir, 'apps/probe/package.json'),
    JSON.stringify({ name: '@forge/ext-probe', version: '0.0.0', private: true, type: 'module', forge: { origin: 'instance', wiring: { blocks: { s: { surface: 'storefront', module: './s', export: 'S' } } } }, exports: { './manifest': './manifest.ts', './s': './s.tsx' } }),
  );
  writeFileSync(join(dir, 'extensions/probe-app/forge-extension.json'), '{"id":"probe-app","version":"2"}\n');
  writeFileSync(
    join(dir, 'forge.lock'),
    JSON.stringify({
      forgeVersion: 'v0.0.0-probe',
      node: { minMajor: 24, engines: '>=24' },
      composition: { id: 'probe', apps: ['probe'] },
      images: Object.fromEntries(['kernel', 'storefront', 'checkout', 'admin', 'storefront-coffee', 'totem'].map((k, i) => [k, { ref: `ghcr.io/probe/probe-${k}@${D('abcdef'[i])}`, origin: 'own build' }])),
    }),
  );
  writeFileSync(join(dir, 'deploy/box.env'), 'FORGE_TOTEM_STORE_ID=sto_PROBE\n');
  writeFileSync(
    join(dir, 'deploy/probe.env'),
    ['FORGE_DEPLOY_HOST=probe-host.example.test', 'FORGE_DEPLOY_USER=nobody', `FORGE_DEPLOY_DIR=${host}`, 'FORGE_DOMAIN=probe.invalid', 'FORGE_ADMIN_DOMAIN=admin.probe.invalid', 'FORGE_PUBLIC_ORIGIN=https://probe.invalid', 'FORGE_DEPLOY_FACE_WAIT=0', ''].join('\n'),
  );
  writeFileSync(
    join(host, '.secrets'),
    ['forge-postgres-password', 'forge-vault-key', 'forge-storage-endpoint', 'forge-storage-access-key-id', 'forge-storage-secret-access-key'].map((n) => `${n}=probe`).join('\n') + '\n',
  );
  if (onBox !== undefined) {
    mkdirSync(join(host, 'extensions/probe-app'), { recursive: true });
    writeFileSync(join(host, 'extensions/probe-app/forge-extension.json'), onBox);
  }
  for (const [name, body] of Object.entries(SHIMS)) {
    writeFileSync(join(dir, 'shims', name), body);
    chmodSync(join(dir, 'shims', name), 0o755);
  }
  writeFileSync(join(dir, 'log', 'docker.log'), '');
  return { dir, host };
}

function deploy({ dir }) {
  const r = run('bash', [join(dir, 'bin', 'deploy.sh'), 'probe'], {
    cwd: dir,
    env: {
      ...process.env,
      PATH: `${join(dir, 'shims')}:${process.env.PATH}`,
      PROBE_LOG: join(dir, 'log'),
      FORGE_PROVENANCE_BIN: FENCE,
    },
    timeout: 120_000,
  });
  return { ...r, docker: readFileSync(join(dir, 'log', 'docker.log'), 'utf8') };
}
const RECREATE_KERNEL = /compose .*up -d --force-recreate --no-deps kernel/;

test('⛔ SABOTAGE GUARD — a delivery that CHANGES extensions/ recreates the kernel, after the up', { skip: NO_TOOLS }, () => {
  const s = deployScratch({ onBox: '{"id":"probe-app","version":"1"}\n' });
  try {
    const r = deploy(s);
    assert.match(r.out, /recreated kernel — extensions\/ changed in this delivery/, r.out);
    const log = r.docker.split('\n');
    const up = log.findIndex((l) => /compose .* up -d --remove-orphans/.test(l));
    const re = log.findIndex((l) => RECREATE_KERNEL.test(l));
    assert.ok(up > -1 && re > up, `the kernel was not recreated after the up:\n${r.docker}`);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('★ CONTROL — a delivery that leaves extensions/ byte for byte as it was does NOT restart the kernel', { skip: NO_TOOLS }, () => {
  const s = deployScratch({ onBox: '{"id":"probe-app","version":"2"}\n' });
  try {
    const r = deploy(s);
    assert.match(r.out, /extensions\/ unchanged by this delivery/, r.out);
    assert.doesNotMatch(r.docker, RECREATE_KERNEL, r.docker);
    // The run reached the up — the control measured a deploy, not a refusal before it.
    assert.match(r.docker, /compose .* up -d --remove-orphans/, `${r.out}\n${r.docker}`);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('★ a FIRST delivery (the box has no extensions/ yet) recreates the kernel too — the mount appeared', { skip: NO_TOOLS }, () => {
  const s = deployScratch({ onBox: undefined });
  try {
    const r = deploy(s);
    assert.match(r.docker, RECREATE_KERNEL, `${r.out}\n${r.docker}`);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
