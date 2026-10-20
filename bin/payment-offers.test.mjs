// ★ THE GESTURE FOR A BOX BORN BEFORE v0.3.3, RUN AS THE OPERATOR WILL RUN IT — against an ephemeral fake kernel.
//
// `bin/payment-offers.mjs` is the one command a standing box needs so its café stops offering the counter's
// `payment-pos` (the step `seed/coffee.mjs` runs at birth). What is held here is the process, not the function
// (`seed/payments.test.mjs` holds that): the faces it calls, the store it resolves, that a second run writes
// nothing, and that the wrong tenant's token stops it before any write.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'payment-offers.mjs');

const TENANTS = {
  tok_forgeco: { stores: [{ id: 'sto_forge', handle: 'forge' }, { id: 'sto_outlet', handle: 'outlet' }] },
  tok_forgecafe: { stores: [{ id: 'sto_cafe', handle: 'cafe' }, { id: 'sto_balcao', handle: 'balcao' }] },
};

/** A kernel that keeps one offer table and records every request. */
async function fakeKernel() {
  const offered = new Map(); // `${store}|${app}` → boolean; absent = offered (the default)
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const tenant = TENANTS[(req.headers.authorization ?? '').replace(/^Bearer /, '')];
      requests.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : undefined });
      const json = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (!tenant) return json(401, { code: 'unauthorized' });
      if (req.method === 'GET' && req.url === '/v1/read/internal/stores') return json(200, { items: tenant.stores });
      if (req.method === 'GET' && req.url === '/v1/read/internal/payment_offers') {
        return json(200, {
          stores: tenant.stores.map((s) => ({
            store_id: s.id,
            providers: ['payment-reference', 'payment-pos'].map((app) => ({
              app_id: app,
              methods: ['pix', 'card'],
              offered: offered.get(`${s.id}|${app}`) ?? true,
              position: null,
            })),
          })),
        });
      }
      if (req.method === 'POST' && req.url === '/v1/commands/payment.offer.set') {
        const { store_id, extension_id, offered: value } = JSON.parse(raw);
        offered.set(`${store_id}|${extension_id}`, value);
        return json(200, { store_id, extension_id, offered: value, position: null });
      }
      return json(404, { code: 'not_found', message: `no route ${req.method} ${req.url}` });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const api = `http://127.0.0.1:${server.address().port}`;
  return { api, offered, requests, close: () => new Promise((resolve) => server.close(resolve)) };
}

const gesture = (api, token) =>
  run(process.execPath, [SCRIPT, '--api', api, '--tenant', 'forgecafe'], {
    env: { ...process.env, FORGE_OPERATOR_TOKEN: token },
  });

test('★★ on a box born before v0.3.3: one write — the café withholds payment-pos, the counter keeps it', async () => {
  const kernel = await fakeKernel();
  try {
    await gesture(kernel.api, 'tok_forgecafe');
    const writes = kernel.requests.filter((r) => r.method === 'POST');
    assert.deepEqual(writes, [
      {
        method: 'POST',
        url: '/v1/commands/payment.offer.set',
        body: { store_id: 'sto_cafe', extension_id: 'payment-pos', offered: false },
      },
    ]);
    assert.equal(kernel.offered.get('sto_cafe|payment-pos'), false);
    assert.equal(kernel.offered.has('sto_balcao|payment-pos'), false, 'a row was written for the counter');

    // ★ and run again: nothing to do, nothing written.
    kernel.requests.length = 0;
    await gesture(kernel.api, 'tok_forgecafe');
    assert.deepEqual(kernel.requests.filter((r) => r.method === 'POST'), []);
  } finally {
    await kernel.close();
  }
});

test('⛔ the other tenant\'s token sees no café — the gesture stops by name and writes nothing', async () => {
  const kernel = await fakeKernel();
  try {
    await assert.rejects(gesture(kernel.api, 'tok_forgeco'), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /sees no "cafe" store/);
      return true;
    });
    assert.deepEqual(kernel.requests.filter((r) => r.method === 'POST'), []);
  } finally {
    await kernel.close();
  }
});
