// ★★★ MZ-9 — EVERY HOSTNAME OF THIS DEMO ANSWERS `X-Robots-Tag: noindex, nofollow`.
//
//   node --test bin/noindex-edge.guard.mjs        (or: bash bin/test.sh)
//
// ── WHY ─────────────────────────────────────────────────────────────────────────────────────────────────
//
// Decided 2026-10-19: the domain's indexing focus is the institutional site, and a fictional shop in a search
// engine gains nothing and can hurt (the brand competing with its own demo, fictional prices and stock as
// structured data). So the WHOLE demo leaves the index — not one page, not one host. The edge is the one place
// every response of every face crosses, so the header is set there, by a snippet every site block imports.
//
// ── WHAT WAS MEASURED, caddy:2 v2.11.4, 2026-10-19, the real file against stub upstreams that answer
//    `X-Robots-Tag: all` ───────────────────────────────────────────────────────────────────────────────────
//
//     before (ee8f87d): every face → [all]; `/tenis?cf.marca=nike` → [noindex, follow][all];
//                       `/v1/control/x` (the edge's own 403) → no header at all
//     after:            all 13 probes, six faces + a hostname in `caddy/extra/` → [noindex, nofollow], ONE value
//
// ── THE RULES, AND WHAT EACH ONE CATCHES ────────────────────────────────────────────────────────────────
//
//   1. THE SNIPPET SAYS EXACTLY `noindex, nofollow`, DEFERRED. Without `defer` an upstream's own header is
//      ADDED by `reverse_proxy` beside the edge's (measured: two values) — the front gets a vote.
//   2. EVERY SITE BLOCK IMPORTS IT, AT THE SITE'S OWN LEVEL. An import nested in a `handle` covers that path
//      only; an import in a comment covers nothing. Both read as present to a grep, so the rule reads CODE
//      and tracks depth. A seventh face added tomorrow without the import is red tomorrow.
//   3. NO OTHER `X-Robots-Tag` IN CODE. Two `header` directives on one field are two answers and the later one
//      wins — which is exactly what the retired `@faceted` patch (`noindex, follow`) would be next to this one.
//   4. THE BENCH'S COPY IS THE SAME SNIPPET, BYTE FOR BYTE. `caddy/Caddyfile.local` cannot import the other
//      file (compose mounts each Caddyfile alone), so the equality is graded instead of shared.
//   5. THE LOOPBACK DOOR ONLY FORWARDS TO THE BENCH EDGE, so it inherits rule 2 instead of needing it.
//   6. THE RECIPE FOR AN EXTRA HOSTNAME CARRIES THE IMPORT — `caddy/extra/README.md` is what someone copies.
//
// ⚠️ robots.txt is NOT graded here and blocks nothing on purpose: a crawler kept out by it never sees this
// header. `storefront-coffee/src/app/robots.test.ts` pins that.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { ROOT, topLevelBlocks } from './box-domains.mjs';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

export const SNIPPET = 'forge_noindex';
export const SNIPPET_CODE = ['header {', 'X-Robots-Tag "noindex, nofollow"', 'defer', '}'];

