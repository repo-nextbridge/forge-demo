// DEMO-GATE — the copy of the gate's TWO screens, embedded in the app in three languages (PT/EN/ES). Texts are
// NOT config (spec item 7): they ship with the app. `?lang=` on the URL wins (the marketing site links with the
// locale), else Accept-Language auto-detect, else PT; the footer selector switches live (all three are already
// here). The brand ("forge.demo"), "Storefront", "Checkout", "Admin", "Totem", "Kernel" and the surface names
// (API/CLI/MCP/SDK/Docs) stay verbatim across all three.
//
// ★ THE SELECTOR IS THE GATE'S LANGUAGE, NOT THE SHOPS'. The owner, 10/09: *"esse seletor é do idioma do DEMO
// GATE e não dos sites… pode entrar um gringo para ver e ele vai cair em uma loja em pt, tudo bem, mas a
// explicação no demo gate tem 3 idiomas."* The reference storefront is PT-BR and stays PT-BR; what gets three
// languages is the EXPLANATION — which is why the architecture screen below is here and not a second mechanism.

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

/* ── THE SECOND SCREEN: "A arquitetura da demo" ──────────────────────────────────────────────────────────────
 *
 * The gate's first screen says WHAT to open; this one says WHY that is hard, for a visitor who has never heard
 * the word multi-tenant. It is the same mechanism as everything above — embedded copy, the three languages, the
 * one selector — and deliberately NOT config: a second screen of explanation is the app's, exactly like the
 * first (`manifest.ts` keeps `config_schema: []` for the same reason).
 *
 * ⚠️ WHAT IS *NOT* HERE. The facts this screen states about the box — two tenants, two shops each, which
 * storefront is forked, which theme each shop wears — are STRUCTURE, not words; they live in `block/arch.tsx`
 * and are checked against `seed/box.json` by `block/arch.test.tsx`. A translator editing this file cannot
 * accidentally claim a third shop, and a third shop in the box makes that test red instead of making this
 * screen quietly wrong.
 */

export type ArchStrings = {
  /** The affordance at the foot of the first screen that opens this one. */
  open: string;
  title: string;
  /** [before, the emphasised word, after] — the one word in bold is "kernel", in all three languages. */
  lede: readonly [string, string, string];
  /** The affordance at the foot of THIS screen that goes back. */
  back: string;
  tenantShoes: string;
  tenantCafe: string;
  shopOne: string;
  shopTwo: string;
  storefront: string;
  checkout: string;
  theme: string;
  totem: string;
  vanilla: string;
  forked: string;
  themeOutlet: string;
  themeCafe: string;
  totemNote: string;
  noStorefront: string;
  noCheckout: string;
  oneAdmin: string;
  port: string;
  kernel: string;
  kernelParts: string;
  infra: string;
  infraParts: string;
};

export const ARCH: Record<Lang, ArchStrings> = {
  pt: {
    open: 'Entenda a arquitetura',
    title: 'A arquitetura da demo',
    lede: ['Quatro vitrines diferentes, dois admins da mesma imagem, um ', 'kernel', '!'],
    back: 'Voltar para as demos',
    tenantShoes: 'Tenant 1 · Sapatos',
    tenantCafe: 'Tenant 2 · Café',
    shopOne: 'Loja 1',
    shopTwo: 'Loja 2',
    storefront: 'Storefront',
    checkout: 'Checkout',
    theme: 'Tema',
    totem: 'Totem',
    vanilla: 'vanilla',
    forked: 'forkado',
    themeOutlet: 'outlet',
    themeCafe: 'café',
    totemNote: '(aplicação exclusiva)',
    noStorefront: 'Sem storefront',
    noCheckout: 'Sem checkout',
    oneAdmin: 'Um admin para as duas lojas',
    port: 'Porta única de comandos',
    kernel: 'Kernel',
    kernelParts: 'catálogo · carrinho · checkout · pedido · pagamento · estoque',
    infra: 'Infra',
    infraParts: 'docker · gcp · opentelemetry',
  },
  en: {
    open: 'Understand the architecture',
    title: "The demo's architecture",
    lede: ['Four different storefronts, two admins from the same image, one ', 'kernel', '!'],
    back: 'Back to the demos',
    tenantShoes: 'Tenant 1 · Shoes',
    tenantCafe: 'Tenant 2 · Coffee',
    shopOne: 'Shop 1',
    shopTwo: 'Shop 2',
    storefront: 'Storefront',
    checkout: 'Checkout',
    theme: 'Theme',
    totem: 'Totem',
    vanilla: 'vanilla',
    forked: 'forked',
    themeOutlet: 'outlet',
    themeCafe: 'coffee',
    totemNote: '(an application of its own)',
    noStorefront: 'No storefront',
    noCheckout: 'No checkout',
    oneAdmin: 'One admin for both shops',
    port: 'One command port',
    kernel: 'Kernel',
    kernelParts: 'catalog · cart · checkout · order · payment · stock',
    infra: 'Infra',
    infraParts: 'docker · gcp · opentelemetry',
  },
  es: {
    open: 'Entiende la arquitectura',
    title: 'La arquitectura de la demo',
    lede: ['¡Cuatro tiendas diferentes, dos admins de la misma imagen, un ', 'kernel', '!'],
    back: 'Volver a las demos',
    tenantShoes: 'Tenant 1 · Zapatos',
    tenantCafe: 'Tenant 2 · Café',
    shopOne: 'Tienda 1',
    shopTwo: 'Tienda 2',
    storefront: 'Storefront',
    checkout: 'Checkout',
    theme: 'Tema',
    totem: 'Totem',
    vanilla: 'vanilla',
    forked: 'forkeado',
    themeOutlet: 'outlet',
    themeCafe: 'café',
    totemNote: '(aplicación exclusiva)',
    noStorefront: 'Sin storefront',
    noCheckout: 'Sin checkout',
    oneAdmin: 'Un admin para las dos tiendas',
    port: 'Puerta única de comandos',
    kernel: 'Kernel',
    kernelParts: 'catálogo · carrito · checkout · pedido · pago · stock',
    infra: 'Infra',
    infraParts: 'docker · gcp · opentelemetry',
  },
};
