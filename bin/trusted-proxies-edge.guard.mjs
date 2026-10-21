// ★★★ FI-BORDA (EDGE-CDN, v0.4) — THE EDGE BELIEVES THE ADDRESS CLOUDFLARE HANDS IT, AND ONLY CLOUDFLARE'S.
//
//   node --test bin/trusted-proxies-edge.guard.mjs        (or: bash bin/test.sh)
//
// ── WHY ─────────────────────────────────────────────────────────────────────────────────────────────────
//
// With Cloudflare's proxy on, every request reaches this box from one of Cloudflare's few edge addresses.
// The kernel caps `cart.set_buyer`, `cart.apply_coupon`, `customer.request_otp` and `read.email_registered`
// at ten a minute PER STORE × ADDRESS, so an edge that cannot tell the shopper from the CDN counts every
// shopper behind one Cloudflare edge as one person: a 429 in the middle of the checkout, nobody attacking.
// Forge v0.3.3 ships the recipe (`templates/instance/caddy/Caddyfile` + README §"Behind a CDN"); this box
// copied it, and these rules keep it copied AND working.
//
// ── THE RULES ───────────────────────────────────────────────────────────────────────────────────────────
//
//   1. THE GLOBAL BLOCK — `servers { trusted_proxies static {$FORGE_TRUSTED_PROXY_CIDRS}; trusted_proxies_strict }`,
//      first in caddy/Caddyfile, code only (a commented-out line does not count).
//   2. `(forwarded_client)` IS THE TEMPLATE'S and every site block imports it at its own level, and so does
//      the recipe in caddy/extra/README.md.
//   3. THE CONTROL FACE IS JUDGED ON `client_ip` (the resolved address), never `remote_ip` (the CDN's).
//   4. compose DELIVERS the variable with Cloudflare's ranges as the UNSET default (`-`, so EMPTY stays "trust
//      nobody"), pinned below with the date they were read.
//   5. ★★★ BY HTTP, ON THE REAL FILE, IN A REAL CADDY (the image compose.yml names): (a) a peer INSIDE the
//      trusted range relaying `X-Forwarded-For` → the upstream receives the shopper's address, on every site
//      block; (b) a peer OUTSIDE it forging the header → the upstream receives the peer; (c) the variable
//      unset or empty → the peer, which is this box before FI-BORDA. Plus the access log records both
//      addresses, and the control face's allow-list follows the resolved one.
//      ⚠️ AND THE SAME RUN PROVES THE RULE CAN SEE RED: the real file with `trusted_proxies_strict` removed
//      lets a left-hand forgery through, without the global block (a) fails, and without `forwarded_client`
//      the forgery reaches the upstream first in the header. A guard whose sabotage passes grades nothing.
//
//      Rule 5 needs docker and `caddy:2` already on this machine (it never pulls); without them it is NOT
//      CHECKED, never quietly passed. It uses a network with no way out (`internal: true`) and its own compose
//      project (`fi-borda-trust-<pid>`, the slice that wrote it), and takes it down with its volumes.
//      ⚠️ The peers are a TEST range on that network, not Cloudflare's: the rule under test is "a peer in
//      FORGE_TRUSTED_PROXY_CIDRS is believed, any other is not", and it does not depend on which range it is.
//
// ── WHAT WAS MEASURED, caddy:2 v2.11.4, 2026-10-21 (the numbers this file's assertions hold) ────────────
//
//     real file, trusted peer, `XFF: 6.6.6.6, 198.51.100.7` → upstream `198.51.100.7, 10.254.213.10` (6 sites, 9 doors)
//     real file, untrusted peer, `XFF: 198.51.100.7`        → upstream `10.254.213.20`
//     variable unset / empty, `XFF: 198.51.100.7`           → upstream `10.254.213.10` (= main's file)
//     sabotage, no `trusted_proxies_strict`                 → upstream `6.6.6.6, 10.254.213.10`
//     sabotage, no global block                             → upstream `10.254.213.10`
//     sabotage, no `forwarded_client`                       → upstream `6.6.6.6, 198.51.100.7, 10.254.213.10`

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { ROOT, topLevelBlocks } from './box-domains.mjs';
import { codeOf, serviceBlock, sitesOf, sitesWithoutImport, snippetCode } from './edge-text.mjs';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

