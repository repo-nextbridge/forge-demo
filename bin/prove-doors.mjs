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
//   4. ★ pk22: does the port SAY WHAT THE BOX DECLARED?  (`seed/box.json` states `status` for a store whose
//      front is not the vitrine — the counter, whose front is the totem — and a store that is back on the
//      street with that word still written in the file is a ✗ that names it)
// and it refuses to call a run that graded ZERO doors a green, because that is the shape all of those
// failures decay into.
//
// ★★★ pk33 — AND IT NOW GRADES **BOTH SIDES OF THE GATE'S COOKIE**, which is the half nobody had.
//
// ⛔ THE SILENCE, MEASURED 2026-09-11. `apps/demo-gate` — the demo's front door, the "Loja demo." screen a
// visitor must meet before the shop — was installed by NO step of the birth: not `bin/seed-box.mjs`, not
// `seed/vitrine.mjs`, not `seed/coffee.mjs`, not `seed/outlet.mjs`. The app's own README said "Install the app
// for the tenant", i.e. a hand gesture somebody had to remember, and on the bench nobody had. It had been
// missing for DAYS with every birth green underneath — because NOTHING ANYWHERE VERIFIED THAT THE GATE
// APPEARS. This step opened all sixteen doors and graded the status code and the container: both are identical
// whether the visitor meets the gate or walks straight into the shop, because the gate answers 200 and so does
// the shop.
//
// ★ SO EVERY DOOR IS NOW OPENED TWICE — once WITHOUT the dismissal cookie and once WITH it — and the two
// answers are graded against each other:
//   · without the cookie ⇒ the body must BE the gate (`data-testid="<the extension the port names>"`);
//   · with the cookie    ⇒ the body must be the SHOP, and today's status/front rules are unchanged;
//   · and the two bodies must DIFFER, asserted directly, because a probe that accepts any body on both sides
//     proves only that the process is alive.
// ⇒ the two ways this could go quietly blind are therefore both red by construction: a probe that sent the
// cookie on both sides fails the first rule, one that sent it on neither fails the second.
//
// ★ WHAT IS EXPECTED IS DERIVED FROM THE RULE, NOT FROM A LIST: **every store has a gate** — the shoe shop,
// the outlet, the café and the totem alike — and a store that must NOT is the EXCEPTION and declares itself in
// `seed/box.json` with `gate: false` + the reason. The declaration is graded against the PORT
// (`read.extensions`, the same anonymous read the front itself makes) and against the SCREEN, so uninstalling
// the app reddens this step by name instead of vanishing.
//
// ★★★ pk36/d1 — AND TODAY NO STORE DECLARES THE EXCEPTION. `cafe` was the only one and it was the fork's
// doing: its vitrine resolved the gate through the kit's registry, which is `{}` by design, so a STRUCTURAL
// slot it could not draw REFUSED the page. pk35/d2 gave that fork its own `composition.json` and `codegen`
// script, `storefront-coffee/src/lib/extensions/generated/gate-registry.tsx` exists, and the café draws the
// gate like every other shop — so `seed/coffee.mjs` stopped removing the placement and the key went with it.
// ⚠️ THE RULE SURVIVES ITS LAST SUBJECT ON PURPOSE: any store may declare itself gateless tomorrow, and
// `bin/prove-doors.test.mjs` keeps the branch graded against a FIXTURE box of its own rather than letting it
// go quiet — a rule nothing exercises is a rule nobody will notice breaking.
//
// ⚠️ THE VITRINE PAGE OF A STORE THAT IS OFF THE STREET IS EXEMPT, and it is measured rather than assumed:
// both the reference vitrine and the café's fork mount `requirePublicStorefront` in the store layout ABOVE the
// gate branch, so the 404 happens before any gate could render. A ⊘ door is graded as it always was.
//
// ★★ MEASURED ON https://demo.forgecommerce.pro (2026-09-11) BEFORE ANY OF THIS WAS WRITTEN, because the one
// thing that could have sunk the design is whether a gate really covers a door that REDIRECTS:
//     /account          no cookie → 200 (the gate)      with cookie → 307 (the login)
//     /account/login    no cookie → 200 (the gate)      with cookie → 200 (the form)
//     /checkout   /     no cookie → 200 (the gate)      with cookie → 200 (the shop)
// The gate COVERS the route rather than redirecting to home, so the page component — and its `redirect()` —
// never runs. That is what lets the no-cookie side demand the gate on all four doors alike.
//
// ★★ pk22 — AND IT NO LONGER SKIPS A WHOLE STORE FOR THE SAKE OF ONE DOOR. `storefront_enabled: false` says
// the reference VITRINE has no page for the store; it says nothing about the checkout, the account or the
// LOGIN, which are a different deployable (`apps/checkout`, which mounts `requireStore` and never
// `requirePublicStorefront`). Until this slice the counter's three checkout doors were opened by nothing at
// all the moment it left the street — silently, on the very birth that took it off. Now the vitrine page is
// demanded SHUT (⊘, a graded green) and the other three are demanded OPEN.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { declaredFaces, faceOfStore } from './box-domains.mjs';
import { OFF_THE_STREET, servability } from './servable.mjs';

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
/** Held by the box and declared by nobody: probed anyway, and NAMED — see the loop for why. */
const noted = (what, why) => say(`  ⓘ ${what} — ${why}`);
/** ★★ pk22 — A DOOR THAT WAS PROVED **SHUT**, which is a GREEN and has to look different from a green that
 *  was proved open. The counter's vitrine page must 404: that is what its merchant asked for. Rendering it
 *  as a ✓ would make «every door opens» mean two opposite things in one report. */
