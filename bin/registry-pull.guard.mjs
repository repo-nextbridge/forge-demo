// ★★★ KP-D1 (2026-10-21) — THE ADMIN COMES FROM A PRIVATE REGISTRY, AND THE BOX KEEPS NO CREDENTIAL FOR IT.
//
//   node --test bin/registry-pull.guard.mjs        (or: bash bin/test.sh)
//
// The admin is pulled from the Forge release, whose images live in the product's PRIVATE Artifact Registry.
// The GCP organization forbids service-account keys, so the access is a read-only account WITHOUT a key:
// `bin/deploy.sh` mints a 1-hour token on the deploying machine by impersonation (step 3b), hands it to the box
// on ssh's STDIN for `docker login`, and logs the box out after the pull. What is graded, end to end, by running
// the real `bin/deploy.sh` against a FAKE host (an `ssh` that runs the command here, in a scratch directory)
// with a fake `docker` and a fake `gcloud` that write down everything they are asked:
//
//   1 · ★ no token can be minted ⇒ the deploy refuses NAMING the image, the host and the gcloud command — and
//       BEFORE delivery: no `install -d`, no `tar`, no pull, no compose reached the host.
//   2 · ★ a registry that refuses strangers and that `registry-access.json` does not open ⇒ the same, earlier.
//   3 · ★★ the token path: `docker login -u oauth2accesstoken --password-stdin https://<host>` on the box,
//       with the token on STDIN — never in any command line ssh carried, never in the deploy's output — then the
//       pull of the admin, then `docker logout`.
//   4 · ⟂ CONTROL: a lock that is all public GHCR (the shape of every lock before KP-D1) never calls gcloud
//       and never logs in — the new step costs nothing to a box that does not need it.
//   5 · the committed `registry-access.json` opens the release's registry as a read-only account, no key.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FENCE = join(ROOT, 'node_modules', '.bin', 'forge-lock-provenance');
const SKIP = existsSync(FENCE) ? false : 'NOT CHECKED — the release’s tools are not installed (`npm ci` at the root); the deploy runs the fence first';

const D = (c) => `sha256:${c.repeat(64)}`;
const AR_HOST = 'southamerica-east1-docker.pkg.dev';
const ADMIN_REF = `${AR_HOST}/probe/forge-kernel/forge-admin@${D('d')}`;
const SA = 'reader-probe@probe.iam.gserviceaccount.example.test';
// A token-shaped value that appears nowhere else: if it is found in a command line or in the output, it leaked.
const TOKEN = 'ya29.PROBE-TOKEN-7f3c9e1b-not-a-real-credential';

const lock = (adminRef, adminOrigin) => ({
  forgeVersion: 'v0.0.0-probe',
  node: { minMajor: 24, engines: '>=24' },
  composition: { id: 'probe', apps: ['probe'] },
  images: {
    kernel: { ref: `ghcr.io/probe/probe-kernel@${D('a')}`, origin: 'own build' },
    storefront: { ref: `ghcr.io/probe/probe-storefront@${D('b')}`, origin: 'own build' },
    checkout: { ref: `ghcr.io/probe/probe-checkout@${D('c')}`, origin: 'own build' },
    admin: { ref: adminRef, origin: adminOrigin },
    'storefront-coffee': { ref: `ghcr.io/probe/probe-coffee@${D('e')}`, origin: 'own build' },
    totem: { ref: `ghcr.io/probe/probe-totem@${D('f')}`, origin: 'own build' },
  },
});

const SHIMS = {
  // The "host" is a directory here; the command is ssh's LAST argument, stdin passes through.
  ssh: `#!/usr/bin/env bash
cmd="\${@: -1}"
printf '%s\\n----\\n' "$cmd" >> "$PROBE_LOG/ssh.log"
exec bash -c "$cmd"
`,
  docker: `#!/usr/bin/env bash
case "$1 $2" in
  'compose version') echo 2.99.0; exit 0 ;;
esac
case "$1" in
  login)
    body="$(cat)"
    printf 'login %s stdin=%s\\n' "$*" "$( [ "$body" = "$PROBE_TOKEN" ] && echo token || echo "other:\${#body}")" >> "$PROBE_LOG/docker.log"; exit 0 ;;
  logout|pull) echo "$*" >> "$PROBE_LOG/docker.log"; exit 0 ;;
  image) exit 1 ;;
  version) exit 0 ;;
  compose) echo "compose \${*: -3}" >> "$PROBE_LOG/docker.log"; exit 1 ;;
esac
echo "$*" >> "$PROBE_LOG/docker.log"
exit 0
`,
  gcloud: `#!/usr/bin/env bash
echo "$*" >> "$PROBE_LOG/gcloud.log"
if [ -n "\${PROBE_GCLOUD_OK:-}" ]; then printf '%s\\n' "$PROBE_TOKEN"; exit 0; fi
echo 'ERROR: (gcloud.auth.print-access-token) PERMISSION_DENIED: iam.serviceAccounts.getAccessToken' >&2
exit 1
`,
};

