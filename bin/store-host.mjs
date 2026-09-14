#!/usr/bin/env node
// ★★★ THE SHOP'S ADDRESS, DECLARED WHERE THE KERNEL CAN SEE IT — the birth's half of `read.store.by_host`.
//
//   FORGE_SEED_TOKEN=… node bin/store-host.mjs --tenant forgeco --api http://localhost:8200
//     [--origin <url>]   the address to DECLARE, when it is not the one being talked to. The PROMOTION passes
//                        the new address here: it drives the command through the door that is already
//                        answering and writes the address the box is about to publish itself at.
//     [--env ./.env]     the declaration that says which store this box serves at the ROOT of that origin
//                        (`FORGE_STORE_HOSTS`, written by step 3b / the promotion). Default: this repo's `.env`.
//     [--store sto_…]    that same answer, named by hand, for a box whose declaration this process cannot read.
//     [--settle-ms N]    how long to wait for the DIRECTORY to catch up (default 60000; see §3)
//     [--poll-ms N]      how often to ask it (default 500)
//
// ── ⛔ THE DEFECT THIS STEP EXISTS FOR, AND IT WAS THE CAUSE OF THREE (pk25/d1 §15.2, pk26/d1) ────────────
//
// The root store did not claim the origin in the kernel's directory. `store.host` was EMPTY on every store of
// every birth, so `read.store.by_host` answered 404 for every hostname this box uses — measured 04/09 and
// again 08/09, for `localhost`, `localhost:8200`, `127.0.0.1:8200` and the tailnet name. The box routed
// anyway, because the FRONTS carry an override the kernel knows nothing about (`FORGE_STORE_HOSTS`, checked
// by `packages/storefront-kit/src/resolve-store.ts` BEFORE it asks the port). One truth, reachable from one
// side only. Three things fell out of that, and all three were blamed on something else first:
//
//   (a) THE WARMER WARMED THE WRONG TREE. `resolveTargets` gives a store clean URLs (`/tenis`) only when
//       `storeForOrigin` — which asks `read.store.by_host` and nothing else — names it at the origin
//       (apps/storefront/src/lib/warm/targets.ts). With the port answering 404 every store was warmed
//       path-scoped (`/s/<id>/tenis`), which is not the address a shopper receives. The "95% warm" of past
//       handovers was about a set of route-cache entries nobody opens.
//   (b) THE URL INVENTORY COULD NOT FIND THE ROOT STORE, and had to be told with `--root-store`.
//   (c) `store.by_host` → 404 read as a broken box. The box was fine; nothing had ever claimed the address.
//
// ── ★★ SO WHO IS AUTHORITATIVE NOW: THE OVERRIDE OR THE DATA? (the question this slice had to answer) ─────
//
// ONE AUTHOR, TWO REGISTERS, AND ONE DIRECTION — `.env` map ⇒ directory, never back.
//
// `bin/box-up.sh` decides this box's addresses exactly twice (step 3b at birth, the promotion afterwards).
// Both write `FORGE_STORE_HOSTS`; this step reads that map and writes the SAME answer into the kernel through
// `tenant.store.update`. Nothing ever reads the directory to write the map, so the two cannot drift into two
// opinions: the map is the box's decision and the directory is that decision stated to the port.
//
// ⚠️ AND THE OVERRIDE IS NOT RETIRED, FOR A MEASURED REASON. `store.host` holds ONE public URL and the
// directory key derived from it is unique across ALL tenants (packages/core/src/read/host-key.ts) — so a
// store can claim exactly ONE authority. The map on this bench carries six to ten: `localhost`,
// `localhost:8200`, `127.0.0.1`, `127.0.0.1:8200`, this machine's own name, and the tailnet's when promoted.
// A directory alone would 404 every spelling but one. The product says the same thing from its side
// (`resolve-store.ts`: *"survives as a LOCAL-DEV OVERRIDE only … in production the env is unset and the
// answer is data"*) — and this bench is the local-dev case, with a second address it wants to keep answering.
// ⇒ THE ONE AUTHORITY THAT IS DECLARED IS `FORGE_PUBLIC_ORIGIN`'s: the address this box publishes itself at,
// the one the media driver mints image URLs from, and the only one the warmer ever asks about.
//
// ── ★ WHAT A BOX THAT WAS NEVER PROMOTED DECLARES: `http://localhost:8200`, AND THAT IS NOT A PLACEHOLDER ─
//
// The worry is real — a directory entry saying `localhost` on an instance that goes public tomorrow is a lie
// with a routing consequence. It does not apply here, twice over: the address is TRUE (this box is on
// localhost, because the box is born there by decision), and the directory is per-box, so no other instance
// can ever read it. What makes it safe is that ONE gesture moves the box, and it moves both registers: the
// promotion rewrites the map, `FORGE_PUBLIC_ORIGIN` and — since this step — the directory, in the same run;
// `--localhost` writes all three back. A rebirth resets all three to `localhost` together, which is exactly
// what it already did to the other two.
//
// ── ★★ WHICH STORE CLAIMS IT: THE ROOT ONE, AND ONLY IT ──────────────────────────────────────────────────
//
// Measured against the matching rule rather than chosen by taste. `read.store.by_host` resolves ONE store per
// authority and the key is globally unique, so the other three stores COULD NOT claim this origin even if
// this file wanted them to: the second `tenant.store.update` would be refused `conflict` / `host_taken`
// (packages/core/src/commands/store.ts, `assertHostIsFree`). And they should not want to — the column is also
// the store's PUBLIC URL, shown in the admin's Settings ▸ General, and `http://localhost:8200` on the café
// would be a lie about an address that answers with the shoe shop. The café, the outlet and the counter are
// reached path-scoped (`/s/<id>/…`), which is what the edge really does and what the map really says.
//
// ── ⚠️ §3 · THE DIRECTORY IS A PROJECTION, SO THIS STEP WAITS FOR IT AND SAYS HOW LONG IT TOOK ────────────
//
// `read.store.by_host` is not served by the store row. It is served by `forge_control.store_directory`, filled
// by the `read.store_directory` relay consumer from `tenant.store.updated` — asynchronously, one cycle per
// second (`relay.ts`, `intervalMs ?? 1000`). Asking a projection about what the same run just wrote and
// getting an empty answer is a shape this house has already paid for. So the write is not the end of this
// step: it waits, bounded, for the port to agree, and a directory that never agrees is RED — the store row
// would be right and every consumer that asks the port would still be wrong, which is the defect above with
// one extra step in front of it.
//
// ── EXIT CODES — the split is `bin/verify-seed.mjs`'s and `bin/warm-box.mjs`'s, for the same reason ───────
//   0  THE ORIGIN IS CLAIMED. This run declared it, or found it already declared, or this tenant does not own
//      the store at the root (only one tenant can; the other one's run is where it happens).
//   1  IT IS NOT. The command was refused, or the directory never came to agree — and the box then routes by
//      the front's override alone, which is exactly the state that cost three misdiagnoses.
//   2  THIS STEP COULD NOT ASK — no credential, no tenant, no origin, a port that did not answer. Nothing was
//      learned about the box, and reporting that as a defect is how an operator hunts one that is not there.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readDeclaration, storeAtRoot } from './box-env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const intArg = (name, fallback) => {
  const raw = argOf(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    process.stderr.write(`[store-host] ${name} needs a whole positive number, got "${raw}"\n`);
    process.exit(2);
  }
  return n;
};

