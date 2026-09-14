// ★★★ THE SIX ADDRESSES OF THIS BOX, GRADED FROM BOTH ENDS AT ONCE.
//
//   node --test bin/box-domains.guard.mjs        (or: bash bin/test.sh)
//
// ── WHY THIS GUARD EXISTS, AND THE MEASUREMENT THAT PUT IT HERE ─────────────────────────────────────────
//
// THE DEMO PUBLISHES SIX ADDRESSES, one per face this box serves — settled 2026-09-12 and declared in
// `seed/box.json`:
//
//     store.forgecommerce.pro          outlet.store.forgecommerce.pro     admin.store.forgecommerce.pro
//     cafe.forgecommerce.pro           totem.cafe.forgecommerce.pro       admin.cafe.forgecommerce.pro
//
// Four of them had nowhere to be declared. `FORGE_DOMAIN`, `FORGE_ADMIN_DOMAIN` and `FORGE_TOTEM_DOMAIN` are
// three SINGULAR variables for a box with two brands, four stores and two admins — the outlet and the coffee
// shop had no variable at all, and the second admin was a file somebody had to hand-write into `caddy/extra/`.
//
// ⛔⛔ AND THE EDGE A DEPLOYMENT GETS COULD NOT LOAD. Measured 2026-09-12 on the live bench:
// `docker inspect forge-preseed-caddy-1` shows the edge container holding THREE FORGE_* variables —
// `FORGE_DOMAIN`, `FORGE_ADMIN_DOMAIN`, `FORGE_CONTROL_ALLOW_CIDR`. `FORGE_TOTEM_DOMAIN` is not delivered to
// it by compose at all, so `{$FORGE_TOTEM_DOMAIN}` resolved to the empty string, and with the real file and
// exactly those three variables:
//
//     $ docker run --rm -e FORGE_DOMAIN=… -e FORGE_ADMIN_DOMAIN=… -v …:/etc/caddy caddy:2 \
//         caddy validate --config /etc/caddy/Caddyfile
//     Error: adapting config using caddyfile: server block without any key is global configuration, …
//
// An empty site address is not a missing host: it is a file that does not parse, and `caddy/Caddyfile` is
// compose's DEFAULT. Store, checkout and admin down together — the A10 species, one layer out, and the bench
// could never show it because the bench opts into `caddy/Caddyfile.local`.
//
// ── THE FOUR LEGS, AND EVERY ONE OF THEM IS SILENT ON ITS OWN ───────────────────────────────────────────
//
//   1. DECLARED ↔ ROUTED. A hostname `seed/box.json` declares with no site block is a shop that answers
//      somebody else's 404 and a certificate nobody ever asks for; a site block for a variable nothing
//      declares is a certificate asked for on behalf of nobody. Both directions, by name.
//   2. ROUTED ↔ DELIVERED. A variable the edge reads and compose does not pass is the dead edge above.
//   3. EVERY VARIABLE SITE ADDRESS HAS A SENTINEL DEFAULT, and the defaults are DISTINCT. Measured with
//      `caddy:2` v2.11.4: a `.localhost` name is issued by Caddy's own internal CA (`issuer:"local"`, 11 ms,
//      no ACME request), so a variable nobody set costs ONE face on a name nothing resolves. Two blocks
//      sharing one default would be a duplicate site address, which is the dead edge by another road.
//   4. EVERY SHOP HOSTNAME CARRIES THE SAME DOORS. Vitrine and checkout share a hostname and split by PATH —
//      never by subdomain, because a subdomain puts `forge_cart` and `forge_customer_session` on another
//      origin and the shopper loses the cart on the way to paying. So a shop hostname that carries eleven
//      handles and its sibling that carries nine is a shop whose checkout is the other shop's 404. The shared
//      set is the SNIPPET's — every shop hostname must import the same one, and carry every door it defines —
//      because eleven handles copied three times by hand is exactly the list that rots in silence («cinco
//      listas digitadas para mover um bloco», 09/09). A hostname may ADD a door of its own (the café must:
//      its fork's `assetPrefix` is real) — but ONLY to its OWN front, which is the argument it passes to the
//      shared import. ⚠️ THAT SECOND HALF WAS MISSING AND A SABOTAGE FOUND IT: comparing each hostname
//      against the snippet is GREEN when a door is MOVED OUT of the snippet onto one hostname, because the
//      reference loses it at the same moment the siblings do. Measured on this file with `handle /checkout*`
//      moved into the root shop's block: every rule was green while the outlet and the café had lost the
//      buyer's door.
//
// ⚠️ NOTHING HERE NAMES A HOSTNAME, A VARIABLE OR A HANDLE. A seventh face declared tomorrow is graded
// tomorrow; a handle added to one hostname and not its siblings is red the same day.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  ROOT,
  SENTINEL_SUFFIX,
  declaredFaces,
  envSitesOf,
  faceCoverage,
  doorsIn,
  handlesOf,
  readBox,
  siteBlocks,
  snippetsOf,
  upstreamsOf,
} from './box-domains.mjs';

