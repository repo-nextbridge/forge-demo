// ★★ N BENCHES ON ONE MACHINE — the project a checkout may touch, and the doors one number derives (DX-I3).
//
//   node --test bin/bench-parallel.guard.mjs      (or: bash bin/test.sh)
//
// ⛔ THE DEFECT, MEASURED 2026-10-10 (RESULTADOS-dx0 N8, line 2). `COMPOSE_PROJECT_NAME` defaulted to
// `forge-preseed` in `bin/box-up.sh` and `bin/box-down.sh` and appeared in neither the README nor
// `.env.example`. Two checkouts without it are ONE compose project: the second `box-up` recreates the first
// bench's containers and adopts its volumes, the second `box-down` destroys its database. And a second
// bench's doors were seven `.env` lines that had to move together by hand.
//
// WHAT THIS HOLDS, BY RUNNING THE SCRIPTS (not by reading them):
//   1. `box-down` and `box-up`, run from a checkout whose project name is OWNED by another directory (the
//      `com.docker.compose.project.working_dir` label compose stamps on every container), REFUSE — naming
//      the owner — before a single compose command. A fake `docker` on PATH records every call.
//   2. The project they ask about is the one `.env` names, not the `forge-preseed` default.
//   3. `FORGE_BENCH_PORT_BLOCK=NN` writes the seven doors and the origin into `.env`, keeps a value off the
//      block's shape as an override, and — undeclared — leaves `.env` byte for byte. The default block, 82,
//      applied to `.env.example` changes nothing: the derivation IS the layout the template ships.
//
// ⚠️ WHAT IT DOES NOT REACH: a real docker. The label read is the one measured live in the DX-I3 report
// (`docker ps -a --filter label=com.docker.compose.project=<p> --format '{{.Label "…working_dir"}}'`); here
// the fake answers it.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const BOX_UP = read('bin/box-up.sh');

