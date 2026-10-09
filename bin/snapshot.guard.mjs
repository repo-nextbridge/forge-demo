// ★★★ THE SNAPSHOT AND THE WAY BACK — every refusal, and the pair, graded before a box ever depends on them.
//
// `bin/snapshot.sh` destroys a box's state on the way to restoring it. So the four sentences it lives by are
// held here, each one against the real file and each one with a fabricated state that MUST be able to break it
// (RESULTADOS-g carries the sabotage of every test below — diff, red, then green):
//
//   1. A box with NO gold, a gold with NO pair, a gold whose bytes are not its own and a gold NEWER than the
//      kernel are refused — and refused BEFORE box-down: the fake docker below records every call, and a
//      refusal that reached `down` or `volume rm` is red.
//   2. The restore PUTS THE PAIR BACK: after a restore, every name the gold carries holds the gold's value —
//      the token a later birth minted is gone — and every line the gold does not name is untouched.
//   3. What the pair carries is DERIVED from the birth (never typed), and what is state is DERIVED from
//      box-down (never a second opinion) — a STATE volume with no disposition is a refusal to take.
//   4. Nothing a front renders survives a restore: every mount in the compose is read-only or a named volume
//      box-down classifies. A writable bind mount would be state that `down` does not destroy and the gold
//      does not carry — the vitrine would serve the dirty shop across the reset.

import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  judgeGold,
  mintedNames,
  PAIR_REQUIRED_SECRETS,
  secretInPair,
  selectPair,
  statePlan,
  stateVolumes,
} from './snapshot-pair.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const SCRIPT = read('bin/snapshot.sh');
const codeOnly = (text) =>
  text
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

// ── 3 · THE TWO AUTHORS ────────────────────────────────────────────────────────────────────────────────────
test('the pair is read out of the deployed birth: every store id, the host map, and every token it mints', () => {
  const n = mintedNames(read('bin/birth-remote.sh'));
  for (const k of ['FORGE_STORE_HOSTS', 'FORGE_ADMIN_STORE_IDS', 'FORGE_COFFEE_STORE_ID', 'FORGE_TOTEM_STORE_ID', 'FORGE_ADMIN_ACCESS_KEYS']) {
    assert.ok(n.env.includes(k), `${k} is minted by bin/birth-remote.sh and the pair does not carry it — read: ${n.env.join(', ')}`);
  }
  for (const s of ['forge-admin-platform-token', 'forge-bulk-read-token', 'forge-vault-key']) {
    assert.ok(n.secrets.includes(s), `${s} is not in the pair — read: ${n.secrets.join(', ')}`);
  }
  for (const f of ['forge-operator-token', 'forge-admin-service-token', 'forge-admin-access-key']) {
    assert.ok(n.secretFamilies.includes(f), `the per-tenant family ${f} is not in the pair`);
  }
  // Every name the restore REQUIRES must be one the birth (or the database) actually puts in the pair.
  for (const r of PAIR_REQUIRED_SECRETS) assert.ok(secretInPair(r, n), `${r} is required of a gold and never carried by one`);
});

test('the bench birth is read too — including the counter id it writes WITHOUT the helper', () => {
  const n = mintedNames(read('bin/box-up.sh'));
  assert.ok(n.env.includes('FORGE_TOTEM_STORE_ID'), 'bin/box-up.sh writes FORGE_TOTEM_STORE_ID by sed/printf and the pair misses it');
  assert.ok(n.env.includes('FORGE_STORE_HOSTS'));
});

// ⚠️ ONE ASSERTION PER WRITER SHAPE, and the reason is a vacuous green measured on 2026-10-09: bin/box-up.sh
// writes the counter id with BOTH a sed and a printf on adjacent lines, so a test that only read the real file
// stayed green with either parse switched off. Each shape is now proved alone.
test('each way a birth writes .env is read on its own — the helper, `sed -i`, and `printf >> .env`', () => {
  assert.deepEqual(mintedNames('  put_env FORGE_A "$v"\n').env, ['FORGE_A']);
  assert.deepEqual(mintedNames('    sed -i "s|^FORGE_B=.*|FORGE_B=$id|" "$HERE/.env"\n').env, ['FORGE_B']);
  assert.deepEqual(mintedNames(`      printf 'FORGE_C=%s\\n' "$id" >> "$HERE/.env"\n`).env, ['FORGE_C']);
});

