// ONE PRODUCT, AS THE MODAL NEEDS IT — "variação em no máximo dois toques, botões gordos, nunca dropdown".
//
// ★ THE AXES ARE THE PRODUCT'S OWN. `ProductDoc.options` is the merchant's list of variation axes (Tamanho,
// Leite, Moagem, Peso…) with their values in the position the merchant chose, and each SKU declares which
// value it carries on each axis. So the modal does not know what a "size" is — it renders the axes the
// catalogue has, in the catalogue's order, and looks the SKU back up from the buttons that are pressed.
//
// ⚠️ THE PRICE OF A CHOICE IS THE PRICE OF A SKU, NEVER A DELTA THIS SCREEN ADDS. The artboard shows
// "+ R$ 3,00" beside an option, and that number is computed by SUBTRACTING two real SKU prices, not by
// carrying a surcharge table. A product whose "G" costs less than its "P" would therefore show a negative
// delta and still charge the truth, which is the only behaviour that cannot drift from the till.

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import type { OptionAxis, ProductDetail } from './product-select';
import { coverOf, imagesOf, mediaSrc } from '@forgeco/storefront-kit/media/src';
import { totemRead } from './port';
import { resolveTotemStore } from './store';

export function toDetail(p: ProductDoc, kicker: string): ProductDetail {
  const axes: OptionAxis[] = [...p.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({
      optionId: o.id,
      label: o.name,
      values: [...o.values]
        // A value the public read still carries but the merchant archived must not become a button.
        .filter((v) => v.status === undefined || v.status === 'active')
        .sort((a, b) => a.position - b.position)
        .map((v) => ({ valueId: v.id, label: v.value })),
    }))
    .filter((a) => a.values.length > 0);

  const variants = p.skus
    .filter((s) => s.status === 'active')
    .map((s) => ({
      skuId: s.id,
      valueIds: s.option_values.map((ov) => ov.value_id),
      amount: s.promotional_price?.promotional_amount ?? s.amount,
      label: s.option_values.map((ov) => ov.value).join(' · '),
    }));

  const cheapest = variants.reduce<(typeof variants)[number] | null>(
    (best, v) => (best === null || v.amount < best.amount ? v : best),
    null,
  );

  return {
    handle: p.handle,
    name: p.title,
    description: p.description ?? '',
    imageUrl: mediaSrc(coverOf(p.media) ?? imagesOf(p.media)[0]).url,
    kicker,
    axes,
    variants,
    defaultSkuId: cheapest?.skuId ?? null,
  };
}

/** Read one product of this counter by handle. Null when the port cannot resolve it (see `menu.ts`). */
export async function readProduct(handle: string, kicker: string): Promise<ProductDetail | null> {
  const store = resolveTotemStore();
  const doc = await totemRead().productByHandle(store.id, handle);
  return doc ? toDetail(doc, kicker) : null;
}



export type { OptionAxis, OptionValue, ProductDetail } from './product-select';
