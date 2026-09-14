// ★★ THE DOORS STEP GOES RED WHEN A DOOR IS SHUT — graded against a FAKE BOX, on a real socket.
//
// This grades `bin/prove-doors.mjs` the way `warm-box.test.mjs` grades its step: a real http server on a
// real port speaking the faces the step uses (`read.internal.stores`, and the doors themselves), the step
// spawned as the birth spawns it, and what is graded is its exit code and what it printed.
//
// ⚠️ A SERVER AND NOT A MOCK, for the reason the sibling file gives: the whole risk of this step is on the
// wire. The defect it was written for was an EDGE rule that claimed one path and not its children — a mock
// of `fetch` would have agreed with whatever the step believed.
//
//   node --test bin/prove-doors.test.mjs      (or: bash bin/test.sh)

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';
import { candidates, checkout } from './release-tree.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STEP = join(ROOT, 'bin/prove-doors.mjs');
const TOKEN = 'fot_test';
const run = promisify(execFile);

/**
 * The tenant this fixture speaks for — `forgeco` is declared in `seed/box.json` with both its stores.
 *
 * ⚠️ NEITHER ROW CARRIES `storefront_enabled`, ON PURPOSE: that is the answer of a kernel OLDER than the
 * capability, which a box pinning images by digest can really be, and the rule is that an absent field means
 * the store is ON THE STREET (`bin/servable.mjs`). So every test below that expects doors to be opened is
 * also grading that the legacy shape does not empty a box.
 */
const TENANT = 'forgeco';
const STORES = [
  { id: 'sto_FORGE', handle: 'forge', name: 'Forge' },
  { id: 'sto_OUTLET', handle: 'outlet', name: 'Forge Outlet' },
];

/**
 * ★★ THE SECOND TENANT OF `seed/box.json`, AND IT IS THE WHOLE POINT OF THE pk19 TESTS BELOW. `forgecafe`
 * declares `cafe` (its bootstrap store) and `balcao` — the counter the totem serves. Until 2026-09-07 this
 * step had never opened either of them in any run: it printed the café's NAME over the OTHER tenant's stores.
 *
 * ★★ pk21 — WHAT DECIDES `balcao`'s PAGE IS THE PORT, NOT THE FILE. `read.internal.stores` publishes
 * `storefront_enabled` (derived from the store's `status`), and `seed/box.json` carries no hand-written
 * `servable` flag beside it.
 *
 * ★★★ pk22 — AND THE BOX NOW SAYS THE WORD THE PORT DERIVES IT FROM. `seed/box.json` declares
 * `status: "private"` on the counter, `bin/seed-box.mjs` writes it with `tenant.store.create`/`.update`, and
 * this fixture is what the port answers afterwards. ⚠️ `CAFE_ON_THE_STREET` STOPPED BEING «today's box» and
 * became a SABOTAGE: a counter answering `storefront_enabled: true` while the file still declares it private
 * is the shop back on the vitrine, and the test below demands a red that names it. (Until 2026-09-07 the
 * real port did answer `true` for `balcao` — every store was `active` — which is what this slice changed.)
 */
