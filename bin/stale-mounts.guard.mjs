// ★★★ A DEPLOY THAT DELIVERS A NEW CONFIG FILE LEAVES NO CONTAINER SERVING THE OLD ONE — with real containers.
//
// ⛔ THE INCIDENT, MEASURED ON THE STAGING BOX 2026-10-19. `bin/deploy.sh stag` exited 0, every face answered,
// and the edge served the Caddyfile of 10/10: the host's copy held MZ-9's `import forge_noindex`
// (`grep -c` → 7), the container's did not (→ 0). The deploy delivers with `tar -x` (a NEW inode per file), a
// bind-mounted FILE pins the OLD inode, and `docker compose up -d` does not recreate a service whose
// definition did not change. `box_refresh_stale_mounts` (bin/remote-box.sh) is the repair; this grades it.
//
// ★ THE BUG IS RE-STAGED, NOT MOCKED: a compose project of throwaway busybox containers, a file and two
// directories bind-mounted the way compose.yml mounts the edge's, and the redelivery done with the same
// `tar -czf - | tar -xzf -` the deploy uses. Before each repair the test asserts the premise — the container
// really does still serve the old bytes — so a docker that one day re-resolves mounts by itself turns this red
// as "premise gone" instead of passing without testing anything.
//
// ⟂ AND THE NO-OP DIRECTION FIRST: a redelivery of IDENTICAL bytes is still a new inode on every file, and must
// recreate NOTHING. A rule that judged by inode (or that recreated everything) would pass the incident and
// take the edge down on every deploy; this is the case that tells the two apart.
//
// `stop_signal: SIGKILL` because a shell as PID 1 ignores SIGTERM and every recreate would wait the 10 s grace.
// The project is `forge-dp1-mounts-<pid>`, created and removed (`down -v`) by this file only.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE = 'busybox:1';

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

/** Why this machine cannot grade it, or null. No pull: a guard does not reach the network to find its image. */
function cannotRun() {
  if (sh('docker', ['version']).status !== 0) return 'no runnable `docker` on this machine';
  if (sh('docker', ['compose', 'version']).status !== 0) return 'no `docker compose` on this machine';
  if (sh('docker', ['image', 'inspect', IMAGE]).status !== 0) return `the image ${IMAGE} is not here (\`docker pull ${IMAGE}\`)`;
  return null;
}
const WHY_NOT = cannotRun();
const notChecked = (t) => t.skip(`NOT CHECKED: ${WHY_NOT} — the stale-mount repair needs real containers and real bind mounts`);

const work = mkdtempSync(join(tmpdir(), 'forge-stale-mounts-'));
const project = `forge-dp1-mounts-${process.pid}`;
const src = join(work, 'src'); // what this repository holds
const box = join(work, 'box'); // where the deploy puts it
const compose = ['docker', 'compose', '-p', project, '-f', join(box, 'compose.yml')];

/** The deploy's own delivery, byte for byte: one tar stream, extracted over what is there. */
function deliver() {
  const r = sh('bash', ['-c', `tar -C "${src}" -czf - compose.yml caddy | tar -C "${box}" -xzf -`]);
  assert.equal(r.status, 0, r.stderr);
}

/** Run box_refresh_stale_mounts against the project, sourced from the real bin/remote-box.sh. */
function refresh(extraEnv = {}) {
  const r = sh(
    'bash',
    ['-c', '. "$1/bin/remote-box.sh"; shift; box_refresh_stale_mounts "$@"', 'x', ROOT, ...compose],
    { env: { ...process.env, ...extraEnv } },
  );
  return { ...r, lines: r.stdout.split('\n').filter(Boolean) };
}

const cid = (svc) => sh(compose[0], [...compose.slice(1), 'ps', '-q', svc]).stdout.trim();
const served = (svc, path) => sh('docker', ['exec', cid(svc), 'cat', path]).stdout;

