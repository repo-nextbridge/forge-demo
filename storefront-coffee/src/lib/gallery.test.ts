// S6-PDP — the gallery ordering rule: cover opens the stage, videos close the strip, a SKU without media
// falls back to the product's (the S5 regression, proven at the pure level).

import type { MediaRef } from '@forgecommerce/storefront-kit/read-client';
import { expect, test } from 'vitest';
import { embedSrc, isVideo, orderGalleryItems } from '@/lib/gallery';

const img = (key: string, position: number, role: string | null = null): MediaRef => ({
  provider_key: key,
  kind: 'image',
  role,
  position,
  url: `https://h/${key}`,
});

const video = (url: string, position: number): MediaRef => ({
  provider_key: url,
  kind: 'video_external',
  role: null,
  position,
  url,
});

const doc: MediaRef = {
  provider_key: 'cdn/spec.pdf',
  kind: 'document',
  role: 'Ficha técnica',
  position: 9,
  url: 'https://h/cdn/spec.pdf',
};

test('the cover opens the stage, whatever its position', () => {
  const media = [img('a', 0), img('cover', 5, 'cover'), img('b', 1)];
  expect(orderGalleryItems(media, media).map((m) => m.provider_key)).toEqual(['cover', 'a', 'b']);
});

test('without a cover role the strip is position-ordered (today behaviour preserved)', () => {
  const media = [img('b', 2), img('a', 1)];
  expect(orderGalleryItems(media, media).map((m) => m.provider_key)).toEqual(['a', 'b']);
});

test("the product's videos come last; documents never enter the gallery", () => {
  const media = [doc, video('https://youtu.be/x', 0), img('a', 1)];
  const items = orderGalleryItems(media, media);
  expect(items.map((m) => m.provider_key)).toEqual(['a', 'https://youtu.be/x']);
  expect(items.filter(isVideo)).toHaveLength(1);
});

test('a SKU with media drives the strip; the videos still come from the product', () => {
  const productMedia = [img('p', 0), video('https://youtu.be/x', 1)];
  const skuMedia = [img('s', 0)];
  expect(orderGalleryItems(skuMedia, productMedia).map((m) => m.provider_key)).toEqual([
    's',
    'https://youtu.be/x',
  ]);
});

test('a SKU WITHOUT media falls back to the product images (S5 regression)', () => {
  const productMedia = [img('p', 0)];
  expect(orderGalleryItems([], productMedia).map((m) => m.provider_key)).toEqual(['p']);
});

test('a SKU carrying only a document still falls back to the product images', () => {
  const productMedia = [img('p', 0)];
  expect(orderGalleryItems([doc], productMedia).map((m) => m.provider_key)).toEqual(['p']);
});

test('embedSrc maps YouTube/Vimeo and gives up on anything else', () => {
  expect(embedSrc('https://www.youtube.com/watch?v=abc123')).toBe(
    'https://www.youtube.com/embed/abc123',
  );
  expect(embedSrc('https://youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123');
  expect(embedSrc('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
  expect(embedSrc('https://example.com/v.mp4')).toBeNull();
});
