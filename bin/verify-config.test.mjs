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
import { createServer as createTlsServer } from 'node:https';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isBenchAddress } from './box-domains.mjs';

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
 * `directory`  — `authority → store`, the OTHER half of the same global table (`store_directory`), which is
 *                what `read.store.by_host` answers and what every consumer resolving an address THROUGH THE
 *                PORT reads. ⚠️ IT IS SEPARATE FROM `storeHosts` ON PURPOSE: the fronts resolve from the env
 *                override, so the box can answer 200 at an address no store claims in the kernel — which is
 *                exactly the state this bench was in until pk26/d1, and the state the check exists to name.
 */
async function fakeBox({ storeHosts = [], adminDoors = {}, directory = null, https = false } = {}) {
  // Unset ⇒ the directory agrees with the map, which is what a box born since step 6b looks like.
  const storeDirectory = directory ?? Object.fromEntries(storeHosts.map((h) => [h.toLowerCase(), 'sto_ROOT']));
  /** What the TLS handshakes carried, so a test can assert the CLAIMED name never reached one. */
  const sni = [];
  const handler = (req, res) => {
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
    if (url.pathname === '/v1/read/store.by_host') {
      const asked = (url.searchParams.get('host') ?? '').toLowerCase();
      // The kernel's own rule: the exact authority first, then the bare host.
      const id = storeDirectory[asked] ?? storeDirectory[asked.replace(/:\d+$/, '')];
      return id ? json(200, { store_id: id }) : json(404, { error: { kind: 'not_found' } });
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
  };
  // ★★★ AN EDGE THAT HOLDS A CERTIFICATE FOR ITS OWN NAME AND NOTHING ELSE — which is every box published
  // online, and is what the SNICallback below models: a handshake asking for any other name DIES, exactly
  // as `tailscale serve` does (measured EPROTO on the live bench, 2026-09-08). That is the whole reason a
  // probe deriving its ServerName from the `Host:` header it is testing reported the shop as answering
  // NOTHING at five of eight addresses it answers 200 at.
  const server = https
    ? createTlsServer(
        {
          key: TLS_KEY,
          cert: TLS_CERT,
          SNICallback: (name, cb) => {
            sni.push(name);
            cb(new Error(`this edge holds no certificate for "${name}"`));
          },
        },
        handler,
      )
    : createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  return {
    origin: `${https ? 'https' : 'http'}://127.0.0.1:${server.address().port}`,
    https,
    sni,
    close: () => server.close(),
  };
}

// ── the certificate the https fake presents ───────────────────────────────────────────────────────────────
//
// ⚠️ A FIXTURE, NOT A SECRET: a P-256 self-signed pair for `IP:127.0.0.1` and nothing else, generated once
// for this file and valid until 2126 so no run of this suite ever fails on a date. It is deliberately NOT
// valid for `localhost` — if it were, the broken probe would pass and this file would prove nothing. The
// child process is told to trust it through `NODE_EXTRA_CA_CERTS`, which is how the assertions can be about
// the ServerName rather than about certificate validation.
const TLS_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQge4BTh9jeTNNn9g0d
D4Ns1N7FCZ5kAGxm+W03C5wqqQOhRANCAAR0CZMjfZ9dVlPmoXw2ZFcwvEyId089
Hg7OK8s7eKJUZoTN4CT5p+82tyFy7hH40miBddakCt6mHU3Ti/JXlZ2Z
-----END PRIVATE KEY-----
`;
const TLS_CERT = `-----BEGIN CERTIFICATE-----
MIIBkDCCATagAwIBAgIUTjxeaBX9d4pCfgzpjPFTbRVCkBIwCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJMTI3LjAuMC4xMCAXDTI2MDkwODIxNDUxNloYDzIxMjYwODE1
MjE0NTE2WjAUMRIwEAYDVQQDDAkxMjcuMC4wLjEwWTATBgcqhkjOPQIBBggqhkjO
PQMBBwNCAAR0CZMjfZ9dVlPmoXw2ZFcwvEyId089Hg7OK8s7eKJUZoTN4CT5p+82
tyFy7hH40miBddakCt6mHU3Ti/JXlZ2Zo2QwYjAdBgNVHQ4EFgQUpXEjyhIaS8xJ
j+XOVBzRwi6lSVwwHwYDVR0jBBgwFoAUpXEjyhIaS8xJj+XOVBzRwi6lSVwwDwYD
VR0TAQH/BAUwAwEB/zAPBgNVHREECDAGhwR/AAABMAoGCCqGSM49BAMCA0gAMEUC
IQDDcWQb7xcirW1hqfeGWPXHY0HDS5s5w9QdbZXlMDOKDwIgEQKjxtXIR0BBi+xV
aQJk3CySZNbXSDezFCGh/Kq6D+E=
-----END CERTIFICATE-----
`;

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
    // The fake edge's own certificate is the trust anchor, so what fails on an https box fails for the
    // reason this file is about (the ServerName) and never because a self-signed chain was rejected.
    const childEnv = { PATH: process.env.PATH };
    if (box.https) {
      const ca = join(dir, 'fake-edge.pem');
      writeFileSync(ca, TLS_CERT);
      childEnv.NODE_EXTRA_CA_CERTS = ca;
    }
    try {
      const { stdout, stderr } = await run_('node', args, { encoding: 'utf8', env: childEnv });
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

// ── ★★★ pk26/d1 · AND THE KERNEL HAS TO KNOW THE ADDRESS TOO ─────────────────────────────────────────────
//
// ⛔ EVERY OTHER CHECK OF THE SHOP SECTION CARRIES A `Host:` HEADER TO THE EDGE, so it grades what the FRONTS
// resolve — and the fronts read `FORGE_STORE_HOSTS` themselves. That is why this whole file was green on a
// bench whose kernel directory was EMPTY for weeks: `read.store.by_host` answered 404 at every hostname
// (measured 04/09 and again 08/09) while eight ✓ said the shop answered. The warmer paid for it — it built
// `/s/<id>/…` urls for a shop a visitor opens at `/`.

test('★★★ the shop answers 200 and NO store claims the address in the kernel ⇒ RED, with the cost named', async () => {
  // The exact bench of 08/09: the map serves the root store, the edge answers, the directory holds nothing.
  const box = await fakeBox({ ...wholeLocalhost, directory: {} });
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('localhost') });
    assert.notEqual(status, 0, `a box whose kernel claims no store at its own address was called settled:\n${stdout}`);
    assert.match(stdout, /read\.store\.by_host answers 404/, stdout);
    // …and it names what breaks, in the words of the defect rather than "not ok".
    assert.match(stdout, /\/s\/<id>\/…/, `the red does not say what it costs:\n${stdout}`);
    assert.match(stdout, /Step 6b/, `the red does not name the step that declares it:\n${stdout}`);
    // ⚠️ ANTI-VACUUM: the SHOP section above must still be green, or this test would be passing for the
    //    wrong reason — the whole point is that the two halves can disagree.
    assert.match(stdout, /✓ localhost:8200 — → sto_ROOT/, `the front-side checks went red too:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ TWO ANSWERS about one address — the directory and the override name DIFFERENT stores ⇒ RED', async () => {
  // Worse than cold, and the shape `bin/warm-box.mjs` already refuses to call warm: the warmer builds clean
  // URLs for the store the DIRECTORY names while a shopper typing that address is served by the other one.
  const box = await fakeBox({ ...wholeLocalhost, directory: { localhost: 'sto_OTHER', 'localhost:8200': 'sto_OTHER' } });
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('localhost') });
    assert.notEqual(status, 0, stdout);
    assert.match(stdout, /TWO ANSWERS about one address/, stdout);
    assert.match(stdout, /sto_OTHER/, stdout);
    assert.match(stdout, /sto_ROOT/, stdout);
  } finally {
    box.close();
  }
});