const closed = (what, why) => say(`  ⊘ ${what} — ${why}`);
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
      'forgeco → forge-operator-token ($FORGE_SEED_TOKEN), forgecafe → forge-operator-token-forgecafe ' +
      '($FORGE_SEED_TOKEN_FORGECAFE). `source env-source.sh` exports the FIRST tenant\'s as the ' +
      'unsuffixed one, which is the shell this defect was found in.',
  );
}

/**
 * ── ★★★ pk33 · THE GATE HALF — THREE SOURCES, AND NONE OF THEM IS A LIST TYPED HERE ──────────────────────
 *
 * The DECLARATION is `seed/box.json` (every store is gated unless it says `gate: false`), the PORT is
 * `read.extensions` — the very read the store layout makes — and the SCREEN is the body of each door. The
 * three are asked against each other, which is the same shape the `status` cross-check below already uses.
 */
const GATE_TARGET = 'storefront:gate';

/**
 * ⚠️ THE COOKIE NAME IS THE KIT'S AND IT IS FROZEN — `packages/storefront-kit/src/cookies.ts` in the Forge
 * monorepo, held by `cookies.contract.test.ts` there. It is written out here because this repository has no
 * way to import from the kit at runtime (the forks install it as a tarball; `bin/` runs on bare node), and
 * `bin/prove-doors.test.mjs` DERIVES it from a Forge checkout and goes red if the two ever part company.
 * ⛔ Never retype it from memory: the probe would send a cookie nothing reads and grade the gate on both
 * sides, which is the exact vacuum this slice exists to close.
 */
const GATE_DISMISSED_COOKIE = 'forge_gate_dismissed';
const GATE_DISMISSED_VALUE = '1';

/**
 * The mark of a rendered screen, in the markup. ★ THE GATE'S IS BUILT FROM THE EXTENSION ID THE PORT NAMED —
 * nothing here knows the demo's app by name — and the app asserts the other end against its own manifest
 * (`apps/demo-gate/block/marks.test.tsx`). The closing quote is load-bearing: without it `demo-gate` would
 * also match `demo-gate-ribbon`, and the two are the opposite states.
 */
const mark = (id) => `data-testid="${id}"`;
/**
 * ★★★ pk35/d1 — THE OTHER HALF OF THE SAME SENTENCE, AND NOTHING HAD IT. The gate is TWO screens: the
 * interstitial a first-time visitor meets, and the RIBBON at the foot of every page a visitor who came through
 * is browsing — the one affordance that reopens the gate ("A demo gate tem uma feature que aparece uma
 * barrinha no rodapé… só precisa checar se isso aparece nos 4 front", 13/09). Until this slice the cookie side
 * was graded only for what it must NOT contain (the interstitial), so a front that stopped drawing the ribbon
 * — a registry entry dropped, an image pinned before the ribbon existed, a fork that never had one — was a
 * silent loss on a green birth.
 *
 * ⛔ IT IS DERIVED, NOT TYPED: the app's own convention is `<extension id>-ribbon`, held against `manifest.id`
 * by `apps/demo-gate/block/marks.test.tsx` on the other end, exactly as the interstitial's mark is.
 */
const ribbonMark = (id) => mark(`${id}-ribbon`);
/** The PRODUCT's visible refusal of a structural slot this build cannot draw
 *  (`packages/storefront-kit/src/extensions/CompositionGapNotice.tsx`). A different failure, so a different ✗. */
const GAP_MARK = mark('composition-gap');

/**
 * Which extension fills `storefront:gate` for this store, ANONYMOUSLY — the same face, the same question and
 * the same answer the store layout resolves the gate from. Asking the operator face instead would grade a
 * different fact from the one a visitor's browser acts on.
 *
 * `null` = the port names nobody. `undefined` = this run could not ask, which is never a green (the caller
 * turns it into a ✗ that names the store).
 */
const gateFillerOf = async (storeId) => {
  let res;
  try {
    res = await fetch(`${api}/v1/read/extensions?store=${encodeURIComponent(storeId)}`);
  } catch {
    return undefined;
  }
  if (!res.ok) return undefined;
  const list = await res.json().catch(() => undefined);
  if (!Array.isArray(list)) return undefined;
  const filling = list.find((ext) => (ext.hooks ?? []).some((h) => h.target === GATE_TARGET));
  return filling?.extension_id ?? null;
};

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
 *
 * ★★★ pk22 — AND ONE OF THESE FOUR IS THE VITRINE'S AND THE OTHER THREE ARE NOT, which is the whole reason
 * this step no longer skips a store wholesale.
 *
 * `storefront_enabled: false` says ONE thing: the reference vitrine has no page for this store. It does not
 * say the store is off. Measured by pk21/p1 with a store `private`: the port answers 200 for `read.products`,
 * `product.by_handle`, `search`, `categories`, `availability`, `store.by_host`, `cart` and `checkout`, and
 * `cart.create` + `add_line` still work — and the CHECKOUT deployable, which serves the three doors below,
 * mounts `requireStore` and never `requirePublicStorefront` (`apps/checkout/src/app/s/[store]/layout.tsx`).
 * So a counter whose front is a totem still has a checkout, still has an account, and above all still has the
 * LOGIN and the ORDER STATUS page the person who just paid at the till follows a link to.
 *
 * ⛔ UNTIL THIS SLICE THIS STEP SKIPPED THE WHOLE STORE, and the day the counter went `private` those three
 * doors would have stopped being opened by anything — silently, on the very birth that took it off the
 * street, which is the moment the risk appears. `page: true` marks the one door servability governs.
 */