const CAFE_TENANT = 'forgecafe';
const CAFE_STORES = [
  { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café', storefront_enabled: true },
  { id: 'sto_BALCAO', handle: 'balcao', name: 'Balcão', storefront_enabled: false },
];

/** ⛔ NOT today's answer any more — the box where the counter went back to the vitrine. See SABOTAGE 1. */
const CAFE_ON_THE_STREET = CAFE_STORES.map((s) => ({ ...s, storefront_enabled: true }));

/**
 * ── ★★★ pk33 · THE GATE, AS THIS BOX WOULD ANSWER IT ────────────────────────────────────────────────────
 *
 * `seed/box.json` declares every store gated unless it says `gate: false`, and exactly one does: `cafe`,
 * whose forked vitrine owns no gate registry (the reason is written out in that file and in
 * `seed/coffee.mjs`). So a healthy box answers `demo-gate` on `read.extensions` for every store but that one.
 *
 * ★ THE MARKS ARE THE REAL ONES. `data-testid="demo-gate"` is what `apps/demo-gate/block/gate.tsx` renders and
 * `apps/demo-gate/block/marks.test.tsx` pins to the manifest id; `data-testid="composition-gap"` is the
 * PRODUCT's visible refusal of a structural slot a build cannot draw. A fixture that invented its own strings
 * would grade the probe against a box no deployable can be.
 */
const GATE_APP = 'demo-gate';
const GATE_TARGET = 'storefront:gate';
const DEFAULT_GATES = (handle) => (handle === 'cafe' ? null : GATE_APP);

const gateBody = (app) =>
  `<html><body><div data-testid="${app}"><h1>Loja demo.</h1></div></body></html>`;
const gapBody = (app) =>
  `<html><body><div data-testid="composition-gap" data-extension="${app}"></div></body></html>`;
/**
 * The shop. DIFFERENT per door on purpose: two doors answering the same bytes would hide a probe that
 * compared the wrong pair.
 *
 * ★★★ AND IT CARRIES THE RIBBON, WHICH IS THE POINT OF THIS FUNCTION AND NOT DECORATION. A store whose gate
 * is DISMISSED renders the gate app's persistent bar at the foot of the page, and its mark is
 * `data-testid="demo-gate-ribbon"` — the interstitial's mark plus a suffix. ⛔ A probe that looked for
 * `data-testid="demo-gate` without the CLOSING QUOTE would match it, conclude the gate is unescapable, and
 * redden every door of a perfectly healthy box. (This house has paid for that class of bug twice this week:
 * `/jq/` matched inside a temp path, `/demo/` matched `demorou`.) Every green below is therefore also a
 * standing proof that the match is exact.
 */
const shopBody = (handle, path) =>
  `<html><body><main data-testid="shop">${handle}${path || '/'}</main>` +
  `<form data-testid="${GATE_APP}-ribbon"></form></body></html>`;
/** ⛔ THE SAME SHOP WITH THE RIBBON GONE — a front that mounts the interstitial and not the bar under it.
 *  Byte-identical otherwise, so what the step reddens for can only be the ribbon. See SABOTAGE below. */
const shopBodyWithoutRibbon = (handle, path) =>
  `<html><body><main data-testid="shop">${handle}${path || '/'}</main></body></html>`;

/**
 * A box that answers.
 *
 * `shut` names the door paths this box will 404 instead of serving — that is the defect being reproduced:
 * the edge claimed `/account` and never its children, so `/account/login` fell through to the vitrine.
 * `mislead` names the doors that answer the right CODE from the WRONG front, which is the second thing the
 * step grades and the one a status code alone cannot see.
 *
 * ★ `credentialTenant` and `stores` MOVE TOGETHER ON PURPOSE — they are the one fact this box holds that the
 * step cannot get from its arguments: the internal read face resolves the tenant from the CREDENTIAL, so a
 * token can only ever be answered with its OWN tenant's identity and its OWN tenant's stores. A fixture that
 * let them disagree would be a box no kernel can be.
 */
function fakeBox({
  shut = [],
  mislead = [],
  credentialTenant = TENANT,
  stores = STORES,
  shutFor = {},
  stillServes = [],
  pageServedBy = {},
  gates = DEFAULT_GATES,
  ignoresCookie = false,
  neverLetsGo = false,
  /** Doors (by path, `''` for the vitrine) whose front draws the shop and NOT the demo ribbon. */
  noRibbon = [],
  refusesGate = [],
  leaksGate = [],
  extensionsRefuses = false,
  /**
   * ★★★ pk34/d1 — WHAT THE KERNEL'S GLOBAL ADDRESS BOOK ANSWERS, `hostname → store`. It is the table
   * `read.store.by_host` serves and `bin/store-host.mjs` writes at step 6b, and it is SEPARATE from every
   * other fact this fixture holds on purpose: a box can answer perfectly at `/s/<id>/…` while its directory
   * claims the wrong store — or no store — for a hostname `seed/box.json` declares. Empty is what a
   * LOCALHOST BIRTH really leaves, which is why it is the default.
   */
  directory = {},
} = {}) {
  /**
   * ★★ pk22 — THE FAKE VITRINE IS NOW HONEST ABOUT A STORE WITH NO PUBLIC PAGE, and without this the whole
   * slice would have been graded against a box no kernel can be. The real vitrine mounts
   * `requirePublicStorefront` in its store-scoped layout and answers its OWN 404 (served by `storefront`)
   * for a store whose `storefront_enabled` is false — while the checkout deployable, which mounts only
   * `requireStore`, keeps serving `/checkout`, `/account` and `/account/login` for the same store.
   *
   * THREE SABOTAGE SEAMS, one per way this can be wrong on a real box:
   *   · `shutFor: { balcao: ['/checkout'] }` — the vitrine's refusal LEAKING into the other deployable.
   *   · `stillServes: ['balcao']`            — the page of an off-street store still being SERVED (200).
   *   · `pageServedBy: { balcao: 'checkout' }` — the right code from the wrong front: a 404 the EDGE
   *     produced by sending the request somewhere else, which proves nothing about the vitrine's refusal.
   */
  const idOf = new Map(stores.map((row) => [row.id, row]));
  const offTheStreet = (id) => idOf.get(id)?.storefront_enabled === false;
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    // ★ WHOAMI IS THE FACE'S ANSWER TO "whose token is this", and the step now asks it before it opens
    // anything. It is served here with the SAME credential check as `stores` because on the real face it is
    // the same face: one credential, one tenant, no header in the question.
    if (url.pathname === '/v1/read/internal/whoami') {
      if (req.headers.authorization !== `Bearer ${TOKEN}`) {
        res.writeHead(401).end('{}');
        return;
      }
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ actor_id: 'act_test', tenant_id: credentialTenant, scopes: [] }));
      return;
    }
    // ★★★ pk33 — THE ANONYMOUS READ THE STORE LAYOUT ITSELF MAKES. No credential: a visitor's browser carries
    // none, and the probe asks exactly the question the front asks or it is grading a different fact.
    if (url.pathname === '/v1/read/extensions') {
      // A port that answers 5xx to the read the store layout makes: the front cannot resolve a gate either,
      // so this is a box where nobody knows whether there is a front door.
      if (extensionsRefuses) {
        res.writeHead(503, { 'content-type': 'application/json' }).end('{"error":{"kind":"unavailable"}}');
        return;
      }
      const store = idOf.get(url.searchParams.get('store') ?? '');
      const app = store ? gates(store.handle) : null;
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(
          JSON.stringify(
            app
              ? [{ extension_id: app, hooks: [{ component: 'gate', target: GATE_TARGET, position: 0 }] }]
              : [],
          ),
        );
      return;
    }
    // ★ THE GLOBAL DIRECTORY: public, actorless, and the same read every consumer that resolves an
    // address THROUGH THE PORT makes. 404 is «no store claims it», which is what a bench answers.
    if (url.pathname === '/v1/read/store.by_host') {
      const id = directory[(url.searchParams.get('host') ?? '').toLowerCase()];
      res
        .writeHead(id ? 200 : 404, { 'content-type': 'application/json' })
        .end(JSON.stringify(id ? { store_id: id } : { error: { kind: 'not_found' } }));
      return;
    }
    if (url.pathname === '/v1/read/internal/stores') {
      if (req.headers.authorization !== `Bearer ${TOKEN}`) {
        res.writeHead(401).end('{}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(stores));
      return;
    }
    const m = url.pathname.match(/^\/s\/([^/]+)(.*)$/);
    if (!m) {
      res.writeHead(404).end('');
      return;
    }
    const path = m[2] ?? '';
    const store = idOf.get(m[1]);
    // The vitrine's own refusal, from the vitrine, for a store the port says has no public page.
    // ⚠️ BEFORE THE GATE, AND THAT ORDER IS THE DEPLOYABLE'S: both the reference vitrine and the café's fork
    // mount `requirePublicStorefront` in the store layout ABOVE the gate branch, so a store with no public
    // page is refused before any gate could render — and the refusal is the same with or without the cookie.
    if (path === '' && offTheStreet(m[1]) && !stillServes.includes(store?.handle)) {
      res
        .writeHead(404, { 'x-forge-served-by': pageServedBy[store?.handle] ?? 'storefront' })
        .end('');
      return;
    }
    // …and the sabotage: that refusal reaching a door the vitrine does not own.
    if ((shutFor[store?.handle] ?? []).includes(path)) {
      res.writeHead(404, { 'x-forge-served-by': 'checkout' }).end('');
      return;
    }
    if (shut.includes(path)) {
      // The vitrine's own 404 — served by the vitrine, exactly as the real fall-through was.
      res.writeHead(404, { 'x-forge-served-by': 'storefront' }).end('');
      return;
    }
    const by = mislead.includes(path) ? 'storefront' : path === '' ? 'storefront' : 'checkout';
    // ── ★★★ pk33 · THE GATE, AND THE SHAPE IS THE ONE MEASURED ON THE LIVE DEMO (2026-09-11) ──────────────
    //
    // With no dismissal cookie the interstitial COVERS the route — including `/account`, which answers 200
    // with the gate instead of its 307, because the page component (and its `redirect()`) never renders. With
    // the cookie the door answers exactly what it always did. Both facts were curled against
    // https://demo.forgecommerce.pro before this fixture was written; see `bin/prove-doors.mjs`'s header.
    const app = gates(store?.handle);
    const dismissed = /(^|;\s*)forge_gate_dismissed=1(;|$)/.test(req.headers.cookie ?? '');
    // A gate SCREEN on a store the port says nobody gates: a front pinned to an image whose registry still
    // welds the entry, or a placement removed in the data and cached in the front. Nothing about the
    // declaration can see it — only the body can.
    if (!app && leaksGate.includes(store?.handle)) {
      res.writeHead(200, { 'x-forge-served-by': by }).end(gateBody(GATE_APP));
      return;
    }
    if (app && refusesGate.includes(store?.handle)) {
      // The front cannot DRAW the gate the port declares: the structural-gap refusal, on every door.
      res.writeHead(200, { 'x-forge-served-by': by }).end(gapBody(app));
      return;
    }
    if (app && (!dismissed || neverLetsGo) && !ignoresCookie) {
      res.writeHead(200, { 'x-forge-served-by': by }).end(gateBody(app));
      return;
    }
    if (path === '/account') {
      res
        .writeHead(307, { location: `/s/${m[1]}/account/login`, 'x-forge-served-by': by })
        .end(shopBody(store?.handle ?? '?', path));
      return;
    }
    const shop = noRibbon.includes(path) ? shopBodyWithoutRibbon : shopBody;
    res.writeHead(200, { 'x-forge-served-by': by }).end(shop(store?.handle ?? '?', path));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ api: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

const step = (api, tenant = TENANT) =>
  run('node', [STEP, '--tenant', tenant, '--api', api], {
    env: { ...process.env, FORGE_SEED_TOKEN: TOKEN },
  }).then(
    (r) => ({ code: 0, out: r.stdout }),
    (e) => ({ code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }),
  );

test('every door open ⇒ green, and it says which front answered', async () => {
  const box = await fakeBox();
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 0, out);
  assert.match(out, /VERDICT: every door of forgeco answers as it must/);
  assert.match(out, /forge\/account\/login .* checkout/);
});

test('★ THE DEFECT: the login page 404s ⇒ red, naming the store and the path', async () => {
  const box = await fakeBox({ shut: ['/account/login'] });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  // Both stores, because the edge rule that broke was generic — a red on one of two would have been the
  // hand-written per-store workaround still standing.
  assert.match(out, /✗ forge\/account\/login/);
  assert.match(out, /✗ outlet\/account\/login/);
  assert.match(out, /VERDICT: 2 door\(s\) of forgeco do NOT answer as they must/);
});

test('★ the right code from the WRONG front is still red', async () => {
  const box = await fakeBox({ mislead: ['/checkout'] });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /served by "storefront", not "checkout"/);
});

