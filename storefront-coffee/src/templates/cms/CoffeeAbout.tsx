// ★★ THE CAFÉ'S OWN "Sobre" — the first template in this repository that exists because the registry grew a
// STORE AXIS (pk14/P6), and the first page of this shop whose words are the shop's.
//
// ── WHAT IT REPLACES, MEASURED ───────────────────────────────────────────────────────────────────────────
//
// `About.tsx` in this same directory — the copy this fork inherited and never changed — opens with *"Somos
// uma loja de calçados feita para quem valoriza conforto, durabilidade e um bom design"* and goes on about
// tênis, botas and o tamanho certo para o seu pé. That is the reference vitrine's shoe shop, served under
// the coffee shop's theme, on a page every other page of this shop links to from its footer. The body of an
// institutional page is not data anywhere (`content.page.create` takes a title and a `template_key` and has
// no column for prose), so the only place this could ever have been fixed is a component, and until the
// axis landed the only component available was one shared by every store of the image.
//
// ── ⛔ WHAT IS DELIBERATELY NOT IN THIS TEXT ─────────────────────────────────────────────────────────────
//
// The counter's ADDRESS and its hours. They are a `pickup_location` in the kernel (`seed/totem.json`), the
// order freezes them and the checkout prints them — so typing them here would make this file a SECOND author
// for a fact the port already owns, and the two would disagree the first time somebody moved. `Contact.tsx`
// documents the same refusal for the same reason. What is said about the counter is only that it exists.
//
// Every other claim below is one this box can be held to: six coffees with name, origin and producer
// (`seed/catalog.json`), five of them subscribable and the sixth a numbered lot that ends when it ends
// (`seed/coffee.mjs` — the curation is a mark on the SKU, not an `if` in this front), roasting in the week
// of dispatch, and a subscription with no lock-in. A "Sobre" that promised a fact the shop does not carry
// would be the same defect as the shoe copy, one draft later.

import type { PageDoc } from '@forgeco/storefront-kit/read-client';
import styles from './template.module.css';

export function CoffeeAbout({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>
        A Forge Café é uma torrefação pequena. Compramos lotes fechados de produtores que conseguimos
        nomear — Dona Cida, na Mantiqueira de Minas; o Sebastião e a Marlene, no alto do Caparaó; as
        famílias da Mogiana que colhem tarde de propósito — e torramos aqui, em quantidade que cabe na
        semana.
      </p>
      <p>
        São seis cafés no catálogo, e seis é um número escolhido. Cada um existe porque faz uma coisa que
        os outros não fazem: o do dia a dia, o microlote de torra clara, o que aguenta meio litro de leite,
        o descafeinado que continua sendo café. Na página de cada um estão a região, a fazenda, a variedade,
        o processo e a torra — não como enfeite, mas porque é o que muda a xícara.
      </p>
      <p>
        Torramos na semana em que o café é despachado. É por isso que não temos estoque grande e é por isso
        que a Edição do Produtor sai numerada: quando o lote da safra acaba, ele acaba, e o próximo é outro
        café com outro nome.
      </p>
      <p>
        Quem toma o mesmo café toda semana assina. Cinco dos seis entram na assinatura, na moagem do seu
        método, sem fidelidade — dá para pausar, trocar o café ou cancelar sem falar com ninguém. E quem
        estiver por perto toma no balcão, que é onde essa história começou.
      </p>
      <p>
        Esta é uma loja de demonstração da plataforma Forge: os cafés, os preços e os pedidos são
        fictícios, criados para mostrar a experiência completa de uma loja real.
      </p>
    </article>
  );
}