test('a COMMENT that quotes a writer mints nothing; identity never enters the pair', () => {
  const n = mintedNames('# remote_env_put FORGE_FROM_A_SENTENCE x\nremote_env_put FORGE_REAL "$v"\nremote_secret_put forge-real-token "$t"\n');
  assert.deepEqual(n.env, ['FORGE_REAL']);
  const real = mintedNames(read('bin/birth-remote.sh'));
  for (const id of ['forge-storage-access-key-id', 'forge-storage-secret-access-key', 'forge-smtp-pass', 'forge-google-client-secret', 'forge-postgres-password']) {
    assert.ok(!secretInPair(id, real), `${id} is the box's IDENTITY (or not referenced by the dump) and the pair would carry it`);
  }
  assert.ok(secretInPair('forge-operator-token-forgecafe', real), 'a second tenant’s operator token is not matched by its family');
  assert.ok(!secretInPair('forge-operator-token-', real) && !secretInPair('forge-operator-tokenX', real));
});

test("every STATE volume of box-down has a disposition — and one that does not is a refusal, not a gap", () => {
  const boxDown = read('bin/box-down.sh');
  const plan = statePlan(boxDown);
  assert.deepEqual(plan.map((p) => p.volume), stateVolumes(boxDown));
  assert.ok(plan.some((p) => p.how === 'dump'), 'no STATE volume is dumped — the database would not be in the gold');
  const grown = boxDown.replace(/^STATE='([^']*)'/m, "STATE='$1 orders_cache'");
  assert.throws(() => statePlan(grown), /orders_cache/, 'a STATE volume box-down grew is silently left out of the gold');
});

// ── 1 · THE JUDGEMENT ──────────────────────────────────────────────────────────────────────────────────────
const KERNEL = ['system/0001_core.sql', 'system/0002_x.sql', 'tenant/0001_t.sql'];
const WHOLE = { manifest: { format: 1, forgeVersion: 'v0.3.2', migrations: KERNEL.slice(0, 2) }, kernelMigrations: KERNEL, sumsOk: true, pairSecretNames: ['forge-vault-key', 'forge-operator-token'] };

test('a whole gold is restorable, and what the kernel has beyond it is what migrate will apply', () => {
  const v = judgeGold(WHOLE);
  assert.equal(v.ok, true, v.refusals.join(' | '));
  assert.deepEqual(v.pending, ['tenant/0001_t.sql']);
});

test('REFUSED: a box with no gold', () => {
  const v = judgeGold({ ...WHOLE, manifest: null });
  assert.equal(v.ok, false);
  assert.match(v.refusals.join(' '), /NO GOLD/);
});

test('REFUSED: a gold without the pair (empty, or missing the birth’s record or the vault key)', () => {
  for (const names of [[], ['forge-vault-key'], ['forge-operator-token']]) {
    const v = judgeGold({ ...WHOLE, pairSecretNames: names });
    assert.equal(v.ok, false, `a pair of ${JSON.stringify(names)} was accepted`);
    assert.match(v.refusals.join(' '), /NO PAIR/);
  }
});

test('REFUSED: a gold NEWER than the kernel, and a kernel whose migrations could not be read', () => {
  const newer = judgeGold({ ...WHOLE, manifest: { ...WHOLE.manifest, migrations: [...KERNEL, 'system/0099_future.sql'] } });
  assert.equal(newer.ok, false);
  assert.match(newer.refusals.join(' '), /NEWER THAN THIS KERNEL.*0099_future/);
  const unknown = judgeGold({ ...WHOLE, kernelMigrations: [] });
  assert.equal(unknown.ok, false);
  assert.match(unknown.refusals.join(' '), /could not be read/i);
});

