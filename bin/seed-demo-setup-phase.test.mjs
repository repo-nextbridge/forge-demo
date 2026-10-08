// ★★ v031/H29 — `bin/seed.mjs --phase demo-setup` RUN FOR REAL, TWICE, against an EPHEMERAL fake kernel.
//
//   node --test bin/seed-demo-setup-phase.test.mjs        (or: bash bin/test.sh)
//
// The phase exists so that a change to `seed/demo-setup.json` reaches a box that is ALREADY BORN without a
// reset — the notice moving into the funnel being the first. ⛔ It is proven here and nowhere else: this file
// starts an HTTP server on 127.0.0.1 that answers the reads and commands the seed uses, holds what it is told
// to place, and is closed at the end. No box, no bench, no stag.
//
// What is held:
//   · the state a box born before v031/H29 is in (the notice in `footer.end` on the three shops, the marks in
//     place) gets EXACTLY one write per shop: the notice in `checkout.bottom`;
//   · the second run writes NOTHING (idempotent per store × component × slot);
//   · the phase touches nothing else — no store, field, product, promotion or silence command is sent;
//   · and it ends with the purge, which without a revalidate secret is a named line, not a failure.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { blocksFor } from '../seed/blocks.mjs';
import { DEMO_SETUP } from '../seed/demo-setup.mjs';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = join(HERE, 'seed.mjs');
const FUNNEL = 'storefront:checkout.bottom';

const TENANTS = {
  tok_forgeco: { id: 'forgeco', stores: ['forge', 'outlet'] },
  tok_forgecafe: { id: 'forgecafe', stores: ['cafe', 'balcao'] },
};

/** A box born BEFORE this slice: every block the declaration states, minus the funnel notice. */
function bornBefore() {
  const rows = [];
  for (const { stores } of Object.values(TENANTS)) {
    for (const handle of stores) {
      for (const block of blocksFor(DEMO_SETUP, handle)) {
        if (block.slot === FUNNEL) continue;
        rows.push({
          store: `sto_${handle}`,
          extension_id: DEMO_SETUP.app,
          component: block.component,
          declared_target: block.slot,
          target: block.slot,
          position: 0,
          enabled: true,
          has_placement: true,
          placement_id: `hp_${rows.length}`,
          config: { ...block.config },
          active: true,
        });
      }
    }
  }
  return rows;
}

async function fakeKernel() {
  const rows = bornBefore();
  const writes = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const tenant = TENANTS[(req.headers.authorization ?? '').replace(/^Bearer /, '')];
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (!tenant) return send(401, { code: 'unauthorized' });
    if (req.method === 'POST' && url.pathname.startsWith('/v1/commands/')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const name = url.pathname.slice('/v1/commands/'.length);
        const input = JSON.parse(body || '{}');
        writes.push({ tenant: tenant.id, name, input });
        if (name === 'composition.place') {
          rows.push({ store: input.store, extension_id: input.extension_id, component: input.component, declared_target: input.slot, target: input.slot, position: 0, enabled: true, has_placement: true, placement_id: `hp_${rows.length}`, config: input.config, active: true });
        }
        send(200, { ok: true });
      });
      return;
    }
    const name = url.pathname.replace('/v1/read/internal/', '');
    if (name === 'stores') return send(200, tenant.stores.map((h) => ({ id: `sto_${h}`, handle: h, name: h, status: 'active' })));
    if (name === 'installed_extensions') return send(200, [{ extension_id: DEMO_SETUP.app, status: 'active' }]);
    if (name === 'assets') return send(200, []);
    if (name === 'extension_composition') return send(200, rows.filter((r) => r.store === url.searchParams.get('store')).map(({ store: _s, ...r }) => r));
    return send(500, { code: 'unexpected', message: `the fake kernel does not serve ${req.method} ${url.pathname}` });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { api: `http://127.0.0.1:${server.address().port}`, writes, close: () => server.close() };
}

async function seed(api, tenant) {
  const env = { ...process.env, FORGE_OPERATOR_TOKEN: `tok_${tenant}`, FORGE_REVALIDATE_SECRET: '' };
  try {
    const { stdout, stderr } = await run(process.execPath, [SEED, '--phase', 'demo-setup', '--tenant', tenant, '--api', api], { env, maxBuffer: 8 * 1024 * 1024 });
    return { code: 0, out: stdout + stderr };
  } catch (e) {
    return { code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test('★★★ on a box born before the funnel notice: ONE write per shop with a checkout, then NOTHING on the re-run', async () => {
  const kernel = await fakeKernel();
  try {
    for (const tenant of ['forgeco', 'forgecafe']) {
      const r = await seed(kernel.api, tenant);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /demo-setup — done\. Nothing else was asked of this box\./, r.out);
    }
    assert.deepEqual(
      kernel.writes.map((w) => `${w.tenant} ${w.name} ${w.input.store}/${w.input.component}@${w.input.slot}`).sort(),
      [
        `forgecafe composition.place sto_cafe/demo_ribbon@${FUNNEL}`,
        `forgeco composition.place sto_forge/demo_ribbon@${FUNNEL}`,
        `forgeco composition.place sto_outlet/demo_ribbon@${FUNNEL}`,
      ],
      'the phase wrote something other than the funnel notice on the three shops',
    );

    kernel.writes.length = 0;
    for (const tenant of ['forgeco', 'forgecafe']) {
      const r = await seed(kernel.api, tenant);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /0 block\(s\) placed, 0 re-configured/, r.out);
    }
    assert.deepEqual(kernel.writes, [], 'the second run wrote — the phase is not idempotent');
  } finally {
    kernel.close();
  }
});

test('⛔ an unknown phase is refused by name — a typo never runs the curated phase by default', async () => {
  const bad = await run(process.execPath, [SEED, '--phase', 'demo_setup', '--tenant', 'forgeco', '--api', 'http://127.0.0.1:9'], {
    env: { ...process.env, FORGE_OPERATOR_TOKEN: 'tok_x' },
  }).then(
    () => ({ code: 0, out: '' }),
    (e) => ({ code: e.code, out: `${e.stdout}${e.stderr}` }),
  );
  assert.notEqual(bad.code, 0);
  assert.match(bad.out, /unknown --phase "demo_setup"/);
});
