// MS-M2 — THE THEME LOADED HERE IS THE BASE, NOT THE ANSWER. This layout sits ABOVE `[store]`, so it cannot
// know which store it is rendering; the import below is therefore the FALLBACK every store starts from, and a
// store that wears something else overrides it from its own store-scoped layout, which inlines that theme's
// tokens after this stylesheet (`lib/theme/store-theme.tsx`, wired into both `s/[store]` and `c/[store]`).
// Leaving the base here is deliberate: a route that is not store-scoped (`/`, the 404) still needs a palette,
// and a store on the reference theme costs exactly this one build-time import and nothing at runtime.
//
// Root layout: loads the theme (themes/storefront-vanilla/tokens.css via the styles barrel) and the two
// typefaces, then renders the page tree. The chrome (header/footer) is NOT here — it lives in the
// store-scoped route groups (`s/[store]/(storefront)` and `(checkout)`), because the header needs `store`
// (mega-menu categories, slot discovery) and the checkout wants a clean variant. The root stays chrome-less
// so non-store roots (`/`, 404) don't inherit a store header. Nothing here fetches data.

import { ImageDriverProvider } from '@forgecommerce/storefront-kit/ImageDriverProvider';
import { imageDriverConfig } from '@forgecommerce/storefront-kit/media/driver';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
// Self-hosted Urbanist via next/font/local (no CDN, CSP-clean; no build-time network — the woff2 ship in the
// repo). next/font auto-generates a metric-ADJUSTED fallback (size-adjust/ascent/descent from the real font),
// so `display: swap` no longer reflows when Urbanist finishes loading — the FOUT layout shift is gone (the empty
// checkout's CLS regression). It also preloads the weights. `--font-urbanist` is wired into `--font-sans` by
// globals.css. Figtree/Geist stay documented token swaps (design-storefront.md), off by default.
import '@forgecommerce/theme-storefront-vanilla/tokens.css';
import '../styles/globals.css';

const urbanist = localFont({
  src: [
    { path: './fonts/urbanist-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/urbanist-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/urbanist-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/urbanist-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-urbanist',
  display: 'swap',
  adjustFontFallback: 'Arial', // the size-adjusted fallback that kills the swap reflow
});

// ★ PK2-I18N — the DEFAULT every page without its own metadata inherits, and it is the shopper's copy: it
// used to be the developer's English ("Forge Storefront"), which is what the cart, the checkout, /account,
// /account/login and the order detail put in the browser tab of a `lang="pt-BR"` store. It lives in
// `lib/site-metadata` so it can be read by a test — this file imports `next/font/local` and cannot be.
export { rootMetadata as metadata } from '@/lib/site-metadata';

// Without this, mobile browsers assume a ~980px desktop viewport and scale the whole page down — the layout
// reads as "broken / not responsive". `width=device-width` makes CSS px equal device px so the responsive
// rules below actually apply.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={urbanist.variable}>
      <body>
        {/* PERF-C — the image driver is per-instance RUNTIME config, so it is read from the env HERE (server) and
            crosses to the client as data. This is the one place it is read; every <MediaImage> below takes it
            from the context. Nothing else in this layout fetches anything. */}
        <ImageDriverProvider config={imageDriverConfig()}>{children}</ImageDriverProvider>
      </body>
    </html>
  );
}
