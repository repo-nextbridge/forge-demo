// ★★★ THE BIRTH DECLARES THIS BOX'S ADDRESS, AND THE PORT ANSWERS IT — or the run is red, by name.
//
//   node --test bin/store-host.test.mjs      (or: bash bin/test.sh)
//
// This grades `bin/store-host.mjs` against a FAKE BOX — a real http server on a real port, speaking the three
// faces the step uses: `read.internal.stores` (whose stores are these, and what address do they hold),
// `POST /v1/commands/tenant.store.update` (the only way the column is ever written), and
// `read.store.by_host` (the GLOBAL directory, which is a PROJECTION and answers a beat later).
//
// ⚠️ THE FAKE IS A SERVER AND NOT A MOCK, for `bin/warm-box.test.mjs`'s reason: the risk of this step is on
// the wire — a command refused with `host_taken`, a directory that never catches up, a credential that
// belongs to the other tenant. A mock of `fetch` agrees with whatever the step believes; a socket answers
// what a box answers.
//
// ★★ AND THE PROJECTION IS MODELLED WITH A DELAY ON PURPOSE. `read.store.by_host` is served from
// `forge_control.store_directory`, filled by a relay consumer one cycle (~1 s) after the command commits —
// so a fake that answered the new value on the very next request would be greener than the box and would
// prove nothing about the wait that makes this step honest. `settleAfter` is how many reads the directory
// answers with the OLD value before it catches up.

import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STEP = join(ROOT, 'bin/store-host.mjs');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const TOKEN = 'fot_test';
const ROOT_STORE = 'sto_SHOE';

/** The tenant that owns the store at the root, as this box's first tenant does. */
const SHOE_STORES = [
  { id: ROOT_STORE, handle: 'forge', name: 'Forge', host: null },
  { id: 'sto_OUTLET', handle: 'outlet', name: 'Forge Outlet', host: null },
];
/** The other tenant: real stores, none of them the one at the root. */
const CAFE_STORES = [
  { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café', host: null },
  { id: 'sto_BALCAO', handle: 'balcao', name: 'Forge Café · Balcão', host: null },
];

/**
 * A box that answers.
 *
 *   stores        what `read.internal.stores` reports for this credential
 *   updateStatus  what the write face answers (200, or a refusal to grade)
 *   updateBody    the refusal's body — `host_taken` is the one this step names
 *   settleAfter   how many `store.by_host` reads answer the OLD directory before the write shows up.
 *                 `Infinity` is the projection that never catches up.
 *   directory     the directory BEFORE this run (authority -> store id)
 */
async function fakeBox({
  stores = SHOE_STORES,
  updateStatus = 200,
  updateBody = { ok: true },
  settleAfter = 1,
  directory = {},
  hostOnRoot = false,
} = {}) {
  const asked = { updates: [], byHost: [], tenantHeaders: [], tokens: [] };
  const live = { ...directory };
  let pending = null;
  let reads = 0;
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.headers['x-forge-tenant']) asked.tenantHeaders.push(`${req.method} ${url.pathname}`);
    if (req.headers.authorization) asked.tokens.push(req.headers.authorization);

    if (url.pathname === '/v1/read/internal/stores') return json(200, stores);

    if (url.pathname === '/v1/read/store.by_host') {
      const host = (url.searchParams.get('host') ?? '').toLowerCase();
      asked.byHost.push(host);
      reads += 1;
      // The relay has caught up by now: the pending claim becomes the directory's answer.
      if (pending && reads > settleAfter) {
        live[pending.authority] = pending.store;
        pending = null;
      }
      // The kernel's own matching rule: exact authority first, then the bare host.
      const id = live[host] ?? live[host.replace(/:\d+$/, '')];
      return id ? json(200, { store_id: id }) : json(404, { error: { kind: 'not_found' } });
    }

    if (url.pathname === '/v1/commands/tenant.store.update' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const input = raw ? JSON.parse(raw) : {};
        asked.updates.push(input);
        if (updateStatus !== 200) return json(updateStatus, updateBody);
        // The command writes the ROW synchronously; the DIRECTORY is a projection and lags.
        const row = stores.find((s) => s.id === input.id);
        if (row) row.host = input.host;
        if (input.host) {
          const u = new URL(input.host);
          pending = { authority: u.port ? `${u.hostname}:${u.port}` : u.hostname, store: input.id };
          reads = 0;
        }
        json(200, { ok: true });
      });
      return;
    }
    json(404, { error: { kind: 'not_found' } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  // ★ THE ROW ALREADY CARRYING THIS BOX'S OWN ADDRESS, which cannot be written into the fixture literal: the
  // port is only known here. It is the state a re-run finds, and the state the test below is about.
  if (hostOnRoot) for (const row of stores) if (row.id === ROOT_STORE) row.host = origin;
  return { origin, authority: `127.0.0.1:${port}`, asked, close: () => server.close() };
}

// ⚠️ ASYNCHRONOUS: the fake box is served by THIS process's event loop, and `execFileSync` would block it for
// the child's whole life — the step's first request would find nobody accepting and the suite would hang.
const run_ = promisify(execFile);

/** Every run is given a declaration, because a real one always has one — `bin/box-up.sh` calls this step from
 *  the repository whose `.env` step 3b just wrote. */
function declarationFor(box, storeHosts) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-storehost-env-'));
  const file = join(dir, '.env');
  writeFileSync(file, `FORGE_PUBLIC_ORIGIN=${box.origin}\nFORGE_STORE_HOSTS='${JSON.stringify(storeHosts)}'\n`);
  return { file, clean: () => rmSync(dir, { recursive: true, force: true }) };
}