const DOORS = [
  {
    path: '',
    expect: [200],
    by: null,
    what: 'vitrine',
    page: true,
    // ⚠️ 404 AND NOTHING ELSE, on purpose. A store with no public page answers the vitrine's own 404
    // (`requirePublicStorefront` → `notFound()`), UNLESS it declares a public address, in which case
    // pk21/p1 sends a 307 to it. THIS BOX DECLARES NONE and the reason is measured — see
    // `_public_url_why` on the counter in `seed/box.json`. Widening this to accept a redirect would let a
    // 307 to nowhere pass as a proof.
    shutExpect: [404],
    shutBy: 'storefront',
    shutWhat: 'vitrine REFUSES it, which is exactly what «no public page» has to mean',
  },
  { path: '/checkout', expect: [200], by: 'checkout', what: 'checkout' },
  { path: '/account', expect: [307, 302], by: 'checkout', what: 'conta (redirects an anonymous shopper to the login)' },
  { path: '/account/login', expect: [200], by: 'checkout', what: '★ LOGIN — the door that was shut' },
];

say(`THE DOORS OF ${tenant}, opened anonymously at ${api}`);
say(`  credential → ${credentialTenant} ✓ · ${rows.length} store(s) held · ${declared.size} declared`);
say();

/** Doors actually opened by this run. A verdict over zero of them is not a verdict — see the vacuum below. */
let opened = 0;
/** ★ pk33 — doors whose TWO sides of the dismissal cookie were compared. Its own vacuum, below. */
let gatesGraded = 0;
/** Doors whose BODY was asked for the ribbon (2xx only — a redirect has none). Counted so the summary can
 *  say it out loud: a run that graded zero of them proved nothing about the way back. */
let ribbonsGraded = 0;

/**
 * ── ★ WHICH STORE HAS WHICH GATE, ASKED FOR ALL OF THEM BEFORE THE FIRST DOOR IS OPENED ─────────────────
 *
 * It is a pre-pass and not a line inside the loop, for one reason: a store declared GATELESS is graded
 * against the gates this tenant really carries (the negative control below), and that set is only complete
 * once every store has been asked. Derived from the box, never typed.
 *
 * `undefined` = could not ask (never a green — the loop turns it into a ✗ naming the store).
 */
const fillerOf = new Map();
for (const row of rows) fillerOf.set(row.id, await gateFillerOf(row.id));
/** Every extension that really fills the gate slot somewhere on this tenant. */
const gatesSeen = new Set([...fillerOf.values()].filter((id) => typeof id === 'string'));

/**
 * One door, opened once. `withCookie` is the whole experiment: the SAME request, the same manual redirect
 * handling, differing only in the kit's dismissal cookie — so any difference in the answer is the gate's.
 * ⚠️ The BODY is read, and it has to be: the gate and the shop both answer 200 from the same container, and
 * a status code cannot tell a front door from a shop floor.
 */
const openDoor = async (url, withCookie) => {
  const res = await fetch(url, {
    redirect: 'manual',
    ...(withCookie
      ? { headers: { cookie: `${GATE_DISMISSED_COOKIE}=${GATE_DISMISSED_VALUE}` } }
      : {}),
  });
  return {
    code: res.status,
    servedBy: res.headers.get('x-forge-served-by') ?? '',
    body: await res.text().catch(() => ''),
  };
};