function setUp() {
  mkdirSync(join(src, 'caddy/extra'), { recursive: true });
  mkdirSync(box, { recursive: true });
  writeFileSync(join(src, 'caddy/Caddyfile'), 'site { respond "v1" }\n');
  writeFileSync(join(src, 'caddy/extra/one.caddy'), '# one\n');
  // `edge` mounts a FILE and a DIRECTORY, as compose.yml mounts the real edge; `sidecar` mounts only the
  // directory, so "recreate only what diverged" has a service that must be left alone — and the edge DEPENDS on
  // it, as the real edge depends on the fronts, so a recreate without `--no-deps` drags it along; the named volume is
  // the negative control — not a bind mount, never counted, never judged.
  writeFileSync(
    join(src, 'compose.yml'),
    `services:
  edge:
    image: ${IMAGE}
    command: ["sh", "-c", "while :; do sleep 3600; done"]
    stop_signal: SIGKILL
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy/extra:/etc/caddy/extra:ro
      - edge_data:/data
    depends_on: [sidecar]
  sidecar:
    image: ${IMAGE}
    command: ["sh", "-c", "while :; do sleep 3600; done"]
    stop_signal: SIGKILL
    volumes:
      - ./caddy/extra:/extra:ro
volumes:
  edge_data:
`,
  );
  deliver();
  const r = sh(compose[0], [...compose.slice(1), 'up', '-d']);
  assert.equal(r.status, 0, r.stderr);
}

test.after(() => {
  if (!WHY_NOT) sh(compose[0], [...compose.slice(1), 'down', '-v', '--remove-orphans']);
  rmSync(work, { recursive: true, force: true });
});

// ── the premise, measured on this machine: tar renews every FILE's inode and keeps every DIRECTORY's ──────
test('the deploy\'s delivery gives a file a new inode (even with the same bytes) and keeps a directory\'s', (t) => {
  if (WHY_NOT) return notChecked(t);
  setUp();
  const before = { file: statSync(join(box, 'caddy/Caddyfile')).ino, dir: statSync(join(box, 'caddy/extra')).ino };
  deliver();
  assert.notEqual(statSync(join(box, 'caddy/Caddyfile')).ino, before.file, 'tar reused the file inode — the incident cannot happen this way');
  assert.equal(statSync(join(box, 'caddy/extra')).ino, before.dir, 'tar replaced the directory — the directory half is a deploy-time bug too');
});

test('⟂ a redelivery of the SAME bytes recreates nothing — no downtime on a deploy that changes no config', (t) => {
  if (WHY_NOT) return notChecked(t);
  deliver(); // new inodes, identical content
  const ids = [cid('edge'), cid('sidecar')];
  const r = refresh();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.lines, ['checked 1 2'], `expected only the census (1 file, 2 directories — the named volume is not a bind mount)\n${r.stdout}${r.stderr}`);
  assert.deepEqual([cid('edge'), cid('sidecar')], ids, 'a container was replaced although nothing changed');
});

test('★★★ the incident: a new Caddyfile delivered by tar is detected by content, and only the edge is recreated', (t) => {
  if (WHY_NOT) return notChecked(t);
  writeFileSync(join(src, 'caddy/Caddyfile'), 'site { import forge_noindex\n respond "v2" }\n');
  deliver();
  assert.match(served('edge', '/etc/caddy/Caddyfile'), /v1/, 'premise gone: the container already serves the new file without a recreate');
  const ids = { edge: cid('edge'), sidecar: cid('sidecar') };

  const r = refresh();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^stale edge file \/etc\/caddy\/Caddyfile \S+\/caddy\/Caddyfile content differs/m, r.stdout);
  assert.match(r.stdout, /^recreated edge$/m, r.stdout);
  assert.doesNotMatch(r.stdout, /sidecar/, 'the sidecar diverged in nothing and was named anyway');
  assert.notEqual(cid('edge'), ids.edge, 'the edge was reported and not recreated');
  assert.equal(cid('sidecar'), ids.sidecar, 'the sidecar was recreated although it serves what was delivered');
  assert.match(served('edge', '/etc/caddy/Caddyfile'), /forge_noindex/, 'recreated, and still serving the old Caddyfile');
});

test('⟂ the repair touches only the stale service — a dependency that was stopped stays stopped', (t) => {
  if (WHY_NOT) return notChecked(t);
  // Measured with compose 5.3.1: without `--no-deps`, recreating the edge STARTS the sidecar it depends on.
  assert.equal(sh(compose[0], [...compose.slice(1), 'stop', 'sidecar']).status, 0);
  writeFileSync(join(src, 'caddy/Caddyfile'), 'site { respond "v2b" }\n');
  deliver();
  const r = refresh();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^recreated edge$/m, r.stdout);
  assert.equal(cid('sidecar'), '', 'repairing the edge started a dependency that had been stopped');
  assert.equal(sh(compose[0], [...compose.slice(1), 'up', '-d', 'sidecar']).status, 0);
});

