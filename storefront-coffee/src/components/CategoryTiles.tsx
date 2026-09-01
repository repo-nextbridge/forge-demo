// CategoryTiles — the "Compre por categoria" block (S7-SF-HOME, HANDOVER §3). A theme block filling the
// `home.categories` slot: up to 8 tiles built from the CORE `read.categories` (the same map the megamenu reads —
// this is core navigation data, not an app's, so the theme reads it directly, like the header tree does), each
// with its S7-SF-SMALLS icon. Server Component; degrades to nothing when the store has no categories (never an
// empty grid). The section header carries a "Ver todas →" affordance to the browse-all surface, matching the
// prototype. The presentational body (CategoryTilesView) is split out so the preview gallery can render it with
// a fixture (the async wrapper reads the port, which the gallery has no access to).

import { ltreeToSegments } from '@forgecommerce/storefront-kit/catalog-path';
import { isCategoryBrowsable } from '@forgecommerce/storefront-kit/category-visibility';
import { readClient } from '@forgecommerce/storefront-kit/config';
import { ArrowRight } from '@forgecommerce/storefront-kit/icons';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { CSSProperties } from 'react';
import { CategoryTileIcon } from './CategoryTileIcon';
import styles from './CategoryTiles.module.css';

/** The prototype shows 8 tiles; a store with fewer shows fewer, more are trimmed. */
const MAX_TILES = 8;

/** "Ver todas" resolves to the browse-all surface (the store has no dedicated all-categories index). */
const SEE_ALL_PATH = '/search';

export type CategoryTile = { path: string; name: string; iconUrl?: string; href: string };

/** The public URL for an ltree category path (`roupas.calcados` -> `/roupas/calcados`) — mirrors the megamenu.
 * MULTISTORE M1-β: store-scoped, so a tile clicked under `/s/<store>` stays in that store. */
function categoryHref(base: StoreBase, path: string): string {
  return storeHref(base, `/${ltreeToSegments(path).join('/')}`);
}

/** Presentational — the section chrome + the tile grid over already-resolved tiles. Pure (no port), so the
 * preview gallery renders it directly. The tiles' hrefs are already store-scoped by the async half; `base` is
 * what the section's own "Ver todas" needs. */
export function CategoryTilesView({ tiles, base }: { tiles: CategoryTile[]; base: StoreBase }) {
  if (tiles.length === 0) return null;
  return (
    <section className={styles.section} data-testid="home-categories">
      <div className={styles.header}>
        <h2 className={styles.title}>Compre por categoria</h2>
        <a className={styles.seeAll} href={storeHref(base, SEE_ALL_PATH)}>
          Ver todas <ArrowRight size={14} />
        </a>
      </div>
      {/* --tiles drives the desktop grid: N tiles become N equal columns that fill 100% (no empty gutter when
          there are fewer than the old fixed 8). */}
      <ul className={styles.grid} style={{ '--tiles': tiles.length } as CSSProperties}>
        {tiles.map((t) => (
          <li key={t.path} className={styles.cell}>
            <a href={t.href} className={styles.tile}>
              {/* Icon OR the named empty state — CategoryTileIcon always renders one of the two, so a tile is
                  never a hole. See its header for why the no-art case is the normal one here. */}
              <CategoryTileIcon iconUrl={t.iconUrl} name={t.name} />
              <span className={styles.label}>{t.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function CategoryTiles({ store, base }: { store: string; base: StoreBase }) {
  const map = await readClient().categories(store);
  if (!map) return null;
  const tiles: CategoryTile[] = Object.values(map)
    .filter(isCategoryBrowsable) // CAT-STATUS-GAP — a tile the resolver 404s is a tile into a dead end
    .filter((c) => ltreeToSegments(c.path).length === 1) // top-level only (the tiles are the entry points)
    .sort((a, b) => b.name.localeCompare(a.name)) // reverse-alphabetical (Tênis → Acessórios)
    .slice(0, MAX_TILES)
    .map((c) => ({
      path: c.path,
      name: c.name,
      iconUrl: c.icon_url,
      href: categoryHref(base, c.path),
    }));
  if (tiles.length === 0) return null; // empty store → nothing (never an empty grid)
  return <CategoryTilesView tiles={tiles} base={base} />;
}
