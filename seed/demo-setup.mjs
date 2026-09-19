// pk26/D2 — THE `demo-setup` APP: this box's own blocks, INSTALLED, PLACED AND FILLED IN, per store.
// `seed/demo-setup.json` holds the data and the reasons; the hand is `seed/blocks.mjs`, shared with
// `seed/chrome.mjs`. What lives here is the one refusal that is about what THESE blocks mean.
//
// ★★★ AND «MARKS» STOPPED BEING THE WHOLE OF IT IN v0.4. The app also ships the DEMONSTRATION NOTICE, and
// that block was declared, drawable and placed by nobody — a `hook_placement` row somebody wrote in Compose,
// which survives a deploy and does not survive a reset. It is declared in `seed/demo-setup.json` like
// everything else now, so a store is born wearing it; `bin/ribbon-at-birth.guard.mjs` is what keeps that
// true on a laptop, where no box is running and the birth is exactly what would stop happening.
//
// IT RUNS IN THE **CURATED** PHASE, right after `seedChrome`, and for the same reason: the declaration names
// stores by handle and `seedTotem` is what creates the counter's. It needs nothing from the massive
// catalogue, so it does not wait for the window.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocksOf } from '../bin/app-manifest.mjs';
import { blocksFor, readDeclaration, seedDeclaredBlocks } from './blocks.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const data = readDeclaration(join(SEED, 'demo-setup.json'));

export { data as DEMO_SETUP };

/** The config keys that CARRY a mark — a picture, or the two halves of a wordmark. ⚠️ `tagline` is
 *  deliberately not one of them: a footer with a sentence and no mark is the same defect one element to the
 *  right, which is the kit's own reason for ceding that node as a unit. */
const MARK_KEYS = ['logo', 'text', 'tail'];

/**
 * ★★★ WHICH OF AN APP'S BLOCKS ARE MARKS — ASKED OF THE MANIFEST, NEVER TYPED BESIDE IT.
 *
 * A block is a mark when its own `config_schema` offers somewhere to put one. That is not a proxy for the
 * answer, it IS the answer: a slot that cedes its node to a mark is a slot whose block has to be able to
 * carry a mark, so the app declaring `logo`/`text`/`tail` is the app saying «this block IS the shop's name
 * here». A block that declares none of them cannot be filled with a mark and therefore cannot be missing one.
 *
 * ⛔ AND THIS IS WHY IT IS NOT A LIST. The alternative — «refuse a block with no config, except the ones I
 * name» — is a list that goes stale in the direction of grading LESS: the day a fifth mark is added, nobody
 * has to remember anything for it to be covered, and the day a second notice block arrives nobody has to
 * remember anything for it to be left alone.
 *
 * ⛔ ANTI-VACUUM. An app whose manifest yields no mark block at all would make the refusal below pass over
 * an empty set, silently, which is exactly the shape it exists to prevent. That throws instead.
 */
export function markComponents(app) {
  const read = blocksOf(app);
  // An app of THIS box is a directory here, so there is no «not checked» branch to take: a manifest that
  // cannot be read is a seed that must not run.
  if (read.tried) {
    throw new Error(
      `demo-setup — the manifest of app "${app}" could not be read (${read.tried.join(' · ')}), so which of ` +
        'its blocks are MARKS is unknown. The refusal below would then pass over nothing.',
    );
  }
  const marks = read.blocks
    .filter((block) => block.config_schema.some((field) => MARK_KEYS.includes(field.name)))
    .map((block) => block.component);
  if (marks.length === 0) {
    throw new Error(
      `demo-setup — no block of app "${app}" declares any of ${MARK_KEYS.join('/')} in its \`config_schema\`, ` +
        'so «a mark with no mark in it» has no subject. Either the marks left this app (and this refusal ' +
        'should go with them) or the manifest stopped declaring their fields.',
    );
  }
  return marks;
}

/**
 * ⛔ THE BLOCK THAT WOULD DELETE THE SHOP'S MARK — refused here, before anything is written.
 *
 * Each of the MARK slots REPLACES the front's own wordmark instead of standing beside it: the slot cedes its
 * whole node to whatever is placed there, and the app draws nothing when nothing is configured. So a brand
 * placement with an empty config is not a neutral default — it is a header, a drawer or a footer column with
 * NO MARK AT ALL, on every page of that store, and nothing anywhere would report it.
 *
 * ⚠️ IT ASKS THE QUESTION OF EVERY MARK THE DECLARATION CARRIES, never of a component named here — see
 * `markComponents` for how «which blocks are marks» is derived. A fifth mark added tomorrow is covered
 * without anybody remembering, and it stays exactly as strict for the four that exist.
 *
 * ⛔ AND IT IS SILENT ABOUT THE REST ON PURPOSE, WHICH IS WHAT THE NOTICE TAUGHT IT. `demo_ribbon` — the
 * demonstration notice — declares NO config at all: the app ships its sentence in three languages precisely
 * so that an operator cannot empty it. An empty config there is the only config it can have, and the reason
 * written above («a header that comes without a mark, silently») is not a sentence about it.
 */
export function markless(spec = data, marks = markComponents(spec.app)) {
  const isMark = new Set(marks);
  const bad = [];
  for (const handle of Object.keys(spec.stores ?? {})) {
    for (const block of blocksFor(spec, handle)) {
      if (!isMark.has(block.component)) continue;
      const config = block.config ?? {};
      const has = MARK_KEYS.some(
        (key) => typeof config[key] === 'string' && config[key].trim().length > 0,
      );
      if (!has) bad.push(`${handle}/${block.component}`);
    }
  }
  return bad;
}

export async function seedDemoSetup(deps) {
  const markLess = markless(data);
  if (markLess.length > 0) {
    deps.fail(
      `demo-setup — seed/demo-setup.json declares a brand block with no logo and no word for ` +
        `${markLess.join(', ')}. Each of these slots REPLACES the front's own wordmark and the app draws ` +
        'nothing when nothing is configured, so that place would come up with no mark at all, silently.',
    );
  }
  await seedDeclaredBlocks(data, deps);
}
