// ★★★ dx-i2 — THE VITRINE REACHES THE SHOP ON A BENCH: its loopback door, derived and wired.
//
// ⛔ THE DEFECT, MEASURED 2026-10-10 on two local benches and the café: step 14 printed `planned=838 warmed=0
// failed=1676`, every url `fetch failed`. The vitrine's warmer fetches FROM INSIDE ITS CONTAINER at
// `FORGE_PUBLIC_ORIGIN` (`http://localhost:8200` on a bench), where `localhost` is the container itself:
// `docker exec … node -e "fetch('http://localhost:8200/')"` → ECONNREFUSED. The repair is a door inside the
// vitrine's network namespace (`storefront-loopback` in compose.yml, `caddy/Caddyfile.loopback`), derived
// from the origin by `env-source.sh` (`_forge_loopback_door_port`) and named by `bin/box-up.sh` wherever it
// (re)creates the vitrine.
//
// What this grades, and how each half can go wrong without anybody seeing it on a laptop:
//   1 · the derivation, EXECUTED — a bench origin must open the door, a deployed one must never create it.
//   2 · the compose row — a door that is not in the vitrine's namespace, or that publishes a port, is not
//       this door.
//   3 · the edge it forwards to — the bench edge's shop face, with the Host untouched.
//   4 · `bin/box-up.sh` — a namespace-sharing container dies with the vitrine, so every `dc up` that
//       (re)creates the vitrine must name it, and the re-warm must start it.
//
//   node --test bin/loopback-door.guard.mjs      (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

/** Shell/Caddyfile/YAML code with its comment lines removed — a rule that reads source reads CODE. */
const code = (text) =>
  text
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

const ENV_SOURCE = code(read('env-source.sh'));
const BOX_UP = code(read('bin/box-up.sh'));
const CADDY = code(read('caddy/Caddyfile.loopback'));

/** The function as `env-source.sh` defines it, and nothing else of that file (which needs real secrets). */
function derivation() {
  const fn = ENV_SOURCE.match(/\n(_forge_loopback_door_port\(\) \{[\s\S]*?\n\})\n/);
  assert.ok(fn, 'env-source.sh no longer defines `_forge_loopback_door_port()` — the door has nothing deriving it.');
  return fn[1];
}

const portFor = (origin) =>
  execFileSync('bash', ['-c', `${derivation()}\n_forge_loopback_door_port "$1"`, 'guard', origin], {
    encoding: 'utf8',
  });

