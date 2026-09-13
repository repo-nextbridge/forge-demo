// ★★★ THE ADDRESSES THIS BOX IS PUBLISHED AT, AND THE TWO ENDS THAT HAVE TO AGREE ABOUT EACH ONE.
//
// A deployment of this instance answers on SIX hostnames — three shops, two admins and the counter — and
// until pk34 only three of them could be declared at all. `FORGE_DOMAIN`, `FORGE_ADMIN_DOMAIN` and
// `FORGE_TOTEM_DOMAIN` are SINGULAR variables for a box that holds two brands, four stores and two admins,
// so the outlet, the coffee shop and the second admin had nowhere to be named: the first two simply did not
// exist, and the third was a file somebody had to hand-write into `caddy/extra/`.
//
// ── WHAT IS A FACE, AND WHERE EACH HALF OF IT LIVES ─────────────────────────────────────────────────────
//
// A face is one hostname this box answers on. It has exactly two halves and they live in different files on
// purpose:
//
//   · THE ADDRESS IS DATA. A store's public hostname is the `host` column the kernel keys its directory on
//     (`storePublicUrl`/`storeHostKey`), and an admin's is what `read.admin.by_host` resolves — both are
//     facts about the TOPOLOGY, which is what `seed/box.json` is for. So the hostname is declared there,
//     beside the `admin_host` each tenant already carries and the `status` each store already carries.
//   · WHICH CONTAINER SERVES IT IS THE EDGE'S. `caddy/Caddyfile` turns a hostname into an upstream, and
//     nothing in `seed/box.json` names a container.
//
// The wire between the two is the ENVIRONMENT VARIABLE: Caddy cannot read `seed/box.json`, so each face
// names the variable that carries its address to the edge, and `bin/box-domains.guard.mjs` is what makes the
// two ends unable to drift. A hostname declared with no site block is a store that answers somebody else's
// 404; a site block for a variable nothing declares is a certificate asked for on behalf of nobody.
//
// ⛔⛔ AND THE THIRD END IS COMPOSE, WHICH IS WHERE THIS WAS ALREADY BROKEN. Measured 2026-09-12 on the live
// bench: `docker inspect forge-preseed-caddy-1` shows the edge container holding exactly three FORGE_*
// variables — `FORGE_DOMAIN`, `FORGE_ADMIN_DOMAIN`, `FORGE_CONTROL_ALLOW_CIDR`. `FORGE_TOTEM_DOMAIN` is NOT
// among them, so `{$FORGE_TOTEM_DOMAIN}` in `caddy/Caddyfile` resolves to the EMPTY STRING on every box, and
// an empty site address is not a missing host — it is a file that does not parse:
//
//     Error: adapting config using caddyfile: server block without any key is global configuration, …
//
// Measured against the real file with exactly those three variables. `caddy/Caddyfile` is compose's DEFAULT
// (`${FORGE_CADDYFILE:-./caddy/Caddyfile}`), so the edge a deployment of this instance gets is one that
// cannot load — store, checkout and admin down together. The bench never showed it because the bench opts
// into `caddy/Caddyfile.local`. Same species as A10, one layer over.
//
// ⇒ ★ THE SENTINEL RULE, AND IT IS MEASURED. Every site address that comes from a variable carries a
// DEFAULT, and the default ends in `.localhost`. Measured with `caddy:2` v2.11.4: a `.localhost` name is
// issued a certificate by Caddy's own internal CA (`"certificate obtained successfully" … issuer:"local"`,
// 11 ms, no ACME request at all), so a variable nobody set costs ONE face on a name nothing resolves —
// never the whole edge. The defaults must also be DISTINCT, because two site blocks with one address is a
// parse error, which is the dead edge again by another road.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The reserved suffix every sentinel default carries. RFC 6761 keeps `.localhost` out of the DNS, and
 *  Caddy answers it from its internal CA rather than from ACME — measured, see the header. */
export const SENTINEL_SUFFIX = '.localhost';

export const readBox = (root = ROOT) => JSON.parse(readFileSync(join(root, 'seed/box.json'), 'utf8'));

/**
 * ── THE DECLARATION ──────────────────────────────────────────────────────────────────────────────────────
 *
 * Every face `seed/box.json` declares, derived from the topology it already states. Nothing is listed here:
 * a fifth store that grows a `domain` block arrives in this list, in the guard and in the two steps that
 * read it without a second edit anywhere.
 *
 * `directory` is the question "does the KERNEL's own address book claim this hostname for this store?", and
 * it is `true` unless the declaration says otherwise. The counter is the one that says otherwise, and the
 * reason is measured and written beside it in the file: its front is the totem, which serves ONE route, so a
 * `host` on that store would put an «Acompanhar o pedido» button on every counter receipt pointing at the
 * totem's own 404 (`packages/core/src/notification/context.ts` builds `https://<host>/account/orders/<id>`).
 */
