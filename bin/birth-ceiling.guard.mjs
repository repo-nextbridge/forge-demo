// ★★ v04-stress/H — THE BIRTH'S CPU CEILING: a box that is reborn keeps CPU for the shop it is serving.
//
// ⛔ WHY IT EXISTS: on 2026-09-17 a staging birth held the VM at 75–78% CPU for ~7 h and the provider throttled
// the whole account, production included. The weekly cycle is a birth on a box that serves visitors. The
// ceiling and its reasons are written in `deploy/box.env`; this file holds the four things that make it a
// ceiling and not a slowdown or a decoration:
//
//   1 · IT IS APPLIED — `compose.yml`'s `birth-worker` carries the two values `deploy/box.env` declares, and
//       the declared hard ceiling is below one CPU (the seed is one node process; ≥ 1 caps almost nothing).
//   2 · IT IS NOT THE SHOP'S — no other service of either compose file carries a CPU key or reads the two
//       variables. A ceiling on the kernel, a front or postgres is a ceiling on the read path.
//   3 · IT ENDS WITH THE WORK, ON SUCCESS AND ON FAILURE — the birth runs `seed-demo` and `seed-history`
//       through `run --rm` of that worker, and touches no serving container's CPU (`docker update`), so there
//       is nothing a trap would have to retire and nothing a dead laptop could leave behind.
//   4 · A BIRTH WITHOUT IT SAYS SO — the announcement block of `bin/birth-remote.sh` is SOURCED and run here
//       over fabricated boxes: declared, undeclared, a useless ceiling and a box whose `.env` disagrees.
//
// ⚠️ THE COMPOSE READER IS HAND-ROLLED for the reason `bin/container-health.guard.mjs` gives (this repository
// has no package manager); the first test makes a blind reader accuse itself instead of passing.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE_FILES = ['compose.yml', 'compose.override.yml'];
const WORKER = 'birth-worker';
// Assembled at run time so this file's own text never matches the needle it hunts.
const CPU_KEYS = ['cpus', 'cpu_shares', 'cpu_quota', 'cpu_period', 'cpu_count', 'cpu_percent', 'cpuset', 'cpu_rt_runtime', 'cpu_rt_period'];
const VARS = ['FORGE_BIRTH_CPUS', 'FORGE_BIRTH_CPU_SHARES'];

/** A shell file with every `#` comment removed — whole-line and trailing. A `#` in quotes or `${#…}` stays. */
function codeOf(shell) {
  return shell
    .split('\n')
    .map((line) => {
      let quote = null;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
          if (c === quote) quote = null;
          continue;
        }
        if (c === "'" || c === '"') quote = c;
        else if (c === '#' && line[i - 1] !== '$' && line[i - 1] !== '{' && (i === 0 || /\s/.test(line[i - 1])))
          return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

/** `services:` of a compose file as Map(name → { file, body: code lines }). Comments are dropped first. */
function servicesOf(file, text = readFileSync(join(ROOT, file), 'utf8')) {
  const out = new Map();
  let inServices = false;
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').replace(/^\s*#.*$/, '');
    if (!line.trim()) continue;
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      continue;
    }
    if (!inServices) continue;
    if (/^\S/.test(line)) {
      inServices = false;
      current = null;
      continue;
    }
    const service = /^ {2}([a-z0-9][a-z0-9._-]*):\s*$/.exec(line);
    if (service) {
      current = { name: service[1], file, body: [] };
      out.set(`${file}:${current.name}`, current);
      continue;
    }
    if (current) current.body.push(line);
  }
  return out;
}

function allServices() {
  const all = [];
  for (const file of COMPOSE_FILES) all.push(...servicesOf(file).values());
  return all;
}

/** The value of a 4-space key of a service, or null. */
function keyOf(svc, key) {
  const hit = svc.body.find((l) => new RegExp(`^ {4}${key}:`).test(l));
  return hit ? hit.replace(new RegExp(`^ {4}${key}:\\s*`), '').trim() : null;
}

/** The CPU keys a service carries (4-space property keys, or nested under `deploy.resources`). */
function cpuKeysOf(svc) {
  return svc.body
    .map((l) => /^ {4,}([a-z_]+):/.exec(l)?.[1])
    .filter((k) => k && (CPU_KEYS.includes(k) || k === 'resources'));
}

