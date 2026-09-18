// DEMO-GATE — the copy of the gate's ONE screen, embedded in the app in three languages (PT/EN/ES). Texts are
// NOT config (spec item 7): they ship with the app. `?lang=` on the URL wins (the marketing site links with the
// locale), else Accept-Language auto-detect, else PT; the footer selector switches live (all three are already
// here). The brand ("forge.demo"), "Admin", "Tenant" and "Kernel" stay verbatim across all three.
//
// ★ THE SELECTOR IS THE GATE'S LANGUAGE, NOT THE SHOPS'. The reference storefront is PT-BR and stays PT-BR; a
// visitor from anywhere lands in a Portuguese shop and that is correct. What gets three languages is the
// EXPLANATION — the one screen this app draws.
//
// ⛔ v2 — THE ARCHITECTURE SCREEN IS GONE, AND ITS COPY WENT WITH IT. `ARCH` held an eyebrow, a title, a lede,
// six layer captions and a way back: a second screen that explained the architecture in prose while the first
// one demonstrated it. The v2 artboard has ONE screen that does both — four shops, two admins, and the
// connectors that tie them to a single kernel — so the explanation is the DIAGRAM now, and a block of
// translated prose describing what the diagram shows would be the same claim told twice.

export type Lang = 'pt' | 'en' | 'es';

export const LANGS: readonly Lang[] = ['pt', 'en', 'es'] as const;

/** The chosen-language cookie. The gate writes it when the visitor picks a language in the footer selector;
 * the storefront layout reads it so the choice PERSISTS across the gate, the "demo store" ribbon, and a
 * re-opened gate (instead of re-guessing from Accept-Language each time). Non-secret UI preference. */
export const GATE_LANG_COOKIE = 'forge_gate_lang';

export type GateStrings = {
  /** The way back to the marketing site, at the foot. */
  back: string;
  /** The persistent bottom ribbon shown while browsing the store (gate dismissed). Clicking it re-opens the gate. */
  ribbon: string;
};

export const STRINGS: Record<Lang, GateStrings> = {
  pt: {
    back: '← forgecommerce.pro',
    ribbon: 'Loja demo: tudo fictício, nada será cobrado ou entregue.',
  },
  en: {
    back: '← forgecommerce.pro',
    ribbon: 'Demo store: everything is fictional, nothing will be charged or shipped.',
  },
  es: {
    back: '← forgecommerce.pro',
    ribbon: 'Tienda demo: todo es ficticio, no se cobrará ni se enviará nada.',
  },
};

export function resolveLang(raw: string | undefined | null): Lang {
  const head = (raw ?? '').toLowerCase();
  if (head.startsWith('en')) return 'en';
  if (head.startsWith('es')) return 'es';
  return 'pt';
}

/* ── THE SCREEN'S COPY ──────────────────────────────────────────────────────────────────────────────────────
 *
 * ★★★ ON THIS SCREEN THE TRUTH IS THE DESIGN, WORD FOR WORD. Everywhere else in this house a figure typed
 * into a screen is a claim that goes stale on somebody else's box — but this is the public demo's own front
 * door: one box, one catalogue, one audience, and not an app a customer installs. Anyone who wants a
 * different first screen forks this app, which is how this repository says "different". So the source is
 * `design-base/gate-v2.dc.html`, and `block/gate.test.tsx` holds every sentence below against that file.
 *
 * ⚠️ AND THE KEYS ARE THE BOX'S KEYS. `tenants` is keyed by tenant id and `faces` by `<tenant>/<handle>` —
 * the same strings `faces.generated.ts` carries — so copy for a face that no longer exists, and a face
 * nobody wrote copy for, are both RED, in both directions.
 *
 * ⛔ WHAT v2 TOOK OUT OF EVERY CARD, named so nobody rebuilds half of it: the CTA button. The whole card is
 * the link now, so a button inside it was a second target for one destination. What each card gained instead
 * is a PLACE (`Tenant 1 · Loja I`) and a FOOT (`storefront vanilla`) — the two facts the old screen told in a
 * chip and a sentence.
 *
 * ⛔ AND THE HEADLINE STOPPED DECLARING ITS OWN LINES. It used to arrive as three strings, because a
 * character measure breaks the same sentence in a different place in each language. The v2 artboard sets it
 * at `clamp(24px,2.4vw,28px)` beside the wordmark with `text-wrap: balance` — the engine balances, in every
 * language, and a declared break would fight it. One string, plus the clause that carries the accent.
 */

