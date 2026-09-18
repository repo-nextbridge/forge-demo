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
 * ── ★★★ v0.4 · THE GATE, AS THIS BOX ANSWERS IT: NOBODY FILLS IT ────────────────────────────────────────
 *
 * ⛔ THE DEFAULT TURNED OVER WITH THE RULE. It used to be «every store answers the demo's gate app on
 * `read.extensions`», because every store was gated; a healthy box now answers an EMPTY list, on every store,
 * and the step's job is to prove that and to name whoever appears there.
 *
 * ★ THE MARKS ARE STILL THE REAL ONES. `data-testid="composition-gap"` is the PRODUCT's visible refusal of a
 * structural slot a build cannot draw — the shape a half-removed gate takes, and the only one of these two
 * strings this repository does not own. The intruder's id is a fixture name on purpose: no app of this box
 * may fill that slot, so an id that matched one of ours would be a fixture that cannot happen.
 */
const GATE_TARGET = 'storefront:gate';
/** ⛔ A GATE THAT IS NOT OURS, which is the only kind that can still turn up on this box: an app installed by
 *  a hand, restored with a backup, or left behind by an image pinned before the removal. */
const INTRUDER_APP = 'some-gate-app';
const DEFAULT_GATES = () => null;

const gateBody = (app) =>
  `<html><body><div data-testid="${app}"><h1>Loja demo.</h1></div></body></html>`;
const gapBody = (app) =>
  `<html><body><div data-testid="composition-gap" data-extension="${app}"></div></body></html>`;
/**
 * The shop. DIFFERENT per door on purpose: two doors answering the same bytes would hide a probe that
 * compared the wrong pair.
 *
 * ⚠️ IT CARRIES NO RIBBON, AND THAT IS A DECISION THIS FIXTURE HAS TO STATE. What this step owes is the
 * opposite sentence — that nothing STANDS IN FRONT of the shop — and a body that also carried the notice
 * would let a probe silently start grading two rules through one fixture.
 *
 * ⛔ AND THE REASON WRITTEN HERE UNTIL v0.4/F5 IS NO LONGER THE TRUE ONE. It said the ribbon «is placed in
 * Compose, per store, by an operator», so demanding it of every door would assert a gesture as if it were an
 * invariant. It IS an invariant now: `seed/demo-setup.json` declares it and the birth places it in every
 * store this box keeps on the street. What holds that is `bin/ribbon-at-birth.guard.mjs`, statically, on a
 * laptop with no box running — which is where the defect actually arrives (one line deleted from a
 * declaration). ⇒ A LIVE probe of the ribbon at every door is a rule this step COULD now carry and does not,
 * said out loud rather than left as a fixture that looks like a decision.
 */
const shopBody = (handle, path) =>
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
  /** Stores whose front REFUSES the page with the structural-gap notice — a build that still believes the
   *  slot is filled. */
  refusesGate = [],
  /** Stores whose front still draws a gate SCREEN although the port names nobody: an image pinned before the
   *  removal, or a registry entry somebody welded by hand. */
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
    // ── ★★★ v0.4 · THE GATE, AND THE SHAPE IS THE ONE MEASURED ON THE LIVE DEMO (2026-09-11) ─────────────
    //
    // An interstitial COVERS the route — including `/account`, which answers 200 with the gate instead of its
    // 307, because the page component (and its `redirect()`) never renders. That is what makes the BODY the
    // only thing that can see one, and it is why the fixture serves it at the head of every door.
    const app = gates(store?.handle);
    // A gate SCREEN on a store the port says nobody gates: a front pinned to an image whose registry still
    // welds the entry, or a placement removed in the data and cached in the front. Nothing about the
    // declaration can see it — only the body can.
    if (!app && leaksGate.includes(store?.handle)) {
      res.writeHead(200, { 'x-forge-served-by': by }).end(gateBody(INTRUDER_APP));
      return;
    }
    if (refusesGate.includes(store?.handle)) {
      // The front cannot DRAW the slot it believes is filled: the structural-gap refusal, on every door.
      res.writeHead(200, { 'x-forge-served-by': by }).end(gapBody(app ?? INTRUDER_APP));
      return;
    }
    if (app) {
      res.writeHead(200, { 'x-forge-served-by': by }).end(gateBody(app));
      return;
    }
    if (path === '/account') {
      res
        .writeHead(307, { location: `/s/${m[1]}/account/login`, 'x-forge-served-by': by })
        .end(shopBody(store?.handle ?? '?', path));
      return;
    }
    res.writeHead(200, { 'x-forge-served-by': by }).end(shopBody(store?.handle ?? '?', path));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ api: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

