#!/usr/bin/env node
// ★★ EVERY DOOR OF EVERY STORE, OPENED — because a 404 behind a link nobody clicked is invisible.
//
//   FORGE_SEED_TOKEN=… node bin/prove-doors.mjs --tenant forgeco --api http://localhost:8200
//
// ⛔ WHY IT EXISTS, MEASURED 2026-09-04 ON A BOX THAT HAD JUST COME UP GREEN. Three of this box's four
// stores answered **404 at `/s/<id>/account/login`** — the shopper's sign-in page — while every other step
// of the birth was settled: the vitrine was warm, the data verified, the configuration graded. Nothing in
// the birth ever opened that door, so nothing said it was shut, and the box was handed over with sign-in
// dead on three shops.
//
// THE CAUSE WAS ONE CHARACTER CLASS IN THE EDGE, and it is worth stating because it is the shape of defect
// this file is for. `caddy/Caddyfile.local` claimed the store-scoped doors with `handle /s/*/account*`.
// Caddy has TWO path-matching regimes: a pattern whose ONLY wildcard is a trailing `*` is a PREFIX match
// (it crosses `/`), and any other pattern falls back to Go's `path.Match`, where `*` matches a run of
// NON-SEPARATOR characters. So `/s/*/account*` claimed `/s/<id>/account` and stopped dead at the slash
// before `login`. The generic rule looked right, read right, and covered exactly the one path that the two
// people who wrote it had typed into a browser.
//
// ★ WHAT IT GRADES IS **WHICH CONTAINER ANSWERED**, not just the status code, and that is the whole point.
// A store's vitrine will happily answer 200 for a path it does not own; the split between the forkable
// vitrine and the checkout we host is invisible from a status code alone. `X-Forge-Served-By` is set BY THE
// ROUTE in `caddy/Caddyfile.local`, so it answers the question a code cannot: whose front is this?
//
// ⚠️ IT PROBES ANONYMOUSLY, ON PURPOSE. Every door below is one an unauthenticated shopper must be able to
// reach — a probe carrying a session would grade a different set of pages and would go green on a box where
// a first-time visitor cannot sign in, which is the exact failure this file was written for.
//
// ★★★ pk19 — AND FOR THREE DAYS IT PROVED THE WRONG TENANT'S DOORS AND SIGNED THE RIGHT TENANT'S NAME.
// Measured on the live bench 2026-09-07: `--tenant forgecafe` printed «THE DOORS OF forgecafe», opened
// `forge/…` and `outlet/…` — the two stores of **forgeco** — and closed with «every door of forgecafe
// opens». The café's own two stores had never been opened by this step, in any run, and `bin/box-up.sh`
// runs it once per tenant and adds the two greens: an instrument confirming what it never measured, which
// is worse than no instrument.
//
// ⛔ THE ARGUMENT NEVER TRAVELLED, AND CANNOT. `read.internal.stores` RESOLVES THE TENANT FROM THE
// CREDENTIAL and ignores `x-forge-tenant` (`docs/reference/read.internal.stores.md`: «The tenant is resolved
// from the CALLER's identity»; the trap is written up at `bin/seed-box.mjs:340`). So `--tenant` was never a
// filter — it was a LABEL printed over whatever list the token owned. The birth hands each tenant its own
// token, so the birth was reading the right list; a step whose NAME and whose DATA come from two independent
// places is one stale `FORGE_SEED_TOKEN` in a shell away from lying, and that is how it was found.
//
// ★ SO THIS STEP NOW ASKS THREE QUESTIONS BEFORE IT OPENS ANYTHING, and refuses on any of them:
//   1. does `seed/box.json` DECLARE this tenant?   (no declaration ⇒ nothing to grade against)
//   2. does the CREDENTIAL belong to it?           (`whoami` — the response IS the proof; see below)
//   3. does the box HOLD the stores it declares?   (a declared store the port does not list is a ✗)
// and it refuses to call a run that opened ZERO doors a green, because that is the shape all three of those
// failures decay into.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { servability } from './servable.mjs';

const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? '';
const token = process.env.FORGE_SEED_TOKEN ?? '';

const out = [];
let failures = 0;
const say = (s = '') => out.push(s);
const ok = (what, why) => say(`  ✓ ${what} — ${why}`);
const bad = (what, why) => { failures++; say(`  ✗ ${what} — ${why}`); };
const skipped = (what, why) => say(`  ↷ ${what} — SKIPPED: ${why}`);
/** Held by the box and declared by nobody: probed anyway, and NAMED — see the loop for why. */
const noted = (what, why) => say(`  ⓘ ${what} — ${why}`);
const finish = (verdict) => {
  say();
  say(verdict);
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(failures === 0 ? 0 : 1);
};
/** A question this run cannot ask is never a green and never a red — it is a run that did not happen. */
const wrongQuestion = (why) => {
  say(`  ⚑ ${why}`);
  say();
  say(`VERDICT: this step could not ask. Nothing above is a claim about ${tenant || 'this box'}.`);
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(2);
};

