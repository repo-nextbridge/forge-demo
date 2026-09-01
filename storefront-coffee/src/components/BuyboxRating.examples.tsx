// Catalog example for BuyboxRating (/ui-storefront/buybox-rating) — the buybox's "★★★★★ 4,7 · Ler N avaliações"
// line. The aggregate arrives over the neutral rating channel (lib/pdp-rating), which the reviews extension
// publishes; here we publish a stub aggregate on mount so the stars light, exactly as PdpShowcase does. Under
// SSR the effect never runs, so the row renders EMPTY (reserved height, no hole) — that is the "no reviews" state.
'use client';

import { useEffect } from 'react';
import { PDP_RATING_EVENT, PDP_RATING_GLOBAL, type PdpRating } from '@/lib/pdp-rating';
import { BuyboxRating } from './BuyboxRating';

export function BuyboxRatingExamples() {
  // Publish an aggregate the way the reviews section does (write the global AND fire the event) so a client
  // render lights the stars. On the server this does not run → the row stays empty (the "no reviews" shape).
  useEffect(() => {
    const rating: PdpRating = { average: 4.7, count: 128 };
    (window as unknown as Record<string, PdpRating>)[PDP_RATING_GLOBAL] = rating;
    window.dispatchEvent(new CustomEvent(PDP_RATING_EVENT, { detail: rating }));
  }, []);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={{ color: 'var(--color-subtle)' }}>rated (aggregate published on mount)</p>
      <BuyboxRating />
    </div>
  );
}
