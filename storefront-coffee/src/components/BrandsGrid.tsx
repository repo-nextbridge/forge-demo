// BrandsGrid — the "Marcas" block (S7-SF-HOME, HANDOVER §3). A theme block filling the `home.brands` slot: a
// 4-column grid (2 on mobile) built from the CORE `read.brands` map (the seed logos), each linking to its
// brand page. Server Component; degrades to nothing when the store has no active brands (never an empty grid).
// The presentational body (BrandsGridView) is split out so the preview gallery can render it with a fixture.
import { readClient } from '@forgecommerce/storefront-kit/config';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import styles from './BrandsGrid.module.css';

export type BrandCell = { slug: string; name: string; logoUrl?: string | null; href: string };

/** The featured brands, in order — the store's most-stocked labels, so the home shows a curated TWO ROWS (4-up)
 * instead of the full hundreds. Demo curation: `read.brands` carries no product count, so the ranking is authored
 * here (a count-driven read is the refinement). A slug absent from the store is silently skipped. */
const FEATURED_BRANDS = [
  'johnston-murphy',
  'cole-haan',
  'corral-boots',
  'columbia',
  'adidas',
  'nike',
  'ugg',
  'new-balance',
];

/** Presentational — the "Marcas que amamos" section over already-resolved cells. Pure (no port), so the preview
 * gallery renders it directly. A cell shows its wordmark image when the brand has a logo, else the name. */
export function BrandsGridView({ brands }: { brands: BrandCell[] }) {
  if (brands.length === 0) return null;
  return (
    <section className={styles.section} data-testid="home-brands">
      <h2 className={styles.title}>Marcas que amamos</h2>
      <ul className={styles.grid}>
        {brands.map((b) => (
          <li key={b.slug} className={styles.cell}>
            <a href={b.href} className={styles.tile}>
              {b.logoUrl ? (
                <img src={b.logoUrl} alt={b.name} className={styles.logo} />
              ) : (
                <span className={styles.label}>{b.name}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function BrandsGrid({ store, base }: { store: string; base: StoreBase }) {
  const map = await readClient().brands(store);
  if (!map) return null;
  const bySlug = new Map(
    Object.values(map)
      .filter((b) => b.status === 'active')
      .map((b) => [b.slug, b] as const),
  );
  // Two rows of the featured brands, in the curated order; skip any the store does not carry. Fall back to the
  // first few active brands (alphabetical) only if none of the featured ones resolve (a very different catalog).
  let picked = FEATURED_BRANDS.map((slug) => bySlug.get(slug)).filter((b) => b !== undefined);
  if (picked.length === 0) {
    picked = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
  }
  const brands: BrandCell[] = picked.map((b) => ({
    slug: b.slug,
    name: b.name,
    logoUrl: b.logo_url,
    // MULTISTORE M1-β — store-scoped, so the brand page opens in the store the shopper is browsing.
    href: storeHref(base, `/b/${b.slug}`),
  }));
  if (brands.length === 0) return null;
  return <BrandsGridView brands={brands} />;
}
