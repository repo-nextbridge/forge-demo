// ★★★ ONE BENCH PORT, ONE INTERFACE — a door that answers 200 and loses the cart is worse than no door.
//
//   node --test bin/bench-http-door.guard.mjs        (or: bash bin/test.sh)
//
// ── ⚠️ READ THIS FIRST: THIS FILE AND `bench-ports.guard.mjs` ASK DIFFERENT QUESTIONS OF THE SAME LINES ────
//
//   `bin/bench-ports.guard.mjs`   WHICH NUMBER is this door?      `.env.example` is the one that says it.
//   this file                     WHO CAN REACH it?               `FORGE_BENCH_BIND` is the one that says it.
//
// They must never answer each other's question, and they do not overlap by construction: that file matches
// `${FORGE_*_PORT:-N}` and this one matches the `${FORGE_BENCH_BIND?…}` prefix in front of it. The one place
// they touch is `compose.yml`, which that file deliberately does NOT grade (its port fallbacks are what a
// DEPLOYMENT gets: `:-80`, `:-443`). This file DOES grade it, and must: four of this box's five doors are
// published there, and the interface question has the same answer in a deployment and on a bench — the
// difference is the VALUE, which is why the value is demanded rather than defaulted. See rule 2.
//
// ── THE DEFECT, MEASURED 2026-09-08 ON THE LIVE BENCH ─────────────────────────────────────────────────────
//
// Every front of this box declares `NODE_ENV: production`, so `secureCookie()` is true — the storefront kit's
// `cookies.ts:85` for the shopper's cookies, the admin image's `session.ts:21` for the operator's — and a
// browser SILENTLY refuses a `Secure` cookie on any plain-http origin that is not `localhost`. Every door
// this box publishes is plain http (`caddy/Caddyfile.local` carries no TLS), and all five were published on
// every interface:
//
//   docker ps: forge-preseed-caddy-1   0.0.0.0:8200->80  0.0.0.0:8201->81  0.0.0.0:8202->83  0.0.0.0:8203->82
//   http://<magicdns>:8200/health → 200   http://<magicdns>:8201/login → 200
//   http://<magicdns>:8202/login  → 200   http://<magicdns>:8203/      → 200
//
// So the shop, both admins and the counter all answered a phone on the tailnet, and every one of them then
// dropped the cookie that makes the visit mean anything. `bin/box-up.sh` carries the browser half of that
// measurement already, on the admin: «the login succeeds, the jar keeps nothing, and the next request
// bounces». It is the same species `pk23/p5` closed on the product's `:3033`.
//
// ⚠️ AND `Secure` CANNOT BE TURNED OFF. `FORGE_STOREFRONT_SECURE_COOKIE` / `FORGE_ADMIN_SECURE_COOKIE` are
// opt-INS (`NODE_ENV === 'production' || … === '1'`) and this box passes neither to any container. The host
// interface is the only place this can be closed, which is why it is closed there.
//
// ── WHAT THIS GUARD HOLDS ─────────────────────────────────────────────────────────────────────────────────
//   0. IT SEES ITS SUBJECTS   — both compose files parse to published-port lines, and the count is plausible.
//                               Pointed at a compose that publishes nothing, it goes RED naming itself.
//   1. EVERY DOOR IS BOUND    — no published port anywhere may be written without the bind in front of it.
//                               This is what a re-published door trips.
//   2. THE BOX MUST DECLARE   — the interpolation is `${FORGE_BENCH_BIND?…}`, never `:-`. A default would be
//                               a decision nobody made, and it would be silent exactly on the box that has
//                               no `.env` yet. Empty is a legal answer ("every interface", what a deployment
//                               says); saying nothing is not.
//   3. THE BENCH SAYS LOOPBACK— `.env.example` is the bench's configuration and it ships a loopback address.
//   4. ⟂ localhost STILL OPENS— PERMANENT NEGATIVE CONTROL. `localhost` is a secure context: it keeps the
//                               cookie, keeps the cart, and must keep its plain-http door. A "fix" that
//                               hardened the tailnet by making the bench unreachable from the laptop it runs
//                               on would be worse than the trap, and this is the rule that refuses it.
//   5. NO DEAD TAILNET DOOR   — `bin/box-up.sh` may not hand out a plain-http address on the tailnet host
//                               while the doors are on loopback. The BEHAVIOURAL half of that lives in
//                               `bin/box-config.guard.mjs`, which already runs the promotion for real with
//                               stubs; here it is the structural half — the refusal exists at all.
//
// ⚠️ THE SET IS DERIVED, NOT LISTED. Rule 1 reads every `ports:` entry of every service of both files, so a
// sixth door added tomorrow is graded the day it lands — which is the failure mode this repository has paid
// for twice (a rename applied to four places out of six, and a guard that could not see `scripts/`).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BIND = 'FORGE_BENCH_BIND';
const COMPOSE_FILES = ['compose.yml', 'compose.override.yml'];
const DECLARATION = '.env.example';
const BIRTH = 'bin/box-up.sh';