test('no token ⇒ the run REFUSES; it never grades a smaller set', async () => {
  const box = await fakeBox();
  const r = await run('node', [STEP, '--tenant', TENANT, '--api', box.api], {
    env: { ...process.env, FORGE_SEED_TOKEN: '' },
  }).then(
    (x) => ({ code: 0, out: x.stdout }),
    (e) => ({ code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }),
  );
  await box.close();
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /this step could not ask/);
});

test('the port refusing the credential is NOT a green and NOT a red', async () => {
  const box = await fakeBox();
  const r = await run('node', [STEP, '--tenant', TENANT, '--api', box.api], {
    env: { ...process.env, FORGE_SEED_TOKEN: 'wrong-token' },
  }).then(
    (x) => ({ code: 0, out: x.stdout }),
    (e) => ({ code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }),
  );
  await box.close();
  assert.equal(r.code, 2, r.out);
  // ⚠️ pk19 MOVED WHICH READ REPORTS THIS. `whoami` is now asked FIRST — a token the face refuses is refused
  // there, one read before `stores`, so this assertion names the read that actually answers 401 today.
  assert.match(r.out, /read\.internal\.whoami answered 401/);
});

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// ★★★ pk19 · WHOSE DOORS ARE THESE? — the half this step was missing, and it was missing it in production.
//
// ⛔ MEASURED 2026-09-07 ON THE LIVE BENCH: `--tenant forgecafe` printed «THE DOORS OF forgecafe», opened
// `forge/…` and `outlet/…` — the two stores of `forgeco` — and signed «every door of forgecafe opens». The
// café's own stores had never been opened by this step in any run, and `bin/box-up.sh` runs it once per
// tenant and adds the two greens.
//
// THE ARGUMENT NEVER TRAVELLED. `read.internal.stores` resolves the tenant from the CREDENTIAL and ignores
// `x-forge-tenant` — so `--tenant` was a LABEL printed over somebody else's list. What follows grades the
// step's new first question (`whoami`), its declaration cross-check, and its refusal to call a run with no
// door in it a green.
// ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('★★★ THE pk19 DEFECT: a credential from the OTHER tenant ⇒ the run REFUSES, and never signs the name it was given', async () => {
  // The box is `forgeco`'s — its token, its identity, its stores — and the run asks for `forgecafe`. That is
  // exactly the shell the defect was found in: `source env-source.sh` exports the FIRST tenant's token.
  const box = await fakeBox();
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 2, out);
  assert.match(out, /THIS CREDENTIAL BELONGS TO "forgeco", NOT "forgecafe"/);
  // The signature the defect produced must be impossible now, and so must the ✓ lines under it.
  assert.doesNotMatch(out, /VERDICT: every door of forgecafe answers as it must/);
  assert.doesNotMatch(out, /✓ forge\//);
  assert.doesNotMatch(out, /✓ outlet\//);
  assert.match(out, /Nothing above is a claim about forgecafe/);
});

