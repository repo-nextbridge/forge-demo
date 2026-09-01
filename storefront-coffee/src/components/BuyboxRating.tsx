// S7-SF-PDP — the buybox rating line (HANDOVER §4): "★★★★★ 4,7 · Ler N avaliações", anchored to the reviews
// section with a smooth scroll. The aggregate arrives over the NEUTRAL rating channel (lib/pdp-rating) published
// by the reviews extension — never from the product read, never by importing the extension. The row is ALWAYS
// rendered (reserved height) so the buybox never dances; it stays EMPTY until (and unless) a rating is published.
// A product with no reviews → the reviews block renders null → nothing is published → this stays empty (no hole).
'use client';

import { Star } from '@forgecommerce/storefront-kit/icons';
import { useEffect, useState } from 'react';
import { onPdpRating, PDP_REVIEWS_ANCHOR, type PdpRating } from '@/lib/pdp-rating';
import styles from './BuyboxRating.module.css';

/** A row of five canonical stars (lib/icons.Star) — the shared glyph the card and the reviews section render. */
function FiveStars() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={14} className={styles.star} />
      ))}
    </>
  );
}

/** Five stars with the average's exact fractional fill (a gold overlay clipped to average/5, over a gray row). */
function Stars({ average }: { average: number }) {
  const pct = Math.max(0, Math.min(100, (average / 5) * 100));
  return (
    <span className={styles.stars} aria-hidden="true">
      <span className={styles.starsFill} style={{ width: `${pct}%` }}>
        <FiveStars />
      </span>
      <FiveStars />
    </span>
  );
}

export function BuyboxRating() {
  const [rating, setRating] = useState<PdpRating | null>(null);

  useEffect(() => onPdpRating(setRating), []);

  function scrollToReviews(e: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(PDP_REVIEWS_ANCHOR);
    if (!target) return; // no section yet → let the plain anchor jump do its thing
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className={styles.row} data-testid="buybox-rating">
      {rating && rating.count > 0 ? (
        <a
          href={`#${PDP_REVIEWS_ANCHOR}`}
          className={styles.link}
          onClick={scrollToReviews}
          data-testid="buybox-rating-link"
        >
          <Stars average={rating.average} />
          <span className={styles.score}>{rating.average.toFixed(1).replace('.', ',')}</span>
          <span className={styles.count}>
            Ler {rating.count} {rating.count === 1 ? 'avaliação' : 'avaliações'}
          </span>
        </a>
      ) : null}
    </div>
  );
}