async function runStep({ box, tenant = 'forgeco', token = TOKEN, storeHosts, extra = [], noDeclaration = false }) {
  const map = storeHosts ?? { [box.authority]: ROOT_STORE, '127.0.0.1': ROOT_STORE };
  const declaration = noDeclaration ? null : declarationFor(box, map);
  const args = [STEP, '--tenant', tenant, '--api', box.origin, '--poll-ms', '20', '--settle-ms', '600', ...extra];
  if (declaration) args.push('--env', declaration.file);
  try {
    const { stdout, stderr } = await run_('node', args, {
      encoding: 'utf8',
      env: { ...process.env, FORGE_SEED_TOKEN: token },
    });
    return { out: `${stdout}${stderr}`, stdout, status: 0 };
  } catch (error) {
    return { out: `${error.stdout ?? ''}${error.stderr ?? ''}`, stdout: error.stdout ?? '', status: error.code ?? -1 };
  } finally {
    declaration?.clean();
  }
}

// ── 1 · THE HAPPY HALF ────────────────────────────────────────────────────────────────────────────────────

test('★★★ the birth DECLARES the origin on the root store, and waits for the port to answer it', async () => {
  const box = await fakeBox();
  try {
    const { out, stdout, status } = await runStep({ box });
    assert.equal(status, 0, out);
    // 1 · the WRITE went through the port, on the right store, with the right address — never SQL, never a
    //     second column, and never a store the map did not name.
    assert.deepEqual(
      box.asked.updates,
      [{ id: ROOT_STORE, host: box.origin }],
      `the step did not drive exactly one tenant.store.update with the origin:\n${out}`,
    );
    // 2 · …and it is the tenant WRITE face, which takes the tenant as a header.
    assert.ok(
      box.asked.tenantHeaders.some((c) => c.includes('/v1/commands/tenant.store.update')),
      `the command went out with no x-forge-tenant header — the write face refuses without one:\n${out}`,
    );
    // 3 · the answer this step is FOR: the port, not the row.
    assert.match(out, /read\.store\.by_host\?host=127\.0\.0\.1:\d+ → sto_SHOE/, out);
    assert.equal(stdout.trim(), 'result=declared', `the countable word is not on stdout:\n${out}`);
  } finally {
    box.close();
  }
});

test('★★ DECLARING TWICE IS IDEMPOTENT — the second run writes NOTHING and still ends claimed', async () => {
  // ⚠️ "Alguém escreve isto DEPOIS de mim?" has a sibling question: "what does MY second run do?". A rebirth,
  //    a re-promotion and a repair all re-run this step; converging by VALUE is what keeps that free.
  const box = await fakeBox();
  try {
    const first = await runStep({ box });
    assert.equal(first.status, 0, first.out);
    const second = await runStep({ box });
    assert.equal(second.status, 0, second.out);
    assert.equal(
      box.asked.updates.length,
      1,
      `the second run spent a second command (and a second event, and a second audit row) to write the ` +
        `value that was already there:\n${second.out}`,
    );
    assert.match(second.out, /already declares/, second.out);
    assert.equal(second.stdout.trim(), 'result=converged', second.out);
  } finally {
    box.close();
  }
});