// ⚠️ THE NEXT TWO ARE THE DoD, NOT THE DISCRIMINATOR — and saying so is the point. MEASURED: both of them
// PASS against the pre-pk19 file, because a step that lists whatever the token owns lists the café's stores
// correctly the moment it is handed the café's token. The defect only exists when the NAME and the
// CREDENTIAL disagree, which is the test above. Read these two as "the café's doors are stated somewhere",
// never as "the fix works".
test('★★ THE CAFÉ, at last: its own credential opens `cafe` and NEVER `forge`/`outlet`', async () => {
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: CAFE_STORES });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 0, out);
  assert.match(out, /✓ cafe\/account\/login .* checkout/);
  assert.match(out, /VERDICT: every door of forgecafe answers as it must/);
  assert.doesNotMatch(out, /forge\/|outlet\//);
});

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// ★★★ pk22 · THE COUNTER LEFT THE STREET — and what that must and must NOT close.
//
// `seed/box.json` now declares `status: "private"` on `balcao`: its front is the totem, so the reference
// vitrine has no business serving it. Everything below grades the two halves of that one decision, and the
// second half is the one that can hurt somebody — a person who paid at the till and cannot open the order.
// ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('★★★ the counter: its vitrine page is proved SHUT (⊘) and its checkout, account and LOGIN are proved OPEN', async () => {
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: CAFE_STORES });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 0, out);

  // ── the half that CLOSES — ONE line for one door, and it carries the PORT's reason ──
  const page = out.split('\n').find((l) => l.includes('⊘ balcao/'));
  assert.ok(page, `the counter's page is not graded as a door proved shut:\n${out}`);
  assert.match(page, /404/, `the page was not demanded 404: ${page}`);
  assert.match(page, /storefront/, `a 404 that did not come from the VITRINE proves nothing: ${page}`);
  // Announced BY NAME with the reason — a door absent from a report reads exactly like one that failed —
  // and the reason is the PORT's, so a reader can go and ask the box the same question.
  assert.match(page, /storefront_enabled/, `the ⊘ line does not name the field that decided it: ${page}`);
  assert.match(page, /read\.internal\.stores/, `the ⊘ line does not name the read that answered: ${page}`);

  // ── ★★ the half that MUST NOT: this is the whole point of the slice ──
  assert.match(out, /✓ balcao\/checkout .* checkout/, out);
  assert.match(out, /✓ balcao\/account .* checkout/, out);
  assert.match(out, /✓ balcao\/account\/login .* checkout/, out);

  // …and `seed/box.json` still declares no `servable` — the word it declares is the KERNEL's `status`, which
  // the port derives the boolean from. `bin/servable.test.mjs` is the guard; this is why it matters here.
  const declared = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'))
    .tenants.find((t) => t.id === CAFE_TENANT)
    .stores.find((s) => s.handle === 'balcao');
  assert.ok(!('servable' in declared), 'seed/box.json declares `servable` again — two truths about one store.');
  assert.equal(declared.status, 'private', 'the counter no longer declares itself off the street.');
});

