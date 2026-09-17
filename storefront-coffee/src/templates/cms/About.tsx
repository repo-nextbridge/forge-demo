// The "Sobre" template (CMS-1, yellow zone). CONTENT is theme code — a store edits it here or forks the
// template. The CMS routes the page's slug to this template_key ('about'). Demo copy for the reference store.

import type { PageDoc } from '@forgeco/storefront-kit/read-client';
import styles from './template.module.css';

export function About({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>
        Somos uma loja de calçados feita para quem valoriza conforto, durabilidade e um bom design.
        Reunimos tênis, botas, sandálias, sapatos e acessórios de marcas selecionadas, com curadoria
        pensada para o dia a dia de quem vive em movimento.
      </p>
      <p>
        Cada modelo é escolhido pela qualidade do material e pelo caimento, do treino de rua ao
        escritório, da trilha ao fim de semana. Aqui você encontra a ficha técnica clara de cada
        produto, fotos por cor e o tamanho certo para o seu pé.
      </p>
      <p>
        Esta é uma loja de demonstração da plataforma Forge: os produtos, preços e pedidos são
        fictícios, criados para mostrar a experiência completa de uma loja real.
      </p>
    </article>
  );
}
