// The "Prazos e entrega" template (CMS-1, yellow zone). CONTENT is theme code — a store edits it here or forks
// the template. The CMS routes the page's slug to this template_key ('shipping'). Demo copy.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import styles from './template.module.css';

export function Shipping({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>
        Entregamos para todo o Brasil. O prazo e o valor do frete são calculados no checkout a
        partir do seu CEP e da transportadora escolhida, assim você sempre vê o custo real antes de
        fechar o pedido.
      </p>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Prazo de entrega</p>
        <p>
          O prazo começa a contar após a aprovação do pagamento e a separação do pedido. Você
          acompanha cada etapa (saída do centro de distribuição, trânsito e chegada) na página do
          pedido, com o código de rastreio.
        </p>
      </div>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Frete grátis</p>
        <p>
          Pedidos acima do valor indicado na loja têm frete grátis para as regiões elegíveis. A
          condição aparece no carrinho quando aplicável.
        </p>
      </div>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Acompanhamento</p>
        <p>
          Assim que o pedido é despachado, o código de rastreio fica disponível na sua conta, em
          Meus pedidos.
        </p>
      </div>
    </article>
  );
}
