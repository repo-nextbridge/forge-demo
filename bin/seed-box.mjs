#!/usr/bin/env node
// THE BOX — the stores this bench has and the settings every screen inherits. ONE TENANT PER RUN.
//
//   node bin/seed-box.mjs --tenant forgeco
//   node bin/seed-box.mjs --tenant forgecafe
//
// It reads `seed/box.json` and applies the entry whose `id` matches. It is the piece that PREPARES THE
// TERRAIN; `bin/seed.mjs` and the `demo-data` app are what FILL it. Two pieces filling is how one of them
// rots without anyone noticing — the lesson this repo already paid for once.
//
// ★ WHY A RUN IS SCOPED TO ONE TENANT, AND IT IS NOT A CHOICE. The write face takes the tenant as a HEADER
// (`x-forge-tenant`) and refuses without one; a credential is a tenant's. So "seed both tenants" is two runs
// with two tokens, and pretending otherwise would mean one credential reaching across a boundary the kernel
// exists to hold.
//
// ⚠️ WHAT THIS SCRIPT CANNOT DO, and where that work lives instead: it cannot claim the admin hostname.
// `platform.admin_host.set` is `system: true` on the CONTROL face and needs `platform.tenant.write`, and this
// box has no way to mint a credential holding that scope — the only entrypoint that mints a platform
// credential (`dist/admin-platform-token.js`) hardcodes ONE scope, `platform.admin_driver.mint`, on purpose.
// Measured, not assumed. The claim therefore happens where a system dispatch already exists: at bootstrap,
// via `FORGE_ADMIN_HOST` on `provision-ref` (and `dist/admin-host.js` afterwards). `admin_host` in box.json
// is carried here so ONE file states the whole topology; this script VERIFIES it and never writes it.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const argOf = (name) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : undefined;
};
const fail = (message) => {
  process.stderr.write(`[box] ${message}\n`);
  process.exit(1);
};
const log = (message) => process.stderr.write(`[box] ${message}\n`);

const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? process.env.FORGE_REF_TENANT ?? '';
const token = process.env.FORGE_SEED_TOKEN ?? '';

if (!api) fail('no API base. Pass --api http://… or set FORGE_PUBLIC_ORIGIN (see .env.example).');
if (!tenant) fail('no tenant. Pass --tenant <id> (this box has two: forgeco and forgecafe).');
if (!token) {
  fail(
    'no FORGE_SEED_TOKEN. Capture the "Reference Operator" token `provision-ref` prints at bootstrap into\n' +
      '  `.secrets` as `forge-seed-token` and re-source env-source.sh.\n' +
      '  ⚠️ EACH TENANT HAS ITS OWN. A token minted for one tenant is refused for the other by the\n' +
      '     cross-tenant guard — that refusal is the boundary working, not a misconfiguration.',
  );
}

const box = JSON.parse(readFileSync(join(ROOT, 'seed', 'box.json'), 'utf8'));
const spec = box.tenants.find((t) => t.id === tenant);
if (!spec) {
  fail(
    `seed/box.json declares no tenant "${tenant}". It knows: ${box.tenants.map((t) => t.id).join(', ')}.`,
  );
}

async function call(path, init) {
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
  if (!res.ok) {
    // The tenant header is the refusal that reads like a permissions problem and is not — name it here so
    // nobody spends an evening on it twice (the story is in env-source.sh).
    const hint =
      body?.message === 'tenant required'
        ? ' — the write face takes the tenant as the `x-forge-tenant` header; this script sends it, so seeing ' +
          'this means the header never arrived'
        : res.status === 403
          ? `\n  ⚠️ The token in FORGE_SEED_TOKEN almost certainly belongs to a DIFFERENT tenant than ` +
            `"${tenant}".\n     Each tenant has its own: forgeco → forge-seed-token, forgecafe → ` +
            `forge-seed-token-forgecafe.\n     Run the second one as: FORGE_SEED_TOKEN="$FORGE_SEED_TOKEN_FORGECAFE" ` +
            `node bin/seed-box.mjs --tenant forgecafe`
          : '';
    fail(`${path} → HTTP ${res.status} ${JSON.stringify(body)}${hint}`);
  }
  return body;
}

const command = (name, input) =>
  call(`/v1/commands/${name}`, { method: 'POST', body: JSON.stringify(input) });
const read = (name, params = '') => call(`/v1/read/internal/${name}${params}`, { method: 'GET' });

/** The tenant's stores, by handle. `read.internal.stores` is the ONLY read that answers a handle — the public
 * face has none, which is why this script uses the internal one behind the same credential. */