test('★★★ SABOTAGE 1 — the counter is BACK ON THE STREET ⇒ red, naming the store that returned to the vitrine', async () => {
  // The file still says `private`; the port answers `storefront_enabled: true`. That is a re-provision that
  // reset the column, a birth whose step 6 never ran, or a hand that put the shop back — and NOTHING ELSE ON
  // THIS BOX WOULD SAY SO: every other step reads the port and would grade `balcao` as an ordinary shop,
  // opening four doors and signing a green.
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: CAFE_ON_THE_STREET });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('IS BACK ON THE VITRINE'));
  assert.ok(line, `the store that returned to the vitrine is not named:\n${out}`);
  assert.match(line, /✗ balcao/, `the red does not name the store: ${line}`);
  assert.match(line, /storefront_enabled/, `the red does not name the fact that decided it: ${line}`);
  assert.match(line, /seed\/box\.json/, `the red does not name the declaration it disagrees with: ${line}`);
  assert.doesNotMatch(out, /VERDICT: every door of forgecafe answers as it must/);
  // ⚠️ AND THE OTHER STORE IS NOT COLLATERAL. `cafe` declares no status and must be graded exactly as before.
  assert.match(out, /✓ cafe\/account\/login .* checkout/, out);
});

test('★★★ SABOTAGE 1-bis — the counter is off the street and the VITRINE IS STILL SERVING ITS PAGE ⇒ red', async () => {
  // The port says the store has no public page and `/s/<balcao>` answers 200 anyway. That is the front
  // pinned to an older image (`requirePublicStorefront` is what refuses, and a fork may not mount it), or an
  // edge rule sending the path to a front that never asked the question. Either way the merchant asked for
  // one thing and a visitor gets another, and nothing else on this box looks at the page of a store the port
  // has already excused.
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: CAFE_STORES,
    stillServes: ['balcao'],
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.startsWith('  ✗ balcao/ '));
  assert.ok(line, `the page that is still being served is not named as a failure:\n${out}`);
  assert.match(line, /still serving/, `the red does not say what is wrong: ${line}`);
  assert.match(line, /200/, `the red does not carry the answer it got: ${line}`);
  // …and the doors that must stay open are still green in the same run: one defect, one red.
  assert.match(out, /✓ balcao\/account\/login .* checkout/, out);
});

test('★★ SABOTAGE 1-ter — the page 404s from the WRONG front: a 404 the edge produced proves nothing', async () => {
  // ⚠️ THE DIFFERENCE A STATUS CODE CANNOT SEE, and it is the lesson this whole step was written for. If the
  // 404 comes from the CHECKOUT container, the vitrine was never asked and its refusal was never exercised —
  // the edge simply sent `/s/<balcao>` somewhere that does not serve it. The day the edge rule is fixed, the
  // page comes back on the street with this step still green.
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: CAFE_STORES,
    pageServedBy: { balcao: 'checkout' },
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /✗ balcao\/ .*served by "checkout", not "storefront"/, out);
});

test('★★★ SABOTAGE 2 — the vitrine\'s refusal LEAKS into the checkout ⇒ red, naming the door that must not close', async () => {
  // The shape, measured in the product on 2026-09-07: mounting `requirePublicStorefront` in
  // `apps/checkout/src/app/s/[store]/layout.tsx` left the whole checkout suite green (765 tests). On a box it
  // reads as this: the counter's own checkout, account and login start answering the vitrine's 404. The
  // person who paid at the till cannot open the order they just paid for, and until this slice this step was
  // SKIPPING those three doors for exactly the stores where it happens.
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: CAFE_STORES,
    shutFor: { balcao: ['/checkout', '/account', '/account/login'] },
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  for (const door of ['/checkout', '/account', '/account/login']) {
    const line = out.split('\n').find((l) => l.includes(`✗ balcao${door} `));
    assert.ok(line, `the door that must not close is not named as a failure: balcao${door}\n${out}`);
    assert.match(
      line,
      /MUST NOT CLOSE WITH IT/,
      `the red does not say that this door is not the vitrine's page: ${line}`,
    );
  }
  // ⚠️ AND THE PAGE ITSELF IS STILL A GREEN in the same run — the two facts are independent, and a step that
  // reddened both would be telling a reader the counter's refusal is the defect.
  assert.match(out, /⊘ balcao\//, out);
});


test('★★ SABOTAGE, THE VACUUM: the port holds NONE of the declared stores ⇒ red naming them, never an empty green', async () => {
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: [] });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /✗ cafe .*declared in seed\/box\.json and NOT in this box/);
  assert.match(out, /✗ balcao .*declared in seed\/box\.json and NOT in this box/);
  assert.doesNotMatch(out, /VERDICT: every door of \w+ answers as it must/);
});

test('a tenant `seed/box.json` does not declare ⇒ the run REFUSES; it has no declaration to grade against', async () => {
  const box = await fakeBox({ credentialTenant: 'forgenope', stores: [] });
  const { code, out } = await step(box.api, 'forgenope');
  await box.close();
  assert.equal(code, 2, out);
  assert.match(out, /seed\/box\.json declares no tenant "forgenope"/);
  assert.match(out, /forgeco/, 'the refusal must name what the file DOES declare, or it is a dead end');
});