const say = (line) => console.error(`[box-domains] ${line}`);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const EDGE_FILE = 'caddy/Caddyfile';
const BENCH_EDGE_FILE = 'caddy/Caddyfile.local';

const FACES = declaredFaces(readBox());
const SITES = siteBlocks(read(EDGE_FILE));
const BENCH_SITES = siteBlocks(read(BENCH_EDGE_FILE));
const ENV_EXAMPLE = read('.env.example');

/** Every site block whose address comes from the environment, flattened one entry per address. */
const ENV_SITES = envSitesOf(read(EDGE_FILE));

/**
 * Which variables compose DELIVERS to the edge container, read out of the compose files rather than listed.
 * A variable the Caddyfile reads and this set does not carry is the empty site address that killed the file.
 */
function edgeEnvironment() {
  const out = new Map(); // variable → { demanded, fallback }: how compose guarantees it is never empty
  for (const name of ['compose.yml', 'compose.override.yml']) {
    const file = join(ROOT, name);
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    let inService = false;
    let inEnv = false;
    for (const raw of lines) {
      if (/^\s{2}\S/.test(raw)) {
        inService = /^\s{2}caddy:\s*$/.test(raw);
        inEnv = false;
        continue;
      }
      if (!inService) continue;
      if (/^\s{4}\S/.test(raw)) inEnv = /^\s{4}environment:\s*$/.test(raw);
      if (!inEnv) continue;
      const m = raw.match(/^\s{6}([A-Z_][A-Z0-9_]*):\s*(.*)$/);
      if (!m) continue;
      // `${VAR:?…}` is DEMANDED — compose stops by name before a container starts, so the variable can never
      // reach the edge empty. `${VAR:-x}` SUBSTITUTES x for unset AND empty. A bare `${VAR}` is neither, and
      // is the shape that lets the empty string through.
      const demanded = /^\$\{[A-Z_][A-Z0-9_]*:\?/.test(m[2]);
      out.set(m[1], { demanded, fallback: m[2].match(/^\$\{[A-Z_][A-Z0-9_]*:-([^}]*)\}$/)?.[1] ?? null });
    }
  }
  return out;
}

/** Every service the box declares, so an upstream nobody runs is a 502 caught before it is one. */
function composeServices() {
  const out = new Set();
  for (const name of ['compose.yml', 'compose.override.yml']) {
    const file = join(ROOT, name);
    if (!existsSync(file)) continue;
    let inServices = false;
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      if (/^\S/.test(raw)) {
        inServices = /^services:\s*$/.test(raw);
        continue;
      }
      if (inServices) {
        const m = raw.match(/^\s{2}([a-z][a-z0-9_-]*):\s*$/);
        if (m) out.add(m[1]);
      }
    }
  }
  return out;
}

const DELIVERED = edgeEnvironment();
const SERVICES = composeServices();

