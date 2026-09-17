// The FAQ template (CMS-1, yellow zone). CONTENT (the questions/answers) is theme code — a store edits this
// list directly or forks the template. The CMS only routes the page's slug to this template_key ('faq').

import type { PageDoc } from '@forgeco/storefront-kit/read-client';
import styles from './template.module.css';

// Placeholder Q&A a store replaces in its theme. Kept in code by design (CMS-lite is a registry, not an editor).
const ITEMS: { q: string; a: string }[] = [
  {
    q: 'Qual o prazo de entrega?',
    a: 'O prazo é calculado no checkout a partir do CEP e da transportadora escolhida.',
  },
  {
    q: 'Como faço para trocar um produto?',
    a: 'Entre em contato pelos nossos canais de atendimento em até 7 dias após o recebimento.',
  },
  {
    q: 'Quais formas de pagamento vocês aceitam?',
    a: 'As formas disponíveis aparecem no checkout, conforme os meios habilitados para a loja.',
  },
];

export function Faq({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      {ITEMS.map((item) => (
        <div key={item.q} className={styles.faqItem}>
          <p className={styles.faqQuestion}>{item.q}</p>
          <p>{item.a}</p>
        </div>
      ))}
    </article>
  );
}
