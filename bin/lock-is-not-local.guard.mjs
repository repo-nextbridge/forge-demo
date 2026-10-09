// ★★★ v032/C — A LOCK ONLY ONE MACHINE CAN RUN NEVER REACHES A BOX ANYBODY ELSE REACHES (spec v032, decision 9).
//
//   node --test bin/lock-is-not-local.guard.mjs        (or: bash bin/test.sh)
//
// Until v0.3.2 the obligation was PROSE: `forge.lock` itself carried «OBLIGATION, NOT A REMINDER: the first
// real deploy … replaces every ref below with a registry digest», and nothing executed it — the stag and prod
// boxes of this demo ran a `local build` lock for weeks, carried over ssh by `docker save`. `bin/lock-gate.sh`
// is now the rule, once, and `bin/deploy.sh` calls it at step 0. What this file holds:
//
//   1 · THE RULE, EXECUTED over planted locks: `local build` (the old `provenance` shape, and the per-image
//       `origin`) and a ref with no registry host are REFUSED for stag and prod, naming every image; a lock of
//       registry digests passes; `--allow-local` lets a BENCH env through and is ignored for stag/prod.
//   2 · THE WIRING, read from `bin/deploy.sh`'s code: the gate is sourced and called before the fence, before
//       the pin and before the host — a gate called after the bytes left would be a report, not a gate.
//   3 · THE REAL LOCK: whatever `forge.lock` is committed, the gate's verdict on it for stag and prod is the
//       one its shape implies. A lock out of `bin/bake-local.sh` is refused; one out of `.github/workflows/
//       bake.yml` passes. (Which of the two this branch carries is said in the run, not assumed.)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from './release-tree.mjs';

const say = (line) => console.error(`[lock-is-not-local] ${line}`);
const GATE = join(ROOT, 'bin', 'lock-gate.sh');
const D = (c) => `sha256:${c.repeat(64)}`;