// ── what every run says out loud, before a single assertion ─────────────────────────────────────────────
for (const face of FACES) {
  say(`declared: ${face.label.padEnd(22)} ${face.host}  ← {$${face.env}}${face.directory ? '' : '  (NOT in the kernel directory, by declaration)'}`);
}
for (const site of ENV_SITES) {
  say(`routed:   ${site.address.padEnd(46)} → ${upstreamsOf(site.site).join(', ') || '(nothing)'}`);
}
for (const [name, how] of DELIVERED) {
  say(`delivered: ${name}${how.demanded ? '  (DEMANDED — compose refuses an unset or empty value)' : how.fallback === null ? '  ⚠️ passed through bare' : ` → ${how.fallback} when unset or empty`}`);
}

// ── 0 · THE VACUUM ──────────────────────────────────────────────────────────────────────────────────────

test('⛔ THE VACUUM CHECK — there is a declaration, there is an edge, and this file can read both', () => {
  assert.ok(FACES.length > 0, 'seed/box.json declares no face at all — every rule below would pass over nothing.');
  assert.ok(
    FACES.some((f) => f.kind === 'store') && FACES.some((f) => f.kind === 'admin'),
    `the declaration has no shop face or no admin face: ${FACES.map((f) => `${f.label}(${f.kind})`).join(', ')}`,
  );
  assert.ok(SITES.length > 0, `${EDGE_FILE} parsed into zero site blocks — the PARSER is broken, not the edge.`);
  assert.ok(BENCH_SITES.length > 0, `${BENCH_EDGE_FILE} parsed into zero site blocks — the parser sees one shape of file only.`);
  assert.ok(ENV_SITES.length > 0, `${EDGE_FILE} has no site address that comes from a variable — nothing below is grading the wire.`);
  assert.ok(DELIVERED.size > 0, 'compose delivers no environment to the edge container — the parse, not the box, is wrong.');
  assert.ok(
    [...DELIVERED.values()].some((v) => v.fallback !== null || v.demanded),
    'no entry in the caddy service reads as `${VAR:-default}` or `${VAR:?…}` — the rule below grades nothing.',
  );
  assert.ok(SERVICES.has('kernel') && SERVICES.has('caddy'), `compose yielded ${SERVICES.size} service(s) and not the ones every box has: ${[...SERVICES].join(', ')}`);
});

test('★ every declared face is complete and unique — a face with no variable cannot reach the edge', () => {
  const broken = FACES.filter((f) => !f.host || !f.env).map((f) => `${f.label} → host=${f.host ?? '(none)'} env=${f.env ?? '(none)'}`);
  assert.deepEqual(broken, [], 'a face in seed/box.json declares a hostname with no variable, or a variable with no hostname.');
  const dup = (key) => {
    const seen = new Map();
    for (const f of FACES) seen.set(f[key], [...(seen.get(f[key]) ?? []), f.label]);
    return [...seen].filter(([, who]) => who.length > 1).map(([v, who]) => `${v} ← ${who.join(' + ')}`);
  };
  assert.deepEqual(dup('host'), [], 'two faces claim one hostname. One of them is unreachable and nothing says which.');
  assert.deepEqual(dup('env'), [], 'two faces share one variable, so setting it points both at one address.');
});

// ── 1 · DECLARED ↔ ROUTED ───────────────────────────────────────────────────────────────────────────────

test('★★★ every hostname this box DECLARES has a block at the edge — the other half of a 404', () => {
  // ★ THE RULE LIVES IN `box-domains.mjs` BECAUSE IT HAS TWO CALLERS (pk35/d4): this guard grades the
  // REPOSITORY at test time, and `bin/promotion-faces.mjs` grades the box a promotion is standing on — a
  // deployment that added a store to its own `seed/box.json` never runs this suite. A second copy of the
  // comparison here would be the list that rots in silence, one file over.
  const orphans = faceCoverage(FACES, ENV_SITES).unrouted.map((f) => `${f.label} — ${f.host} ({$${f.env}}), and ${EDGE_FILE} has no site block for it`);
  assert.deepEqual(
    orphans,
    [],
    'a hostname is declared and the edge does not serve it. DNS points at this box, Caddy asks for no ' +
      "certificate on that name, and every request for it falls through to another site's 404 — or to " +
      'nothing at all. Give it a site block, or take the declaration out.',
  );
});

