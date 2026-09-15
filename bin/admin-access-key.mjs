#!/usr/bin/env node
// ★★★ THE FRONT DOOR OF ONE TENANT'S ADMIN, MINTED BY THE BIRTH — one operator access key per tenant.
//
//   FORGE_OPERATOR_TOKEN=<that tenant's credential> node bin/admin-access-key.mjs --tenant <id> --api <origin>
//   node bin/admin-access-key.mjs --declare      the map `env-source.sh` exports, built from the secret store
//
// Writes the RAW KEY to stdout and nothing else; every word for a human goes to stderr. `bin/box-up.sh`
// captures stdout into a temp file, files it into `.secrets`, and shreds the file — the same handling
// `provision-ref`'s two secrets get, and for the same reason: a token that reaches a terminal reaches a
// scrollback, a log, and anything reading either.
//
// ── ⛔ WHAT WAS MISSING, AND IT IS THE WHOLE CARD ────────────────────────────────────────────────────────
//
// The gate's admin row sends an operator to `<admin>/enter`, which redeems an operator access key SERVER-SIDE
// and lands signed in with no login screen. Nothing on this box ever MINTED that key: the admin's variable
// was declared in no `.env.example`, no compose file and no step of the birth, so `/enter` fell through to
// `/login` on every box this repository has ever built. A demo that regenerates on a schedule cannot ask a
// human to mint a key by hand after each rebirth — that is the one gesture a reset may not require.
//
// ── ★ WHY THIS DRIVES THE PORT AND NOT THE DATABASE ─────────────────────────────────────────────────────
//
// `operator.access_key.create` is a kernel command behind `admin.users.write`, which the tenant's reference
// operator holds (its role is derived from the whole command registry). So this is a caller of the same door
// the admin screen uses — never a second write path, and never a scope this box invented.
//
// ── ★★ IT IS IDEMPOTENT BY REVOKING, BECAUSE A RAW KEY IS UNRECOVERABLE ─────────────────────────────────
//
// The kernel stores the hash and returns the key exactly once, so a re-run cannot reuse the key the last run
// minted: it has to create a new one. Left alone, every re-run of the birth would leave another LIVE front
// door on the tenant, each redeeming into the same operator's session, none of them named anywhere. So the
// keys this step minted before — recognised by the label below, which nothing else writes — are revoked
// first. What remains active is exactly the one this run just filed.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The label this step writes on every key it mints, and the one it revokes by. It is a sentence rather than a
 * slug because the Team screen lists it to a human, and "who left this door open?" is the question the label
 * exists to answer.
 */
export const KEY_LABEL = 'gate /enter door (minted at birth)';

/**
 * WHERE ONE TENANT'S KEY IS FILED IN THE SECRET STORE, derived from `seed/box.json`'s declaration order.
 *
 * ⚠️ THE FIRST TENANT'S NAME CARRIES NO SUFFIX, and that is not tidiness: it is the rule every other
 * per-tenant secret on this box already follows (`forge-operator-token` / `forge-operator-token-<tenant>`,
 * `bin/box-up.sh::secret_name_for`), so a reader who has learned one has learned all three. The two authors
 * of the rule are pinned to each other by `bin/admin-access-key.test.mjs`.
 */
export function accessKeySecretName(tenants, tenantId) {
  const base = 'forge-admin-access-key';
  return tenants[0] === tenantId ? base : `${base}-${tenantId}`;
}

/** `seed/box.json`'s tenant ids, in declaration order — the axis every map on this box is keyed by. */
export function boxTenants(root = ROOT) {
  const box = JSON.parse(readFileSync(join(root, 'seed', 'box.json'), 'utf8'));
  return (box.tenants ?? []).map((t) => t.id).filter(Boolean);
}