async function storesByHandle() {
  const out = await read('stores');
  const rows = Array.isArray(out) ? out : (out.items ?? out.stores ?? []);
  return new Map(rows.map((s) => [s.handle, s]));
}

async function stores() {
  const existing = await storesByHandle();
  for (const store of spec.stores) {
    const found = existing.get(store.handle);
    if (found) {
      // IDEMPOTENT BY VALUE. A second run must converge, and re-writing a theme that already matches spends a
      // command and an audit row to change nothing.
      if (store.theme_key && found.theme_key !== store.theme_key) {
        await command('tenant.store.update', { id: found.id, theme_key: store.theme_key });
        log(`store ${store.handle} — already there; theme_key → ${store.theme_key}`);
      } else {
        log(`store ${store.handle} — already there`);
      }
      continue;
    }
    if (store.bootstrap) {
      // The first store of a tenant is `provision-ref`'s. If it is missing, the box was not bootstrapped the
      // way this file describes, and CREATING it here would paper over that with a store whose id nothing
      // else expects.
      fail(
        `store "${store.handle}" is the tenant's BOOTSTRAP store and it is not there. It is created by\n` +
          `  \`provision-ref\` (FORGE_REF_STORE_HANDLE), not by this script. Run the bootstrap for ${tenant}\n` +
          '  first — see README, "The bench".',
      );
    }
    const out = await command('tenant.store.create', {
      handle: store.handle,
      name: store.name,
      ...(store.theme_key ? { theme_key: store.theme_key } : {}),
    });
    log(`store ${store.handle} — created (${out.store_id ?? out.id ?? '?'})`);
  }
}

/** ★ THE INSTANCE'S LANGUAGE, CLOCK AND MONEY. Declared for BOTH tenants because a tenant is where they live
 * (`instance_settings` is a tenant table), so "the box is in pt-BR" is two writes, not one.
 *
 * ⚠️ `default_currency` IS ALREADY `BRL` — the migration's own default (tenant/0073). It is declared anyway:
 * stating what is already true costs one idempotent write and stops a future change of that default from
 * silently re-pricing this bench. The two that genuinely differ are the locale ('en') and the timezone
 * ('UTC'), and an app's name showing up in English on a Brazilian demo is exactly what that cost. */
async function settings() {
  const values = spec.settings ?? {};
  if (Object.keys(values).length === 0) return;
  await command('tenant.settings.update', values);
  log(
    `settings — ${Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join(' · ')}`,
  );
}

/** The admin hostname this tenant answers on. VERIFIED, never written — see the header for why the write is
 * not reachable from here. A mismatch is loud because the symptom otherwise is a login screen that refuses
 * with `unknown_admin_host` and says nothing about which host it wanted. */
async function verifyAdminHost() {
  if (!spec.admin_host) return;
  const res = await fetch(`${api}/v1/read/admin.by_host?host=${encodeURIComponent(spec.admin_host)}`);
  const body = await res.json().catch(() => ({}));
  const claimed = body?.tenant_id ?? body?.tenant ?? null;
  if (claimed === tenant) {
    log(`admin host ${spec.admin_host} → ${tenant} ✓`);
    return;
  }
  log(
    `⚠️ admin host ${spec.admin_host} answers ${claimed ?? '(nobody)'} , expected ${tenant}.\n` +
      `  This script cannot claim it (no credential on this box holds platform.tenant.write). Claim it with:\n` +
      `    docker compose run --rm kernel node dist/admin-host.js set ${spec.admin_host} ${tenant}`,
  );
}

async function main() {
  log(`tenant ${tenant} · ${api}`);
  // ★★ SETTINGS FIRST, AND THE ORDER IS THE GUARD — measured, after this script told a lie.
  //
  // `read.internal.stores` IGNORES the `x-forge-tenant` header and resolves the tenant from the CREDENTIAL.
  // Measured on this box: T1's token asking for `forgecafe` answered HTTP 200 with T1's OWN stores. So the
  // read cannot confirm which tenant we are in — pointing this script at T2 with T1's token read T1's shelf,
  // failed to find T2's bootstrap store in it, and blamed the bootstrap. The message was wrong and would have
  // sent somebody to re-provision a tenant that was perfectly fine.
  //
  // The WRITE face does honour the header (403 `forbidden` on a mismatch), so doing a write FIRST turns the
  // ambiguity into a refusal that names the real cause. `tenant.settings.update` is the right one: idempotent,
  // cheap, and something this script has to do anyway.
  await settings();
  await stores();
  await verifyAdminHost();
  log('done.');
}

main().catch((err) => fail(err?.message ?? String(err)));