test('REFUSED: a gold whose files do not match its own sums', () => {
  const v = judgeGold({ ...WHOLE, sumsOk: false });
  assert.equal(v.ok, false);
  assert.match(v.refusals.join(' '), /SHA256SUMS/);
});

// ── THE SCRIPT, RUN — against a fake docker that records every call ────────────────────────────────────────
//
// The box is a temp copy of the files the phases read on a box (env-source.sh, forge.lock, the lock reader,
// box-down). `FORGE_DOCKER_SH='bash -c'` makes the "box" this machine, and `docker` on PATH is the fake: it
// answers the kernel's migration list and the table count from the gold, and does nothing else — so what the
// log shows is exactly what the script ASKED for.
function scratchBox() {
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-guard-'));
  mkdirSync(join(dir, 'bin'));
  for (const f of ['bin/snapshot.sh', 'bin/snapshot-pair.mjs', 'bin/box-down.sh', 'bin/birth-remote.sh', 'bin/box-up.sh', 'bin/images-from-lock.sh', 'bin/require-node.sh', 'env-source.sh', 'forge.lock']) {
    cpSync(join(ROOT, f), join(dir, f));
  }
  writeFileSync(join(dir, '.secrets'), 'forge-postgres-password=pw-box\nforge-vault-key=vault-gold\nforge-smtp-pass=identity-untouched\nforge-operator-token=tok-reborn\nforge-operator-token-intruder=tok-later-tenant\n');
  writeFileSync(join(dir, '.env'), 'FORGE_PUBLIC_ORIGIN=https://example.invalid\nFORGE_STORE_HOSTS=\'{"a":"sto_REBORN"}\'\nFORGE_ADMIN_SEED_EMAIL=owner@example.invalid\n');
  const fakeBin = join(dir, 'fake-bin');
  mkdirSync(fakeBin);
  writeFileSync(
    join(fakeBin, 'docker'),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${dir}/docker.log"
case "$*" in
  *"--entrypoint sh kernel"*) printf '/app/x/db/migrations/system/0001_core.sql\\n/app/x/db/migrations/system/0002_x.sql\\n/app/x/db/migrations/tenant/0001_t.sql\\n' ;;
  *"exec -T postgres psql"*) if grep -q _system_migrations; then printf 'system/0001_core.sql\nsystem/0002_x.sql\n'; else cat "${dir}/counts.fixture"; fi ;;
  *"exec -T postgres pg_dump"*) printf 'PGDMP fake dump' ;;
  *"exec -T postgres sh -c"*) cat >/dev/null ;;
  *"volume inspect"*) exit 1 ;;
