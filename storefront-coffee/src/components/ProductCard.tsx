// Product card — the theme's ONE card (S6-PRODUCT-CARD → S7-SF-HOME "v3" → S7 fidelity). This is the SERVER
// half: it resolves everything the source card needs — the cover + per-color swatch photos (mediaSrc, server-
// only), the display SKU's price / "was" / discount, the free-shipping tag, the installment line, the variation
// model — and hands it all as plain, serializable props to <ProductCardView> (the interactive client half).
// Keeping the media resolution here is the hydration/guard rule: a client component never calls mediaSrc().
//
// The price is the DEFAULT sku's (the starred one, else the cheapest). Its struck "was" is that sku's static
// the kernel's ANONYMOUS-SAFE promotional preview when there is one (PROMO), else a static compare_at_amount.
// STORE-level chrome (free-shipping threshold, max installments)
// arrives as props (cardChrome). RATING arrives as a prop (reviews live in the extension's isolated data).

import { altOf, coverOf, mediaSrc } from '@forgecommerce/storefront-kit/media/src';
import { formatMoney } from '@forgecommerce/storefront-kit/money';
import { cardBadges } from '@forgecommerce/storefront-kit/promo/badges';
import { displayPrice } from '@forgecommerce/storefront-kit/promo/display-price';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { coverMediaOf, displaySku } from '@forgecommerce/storefront-kit/sku';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import type { CartModel, VariantOption } from '@/lib/cardModel';
import { ProductCardView } from './ProductCardView';

/** The grid cell's rendered width per breakpoint — what the optimizer builds the card's srcset from. */
const CARD_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px';

/** A 5-star rating aggregate a consumer may pass (from REVIEWS-V2). */
export type CardRating = { average: number; count: number };

/** Is this option the COLOR axis? Name-based (like the PDP buybox), NOT the pure photo heuristic — because every
 * SKU carries the color photo, a size value inherits an image too, so "photo-backed = color" wrongly turns the
 * size row into swatches. The color axis is the one NAMED Cor/Cores/Color AND photo-backed; anything else is text. */
function isColorAxis(name: string): boolean {
  return /^(cor|cores|color|colour)$/i.test(name.trim());
}

/** Build the serializable variation model the client view resolves a selection against. The COLOR option renders
 * as photo swatches (its values' SKU images); every other option is text rectangles (size). The server does the
 * media resolution so the client stays dumb (no server-only imports on the client). */
function buildCartModel(product: ProductDoc): CartModel {
  const skus = (product.skus ?? []).filter((s) => (s.status ? s.status === 'active' : true));
  // The swatch carries BOTH the url and the opaque provider_key, so the chip (and the hover-swap) can go through
  // the same-origin optimizer door instead of painting the full-size master (PERF: a ~40px chip must not fetch a
  // 130 KB photo). server-side resolution (mediaSrc) — the client half never touches the env.
  const swatch = new Map<string, Map<string, { url: string; providerKey?: string }>>();
  for (const s of skus) {
    const src = mediaSrc(coverOf(s.media ?? []));
    if (!src.url) continue;
    for (const ov of s.option_values ?? []) {
      if (!swatch.has(ov.option_id)) swatch.set(ov.option_id, new Map());
      const byValue = swatch.get(ov.option_id);
      if (byValue && !byValue.has(ov.value_id))
        byValue.set(ov.value_id, { url: src.url, providerKey: src.providerKey });
    }
  }
  const options: VariantOption[] = (product.options ?? []).map((o) => {
    const swatches = swatch.get(o.id);
    const isSwatch = isColorAxis(o.name) && Boolean(swatches && swatches.size > 0);
    return {
      optionId: o.id,
      name: o.name,
      kind: isSwatch ? 'swatch' : 'text',
      values: [...o.values]
        .sort((a, b) => a.position - b.position)
        .map((v) => ({
          valueId: v.id,
          label: v.value,
          swatchUrl: isSwatch ? swatches?.get(v.id)?.url : undefined,
          swatchProviderKey: isSwatch ? swatches?.get(v.id)?.providerKey : undefined,
        })),
    };
  });
  return {
    currency: displaySku(product)?.currency ?? 'BRL',
    defaultSkuId: displaySku(product)?.id ?? skus[0]?.id ?? '',
    // Only expose options when there is a real choice (multiple SKUs). A single-SKU product shows just the qty.
    options: skus.length > 1 ? options : [],
    skus: skus.map((s) => ({
      id: s.id,
      optionValues: Object.fromEntries(
        (s.option_values ?? []).map((ov) => [ov.option_id, ov.value_id]),
      ),
    })),
  };
}