/** The brand mark of one shop, as four pieces: the word, the dot (which takes the accent), the tail, and an
 *  optional ASIDE drawn in the neutral. Verbatim in every language — a wordmark is not translated.
 *
 *  ⚠️ THE ASIDE EXISTS FOR THE COUNTER. The artboard writes `forge.café balcão` with `café` in the brand's
 *  sand and `balcão` in `#6B6B6B`: the counter is a face OF the coffee shop, not a fifth brand, and the
 *  colour is what says so. Folding it into the tail would have drawn it as one wordmark. */
export const HUB_MARKS: Record<string, readonly [string, string, string, string?]> = {
  'forgeco/forge': ['forge', '.', 'store'],
  'forgeco/outlet': ['forge', '.', 'outlet'],
  'forgecafe/cafe': ['forge', '.', 'café'],
  'forgecafe/balcao': ['forge', '.', 'café', 'balcão'],
};

export type HubTenantStrings = {
  /** The chip under the bracket that gathers this tenant's shops ("Tenant 1 · Sapatos"). */
  chip: string;
  /** The title in the window's own bar ("Admin · Tenant 1"). */
  window: string;
  /** The one button on the screen ("Acessar o admin"). */
  enter: string;
};

export type HubFaceStrings = {
  /** The line under the wordmark, as the design writes it ("Loja completa · 44 399 SKUs"). */
  blurb: string;
  /** The small uppercase line over the art ("Tenant 1 · Loja I") — where this shop sits in the box. */
  place: string;
  /** The uppercase line at the card's foot ("storefront vanilla") — what this shop's front IS. */
  foot: string;
};

export type HubStrings = {
  /** The headline, as one string; the clause that carries the accent is `headlineAccent` and follows it. */
  headline: string;
  headlineAccent: string;
  /** The notice at the foot of the screen. */
  notice: string;
  /* ── THE TWO SENTENCES THE ARTBOARD HAS NO PLACE FOR, AND WHICH SURVIVE v2 ANYWAY ─────────────────────────
   *
   * The artboard was drawn for the DEPLOYED box: every face has an address and the visitor is standing on one
   * of them. Neither is guaranteed. Dropping these with the redesign would have removed an honesty the screen
   * owes rather than a decoration the design retired — so they are here, at the foot, where the diagram is
   * not. ⚠️ On the public demo NEITHER is ever drawn; they exist for the bench and for a half-declaration. */

  /** Shown when the host in the browser's bar matches no declared face (a bench, a tailnet). It names the
   *  host rather than claiming the visitor is somewhere the box knows. */
  hereNote: string;
  /** The door beside that sentence — it does not promise a shop, only that this window can go in. */
  hereCta: string;
  /** Drawn IN the card of a face the box declares and gives no address to. The card still exists: a
   *  destination nobody can address is a fact about this box the visitor has to be able to see. */
  noAddress: string;
  /** The chip at the bottom of the diagram — the thing all four shops share. */
  kernel: { name: string; blurb: string };
  tenants: Record<string, HubTenantStrings>;
  faces: Record<string, HubFaceStrings>;
};