// ── ★★★ THE VACUUM, AND pk22 MOVED WHAT IT LOOKS LIKE ──────────────────────────────────────────────────
//
// "Every store of this tenant has no public page" used to be the shape that made this step print a green
// over ZERO opened doors: it skipped such a store whole, so a box of them was a report with nothing in it.
// IT IS NOT THAT SHAPE ANY MORE, and saying so is half the value of this test — the counter's checkout,
// account and login are graded whatever its page does, so the only way to grade nothing is to hold nothing.
//
// The refusal itself did not move: `opened === 0` is still asserted directly rather than trusted to the
// reasons above, because every way this step can go blind decays into an empty report under a green verdict.
test('★★★ THE VACUUM: every store off the street is NOT an empty run — the doors that stay open are still graded', async () => {
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: [
      { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café', storefront_enabled: false },
      { id: 'sto_BALCAO', handle: 'balcao', name: 'Balcão', storefront_enabled: false },
    ],
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  // ⚠️ GREEN, and the green is the assertion. `cafe` declares no `status`, and an undeclared status is «this
  // box has no opinion» — the same rule the checkout flags live by — so nothing is graded against the file
  // here. What IS graded is every door, and this is a box where the old shape graded none of them.
  assert.equal(code, 0, out);
  // Both stores' three non-vitrine doors were opened, by the front that owns them.
  assert.match(out, /✓ balcao\/account\/login .* checkout/, out);
  assert.match(out, /✓ cafe\/account\/login .* checkout/, out);
  assert.match(out, /⊘ balcao\//, out);
  assert.doesNotMatch(out, /NO DOOR OF forgecafe WAS OPENED/, `an all-private box is no longer a vacuum:\n${out}`);
});

test('★★★ SABOTAGE, THE PURE VACUUM: a run that graded ZERO doors is not a green, whatever else it found', async () => {
  // The only remaining way to ask nothing: the port hands back no store at all. Nothing is "shut" here and
  // nothing was mis-served — the old shape would have signed «every door opens» over an empty report.
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: [] });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /NO DOOR OF forgecafe WAS OPENED/);
  assert.match(out, /proves nothing about this tenant/);
  assert.doesNotMatch(out, /VERDICT: every door of \w+ answers as it must/);
});

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// ★★★ pk33 · THE GATE — BOTH SIDES OF THE DISMISSAL COOKIE
//
// ⛔ THE SILENCE THIS ENDS, MEASURED 2026-09-11: `apps/demo-gate` was installed by NO step of the birth, and
// had not been for days, with every birth green. Nothing anywhere verified that the gate APPEARS — this step
// graded the status code and the container, and both are identical whether a visitor meets the "Loja demo."
// screen or walks straight into the shop.
//
// ★ EVERY TEST BELOW GRADES A BODY, never a status. That is not a preference: the gate answers 200 from the
// same container as the shop, so a status code cannot see the difference at all.
// ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('★★★ the gate is proved on BOTH sides — the ✓ line says so, door by door', async () => {
  const box = await fakeBox();
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 0, out);
  // Not "somewhere in the report": the verdict has to be readable per door, or a reader cannot tell which
  // doors were proved and which were merely opened.
  for (const door of ['/', '/checkout', '/account', '/account/login']) {
    const label = `forge${door}`;
    const line = out.split('\n').find((l) => l.includes(`✓ ${label} `));
    assert.ok(line, `no ✓ line for ${label}:\n${out}`);
    assert.match(line, /gate ✓ \(demo-gate without the cookie, the shop with it\)/, line);
  }
  assert.match(out, /door\(s\) proved on BOTH sides of `forge_gate_dismissed`/, out);
});

test('★★★ SABOTAGE — THE GATE IS NOT INSTALLED ⇒ red naming every store, which is the defect that ran for days', async () => {
  // Exactly the box of 2026-09-11: the app composed into the image, filling nothing, and four shops open to
  // the street. Every other step on this box was green through all of it.
  const box = await fakeBox({ gates: () => null });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  for (const handle of ['forge', 'outlet']) {
    const line = out.split('\n').find((l) => l.includes(`✗ ${handle} `) && l.includes('NO APP FILLS'));
    assert.ok(line, `the store with no front door is not named: ${handle}\n${out}`);
    assert.match(line, /storefront:gate/, `the red does not name the slot: ${line}`);
    assert.match(line, /seed\/box\.json/, `the red does not name the declaration it disagrees with: ${line}`);
  }
  assert.doesNotMatch(out, /VERDICT: every door of forgeco answers as it must/);
});

test('★★★ SABOTAGE — THE BOX IGNORES THE COOKIE (the shop on both sides) ⇒ red: a visitor meets no gate', async () => {
  // ⚠️ THIS IS ALSO THE SHAPE OF A PROBE THAT SENT THE DISMISSAL COOKIE ON BOTH SIDES. Graded from the
  // outside the two are the same box: both sides answer the shop. If this went green, the whole two-sided
  // proof would be one side twice.
  const box = await fakeBox({ ignoresCookie: true });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('✗ forge/ '));
  assert.ok(line, `the door that shows no gate is not named:\n${out}`);
  assert.match(line, /NO GATE ON THIS DOOR/, line);
  assert.match(line, /forge_gate_dismissed/, `the red does not name the cookie it sent: ${line}`);
});

test('★★★ SABOTAGE — THE GATE WILL NOT LET GO (the gate on both sides) ⇒ red: the shop is unreachable', async () => {
  // The mirror, and the reason rule 1 alone is not enough: a probe that only demanded the gate would sign a
  // green over a demo nobody can get INTO.
  const box = await fakeBox({ neverLetsGo: true });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('✗ forge/ '));
  assert.ok(line, `the door that never opens is not named:\n${out}`);
  assert.match(line, /THE GATE WILL NOT LET GO/, line);
});

test('★★★ SABOTAGE — THE FRONT DROPS THE RIBBON ⇒ red, naming the door and the front that served it', async () => {
  // ⛔ THE SILENCE THIS CLOSES, and it is the one he asked about on 13/09: «a demo gate tem uma feature que
  // aparece uma barrinha no rodapé… só precisa checar se isso aparece nos 4 front». Until pk35/d1 the cookie
  // side was graded only for what it must NOT contain, so a front that mounted the interstitial and not the
  // bar under it was a GREEN birth with no way back to the gate. The box below is byte-identical to a healthy
  // one except for that one element on ONE door, which is what makes this a statement about the ribbon.
  const box = await fakeBox({ noRibbon: ['/checkout'] });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('✗ forge/checkout'));
  assert.ok(line, `the door with no ribbon is not named:\n${out}`);
  assert.match(line, /THE WAY BACK IS MISSING/, line);
  assert.match(line, /demo-gate-ribbon/, `the red does not name the mark it looked for: ${line}`);
  assert.match(line, /checkout/, `the red does not name the front that served it: ${line}`);
  // …and the doors that DO draw it are untouched in the same run, so this is not a step that simply broke.
  assert.match(out, /✓ forge\/ .* gate ✓/, out);
});