for (const row of rows) {
  // Probed anyway — a store the box holds is a store a visitor can reach — and NAMED, because a store no
  // declaration mentions is a fact about this box somebody has to see. (Same rule as `bin/warm-box.mjs`.)
  if (!declared.has(row.handle)) {
    noted(row.handle, `not declared in seed/box.json (${row.id}) — this box holds a store nothing there mentions`);
  }
  // ⚠️ ANNOUNCED BY NAME, WITH THE REASON, because a store simply ABSENT from a report is indistinguishable
  // from one that failed — this repository has paid for that silence twice. ★ pk21: THE REASON IS THE PORT'S.
  // `seed/box.json` used to carry a hand-written `servable: false` for the counter — a second truth about a
  // store the very read below already described — so this step had to learn that store BY NAME. It reads
  // `storefront_enabled` off the row now (`bin/servable.mjs`), which is why nothing here needs a list.
  //
  // ★★ pk22 — AND WHAT IT GOVERNS IS ONE DOOR, NOT THE STORE. See the DOORS table: the vitrine's page is the
  // only thing a merchant switched off; the checkout, the account and the LOGIN are a different deployable
  // and must keep answering, or the person who paid at the counter cannot open the order they just paid for.
  const { servable, reason } = servability(row);
  const base = `${api}/s/${row.id}`;

  // ── ★★★ pk33 · DOES THIS STORE HAVE A FRONT DOOR, AND DOES EVERYBODY AGREE? ─────────────────────────────
  //
  // ★ THE DEFAULT IS **YES**, AND IT IS A DECISION RATHER THAN A CONVENIENCE: the demo is the shoe shop, the
  // outlet, the café and the totem, and all of it is gated. So nothing here lists the gated stores — a list would go
  // quietly stale the day a fifth store is born. What is listed is the EXCEPTION, in `seed/box.json`, with the
  // reason beside it, exactly as `status` is.
  const declaredGate = declared.get(row.handle);
  const wantsGate = declaredGate?.gate !== false;
  const filler = fillerOf.get(row.id);
  if (filler === undefined) {
    // Never a silent pass: without this answer every gate assertion below would abstain, and abstaining looks
    // exactly like passing in a report made of ✓ lines.
    bad(
      row.handle,
      'read.extensions could not be asked anonymously for this store, so this run cannot say whether it has a ' +
        'front door. That read is the one the store layout itself makes; if it is broken here it is broken for ' +
        'the shopper too.',
    );
  } else if (wantsGate && filler === null) {
    // ⛔ THE DEFECT THIS WHOLE HALF EXISTS FOR: the gate simply not installed, which is how the demo ran for
    // days. Nothing else on this box says so — every other step grades data the gate does not touch.
    bad(
      row.handle,
      `NO APP FILLS \`${GATE_TARGET}\` FOR THIS STORE. Every store of this demo is gated unless seed/box.json ` +
        'declares `gate: false` on it, and this one does not. Either nothing installed the gate app for this ' +
        "tenant (`seed/vitrine.json`'s `apps` for the shoe brand, `seed/coffee.mjs`'s for the coffee shop), or " +
        'its placement was removed from this store. A shop whose front door is missing looks exactly like a ' +
        'shop, which is why this is asserted and not eyeballed.',
    );
  } else if (!wantsGate && filler !== null) {
    bad(
      row.handle,
      `seed/box.json declares \`gate: false\` on this store — ${declaredGate?._gate_why ?? 'no reason written'} — ` +
        `and the port answers that "${filler}" fills \`${GATE_TARGET}\` here. The declaration and the box ` +
        'disagree: either the seed module that owns this store never removed the placement, or something put ' +
        'it back. A front that cannot draw a structural slot REFUSES the page, so this is a shop nobody can ' +
        'open.',
    );
  } else if (filler === null) {
    noted(
      row.handle,
      `no gate, BY DECLARATION — seed/box.json says \`gate: false\`: ${declaredGate?._gate_why ?? 'no reason written'}`,
    );
  }
  /** The extension whose screen the no-cookie side must show, or null when this store is declared gateless. */
  const gateOf = filler ?? null;
  const gateMark = gateOf ? mark(gateOf) : null;
  /** ⚠️ A RUN THAT COULD NOT ASK GRADES NEITHER SIDE, and it has already been named by the ✗ above. Without
   *  this, an unanswerable read would fall into the GATELESS branch and accuse the store of a second, made-up
   *  defect — «declared gateless and a gate reached it» — over a question nobody answered. */
  const gateKnown = filler !== undefined;

  for (const door of DOORS) {
    // The one door servability moves. Everything else about the probe is identical: same request, same
    // header check — only the answer being demanded is the opposite one.
    const shut = !servable && door.page === true;
    const expect = shut ? door.shutExpect : door.expect;
    const expectedBy = shut ? door.shutBy : door.by;
    const what = shut ? door.shutWhat : door.what;
    const label = `${row.handle}${door.path || '/'}`;
    // ★★★ pk33 — THE SAME DOOR, TWICE. `through` is the shopper who has already been past the gate, and its
    // answer is what every rule that existed before this slice grades: the status, the front, the ⊘. `atTheDoor`
    // is the first-time visitor, and it is graded on its BODY.
    let atTheDoor;
    let through;
    try {
      atTheDoor = await openDoor(`${base}${door.path}`, false);
      through = await openDoor(`${base}${door.path}`, true);
    } catch (error) {
      bad(label, `could not be reached: ${error.message}`);
      continue;
    }
    const { code, servedBy } = through;
    if (!expect.includes(code)) {
      bad(
        label,
        shut
          ? // ⛔ THE ONE THIS SENTENCE IS FOR: the store is off the street and its page is STILL being served.
            `${what} — but it answered ${code}${servedBy ? ` (served by ${servedBy})` : ''}, so the vitrine is ` +
              `still serving a store the port says has no public page. ${reason}`
          : // ⛔ AND THE OPPOSITE ONE, which is the leak this slice exists to catch: the refusal of the PAGE
            // reaching a door that is not the page's.
            `${what} answered ${code}, and this door has to answer ${expect.join(' or ')}${servedBy ? ` (served by ${servedBy})` : ''}${
              servable
                ? ''
                : ' — ⛔ THIS DOOR IS NOT THE VITRINE\'S PAGE AND MUST NOT CLOSE WITH IT. A store with no ' +
                  'public page keeps its catalogue, its cart, its orders and its sign-in: the totem sells ' +
                  'through the port and the buyer follows a link to the order they just paid for. If this ' +
                  'went red the day the counter left the street, the refusal leaked out of the vitrine into ' +
                  'the deployable that holds the money and the session.'
            }`,
      );
      continue;
    }
    // ★ THE CONTAINER, NOT ONLY THE CODE. The vitrine answers 200 for paths it does not own; only the
    // header proves the edge chose the front that holds the money and the session. It is also what tells a
    // 404 that the VITRINE decided from a 404 the edge produced by sending the request somewhere else.
    if (expectedBy && servedBy && servedBy !== expectedBy) {
      bad(label, `${what} answered ${code} but was served by "${servedBy}", not "${expectedBy}" — the edge sent it to the wrong front`);
      continue;
    }
    // ── ★★★ pk33 · AND NOW THE GATE, WHICH IS THE ONLY THING HERE A STATUS CODE CANNOT SEE ────────────────
    //
    // Every assertion below reads a BODY. The gate answers 200 and so does the shop; they come from the same
    // container and carry the same `x-forge-served-by`. The one difference that reaches this process is what
    // is in the markup, and the marks are not typed here — `mark()` builds the gate's from the extension id
    // the PORT just named, and the app asserts the same string against its own manifest.
    if (shut) {
      // ⚠️ EXEMPT, AND MEASURED RATHER THAN ASSUMED. Both the reference vitrine and the café's fork mount
      // `requirePublicStorefront` in the store layout ABOVE the gate branch, so a store with no public page
      // 404s before any gate could render — on BOTH sides of the cookie. Asserting that the refusal is
      // cookie-blind is the useful statement here: a gate that could be dismissed INTO a page the merchant
      // switched off would be a way around the refusal.
      if (atTheDoor.code !== through.code) {
        bad(
          label,
          `the vitrine's refusal of this store CHANGES WITH THE DISMISSAL COOKIE — ${atTheDoor.code} without ` +
            `it, ${through.code} with it. «No public page» is not something a visitor may dismiss.`,
        );
        continue;
      }
    } else if (!gateKnown) {
      // Named once, above. Nothing else is claimed about this store's doors.
    } else if (gateMark) {
      // 1 · THE FIRST-TIME VISITOR MUST MEET THE GATE. This is the assertion whose absence let the app sit
      //     uninstalled for days under a green birth.
      if (!atTheDoor.body.includes(gateMark)) {
        bad(
          label,
          atTheDoor.body.includes(GAP_MARK)
            ? // A DIFFERENT FAILURE AND IT DESERVES ITS OWN SENTENCE: the port says a gate is here and the
              // front that answered cannot draw it, so it refuses the page instead of opening the shop. That
              // refusal is correct behaviour and a broken store — the fix is the FRONT, never this step.
              `the front that answers this door CANNOT DRAW the gate the port declares ("${gateOf}"): it ` +
                'rendered the structural-gap refusal instead of the shop. This store either needs that gate ' +
                'removed from its placement (`seed/box.json` → `gate: false`, with the reason) or a front ' +
                'that carries the implementation.'
            : `NO GATE ON THIS DOOR. The port says "${gateOf}" fills \`${GATE_TARGET}\` for this store, and a ` +
                `request carrying no \`${GATE_DISMISSED_COOKIE}\` cookie answered ${atTheDoor.code} with a body ` +
                `that does not contain \`${gateMark}\` — so a first-time visitor walks straight into the shop. ` +
                'The gate is declared and not rendered: the front is pinned to an image that does not carry ' +
                'the implementation, or the slot stopped being mounted in that layout.',
        );
        continue;
      }
      // 2 · AND THE VISITOR WHO IS THROUGH MUST GET THE SHOP. Without this the probe would go green against
      //     a box where the gate is unescapable, and — worse — a probe that sent the cookie on BOTH sides
      //     would satisfy rule 1 for free. This is the assertion that makes that mistake red.
      if (through.body.includes(gateMark)) {
        bad(
          label,
          `THE GATE WILL NOT LET GO. A request carrying \`${GATE_DISMISSED_COOKIE}=${GATE_DISMISSED_VALUE}\` — ` +
            'the cookie the gate\'s own "Abrir a loja" sets — still answered the gate screen, so a visitor who ' +
            'came through it cannot reach this door at all.',
        );
        continue;
      }
      // 3 · ⛔ THE ANTI-VACUUM, ASSERTED DIRECTLY AND ON PURPOSE REDUNDANT. Rules 1 and 2 cannot both hold
      //     over identical bytes — one demands the mark, the other forbids it — so on a healthy box this line
      //     never fires, and that is the point of writing it down: it is the guard on the two guards above.
      //     The day somebody weakens either of them into «contains something plausible», the claim this whole
      //     half rests on — that the two sides of the cookie are DIFFERENT ANSWERS — stops being checked by
      //     anything else. `bin/prove-doors.test.mjs` drives it with a box that ignores the cookie.
      //     ⚠️ It is asserted rather than reasoned about for the same reason `opened === 0` is, fifty lines
      //     down: every way this step can go blind decays into a report of ✓ lines that measured nothing.
      if (atTheDoor.body === through.body) {
        bad(
          label,
          'the two sides of the dismissal cookie answered the SAME BODY, byte for byte. This run cannot tell ' +
            'the gate from the shop on this door, so nothing it says about either is a measurement.',
        );
        continue;
      }
      // 4 · ★★★ AND THE WAY BACK MUST BE ON THE PAGE — the ribbon, on the front that answered THIS door.
      //     ⚠️ ONLY WHERE THERE IS A PAGE, and that is measured rather than assumed: on the bench of
      //     2026-09-13 the four doors of the outlet answered, with the cookie, `200 · storefront` (ribbon),
      //     `200 · checkout` (ribbon), `307 · checkout` (a redirect — no body, no ribbon, correctly) and
      //     `200 · checkout` (ribbon). Demanding it of a 3xx would redden the login redirect for having done
      //     its job, so the question is asked of a door that RENDERED something.
      if (code >= 200 && code < 300 && !through.body.includes(ribbonMark(gateOf))) {
        bad(
          label,
          `THE WAY BACK IS MISSING. This door answered ${code}${servedBy ? ` from "${servedBy}"` : ''} to a ` +
            `visitor carrying \`${GATE_DISMISSED_COOKIE}\`, and its body does not contain ` +
            `\`${ribbonMark(gateOf)}\` — so the demo ribbon is not drawn there and nothing on the page reopens ` +
            'the gate. The gate app ships BOTH faces from one module (`forge.wiring.gate`: an interstitial and ' +
            'a ribbon); a front that mounts the first and not the second is installed, visible and half ' +
            'wired. Look at the registry of the front named above.',
        );
        continue;
      }
      if (code >= 200 && code < 300) ribbonsGraded++;
      gatesGraded++;
    } else {
      // ★ THE PERMANENT NEGATIVE CONTROL, AND IT IS DERIVED. A store declared `gate: false` must show no gate
      // and no refusal — on either side. The mark it is checked against is not this store's (it has none): it
      // is every gate this TENANT really carries, learned from the port a few lines up. So the control is a
      // fact about this box rather than a string somebody typed, and it goes red if the removal ever stops
      // removing.
      //
      // ⚠️ pk36/d1 — AND IT SAYS ONLY WHAT IT KNOWS. This branch is reached whenever the port names NO filler,
      // and that is TWO different boxes: the store that declares itself gateless (the ⓘ above) and the store
      // that wants a gate and has none (the ✗ above). The sentence used to assert the DECLARATION in both, so
      // a shop whose gate had simply gone missing was accused of being «declared gateless» — an instrument
      // stating about the world what it only knows about itself, which is the defect this house keeps finding.
      const knownAs = wantsGate
        ? 'the port names no app filling the gate slot on this store (the ✗ above says so)'
        : 'this store is declared gateless';
      const intruder = [...gatesSeen].map(mark).find((m) => atTheDoor.body.includes(m) || through.body.includes(m));
      if (intruder) {
        bad(label, `${knownAs} and a gate screen (\`${intruder}\`) reached this door anyway.`);
        continue;
      }
      if (atTheDoor.body.includes(GAP_MARK) || through.body.includes(GAP_MARK)) {
        bad(
          label,
          `${knownAs}, and the front REFUSED the page with the structural-gap notice — it still believes a ` +
            'slot is filled that the port says nobody fills.',
        );
        continue;
      }
    }
    // A door proved SHUT is a graded door: it counts, so «this run asked nothing» stays the only meaning of
    // zero, and it prints as ⊘ so nobody reads it as a page that opened.
    opened++;
    // ⚠️ THE REASON RIDES ON THE ⊘ LINE AND NOWHERE ELSE. It used to be a second, separate «SKIPPED» line for
    // the same door, from the days the whole store was skipped — two lines saying one thing, and the reader
    // had to reconcile them. One door, one line, and the line carries the PORT's words.
    (shut ? closed : ok)(
      label,
      `${what} → ${code}${servedBy ? ` · ${servedBy}` : ''}${shut ? ` — ${reason}` : ''}` +
        // ⚠️ THE GATE VERDICT RIDES ON THE SAME LINE, because a reader has to be able to see WHICH doors were
        // proved on both sides. A ✓ that is silent about the gate is what this step used to print for a box
        // with no gate at all.
        (shut
          ? ' · gate n/a (refused above the slot)'
          : !gateKnown
          ? ' · gate NOT ASKED (see the ✗ above)'
          : gateMark
            ? ` · gate ✓ (${gateOf} without the cookie, the shop with it)`
            : ' · no gate, declared'),
    );
  }
  say();
}

