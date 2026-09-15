// DEMO-GATE — the copy of the gate's TWO screens, embedded in the app in three languages (PT/EN/ES). Texts are
// NOT config (spec item 7): they ship with the app. `?lang=` on the URL wins (the marketing site links with the
// locale), else Accept-Language auto-detect, else PT; the footer selector switches live (all three are already
// here). The brand ("forge.demo"), "Storefront", "Checkout", "Admin", "Totem", "Kernel" and the surface names
// (API/CLI/MCP/SDK/Docs) stay verbatim across all three.
//
// ★ THE SELECTOR IS THE GATE'S LANGUAGE, NOT THE SHOPS'. The reference storefront is PT-BR and stays PT-BR; a
// visitor from anywhere lands in a Portuguese shop and that is correct. What gets three languages is the
// EXPLANATION — which is why the architecture screen below is here and not a second mechanism.

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
   * file.
   *
   * ★★★ pk38/d7 — AND `eyebrow`/`title`/`intro` LEFT WITH THE SCREEN THEY BELONGED TO. They were the framed
   * hero — a small uppercase line, a large "Loja demo." and a paragraph of prose — that the 10/09 layout
   * REPLACES with the hub. The port that brought the hub in mounted it UNDER that hero instead of in its
   * place, so the first screen said the same thing twice and neither in the design's shape. What the visitor
   * is told now is the design's own headline (`HUB.headline`) plus the notice at the foot; what stays in
   * this type is the chrome around the hub that the design does keep. */
  back: string;
  /** The persistent bottom ribbon shown while browsing the store (gate dismissed). Clicking it re-opens the gate. */
  ribbon: string;
};

