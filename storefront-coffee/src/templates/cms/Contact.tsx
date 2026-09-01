// The contact template (CMS-1, yellow zone). CONTENT (the channels) is theme code — a store edits it here or
// forks the template. The CMS routes the page's slug to this template_key ('contact').

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import styles from './template.module.css';

export function Contact({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>Fale com a nossa equipe pelos canais abaixo:</p>
      <ul className={styles.contactList}>
        <li>E-mail: contato@loja.exemplo</li>
        <li>WhatsApp: (00) 00000-0000</li>
        <li>Atendimento: seg. a sex., das 9h às 18h</li>
      </ul>
    </article>
  );
}