/** A scratch checkout with a fake `docker` that answers `ps` with `owner` as the project's working dir. */
function scratch({ owner, env = '' }) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'bench-parallel-')));
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(dir, 'seed'));
  for (const f of ['bin/box-up.sh', 'bin/box-down.sh', 'bin/require-node.sh', 'forge.lock', 'seed/box.json']) {
    cpSync(join(ROOT, f), join(dir, f));
  }
  writeFileSync(join(dir, 'env-source.sh'), 'export DATABASE_URL=postgres://guard\n');
  writeFileSync(join(dir, '.env'), env);
  const fake = join(dir, 'fake-bin');
  mkdirSync(fake);
  writeFileSync(
    join(fake, 'docker'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${dir}/docker.log"\n` +
      `case "$*" in\n  "ps -a --filter label=com.docker.compose.project="*) [ -n "$OWNER" ] && printf '%s\\n' "$OWNER" ;;\n` +
      `  *"volume inspect"*) exit 1 ;;\nesac\nexit 0\n`,
  );
  chmodSync(join(fake, 'docker'), 0o755);
  const run = (script, args = []) => {
    const proc = spawnSync('bash', [join(dir, script), ...args], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        PATH: `${fake}:${process.env.PATH}`,
        FORGE_DOCKER_SH: 'bash -c',
        OWNER: owner === 'self' ? dir : owner,
        COMPOSE_PROJECT_NAME: '',
      },
    });
    const log = existsSync(join(dir, 'docker.log')) ? readFileSync(join(dir, 'docker.log'), 'utf8') : '';
    return { status: proc.status, out: `${proc.stdout}${proc.stderr}`, log };
  };
  return { dir, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const OTHER = '/home/someone/forge-demo-first-bench';

test('★★ box-down from a second checkout REFUSES to tear down the bench that owns the name — before any compose call', () => {
  const box = scratch({ owner: OTHER, env: 'COMPOSE_PROJECT_NAME=dxi3-guard\nFORGE_BENCH_BIND=127.0.0.1\n' });
  try {
    for (const args of [[], ['--all'], ['--plan']]) {
      const { status, out, log } = box.run('bin/box-down.sh', args);
      assert.notEqual(status, 0, `box-down ${args.join(' ')} tore down a bench owned by ${OTHER}:\n${out}`);
      assert.match(out, new RegExp(`belongs to ANOTHER checkout: ${OTHER}`), `the refusal does not name the owner:\n${out}`);
      assert.ok(!/^compose |volume rm/m.test(log), `box-down ${args.join(' ')} touched the other bench before refusing:\n${log}`);
    }
  } finally {
    box.cleanup();
  }
});

test('box-down from the checkout that OWNS the project tears it down (the control: the refusal is not a wall)', () => {
  const box = scratch({ owner: 'self', env: 'COMPOSE_PROJECT_NAME=dxi3-guard\nFORGE_BENCH_BIND=127.0.0.1\n' });
  try {
    const { status, out, log } = box.run('bin/box-down.sh');
    assert.equal(status, 0, out);
    assert.match(log, /compose down --remove-orphans/, `the owner's own box-down did not run:\n${log}`);
  } finally {
    box.cleanup();
  }
});

test('★ the project asked about is the one `.env` names — not the forge-preseed default — in box-down AND box-up', () => {
  const box = scratch({ owner: '', env: 'COMPOSE_PROJECT_NAME=dxi3-guard\nFORGE_BENCH_BIND=127.0.0.1\n' });
  try {
    const down = box.run('bin/box-down.sh', ['--plan']);
    assert.match(down.log, /^ps -a --filter label=com\.docker\.compose\.project=dxi3-guard /m, `box-down asked about another project:\n${down.log}`);
    assert.ok(!/forge-preseed/.test(down.log), `box-down still reached for forge-preseed:\n${down.log}`);
    rmSync(join(box.dir, 'docker.log'));
    const up = box.run('bin/box-up.sh', ['--warm-only']);
    assert.match(up.log, /^ps -a --filter label=com\.docker\.compose\.project=dxi3-guard /m, `box-up asked about another project:\n${up.log}\n${up.out}`);
  } finally {
    box.cleanup();
  }
});

test('★★ box-up from a second checkout REFUSES before any compose call — and before it writes a byte of .env', () => {
  const env = 'COMPOSE_PROJECT_NAME=dxi3-guard\nFORGE_BENCH_BIND=127.0.0.1\nFORGE_BENCH_PORT_BLOCK=87\nFORGE_HTTP_PORT=8200\n';
  const box = scratch({ owner: OTHER, env });
  try {
    for (const args of [[], ['--warm-only'], ['--promote', 'localhost']]) {
      const { status, out, log } = box.run('bin/box-up.sh', args);
      assert.notEqual(status, 0, `box-up ${args.join(' ')} went on over a bench owned by ${OTHER}:\n${out}`);
      assert.match(out, new RegExp(`belongs to ANOTHER checkout: ${OTHER}`), `the refusal does not name the owner:\n${out}`);
      assert.ok(!/^compose /m.test(log), `box-up ${args.join(' ')} spoke compose before refusing:\n${log}`);
      assert.equal(readFileSync(join(box.dir, '.env'), 'utf8'), env, 'the refusal rewrote .env (the port block ran first)');
    }
  } finally {
    box.cleanup();
  }
});

// ── the port block, run out of `bin/box-up.sh` itself ─────────────────────────────────────────────────────────

/** The block between the markers, plus the `put_env` it writes through — the code box-up runs, not a copy. */
function blockScript() {
  const block = BOX_UP.match(/\n# >>> THE BENCH'S NAME AND DOORS\n([\s\S]*?)\n# <<< THE BENCH'S NAME AND DOORS\n/);
  assert.ok(block, "bin/box-up.sh lost its `# >>> THE BENCH'S NAME AND DOORS` markers — this guard would grade nothing");
  const putEnv = BOX_UP.match(/\nput_env\(\) \{[\s\S]*?\n\}\n/);
  assert.ok(putEnv, 'bin/box-up.sh no longer defines put_env() — the block writes through it');
  return `note() { printf '   %s\\n' "$*" >&2; }\n${putEnv[0]}\n${block[1]}\nbench_port_block\n`;
}

/** Run the block over an `.env` and return the file it left, and what it said. */
function applyBlock(envText) {
  const dir = mkdtempSync(join(tmpdir(), 'bench-block-'));
  try {
    writeFileSync(join(dir, '.env'), envText);
    const proc = spawnSync('bash', ['-c', `HERE=${JSON.stringify(dir)}\n${blockScript()}`], { encoding: 'utf8' });
    return { status: proc.status, out: `${proc.stdout}${proc.stderr}`, env: readFileSync(join(dir, '.env'), 'utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const valueOf = (envText, name) => envText.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1];
const DOORS = ['FORGE_HTTP_PORT', 'FORGE_ADMIN_HTTP_PORT', 'FORGE_ADMIN2_HTTP_PORT', 'FORGE_TOTEM_HTTP_PORT', 'FORGE_MAIL_HTTP_PORT', 'FORGE_HTTPS_PORT'];
const TEMPLATE = read('.env.example');

test('★★ FORGE_BENCH_PORT_BLOCK=86 writes all seven: six distinct doors in 86xx and the origin at 8600', () => {
  const { status, out, env } = applyBlock(`${TEMPLATE}\nFORGE_BENCH_PORT_BLOCK=86\n`);
  assert.equal(status, 0, out);
  const ports = DOORS.map((d) => valueOf(env, d));
  assert.deepEqual(ports, ['8600', '8601', '8602', '8603', '8604', '8643'], `the block did not derive the doors:\n${out}`);
  assert.equal(new Set(ports).size, DOORS.length, 'two doors of one bench share a port');
  assert.equal(valueOf(env, 'FORGE_PUBLIC_ORIGIN'), 'http://localhost:8600', 'the origin still mints image URLs at another bench');
  // and every other line of the template survives untouched
  assert.equal(env.split('\n').length, `${TEMPLATE}\nFORGE_BENCH_PORT_BLOCK=86\n`.split('\n').length, 'the block added or dropped lines');
});

test('★ the default block, 82, over .env.example changes NOTHING — the derivation is the layout the template ships', () => {
  const text = `${TEMPLATE}\nFORGE_BENCH_PORT_BLOCK=82\n`;
  const { status, out, env } = applyBlock(text);
  assert.equal(status, 0, out);
  assert.equal(env, text, `block 82 rewrote the template's own doors — the block layout and .env.example disagree:\n${out}`);
});

test('no declaration, no write — a bench on hand-set ports (83xx) keeps its .env byte for byte', () => {
  const text = 'FORGE_HTTP_PORT=8300\nFORGE_ADMIN_HTTP_PORT=8301\nFORGE_PUBLIC_ORIGIN=http://localhost:8300\n';
  const { status, env } = applyBlock(text);
  assert.equal(status, 0);
  assert.equal(env, text);
});

test('an individual line OFF the block shape is an override and is kept; ON it, the block wins when it moves', () => {
  const text = 'FORGE_BENCH_PORT_BLOCK=87\nFORGE_HTTP_PORT=8080\nFORGE_ADMIN_HTTP_PORT=8601\nFORGE_PUBLIC_ORIGIN=https://bench.example.test\n';
  const { status, out, env } = applyBlock(text);
  assert.equal(status, 0, out);
  assert.equal(valueOf(env, 'FORGE_HTTP_PORT'), '8080', 'an explicit override was overwritten');
  assert.equal(valueOf(env, 'FORGE_PUBLIC_ORIGIN'), 'https://bench.example.test', 'a promoted origin was overwritten');
  assert.equal(valueOf(env, 'FORGE_ADMIN_HTTP_PORT'), '8701', 'a door left by an older block (86) did not follow the block to 87');
  assert.equal(valueOf(env, 'FORGE_MAIL_HTTP_PORT'), '8704', 'an absent door was not written');
  assert.match(out, /kept as an override \(off the block's shape\): FORGE_HTTP_PORT FORGE_PUBLIC_ORIGIN/);
});

test('a block that is not a block is a refusal, and .env is untouched', () => {
  for (const bad of ['8', '10', '100', 'eighty', '8600']) {
    const text = `FORGE_BENCH_PORT_BLOCK=${bad}\nFORGE_HTTP_PORT=8200\n`;
    const { status, out, env } = applyBlock(text);
    assert.notEqual(status, 0, `FORGE_BENCH_PORT_BLOCK=${bad} was accepted:\n${out}`);
    assert.equal(env, text);
  }
});

test('the refusal and the block run BEFORE step 0 sources .env (in the code, comments stripped)', () => {
  const code = BOX_UP.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const refuse = code.indexOf('\nbench_refuse_foreign_project\n');
  const block = code.indexOf('\nbench_port_block\n');
  const step0 = code.indexOf('\n. "$HERE/env-source.sh"');
  assert.ok(refuse > 0 && block > 0 && step0 > 0, 'box-up no longer calls the refusal and the block, or lost step 0');
  assert.ok(refuse < block, 'the block writes .env before the refusal asks whose bench this is');
  assert.ok(block < step0, 'step 0 reads .env before the block has written it — the first compose call would publish the old doors');
});

// ── the admin doors the directory is told about — they move with the block too ─────────────────────────────
// MEASURED on this slice's first 86xx birth: the edge published the admins on 8601/8602 while step 3 claimed
// localhost:8201/8202 and wrote both into the sibling switcher and the gate links. Green, and a login refused.

/** The admin addresses box-up derives, run out of box-up itself: `admin_host_of`, the switcher, the gate links. */
function adminDoors(block, host = '') {
  const fn = (name) => {
    const m = BOX_UP.match(new RegExp(`\\n${name}\\(\\) \\{[\\s\\S]*?\\n\\}\\n`));
    assert.ok(m, `bin/box-up.sh no longer defines ${name}()`);
    return m[0];
  };
  const block_ = BOX_UP.match(/\n# >>> THE BENCH'S NAME AND DOORS\n([\s\S]*?)\n# <<< THE BENCH'S NAME AND DOORS\n/)[1];
  // ★ THE BLOCK REACHES THE ADMIN DOORS THROUGH `.env`, the way a birth does: `bench_port_block` reads the
  //   declaration and is what sets it — a test that set the shell variable itself would pass over a box-up
  //   whose block never reached the admins.
  const here = mkdtempSync(join(tmpdir(), 'bench-admin-'));
  writeFileSync(join(here, '.env'), block ? `FORGE_BENCH_PORT_BLOCK=${block}\n` : '');
  const putEnv = BOX_UP.match(/\nput_env\(\) \{[\s\S]*?\n\}\n/)[0];
  const script =
    `HERE=${JSON.stringify(here)}\nBOX=${JSON.stringify(join(ROOT, 'seed/box.json'))}\nnote() { :; }\n${putEnv}\n${block_}\nbench_port_block\n` +
    `${fn('admin_siblings_json')}\n${fn('admin_gate_urls_json')}\n` +
    `for t in $(jq -r '.tenants[].id' "$BOX"); do printf 'host %s %s\\n' "$t" "$(admin_host_of "$t")"; done\n` +
    `printf 'siblings %s\\n' "$(admin_siblings_json ${JSON.stringify(host)})"\nprintf 'gate %s\\n' "$(admin_gate_urls_json ${JSON.stringify(host)})"\n`;
  const proc = spawnSync('bash', ['-c', script], { encoding: 'utf8' });
  rmSync(here, { recursive: true, force: true });
  assert.equal(proc.status, 0, proc.stderr);
  const lines = proc.stdout.trim().split('\n');
  const hosts = Object.fromEntries(lines.filter((l) => l.startsWith('host ')).map((l) => l.split(' ').slice(1)));
  const siblings = JSON.parse(lines.find((l) => l.startsWith('siblings ')).slice(9)).map((e) => e.url);
  const gate = Object.values(JSON.parse(lines.find((l) => l.startsWith('gate ')).slice(5)));
  return { hosts, siblings, gate };
}

test('★★ seed/box.json declares its admin doors on .env.example\'s two admin ports — what makes the "82" in box-up right', () => {
  const box = JSON.parse(read('seed/box.json'));
  const declared = box.tenants.filter((t) => t.admin_host).map((t) => t.admin_host);
  assert.deepEqual(
    declared,
    [`localhost:${valueOf(TEMPLATE, 'FORGE_ADMIN_HTTP_PORT')}`, `localhost:${valueOf(TEMPLATE, 'FORGE_ADMIN2_HTTP_PORT')}`],
    'the admin doors seed/box.json declares are no longer the two the template publishes — box-up moves `localhost:82NN` with the block, and this is the pair it assumes',
  );
});

test('★★ FORGE_BENCH_PORT_BLOCK=86 moves the claimed admin doors, the switcher and the gate links to 8601/8602', () => {
  const { hosts, siblings, gate } = adminDoors('86');
  assert.deepEqual(Object.values(hosts), ['localhost:8601', 'localhost:8602'], 'step 3 would claim another bench\'s admin door');
  assert.deepEqual(siblings, ['http://localhost:8601', 'http://localhost:8602'], 'the switcher points at another bench');
  assert.deepEqual(gate, ['http://localhost:8601', 'http://localhost:8602'], 'the gate links point at another bench');
});

test('no block, no move — the default bench claims what seed/box.json says; a promotion keeps the moved PORT', () => {
  assert.deepEqual(Object.values(adminDoors('').hosts), ['localhost:8201', 'localhost:8202']);
  assert.deepEqual(adminDoors('87', 'bench.example.test').siblings, ['http://bench.example.test:8701', 'http://bench.example.test:8702']);
});

test('★ every read of `.admin_host` in box-up goes through `bench_host` (in the CODE, comments stripped)', () => {
  const code = BOX_UP.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*#/.test(l));
  const reads = code.filter(([, l]) => /\.admin_host\b/.test(l));
  assert.ok(reads.length >= 3, 'box-up reads `.admin_host` fewer than three times — this rule lost its subjects');
  const raw = reads.filter(([, l]) => !/bench_host/.test(l));
  assert.deepEqual(
    raw.map(([n, l]) => `bin/box-up.sh:${n}  ${l.trim()}`),
    [],
    'a read of seed/box.json\'s admin_host that does not move with the port block — on any block but 82 it claims or links another bench\'s admin',
  );
});

test('step 6 asks the directory about the MOVED admin door too — and its repair hint names that door (bin/seed-box.mjs)', () => {
  const code = read('bin/seed-box.mjs').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const fn = code.match(/async function verifyAdminHost\(\) \{[\s\S]*?\n\}\n/);
  assert.ok(fn, 'bin/seed-box.mjs no longer has verifyAdminHost() — say where step 6 checks the admin door now');
  assert.match(fn[0], /process\.env\.FORGE_BENCH_PORT_BLOCK/, 'step 6 no longer reads the port block');
  const uses = [...fn[0].matchAll(/spec\.admin_host/g)].length;
  assert.equal(uses, 3, `verifyAdminHost reads spec.admin_host ${uses}× — beyond the presence check and the derivation, every use must be the moved door`);
});