// ── ★★★ pk34/d1 · THE ADDRESS EACH STORE IS PUBLISHED AT, AND WHO THE KERNEL SAYS ANSWERS THERE ─────────
//
// The loop above opened every door of this box's BENCH address space — `/s/<id>/…`, one origin, four stores.
// Online each store has a hostname and its doors sit at the ROOT of it, and `seed/box.json` now declares
// which hostname is whose (`domain`, per store). This is the half of that a step with no DNS can honestly
// ask: WHO DOES THE KERNEL'S OWN ADDRESS BOOK SAY ANSWERS THERE. `read.store.by_host` is the global
// directory — public, actorless, the same table `bin/store-host.mjs` writes at step 6b — and it is asked
// here about the declared hostname rather than about the address this run was reached at.
//
// ⛔ AND THE ONE THAT MATTERS ON A BENCH IS THE NEGATIVE. The counter declares `directory: false`: a front of
// this box answers at that hostname (the totem) and no store may CLAIM it, because the kernel writes
// `https://<host>/account/orders/<id>` into every transactional message and the totem serves ONE route — so a
// claim there puts an «Acompanhar o pedido» button on every counter receipt pointing at the totem's own 404
// (`_public_url_why` in seed/box.json carries the measurement). Nothing anywhere asserted that, and it is
// exactly the kind of fact a re-provision or a hand-edit flips in silence.
{
  const faces = declaredFaces(BOX);
  const mine = rows.flatMap((row) => {
    const face = faceOfStore(faces, tenant, row.handle);
    return face ? [{ row, face }] : [];
  });
  if (mine.length === 0) {
    noted(
      `${tenant} declares no store hostname`,
      'no store of this tenant carries a `domain` in seed/box.json, so this run has no published address to ' +
        'ask the directory about. On a box that is meant to go online, that is the finding.',
    );
  } else {
    let claimedHere = 0;
    for (const { row, face } of mine) {
      let answered;
      try {
        const res = await fetch(`${api}/v1/read/store.by_host?host=${encodeURIComponent(face.host)}`);
        answered = res.status === 404 ? null : (await res.json().catch(() => ({})))?.store_id ?? null;
      } catch (error) {
        bad(`${row.handle} @ ${face.host}`, `read.store.by_host could not be asked: ${error.message}`);
        continue;
      }
      if (answered) claimedHere++;
      if (!face.directory) {
        if (answered === null) {
          ok(
            `${row.handle} @ ${face.host}`,
            'served at the EDGE and claimed by no store in the kernel\'s directory — which is what ' +
              '`directory: false` declares, and what keeps every counter receipt free of a link into a front ' +
              'that serves one route',
          );
        } else {
          bad(
            `${row.handle} @ ${face.host}`,
            `seed/box.json declares \`directory: false\` for this store's hostname and read.store.by_host ` +
              `answers "${answered}" for it. The kernel composes \`https://<host>/account/orders/<id>\` into ` +
              'every transactional message from this column, and the front at that hostname is the totem, ' +
              'which serves ONE route: every receipt of that store now carries a button to a 404. It also ' +
              'keys the global store directory, so any request reaching this box with that Host is served ' +
              'that store. Remove the claim (`tenant.store.update` with a null host), or change the ' +
              'declaration and say why.',
          );
        }
        continue;
      }
      if (answered === null) continue; // reported once, below — a localhost birth claims none of them
      if (answered !== row.id) {
        bad(
          `${row.handle} @ ${face.host}`,
          `this box declares that hostname for "${row.handle}" (${row.id}) and the kernel's directory answers ` +
            `"${answered}". TWO STORES AT ONE ADDRESS: whichever the directory names is the one a visitor ` +
            'reaches, and the declaration is a promise nothing keeps.',
        );
        continue;
      }
      ok(`${row.handle} @ ${face.host}`, 'its declared hostname resolves to this store in the kernel\'s directory');
    }
    if (claimedHere === 0) {
      noted(
        `${tenant} is not published at any of its ${mine.length} declared hostname(s)`,
        'the kernel\'s directory claims none of them, which is exactly what a LOCALHOST BIRTH leaves — the ' +
          'addresses are in seed/box.json and the promotion is what claims them.',
      );
    }
  }
}
say();