test('★★ …and a box where the two AGREE says so, naming the store — never a silent ✓', async () => {
  const box = await fakeBox(wholeTailnet);
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('tailnet') });
    assert.equal(status, 0, stdout);
    assert.match(stdout, /in the kernel's directory, the same store FORGE_STORE_HOSTS serves there/, stdout);
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

// ── ★★★ pk34/d1 · THE SIX FACES, AND THE HALF-NAMED BOX ─────────────────────────────────────────────────
//
// `seed/box.json` declares one hostname per store and per tenant admin. Every one of them falls back, at the
// edge, to a `<something>.unset.localhost` sentinel — measured 2026-09-12: a variable the Caddyfile reads and
// nobody set used to take the WHOLE edge down (`server block without any key is global configuration`), and
// the sentinel turns that into one unreachable face. That trade is only safe if SOMETHING says the face is
// unreachable, and nothing else on this box would.
//
// ⚠️ THE THREE STATES ARE GRADED DIFFERENTLY ON PURPOSE: none named is a BENCH (a note), all named is a
// deployment (graded against the directory), and SOME named is the shape nobody chose.

/** The six faces as `seed/box.json` really declares them, so these tests carry no hostname of their own. */
const FACES = BOX.tenants.flatMap((t) => [
  ...(t.admin_domain ? [{ kind: 'admin', tenant: t.id, ...t.admin_domain }] : []),
  ...t.stores.flatMap((s) => (s.domain ? [{ kind: 'store', tenant: t.id, handle: s.handle, ...s.domain }] : [])),
]);

test('★★★ pk34/d1 — a box that names NONE of its faces is a BENCH, and is told so instead of accused', async () => {
  // ⚠️ THIS FIXTURE IS NOT THE BENCH, and saying so is the point of keeping it. All six empty is what a fresh
  // clone has BEFORE `.env` is written; the bench itself carries FORGE_DOMAIN=localhost and
  // FORGE_ADMIN_DOMAIN=localhost, and the test below this one is the one that grades that shape. Believing
  // this case covered the bench is what let the birth of 2026-09-13 print four wrong ✗.
  const box = await fakeBox(wholeLocalhost);
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('localhost') });
    assert.equal(status, 0, stdout);
    assert.match(stdout, /none of the \d+ faces is published/, stdout);
    assert.match(stdout, /0 of them answer at loopback/, stdout);
    assert.match(stdout, /LOCALHOST BIRTH/, stdout);
  } finally {
    box.close();
  }
});