/** A scratch instance, a scratch "host" directory, and the shims first on PATH. */
function scratch({ adminRef = ADMIN_REF, adminOrigin = 'release', access = { [AR_HOST]: { login: 'impersonate', serviceAccount: SA } } } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-registry-pull-'));
  const host = join(dir, 'host');
  const log = join(dir, 'log');
  const shims = join(dir, 'shims');
  for (const d of ['bin', 'deploy', 'apps/probe', 'caddy/certs', 'caddy/extra', 'extensions', 'i18n', 'themes', 'log', 'shims', 'host'])
    mkdirSync(join(dir, d), { recursive: true });
  for (const f of ['deploy.sh', 'images-from-lock.sh', 'require-node.sh', 'remote-box.sh', 'lock-gate.sh'])
    cpSync(join(ROOT, 'bin', f), join(dir, 'bin', f));
  for (const f of ['compose.yml', 'compose.override.yml', 'caddy/Caddyfile', 'bin/verify-composition.sh']) writeFileSync(join(dir, f), '# probe\n');
  // The box's accessor, as the box would source it after delivery: no GHCR token (anonymous public pulls).
  writeFileSync(join(dir, 'env-source.sh'), "optional_secret() { printf ''; }\n");
  writeFileSync(
    join(dir, 'composition.json'),
    JSON.stringify({ version: 1, apps: [], instanceApps: [{ id: 'probe', package: '@forge/ext-probe', source: './apps/probe' }] }),
  );
  // An app that draws only in the STOREFRONT: the fence is green with the admin pulled (bin/deploy.guard.mjs).
  writeFileSync(
    join(dir, 'apps/probe/package.json'),
    JSON.stringify({
      name: '@forge/ext-probe',
      version: '0.0.0',
      private: true,
      type: 'module',
      forge: { origin: 'instance', wiring: { blocks: { probe_shelf: { surface: 'storefront', module: './block/shelf', export: 'Shelf' } } } },
      exports: { './manifest': './manifest.ts', './block/shelf': './block/shelf.tsx' },
    }),
  );
  writeFileSync(join(dir, 'forge.lock'), JSON.stringify(lock(adminRef, adminOrigin), null, 2));
  if (access) writeFileSync(join(dir, 'registry-access.json'), JSON.stringify({ registries: access }, null, 2));
  writeFileSync(join(dir, 'deploy/box.env'), 'FORGE_ADMIN_TENANT=\n');
  writeFileSync(
    join(dir, 'deploy/probe.env'),
    [
      'FORGE_DEPLOY_HOST=probe-host.example.test',
      'FORGE_DEPLOY_USER=nobody',
      `FORGE_DEPLOY_DIR=${host}`,
      'FORGE_DOMAIN=probe.invalid',
      'FORGE_ADMIN_DOMAIN=admin.probe.invalid',
      'FORGE_PUBLIC_ORIGIN=https://probe.invalid',
      'FORGE_DEPLOY_FACE_WAIT=0',
      '',
    ].join('\n'),
  );
  // The five names step 3 asks the host for — placeholders, nothing here is a credential.
  writeFileSync(
    join(host, '.secrets'),
    ['forge-postgres-password', 'forge-vault-key', 'forge-storage-endpoint', 'forge-storage-access-key-id', 'forge-storage-secret-access-key']
      .map((n) => `${n}=probe`)
      .join('\n') + '\n',
  );
  for (const [name, body] of Object.entries(SHIMS)) {
    writeFileSync(join(shims, name), body);
    chmodSync(join(shims, name), 0o755);
  }
  return { dir, host, log, shims };
}