test('★ a bind-mounted directory replaced under running containers is caught too, in every service that mounts it', (t) => {
  if (WHY_NOT) return notChecked(t);
  // Not something the deploy does (tar keeps the directory, above) — something a person on the box does.
  rmSync(join(box, 'caddy/extra'), { recursive: true });
  mkdirSync(join(box, 'caddy/extra'));
  writeFileSync(join(box, 'caddy/extra/two.caddy'), '# two\n');
  assert.doesNotMatch(sh('docker', ['exec', cid('sidecar'), 'ls', '/extra']).stdout, /two\.caddy/, 'premise gone: the sidecar already sees the new directory');

  const r = refresh();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^stale edge dir \/etc\/caddy\/extra /m, r.stdout);
  assert.match(r.stdout, /^stale sidecar dir \/extra /m, r.stdout);
  assert.match(r.stdout, /^recreated edge$/m);
  assert.match(r.stdout, /^recreated sidecar$/m);
  assert.match(sh('docker', ['exec', cid('sidecar'), 'ls', '/extra']).stdout, /two\.caddy/, 'recreated, still serving the old directory');
  assert.deepEqual(refresh().lines, ['checked 1 2'], 'a second pass right after the repair still finds something stale');
});

test('⟂ a docker that cannot run is a FAILURE with no census, never a quiet "nothing stale"', (t) => {
  if (WHY_NOT) return notChecked(t);
  const r = sh('bash', ['-c', '. "$1/bin/remote-box.sh"; shift; DOCKER_CMD=(false); box_refresh_stale_mounts "$@"', 'x', ROOT, ...compose]);
  assert.notEqual(r.status, 0, 'a docker that cannot run returned green');
  assert.doesNotMatch(r.stdout, /^checked /m, 'it printed a census of a measure it never took');
});

// ── through the vehicle: the function's text travels over ssh and runs ON the box, with the box's prelude ──
test('★★ remote_refresh_stale_mounts runs the same rule on the box, in its directory, under its project name', (t) => {
  if (WHY_NOT) return notChecked(t);
  // The "box" is `box/`; ssh is a stub that runs the remote command HERE, stdin and all.
  const stub = join(work, 'stub');
  mkdirSync(stub, { recursive: true });
  mkdirSync(join(box, 'bin'), { recursive: true });
  writeFileSync(join(stub, 'ssh'), '#!/usr/bin/env bash\nexec bash -c "${@: -1}"\n', { mode: 0o755 });
  writeFileSync(join(box, 'env-source.sh'), '');
  writeFileSync(join(box, 'bin/images-from-lock.sh'), '');

  writeFileSync(join(src, 'caddy/Caddyfile'), 'site { respond "v3" }\n');
  deliver();
  assert.doesNotMatch(served('edge', '/etc/caddy/Caddyfile'), /v3/, 'premise gone');
  const before = cid('edge');

  const r = sh(
    'bash',
    [
      '-c',
      '. "$1/bin/remote-box.sh"; REMOTE_SSH=(ssh box); REMOTE_BOX_DIR="$2"; REMOTE_BOX_PROJECT="$3"; remote_refresh_stale_mounts -f compose.yml',
      'x', ROOT, box, project,
    ],
    { env: { ...process.env, PATH: `${stub}:${process.env.PATH}` } },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^stale edge file \/etc\/caddy\/Caddyfile /m, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /^recreated edge$/m);
  assert.match(r.stdout, /^checked 1 2$/m);
  assert.notEqual(cid('edge'), before);
  assert.match(served('edge', '/etc/caddy/Caddyfile'), /v3/);
});

// ── the wiring: bin/deploy.sh asks, after `up`, before the birth and the verdict, and stops on a failure ──────
test('★★ bin/deploy.sh runs the check after the stack is up and before the birth hand-off and the verdict', () => {
  const code = readFileSync(join(ROOT, 'bin/deploy.sh'), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  const up = code.search(/^remote_compose "\$\{COMPOSE_FILES\[@\]\}" up -d --remove-orphans/m);
  const check = code.search(/^mounts_report="\$\(remote_refresh_stale_mounts "\$\{COMPOSE_FILES\[@\]\}"\)" \\\n\s*\|\| die /m);
  const birth = code.indexOf('bash "$HERE/bin/birth-remote.sh"');
  const verdict = code.indexOf("say '7 · the verdict'");
  assert.ok(up > -1, 'the reader cannot find the stack\'s `up` — it is blind, or the step moved');
  assert.ok(check > -1, 'bin/deploy.sh does not run remote_refresh_stale_mounts (or a failure of it does not stop the deploy)');
  assert.ok(up < check, 'the check runs before the stack is up — it would grade the containers being replaced');
  assert.ok(check < birth && check < verdict, 'the check runs after the birth hand-off or the verdict — a stale edge would be graded green');
});
