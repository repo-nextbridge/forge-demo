#!/usr/bin/env node
// THE CAFÉ'S PAYMENT OFFER, ON A BOX THAT IS ALREADY BORN — and nothing else.
//
//   FORGE_OPERATOR_TOKEN=<forgecafe's token> node bin/payment-offers.mjs --api <public origin> --tenant forgecafe
//
// v0.3.3 made the offer of an installed payment app per store (`payment.offer.set`). A box born from now on gets
// the café's row from `seed/coffee.mjs` (`withholdPayments`, right after it installs `payment-pos`); a box born
// before has the app installed and no row, so its café still offers the counter's driver. This runs THAT step,
// the same function, against a standing box — the way `--phase demo-setup` runs one step of the seed without
// re-asserting the stores, the catalogues and the commerce silence. Idempotent: a café that already withholds
// the app costs one read and no write.
//
// ⚠️ THE CREDENTIAL IS THE TENANT'S, and it is proven before the write: the internal read face resolves the
// tenant from the token (never from `x-forge-tenant`), so a token of the other tenant would see no `cafe` store
// — and this stops there, by name, instead of writing nothing and exiting 0.

import { STORE_HANDLE, withholdPayments } from '../seed/coffee.mjs';
import { createPacer, faceOf, ratesFromEnv } from '../seed/pacer.mjs';

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const api = (argOf('--api') ?? 'http://localhost:8200').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? 'forgecafe';
const token = process.env.FORGE_OPERATOR_TOKEN ?? '';

const log = (msg) => process.stderr.write(`[payment-offers] ${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`[payment-offers] FAILED: ${msg}\n`);
  process.exit(1);
};
if (!token) fail('FORGE_OPERATOR_TOKEN is required — the forgecafe operator credential (`forge-operator-token-forgecafe`).');

const pacer = createPacer(ratesFromEnv());
async function call(url, init, what) {
  const face = faceOf(url);
  if (!face) fail(`no face declared for ${url} — add it to FACE_PATTERNS in seed/pacer.mjs.`);
  await pacer.take(face);
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) fail(`${what} → HTTP ${res.status} ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

const headers = { authorization: `Bearer ${token}`, 'x-forge-tenant': tenant };
const read = (name) => call(`${api}/v1/read/internal/${name}`, { headers }, `read.internal.${name}`);
// The bare tenant face, as `bin/seed.mjs` uses: `payment.offer.set` is NOT on the `/v1/payment/` face.
const command = (name, input) =>
  call(
    `${api}/v1/commands/${name}`,
    { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(input) },
    name,
  );

const listed = await read('stores');
const stores = Array.isArray(listed) ? listed : (listed?.items ?? listed?.rows ?? listed?.data ?? []);
const store = stores.find((s) => s?.handle === STORE_HANDLE);
if (!store) {
  fail(
    `this credential sees no "${STORE_HANDLE}" store (it sees: ${stores.map((s) => s?.handle).join(', ') || 'none'}). ` +
      'Present the forgecafe token — the internal read face answers for the token\'s own tenant.',
  );
}
log(`against ${api} as ${tenant} — store ${store.handle} (${store.id})`);
await withholdPayments({ command, read, log, fail }, store);
log('done. Nothing else was asked of this box.');
