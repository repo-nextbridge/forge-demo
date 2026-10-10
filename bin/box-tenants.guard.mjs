// ★★ DX-I5 — A BENCH OF ONLY THE TENANTS ASKED FOR: the steps build what was named, skip the rest BY NAME,
// and the verdicts do not accuse what is missing by design.
//
//   node --test bin/box-tenants.guard.mjs      (or: bash bin/test.sh)
//
// ⛔ WHAT IT STOPS, MEASURED 2026-10-10 (RESULTADOS-dx0, line 4): building only the café meant editing
// `seed/box.json`; not editing it cost step 9 of `forgeco` (23–32 min). A selection now exists
// (`bin/box-up.sh --tenant <id>`, `FORGE_BOX_TENANTS` in `.env`), and every rule below is one way it can
// quietly stop meaning what it says: a typo selecting nothing (or everything), a loop that still walks the
// whole declaration, a step that «ran» over nobody, a secret filed under another name, a verdict that
// accuses the tenant nobody asked for — or one that stops grading the tenant that WAS asked for.
// Each test lifts the real code out of `bin/box-up.sh` / runs the real `bin/verify-config.mjs`; nothing here
// re-states the rule it grades.

import { execFile, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

import { declaredTenants, resolveTenants, rootTenant } from './box-tenants.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOX_UP = join(ROOT, 'bin/box-up.sh');
const BOX = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'));
const DECLARED = declaredTenants(BOX);
const DATASET = BOX.tenants.filter((t) => t.dataset === true).map((t) => t.id);
const NOT_DATASET = DECLARED.filter((t) => !DATASET.includes(t));
const ROOT_T = rootTenant(BOX);

// ⚠️ ANTI-VACUUM: every rule below needs a box with a dataset tenant AND a tenant without one. A box.json of
// one tenant would make each «skips the other» assertion true of nothing.
test('the declaration has the shape these rules are about (a dataset tenant and one without)', () => {
  assert.ok(DATASET.length >= 1 && NOT_DATASET.length >= 1, `seed/box.json: dataset=${DATASET} other=${NOT_DATASET}`);
  assert.equal(ROOT_T, DECLARED[0]);
});

// ── 1 · the resolver ──────────────────────────────────────────────────────────────────────────────────────

test('★★ no selection is EVERY declared tenant — every bench born before DX-I5 builds what it built', () => {
  assert.deepEqual(resolveTenants({ declared: DECLARED }).wanted, DECLARED);
  assert.deepEqual(resolveTenants({ declared: DECLARED, fromEnv: " '' " }).wanted, DECLARED);
});

test('★★★ a name seed/box.json does not declare is REFUSED, naming it and every tenant that exists', () => {
  for (const args of [{ asked: ['forgecaf'] }, { fromEnv: 'nope' }, { asked: [NOT_DATASET[0], 'nope'] }]) {
    assert.throws(
      () => resolveTenants({ declared: DECLARED, ...args }),
      (e) => /not a tenant/.test(e.message) && DECLARED.every((t) => e.message.includes(t)) && /Nothing was touched/.test(e.message),
      JSON.stringify(args),
    );
  }
});

test('★★ the command line WINS over FORGE_BOX_TENANTS, both spellings parse, and the ORDER is the file\'s', () => {
  const r = resolveTenants({ declared: DECLARED, asked: [NOT_DATASET[0]], fromEnv: DATASET[0] });
  assert.deepEqual(r.wanted, [NOT_DATASET[0]]);
  assert.equal(r.source, 'command line');
  // Reversed on input, declaration order on output: `secret_name_for` and the root are positional.
  const both = resolveTenants({ declared: DECLARED, fromEnv: `${[...DECLARED].reverse().join(', ')}` });
  assert.deepEqual(both.wanted, DECLARED);
  assert.equal(both.source, 'FORGE_BOX_TENANTS');
});

// ── 2 · box-up, as a developer types it ──────────────────────────────────────────────────────────────────

/** A copy of what `--plan` reads, so a `.env` can be written beside it without touching this checkout's. */
function sandbox(envText = '') {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'box-tenants-')));
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(dir, 'seed'));
  for (const f of ['bin/box-up.sh', 'bin/box-tenants.mjs', 'bin/roteiro.mjs', 'bin/require-node.sh', 'forge.lock', 'seed/box.json']) {
    cpSync(join(ROOT, f), join(dir, f));
  }
  writeFileSync(join(dir, '.env'), envText);
  return dir;
}
function boxUp(dir, args, env = {}) {
  const r = spawnSync('bash', [join(dir, 'bin/box-up.sh'), ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
const willSkip = (out, id) => new RegExp(`⏭  ${id.replace('-', '\\-')}\\s.*WILL BE SKIPPED`).test(out);

test('★★★ `--tenant <unknown>` is refused BEFORE anything — exit 1, the stranger and the real ones named', () => {
  const dir = sandbox();
  try {
    const r = boxUp(dir, ['--plan', '--tenant', 'forgecaf']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /"forgecaf" is not a tenant/, r.out);
    for (const t of DECLARED) assert.ok(r.out.includes(t), `the refusal does not name ${t}:\n${r.out}`);
    assert.doesNotMatch(r.out, /THE ROTEIRO/, `a refused selection still printed a plan:\n${r.out}`);
    // …and the same refusal for the `.env` spelling.
    writeFileSync(join(dir, '.env'), 'FORGE_BOX_TENANTS=nope\n');
    const e = boxUp(dir, ['--plan']);
    assert.equal(e.status, 1, e.out);
    assert.match(e.out, /"nope" is not a tenant .*FORGE_BOX_TENANTS/, e.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('★★ `--tenant` with no id, and `--tenant` beside `--promote`, are refused instead of ignored', () => {
  const dir = sandbox();
  try {
    for (const args of [['--plan', '--tenant'], ['--plan', '--tenant', '--no-warm'], ['--promote', 'localhost', '--tenant', NOT_DATASET[0]]]) {
      const r = boxUp(dir, args);
      assert.equal(r.status, 1, `box-up ${args.join(' ')} was accepted:\n${r.out}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('★★★ the PLAN of a selection without the dataset tenant skips step 9 BY NAME — and the full plan does not', () => {
  const dir = sandbox();
  try {
    const only = boxUp(dir, ['--plan', '--tenant', NOT_DATASET[0]]);
    assert.equal(only.status, 0, only.out);
    assert.match(only.out, new RegExp(`tenants this birth builds: ${NOT_DATASET[0]}\\b`), only.out);
    assert.ok(willSkip(only.out, '9'), `step 9 is not announced as skipped:\n${only.out}`);
    assert.match(only.out, /23–32 min/, `the skip does not say what it saves:\n${only.out}`);
    if (!NOT_DATASET.includes(ROOT_T)) assert.ok(willSkip(only.out, '6b'), only.out);
    // ★ NEGATIVE CONTROL: with no selection nothing is skipped — the skip above is the selection's doing.
    const all = boxUp(dir, ['--plan']);
    assert.equal(all.status, 0, all.out);
    for (const id of ['9', '6b', '3c', '7']) assert.ok(!willSkip(all.out, id), `the full plan skips ${id}:\n${all.out}`);
    // ★ AND THE `.env` SPELLING IS THE SAME DECLARATION.
    writeFileSync(join(dir, '.env'), `FORGE_BOX_TENANTS=${NOT_DATASET[0]}\n`);
    const fromEnv = boxUp(dir, ['--plan']);
    assert.ok(willSkip(fromEnv.out, '9'), fromEnv.out);
    // …and the command line wins over it.
    const wins = boxUp(dir, ['--plan', '--tenant', DATASET[0]]);
    assert.ok(!willSkip(wins.out, '9'), wins.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 3 · the birth's own blocks, lifted out of the script ─────────────────────────────────────────────────

const SRC = readFileSync(BOX_UP, 'utf8');
/** Lines `from` (a line starting with it) up to the first line after it that starts with `to`, inclusive. */
function lift(from, to) {
  const lines = SRC.split('\n');
  const a = lines.findIndex((l) => l.startsWith(from));
  assert.ok(a > -1, `bin/box-up.sh no longer has a line starting with ${JSON.stringify(from)} — re-read this guard`);
  const b = lines.findIndex((l, i) => i > a && l.startsWith(to));
  assert.ok(b > -1, `no ${JSON.stringify(to)} after ${JSON.stringify(from)}`);
  return lines.slice(a, b + 1).join('\n');
}
function bash(script) {
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
const PRELUDE = `
set -uo pipefail
HERE=${JSON.stringify(ROOT)}
BOX="$HERE/seed/box.json"
MODE=birth
PLANNED_SKIPS=''
STEPS_SKIPPED=''
say() { printf 'SAY %s\\n' "$*"; }
note() { printf 'NOTE %s\\n' "$*"; }
skip() { printf 'SKIP %s\\n' "$1"; }
die() { printf 'DIE %s\\n' "$*"; exit 9; }
`;
/** The selection block and the line that narrows $TENANTS, exactly as box-up runs them. */
function selected(asked) {
  return `${PRELUDE}
ASKED_TENANTS=(${asked.map((t) => JSON.stringify(t)).join(' ')})
${lift('# >>> WHICH TENANTS THIS RUN BUILDS', '# <<< WHICH TENANTS THIS RUN BUILDS')}
${lift('TENANTS="$(jq -r', '[ "$MODE" = promote ]')}
${lift('secret_name_for() {', '}')}
`;
}

test('★★★ the per-tenant loops walk the SELECTION, and secrets keep the DECLARED names', () => {
  const t = NOT_DATASET[0];
  const r = bash(`${selected([t])}
printf 'TENANTS=%s\\n' "$(echo $TENANTS)"
printf 'DECLARED=%s\\n' "$(echo $DECLARED_TENANTS)"
for x in $TENANTS; do printf 'SECRET %s %s\\n' "$x" "$(secret_name_for "$x" seed)"; done`);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, new RegExp(`^TENANTS=${t}$`, 'm'), `$TENANTS is not the selection:\n${r.out}`);
  assert.match(r.out, new RegExp(`^DECLARED=${DECLARED.join(' ')}$`, 'm'), r.out);
  // ★ The tenant keeps the name a full bench files it under — the first DECLARED one is unsuffixed, not the
  //   first SELECTED one. Otherwise a café-only bench writes the café's token where forgeco's belongs.
  const expected = t === DECLARED[0] ? 'forge-operator-token' : `forge-operator-token-${t}`;
  assert.match(r.out, new RegExp(`^SECRET ${t} ${expected}$`, 'm'), r.out);
});

/** Step 9 lifted whole, with a `dc` that records which tenant it was asked to fill. */
function step9(asked) {
  return bash(`${selected(asked)}
DATASET_TENANTS=${JSON.stringify(DATASET.join(' '))}
dc() { printf 'DC %s\\n' "$*"; }
${lift('# >>> THE SPEAKING SEED', '# <<< THE SPEAKING SEED')}
${lift('if [ -z "$WANTED_DATASET" ]; then', 'fi')}
printf 'STEPS_SKIPPED=%s\\n' "$STEPS_SKIPPED"`);
}

test('★★★ step 9 is SKIPPED BY NAME when no dataset tenant is asked — never a title over an empty loop', () => {
  const only = step9([NOT_DATASET[0]]);
  assert.equal(only.status, 0, only.out);
  assert.match(only.out, /^SKIP 9$/m, `step 9 was not declared skipped:\n${only.out}`);
  assert.doesNotMatch(only.out, /^SAY 9 /m, `step 9 printed its title (and the roteiro would call it RAN):\n${only.out}`);
  assert.doesNotMatch(only.out, /^DC /m, `step 9 filled somebody:\n${only.out}`);
  // ★ NEGATIVE CONTROL: asked, the dataset tenant IS filled — and only it.
  const ds = step9([DATASET[0]]);
  assert.match(ds.out, /^SAY 9 /m, ds.out);
  assert.match(ds.out, new RegExp(`^DC run .*FORGE_REF_TENANT=${DATASET[0]}`, 'm'), ds.out);
  assert.doesNotMatch(ds.out, new RegExp(`FORGE_REF_TENANT=${NOT_DATASET[0]}\\b`), ds.out);
});

test('★★★ step 6b without the root tenant is SKIPPED, not «0 claims» — and with it, it still refuses 0', () => {
  const run = (asked) =>
    bash(`${selected(asked)}
host_node() { printf 'result=not-mine\\n'; }
FORGE_PUBLIC_ORIGIN=http://localhost:8200
${DECLARED.map((t) => `export ${`forge-operator-token${t === DECLARED[0] ? '' : `-${t}`}`.toUpperCase().replace(/-/g, '_')}=tok`).join('\n')}
${lift('if ! wanted_has "$ROOT_TENANT"; then', 'fi')}`);
  const other = DECLARED.find((t) => t !== ROOT_T);
  const without = run([other]);
  assert.equal(without.status, 0, without.out);
  assert.match(without.out, /^SKIP 6b$/m, without.out);
  assert.doesNotMatch(without.out, /^DIE/m, without.out);
  // ★ NEGATIVE CONTROL: the root asked and nobody claiming is still the refusal it always was.
  const withRoot = run([ROOT_T]);
  assert.equal(withRoot.status, 9, withRoot.out);
  assert.match(withRoot.out, /^DIE not one of this box's tenants owns the store/m, withRoot.out);
});

// ── 4 · the verdict over the configuration does not accuse what was not asked ────────────────────────────

/** A box holding ONLY the tenants named: their admin doors are claimed, the root (if absent) answers 404. */
async function fakeBox(onBox) {
  const doors = Object.fromEntries(BOX.tenants.filter((t) => onBox.includes(t.id)).map((t) => [t.admin_host, t.id]));
  const rootUp = onBox.includes(ROOT_T);
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/health') return json(200, { ok: true });
    if (url.pathname === '/v1/read/admin.by_host') {
      const t = doors[url.searchParams.get('host') ?? ''];
      return t ? json(200, { tenant_id: t }) : json(404, { error: { kind: 'not_found' } });
    }
    if (url.pathname === '/v1/read/store.by_host') {
      const h = (url.searchParams.get('host') ?? '').replace(/:\d+$/, '');
      return rootUp && h === 'localhost' ? json(200, { store_id: 'sto_ROOT' }) : json(404, { error: { kind: 'not_found' } });
    }
    res.writeHead(rootUp ? 200 : 404, { 'content-type': 'text/html' });
    res.end('<html></html>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  server.unref();
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
/** The `.env` box-up step 3 + 3b + 3d writes for exactly these tenants. */
function envFor(onBox) {
  const on = BOX.tenants.filter((t) => onBox.includes(t.id));
  const rootUp = onBox.includes(ROOT_T);
  const map = rootUp ? { localhost: 'sto_ROOT', 'localhost:8200': 'sto_ROOT' } : null;
  return [
    'FORGE_PUBLIC_ORIGIN=http://localhost:8200',
    'FORGE_HTTP_PORT=8200',
    `FORGE_STORE_HOSTS=${map ? `'${JSON.stringify(map)}'` : ''}`,
    `FORGE_ADMIN_SIBLINGS='${JSON.stringify(on.map((t) => ({ name: t.settings.tenant_name, url: `http://${t.admin_host}` })))}'`,
    `FORGE_GATE_ADMIN_URLS='${JSON.stringify(Object.fromEntries(on.map((t) => [t.id, `http://${t.admin_host}`])))}'`,
    `FORGE_ADMIN_STORE_IDS='${JSON.stringify(Object.fromEntries(on.map((t, i) => [t.id, `sto_GATE_${i}`])))}'`,
    'FORGE_REVALIDATE_SECRET=a-real-secret',
    '',
  ].join('\n');
}
async function verdict(onBox, args, extraEnv = '') {
  const box = await fakeBox(onBox);
  const dir = mkdtempSync(join(tmpdir(), 'box-tenants-verdict-'));
  writeFileSync(join(dir, '.env'), envFor(onBox) + extraEnv);
  try {
    // ⚠️ ASYNC, NOT `execFileSync`: the fake box answers from THIS process's event loop, which a sync child blocks.
    const { stdout } = await promisify(execFile)('node', [join(ROOT, 'bin/verify-config.mjs'), '--env', join(dir, '.env'), '--api', box.origin, ...args], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    });
    return { status: 0, out: stdout };
  } catch (error) {
    return { status: error.code ?? -1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  } finally {
    box.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test('★★★ a bench of ONLY the café is SETTLED when told so — the root\'s 404 and the absent admin are NAMED, not accused', async () => {
  const only = [NOT_DATASET[0]];
  const r = await verdict(only, ['--tenants', only.join(' ')]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /VERDICT: settled/, r.out);
  for (const t of DECLARED.filter((x) => !only.includes(x))) {
    assert.match(r.out, new RegExp(`· ${t} — not on this bench`), `the absent tenant is passed over in silence:\n${r.out}`);
  }
  if (!only.includes(ROOT_T)) assert.match(r.out, /BY DESIGN/, r.out);
  // ★ ANTI-VACUUM: the tenant that IS on the bench is still graded, by name.
  assert.match(r.out, new RegExp(`✓ ${only[0]} — admin at`), `the asked tenant was not graded at all:\n${r.out}`);
});

test('★★★ …the SAME bench with no selection is RED, naming the missing tenant — the negative control', async () => {
  const only = [NOT_DATASET[0]];
  const r = await verdict(only, []);
  assert.equal(r.status, 1, r.out);
  for (const t of DECLARED.filter((x) => !only.includes(x))) assert.match(r.out, new RegExp(`✗ ${t} — `), r.out);
  // …and the `.env` spelling of the selection settles it exactly like `--tenants`.
  const fromEnv = await verdict(only, [], `FORGE_BOX_TENANTS=${only.join(',')}\n`);
  assert.equal(fromEnv.status, 0, fromEnv.out);
});

test('★★★ a selection never HIDES the asked tenant: its missing admin door is still red', async () => {
  // The bench holds nothing; the café was asked. Narrowing must not become «grade nobody».
  const r = await verdict([], ['--tenants', NOT_DATASET[0]], '');
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, new RegExp(`✗ ${NOT_DATASET[0]} — `), r.out);
});

test('★★ an unknown tenant handed to the verdict is THIS STEP\'s wrong question (exit 2), never a narrowing', async () => {
  const r = await verdict(DECLARED, ['--tenants', 'nope']);
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /"nope" is not a tenant/, r.out);
});

// ── 5 · the switcher and the gate links name the tenants ON the bench — and still name all without one ──
//
// ⛔ MEASURED ON THIS SLICE'S FIRST REAL BIRTH (2026-10-10, bench dxi5, café only): the first filter read
// `.id` inside a string pipe, jq died on `Cannot index string with string "id"`, and step 3d wrote NO switcher
// and NO gate link — step 15 caught it (`forgecafe — no admin door`). Nothing above had run these two
// functions WITH a selection; `bin/box-config.guard.mjs` runs them without one, where the filter short-circuits.
test('★★★ 3d under a selection: one switcher entry and one gate link per tenant ON the bench, none for the others', () => {
  const run = (only) =>
    bash(`${PRELUDE}
BENCH_BLOCK=''
${lift('admin_siblings_json() {', '}')}
${lift('admin_gate_urls_json() {', '}')}
BOX_ON_BENCH=${JSON.stringify(only)} admin_siblings_json
BOX_ON_BENCH=${JSON.stringify(only)} admin_gate_urls_json`);
  const t = NOT_DATASET[0];
  const one = run(t);
  assert.equal(one.status, 0, one.out);
  const [siblings, gate] = one.out.trim().split('\n').map((l) => JSON.parse(l));
  const spec = BOX.tenants.find((x) => x.id === t);
  assert.deepEqual(siblings, [{ name: spec.settings.tenant_name, url: `http://${spec.admin_host}` }], one.out);
  assert.deepEqual(Object.keys(gate), [t], one.out);
  // ★ NEGATIVE CONTROL: no selection is every tenant, as the promotion and every older bench need.
  const all = run('');
  const [s2, g2] = all.out.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(s2.length, DECLARED.length, all.out);
  assert.deepEqual(Object.keys(g2), DECLARED, all.out);
});