test('★★★ every block at the edge belongs to a hostname this box DECLARES — a certificate for nobody', () => {
  const orphans = faceCoverage(FACES, ENV_SITES).undeclared.map(
    (s) => `${EDGE_FILE}:${s.site.line} routes {$${s.env}} and seed/box.json declares no face using that variable`,
  );
  assert.deepEqual(
    orphans,
    [],
    'the edge carries a site block for a variable nothing declares. Caddy will provision a certificate for ' +
      'whatever that variable holds, on behalf of a face this box has no topology for — and nothing states ' +
      'which store or which tenant is supposed to answer there.',
  );
});

test('★ and the pairing is ONE-to-one: two blocks for one variable is one of them dead', () => {
  const byEnv = new Map();
  for (const s of ENV_SITES) byEnv.set(s.env, [...(byEnv.get(s.env) ?? []), `${EDGE_FILE}:${s.site.line}`]);
  assert.deepEqual(
    [...byEnv].filter(([, where]) => where.length > 1).map(([env, where]) => `{$${env}} ← ${where.join(' + ')}`),
    [],
    'two site blocks name the same hostname. Caddy refuses a duplicate site address, which does not degrade ' +
      'one host — it stops the whole file loading and takes the store down with it.',
  );
});

// ── 2 · ROUTED ↔ DELIVERED ──────────────────────────────────────────────────────────────────────────────

test('★★★ every variable the edge READS is one compose DELIVERS to it — the dead edge, measured', () => {
  const missing = ENV_SITES
    .filter((s) => !DELIVERED.has(s.env))
    .map((s) => `${EDGE_FILE}:${s.site.line} reads {$${s.env}} and the caddy service passes no such variable`);
  // Written before the assert so a red names BOTH halves at once rather than one run at a time.
  for (const s of ENV_SITES) {
    if (!DELIVERED.has(s.env)) continue;
    const how = DELIVERED.get(s.env);
    // ★ TWO WAYS TO CLOSE THE HOLE, AND EITHER IS ENOUGH. Demanded (`:?`) means the box refuses to start
    // before the edge ever sees an empty value — the stronger and louder of the two. Substituted (`:-x`)
    // means compose fills it, and then x has to BE the Caddyfile's own fallback, because compose is the one
    // that decides: Caddy's `{$VAR:fallback}` fires only when the variable is UNSET, and measured with
    // caddy:2 v2.11.4 a variable that is PRESENT AND EMPTY beats it and the site address goes empty again.
    if (how.demanded) continue;
    if (how.fallback === s.fallback) continue;
    missing.push(
      `${s.env}: the Caddyfile falls back to "${s.fallback ?? '(nothing)'}" and compose ` +
        (how.fallback === null
          ? 'passes it BARE (`${VAR}`), so an empty `.env` line reaches the edge as the empty string'
          : `substitutes "${how.fallback}"`) +
        ' — either demand it with `${VAR:?…}` or substitute the SAME sentinel the Caddyfile names.',
    );
  }
  assert.deepEqual(
    missing,
    [],
    'the edge container never sees this variable, so the placeholder resolves to the EMPTY STRING — and an ' +
      'empty site address is not a missing host. Measured 2026-09-12 against the real file with the real ' +
      "container environment: `caddy validate` answers «server block without any key is global " +
      'configuration, and if used, it must be first», i.e. the whole edge fails to load: store, checkout and ' +
      'admin together. Add it to the caddy service\'s `environment:` in compose.yml.',
  );
});

test('★ every upstream a site block proxies to is a service this box runs', () => {
  const strays = [];
  for (const site of SITES) {
    for (const up of upstreamsOf(site)) {
      if (!SERVICES.has(up)) strays.push(`${EDGE_FILE}:${site.line} (${site.addresses.join(', ')}) proxies to "${up}", which compose does not declare`);
    }
  }
  assert.deepEqual(strays, [], 'a hostname is routed to a container that does not exist: that face answers 502, for ever, and only that one.');
});

