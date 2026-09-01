// S6-PDP — the gallery's ordering rule, as a pure module (no React), so the interactive Gallery stays thin.
//
// The stage shows ONE item at a time and the thumbs are the whole strip. What feeds it:
//   • images of the SELECTED source — the SKU's own media when it has any, else the product's (the S5 rule);
//   • the product's `video_external` refs, always LAST (a video belongs to the product, not to a variant).
// `document` refs never enter the gallery (they stay in DocumentLinks, below the buybox).
//
// Ordering of the images: the media the operator marked as `role='cover'` opens the stage, whatever its
// position; everything else follows by `position`. Sort is stable, so equal positions keep read order.

import { imagesOf } from '@forgecommerce/storefront-kit/media/src';
import type { MediaRef } from '@forgecommerce/storefront-kit/read-client';

/** A gallery entry: an image (stage = picture) or an external video (stage = player embed). */
export type GalleryItem = MediaRef;

export function isVideo(m: MediaRef): boolean {
  return (m.kind ?? 'image') === 'video_external';
}

/** Map an external video URL to its player-embed URL. `null` when we don't know the provider (renders as a link). */
export function embedSrc(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/** The gallery strip: cover-first images of `source` (fallback `productMedia`, then `fallbackMedia`), followed
 * by the product's videos. `imagesOf` (S6-IMAGES) gives the position-ordered images; the cover role is what
 * lifts one to the front.
 *
 * PRE-S7-DEFAULT-SKU — `fallbackMedia` is the DEFAULT sku's media: the LAST resort, reached only when neither
 * the selected SKU nor the product carries an image. It never outranks the product's own photos (product-level
 * info always wins). Omitted / no star → the chain is exactly the one that shipped before: SKU, then product,
 * then nothing. The VIDEOS keep coming from the product either way — a video belongs to the product, not to a
 * variant, so a starred SKU's photos never drag a video along. */
/** S7-SF-PDP — the gallery filters by COLOR, not by the resolved SKU. Given the selected color axis + value,
 * this is the UNION of the images of every SKU that carries that (option,value) pair (a color may span several
 * sizes, each with its own photos). Empty when no color is selected (`colorValueId` null) OR the axis is absent
 * → the caller then falls back to the product's own media (all colors), which is the prototype's initial state.
 * Order is by position; `orderGalleryItems` lifts the cover and appends the product's videos. */
export function mediaForColorValue(
  skus: { option_values: { option_id: string; value_id: string }[]; media: MediaRef[] }[],
  colorOptionId: string | null,
  colorValueId: string | null,
): MediaRef[] {
  if (!colorOptionId || !colorValueId) return [];
  const seen = new Set<string>();
  const union: MediaRef[] = [];
  for (const sku of skus) {
    const carries = sku.option_values.some(
      (ov) => ov.option_id === colorOptionId && ov.value_id === colorValueId,
    );
    if (!carries) continue;
    for (const m of imagesOf(sku.media)) {
      // De-dup across sizes of the same color (they often share the same photos).
      const dedupKey = `${m.provider_key}#${m.position}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      union.push(m);
    }
  }
  return union;
}

/** The union of EVERY color's images (all SKUs), de-duped, position-ordered — the "todas as cores" the gallery
 * shows before the shopper picks a color (HANDOVER §4). Empty when no SKU carries a photo → the caller falls
 * back to the product's own media. */
export function mediaAllColors(skus: { media: MediaRef[] }[]): MediaRef[] {
  const seen = new Set<string>();
  const union: MediaRef[] = [];
  for (const sku of skus) {
    for (const m of imagesOf(sku.media)) {
      const dedupKey = `${m.provider_key}#${m.position}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      union.push(m);
    }
  }
  return union;
}

export function orderGalleryItems(
  source: MediaRef[],
  productMedia: MediaRef[],
  fallbackMedia: MediaRef[] = [],
): GalleryItem[] {
  const own = imagesOf(source);
  const product = imagesOf(productMedia);
  const picked = own.length > 0 ? own : product.length > 0 ? product : imagesOf(fallbackMedia);
  const ordered = [...picked].sort(
    (a, b) => Number(b.role === 'cover') - Number(a.role === 'cover'),
  );
  const videos = productMedia.filter(isVideo).sort((a, b) => a.position - b.position);
  return [...ordered, ...videos];
}