test('★★ SABOTAGE — the front CANNOT DRAW the declared gate ⇒ its own red, not "no gate"', async () => {
  // A different failure and it needs a different sentence: the port declares a gate, the front has no
  // implementation, and `storefront:gate` is STRUCTURAL, so the page is refused rather than opened
  // (`CompositionGapNotice`). Telling an operator "no gate on this door" here would send them to fix the
  // seed, which is the one thing that is right.
  const box = await fakeBox({ refusesGate: ['forge'] });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('✗ forge/ '));
  assert.ok(line, `the refused door is not named:\n${out}`);
  assert.match(line, /CANNOT DRAW the gate the port declares/, line);
  assert.doesNotMatch(line, /NO GATE ON THIS DOOR/, `two different defects must not share one sentence: ${line}`);
  // …and the store whose front is fine is untouched in the same run.
  assert.match(out, /✓ outlet\/ .* gate ✓/, out);
});

test('★★★ the café is gateless BY DECLARATION — a green, announced, with the reason from the file', async () => {
  // His decision is that the whole demo is gated; this store is the ONE exception, and the exception is in
  // `seed/box.json` where a reader meets it, not buried in a seed. A green that says nothing about it would
  // be indistinguishable from a gate that went missing.
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: CAFE_STORES });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 0, out);
  const line = out.split('\n').find((l) => l.includes('ⓘ cafe ') && l.includes('no gate'));
  assert.ok(line, `the gateless store is not announced:\n${out}`);
  assert.match(line, /BY DECLARATION/, line);
  assert.match(line, /storefront-coffee/, `the announcement does not carry the file's own reason: ${line}`);
  // …and the COUNTER, whose front is the totem, keeps its gate on the three doors it still serves.
  assert.match(out, /✓ balcao\/account\/login .* gate ✓ \(demo-gate/, out);
  // ⚠️ AND ITS VITRINE PAGE IS EXEMPT, NOT GATED: `requirePublicStorefront` refuses above the slot.
  assert.match(out, /⊘ balcao\/ .* gate n\/a \(refused above the slot\)/, out);

  // ★ THE DECLARATION IS REALLY IN THE FILE — a test that only read the probe's output would stay green if
  // the key were dropped and the default (gated) silently took over.
  const declared = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'))
    .tenants.find((t) => t.id === CAFE_TENANT)
    .stores.find((s) => s.handle === 'cafe');
  assert.equal(declared.gate, false, 'seed/box.json no longer declares the café gateless.');
  assert.match(declared._gate_why ?? '', /storefront-coffee/, 'the exception carries no written reason.');
});

test('★★ SABOTAGE — the café is declared gateless and the PORT gates it anyway ⇒ red', async () => {
  // The removal never ran, or a reinstall put the placement back. The screen would be the structural-gap
  // refusal on every page of the coffee shop, and the declaration is the only thing that knows better.
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: CAFE_STORES,
    gates: () => GATE_APP,
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('✗ cafe ') && l.includes('gate: false'));
  assert.ok(line, `the disagreement between the file and the port is not named:\n${out}`);
  assert.match(line, /dropGateOnTheCafe/, `the red does not name who was supposed to remove it: ${line}`);
});

test('★★ SABOTAGE — a gate SCREEN reaches a store the port says nobody gates ⇒ red (the negative control)', async () => {
  // ⚠️ THE CONTROL IS DERIVED, not typed: the mark it looks for is every gate this TENANT really carries,
  // learned from the port in the same run (here, the counter's). Nothing in the declaration can see this —
  // the port says "no gate on the café" and the café serves one anyway, which is a front pinned to an image
  // that still welds the entry.
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: CAFE_STORES,
    leaksGate: ['cafe'],
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('✗ cafe/ '));
  assert.ok(line, `the gate that leaked onto a gateless store is not named:\n${out}`);
  assert.match(line, /declared gateless and a gate screen/, line);
  assert.match(line, /demo-gate/, `the red does not name the screen it found: ${line}`);
});

test('★★ the port refusing `read.extensions` is a RED that names the store, never a silent abstention', async () => {
  // Every gate assertion hangs off this one read. A run that could not make it would otherwise print ✓ lines
  // for doors it graded on half the question — the exact shape of "green because it did not look".
  const box = await fakeBox({ extensionsRefuses: true });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /✗ forge .*read\.extensions could not be asked anonymously/, out);
});

