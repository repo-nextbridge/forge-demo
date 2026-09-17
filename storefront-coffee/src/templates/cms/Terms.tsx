// The "Termos de uso" template (CMS-1, yellow zone). CONTENT is theme code — a store edits it here or forks the
// template. The CMS routes the page's slug to this template_key ('terms'). Demo copy — NOT legal advice.

import type { PageDoc } from '@forgeco/storefront-kit/read-client';
import styles from './template.module.css';

export function Terms({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>
        Ao usar esta loja, você concorda com os termos abaixo. Eles descrevem, de forma resumida, as
        regras de compra e uso do site.
      </p>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Pedidos e preços</p>
        <p>
          Os preços e as condições vigentes são os exibidos no momento da compra. Um pedido é
          confirmado após a aprovação do pagamento.
        </p>
      </div>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Uso do site</p>
        <p>
          O conteúdo da loja (textos, imagens e marcas) é de uso exclusivo da loja e de seus
          parceiros. É proibido reproduzir ou utilizar o conteúdo sem autorização.
        </p>
      </div>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Atendimento</p>
        <p>
          Dúvidas sobre pedidos, trocas ou entregas podem ser resolvidas pelos nossos canais de
          atendimento.
        </p>
      </div>
      <p>
        Esta é uma loja de demonstração; o texto acima é ilustrativo e não constitui um contrato
        jurídico.
      </p>
    </article>
  );
}
