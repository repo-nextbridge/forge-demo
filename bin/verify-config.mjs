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

import { declaredFaces, isBenchAddress } from './box-domains.mjs';
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

/** `store.by_host` is the same GLOBAL directory as `admin.by_host`, on the store axis: public, actorless, and
 *  the thing every consumer that resolves an address THROUGH THE PORT reads — the warmer's address space
 *  first (`apps/storefront/src/lib/warm/targets.ts`). `null` is "no store claims it", which is a 404. */
async function storeByHost(authority) {
  try {
    const res = await fetch(`${api}/v1/read/store.by_host?host=${encodeURIComponent(authority)}`);
    if (res.status === 404) return null;
    if (!res.ok) return { error: res.status };
    return (await res.json())?.store_id ?? null;
  } catch (error) {
    return { error: error.message };
  }
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

// ── 1b · ★★★ …AND THE KERNEL HAS TO KNOW IT TOO (pk26/d1) ────────────────────────────────────────────────
//
// ⛔ THE HOLE IN THE RULE ABOVE, AND IT COST THREE MISDIAGNOSES. Every probe in this section carries a `Host`
// header to the EDGE, so it grades what the FRONTS resolve — and the fronts read `FORGE_STORE_HOSTS`
// themselves (`packages/storefront-kit/src/resolve-store.ts` checks it before it asks the port). So this
// whole section was green on a box whose kernel directory was EMPTY: `read.store.by_host` answered 404 for
// every hostname, measured 04/09 and 08/09, and everything that resolves an address THROUGH THE PORT was
// wrong while every ✓ above was true. The warmer was the visible casualty — it built `/s/<id>/…` urls for a
// shop a visitor opens at `/`, so the "95% warm" of past handovers was about pages nobody opens.
//
// ★ SO THE SAME RULE IS ASKED OF THE OTHER SIDE, and it is asked INDEPENDENTLY of the step that writes it —
// `bin/store-host.mjs` (step 6b) declares the address and waits for this same read; this file asks it again
// at the end of the birth, from the declaration on disk. Neither runs the other, which is the arrangement
// `bin/prove-doors.mjs` and `bin/warm-box.mjs` already have over the declared-store question.
say('THE SHOP\'S ADDRESS IN THE KERNEL · what read.store.by_host answers, which is NOT what the fronts read');
{
  const authority = authorityOf(published);
  const servedByMap = storeHosts[authority] ?? storeHosts[PUBLISHED_HOST] ?? null;
  const inDirectory = await storeByHost(authority);
  if (inDirectory && typeof inDirectory === 'object') {
    bad(authority, `read.store.by_host answered HTTP ${inDirectory.error ?? '?'} — this box's directory cannot be read`);
  } else if (!servedByMap) {
    noted(authority, 'FORGE_STORE_HOSTS names no store here, so there is nothing the directory should agree with');
  } else if (inDirectory === servedByMap) {
    ok(authority, `→ ${inDirectory} in the kernel's directory, the same store FORGE_STORE_HOSTS serves there`);
  } else if (inDirectory === null) {
    bad(
      authority,
      `FORGE_STORE_HOSTS serves ${servedByMap} here and read.store.by_host answers 404 — NO store claims this ` +
        "box's own address. The shop still opens (the fronts obey the override), and everything that asks the " +
        'PORT is wrong: the warmer fills /s/<id>/… pages while a shopper opens /, and the URL inventory cannot ' +
        'find the root store. Step 6b of the birth (bin/store-host.mjs) is what declares it.',
    );
  } else {
    bad(
      authority,
      `read.store.by_host says ${inDirectory} and FORGE_STORE_HOSTS serves ${servedByMap} — TWO ANSWERS about ` +
        'one address. The fronts obey the second and the warmer obeys the first, so the clean URLs this box ' +
        'warms belong to a store that does not answer there. One of the two has to move; step 6b writes the ' +
        'directory from the map, so a disagreement means something else wrote the store\'s host.',
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

// ── 3b · ★★★ THE FACES THIS BOX DECLARES, AND WHETHER ANY OF THEM IS STILL ON ITS SENTINEL (pk34/d1) ─────
//
// He named the demo's six addresses on 12/09. `seed/box.json` declares them — one `domain` per store, one
// `admin_domain` per tenant — and `caddy/Caddyfile` routes each from the variable the declaration names.
//
// ⛔ WHAT THIS SECTION IS FOR, AND IT IS NOT «are the six set». It is the LOUD HALF of a deliberate trade.
// A variable this box's edge reads and nobody set used to take the WHOLE EDGE DOWN — an empty site address
// is a file that does not parse, measured 2026-09-12 — so every address now falls back to a
// `<something>.unset.localhost` sentinel and one forgotten variable costs ONE face. That is strictly better,
// and it is also QUIETER: the box comes up, five faces serve, and the sixth answers on a name nothing
// resolves. Nothing else on this box would ever say so. This does, by name.
//
// ★ AND IT NEVER GRADES A LOCALHOST BIRTH AS BROKEN — which this file CLAIMED before it was true. The bench
// is born on `localhost` and the promotion is a NAMED step (§0b), and the three states are read off the
// ADDRESSES, never off which variables happen to be set: a face answering at loopback is not published.
// ⛔ THE FIRST VERSION READ THE VARIABLES, and the birth of 2026-09-13 printed the consequence four times —
// `FORGE_DOMAIN` and `FORGE_ADMIN_DOMAIN` have been `localhost` in `.env.example` since the first box, so
// the bench looked HALF PROMOTED and the four newer faces took a ✗ that means «somebody stopped midway».
// ⚠️ The test that should have caught it passed a fixture with all six EMPTY — a shape no bench has. A case
// that grades a state nothing produces is a green that means nothing.
// What is a ✗ is the half-PUBLISHED box — some faces at real hostnames and others not — because that is the
// shape nobody chose: somebody was promoting this box and stopped.
say('THE FACES THIS BOX DECLARES · one hostname per store and per tenant admin (seed/box.json)');
{
  const faces = declaredFaces(BOX);
  // ★ A face counts as ADDRESSED only when its value is a PUBLISHED address. `FORGE_DOMAIN` and
  // `FORGE_ADMIN_DOMAIN` are not new: `.env.example` has shipped them as `localhost` since the first box,
  // so a bench never names ZERO faces — it names two. Grading the VALUE rather than the VARIABLE is what
  // separates a bench from an abandoned promotion. Measured on the birth of 2026-09-13: without this the
  // bench came out with 4 ✗ that belong to a different shape entirely.
  const published = (f) => {
    const v = (declared[f.env] ?? '').trim();
    return v !== '' && !isBenchAddress(v);
  };
  const named = faces.filter(published);
  const onBench = faces.filter((f) => isBenchAddress(declared[f.env] ?? ''));
  if (faces.length === 0) {
    bad('seed/box.json', 'declares no face at all — this box has no address it can be published at.');
  } else if (named.length === 0) {
    noted(
      `none of the ${faces.length} faces is published`,
      `${onBench.length} of them answer at loopback and the rest are empty, which is what a LOCALHOST ` +
        'BIRTH leaves (§0b: the box is born on localhost and the promotion is a NAMED step). The ' +
        'deployment addresses are in seed/box.json and the promotion is what fills them; nothing here ' +
        'is wrong.',
    );
  } else {
    for (const face of faces) {
      const value = (declared[face.env] ?? '').trim();
      if (!value || isBenchAddress(value)) {
        bad(
          `${face.label} — ${face.host}`,
          `${face.env} is EMPTY while ${named.length} of this box's ${faces.length} faces are addressed. This ` +
            'face falls back to its `.unset.localhost` sentinel: the edge stays up and that one hostname ' +
            'answers on a name nothing resolves, so the shop/admin behind it is unreachable and no log says ' +
            'so. Either set it, or take the declaration out of seed/box.json.',
        );
        continue;
      }
      if (value !== face.host) {
        noted(`${face.label}`, `${face.env}=${value}, and seed/box.json declares ${face.host} — this box is published somewhere other than the address its topology names`);
      }
      // ★ WHAT THE DIRECTORY SAYS ABOUT IT, asked of the port and never assumed from the name. A store face
      // that is addressed and NOT claimed is the pk26/d1 defect one hostname over; the counter is the one
      // face that must NOT be claimed, and says so in its own declaration.
      if (face.kind === 'admin') {
        const tenant = await adminDoorTenant(value);
        if (tenant === face.tenant) ok(`${face.label} — ${value}`, 'the directory holds it');
        else if (tenant === null) bad(`${face.label} — ${value}`, `the directory holds NO claim for this hostname — a login there answers \`unknown_admin_host\`.`);
        else if (typeof tenant === 'string') bad(`${face.label} — ${value}`, `the directory says this hostname belongs to "${tenant}", not to "${face.tenant}".`);
        else bad(`${face.label} — ${value}`, `the directory could not be asked: ${JSON.stringify(tenant)}`);
        continue;
      }
      const store = await storeByHost(value);
      if (store && typeof store === 'object') {
        bad(`${face.label} — ${value}`, `read.store.by_host answered HTTP ${store.error ?? '?'} — this box's directory cannot be read`);
      } else if (!face.directory) {
        // The counter. Its front is the totem, which serves ONE route, so a `host` on that store would put an
        // «Acompanhar o pedido» button on every receipt pointing at the totem's own 404. The declaration says
        // so; this is the assertion that keeps it true.
        if (store === null) ok(`${face.label} — ${value}`, 'served at the edge and claimed by NO store, which is what `directory: false` declares');
        else bad(`${face.label} — ${value}`, `seed/box.json declares \`directory: false\` for this face and the kernel's directory claims it for ${store}. Every receipt of that store now carries a link into a front that serves one route.`);
      } else if (store === null) {
        bad(
          `${face.label} — ${value}`,
          'the edge serves this hostname and NO store claims it in the kernel\'s directory, so everything that ' +
            'resolves an address THROUGH THE PORT is wrong here: the warmer fills /s/<id>/… pages while a ' +
            'shopper opens /, and the URL inventory cannot find the store. Step 6b (bin/store-host.mjs) is ' +
            'what declares it.',
        );
      } else {
        ok(`${face.label} — ${value}`, `→ ${store} in the kernel's directory`);
      }
    }
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