// ── 3 · THE SENTINEL ────────────────────────────────────────────────────────────────────────────────────

test('★★★ a variable nobody set costs ONE face, never the edge — every address carries a sentinel default', () => {
  const bare = ENV_SITES
    .filter((s) => !s.fallback)
    .map((s) => `${EDGE_FILE}:${s.site.line} — {$${s.env}} has no default`);
  assert.deepEqual(
    bare,
    [],
    'this site address resolves to the empty string on any box that does not set the variable, and an empty ' +
      'site address stops the WHOLE file loading (measured: «server block without any key is global ' +
      'configuration»). Write it as {$THE_VARIABLE:<something>.localhost}: Caddy issues `.localhost` from ' +
      'its own internal CA (measured: issuer "local", 11 ms, no ACME request), so an unset variable leaves ' +
      'one face on a name nothing resolves and every other face serving.',
  );
  const wrongSuffix = ENV_SITES
    .filter((s) => s.fallback && !s.fallback.endsWith(SENTINEL_SUFFIX))
    .map((s) => `${EDGE_FILE}:${s.site.line} — {$${s.env}:${s.fallback}}`);
  assert.deepEqual(
    wrongSuffix,
    [],
    `a default that does not end in "${SENTINEL_SUFFIX}" is a real name: Caddy will try to obtain a PUBLIC ` +
      'certificate for it, fail on every box that did not set the variable, and retry for ever. It is also a ' +
      'hostname a reader can mistake for a real one. The reserved suffix is what makes the fallback both ' +
      'inert and obvious.',
  );
  const byFallback = new Map();
  for (const s of ENV_SITES) byFallback.set(s.fallback, [...(byFallback.get(s.fallback) ?? []), `{$${s.env}}`]);
  assert.deepEqual(
    [...byFallback].filter(([, who]) => who.length > 1).map(([fb, who]) => `${fb} ← ${who.join(' + ')}`),
    [],
    'two faces share one sentinel, so a box that sets neither variable declares the same site address twice ' +
      '— which Caddy refuses, and that is the dead edge this whole rule exists to prevent, by another road.',
  );
});

// ── 4 · THE DOORS OF A SHOP HOSTNAME ────────────────────────────────────────────────────────────────────