/** The file with every comment removed — a `#` at the start of a line or after whitespace (Caddy's rule). */
export const codeOf = (text) =>
  text
    .split('\n')
    .map((l) => l.replace(/(^|\s)#.*$/, '').replace(/\s+$/, ''))
    .join('\n');

/** Site blocks of a Caddyfile's CODE: neither the global options block nor a snippet definition. */
export function sitesOf(text) {
  return topLevelBlocks(codeOf(text)).filter((b) => b.header !== '' && !/^\(.*\)$/.test(b.header));
}

/** The body of a snippet definition, code only, trimmed, blank lines out; `null` if it is not defined. */
export function snippetCode(text, name = SNIPPET) {
  const b = topLevelBlocks(codeOf(text)).find((x) => x.header === `(${name})`);
  return b ? b.body.map((l) => l.trim()).filter(Boolean) : null;
}

/** The site blocks that do NOT import the snippet at their own level (depth 0 of the site's body). */
export function sitesWithoutNoindex(text, name = SNIPPET) {
  return sitesOf(text).filter((site) => {
    let depth = 0;
    for (const raw of site.body) {
      const line = raw.trim();
      if (depth === 0 && new RegExp(`^import\\s+${name}$`).test(line)) return false;
      if (line.endsWith('{')) depth += 1;
      if (line === '}') depth -= 1;
    }
    return true;
  });
}

/** Lines of CODE naming `X-Robots-Tag` outside the snippet definition. */
export function strayRobotsHeaders(text, name = SNIPPET) {
  return topLevelBlocks(codeOf(text))
    .filter((b) => b.header !== `(${name})`)
    .flatMap((b) => b.body.filter((l) => /x-robots-tag/i.test(l)).map((l) => `${b.header} › ${l.trim()}`));
}

const EDGES = ['caddy/Caddyfile', 'caddy/Caddyfile.local'];

for (const file of EDGES) {
  test(`★ ${file}: the ${SNIPPET} snippet says exactly noindex, nofollow — deferred`, () => {
    assert.deepEqual(snippetCode(read(file)), SNIPPET_CODE);
  });

  test(`★★ ${file}: every site block imports ${SNIPPET} at its own level`, () => {
    const text = read(file);
    assert.ok(sitesOf(text).length > 0, `${file}: the parse found no site block — the rule would grade nothing`);
    const missing = sitesWithoutNoindex(text).map((s) => `${s.header} (line ${s.line})`);
    assert.deepEqual(missing, [], `${file}: these hostnames would be indexed:\n  ${missing.join('\n  ')}`);
  });

  test(`★ ${file}: no other X-Robots-Tag in code — one answer, the snippet's`, () => {
    assert.deepEqual(strayRobotsHeaders(read(file)), []);
  });
}

test('★ the bench edge carries the production snippet byte for byte', () => {
  const block = (rel) => topLevelBlocks(read(rel)).find((b) => b.header === `(${SNIPPET})`)?.body.join('\n');
  assert.equal(block('caddy/Caddyfile.local'), block('caddy/Caddyfile'));
});

test('the loopback door only forwards to the bench edge, so it inherits the header', () => {
  const sites = sitesOf(read('caddy/Caddyfile.loopback'));
  assert.ok(sites.length > 0);
  for (const s of sites) {
    assert.deepEqual(s.body.map((l) => l.trim()).filter(Boolean), ['reverse_proxy caddy:80'], s.header);
  }
});

test('the recipe for an extra hostname carries the import', () => {
  const fences = [...read('caddy/extra/README.md').matchAll(/```caddy\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(fences.length > 0, 'caddy/extra/README.md: no ```caddy example found');
  for (const f of fences) assert.deepEqual(sitesWithoutNoindex(f).map((s) => s.header), []);
});

// ── NEGATIVE CONTROLS — the rules can see the forbidden state, on fabricated files ──────────────────────
const SNIP = `(${SNIPPET}) {\n\theader {\n\t\tX-Robots-Tag "noindex, nofollow"\n\t\tdefer\n\t}\n}\n`;

test('control: a site without the import, with it in a comment, or nested in a handle — all three seen', () => {
  const text = `${SNIP}
a.example.test {
\timport ${SNIPPET}
\treverse_proxy admin:3000
}
b.example.test {
\treverse_proxy admin:3000
}
c.example.test {
\t# import ${SNIPPET}
\treverse_proxy admin:3000
}
d.example.test {
\thandle /x* {
\t\timport ${SNIPPET}
\t\treverse_proxy admin:3000
\t}
}
`;
  assert.deepEqual(
    sitesWithoutNoindex(text).map((s) => s.header),
    ['b.example.test', 'c.example.test', 'd.example.test'],
  );
});

test('control: the retired faceted patch next to the snippet is a stray header', () => {
  const text = `${SNIP}
a.example.test {
\timport ${SNIPPET}
\t@faceted expression {http.request.uri.query}.contains("cf.")
\theader @faceted X-Robots-Tag "noindex, follow"
}
`;
  assert.equal(strayRobotsHeaders(text).length, 1);
});

test('control: a snippet without defer is not the snippet', () => {
  assert.notDeepEqual(snippetCode(SNIP.replace('\t\tdefer\n', '')), SNIPPET_CODE);
});