const log = (line) => process.stderr.write(`[store-host] ${line}\n`);
/** ★ THE LAST LINE OF EVERY GREEN RUN, AND IT IS THE ONE THE CALLER READS. Exit 0 covers three different
 *  answers — this run declared the address, found it already declared, or does not own the store at the root
 *  — and `bin/box-up.sh` has to tell them apart: it runs this step once per tenant and "not one of them
 *  claimed it" is a refusal, not a success (the shape F2 of the promotion already taught this box). A word on
 *  stdout is what makes that countable; everything else this step says goes to stderr, for a human. */
const result = (word) => process.stdout.write(`result=${word}\n`);
/** THIS step could not ask — never a claim about the box. */
const cannotAsk = (message) => {
  log(`⚑ ${message}`);
  log('nothing above is a claim about this box.');
  process.exit(2);
};
const refuse = (message) => {
  log(`⛔ ${message}`);
  process.exit(1);
};

const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
const origin = (argOf('--origin') ?? api).replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? '';
const token = process.env.FORGE_SEED_TOKEN ?? '';
const settleMs = intArg('--settle-ms', 60_000);
const pollMs = intArg('--poll-ms', 500);

if (!api) cannotAsk('no API base. Pass --api http://… or set FORGE_PUBLIC_ORIGIN.');
if (!tenant) cannotAsk('no tenant. Pass --tenant <id> (this box has two: forgeco and forgecafe).');
if (!token) {
  cannotAsk(
    'no FORGE_SEED_TOKEN. Each tenant has its own — forgeco → forge-operator-token, forgecafe → ' +
      'forge-operator-token-forgecafe — and step 3 of the birth files both into `.secrets`.',
  );
}