esac
exit 0
`,
  );
  chmodSync(join(fakeBin, 'docker'), 0o755);
  // A gold, as `take` seals one.
  const g = join(dir, 'gold/g1');
  mkdirSync(g, { recursive: true });
  const names = mintedNames(read('bin/box-up.sh'));
  writeFileSync(join(g, 'pair-names.json'), JSON.stringify(names));
  writeFileSync(join(g, 'pair.env'), "FORGE_STORE_HOSTS='{\"a\":\"sto_GOLD\"}'\nFORGE_COFFEE_STORE_ID=sto_GOLD_CAFE\n");
  writeFileSync(join(g, 'pair.secrets'), 'forge-vault-key=vault-gold\nforge-operator-token=tok-gold\n');
  writeFileSync(join(g, 'pair-secret-names'), 'forge-vault-key\nforge-operator-token\n');
  writeFileSync(join(g, 'counts.tsv'), 'forge_control.tenant\t1\n');
  writeFileSync(join(dir, 'counts.fixture'), 'forge_control.tenant\t1\n');
  writeFileSync(join(g, 'db.dump'), 'not really a dump');
  writeFileSync(
    join(g, 'manifest.json'),
    JSON.stringify({ format: 1, forgeVersion: 'v0.3.2', migrations: ['system/0001_core.sql', 'system/0002_x.sql'], counts: { 'forge_control.tenant': 1 }, pair: names }),
  );
  const sums = () => spawnSync('bash', ['-c', 'cd gold/g1 && sha256sum -- $(ls | grep -v SHA256SUMS) > SHA256SUMS'], { cwd: dir });
  sums();
  writeFileSync(join(dir, 'gold/LATEST'), 'g1\n');
  // ★ THE REMOTE PATH, WITHOUT A REMOTE: `deploy/fake.env` names THIS directory as the box, and `ssh` on PATH
  // runs its last argument here — so `--env fake` drives the real vehicle (bin/remote-box.sh), the real
  // `box-down --env`, and the real tar-over-ssh of pull/push, against a box that is a folder.
  mkdirSync(join(dir, 'deploy'));
  writeFileSync(join(dir, 'deploy/box.env'), 'FORGE_DEPLOY_USER=root\n');
  writeFileSync(
    join(dir, 'deploy/fake.env'),
    `FORGE_DEPLOY_HOST=box.invalid\nFORGE_DEPLOY_DIR=${dir}\nFORGE_DOMAIN=a.invalid\nFORGE_ADMIN_DOMAIN=b.invalid\nFORGE_PUBLIC_ORIGIN=https://a.invalid\n`,
  );
  cpSync(join(ROOT, 'bin/remote-box.sh'), join(dir, 'bin/remote-box.sh'));
  writeFileSync(join(fakeBin, 'ssh'), `#!/usr/bin/env bash\nprintf 'ssh %s\\n' "\${@: -1}" >> "${dir}/docker.log"\nexec bash -c "\${@: -1}"\n`);
  chmodSync(join(fakeBin, 'ssh'), 0o755);
  const home = join(dir, 'operator-home');
  const run = (args) =>
    spawnSync('bash', [join(dir, 'bin/snapshot.sh'), ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, FORGE_DOCKER_SH: 'bash -c', COMPOSE_PROJECT_NAME: 'snapguard', FORGE_NODE: process.execPath, FORGE_GOLD_HOME: home },
    });
  const log = () => {
    try {
      return readFileSync(join(dir, 'docker.log'), 'utf8');
    } catch {
      return '';
    }
  };
  return { dir, g, home, run, log, sums, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
const DESTRUCTIVE = [/compose .*\bdown\b/, /volume rm/, /pg_restore/];
const assertUntouched = (log, why) => {
  for (const d of DESTRUCTIVE) assert.ok(!d.test(log), `${why} — and the box was touched anyway: ${log.split('\n').find((l) => d.test(l))}`);
};

test('the script REFUSES before box-down: no gold, no pair, bad sums, a gold newer than the kernel', () => {
  const cases = [
    ['no gold', (s) => rmSync(join(s.dir, 'gold'), { recursive: true }), /NO GOLD/],
    ['no pair', (s) => { writeFileSync(join(s.g, 'pair.secrets'), ''); s.sums(); }, /NO PAIR/],
    ['bad sums', (s) => writeFileSync(join(s.g, 'db.dump'), 'edited after the take'), /SHA256SUMS/],
    ['newer gold', (s) => {
      const m = JSON.parse(readFileSync(join(s.g, 'manifest.json'), 'utf8'));
      m.migrations.push('system/0099_future.sql');
      writeFileSync(join(s.g, 'manifest.json'), JSON.stringify(m));
      s.sums();
    }, /NEWER THAN THIS KERNEL/],
  ];
  for (const [name, spoil, why] of cases) {
    const s = scratchBox();
    try {
      spoil(s);
      const r = s.run(['restore']);
      assert.notEqual(r.status, 0, `${name}: the restore went ahead`);
      assert.match(r.stderr, why, `${name}: refused for another reason:\n${r.stderr}`);
      assertUntouched(s.log(), name);
      assert.equal(readFileSync(join(s.dir, '.secrets'), 'utf8').includes('tok-reborn'), true, `${name}: .secrets was rewritten`);
    } finally {
      s.cleanup();
    }
  }
});

test('★ the restore PUTS THE PAIR BACK — the gold’s values replace the later birth’s, everything else untouched', () => {
  const s = scratchBox();
  try {
    const r = s.run(['restore', '--no-start']);
    assert.equal(r.status, 0, `the restore of a whole gold failed:\n${r.stderr}`);
    const log = s.log();
    assert.match(log, /compose .*down/, 'the restore never tore the state down');
    assert.match(log, /pg_restore/, 'the restore never restored the dump');
    assert.match(log, /dist\/migrate\.js/, 'the restore never migrated');
    // the order IS the safety: down → restore → migrate
    assert.ok(log.indexOf('down') < log.indexOf('pg_restore') && log.indexOf('pg_restore') < log.indexOf('migrate.js'), log);
    const secrets = readFileSync(join(s.dir, '.secrets'), 'utf8');
    const env = readFileSync(join(s.dir, '.env'), 'utf8');
    assert.match(secrets, /^forge-operator-token=tok-gold$/m, 'the gold’s operator token is not back');
    assert.doesNotMatch(secrets, /tok-reborn/, 'the token a later birth minted survived — it does not match the restored database');
    // A stray (a tenant the gold never had) is KEPT and NAMED: deleting covered lines the gold lacks is what
    // once deleted FORGE_PUBLIC_ORIGIN and left a box compose could not start (see PAIR_PUT_PY).
    assert.match(secrets, /^forge-operator-token-intruder=tok-later-tenant$/m, 'a line the gold does not NAME was deleted');
    assert.match(r.stderr, /kept, not in the gold: forge-operator-token-intruder/, 'the stray was kept silently');
    assert.doesNotMatch(r.stderr, /tok-later-tenant|tok-gold|vault-gold/, 'the restore printed a secret VALUE');
    assert.match(secrets, /^forge-smtp-pass=identity-untouched$/m, 'IDENTITY was touched by a restore');
    assert.match(secrets, /^forge-postgres-password=pw-box$/m);
    assert.equal(statSync(join(s.dir, '.secrets')).mode & 0o777, 0o600, '.secrets is not 600 after the restore');
    assert.match(env, /^FORGE_STORE_HOSTS='\{"a":"sto_GOLD"\}'$/m, 'the host map still points at the reborn store');
    assert.match(env, /^FORGE_COFFEE_STORE_ID=sto_GOLD_CAFE$/m);
    assert.match(env, /^FORGE_ADMIN_SEED_EMAIL=owner@example.invalid$/m, 'a line the pair does not cover was lost');
    assert.match(env, /^FORGE_PUBLIC_ORIGIN=https:\/\/example.invalid$/m);
  } finally {
    s.cleanup();
  }
});

test('the box-side selection (python) and the node rule agree line for line', () => {
  const m = /^PAIR_TAKE_PY='([\s\S]*?)^'$/m.exec(SCRIPT);
  assert.ok(m, 'PAIR_TAKE_PY is not between the markers any more');
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-pair-'));
  try {
    const names = mintedNames(read('bin/birth-remote.sh'));
    const env = "FORGE_STORE_HOSTS='{}'\nFORGE_DOMAIN=x\n# FORGE_TOTEM_STORE_ID=commented\nFORGE_TOTEM_STORE_ID=sto_1\nFORGE_REVALIDATE_SECRET=abc\n";
    const sec = 'forge-vault-key=v\nforge-operator-token=a\nforge-operator-token-cafe=b\nforge-smtp-pass=c\nforge-admin-access-key-x=d\nforge-bulk-read-token=e\n';
    writeFileSync(join(dir, 'n.json'), JSON.stringify(names));
    writeFileSync(join(dir, '.env'), env);
    writeFileSync(join(dir, '.secrets'), sec);
    const r = spawnSync('python3', ['-c', m[1], 'n.json', '.env', '.secrets', 'p.env', 'p.secrets'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout + r.stderr, /=a|=b|=d|=e|=v/, 'the box-side selection printed a VALUE');
    const lines = (f) => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean);
    assert.deepEqual(lines('p.env'), selectPair(env, (k) => names.env.includes(k)));
    assert.deepEqual(lines('p.secrets'), selectPair(sec, (k) => secretInPair(k, names)));
    assert.equal(statSync(join(dir, 'p.secrets')).mode & 0o777, 0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the judgement runs before box-down in the restore — in the CODE, not in a comment', () => {
  const body = codeOnly(/^restore\(\) \{([\s\S]*?)^\}/m.exec(SCRIPT)[1]);
  const judge = body.indexOf('snapshot-pair.mjs" judge');
  const down = body.indexOf('bin/box-down.sh"');
  assert.ok(judge > 0 && down > 0, 'restore() no longer calls the judgement or box-down');
  assert.ok(judge < down, 'restore() tears the state down BEFORE it judges the gold');
});

// ── 4 · NOTHING A FRONT RENDERED SURVIVES ───────────────────────────────────────────────────────────────────
test('every mount is read-only or a volume box-down classifies — no front keeps a render cache across a restore', () => {
  const boxDown = read('bin/box-down.sh');
  const classified = new Set(['STATE', 'IDENTITY', 'CACHE'].flatMap((k) => (new RegExp(`^${k}='([^']*)'`, 'm').exec(boxDown)?.[1] ?? '').split(/\s+/).filter(Boolean)));
  let seen = 0;
  for (const file of ['compose.yml', 'compose.override.yml']) {
    const lines = read(file).split('\n');
    let inVolumes = false;
    for (const line of lines) {
      if (/^ {4}volumes:\s*$/.test(line)) { inVolumes = true; continue; }
      if (inVolumes && /^ {6}- /.test(line)) {
        seen++;
        const entry = line.replace(/^ {6}- /, '').replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '');
        const named = /^([a-z0-9_]+):\//.exec(entry);
        assert.ok(
          entry.endsWith(':ro') || (named && classified.has(named[1])),
          `${file}: \`${entry}\` is a WRITABLE mount that bin/box-down.sh does not classify. A restore's \`down\` ` +
            'does not destroy it and the gold does not carry it — whatever a container writes there (a render ' +
            'cache, an upload) survives the reset. Make it read-only, or a named volume box-down classifies.',
        );
        continue;
      }
      if (inVolumes && !/^ {6,}/.test(line) && line.trim() !== '' && !/^\s*#/.test(line)) inVolumes = false;
    }
  }
  assert.ok(seen >= 10, `read only ${seen} mount(s) out of the compose — the parse is broken, not the tree`);
});

test('★ a gold that dies with the disk is not a gold: take copies it OFF the box, push puts it back, restore uses it', () => {
  const s = scratchBox();
  try {
    rmSync(join(s.dir, 'gold'), { recursive: true });
    const take = s.run(['take', '--env', 'fake', '--label', 'ouro']);
    assert.equal(take.status, 0, `the remote take failed:\n${take.stderr}`);
    const copy = join(s.home, 'fake', 'ouro');
    assert.ok(statSync(join(copy, 'manifest.json')).isFile(), 'take --env left no copy off the box');
    assert.equal(statSync(join(copy, 'pair.secrets')).mode & 0o777, 0o600, 'the off-box pair is readable by others');
    assert.match(readFileSync(join(copy, 'pair.secrets'), 'utf8'), /^forge-operator-token=tok-reborn$/m, 'the pair taken is not the box’s');
    assert.doesNotMatch(take.stderr, /tok-reborn|vault-gold/, 'the take printed a secret VALUE');
    // the disk dies
    rmSync(join(s.dir, 'gold'), { recursive: true });
    const refused = s.run(['restore', '--env', 'fake']);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /NO GOLD/);
    assertUntouched(s.log(), 'a box with no gold');
    // the operator puts it back, and the box comes back to it
    writeFileSync(join(s.dir, '.secrets'), 'forge-postgres-password=pw-box\nforge-vault-key=vault-gold\nforge-operator-token=tok-even-later\n');
    const push = s.run(['push', '--env', 'fake', '--label', 'ouro']);
    assert.equal(push.status, 0, `push failed:\n${push.stderr}`);
    const back = s.run(['restore', '--env', 'fake', '--no-start']);
    assert.equal(back.status, 0, `the restore of a pushed gold failed:\n${back.stderr}`);
    assert.match(readFileSync(join(s.dir, '.secrets'), 'utf8'), /^forge-operator-token=tok-reborn$/m, 'the pushed gold’s pair was not put back');
    assert.match(s.log(), /ssh .*box-down|compose .*down/, 'the remote restore never tore the state down');
  } finally {
    s.cleanup();
  }
});

// ── THE DEMO'S POLICY ──────────────────────────────────────────────────────────────────────────────────────
// `bin/demo-reset.sh` is run with its three verdicts and the snapshot replaced by recorders, so what is graded
// is the ORDER it asks for things in: a gold is never taken from a box that does not answer, and a reset
// that comes back red says so with a non-zero exit.
function policyBox({ proveShop = 0, dataOnly = 0, verdictOnly = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'demo-reset-guard-'));
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(dir, 'deploy'));
  writeFileSync(join(dir, 'deploy/stag.env'), '');
  cpSync(join(ROOT, 'bin/demo-reset.sh'), join(dir, 'bin/demo-reset.sh'));
  const rec = (name, rc) => `printf '%s %s\\n' ${name} "$*" >> "${dir}/calls.log"; exit ${rc}\n`;
  writeFileSync(join(dir, 'bin/prove-shop.mjs'), `(await import('node:fs')).appendFileSync('${dir}/calls.log', 'prove-shop\\n'); process.exit(${proveShop});\n`);
  writeFileSync(join(dir, 'bin/birth-remote.sh'), `case "$*" in *--data-only*) ${rec('birth-remote', dataOnly)};; *--verdict-only*) ${rec('birth-remote', verdictOnly)};; *) ${rec('birth-remote', 0)};; esac\n`);
  writeFileSync(join(dir, 'bin/snapshot.sh'), rec('snapshot', 0));
  const run = (args) => spawnSync('bash', [join(dir, 'bin/demo-reset.sh'), ...args], { cwd: dir, encoding: 'utf8' });
  const calls = () => {
    try {
      return readFileSync(join(dir, 'calls.log'), 'utf8');
    } catch {
      return '';
    }
  };
  return { run, calls, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('the demo takes NO gold from a box that does not answer its verdicts — and takes one from a box that does', () => {
  for (const bad of [{ proveShop: 1 }, { dataOnly: 1 }]) {
    const p = policyBox(bad);
    try {
      const r = p.run(['stag', '--take-gold']);
      assert.notEqual(r.status, 0, `${JSON.stringify(bad)}: a gold was taken from a red box`);
      assert.doesNotMatch(p.calls(), /^snapshot take/m, `${JSON.stringify(bad)}: the snapshot ran anyway`);
    } finally {
      p.cleanup();
    }
  }
  const p = policyBox();
  try {
    const r = p.run(['stag', '--take-gold', '--label', 'ouro']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(p.calls(), /prove-shop\nbirth-remote stag --data-only\nsnapshot take --env stag --label ouro\n/);
  } finally {
    p.cleanup();
  }
});

test('a reset restores FIRST and then asks every verdict; a red verdict is a red reset', () => {
  const p = policyBox({ verdictOnly: 1 });
  try {
    const r = p.run(['stag']);
    assert.notEqual(r.status, 0, 'a reset whose doors did not open exited 0');
    assert.match(r.stderr, /DOES NOT ANSWER: verdict-only/);
    assert.match(p.calls(), /^snapshot restore --env stag\nprove-shop\nbirth-remote stag --data-only\nbirth-remote stag --verdict-only\n$/);
  } finally {
    p.cleanup();
  }
});
