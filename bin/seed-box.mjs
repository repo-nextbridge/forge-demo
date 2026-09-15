#!/usr/bin/env node
// THE BOX — the stores this bench has, the settings every screen inherits, and (for a tenant the mounted
// example dataset is NOT about) the apps and the freight that the dataset's one-shot would otherwise have
// brought along with a catalogue that is not its own. ONE TENANT PER RUN.
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
// A22 — the checkout POSTURE: which of the two `store` columns this box states, and the one declaration that
// would be overwritten in silence. In a module of its own because this file seeds on import, so nothing can
// import it to check its reasoning — the same argument `seed/media.mjs` makes about its own pair.
import { CHECKOUT_FLAGS, bootstrapFlagConflicts, checkoutFlagPatch } from '../seed/posture.mjs';
// pk22 — IS THIS STORE ON THE STREET? The declaration's half of a fact whose reading half already lived in
// `bin/servable.mjs`, and it lives THERE rather than here so the box has one file that both writes the word
// and reads the boolean the port derives from it. See that file for why idempotency cannot compare words.
import { statusPatch } from './servable.mjs';

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
const token = process.env.FORGE_OPERATOR_TOKEN ?? '';

if (!api) fail('no API base. Pass --api http://… or set FORGE_PUBLIC_ORIGIN (see .env.example).');
if (!tenant) fail('no tenant. Pass --tenant <id> (this box has two: forgeco and forgecafe).');
if (!token) {
  fail(
    'no FORGE_OPERATOR_TOKEN. Capture the "Reference Operator" token `provision-ref` prints at bootstrap into\n' +
      '  `.secrets` as `forge-operator-token` and re-source env-source.sh.\n' +
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
          ? `\n  ⚠️ The token in FORGE_OPERATOR_TOKEN almost certainly belongs to a DIFFERENT tenant than ` +
            `"${tenant}".\n     Each tenant has its own: forgeco → forge-operator-token, forgecafe → ` +
            `forge-operator-token-forgecafe.\n     Run the second one as: FORGE_OPERATOR_TOKEN="$FORGE_OPERATOR_TOKEN_FORGECAFE" ` +
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
  // ⛔ EVERY DECLARED STATUS IS A REAL WORD, ASKED BEFORE THE FIRST WRITE. `statusPatch` refuses an unknown
  // one by name (see `bin/servable.mjs` for why silence there is a typo that reads as a decision); asking it
  // here rather than inside the loop is the difference between "nothing was written" and a run that created
  // two stores and then stopped on the third.
  for (const store of spec.stores) statusPatch(store, undefined);
  const existing = await storesByHandle();
  for (const store of spec.stores) {
    const found = existing.get(store.handle);
    if (found) {
      // IDEMPOTENT BY VALUE. A second run must converge, and re-writing a theme that already matches spends a
      // command and an audit row to change nothing.
      //
      // ★ THE CHECKOUT POSTURE JOINS THE THEME HERE, and for the same reason it is declared at all: the two
      // columns are born at their own defaults (masked OFF, guest ON) and used to be flipped by
      // `configureStore` inside the dataset one-shot. A tenant that no longer runs that one-shot needs the box
      // to state them, and re-asserting them every birth is the point — a re-provision resets the store to the
      // defaults. WHICH stores may be stated here is `bootstrapFlagConflicts`' subject; see `assertOneOwner`.
      const patch = checkoutFlagPatch(store, found);
      // ★ pk22 — AND THE COLUMN THAT DECIDES WHETHER A VITRINE SERVES THIS STORE AT ALL. Same rule as the
      // flags: idempotent by value, so a converged box spends no command — except that the port never answers
      // the WORD (`read.internal.stores` publishes the derived boolean and drops `status`), which is why the
      // comparison lives in `bin/servable.mjs` instead of being spelled here.
      Object.assign(patch, statusPatch(store, found));
      if (store.theme_key && found.theme_key !== store.theme_key) patch.theme_key = store.theme_key;
      if (Object.keys(patch).length > 0) {
        await command('tenant.store.update', { id: found.id, ...patch });
        log(
          `store ${store.handle} — already there; ${Object.entries(patch)
            .map(([k, v]) => `${k} → ${v}`)
            .join(', ')}`,
        );
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
    // ★★ pk22 — `status` RIDES ON THE CREATE, AND THAT IS THE ONE COLUMN THAT MUST. The checkout flags below
    // are a second command because `tenant.store.create` does not take them; `status` it DOES take, and the
    // kernel put it there for exactly this case (pk13/C6): created without it, a counter is a store WITH a
    // public page for the window between the two commands — public at the moment nobody has checked it yet.
    // An unknown word never reaches here: `statusPatch` refuses it by name before the first request.
    const out = await command('tenant.store.create', {
      handle: store.handle,
      name: store.name,
      ...(store.theme_key ? { theme_key: store.theme_key } : {}),
      ...statusPatch(store, undefined),
    });
    const id = out.store_id ?? out.id;
    log(`store ${store.handle} — created (${id ?? '?'})`);
    // ⚠️ THE FLAGS ARE A SECOND COMMAND AND NOT FIELDS OF THE FIRST. `tenant.store.create` takes name, handle,
    // host and theme_key — nothing else (packages/core/src/commands/store.ts, `storeInput`); the checkout
    // flags live only on `tenant.store.update`. Sending them on create is how a declaration goes quietly
    // nowhere, which is the failure mode this whole slice is about.
    const born = {};
    for (const flag of CHECKOUT_FLAGS) if (store[flag] !== undefined) born[flag] = store[flag];
    if (Object.keys(born).length > 0 && id) {
      await command('tenant.store.update', { id, ...born });
      log(
        `store ${store.handle} — ${Object.entries(born)
          .map(([k, v]) => `${k} → ${v}`)
          .join(', ')}`,
      );
    }
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

/** Every row of an internal read that answers either a bare array or a `{items}` envelope. */
const rows = (payload) => (Array.isArray(payload) ? payload : (payload?.items ?? []));

// ── ★★ THE HALF OF THE DATASET ONE-SHOT THAT WAS NEVER THE DATASET'S ────────────────────────────────────────
//
// ⛔ THE DEFECT THIS PAIR OF STEPS EXISTS FOR, MEASURED ON THE BENCH OF 02/09 AND WORTH THE PARAGRAPH.
//
// `bin/box-up.sh` step 9 ran `dist/seed-demo.js` `for t in $TENANTS`. That entrypoint fills the tenant it is
// POINTED AT from whatever dataset the box mounts — and this box mounts ONE, the footwear catalogue. So the
// coffee tenant was handed 2 790 footwear products, 44 427 SKUs, 351 footwear brands, 33 footwear categories
// and the dataset's eleven footwear custom fields (AMORTECIMENTO, CANO, DROP MM, …), on top of its own 21.
//
// ★ AND THE KERNEL DID NOTHING WRONG, which is the half that decides where the repair belongs. The same
// handles carry DIFFERENT product ids in the two schemas (`adidas-golf-braided-stretch-belt` is
// `prod_01M1FRFC9D…` in forgeco at 00:32:03 and `prod_01M1FS95MQ…` in forgecafe at 00:46:08): two independent,
// correctly-scoped writes, not one leaking sideways. The entrypoint filled exactly the tenant it was given.
// The defect was the loop that gave it a second one, so the repair is here and not in the monorepo.
//
// ★★ BUT SKIPPING STEP 9 IS NOT FREE, AND THIS IS THE PART THAT IS EASY TO GET WRONG. `seed-demo.js` fuses
// two jobs under one name: fill the store from the dataset, and PROVISION the tenant — install its storefront
// apps, give it delivery, turn on its checkout flags. Only the first is the dataset's. Measured, the coffee
// tenant's ONLY delivery methods were born at 00:58:33, inside that one-shot; before it the tenant had nothing
// but the counter's pickup. Dropping step 9 without this would leave a coffee shop that cannot be paid, cannot
// be delivered from, and fails step 10 by name.
//
// So the box declares that half itself, for the tenant the dataset is not about. `seed/box.json` carries the
// `why` for each list; this file is only the hand.

/** ★ THE APPS THIS TENANT CONSENTS TO — idempotent by the installation list, which is the read that answers
 *  the question being asked.
 *
 *  ⚠️ `read.extensions` is the WRONG read here and it answers plausibly: it takes a STORE and lists the apps
 *  with a block PLACEMENT there, so an app can be installed and working and still be absent from it. The
 *  tenant's installations are `read.installed_extensions`, which takes no store. `seed/commerce.mjs` carries
 *  the same warning over the same trap, one file away. */
async function apps() {
  const wanted = spec.apps ?? [];
  if (wanted.length === 0) return;
  const installed = new Set(
    rows(await read('installed_extensions'))
      .filter((e) => (e.status ?? 'active') === 'active')
      .map((e) => e.extension_id ?? e.id),
  );
  for (const id of wanted) {
    if (installed.has(id)) {
      log(`app ${id} — already installed`);
      continue;
    }
    await command('extension.install', { extension_id: id });
    log(`app ${id} — installed`);
  }
}

/** ★ THE TENANT'S OWN FREIGHT. Idempotent by NAME, which is what makes the name a key: two methods called
 *  "Entrega Padrão" is an ambiguity a shopper resolves by guessing, and `seed-history` resolves by refusing.
 *
 *  The shape is `seed/totem.mjs`'s, deliberately — that file already drives these three commands with this
 *  credential, so nothing here is a new power. `shipping.rate.set` is an UPSERT on (method, zone, bracket),
 *  so re-asserting a rate is free and the check below only saves the command, never the correctness. */
async function delivery() {
  const wanted = spec.delivery;
  if (!wanted) return;

  const zone =
    rows(await read('shipping_zones')).find((z) => z.name === wanted.zone.name) ??
    (await (async () => {
      const out = await command('shipping.zone.create', wanted.zone);
      log(`shipping zone "${wanted.zone.name}" — created (${out.zone_id})`);
      return { id: out.zone_id };
    })());
  const zoneId = zone.id ?? zone.zone_id;

  const existing = rows(await read('shipping_methods_admin'));
  const rated = rows(await read('shipping_rates'));
  for (const m of wanted.methods) {
    const found = existing.find((row) => row.name === m.name);
    const methodId =
      (found?.id ?? found?.method_id) ??
      (await (async () => {
        const out = await command('shipping.method.create', {
          name: m.name,
          kind: 'delivery',
          dimensional_divisor: m.dimensional_divisor,
          max_weight_grams: m.max_weight_grams,
          active: true,
        });
        log(`shipping method "${m.name}" — created, kind delivery (${out.method_id})`);
        return out.method_id;
      })());
    for (const rate of m.rates) {
      const already = rated.some(
        (r) =>
          (r.method_id ?? r.shipping_method_id) === methodId &&
          r.zone_id === zoneId &&
          Number(r.weight_bracket_max_grams) === rate.weight_bracket_max_grams,
      );
      if (already) continue;
      await command('shipping.rate.set', { method_id: methodId, zone_id: zoneId, ...rate });
      log(`rate "${m.name}" ≤${rate.weight_bracket_max_grams}g — ${rate.price} cents`);
    }
  }
}

/** ⛔ ONE OWNER PER GESTURE, AND THE FILE IS GRADED ON IT RATHER THAN TRUSTED.
 *
 *  A tenant the dataset IS about gets its apps, its freight and its checkout flags from `dist/seed-demo.js`
 *  at step 9. If such a tenant also declared them here, both would run and neither would know: `populate`'s
 *  shipping is idempotent by its own app LEDGER, not by reading what is already there, so it would create a
 *  SECOND "Entrega Padrão" — and a tenant with two active delivery methods is exactly what step 10 refuses.
 *  A duplicate born from two owners is the failure this repository has already paid for twice. */
function assertOneOwner() {
  if (spec.dataset !== true) return;
  const declared = ['apps', 'delivery'].filter((k) => spec[k] !== undefined);
  if (declared.length > 0) {
    fail(
      `seed/box.json declares ${declared.join(' + ')} for "${tenant}", which also declares \`dataset: true\`.\n` +
        '  A dataset tenant is provisioned by `dist/seed-demo.js` (step 9 of bin/box-up.sh) — apps, delivery\n' +
        '  and its BOOTSTRAP store\'s checkout flags all come from there. Declaring them here too gives one\n' +
        '  gesture two owners, and the visible cost is a SECOND "Entrega Padrão": `populate` is idempotent by\n' +
        '  its own ledger and does not see a method this script created. Step 10 then refuses the tenant for\n' +
        '  having two.',
    );
  }
  // ★★ A22 — THE THIRD GESTURE, AND IT IS ONLY HALF THE ONE-SHOT'S. `configureStore`
  // (apps/api/src/seed-storefront.ts) re-asserts `masked_checkout_enabled: true` AND `guest_checkout_enabled:
  // true` on every run — but on ONE store, `ctx.storeId`, which is the tenant's bootstrap store. Measured on
  // the bench of 04/09: `forge` came out masked=t/guest=t and its sibling `outlet` masked=f/guest=t, i.e. the
  // column defaults. So the SIBLING is genuinely unowned and this box may state its posture; the BOOTSTRAP
  // store is not, and a declaration here would be silently overwritten at step 9 — the worst shape of all,
  // because the file would say one thing and the box would show another with no failure anywhere.
  const bootstrap = bootstrapFlagConflicts(spec);
  if (bootstrap.length === 0) return;
  fail(
    `seed/box.json declares checkout flags on the BOOTSTRAP store(s) ${bootstrap
      .map((s) => `"${s.handle}"`)
      .join(', ')} of "${tenant}", which also declares \`dataset: true\`.\n` +
      '  Step 9 (`dist/seed-demo.js` → `configureStore`) re-asserts masked + guest on exactly that store,\n' +
      '  AFTER this script runs, so what is written here would be overwritten in silence. Declare the\n' +
      '  posture of the SIBLING stores here (step 9 never touches them) and leave the bootstrap store to\n' +
      '  the one-shot — or change the one-shot, which is the product repository.',
  );
}

/**
 * ★★ WHOSE CREDENTIAL IS THIS? — asked before anything is touched, because the box can answer it and
 * because getting it wrong is silent.
 *
 * THE TRAP, measured on this bench: the INTERNAL READ FACE IGNORES `x-forge-tenant` and resolves the tenant
 * from the CREDENTIAL. T1's token asking for `forgecafe` answered HTTP 200 with T1's OWN stores. So a seeder
 * that reads before it writes sees a plausible shelf belonging to the wrong tenant, and every conclusion it
 * draws from that is wrong while looking fine. This script once reported "the bootstrap store is missing" and
 * sent a reader off to re-provision a tenant that was perfectly healthy.
 *
 * ★ AND THE FIX IS AN ASSERTION, NOT AN ORDERING. The first defence was "do a write first, so a mismatch
 * 403s" — that works and depends on somebody remembering to keep the write first forever. This asks the
 * question directly: `whoami` on the internal face returns the tenant the CREDENTIAL belongs to, and a token
 * from the wrong tenant cannot answer anything but its own. The response IS the proof, so it holds whatever
 * order the steps run in. (The shape is P-C's, arrived at independently on the same trap.)
 *
 * The store cross-check below is the corroboration: the tenant we are about to build must be one whose
 * bootstrap store this credential can actually see. Two independent facts, one refusal.
 */
async function assertCredentialTenant() {
  const who = await read('whoami');
  const actual = who?.tenant_id;
  if (actual !== tenant) {
    fail(
      `THIS CREDENTIAL BELONGS TO "${actual ?? '(unknown)'}", NOT "${tenant}".\n` +
        '  Nothing has been written. The internal read face resolves the tenant from the CREDENTIAL and\n' +
        '  IGNORES the `x-forge-tenant` header, so without this check the run would have read the other\n' +
        "  tenant's stores, found this tenant's bootstrap store missing, and blamed the bootstrap.\n" +
        '  Each tenant has its own token: forgeco → forge-operator-token, forgecafe → forge-operator-token-forgecafe.\n' +
        '    FORGE_OPERATOR_TOKEN="$FORGE_OPERATOR_TOKEN_FORGECAFE" node bin/seed-box.mjs --tenant forgecafe',
    );
  }
  log(`credential → ${actual} ✓`);
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
  assertOneOwner();
  await assertCredentialTenant();
  await stores();
  await settings();
  // AFTER the stores and BEFORE anything that fills them. Step 8 (the curated seed), step 10 (the past) and
  // step 11 (the window's live order) each need a paid, deliverable shop to exist already.
  await apps();
  await delivery();
  await verifyAdminHost();
  log('done.');
}

main().catch((err) => fail(err?.message ?? String(err)));
