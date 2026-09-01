// The "Trocas e devoluções" template (CMS-1, yellow zone). CONTENT is theme code — a store edits it here or
// forks the template. The CMS routes the page's slug to this template_key ('returns'). Demo copy.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import styles from './template.module.css';

export function Returns({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>
        Se algo não saiu como esperado, a troca ou devolução é simples. Você tem até 7 dias corridos
        após o recebimento para solicitar, conforme o Código de Defesa do Consumidor.
      </p>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Como solicitar</p>
        <p>
          Entre em contato pelos nossos canais de atendimento informando o número do pedido. Nossa
          equipe orienta o passo a passo e envia o código de postagem quando aplicável.
        </p>
      </div>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Condições</p>
        <p>
          O produto deve estar sem sinais de uso, com a embalagem original e todos os acessórios.
          Após recebermos e conferirmos o item, o reembolso ou a troca é processado.
        </p>
      </div>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Prazos de reembolso</p>
        <p>
          O reembolso é feito pelo mesmo meio de pagamento do pedido. O prazo depende da operadora
          do cartão ou do banco, contado a partir da aprovação da devolução.
        </p>
      </div>
    </article>
  );
}
