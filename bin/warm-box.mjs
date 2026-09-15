#!/usr/bin/env node
// ★★ THE LAST STEP OF A BIRTH: THE BOX IS NOT DONE UNTIL IT IS WARM, AND IT SAYS SO WITH NUMBERS.
//
//   FORGE_OPERATOR_TOKEN=… FORGE_REVALIDATE_SECRET=… node bin/warm-box.mjs --tenant forgeco --api http://localhost:8200
//     [--env ./.env]            the declaration this box is reborn from — how the run learns which store it
//                               serves at the ROOT of that origin (§2b). Default: this repository's `.env`.
//     [--root-store sto_…]      the same answer, named by hand, for a box whose `.env` is not readable here.
//                               The URL inventory's flag, same name and same meaning.
//
// ── WHY WARMING IS PART OF "DONE" AND NOT A COURTESY ─────────────────────────────────────────────────────
//
// ★ THE ARGUMENT IS COMMERCIAL: this box is evaluated, performance included, and a box that fails that kind
// of look costs the sale. A box handed over cold makes the FIRST VISITOR pay for every
// route cache, ISR entry and image derivative this box could have filled by itself in the minutes nobody was
// watching — and on this box that first visitor is whoever is evaluating it. So warming still runs at the end
// of every birth, and it still says everything it learned.
//
// ── ★★ AND WHY IT REPORTS RATHER THAN GRADES (warmth was demoted to a report on 05/09) ──────────────────
//
// ★ THE ARGUMENT, AND IT IS THE WHOLE REASON THIS STEP CHANGED SHAPE: A STEP THAT IS ALWAYS RED IS A STEP
// PEOPLE LEARN TO SKIP — and then it stops being worth anything on the day it is right.
//
// Three measurements, all of them from real births on the promoted bench, say this one was always red:
//
//   1 · RED BY CONSTRUCTION — ★ AND THIS ONE IS FIXED, TWICE (pk21/d2, then pk35/d5; see §3b). The plan is
//       not made of pages: ~420 pages plus ~20 400 IMAGE derivatives found in each HTML's `srcset` —
//       `planned=20822`, `warmed=4964`, `15865 urls were never visited`. What cut it was the VITRINE's own
//       15-minute default, `DEFAULT_MAX_DURATION_MS` in `apps/storefront/src/lib/warm/warm.ts`. pk21 raised
//       that clock from here, by deriving a ceiling from the plan the cut run had just measured — the
//       ceiling DERIVES FROM THE PLAN — and sending it as `/api/warm?max_duration_ms=`.
//       ⛔ AND THAT DERIVED CLOCK IS WHAT CUT THE OUTLET ON 2026-09-13: `4 034 947 ms`, with `failed=0` and
//       `busy=0`, over a box that was filling its derivative cache at ~330 images/min. A clock that grows
//       with the plan is still a clock pretending to know when a healthy box should be done — the shape this
//       house forbade on 2026-09-11 (*a ceiling does not carry a number of SIZE inside it*).
//       ★ `pk35/p1` MOVED THE JUDGE INTO THE PRODUCT: a window of NON-progress (`lib/warm/limit.ts`), with
//       `max_duration_ms` demoted to an optional safety net nobody buys by default, and a new
//       `report.stoppedBecause` (`finished` · `no-progress` · `safety-net`) saying which limit fired. ⇒ THIS
//       STEP STOPPED SENDING A CEILING — except to an image that publishes no `stoppedBecause`, which is an
//       image that cannot bound itself by progress and is therefore on a clock either way. See §3b.
//       The `--deadline-ms` below is still a different number: how long THIS SCRIPT waits for an answer.
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
const token = process.env.FORGE_OPERATOR_TOKEN ?? '';
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
if (!token) wrongQuestion('no FORGE_OPERATOR_TOKEN: `read.internal.stores` is the operator face and needs this tenant\'s own token.');
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
      'forgeco → forge-operator-token ($FORGE_OPERATOR_TOKEN), forgecafe → forge-operator-token-forgecafe ' +
      '($FORGE_OPERATOR_TOKEN_FORGECAFE). `source env-source.sh` exports the FIRST tenant\'s as the unsuffixed ' +
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
      `A GATE ("${filler}") STANDS IN FRONT OF THIS STORE. A warmer that does not carry the shopper's ` +
        'dismissal warms the GATE and not the shop: every visit answers 200 from the same tiny page, and a ' +
        'report counting visits cannot tell that apart from a warm store. ⚠️ THIS SCRIPT CANNOT SEE INSIDE ' +
        'THE STOREFRONT CONTAINER, so it does not claim which one happened — it says where to look. The ' +
        'fetcher is the product\'s (apps/storefront/src/lib/warm/run.ts) and it has carried the dismissal ' +
        'since pk33; the release this box is pinned to is in forge.lock. ★ AND THE NUMBERS BELOW ANSWER IT: ' +
        'a gated store that warmed the GATE finds ZERO images, because the interstitial has no next/image in ' +
        'it — so `images: 0 visited` on this store means the dismissal did not travel, whatever the page ' +
        'count says. Step 14-bis is what proves the gate is really there.',
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
 * One warm run, from POST to settled — under `maxDurationMs`, or under whatever the VITRINE bounds itself
 * with when that is `null` (since pk35/p1 a window of NON-progress; on an older image its own 900 000 ms
 * ceiling). Returns the last snapshot the poll saw; a run still `running` when `waitMs` expires comes back
 * as it is, because a birth may not hang on a poll.
 */
