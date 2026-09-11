#!/usr/bin/env node
// ★★ THE LAST STEP OF A BIRTH: THE BOX IS NOT DONE UNTIL IT IS WARM, AND IT SAYS SO WITH NUMBERS.
//
//   FORGE_SEED_TOKEN=… FORGE_REVALIDATE_SECRET=… node bin/warm-box.mjs --tenant forgeco --api http://localhost:8200
//     [--env ./.env]            the declaration this box is reborn from — how the run learns which store it
//                               serves at the ROOT of that origin (§2b). Default: this repository's `.env`.
//     [--root-store sto_…]      the same answer, named by hand, for a box whose `.env` is not readable here.
//                               The URL inventory's flag, same name and same meaning.
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
//   1 · RED BY CONSTRUCTION — ★ AND THIS ONE IS FIXED (pk21/d2, see §3b). The plan is not made of pages:
//       ~420 pages plus ~20 400 IMAGE derivatives found in each HTML's `srcset` — `planned=20822`,
//       `warmed=4964`, `15865 urls were never visited`. What cut it is the VITRINE's own DEFAULT,
//       `DEFAULT_MAX_DURATION_MS = 15 * 60_000` (`apps/storefront/src/lib/warm/warm.ts:51`, in the product).
//       ⚠️ THIS FILE USED TO SAY THAT DEFAULT COULD NOT BE OVERRIDDEN. It was wrong, and one look at the
//       route settles it: `/api/warm?max_duration_ms=` overrides it
//       (`apps/storefront/src/app/api/warm/route.ts:183`). Since pk21 a run that is CUT is re-run under a
//       ceiling DERIVED from the plan it just measured (Renan, 07/09: *"deriva do plano"*), so the step is
//       no longer red by construction. The `--deadline-ms` below is still a different number: the wait for
//       an answer, and it derives from the ceiling rather than being a constant.
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
// statement about warmth — it is "the birth did not build what this repository declares" — so it keeps an
// exit code of its own (3), and dropping the warmth gate did not quietly drop that one too.
//
// ⚠️ AND THIS PARAGRAPH USED TO CLAIM THIS STEP WAS THE **ONLY** ONE THAT COULD SEE IT. That was true when it
// was written (`e6df443`, 2026-09-05) and it stopped being true two days later: `b72eca4` (2026-09-07, the
// pk19 `--tenant` repair) gave `bin/prove-doors.mjs` the same loop over the same two sources —
// `seed/box.json`'s stores for the tenant against the handles `read.internal.stores` answers — and it `bad`s
// on a declared store the port does not list, which is a non-zero exit there too. MEASURED, not read: its
// suite covers it (*"SABOTAGE, THE VACUUM: the port holds NONE of the declared stores ⇒ red naming them"*).
// So the two steps ask it independently, which is what `prove-doors` already says at that loop — *"neither
// runs the other"* — and this file is now the second half of that sentence instead of contradicting it.
//
// ★ WHAT IS STILL TRUE, AND IT IS THE HALF THAT MATTERS: `bin/verify-seed.mjs` cannot see it. It compares
// handles only to catch a WRONG CREDENTIAL (no overlap at all between what this repository declares and what
// the token sees); one declared store missing out of two passes it without a word.
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
// tomorrow is warmed with no edit. ★ pk21: WHICH OF THEM HAS A PAGE IS READ FROM THE SAME ANSWER. That read
// already carries `storefront_enabled` (derived from the store's `status`), so `bin/servable.mjs` classifies
// the rows and `seed/box.json` declares nothing about it. It used to: a hand-written `servable: false` on the
// counter, a second truth about a store the port was already describing, which is exactly why this step and
// `bin/prove-doors.mjs` each had to learn that store BY NAME.
//
// ⚠️ EVERY STORE GETS A LINE, INCLUDING THE ONES THAT DID NOTHING. A store absent from a warm report reads
// exactly like a store that failed, and this repository has already paid three times for a summary that was
// silent about what it did not do (the totem announced without starting, two admin doors announced with one
// claimed, a verifier's ✓ printed without a row being read). So: a skip is announced WITH THE REASON THE PORT
// GAVE, a store the port holds and the file does not mention is NAMED as undeclared, and a store the file
// declares and the box does not hold is RED.
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
//   3  THE BOX DOES NOT HOLD A STORE `seed/box.json` DECLARES — or the port reported no store at all. The
//      birth did not build it; see above for why this one, and only this one, still fails.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readDeclaration, storeAtRoot } from './box-env.mjs';
import { servability } from './servable.mjs';

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
/** How long THIS SCRIPT waits for an answer — a different number from the run's own ceiling, which is
 *  derived per run below. Absent ⇒ derived too; given ⇒ it wins for every run, which is how the tests pin it. */
