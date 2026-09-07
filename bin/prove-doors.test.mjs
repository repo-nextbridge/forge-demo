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
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STEP = join(ROOT, 'bin/prove-doors.mjs');
const TOKEN = 'fot_test';
const run = promisify(execFile);

/** The tenant this fixture speaks for — `forgeco` is declared in `seed/box.json` with both its stores. */
const TENANT = 'forgeco';
const STORES = [
  { id: 'sto_FORGE', handle: 'forge', name: 'Forge' },
  { id: 'sto_OUTLET', handle: 'outlet', name: 'Forge Outlet' },
];

/**
 * ★★ THE SECOND TENANT OF `seed/box.json`, AND IT IS THE WHOLE POINT OF THE pk19 TESTS BELOW. `forgecafe`
 * declares `cafe` (its bootstrap store) and `balcao` (`servable: false` — the totem). Until 2026-09-07 this
 * step had never opened either of them in any run: it printed the café's NAME over the OTHER tenant's stores.
 */
const CAFE_TENANT = 'forgecafe';
const CAFE_STORES = [
  { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café' },
  { id: 'sto_BALCAO', handle: 'balcao', name: 'Balcão' },
];

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

const step = (api, tenant = TENANT, exe = STEP) =>
  run('node', [exe, '--tenant', tenant, '--api', api], {
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

test('★★ `balcao` is skipped BY NAME with the reason — an absent store reads as a failed one', async () => {
  const box = await fakeBox({ credentialTenant: CAFE_TENANT, stores: CAFE_STORES });
  const { code, out } = await step(box.api, CAFE_TENANT);
  await box.close();
  assert.equal(code, 0, out);
  assert.match(out, /↷ balcao .*SKIPPED/);
  // The reason is the box's own, not this test's — three long words of it, so the assertion cannot be
  // satisfied by a generic apology.
  const declared = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'))
    .tenants.find((t) => t.id === CAFE_TENANT)
    .stores.find((s) => s.handle === 'balcao');
  assert.equal(declared.servable, false, 'seed/box.json no longer marks balcao unservable');
  for (const word of declared._servable_why.split(/[\s,.]+/).filter((w) => w.length > 6).slice(0, 3)) {
    assert.match(out, new RegExp(word), `the skip does not carry the declared reason (${word})`);
  }
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

// ── ★ THE VACUUM THAT `seed/box.json` CANNOT EXPRESS ────────────────────────────────────────────────────
//
// "Every store this tenant holds is declared unservable" is a shape the real declaration has no tenant for,
// and it is precisely the shape that would make this step print a green over ZERO opened doors. So the step
// is COPIED into a scratch root with a declaration of its own — legitimate because `bin/prove-doors.mjs`
// imports nothing but node builtins and locates its box relative to its OWN path, so a copy is the same
// program reading a different declaration. ⚠️ The copy is taken from the real file at run time: this cannot
// drift from what the birth runs.
function scratchRoot(box) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-doors-'));
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(dir, 'seed'));
  copyFileSync(STEP, join(dir, 'bin/prove-doors.mjs'));
  writeFileSync(join(dir, 'seed/box.json'), JSON.stringify(box));
  after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'bin/prove-doors.mjs');
}

test('★★★ SABOTAGE, THE PURE VACUUM: zero doors opened is NOT a green, even with nothing missing and nothing shut', async () => {
  const box = await fakeBox({
    credentialTenant: 'forgeghost',
    stores: [{ id: 'sto_GHOST', handle: 'ghost', name: 'Ghost' }],
  });
  const exe = scratchRoot({
    tenants: [
      {
        id: 'forgeghost',
        stores: [{ handle: 'ghost', servable: false, _servable_why: 'declared unservable by this fixture' }],
      },
    ],
  });
  const { code, out } = await step(box.api, 'forgeghost', exe);
  await box.close();
  // Nothing is missing (the box holds the one store the file declares) and nothing is shut (no door was
  // asked). The old shape would have signed "every door opens" over an empty report.
  assert.equal(code, 1, out);
  assert.match(out, /NO DOOR OF forgeghost WAS OPENED/);
  assert.doesNotMatch(out, /VERDICT: every door/);
});