export function ProductCard({
  product,
  base,
  freeShippingThreshold,
  maxInstallments,
  rating,
  isNew,
  badges,
  cart = true,
  compact,
  sizes = CARD_SIZES,
  priority,
}: {
  product: ProductDoc;
  /** MULTISTORE M1-β — the prefix the current request carries. Required on purpose: a card is the most-repeated
   * link in the storefront, and a card that drops the store walks the shopper into whatever store the Host
   * resolves. There is no sensible default for it, so there is none. */
  base: StoreBase;
  /** The store's free-shipping floor in cents. Absent/null → no "Frete grátis" tag. */
  freeShippingThreshold?: number | null;
  /** The store's max installments. Absent/null → no installment line (never a hardcoded 12x). */
  maxInstallments?: number | null;
  /** REVIEWS-V2 aggregate; absent → the rating row stays reserved but empty. */
  rating?: CardRating;
  /** The "NOVO" tag — a caller's signal (the product doc carries no created_at). */
  isNew?: boolean;
  /** A caller-supplied extra badge slot; the theme's own ordered tags render before it. */
  badges?: ReactNode;
  /** The interactive 2-click cart island. Default on; a display-only context passes `false`. */
  cart?: boolean;
  /** Compact rendering (mobile / narrow columns): fewer variation chips, a smaller expanded pill. */
  compact?: boolean;
  /** Override the srcset hint when the card sits in a grid with different cells. */
  sizes?: string;
  priority?: boolean;
}) {
  const cover = coverOf(coverMediaOf(product));
  const src = mediaSrc(cover);
  const sku = displaySku(product);

  // OOS card (ronda3 #11) — out of stock on the CARD. The kernel stamps `available` on the product read: false
  // = no active sku is purchasable. The card then shows the "Esgotado" badge and drops the quick-add pill (no add
  // path for a sold-out product), but stays clickable → the PDP (VTEX/Shopify consensus: never hide the product).
  // A doc without the signal (`available === undefined`, e.g. a read that does not compute it) keeps today's card.
  const soldOut = product.available === false;

  const freeShipping =
    sku !== undefined && freeShippingThreshold != null && sku.amount >= freeShippingThreshold;
  // PROMO — the price the card prints now has two possible sources: the merchant's static "was", and the
  // kernel's anonymous-safe promotional preview. `displayPrice` is the ONE place that decides between them
  // (and refuses to combine them into a discount nobody computed).
  const shown = displayPrice(sku);
  const was = shown?.was;
  const effective = shown?.amount ?? sku?.amount ?? 0;
  const installmentEach = maxInstallments ? Math.round(effective / maxInstallments) : null;
  // PACK item 16 — the card used to light FOUR independent tags at once (Esgotado, Frete grátis, NOVO, -N%),
  // each deciding for itself, with no precedence and no cap. One function decides now, and it caps at two
  // (item 16-bis). The view still places each badge in the corner the design gives it.
  const tags = cardBadges({
    soldOut,
    percentOff: shown?.percent ?? null,
    freeShipping,
    isNew: Boolean(isNew),
  });

  return (
    <ProductCardView
      href={storeHref(base, `/p/${product.handle}`)}
      title={product.title}
      imageUrl={src.url}
      imageProviderKey={src.providerKey}
      imageAlt={altOf(cover, product.title)}
      sizes={sizes}
      priority={priority}
      tags={tags}
      rating={rating}
      price={sku ? formatMoney(effective, sku.currency) : ''}
      priceSku={sku?.id}
      oldPrice={was !== undefined && sku ? formatMoney(was, sku.currency) : undefined}
      installments={
        installmentEach !== null && maxInstallments && sku
          ? `ou ${maxInstallments}x de ${formatMoney(installmentEach, sku.currency)}`
          : undefined
      }
      badges={badges}
      cart={Boolean(cart && sku && !soldOut)}
      compact={compact}
      model={buildCartModel(product)}
    />
  );
}
