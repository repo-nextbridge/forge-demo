// LoadMore — the PLP's "Carregar mais produtos" (S7-SF-PLP), replacing numbered pagination. An honest counter
// ("Mostrando X de Y") plus a GET link to the next page. With JS, `<Link scroll={false}>` makes it a Next
// soft-nav: the shelf re-renders in place with the accumulated items (no full reload, scroll preserved), which
// is the prototype's smooth append; without JS it is a real navigation. The server renders the window `?page=N`
// resolves to (see lib/filters/plp.ts plpWindow), so the button just points at `?page=N+1`. It hides on the last
// page (hasMorePages).
//
// ★ QA20/B11 — the counter names the SLICE once the window slides. Up to the ceiling the shelf really does hold
// items 1..N·20 and the counter reads "Mostrando 100 de 250"; past it the shelf holds a slice and saying
// "Mostrando 100" while the first 100 products are off-screen would be a number that promises what the page does
// not show. Then it reads "Mostrando 21 a 120 de 250" and a link back to the top of the list appears — the
// browser's Back is not an affordance the page may count on (it is gone on a fresh deep link to `?page=999`).

import { pluralNoun } from '@forgeco/storefront-kit/plural';
import type { StorePath } from '@forgeco/storefront-kit/store-route';
import Link from 'next/link';
import { hasMorePages } from '@/lib/filters/plp';
import styles from './LoadMore.module.css';

export function LoadMore({
  page,
  from,
  shown,
  total,
  basePath,
}: {
  /** The EFFECTIVE UI page (already clamped to the last page by the window). The button targets `page + 1`. */
  page: number;
  /** 1-based index of the first product on screen — 1 until the window slides. */
  from: number;
  /** How many products are on screen right now (products.length). */
  shown: number;
  total: number;
  /** The list path WITH its active filters/extra already serialized (a `?page=` is appended here). */
  basePath: StorePath;
}) {
  if (total <= 0) return null;
  // basePath may already carry a query (e.g. /search?q=tenis) → append page with the right separator.
  const sep = basePath.includes('?') ? '&' : '?';
  const nextHref = `${basePath}${sep}page=${page + 1}`;
  const more = hasMorePages(page, total);
  const sliding = from > 1;

  return (
    <div className={styles.loadMore} data-testid="load-more">
      <p className={styles.counter} data-testid="load-more-counter">
        Mostrando{' '}
        <strong className={styles.counterStrong}>
          {sliding ? `${from} a ${from + shown - 1}` : shown}
        </strong>
        {` de ${total} ${pluralNoun(total, 'produto', 'produtos')}`}
      </p>
      {more ? (
        // scroll={false}: keep the shopper where they are so the newly appended cards reveal below (the
        // prototype UX), instead of Next's default scroll-to-top on navigation.
        <Link href={nextHref} scroll={false} className={styles.button} rel="nofollow">
          Carregar mais produtos
        </Link>
      ) : null}
      {sliding ? (
        <Link href={basePath} className={styles.restart} rel="nofollow">
          Voltar ao começo da lista
        </Link>
      ) : null}
    </div>
  );
}