/** The `services:` row of compose.yml for one service — two-space key, deeper lines until the next key. */
function serviceRow(name) {
  const lines = code(read('compose.yml')).split('\n');
  const start = lines.findIndex((l) => l === `  ${name}:`);
  assert.ok(start > -1, `compose.yml declares no \`${name}\` service.`);
  const end = lines.findIndex((l, i) => i > start && /^ {2}\S/.test(l));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

// ── 1 · the derivation, executed ──────────────────────────────────────────────────────────────────────────

test('★★★ a bench origin OPENS the door on its own port — the address a browser here opens', () => {
  for (const [origin, port] of [
    ['http://localhost:8200', '8200'],
    ['http://localhost:8500', '8500'],
    ['http://127.0.0.1:8300/', '8300'],
    ['http://[::1]:8400', '8400'],
    ['http://shop.localhost:8600', '8600'],
    ['http://localhost', '80'],
  ]) {
    assert.equal(portFor(origin), port, `${origin} should open the vitrine's loopback door on ${port}`);
  }
});

test('★★★ a DEPLOYED origin derives nothing — a real name already reaches its own edge from anywhere', () => {
  for (const origin of [
    'https://shop.example.test',
    'http://shop.example.test:8200',
    // The door speaks plain http; a loopback https origin is not one it can answer.
    'https://localhost:8443',
    // The vitrine itself listens on 3000 in that namespace: a door there could never bind.
    'http://localhost:3000',
    '',
  ]) {
    assert.equal(portFor(origin), '', `${origin || '(empty)'} must not create the loopback door`);
  }
});

test('★★ the derivation is what env-source EXPORTS, from FORGE_PUBLIC_ORIGIN, and it turns on the profile', () => {
  assert.match(
    ENV_SOURCE,
    /FORGE_LOOPBACK_DOOR_PORT="\$\(_forge_loopback_door_port "\$\(_forge_env_declares FORGE_PUBLIC_ORIGIN/,
    'env-source.sh does not derive FORGE_LOOPBACK_DOOR_PORT from the FORGE_PUBLIC_ORIGIN that .env declares',
  );
  assert.match(ENV_SOURCE, /export FORGE_LOOPBACK_DOOR_PORT/, 'the derived port is not exported to compose');
  assert.match(
    ENV_SOURCE,
    /COMPOSE_PROFILES="\$\{COMPOSE_PROFILES:\+\$COMPOSE_PROFILES,\}bench-loopback"/,
    'env-source.sh never asks compose for the `bench-loopback` profile, so the door is never created',
  );
});

// ── 2 · the compose row ───────────────────────────────────────────────────────────────────────────────────

test('★★★ the door lives IN THE VITRINE\'S NAMESPACE, behind the profile env-source asks for, and publishes nothing', () => {
  const row = serviceRow('storefront-loopback');
  assert.match(row, /network_mode: 'service:storefront'/, `the door is not in the vitrine's namespace:\n${row}`);
  assert.match(row, /profiles: \['bench-loopback'\]/, `the door is not behind the bench-loopback profile:\n${row}`);
  assert.doesNotMatch(row, /\n {4}ports:/, `the door publishes a port — it is a door inside a namespace:\n${row}`);
  assert.match(row, /\.\/caddy\/Caddyfile\.loopback:\/etc\/caddy\/Caddyfile:ro/, `the door does not read its Caddyfile:\n${row}`);
  assert.match(row, /FORGE_LOOPBACK_DOOR_PORT: \$\{FORGE_LOOPBACK_DOOR_PORT/, `the door is not told its port:\n${row}`);
});

// ── 3 · the edge it forwards to ───────────────────────────────────────────────────────────────────────────

test('★★ the door listens on the derived port and hands everything to the bench edge\'s shop face, Host untouched', () => {
  assert.match(CADDY, /^:\{\$FORGE_LOOPBACK_DOOR_PORT\} \{/m, `the door does not listen on the derived port:\n${CADDY}`);
  assert.match(CADDY, /^\treverse_proxy caddy:80$/m, `the door does not forward to the edge's shop face:\n${CADDY}`);
  assert.doesNotMatch(CADDY, /header_up\s+Host/i, `the door rewrites the Host — the edge would see another request:\n${CADDY}`);
});

// ── 4 · box-up names it ───────────────────────────────────────────────────────────────────────────────────

test('★★★ every `dc up` that (re)creates the vitrine names the door too — it dies with the namespace it shares', () => {
  const ups = BOX_UP.split('\n').filter((l) => /\bdc up\b/.test(l) && /\bstorefront\b/.test(l));
  assert.ok(ups.length >= 2, `box-up.sh starts the vitrine from ${ups.length} \`dc up\` line(s) — the reader lost them`);
  for (const line of ups) {
    assert.match(line, /\$\(loopback_door\)/, `this \`dc up\` (re)creates the vitrine and leaves its door behind:\n${line}`);
  }
  assert.match(
    BOX_UP,
    /loopback_door\(\) \{[^}]*dc config --services[^}]*storefront-loopback/,
    'box-up.sh does not DERIVE the door from what compose declares under the active profiles',
  );
});

test('★★ the re-warm starts the door first — a bench born before it existed is warmed through it too', () => {
  const mode = BOX_UP.slice(BOX_UP.indexOf('if [ "$MODE" = warm ]; then')).split('\nfi\n')[0];
  assert.match(
    mode,
    /\[ -z "\$door" \] \|\| dc up -d "\$door"/,
    `\`--warm-only\` warms without starting the door:\n${mode}`,
  );
  // ⛔ AND NEVER A BARE `dc up -d $(…)`: with no door to derive it would be `dc up -d` — EVERY service.
  assert.doesNotMatch(mode, /dc up -d \$\(loopback_door\)\s*(>|$)/m, 'an empty derivation would start every service');
});
