// A22 — THE SHOE BRAND'S LOGISTICS REGISTRIES, driven through the port: the carriers a parcel travels with
// and the points a buyer can fetch one from. `seed/logistics.json` holds the data and the reasons; this file
// is only the hand.
//
// A MODULE AND NOT MORE LINES IN `bin/seed.mjs`, for the reason every module beside it states: slices fill a
// box from different worktrees, and one file between them is a conflict with a stopwatch on it.
//
// ⚠️ BOTH REGISTRIES ARE TENANT-WIDE. Neither command takes a `store_id`, so this runs ONCE per tenant and
// never per store — and what it writes is visible from every store of that tenant. That is a fact about the
// kernel, not a shortcut here; `seed/totem.json` measured the same thing for the counter's own point.
//
// IDEMPOTENT BY NAME, which is what makes the name a key: two carriers called "Correios" is an ambiguity an
// operator resolves by guessing, and two points with one name is the same defect on a checkout.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(SEED, 'logistics.json'), 'utf8'));

/** The placeholder `shipping.carrier.create` demands, spelled once. */
export const TRACKING_PLACEHOLDER = '{code}';

/**
 * ⛔ THE REFUSAL THE KERNEL WILL MAKE, MADE HERE FIRST AND WITH THE FILE NAME IN IT.
 *
 * `assertTrackingTemplate` (packages/core/src/commands/shipping.ts) refuses a template that does not carry
 * `{code}` EXACTLY once, and it is right to: a template with none produces a link to the carrier's home page
 * for every parcel in the store, which looks like it works. The kernel's message names the template; this one
 * names the CARRIER and the file, because that is what the person editing `seed/logistics.json` needs.
 *
 * `null` is a legal answer and means "this carrier publishes no tracking page" — checked here so that a
 * carrier row deliberately without a link is never confused with one whose template rotted to empty.
 */
export function trackingTemplateProblem(carrier) {
  const template = carrier?.tracking_url_template;
  if (template === null || template === undefined) return null;
  if (typeof template !== 'string' || template.trim() === '') {
    return `carrier "${carrier.name}": tracking_url_template is empty. Write \`null\` to say the carrier publishes no tracking page — an empty string is a link to nowhere.`;
  }
  const occurrences = template.split(TRACKING_PLACEHOLDER).length - 1;
  if (occurrences === 1) return null;
  return `carrier "${carrier.name}": tracking_url_template must contain ${TRACKING_PLACEHOLDER} exactly once (found ${occurrences}). The kernel refuses it, and a template without the placeholder links every parcel to the carrier's home page.`;
}

/**
 * ★ WHICH POINTS AND CARRIERS STILL HAVE TO BE WRITTEN — a function, and it takes what EXISTS rather than
 * deciding for itself, so the same rule can be driven by a test without a box.
 *
 * @param wanted   the declared rows (each with a `name`)
 * @param existing the names already registered
 */
export function missingByName(wanted, existing) {
  const have = new Set(existing);
  return wanted.filter((row) => !have.has(row.name));
}

/**
 * ⚠️ THE READS TAKE NO PARAMETERS AND HAVE NO SECOND PAGE — measured against the source, the same way
 * `seed/totem.mjs` measured them for the counter: `carriers` and `pickup_locations` are small operator-curated
 * registries and the read hands back the whole list. `readAll` is used anyway, because it costs nothing and
 * it is the shape that stays right the day one of them grows a `limit`.
 */
export async function seedLogistics({ command, readAll, log, fail }) {
  for (const carrier of data.carriers) {
    const problem = trackingTemplateProblem(carrier);
    if (problem) fail(`logistics — ${problem}`);
  }

  const carriers = missingByName(data.carriers, (await readAll('carriers')).map((c) => c.name));
  for (const carrier of carriers) {
    const out = await command('shipping.carrier.create', {
      name: carrier.name,
      tracking_url_template: carrier.tracking_url_template ?? null,
    });
    log(
      `logistics — carrier "${carrier.name}" created (${out.carrier_id})` +
        `${carrier.tracking_url_template ? '' : ', no tracking page'}`,
    );
  }

  const points = missingByName(
    data.pickup_points,
    (await readAll('pickup_locations')).map((p) => p.name),
  );
  for (const point of points) {
    // `why` is documentation and the command would refuse it — the declaration carries reasons, the port
    // carries fields, and spreading the whole object is how a reason becomes a validation error.
    const { why: _why, ...fields } = point;
    const out = await command('pickup_location.create', { ...fields, active: true });
    log(`logistics — pickup point "${point.name}" created (${out.pickup_location_id})`);
  }

  log(
    `logistics — ${data.carriers.length} carrier(s): ${carriers.length} created; ` +
      `${data.pickup_points.length} pickup point(s): ${points.length} created. ` +
      'No pickup METHOD is created here — see seed/logistics.json for why, and the card SEED-PICKUP-SO-METADE.',
  );
}