test('★★★ every shop hostname carries the SAME doors — the path split is what keeps the cart', () => {
  const shopEnvs = new Set(FACES.filter((f) => f.kind === 'store' && f.directory).map((f) => f.env));
  const shops = ENV_SITES.filter((s) => shopEnvs.has(s.env));
  // ANTI-VACUUM: a comparison over fewer than two hostnames proves nothing at all, and this box has three.
  assert.ok(
    shops.length >= 2,
    `only ${shops.length} shop hostname(s) reached this rule, so it compared nothing. This box serves a shop ` +
      'on more than one hostname; if that stopped being true, this rule has lost its subject.',
  );
  // ★ THE SHARED SET IS THE SNIPPET'S, NOT "whichever hostname happens to carry the most doors". A hostname
  // is ALLOWED to add one of its own — the café has to, because its fork's asset prefix is real — and a rule
  // that took the longest list as the reference would demand the café's `/_coffee` of the shoe shop.
  const snippets = snippetsOf(read(EDGE_FILE));
  const importedByShops = [...new Set(shops.flatMap((s) => s.site.snippetsUsed))];
  const divergent = shops
    .filter((s) => [...importedByShops].some((n) => !s.site.snippetsUsed.includes(n)))
    .map((s) => `{$${s.env}} imports ${s.site.snippetsUsed.join(', ') || '(nothing)'} while its siblings import ${importedByShops.join(', ')}`);
  assert.deepEqual(
    divergent,
    [],
    'a shop hostname does not import the same shared definition its siblings do, so its doors are a SECOND ' +
      'copy of a list — and the copy is what rots. Every shop hostname imports the same snippet; what differs ' +
      'is the argument it passes.',
  );
  const reference = importedByShops.flatMap((name) => handlesOf(snippets.get(name) ?? { body: [] })).sort();
  assert.ok(
    reference.length >= 5,
    `the shared snippet(s) ${importedByShops.join(', ') || '(none)'} define ${reference.length} handle(s) — ` +
      'either no shop hostname imports one, or the parse lost the body, and this rule is grading nothing.',
  );
  const short = [];
  for (const site of shops) {
    const doors = handlesOf(site.site);
    const missing = reference.filter((d) => !doors.includes(d));
    if (missing.length) short.push(`{$${site.env}} is missing: ${missing.join(', ')}`);
    // ★★★ AND THE RULE THAT KEEPS THE REFERENCE FROM SHRINKING IN SILENCE — a sabotage found this hole.
    // Comparing every hostname against the SNIPPET is green when a door is MOVED OUT of the snippet onto one
    // hostname: the reference loses it at the same moment the siblings do. Measured on this very file, with
    // `handle /checkout*` moved from the snippet into the root shop's block: every rule above stayed green
    // while the outlet and the café silently lost the buyer's door.
    // ⇒ A DOOR A HOSTNAME WRITES FOR ITSELF MAY ONLY REACH ITS OWN FRONT. The argument each block passes to
    // the shared import IS its front, so this needs no container named anywhere: the café's own
    // `handle_path /_coffee/*` goes to `storefront-coffee`, which is its argument, and is fine; a literal
    // door pointing at the CHECKOUT — or at anything else — is a door that belongs to every shop hostname
    // and is therefore the snippet's.
    const ownFronts = new Set(site.site.args);
    for (const own of doorsIn(site.site.rawBody)) {
      const foreign = own.upstreams.filter((u) => !ownFronts.has(u));
      if (foreign.length === 0) {
        say(`note: {$${site.env}} carries a door of its own, to its own front: ${own.door}`);
        continue;
      }
      short.push(
        `{$${site.env}} writes "${own.door}" for itself, reaching ${foreign.join(', ')} — not the front this ` +
          `hostname passes to the shared import (${[...ownFronts].join(', ') || 'nothing'}). A door to a front ` +
          'every shop hostname shares belongs in the snippet, or the siblings lose it the day it moves.',
      );
    }
  }
  assert.deepEqual(
    short,
    [],
    'a shop hostname does not carry a door its siblings carry. The vitrine and the checkout SHARE a hostname ' +
      'and split by PATH — a subdomain would put `forge_cart` and `forge_customer_session` on another origin ' +
      'and the shopper would lose the cart on the way to paying — so a hostname short of `/checkout*` or of ' +
      '`handle_path /_checkout/*` is a shop whose buyer meets the vitrine\'s 404, or an UNSTYLED checkout ' +
      'holding a card number. Put the shared doors in the snippet both hostnames import.',
  );
});

// ── 5 · THE OPERATOR CAN SET THEM ───────────────────────────────────────────────────────────────────────

test('★ .env.example names every variable — a face nobody can configure is a face nobody has', () => {
  const missing = FACES
    .filter((f) => !new RegExp(`^${f.env}=`, 'm').test(ENV_EXAMPLE))
    .map((f) => `${f.env} (${f.label} → ${f.host})`);
  assert.deepEqual(
    missing,
    [],
    '.env.example does not declare this variable, so an operator copying that file has no line to put the ' +
      'hostname on and the face silently falls back to its sentinel.',
  );
});

test('★ the box keeps its own addresses out of the BENCH edge — a localhost birth names none of them', () => {
  // ⛔ THE ONE THING THIS SLICE MUST NOT BREAK. The bench is born on `localhost` (§0b) and the promotion is a
  // NAMED step; a hostname of the deployment leaking into `caddy/Caddyfile.local` would make the bench try to
  // serve an address it has no certificate and no DNS for.
  const benchText = read(BENCH_EDGE_FILE);
  const leaked = FACES.filter((f) => benchText.includes(f.host)).map((f) => `${f.host} (${f.label})`);
  assert.deepEqual(leaked, [], `${BENCH_EDGE_FILE} names an address of the deployment. The bench answers on localhost and nothing else.`);
});
