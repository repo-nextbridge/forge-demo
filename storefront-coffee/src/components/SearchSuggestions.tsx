// Empty-state suggestions (SEARCH-6): when a search/PLP yields nothing, don't dead-end — offer a way forward.
// The TopTherm pattern is curated best-sellers; best-selling depends on a sales signal (SIG, v0.4), so V1
// suggests CATEGORIES (from the catmap) + a few NEWEST products. Additive: when SIG lands, swap/augment the
// product row with curated best-sellers. Server-rendered links (no JS).

import { ltreeToSegments } from '@forgeco/storefront-kit/catalog-path';
import type { CategoryMap, ProductDoc } from '@forgeco/storefront-kit/read-client';
import { type StoreBase, storeHref } from '@forgeco/storefront-kit/store-route';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { Shelf } from '@/components/Shelf';
import styles from './SearchSuggestions.module.css';

export function SearchSuggestions({
  title,
  message,
  catmap,
  products,
  base,
}: {
  title: string;
  message: string;
  catmap: CategoryMap;
  products: ProductDoc[];
  base: StoreBase;
}) {
  const categories = Object.values(catmap).slice(0, 8);
  return (
    <div className={styles.wrap} data-testid="search-suggestions">
      <EmptyState title={title} message={message} />
      {categories.length > 0 ? (
        <nav className={styles.cats} aria-label="Categorias sugeridas">
          {categories.map((c) => (
            <Link
              key={c.path}
              href={storeHref(base, `/${ltreeToSegments(c.path).join('/')}`)}
              className={styles.cat}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {products.length > 0 ? (
        <div className={styles.suggested}>
          <h2 className={styles.heading}>Novidades</h2>
          <Shelf products={products} base={base} />
        </div>
      ) : null}
    </div>
  );
}