// ── ★★ THE COOKIE NAME IS THE KIT'S, AND IT IS DERIVED FROM THE KIT ─────────────────────────────────────
//
// `bin/prove-doors.mjs` writes `forge_gate_dismissed` out as a literal — `bin/` runs on bare node and cannot
// import from a package the forks install as a tarball. A literal that nothing compares is a guess with a
// shelf life: the probe would keep sending a cookie nothing reads, BOTH sides would answer the gate, and rule
// 2 would go red naming the wrong thing. So the string is compared against the kit's own frozen constant.
test('★★ the dismissal cookie this probe sends IS the kit\'s frozen name', (t) => {
  const base = candidates().map((c) => checkout(c)).find(Boolean);
  if (!base) {
    t.skip(
      'no Forge checkout on this machine — set FORGE_MONOREPO=<a forge checkout>. Without it the cookie name ' +
        'in bin/prove-doors.mjs is compared against nothing, which is how a frozen constant drifts in silence.',
    );
    return;
  }
  const kit = readFileSync(join(base.path, 'packages/storefront-kit/src/cookies.ts'), 'utf8');
  const declared = kit.match(/GATE_DISMISSED_COOKIE\s*=\s*'([^']+)'/)?.[1];
  assert.ok(
    declared,
    `packages/storefront-kit/src/cookies.ts declares no GATE_DISMISSED_COOKIE at ${base.path}. This guard ` +
      'derives its whole answer from that line; without it there is nothing to compare and a green would mean ' +
      'nothing.',
  );
  const mine = readFileSync(STEP, 'utf8').match(/GATE_DISMISSED_COOKIE\s*=\s*'([^']+)'/)?.[1];
  assert.equal(
    mine,
    declared,
    `bin/prove-doors.mjs sends \`${mine}\` and the kit sets \`${declared}\`. A probe whose cookie nothing ` +
      'reads grades the gate on both sides and calls the gate unescapable.',
  );
});

test('★★★ the RIBBON is not the GATE — the match is exact, and a healthy box stays green because of it', async () => {
  // ⛔ THE SUBSTRING TRAP, ASSERTED RATHER THAN REASONED ABOUT. `demo-gate-ribbon` starts with `demo-gate`,
  // and the two marks are the OPPOSITE states: the interstitial means "this visitor has not been through",
  // the ribbon means "this visitor has". A probe matching the id without its closing quote would read every
  // dismissed page as the gate refusing to let go.
  const box = await fakeBox();
  // ⛔ ANTI-VACUUM FIRST: the fixture must really be serving the ribbon, or the green below means nothing.
  const dismissed = await fetch(`${box.api}/s/sto_FORGE/checkout`, {
    headers: { cookie: 'forge_gate_dismissed=1' },
  }).then((r) => r.text());
  assert.match(dismissed, /data-testid="demo-gate-ribbon"/, `the fixture serves no ribbon:\n${dismissed}`);
  assert.doesNotMatch(dismissed, /data-testid="demo-gate"/, 'the dismissed page must not carry the gate mark');

  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /THE GATE WILL NOT LET GO/, out);
});

// ── ★★★ pk34/d1 · THE ADDRESS EACH STORE IS PUBLISHED AT ─────────────────────────────────────────────────
//
// `seed/box.json` declares one hostname per store (`domain`) and — for the counter alone — `directory: false`,
// meaning a front of this box answers there and NO store may claim it in the kernel's address book. Nothing
// asserted either half before this slice, and the second is the one that bites: the kernel composes
// `https://<host>/account/orders/<id>` into every transactional message from that column, and the totem
// serves ONE route, so a claim there puts an «Acompanhar o pedido» button on every counter receipt pointing
// at a 404. It is exactly the fact a re-provision or a hand-edit flips in silence.

/** The declared faces of one tenant, read from the file so no hostname is typed in this suite. */
const facesOf = (tenantId) => {
  const t = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8')).tenants.find((x) => x.id === tenantId);
  return (t?.stores ?? []).flatMap((s) => (s.domain ? [{ handle: s.handle, ...s.domain }] : []));
};

test('★★★ pk34/d1 — a LOCALHOST birth claims none of its declared hostnames, and is told so, not accused', async () => {
  const faces = facesOf(CAFE_TENANT);
  assert.ok(faces.length >= 2, `forgecafe declares ${faces.length} store hostname(s) — this arm has nothing to grade.`);
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: CAFE_STORES });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 0, out);
  assert.match(out, /is not published at any of its \d+ declared hostname\(s\)/, out);
  // ⛔ ANTI-VACUUM: the counter's negative is a GREEN that must be stated, not an absence.
  assert.match(out, /claimed by no store in the kernel's directory/, out);
});

test('★★★ pk34/d1 — SABOTAGE: the COUNTER\'s hostname is claimed ⇒ red, and the reason is the receipt', async () => {
  const counter = facesOf(CAFE_TENANT).find((f) => f.directory === false);
  assert.ok(counter, 'seed/box.json declares no `directory: false` store — this sabotage has no subject.');
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: CAFE_STORES,
    directory: { [counter.host.toLowerCase()]: 'sto_BALCAO' },
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  assert.ok(out.includes(counter.host), `the red does not name ${counter.host}:\n${out}`);
  assert.match(out, /every receipt of that store now carries a button to a 404/, out);
});

test('★★★ pk34/d1 — SABOTAGE: a shop hostname claimed for ANOTHER store ⇒ red, naming both', async () => {
  const shop = facesOf(CAFE_TENANT).find((f) => f.directory !== false);
  assert.ok(shop, 'forgecafe declares no ordinary shop hostname.');
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: CAFE_STORES,
    directory: { [shop.host.toLowerCase()]: 'sto_SOMEBODY_ELSE' },
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /TWO STORES AT ONE ADDRESS/, out);
  assert.match(out, /sto_SOMEBODY_ELSE/, out);
});

test('★★★ pk34/d1 — a published box: each shop resolves to its own store and the counter to nobody ⇒ green', async () => {
  const faces = facesOf(CAFE_TENANT);
  const idOf = { cafe: 'sto_CAFE', balcao: 'sto_BALCAO' };
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: CAFE_STORES,
    directory: Object.fromEntries(
      faces.filter((f) => f.directory !== false).map((f) => [f.host.toLowerCase(), idOf[f.handle]]),
    ),
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 0, out);
  for (const face of faces) assert.ok(out.includes(face.host), `${face.host} is not in the report at all:\n${out}`);
  assert.match(out, /its declared hostname resolves to this store/, out);
  assert.doesNotMatch(out, /is not published at any of its/, out);
});