// ── ★★ THE STORE THIS REPOSITORY DECLARES AND THE BOX DOES NOT HOLD ─────────────────────────────────────
//
// The other half of "which doors are these": question 2 proved the list belongs to the right tenant, and
// this proves the list is not SHORT. Without it, a port that hands back an empty array — or a birth that
// built one store of two — is a run with fewer ✓ lines and the same green verdict. (`bin/warm-box.mjs` grades
// the same disagreement, in the loop after the one that classifies rows; it is stated in both because neither
// runs the other. ⚠️ Named rather than cited by line: this file used to point at a line number, and pk21
// moved it.)
for (const [handle, decl] of declared) {
  const row = rows.find((r) => r.handle === handle);
  if (!row) {
    bad(
      handle,
      `declared in seed/box.json and NOT in this box, so none of its doors could be opened${decl.bootstrap ? " (it is the tenant's bootstrap store; `provision-ref` owns it)" : ''}`,
    );
    continue;
  }
  // ── ★★★ pk22 · THE DECLARATION AND THE PORT, ASKED AGAINST EACH OTHER ─────────────────────────────────
  //
  // The loop above graded whatever the port said. This asks the other question, and it is the one nothing on
  // this box could ask before: does the port say what the BOX DECLARED? `seed/box.json` states `status` for
  // a store whose front is not the vitrine (the counter, whose front is the totem), `bin/seed-box.mjs`
  // writes it through `tenant.store.update`, and the kernel derives `storefront_enabled` from it. Three
  // links, and any of them failing quietly puts a shop back on the street with a full green underneath:
  // a re-provision that reset the column, a birth where step 6 never ran, an edit that dropped the word.
  //
  // ⚠️ ASKED ONLY WHERE THE FILE SAYS SOMETHING. An undeclared status is «this box has no opinion», exactly
  // as it is for the checkout flags, so a store this file is silent about is never graded on it.
  if (decl.status === undefined) continue;
  const declaredOffTheStreet = decl.status === OFF_THE_STREET;
  const portOffTheStreet = !servability(row).servable;
  if (declaredOffTheStreet === portOffTheStreet) continue;
  bad(
    handle,
    declaredOffTheStreet
      ? `⛔ IS BACK ON THE VITRINE. seed/box.json declares this store \`status: "${decl.status}"\` — it has a ` +
          'front of its own and the reference vitrine must not serve it — and `read.internal.stores` answers ' +
          '`storefront_enabled: true` for it, so the page IS being served. The word is written through the ' +
          'port by `bin/seed-box.mjs` (step 6 of the birth) and nowhere else: either that step did not run ' +
          'for this tenant, or something put the store back with `tenant.store.update {"status":"active"}`. ' +
          `Nothing else on this box will say so — every other step reads the port and would grade "${handle}" ` +
          'as an ordinary shop.'
      : `seed/box.json declares this store \`status: "${decl.status}"\`, so it must have a public page, and ` +
          '`read.internal.stores` answers `storefront_enabled: false` for it — the vitrine is 404ing a store ' +
          'this box says is on the street, and no visitor reaches it.',
  );
}

