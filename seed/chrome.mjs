// A10 (the DEMO half) — THE `chrome` APP, INSTALLED, PLACED AND FILLED IN. `seed/chrome.json` holds the data
// and the reasons; this file is only the hand.
//
// ★★ THREE GESTURES, NOT ONE, AND EACH OF THEM IS SEPARATELY INVISIBLE WHEN IT IS MISSING:
//   · COMPOSING puts the app in the image (`composition.json`) — it is already there;
//   · INSTALLING makes it a row in the tenant's Apps area (`extension.install`) — nothing did this, so a
//     human did it by hand on 2026-09-04 while testing, and a rebirth would have lost it;
//   · PLACING makes it render (`composition.place`) — and installing does NOT do it here. The manifest
//     declares `hooks: []`, so `seedDefaultPlacements` returns before the loop; the app's own default
//     placements simply do not exist. Measured against the source, not assumed.
//
// ⚠️ AND FILLING IN IS THE FOURTH, which is the one the achado was about. Every field of every block is
// optional and the app writes NO default word anywhere, so a placed-and-empty block draws nothing at all.
// «Placed» and «configured» are therefore not the same claim, and only the second one shows an operator where
// the pieces go.
//
// IT RUNS IN THE **CURATED** PHASE, AFTER the counter's store exists (`seedTotem` creates `balcao`): the
// declaration names stores by handle and a handle that has not been created yet cannot be resolved. It needs
// nothing from the massive catalogue, so it does not wait for the window.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(SEED, 'chrome.json'), 'utf8'));

/** Config keys the declaration uses for a picture: the kernel's `type:'id'` fields, by name. */
const IMAGE_FIELDS = ['logo', 'start_image', 'middle_image', 'end_image'];

/** A key that is documentation and never a config field. */
const isMeta = (key) => key.startsWith('_');

/** The blocks one store declares, `{component, slot, config}`, in the declaration's own order. */
export function blocksFor(spec, handle) {
  const store = spec.stores?.[handle];
  if (!store) return [];
  return Object.entries(store)
    .filter(([component]) => !isMeta(component))
    .map(([component, config]) => {
      const slot = spec.slots?.[component];
      if (!slot) {
        throw new Error(
          `seed/chrome.json: store "${handle}" declares a block "${component}" that the file's own ` +
            '`slots` map does not name. The slot is what `composition.place` validates the block against, ' +
            'so there is nothing to guess.',
        );
      }
      return { component, slot, config };
    });
}

/**
 * ★ EVERY PICTURE THE DECLARATION NAMES, derived from the configs rather than listed a second time.
 *
 * A second list would be a list that can disagree with the first, and the way it disagrees is silent: the
 * file names a logo, nothing uploads it, the config stores a filename where the kernel expects an asset id,
 * and the header draws nothing. Deriving is what makes «declared» and «uploaded» one fact.
 *
 * ⚠️ AND IT IS SCOPED TO THE STORES OF THE RUNNING TENANT, which is not tidiness. An asset library is a
 * TENANT's, and this seed runs once per tenant: deriving over the whole file would upload the coffee shop's
 * logo into the shoe brand's library, where nothing references it — a row an operator finds and cannot
 * explain. Absent `handles`, the answer is the whole file, which is what a test wants.
 */
export function imagesOf(spec = data, handles = Object.keys(spec.stores ?? {})) {
  const files = new Set();
  for (const handle of handles) {
    for (const { config } of blocksFor(spec, handle)) {
      for (const field of IMAGE_FIELDS) {
        const value = config?.[field];
        if (typeof value === 'string' && value.length > 0) files.add(value);
      }
    }
  }
  return [...files];
}

/**
 * ⛔ THE BLOCK THAT WOULD DELETE THE SHOP'S MARK — refused here, before anything is written.
 *
 * `brand` REPLACES the theme's wordmark instead of standing beside it, and the app draws nothing when nothing
 * is configured (`BrandBlock` returns null with neither a logo nor a word). So a `brand` placement with an
 * empty config is not a neutral default: it is a header with no mark on every page of that store, and nothing
 * anywhere would report it.
 */
export function markless(spec = data) {
  const bad = [];
  for (const handle of Object.keys(spec.stores ?? {})) {
    const brand = blocksFor(spec, handle).find((b) => b.component === 'brand');
    if (!brand) continue;
    const config = brand.config ?? {};
    const has = ['logo', 'text', 'tail'].some(
      (key) => typeof config[key] === 'string' && config[key].trim().length > 0,
    );
    if (!has) bad.push(handle);
  }
  return bad;
}

/**
 * WHAT STILL HAS TO HAPPEN FOR ONE STORE, given what the composition read answered. Separated from the
 * driving so a test can ask it without a box.
 *
 * ⚠️ A PLACED BLOCK WHOSE CONFIG DIFFERS IS **UPDATED**, and that is the opposite of what this repository does
 * with promotions. The reason is which way the mistake goes: a promotion the operator paused is a decision to
 * preserve, while a chrome block still holding `{"back":"a","seal":"c"}` from somebody's afternoon of testing
 * is the exact state this file exists to replace — and that state is what the bench was measured in. A birth
 * re-asserts the declaration; an operator's own edit survives only until the next birth, which is the same
 * contract every other declared thing in this box has.
 */
export function planChrome(wanted, placed) {
  const byComponent = new Map(placed.map((row) => [row.component, row]));
  const plan = [];
  for (const block of wanted) {
    const row = byComponent.get(block.component);
    if (!row) {
      plan.push({ action: 'place', ...block });
      continue;
    }
    if (sameConfig(row.config, block.config)) continue;
    plan.push({ action: 'update', placement_id: row.placement_id, ...block });
  }
  return plan;
}