test('★★ the tenant that does NOT own the store at the root says so and writes nothing', async () => {
  // The step runs once per tenant because a credential belongs to one tenant. This answer is not a failure —
  // and it is not a claim either, which is why `bin/box-up.sh` counts the words rather than the exit codes.
  const box = await fakeBox({ stores: CAFE_STORES });
  try {
    const { out, stdout, status } = await runStep({ box, tenant: 'forgecafe' });
    assert.equal(status, 0, out);
    assert.deepEqual(box.asked.updates, [], `it wrote a host onto a store of the wrong tenant:\n${out}`);
    assert.equal(stdout.trim(), 'result=not-mine', out);
    assert.match(out, /not one of "forgecafe"'s 2 store\(s\)/, out);
  } finally {
    box.close();
  }
});

test('★★★ THE ROW BEING RIGHT DOES NOT EXCUSE THE PORT — converged + a cold directory is still RED', async () => {
  // ⛔ THE TRAP THE IDEMPOTENCY SHORTCUT COULD HAVE OPENED, and it is worth a test of its own. The column
  //    already holds the address, so no command is spent — and a step that took that for "done" would walk
  //    past the exact state this slice exists to end: the store row right, `read.store.by_host` still 404,
  //    the warmer still filling /s/<id>/… pages nobody opens. THE ROW IS NOT WHAT ANYBODY ASKS.
  const box = await fakeBox({ hostOnRoot: true, directory: {} });
  try {
    const { out, status } = await runStep({ box });
    assert.equal(status, 1, `a converged row with an empty directory exited ${status}:\n${out}`);
    assert.deepEqual(box.asked.updates, [], `it re-wrote a value that was already there:\n${out}`);
    assert.match(out, /already declares/, out);
    assert.match(out, /read\.store\.by_host\?host=/, `the red does not name the read that stayed wrong:\n${out}`);
  } finally {
    box.close();
  }
});

// ── 2 · THE RED HALF — and every one of these is a shape this box has really been in ──────────────────────

test('★★★ SABOTAGE ① — the birth does NOT declare ⇒ red, NAMING read.store.by_host', async () => {
  // ⛔ THE STATE THIS SLICE EXISTS TO END, reproduced exactly: the store row carries no host, so the global
  //    directory has nothing and the port answers 404 for the box's own address. Here it is forced by a write
  //    face that refuses; what matters is that the step REFUSES rather than reporting a box it did not change.
  const box = await fakeBox({ updateStatus: 403, updateBody: { error: { kind: 'forbidden' } } });
  try {
    const { out, status } = await runStep({ box });
    assert.equal(status, 1, `a store that could not claim the address exited ${status}:\n${out}`);
    assert.match(out, /tenant\.store\.update --host/, `the refusal does not name the write that failed:\n${out}`);
    assert.match(out, /HTTP 403/, out);
  } finally {
    box.close();
  }
});

test('★★★ SABOTAGE ①b — the command is accepted and the DIRECTORY never catches up ⇒ red, naming the read', async () => {
  // ★★ THE MEASURED SHAPE, and the reason this step waits at all: `read.store.by_host` is a PROJECTION.
  //    A run that wrote the row and walked away would be green over a box where the warmer still builds
  //    /s/<id>/… urls — the row right, every consumer wrong. Asking a projection about what the same run just
  //    created and taking the empty answer for a fact is a bill this house has already paid.
  const box = await fakeBox({ settleAfter: Infinity });
  try {
    const { out, status } = await runStep({ box });
    assert.equal(status, 1, `a directory that never agreed exited ${status}:\n${out}`);
    assert.match(out, /read\.store\.by_host\?host=/, `the red does not name the read that stayed wrong:\n${out}`);
    assert.match(out, /404 \(no store\)/, out);
    assert.match(out, /read\.store_directory/, `the red does not name the consumer that owes the delivery:\n${out}`);
    // …and it says what an operator loses meanwhile, in the words of the defect rather than "not ok".
    assert.match(out, /\/s\/<id>\/…/, out);
    // ⚠️ ANTI-VACUUM: it really did ask more than once. A "wait" that polls a single time is a sleep.
    assert.ok(box.asked.byHost.length >= 2, `the step asked the directory ${box.asked.byHost.length} time(s) — that is not a wait:\n${out}`);
  } finally {
    box.close();
  }
});

test('★★ SABOTAGE ② — the address is TAKEN by another store ⇒ red, and it says a host is unique box-wide', async () => {
  // The half-promoted / hand-edited box: a second store holds the origin, so the root store cannot have it.
  // `assertHostIsFree` (packages/core/src/commands/store.ts) refuses with `conflict` / `host_taken`.
  const box = await fakeBox({
    updateStatus: 409,
    updateBody: { error: { kind: 'conflict', reason: 'host_taken', field: 'host' } },
  });
  try {
    const { out, status } = await runStep({ box });
    assert.equal(status, 1, out);
    assert.match(out, /another store already claims/, out);
    assert.match(out, /unique across every tenant/, out);
  } finally {
    box.close();
  }
});

test('★★★ SABOTAGE ③ — THE VACUUM: no store serves the root ⇒ it accuses ITSELF, never exits 0 quietly', async () => {
  // ⛔ AN EMPTY MAP IS THE ONE INPUT THAT MAKES EVERY RULE ABOVE VACUOUS: nothing to declare, nothing to
  //    compare, nothing to wait for — and a step that answered "fine" would leave the box exactly in the
  //    state this slice exists to end, with a green line saying it had been handled.
  const box = await fakeBox();
  try {
    const { out, status } = await runStep({ box, storeHosts: {} });
    assert.equal(status, 1, `an empty host map produced exit ${status}:\n${out}`);
    assert.deepEqual(box.asked.updates, [], out);
    assert.match(out, /no store serves the root of/, out);
    assert.match(out, /read\.store\.by_host/, `the vacuum does not name what stays broken:\n${out}`);
    assert.match(out, /Step 3b/, `the vacuum does not name the step that writes that map:\n${out}`);
  } finally {
    box.close();
  }
});

test('★★ "I could not ask" is EXIT 2 and never a claim about the box', async () => {
  // The split `bin/verify-seed.mjs` and `bin/warm-box.mjs` already make: a missing credential is a fact about
  // this RUN. Reporting it as a defect is how an operator hunts one that does not exist.
  const box = await fakeBox();
  try {
    const noToken = await runStep({ box, token: '' });
    assert.equal(noToken.status, 2, noToken.out);
    assert.match(noToken.out, /FORGE_SEED_TOKEN/, noToken.out);
    assert.match(noToken.out, /nothing above is a claim about this box/, noToken.out);

    const noEnv = await runStep({ box, noDeclaration: true, extra: ['--env', join(tmpdir(), 'forge-absent.env')] });
    assert.equal(noEnv.status, 2, noEnv.out);
    assert.match(noEnv.out, /could not be read/, noEnv.out);
    assert.match(noEnv.out, /--store/, `it does not say how a caller without a declaration names the store:\n${noEnv.out}`);
  } finally {
    box.close();
  }
});

test('★ --origin declares an address OTHER than the one being talked to — the promotion\'s shape', async () => {
  // The promotion drives the command through the door that answers and writes the address the box publishes
  // itself at. They are the same on the bench and different the moment a box is promoted.
  const box = await fakeBox({ settleAfter: 0, directory: {} });
  try {
    const { out, status } = await runStep({
      box,
      storeHosts: { 'demo.example.com': ROOT_STORE, [box.authority]: ROOT_STORE },
      extra: ['--origin', 'https://demo.example.com'],
    });
    assert.equal(status, 0, out);
    assert.deepEqual(box.asked.updates, [{ id: ROOT_STORE, host: 'https://demo.example.com' }], out);
    // …and the directory is asked about THE DECLARED authority, with the scheme's default port dropped
    // exactly as a browser drops it.
    assert.ok(box.asked.byHost.includes('demo.example.com'), `it asked the directory about ${box.asked.byHost.join(', ')}:\n${out}`);
  } finally {
    box.close();
  }
});

test('★ --store names the root store for a box whose declaration this process cannot read', async () => {
  const box = await fakeBox();
  try {
    const { out, status } = await runStep({
      box,
      noDeclaration: true,
      extra: ['--store', ROOT_STORE],
    });
    assert.equal(status, 0, out);
    assert.deepEqual(box.asked.updates, [{ id: ROOT_STORE, host: box.origin }], out);
  } finally {
    box.close();
  }
});

// ── 3 · ⛔ ONE OWNER FOR THE COLUMN — the A22 trap, one column down ───────────────────────────────────────
//
// ★★ WHAT THE PRODUCT'S SOURCE SAYS, AND IT IS THE REASON THIS RULE IS HERE AND NOT A COMMENT.
// `dist/seed-demo.js` → `configureStore` (apps/api/src/seed-storefront.ts) sends
// `host: env.FORGE_SEED_STORE_HOST` on the store it seeds, on EVERY run, and step 9 of this birth runs it
// AFTER step 6b, on the DATASET tenant's bootstrap store — which is exactly the store that claims the root.
// So the day somebody puts that variable in this box's configuration, step 9 silently repoints the address
// step 6b declared, both halves are idempotent, the last one wins, and nothing anywhere says a word. That is
// the shape `bootstrapFlagConflicts` already refuses for the checkout flags (seed/posture.mjs).
//
// ⚠️ IT IS UNSET TODAY — measured, not assumed — so the seed OMITS the field and `tenant.store.update`
// coalesces it to whatever the store holds. This rule keeps it unset, and names the consequence if it is not.
test('★★★ nothing in this box declares FORGE_SEED_STORE_HOST — step 9 would overwrite step 6b in silence', () => {
  const files = [
    '.env.example',
    'compose.yml',
    'compose.override.yml',
    'bin/box-up.sh',
    'env-source.sh',
    'seed/box.json',
  ];
  const offenders = files.filter((f) => {
    const body = read(f);
    // A mention inside a COMMENT is how this rule explains itself; a DECLARATION is `NAME=` / `NAME:`.
    return /^[^#\n]*\bFORGE_SEED_STORE_HOST\s*[:=]/m.test(body);
  });
  assert.deepEqual(
    offenders,
    [],
    `${offenders.join(', ')} declare(s) FORGE_SEED_STORE_HOST. Step 9 (\`dist/seed-demo.js\` → configureStore) ` +
      'sends that value as the store\'s `host` on every run, AFTER step 6b, on the dataset tenant\'s bootstrap ' +
      'store — the very store that claims this box\'s address. Two idempotent authors, and the last one wins ' +
      'with nothing anywhere to notice. If an instance really has to state an address there, take step 6b out ' +
      'deliberately; do not let both write.',
  );
  // ⚠️ ANTI-VACUUM: the rule is worth nothing if the pattern cannot match. Proven on a string this test owns.
  assert.ok(
    /^[^#\n]*\bFORGE_SEED_STORE_HOST\s*[:=]/m.test('FORGE_SEED_STORE_HOST=https://demo.example.com\n'),
    'the pattern this rule scans with does not match a declaration — every file above would pass empty.',
  );
});

// ── 4 · AND THE BIRTH REALLY RUNS IT, AND REALLY COUNTS THE ANSWER ────────────────────────────────────────

test('★★★ bin/box-up.sh runs step 6b once per tenant, and ZERO claims is a refusal', () => {
  // ⛔ THE MECHANISM IS WORTH NOTHING IF THE BIRTH IGNORES IT — and "zero of N" reading as success is the
  //    exact shape F2 of the promotion had: a loop that reached one tenant of two, counted honestly, and
  //    printed both doors. Here every tenant can legitimately answer `not-mine`, so the count is the check.
  const boxUp = read('bin/box-up.sh');
  assert.match(boxUp, /say '6b · /, 'bin/box-up.sh does not stamp step 6b — the roteiro would never mention it.');
  const at = boxUp.indexOf("say '6b · ");
  const block = boxUp.slice(at, boxUp.indexOf("\n# ── 7 · ", at));
  assert.ok(block.length > 300, 'step 6b did not parse — re-read this guard before believing it.');
  assert.match(block, /bin\/store-host\.mjs/, 'step 6b does not run the step that declares the address.');
  assert.match(block, /for t in \$TENANTS/, 'step 6b does not run once per tenant, so one tenant is never asked.');
  assert.match(block, /result=declared\*\|\*result=converged/, 'step 6b does not count the answers it gets back.');
  assert.match(block, /address_claims" -gt 0 \] \|\| die/, 'step 6b accepts a box where NOBODY claimed the address.');
  assert.match(block, /\|\| die "the root store could not claim/, 'a refused claim does not stop the birth.');
});

test('★★★ the PROMOTION re-claims the new address, after the recreate and after /health answers', () => {
  // ★ THE ORDER IS THE WHOLE OF IT. Before the recreate the containers hold the old environment; before the
  //   health check nothing has proved the kernel is answering at the new address. The claim goes through the
  //   port, so it needs both.
  const boxUp = read('bin/box-up.sh');
  const health = boxUp.indexOf('note "edge $origin/health → 200"');
  const claim = boxUp.indexOf('store-host.mjs" --tenant "$t" --api "$origin"');
  const recreate = boxUp.indexOf('recreating the services that read the environment');
  assert.ok(health > 0 && claim > 0 && recreate > 0, 'the promotion no longer has all three lines — re-read this guard.');
  assert.ok(recreate < health, 'the health check moved above the recreate — re-read this guard before believing it.');
  assert.ok(
    claim > health,
    'the promotion claims the address BEFORE it has proved the kernel answers at it. The command goes through ' +
      'the port; a box mid-recreate answers nothing, and the promotion would report a failure of its own making.',
  );
  // …and a directory that refused makes the promotion INCOMPLETE rather than silently fine.
  //
  // ⚠️ THIS ASSERTION MOVED ON 10/09 AND THE REASON IS WORTH THE THREE LINES. It used to look for
  // `promotion_status=1` — a flag this block set and a sentence four hundred lines away printed. That flag WAS
  // the pk30/§2 defect: on the way back it was the only thing that could be set, and the sentence it reached
  // reported `0 of 0 admin door(s) claimed`, blaming a check that direction never runs. The property this test
  // is really about is unchanged, so it is now asked of the two things that carry it: this block RECORDS the
  // fact, and `bin/promotion-verdict.mjs` derives the status from it (both directions proved in
  // `bin/promotion-verdict.guard.mjs`).
  const tail = boxUp.slice(claim, claim + 4200);
  assert.match(
    tail,
    /\n    address_state=absent\n/,
    'a promotion whose address never reached the directory no longer records that fact, so nothing downstream ' +
      'can turn it into a non-zero exit.',
  );
  assert.match(
    tail,
    /node "\$HERE\/bin\/promotion-verdict\.mjs"[\s\S]*--address "\$address_state"/,
    'the recorded address state is not handed to the verdict — a promotion whose address never reached the ' +
      'directory would exit 0.',
  );
});

// ── 5 · THE PROSE THAT WAS FALSE, AND MUST NOT COME BACK ──────────────────────────────────────────────────

test('★★ no file still says the directory claim is something that has NOT happened', () => {
  // ⛔ MEASURED IN THIS SLICE: the promotion's own header has claimed since §B5 that "`store.host` is what
  //    ROUTES" while the block wrote only `FORGE_STORE_HOSTS` — prose describing a mechanism the code did not
  //    use. `bin/warm-box.mjs` carried the mirror image: "what closes this is DATA … on the day one does".
  //    That day is today, and a sentence left in the future tense sends the next reader looking for the fix.
  const warm = read('bin/warm-box.mjs');
  assert.ok(
    !/on the day one does/.test(warm),
    'bin/warm-box.mjs still says the store claiming the origin is a future event. Step 6b of the birth does ' +
      'it now, so that branch means the declaration did not take — which is a different sentence to an operator.',
  );
  assert.match(
    warm,
    /step 6b/,
    'bin/warm-box.mjs no longer names the step that owes it the directory entry. When that branch fires, the ' +
      'operator needs to know which step should have prevented it.',
  );
});
