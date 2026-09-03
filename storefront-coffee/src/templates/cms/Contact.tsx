// The contact template (CMS-1, yellow zone). CONTENT (the channels) is theme code — a store edits it here or
// forks the template. The CMS routes the page's slug to this template_key ('contact').
//
// ⛔ p1-4 — IT SHIPPED WITH `contato@loja.exemplo` AND `(00) 00000-0000`, AND THAT IS THE REFERENCE
// STOREFRONT BEING HONEST ABOUT WHAT IT CANNOT KNOW. Nothing in the port carries a shop's e-mail or its
// WhatsApp: `content.page.create` takes a title and a `template_key` and no body (seed/vitrine.mjs says so),
// so every word on the seven institutional pages comes from a template like this one. Six of them are true of
// any shop ("como trocar", "como entregamos") and can be written once upstream; the channels are the one page
// whose content is a FACT ABOUT ONE SHOP, and a reference that invented a number would be worse than one that
// visibly does not have it.
//
// ★ THIS IS A FORK, SO HERE THE ANSWER IS DIFFERENT: this file is the coffee shop's own copy, and its own
// voice is exactly what a fork is for. The channels below are this shop's.
//
// ⚠️ AND ONLY THE CHANNELS. The counter's ADDRESS is not repeated here on purpose — it lives in the kernel as
// a `pickup_location` (seed/totem.json), the order freezes it, and the checkout prints it. Typing it into a
// template would be a second author for a fact the port already owns, which is the mistake
// `CoffeeChrome.tsx` documents at length for the announcement bar's prices. An e-mail and a phone have no row
// anywhere in this tenant, so nothing here can contradict the kernel.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import styles from './template.module.css';

export function Contact({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>Fale com a nossa equipe pelos canais abaixo:</p>
      <ul className={styles.contactList}>
        <li>E-mail: ola@forge.co</li>
        <li>WhatsApp: (11) 3237-0188</li>
        <li>Atendimento: seg. a sex., das 9h às 18h</li>
      </ul>
    </article>
  );
}