/**
 * ⚠️ THE COMPARISON IGNORES WHAT THE KERNEL ADDS AND NEVER WHAT THE FILE SAYS. A `type:'id'` field comes back
 * with a `<field>_url` stamped beside it (the app reads exactly that pair), so a naive deep-equal would find
 * a difference on every single run and rewrite all fifteen placements at every birth, forever. So the answer
 * is: is every key the DECLARATION states already stored with that value?
 */
function sameConfig(stored, wanted) {
  const bag = stored ?? {};
  return Object.entries(wanted ?? {}).every(([key, value]) => bag[key] === value);
}

export async function seedChrome({ command, read, readAll, rows, log, fail, uploadAsset }) {
  const markLess = markless(data);
  if (markLess.length > 0) {
    fail(
      `chrome — seed/chrome.json declares a \`brand\` block with no logo and no word for ${markLess.join(', ')}. ` +
        'That slot REPLACES the theme wordmark and the app draws nothing when nothing is configured, so the ' +
        'store would come up with no mark at all, on every page, silently.',
    );
  }

  // ── 1. the app ────────────────────────────────────────────────────────────────────────────────────────
  // ⚠️ `read.extensions` IS THE WRONG READ AND IT ANSWERS PLAUSIBLY — it takes a STORE and lists the apps with
  // a block PLACEMENT there, so before this file runs `chrome` would be absent from it while being perfectly
  // installed. The tenant's installations are `read.installed_extensions`, which takes no store.
  // `bin/seed-box.mjs` and `seed/commerce.mjs` carry the same warning over the same trap.
  const installed = new Set(
    rows(await read('installed_extensions'))
      .filter((e) => (e.status ?? 'active') === 'active')
      .map((e) => e.extension_id ?? e.id),
  );
  if (installed.has(data.app)) {
    log(`chrome — app "${data.app}" already installed`);
  } else {
    await command('extension.install', { extension_id: data.app });
    log(`chrome — app "${data.app}" installed`);
  }

  // ── 2. the pictures ───────────────────────────────────────────────────────────────────────────────────
  // The `logo` field stores an asset LIBRARY id, so a filename has to become one before any config is
  // written. `uploadAsset` matches on NAME AND BYTES (seed/media.mjs), so a re-run uploads nothing.
  //
  // ⚠️ THE STORES COME FIRST BECAUSE THE LIBRARY IS THE TENANT'S. Only the pictures THIS tenant's stores
  // actually name are uploaded; deriving over the whole declaration would put the coffee shop's logo in the
  // shoe brand's library, unreferenced, for somebody to find later and not be able to explain.
  const stores = rows(await read('stores'));
  const assets = new Map();
  const known = new Map();
  for (const asset of await readAll('assets')) if (asset.filename) known.set(asset.filename, asset);
  for (const file of imagesOf(data, stores.map((s) => s.handle))) {
    const found = known.get(file);
    if (found) {
      assets.set(file, found.id);
      continue;
    }
    if (!uploadAsset) fail(`chrome — "${file}" is not in the asset library and this run has no uploader.`);
    await uploadAsset(file);
    // ⚠️ RE-READ RATHER THAN TRUST THE RETURN. `upload()` answers a provider_key; the config needs the
    // library ROW's id, and the two are different strings. Asking again is one read and cannot be wrong.
    const after = (await readAll('assets')).find((a) => a.filename === file);
    if (!after) fail(`chrome — uploaded "${file}" and the asset library still does not list it.`);
    assets.set(file, after.id);
    log(`chrome — uploaded "${file}" to the asset library (${after.id})`);
  }

  /** The declared config with every filename swapped for the asset id the library minted. */
  const resolve = (config) =>
    Object.fromEntries(
      Object.entries(config ?? {}).map(([key, value]) =>
        IMAGE_FIELDS.includes(key) && assets.has(value) ? [key, assets.get(value)] : [key, value],
      ),
    );

  // ── 3. the placements ─────────────────────────────────────────────────────────────────────────────────
  let placed = 0;
  let updated = 0;
  const skipped = [];
  for (const store of stores) {
    const declared = data.stores?.[store.handle];
    if (declared === undefined) {
      // ⛔ NAMED, NEVER SILENT. A store this file has never heard of is a new store somebody added, and it
      // reaching a birth with no chrome and no line in the log is exactly the shape of report this repository
      // has already paid twice for.
      skipped.push(`${store.handle} (undeclared — add it to seed/chrome.json or say null there)`);
      continue;
    }
    if (declared === null) {
      skipped.push(`${store.handle} (declared as null — see \`_balcao_why\`)`);
      continue;
    }
    const wanted = blocksFor(data, store.handle).map((block) => ({
      ...block,
      config: resolve(block.config),
    }));
    const mine = rows(await read('extension_composition', { store: store.id })).filter(
      (row) => row.extension_id === data.app,
    );
    for (const step of planChrome(wanted, mine)) {
      if (step.action === 'place') {
        await command('composition.place', {
          store: store.id,
          extension_id: data.app,
          component: step.component,
          slot: step.slot,
          config: step.config,
        });
        placed += 1;
        log(`chrome — ${store.handle}: placed ${step.component} in ${step.slot}`);
      } else {
        await command('composition.update_config', {
          store: store.id,
          placement_id: step.placement_id,
          config: step.config,
        });
        updated += 1;
        log(`chrome — ${store.handle}: ${step.component} re-configured from the declaration`);
      }
    }
  }
  log(
    `chrome — ${placed} block(s) placed, ${updated} re-configured` +
      (skipped.length > 0 ? `; NOT dressed: ${skipped.join(', ')}` : ''),
  );
}
