// DEMO-GATE — the copy of the gate's TWO screens, embedded in the app in three languages (PT/EN/ES). Texts are
// NOT config (spec item 7): they ship with the app. `?lang=` on the URL wins (the marketing site links with the
// locale), else Accept-Language auto-detect, else PT; the footer selector switches live (all three are already
// here). The brand ("forge.demo"), "Storefront", "Checkout", "Admin", "Totem", "Kernel" and the surface names
// (API/CLI/MCP/SDK/Docs) stay verbatim across all three.
//
// ★ THE SELECTOR IS THE GATE'S LANGUAGE, NOT THE SHOPS'. A visitor from anywhere may pick a language here and
// still land in a PT-BR shop, and that is accepted rather than a gap: the reference storefront is PT-BR and
// stays PT-BR; what gets three languages is the EXPLANATION — which is why the architecture screen below is
// here and not a second mechanism.

export type Lang = 'pt' | 'en' | 'es';

export const LANGS: readonly Lang[] = ['pt', 'en', 'es'] as const;

/** The chosen-language cookie. The gate splash writes it when the visitor picks a language in the footer
 * selector; the storefront layout reads it so the choice PERSISTS across the gate, the "demo store" ribbon, and
 * a re-opened splash (instead of re-guessing from Accept-Language each time). Non-secret UI preference. */
export const GATE_LANG_COOKIE = 'forge_gate_lang';