/** `deploy/box.env` as a map — the declaration the deploy writes into the box's `.env`. */
function boxEnv(text = readFileSync(join(ROOT, 'deploy/box.env'), 'utf8')) {
  const out = new Map();
  for (const line of text.split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

/** Rule 1 over a compose text + an env text — a function so the sabotage tests can feed it broken inputs. */
function ceilingApplied(composeText, envText) {
  const worker = [...servicesOf('compose.yml', composeText).values()].find((s) => s.name === WORKER);
  if (!worker) return `compose.yml has no "${WORKER}" service — the birth's one-shots would have nowhere capped to run`;
  if (!/^ {6}service:\s*kernel\s*$/m.test(worker.body.join('\n')) || keyOf(worker, 'extends') === null)
    return `"${WORKER}" does not extend "kernel" — it would not be the kernel's image, environment and mounts`;
  if (keyOf(worker, 'profiles') === null) return `"${WORKER}" has no profile, so \`docker compose up -d\` would START it as a service`;
  if (!/^\$\{FORGE_BIRTH_CPUS[:}]/.test(keyOf(worker, 'cpus') ?? '')) return `"${WORKER}" does not read its hard ceiling (cpus) from FORGE_BIRTH_CPUS`;
  if (!/^\$\{FORGE_BIRTH_CPU_SHARES[:}]/.test(keyOf(worker, 'cpu_shares') ?? ''))
    return `"${WORKER}" does not read its weight (cpu_shares) from FORGE_BIRTH_CPU_SHARES`;
  const env = boxEnv(envText);
  const cpus = Number(env.get('FORGE_BIRTH_CPUS'));
  if (!(cpus > 0 && cpus < 1))
    return `deploy/box.env declares FORGE_BIRTH_CPUS=${env.get('FORGE_BIRTH_CPUS') ?? '<absent>'} — it must be above 0 and BELOW 1: the seed is one node process, and a ceiling of one CPU or more caps almost nothing`;
  const shares = Number(env.get('FORGE_BIRTH_CPU_SHARES'));
  if (!(Number.isInteger(shares) && shares >= 2 && shares < 1024))
    return `deploy/box.env declares FORGE_BIRTH_CPU_SHARES=${env.get('FORGE_BIRTH_CPU_SHARES') ?? '<absent>'} — it must be an integer below the 1024 every serving container has, or the shop does not win a contended CPU`;
  return null;
}

/** Rule 2 over compose texts: the services that serve carry no CPU key and read neither variable. */
function shopUncapped(texts = Object.fromEntries(COMPOSE_FILES.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]))) {
  const bad = [];
  for (const [file, text] of Object.entries(texts)) {
    for (const svc of servicesOf(file, text).values()) {
      if (svc.name === WORKER) continue;
      const keys = cpuKeysOf(svc);
      if (keys.length) bad.push(`${file} · ${svc.name} carries ${keys.join(', ')}`);
      const reads = VARS.filter((v) => svc.body.some((l) => l.includes(v)));
      if (reads.length) bad.push(`${file} · ${svc.name} reads ${reads.join(', ')}`);
    }
  }
  return bad;
}

/** The `remote_compose … run …` invocations of a shell script, continuation lines joined, comments gone. */
function composeRuns(shell) {
  const joined = codeOf(shell).replace(/\\\n/g, ' ');
  return joined.split('\n').filter((l) => /^\s*remote_compose\s.*\srun\s/.test(l));
}