if (!api) wrongQuestion('no --api and no FORGE_PUBLIC_ORIGIN: this step has no box to open.');
if (!tenant) wrongQuestion('no --tenant: the store list is per tenant and this run does not know which.');
if (!token) wrongQuestion('no FORGE_SEED_TOKEN: `read.internal.stores` is the operator face and needs this tenant\'s own token.');

let BOX = {};
try {
  BOX = JSON.parse(readFileSync(join(HERE, 'seed/box.json'), 'utf8'));
} catch (error) {
  wrongQuestion(`seed/box.json could not be read (${error.message}) — there is no declaration of which tenant this is, or of which stores it must hold.`);
}

// ── 1 · IS THIS TENANT DECLARED? ────────────────────────────────────────────────────────────────────────
//
// Asked first because it is local, free, and the only one of the three that can name the TYPO. Until pk19
// this was a `?.stores ?? []`: an unknown tenant produced an EMPTY declaration, which silently disabled the
// skip list and the cross-check below and left the run grading whatever the port happened to hand it.
const spec = (BOX.tenants ?? []).find((t) => t.id === tenant);
if (!spec) {
  const known = (BOX.tenants ?? []).map((t) => t.id).join(', ') || '(none)';
  wrongQuestion(`seed/box.json declares no tenant "${tenant}" — this step has no declaration to grade against. It declares: ${known}.`);
}

/**
 * ── 2 · ★★★ WHOSE CREDENTIAL IS THIS? — asked before a single door is opened ─────────────────────────────
 *
 * The header of this file has the measurement. The short of it: the store list comes from the CREDENTIAL and
 * `--tenant` is only a label, so the two have to be made to agree HERE or the report is a name over somebody
 * else's stores.
 *
 * ★ AN ASSERTION, NOT AN ORDERING — the shape is `bin/seed-box.mjs:358`'s, arrived at on the same trap:
 * `whoami` on this same face returns the tenant the credential belongs to, and a token cannot be answered
 * with anybody else's identity. The response IS the proof, so it holds whatever order the steps run in.
 */
const internalRead = async (name) => {
  let res;
  try {
    res = await fetch(`${api}/v1/read/internal/${name}`, { headers: { authorization: `Bearer ${token}` } });
  } catch (error) {
    wrongQuestion(`read.internal.${name} could not be reached at ${api}: ${error.message}`);
  }
  if (!res.ok) {
    wrongQuestion(
      `read.internal.${name} answered ${res.status} for the credential this run was given — this step cannot ` +
        `know whose doors it would be opening. The token must be ${tenant}'s own and carry \`tenant.settings.read\`.`,
    );
  }
  return res.json();
};

const who = await internalRead('whoami');
const credentialTenant = who?.tenant_id ?? null;
if (credentialTenant !== tenant) {
  wrongQuestion(
    `THIS CREDENTIAL BELONGS TO "${credentialTenant ?? '(unknown)'}", NOT "${tenant}". Nothing was opened. ` +
      'The internal read face resolves the tenant from the CREDENTIAL and IGNORES `x-forge-tenant`, so ' +
      `continuing would open "${credentialTenant ?? 'another tenant'}"'s doors and sign "${tenant}" under ` +
      'them — which is exactly what this step did until 2026-09-07. Each tenant has its own token: ' +
      'forgeco → forge-seed-token ($FORGE_SEED_TOKEN), forgecafe → forge-seed-token-forgecafe ' +
      '($FORGE_SEED_TOKEN_FORGECAFE). `source env-source.sh` exports the FIRST tenant\'s as the ' +
      'unsuffixed one, which is the shell this defect was found in.',
  );
}

// ── 3 · WHICH STORES — and the port is asked WITHOUT `x-forge-tenant`, deliberately. This face ignores that
// header (see above), and sending it would suggest to the next reader that the tenant travels in the
// question. It does not: it travelled in the token, and question 2 is what proved which one.
const rows = await internalRead('stores');
if (!Array.isArray(rows)) wrongQuestion('read.internal.stores answered something that is not an array of stores.');

const declared = new Map((spec.stores ?? []).map((s) => [s.handle, s]));

/**
 * ⚠️ THE STORE-SCOPED ADDRESS SPACE, AND IT IS THE BENCH'S, not production's. Online each store claims a
 * hostname and its doors sit at the ROOT (`/checkout`, `/account/login`); here one origin serves four
 * stores, so the store can only come from the path. Those are two different sets of routes and the edge
 * needs a rule for each — which is exactly the rule that was wrong.
 */
const DOORS = [
  { path: '', expect: [200], by: null, what: 'vitrine' },
  { path: '/checkout', expect: [200], by: 'checkout', what: 'checkout' },
  { path: '/account', expect: [307, 302], by: 'checkout', what: 'conta (redirects an anonymous shopper to the login)' },
  { path: '/account/login', expect: [200], by: 'checkout', what: '★ LOGIN — the door that was shut' },
];