const warmRun = async (maxDurationMs, waitMs) => {
  const params = new URLSearchParams();
  for (const s of toWarm) params.append('store', s.id);
  params.set('depth', WARM.depth ?? 'products');
  if (WARM.products !== undefined) params.set('products', String(WARM.products));
  // ★ The endpoint is TOLD the threshold as well as this script grading it, so the run's own `reasons` name
  //   the breach in the box's words rather than only in ours.
  if (thresholdMs !== null) params.set('threshold_ms', String(thresholdMs));
  // ⛔ pk35/d5 — `maxDurationMs` is `null` on every call this step makes to a front that can bound itself by
  //   PROGRESS, and the parameter is then absent rather than zero: since p1 an absent `max_duration_ms` means
  //   "no safety net", and a `0` would mean the smallest net that can be honoured. See §3b for the one image
  //   that still gets a number.
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
  // ★ pk35, o corte — E ESSA RESSALVA NÃO PODE MORRER AQUI. Medido no nascimento de 14/09: o passo do SEGUNDO
  // tenant encontrou a corrida do primeiro ainda voando, disse esta linha honestamente, e o VEREDITO três
  // linhas abaixo publicou `13002 de 20418 planned` como se fosse do café — um tenant de ~15 páginas. A nota
  // existia e o resumo a esquecia, que é a forma mais fina do defeito que esta casa persegue: não um sinal que
  // mente, mas um sinal honesto que o resumo joga fora. ⇒ a posse viaja com a corrida.
  const adopted = startedBody.started === false;

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
  return run && { ...run, adopted };
};

// ── ★★★ 3b · THE CLOCK IS NOT THE JUDGE ANY MORE, AND THIS STEP STOPPED BUYING ONE ──────────────────────
//
// ⛔⛔ READ THIS FIRST, BECAUSE THE SECTION BELOW IS HISTORY NOW. pk21 taught this step to DERIVE a ceiling
// and send it; on 2026-09-13 that derived number came out `4 034 947 ms` and cut the `outlet` at
// `879/1 224` images with `failed=0` and `busy=0` — a box that was working, filling its derivative cache at
// ~330 images/min. ★ THE DERIVATION FIXED THE SYMPTOM AND KEPT THE SHAPE: a ceiling that carries a number of
// SIZE inside it, forbidden here since 2026-09-11. `pk35/p1` replaced the judge in the PRODUCT with a window
// of NON-progress (`apps/storefront/src/lib/warm/limit.ts`) and demoted `max_duration_ms` to an optional
// safety net, absent unless a caller with a deadline of its own buys one.
//
// ⇒ ★★★ THIS STEP SENDS NO `max_duration_ms` — WITH ONE MEASURED EXCEPTION, AND IT IS NOT A HEDGE.
// This box pins its fronts BY DIGEST. The storefront `forge.lock` pins today (`v0.3.0-pre.e8fc602d4`, the
// commit before p1) compiles `max_duration_ms")??9e5` into its warm route and carries the string
// `stoppedBecause` nowhere at all — MEASURED on the bench `forge-preseed`, 2026-09-13. On that image the
// clock is the judge whether this step likes it or not, and the derived ceiling is the only thing standing
// between the birth and `15865 urls were never visited`. So the derivation survives EXACTLY where the run
// cannot say how it stopped, and the report says that is what it is doing and why.
// ⚠️ AND WHERE IT SURVIVES IT SURVIVES AS A **NET**, `NET_HEADROOM`× the work it measured — because the
// judge-sized version of that number is precisely what cut the outlet: `4 034 947 ms` against a final plan
// that needed 4 043 880–4 493 200 ms at its own measured cost. See `NET_HEADROOM`.
// ⛔ THE DISCRIMINATOR IS THE FIELD, NEVER `skipped`: same plan, same cut, and a run that publishes
// `no-progress` gets no ceiling at all. `bin/warm-box.test.mjs` runs both halves of that control.
//
// ──────────────────────── what follows is pk21's reasoning, kept because the exception above still runs it
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
// ⚠️ AND THIS FILE USED TO SAY THE BOX "CANNOT RAISE" THAT CEILING. That was FALSE: `DEFAULT_MAX_DURATION_MS`
// (`apps/storefront/src/lib/warm/warm.ts`) was a DEFAULT, and `/api/warm?max_duration_ms=` overrode it
// (`apps/storefront/src/app/api/warm/route.ts`, the `parse` block). The product had always exposed exactly
// what this box needed. What was missing was a number to send. ⚠️ Since p1 the product ships NO such default
// at all, so on a rebaked front there is nothing to raise and nothing to send.
//
// ★★ AND THE NUMBER IS DERIVED, NEVER CHOSEN — it derives from the PLAN. A bigger constant is the
// same trap one house further along: it fits today's catalogue and lies again the day the catalogue grows,
// silently, in the direction of "never visited". So:
//
//     ceiling = (urls the run PLANNED + the urls its verify pass revisits) × (ms per url it MEASURED)
//
// Both factors come from the run that was cut — the plan it enumerated from the port, and the wall clock it
// spent divided by the urls it actually warmed. Nothing here is a constant, which is why a plan 2× bigger
// gets a ceiling 2× bigger with no edit anywhere.
//
// ── WHY THE FIRST RUN SENDS NOTHING, and it is not an oversight ─────────────────────────────────────────
// The plan CANNOT be known before the run: the pages come from the port's enumeration and the images come
// from the BYTES those pages serve (`imageUrlsFrom` reads each `srcset`), so nothing outside the run can
// count them. A box that guessed would be inventing the very number this slice removes. So the first run is
// the OBSERVATION — it runs under whatever the product bounds itself with, which since p1 is the no-progress
// window and on an older image is that image's own 900 000 ms — and the second run is this box correcting a
// PRE-p1 image with what the first one measured. On a box whose plan already fits, and on every rebaked
// front, the first run is not cut and there IS no second.
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

