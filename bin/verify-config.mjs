#!/usr/bin/env node
// ★★★ THE VERDICT OVER THE BOX'S CONFIGURATION — the twin of `bin/verify-seed.mjs`, which grades its DATA.
//
//   node bin/verify-config.mjs --api http://localhost:8200 [--env ./.env]
//
// ── WHAT DIED AT EVERY REBIRTH AND NOTHING GRADED ────────────────────────────────────────────────────────
//
// A promoted box torn down and reborn comes back HALF PROMOTED, and every half of that is deliberate code:
//
//   · the database is destroyed, so the admin directory holds only what `provision-ref` claims from
//     `seed/box.json` — `localhost:8201` and `localhost:8202`;
//   · step 3b rewrites FORGE_STORE_HOSTS and DOES include $FORGE_TAILNET_HOST, so the SHOP still answers on
//     the network;
//   · step 3d rewrites FORGE_ADMIN_SIBLINGS back to `localhost`;
//   · FORGE_PUBLIC_ORIGIN and FORGE_GATE_ADMIN_URL are never written at birth (the only `put_env` calls
//     outside the promotion block are the purge secret and the sibling list), so they stay on the tailnet.
//
// ⇒ the shop opens over the tailnet and the admin refuses the login with `unknown_admin_host`. The birth
// exits 0, and the only thing that ever said otherwise was one sentence at the bottom of a 400-line
// scrollback, which is a thing a human scrolls past.
//
// ── ⛔ WHY THIS IS A VERDICT AND NOT A LIST OF THINGS TO RE-ENABLE ────────────────────────────────────────
//
// Renan asked that the reset "garanta que ligue tudo que só tem online… ou qualquer coisa assim que morre no
// reset". The obvious answer is a checklist, and the checklist is the disease: it ages in silence, somebody
// adjusts the live box and forgets to add the item, and the next reset erases it with nothing saying so.
//
// ★ SO EVERY CHECK BELOW IS DERIVED, AND THE ONE RULE IS OWNERSHIP OF AN ADDRESS:
//
//     THIS BOX PUBLISHES ITSELF AT ONE ADDRESS, AND EVERY FACE IT DECLARES MUST BE PUBLISHED THERE TOO.
//
// The address is `FORGE_PUBLIC_ORIGIN`. The faces are whatever `.env` declares — the shop's host map, the
// admin doors, the gate's link — and each is compared with what THE BOX ANSWERS, never with a copy of what
// it should answer. The last check turns the rule on the file itself: any FORGE_* variable holding an
// address ON THIS BOX'S OWN HOSTNAMES that the promotion does not rewrite is named, because the next reset
// will leave it pointing at the network the box used to be on. Nobody has to have remembered it.
//
// ── EXIT CODES, and the third is `verify-seed.mjs`'s for the same reason ─────────────────────────────────
//   0  settled
//   1  the box's configuration is not what it declares — read the ✗ lines
//   2  THIS step could not ask (the box did not answer, `.env` is not there). Not a claim about the box.

