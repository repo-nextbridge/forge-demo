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
// watching — and on this box that first visitor is whoever is evaluating it. So warming still runs at the end
// of every birth, and it still says everything it learned.
//
// ── ★★ AND WHY IT REPORTS RATHER THAN GRADES (Renan, 05/09: *"D1 - Pode ser só relatório"*) ──────────────
//
// ★ THE ARGUMENT, AND IT IS THE WHOLE REASON THIS STEP CHANGED SHAPE: A STEP THAT IS ALWAYS RED IS A STEP
// PEOPLE LEARN TO SKIP — and then it stops being worth anything on the day it is right.
//
// Three measurements, all of them from real births on the promoted bench, say this one was always red:
//
//   1 · RED BY CONSTRUCTION. The plan is not made of pages: ~420 pages plus ~20 400 IMAGE derivatives found in
//       each HTML's `srcset` — `planned=20822`, `warmed=4964`, `15865 urls were never visited`. What cuts it
//       is the VITRINE's own ceiling, `DEFAULT_MAX_DURATION_MS = 15 * 60_000`
//       (`apps/storefront/src/lib/warm/warm.ts:51`, in the product), which this script does not override — the
//       `--deadline-ms` below is a different number, the wait for an answer. EVERY run ends this way.
//   2 · AND IT INVENTS RED. `failed=198` and `failed=189` on two births — and the very same brands and
//       collections answer 200 on the idle box, with this same step reporting `failed=0`. Those failures are
//       the load the warmer imposes on a box that is still settling; it is the last step of the birth and it
//       races the tail of the seed.
//   3 · AND THE p95 IT PUBLISHES IS NOT THE VISITOR'S. `p95=735ms` for the coffee shop against 19–29 ms
//       measured with `curl` at the same instant. Whatever the verify pass measures, it is not a page's TTFB.
//
// ⇒ So the birth's exit code stops depending on WARMTH. Nothing is silenced, nothing became `|| true`: the run
// still happens, and this file now says MORE than it used to — which pages did not answer BY NAME, which were
// never visited (a different thing, and the difference used to live only in a sentence), and why.
//
// ⛔ WHAT DID NOT STOP GRADING: a store `seed/box.json` DECLARES and the box does not hold. That is not a
// statement about warmth — it is "the birth did not build what this repository declares" — and this step is
// the ONLY one that can see it (`bin/verify-seed.mjs` grades the stores the port REPORTS, and `bin/prove-doors.mjs`
// opens the doors of the stores the port reports; neither can miss a store that is not there). It keeps an exit
// code of its own so that dropping the warmth gate did not quietly drop that one too.
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
// ── EXIT CODES, and the interesting one is the one that is NOT here ──────────────────────────────────────
//   0  EVERY SERVABLE STORE CAME OUT WARM.
//   1  ★ A REPORT, NOT A GATE: the box did NOT come out fully warm. A store that did not warm, a run that came
//      back incomplete or never finished, a p95 over a DECLARED ceiling, a vitrine that publishes no warmer, a
//      secret this host does not share. It is still non-zero because a HUMAN running this script by hand asked
//      a yes/no question and deserves an answer — but `bin/box-up.sh` DELIBERATELY does not fail the birth on
//      it, and says so where it reads the status. Everything is printed, and printed by name.
//   2  THIS STEP COULD NOT ASK — no credential, no tenant, a read face that refused, a port that did not
//      answer. Nothing was learned about the box, and reporting that as a defect is how an operator ends up
//      hunting one that does not exist. The split is `bin/verify-seed.mjs`'s, for the same reason.
//   3  THE BOX DOES NOT HOLD A STORE `seed/box.json` DECLARES. The birth did not build it; see above for why
//      this one, and only this one, still fails.

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
/** Stores `seed/box.json` declares and the box does not hold. The ONE thing here that is still an exit code. */
let missing = 0;
/** What the box was not: one sentence each, printed in the verdict. Reported, never graded — see the header. */
const shortfalls = [];
/** THIS step could not ask. Never a claim about the box — see the exit codes above. */
const wrongQuestion = (message) => {
  say(`  ⚑ ${message}`);
  say();
  say(`VERDICT: this step could not ask. Nothing above is a claim about ${tenant || 'the box'}.`);
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(2);
};
const ok = (label, detail) => say(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
/** THE BIRTH DID NOT BUILD SOMETHING THIS REPOSITORY DECLARES. The only red this step still owns. */
const bad = (label, detail) => {
  missing += 1;
  say(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};
/** THE BOX IS NOT AS WARM AS IT COULD BE. Said in full, and it does not decide anybody's exit code. */
const cold = (label, detail) => {
  shortfalls.push(detail);
  say(`  ⚠ ${label} — ${detail}`);
};
const skipped = (label, detail) => say(`  ↷ ${label} — SKIPPED: ${detail}`);
const noted = (label, detail) => say(`  ⚠ ${label} — ${detail}`);

/**
 * The last line, and the only place this file exits from once it has been able to ask.
 *
 * ⚠️ THE VERDICT NAMES THE SHORTFALLS EVEN THOUGH THEY DO NOT FAIL. A report that ends "not warm" without
 * saying what was not warm is precisely the summary this repository has paid for four times.
 */
const finish = () => {
  say();
  if (missing > 0) {
    say(
      `VERDICT: ${missing} store(s) this repository DECLARES are not in ${tenant}. The birth did not build ` +
        'them, which is not a statement about warmth — read the ✗ line(s) above.',
    );
  } else if (shortfalls.length === 0) {
    say(`VERDICT: warm. Every servable store of ${tenant} was warmed through ${api}.`);
  } else {
    say(`VERDICT (a REPORT — bin/box-up.sh does not fail the birth on it): ${tenant} did NOT come out fully warm.`);
    for (const line of shortfalls) say(`  · ${line}`);
    say('  Why this is a report and not a red: see the header of bin/warm-box.mjs.');
  }
  process.stdout.write(`${out.join('\n')}\n`);
  // ⚠️ 3 BEATS 1: a box that is missing a store this repository declares is a different sentence from a box
  //    that is a bit cold, and the caller reads the status before it reads the prose.
  process.exit(missing > 0 ? 3 : shortfalls.length > 0 ? 1 : 0);
};

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
  say(`Nothing to warm for ${tenant} — every store it holds is declared unservable.`);
  finish();
}

// ── ★★ 2b · WHICH ADDRESS SPACE THIS RUN WILL WARM, ASKED BEFORE IT WARMS ANYTHING ──────────────────────
//
// One rule decides a store's URLs and the PORT answers it: does the origin's own host resolve to this store?
// Yes → the store is warmed with clean URLs (`/tenis`); no → path-scoped (`/s/<id>/tenis`). Those are two
// different sets of route-cache entries, so warming the second while shoppers arrive on the first fills
// pages nobody opens — and reports them as this shop's, which is worse than not warming.
//
// ⛔ MEASURED ON THIS BOX, 04/09. `read.store.by_host` answers 404 for EVERY hostname the bench uses —
// `localhost`, `localhost:8200`, `127.0.0.1:8200` and the tailnet name. The kernel's `store_directory` is
// empty because this box resolves hosts through the `FORGE_STORE_HOSTS` OVERRIDE, which
// `packages/storefront-kit/src/resolve-store.ts` checks first by design and which the warmer's
// `storeForOrigin` (`apps/storefront/src/lib/warm/targets.ts`) cannot see: it asks the port and nothing else.
//
// ⚠️ THIS IS NOT MADE RED, AND THE REASON IS STATED. The run genuinely warms what it is able to warm, and the
// gap is in the product's seam rather than in this box's configuration — an operator here cannot close it, and
// a red nobody can act on is a red people learn to skip. It IS said, in the words of the read that decided it,
// and the day a store claims the origin in the directory this line turns into the other one by itself.
const originAuthority = (() => {
  try {
    const u = new URL(api);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return '';
  }
})();
let rootStore = null;
try {
  const res = await fetch(`${api}/v1/read/store.by_host?host=${encodeURIComponent(originAuthority)}`);
  if (res.ok) rootStore = (await res.json())?.store_id ?? null;
} catch {
  rootStore = null;
}
if (rootStore && toWarm.some((s) => s.id === rootStore)) {
  noted('the addresses', `read.store.by_host says ${originAuthority} → ${rootStore}, so that store is warmed at the ROOT (clean URLs) and the others under /s/<id>`);
} else {
  noted(
    'the addresses',
    `read.store.by_host claims no store for ${originAuthority}, so EVERY store below is warmed path-scoped ` +
      '(/s/<id>/…). If a shopper reaches one of them at the root of this origin — which is what the ' +
      'FORGE_STORE_HOSTS override does on this box — those pages are a DIFFERENT set of route-cache entries ' +
      'and this run did not warm them. The warmer asks the port and the override never reaches it.',
  );
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
/** The run cannot even begin. Still the whole truth on the screen — and still not an exit code. */
const stop = (label, detail) => {
  cold(label, detail);
  finish();
};

if (started.status === 404) {
  // ⛔ THE ONE FAILURE AN OPERATOR CANNOT DIAGNOSE FROM THE STATUS ALONE, so it names the cause. This box
  // pins its fronts BY DIGEST; an image baked before the warmer existed simply has no such route, and the
  // pin is where that is written down. Measured on the bench of 04/09: `GET /api/warm` → 404 while
  // `/api/revalidate` → 405, on `forge-demo-storefront@sha256:561f9c3c…`.
  stop(
    'the warmer',
    `${api}/api/warm → 404: the vitrine of this box publishes no warmer, so nothing can warm it. Its image ` +
      'predates the route — ' +
      `forge.lock pins ${LOCK?.forgeVersion ?? 'this release'}` +
      `${LOCK?.provenance?.built_from ? ` (built from ${LOCK.provenance.built_from})` : ''}. ` +
      'Rebake the fronts with `bash bin/build-local.sh <forge checkout>`, which rewrites forge.lock.',
  );
}
if (started.status === 401) {
  stop(
    'the warmer',
    `${api}/api/warm → 401: this host's FORGE_REVALIDATE_SECRET is not the one the storefront container holds. ` +
      'The variable is read once at boot, so a value written after `dc up` is a value the running process does ' +
      'not have — recreate the front, or re-run `bash bin/box-up.sh`.',
  );
}
if (!started.ok && started.status !== 202) {
  const body = await started.text().catch(() => '');
  stop('the warmer', `${api}/api/warm → ${started.status}: ${body.slice(0, 300)}`);
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

// ── 4 · THE REPORT ───────────────────────────────────────────────────────────────────────────────────────
//
// ⚠️ THIS HALF EXISTS BECAUSE THE OLD ONE PRINTED A NUMBER AND NOT A FACT. It said
// `failed=198 … forgeco: 198 of 419 pages did not answer` and named NOT ONE of the 198 — so nobody reading it
// could check whether those pages were broken or whether the warmer had simply overloaded a box that was still
// settling (they were the second: the same URLs answered 200 on the idle box minutes later). A report that
// replaces a gate has to be readable, or the gate was worth more.
//
// ★ AND "DID NOT ANSWER" IS NOT "NEVER VISITED". The vitrine has always carried the two apart — `failed` is a
// url that answered badly, `skipped` is a url the run's ceiling arrived before — but this file used to fold
// them into one word and left the difference to a sentence in `reasons`. They are different repairs: one is a
// page, the other is a ceiling.

/** A url, short enough to read in a terminal and long enough to paste. */
const shortUrl = (u) => {
  const text = String(u ?? '');
  return text.length <= 120 ? text : `${text.slice(0, 117)}…`;
};

/** Up to `SAMPLE` of them BY NAME, and the total — a sample that hides its own size is the old defect again. */
const SAMPLE = 5;
const namedFailures = (lines) => {
  const shown = lines.slice(0, SAMPLE).map((f) => `${shortUrl(f.url)} (${f.error ?? 'failed'})`);
  const more = lines.length - shown.length;
  return `${shown.join(' · ')}${more > 0 ? ` · …and ${more} more` : ''} (${lines.length} in total)`;
};

/** One pass of one store, in the words the pass itself uses. Returns whether it was whole. */
const passLine = (label, pass) => {
  if (!pass) return true;
  const planned = pass.planned ?? 0;
  const done = pass.done ?? 0;
  const failed = pass.failed ?? [];
  const skipped = pass.skipped ?? 0;
  say(
    `      ${label.padEnd(7)} ${done} of ${planned} answered · ${failed.length} did NOT answer · ` +
      `${skipped} never visited · p95 ${pass.p95 ?? 0}ms`,
  );
  if (failed.length > 0) say(`              did not answer: ${namedFailures(failed)}`);
  if (skipped > 0) {
    say(
      `              never visited: ${skipped} url(s) were never TRIED — the run's own ceiling arrived first. ` +
        'That is the vitrine\'s DEFAULT_MAX_DURATION_MS, not this script\'s --deadline-ms.',
    );
  }
  return failed.length === 0 && skipped === 0;
};

const names = toWarm.map((s) => `${s.handle}=${s.id}`).join(' · ');
if (!run) {
  cold('the run', 'the vitrine answered with no run at all');
} else if (run.state === 'running') {
  const p = run.progress ?? {};
  cold(
    'the run',
    `still running after the ${Math.round(deadlineMs / 1000)}s deadline — ${p.warmed ?? 0} warmed, ` +
      `${p.failed ?? 0} failed of ${p.planned ?? 0} planned so far. A birth may not hang on a poll; the run ` +
      `itself carries on and \`GET ${api}/api/warm\` still answers for it.`,
  );
} else if (run.state === 'failed') {
  // No report at all is a DIFFERENT answer from "warmed nothing", and the two must never render the same.
  cold('the run', `could not be planned, so nothing was measured: ${run.error ?? 'no reason given'}`);
} else {
  const r = run.report ?? {};
  const line = `planned=${r.planned ?? 0} warmed=${r.warmed ?? 0} failed=${r.failed ?? 0} p95=${r.p95 ?? 0}ms (${r.p95Pass ?? '?'} pass) · ${names}`;
  if (run.state === 'ok') ok('the stores', line);
  else cold('the stores', `${line}${(r.reasons ?? []).length ? ` — ${r.reasons.join(' · ')}` : ''}`);

  // ★ THE BREAKDOWN, per store and per pass. It is printed on a GREEN run too: an operator who only ever sees
  //   this shape when something is wrong cannot tell a shape that is wrong from a shape they have not seen.
  const perStore = Array.isArray(r.stores) ? r.stores : [];
  if (perStore.length === 0) {
    noted('the breakdown', 'the run carries no per-store report, so this step can only relay the totals above');
  }
  for (const store of perStore) {
    say(`    ${store.store ?? '?'}  ${shortUrl(store.url)}  ${store.planned ?? 0} page(s) planned`);
    for (const reason of store.short ?? []) {
      say(`      ⚠ the URL LIST is incomplete, so the plan is not the store: ${reason}`);
    }
    passLine('pages', store.pages);
    if (store.images) {
      passLine('images', store.images);
      if (store.images.cut) {
        say(`              the image list was CUT at the run's ceiling: ${store.images.declared ?? 0} declared by the HTML`);
      }
      const foreign = store.images.foreignHosts ?? [];
      if (foreign.length > 0) say(`              images on hosts this box does not serve: ${foreign.join(' · ')}`);
    }
    passLine('verify', store.verify);
  }

  if (thresholdMs === null) {
    // ⚠️ SAID OUT LOUD. A green with no ceiling reads like a fast box; it is a box nobody measured a promise
    //    for. `seed/box.json` → `warm.threshold_ms` is where a measured number goes.
    noted('the latency', `no ceiling declared (seed/box.json → warm.threshold_ms is null), so this run asserts nothing about how fast — only that ${r.warmed ?? 0} page(s) warmed`);
  } else if ((r.p95 ?? 0) > thresholdMs) {
    cold('the latency', `p95 ${r.p95}ms is over the declared ceiling of ${thresholdMs}ms`);
  } else {
    ok('the latency', `p95 ${r.p95 ?? 0}ms is within the declared ceiling of ${thresholdMs}ms`);
  }
}

finish();