// ── ★★★ pk35/d5 · HOW THE RUN STOPPED IS THE RUN'S OWN WORD, AND THERE ARE FOUR OF THEM ─────────────────
//
// `pk35/p1` publishes `report.stoppedBecause`: `finished` · `no-progress` · `safety-net`. Before it, a box
// that had GONE QUIET and a box merely bigger than somebody's clock produced the same sentence — and those
// are opposite instructions to whoever reads the report ("your shop stopped answering" against "the number
// I handed the run was too small").
//
// ⛔ AND THE FOURTH READING IS ABSENCE, WHICH IS NOT `finished`. This box pins its fronts BY DIGEST, so the
// image that answers can predate the field entirely — MEASURED on the bench of 2026-09-13, on the storefront
// `forge.lock` pins today: its compiled warm route carries `max_duration_ms")??9e5` and the string
// `stoppedBecause` appears nowhere in it. `stoppedBecause ?? 'finished'` would render "nobody said" and "it
// finished" identically, which is the same rule the `busy` half of this file already obeys.

/** The word, verbatim, or `null` when the image publishes none. ⛔ Never defaulted — see above. */
const stopWordOf = (report) =>
  typeof report?.stoppedBecause === 'string' && report.stoppedBecause ? report.stoppedBecause : null;

/**
 * Why a pass has urls it never TRIED, in terms of the run's own word.
 *
 * ⚠️ THIS SENTENCE USED TO BE A CONSTANT that blamed `DEFAULT_MAX_DURATION_MS` on every cut run. Since p1
 * that is a HALF-TRUTH at best: the clock is no longer the product's judge, so a cut can mean the box went
 * quiet — and printing the clock's words over a quiet box is a signal asserting about the WORLD what it only
 * knows about ITSELF.
 */
const neverVisitedWhy = (word) => {
  if (word === 'no-progress') {
    return 'the box STOPPED ANSWERING before the run reached them — the run\'s own word is `no-progress`, and ' +
      'no clock was involved. A bigger ceiling buys nothing here; find what stopped answering.';
  }
  if (word === 'safety-net') {
    return 'a SAFETY NET the run was handed fired first, while the box was still answering — the run\'s own ' +
      'word is `safety-net`. The store is not smaller than its plan; the clock was too short.';
  }
  if (word === 'finished') {
    return 'the run says it FINISHED, which CONTRADICTS this column: `finished` means every url of the plan ' +
      'was attempted. One of the two numbers is wrong, and this step is not guessing which.';
  }
  if (word !== null) {
    return `the run stopped because \`${word}\` — a word this step does not know, so it names it rather than ` +
      'rounding it to one it does.';
  }
  return 'the run\'s own ceiling arrived first. This image publishes no `stoppedBecause` (it predates ' +
    'pk35/p1), and the only run-wide ceiling an image of that age has is the vitrine\'s ' +
    'DEFAULT_MAX_DURATION_MS — never this script\'s --deadline-ms.';
};

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

