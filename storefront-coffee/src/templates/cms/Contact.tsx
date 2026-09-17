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
// ⛔ AND THIS SHOP DOES NOT EXIST, SO ITS CHANNELS MUST NOT EITHER (pk21/D3 swapped them to `.example`).
// It shipped `ola@forge.co` and `(11) 3237-0188` — a REAL delegated TLD (`.co`, Colombia) and a
// plausible São Paulo landline. Both are reachable, both end up in screenshots, and this dataset has already
// put a real address on a screen once: a live personal one, in fifteen files. The e-mail is now under
// the RFC 2606 `.example` TLD, which can never be registered by anyone, and the number is in the
// `(11) 4000-xxxx` range this box keeps its fictional lines in.
//
// ★★ AND THEY ARE THE SAME TWO CHANNELS THE CAFÉ'S HOSTED FUNNEL SHOWS — `seed/chrome.json` →
// `cafe.account_footer` (`start_text` / `middle_text`). A shopper crosses from this page to the account
// screen in one click, and a template that invented its own number would be a SECOND author for a fact the
// dataset already states. `bin/fork-contact.guard.mjs` ties the two files together, because nothing else can:
// this is the only shopper-facing contact detail in the repository that is typed into a component.
//
// ⚠️ AND ONLY THE CHANNELS. The counter's ADDRESS is not repeated here on purpose — it lives in the kernel as
// a `pickup_location` (seed/totem.json), the order freezes it, and the checkout prints it. Typing it into a
// template would be a second author for a fact the port already owns, which is the mistake
// `CoffeeChrome.tsx` documents at length for the announcement bar's prices. An e-mail and a phone have no row
// anywhere in this tenant, so nothing here can contradict the kernel.

import type { PageDoc } from '@forgeco/storefront-kit/read-client';
import styles from './template.module.css';

export function Contact({ page }: { page: PageDoc }) {
  return (
    <article className={styles.prose}>
      <h1 className={styles.title}>{page.title}</h1>
      <p>Fale com a nossa equipe pelos canais abaixo:</p>
      <ul className={styles.contactList}>
        <li>E-mail: contato@cafe.example</li>
        <li>WhatsApp: (11) 4000-3000</li>
        <li>Atendimento: seg. a sex., das 9h às 18h</li>
      </ul>
    </article>
  );
}