// ── ★★★ THE VACUUM: a run that opened NOTHING is not a run that found everything open ───────────────────
//
// Every way this step can go blind decays into the same shape — an empty report under a green verdict — so
// the count is asserted directly instead of trusting that the reasons above are exhaustive.
// ── ★★★ pk33 · AND THE GATE HALF HAS A VACUUM OF ITS OWN ────────────────────────────────────────────────
//
// Every ✗ above names a store; none of them names the shape where NOBODY was graded on both sides. That can be
// honest — a tenant every store of which declares `gate: false` — so it is a ⓘ and not a ✗, but it is SAID,
// because a report full of ✓ lines over zero cookie comparisons reads exactly like a report that proved the
// gate. A ✗ is not needed to catch the dangerous version of this: a store that WANTS a gate and has none is
// already red by name, one store at a time.
if (gatesGraded === 0) {
  noted(
    `NO DOOR OF ${tenant} WAS PROVED ON BOTH SIDES OF THE GATE`,
    'not one store of this tenant carries a gate this run could compare with and without the dismissal ' +
      'cookie. If that is a surprise, it is the finding: `seed/box.json` declares every store gated unless ' +
      'it says `gate: false`.',
  );
} else {
  say(
    `  ⓘ ${gatesGraded} door(s) proved on BOTH sides of \`${GATE_DISMISSED_COOKIE}\` — the gate without it, ` +
      'the shop with it, and the two bodies asserted DIFFERENT.',
  );
  // ⚠️ SAID SEPARATELY BECAUSE IT IS A SEPARATE COUNT. Not every graded door renders a page (`/account`
  // redirects an anonymous shopper), so «gates graded» does not imply «ribbons graded», and a run where the
  // second is zero has said nothing about the way back — which is the shape this rule exists to end.
  if (ribbonsGraded === 0) {
    noted(
      `NO PAGE OF ${tenant} WAS ASKED FOR THE DEMO RIBBON`,
      'every gated door of this tenant answered a redirect, so no body carried the foot of a page. The ' +
        'ribbon — the one affordance that reopens the gate — is ungraded on this run.',
    );
  } else {
    say(`  ⓘ ${ribbonsGraded} page(s) carried the demo ribbon, on the front that served each one.`);
  }
}

if (opened === 0) {
  bad(
    `NO DOOR OF ${tenant} WAS OPENED`,
    `this run graded ${rows.length} store(s) held and ${declared.size} declared and opened zero doors, so it ` +
      'proves nothing about this tenant. A doors step with no door in it is a green that means "not asked".',
  );
}

finish(
  failures === 0
    ? // ★ pk22 — «answers as it must», not «opens»: one of the doors this step grades is one that has to be
      // SHUT (the vitrine page of a store whose front is somebody else's), and a verdict that says «opens»
      // over a ⊘ line is a report that contradicts itself in two lines.
      `VERDICT: every door of ${tenant} answers as it must (${opened}), each one from the front that owns it.`
    : opened === 0
      ? // ⚠️ NOT "N doors do not open" — this run never opened one, and a count of failures over an empty
        // report would read as a partial success. The ✗ lines above say what it could not reach.
        `VERDICT: NOT ONE door of ${tenant} was opened by this run, so it proves nothing about this tenant. Read the ✗ lines above.`
      : `VERDICT: ${failures} door(s) of ${tenant} do NOT answer as they must. Read the ✗ lines above.`,
);