/**
 * `FORGE_ADMIN_ACCESS_KEYS` — the map the admin reads, in the shape the `/enter` route defines:
 *
 *     {"<tenant id>": {"store": "<store id>", "key": "<raw key>"}}
 *
 * The tenant id is the REGISTRY id — what `read.admin.by_host` answers for the hostname the browser asked
 * for, which on this box is `seed/box.json`'s `tenants[].id` (the same string every credential, claim and
 * `x-forge-tenant` header on this box carries). The store is a store OF THAT TENANT: the redeem face is
 * public and takes no credential, so `x-forge-store` is what fixes which tenant a key is checked against,
 * and a store of another tenant answers `unauthorized`.
 *
 * ★★★ AN ENTRY IS WHOLE OR ABSENT — NEVER BORROWED. Both halves are looked up under THIS tenant's own name
 * (its secret, its store id), and a tenant missing either half is dropped from the map entirely. That one
 * rule is what makes the failure mode safe: a brand with no entry falls through to its own login screen,
 * which is what an unconfigured instance has always done, and it can never inherit its neighbour's key —
 * which would sign a visitor on one brand's hostname into the other brand's tenant. There is no positional
 * fallback anywhere in this function, and `bin/admin-access-key.test.mjs` proves the absence by asking for a
 * box where only one tenant is configured.
 *
 * ⛔ IT IS BUILT HERE AND NOT IN `env-source.sh` so that the naming rule above has ONE author. Two spellings
 * of one secret name is the defect that makes a key look filed and read back missing.
 */
export function declaredAccessKeys(secrets, storeIds, tenants) {
  const out = {};
  for (const tenant of tenants) {
    const key = secrets.get(accessKeySecretName(tenants, tenant));
    const store = storeIds?.[tenant];
    if (typeof key === 'string' && key.length > 0 && typeof store === 'string' && store.length > 0) {
      out[tenant] = { store, key };
    }
  }
  return out;
}

/** The bench's secret store, `NAME=value` per line. Absent file ⇒ an empty store, never a throw. */
function readSecrets(root = ROOT) {
  const store = new Map();
  let text;
  try {
    text = readFileSync(join(root, '.secrets'), 'utf8');
  } catch {
    return store;
  }
  for (const line of text.split('\n')) {
    const at = line.indexOf('=');
    if (at <= 0) continue;
    if (!store.has(line.slice(0, at))) store.set(line.slice(0, at), line.slice(at + 1));
  }
  return store;
}

/**
 * The non-secret half, read from `.env` — `FORGE_ADMIN_STORE_IDS`, written by `bin/box-up.sh` from the ids
 * `provision-ref` returned. It lives there rather than in the secret store because a store id is not a
 * secret and because `.env` is what compose interpolates the rest of this box from.
 *
 * ⚠️ THE QUOTES box-up WRITES ARE STRIPPED, the same way `source` and compose both strip them (see that
 * script's `put_env`). Anything unparseable is an EMPTY map — which drops every entry, never half of one.
 */
function readStoreIds(root = ROOT) {
  let text;
  try {
    text = readFileSync(join(root, '.env'), 'utf8');
  } catch {
    return {};
  }
  for (const line of text.split('\n')) {
    if (!line.startsWith('FORGE_ADMIN_STORE_IDS=')) continue;
    const raw = line.slice('FORGE_ADMIN_STORE_IDS='.length).trim().replace(/^'|'$/g, '');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * WHICH OPERATOR THE KEY REDEEMS INTO, derived from what the tenant holds rather than configured.
 *
 * ⚠️ IT IS NEVER "the first row". A key redeems into ITS operator's session, so picking whoever happens to
 * sort first would hand the demo's front door to whichever colleague was invited last. The rule is the one
 * the tenant is born with: the operator carrying the `owner` role — `provision-ref` invites exactly one, and
 * it is the same operator whose credential this script is authenticating with.
 *
 * ⛔ "LOGINABLE" IS `status <> 'disabled'`, NEVER `status === 'active'`, AND ON THIS BOX THE DIFFERENCE IS
 * THE WHOLE FEATURE. A freshly provisioned tenant's owner is `invited` — the status flips to `active` on the
 * FIRST sign-in, and signing in without a login screen is exactly what this key is for. Grading on `active`
 * would refuse every box on the one day it matters, and it would be a stricter rule than the kernel's own
 * (`loadLoginableUserById` selects `status <> 'disabled'`).
 *
 * ⛔ AND AMBIGUITY REFUSES rather than picks. Two owners is a tenant somebody has since invited into, and
 * choosing silently between them would put a redeemable session on a person nobody named.
 *
 * @returns {{ ok: true, user: { id: string, email?: string } } | { ok: false, why: string }}
 */
export function chooseOperator(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, why: 'the tenant has no operator at all — `provision-ref` invites one, so this box was not born' };
  }
  const owners = rows.filter((row) => row?.role === 'owner' && row?.status !== 'disabled');
  if (owners.length === 1) return { ok: true, user: owners[0] };
  if (owners.length === 0) {
    return {
      ok: false,
      why:
        `none of the tenant's ${rows.length} operator(s) is a loginable owner ` +
        `(role/status seen: ${[...new Set(rows.map((r) => `${r?.role}/${r?.status}`))].join(', ')})`,
    };
  }
  return {
    ok: false,
    why:
      `the tenant has ${owners.length} loginable owners, so there is no ONE session this door should open. ` +
      'Mint the key for the operator it belongs to from the admin Team screen instead',
  };
}

