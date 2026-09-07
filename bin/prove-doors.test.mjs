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
 * ★★ pk21 — WHAT MAKES `balcao` SKIPPABLE IS THE PORT, NOT THE FILE. `read.internal.stores` publishes
 * `storefront_enabled` (derived from the store's `status`), and `seed/box.json` no longer carries the
 * hand-written `servable: false` that duplicated it. ⚠️ MEASURED ON THE LIVE BENCH 2026-09-07: the real port
 * answers `true` for `balcao` — every store is `active` — so this fixture is the box of the day the counter's
 * status is flipped, and `CAFE_ON_THE_STREET` is the box of today.
 */
const CAFE_TENANT = 'forgecafe';
const CAFE_STORES = [
  { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café', storefront_enabled: true },
  { id: 'sto_BALCAO', handle: 'balcao', name: 'Balcão', storefront_enabled: false },
];

/** Today's real answer: every store of the tenant on the street. */
const CAFE_ON_THE_STREET = CAFE_STORES.map((s) => ({ ...s, storefront_enabled: true }));

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
function fakeBox({ shut = [], mislead = [], credentialTenant = TENANT, stores = STORES } = {}) {
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
    if (shut.includes(path)) {
      // The vitrine's own 404 — served by the vitrine, exactly as the real fall-through was.
      res.writeHead(404, { 'x-forge-served-by': 'storefront' }).end('');
      return;
    }
    const by = mislead.includes(path) ? 'storefront' : path === '' ? 'storefront' : 'checkout';
    if (path === '/account') {
      res.writeHead(307, { location: `/s/${m[1]}/account/login`, 'x-forge-served-by': by }).end('');
      return;
    }
    res.writeHead(200, { 'x-forge-served-by': by }).end('');
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
  assert.match(out, /VERDICT: every door of forgeco opens/);
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
  assert.match(out, /VERDICT: 2 door\(s\) of forgeco do NOT open/);
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
  assert.doesNotMatch(out, /VERDICT: every door of forgecafe opens/);
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
  assert.match(out, /VERDICT: every door of forgecafe opens/);
  assert.doesNotMatch(out, /forge\/|outlet\//);
});

test('★★ a store the PORT says has no public page is skipped BY NAME with the reason — an absent store reads as a failed one', async () => {
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: CAFE_STORES });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 0, out);
  const line = out.split('\n').find((l) => l.includes('balcao'));
  assert.match(line ?? '', /↷ balcao .*SKIPPED/, `the counter is not skipped by name:\n${out}`);
  // The reason names the PORT and the field that decided it, so a reader can go and ask the box the same
  // question. ⛔ It is deliberately NOT a paragraph out of `seed/box.json`: that copy was the duplication.
  assert.match(line, /storefront_enabled/, `the skip does not name the field that decided it: ${line}`);
  assert.match(line, /read\.internal\.stores/, `the skip does not name the read that answered: ${line}`);
  // And `seed/box.json` must stay out of it — `bin/servable.test.mjs` is the guard, this is why it matters.
  const declared = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'))
    .tenants.find((t) => t.id === CAFE_TENANT)
    .stores.find((s) => s.handle === 'balcao');
  assert.ok(!('servable' in declared), 'seed/box.json declares `servable` again — two truths about one store.');
});

test('★★★ …and TODAY the counter is on the street, so its doors ARE opened — measured, not preferred', async () => {
  // ⛔ MEASURED ON THE LIVE BENCH 2026-09-07, `http://localhost:8200/s/sto_01M1Y6EFVT3DY88PGC51Y5Z2YH`:
  //    `/` → 200 storefront · `/checkout` → 200 checkout · `/account` → 307 checkout · `/account/login` →
  //    200 checkout. The counter's four doors answer exactly what this step demands, so deriving instead of
  //    reading a hand-written flag does not turn the birth red — it opens four doors nobody had opened.
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: CAFE_ON_THE_STREET });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 0, out);
  assert.match(out, /✓ balcao\/account\/login .* checkout/, out);
  assert.doesNotMatch(out, /balcao .*SKIPPED/, `a store on the street was skipped:\n${out}`);
});

test('★★ SABOTAGE, THE VACUUM: the port holds NONE of the declared stores ⇒ red naming them, never an empty green', async () => {
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: [] });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 1, out);
  assert.match(out, /✗ cafe .*declared in seed\/box\.json and NOT in this box/);
  assert.match(out, /✗ balcao .*declared in seed\/box\.json and NOT in this box/);
  assert.doesNotMatch(out, /VERDICT: every door/);
});

test('a tenant `seed/box.json` does not declare ⇒ the run REFUSES; it has no declaration to grade against', async () => {
  const box = await fakeBox({ credentialTenant: 'forgenope', stores: [] });
  const { code, out } = await step(box.api, 'forgenope');
  await box.close();
  assert.equal(code, 2, out);
  assert.match(out, /seed\/box\.json declares no tenant "forgenope"/);
  assert.match(out, /forgeco/, 'the refusal must name what the file DOES declare, or it is a dead end');
});

// ── ★ THE PURE VACUUM, AND pk21 MOVED WHO CAN EXPRESS IT ────────────────────────────────────────────────
//
// "Every store this tenant holds has no public page" used to be a shape `seed/box.json` had no tenant for,
// so this file COPIED the step into a scratch root with a declaration of its own. It does not have to any
// more: servability is DERIVED from `read.internal.stores[].storefront_enabled`, so the FAKE PORT can say it
// — which is both simpler and more faithful, because it is the box that says it on a real run too. (The
// scratch-root helper went with the declaration it existed to fake; the step now imports `./servable.mjs`,
// so a bare copy of one file would not even load.)
//
// It is the shape that would make this step print a green over ZERO opened doors, which is what every way of
// going blind decays into — hence the count is asserted directly rather than trusted to the reasons above.
test('★★★ SABOTAGE, THE PURE VACUUM: zero doors opened is NOT a green, even with nothing missing and nothing shut', async () => {
  const box = await fakeBox({
    credentialTenant: CAFE_TENANT,
    stores: [
      { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café', storefront_enabled: false },
      { id: 'sto_BALCAO', handle: 'balcao', name: 'Balcão', storefront_enabled: false },
    ],
  });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  // Nothing is missing (the box holds both stores the file declares) and nothing is shut (no door was
  // asked). The old shape would have signed "every door opens" over an empty report.
  assert.equal(code, 1, out);
  assert.match(out, /NO DOOR OF forgecafe WAS OPENED/);
  assert.doesNotMatch(out, /VERDICT: every door/);
  // …and both stores are still named, with the reason. A vacuum that is also silent is two defects.
  assert.match(out, /↷ cafe .*SKIPPED/, out);
  assert.match(out, /↷ balcao .*SKIPPED/, out);
});
