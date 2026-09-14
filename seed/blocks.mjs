// ★★ THE ENGINE THAT DRESSES A STORE WITH AN APP'S BLOCKS — the hand behind `seed/chrome.json` and
// `seed/demo-setup.json`, written ONCE because there are now two declarations of the same shape.
//
// It was `seed/chrome.mjs` in its entirety until pk26/D2 split the shop's MARK out of the `chrome` app and
// into `demo-setup`, this box's own. That split created a second declaration with the same three verbs
// (install · upload · place-and-fill-in) and the same four traps, and this repository has already written
// down what a second copy costs: a list living in TWO repositories has nobody to keep the two in step.
// Two copies in ONE repo have the same problem with less excuse — so the declaration format is shared, and
// so is the hand that writes it.
//
// A DECLARATION is `{ app, slots, stores }`:
//   · `app`    the extension id to install (`chrome`, `demo-setup`);
//   · `slots`  component → the slot it is placed in (`storefront:<page>.<name>`). It is the app's OWN map,
//              read off its manifest: a slot invented here is refused by `composition.place`;
//   · `stores` handle → the blocks that store wears, `{component: config}`. `null` = a store deliberately
//              wearing none, which is NAMED rather than absent (see either file's `_..._why`).
//
// ⚠️ THE FOUR GESTURES, AND EACH IS SEPARATELY INVISIBLE WHEN IT IS MISSING:
//   · COMPOSING puts the app in the image (`composition.json`) — not this file's;
//   · INSTALLING makes it a row in the tenant's Apps area (`extension.install`);
//   · PLACING makes it render (`composition.place`) — installing does NOT do it when the manifest declares
//     `hooks: []`, which both of this box's declared apps do;
//   · FILLING IN is the one an achado was about: every field is optional and neither app writes a default
//     word anywhere, so a placed-and-empty block draws nothing at all.

import { readFileSync } from 'node:fs';

/** Config keys that carry a picture: the kernel's `type:'id'` fields, by name. A value here is a FILENAME in
 *  the declaration and an asset-library ID in the placement, and the swap is this file's job. */
export const IMAGE_FIELDS = ['logo', 'start_image', 'middle_image', 'end_image'];

/** A key that is documentation and never a config field. */
const isMeta = (key) => key.startsWith('_');

/** Read a declaration off disk. Malformed JSON throws — a seed that cannot read its own data must not run. */
export const readDeclaration = (path) => JSON.parse(readFileSync(path, 'utf8'));

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
          `${spec.app}: store "${handle}" declares a block "${component}" that the declaration's own ` +
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
export function imagesOf(spec, handles = Object.keys(spec.stores ?? {})) {
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
 * WHAT STILL HAS TO HAPPEN FOR ONE STORE, given what the composition read answered. Separated from the
 * driving so a test can ask it without a box.
 *
 * ⚠️ A PLACED BLOCK WHOSE CONFIG DIFFERS IS **UPDATED**, and that is the opposite of what this repository does
 * with promotions. The reason is which way the mistake goes: a promotion the operator paused is a decision to
 * preserve, while a chrome block still holding `{"back":"a","seal":"c"}` from somebody's afternoon of testing
 * is the exact state this mechanism exists to replace — and that state is what the bench was measured in. A
 * birth re-asserts the declaration; an operator's own edit survives only until the next birth, which is the
 * same contract every other declared thing in this box has.
 */
export function planBlocks(wanted, placed) {
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
 * a difference on every single run and rewrite every placement at every birth, forever. So the answer is: is
 * every key the DECLARATION states already stored with that value?
 */
function sameConfig(stored, wanted) {
  const bag = stored ?? {};
  return Object.entries(wanted ?? {}).every(([key, value]) => bag[key] === value);
}

/**
 * INSTALL the app, UPLOAD the pictures its configs name, and PLACE-AND-FILL every block, per store.
 *
 * `spec` is the declaration; the rest is the seed's own driving surface (`bin/seed.mjs`). A caller with a
 * refusal of its own — «this config would delete the shop's mark» — runs it BEFORE calling here: a refusal is
 * about what a particular app's blocks MEAN, and this file deliberately knows nothing about that.
 */
export async function seedDeclaredBlocks(spec, { command, read, readAll, rows, log, fail, uploadAsset }) {
  const app = spec.app;

  // ── 1. the app ────────────────────────────────────────────────────────────────────────────────────────
  // ⚠️ `read.extensions` IS THE WRONG READ AND IT ANSWERS PLAUSIBLY — it takes a STORE and lists the apps with
  // a block PLACEMENT there, so before this runs the app would be absent from it while being perfectly
  // installed. The tenant's installations are `read.installed_extensions`, which takes no store.
  // `bin/seed-box.mjs` and `seed/commerce.mjs` carry the same warning over the same trap.
  const installed = new Set(
    rows(await read('installed_extensions'))
      .filter((e) => (e.status ?? 'active') === 'active')
      .map((e) => e.extension_id ?? e.id),
  );
  if (installed.has(app)) {
    log(`${app} — app "${app}" already installed`);
  } else {
    await command('extension.install', { extension_id: app });
    log(`${app} — app "${app}" installed`);
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
  for (const file of imagesOf(spec, stores.map((s) => s.handle))) {
    const found = known.get(file);
    if (found) {
      assets.set(file, found.id);
      continue;
    }
    if (!uploadAsset) fail(`${app} — "${file}" is not in the asset library and this run has no uploader.`);
    await uploadAsset(file);
    // ⚠️ RE-READ RATHER THAN TRUST THE RETURN. `upload()` answers a provider_key; the config needs the
    // library ROW's id, and the two are different strings. Asking again is one read and cannot be wrong.
    const after = (await readAll('assets')).find((a) => a.filename === file);
    if (!after) fail(`${app} — uploaded "${file}" and the asset library still does not list it.`);
    assets.set(file, after.id);
    log(`${app} — uploaded "${file}" to the asset library (${after.id})`);
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
    const declared = spec.stores?.[store.handle];
    if (declared === undefined) {
      // ⛔ NAMED, NEVER SILENT. A store this declaration has never heard of is a new store somebody added, and
      // it reaching a birth undressed and with no line in the log is exactly the shape of report this
      // repository has already paid twice for.
      skipped.push(`${store.handle} (undeclared — add it to the declaration or say null there)`);
      continue;
    }
    if (declared === null) {
      skipped.push(`${store.handle} (declared as null — see the declaration's own reason)`);
      continue;
    }
    const wanted = blocksFor(spec, store.handle).map((block) => ({
      ...block,
      config: resolve(block.config),
    }));
    const mine = rows(await read('extension_composition', { store: store.id })).filter(
      (row) => row.extension_id === app,
    );
    for (const step of planBlocks(wanted, mine)) {
      if (step.action === 'place') {
        await command('composition.place', {
          store: store.id,
          extension_id: app,
          component: step.component,
          slot: step.slot,
          config: step.config,
        });
        placed += 1;
        log(`${app} — ${store.handle}: placed ${step.component} in ${step.slot}`);
      } else {
        await command('composition.update_config', {
          store: store.id,
          placement_id: step.placement_id,
          config: step.config,
        });
        updated += 1;
        log(`${app} — ${store.handle}: ${step.component} re-configured from the declaration`);
      }
    }
  }
  log(
    `${app} — ${placed} block(s) placed, ${updated} re-configured` +
      (skipped.length > 0 ? `; NOT dressed: ${skipped.join(', ')}` : ''),
  );
}
