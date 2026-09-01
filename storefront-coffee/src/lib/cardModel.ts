// The ProductCard's variation model — the serializable shape the server card builds and the client view resolves
// a selection against. Pure (no 'use client'): shared by ProductCard (server, builds it) and ProductCardView
// (client, resolves a selection → SKU id for the real add). HANDOVER §2.8.

/** One selectable value of an option (a color photo swatch or a size label). */
export type VariantValue = {
  valueId: string;
  label: string;
  swatchUrl?: string;
  /** The opaque catalog key for the swatch photo — lets the chip + the hover-swap render through the same-origin
   * optimizer (next/image) instead of a full-size CSS background. Absent when no media base is configured. */
  swatchProviderKey?: string;
};

/** One option row in the panel — photo swatches ("color") or text rectangles ("size"). */
export type VariantOption = {
  optionId: string;
  name: string;
  kind: 'swatch' | 'text';
  values: VariantValue[];
};

/** The serializable model the server card builds; the client only resolves a selection against it. */
export type CartModel = {
  currency: string;
  defaultSkuId: string;
  options: VariantOption[];
  /** Each SKU's optionId -> valueId map, so a selection resolves to exactly one SKU. */
  skus: { id: string; optionValues: Record<string, string> }[];
};

/** The default selection — the starred (default) SKU's option values, so the panel opens on a resolvable SKU. */
export function defaultSelection(model: CartModel): Record<string, string> {
  const def = model.skus.find((s) => s.id === model.defaultSkuId) ?? model.skus[0];
  return def ? { ...def.optionValues } : {};
}

/** Resolve a selection to a SKU id: the SKU whose every option value matches. Falls back to the default when the
 * product has no options (single SKU) or the selection is incomplete. */
export function resolveSkuId(model: CartModel, selection: Record<string, string>): string {
  if (model.options.length === 0) return model.defaultSkuId;
  const hit = model.skus.find((s) =>
    model.options.every((o) => s.optionValues[o.optionId] === selection[o.optionId]),
  );
  return hit?.id ?? model.defaultSkuId;
}