/** Rule 3 over the birth's text. */
function workRunsCapped(shell) {
  const bad = [];
  const code = codeOf(shell);
  const worker = /^\s*BIRTH_WORKER=(\S+)\s*$/m.exec(code)?.[1]?.replace(/^['"]|['"]$/g, '');
  if (worker !== WORKER) bad.push(`BIRTH_WORKER is ${worker ?? '<unset>'}, not the compose service "${WORKER}"`);
  for (const entry of ['dist/seed-demo.js', 'dist/seed-history.js']) {
    const runs = composeRuns(shell).filter((l) => l.includes(entry));
    if (!runs.length) bad.push(`no \`remote_compose … run\` of ${entry} found — the reader is blind or the step moved`);
    for (const r of runs) {
      if (!/"\$BIRTH_WORKER"\s+node\s/.test(r)) bad.push(`${entry} runs outside the worker: ${r.trim()}`);
      if (!/\srun\s+--rm\s/.test(r)) bad.push(`${entry} runs without --rm, so its capped container outlives the step: ${r.trim()}`);
    }
  }
  if (/\bdocker\s+update\b/.test(code)) bad.push('the birth mutates a running container (`docker update`) — that needs a retirement this design does not have');
  return bad;
}

const BIRTH = readFileSync(join(ROOT, 'bin/birth-remote.sh'), 'utf8');

/** Run the marked announcement block of `bin/birth-remote.sh` with the three values a birth hands it. */
function announce(boxCpus, boxShares, declared, shell = BIRTH) {
  const m = shell.match(/# >>> THE BIRTH'S CPU CEILING[^\n]*\n([\s\S]*?)# <<< THE BIRTH'S CPU CEILING/);
  assert.ok(m, "bin/birth-remote.sh no longer marks THE BIRTH'S CPU CEILING — this guard cannot run it");
  const script = `note() { printf '   %s\\n' "$*"; }\n${m[1]}\nannounce_birth_ceiling "$1" "$2" "$3"\n`;
  return execFileSync('bash', ['-c', script, 'announce', boxCpus, boxShares, declared], { encoding: 'utf8' });
}

// ── 0 · THE READER SEES ───────────────────────────────────────────────────────────────────────────────────

test("★★ the reader found this box's services, the worker among them, and sees a CPU key where there is one", () => {
  const all = allServices();
  assert.ok(all.length >= 8, `the compose reader found ${all.length} service(s); a low count is a blind reader, not a small box`);
  assert.ok(all.some((s) => s.name === WORKER), `the reader does not see "${WORKER}"`);
  // ⟂ The negative control of rule 2's reader: a key it must see, in the shape both files are written in.
  const probe = 'services:\n  kernel:\n    image: x\n    cpus: 1.5\n  storefront:\n    deploy:\n      resources:\n        limits:\n          cpus: "1"\n';
  assert.deepEqual(shopUncapped({ 'compose.yml': probe }), ['compose.yml · kernel carries cpus', 'compose.yml · storefront carries resources, cpus']);
  // …and prose about a ceiling is not a ceiling.
  assert.deepEqual(shopUncapped({ 'compose.yml': 'services:\n  kernel:\n    # cpus: 1 is what we refused\n    image: x\n' }), []);
});

// ── 1 · APPLIED ───────────────────────────────────────────────────────────────────────────────────────────

test('1 · the worker carries the ceiling deploy/box.env declares, behind a profile, below one CPU', () => {
  const why = ceilingApplied(readFileSync(join(ROOT, 'compose.yml'), 'utf8'), readFileSync(join(ROOT, 'deploy/box.env'), 'utf8'));
  assert.equal(why, null, why ?? '');
});

test('1 ⟂ each half of the declaration, taken away, is named', () => {
  const compose = readFileSync(join(ROOT, 'compose.yml'), 'utf8');
  const env = readFileSync(join(ROOT, 'deploy/box.env'), 'utf8');
  const cases = [
    [compose.replace(/^ {4}cpus: \$\{FORGE_BIRTH_CPUS[^\n]*\n/m, ''), env, /hard ceiling/],
    [compose.replace(/^ {4}cpu_shares: [^\n]*\n/m, ''), env, /weight/],
    [compose.replace(/^ {4}profiles: \['birth'\]\n/m, ''), env, /no profile/],
    [compose.replace(/^ {2}birth-worker:/m, '  birth-helper:'), env, /no "birth-worker"/],
    [compose, env.replace(/^FORGE_BIRTH_CPUS=.*$/m, 'FORGE_BIRTH_CPUS='), /above 0 and BELOW 1/],
    [compose, env.replace(/^FORGE_BIRTH_CPUS=.*$/m, 'FORGE_BIRTH_CPUS=1.0'), /BELOW 1/],
    [compose, env.replace(/^FORGE_BIRTH_CPU_SHARES=.*$/m, 'FORGE_BIRTH_CPU_SHARES=1024'), /below the 1024/],
  ];
  for (const [c, e, expected] of cases) {
    const why = ceilingApplied(c, e);
    assert.ok(why, `a broken declaration passed (expected ${expected})`);
    assert.match(why, expected);
  }
});

// ── 2 · NOT THE SHOP'S ────────────────────────────────────────────────────────────────────────────────────

test("2 · no service that serves carries a CPU ceiling or reads the birth's", () => {
  const bad = shopUncapped();
  assert.deepEqual(bad, [], `a ceiling reached the shop — that is slowness, not a ceiling:\n  ${bad.join('\n  ')}`);
});

// ── 3 · IT ENDS WITH THE WORK ─────────────────────────────────────────────────────────────────────────────

test('3 · the birth runs seed-demo and seed-history in the worker, through run --rm, and updates no running container', () => {
  const bad = workRunsCapped(BIRTH);
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('3 ⟂ the seed run on the kernel, a run that keeps its container, and a docker update are each caught', () => {
  const sabotaged = [
    BIRTH.replace('"$BIRTH_WORKER" node dist/seed-demo.js', 'kernel node dist/seed-demo.js'),
    BIRTH.replace(/run --rm( \\\n\s+\$\{FORGE_SEED_ACTION_TIMEOUT_MS[^\n]*\n\s+"\$BIRTH_WORKER" node dist\/seed-history)/, 'run$1'),
    BIRTH.replace('BIRTH_WORKER=birth-worker', 'BIRTH_WORKER=kernel'),
    BIRTH.replace("say '9 ·", "docker update --cpus 0.5 forge-demo-postgres-1\nsay '9 ·"),
  ];
  const expected = [/seed-demo\.js runs outside the worker/, /seed-history\.js runs without --rm/, /BIRTH_WORKER is kernel/, /docker update/];
  sabotaged.forEach((s, i) => {
    assert.notEqual(s, BIRTH, `sabotage ${i} did not change the file — the test proves nothing`);
    const bad = workRunsCapped(s).join('\n');
    assert.match(bad, expected[i]);
  });
  // ⟂ prose is not code: the same words in a comment are not a run.
  assert.deepEqual(workRunsCapped(BIRTH.replace("say '9 ·", "# docker update --cpus 0.5 x\nsay '9 ·")), []);
});

test('3 · the ceiling is announced BEFORE the first seed-demo run, with the values asked of the BOX', () => {
  const code = codeOf(BIRTH);
  const call = code.search(/^announce_birth_ceiling "\$\(remote_env_get FORGE_BIRTH_CPUS\)" "\$\(remote_env_get FORGE_BIRTH_CPU_SHARES\)" "\$\{FORGE_BIRTH_CPUS:-\}"\s*$/m);
  assert.ok(call >= 0, 'the announcement is not called with the box\'s two values and the declared one');
  assert.ok(call < code.indexOf('dist/seed-demo.js'), 'the announcement comes after the seed it announces');
});

// ── 4 · A BIRTH WITHOUT THE DECLARATION SAYS WHAT IT DID ──────────────────────────────────────────────────

test('4 · undeclared → the birth says UNCAPPED and names the variable', () => {
  for (const [cpus, declared] of [['', ''], ['0', '0']]) {
    const out = announce(cpus, '', declared);
    assert.match(out, /NO CPU CEILING/);
    assert.match(out, /UNCAPPED/);
    assert.match(out, /FORGE_BIRTH_CPUS/);
  }
});

test('4 · declared → the birth names the ceiling and the weight it runs under, and nothing else', () => {
  const out = announce('0.5', '256', '0.5');
  assert.match(out, /capped at 0\.5 CPU, weight 256/);
  assert.doesNotMatch(out, /UNCAPPED|⚠️/);
});

test('4 · a ceiling of one CPU or more, and a box whose .env disagrees with deploy/box.env, are each said', () => {
  assert.match(announce('1', '256', '1'), /caps almost nothing/);
  assert.match(announce('2.0', '256', '2.0'), /caps almost nothing/);
  const drift = announce('', '', '0.5');
  assert.match(drift, /UNCAPPED/);
  assert.match(drift, /deploy\/box\.env declares FORGE_BIRTH_CPUS=0\.5 and the box's \.env says\s+<empty>/);
});

test('4 ⟂ an announcement that stopped saying UNCAPPED is caught', () => {
  const muted = BIRTH.replace(/note "⚠️ NO CPU CEILING[\s\S]*?written there\."/, 'true');
  assert.notEqual(muted, BIRTH, 'the sabotage did not apply — the test proves nothing');
  assert.doesNotMatch(announce('', '', '', muted), /UNCAPPED/);
});