test('★★★ ANCHORED — a hostname that merely CONTAINS "localhost" is a real address, not the bench', () => {
  // ⛔ THE SABOTAGE THAT PASSED GREEN FIRST TRY, which means the rule was the thing missing. Swapping the
  // equality for `bare.includes('localhost')` broke nothing, and this repository has paid three times in one
  // week for exactly that shape: `/jq/` matched inside `/tmp/…zSYjqw`, `die` inside `mens-…-brodie-2`, and
  // `/demo/` matches `demorou`. A face published at `notlocalhost.example` would have been read as loopback
  // and silently dropped out of the count.
  for (const bench of ['localhost', 'localhost:8200', 'http://localhost:8200', '127.0.0.1', '127.0.0.1:8200', '::1', '[::1]:8200', 'https://localhost/']) {
    assert.equal(isBenchAddress(bench), true, `${bench} is the bench and was not read as one`);
  }
  for (const real of ['notlocalhost.example', 'mylocalhost.test', 'localhost.attacker.example', 'store.forgecommerce.pro', 'cafe.forgecommerce.pro:443', 'cafe.unset.localhost']) {
    assert.equal(isBenchAddress(real), false, `${real} is a real hostname and was read as the bench`);
  }
  // ⚠️ ANTI-VACUUM: empty is NOT the bench — it is "unset", a different answer with its own line. A predicate
  // that swallowed it would make the two states indistinguishable, which is the whole defect this fixes.
  assert.equal(isBenchAddress(''), false);
  assert.equal(isBenchAddress(undefined), false);
});

