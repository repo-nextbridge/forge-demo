// S7-SF-PDP — the NEUTRAL rating channel between the reviews extension and the theme's buybox. The review
// aggregate (average + count) lives only in the reviews extension's isolated data space, and `read.product`
// carries no rating (onda-2 note). The buybox needs it to light the stars. Crossing that boundary WITHOUT
// coupling: the extension's reviews section (which already computes the aggregate) DISPATCHES a browser
// CustomEvent + writes a global; the theme's `BuyboxRating` island subscribes here. Neither side imports the
// other — both depend only on this documented string contract, the same way the reviews block "speaks only the
// generated data port". No reviews → the block renders null → nothing is ever dispatched → the buybox stays
// starless (a reserved-but-empty line, no hole).
//
// The extension re-declares the SAME event name + global key with a pointer to this file (it cannot import the
// theme). Keep the two literals in sync — this module is the source of truth.

/** The neutral event the reviews section fires on mount/update. */
export const PDP_RATING_EVENT = 'forge:pdp-rating';

/** The neutral global the reviews section also writes, so a buybox that mounts AFTER the event still gets it. */
export const PDP_RATING_GLOBAL = '__forgePdpRating';

/** The anchor id the reviews section renders, so the buybox's "Ler N avaliações" can scroll to it. */
export const PDP_REVIEWS_ANCHOR = 'avaliacoes';

export type PdpRating = { average: number; count: number };

type RatingWindow = Window & { [PDP_RATING_GLOBAL]?: PdpRating };

/** The last aggregate published this page load, or null. */
export function readPublishedRating(): PdpRating | null {
  if (typeof window === 'undefined') return null;
  return (window as RatingWindow)[PDP_RATING_GLOBAL] ?? null;
}

/** Subscribe to rating updates. Fires immediately with any already-published value (mount-order safe), then on
 * every subsequent event. Returns an unsubscribe. */
export function onPdpRating(handler: (rating: PdpRating) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const published = readPublishedRating();
  if (published) handler(published);
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<PdpRating>).detail;
    if (detail && typeof detail.count === 'number') handler(detail);
  };
  window.addEventListener(PDP_RATING_EVENT, listener);
  return () => window.removeEventListener(PDP_RATING_EVENT, listener);
}