const deadlineArg = argOf('--deadline-ms') !== undefined ? intArg('--deadline-ms', 0) : null;
const pollMs = intArg('--poll-ms', 3_000);
/** ⚠️ THE SABOTAGE SWITCH, MADE PERMANENT. With it the step reports the cut and derives NOTHING — which is
 *  exactly the pre-pk21 behaviour, and is how `bin/warm-box.test.mjs` proves the derivation is what repairs
 *  the box rather than something else that changed at the same time. Nothing in the birth passes it. */
const noDerive = process.argv.includes('--no-derive');

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

// ── 1 · WHOSE CREDENTIAL IS THIS, AND THEN WHICH STORES ──────────────────────────────────────────────────
//
// ★★★ THE HOLE THIS CLOSES (§B5 of the pk18 notebook; found by `pk19/portas` on 2026-09-07 and left here).
// Until pk21 this step sent `x-forge-tenant: <tenant>` on the read below and asked nothing else. THAT HEADER
// IS A NO-OP ON THIS FACE: `read.internal.stores` resolves the tenant from the CREDENTIAL
// (`docs/reference/read.internal.stores.md`: «The tenant is resolved from the CALLER's identity»). So
// `--tenant` was never a filter — it was a LABEL printed over whatever list the token owned, and with the
// wrong token in the shell (`source env-source.sh` exports the FIRST tenant's as the unsuffixed one) this
// step read another tenant's stores, found none of the ones `seed/box.json` declares, and EXITED 3:
// «the birth did not build it». It accused an innocent tenant and sent the operator to re-provision it —
// which is literally the damage written up at `bin/seed-box.mjs:346`.
//
// ★ THE FIX IS AN ASSERTION, NOT AN ORDERING. `whoami` on this same face answers the tenant the CREDENTIAL
// belongs to, and a token cannot be answered with anybody else's identity — the response IS the proof, so it
// holds whatever order the birth runs its steps in. The shape is `bin/seed-box.mjs:358`'s and
// `bin/prove-doors.mjs`'s; this is the third copy, and the last of the three that needed it.
const internalRead = async (name) => {
  let res;
  try {
    // ⛔ NO `x-forge-tenant`. The tenant travelled in the token and question 1 is what proved which one; a
    //    header suggesting the question carried it is how the next reader concludes the list was filtered.
    res = await fetch(`${api}/v1/read/internal/${name}`, { headers: { authorization: `Bearer ${token}` } });
  } catch (error) {
    wrongQuestion(`read.internal.${name} could not be reached at ${api}: ${error.message}`);
  }
  if (!res.ok) {
    wrongQuestion(
      `read.internal.${name} answered ${res.status} for the credential this run was given — this step cannot ` +
        `know whose stores it would be warming. The token must be ${tenant}'s own and carry \`tenant.settings.read\`.`,
    );
  }
  return res.json();
};

const who = await internalRead('whoami');
const credentialTenant = who?.tenant_id ?? null;
if (credentialTenant !== tenant) {
  wrongQuestion(
    `THIS CREDENTIAL BELONGS TO "${credentialTenant ?? '(unknown)'}", NOT "${tenant}". Nothing was warmed. ` +
      'The internal read face resolves the tenant from the CREDENTIAL and IGNORES `x-forge-tenant`, so ' +
      `continuing would read "${credentialTenant ?? 'another tenant'}"'s stores, find none of the stores ` +
      `seed/box.json declares for "${tenant}", and report that the birth never built them — an innocent ` +
      'tenant accused, which is what this step did until 2026-09-07. Each tenant has its own token: ' +
      'forgeco → forge-seed-token ($FORGE_SEED_TOKEN), forgecafe → forge-seed-token-forgecafe ' +
      '($FORGE_SEED_TOKEN_FORGECAFE). `source env-source.sh` exports the FIRST tenant\'s as the unsuffixed ' +
      'one, which is the shell this defect was found in.',
  );
}

