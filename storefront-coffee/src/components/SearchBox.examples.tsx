// Catalog examples for SearchBox (/ui-storefront/search-box). The header search: a pill field (no submit button)
// with the two-column suggest panel — a results list ("Categoria · preço-de preço") + a FEATURED ProductCard
// (desktop; single column on mobile). Seeded OPEN with a static previewResult (the live panel opens over
// /api/suggest once you type). Images are omitted (the card/thumb show the placeholder) — staging renders the
// real photos.
'use client';

import type { SuggestProduct, SuggestResult } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { SearchBox } from './SearchBox';

function item(
  title: string,
  handle: string,
  price: number,
  compareAt: number | null,
): SuggestProduct {
  // `image_key` joined SuggestProduct in PACK 03/09 (the vitrine's image door): the suggest payload carries
  // the media KEY so the dropdown can address a derivative through /api/img instead of the kernel's absolute
  // URL. This catalog fixture draws no photo at all, so both halves are null — but the field is required, and
  // the oven is where a fork finds that out. See docs/conventions/media-and-images.md §3.
  return {
    title,
    handle,
    price,
    compare_at: compareAt,
    image: null,
    image_key: null,
    category: 'Tênis',
  };
}

const PREVIEW: SuggestResult = {
  products: [
    item('Tênis Velocity 9', 'tenis-velocity-9', 69990, 90990),
    item('Tênis Pace Runner', 'tenis-pace-runner', 54990, null),
    item('Tênis Glide Boost', 'tenis-glide-boost', 62990, null),
    item('Tênis Fresh Foam X', 'tenis-fresh-foam-x', 57990, null),
    item('Tênis Speed Elite', 'tenis-speed-elite', 74990, 97490),
  ],
  categories: [{ name: 'Tênis', path: 'tenis' }],
};

export function SearchBoxExamples() {
  // Full-width wrap so the panel spans as it does on a real mobile header row; on desktop it opens as a 640px
  // panel anchored to the field's right edge (the field itself is the header's compact 210px pill in context).
  return (
    <div style={{ position: 'relative', paddingBottom: 460 }}>
      <SearchBox base={HOST_BASE} defaultValue="tênis" previewResult={PREVIEW} />
    </div>
  );
}
