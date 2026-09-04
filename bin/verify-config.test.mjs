// ★★★ THE RESET ENDS WITH A VERDICT OVER THE CONFIGURATION, NOT A CHECKLIST OF THINGS TO TURN BACK ON.
//
// The box already ends with a verdict over DATA (`bin/verify-seed.mjs` → `VERDICT: settled`). What died at
// every rebirth and nothing graded was the CONFIGURATION: a promoted box torn down and reborn comes back
// with the shop answering on the tailnet and the admin directory holding only `localhost`, so the box is
// HALF PROMOTED — the shop opens, the login refuses `unknown_admin_host`, and the only thing that ever said
// so was a sentence in the last line of a 400-line scrollback.
//
// ⛔ AND THE POINT IS THE FORM. A list of things to re-enable ages in silence: somebody adjusts the live box,
// forgets to add the item, and the next reset erases it with nothing saying so. A verdict cannot: every check
// below is DERIVED — from `seed/box.json`, from what `.env` declares, and from what the box answers — so the
// forgotten item is not an invisible line in a list, it is the missing answer.
//
//   node --test bin/verify-config.test.mjs      (or: bash bin/test.sh)

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
const STEP = join(ROOT, 'bin/verify-config.mjs');
const BOX = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'));
const TENANTS = BOX.tenants.map((t) => t.id);
const run_ = promisify(execFile);

// ⚠️ FAKE ON PURPOSE. `bin/box-config.guard.mjs` forbids a real tailnet name or address in any tracked file
// and scans this one too — the same fixture host it uses.
const NET = 'box.example.test';

/**
 * A box that answers the two GLOBAL reads a configuration verdict lives on.
 *
 * `storeHosts` — the hostnames the shop really resolves (`Host:` header → 200 or 404), which is how the box
 *                answers rather than how `.env` describes it.
 * `adminDoors` — `authority → tenant`, i.e. what `forge_control.admin_directory` really holds.
 */
async function fakeBox({ storeHosts = [], adminDoors = {} } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/v1/read/admin.by_host') {
      const tenant = adminDoors[url.searchParams.get('host') ?? ''];
      return tenant
        ? json(200, { tenant_id: tenant })
        : json(404, { error: { kind: 'not_found', message: 'not found' } });
    }
    if (url.pathname === '/health') return json(200, { ok: true });
    // The vitrine's root, resolved from the request's Host exactly as the edge does it.
    const host = (req.headers.host ?? '').toLowerCase();
    if (storeHosts.map((h) => h.toLowerCase()).includes(host)) {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<html>the shop</html>');
    }
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end('<html>404</html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/** The four values a promotion writes, in the two spellings this box is ever in. */
function envFor(mode, overrides = {}) {
  const storeMap =
    mode === 'tailnet'
      ? { localhost: 'sto_ROOT', 'localhost:8200': 'sto_ROOT', [NET]: 'sto_ROOT', [`${NET}:8200`]: 'sto_ROOT' }
      : { localhost: 'sto_ROOT', 'localhost:8200': 'sto_ROOT' };
  const doors =
    mode === 'tailnet'
      ? BOX.tenants.map((t, i) => ({ name: t.settings.tenant_name, url: `https://${NET}:${8443 + i}` }))
      : BOX.tenants.map((t) => ({ name: t.settings.tenant_name, url: `http://${t.admin_host}` }));
  return {
    FORGE_HTTP_PORT: '8200',
    FORGE_PUBLIC_ORIGIN: mode === 'tailnet' ? `https://${NET}` : 'http://localhost:8200',
    FORGE_STORE_HOSTS: `'${JSON.stringify(storeMap)}'`,
    FORGE_ADMIN_SIBLINGS: `'${JSON.stringify(doors)}'`,
    FORGE_GATE_ADMIN_URL: doors[0].url,
    FORGE_REVALIDATE_SECRET: 'a-real-secret',
    FORGE_STOREFRONT_URL: 'http://storefront:3000',
    FORGE_GATE_SITE_URL: 'https://forgecommerce.pro',
    ...(mode === 'tailnet' ? { FORGE_TAILNET_HOST: NET } : {}),
    ...overrides,
  };
}

async function runVerdict({ box, env, apiOverride }) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-verdict-'));
  const file = join(dir, '.env');
  writeFileSync(
    file,
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
  );
  try {
    const args = [STEP, '--env', file, '--api', apiOverride ?? box.origin];
    try {
      const { stdout, stderr } = await run_('node', args, { encoding: 'utf8', env: { PATH: process.env.PATH } });
      return { stdout: `${stdout}${stderr}`, status: 0 };
    } catch (error) {
      return { stdout: `${error.stdout ?? ''}${error.stderr ?? ''}`, status: error.code ?? -1 };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** What the box really holds when it is whole, in each spelling. */
const wholeLocalhost = {
  storeHosts: ['localhost', 'localhost:8200'],
  adminDoors: Object.fromEntries(BOX.tenants.map((t) => [t.admin_host, t.id])),
};
const wholeTailnet = {
  storeHosts: ['localhost', 'localhost:8200', NET, `${NET}:8200`],
  adminDoors: Object.fromEntries(BOX.tenants.map((t, i) => [`${NET}:${8443 + i}`, t.id])),
};

// ── the two states a whole box is allowed to be in ───────────────────────────────────────────────────────

test('★★ a box born on localhost and never promoted is SETTLED', async () => {
  const box = await fakeBox(wholeLocalhost);
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('localhost') });
    assert.equal(status, 0, stdout);
    assert.match(stdout, /VERDICT: settled/, stdout);
  } finally {
    box.close();
  }
});