export const VARIABLE = 'FORGE_TRUSTED_PROXY_CIDRS';
export const SNIPPET = 'forwarded_client';
/** The template's global block at v0.3.3, code lines, trimmed. */
export const GLOBAL_CODE = ['servers {', `trusted_proxies static {$${VARIABLE}}`, 'trusted_proxies_strict', '}'];
export const SNIPPET_CODE = ['request_header X-Forwarded-For {client_ip}'];
/** https://www.cloudflare.com/ips-v4 and /ips-v6, read 2026-10-21. Cloudflare changes them: re-read, re-pin. */
export const CLOUDFLARE = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];

/** The global options block (the header-less top-level block), code lines trimmed; null if absent or not first. */
export function globalCode(text) {
  const blocks = topLevelBlocks(codeOf(text));
  if (!blocks.length || blocks[0].header !== '') return null;
  return blocks[0].body.map((l) => l.trim()).filter(Boolean);
}

/** How compose's caddy service spells the variable: `{ unsetDefault }` for `${VAR-x}`, null otherwise. */
export function composeDelivery(text) {
  const line = (serviceBlock(text, 'caddy') ?? []).map((l) => l.match(new RegExp(`^ {6}${VARIABLE}:\\s*(.*)$`))).find(Boolean);
  if (!line) return null;
  const m = line[1].replace(/^'(.*)'$/, '$1').match(new RegExp(`^\\$\\{${VARIABLE}-([^}]*)\\}$`));
  return m ? { unsetDefault: m[1].split(/\s+/).filter(Boolean) } : { unsetDefault: null };
}

// ── 1-4 · THE TEXT ──────────────────────────────────────────────────────────────────────────────────────

test('★★★ caddy/Caddyfile: the global block trusts FORGE_TRUSTED_PROXY_CIDRS, strictly — first in the file', () => {
  assert.deepEqual(globalCode(read('caddy/Caddyfile')), GLOBAL_CODE);
});

test(`★★ caddy/Caddyfile: the ${SNIPPET} snippet is the template's, and every site block imports it`, () => {
  const text = read('caddy/Caddyfile');
  assert.deepEqual(snippetCode(text, SNIPPET), SNIPPET_CODE);
  assert.ok(sitesOf(text).length >= 6, 'the parse found fewer than the six faces — the rule would grade too little');
  const missing = sitesWithoutImport(text, SNIPPET).map((s) => `${s.header} (line ${s.line})`);
  assert.deepEqual(missing, [], `these hostnames pass the caller's own X-Forwarded-For along:\n  ${missing.join('\n  ')}`);
});

test('★★ caddy/Caddyfile: the control face is judged on the resolved address, never the TCP peer', () => {
  const code = codeOf(read('caddy/Caddyfile'));
  assert.match(code, /@control_allowed client_ip \{\$FORGE_CONTROL_ALLOW_CIDR:127\.0\.0\.1\/32\}/);
  assert.doesNotMatch(code, /\bremote_ip\b/, 'behind Cloudflare `remote_ip` is always a Cloudflare edge');
});

test('★★ compose: the edge receives Cloudflare’s ranges when unset, and EMPTY stays empty', () => {
  assert.deepEqual(composeDelivery(read('compose.yml')), { unsetDefault: CLOUDFLARE });
});

