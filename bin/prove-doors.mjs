#!/usr/bin/env node
// ★★ EVERY DOOR OF EVERY STORE, OPENED — because a 404 behind a link nobody clicked is invisible.
//
//   FORGE_OPERATOR_TOKEN=… node bin/prove-doors.mjs --tenant forgeco --api http://localhost:8200
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
// places is one stale `FORGE_OPERATOR_TOKEN` in a shell away from lying, and that is how it was found.
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
// ★★★ v0.4 — AND IT NOW GRADES THE OPPOSITE OF WHAT IT USED TO: **NO DOOR OF THIS BOX SERVES A GATE**.
//
// ⛔ WHAT THIS STEP USED TO DEMAND, AND WHY IT WAS TURNED AROUND. Until this slice the rule was «every store
// has a front door», and every door was opened TWICE — once without the kit's dismissal cookie (the body had
// to BE the interstitial) and once with it (the body had to be the shop). That rule was correct about the
// screen and blind about the ROUTING, which is what the screen cost. Measured on the deployed box:
//
//     · the product asks, at the edge of EVERY store route, whether an INSTALLED app fills `storefront:gate`;
//     · so the mere install took every store off the cacheable tree — every route answered
//       `private, no-cache, no-store`, on every face;
//     · and a robot asking for any URL was handed the interstitial, with no `<title>`.
//
// ⇒ THE SCREEN WAS NOT WORTH THE TREE. The sentence a visitor is owed — «this is a demo, nothing is charged
// or shipped» — is a BLOCK now (`demo-setup/demo_ribbon`), rendered by the slot it was dropped into, and it
// costs the cache nothing. What is left to grade is that the slot really is EMPTY: an app installed on it by
// a hand, a seed or a restored backup puts the whole box back on the dynamic tree, in silence, exactly as
// before — nothing else on this box would say so.
//
// ★ SO THE GATE HALF IS NOW TWO QUESTIONS AND BOTH ARE DERIVED:
//   · the PORT — `read.extensions`, the same anonymous read the store layout makes — must name NOBODY filling
//     `storefront:gate` for any store of this tenant. A filler is a ✗ that names the app;
//   · the SCREEN — no door may answer with the product's structural-gap refusal, which is what a front shows
//     when a slot IS filled and it cannot draw it. A box in that state serves «Esta loja está temporariamente
//     indisponível» on every route, and its status code is the same 200 a shop answers with.
//
// ⚠️ AND EACH DOOR IS OPENED ONCE AGAIN, which is a subtraction the reader should see rather than discover:
// there is no second side to compare, because there is no cookie any front reads for this. A run that could
// not ASK the port is a ✗ naming the store, never an abstention.
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
const token = process.env.FORGE_OPERATOR_TOKEN ?? '';

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
if (!token) wrongQuestion('no FORGE_OPERATOR_TOKEN: `read.internal.stores` is the operator face and needs this tenant\'s own token.');

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
      'forgeco → forge-operator-token ($FORGE_OPERATOR_TOKEN), forgecafe → forge-operator-token-forgecafe ' +
      '($FORGE_OPERATOR_TOKEN_FORGECAFE). `source env-source.sh` exports the FIRST tenant\'s as the ' +
      'unsuffixed one, which is the shell this defect was found in.',
  );
}

/**
 * ── ★★★ v0.4 · THE GATE HALF — TWO SOURCES, AND NEITHER OF THEM IS A LIST TYPED HERE ─────────────────────
 *
 * The PORT is `read.extensions` — the very read the store layout makes — and the SCREEN is the body of each
 * door. Both are asked against ONE rule: nobody fills this slot on this box. Nothing here spells the name of
 * an app, so an app installed on it tomorrow is named by the port rather than matched against a memory.
 */
const GATE_TARGET = 'storefront:gate';

/** The mark of a rendered screen, in the markup — `data-testid`, the one handle a build does not hash. */
const mark = (id) => `data-testid="${id}"`;
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
/** ★ v0.4 — doors whose BODY was read and found free of a gate. Its own vacuum, below. */
let gatelessProved = 0;

/**
 * ── ★ WHO FILLS THE GATE SLOT ON EACH STORE, ASKED FOR ALL OF THEM BEFORE THE FIRST DOOR IS OPENED ──────
 *
 * It is a pre-pass and not a line inside the loop, for one reason: the SCREEN half is graded against the
 * gates this tenant really carries, and that set is only complete once every store has been asked. Derived
 * from the box, never typed.
 *
 * `undefined` = could not ask (never a green — the loop turns it into a ✗ naming the store).
 */
const fillerOf = new Map();
for (const row of rows) fillerOf.set(row.id, await gateFillerOf(row.id));
/** Every extension that really fills the gate slot somewhere on this tenant. On a healthy box: EMPTY. */
const gatesSeen = new Set([...fillerOf.values()].filter((id) => typeof id === 'string'));