/**
 * ★★★ pk35/d5 — HOW FAR THE SURVIVING CEILING CLEARS THE WORK IT MEASURED, so it is a NET and not a JUDGE.
 *
 * ⛔ MEASURED, AND IT IS WHY THIS NUMBER EXISTS AT ALL. On 2026-09-13 this step derived `4 034 947 ms` —
 * exactly the work the cut run's plan implied — and the derived run WAS CUT TOO: the final report said
 * `planned=22047`, and at the 180–200 ms/url that run really cost, the plan plus its verify pass needed
 * 4 043 880–4 493 200 ms. The derivation was short by 0.2–11%. ★ IT COULD NOT HAVE BEEN OTHERWISE: this file
 * already says the observed plan is a FLOOR (a run cut inside the PAGES pass never sees the images those
 * pages would have declared), and a number sized to a floor is a number that decides.
 *
 * ⚠️ THIS IS A MULTIPLE OF A MEASUREMENT, NEVER A NUMBER OF SIZE. It carries no idea of how big a catalogue
 * is: a plan ten times larger gets a net ten times larger, with no edit. What it buys is that the clock can
 * no longer be the REASON a run stops while the box is working — which is the whole rule
 * (*limit by progress; the clock is a net, never a judge*), honoured as far as an image that cannot bound
 * itself by progress allows.
 *
 * ⛔ AND IT IS NOT WHAT KEEPS THE RUN FINITE. That guarantee already exists elsewhere and was checked first:
 * the plan is finite, every request is bounded by the vitrine's `timeoutMs`, and this script's own poll
 * gives up at `waitFor(ceiling)` — a birth may not hang on a poll.
 */
const NET_HEADROOM = 10;

const FIRST_WAIT_MS = 20 * 60_000;
/** The poll always outlasts the ceiling: the ceiling bounds the FETCHING, and the enumeration is outside it.
 *  The third is the ratio this file already carried (20 min of waiting for a 15-minute ceiling). */
const waitFor = (ceilingMs) => deadlineArg ?? Math.ceil((ceilingMs * 4) / 3);

let run = await warmRun(null, deadlineArg ?? FIRST_WAIT_MS);
const observed = measure(run);
/** How the FIRST run says it stopped. `null` ⇒ the image cannot say, and that decides everything below. */
const stopWord = stopWordOf(run?.report);