/** The `host:port` a browser sends as `Host`, with the scheme's default port omitted exactly as a browser
 *  omits it. This is the key `read.store.by_host` and `FORGE_STORE_HOSTS` both resolve on. */
const authorityOf = (url) => {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return '';
  }
};

const authority = authorityOf(origin);
if (!authority) cannotAsk(`"${origin}" is not a usable origin — there is no address to declare.`);

// ── 1 · WHO IS AT THE ROOT — read from the declaration this box is reborn from ────────────────────────────
//
// ⚠️ THE SAME DERIVATION `bin/warm-box.mjs` AND `bin/box-up.sh --promote` ALREADY MAKE, through the same
// module, because three answers to "who does this box serve at the root?" is how the next drift starts.
const envPath = argOf('--env') ?? join(ROOT, '.env');
const storeFlag = argOf('--store') ?? null;
let rootStore = storeFlag;
let rootFrom = storeFlag ? '--store' : `FORGE_STORE_HOSTS in ${envPath}`;
if (!rootStore) {
  let declaration;
  try {
    declaration = readDeclaration(envPath);
  } catch (error) {
    cannotAsk(
      `${envPath} could not be read (${error.code ?? error.message}), so this run does not know which store ` +
        `this box serves at the root of ${authority}. Name it with --store <id>.`,
    );
  }
  rootStore = storeAtRoot(declaration, authority);
}
if (!rootStore) {
  // ⛔ NOT A VACUUM AND NOT A SHRUG. A box whose host map claims nobody at its own published origin has a
  // shop root that answers 404 — step 3b says so when it cannot write the map, and this is the same fact one
  // step later. Declaring nothing here would leave `read.store.by_host` at 404 with this step exiting 0.
  refuse(
    `no store serves the root of ${authority} according to ${rootFrom} — so nothing can claim that address ` +
      'in the kernel\'s directory, `read.store.by_host` goes on answering 404 there, and the warmer goes on ' +
      'warming /s/<id>/… while a shopper opens /. Step 3b of the birth writes that map; if this box really ' +
      'serves no store at its root, this step is the wrong one to be running.',
  );
}