test('★★ a box promoted onto the tailnet, whole, is SETTLED too', async () => {
  const box = await fakeBox(wholeTailnet);
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('tailnet') });
    assert.equal(status, 0, stdout);
    assert.match(stdout, /VERDICT: settled/, stdout);
  } finally {
    box.close();
  }
});

// ── ★★★ THE ONE THIS SLICE EXISTS FOR ────────────────────────────────────────────────────────────────────

test('★★★ a rebirth DE-PROMOTES the admin, and the verdict accuses it by tenant and by hostname', async () => {
  // The measured state after `box-down` + `box-up` on a promoted box, derived from what the birth writes:
  //   · the database is destroyed, so the directory holds only what `provision-ref` claims — `localhost:8201`
  //     and `localhost:8202`, from seed/box.json;
  //   · step 3b rewrites FORGE_STORE_HOSTS and DOES include $FORGE_TAILNET_HOST, so the SHOP still answers;
  //   · step 3d rewrites FORGE_ADMIN_SIBLINGS back to localhost;
  //   · FORGE_PUBLIC_ORIGIN and FORGE_GATE_ADMIN_URL are never written at birth, so they stay on the tailnet.
  // The box is therefore HALF PROMOTED: the shop opens over the tailnet and the admin refuses.
  const box = await fakeBox({
    storeHosts: ['localhost', 'localhost:8200', NET, `${NET}:8200`],
    adminDoors: Object.fromEntries(BOX.tenants.map((t) => [t.admin_host, t.id])),
  });
  try {
    const env = envFor('tailnet', {
      FORGE_ADMIN_SIBLINGS: `'${JSON.stringify(BOX.tenants.map((t) => ({ name: t.settings.tenant_name, url: `http://${t.admin_host}` })))}'`,
    });
    const { stdout, status } = await runVerdict({ box, env });
    assert.equal(status, 1, `a half-promoted box came out settled:\n${stdout}`);
    // Named, not counted: every tenant whose admin is not published where the box is.
    for (const t of TENANTS) {
      assert.match(stdout, new RegExp(t), `the verdict never names the tenant ${t}:\n${stdout}`);
    }
    assert.match(stdout, new RegExp(NET.replace(/\./g, '\\.')), `the verdict never names the hostname:\n${stdout}`);
    assert.match(stdout, /half.?promoted|box-up\.sh --tailnet/i, `the verdict does not say what to do:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ …and the accusation is not cosmetic: the directory really has no door on that hostname', async () => {
  // Same as above but with the sibling list ALSO pointing at the tailnet — the shape a hand-edited .env
  // produces. The declaration now agrees with the origin and the DIRECTORY is what is wrong, so the verdict
  // has to catch it on the other side.
  const box = await fakeBox({
    storeHosts: ['localhost', NET, `${NET}:8200`],
    adminDoors: Object.fromEntries(BOX.tenants.map((t) => [t.admin_host, t.id])),
  });
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('tailnet') });
    assert.equal(status, 1, `a box whose admin doors are unclaimed came out settled:\n${stdout}`);
    assert.match(stdout, /unknown_admin_host|no claim|not claimed|404/i, stdout);
  } finally {
    box.close();
  }
});

test('★★ the gate sending an operator to a door the directory does not hold is NAMED', async () => {
  const box = await fakeBox(wholeLocalhost);
  try {
    const env = envFor('localhost', { FORGE_GATE_ADMIN_URL: 'http://localhost:8299' });
    const { stdout, status } = await runVerdict({ box, env });
    assert.equal(status, 1, stdout);
    assert.match(stdout, /FORGE_GATE_ADMIN_URL/, `the verdict does not name the variable:\n${stdout}`);
    assert.match(stdout, /8299/, stdout);
  } finally {
    box.close();
  }
});

test('★★ a shop hostname the box does not resolve is NAMED — the map is a promise a browser cashes', async () => {
  const box = await fakeBox({ storeHosts: ['localhost'], adminDoors: wholeLocalhost.adminDoors });
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('localhost') });
    assert.equal(status, 1, `a host map naming an address the shop 404s came out settled:\n${stdout}`);
    assert.match(stdout, /localhost:8200/, stdout);
  } finally {
    box.close();
  }
});

test('★★ an empty purge secret is a defect, not a blank — measured empty for a day with every bust refused', async () => {
  const box = await fakeBox(wholeLocalhost);
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('localhost', { FORGE_REVALIDATE_SECRET: '' }) });
    assert.equal(status, 1, stdout);
    assert.match(stdout, /FORGE_REVALIDATE_SECRET/, stdout);
  } finally {
    box.close();
  }
});

// ── ★★★ THE HALF THAT MAKES IT A VERDICT AND NOT A CHECKLIST ─────────────────────────────────────────────

test('★★★ an address OF THIS BOX that the promotion does not move is the missing answer, and it is named', async () => {
  const box = await fakeBox(wholeTailnet);
  try {
    // Somebody wires the totem's public address by hand on the live box. It is on THIS box's hostname, and
    // `bash bin/box-up.sh --tailnet` does not rewrite it — so the next reset leaves it pointing at whatever
    // network the box used to be on, silently. Nobody put it in any list; the verdict finds it anyway.
    const env = envFor('tailnet', { FORGE_TOTEM_PUBLIC_URL: `https://${NET}:8445` });
    const { stdout, status } = await runVerdict({ box, env });
    assert.equal(status, 1, `an address the promotion cannot move passed unnoticed:\n${stdout}`);
    assert.match(stdout, /FORGE_TOTEM_PUBLIC_URL/, `the verdict does not name the variable:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ …and an address that is NOT this box\'s is left alone — the rule is ownership, not the word http', async () => {
  const box = await fakeBox(wholeTailnet);
  try {
    // `FORGE_GATE_SITE_URL=https://forgecommerce.pro` is in every one of these fixtures and must never be
    // flagged: it is somebody else's site, correctly not moved by a promotion of this box.
    const { stdout, status } = await runVerdict({ box, env: envFor('tailnet') });
    assert.equal(status, 0, stdout);
    assert.ok(!stdout.includes('FORGE_GATE_SITE_URL'), `an address of another site was flagged:\n${stdout}`);
    // …nor is an INTERNAL container address, which is a compose service name and not an address at all.
    assert.ok(!stdout.includes('FORGE_STOREFRONT_URL'), `a container-internal address was flagged:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ the moved set is READ FROM box-up.sh, so a fifth address added to the promotion is graded with no edit here', () => {
  const src = readFileSync(join(ROOT, 'bin/verify-config.mjs'), 'utf8');
  assert.match(
    src,
    /box-up\.sh/,
    'the verdict no longer derives the promotion\'s own list from bin/box-up.sh — a typed copy of those four ' +
      'names is a second truth, and it goes stale the day somebody adds a fifth.',
  );
  assert.ok(
    !/'FORGE_STORE_HOSTS',\s*'FORGE_PUBLIC_ORIGIN'/.test(src),
    'the four variables are typed into the verdict as a literal list',
  );
});

// ── what the online-only facilities contribute, and what a question that could not be asked is ───────────

test('★★ the verdict covers the facilities that only exist online, one line each', async () => {
  const box = await fakeBox(wholeLocalhost);
  try {
    const { stdout } = await runVerdict({ box, env: envFor('localhost') });
    for (const facility of BOX.online_only ?? []) {
      assert.match(stdout, new RegExp(facility.id), `${facility.id} is not in the configuration verdict:\n${stdout}`);
    }
  } finally {
    box.close();
  }
});

test('★★ a box that does not answer at all is THIS STEP failing to ask — exit 2, never a verdict', async () => {
  const box = await fakeBox(wholeLocalhost);
  box.close();
  const { stdout, status } = await runVerdict({ box, env: envFor('localhost'), apiOverride: 'http://127.0.0.1:1' });
  assert.equal(status, 2, `an unreachable box was reported as a configuration defect:\n${stdout}`);
  assert.match(stdout, /⚑/, stdout);
});
