// /ui-storefront gallery (S7-SF-FOUNDATION) — the storefront theme's chrome inventory, browsable. The sibling
// of /ui-admin. Index view: a GET search (?q=, server-filtered — no client JS needed) + component cards linking
// to their detail page. GENERATED-manifest-driven: authored once, never grows per component (a chrome piece
// with a co-located examples file just appears here after `pnpm codegen`).
//
// noindex + off the sitemap + excluded from the store-rewrite middleware — a dev/preview reference for the
// team and AI agents, not a store surface. Always mounted (no build flag).

import type { Metadata } from 'next';
import Link from 'next/link';
import { filterComponents } from './catalog';
import styles from './ui-storefront.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'UI storefront',
  robots: { index: false, follow: false },
};

export default async function UiStorefrontPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const matches = filterComponents(q);

  return (
    <main className={styles.page}>
      <div>
        <h1 className={styles.title}>
          UI storefront <span className={styles.count}>{matches.length}</span>
        </h1>
        <p className={styles.blurb}>
          The storefront theme's chrome inventory. Check here before drawing something new.
        </p>
      </div>

      <form method="get" action="/ui-storefront" className={styles.searchForm}>
        <div className={styles.searchBox}>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar componentes"
            aria-label="Buscar componentes"
            className={styles.searchInput}
          />
        </div>
      </form>

      {matches.length > 0 ? (
        <div className={styles.grid}>
          {matches.map((c) => (
            <Link key={c.id} href={`/ui-storefront/${c.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.cardName}>{c.name}</span>
                {c.client ? <span className={styles.tag}>client</span> : null}
              </div>
              <span className={styles.path}>{c.path}</span>
              <div className={styles.meta}>
                {c.props.length > 0 ? <span>{c.props.length} props</span> : null}
                {c.variants.length > 0 ? <span>{c.variants.length} variants</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>Nenhum componente corresponde a "{q}".</p>
      )}
    </main>
  );
}
