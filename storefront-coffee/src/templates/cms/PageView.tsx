// The CMS page view (structure, yellow zone): a help-center layout — a small LEFT sidebar with the institutional
// menu (the same links as the footer) + the page content on the right. The sidebar is HARDCODED (these pages are
// always the institutional set); the active page is marked. Resolves the page's template_key to a theme component
// (graceful: an unknown key renders the default template, never a 500). Stacks to one column on mobile.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import { resolvePageTemplate } from './registry';
import styles from './template.module.css';

/** The institutional menu — same links/slugs the footer publishes. Hardcoded (front doctrine: menu ≠ data). */
const NAV: { slug: string; label: string }[] = [
  { slug: 'trocas-e-devolucoes', label: 'Trocas e devoluções' },
  { slug: 'entrega', label: 'Prazos de entrega' },
  { slug: 'contato', label: 'Fale conosco' },
  { slug: 'faq', label: 'Perguntas frequentes' },
  { slug: 'sobre', label: 'Sobre' },
  { slug: 'privacidade', label: 'Privacidade' },
  { slug: 'termos', label: 'Termos' },
];

export function PageView({ page, base }: { page: PageDoc; base: StoreBase }) {
  const { template: Template } = resolvePageTemplate(page.template_key);
  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar} aria-label="Páginas institucionais">
        {NAV.map((n) => (
          <a
            key={n.slug}
            href={storeHref(base, `/${n.slug}`)}
            className={styles.navLink}
            aria-current={n.slug === page.slug ? 'page' : undefined}
          >
            {n.label}
          </a>
        ))}
      </nav>
      <main className={styles.page}>
        <Template page={page} />
      </main>
    </div>
  );
}
