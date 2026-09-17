// Catalog example for Gallery (/ui-storefront/gallery) — the PDP media STAGE + thumbnail strip. Clicking a thumb
// puts it on the stage; a single-image product hides the strip; a video thumb (last, always) swaps the stage to a
// player embed. Fed offline with data-URI squares (no media door), so `optimized` is false — the plain <img> path.
'use client';

import type { MediaRef } from '@forgeco/storefront-kit/read-client';
import { Gallery } from './Gallery';

/** A 1×1 colored square as a data URI — a stand-in photo (no media door in the offline preview). */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

function image(hex: string, position: number, role: string | null = null): MediaRef {
  return { provider_key: `demo/${position}`, kind: 'image', role, position, url: square(hex) };
}

const MULTI: MediaRef[] = [
  image('%23c7cdd4', 0, 'cover'),
  image('%2317181a', 1),
  image('%231d4ed8', 2),
  image('%2316a34a', 3),
];

const SINGLE: MediaRef[] = [image('%23c7cdd4', 0, 'cover')];

// A video rides LAST (a video belongs to the product). Its thumb swaps the stage to a YouTube player embed on
// click; at first paint the cover image is on the stage, so nothing loads over the network during SSR.
const WITH_VIDEO: MediaRef[] = [
  image('%23c7cdd4', 0, 'cover'),
  image('%23c2410c', 1),
  { provider_key: 'https://youtu.be/dQw4w9WgXcQ', kind: 'video_external', role: null, position: 2 },
];

export function GalleryExamples() {
  return (
    <div style={{ display: 'grid', gap: 32, maxWidth: 460 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>
          Vários ângulos: a tira aparece; clique troca o palco
        </p>
        <Gallery media={MULTI} alt="Tênis Speed Elite" optimized={false} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>Uma foto só: sem tira de miniaturas</p>
        <Gallery media={SINGLE} alt="Tênis Speed Elite" optimized={false} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>
          Com vídeo: a miniatura do player fecha a tira
        </p>
        <Gallery media={WITH_VIDEO} alt="Tênis Speed Elite" optimized={false} />
      </div>
    </div>
  );
}