const argOf = (name) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : undefined;
};
const log = (message) => process.stderr.write(`[access-key] ${message}\n`);
const fail = (message) => {
  log(message);
  process.exit(1);
};

async function main() {
  const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
  const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? '';
  const token = process.env.FORGE_OPERATOR_TOKEN ?? '';

  if (!api) fail('no API base. Pass --api http://… or set FORGE_PUBLIC_ORIGIN (see .env.example).');
  if (!tenant) fail('no tenant. Pass --tenant <id>.');
  if (!token) {
    fail(
      'no FORGE_OPERATOR_TOKEN. Each tenant has its own credential and step 3 of the birth files both into\n' +
        '  `.secrets`; re-source env-source.sh. A credential of the OTHER tenant is refused by the ' +
        'cross-tenant guard, which is the boundary working.',
    );
  }

  const box = JSON.parse(readFileSync(join(ROOT, 'seed', 'box.json'), 'utf8'));
  if (!box.tenants?.some((t) => t.id === tenant)) {
    fail(
      `seed/box.json declares no tenant "${tenant}". It knows: ${(box.tenants ?? []).map((t) => t.id).join(', ')}.`,
    );
  }

  const call = async (path, init) => {
    const res = await fetch(`${api}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-forge-tenant': tenant,
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) fail(`${path} → HTTP ${res.status} ${JSON.stringify(body)}`);
    return body;
  };

  const operators = await call('/v1/read/internal/admin_users', { method: 'GET' });
  const chosen = chooseOperator(Array.isArray(operators) ? operators : (operators.items ?? []));
  if (!chosen.ok) fail(`${tenant}: ${chosen.why}.`);

  // ⚠️ REVOKE BEFORE CREATE, so a run that dies between the two leaves a tenant with NO front door rather
  // than with two — the state a human can see and repair by re-running, instead of one nobody can count.
  const existing = await call('/v1/read/internal/operator_access_keys', { method: 'GET' });
  let revoked = 0;
  for (const key of Array.isArray(existing) ? existing : (existing.items ?? [])) {
    if (key?.label !== KEY_LABEL) continue;
    await call('/v1/commands/operator.access_key.revoke', {
      method: 'POST',
      body: JSON.stringify({ access_key_id: key.id }),
    });
    revoked += 1;
  }

  const minted = await call('/v1/commands/operator.access_key.create', {
    method: 'POST',
    body: JSON.stringify({ admin_user_id: chosen.user.id, label: KEY_LABEL }),
  });
  if (typeof minted.key !== 'string' || minted.key.length === 0) {
    fail(`the kernel minted no key for "${tenant}" (it answered ${JSON.stringify(minted)}).`);
  }

  // ⛔ THE IDENTIFIER, NEVER THE KEY. `access_key_id` is what the Team screen shows and what a revoke takes;
  // the key itself leaves this process on stdout and is never named in a sentence.
  log(
    `${tenant} · operator ${chosen.user.id} · key ${minted.access_key_id} minted` +
      (revoked > 0 ? ` · ${revoked} earlier key(s) of this step revoked` : ''),
  );
  process.stdout.write(`${minted.key}\n`);
}

// Run, never on import: the test below imports this module for `chooseOperator`, and a module that talks to
// the port on import would make that suite need a box.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--declare')) {
    // ⛔ THE MAP, NEVER A KEY IN PROSE. This writes one JSON document to stdout for `env-source.sh` to
    // capture into a variable; nothing about it is ever logged, counted aloud or named on stderr.
    process.stdout.write(
      `${JSON.stringify(declaredAccessKeys(readSecrets(), readStoreIds(), boxTenants()))}\n`,
    );
  } else {
    await main();
  }
}