test('★★★ THE REAL BENCH — two faces at `localhost` and four empty is a BENCH, not a stopped promotion', async () => {
  // ⛔ THE CASE THE SIBLING TEST ABOVE COULD NOT SEE. It passes a fixture with all six EMPTY, and no bench has
  // that shape: `.env.example` has shipped FORGE_DOMAIN=localhost and FORGE_ADMIN_DOMAIN=localhost since the
  // first box. Measured on the birth of 2026-09-13 — the bench came out with FOUR ✗ reading
  // "FORGE_*_DOMAIN is EMPTY while 2 of this box's 6 faces are addressed", which is the accusation meant for a
  // promotion somebody abandoned. The two faces were the bench's own loopback.
  const box = await fakeBox(wholeLocalhost);
  try {
    const { stdout, status } = await runVerdict({
      box,
      env: envFor('localhost', { FORGE_DOMAIN: 'localhost', FORGE_ADMIN_DOMAIN: 'localhost' }),
    });
    assert.equal(status, 0, `a plain bench was graded as a broken deployment:\n${stdout}`);
    assert.match(stdout, /none of the \d+ faces is published/, stdout);
    assert.match(stdout, /LOCALHOST BIRTH/, stdout);
    // …and the line SAYS the two are at loopback rather than claiming every variable is empty.
    assert.match(stdout, /2 of them answer at loopback/, stdout);
    // ⚠️ ANTI-VACUUM: the four that really are unset must NOT be accused here either.
    assert.doesNotMatch(stdout, /faces are addressed/, `the bench was told a face is missing:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★ a face published at a REAL hostname still makes the loopback ones a ✗ — the rule is the address, not the count', async () => {
  // The half-published box is still the shape nobody chose, and this proves the fix did not simply mute the
  // section: one real hostname among the six and the bench's own loopback faces are named again.
  const box = await fakeBox(wholeLocalhost);
  try {
    const { stdout, status } = await runVerdict({
      box,
      env: envFor('localhost', {
        FORGE_DOMAIN: 'localhost',
        FORGE_ADMIN_DOMAIN: 'localhost',
        FORGE_CAFE_DOMAIN: 'cafe.forgecommerce.pro',
      }),
    });
    assert.equal(status, 1, `a half-published box came out settled:\n${stdout}`);
    assert.match(stdout, /faces are addressed/, stdout);
  } finally {
    box.close();
  }
});

test('★★★ pk34/d1 — a HALF-NAMED box names the face left on its sentinel, and does not exit 0', async () => {
  assert.ok(FACES.length >= 2, `seed/box.json declares ${FACES.length} face(s) — this test has nothing to half-name.`);
  const box = await fakeBox(wholeLocalhost);
  try {
    // One face addressed, the rest empty: somebody was promoting this box and stopped.
    const first = FACES[0];
    const { stdout, status } = await runVerdict({
      box,
      env: envFor('localhost', { [first.env]: first.host }),
    });
    assert.equal(status, 1, stdout);
    for (const face of FACES.slice(1)) {
      assert.ok(stdout.includes(face.host), `the verdict does not name ${face.host}, which is a face left unaddressed:\n${stdout}`);
    }
    assert.match(stdout, /unset\.localhost/, stdout);
  } finally {
    box.close();
  }
});

test('★★★ pk34/d1 — every face named and claimed is SETTLED, including the one that must be claimed by NOBODY', async () => {
  const storeFaces = FACES.filter((f) => f.kind === 'store');
  const kept = storeFaces.filter((f) => f.directory !== false);
  const refused = storeFaces.filter((f) => f.directory === false);
  assert.ok(kept.length > 0 && refused.length === 1, `the declaration has ${kept.length} claimed and ${refused.length} refused store face(s) — this test grades both arms and needs one of each.`);
  const box = await fakeBox({
    ...wholeLocalhost,
    storeHosts: [...wholeLocalhost.storeHosts, ...FACES.map((f) => f.host)],
    adminDoors: {
      ...wholeLocalhost.adminDoors,
      ...Object.fromEntries(FACES.filter((f) => f.kind === 'admin').map((f) => [f.host, f.tenant])),
    },
    directory: {
      localhost: 'sto_ROOT',
      'localhost:8200': 'sto_ROOT',
      ...Object.fromEntries(kept.map((f) => [f.host, `sto_${f.handle.toUpperCase()}`])),
    },
  });
  try {
    const { stdout, status } = await runVerdict({
      box,
      env: envFor('localhost', Object.fromEntries(FACES.map((f) => [f.env, f.host]))),
    });
    assert.equal(status, 0, stdout);
    assert.match(stdout, /VERDICT: settled/, stdout);
    // ⛔ ANTI-VACUUM: a green here has to have LOOKED. Every face must appear on a ✓ line of its own.
    for (const face of FACES) assert.ok(stdout.includes(face.host), `${face.host} is not in the report at all:\n${stdout}`);
    assert.match(stdout, /claimed by NO store/, stdout);
  } finally {
    box.close();
  }
});

test('★★★ pk34/d1 — the counter\'s hostname CLAIMED by a store is red, and the reason is the receipt', async () => {
  const counter = FACES.find((f) => f.kind === 'store' && f.directory === false);
  assert.ok(counter, 'seed/box.json declares no `directory: false` face — the negative control has no subject.');
  const kept = FACES.filter((f) => f.kind === 'store' && f.directory !== false);
  const box = await fakeBox({
    ...wholeLocalhost,
    storeHosts: [...wholeLocalhost.storeHosts, ...FACES.map((f) => f.host)],
    adminDoors: {
      ...wholeLocalhost.adminDoors,
      ...Object.fromEntries(FACES.filter((f) => f.kind === 'admin').map((f) => [f.host, f.tenant])),
    },
    directory: {
      localhost: 'sto_ROOT',
      'localhost:8200': 'sto_ROOT',
      ...Object.fromEntries(kept.map((f) => [f.host, `sto_${f.handle.toUpperCase()}`])),
      // THE SABOTAGE: somebody gave the counter a public address.
      [counter.host]: 'sto_BALCAO',
    },
  });
  try {
    const { stdout, status } = await runVerdict({
      box,
      env: envFor('localhost', Object.fromEntries(FACES.map((f) => [f.env, f.host]))),
    });
    assert.equal(status, 1, stdout);
    assert.ok(stdout.includes(counter.host), stdout);
    assert.match(stdout, /directory: false.*claims it for sto_BALCAO/s, stdout);
  } finally {
    box.close();
  }
});

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

// ── ★★★ THE STEP OVER TLS, WHICH IS EVERY BOX ONLINE (pk25/d1) ───────────────────────────────────────────
//
// ⛔ THE DEFECT, MEASURED ON THE LIVE https BENCH 2026-09-08: this verdict refused FIVE of the eight names
// its own `.env` claims — «claimed for sto_… and the shop answers nothing there» — while
// `curl -H "Host: <each of the eight>" https://<origin>/` answered 200 for all eight. The box was right and
// the probe was wrong: Node derives the TLS ServerName from the `Host` HEADER when none is given, so the
// probe negotiated the handshake as «localhost» against an edge holding a certificate for its own name, the
// handshake died, and `req.on('error')` became «answers nothing». It was written and measured on 04/09
// against an http origin, where there is no TLS to get wrong, and has been wrong on https ever since.
//
// ★ WHY IT MATTERS MORE THAN A WRONG LINE: online the origin is https BY DEFINITION, so the last step of
// every birth — the verdict over the configuration — would be red on every box, for a reason that has
// nothing to do with the box. A gate that cries wolf at every deploy is a gate the team learns to skip.

test('★★★ over TLS the eight names the map claims are graded by the SHOP, not by the handshake', async () => {
  const box = await fakeBox({ ...wholeTailnet, https: true });
  try {
    const { stdout, status } = await runVerdict({ box, env: envFor('tailnet') });
    assert.equal(status, 0, `an https box whose shop answers every claimed name was refused:\n${stdout}`);
    assert.match(stdout, /VERDICT: settled/, stdout);
    // …and the claimed names really were probed one by one, not skipped.
    for (const host of wholeTailnet.storeHosts) {
      assert.match(stdout, new RegExp(`✓ ${host.replace(/\./g, '\\.')}`), `${host} was never graded:\n${stdout}`);
    }
    // ★ THE MECHANISM, ASSERTED: the name under test travels in the HEADER and NEVER in the handshake. This
    //   edge refuses any ServerName but its own, so a single entry here would be a probe about to be red.
    assert.deepEqual(box.sni, [], `the claimed name was sent as the TLS ServerName: ${JSON.stringify(box.sni)}`);
  } finally {
    box.close();
  }
});

test('★★★ …and the negative control SURVIVES it: over TLS a name the shop does not serve is still RED', async () => {
  // The one thing a `servername` fix must not buy: a green that means "the handshake worked". The map
  // claims a fifth name here and the shop answers 404 for it, exactly as the live edge does for a name it
  // does not route — so the verdict has to keep refusing it, over TLS, by name.
  const box = await fakeBox({ ...wholeTailnet, https: true });
  try {
    const env = envFor('tailnet', {
      FORGE_STORE_HOSTS: `'${JSON.stringify({
        localhost: 'sto_ROOT',
        'localhost:8200': 'sto_ROOT',
        [NET]: 'sto_ROOT',
        [`${NET}:8200`]: 'sto_ROOT',
        'never-declared.example.test': 'sto_ROOT',
      })}'`,
    });
    const { stdout, status } = await runVerdict({ box, env });
    assert.equal(status, 1, `an undeclared hostname came out settled over TLS:\n${stdout}`);
    assert.match(stdout, /✗ never-declared\.example\.test/, `the undeclared name is not refused by name:\n${stdout}`);
    // …and it is refused for what the SHOP answered (404), never for a dead handshake.
    const line = stdout.split('\n').find((l) => l.includes('never-declared.example.test'));
    assert.match(line, /answers 404/, `the refusal is not the shop's answer: ${line}`);
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