const rows = await internalRead('stores');
if (!Array.isArray(rows)) wrongQuestion(`read.internal.stores answered ${typeof rows}, not an array of stores.`);

// ── 2 · the declaration, and the three ways the two lists can disagree ───────────────────────────────────
const spec = (BOX.tenants ?? []).find((t) => t.id === tenant);
if (!spec) wrongQuestion(`seed/box.json declares no tenant "${tenant}" — this step has no declaration to filter with.`);
const declared = new Map((spec.stores ?? []).map((s) => [s.handle, s]));

/**
 * ── ★★★ pk33 · DOES THIS STORE HAVE A GATE IN FRONT OF IT, AND WHAT DOES THAT COST THE WARMING? ─────────
 *
 * ⛔ THE MEASUREMENT, AND IT IS A DEFECT OF THE PRODUCT RATHER THAN OF THIS BOX. The warmer runs INSIDE the
 * vitrine (`POST /api/warm` → `apps/storefront/src/lib/warm/run.ts` in the Forge monorepo) and its fetcher
 * sets exactly ONE header — `user-agent: <the warmer's>` (`withWarmerUserAgent`, and `runPass` beside it).
 * It carries NO COOKIE. So on a store with a gate, every page it visits answers **the gate**: a small static
 * interstitial, 200, from the same container. ⇒ the shop's route cache, its ISR entries and its image
 * derivatives are NOT filled, and the image pass — which derives its list from `imageUrlsFrom(visit.body)` —
 * finds nothing at all, because a gate screen has no `next/image` in it.
 *
 * ⚠️ AND THE RUN STILL COMES BACK GREEN, which is why this is said here rather than left to be noticed. Every
 * visit is a 200 and every page "warmed"; nothing in the report can tell the gate from the shop. A step that
 * reports success over work it did not do is the one shape this repository keeps paying for.
 *
 * ⛔ IT IS NOT FIXED HERE, AND IT CANNOT BE: this step drives the endpoint over HTTP and the fetches happen
 * inside the other repository's process. The repair is one header on the warmer's own fetcher
 * (`apps/storefront/src/lib/warm/run.ts`, the Forge monorepo), and a slice names one repo. What IS repaired is
 * the silence.
 */
const GATE_TARGET = 'storefront:gate';
const gateFillerOf = async (storeId) => {
  try {
    const res = await fetch(`${api}/v1/read/extensions?store=${encodeURIComponent(storeId)}`);
    if (!res.ok) return undefined;
    const list = await res.json();
    if (!Array.isArray(list)) return undefined;
    return list.find((e) => (e.hooks ?? []).some((h) => h.target === GATE_TARGET))?.extension_id ?? null;
  } catch {
    return undefined;
  }
};

