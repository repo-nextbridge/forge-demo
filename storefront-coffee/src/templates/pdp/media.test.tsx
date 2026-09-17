// ASSETS / S6-PDP — the PDP renders the type axis: images feed the gallery, a `video_external` is a SQUARE OF THE
// GALLERY (a link to the video that plays on the stage — it is no longer an iframe dumped below the description),
// and a `document` renders as a download link. Server-rendered markup (a crawler sees it).

import type { MediaRef } from '@forgeco/storefront-kit/read-client';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { PdpTemplate } from './template';

const media: MediaRef[] = [
  {
    provider_key: 'cdn/img.jpg',
    kind: 'image',
    role: null,
    position: 0,
    url: 'https://h/cdn/img.jpg',
  },
  {
    provider_key: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    kind: 'video_external',
    role: null,
    position: 1,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    provider_key: 'cdn/spec.pdf',
    kind: 'document',
    role: 'Ficha técnica',
    position: 2,
    url: 'https://h/cdn/spec.pdf',
  },
];

const html = () => renderToString(<PdpTemplate product={makeProduct({ media })} crumbs={[]} />);

test('a video_external is a gallery thumb linking to the video (reachable without JS)', () => {
  const out = html();
  expect(out).toContain('data-testid="gallery-video-thumb"');
  expect(out).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
});

test('the video does NOT auto-embed below the description (it plays on the stage, on demand)', () => {
  expect(html()).not.toContain('<iframe');
});

test('a document renders as a download link with its role label', () => {
  const out = html();
  expect(out).toContain('https://h/cdn/spec.pdf');
  expect(out).toContain('Ficha técnica');
});

test('the stage opens on an image (the video URL is never an <img src>)', () => {
  const out = html();
  expect(out).toContain('https://h/cdn/img.jpg');
  expect(out).not.toContain('<img src="https://www.youtube.com');
});
