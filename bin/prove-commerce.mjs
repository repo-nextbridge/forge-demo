#!/usr/bin/env node
// THE COMMERCE PASS, RUN AGAINST ONE BOX — a harness, not a second seeder.
//
//   FORGE_SEED_TOKEN=… node bin/prove-commerce.mjs --api http://localhost:8100 --tenant forgeco
//   FORGE_SEED_TOKEN=… node bin/prove-commerce.mjs --api http://localhost:8200 --tenant forgecafe
//
// ⚠️ IT ADDS NO SEEDING LOGIC OF ITS OWN. Every decision and every write lives in `seed/commerce.mjs`, which
// `bin/seed.mjs` will call in the ordinary run; this file only builds the port helpers and points them at a
// box. It exists because the two boxes are filled at different times — the isolated bench already has a
// catalogue and logistics, the new one is still being written — and the proof has to be repeatable against
// whichever is ready, without a second copy of the code that would then drift from the first.
//
// ⚠️ AND IT IS PARAMETERISED BY BOX **AND** TENANT because the credential decides the tenant, not the header:
// the INTERNAL read face resolves the tenant from the token and ignores `x-forge-tenant` entirely (measured —
// see `assertCredentialTenant`). Pointing the wrong token at a box does not fail; it answers about the other
// tenant, in a 200.

import { seedCommerce } from '../seed/commerce.mjs';

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const api = (argOf('--api') ?? 'http://localhost:8100').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? 'forgeco';
const token = process.env.FORGE_SEED_TOKEN ?? '';
if (!token) {
  process.stderr.write('[prove] FORGE_SEED_TOKEN is required\n');
  process.exit(1);
}

const log = (msg) => process.stderr.write(`[prove] ${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`[prove] FAILED: ${msg}\n`);
  process.exit(1);
};

/** A command on one of the kernel's write faces. `store` rides in the header, like every other caller. */
async function command(name, input, { store, face = faceOf(name) } = {}) {
  const res = await fetch(`${api}/v1${face ? `/${face}` : ''}/commands/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-forge-tenant': tenant,
      ...(store ? { 'x-forge-store': store } : {}),
    },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(`${name} → HTTP ${res.status} ${JSON.stringify(body)}`);
  return body;
}

/**
 * Which face a command lives on, derived from its own name.
 *
 * ⚠️ THE DEFAULT IS THE BARE TENANT FACE (`/v1/commands/<name>`), not `/v1/internal/commands/…` — the first
 * draft guessed `internal` and every ordinary command answered `404 no command at this route`. The three
 * named prefixes are faces of their own because the kernel mounts them that way (cart-adapter, payment-
 * adapter): `cart.*` and `checkout.*` are the shopper's, `payment.initiate` is its own handler. `bin/seed.mjs`
 * has used the bare face since the beginning, which is the version to copy.
 */
function faceOf(name) {
  if (name.startsWith('cart.')) return 'cart';
  if (name.startsWith('checkout.')) return 'checkout';
  if (name.startsWith('payment.')) return 'payment';
  return '';
}

/** A read. `internal/...` needs the credential; the rest are public. */
async function read(name, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  );
  const res = await fetch(`${api}/v1/read/${name}?${qs}`, {
    headers: { authorization: `Bearer ${token}`, 'x-forge-tenant': tenant },
  });
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    log(`read ${name} → HTTP ${res.status} ${JSON.stringify(body)}`);
    return null;
  }
  return body;
}

/** A raw POST, for the two app faces (the tenant action face and the anonymous public data face). */
async function post(path, body, { store } = {}) {
  // ⚠️ THE ANONYMOUS APP FACE STILL NEEDS THE STORE. It carries no credential to resolve one from, so the
  // header is the ONLY thing that says which shop a public write belongs to — measured: without it the face
  // answers `400 x-forge-store is required`, which is right and is easy to miss when copying the shape of
  // the credentialed calls next door.
  const anonymous = path.startsWith('/v1/ext-public/');
  const res = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forge-tenant': tenant,
      ...(store ? { 'x-forge-store': store } : {}),
      ...(anonymous ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  const parsed = await res.json().catch(() => ({}));
  if (!res.ok) {
    log(`POST ${path} → HTTP ${res.status} ${JSON.stringify(parsed)}`);
    return null;
  }
  return parsed;
}

const stores = (await read('internal/stores')) ?? [];
if (stores.length === 0) fail(`no stores visible to this credential on ${api}`);
log(`against ${api} as ${tenant} — ${stores.map((s) => s.handle).join(', ')}`);

await seedCommerce({ stores, command, read, log, fail, post });
log('done.');
