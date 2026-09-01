// The bundle line, with the kernel's quote already in hand.
//
// ★ WHY THIS EXISTS AS A SERVER COMPONENT. `renderBundle` (the seam the recommendations block calls) is a
// SYNCHRONOUS callback — the block owns the curated pairs and knows nothing about prices, which is exactly the
// boundary that keeps it printing no price. So the theme returns THIS node instead: an async Server Component
// that asks the port what the pair costs and hands the answer to the client leaf. The green-zone contract does
// not change, the first paint is already right, and the quote travels inside the cached HTML — which is safe
// because the kernel computes it with no buyer and no payment method.
//
// The DEFAULT selection has to be the same one `BundlePair` starts with (the first sellable SKU of each side),
// or the quote would be about a variant the shopper is not looking at. Both use `sellable()`.

import { readClient } from '@forgecommerce/storefront-kit/config';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { priceTogetherAction } from '@/lib/promo/price-together-action';
import { sellable } from '@/lib/variant-axes';
import { BundlePair } from './BundlePair';

export async function BundlePairQuoted({
  store,
  base,
  paired,
  optimized,
  maxInstallments,
  addToCart,
}: {
  store: string;
  base: ProductDoc;
  paired: ProductDoc;
  optimized: boolean;
  maxInstallments?: number | null;
  addToCart?: (skuIds: string[]) => Promise<void>;
}) {
  const defaults = [sellable(base.skus ?? [])[0]?.id, sellable(paired.skus ?? [])[0]?.id].filter(
    (id): id is string => !!id,
  );
  // No quote / port down → null, and the block sums exactly as it did before any of this existed.
  const quote = defaults.length === 2 ? await readClient().priceTogether(store, defaults) : null;

  return (
    <BundlePair
      base={base}
      paired={paired}
      optimized={optimized}
      maxInstallments={maxInstallments}
      addToCart={addToCart}
      quote={quote}
      requote={priceTogetherAction.bind(null, store)}
    />
  );
}