function deploy(s, { gcloudOk = false } = {}) {
  const env = {
    ...process.env,
    PATH: `${s.shims}:${process.env.PATH}`,
    PROBE_LOG: s.log,
    PROBE_TOKEN: TOKEN,
    FORGE_PROVENANCE_BIN: FENCE,
  };
  delete env.PROBE_GCLOUD_OK;
  if (gcloudOk) env.PROBE_GCLOUD_OK = '1';
  let code = 0;
  let out;
  try {
    out = execFileSync('bash', [join(s.dir, 'bin/deploy.sh'), 'probe'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env, timeout: 120_000 });
  } catch (e) {
    code = e.status ?? -1;
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const read = (f) => (existsSync(join(s.log, f)) ? readFileSync(join(s.log, f), 'utf8') : '');
  return { code, out, ssh: read('ssh.log'), docker: read('docker.log'), gcloud: read('gcloud.log') };
}

const DELIVERED = /install -d -m 755|tar -C/;

test('★ no token can be minted ⇒ refused by name, BEFORE anything is delivered to the box', { skip: SKIP }, () => {
  const s = scratch();
  try {
    const r = deploy(s);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /the lock pins admin at southamerica-east1-docker\.pkg\.dev/, r.out);
    assert.ok(r.out.includes(`gcloud auth print-access-token --impersonate-service-account=${SA}`), `the refusal does not say how to mint the token:\n${r.out}`);
    assert.match(r.out, /PERMISSION_DENIED/, 'gcloud’s own reason is not quoted');
    assert.match(r.gcloud, new RegExp(`auth print-access-token --impersonate-service-account=${SA.replace(/\./g, '\\.')}`));
    assert.doesNotMatch(r.ssh, DELIVERED, `the box was touched before the refusal:\n${r.ssh}`);
    assert.equal(r.docker.match(/^(pull|compose|login)/m), null, `docker was asked for something:\n${r.docker}`);
    assert.ok(r.ssh.includes('.secrets'), 'anti-vacuum: the run never reached the host at all (step 3), so the order above proves nothing');
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('★ a registry that refuses strangers and that registry-access.json does not open ⇒ refused before delivery', { skip: SKIP }, () => {
  const s = scratch({ access: null });
  try {
    const r = deploy(s, { gcloudOk: true });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /the lock pins admin at southamerica-east1-docker\.pkg\.dev, and that registry refuses an anonymous pull/);
    assert.match(r.out, /registry-access\.json/);
    assert.equal(r.gcloud, '', 'a token was minted for an account nobody declared');
    assert.doesNotMatch(r.ssh, DELIVERED, r.ssh);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('★★ the token reaches the box on STDIN only, logs in, the admin is pulled, and the box is logged out', { skip: SKIP }, () => {
  const s = scratch();
  try {
    const r = deploy(s, { gcloudOk: true });
    // It stops at `compose up` (the fake docker refuses compose) — AFTER the images, which is what is graded.
    assert.match(r.out, /database and cache did not come up/, `the run did not reach step 6:\n${r.out}`);
    const lines = r.docker.trim().split('\n');
    const login = lines.findIndex((l) => l === `login login -u oauth2accesstoken --password-stdin https://${AR_HOST} stdin=token`);
    const pull = lines.findIndex((l) => l === `pull -q ${ADMIN_REF}`);
    const logout = lines.findIndex((l) => l === `logout https://${AR_HOST}`);
    assert.ok(login >= 0, `no docker login with the token on stdin:\n${r.docker}`);
    assert.ok(pull > login, `the admin was not pulled after the login:\n${r.docker}`);
    assert.ok(logout > pull, `the box was not logged out after the pull:\n${r.docker}`);
    assert.equal(lines.filter((l) => l.startsWith('login ')).length, 1, 'one login per registry, not one per image');
    assert.ok(!r.ssh.includes(TOKEN), 'THE TOKEN TRAVELLED IN A COMMAND LINE — `ps` on the box shows it');
    assert.ok(!r.out.includes(TOKEN), 'THE TOKEN WAS PRINTED by the deploy');
    // Not on any disk either — the scratch instance (this machine) nor the "host" directory (the box).
    const grep = spawnSync('grep', ['-rl', '--exclude-dir=log', TOKEN, s.dir], { encoding: 'utf8' });
    assert.equal(grep.status, 1, `THE TOKEN WAS WRITTEN TO DISK: ${grep.stdout}`);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('⟂ CONTROL — a lock that is all public GHCR never calls gcloud and never logs in', { skip: SKIP }, () => {
  const s = scratch({ adminRef: `ghcr.io/probe/probe-admin@${D('d')}`, adminOrigin: 'own build' });
  try {
    const r = deploy(s);
    assert.match(r.out, /every image is on a registry that answers anonymously/, r.out);
    assert.match(r.out, /database and cache did not come up/, `the run did not reach step 6:\n${r.out}`);
    assert.equal(r.gcloud, '', `gcloud was called for a lock that needs no login:\n${r.gcloud}`);
    assert.doesNotMatch(r.docker, /^(login|logout)/m, r.docker);
    assert.match(r.docker, new RegExp(`pull -q ghcr\\.io/probe/probe-admin@${D('d')}`));
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test('the committed registry-access.json opens the release’s registry as a read-only account — and holds no key', () => {
  const text = readFileSync(join(ROOT, 'registry-access.json'), 'utf8');
  const { registries } = JSON.parse(text);
  const entry = registries?.[AR_HOST];
  assert.ok(entry, `registry-access.json does not open ${AR_HOST}, where the release’s admin lives`);
  assert.equal(entry.login, 'impersonate');
  assert.match(entry.serviceAccount, /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/);
  assert.doesNotMatch(text, /private_key|-----BEGIN|"type":\s*"service_account"/, 'a key landed in a versioned file');
});
