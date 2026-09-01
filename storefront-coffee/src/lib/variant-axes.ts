// S7-SF-PDP — the shared "which axis is the color" rule, as a pure, CLIENT-SAFE module (no React, no
// server-only media call — it reads the port-resolved `url` straight off the MediaRef). The PDP buybox renders
// the color axis as photo swatches (the others as text buttons), and the gallery filters by the selected color
// value — both consume this ONE rule so they never disagree.
//
// Detection (D1, the spec's lean): the color axis is the one NAMED "Cor"/"Cores"/"Color" AND backed by SKU
// photos; with a matching name but no photos it falls back to text buttons. Name-gating (vs. the card's pure
// photo heuristic) is deliberate: a size-only product whose SKUs happen to carry photos must stay text buttons,
// or the size selector would turn into a photo grid (and the deep-link/gallery mechanics that follow the
// resolved SKU would break). "Cor" is presentation vocabulary in the THEME (degradable), not the kernel.

import { coverOf } from '@forgecommerce/storefront-kit/media/src';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';

type Sku = ProductDoc['skus'][number];

/** Whether an option's name reads as the color axis (pt-BR "Cor"/"Cores", or "Color"). Accent/case-insensitive. */
const COLOR_NAMES = new Set(['cor', 'cores', 'color', 'colors']);

export function isColorName(name: string): boolean {
  return COLOR_NAMES.has(name.trim().toLowerCase());
}

/** A sellable SKU (a doc projected before `status` existed → treat as sellable, like the card/bundle do).
 * Exported because the bundle's SERVER side has to pick the same default SKU the client will pick — two
 * different "first sellable" rules would quote one variant and render another. */
export function sellable(skus: readonly Sku[]): Sku[] {
  return skus.filter((s) => (s.status ? s.status === 'active' : true));
}

/** optionId -> valueId -> the first photo url of a SKU carrying that (option,value) pair. Only axes whose
 * values are backed by a SKU photo get entries — those are the "color" axes. Mirrors ProductCard.buildCartModel,
 * but reads `url` (the port already resolved it) so it runs on the client too. */
export function swatchPhotos(skus: readonly Sku[]): Map<string, Map<string, string>> {
  const swatch = new Map<string, Map<string, string>>();
  for (const s of sellable(skus)) {
    const url = coverOf(s.media)?.url;
    if (!url) continue;
    for (const ov of s.option_values ?? []) {
      if (!swatch.has(ov.option_id)) swatch.set(ov.option_id, new Map());
      const byValue = swatch.get(ov.option_id);
      if (byValue && !byValue.has(ov.value_id)) byValue.set(ov.value_id, url);
    }
  }
  return swatch;
}

/** The color axis id (D1): the option NAMED "Cor" (etc.) whose values are photo-backed. Null when there is no
 * such axis (→ every axis renders as text buttons, and the gallery keeps following the resolved SKU). A "Cor"
 * axis with no photos also returns null → it degrades to text buttons (the spec's fallback). */
export function colorAxisId(product: ProductDoc): string | null {
  const swatch = swatchPhotos(product.skus);
  const byPosition = [...(product.options ?? [])].sort((a, b) => a.position - b.position);
  for (const o of byPosition) {
    if (!isColorName(o.name)) continue;
    const photos = swatch.get(o.id);
    if (photos && photos.size > 0) return o.id;
  }
  return null;
}

/** The buybox axis order (o4-PDP): the COLOR axis renders FIRST — a shopper picks the LOOK, then the fit — and the
 * remaining axes keep their catalog position (`position`). This is DERIVED FROM THE AXIS ROLE (colorAxisId), never
 * a per-product hardcode: a doc that lists "Tamanho" before "Cor" still renders Cor first, because the RULE — the
 * color-axis role leads — decides, not the stored option order. A product with no color axis keeps its catalog
 * order untouched (`position`), so a size-only (or any non-color) product is unaffected. The gallery/selector both
 * read the same `colorAxisId`, so the reorder can never disagree with which axis is the photo swatch grid. */
export function orderedOptions(product: ProductDoc): ProductDoc['options'] {
  const colorId = colorAxisId(product);
  const byPosition = [...(product.options ?? [])].sort((a, b) => a.position - b.position);
  if (!colorId) return byPosition;
  // Stable: the color axis to the front, everyone else in ascending catalog position.
  return byPosition.sort((a, b) => Number(b.id === colorId) - Number(a.id === colorId));
}