const step = (api, tenant = TENANT, script = STEP) =>
  run('node', [script, '--tenant', tenant, '--api', api], {
    env: { ...process.env, FORGE_OPERATOR_TOKEN: TOKEN },
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
    env: { ...process.env, FORGE_OPERATOR_TOKEN: '' },
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
    env: { ...process.env, FORGE_OPERATOR_TOKEN: 'wrong-token' },
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
// ★★★ v0.4 · THE GATE — AND THE RULE IS THE OPPOSITE ONE NOW
//
// ⛔ WHAT THIS BLOCK USED TO PROVE, AND WHY IT WAS TURNED AROUND. Until this slice it demanded that every
// store SHOW a front door, and opened every door twice to compare the two sides of the kit's dismissal
// cookie. The rule was right about the screen and blind about what the screen cost: an app merely INSTALLED
// on `storefront:gate` is asked about at the edge of every store route, so it took the whole box off the
// cacheable tree — `private, no-cache, no-store` on every route, and an interstitial with no `<title>` handed
// to every robot at every URL. The sentence a visitor is owed is a BLOCK now, and nothing may fill that slot.
//
// ★ EVERY TEST BELOW GRADES A BODY, never a status. That is not a preference: a gate answers 200 from the
// same container as the shop, so a status code cannot see the difference at all.
// ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('★★★ no door serves a gate — the ✓ line says so, door by door', async () => {
  const box = await fakeBox();
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 0, out);
  // Not "somewhere in the report": the verdict has to be readable per door, or a reader cannot tell which
  // doors had their body read and which were merely opened.
  for (const door of ['/', '/checkout', '/account', '/account/login']) {
    const label = `forge${door}`;
    const line = out.split('\n').find((l) => l.includes(`✓ ${label} `));
    assert.ok(line, `no ✓ line for ${label}:\n${out}`);
    assert.match(line, /no gate ✓ \(the port names none, the body shows none\)/, line);
  }
  assert.match(out, /door\(s\) proved free of a gate/, out);
});

test('★★★ SABOTAGE — AN APP IS INSTALLED ON `storefront:gate` ⇒ red naming the app and every store', async () => {
  // ⛔ THE STATE THIS WHOLE SLICE EXISTS TO KEEP AWAY: one `extension.install` — by a hand, by a restored
  // backup, by a seed somebody adds back — and every route of every store of this tenant is dynamic again.
  // Nothing else on this box would say so: the status codes, the containers and the page bodies of a gated
  // box and a cacheable one are the same until you read the markup.
  const box = await fakeBox({ gates: () => INTRUDER_APP });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  for (const handle of ['forge', 'outlet']) {
    const line = out.split('\n').find((l) => l.includes(`✗ ${handle} `) && l.includes('FILLS'));
    assert.ok(line, `no ✗ naming ${handle}:\n${out}`);
    assert.ok(line.includes(INTRUDER_APP), `the red does not name the app it found: ${line}`);
    assert.ok(line.includes('storefront:gate'), `the red does not name the slot: ${line}`);
  }
  // ⚠️ AND IT SAYS WHAT THE INSTALL COSTS, not only that it happened. A red that names a slot and not the
  // consequence reads as tidiness, and tidiness is what gets waived.
  assert.match(out, /no-cache, no-store/, out);
});