if (observed && observed.skipped > 0 && stopWord !== null) {
  // ★★★ THE RUN CAN SAY, SO THIS STEP DOES NOT INVENT A CLOCK. Each of the words is a different instruction,
  //     and none of them is answered by a bigger ceiling: `no-progress` says the box went quiet (a clock
  //     would only let it stay quiet for longer), `safety-net` says somebody ELSE's clock fired on a box that
  //     was working, and `finished` beside unvisited urls is two numbers that cannot both be true.
  const facts =
    `the run was CUT: ${observed.skipped} url(s) were never TRIED. It warmed ${observed.warmed} url(s) in ` +
    `${observed.elapsed}ms` +
    (observed.msPerUrl === null ? '' : ` (${observed.msPerUrl.toFixed(1)} ms/url)`) +
    `, over a plan of ${observed.plan} url(s)`;
  if (stopWord === 'no-progress') {
    noted(
      'how it stopped',
      `${facts}. The run says it STOPPED MAKING PROGRESS: the box WENT QUIET — nothing answered for the ` +
        'whole no-progress window. ⛔ nothing was re-run, and nothing should be: a bigger clock buys ' +
        'nothing from a box that is not answering. Read the ✗/⚠ lines for what stopped answering.',
    );
  } else if (stopWord === 'safety-net') {
    noted(
      'how it stopped',
      `${facts}. The run says a SAFETY NET fired WHILE THE BOX WAS STILL WORKING — the store is not ` +
        'smaller than its plan. ⛔ This step sends no ceiling of its own (pk35/d5), so that clock is ' +
        'somebody else\'s: a `--max-duration-ms` typed by hand, or a run already flying that this call did ' +
        'not start (the line above names that case). Nothing was re-run; raise or drop THAT clock.',
    );
  } else if (stopWord === 'finished') {
    noted(
      'how it stopped',
      `${facts}. ⛔ AND THE RUN SAYS IT \`finished\`, WHICH CONTRADICTS THAT COUNT: \`finished\` means ` +
        'every url of the plan was attempted, so one of the two numbers is wrong. This step reports both ' +
        'rather than picking the one it prefers — a signal that cannot tell must never choose.',
    );
  } else {
    noted(
      'how it stopped',
      `${facts}. The run stopped because \`${stopWord}\` — a word this step does not know, so it is ` +
        'printed as itself and nothing is derived from it. Whoever added the word owns the sentence.',
    );
  }
} else if (observed && observed.skipped > 0) {
  // ── ⚠️ THE PRE-p1 IMAGE, AND THIS IS THE ONE PLACE THE DERIVED CLOCK SURVIVES ─────────────────────────
  // An image that cannot say how it stopped is an image that CANNOT BOUND ITSELF BY PROGRESS: its only
  // run-wide limit is `DEFAULT_MAX_DURATION_MS`, and that clock is bought whether this step sends a number
  // or not. Sending a derived one is strictly better than letting the 900 000 ms default cut the birth.
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
    const work = Math.ceil(observed.plan * observed.msPerUrl);
    const ceiling = work * NET_HEADROOM;
    noted(
      'the ceiling',
      `${cut}. ↻ re-running under a SAFETY NET of ${ceiling}ms — ${NET_HEADROOM}× the ${work}ms of work ` +
        'that plan measures, because the plan is a FLOOR and a net sized like the work is a judge. ⚠️ THIS IS ' +
        'COMPATIBILITY, NOT THIS STEP\'S OPINION OF HOW LONG A HEALTHY BOX SHOULD TAKE: the vitrine that ' +
        'answered publishes no `stoppedBecause`, so it predates pk35/p1 and CANNOT BOUND ITSELF BY ' +
        'PROGRESS — its only run-wide limit is a clock, and a derived one is larger than the 900 000 ms ' +
        'it would otherwise use. Rebake the fronts and this step sends no ceiling at all.',
    );
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
// url that answered badly, `skipped` is a url the run stopped before it reached — but this file used to fold
// them into one word and left the difference to a sentence in `reasons`. They are different repairs: one is a
// page, the other is whatever stopped the run. ⚠️ AND WHICH OF THOSE IT WAS IS THE RUN'S WORD, NOT AN
// INFERENCE FROM `skipped`: since pk35/p1 a cut can mean the box went quiet, and printing the clock's
// sentence over a quiet box is the same defect one field along (see `neverVisitedWhy`).

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

// ── ★★★ pk34/d2 · DOES THIS BOX SERVE THAT HOST? THE STEP ASKS, IT NO LONGER ASSUMES ────────────────────
//
// ⛔ THE DEFECT, MEASURED ON THE BENCH `forge-preseed` ON 2026-09-12, in EVERY store and EVERY pass:
//
//     images on hosts this box does not serve: $FORGE_TAILNET_HOST
//
// and that host is THE BOX'S OWN. Two keys of its `FORGE_STORE_HOSTS`, the address `bin/verify-config.mjs`
// calls `settled`, and a 200 from `read.store.by_host` for it (asked from inside the kernel container).
// ⇒ A LINE THAT ACCUSES, ON EVERY RUN, FALSELY — which is worse than a line that stays quiet, because a
// reader who learns to ignore one line has learned to ignore the report.
//
// ★ WHAT WAS WRONG WAS THE SENTENCE, NOT THE FIELD. `images.foreignHosts` is the VITRINE's list and it means
// exactly one thing: hosts whose image addresses the vitrine's image pass did not fetch. The vitrine has
// never been told which hosts this box answers on, so "this box does not serve them" was this step asserting
// about the WORLD what the field only knows about ITSELF. That claim is now GRADED before it is printed.
//
// ⚠️ AND THE MEASUREMENT KILLED THE OBVIOUS EXPLANATION. It is NOT `host:port` against a bare `host`.
// Measured over the bytes the bench served (`/`, `/tenis`, `/b/taft`, past the gate, one absolute image src
// each): the addresses are `https://$FORGE_TAILNET_HOST/v1/media/…`, the KERNEL's master url on the
// box's OWN origin. The vitrine's classifier compared origins first and matched — then it checked the PATH
// against its three image doors, `/v1/media/` is none of them, and the fall-through named the HOST for a
// problem that is about the DOOR. Same host, different door.
//
// ★★ AND `pk34/p5` CLOSED THAT AT THE SOURCE — the past tense above is that change. The vitrine now answers
// the origin question first and once, so `foreignHosts` carries only somebody else's hosts and OUR own
// doorless addresses come back in `unwarmablePaths`, printed by its own sentence further down.
// ⛔ THE GRADING BELOW STAYS ANYWAY, and it is not belt-and-braces: this box pins its fronts BY DIGEST, so
// the image that answers can be OLDER than p5 and still report this box's own host as foreign. On that
// image this block is the only thing standing between the operator and the false accusation.
//
// ── WHICH SOURCE ANSWERS «THIS BOX SERVES H», AND WHY IT TAKES BOTH ─────────────────────────────────────
// ⛔ THE TWO DISAGREE ON THE REAL BOX, measured the same day, asked of the same bench:
//
//     FORGE_STORE_HOSTS        8 keys: localhost · localhost:8200 · 127.0.0.1 · 127.0.0.1:8200 ·
//                              $FORGE_TAILNET_HOST and its short name, each bare and :8200
//     read.store.by_host       200 for TWO of them (the tailnet name, bare and :8200); 404 for the other six
//
// Neither is the whole answer. The OVERRIDE is what the fronts obey — `resolve-store.ts` checks it before it
// asks the port — so a host in it IS served, whatever the directory says; and the DIRECTORY is what the
// warmer itself resolved for this origin (step 6b claims exactly one host, which is why the other six are
// 404). A step that trusted only the directory would call `localhost` foreign on this very bench. So the
// question is put to BOTH, and the line names whichever one answered.
//
// ⛔ ANCHORED, HOST BY HOST, NEVER `includes()` ON A JOINED STRING. This house has paid three times this
// month for an unanchored match (`/jq/` inside `/tmp/…zSYjqw`, `die` inside `mens-calvin-klein-brodie-2`,
// `/demo/` inside `demorou`), and `127.0.0.1` is a substring of `127.0.0.10`. The comparison is `storeAtRoot`,
// which is the KERNEL's own rule spelled once (exact authority, then the bare host) and is equality on a key.

/**
 * Who says this box serves `host` — every source that answered, or `[]` for none.
 *
 * `[]` is NOT «nobody serves it»: when there is no declaration to read, nothing here can tell the two apart,
 * and `canGradeHosts` below is what keeps the step from turning silence into an accusation.
 */
const servesHost = (host) => {
  const from = [];
  if (declaration && storeAtRoot(declaration, host)) from.push(`FORGE_STORE_HOSTS in ${envPath}`);
  // The port's answer is the one this run already has, for the one host it already asked about — the origin.
  // Asking it again per host would be N reads to re-derive what the override answers for free.
  if (rootByPort) {
    const h = String(host ?? '').toLowerCase();
    const authority = originAuthority.toLowerCase();
    if (h === authority || h === authority.replace(/:\d+$/, '')) from.push('read.store.by_host');
  }
  return from;
};

/** Can this run say «this box does NOT serve H» at all? Only the declaration lists every host it answers on. */
const canGradeHosts = Boolean(declaration);

// ── ★★★ pk34/d2 (reopened) · THE THIRD COLUMN, AND WHY READING ONLY `failed` WOULD NOW LIE ──────────────
//
// ⛔ `pk34/p5` SPLIT OCCUPIED FROM BROKEN IN THE VITRINE. `failed` means only «the box did not answer»; the
// urls the box REFUSED because it is at its read ceiling come back in a new `busy` (and `busyNamedNoTime`,
// which is how many of those named no time to come back). The demo's birth of 2026-09-12 published
// `failed=83` over a shop that had answered "muita gente navegando agora" 83 times — that number is about to
// shrink, correctly. ⇒ A STEP THAT READ ONLY `failed` WOULD THEN PRINT `failed=0` OVER PAGES STILL COLD:
// a false red traded for a FALSE GREEN, which is strictly worse, because nobody investigates a green.
//
// ⚠️ AND ABSENT IS NOT ZERO. This box pins its fronts BY DIGEST, so the image that is up can be older than
// the field and publish no `busy` at all — and that box is exactly the one whose `failed` still swallows the
// refusals. `busy ?? 0` renders the two identically. It is the same rule the host half of this slice already
// obeys: there are three answers, and «I cannot say» is one of them.

/**
 * `busy` as the report published it — a number, or `null` when the answering image does not carry the column.
 *
 * ⛔ Never `?? 0`. See above: "nobody counted" and "none were busy" are different sentences.
 */
const busyOf = (o) => (Number.isFinite(o?.busy) ? o.busy : null);

/** One pass of one store, in the words the pass itself uses. Returns whether it was whole.
 *  `why` is the run's own account of what cut it (`neverVisitedWhy`), passed in rather than assumed here:
 *  since pk35/p1 a pass with unvisited urls is not proof that a clock was involved. */
const passLine = (label, pass, why) => {
  if (!pass) return true;
  const planned = pass.planned ?? 0;
  const done = pass.done ?? 0;
  const failed = pass.failed ?? [];
  const skipped = pass.skipped ?? 0;
  const busy = busyOf(pass);
  const busyColumn = busy === null ? 'BUSY not published by this image' : `${busy} came back BUSY`;
  say(
    `      ${label.padEnd(7)} ${done} of ${planned} answered · ${failed.length} did NOT answer · ` +
      `${busyColumn} · ${skipped} never visited · p95 ${pass.p95 ?? 0}ms`,
  );
  if (failed.length > 0) say(`              did not answer: ${namedFailures(failed)}`);
  if (busy !== null && busy > 0) {
    // ★ TWO NUMBERS BECAUSE THEY ARE TWO INSTRUCTIONS. One says the box's ceiling refuses without telling
    //   anyone when to come back; the other says the run did not have time left to wait out the `Retry-After`
    //   it WAS given. Folding them into one total would name a problem and no action.
    const noTime = pass.busyNamedNoTime ?? 0;
    const tooLong = busy - noTime;
    say(
      `              came back BUSY: ${busy} url(s) were REFUSED, not broken — the box is at its read ceiling, ` +
        `and they are STILL COLD. ${noTime} named no time to come back (no Retry-After, so nothing could wait ` +
        `for them) · ${tooLong} asked for longer than this run had left.`,
    );
  }
  if (skipped > 0) {
    say(`              never visited: ${skipped} url(s) were never TRIED — ${why}`);
  }
  // ⚠️ A pass whose image cannot count busy is not asserted WHOLE — it is a pass this run cannot grade.
  return failed.length === 0 && skipped === 0 && busy === 0;
};

const names = toWarm.map((s) => `${s.handle}=${s.id}`).join(' · ');
if (!run) {
  cold('the run', 'the vitrine answered with no run at all');
} else if (run.state === 'running') {
  const p = run.progress ?? {};
  cold(
    'the run',
    `still running after this step's deadline — ${p.warmed ?? 0} warmed, ` +
      `${p.failed ?? 0} failed, ` +
      `${busyOf(p) === null ? 'busy not published by this image' : `${busyOf(p)} busy`} ` +
      `of ${p.planned ?? 0} planned so far. A birth may not hang on a poll; the run ` +
      `itself carries on and \`GET ${api}/api/warm\` still answers for it.` +
      (run.adopted
        ? ` ⛔ AND THESE NUMBERS ARE NOT THIS TENANT'S: run ${run.id ?? '?'} was already flying when this step ` +
          'asked, and the vitrine keeps ONE run per box, so the plan above is whoever started it. Read it as ' +
          'the BOX still warming, never as this tenant measured.'
        : ''),
  );
} else if (run.state === 'failed') {
  // No report at all is a DIFFERENT answer from "warmed nothing", and the two must never render the same.
  cold('the run', `could not be planned, so nothing was measured: ${run.error ?? 'no reason given'}`);
} else {
  const r = run.report ?? {};
  const runBusy = busyOf(r);
  const busyTotal = `busy=${runBusy === null ? '? (this image does not publish the column)' : runBusy}`;
  // ★★★ pk35/d5 — THE RUN'S OWN WORD, in the totals rather than only in a branch: an operator comparing two
  //     births needs to see that one of them was cut and the other was not without reading further.
  const runStop = stopWordOf(r);
  const stoppedTotal = `stopped=${runStop ?? '? (this image does not publish it)'}`;
  const whyUnvisited = neverVisitedWhy(runStop);
  const line =
    `planned=${r.planned ?? 0} warmed=${r.warmed ?? 0} failed=${r.failed ?? 0} ${busyTotal} ${stoppedTotal} ` +
    `p95=${r.p95 ?? 0}ms (${r.p95Pass ?? '?'} pass) · ${names}`;
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
  } else if (runBusy !== null && runBusy > 0) {
    // ⛔ THIS STEP GRADES THE COLUMN ITSELF, and does not wait for the vitrine's `state` to do it. The run
    //    that produced this branch said `state: ok` and `failed: 0`; a step that trusted those two would
    //    print «warm» over pages the box REFUSED to serve. Busy is not a failure and it is not a success —
    //    those urls are still cold, and the verdict has to be able to say so.
    cold(
      'the stores',
      `${line} — ${runBusy} url(s) came back BUSY: the box REFUSED them at its read ceiling rather than ` +
        'failing, so they are neither broken nor warm — they are STILL COLD. The per-pass lines below say ' +
        'how many named no time to come back. ⚠️ This is not a bug hunt: it is a ceiling, and the warming ' +
        'itself spends the same budget a shopper does.' +
        ((r.reasons ?? []).length ? ` — ${r.reasons.join(' · ')}` : ''),
    );
  } else if (run.state === 'ok') {
    ok('the stores', line);
    if (runBusy === null) {
      // ⚠️ SAID ONCE, AND IT DOES NOT COST THE VERDICT. An image older than pk34/p5 publishes no `busy`, and
      //    on that image a refused url is still counted in `failed` — so nothing is being hidden, it is only
      //    being named with the wrong word. Turning this into a shortfall would make the step red on every
      //    box that has not been rebaked, and a step that is always red is a step people skip.
      noted(
        'the third column',
        'this run CANNOT SAY how many urls came back BUSY: the vitrine image that answered does not publish ' +
          '`busy` (it predates pk34/p5), so a url the box REFUSED is still counted as one that did not ' +
          'answer. Read `failed` above as "did not answer OR was refused". Rebake the fronts to split them.',
      );
    }
    if (runStop === null) {
      // ⚠️ THE SAME RULE, ONE FIELD LATER, AND IT DOES NOT COST THE VERDICT. An image older than pk35/p1
      //    publishes no `stoppedBecause`; `?? 'finished'` would print a green word this run did not earn.
      //    Making it a shortfall would make the step red on every box not yet rebaked, and a step that is
      //    always red is a step people skip.
      noted(
        'how it stopped',
        'this run CANNOT SAY HOW IT STOPPED: the vitrine image that answered does not publish ' +
          '`report.stoppedBecause` (it predates pk35/p1), so «it finished» and «a ceiling cut it» are the ' +
          'same silence here. It also means that image is still bounded by a CLOCK rather than by progress ' +
          '— which is why this step may still have sent it one. Rebake the fronts and both go away.',
      );
    }
  } else cold('the stores', `${line}${(r.reasons ?? []).length ? ` — ${r.reasons.join(' · ')}` : ''}`);

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
    passLine('pages', store.pages, whyUnvisited);
    if (store.images) {
      passLine('images', store.images, whyUnvisited);
      if (store.images.cut) {
        say(`              the image list was CUT at the run's ceiling: ${store.images.declared ?? 0} declared by the HTML`);
      }
      // ★ TWO SENTENCES, because one of them is about SOMEBODY ELSE'S box and the other is about THIS one,
      //   and printing them as one is the defect this slice removes. See «DOES THIS BOX SERVE THAT HOST?».
      const ours = [];
      const theirs = [];
      const ungraded = [];
      for (const host of store.images.foreignHosts ?? []) {
        const from = servesHost(host);
        if (from.length > 0) ours.push(`${host} (${from.join(' and ')})`);
        else if (canGradeHosts) theirs.push(host);
        else ungraded.push(host);
      }
      if (theirs.length > 0) {
        say(`              images on hosts this box does not serve: ${theirs.join(' · ')}`);
      }
      if (ours.length > 0) {
        say(
          `              images left UNWARMED at an address this box DOES serve: ${ours.join(' · ')} — so these ` +
            'are not somebody else\'s CDN, they are this box\'s own images and nothing warmed them. ⚠️ A ' +
            'vitrine of pk34/p5 or later never reports this: it names our own doorless addresses in ' +
            '`unwarmablePaths` instead (the line below). Seeing THIS line means the image that answered ' +
            'predates that split — rebake the fronts, and the same fact arrives as a path rather than as an ' +
            'accusation against this box\'s own host.',
        );
      }
      // ★★★ pk34/p5 ANSWERED THE HALF THIS STEP COULD ONLY DESCRIBE. Until that slice, an address on our OWN
      //     origin that the warmer had no door for fell out of the classifier as a foreign HOST — which is
      //     the false accusation the block above exists to grade. The vitrine now publishes the two facts
      //     apart, so this step relays them apart: a host is somebody else's bytes, a path is ours through a
      //     door that does not exist. ⚠️ The block above STAYS: this box pins its fronts by digest, and an
      //     image older than p5 still reports our own host in `foreignHosts`.
      const unwarmable = store.images.unwarmablePaths ?? [];
      if (unwarmable.length > 0) {
        say(
          `              our OWN addresses the warmer has no door for: ${unwarmable.slice(0, SAMPLE).join(' · ')}` +
            `${unwarmable.length > SAMPLE ? ` · …and ${unwarmable.length - SAMPLE} more` : ''} ` +
            `(${unwarmable.length} in total). Nothing is wrong with the host — the markup reached PAST the ` +
            'media doors, so those images are served full-size and nothing warms them. Measured on this ' +
            "bench 2026-09-12: the shelf banner emitting the kernel's master url `/v1/media/<key>` instead " +
            'of the storefront\'s `/api/media/<key>`.',
        );
      }
      if (ungraded.length > 0) {
        say(
          `              images the warmer left unwarmed, addressed at: ${ungraded.join(' · ')} — this run CANNOT ` +
            `SAY whether this box serves those hosts${blindWhy ? ` (${blindWhy})` : ''}, so it claims neither.`,
        );
      }
    }
    passLine('verify', store.verify, whyUnvisited);
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