function read(relative) {
  const path = join(ROOT, relative);
  assert.ok(existsSync(path), `${relative} is gone — this guard grades files that must exist`);
  const text = readFileSync(path, 'utf8');
  assert.notEqual(text.trim(), '', `${relative} is empty — nothing to grade is not the same as nothing wrong`);
  return text;
}

/** Line number (1-based) of a character OFFSET — never of the first line that happens to look the same. */
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;

/**
 * Every published-port entry of one compose file: the `- '<something>:<target>'` items under a `ports:` key.
 *
 * ⚠️ IT READS THE LINES, NOT A YAML TREE, and that is a decision this repository already made: it has no
 * package manager and no dependencies, so `bin/bench-ports.guard.mjs` matches text too. What that costs is
 * that a `ports:` written in the long form (`- target: 80` / `published: …`) would not be seen — so rule 0
 * grades the COUNT against what this box is known to publish, and a rewrite into the long form goes red
 * there rather than passing on an empty set.
 */
function publishedPorts(relative) {
  const source = read(relative);
  const out = [];
  let inPorts = false;
  let portsIndent = 0;
  source.split('\n').forEach((line, index) => {
    const item = line.match(/^(\s*)-\s*(.*)$/);
    const key = line.match(/^(\s*)([a-z_]+):\s*$/);
    if (key && key[2] === 'ports') {
      inPorts = true;
      portsIndent = key[1].length;
      return;
    }
    if (!inPorts) return;
    if (item && item[1].length > portsIndent) {
      out.push({ file: relative, line: index + 1, entry: item[2].replace(/^['"]|['"]\s*(#.*)?$/g, '') });
      return;
    }
    // A blank line or a comment inside the block is still the block; anything else at or above the `ports:`
    // indentation has ended it.
    if (line.trim() === '' || /^\s*#/.test(line)) return;
    inPorts = false;
  });
  return out;
}

const PUBLISHED = COMPOSE_FILES.flatMap(publishedPorts);
const EXAMPLE = read(DECLARATION);
const BOX_UP = read(BIRTH);

/** The value `.env.example` — the BENCH's configuration — declares for the bind. `null` when it declares none. */
function declaredBind() {
  const match = EXAMPLE.match(new RegExp(`^${BIND}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const isLoopback = (address) =>
  address === '127.0.0.1' || address === '::1' || address === '[::1]' || address === 'localhost';

// ── 0. IT SEES ITS SUBJECTS ───────────────────────────────────────────────────────────────────────────────

test('★★ this guard can see its subjects — a compose that publishes nothing must accuse itself', () => {
  // ⚠️ ANTI-VACUITY FIRST, and it is not ceremony: every rule below is a filter over `PUBLISHED`, so an empty
  // list passes all of them in silence. This box publishes FIVE doors — the shop, two admins, the counter and
  // the https port — across two files, and a number under that means the scan lost them, not that they went.
  assert.ok(
    PUBLISHED.length >= 5,
    `only ${PUBLISHED.length} published port(s) found across ${COMPOSE_FILES.join(' + ')}. This box publishes the shop, ` +
      'two admin doors, the counter and its https port. A number this small means the `ports:` block moved, ' +
      'was rewritten in the long form, or is no longer where this scan looks — and every rule below would ' +
      'then be grading an empty list, which reads exactly like success.',
  );
  for (const file of COMPOSE_FILES) {
    assert.ok(
      publishedPorts(file).length > 0,
      `${file} publishes no host port at all any more. If a door really moved, say where — here.`,
    );
  }
  assert.ok(
    PUBLISHED.every((p) => /:\d+$/.test(p.entry) || /:\$\{/.test(p.entry)),
    `a published-port entry does not end in a container port:\n  ${PUBLISHED.map((p) => `${p.file}:${p.line} ${p.entry}`).join('\n  ')}`,
  );
});

// ── 1. EVERY DOOR IS BOUND ────────────────────────────────────────────────────────────────────────────────

test('★★★ every host port this box publishes names the interface it is published on', () => {
  const unbound = PUBLISHED.filter((p) => !p.entry.startsWith(`\${${BIND}`)).map(
    (p) => `${p.file}:${p.line} → ${p.entry}`,
  );
  assert.deepEqual(
    unbound,
    [],
    `a door is published without saying on WHICH INTERFACE, so it takes whatever docker binds by default — ` +
      'every one of them. These containers serve plain http and set `Secure` cookies (NODE_ENV=production), ' +
      'and a browser on any origin but `localhost` refuses those cookies: the page answers 200, the cart (or ' +
      'the admin session) comes back empty, and nothing on screen says why. Measured 2026-09-08 on all four ' +
      `of this box's http doors over the tailnet. Put \`\${${BIND}?…}:\` in front of the port.\n  ` +
      unbound.join('\n  '),
  );
});

// ── 2. THE BOX MUST DECLARE ITS EXPOSURE ──────────────────────────────────────────────────────────────────

test('★★ the bind is DEMANDED, never defaulted — a box that decided nothing is refused by name', () => {
  // `${VAR?msg}` (no colon) refuses only an UNSET value; empty is accepted and MEANS "every interface", which
  // is what a deployment declares. `${VAR:-…}` would put a decision nobody made into every box that has no
  // `.env` yet — the exact shape of the 8102 rename `bin/bench-ports.guard.mjs` was written for.
  const wrong = PUBLISHED.filter(
    (p) => p.entry.startsWith(`\${${BIND}`) && !new RegExp(`^\\$\\{${BIND}\\?[^}]+\\}:`).test(p.entry),
  ).map((p) => `${p.file}:${p.line} → ${p.entry}`);
  assert.deepEqual(
    wrong,
    [],
    `${BIND} is read with a DEFAULT instead of being demanded. Compose's \`\${VAR?message}\` form (no colon) ` +
      'stops `docker compose` by name before the first container when nothing declared the value, and accepts ' +
      'an empty one as the legal answer "every interface". A default is a decision nobody made, and it would ' +
      `be silent on exactly the box that has no \`.env\` yet.\n  ${wrong.join('\n  ')}`,
  );
  // ⚠️ ONLY THE ENTRIES THAT CARRY THE BIND. A door with no bind at all is rule 1's finding, and reporting it
  // here too would answer it with the wrong sentence ("the message does not point at .env.example" — there is
  // no message, there is no bind). One defect, one accusation.
  for (const p of PUBLISHED.filter((entry) => entry.entry.startsWith(`\${${BIND}`))) {
    const message = p.entry.match(new RegExp(`^\\$\\{${BIND}\\?([^}]+)\\}`));
    assert.ok(
      message && message[1].includes(DECLARATION),
      `${p.file}:${p.line}: the refusal message does not point at ${DECLARATION}. It is the only thing an ` +
        'operator sees when the box refuses to start, and it has to name the file that carries the answer.',
    );
  }
});

// ── 3. THE BENCH'S ANSWER ─────────────────────────────────────────────────────────────────────────────────

test('★★★ `.env.example` — the BENCH\'s configuration — puts the bench on loopback', () => {
  const declared = declaredBind();
  assert.ok(
    declared !== null,
    `${DECLARATION} does not declare ${BIND}, so \`cp ${DECLARATION} .env\` produces a box compose REFUSES to ` +
      'start. That copy is step one of this repository\'s own runbook.',
  );
  assert.ok(
    isLoopback(declared),
    `${DECLARATION} ships ${BIND}=${JSON.stringify(declared)}. The bench is plain http end to end ` +
      '(caddy/Caddyfile.local carries no TLS) and its fronts mint `Secure` cookies, so any interface but ' +
      'loopback republishes the trap: 200 answers, no cookie kept, no message. A LAN device is a real reason ' +
      'to set it empty — in a `.env`, which is not tracked, never in this file, which every new box copies.',
  );
});

// ── 4. ⟂ THE NEGATIVE CONTROL ─────────────────────────────────────────────────────────────────────────────

test('⟂ NEGATIVE CONTROL — `localhost` keeps its plain-http doors, and that is the whole point', () => {
  // ★★ PERMANENT. `localhost` IS a secure context: the browser stores the cookie, the cart survives, the
  // admin session holds. Hardening the tailnet at the cost of the laptop the bench runs on would be a worse
  // bench than the trap it removed. If the rules above ever start being satisfied by a box nobody can open
  // locally, this is the line that goes red.
  assert.ok(
    isLoopback(declaredBind()),
    `${DECLARATION} binds the bench to something a browser on this machine cannot treat as a secure context. ` +
      `\`http://localhost:<port>\` must keep working — every address in README.md and every one \`${BIRTH}\` ` +
      'prints at the end of a birth is a `localhost` one.',
  );
  // …and the addresses this box hands out really are the ones it binds, or the sentence above is about a
  // door nothing publishes. `bin/bench-ports.guard.mjs` owns the NUMBERS; what is asserted here is that the
  // birth still hands out a `localhost` address at all.
  assert.match(
    BOX_UP,
    /note "shop\s+\$\{FORGE_PUBLIC_ORIGIN:-http:\/\/localhost:\d+\}"/,
    `${BIRTH} no longer hands out a plain-http \`localhost\` shop door at the end of a birth. That door is ` +
      'the one this slice is careful NOT to close, so its absence is a failure of this guard, not a pass.',
  );
  assert.match(
    BOX_UP,
    /note "totem\s+http:\/\/localhost:\$\{FORGE_TOTEM_HTTP_PORT/,
    `${BIRTH} no longer hands out the counter's plain-http \`localhost\` door.`,
  );
});

// ── 5. NO DEAD TAILNET DOOR ───────────────────────────────────────────────────────────────────────────────

test('★★ with the doors on loopback, the promotion refuses to hand out a plain-http tailnet address', () => {
  // The behaviour is exercised for real in `bin/box-config.guard.mjs` (it runs the promotion under stubs).
  // What is held HERE is that the two branches exist at all in the file that hands addresses out — a
  // structural check, so deleting the refusal is red in two places instead of one.
  assert.match(
    BOX_UP,
    /bench_bind_is_loopback\(\)\s*\{/,
    `${BIRTH} no longer derives whether its doors are on loopback. Everything it prints, claims and writes ` +
      'into `.env` during a promotion is an address; without this derivation it cannot tell a door from a ' +
      'dead port, which is what it could not tell before pk24/d4.',
  );
  const promotion = BOX_UP.match(/if \[ "\$MODE" != birth \]; then([\s\S]*?)\n  exit [^\n]+\nfi/);
  assert.ok(promotion, 'the promotion block moved — re-read this guard before believing it.');
  assert.ok(promotion[1].length > 1000, `the promotion block parsed to ${promotion[1].length} characters.`);
  assert.match(
    promotion[1],
    /if bench_bind_is_loopback; then\n\s*die /,
    'the promotion no longer REFUSES when `tailscale serve` publishes nothing and the doors are on loopback. ' +
      'It would write `http://<tailnet>:8200` into FORGE_PUBLIC_ORIGIN and claim admin doors on ports that ' +
      'refuse to connect — and exit 0.',
  );
  assert.match(
    promotion[1],
    /UNREACHABLE /,
    'the promotion no longer names the doors `tailscale serve` does not publish. The refusal above covers ' +
      'the case where it publishes NOTHING; a partial publication falls back to plain http for the rest, ' +
      'one door at a time, which is the quiet half.',
  );
});

// ── the two guards agree about the same lines ─────────────────────────────────────────────────────────────

test('★ the sibling guard still owns the NUMBERS, and this one does not touch them', () => {
  // ⚠️ THE POINT OF THIS TEST IS THE HEADER, not the code. Two guards over one set of lines is how a
  // repository ends up with two answers; the boundary between them is written down in both files and this is
  // what keeps it written down. It also proves the sibling is still there — a rule of this file quietly
  // becoming the only rule over `ports:` would lose the number question with nothing going red.
  const sibling = read('bin/bench-ports.guard.mjs');
  assert.match(
    sibling,
    /ONE BENCH PORT, ONE NUMBER/,
    'bin/bench-ports.guard.mjs is not the file this one divides the work with any more. Re-read both headers.',
  );
  assert.ok(
    sibling.includes('bench-http-door.guard.mjs'),
    "bin/bench-ports.guard.mjs no longer names this file. The split between them — that one grades WHICH " +
      'NUMBER a door has and this one grades WHO CAN REACH IT — is asserted in prose because nothing derives ' +
      'it; a header that stopped saying so is how the next person writes a third answer.',
  );
  // …and it names the bind only in its HEADER, where the split is explained. A rule of that file reading the
  // bind would be the second answer this comment forbids, so the check strips the comments first.
  const siblingCode = sibling
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
  assert.ok(
    !siblingCode.includes(BIND),
    `bin/bench-ports.guard.mjs has started grading ${BIND} in its CODE, not just naming it in its header. Two ` +
      'guards answering one question is two answers the day they disagree; extend THIS file instead.',
  );
});