/** Run `lock_gate` over `lock` for `env`; `{ code, out }` — stdout and stderr together. */
function gate(lock, env, allow = 'no') {
  const dir = mkdtempSync(join(tmpdir(), 'lock-gate-'));
  const file = join(dir, 'forge.lock');
  writeFileSync(file, typeof lock === 'string' ? lock : JSON.stringify(lock, null, 2));
  try {
    const out = execFileSync('bash', ['-c', `. '${GATE}' && lock_gate "$1" "$2" "$3" 2>&1`, 'gate', file, env, allow], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (error) {
    return { code: error.status ?? -1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SIX = ['kernel', 'storefront', 'checkout', 'admin', 'storefront-coffee', 'totem'];
const registryLock = () => ({
  forgeVersion: 'v0.3.2',
  composition: { id: 'probe', apps: ['probe'] },
  images: Object.fromEntries(
    SIX.map((name, i) => [name, { ref: `ghcr.io/probe/forge-demo-${name}@${D('abcdef'[i])}`, origin: 'own build', built_from: 'v0.3.2' }]),
  ),
});

// ── 1 · THE RULE ────────────────────────────────────────────────────────────────────────────────────────

test('★ CONTROL — a lock of registry digests, `own build`, passes for stag and for prod', () => {
  for (const env of ['stag', 'prod']) {
    const r = gate(registryLock(), env);
    assert.equal(r.code, 0, `a lock anybody can rebuild was refused for ${env}:\n${r.out}`);
  }
});

test('★★★ SABOTAGE — `local build` planted in ONE image is refused for prod, naming it', () => {
  const lock = registryLock();
  lock.images.checkout.origin = 'local build';
  const r = gate(lock, 'prod');
  assert.equal(r.code, 1, `a local build reached prod:\n${r.out}`);
  assert.match(r.out, /images\.checkout is origin "local build"/);
  assert.doesNotMatch(r.out, /images\.kernel/, 'the refusal named an image that is fine');
});

test('★★★ SABOTAGE — the pre-v0.3.2 shape (`provenance.origin: "local build"`, bare refs) is refused for stag', () => {
  const lock = {
    forgeVersion: 'v0.3.1-pre.e852092ee',
    provenance: { origin: 'local build', built_from: 'HEAD@e852092ee' },
    images: { kernel: `forge-demo-kernel@${D('a')}`, admin: `forge-demo-admin@${D('d')}` },
  };
  const r = gate(lock, 'stag');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /provenance\.origin is "local build" \(HEAD@e852092ee\)/);
  assert.match(r.out, /images\.kernel names no registry/);
  assert.match(r.out, /images\.admin names no registry/);
});

test('★★ a ref with NO registry host is refused even when it calls itself `own build`', () => {
  const lock = registryLock();
  lock.images.totem.ref = `forge-demo-totem@${D('f')}`;
  const r = gate(lock, 'prod');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /images\.totem names no registry/);
});

test('★★ --allow-local does NOT apply to stag or prod — and does let a bench environment through, saying why', () => {
  const lock = registryLock();
  lock.images.kernel = { ref: `forge-demo-kernel@${D('a')}`, origin: 'local build', built_from: 'v0.3.2' };
  for (const env of ['stag', 'prod']) {
    const r = gate(lock, env, 'yes');
    assert.equal(r.code, 1, `--allow-local opened ${env}:\n${r.out}`);
    assert.match(r.out, /PUBLIC box/);
  }
  const bench = gate(lock, 'bench', 'yes');
  assert.equal(bench.code, 0, bench.out);
  assert.match(bench.out, /BENCH environment and --allow-local was given/);
  const benchNoFlag = gate(lock, 'bench', 'no');
  assert.equal(benchNoFlag.code, 1, 'a bench env without the flag let a local lock through in silence');
});

// ── 2 · THE WIRING ──────────────────────────────────────────────────────────────────────────────────────

/** `bin/deploy.sh` with every `#` comment line dropped — the prose names the gate freely. */
const DEPLOY_CODE = readFileSync(join(ROOT, 'bin', 'deploy.sh'), 'utf8')
  .split('\n')
  .map((line, i) => ({ line, n: i + 1 }))
  .filter(({ line }) => !/^\s*#/.test(line));
const lineOf = (re) => DEPLOY_CODE.find(({ line }) => re.test(line))?.n ?? -1;

test('★★ bin/deploy.sh calls the gate BEFORE the fence, the pin and the host', () => {
  const sourced = lineOf(/\. "\$HERE\/bin\/lock-gate\.sh"/);
  const called = lineOf(/^lock_gate "\$HERE\/forge\.lock" "\$ENV_NAME" "\$ALLOW_LOCAL"/);
  const fence = lineOf(/"\$\{fence_cmd\[@\]\}" --root/);
  const pin = lineOf(/\. "\$HERE\/bin\/images-from-lock\.sh"/);
  const host = lineOf(/"\$\{SSH\[@\]\}" true/);
  assert.ok(sourced > 0 && called > sourced, `the gate is not sourced and then called (sourced ${sourced}, called ${called})`);
  for (const [name, at] of Object.entries({ fence, pin, host })) {
    assert.ok(at > called, `the ${name} (line ${at}) comes before the gate (line ${called}) — the gate would be a report`);
  }
});

test('★ bin/deploy.sh carries nothing left from the `docker save` transport — the host only pulls', () => {
  const code = DEPLOY_CODE.map(({ line }) => line).join('\n');
  assert.doesNotMatch(code, /docker save/, 'an image can still be carried over ssh instead of pulled');
  assert.doesNotMatch(code, /docker load/, 'an image can still be loaded on the host from this machine');
  assert.match(code, /docker pull -q/, 'the deploy no longer pulls — what does it ship with?');
});

// ── 3 · THE REAL LOCK ───────────────────────────────────────────────────────────────────────────────────

test('★★ the committed forge.lock gets the verdict its shape implies, for stag and for prod', () => {
  const text = readFileSync(join(ROOT, 'forge.lock'), 'utf8');
  const lock = JSON.parse(text);
  const entries = Object.entries(lock.images ?? {});
  assert.ok(entries.length > 0, 'forge.lock pins no image — nothing to grade');
  const local =
    lock.provenance?.origin === 'local build' ||
    entries.some(([, e]) => typeof e === 'object' && e.origin === 'local build') ||
    entries.some(([, e]) => !/^[^/@]+[.:][^/@]*\//.test(typeof e === 'string' ? e : e.ref) && !/^localhost\//.test(typeof e === 'string' ? e : e.ref));
  for (const env of ['stag', 'prod']) {
    const r = gate(text, env);
    assert.equal(r.code, local ? 1 : 0, `the gate's verdict on the committed lock for ${env} is not the one its shape implies:\n${r.out}`);
  }
  say(
    local
      ? '⚠️ the committed forge.lock is a BENCH bake — bin/deploy.sh refuses it for stag and prod until the lock of a bake.yml run is adopted'
      : 'the committed forge.lock is a registry bake — stag and prod take it',
  );
});
