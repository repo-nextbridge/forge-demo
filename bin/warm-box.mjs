#!/usr/bin/env node
// ★★ THE LAST STEP OF A BIRTH: THE BOX IS NOT DONE UNTIL IT IS WARM, AND IT SAYS SO WITH NUMBERS.
//
//   FORGE_SEED_TOKEN=… FORGE_REVALIDATE_SECRET=… node bin/warm-box.mjs --tenant forgeco --api http://localhost:8200
//
// ── WHY WARMING IS PART OF "DONE" AND NOT A COURTESY ─────────────────────────────────────────────────────
//
// Renan, 04/09: *"ele também vai ser testado por exemplo performance e tal, se ele falhar em um teste de
// performance é prejudicial ao meu comercial"*. A box handed over cold makes the FIRST VISITOR pay for every
// route cache, ISR entry and image derivative this box could have filled by itself in the minutes nobody was
// watching — and on this box that first visitor is whoever is evaluating it. So a birth that leaves a store
// cold EXITS NON-ZERO, exactly like a tenant that did not settle.
//
// ── WHO WARMS, AND WHY THIS SCRIPT ONLY DRIVES ───────────────────────────────────────────────────────────
//
// The vitrine publishes the warmer itself (`POST /api/warm`, guarded by `FORGE_REVALIDATE_SECRET` — the same
// secret the admin already uses to invalidate). It is inside the IMAGE, which is the whole reason this step
// can exist on a box that runs images and holds no monorepo. This script names the stores and grades the
// answer; the plan, the fetching and the report are the vitrine's.
//
// ★ AND THE FETCHES GO THROUGH THE EDGE, which is what makes ONE call warm THREE containers. The run visits
// `$FORGE_PUBLIC_ORIGIN/...`, so caddy routes each URL to whichever front owns it — the café's fork included.
// Warming the fork by talking to the fork would warm a different address space (`/s/<id>` reached directly
// is not the URL a shopper receives) and would need a second door for no gain.
//
// ── ★★ WHICH STORES: THE PORT SAYS, THE DECLARATION FILTERS, AND NEITHER IS SILENT ───────────────────────
//
// The list of stores is READ FROM THE BOX (`read.internal.stores`), never typed here — a store created
// tomorrow is warmed with no edit. `seed/box.json` may mark one `servable: false`, and the counter is:
// it is served by the totem, a whole-host app with no store in its URLs, so there is no vitrine page to warm.
//
// ⚠️ EVERY STORE GETS A LINE, INCLUDING THE ONES THAT DID NOTHING. A store absent from a warm report reads
// exactly like a store that failed, and this repository has already paid three times for a summary that was
// silent about what it did not do (the totem announced without starting, two admin doors announced with one
// claimed, a verifier's ✓ printed without a row being read). So: a skip is announced WITH THE DECLARED
// REASON, a store the port holds and the file does not mention is warmed AND named as undeclared, and a
// store the file declares and the box does not hold is RED.
//
// ── EXIT CODES, and the third one is not a formality ─────────────────────────────────────────────────────
//   0  every servable store came out warm
//   1  THE BOX IS NOT WARM — a store did not warm, a run came back incomplete, the p95 broke a DECLARED
//      ceiling, the vitrine publishes no warmer, or its secret is not the one this host holds. All five are
//      the same answer to the only question this step asks, and all five leave a cold box.
//   2  THIS STEP COULD NOT ASK — no credential, no tenant, a read face that refused, a port that did not
//      answer. Nothing was learned about the box, and reporting that as a defect is how an operator ends up
//      hunting one that does not exist. The split is `bin/verify-seed.mjs`'s, for the same reason.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOX = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'));
const LOCK = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'forge.lock'), 'utf8'));
  } catch {
    return null;
  }
})();

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const intArg = (name, fallback) => {
  const raw = argOf(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    process.stderr.write(`[warm] ${name} needs a whole number, got "${raw}"\n`);
    process.exit(2);
  }
  return n;
};

const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? '';
const token = process.env.FORGE_SEED_TOKEN ?? '';
const secret = process.env.FORGE_REVALIDATE_SECRET ?? '';
const WARM = BOX.warm ?? {};
// ★ THE CEILING IS DECLARED, NEVER DEFAULTED. `WarmOptions.thresholdMs` upstream says why in the same words:
//   a run that fails a number nobody chose is an invented promise. `null` here means "assert nothing about
//   latency", and the run SAYS that rather than printing a green that reads like a measurement.
const thresholdMs = argOf('--threshold-ms') !== undefined ? intArg('--threshold-ms', 0) : (WARM.threshold_ms ?? null);
const deadlineMs = intArg('--deadline-ms', 20 * 60_000);
const pollMs = intArg('--poll-ms', 3_000);