const toWarm = [];
const gated = [];
for (const row of rows) {
  // ⚠️ BOTH FACTS, AND IN THIS ORDER. "Nothing declares this store" and "the port says it has no page" are
  // independent, and folding them would let one hide the other: an undeclared store that is also off the
  // street would be skipped in silence, and a store nothing mentions is a fact about this box regardless of
  // whether there was anything to warm in it.
  if (!declared.has(row.handle)) {
    noted(row.handle, `not declared in seed/box.json (${row.id}) — this box holds a store nothing here mentions`);
  }
  const { servable, reason } = servability(row);
  if (!servable) {
    // Skipped BY NAME with the reason, because a store simply absent from a report is indistinguishable from
    // one that failed. The reason is the PORT's now, not a paragraph in a file that can go stale against it.
    skipped(row.handle, reason);
    continue;
  }
  const filler = await gateFillerOf(row.id);
  if (filler) {
    gated.push(row.handle);
    noted(
      row.handle,
      `A GATE ("${filler}") STANDS IN FRONT OF THIS STORE, and the warmer carries no dismissal cookie — so ` +
        'every page below warms the GATE, not the shop. The visits will all answer 200 and this report will ' +
        'say "warm": it cannot tell the two apart. ⇒ treat this store as COLD whatever the numbers say. The ' +
        'repair is one header on the warmer\'s own fetcher, in the product (apps/storefront/src/lib/warm/' +
        'run.ts); step 14-bis is what proves the gate is really there.',
    );
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

// ── ★★★ THE VACUUM: a read that came back EMPTY is not a box with nothing to warm ───────────────────────
//
// Every way this step can go blind ends in the same shape — an empty report under a verdict that reads like
// a measurement. `bin/prove-doors.mjs` asserts its own count for the same reason and says so there; neither
// step runs the other, so both state it. ⚠️ It is `rows.length`, not `toWarm.length`: a box whose stores are
// all genuinely off the street warmed nothing CORRECTLY, and the ↷ lines above name every one of them with
// the port's reason. A port that reported NO STORE AT ALL is a different sentence.
if (rows.length === 0) {
  bad(
    `NO STORE OF ${tenant} WAS READ`,
    'read.internal.stores answered an EMPTY list, so this run warmed nothing and knows nothing. "Nothing to ' +
      'warm" over a port that reported no store is a green that means "not asked".',
  );
}
if (toWarm.length === 0) {
  say();
  if (rows.length > 0) {
    say(
      `Nothing to warm for ${tenant} — the port reports ${rows.length} store(s) and says none of them has a ` +
        'public page. Each is named above with the reason it gave.',
    );
  }
  finish();
}

// ── ★★ 2b · WHICH ADDRESS SPACE THIS RUN WILL WARM, ASKED BEFORE IT WARMS ANYTHING ──────────────────────
//
// One rule decides a store's URLs and the PORT answers it: does the origin's own host resolve to this store?
// Yes → the store is warmed with clean URLs (`/tenis`); no → path-scoped (`/s/<id>/tenis`). Those are two
// different sets of route-cache entries, so warming the second while shoppers arrive on the first fills
// pages nobody opens — and reports them as this shop's, which is worse than not warming.
//
// ⛔ MEASURED ON THIS BOX, 04/09 AND AGAIN 08/09. `read.store.by_host` answered 404 for EVERY hostname the
// bench uses — `localhost`, `localhost:8200`, `127.0.0.1:8200` and the tailnet name. The kernel's
// `store_directory` was empty because this box resolved hosts through the `FORGE_STORE_HOSTS` OVERRIDE, which
// `packages/storefront-kit/src/resolve-store.ts` checks first by design and which the warmer's
// `storeForOrigin` (`apps/storefront/src/lib/warm/targets.ts:38`) cannot see: it asks the port and nothing else.
//
// ★★ AND pk26/d1 CLOSED THAT — the past tense above is the change. Step 6b of the birth (`bin/store-host.mjs`)
// now has the root store CLAIM this box's origin through `tenant.store.update --host`, and the promotion
// re-claims the new one; so on a box born since, the port and the declaration AGREE and the first branch
// below is the one that fires. What the two branches mean changed with it: a disagreement is no longer "the
// feature does not exist yet", it is "step 6b did not take on this box".
//
// ★★ SO THIS STEP ASKS BOTH SOURCES, AND THAT IS WHAT CHANGED IN pk25/d1. The port answers who claims the
// origin in the DIRECTORY; `.env`'s `FORGE_STORE_HOSTS` answers who this box actually SERVES there, and it is
// the second one a shopper's browser obeys. Reading it is the same derivation `bin/box-up.sh --promote`
// already makes (it reads the root store back out of that map) and the same override the URL inventory takes
// as `--root-store` — the flag is kept here, with the same name, for a box whose declaration this process
// cannot read.
//
// ⛔ AND WHEN THE TWO DISAGREE THE REPORT STOPS SAYING «warm», WHICH IS THE HALF THAT WAS MISSING. Until now
// this line was a `⚠` note under a `VERDICT: warm` and an exit 0 — so every birth of this box reported a warm
// shop while the pages it warmed (`/s/<id>/botas/chelsea`) were not the pages a visitor opens
// (`/botas/chelsea`). Two route-cache trees, and the operator was told about the wrong one in a sentence that
// did not change the verdict. It is a SHORTFALL now: still not a gate (`bin/box-up.sh` does not fail a birth
// on warmth), still not this operator's fault to fix, but no longer something the last line calls warm.
//
// ⚠️ AND THIS STEP CANNOT CLOSE THE GAP ITSELF — the address space is the VITRINE's to decide. `/api/warm`
// takes `store=`, `origin=`, `depth=`, `products=`, `max_duration_ms=` … and NOTHING that names the root
// store (`apps/storefront/src/app/api/warm/route.ts`), because `resolveTargets` derives each store's base
// from `storeForOrigin` alone (`apps/storefront/src/lib/warm/targets.ts:88`). What closes it is DATA — a store
// that claims the origin in the directory (`tenant.store.update` → `host`) — and that is step 6b of the
// birth, not a wish: when it has run, the port's answer and the declaration agree and this branch turns into
// the first one by itself. So reaching the branches below on a box born since means step 6b did not take.
const originAuthority = (() => {
  try {
    const u = new URL(api);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return '';
  }
})();

// ── who the DIRECTORY says is at the root — the only thing the warmer itself can see ─────────────────────
let rootByPort = null;
try {
  const res = await fetch(`${api}/v1/read/store.by_host?host=${encodeURIComponent(originAuthority)}`);
  if (res.ok) rootByPort = (await res.json())?.store_id ?? null;
} catch {
  rootByPort = null;
}

// ── who this box SERVES there, read from the declaration it is reborn from ───────────────────────────────
//
// ⚠️ THE LOCAL `.env` DESCRIBES THE LOCAL BOX, and this step can be pointed at any `--api`. A run warming
// somebody else's origin with this box's host map would be inventing a fact about another box's routing, so
// the declaration is used ONLY when it declares the very origin being warmed. When it does not, the answer
// is «this run does not know», never a guess.
const envPath = argOf('--env') ?? join(ROOT, '.env');
const rootFlag = argOf('--root-store') ?? null;
let declaration = null;
let blindWhy = '';
try {
  declaration = readDeclaration(envPath);
} catch (error) {
  blindWhy = `${envPath} could not be read (${error.code ?? error.message})`;
}
if (declaration) {
  const declaredOrigin = (declaration.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
  let declaredAuthority = '';
  try {
    const u = new URL(declaredOrigin);
    declaredAuthority = u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    declaredAuthority = '';
  }
  if (!declaredAuthority || declaredAuthority.toLowerCase() !== originAuthority.toLowerCase()) {
    blindWhy =
      `${envPath} declares FORGE_PUBLIC_ORIGIN ${declaredOrigin || '(unset)'}, which is not ${api} — so its ` +
      'host map describes a different box and this run refuses to read this origin out of it';
    declaration = null;
  }
}
const rootDeclared = rootFlag ?? (declaration ? storeAtRoot(declaration, originAuthority) : null);
const rootFrom = rootFlag ? '--root-store' : `FORGE_STORE_HOSTS in ${envPath}`;

/** A root store only matters here if it is one of the stores THIS run is warming. */
const inThisRun = (id) => Boolean(id) && toWarm.some((s) => s.id === id);
const warmedAtRoot = inThisRun(rootByPort) ? rootByPort : null;
const servedAtRoot = inThisRun(rootDeclared) ? rootDeclared : null;

if (warmedAtRoot && servedAtRoot && warmedAtRoot !== servedAtRoot) {
  // Worse than cold: the warmer builds ROOT urls for the store the DIRECTORY names while the shopper who
  // types this address is served by the store the OVERRIDE names. The clean urls warmed belong to nobody.
  cold(
    'the addresses',
    `read.store.by_host says ${originAuthority} → ${warmedAtRoot}, but ${rootFrom} serves ${servedAtRoot} ` +
      'there — and the FRONT obeys the override (resolve-store.ts checks it before it asks the port). So the ' +
      `clean URLs this run warmed are ${warmedAtRoot}'s, at an address that answers with ${servedAtRoot}. ` +
      'One of the two has to move: claim the origin on the store the box really serves, or drop the override.',
  );
} else if (warmedAtRoot) {
  noted(
    'the addresses',
    `read.store.by_host says ${originAuthority} → ${warmedAtRoot}, so that store is warmed at the ROOT (clean URLs) and the others under /s/<id>`,
  );
} else if (servedAtRoot) {
  cold(
    'the addresses',
    `${originAuthority} is served by ${servedAtRoot} (${rootFrom}) and read.store.by_host claims NO store for ` +
      'it, so every store below was warmed path-scoped (/s/<id>/…) — including that one. A shopper typing ' +
      `this address reaches ${servedAtRoot} at the ROOT, and those pages are a DIFFERENT set of route-cache ` +
      'entries: THIS RUN DID NOT WARM THEM. The warmer asks the port and the override never reaches it ' +
      '(apps/storefront/src/lib/warm/targets.ts), and its door takes no root-store parameter — what closes ' +
      'this is the store claiming the origin in the directory, which is STEP 6b of the birth ' +
      '(bin/store-host.mjs, `tenant.store.update` → host). Reaching this line means that step did not take ' +
      'on this box: re-run it, and read what it says.',
  );
} else if (rootDeclared) {
  noted(
    'the addresses',
    `${originAuthority} is served by ${rootDeclared} (${rootFrom}), which is not one of ${tenant}'s stores — ` +
      'so path-scoped (/s/<id>/…) really is the address a shopper receives for every store below.',
  );
} else if (declaration || rootFlag) {
  noted(
    'the addresses',
    `no store claims ${originAuthority}: read.store.by_host answers 404 and ${rootFrom} names none either, ` +
      'so path-scoped (/s/<id>/…) is the address a shopper receives and it is what was warmed.',
  );
} else {
  // ★★★ THE VACUUM, AND IT IS THE ONE THIS LINE USED TO FALL INTO SILENTLY: not knowing which tree the
  //     shopper reaches is not the same as knowing there is only one. Said out loud, and it costs the
  //     verdict its «warm» — a run that cannot tell may have warmed pages nobody opens.
  cold(
    'the addresses',
    `this run does not know which store this box serves at the root of ${originAuthority} — ${blindWhy}. ` +
      'read.store.by_host claims none, so every store below was warmed path-scoped (/s/<id>/…); if this box ' +
      'serves one of them at the root instead, those pages are a different set of route-cache entries and ' +
      'were NOT warmed. Point this run at the box\'s own declaration with --env, or name the store with ' +
      '--root-store <id>.',
  );
}

// ── 3 · the run ──────────────────────────────────────────────────────────────────────────────────────────
const headers = { 'x-revalidate-secret': secret };
/** The run cannot even begin. Still the whole truth on the screen — and still not an exit code. */
const stop = (label, detail) => {
  cold(label, detail);
  finish();
};

/**
 * One warm run, from POST to settled — under `maxDurationMs`, or under the VITRINE's own default when that
 * is `null`. Returns the last snapshot the poll saw; a run still `running` when `waitMs` expires comes back
 * as it is, because a birth may not hang on a poll.
 */
const warmRun = async (maxDurationMs, waitMs) => {
  const params = new URLSearchParams();
  for (const s of toWarm) params.append('store', s.id);
  params.set('depth', WARM.depth ?? 'products');
  if (WARM.products !== undefined) params.set('products', String(WARM.products));
  // ★ The endpoint is TOLD the ceiling as well as this script grading it, so the run's own `reasons` name the
  //   breach in the box's words rather than only in ours.
  if (thresholdMs !== null) params.set('threshold_ms', String(thresholdMs));
  if (maxDurationMs !== null) params.set('max_duration_ms', String(maxDurationMs));

  let started;
  try {
    started = await fetch(`${api}/api/warm?${params}`, { method: 'POST', headers });
  } catch (error) {
    wrongQuestion(`the vitrine's warmer could not be reached at ${api}/api/warm: ${error.message}`);
  }

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
    // Not an error: single-flight, and the caller gets the flying run. It is said out loud because the
    // numbers below then belong to a run THIS script did not start, over a plan — and under a CEILING — it
    // did not choose.
    noted('the run', `one was already flying (${startedBody.run?.id ?? '?'}) — the numbers below are ITS, not this call's`);
  }

  const runId = startedBody.run?.id;
  const until = Date.now() + waitMs;
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
  return run;
};

// ── ★★★ 3b · THE PRAZO DERIVES FROM THE PLAN ────────────────────────────────────────────────────────────
//
// ⛔ THE DEFECT, MEASURED ON FOUR BIRTHS (three in the 05/09 notebook, again on 07/09). The plan of this box
// is not a page count: ~420 pages plus the ~20 400 IMAGE derivatives those pages declare in their `srcset`.
// `planned=20822 warmed=4964`, `15865 urls were never visited` (05/09, and the birth of 07/09 was cut the
// same way), EVERY RUN — because the run was cut by a ceiling of 900 000 ms that has nothing to do with this
// box's plan. ⚠️ The 07/09 note in the pack brief reads `planned=20738 · warmed=4964 · 7700 never visited`;
// that triple does not add up (20738 − 4964 is ~15 800, not 7 700) and the bench could not be re-measured
// from this slice, so the reconcilable pair above is the one cited here. ★ A STEP THAT IS ALWAYS RED IS A STEP
// PEOPLE LEARN TO SKIP, and then it is worth nothing on the day it is right.
//
// ⚠️ AND THIS FILE USED TO SAY THE BOX "CANNOT RAISE" THAT CEILING. That was FALSE, and checking it is what
// this slice did first: `DEFAULT_MAX_DURATION_MS` (`apps/storefront/src/lib/warm/warm.ts:51`) is a DEFAULT,
// and `/api/warm?max_duration_ms=` overrides it — `apps/storefront/src/app/api/warm/route.ts:183`. The
// product had always exposed exactly what this box needed. What was missing was a number to send.
//
// ★★ AND THE NUMBER IS DERIVED, NEVER CHOSEN (Renan, 07/09: *"deriva do plano"*). A bigger constant is the
// same trap one house further along: it fits today's catalogue and lies again the day the catalogue grows,
// silently, in the direction of "never visited". So:
//
//     ceiling = (urls the run PLANNED + the urls its verify pass revisits) × (ms per url it MEASURED)
//
// Both factors come from the run that was cut — the plan it enumerated from the port, and the wall clock it
// spent divided by the urls it actually warmed. Nothing here is a constant, which is why a plan 2× bigger
// gets a ceiling 2× bigger with no edit anywhere.
//
// ── WHY THE FIRST RUN STILL USES THE PRODUCT'S DEFAULT, and it is not an oversight ───────────────────────
// The plan CANNOT be known before the run: the pages come from the port's enumeration and the images come
// from the BYTES those pages serve (`imageUrlsFrom` reads each `srcset`), so nothing outside the run can
// count them. A box that guessed would be inventing the very number this slice removes. So the first run is
// the OBSERVATION — it runs under the product's own default, which is not a promise but a first probe — and
// the second run is this box correcting it with what the first one measured. On a box whose plan already
// fits, the first run is not cut and there IS no second: the cost is paid only where the defect is.
//
// ⚠️ ONE derived re-run, not a loop. If the plan grew again under the bigger ceiling (a run cut inside the
// PAGES pass never sees the images those pages would have declared, so its `planned` is a FLOOR), that is
// said with both numbers rather than chased — a step that keeps re-running until it fits has no bound at all.
//
// 📌 WHAT THIS DOES **NOT** REPAIR, said plainly: the FALSE red (`failed=189`/`failed=198` on two births, and
// the same urls answering 200 on the idle box minutes later — the load the warmer imposes on a box still
// settling). Nothing here treats that. The only effect is incidental and is not claimed as a fix: the
// derived re-run is a SECOND visit, made later, and the report printed is the LAST run's — so a url that
// failed only because of the birth's tail has another chance to answer. A url that is really broken fails
// twice.

/** URLs a settled run never TRIED, across every pass of every store. Non-zero ⇔ a ceiling cut it. */
const cutUrls = (report) =>
  (report?.stores ?? []).reduce(
    (n, s) => n + (s.pages?.skipped ?? 0) + (s.images?.skipped ?? 0) + (s.verify?.skipped ?? 0),
    0,
  );

/**
 * What the observation run measured, or `null` when it measured nothing to derive from.
 *
 * `plan` counts the verify pass because the ceiling does: `report.planned` is the FETCHING plan (pages +
 * images) and the second visit revisits every page under the same deadline. Leaving it out would derive a
 * ceiling that cuts the last pass of every run.
 */
const measure = (run) => {
  const report = run?.report;
  if (!report) return null;
  const elapsed = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  const verifyUrls = (report.stores ?? []).reduce((n, s) => n + (s.verify ? (s.pages?.planned ?? 0) : 0), 0);
  const plan = (report.planned ?? 0) + verifyUrls;
  const warmed = report.warmed ?? 0;
  return {
    skipped: cutUrls(report),
    planned: report.planned ?? 0,
    plan,
    warmed,
    elapsed,
    // ⚠️ GUARDED, because both of these are real: a run cut before it warmed a single url (`warmed = 0`) and
    //    a clock that did not move. Dividing there produces `Infinity`/`NaN`, and this step would then put
    //    that in a query string and call it a derivation.
    msPerUrl: warmed > 0 && Number.isFinite(elapsed) && elapsed > 0 ? elapsed / warmed : null,
  };
};

const FIRST_WAIT_MS = 20 * 60_000;
/** The poll always outlasts the ceiling: the ceiling bounds the FETCHING, and the enumeration is outside it.
 *  The third is the ratio this file already carried (20 min of waiting for a 15-minute ceiling). */
const waitFor = (ceilingMs) => deadlineArg ?? Math.ceil((ceilingMs * 4) / 3);

let run = await warmRun(null, deadlineArg ?? FIRST_WAIT_MS);
const observed = measure(run);

if (observed && observed.skipped > 0) {
  const cut =
    `the run was CUT: ${observed.skipped} url(s) were never TRIED. It warmed ${observed.warmed} url(s) in ` +
    `${observed.elapsed}ms` +
    (observed.msPerUrl === null
      ? ' and warmed no url under a clock that moved, so there is NO OBSERVED COST to derive a ceiling from'
      : ` (${observed.msPerUrl.toFixed(1)} ms/url), and the plan is ${observed.plan} url(s) — ` +
        `${Math.ceil(observed.plan * observed.msPerUrl)}ms at that cost`);
  if (observed.msPerUrl === null) {
    noted('the ceiling', `${cut}. Nothing was re-run; read the ✗/⚠ lines for why nothing answered.`);
  } else if (noDerive) {
    noted('the ceiling', `${cut}. \`--no-derive\` was given, so the ceiling was NOT derived and the run stands as it is.`);
  } else {
    const ceiling = Math.ceil(observed.plan * observed.msPerUrl);
    noted('the ceiling', `${cut}. ↻ re-running under a ceiling DERIVED from that plan: ${ceiling}ms.`);
    run = await warmRun(ceiling, waitFor(ceiling));
    const again = measure(run);
    if (again && again.skipped > 0) {
      noted(
        'the ceiling',
        `the derived run was cut TOO: ${again.skipped} url(s) never tried under ${ceiling}ms. The plan the ` +
          `first run could see was ${observed.plan} url(s) and this one enumerated ${again.plan} — a run cut ` +
          'inside the PAGES pass never sees the images those pages would have declared, so the first number ' +
          'was a floor. This step derives ONCE and reports; it does not chase.',
      );
    }
  }
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
    `still running after this step's deadline — ${p.warmed ?? 0} warmed, ` +
      `${p.failed ?? 0} failed of ${p.planned ?? 0} planned so far. A birth may not hang on a poll; the run ` +
      `itself carries on and \`GET ${api}/api/warm\` still answers for it.`,
  );
} else if (run.state === 'failed') {
  // No report at all is a DIFFERENT answer from "warmed nothing", and the two must never render the same.
  cold('the run', `could not be planned, so nothing was measured: ${run.error ?? 'no reason given'}`);
} else {
  const r = run.report ?? {};
  const line = `planned=${r.planned ?? 0} warmed=${r.warmed ?? 0} failed=${r.failed ?? 0} p95=${r.p95 ?? 0}ms (${r.p95Pass ?? '?'} pass) · ${names}`;
  if ((r.planned ?? 0) === 0) {
    // ⚠️ THE VACUUM, AND IT WAS GREEN UNTIL pk21. A run that finished `ok` having planned NOTHING printed
    //    `✓ the stores — planned=0 warmed=0` and `VERDICT: warm`, exit 0 — a box that warmed nothing reading
    //    exactly like a box that warmed everything. It is not a hypothetical shape: the vitrine answers it
    //    whenever no store claims the origin and none was named, and it is also what any derivation here
    //    would divide by. An empty plan is a REPORT ABOUT NOTHING, and it has to say so.
    cold(
      'the stores',
      `the run finished having planned NO url at all (${line}). ${toWarm.length} store(s) were named to the ` +
        'warmer and it enumerated nothing, so NOTHING about this box was warmed and nothing about it was ' +
        'measured — read this as "the warmer could not build a plan", never as "warm".',
    );
  } else if (run.state === 'ok') ok('the stores', line);
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
