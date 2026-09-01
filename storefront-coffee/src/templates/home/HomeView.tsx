// The store home's render, shared by its two route entries (PERF-B): the dynamic tree's
// `s/[store]/(storefront)/page.tsx` and the edge-cacheable twin `c/[store]/page.tsx`. Next fixes
// cacheability per route file, so the entries are two files; the home itself is written once, here.
//
// It is PURE COMPOSITION: the page mounts the declared slots and whatever the merchant composed fills them
// (S6-FIXPACK — the theme no longer hardcodes a hero or a shelf of recent products; an uncomposed home is an
// empty home). Every read below is ISR-cached through the read client, and nothing reads a cookie or a
// header — which is what lets the twin be prerendered and served from the edge.

import { readClient } from '@forgecommerce/storefront-kit/config';
import type { StoreBase } from '@forgecommerce/storefront-kit/store-route';
import type { Metadata } from 'next';
import { BrandsGrid } from '@/components/BrandsGrid';
import { CategoryTiles } from '@/components/CategoryTiles';
import { ExtensionOutlet } from '@/lib/extensions/ExtensionOutlet';
import { NEUTRAL_STORE_TITLE } from '@/lib/site-metadata';
import { HomeTemplate } from '@/templates/home/template';

// S6-IMAGES — the home had NO metadata at all (it inherited the layout's static title). It now declares its
// canonical and og:type. It carries NO og:image: the S6-FIXPACK home is 100% Compose (no product shelf), so a
// product cover would advertise something the page does not even show. The honest image is a store-level logo
// (not in the kernel yet) or the composed banner — declared limit, follow-up.
//
// QA-PACK-1 C3 — and it now carries the STORE'S NAME. It used to declare no title at all, so the value fell
// through to the root layout's `Forge Storefront` placeholder: the developer's English string, on the most
// linked page of a Brazilian store, in the two places that travel furthest (Google's result and the share
// card). Every other page already named the store; the home was the one that did not.
//
// The name comes from read.store_flags — the store's own public fact, the same read the theme already makes
// for the store clock. It MUST stay the ISR-cached read: `/c/[store]` is the edge-cacheable twin of this page,
// and one uncached fetch anywhere in its render, `generateMetadata` included, makes Next serve the whole route
// dynamically. A store whose flags cannot be read degrades to the neutral title rather than to the placeholder.
export async function homeMetadata(store: string): Promise<Metadata> {
  const flags = await readClient().storeFlags(store);
  const name = flags?.name?.trim();
  const title = name ?? NEUTRAL_STORE_TITLE;
  return {
    title,
    ...(name ? { description: `Compre na ${name}.` } : {}),
    alternates: { canonical: '/' },
    openGraph: { title, type: 'website' },
  };
}

export function HomeView({ store, base }: { store: string; base: StoreBase }) {
  return (
    <HomeTemplate
      hero={<ExtensionOutlet name="home.hero" store={store} storeBase={base} />}
      bannerStrip={<ExtensionOutlet name="home.banner_strip" store={store} storeBase={base} />}
      belowShelf={<ExtensionOutlet name="home.below_shelf" store={store} storeBase={base} />}
      belowCategories={
        <ExtensionOutlet name="home.below_categories" store={store} storeBase={base} />
      }
      belowBrands={<ExtensionOutlet name="home.below_brands" store={store} storeBase={base} />}
      categories={<CategoryTiles store={store} base={base} />}
      brands={<BrandsGrid store={store} base={base} />}
    />
  );
}
