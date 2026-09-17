// HomeShowcase — a PREVIEW-ONLY composition of the home body for the /ui-storefront gallery (S7-SF-HOME-FIDELITY).
// The real home is data-driven (the compose slots + the CORE category/brand reads), which the gallery has no
// port for; this harness feeds fixtures into the SAME presentational pieces so their fidelity can be reviewed and
// their behaviours driven live offline: the hero carousel (HeroAutoplay island — dots/autoplay/swipe), the
// "Compre por categoria" + "Marcas" sections (CategoryTilesView / BrandsGridView), and the footer with the real
// newsletter form (its `.om-invalid` + shake validation). Shelves / banner mosaic / vitrine are data-driven and
// verified on Staging. This module is imported ONLY by its examples file (gallery-only; tree-shaken from routes).
//
// ★ E (PACK 5) — THE TWO APP BLOCKS ARRIVE THROUGH THE REGISTRY NOW, and that is what let `banners` and `leads`
// join the composition list. This file used to import `@forgeco/ext-banners/block/banner` and
// `@forgeco/ext-leads/NewsletterForm` by name, which pinned both apps to the storefront's build (A2
// measured it and reverted a finished migration over it). The registry entry could not be used instead, because
// every generated entry was `async` behind a dynamic import and this gallery renders with a SYNCHRONOUS
// `renderToString` — an async component suspends. With the import static, an entry is async only when it awaits
// an injection, so:
//   · `banners/banner` injects nothing and renders SYNCHRONOUSLY here — same coverage as the named import;
//   · `leads/newsletter` is async by its own nature (it reads its config through the public port, and falls
//     back to defaults when the port is unreachable, which is the gallery's case). It renders behind a
//     <Suspense>, so `renderToString` emits the fallback and the live gallery page renders the real form.
//     ⚠️ That is a real, named loss: the sync catalog test no longer exercises the form's validation island.
//     The alternative was keeping an app welded to the storefront to keep a test's coverage, which is worse.
//
// A block the composition does not carry resolves to `undefined` and simply is not drawn — the same absence a
// merchant sees, rather than a crash in a gallery.

import { SHOWCASE_TIMEZONE } from '@forgeco/storefront-kit/datetime';
import { authoredHref, HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { FooterDefault } from '@forgeco/storefront-kit/subtemplates/footer/variants/default';
import { Suspense } from 'react';
import { resolveBlock } from '@/lib/extensions/registry';
import { BrandsGridView } from './BrandsGrid';
import { CategoryTilesView } from './CategoryTiles';

/** A dark line-icon glyph as a data URI — a stand-in for the seed's category icons (they are PNG art on white). */
function glyph(): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24' fill='none' stroke='%232b2d31' stroke-width='1.5'%3E%3Cpath d='M3 15l3-3 4 2 5-6 6 5v3H3z'/%3E%3C/svg%3E`;
}

// The curated catalog's roots (DEMO-SEED-FINAL) — gallery fixture only; the live home reads these from the store.
const CATEGORIES = ['Tênis', 'Sapatos', 'Botas', 'Sandálias', 'Acessórios'];
const BRANDS = ['ATLAS', 'VERTEX', 'NORDIC', 'PRIMA', 'ÓRBITA', 'KELVIN', 'SOMA', 'FAROL'];

/** The gallery is served from the storefront's own tree, never through `/s/<store>` — so the specimen answers
 *  the base by CONSTRUCTION, exactly like the edge-cacheable `/c` tree does, instead of asking. */
const SHOWCASE = {
  store: 'showcase',
  storeBase: HOST_BASE,
  storeHref: (url: string | null | undefined) => authoredHref(HOST_BASE, url),
  // Q3-HYDRATION: blocks are handed the STORE's clock, and this gallery has no store — so it answers with the
  // zone `lib/datetime.ts` names for exactly this case, by construction, the same way it answers the base.
  timeZone: SHOWCASE_TIMEZONE,
} as const;

const BannerBlock = resolveBlock('banners', 'banner');
const NewsletterBlock = resolveBlock('leads', 'newsletter');

export function HomeShowcase() {
  return (
    <div>
      {/* Hero: the real banner block in carousel style over 3 placeholder slides (no media base → placeholders),
          so the HeroAutoplay island (dots / autoplay / swipe) drives live in the gallery. */}
      {BannerBlock ? (
        <BannerBlock
          {...SHOWCASE}
          placementId="hero"
          config={{
            style: 'carousel',
            media: [
              { asset_id: 'slide-1', duration: 2 },
              { asset_id: 'slide-2', duration: 2 },
              { asset_id: 'slide-3', duration: 2 },
            ],
          }}
        />
      ) : null}
      <CategoryTilesView
        base={HOST_BASE}
        tiles={CATEGORIES.map((name) => ({
          path: name.toLowerCase(),
          name,
          iconUrl: glyph(),
          href: '#',
        }))}
      />
      <BrandsGridView
        brands={BRANDS.map((name) => ({ slug: name.toLowerCase(), name, href: '#' }))}
      />
      <FooterDefault
        base={HOST_BASE}
        store={SHOWCASE.store}
        // ★★ P2 — the showcase stands in for the deployable's outlet: the footer places its own slots now, so
        // what a gallery has to supply is the RESOLVER, not a pre-built node (see the variant's header).
        outlet={({ name }) =>
          name === 'footer.aside' && NewsletterBlock ? (
            <Suspense fallback={null}>
              <NewsletterBlock {...SHOWCASE} />
            </Suspense>
          ) : null
        }
      />
    </div>
  );
}
