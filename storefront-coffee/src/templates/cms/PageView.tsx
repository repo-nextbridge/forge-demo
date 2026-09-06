// The CMS page view (structure, yellow zone): a help-center layout — a small LEFT sidebar with the institutional
// menu (the same links as the footer) + the page content on the right. The sidebar is HARDCODED (these pages are
// always the institutional set); the active page is marked. Resolves the page's template_key to a theme component
// (graceful: an unknown key renders the default template, never a 500). Stacks to one column on mobile.
//
// ★★ THE RESOLUTION IS STORE-SCOPED, so `store` is a required prop. A `PageDoc` does not carry its store (the
// read is already store-scoped, so the row never repeats it), and the axis is a fact about the REQUEST this
// render is serving — the same reason `base` travels as a prop instead of being looked up. See `registry.ts`:
// this fork FILLS the overlay, so on this front the prop chooses between the café's words and the shared ones.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import { resolvePageTemplate, storeTemplateAxis } from './registry';
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

export function PageView({
  page,
  base,
  store,
}: {
  page: PageDoc;
  base: StoreBase;
  /** The store this page belongs to — the `/s/<store>` segment, i.e. the store ID the read port answered for.
   * It selects WHOSE version of `page.template_key` renders; a store with none declared gets the shared one. */
  store: string;
}) {
  const { template: Template } = resolvePageTemplate(page.template_key, storeTemplateAxis(store));
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