export const HUB: Record<Lang, HubStrings> = {
  pt: {
    headline: 'Dois tenants. Quatro lojas. Dois admins.',
    headlineAccent: 'Mesmo kernel!',
    notice: 'Tudo fictício: nada é cobrado, nada é enviado.',
    hereNote: 'Esta janela está num endereço que esta demo não publica:',
    hereCta: 'entrar assim mesmo',
    noAddress: 'sem endereço nesta caixa',
    kernel: { name: 'Kernel', blurb: 'um só, para as quatro lojas' },
    tenants: {
      forgeco: { chip: 'Tenant 1 · Sapatos', window: 'Admin · Tenant 1', enter: 'Acessar o admin' },
      forgecafe: { chip: 'Tenant 2 · Café', window: 'Admin · Tenant 2', enter: 'Acessar o admin' },
    },
    faces: {
      'forgeco/forge': {
        blurb: 'Loja completa · 44 399 SKUs',
        place: 'Tenant 1 · Loja I',
        foot: 'storefront vanilla',
      },
      'forgeco/outlet': {
        blurb: 'Multi-loja · 55 produtos',
        place: 'Tenant 1 · Loja II',
        foot: 'tema outlet',
      },
      'forgecafe/cafe': {
        blurb: 'Forkado · mesmo checkout',
        place: 'Tenant 2 · Loja I',
        foot: 'storefront próprio',
      },
      'forgecafe/balcao': {
        blurb: 'Totem · aplicação exclusiva',
        place: 'Tenant 2 · Loja II',
        foot: 'sem storefront',
      },
    },
  },
  en: {
    headline: 'Two tenants. Four shops. Two admins.',
    headlineAccent: 'Same kernel!',
    notice: 'All fictional: nothing is charged, nothing is shipped.',
    hereNote: 'This window is at an address this demo does not publish:',
    hereCta: 'go in anyway',
    noAddress: 'no address on this box',
    kernel: { name: 'Kernel', blurb: 'one, for all four shops' },
    tenants: {
      forgeco: { chip: 'Tenant 1 · Shoes', window: 'Admin · Tenant 1', enter: 'Open the admin' },
      forgecafe: { chip: 'Tenant 2 · Coffee', window: 'Admin · Tenant 2', enter: 'Open the admin' },
    },
    faces: {
      'forgeco/forge': {
        blurb: 'Full shop · 44,399 SKUs',
        place: 'Tenant 1 · Shop I',
        foot: 'vanilla storefront',
      },
      'forgeco/outlet': {
        blurb: 'Multi-shop · 55 products',
        place: 'Tenant 1 · Shop II',
        foot: 'outlet theme',
      },
      'forgecafe/cafe': {
        blurb: 'Forked · same checkout',
        place: 'Tenant 2 · Shop I',
        foot: 'own storefront',
      },
      'forgecafe/balcao': {
        blurb: 'Counter · a front of its own',
        place: 'Tenant 2 · Shop II',
        foot: 'no storefront',
      },
    },
  },
  es: {
    headline: 'Dos tenants. Cuatro tiendas. Dos admins.',
    headlineAccent: '¡El mismo kernel!',
    notice: 'Todo ficticio: no se cobra nada, no se envía nada.',
    hereNote: 'Esta ventana está en una dirección que esta demo no publica:',
    hereCta: 'entrar igualmente',
    noAddress: 'sin dirección en esta caja',
    kernel: { name: 'Kernel', blurb: 'uno solo, para las cuatro tiendas' },
    tenants: {
      forgeco: { chip: 'Tenant 1 · Zapatos', window: 'Admin · Tenant 1', enter: 'Entrar al admin' },
      forgecafe: { chip: 'Tenant 2 · Café', window: 'Admin · Tenant 2', enter: 'Entrar al admin' },
    },
    faces: {
      'forgeco/forge': {
        blurb: 'Tienda completa · 44 399 SKUs',
        place: 'Tenant 1 · Tienda I',
        foot: 'storefront vanilla',
      },
      'forgeco/outlet': {
        blurb: 'Multitienda · 55 productos',
        place: 'Tenant 1 · Tienda II',
        foot: 'tema outlet',
      },
      'forgecafe/cafe': {
        blurb: 'Bifurcado · mismo checkout',
        place: 'Tenant 2 · Tienda I',
        foot: 'storefront propio',
      },
      'forgecafe/balcao': {
        blurb: 'Tótem · aplicación exclusiva',
        place: 'Tenant 2 · Tienda II',
        foot: 'sin storefront',
      },
    },
  },
};