/**
 * ★★ IS THIS VALUE A BENCH ADDRESS RATHER THAN A PUBLISHED ONE? (pk34, the cut)
 *
 * ⛔ WHY THIS EXISTS, AND IT IS A DEFECT THE BIRTH OF 13/09 PRINTED NINE TIMES. `verify-config` grades the
 * faces in three states — none named is a BENCH, all named is a deployment, SOME named is «somebody was
 * promoting this box and stopped». The comment there says in so many words that it «NEVER GRADES A LOCALHOST
 * BIRTH AS BROKEN», and on a real bench it did exactly that: `FORGE_DOMAIN` and `FORGE_ADMIN_DOMAIN` are not
 * new variables this topology invented — `.env.example` has shipped them as `localhost` since the first box —
 * so a bench NEVER names zero faces. It names two, and the other four took the ✗ meant for a half-promoted
 * deployment. The guard could not tell a bench from an abandoned promotion.
 *
 * ★ The test that was supposed to catch this passed a fixture with all six EMPTY — a shape the bench does not
 * have. A case that grades a state nothing produces is a green that means nothing.
 *
 * The rule is the ADDRESS, never the variable: a face published at loopback is not published.
 * ⚠️ Anchored equality on the HOST, never a substring — `localhost` is inside `notlocalhost.example`, and this
 * repository has paid three times in one week for an unanchored match.
 */
export function isBenchAddress(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false; // empty is "unset", which is a different answer and has its own line.
  const host = (raw.includes('://') ? raw.slice(raw.indexOf('://') + 3) : raw).replace(/\/.*$/, '');
  // ⚠️ A BARE IPv6 IS ALL COLONS, so the `:port` strip has to know it is not looking at one: `::1` would
  // come out as `:`. Bracketed form carries the port outside the brackets and is unambiguous.
  const bare = host.startsWith('[')
    ? host.slice(1, host.indexOf(']'))
    : (host.match(/:/g) ?? []).length > 1
      ? host
      : host.replace(/:\d+$/, '');
  return bare === 'localhost' || bare === '127.0.0.1' || bare === '::1';
}

export function declaredFaces(box = readBox()) {
  const faces = [];
  for (const tenant of box.tenants ?? []) {
    const admin = tenant.admin_domain;
    if (admin) {
      faces.push({
        kind: 'admin',
        label: `${tenant.id} · admin`,
        tenant: tenant.id,
        store: null,
        host: admin.host,
        env: admin.env,
        directory: admin.directory !== false,
      });
    }
    for (const store of tenant.stores ?? []) {
      const domain = store.domain;
      if (!domain) continue;
      faces.push({
        kind: 'store',
        label: `${tenant.id}/${store.handle}`,
        tenant: tenant.id,
        store: store.handle,
        host: domain.host,
        env: domain.env,
        directory: domain.directory !== false,
      });
    }
  }
  return faces;
}

/** The face a given store handle declares, or `undefined`. Used by the steps, which walk the PORT's rows. */
export const faceOfStore = (faces, tenant, handle) =>
  faces.find((f) => f.kind === 'store' && f.tenant === tenant && f.store === handle);

/**
 * ── THE EDGE ─────────────────────────────────────────────────────────────────────────────────────────────
 *
 * A Caddyfile, read as top-level blocks. Line-based on purpose: Caddy's own placeholders (`{$VAR}`,
 * `{args[0]}`, `{http.request.host}`) are braces too, and a character-counting parser would have to know
 * which braces are syntax. In these files a block opens on a line that ENDS with `{` and closes on a line
 * that is only `}` — and `bin/box-domains.guard.mjs` asserts that the parse found something, so a file that
 * stops obeying that shape goes red instead of quietly yielding nothing.
 */
export function topLevelBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let depth = 0;
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const opens = trimmed.endsWith('{');
    const closes = trimmed === '}';
    if (depth === 0 && opens) {
      current = { header: trimmed.slice(0, -1).trim(), line: i + 1, body: [] };
      depth = 1;
      continue;
    }
    if (depth > 0) {
      if (closes) {
        depth -= 1;
        if (depth === 0) {
          blocks.push(current);
          current = null;
          continue;
        }
      } else if (opens) {
        depth += 1;
      }
      if (current) current.body.push(line);
    }
  }
  return blocks;
}

const SNIPPET = /^\(([A-Za-z0-9_]+)\)$/;

