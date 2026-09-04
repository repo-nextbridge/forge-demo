// The store home's render. It READS; `HomeCoffee` draws.
//
// The split is what lets the whole page be asserted without a port: everything below this file is a pure
// function of what these three reads returned, including the two rules that only show up on thin data — a
// card with no SCA and a store with no reviews.
//
// ⚠️ EVERY READ HERE IS ISR-CACHED AND NONE OF THEM READS A COOKIE. That is not a performance note: the
// route this renders is `force-dynamic`, but the reads are the same ones the cacheable twin would make, and
// a `no-store` fetch introduced here would be a per-visitor call on the most-visited page of the shop.

import { readClient } from '@forgecommerce/storefront-kit/config';
import type { StoreBase } from '@forgecommerce/storefront-kit/store-route';
import { fetchPublishedReviews } from '@forgecommerce/ext-reviews/reviews';
import { fetchRatingSummaries } from '@forgecommerce/ext-reviews/ratings';
import type { Metadata } from 'next';
import { ExtensionOutlet } from '@/lib/extensions/ExtensionOutlet';
import { NEUTRAL_STORE_TITLE } from '@/lib/site-metadata';
import { storeRating, wallReviews } from '@/lib/coffee/reviews-view';
import { HomeCoffee } from '@/templates/home/HomeCoffee';

/** How many coffees the home lists. There is no PLP in this shop — this page IS the catalogue — so the
 *  number is a ceiling on the design rather than a page size: a seventh coffee appears here or nowhere. */
const HOME_PRODUCTS = 24;

/** How many reviews the wall shows. The export refuses anything above its own ceiling of 100 rather than
 *  clamping, so this is a page size and not a request for "all of them" — and 12 is a DESIGN number, chosen
 *  by looking at the page: 24 filled the home with testimony and pushed everything below the wall out of
 *  reach. This is the fork's own file, so a fixed number with a name and a reason is the right shape here.
 *  ⚠️ Not to be confused with `HOME_PRODUCTS` above: that one is a ceiling on the CATALOGUE, this one is a
 *  page size on a list that is meant to be partial. */
const WALL_REVIEWS = 12;

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

export async function HomeView({ store, base }: { store: string; base: StoreBase }) {
  // The three reads, in parallel: they answer independent questions and nothing here needs the other's
  // result to ask its own.
  const [catalog, wall, ratings] = await Promise.all([
    readClient().products(store, { limit: HOME_PRODUCTS }),
    fetchPublishedReviews({ store, limit: WALL_REVIEWS }),
    fetchRatingSummaries(store),
  ]);

  const products = catalog?.items ?? [];
  // ⚠️ `null` FROM THE WALL MEANS THE READ FAILED, and it is deliberately distinct from a store with no
  // reviews. Both draw no wall — but only one of them is a shop that has nothing to show, and the export's
  // type is what keeps this page from printing "ninguém avaliou" during an outage.
  const titles = Object.fromEntries(products.map((p) => [p.product_id, p.title]));
  const reviews = wall === null ? [] : wallReviews(wall.reviews, titles);

  const slots = {
    hero: <ExtensionOutlet name="home.hero" store={store} storeBase={base} />,
    bannerStrip: <ExtensionOutlet name="home.banner_strip" store={store} storeBase={base} />,
    belowShelf: <ExtensionOutlet name="home.below_shelf" store={store} storeBase={base} />,
    belowCategories: <ExtensionOutlet name="home.below_categories" store={store} storeBase={base} />,
    belowBrands: <ExtensionOutlet name="home.below_brands" store={store} storeBase={base} />,
  };

  return (
    <HomeCoffee
      base={base}
      products={products}
      reviews={reviews}
      rating={storeRating(ratings)}
      slots={slots}
    />
  );
}
