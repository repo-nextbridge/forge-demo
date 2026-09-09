// pk26/D2 — THE `demo-setup` APP: this box's own marks, INSTALLED, PLACED AND FILLED IN, per store.
// `seed/demo-setup.json` holds the data and the reasons; the hand is `seed/blocks.mjs`, shared with
// `seed/chrome.mjs`. What lives here is the one refusal that is about what THESE blocks mean.
//
// IT RUNS IN THE **CURATED** PHASE, right after `seedChrome`, and for the same reason: the declaration names
// stores by handle and `seedTotem` is what creates the counter's. It needs nothing from the massive
// catalogue, so it does not wait for the window.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocksFor, readDeclaration, seedDeclaredBlocks } from './blocks.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const data = readDeclaration(join(SEED, 'demo-setup.json'));

export { data as DEMO_SETUP };

/**
 * ⛔ THE BLOCK THAT WOULD DELETE THE SHOP'S MARK — refused here, before anything is written.
 *
 * Every one of these three slots REPLACES the front's own wordmark instead of standing beside it: the slot
 * cedes its whole node to whatever is placed there, and the app draws nothing when nothing is configured. So
 * a brand placement with an empty config is not a neutral default — it is a header, a drawer or a footer
 * column with NO MARK AT ALL, on every page of that store, and nothing anywhere would report it.
 *
 * ⚠️ IT ASKS THE QUESTION OF EVERY BLOCK THE DECLARATION CARRIES, never of a component named here. All three
 * are marks; a fourth added tomorrow is a mark too, and a list of component names would have let it through
 * in silence. `tagline` is deliberately NOT one of the answers: a footer with a sentence and no mark is the
 * same defect one element to the right.
 */
export function markless(spec = data) {
  const bad = [];
  for (const handle of Object.keys(spec.stores ?? {})) {
    for (const block of blocksFor(spec, handle)) {
      const config = block.config ?? {};
      const has = ['logo', 'text', 'tail'].some(
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