export type GateStrings = {
  /* ★ pk35/d1 — THE PER-CARD COPY LEFT THIS TYPE WITH THE CARDS. `storefrontDesc`/`storefrontCta`/
   * `adminDesc`/`adminCta` described the two-card screen that PRECEDED the hub; the hub writes one blurb and
   * one button per DECLARED face, keyed by the box's own keys, and those live in `HUB` at the foot of this
   * file. What stays here is the chrome the hub sits inside. */
  eyebrow: string;
  title: string;
  intro: string;
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
    back: '← voltar para forgecommerce.pro',
    ribbon: 'Loja demo: tudo fictício, nada será cobrado ou entregue.',
  },
  en: {
    eyebrow: 'Demo environment',
    title: 'Demo store.',
    intro:
      'Everything here is fictional: products, prices, orders and customers. Nothing is charged, nothing is shipped. Click everything, break whatever you want. That is what it is for. And from time to time, everything is reset.',
    back: '← back to forgecommerce.pro',
    ribbon: 'Demo store: everything is fictional, nothing will be charged or shipped.',
  },
  es: {
    eyebrow: 'Entorno de demostración',
    title: 'Tienda demo.',
    intro:
      'Todo aquí es ficticio: productos, precios, pedidos y clientes. No se cobra nada, no se envía nada. Haz clic en todo, rompe lo que quieras, para eso existe. Y de vez en cuando, todo vuelve a su lugar.',
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

/* ── THE HUB: the copy of the six destinations ───────────────────────────────────────────────────────────
 *
 * The hub's layout: two tenant cards, each with its shops and, at its foot, the row that opens that
 * tenant's admin. Same mechanism as everything above — embedded copy, three languages, one selector.
 *
 * ⚠️ WHAT IS *NOT* HERE, AND THE RULE IS THE ONE `ARCH` ALREADY LIVES BY. No ADDRESS and no COUNT is written
 * in this file. Which faces exist, which tenant each belongs to and what hostname each is published at come
 * from `seed/box.json` through `faces.generated.ts`; the numbers in `counts` are handed in by the screen,
 * which derives them from that list. A translator editing this file cannot invent a shop, and a fifth shop
 * declared in the box makes `block/hub.test.tsx` red instead of making this screen quietly short.
 *
 * ⚠️ AND THE KEYS ARE THE BOX'S KEYS. `tenants` is keyed by tenant id and `faces` by `<tenant>/<handle>` —
 * the same strings the generated module carries — so copy written for a face that no longer exists, and a
 * face nobody wrote copy for, are both RED (`block/hub.test.tsx`), in both directions.
 */

/** The brand mark of one shop, as three pieces: the word, the dot (which takes the accent), the rest.
 *  Verbatim in every language — a wordmark is not translated — so it lives outside `HUB`. Keyed by face. */
export const HUB_MARKS: Record<string, readonly [string, string, string]> = {
  'forgeco/forge': ['forge', '.', 'store'],
  'forgeco/outlet': ['forge', '.', 'outlet'],
  'forgecafe/cafe': ['forge', '.', 'co'],
  'forgecafe/balcao': ['forge', '.', 'co balcão'],
};

export type HubTenantStrings = {
  /** The small uppercase word over the card ("Sapatos"). */
  eyebrow: string;
  /** The framed badge opposite it ("Tenant 1"). */
  badge: string;
  /** The card's own sentence ("Duas lojas, um único banco."). */
  headline: string;
  blurb: string;
};

export type HubFaceStrings = {
  /** The tag beside the wordmark ("Referência", "Totem"). */
  badge: string;
  blurb: string;
  /** The button ("Abrir a loja", "Abrir o totem"). */
  cta: string;
};

export type HubStrings = {
  /** The line under the intro, from numbers the screen DERIVES — never typed here. */
  counts: (tenants: number, shops: number, admins: number) => string;
  /** [before, the emphasised word, after] — the emphasised word is "kernel", in all three languages. */
  lede: readonly [string, string, string];
  /** The row at the foot of a tenant card. */
  adminRow: string;
  /** ⚠️ THE DOOR SHOWN WHEN THE HOST MATCHES NONE OF THE DECLARED FACES — a bench, a tailnet, a preview.
   *  It must NOT claim the visitor is on one of the six (they are not): it says what the button DOES, which
   *  is the one thing that is true in every case where it is drawn. */
  here: string;
  /** Said on a destination `seed/box.json` declares no address for. Never silence. */
  noAddress: string;
  /** The notice at the foot of the screen. */
  notice: string;
  tenants: Record<string, HubTenantStrings>;
  faces: Record<string, HubFaceStrings>;
};

export const HUB: Record<Lang, HubStrings> = {
  pt: {
    counts: (tenants, shops, admins) =>
      `${tenants} tenants. ${shops} lojas. ${admins} admins.`,
    lede: [
      'Cada tenant é uma conta isolada: banco, catálogo, pedidos e login próprios. Mas o mesmo ',
      'kernel',
      '.',
    ],
    adminRow: 'Admin do tenant',
    here: 'Continuar nesta janela',
    noAddress: 'sem endereço publicado',
    notice:
      'Tudo fictício: nada é cobrado, nada é enviado. Pode quebrar: o ambiente volta ao lugar de tempos em tempos.',
    tenants: {
      forgeco: {
        eyebrow: 'Sapatos',
        badge: 'Tenant 1',
        headline: 'Duas lojas, um único banco.',
        blurb: 'Mesmo catálogo, vitrines e temas independentes.',
      },
      forgecafe: {
        eyebrow: 'Café',
        badge: 'Tenant 2',
        headline: 'Outra conta, outra casca.',
        blurb: 'O mesmo kernel sem a nossa vitrine e, no limite, sem o nosso checkout.',
      },
    },
    faces: {
      'forgeco/forge': {
        badge: 'Referência',
        blurb: 'Uma loja completa, na vitrine que ninguém forkou.',
        cta: 'Abrir a loja',
      },
      'forgeco/outlet': {
        badge: 'Segunda loja',
        blurb: 'Multi-loja: o mesmo catálogo, tema e preços próprios.',
        cta: 'Abrir o outlet',
      },
      'forgecafe/cafe': {
        badge: 'Storefront forkado',
        blurb: 'Outro storefront mas o mesmo checkout, repositório e imagem próprios.',
        cta: 'Abrir a loja',
      },
      'forgecafe/balcao': {
        badge: 'Totem',
        blurb: 'Totem de balcão: aplicação exclusiva própria falando direto com a porta.',
        cta: 'Abrir o totem',
      },
    },
  },
  en: {
    counts: (tenants, shops, admins) =>
      `${tenants} tenants. ${shops} shops. ${admins} admins.`,
    lede: [
      'Each tenant is an isolated account: its own database, catalogue, orders and sign-in. But the same ',
      'kernel',
      '.',
    ],
    adminRow: "The tenant's admin",
    here: 'Carry on in this window',
    noAddress: 'no published address',
    notice:
      'All fictional: nothing is charged, nothing is shipped. Feel free to break it: the environment is reset from time to time.',
    tenants: {
      forgeco: {
        eyebrow: 'Shoes',
        badge: 'Tenant 1',
        headline: 'Two shops, one database.',
        blurb: 'The same catalogue, independent storefronts and themes.',
      },
      forgecafe: {
        eyebrow: 'Coffee',
        badge: 'Tenant 2',
        headline: 'Another account, another skin.',
        blurb: 'The same kernel without our storefront and, at the limit, without our checkout.',
      },
    },
    faces: {
      'forgeco/forge': {
        badge: 'Reference',
        blurb: 'A complete shop, on the storefront nobody forked.',
        cta: 'Open the store',
      },
      'forgeco/outlet': {
        badge: 'Second shop',
        blurb: 'Multi-store: the same catalogue, its own theme and its own prices.',
        cta: 'Open the outlet',
      },
      'forgecafe/cafe': {
        badge: 'Forked storefront',
        blurb: 'Another storefront but the same checkout, with a repository and an image of its own.',
        cta: 'Open the shop',
      },
      'forgecafe/balcao': {
        badge: 'Totem',
        blurb: 'The counter totem: an application of its own, talking straight to the port.',
        cta: 'Open the totem',
      },
    },
  },
  es: {
    counts: (tenants, shops, admins) =>
      `${tenants} tenants. ${shops} tiendas. ${admins} admins.`,
    lede: [
      'Cada tenant es una cuenta aislada: base de datos, catálogo, pedidos y acceso propios. Pero el mismo ',
      'kernel',
      '.',
    ],
    adminRow: 'Admin del tenant',
    here: 'Continuar en esta ventana',
    noAddress: 'sin dirección publicada',
    notice:
      'Todo es ficticio: no se cobra nada, no se envía nada. Puedes romperlo: el entorno vuelve a su lugar de vez en cuando.',
    tenants: {
      forgeco: {
        eyebrow: 'Zapatos',
        badge: 'Tenant 1',
        headline: 'Dos tiendas, una sola base.',
        blurb: 'El mismo catálogo, tiendas y temas independientes.',
      },
      forgecafe: {
        eyebrow: 'Café',
        badge: 'Tenant 2',
        headline: 'Otra cuenta, otra piel.',
        blurb: 'El mismo kernel sin nuestra tienda y, en el límite, sin nuestro checkout.',
      },
    },
    faces: {
      'forgeco/forge': {
        badge: 'Referencia',
        blurb: 'Una tienda completa, en la vitrina que nadie forkeó.',
        cta: 'Abrir la tienda',
      },
      'forgeco/outlet': {
        badge: 'Segunda tienda',
        blurb: 'Multi-tienda: el mismo catálogo, tema y precios propios.',
        cta: 'Abrir el outlet',
      },
      'forgecafe/cafe': {
        badge: 'Storefront forkeado',
        blurb: 'Otro storefront pero el mismo checkout, repositorio e imagen propios.',
        cta: 'Abrir la tienda',
      },
      'forgecafe/balcao': {
        badge: 'Totem',
        blurb: 'Totem de mostrador: una aplicación propia hablando directo con la puerta.',
        cta: 'Abrir el totem',
      },
    },
  },
};
