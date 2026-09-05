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

/** The tenant this fixture speaks for — `forgeco` is declared in `seed/box.json` with both its stores. */
const TENANT = 'forgeco';
const STORES = [
  { id: 'sto_FORGE', handle: 'forge', name: 'Forge' },
  { id: 'sto_OUTLET', handle: 'outlet', name: 'Forge Outlet' },
];

/**
 * A box that answers.
 *
 * `shut` names the door paths this box will 404 instead of serving — that is the defect being reproduced:
 * the edge claimed `/account` and never its children, so `/account/login` fell through to the vitrine.
 * `mislead` names the doors that answer the right CODE from the WRONG front, which is the second thing the
 * step grades and the one a status code alone cannot see.
 */
function fakeBox({ shut = [], mislead = [] } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/v1/read/internal/stores') {
      if (req.headers.authorization !== `Bearer ${TOKEN}`) {
        res.writeHead(401).end('{}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(STORES));
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

const step = (api) =>
  run('node', [STEP, '--tenant', TENANT, '--api', api], {
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

test('the port refusing the store list is NOT a green and NOT a red', async () => {
  const box = await fakeBox();
  const r = await run('node', [STEP, '--tenant', TENANT, '--api', box.api], {
    env: { ...process.env, FORGE_SEED_TOKEN: 'wrong-token' },
  }).then(
    (x) => ({ code: 0, out: x.stdout }),
    (e) => ({ code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }),
  );
  await box.close();
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /read\.internal\.stores answered 401/);
});