say(`THE DOORS OF ${tenant}, opened anonymously at ${api}`);
say(`  credential → ${credentialTenant} ✓ · ${rows.length} store(s) held · ${declared.size} declared`);
say();

/** Doors actually opened by this run. A verdict over zero of them is not a verdict — see the vacuum below. */
let opened = 0;

for (const row of rows) {
  // Probed anyway — a store the box holds is a store a visitor can reach — and NAMED, because a store no
  // declaration mentions is a fact about this box somebody has to see. (Same rule as `bin/warm-box.mjs`.)
  if (!declared.has(row.handle)) {
    noted(row.handle, `not declared in seed/box.json (${row.id}) — this box holds a store nothing there mentions`);
  }
  // ⚠️ SKIPPED BY NAME, WITH THE REASON, because a store simply ABSENT from a report is indistinguishable
  // from one that failed — this repository has paid for that silence twice. ★ pk21: THE REASON IS THE PORT'S.
  // `seed/box.json` used to carry a hand-written `servable: false` for the counter — a second truth about a
  // store the very read below already described — so this step had to learn that store BY NAME. It reads
  // `storefront_enabled` off the row now (`bin/servable.mjs`), which is why the skip needs no list here.
  const { servable, reason } = servability(row);
  if (!servable) {
    skipped(row.handle, `this run asked NOTHING about its doors — ${reason}`);
    continue;
  }
  const base = `${api}/s/${row.id}`;
  for (const door of DOORS) {
    let code = 0;
    let servedBy = '';
    try {
      const res = await fetch(`${base}${door.path}`, { redirect: 'manual' });
      code = res.status;
      servedBy = res.headers.get('x-forge-served-by') ?? '';
    } catch (error) {
      bad(`${row.handle}${door.path || '/'}`, `could not be reached: ${error.message}`);
      continue;
    }
    const label = `${row.handle}${door.path || '/'}`;
    if (!door.expect.includes(code)) {
      bad(label, `${door.what} answered ${code}, and this door has to answer ${door.expect.join(' or ')}${servedBy ? ` (served by ${servedBy})` : ''}`);
      continue;
    }
    // ★ THE CONTAINER, NOT ONLY THE CODE. The vitrine answers 200 for paths it does not own; only the
    // header proves the edge chose the front that holds the money and the session.
    if (door.by && servedBy && servedBy !== door.by) {
      bad(label, `${door.what} answered ${code} but was served by "${servedBy}", not "${door.by}" — the edge sent it to the wrong front`);
      continue;
    }
    opened++;
    ok(label, `${door.what} → ${code}${servedBy ? ` · ${servedBy}` : ''}`);
  }
  say();
}

// ── ★★ THE STORE THIS REPOSITORY DECLARES AND THE BOX DOES NOT HOLD ─────────────────────────────────────
//
// The other half of "which doors are these": question 2 proved the list belongs to the right tenant, and
// this proves the list is not SHORT. Without it, a port that hands back an empty array — or a birth that
// built one store of two — is a run with fewer ✓ lines and the same green verdict. (`bin/warm-box.mjs` grades
// the same disagreement, in the loop after the one that classifies rows; it is stated in both because neither
// runs the other. ⚠️ Named rather than cited by line: this file used to point at a line number, and pk21
// moved it.)
for (const [handle, decl] of declared) {
  if (rows.some((r) => r.handle === handle)) continue;
  bad(
    handle,
    `declared in seed/box.json and NOT in this box, so none of its doors could be opened${decl.bootstrap ? " (it is the tenant's bootstrap store; `provision-ref` owns it)" : ''}`,
  );
}

// ── ★★★ THE VACUUM: a run that opened NOTHING is not a run that found everything open ───────────────────
//
// Every way this step can go blind decays into the same shape — an empty report under a green verdict — so
// the count is asserted directly instead of trusting that the reasons above are exhaustive.
if (opened === 0) {
  bad(
    `NO DOOR OF ${tenant} WAS OPENED`,
    `this run graded ${rows.length} store(s) held and ${declared.size} declared and opened zero doors, so it ` +
      'proves nothing about this tenant. A doors step with no door in it is a green that means "not asked".',
  );
}

finish(
  failures === 0
    ? `VERDICT: every door of ${tenant} opens (${opened}), and each one was opened by the front that owns it.`
    : opened === 0
      ? // ⚠️ NOT "N doors do not open" — this run never opened one, and a count of failures over an empty
        // report would read as a partial success. The ✗ lines above say what it could not reach.
        `VERDICT: NOT ONE door of ${tenant} was opened by this run, so it proves nothing about this tenant. Read the ✗ lines above.`
      : `VERDICT: ${failures} door(s) of ${tenant} do NOT open. Read the ✗ lines above.`,
);