test('★★ SABOTAGE — a gate SCREEN reaches a door the port says nobody gates ⇒ red (the negative control)', async () => {
  // The other half, and the one the port cannot see per store: the data says nobody gates THIS shop and its
  // front draws a gate anyway — an image pinned before the removal, or a registry entry welded by hand in a
  // fork. This is why the step reads bodies at all and does not stop at `read.extensions`.
  //
  // ⚠️ THE FIXTURE GATES THE SIBLING, AND THAT IS NOT A CONVENIENCE — IT IS THE LIMIT OF THIS CHECK, STATED.
  // The step knows the name of no app; the only ids it can look for in a body are the ones the PORT just
  // named somewhere on this tenant. So a box where NOTHING is installed anywhere and a front draws a gate out
  // of a stale image is invisible to this arm — what catches that box is the ✗ above, on whichever store the
  // port does answer for, and the structural-gap arm below. Writing the fixture the other way round would
  // have produced a green that proved the opposite of what it claimed.
  const box = await fakeBox({ gates: (h) => (h === 'outlet' ? INTRUDER_APP : null), leaksGate: ['forge'] });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('✗ forge/ ') && l.includes('reached this door'));
  assert.ok(line, `no ✗ for the leaking door:\n${out}`);
  assert.ok(line.includes(INTRUDER_APP), `the red does not name the screen it found: ${line}`);
  assert.match(line, /no route of this box may serve one/, line);
});

test('★★ SABOTAGE — the front REFUSES the page with the structural-gap notice ⇒ its own red', async () => {
  // A DIFFERENT FAILURE AND IT DESERVES ITS OWN SENTENCE. `composition-gap` is what a front draws when a
  // STRUCTURAL slot IS filled and this build cannot draw it: the shop answers 200 and shows «Esta loja está
  // temporariamente indisponível». It is the shape a HALF-removed gate takes, and a status code cannot see it.
  const box = await fakeBox({ refusesGate: ['forge'] });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  const line = out.split('\n').find((l) => l.includes('✗ forge/ ') && l.includes('structural-gap'));
  assert.ok(line, `no ✗ naming the structural-gap refusal:\n${out}`);
  assert.match(line, /believes a slot is filled/, line);
});

test('⛔ ANTI-VACUUM — a run that read NO body is a RED, not a quiet green', async () => {
  // ⛔ THE ONE THE OLD RULE DID NOT NEED AND THIS ONE CANNOT LIVE WITHOUT. «Every store has a gate» is
  // falsified by looking; «no store has one» is SATISFIED by not looking. So a box where the port answers
  // nothing for anybody must not produce a report of ✓ lines — and the step says so in its own words rather
  // than leaving the absence to be noticed.
  const box = await fakeBox({ extensionsRefuses: true });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /✗ forge .*read\.extensions could not be asked anonymously/, out);
  assert.match(out, /NO DOOR OF .* WAS PROVED FREE OF A GATE/, out);
});

test('★★ the port refusing `read.extensions` is a RED that names the store, never a silent abstention', async () => {
  // Every gate assertion hangs off this one read. A run that could not make it would otherwise print ✓ lines
  // for doors it graded on half the question — the exact shape of "green because it did not look".
  const box = await fakeBox({ extensionsRefuses: true });
  const { code, out } = await step(box.api);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /✗ forge .*read\.extensions could not be asked anonymously/, out);
  for (const door of ['/', '/checkout']) {
    const line = out.split('\n').find((l) => l.includes(`✓ forge${door} `));
    assert.ok(line, `no ✓ line for forge${door}:\n${out}`);
    assert.match(line, /gate NOT ASKED \(see the ✗ above\)/, line);
  }
});

test('⛔ ANTI-VACUUM — the marks this suite serves really are the ones the step looks for', () => {
  // A fixture that invented its own strings would grade the probe against a box no deployable can be. Both
  // halves are read from the shipped step rather than retyped here.
  const source = readFileSync(STEP, 'utf8');
  assert.match(source, /data-testid="\$\{id\}"/, 'the step no longer builds its marks from a `data-testid`');
  assert.match(source, /composition-gap/, 'the step no longer knows the product’s structural-gap mark');
  assert.match(
    gapBody(INTRUDER_APP),
    /data-testid="composition-gap"/,
    'this suite stopped serving the mark it claims to be grading',
  );
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
