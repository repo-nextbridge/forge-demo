// /ui-storefront/[slug] — a component's detail: its live example rendered in the real runtime (real tokens.css,
// real CSS Modules), plus its props table from the generated manifest. The example component comes from the
// GENERATED registry (slug → live component). noindex, like the index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findComponent } from '../catalog';
import { CATALOG_EXAMPLES } from '../generated/registry';
import styles from '../ui-storefront.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function UiStorefrontDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const component = findComponent(slug);
  const Example = CATALOG_EXAMPLES[slug];
  if (!component || !Example) notFound();

  return (
    <main className={styles.page}>
      <Link href="/ui-storefront" className={styles.backLink}>
        ← UI storefront
      </Link>
      <div>
        <h1 className={styles.title}>{component.name}</h1>
        <p className={styles.path}>{component.path}</p>
      </div>

      <div className={styles.stage}>
        <Example />
      </div>

      {component.props.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Props</h2>
          <table className={styles.propTable}>
            <thead>
              <tr>
                <th>name</th>
                <th>type</th>
                <th>optional</th>
              </tr>
            </thead>
            <tbody>
              {component.props.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.type}</td>
                  <td>{p.optional ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </main>
  );
}
