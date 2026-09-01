// The coffee PDP's reads. `PdpCoffee` draws; this file fetches and binds.
//
// The buy box is a client component and the cart write is a SERVER ACTION — so the action is bound to the
// store here, on the server, and handed down. The client never learns a store id it could change.

import { fetchPublishedReviews } from '@forgecommerce/ext-reviews/reviews';
import { fetchRatingSummaries } from '@forgecommerce/ext-reviews/ratings';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import type { StoreBase } from '@forgecommerce/storefront-kit/store-route';
import { addManyToCartAction } from '@/lib/cart-actions';
import { ExtensionOutlet } from '@/lib/extensions/ExtensionOutlet';
import { wallReviews } from '@/lib/coffee/reviews-view';
import { PdpCoffee } from '@/templates/pdp/PdpCoffee';

/** This product's wall. The export refuses more than its own ceiling of 100 rather than clamping. */
const PDP_REVIEWS = 12;

export async function PdpCoffeeView({
  store,
  base,
  product,
}: {
  store: string;
  base: StoreBase;
  product: ProductDoc;
}) {
  const [wall, ratings] = await Promise.all([
    fetchPublishedReviews({ store, productId: product.product_id, limit: PDP_REVIEWS }),
    fetchRatingSummaries(store, [product.product_id]),
  ]);

  // `null` is the read FAILING, and it is deliberately distinct from a product nobody has reviewed. Both
  // draw no wall; only one of them is a product with nothing to show.
  const reviews = wall === null ? [] : wallReviews(wall.reviews);

  return (
    <PdpCoffee
      product={product}
      reviews={reviews}
      rating={ratings[product.product_id] ?? null}
      addLine={addManyToCartAction.bind(null, store)}
      slots={<ExtensionOutlet name="pdp.below_buybox" store={store} storeBase={base} />}
    />
  );
}