/**
 * One door, opened once.
 * ⚠️ The BODY is read, and it has to be: a gate and a shop both answer 200 from the same container, and a
 * status code cannot tell a front door from a shop floor.
 */
const openDoor = async (url) => {
  const res = await fetch(url, { redirect: 'manual' });
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

  // ── ⛔⛔ THE STORE'S OWN HOSTNAME, AND `/s/<id>` ONLY WHERE THAT IS HOW A BOX ROUTES ────────────────────
  //
  // MEASURED on this instance's deployed box 2026-09-17: every door of every store was reported 404, and
  // every one of them answered correctly to a browser. The addresses were the difference. `/s/<store>` is
  // the BENCH's path routing; a deployed box routes by HOSTNAME, and the path form does not exist there —
  // it is the same dev-only override `production-cutover.md` was teaching as real until pk43/doc2.
  //
  // ⚠️ AND IT LOOKED GREEN FOR THE WRONG REASON FIRST, WHICH IS WHY THE BODY IS STILL READ. Back when a gate
  // stood in front of this box, `/s/<id>/checkout` answered 200 on a deployed box to a first-time visitor —
  // the GATE substituted the first screen at any path, so the 200 was the front door and not the shop floor.
  // The gate is gone and the lesson is not: a status code cannot tell one screen from another.
  //
  // ⇒ The kernel's directory already answers this: `read.internal.stores` carries each store's `host`. Use it
  // when it is there, and keep the path form for the bench, where it is how the box really routes.
  const base = row.host ? String(row.host).replace(/\/+$/, '') : `${api}/s/${row.id}`;

  // ── ★★ A STORE THIS BOX ROUTES BY A HOSTNAME IT DOES NOT HAVE IS «COULD NOT LOOK», NEVER «IT IS BROKEN» ──
  //
  // A counter (`directory: false`) is served at the EDGE and claimed by no store in the kernel's directory, so
  // it has no `host` to be addressed at. On a bench that is harmless — the path form is how the box routes
  // there anyway. On a HOST-ROUTED box the path form does not exist, and probing it would report three
  // failures about an address this file invented.
  //
  // ⛔ So it says so and moves on. That is not the same as passing: a run that could not look at a door
  // announces the door and the reason, exactly as the census above announces an undeclared store.
  if (!row.host && rows.some((r) => r.host)) {
    noted(
      row.handle,
      `NOT CHECKED — this box routes stores by hostname and the directory claims none for this one ` +
        `(${row.id}). Its doors are served at the edge; naming the address is a decision this file does not ` +
        `get to make.`,
    );
    continue;
  }

  // ── ★★★ v0.4 · IS ANYTHING STANDING IN FRONT OF THIS STORE? ─────────────────────────────────────────────
  //
  // ⛔ THE ANSWER MUST BE NO, FOR EVERY STORE, AND THERE IS NO EXCEPTION TO DECLARE. `storefront:gate` is not
  // a screen this box may choose per store: an app installed on it is TENANT-wide (`seedDefaultPlacements`
  // writes a row per store) and the product asks about it at the edge of every route, so one install takes
  // the whole box off the cacheable tree. A `gate: false` on one store would not buy the tree back for the
  // others, which is why the old per-store declaration went with the app.
  const filler = fillerOf.get(row.id);
  if (filler === undefined) {
    // Never a silent pass: without this answer every gate assertion below would abstain, and abstaining looks
    // exactly like passing in a report made of ✓ lines.
    bad(
      row.handle,
      'read.extensions could not be asked anonymously for this store, so this run cannot say whether anything ' +
        'stands in front of it. That read is the one the store layout itself makes; if it is broken here it is ' +
        'broken for the shopper too.',
    );
  } else if (filler !== null) {
    // ⛔ THE DEFECT THIS HALF EXISTS FOR NOW, and it is the one the whole v0.4 slice was written against.
    bad(
      row.handle,
      `"${filler}" FILLS \`${GATE_TARGET}\` FOR THIS STORE, AND NOTHING IN THIS REPOSITORY MAY. The cost is ` +
        'not the screen, it is the ROUTING: the product asks at the edge of every store route whether an ' +
        'INSTALLED app fills that slot, so this one install answers `private, no-cache, no-store` on every ' +
        'route of every store of this tenant and hands a robot an interstitial with no `<title>` at every URL. ' +
        'Uninstall it (`extension.uninstall`) — and find out what put it back: no seed of this repository ' +
        'installs a gate app, and `bin/no-gate.guard.mjs` refuses one that would.',
    );
  }
  /** ⚠️ A RUN THAT COULD NOT ASK GRADES NOTHING BELOW, and it has already been named by the ✗ above. */
  const gateKnown = filler !== undefined;

  for (const door of DOORS) {
    // The one door servability moves. Everything else about the probe is identical: same request, same
    // header check — only the answer being demanded is the opposite one.
    const shut = !servable && door.page === true;
    const expect = shut ? door.shutExpect : door.expect;
    const expectedBy = shut ? door.shutBy : door.by;
    const what = shut ? door.shutWhat : door.what;
    const label = `${row.handle}${door.path || '/'}`;
    // ★ ONE REQUEST, AND ITS ANSWER IS BOTH HALVES: the status and the front are graded from the head, and
    // the gate half is graded from the BODY — the only place a front door and a shop floor differ.
    let answer;
    try {
      answer = await openDoor(`${base}${door.path}`);
    } catch (error) {
      bad(label, `could not be reached: ${error.message}`);
      continue;
    }
    const { code, servedBy } = answer;
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
    // ── ★★★ v0.4 · AND NOW THE GATE, WHICH IS THE ONLY THING HERE A STATUS CODE CANNOT SEE ───────────────
    //
    // Every assertion below reads a BODY. A gate answers 200 and so does the shop; they come from the same
    // container and carry the same `x-forge-served-by`. The one difference that reaches this process is what
    // is in the markup — and no string here is typed: the marks are built from the extension ids the PORT
    // itself named a few lines up, so this file knows the name of no app at all.
    if (!gateKnown) {
      // Named once, above. Nothing else is claimed about this store's doors.
    } else {
      // 1 · ⛔ NO GATE SCREEN MAY REACH THIS DOOR. `gatesSeen` is every app the port says fills the slot
      //     ANYWHERE on this tenant — empty on a healthy box, which is why this check cannot fire by itself
      //     and why the ✗ that names the app is the per-store one above. It exists for the box where the
      //     port answers for one store and the SCREEN betrays another: an image pinned before the app left,
      //     a front still welding a registry entry by hand.
      const intruder = [...gatesSeen].map(mark).find((m) => answer.body.includes(m));
      if (intruder) {
        bad(label, `a gate screen (\`${intruder}\`) reached this door, and no route of this box may serve one.`);
        continue;
      }
      // 2 · ⛔ AND NEITHER MAY THE PRODUCT'S REFUSAL OF ONE. `composition-gap` is what a front draws when a
      //     STRUCTURAL slot IS filled and this build cannot draw it: the page is refused, visibly, with the
      //     same 200 a shop answers with. It is the shape a half-removed gate takes — the app uninstalled
      //     from the port's answer for one store and still placed on another, or an image that still
      //     believes the slot is filled — and it is a shop nobody can open.
      if (answer.body.includes(GAP_MARK)) {
        bad(
          label,
          'the front REFUSED this page with the structural-gap notice — it believes a slot is filled that ' +
            'nothing in this repository fills any more. The page answers 200 and shows «Esta loja está ' +
            'temporariamente indisponível», so no status code anywhere would have said so.',
        );
        continue;
      }
      gatelessProved++;
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
        // ⚠️ THE GATE VERDICT RIDES ON THE SAME LINE, because a reader has to be able to see WHICH doors had
        // their body read at all. A ✓ that is silent about the gate is what this step printed for a box whose
        // front door had simply gone missing, back when the rule pointed the other way.
        (gateKnown ? ' · no gate ✓ (the port names none, the body shows none)' : ' · gate NOT ASKED (see the ✗ above)'),
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
// ── ★★★ v0.4 · AND THE GATE HALF HAS A VACUUM OF ITS OWN, AND IT IS A ✗ NOW ─────────────────────────────
//
// ⚠️ IT CHANGED SIDES WITH THE RULE, AND THAT IS THE POINT OF WRITING IT DOWN. While the rule was «every
// store HAS a gate», a run that compared nothing was a ⓘ: the dangerous shape (a store that wants one and has
// none) was already red by name. The rule is the opposite now — «NO store has one» — and a rule of that shape
// is satisfied by looking at nothing at all. Every ✗ above names a store the port ANSWERED about; a run where
// the port answered for nobody, or where no body was ever read, would print ✓ lines and prove exactly
// nothing. So zero is a failure here, not a note.
if (gatelessProved === 0) {
  bad(
    `NO DOOR OF ${tenant} WAS PROVED FREE OF A GATE`,
    `this run read the body of zero doors, so «no route serves the portaria» is a claim it did not check. ` +
      'Either the port could not be asked for any store (each one is named above) or every door failed before ' +
      'its body was read.',
  );
} else {
  say(
    `  ⓘ ${gatelessProved} door(s) proved free of a gate — the port names nobody filling ` +
      `\`${GATE_TARGET}\`, and no body carried a gate screen or the structural-gap refusal.`,
  );
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
