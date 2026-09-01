// The default institutional template (CMS-1, yellow zone). CONTENT lives HERE, in the theme code — the CMS
// registers only the page card (title/meta); a deployer writes the body directly in this component (or forks
// a store-specific one). It is also the FALLBACK when a page's template_key is unknown (never a 500). The
// copy below is placeholder institutional text a store replaces in its own theme fork.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import styles from './template.module.css';

export function InstitutionalDefault({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>
        Esta é uma página institucional da loja. O conteúdo vive no código do tema (zona amarela do
        implantador); o CMS registra apenas a ficha da página (título, slug, meta e template).
      </p>
      <p>
        Para personalizar este texto, edite o template <code>institutional-default</code> do tema ou
        crie um template dedicado e aponte a ficha da página para ele.
      </p>
    </article>
  );
}