// ── 2 · IS IT MINE, AND IS IT ALREADY DECLARED — asked of the port, by value ──────────────────────────────
async function call(path, init) {
  let res;
  try {
    res = await fetch(`${api}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-forge-tenant': tenant,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    cannotAsk(`${api}${path} could not be reached: ${error.message}`);
  }
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, ok: res.ok, body };
}

const stores = await call('/v1/read/internal/stores', { method: 'GET' });
if (!stores.ok) {
  cannotAsk(
    `read.internal.stores answered HTTP ${stores.status} ${JSON.stringify(stores.body)} — this run cannot ` +
      `tell whether ${rootStore} is one of "${tenant}"'s stores, so it declares nothing.`,
  );
}
const rows = Array.isArray(stores.body) ? stores.body : (stores.body.items ?? []);
const mine = rows.find((s) => s.id === rootStore);

if (!mine) {
  // ★ NOT AN ERROR, AND THE REASON IS THE SHAPE OF THE BIRTH. The root store belongs to ONE tenant and this
  // step runs once per tenant with that tenant's credential; the other run is where the write happens. The
  // caller counts the claims — "zero of N" is the refusal, and it lives in `bin/box-up.sh`, which is the only
  // place that can see both runs.
  log(
    `${authority} is served by ${rootStore} (${rootFrom}), which is not one of "${tenant}"'s ` +
      `${rows.length} store(s) — the tenant that owns it is where the address is declared.`,
  );
  result('not-mine');
  process.exit(0);
}

// ── 3 · DECLARE IT, unless it is already exactly what we would write ──────────────────────────────────────
//
// IDEMPOTENT BY VALUE, the way `bin/seed-box.mjs` converges the theme and the checkout posture: re-writing a
// value that already matches spends a command, an event and an audit row to change nothing. `read.internal.
// stores` publishes the raw `host` column (packages/core/src/read/internal-capabilities.ts), so the
// comparison is with what the box HOLDS rather than with what somebody believes it holds.
let alreadyThere = false;
if (mine.host === origin) {
  log(`store ${mine.handle} (${rootStore}) already declares ${origin} — nothing written.`);
  alreadyThere = true;
} else {
  const wrote = await call('/v1/commands/tenant.store.update', {
    method: 'POST',
    body: JSON.stringify({ id: rootStore, host: origin }),
  });
  if (!wrote.ok) {
    // ⚠️ `host_taken` IS THE ONE WORTH NAMING. The directory key is unique across ALL tenants, so this is
    // another store of this box holding the address — the shape a hand-edited box or a half-finished
    // promotion leaves behind.
    const reason = wrote.body?.error?.reason ?? wrote.body?.reason ?? '';
    refuse(
      `tenant.store.update --host ${origin} on ${rootStore} was refused: HTTP ${wrote.status} ` +
        `${JSON.stringify(wrote.body)}${
          reason === 'host_taken'
            ? ` — another store already claims ${authority}. A host is unique across every tenant of this ` +
              'box, so exactly one store may be at the root; clear it there first.'
            : ''
        }`,
    );
  }
  log(
    `store ${mine.handle} (${rootStore}) — host ${mine.host ? `${mine.host} → ` : ''}${origin} declared ` +
      'through tenant.store.update',
  );
}

// ── 4 · …AND WAIT FOR THE PORT TO AGREE, because the row is not what anybody asks ─────────────────────────
//
// See §3 of the header: `read.store.by_host` reads the global directory, which a relay consumer fills from
// the event this command just emitted. Everything downstream — the warmer's address space, the URL
// inventory, the fronts when the override is gone — asks THAT. So that is what this step grades.
const settleStarted = Date.now();
let answered = null;
for (;;) {
  try {
    const res = await fetch(`${api}/v1/read/store.by_host?host=${encodeURIComponent(authority)}`);
    if (res.ok) answered = (await res.json())?.store_id ?? null;
    else answered = null;
  } catch {
    answered = null;
  }
  if (answered === rootStore) break;
  if (Date.now() - settleStarted >= settleMs) break;
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}
const waited = Date.now() - settleStarted;

if (answered !== rootStore) {
  refuse(
    `read.store.by_host?host=${authority} answers ${answered ?? '404 (no store)'} after ${waited}ms, not ` +
      `${rootStore}. The store ROW ${alreadyThere ? 'already held' : 'now holds'} that address; the GLOBAL ` +
      'directory this read is served from is filled by the `read.store_directory` relay consumer, so what ' +
      'did not happen is the DELIVERY — look in the kernel log for `[store_directory]` and for relay ' +
      'DEAD-LETTER lines. Until it does, the warmer builds /s/<id>/… urls for a shop a visitor opens at /, ' +
      'and this box routes only through the fronts\' env override.',
  );
}

log(`read.store.by_host?host=${authority} → ${rootStore} (the directory agreed after ${waited}ms)`);
result(alreadyThere ? 'converged' : 'declared');
process.exit(0);
