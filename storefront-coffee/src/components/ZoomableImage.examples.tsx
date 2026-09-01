// Catalog example for ZoomableImage (/ui-storefront/zoomable-image) — the PDP stage's DESKTOP hover loupe. On a
// pointer-fine device, moving the mouse over the image magnifies it in place (scale 2, origin tracking the cursor)
// and leaving resets it; on touch/SSR it is the plain, no-zoom stage (the safe default). Wraps a data-URI photo.
'use client';

import { ZoomableImage } from './ZoomableImage';

/** A 1×1 colored square as a data URI — a stand-in photo (no media door in the offline preview). */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

export function ZoomableImageExamples() {
  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
      <p style={{ color: 'var(--color-subtle)' }}>
        Passe o mouse (desktop) para ativar a lupe; no toque nada acontece
      </p>
      <div style={{ position: 'relative', width: 420, height: 420, overflow: 'hidden' }}>
        <ZoomableImage>
          <img
            src={square('%23c7cdd4')}
            alt="Tênis Speed Elite"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </ZoomableImage>
      </div>
    </div>
  );
}
