// ★★ v0.3.3 (VC-2) — EVERY HOSTNAME OF THIS BOX WRITES AN ACCESS LOG, AND THE LOG HAS A CEILING.
//
//   node --test bin/access-log-edge.guard.mjs        (or: bash bin/test.sh)
//
// ── WHY ─────────────────────────────────────────────────────────────────────────────────────────────────
//
// On 2026-10-19 this demo's production box filled its disk, and the edge had written ZERO access lines in 24 h —
// Caddy logs no request unless a site says `log` — so nobody could say who generated the traffic. Forge v0.3.3
// ships an `(access_log)` snippet in the template's Caddyfile (a file in the `caddy_logs` volume, rolled at
// 100 MiB, 5 gzipped files, 30 days, `email`/`code`/`state` and `Referer` redacted) and says a site of one's
// own in `caddy/extra/` should import it too. This box copied it; these rules keep it copied.
//
// ── WHAT WAS MEASURED, caddy:2 v2.11.4, 2026-10-20, the real file + a hostname in `caddy/extra/` ────────
//
//     after:  `caddy validate` → Valid; 4 requests to 4 hostnames → 4 lines, `uri` with `code=REDACTED&
//             email=REDACTED&page=2&state=REDACTED`, no `Referer`, 0 matches for the planted e-mails/secrets
//     before (main's file, same requests): `/var/log/caddy` EMPTY
//
// ── THE RULES ───────────────────────────────────────────────────────────────────────────────────────────
//
//   1. THE SNIPPET IS THE TEMPLATE'S, CODE FOR CODE — the ceiling and the redactions are the point of it.
//   2. EVERY SITE BLOCK IMPORTS IT AT ITS OWN LEVEL (the depth rule `bin/noindex-edge.guard.mjs` already uses:
//      an import in a comment or inside a `handle` does not count).
//   3. THE FILE IT WRITES IS IN THE VOLUME — compose mounts `caddy_logs` at `/var/log/caddy` on the edge.
//      Without the mount the log lands in the container layer: rolled, but lost on every recreate.
//   4. THE RECIPE FOR AN EXTRA HOSTNAME CARRIES THE IMPORT — `caddy/extra/README.md` is what someone copies.
//
// ⚠️ The bench edge (`caddy/Caddyfile.local`) is NOT graded and logs nothing, like the product's own bench and
// dev edges (`docs/operations/access-log.md`, "O que não está aqui"): it only ever sees the developer.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { ROOT } from './box-domains.mjs';
import { serviceBlock, sitesOf, sitesWithoutImport, snippetCode, volumeAt } from './edge-text.mjs';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

export const SNIPPET = 'access_log';
export const LOG_DIR = '/var/log/caddy';
/** `templates/instance/caddy/Caddyfile` at v0.3.3, the snippet's body — code lines, trimmed. */
export const SNIPPET_CODE = [
  'log {',
  `output file ${LOG_DIR}/access.log {`,
  'roll_size 100MiB',
  'roll_keep 5',
  'roll_keep_for 720h',
  '}',
  'format filter {',
  'request>uri query {',
  'replace email REDACTED',
  'replace code REDACTED',
  'replace state REDACTED',
  '}',
  'request>headers>Referer delete',
  '}',
  '}',
];

test(`★★ caddy/Caddyfile: the ${SNIPPET} snippet is the template's — the ceiling and the redactions included`, () => {
  assert.deepEqual(snippetCode(read('caddy/Caddyfile'), SNIPPET), SNIPPET_CODE);
});

test(`★★★ caddy/Caddyfile: every site block imports ${SNIPPET} at its own level`, () => {
  const text = read('caddy/Caddyfile');
  assert.ok(sitesOf(text).length >= 6, 'the parse found fewer than the six faces — the rule would grade too little');
  const missing = sitesWithoutImport(text, SNIPPET).map((s) => `${s.header} (line ${s.line})`);
  assert.deepEqual(missing, [], `these hostnames would log nothing:\n  ${missing.join('\n  ')}`);
});

test('★★ compose: the edge mounts caddy_logs where the snippet writes', () => {
  const caddy = serviceBlock(read('compose.yml'), 'caddy');
  assert.ok(caddy, 'compose.yml has no `caddy` service');
  assert.equal(volumeAt(caddy, LOG_DIR), 'caddy_logs', `nothing named is mounted at ${LOG_DIR}: the log dies with the container`);
});

test('the recipe for an extra hostname carries the import', () => {
  const fences = [...read('caddy/extra/README.md').matchAll(/```caddy\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(fences.length > 0, 'caddy/extra/README.md: no ```caddy example found');
  for (const f of fences) assert.deepEqual(sitesWithoutImport(f, SNIPPET).map((s) => s.header), []);
});

// ── NEGATIVE CONTROLS ───────────────────────────────────────────────────────────────────────────────────
test('control: a snippet that lost its ceiling or a redaction no longer matches', () => {
  const body = (lines) => `(${SNIPPET}) {\n${lines.map((l) => `\t${l}`).join('\n')}\n}\n`;
  assert.deepEqual(snippetCode(body(SNIPPET_CODE), SNIPPET), SNIPPET_CODE);
  assert.notDeepEqual(snippetCode(body(SNIPPET_CODE.filter((l) => l !== 'roll_size 100MiB')), SNIPPET), SNIPPET_CODE);
  assert.notDeepEqual(snippetCode(body(SNIPPET_CODE.filter((l) => !/Referer/.test(l))), SNIPPET), SNIPPET_CODE);
});

test('control: a site without the import, or with it only in a handle, is seen', () => {
  const text = `a.example.test {\n\timport ${SNIPPET}\n\trespond 1\n}\nb.example.test {\n\trespond 1\n}\nc.example.test {\n\thandle /x* {\n\t\timport ${SNIPPET}\n\t}\n}\n`;
  assert.deepEqual(sitesWithoutImport(text, SNIPPET).map((s) => s.header), ['b.example.test', 'c.example.test']);
});

test('control: an edge whose log is not on a volume is seen', () => {
  assert.equal(volumeAt(['      - caddy_data:/data', `      - ./logs:${LOG_DIR}`], LOG_DIR), null);
  assert.equal(volumeAt([`      - caddy_logs:${LOG_DIR}`], LOG_DIR), 'caddy_logs');
});