test('the recipe for an extra hostname carries the import', () => {
  const fences = [...read('caddy/extra/README.md').matchAll(/```caddy\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(fences.length > 0, 'caddy/extra/README.md: no ```caddy example found');
  for (const f of fences) assert.deepEqual(sitesWithoutImport(f, SNIPPET).map((s) => s.header), []);
});

// ── NEGATIVE CONTROLS (text) ────────────────────────────────────────────────────────────────────────────
test('control: a global block without strict, commented out, or not first is seen', () => {
  const g = (body) => `{\n${body.map((l) => `\t${l}`).join('\n')}\n}\nx.example.test {\n\trespond 1\n}\n`;
  assert.deepEqual(globalCode(g(GLOBAL_CODE)), GLOBAL_CODE);
  assert.notDeepEqual(globalCode(g(GLOBAL_CODE.filter((l) => l !== 'trusted_proxies_strict'))), GLOBAL_CODE);
  assert.notDeepEqual(globalCode(g(GLOBAL_CODE.map((l) => (l === 'trusted_proxies_strict' ? `# ${l}` : l)))), GLOBAL_CODE);
  assert.equal(globalCode(`(s) {\n\trespond 1\n}\n${g(GLOBAL_CODE)}`), null);
});

test('control: compose spellings other than `${VAR-ranges}` are seen', () => {
  const c = (v) => `services:\n  caddy:\n    environment:\n      ${VARIABLE}: ${v}\n`;
  assert.deepEqual(composeDelivery(c("'${FORGE_TRUSTED_PROXY_CIDRS-1.2.3.0/24 ::1/128}'")), { unsetDefault: ['1.2.3.0/24', '::1/128'] });
  assert.deepEqual(composeDelivery(c('${FORGE_TRUSTED_PROXY_CIDRS:-1.2.3.0/24}')), { unsetDefault: null });
  assert.deepEqual(composeDelivery(c('${FORGE_TRUSTED_PROXY_CIDRS}')), { unsetDefault: null });
  assert.equal(composeDelivery('services:\n  caddy:\n    environment:\n      OTHER: x\n'), null);
});

// ── 5 · BY HTTP ─────────────────────────────────────────────────────────────────────────────────────────

const SUBNET = '10.254.213.0/24';
const INSIDE = '10.254.213.10'; // the trusted peer — the CDN edge, in this test
const OUTSIDE = '10.254.213.20'; // a peer nobody trusts — a shopper reaching the box directly
const BUYER = '198.51.100.7'; // TEST-NET-2: the shopper the CDN says it is relaying
const FORGED = '6.6.6.6'; // what a shopper writes into the header themselves
/** Every site block of the real file, each on a port of its own (the bench's `http://:<port>` trick). */
const SITES = {
  FORGE_DOMAIN: 8001,
  FORGE_OUTLET_DOMAIN: 8002,
  FORGE_CAFE_DOMAIN: 8003,
  FORGE_ADMIN_DOMAIN: 8004,
  FORGE_CAFE_ADMIN_DOMAIN: 8005,
  FORGE_TOTEM_DOMAIN: 8006,
};
/** Doors that reach the upstream through different `handle`s of the shop snippet (and the bare admin/totem). */
const TARGETS = [
  ...Object.values(SITES).map((p) => `${p}/`),
  '8001/v1/ping', '8001/checkout', '8003/_coffee/x',
];

const docker = (args, opts = {}) => spawnSync('docker', args, { encoding: 'utf8', timeout: 180_000, ...opts });

function edgeImage() {
  const line = (serviceBlock(read('compose.yml'), 'caddy') ?? []).find((l) => /^ {4}image:/.test(l));
  return line?.replace(/^ {4}image:\s*/, '').trim();
}

/** Why rule 5 cannot run here, or null. */
function cannotRun(image) {
  if (docker(['info', '--format', '{{.ServerVersion}}']).status !== 0) return 'no docker daemon reachable';
  if (docker(['compose', 'version']).status !== 0) return 'no `docker compose`';
  if (docker(['image', 'inspect', image]).status !== 0) return `\`${image}\` is not on this machine (docker pull ${image}) — this rule never pulls`;
  return null;
}

/** The real file, with one sabotage applied to its CODE — each must change the text, or the control is vacuous. */
function sabotaged(text, kind) {
  const out = {
    nostrict: () => text.replace(/^\t+trusted_proxies_strict\n/m, ''),
    noglobal: () => text.replace(/^\{\n\tservers \{\n[\s\S]*?^\t\}\n\}\n/m, ''),
    noforward: () => text.replace(/^\trequest_header X-Forwarded-For \{client_ip\}\n/m, '\theader -X-Never-Set\n'),
  }[kind]();
  return { text: out, applied: out !== text };
}

test('★★★ by HTTP: a trusted peer is believed, any other is not, and empty is today — on the real file', { timeout: 300_000 }, (t) => {
  const image = edgeImage();
  const why = cannotRun(image);
  if (why) return t.skip(`NOT CHECKED — ${why}`);

  const dir = mkdtempSync(join(tmpdir(), 'fi-borda-trust-'));
  const project = `fi-borda-trust-${process.pid}`;
  const compose = (...args) => docker(['compose', '-f', join(dir, 'compose.yml'), ...args]);
  t.after(() => {
    compose('down', '-v', '--remove-orphans', '-t', '0');
    rmSync(dir, { recursive: true, force: true });
  });
  const real = read('caddy/Caddyfile');
  mkdirSync(join(dir, 'extra'));
  writeFileSync(join(dir, 'echo.Caddyfile'), '{\n\tadmin off\n}\n:3000 {\n\trespond "xff={header.X-Forwarded-For}"\n}\n');
  const sabotages = Object.fromEntries(['nostrict', 'noglobal', 'noforward'].map((k) => [k, sabotaged(real, k)]));
  for (const [k, v] of Object.entries(sabotages)) writeFileSync(join(dir, `${k}.Caddyfile`), v.text);

  const domains = Object.entries(SITES).map(([k, p]) => `      ${k}: 'http://:${p}'`).join('\n');
  const edge = (file, env) => `    image: ${image}
    pull_policy: never
    networks: [t]
    environment:
${domains}
      FORGE_CONTROL_ALLOW_CIDR: ${BUYER}/32
${env}
    volumes:
      - ${file}:/etc/caddy/Caddyfile:ro
      - ${join(ROOT, 'caddy/certs')}:/etc/caddy/certs:ro
      - ${join(dir, 'extra')}:/etc/caddy/extra:ro`;
  const trusted = `      ${VARIABLE}: ${INSIDE}/32`;
  const client = (ip) => `    image: ${image}
    pull_policy: never
    entrypoint: ['sleep', '600']
    networks: { t: { ipv4_address: ${ip} } }`;
  const edges = {
    real: edge(join(ROOT, 'caddy/Caddyfile'), trusted),
    unset: edge(join(ROOT, 'caddy/Caddyfile'), ''),
    empty: edge(join(ROOT, 'caddy/Caddyfile'), `      ${VARIABLE}: ''`),
    nostrict: edge(join(dir, 'nostrict.Caddyfile'), trusted),
    noglobal: edge(join(dir, 'noglobal.Caddyfile'), trusted),
    noforward: edge(join(dir, 'noforward.Caddyfile'), trusted),
  };
  writeFileSync(join(dir, 'compose.yml'), `name: ${project}
networks:
  t:
    internal: true
    ipam:
      config:
        - subnet: ${SUBNET}
          ip_range: 10.254.213.128/25
services:
  echo:
    image: ${image}
    pull_policy: never
    command: ['caddy', 'run', '--config', '/e/Caddyfile', '--adapter', 'caddyfile']
    volumes: ['${join(dir, 'echo.Caddyfile')}:/e/Caddyfile:ro']
    networks: { t: { aliases: [kernel, storefront, checkout, admin, totem, storefront-coffee] } }
  inside:
${client(INSIDE)}
  outside:
${client(OUTSIDE)}
${Object.entries(edges).map(([k, v]) => `  edge-${k}:\n${v}`).join('\n')}
`);

  const up = compose('up', '-d', '--wait');
  assert.equal(up.status, 0, `compose up failed:\n${up.stderr}`);

  /** What the upstream received, per target: `{ "<port>/<path>": "<X-Forwarded-For>" }`. */
  const ask = (from, name, xff) => {
    const script = TARGETS.map((p) => {
      const [port, ...rest] = p.split('/');
      return `printf '%s\\t%s\\n' '${p}' "$(wget -qO- -T 5 --header 'X-Forwarded-For: ${xff}' 'http://edge-${name}:${port}/${rest.join('/')}' 2>&1)"`;
    }).join('\n');
    const r = compose('exec', '-T', from, 'sh', '-c', script);
    assert.equal(r.status, 0, r.stderr);
    return Object.fromEntries(r.stdout.trim().split('\n').map((l) => l.split('\t')).map(([k, v]) => [k, v.replace(/^xff=/, '')]));
  };
  const all = (seen, expected, label) =>
    assert.deepEqual(seen, Object.fromEntries(TARGETS.map((p) => [p, expected])), label);

  // (a) the CDN's hop is believed — read from the RIGHT, so the shopper's own left-hand entry is dropped.
  all(ask('inside', 'real', `${FORGED}, ${BUYER}`), `${BUYER}, ${INSIDE}`, '(a) a trusted peer relaying the shopper');
  // (b) a peer nobody trusts gets no say: the forged header is replaced by the peer's own address.
  all(ask('outside', 'real', BUYER), OUTSIDE, '(b) an untrusted peer forging X-Forwarded-For');
  // (c) without the variable — unset, or empty as the bench kit sets it — the box as it was.
  all(ask('inside', 'unset', BUYER), INSIDE, '(c) the variable unset');
  all(ask('inside', 'empty', BUYER), INSIDE, '(c) the variable empty');

  // The control face follows the RESOLVED address: allowed for the relayed shopper, refused for a forger.
  const control = (from, xff) =>
    compose('exec', '-T', from, 'sh', '-c', `wget -S -qO- -T 5 --header 'X-Forwarded-For: ${xff}' http://edge-real:8001/v1/control/x 2>&1 | head -1`).stdout.trim();
  assert.match(control('inside', BUYER), /HTTP\/1\.1 200/, 'the allow-listed shopper behind the trusted peer reaches the control face');
  assert.match(control('outside', BUYER), /HTTP\/1\.1 403/, 'a direct caller writing the allow-listed address is refused');

  // The access log keeps BOTH: the address believed, and the peer that said so.
  const log = compose('exec', '-T', 'edge-real', 'cat', '/var/log/caddy/access.log').stdout.trim().split('\n').map((l) => JSON.parse(l));
  const pairs = new Set(log.map((e) => `${e.request.client_ip} via ${e.request.remote_ip}`));
  assert.ok(pairs.has(`${BUYER} via ${INSIDE}`), `no access line holds the resolved shopper and its peer: ${[...pairs].join(', ')}`);
  assert.ok(pairs.has(`${OUTSIDE} via ${OUTSIDE}`), `no access line holds the direct peer as itself: ${[...pairs].join(', ')}`);

  // ── THE SABOTAGES, AND EACH MUST PRODUCE THE FORBIDDEN THING (else the assertions above are vacuous) ──
  // Checked HERE, after the real file was graded, so a real file that already lost a line reds on (a)/(b)/(c)
  // above — the measurement — and not first on "the sabotage has nothing left to remove".
  for (const [k, v] of Object.entries(sabotages)) assert.ok(v.applied, `the sabotage "${k}" did not apply — its control would grade the real file`);
  all(ask('inside', 'nostrict', `${FORGED}, ${BUYER}`), `${FORGED}, ${INSIDE}`, 'control: without strict the LEFT entry wins');
  all(ask('inside', 'noglobal', BUYER), INSIDE, 'control: without the global block (a) is lost');
  all(ask('inside', 'noforward', `${FORGED}, ${BUYER}`), `${FORGED}, ${BUYER}, ${INSIDE}`, 'control: without forwarded_client the forgery leads');
});

