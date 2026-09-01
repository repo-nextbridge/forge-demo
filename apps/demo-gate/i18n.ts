// DEMO-GATE — the gate screen copy, embedded in the app in three languages (PT/EN/ES). Texts are NOT config
// (spec item 7): they ship with the app. `?lang=` on the URL wins (the marketing site links with the locale),
// else Accept-Language auto-detect, else PT; the footer selector switches live (all three are already here).
// The brand ("forge.demo"), "Storefront" and "Admin" stay verbatim across all three.

export type Lang = 'pt' | 'en' | 'es';

export const LANGS: readonly Lang[] = ['pt', 'en', 'es'] as const;

/** The chosen-language cookie. The gate splash writes it when the visitor picks a language in the footer
 * selector; the storefront layout reads it so the choice PERSISTS across the gate, the "demo store" ribbon, and
 * a re-opened splash (instead of re-guessing from Accept-Language each time). Non-secret UI preference. */
export const GATE_LANG_COOKIE = 'forge_gate_lang';

export type GateStrings = {
  eyebrow: string;
  title: string;
  intro: string;
  storefrontDesc: string;
  storefrontCta: string;
  adminDesc: string;
  adminCta: string;
  back: string;
  /** The persistent bottom ribbon shown while browsing the store (gate dismissed). Clicking it re-opens the gate. */
  ribbon: string;
};

export const STRINGS: Record<Lang, GateStrings> = {
  pt: {
    eyebrow: 'Ambiente de demonstração',
    title: 'Loja demo.',
    intro:
      'Tudo aqui é fictício: produtos, preços, pedidos e clientes. Nada é cobrado, nada é enviado. Clique em tudo, quebre o que quiser, é para isso que ela existe. E de tempos em tempos, tudo volta ao lugar.',
    storefrontDesc: 'A loja pelos olhos do cliente.',
    storefrontCta: 'Abrir a loja',
    adminDesc: 'O painel de quem opera.',
    adminCta: 'Abrir o admin',
    back: '← voltar para forgecommerce.pro',
    ribbon: 'Loja demo: tudo fictício, nada será cobrado ou entregue.',
  },
  en: {
    eyebrow: 'Demo environment',
    title: 'Demo store.',
    intro:
      'Everything here is fictional: products, prices, orders and customers. Nothing is charged, nothing is shipped. Click everything, break whatever you want. That is what it is for. And from time to time, everything is reset.',
    storefrontDesc: "The store through the customer's eyes.",
    storefrontCta: 'Open the store',
    adminDesc: 'The panel for those who operate.',
    adminCta: 'Open the admin',
    back: '← back to forgecommerce.pro',
    ribbon: 'Demo store: everything is fictional, nothing will be charged or shipped.',
  },
  es: {
    eyebrow: 'Entorno de demostración',
    title: 'Tienda demo.',
    intro:
      'Todo aquí es ficticio: productos, precios, pedidos y clientes. No se cobra nada, no se envía nada. Haz clic en todo, rompe lo que quieras, para eso existe. Y de vez en cuando, todo vuelve a su lugar.',
    storefrontDesc: 'La tienda con los ojos del cliente.',
    storefrontCta: 'Abrir la tienda',
    adminDesc: 'El panel de quien opera.',
    adminCta: 'Abrir el admin',
    back: '← volver a forgecommerce.pro',
    ribbon: 'Tienda demo: todo es ficticio, no se cobrará ni se enviará nada.',
  },
};

/** Resolve an arbitrary string (Accept-Language token or `?lang=`) to a supported Lang, defaulting to PT. */
export function resolveLang(raw: string | null | undefined): Lang {
  const s = (raw ?? '').slice(0, 2).toLowerCase();
  return s === 'en' || s === 'es' ? s : 'pt';
}
