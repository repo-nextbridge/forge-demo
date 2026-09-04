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
// ⚠️ THIS HARNESS DRIVES THE SAME ANONYMOUS FORM THE SEED DOES, AND IT WAS NOT PACED AT ALL. `seedCommerce`
// writes 52 open reviews through `/v1/ext-public/reviews/review`, whose ceiling is 30 per 60 s per address:
// unpaced, this file 429s on the 31st and the wall is invisible from here (`post` logs and answers null, so
// the shortfall surfaces much later as "products carry fewer reviews than planned"). Same pacer as
// `bin/seed.mjs`, same per-face lanes, same knobs — a second pacing policy would be a second answer to a
// question the kernel only asks once.
import { createPacer, faceOf as faceOfUrl, ratesFromEnv } from '../seed/pacer.mjs';

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const api = (argOf('--api') ?? 'http://localhost:8100').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? 'forgeco';
// ⛔ WHICH STORES THIS RUN IS FOR — stated, never derived from the box. It is the independent half of the
// credential guard: if the token belongs to the other tenant, the read cannot show these handles and the run
// stops. Deriving it from the same read would make the guard compare a list against itself.
const expect = (argOf('--expect') ?? '').split(',').map((h) => h.trim()).filter(Boolean);
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

const pacer = createPacer(ratesFromEnv());
/** Every call this harness makes, on the lane of the face it belongs to. An unknown path is a loud stop. */
const pacedFetch = async (url, init) => {
  const face = faceOfUrl(url);
  if (!face) fail(`no face declared for ${url} — add it to FACE_PATTERNS in seed/pacer.mjs.`);
  await pacer.take(face);
  return fetch(url, init);
};

/** A command on one of the kernel's write faces. `store` rides in the header, like every other caller. */
async function command(name, input, { store, face = faceOf(name) } = {}) {
  const res = await pacedFetch(`${api}/v1${face ? `/${face}` : ''}/commands/${name}`, {
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
  if (!res.ok) {
    // ⛔ The port NAMES the fields it is missing, in `details.missing`. Printing only the message is how an
    // afternoon gets spent inferring what the door was saying all along.
    const missing = Array.isArray(body?.details?.missing)
      ? `\n  MISSING: ${body.details.missing.join(', ')}`
      : '';
    fail(`${name} → HTTP ${res.status} ${body?.code ?? ''} ${body?.message ?? ''}${missing}`);
  }
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
  const res = await pacedFetch(`${api}/v1/read/${name}?${qs}`, {
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
  const res = await pacedFetch(`${api}${path}`, {
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

if (expect.length === 0)
  fail('--expect <handles,…> is required: the stores this run is for. See the note above it.');
log(`against ${api} as ${tenant} — expecting ${expect.join(', ')}`);

await seedCommerce({ expect, command, read, log, fail, post });
log('done.');
