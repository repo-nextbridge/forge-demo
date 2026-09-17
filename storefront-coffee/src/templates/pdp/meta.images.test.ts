// S6-IMAGES — what the crawler and the share card get: JSON-LD `image` and og:image. Both are ABSOLUTE urls
// minted by the KERNEL (MediaRef.url) — never the optimizer's path, never something the theme joined.

import type { MediaRef } from '@forgeco/storefront-kit/read-client';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { pdpMetadata, productJsonLd } from './meta';

const img = (key: string, position: number, url?: string): MediaRef => ({
  provider_key: key,
  kind: 'image',
  role: null,
  position,
  alt: null,
  ...(url ? { url } : {}),
});

test('JSON-LD carries `image`: absolute urls, cover first', () => {
  const product = makeProduct({
    media: [
      img('demo/b', 1, 'https://cdn.test/media/demo/b'),
      img('demo/a', 0, 'https://cdn.test/media/demo/a'),
    ],
  });
  expect(productJsonLd(product).image).toEqual([
    'https://cdn.test/media/demo/a', // position 0 — the cover leads
    'https://cdn.test/media/demo/b',
  ]);
});

test('a video/document is not a product image (only `kind: image` is indexed)', () => {
  const product = makeProduct({
    media: [
      { ...img('https://youtu.be/x', 0), kind: 'video_external', url: 'https://youtu.be/x' },
      { ...img('demo/manual.pdf', 1, 'https://cdn.test/media/demo/manual.pdf'), kind: 'document' },
      img('demo/a', 2, 'https://cdn.test/media/demo/a'),
    ],
  });
  expect(productJsonLd(product).image).toEqual(['https://cdn.test/media/demo/a']);
});

test('no resolvable image → `image` is OMITTED, never an empty array (invalid structured data)', () => {
  expect(productJsonLd(makeProduct({ media: [] }))).not.toHaveProperty('image');
  // A media with no url (no base configured) contributes nothing.
  expect(productJsonLd(makeProduct({ media: [img('demo/a', 0)] }))).not.toHaveProperty('image');
});

test('og:image = the cover; no image → no og:image, never a broken share card', () => {
  const withImage = makeProduct({ media: [img('demo/a', 0, 'https://cdn.test/media/demo/a')] });
  expect(pdpMetadata(withImage).openGraph?.images).toEqual(['https://cdn.test/media/demo/a']);

  const without = makeProduct({ media: [] });
  expect(pdpMetadata(without).openGraph).toBeDefined();
  expect(pdpMetadata(without).openGraph?.images).toBeUndefined();
});
