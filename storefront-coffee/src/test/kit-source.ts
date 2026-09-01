// WHERE THE KIT'S SOURCE IS, for the guards of this app that read it as TEXT.
//
// ★★ THE PROBLEM THIS SOLVES, AND IT IS THE ONE CHECKOUT-APP INTRODUCED. Half a dozen guards here do not
// import what they police — they READ it, because reading is the only way to assert about a mirror, about a
// cookie's spelling, or about which files a render graph reaches. Every one of them found its target with a
// relative path into `src/lib`. Slice K1 moved those targets into `@forgecommerce/storefront-kit`, and a
// relative path that no longer resolves does not make a guard lenient — it makes it CRASH, which is at least
// loud. The dangerous half is the guard that keeps passing over an empty corpus.
//
// So the location is RESOLVED, never spelled. `require.resolve` walks the package's own `exports` map, which
// answers correctly in both worlds this app builds in: the monorepo (pnpm symlinks the package, so the real
// path is `packages/storefront-kit/src`) and a customer's packed copy (an installed tarball under
// `node_modules`). A guard that hardcoded `../../../packages/…` would be green here and broken there.

import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);

/** The kit's `src` directory, resolved through the package's own exports map. */
export const KIT_SRC = dirname(require.resolve('@forgecommerce/storefront-kit/read-client'));
