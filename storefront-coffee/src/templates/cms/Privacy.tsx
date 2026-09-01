// The "Política de privacidade" template (CMS-1, yellow zone). CONTENT is theme code — a store edits it here or
// forks the template. The CMS routes the page's slug to this template_key ('privacy'). Demo copy — NOT legal
// advice; a real store replaces it with a policy reviewed for the LGPD.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import styles from './template.module.css';

export function Privacy({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>
        Respeitamos a sua privacidade. Esta política explica, de forma resumida, quais dados
        coletamos e como os usamos, em linha com a Lei Geral de Proteção de Dados (LGPD).
      </p>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Quais dados coletamos</p>
        <p>
          Dados que você fornece ao comprar (nome, contato, endereço de entrega) e dados de
          navegação necessários para o funcionamento da loja e para melhorar a sua experiência.
        </p>
      </div>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Como usamos</p>
        <p>
          Para processar pedidos, calcular frete, comunicar o andamento da entrega e oferecer
          atendimento. Não vendemos os seus dados.
        </p>
      </div>
      <div className={styles.faqItem}>
        <p className={styles.faqQuestion}>Seus direitos</p>
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelos
          nossos canais de atendimento.
        </p>
      </div>
      <p>
        Esta é uma loja de demonstração; o texto acima é ilustrativo e não constitui uma política
        jurídica.
      </p>
    </article>
  );
}