/** `{$FORGE_DOMAIN:store.unset.localhost}` → `{ env, fallback }`; anything else → `null`. */
export function envAddress(address) {
  const m = address.match(/^\{\$([A-Za-z_][A-Za-z0-9_]*)(?::([^}]*))?\}$/);
  return m ? { env: m[1], fallback: m[2] ?? null } : null;
}

/**
 * Every site block of one Caddyfile, with its snippet imports EXPANDED — so the upstream a hostname really
 * reaches is read out of the file rather than assumed from where it is written. `{args[0]}` is substituted
 * with the argument the `import` line passes, which is the whole point of the snippet: one definition of the
 * eleven handles a shop hostname needs, and a fall-through upstream per hostname.
 */
export function siteBlocks(text) {
  const blocks = topLevelBlocks(text);
  const snippets = new Map();
  for (const b of blocks) {
    const m = b.header.match(SNIPPET);
    if (m) snippets.set(m[1], b.body);
  }
  const sites = [];
  for (const b of blocks) {
    if (SNIPPET.test(b.header)) continue;
    if (b.header === '') continue; // the global options block
    const addresses = b.header.split(',').map((a) => a.trim()).filter(Boolean);
    const expanded = [];
    for (const raw of b.body) {
      const imp = raw.trim().match(/^import\s+([A-Za-z0-9_]+)((?:\s+\S+)*)$/);
      const body = imp && snippets.get(imp[1]);
      if (!body) {
        expanded.push(raw);
        continue;
      }
      const args = imp[2].trim().split(/\s+/).filter(Boolean);
      for (const snippetLine of body) {
        expanded.push(snippetLine.replace(/\{args\[(\d+)\]\}/g, (_, i) => args[Number(i)] ?? ''));
      }
    }
    sites.push({
      addresses,
      line: b.line,
      body: expanded,
      /** The block as WRITTEN — imports not expanded. What is here and not in the snippet is this hostname's
       *  own, which is the difference the shared-doors rule turns on. */
      rawBody: b.body,
      /** The argument each import passes, i.e. the container this hostname's own fall-through reaches. */
      args: b.body.flatMap((l) => {
        const m = l.trim().match(/^import\s+[A-Za-z0-9_]+((?:\s+\S+)+)$/);
        return m ? m[1].trim().split(/\s+/) : [];
      }),
      snippetsUsed: b.body.flatMap((l) => l.trim().match(/^import\s+([A-Za-z0-9_]+)\b/)?.[1] ?? []),
    });
  }
  return sites;
}

/** The snippet definitions of one Caddyfile, as pseudo-sites, so their doors can be counted on their own. */
export function snippetsOf(text) {
  const out = new Map();
  for (const b of topLevelBlocks(text)) {
    const m = b.header.match(SNIPPET);
    if (m) out.set(m[1], { addresses: [`(${m[1]})`], line: b.line, body: b.body, snippetsUsed: [] });
  }
  return out;
}

/** Every upstream a block proxies to, as compose service names. `kernel:3000` → `kernel`. */
export function upstreamsOf(site) {
  const out = new Set();
  for (const raw of site.body) {
    for (const m of raw.matchAll(/reverse_proxy(?:\s+@\S+)?((?:\s+[^\s{}]+)+)/g)) {
      for (const token of m[1].trim().split(/\s+/)) {
        const host = token.split(':')[0];
        if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(host)) out.add(host);
      }
    }
  }
  return [...out];
}

/** Every `handle`/`handle_path` pattern a block claims, after snippet expansion. */
export function handlesOf(site) {
  return doorsIn(site.body).map((d) => d.door);
}

/**
 * The doors of a body, each with the upstream its own block proxies to — which is the fact the shared-doors
 * rule needs. Indentation is what pairs a `handle` with its `reverse_proxy`: the directive that opens the
 * block is one tab shallower than the lines inside it.
 */
export function doorsIn(lines) {
  const out = [];
  let current = null;
  for (const raw of lines) {
    const m = raw.trim().match(/^(handle|handle_path)\s+(\S+)\s*\{$/);
    if (m) {
      current = { door: `${m[1]} ${m[2]}`, upstreams: [] };
      out.push(current);
      continue;
    }
    if (/^\s*handle\s*\{$/.test(raw)) {
      current = { door: 'handle (fall-through)', upstreams: [] };
      out.push(current);
      continue;
    }
    const up = raw.trim().match(/^reverse_proxy(?:\s+@\S+)?\s+(\S+)/);
    if (up && current) current.upstreams.push(up[1].split(':')[0]);
  }
  return out;
}