export const STRINGS: Record<Lang, GateStrings> = {
  pt: {
    back: '← voltar para forgecommerce.pro',
    ribbon: 'Loja demo: tudo fictício, nada será cobrado ou entregue.',
  },
  en: {
    back: '← back to forgecommerce.pro',
    ribbon: 'Demo store: everything is fictional, nothing will be charged or shipped.',
  },
  es: {
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
 * The 10/09 layout (`block/design-base/gate.dc.html`): two tenant cards, each with its shops and, at its
 * foot, the row that opens that tenant's admin. Same mechanism as everything above — embedded copy, three languages, one selector.
 *
 * ⚠️ WHAT IS *NOT* HERE. No ADDRESS is written in this file, and that rule is the one `ARCH` already lives
 * by: which faces exist, which tenant each belongs to and what hostname each is published at come from
 * `seed/box.json` through `faces.generated.ts`. A translator editing this file cannot invent a shop, and a
 * fifth shop declared in the box makes `block/hub.test.tsx` red instead of making this screen quietly short.
 *
 * ── ⛔ WHAT THE SECOND PASS OVER THIS SCREEN TOOK AWAY, AND IT IS NOT A REGRESSION ────────────────────────
 *
 * The layout was drawn first and read afterwards, and read slowly: too much ink for a door. Three things
 * went, each named where it used to be declared so nobody rebuilds half of one — the masthead's `lede`
 * ("Cada tenant é uma conta isolada… Mas o mesmo kernel."), whose job the headline now does in four words;
 * the four shop CHIPS (`HubFaceStrings`); and the ORANGE OUTLINE of the tenant chip (`block/hub.module.css`).
 * What replaced the lede is the headline's fourth clause, `headlineAccent` — the same claim, on the same
 * line of sight, in the accent. The artboard was redrawn in the same slice: the design is still the truth
 * this file is graded against, and a change that moved only one of the two would have made that a lie.
 *
 * ── ★★★ THE NUMBERS, ON THE OTHER HAND, ARE TYPED — AND THAT IS THE DECISION, NOT AN OVERSIGHT ───────────
 *
 * "Derive, never list" exists to protect what a CUSTOMER is handed: an instance whose catalogue nobody here
 * controls, where a figure typed into a screen is a claim that goes stale on somebody else's box. THIS
 * SCREEN IS NOT THAT. It is the public demo's own front door — one box, one catalogue, one audience — and it
 * is not an app a customer installs or configures; anyone who wants a different first screen forks this app,
 * which is the whole way this repository says "different". ⇒ here the truth is the DESIGN
 * (`design-base/gate.dc.html`), word for word, and `block/hub.test.tsx` holds every sentence below against
 * that file, so the screen and the artboard cannot drift apart in silence.
 *
 * ★ AND TYPING IT IS WHAT GIVES THE SENTENCE ITS SECOND HALF BACK. The design writes "2 777 produtos →
 * 44 399 SKUs"; a screen deriving that number from the public read face could answer the first half and had
 * to DROP the second, because no capability on that face returns a SKU total and summing variants means
 * walking the whole catalogue on the first screen a visitor meets. Typed, the line is the design's again.
 *
 * ⛔ WHAT WENT WITH IT, NAMED SO NOBODY REBUILDS HALF OF IT: the `store.by_host` + `product_paths` reads,
 * their 1 500 ms ceiling, the 300 s cache window, the per-face failure case and the second "no number"
 * sentence each shop card carried for it. There is no reader left, and a `blurb` is a
 * string again rather than a function of a number that may not arrive.
 *
 * ⚠️ THE ONE THING ON THIS SCREEN THAT IS STILL DYNAMIC IS THE ADMIN ORIGIN (`FORGE_GATE_ADMIN_URLS`,
 * `wiring.ts`) — an address this box is promoted to, which no design can know.
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
  /** The chip opposite it ("Tenant 1") — a solid light ground, not an outline. */
  badge: string;
  /** The card's own sentence ("Duas lojas, um único banco."). */
  headline: string;
  blurb: string;
};

export type HubFaceStrings = {
  /* ⛔ THE TAG BESIDE THE WORDMARK IS GONE — "Referência", "Segunda loja", "Storefront forkado", "Totem".
   * Four shop cards, each already carrying a wordmark, a sentence and a button, plus a chip repeating in two
   * words what the sentence says in full: the screen was too crowded to read at a glance, and the chip is the
   * piece that carried the least. It went from the artboard and from here in the same slice, so nothing is
   * left half-said. ⚠️ AND THE COLOUR WENT WITH IT: the magenta `SEGUNDA LOJA` was a fidelity rule of its
   * own (`block/hub.module.css`), and a badge that does not exist has no colour to be faithful to. */
  /**
   * ★★★ THE SENTENCE UNDER THE WORDMARK, AND IT CARRIES THE SHOP'S SIZE AS THE DESIGN WRITES IT — "Uma loja
   * completa com 2 777 produtos → 44 399 SKUs.", not a figure this process went and asked for. See the head
   * of this section for why a typed number is right on THIS screen and wrong on a customer's.
   */
  blurb: string;
  /** The button ("Abrir a loja", "Abrir o totem"). */
  cta: string;
};

export type HubStrings = {
  /**
   * The headline of the screen, as the design writes it: "Dois tenants. Quatro lojas. Dois admins. Mesmo
   * kernel!" — FOUR clauses on THREE lines, the fourth riding the third in the accent (`headlineAccent`).
   *
   * ★ THE LINES ARE DECLARED, NOT MEASURED, and that is the type rather than a rendering detail. A
   * character measure breaks the same sentence in a different place in each of the three languages, and in
   * a different place again the day a clause is added — which is what adding the fourth one did. Declaring
   * the lines is what makes the shape the screen's own, identically in PT, EN and ES.
   */
  headline: readonly [string, string, string];
  /** The fourth clause, drawn in the accent at the end of the LAST line — "Mesmo kernel!". */
  headlineAccent: string;
  /** The row at the foot of a tenant card. */
  adminRow: string;
  /**
   * ⚠️ THE FOOT LINE SHOWN WHEN THE HOST MATCHES NONE OF THE DECLARED FACES — a bench, a tailnet, a preview.
   *
   * ⛔ IT IS NOT A SEVENTH CHOICE. The cards ARE the choice, and on a published face the card the visitor is
   * standing on is already the way in — which is why the old "carry on in this window" button is gone. What
   * is left is the CONDITION said out loud: this window is on an address the box does not publish, so none of
   * the cards above is "here". `hereCta` is the door beside that sentence, and it must not claim the visitor
   * is on one of the six.
   */
  hereNote: string;
  hereCta: string;
  /** Said on a destination `seed/box.json` declares no address for. Never silence. */
  noAddress: string;
  /** The notice at the foot of the screen. */
  notice: string;
  tenants: Record<string, HubTenantStrings>;
  faces: Record<string, HubFaceStrings>;
};

export const HUB: Record<Lang, HubStrings> = {
  pt: {
    headline: ['Dois tenants.', 'Quatro lojas.', 'Dois admins.'],
    headlineAccent: 'Mesmo kernel!',
    adminRow: 'Admin do tenant',
    hereNote: 'Esta janela está num endereço que esta demo não publica:',
    hereCta: 'entrar assim mesmo',
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
        blurb: 'O mesmo kernel sem a nossa vitrine e, no totem, sem o nosso checkout.',
      },
    },
    faces: {
      'forgeco/forge': {
        blurb: 'Uma loja completa com 2 777 produtos → 44 399 SKUs.',
        cta: 'Abrir a loja',
      },
      'forgeco/outlet': {
        blurb: 'Multi-loja: 55 produtos do mesmo catálogo, tema e preços próprios.',
        cta: 'Abrir o outlet',
      },
      'forgecafe/cafe': {
        blurb: 'Outro storefront mas o mesmo checkout, repositório e imagem próprios.',
        cta: 'Abrir a loja',
      },
      'forgecafe/balcao': {
        blurb: 'Totem de balcão: aplicação exclusiva própria falando direto com a porta.',
        cta: 'Abrir o totem',
      },
    },
  },
  en: {
    headline: ['Two tenants.', 'Four shops.', 'Two admins.'],
    headlineAccent: 'Same kernel!',
    adminRow: "The tenant's admin",
    hereNote: 'This window is on an address this demo does not publish:',
    hereCta: 'go in anyway',
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
        blurb: 'The same kernel without our storefront and, on the totem, without our checkout.',
      },
    },
    faces: {
      'forgeco/forge': {
        blurb: 'A complete shop with 2,777 products → 44,399 SKUs.',
        cta: 'Open the store',
      },
      'forgeco/outlet': {
        blurb: 'Multi-store: 55 products of the same catalogue, its own theme and its own prices.',
        cta: 'Open the outlet',
      },
      'forgecafe/cafe': {
        blurb:
          'Another storefront but the same checkout, with a repository and an image of its own.',
        cta: 'Open the shop',
      },
      'forgecafe/balcao': {
        blurb: 'The counter totem: an application of its own, talking straight to the port.',
        cta: 'Open the totem',
      },
    },
  },
  es: {
    headline: ['Dos tenants.', 'Cuatro tiendas.', 'Dos admins.'],
    headlineAccent: '¡Mismo kernel!',
    adminRow: 'Admin del tenant',
    hereNote: 'Esta ventana está en una dirección que esta demo no publica:',
    hereCta: 'entrar de todos modos',
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
        blurb: 'El mismo kernel sin nuestra tienda y, en el totem, sin nuestro checkout.',
      },
    },
    faces: {
      'forgeco/forge': {
        blurb: 'Una tienda completa con 2.777 productos → 44.399 SKUs.',
        cta: 'Abrir la tienda',
      },
      'forgeco/outlet': {
        blurb: 'Multi-tienda: 55 productos del mismo catálogo, tema y precios propios.',
        cta: 'Abrir el outlet',
      },
      'forgecafe/cafe': {
        blurb: 'Otro storefront pero el mismo checkout, repositorio e imagen propios.',
        cta: 'Abrir la tienda',
      },
      'forgecafe/balcao': {
        blurb: 'Totem de mostrador: una aplicación propia hablando directo con la puerta.',
        cta: 'Abrir el totem',
      },
    },
  },
};