import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { hostname as machineHostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readDeclaration } from './box-env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOX = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'));

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const out = [];
const say = (line = '') => out.push(line);
let failures = 0;
const ok = (label, detail) => say(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
const bad = (label, detail) => {
  failures += 1;
  say(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};
const noted = (label, detail) => say(`  · ${label}${detail ? ` — ${detail}` : ''}`);
/** THIS step could not ask — never a claim about the box. */
const wrongQuestion = (message) => {
  say(`  ⚑ ${message}`);
  say();
  say('VERDICT: this step could not ask. Nothing above is a claim about this box.');
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(2);
};

// ── the declaration: `.env` as it stands on disk, because that is what the box is reborn from ────────────
//
// ⚠️ THE FILE, NOT THIS PROCESS'S ENVIRONMENT — the reasoning, and the parser, live in `bin/box-env.mjs`,
// which `bin/warm-box.mjs` reads the same declaration through. Two copies of «strip the quotes box-up.sh
// wrote» would be two things to keep in agreement about one file.
const envPath = argOf('--env') ?? join(ROOT, '.env');
let declared;
try {
  declared = readDeclaration(envPath);
} catch (error) {
  wrongQuestion(`${envPath} could not be read (${error.code ?? error.message}) — there is no declaration to grade.`);
}

const api = (argOf('--api') ?? declared.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
if (!api) wrongQuestion('no --api and no FORGE_PUBLIC_ORIGIN in the file — this step has no box to ask.');

// ── asking the box ───────────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ `node:http`, NOT `fetch`, AND THAT IS THE WHOLE MEASUREMENT. Undici SILENTLY DROPS a `host` header:
 * measured against the live bench on 04/09, `fetch('http://127.0.0.1:8200/', {headers:{host:'nope.invalid'}})`
 * answered 200 while the same request through `node:http` answered 404. A probe built on fetch would have
 * graded every hostname as resolving, on every box, for ever — a green that proves the port is open.
 *
 * ⛔ AND `servername` IS THE OTHER HALF OF THAT SAME SENTENCE — WITHOUT IT THIS STEP IS RED ON EVERY HTTPS
 * BOX, WHICH IS EVERY BOX ONLINE. Node derives the TLS ServerName from the `Host` HEADER when none is given
 * (`calculateServerName`, `lib/https.js`), so a probe carrying `Host: localhost` negotiates the handshake as
 * «localhost» against an edge holding a certificate for its own name; the handshake dies, `req.on('error')`
 * resolves 0, and the shop is reported as answering NOTHING at an address it answers 200 at.
 *
 * ★ MEASURED 2026-09-08 against the live https bench, one request at a time, same `node:https`:
 *
 *     Host: <the origin's own name> → 200 · 200   Host: 127.0.0.1 → 200 · 200
 *     Host: localhost               → EPROTO · 200        Host: ms-s1 (short name) → EPROTO · 200
 *     Host: <a name the map does not declare> → EPROTO · 404
 *
 * («before · after».) The IP passes either way because the RFC forbids sending SNI for an IP literal, so
 * there is no name to diverge. ★ THE LAST ROW IS WHY THIS IS NOT «make it green»: with TLS negotiated
 * against the ORIGIN the HTTP layer still answers, and an undeclared name still comes back 404 — the same
 * negative control this comment demands of `fetch` above.
 *
 * ⚠️ THE EMPTY STRING IS NOT «unset». For an IP origin `servername: url.hostname` would be an RFC-6066
 * violation Node warns about (DEP0123) and `undefined` would let it derive one from the header again;
 * `''` is the spelling that means «send no SNI», measured to be the only one of the three that both keeps
 * Node quiet and stops the derivation.
 */
function probeHost(host) {
  const url = new URL(api);
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve) => {
    const req = send(
      {
        host: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: '/',
        method: 'GET',
        headers: { Host: host },
        // The TLS handshake is negotiated with the ORIGIN, while the header keeps carrying the name under test.
        servername: isIP(url.hostname) ? '' : url.hostname,
        timeout: 15_000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(0));
    req.end();
  });
}

/** `admin.by_host` is a GLOBAL, public, actorless read — the directory itself, not a copy of it. */
async function adminDoorTenant(authority) {
  try {
    const res = await fetch(`${api}/v1/read/admin.by_host?host=${encodeURIComponent(authority)}`);
    if (res.status === 404) return null;
    if (!res.ok) return { error: res.status };
    const body = await res.json();
    return body?.tenant_id ?? null;
  } catch (error) {
    return { error: error.message };
  }
}

// The box has to be there at all before anything below means anything.
try {
  const res = await fetch(`${api}/health`);
  if (!res.ok) wrongQuestion(`${api}/health answered ${res.status} — this box is not standing, so its configuration cannot be graded.`);
} catch (error) {
  wrongQuestion(`${api}/health could not be reached: ${error.message}`);
}

// ── the address this box says it is at ───────────────────────────────────────────────────────────────────
say(`THE CONFIGURATION, graded against ${api}`);
say(`   declaration: ${envPath}`);
say();

let published;
try {
  published = new URL(declared.FORGE_PUBLIC_ORIGIN ?? '');
} catch {
  wrongQuestion(
    `FORGE_PUBLIC_ORIGIN is ${declared.FORGE_PUBLIC_ORIGIN ? `"${declared.FORGE_PUBLIC_ORIGIN}"` : 'unset'} — every ` +
      'check below compares a face against the address this box publishes itself at, and there is none.',
  );
}
/** The `host:port` a browser sends, with the scheme's default port omitted exactly as a browser omits it. */
const authorityOf = (u) => (u.port ? `${u.hostname}:${u.port}` : u.hostname);
const PUBLISHED_HOST = published.hostname;

say('THE ADDRESS THIS BOX PUBLISHES ITSELF AT');
{
  const code = await probeHost(authorityOf(published));
  if (code === 200) ok(`${published.origin}`, 'the shop answers there');
  else {
    bad(
      `${published.origin}`,
      `the shop answers ${code || 'nothing'} to Host: ${authorityOf(published)}. The kernel's media driver mints ` +
        'every product-image URL from this value, so a box published where no store is claimed serves a ' +
        'catalogue of images nobody can fetch — with nothing in any log.',
    );
  }
}
say();

// ── 1 · the shop, at every hostname the map promises ─────────────────────────────────────────────────────
say('THE SHOP · every hostname FORGE_STORE_HOSTS claims');
let storeHosts = {};
try {
  storeHosts = JSON.parse(declared.FORGE_STORE_HOSTS || '{}');
} catch {
  bad('FORGE_STORE_HOSTS', `is not JSON: ${declared.FORGE_STORE_HOSTS?.slice(0, 80)}`);
}
const storeHostKeys = Object.keys(storeHosts);
if (storeHostKeys.length === 0) {
  bad('FORGE_STORE_HOSTS', 'is empty — the shop root answers 404 at every address. Step 3b of the birth writes it.');
} else {
  for (const key of storeHostKeys) {
    const code = await probeHost(key);
    if (code === 200) ok(key, `→ ${storeHosts[key]}`);
    else bad(key, `claimed for ${storeHosts[key]} and the shop answers ${code || 'nothing'} there`);
  }
  if (!storeHostKeys.some((k) => k.toLowerCase() === authorityOf(published).toLowerCase() || k.toLowerCase() === PUBLISHED_HOST)) {
    bad(
      'the map and the origin disagree',
      `FORGE_PUBLIC_ORIGIN is ${published.origin} and FORGE_STORE_HOSTS has no key for ${authorityOf(published)}`,
    );
  }
}
say();

// ── 2 · ★★★ the admin, which is the face a rebirth de-promotes ───────────────────────────────────────────
say('THE ADMIN · one door per tenant, published where this box is, and CLAIMED in the directory');
let siblings = [];
try {
  siblings = JSON.parse(declared.FORGE_ADMIN_SIBLINGS || '[]');
} catch {
  bad('FORGE_ADMIN_SIBLINGS', `is not JSON: ${declared.FORGE_ADMIN_SIBLINGS?.slice(0, 80)}`);
}
/** The tenant each declared door really resolves to, asked of the directory rather than assumed from a name. */
const doorTenants = new Map();
for (const entry of siblings) {
  let url;
  try {
    url = new URL(entry?.url ?? '');
  } catch {
    bad('FORGE_ADMIN_SIBLINGS', `an entry has no usable url: ${JSON.stringify(entry)} (siblings.ts DROPS it, silently)`);
    continue;
  }
  doorTenants.set(entry.url, { url, tenant: await adminDoorTenant(authorityOf(url)) });
}

for (const spec of BOX.tenants) {
  const mine = [...doorTenants.entries()].filter(([, v]) => v.tenant === spec.id);
  const onPublished = mine.filter(([, v]) => v.url.hostname.toLowerCase() === PUBLISHED_HOST.toLowerCase());
  if (onPublished.length > 0) {
    ok(spec.id, `admin at ${onPublished[0][0]} — the directory holds it`);
    continue;
  }
  // ★★★ THE HALF-PROMOTED BOX, NAMED. Two shapes reach here and both leave a login that refuses.
  const declaredDoor = siblings.find((e) => e?.name === spec.settings?.tenant_name)?.url;
  if (declaredDoor) {
    const resolved = doorTenants.get(declaredDoor);
    if (resolved && resolved.tenant === null) {
      bad(
        spec.id,
        `its admin is declared at ${declaredDoor} and the directory holds NO claim for ` +
          `${authorityOf(resolved.url)} — a login there answers \`unknown_admin_host\`.`,
      );
      continue;
    }
    if (resolved && resolved.url.hostname.toLowerCase() !== PUBLISHED_HOST.toLowerCase()) {
      bad(
        spec.id,
        `its admin is published at ${resolved.url.hostname} while this box publishes itself at ` +
          `${PUBLISHED_HOST}. THE BOX IS HALF PROMOTED: the shop answers on ${PUBLISHED_HOST} and the admin ` +
          'does not. A rebirth destroys the directory and rewrites the sibling list, and rewrites neither ' +
          'FORGE_PUBLIC_ORIGIN nor FORGE_GATE_ADMIN_URL — so this is what a `box-down` + `box-up` on a ' +
          'promoted box leaves behind. Run `bash bin/box-up.sh --tailnet`.',
      );
      continue;
    }
  }
  bad(
    spec.id,
    `no admin door: FORGE_ADMIN_SIBLINGS declares ${siblings.length} entr${siblings.length === 1 ? 'y' : 'ies'} and ` +
      'none of them resolves to this tenant in the directory. An absent switcher entry is invisible on the ' +
      'screen — `siblings.ts` drops a bad entry on purpose and says nothing.',
  );
}
say();

// ── 3 · the gate's link, which is the address an operator is SENT to ─────────────────────────────────────
say('THE GATE · where the front sends an operator who clicks through to the admin');
if (!declared.FORGE_GATE_ADMIN_URL) {
  noted('FORGE_GATE_ADMIN_URL', 'empty — the gate shows no admin link (this is the value a localhost birth leaves)');
} else {
  let url;
  try {
    url = new URL(declared.FORGE_GATE_ADMIN_URL);
  } catch {
    url = null;
    bad('FORGE_GATE_ADMIN_URL', `is not a url: "${declared.FORGE_GATE_ADMIN_URL}"`);
  }
  if (url) {
    const tenant = await adminDoorTenant(authorityOf(url));
    if (typeof tenant === 'string') ok('FORGE_GATE_ADMIN_URL', `${url.origin} → ${tenant}`);
    else if (tenant === null) {
      bad(
        'FORGE_GATE_ADMIN_URL',
        `${url.origin} — the directory holds no claim for ${authorityOf(url)}. An operator who follows this ` +
          'link gets a login page that refuses with `unknown_admin_host`.',
      );
    } else bad('FORGE_GATE_ADMIN_URL', `the directory could not be asked about ${authorityOf(url)}: ${JSON.stringify(tenant)}`);
  }
}
say();

// ── 4 · the one secret whose emptiness is invisible ──────────────────────────────────────────────────────
say('THE PURGE SECRET · without it the kernel cannot bust the vitrine, and says so only at boot');
if (declared.FORGE_REVALIDATE_SECRET) {
  ok('FORGE_REVALIDATE_SECRET', `${declared.FORGE_REVALIDATE_SECRET.length} characters`);
} else {
  bad(
    'FORGE_REVALIDATE_SECRET',
    'is empty. Measured on the bench of 02/09 and on Staging for a full day: every purge is silently refused, ' +
      'so unpublishing a product leaves it selling for the whole TTL and a QA probe concludes the unpublish ' +
      'event is broken. It also guards the warmer, so a birth cannot warm itself. Step 3c-bis mints one.',
  );
}
say();

// ── 5 · ★★★ addresses OF THIS BOX that a promotion cannot move ───────────────────────────────────────────
//
// This is the check that makes the whole file a verdict rather than a checklist. It does not know what the
// box's addresses are supposed to be; it derives BOTH halves and reports the difference:
//   · what the promotion moves — read out of `bin/box-up.sh`'s own promotion block;
//   · what the declaration holds that is an address ON THIS BOX — every FORGE_* value that is an http(s) URL
//     whose hostname is one this box answers to.
// Anything in the second and not the first is an adjustment the next reset will silently strand. Nobody has
// to have put it in a list; a variable added tomorrow is graded tomorrow.
say('ADDRESSES OF THIS BOX · every one of them has to survive the next reset');
const src = readFileSync(join(ROOT, 'bin/box-up.sh'), 'utf8');
// ⚠️ pk24/§B5 — the anchor is the promotion's own first line, and the mode it announces is now its
// DESTINATION (`--promote <tailnet|localhost|hostname>`) rather than the name of a bench mode. The check
// below is about the `put_env` calls inside the block, which did not move.
const promotionBlock = src.slice(src.indexOf('say "promotion · $PROMOTE_TO"'), src.indexOf('exit "$promotion_status"'));
const moved = new Set([...promotionBlock.matchAll(/put_env ([A-Z0-9_]+)/g)].map((m) => m[1]));
if (moved.size === 0) {
  bad('the promotion', 'no `put_env` found in bin/box-up.sh\'s promotion block — this check has nothing to derive from');
} else {
  /** Every spelling of this machine that the box itself claims. Hostnames only — the port is the door. */
  const mine = new Set(
    [
      PUBLISHED_HOST,
      'localhost',
      '127.0.0.1',
      machineHostname(),
      declared.FORGE_TAILNET_HOST,
      declared.FORGE_TAILNET_IP,
      ...storeHostKeys.map((k) => k.replace(/:\d+$/, '')),
    ]
      .filter(Boolean)
      .map((h) => h.toLowerCase()),
  );
  const stranded = [];
  for (const [name, value] of Object.entries(declared)) {
    if (!name.startsWith('FORGE_') || moved.has(name)) continue;
    if (!/^https?:\/\//.test(value)) continue;
    let url;
    try {
      url = new URL(value);
    } catch {
      continue;
    }
    // ★ THE RULE IS OWNERSHIP, NOT THE WORD `http`. Somebody else's site (the gate's marketing URL) and a
    //   container-internal address (a compose service name) are both correctly left alone by a promotion of
    //   THIS box, so neither is a finding.
    if (!mine.has(url.hostname.toLowerCase())) continue;
    stranded.push(`${name}=${value}`);
  }
  if (stranded.length === 0) {
    ok(
      'every address of this box',
      `is one of the ${moved.size} the promotion rewrites (${[...moved].join(', ')})`,
    );
  } else {
    for (const line of stranded) {
      bad(
        line,
        'is an address ON THIS BOX that `bash bin/box-up.sh --tailnet|--localhost` does NOT rewrite. The next ' +
          'reset leaves it pointing at the network this box used to be on, and nothing will say so. Either ' +
          'the promotion learns to move it, or it must not name this box.',
      );
    }
  }
}
say();

// ── 6 · what only exists online, from the same declaration the reset step reads ──────────────────────────
say('ONLINE-ONLY · the facilities this box declares, and the driver each resolves to here');
for (const facility of BOX.online_only ?? []) {
  const chosen = (process.env[facility.driver_env] ?? declared[facility.driver_env] ?? '').trim() || 'none';
  if (chosen === 'none') noted(facility.id, `driver "none" (${facility.driver_env} unset) — ${facility.bench_why}`);
  else ok(facility.id, `driver "${chosen}" (${facility.driver_env})`);
}

// ── the verdict ──────────────────────────────────────────────────────────────────────────────────────────
say();
say(
  failures === 0
    ? `VERDICT: settled. Every face this box declares is published at ${published.origin}, and the box answers there.`
    : `VERDICT: ${failures} check(s) NOT settled. This box's configuration is not what it declares — read the ✗ lines above.`,
);
process.stdout.write(`${out.join('\n')}\n`);
process.exit(failures === 0 ? 0 : 1);
