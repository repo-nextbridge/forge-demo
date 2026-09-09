// A10 (the DEMO half) — THE `chrome` APP, INSTALLED, PLACED AND FILLED IN. `seed/chrome.json` holds the data
// and the reasons; this file is only the hand, and since pk26/D2 even the hand is `seed/blocks.mjs` — shared
// with `seed/demo-setup.mjs`, which dresses the same stores with the OTHER app's blocks.
//
// ★★ WHAT THIS FILE STILL IS, AFTER THE SPLIT. `chrome` used to carry FIVE blocks and one of them, `brand`,
// was the shop's own mark. That one was a single slot read in FOUR renders — the header bar, the drawer's
// head, the footer's brand column and the login modal — so a store configuring "the logo" changed four places
// from one row of Compose, and the board could not say where. pk26/P1 gave each of the four its own slot and
// pk26/D2 moved the mark into `demo-setup`, this box's own app. What is left here is the app's honest OOTB
// half: the four bars of the funnel and the account screens, one block per bar, each rendering in exactly the
// place its name says — plus, since pk28, the sign-in mark, which came BACK to this app because the login box
// lives in the CHECKOUT image and nobody forks that one.
//
// ⇒ THE `brand` BLOCK IS NOT DELETED, IT MOVED. `seed/demo-setup.json` carries the three shops' marks with
// their history; `seed/chrome.json` keeps the funnel. Anything that graded a mark had to move with it —
// `bin/chrome-logo-crop.guard.mjs` reads BOTH declarations, and `seed/chrome.test.mjs`'s footer-signature
// rule derives the mark from the file that now holds it.
//
// IT RUNS IN THE **CURATED** PHASE, AFTER the counter's store exists (`seedTotem` creates `balcao`): the
// declaration names stores by handle and a handle that has not been created yet cannot be resolved. It needs
// nothing from the massive catalogue, so it does not wait for the window.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocksFor, imagesOf, planBlocks, readDeclaration, seedDeclaredBlocks } from './blocks.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const data = readDeclaration(join(SEED, 'chrome.json'));

// The engine's readers, re-exported under the names this repository's tests and guards already use. They are
// the SAME functions `seed/demo-setup.mjs` drives — one implementation, two declarations.
export { blocksFor, imagesOf, planBlocks as planChrome };

export async function seedChrome(deps) {
  await seedDeclaredBlocks(data, deps);
}
