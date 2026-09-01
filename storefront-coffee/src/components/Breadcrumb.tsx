// Breadcrumb — follows the catalog's primary-category path (caption type). Dumb component: the page
// computes the crumbs from the primary category; this renders muted links + a faint separator + the ink
// current item.
//
// CAT-CRUMB-GAP — a crumb may arrive with NO `href`: the store stopped serving that category, so the resolver
// 404s it (`crumbsForPath` decides this, not us). It still renders — the trail has to tell the whole hierarchy
// or it lies about where the product sits — but as TEXT, so nobody is invited into an error page. Making the
// href optional is what keeps that structural: with no URL there is nothing to link, so no future edit here can
// accidentally restore the link.
//
// MULTISTORE M1-β — the crumbs arrive CLEAN (`crumbsForPath` builds the storefront's routing paths, which the
// breadcrumb JSON-LD also turns into absolute canonical URLs). Prefixing happens HERE, at the anchor, because
// only navigation carries the store context: a canonical URL must never grow an `/s/<store>` segment.

import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import Link from 'next/link';
import styles from './Breadcrumb.module.css';

export type Crumb = { label: string; path?: string };

export function Breadcrumb({
  crumbs,
  current,
  base,
}: {
  crumbs: Crumb[];
  current: string;
  base: StoreBase;
}) {
  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb" data-testid="breadcrumb">
      {crumbs.map((c, i) => (
        // Keyed by position + label: the href used to be the key and is no longer unique (two unlinked crumbs
        // would collide on `undefined` and React would drop one of them).
        <span key={`${i}-${c.label}`} className={styles.item}>
          {c.path ? (
            <Link href={storeHref(base, c.path)} className={styles.link}>
              {c.label}
            </Link>
          ) : (
            <span className={styles.unlinked}>{c.label}</span>
          )}
          <span className={styles.sep} aria-hidden="true">
            /
          </span>
        </span>
      ))}
      <span className={styles.current} aria-current="page">
        {current}
      </span>
    </nav>
  );
}