const out = [];
const say = (line = '') => out.push(line);
let failures = 0;
/** THIS step could not ask. Never a claim about the box — see the exit codes above. */
const wrongQuestion = (message) => {
  say(`  ⚑ ${message}`);
  say();
  say(`VERDICT: this step could not ask. Nothing above is a claim about ${tenant || 'the box'}.`);
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(2);
};
const ok = (label, detail) => say(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
const bad = (label, detail) => {
  failures += 1;
  say(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};
const skipped = (label, detail) => say(`  ↷ ${label} — SKIPPED: ${detail}`);
const noted = (label, detail) => say(`  ⚠ ${label} — ${detail}`);

if (!api) wrongQuestion('no --api and no FORGE_PUBLIC_ORIGIN: this step has no address to warm.');
if (!tenant) wrongQuestion('no --tenant: the read face resolves the tenant from the credential, so a run speaks about exactly one.');
if (!token) wrongQuestion('no FORGE_SEED_TOKEN: `read.internal.stores` is the operator face and needs this tenant\'s own token.');
if (!secret) {
  wrongQuestion(
    'no FORGE_REVALIDATE_SECRET: the vitrine\'s warmer refuses everything when the secret is unset (never open ' +
      'by default), so this run would measure a 401 rather than the box. `bin/box-up.sh` mints one at step 3c-bis.',
  );
}

say(`WARMING ${tenant} at ${api}`);
say();

// ── 1 · the stores this box really has ───────────────────────────────────────────────────────────────────
let rows;
try {
  const res = await fetch(`${api}/v1/read/internal/stores`, {
    headers: { authorization: `Bearer ${token}`, 'x-forge-tenant': tenant },
  });
  if (!res.ok) {
    wrongQuestion(
      `read.internal.stores answered ${res.status} for ${tenant} — this step cannot know which stores to warm. ` +
        'The token must be that tenant\'s own and carry `tenant.settings.read`.',
    );
  }
  rows = await res.json();
} catch (error) {
  wrongQuestion(`read.internal.stores could not be reached at ${api}: ${error.message}`);
}
if (!Array.isArray(rows)) wrongQuestion(`read.internal.stores answered ${typeof rows}, not an array of stores.`);

// ── 2 · the declaration, and the three ways the two lists can disagree ───────────────────────────────────
const spec = (BOX.tenants ?? []).find((t) => t.id === tenant);
if (!spec) wrongQuestion(`seed/box.json declares no tenant "${tenant}" — this step has no declaration to filter with.`);
const declared = new Map((spec.stores ?? []).map((s) => [s.handle, s]));

const toWarm = [];
for (const row of rows) {
  const decl = declared.get(row.handle);
  if (!decl) {
    // Warmed, because a store the box holds is a store a visitor can reach — and NAMED, because a store
    // nothing declares is a fact about this box that somebody has to see.
    noted(row.handle, `not declared in seed/box.json — warmed anyway (${row.id})`);
    toWarm.push(row);
    continue;
  }
  if (decl.servable === false) {
    skipped(row.handle, decl._servable_why ?? 'seed/box.json marks it `servable: false` and gives no reason');
    continue;
  }
  toWarm.push(row);
}
for (const [handle, decl] of declared) {
  if (rows.some((r) => r.handle === handle)) continue;
  bad(
    `${handle}`,
    `declared in seed/box.json and NOT in this box — the birth did not create it${decl.bootstrap ? ' (it is the tenant\'s bootstrap store; `provision-ref` owns it)' : ''}`,
  );
}

if (toWarm.length === 0) {
  say();
  say(`VERDICT: nothing to warm for ${tenant} — every store it holds is declared unservable.`);
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

// ── 3 · the run ──────────────────────────────────────────────────────────────────────────────────────────
const params = new URLSearchParams();
for (const s of toWarm) params.append('store', s.id);
params.set('depth', WARM.depth ?? 'products');
if (WARM.products !== undefined) params.set('products', String(WARM.products));
// ★ The endpoint is TOLD the ceiling as well as this script grading it, so the run's own `reasons` name the
//   breach in the box's words rather than only in ours.
if (thresholdMs !== null) params.set('threshold_ms', String(thresholdMs));

const headers = { 'x-revalidate-secret': secret };
let started;
try {
  started = await fetch(`${api}/api/warm?${params}`, { method: 'POST', headers });
} catch (error) {
  wrongQuestion(`the vitrine's warmer could not be reached at ${api}/api/warm: ${error.message}`);
}
const fatal = (label, detail) => {
  bad(label, detail);
  say();
  say(`VERDICT: ${failures} check(s) NOT settled while warming ${tenant}. Read the ✗ lines above.`);
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(1);
};

if (started.status === 404) {
  // ⛔ THE ONE FAILURE AN OPERATOR CANNOT DIAGNOSE FROM THE STATUS ALONE, so it names the cause. This box
  // pins its fronts BY DIGEST; an image baked before the warmer existed simply has no such route, and the
  // pin is where that is written down. Measured on the bench of 04/09: `GET /api/warm` → 404 while
  // `/api/revalidate` → 405, on `forge-demo-storefront@sha256:561f9c3c…`.
  fatal(
    'the warmer',
    `${api}/api/warm → 404: the vitrine of this box publishes no warmer, so nothing can warm it. Its image ` +
      'predates the route — ' +
      `forge.lock pins ${LOCK?.forgeVersion ?? 'this release'}` +
      `${LOCK?.provenance?.built_from ? ` (built from ${LOCK.provenance.built_from})` : ''}. ` +
      'Rebake the fronts with `bash bin/build-local.sh <forge checkout>`, which rewrites forge.lock.',
  );
}
if (started.status === 401) {
  fatal(
    'the warmer',
    `${api}/api/warm → 401: this host's FORGE_REVALIDATE_SECRET is not the one the storefront container holds. ` +
      'The variable is read once at boot, so a value written after `dc up` is a value the running process does ' +
      'not have — recreate the front, or re-run `bash bin/box-up.sh`.',
  );
}
if (!started.ok && started.status !== 202) {
  const body = await started.text().catch(() => '');
  fatal('the warmer', `${api}/api/warm → ${started.status}: ${body.slice(0, 300)}`);
}
const startedBody = await started.json().catch(() => ({}));
if (startedBody.started === false) {
  // Not an error: single-flight, and the caller gets the flying run. It is said out loud because the numbers
  // below then belong to a run THIS script did not start, over a plan it did not choose.
  noted('the run', `one was already flying (${startedBody.run?.id ?? '?'}) — the numbers below are ITS, not this call's`);
}

const runId = startedBody.run?.id;
const until = Date.now() + deadlineMs;
let run = startedBody.run ?? null;
while (run && run.state === 'running') {
  if (Date.now() >= until) break;
  await new Promise((r) => setTimeout(r, pollMs));
  let res;
  try {
    res = await fetch(`${api}/api/warm`, { headers });
  } catch (error) {
    wrongQuestion(`the warm run could not be polled: ${error.message}`);
  }
  if (!res.ok) wrongQuestion(`GET ${api}/api/warm → ${res.status} while polling run ${runId}.`);
  const body = await res.json().catch(() => ({}));
  run = body.run ?? run;
}

// ── 4 · the grade ────────────────────────────────────────────────────────────────────────────────────────
const names = toWarm.map((s) => `${s.handle}=${s.id}`).join(' · ');
if (!run) {
  bad('the run', 'the vitrine answered with no run at all');
} else if (run.state === 'running') {
  const p = run.progress ?? {};
  bad(
    'the run',
    `still running after the ${Math.round(deadlineMs / 1000)}s deadline — ${p.warmed ?? 0} warmed, ` +
      `${p.failed ?? 0} failed of ${p.planned ?? 0} planned so far. A birth may not hang on a poll; the run ` +
      `itself carries on and \`GET ${api}/api/warm\` still answers for it.`,
  );
} else if (run.state === 'failed') {
  // No report at all is a DIFFERENT answer from "warmed nothing", and the two must never render the same.
  bad('the run', `could not be planned, so nothing was measured: ${run.error ?? 'no reason given'}`);
} else {
  const r = run.report ?? {};
  const line = `planned=${r.planned ?? 0} warmed=${r.warmed ?? 0} failed=${r.failed ?? 0} p95=${r.p95 ?? 0}ms (${r.p95Pass ?? '?'} pass) · ${names}`;
  if (run.state === 'ok') ok('the stores', line);
  else bad('the stores', `${line}${(r.reasons ?? []).length ? ` — ${r.reasons.join(' · ')}` : ''}`);

  if (thresholdMs === null) {
    // ⚠️ SAID OUT LOUD. A green with no ceiling reads like a fast box; it is a box nobody measured a promise
    //    for. `seed/box.json` → `warm.threshold_ms` is where a measured number goes.
    noted('the latency', `no ceiling declared (seed/box.json → warm.threshold_ms is null), so this run asserts nothing about how fast — only that ${r.warmed ?? 0} page(s) warmed`);
  } else if ((r.p95 ?? 0) > thresholdMs) {
    bad('the latency', `p95 ${r.p95}ms is over the declared ceiling of ${thresholdMs}ms`);
  } else {
    ok('the latency', `p95 ${r.p95 ?? 0}ms is within the declared ceiling of ${thresholdMs}ms`);
  }
}

say();
say(
  failures === 0
    ? `VERDICT: warm. ${toWarm.length} store(s) of ${tenant} were warmed through ${api}.`
    : `VERDICT: ${failures} check(s) NOT settled while warming ${tenant}. Read the ✗ lines above.`,
);
process.stdout.write(`${out.join('\n')}\n`);
process.exit(failures === 0 ? 0 : 1);
