// PDP metadata + structured data, shared by both routes that can render a product (the canonical
// category-path route and the /p/<handle> alias). Canonical = the primary-category path (locked SEO).

import { canonicalProductPath } from '@forgeco/storefront-kit/catalog-path';
import { productImageUrls } from '@forgeco/storefront-kit/media/seo';
import { displayPrice } from '@forgeco/storefront-kit/promo/display-price';
import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { displaySku } from '@forgeco/storefront-kit/sku';
import type { Metadata } from 'next';
import type { ProductStructuredData } from '@/lib/product-structured-data/contract';

export function pdpMetadata(product: ProductDoc): Metadata {
  // RICH (S2): the SEO meta override the defaults; empty/absent (incl. a pre-RICH stale doc) → the current
  // title/description fallback (zero regression). `?? undefined` because `meta_*` may be null or missing.
  const title = product.meta_title ?? product.title;
  const description = product.meta_description ?? product.description ?? undefined;
  // S6-IMAGES — og:image = the COVER, as an absolute url (the kernel's). A share card with no image is the
  // whole hole this closes. Absent when the product has no image (never an empty `images: []`).
  const cover = productImageUrls(product)[0];
  return {
    title,
    description,
    alternates: { canonical: canonicalProductPath(product) },
    openGraph: {
      title,
      ...(description ? { description } : {}),
      type: 'website',
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

/** schema.org Product graph (price/availability/image/rating) for the JSON-LD block.
 *
 * SEO-FINISH — the enrichment is passed IN rather than fetched here, and the function stays pure. It does not
 * live in the catalog: reviews are an extension with its own isolated data space, so `ProductDoc` carries no
 * rating and never will.
 *
 * ★ O3-D — AND IT NOW ARRIVES ALREADY SHAPED, from the app that holds the rows, through the point the
 * storefront declares (`lib/product-structured-data/contract`). It used to arrive as `{ average, count }` read
 * off `cardRatings` — the app's WHOLE-STORE card batch — while the reviews section on the same page rendered
 * from the app's per-product list: two reads, two cache entries, two counts of one thing, agreeing by
 * coincidence. This function stops deciding what an aggregate is; it merges the two fields the contract names
 * and nothing else, so an app cannot reach the price or the sku through it. */
export function productJsonLd(
  product: ProductDoc,
  enrichment?: ProductStructuredData,
): Record<string, unknown> {
  // PRE-S7 — the offer speaks for the DEFAULT sku (the one the merchant starred), falling back to the cheapest
  // when there is no star. The SAME answer the card gives: the rich result and the grid can no longer disagree.
  const sku = displaySku(product);
  // ★★ QA22 · FM6 — THE OFFER IS PRICED THROUGH THE THEME'S ONE RULE, not by re-reading `sku.amount`.
  // `amount` is the CATALOG price; what the shopper is charged today is what `displayPrice` resolves from the
  // kernel's anonymous-safe promotional preview, and it is the number the buybox and every card already print.
  // Measured before this line existed (p3b P3B-9): a PDP showing "de R$ 700,00 por R$ 630,00" published
  // `"price":"700.00"` to the rich result — the shop advertising a price it does not charge. The pricing engine
  // was right throughout; the markup was a second consumer computing the number for itself.
  //
  // ⚠️ IT IS THE SAME FUNCTION AND NOT AN EQUIVALENT ONE. A `compare_at_amount` discount is already inside
  // `amount`, so the two spellings agree there and only diverge under a promotion — which is why the test that
  // guards this renders a promoted product (`seo-price.test.tsx`).
  const shown = displayPrice(sku ?? undefined);
  const inStock = product.skus.some((s) => s.status === 'active');
  // S6-IMAGES — `image` is what makes the rich result show a photo. ABSOLUTE urls (the kernel resolves them),
  // cover first, images only (a document/video is not the product's picture). Omitted when there is none.
  const images = productImageUrls(product);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    // SEO-FINISH — the stars the shopper sees, visible to the crawler too, plus (O3-D) the reviews the page
    // itself lists. Each key is spread only when the contributor sent it: absence is how "nothing to say" is
    // spelled at this point, and `aggregateRating: undefined` would serialize as a missing key anyway while an
    // empty `review: []` would claim the page lists no reviews rather than that no app was asked. Same
    // discipline as `image` above (omitted, never an empty value).
    ...(enrichment?.aggregateRating ? { aggregateRating: enrichment.aggregateRating } : {}),
    ...(enrichment?.review && enrichment.review.length > 0 ? { review: enrichment.review } : {}),
    sku: sku?.code,
    offers: {
      '@type': 'Offer',
      price: shown ? (shown.amount / 100).toFixed(2) : undefined,
      priceCurrency: sku?.currency ?? 'BRL',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
}
