// The CMS template registry — maps a page's `template_key` to the theme component that renders it. This is
// the CMS analogue of the kernel command registry: adding a template is registering it here once. It is the
// ONE place the theme dispatches a template by a runtime string key (the catalog templates are statically
// imported by their routes; a CMS page's template is data-driven, so it needs this lookup).
//
// Unknown key policy (DoD): fall back to the default template + a dev warning, NEVER a 500. A page whose
// template_key does not resolve still renders (institutionally), so a bad/renamed key degrades gracefully.
//
// ── ★★ THE REGISTRY HAS A STORE AXIS (pk14/P6 upstream), AND THIS FORK IS THE ONE THAT FILLS IT ───────────
//
// The BODY of an institutional page is not data anywhere. `content.page.create` takes
// `store_id, slug, title, template_key, meta_title, meta_description, published` and has no column for prose
// — a declared product decision. The prose is a React component in THIS image, chosen by `template_key`, so
// until the axis landed the choice was tenant-wide: one flat map, and two stores of the same tenant asking
// for `about` got the SAME paragraphs. This shop was living that: `About.tsx` below is the reference
// vitrine's SHOE SHOP copy, served under the coffee theme.
//
// The registry therefore gained the axis the store already has: a per-store OVERLAY consulted first, the
// shared map second, the default template last. `template_key` keeps meaning what it meant — the page still
// names the template it wants — and the store now answers WHOSE version of that template it gets.
//
// ★ THE FALLBACK IS THE FEATURE, NOT A SAFETY NET. A store that declares no overlay resolves exactly what it
// resolved before, which is what makes giving ONE store its own `about` safe for the others. This tenant has
// two stores (`cafe` and `balcao`), so that is not a hypothetical here.
//
// ── ★★ AND UPSTREAM SHIPS THIS MAP EMPTY, WHILE THIS FILE FILLS IT. THE DIFFERENCE IS OWNERSHIP ───────────
//
// The reference vitrine is refused an entry on purpose: a store id is one instance's own fact, so an entry
// there would be one customer's data soldered into every instance's image (régua #5). This front is a FORK
// — this repository owns every line of it and the image is built here — so the wall that stops the reference
// does not stand in front of it. Filling the overlay is exactly "the job of whoever owns the image", which
// is what the upstream file names as the way this map is meant to be used.
//
// ⚠️ AND THE OVERLAY IS A FUNCTION HERE, WHERE UPSTREAM IT IS A CONST. That divergence is forced and is the
// whole substance of this file: the key is a store id, and a store id is a ULID minted fresh on every
// `bash bin/box-up.sh`. It cannot be a literal, so it is read from the environment at RESOLUTION time —
// see `src/lib/own-store.ts` for the mechanism (box-up writes it, compose delivers it) and for the
// hand-written id that already rotted once in the café's edge rule (`caddy/extra-local/coffee.caddy`).

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import { ownStoreId, ownStoreProblem } from '@/lib/own-store';
import { About } from './About';
import { CoffeeAbout } from './CoffeeAbout';
import { Contact } from './Contact';
import { Faq } from './Faq';
import { InstitutionalDefault } from './InstitutionalDefault';
import { Privacy } from './Privacy';
import { Returns } from './Returns';
import { Shipping } from './Shipping';
import { Terms } from './Terms';

export type PageTemplate = (props: { page: PageDoc }) => React.ReactElement;

export const DEFAULT_TEMPLATE_KEY = 'institutional-default';

/** The templates every store of this image gets — the answer when a store declares no version of its own. */
export const SHARED: Record<string, PageTemplate> = {
  'institutional-default': InstitutionalDefault,
  faq: Faq,
  contact: Contact,
  about: About,
  returns: Returns,
  shipping: Shipping,
  privacy: Privacy,
  terms: Terms,
};

/**
 * The templates the café store — and only it — gets instead of the shared ones.
 *
 * ★ A DIFF, NEVER A REPLACEMENT: what is absent here falls through to `SHARED`, so claiming `about` does not
 * cost this store its `faq`. Grow it by adding a key; nothing else has to change.
 */
export const OWN: Record<string, PageTemplate> = {
  about: CoffeeAbout,
};

/**
 * The per-store OVERLAY: `<store identity> -> template_key -> component`, built for the store THIS IMAGE is
 * the fork of. Empty when the wiring did not arrive — and then this front behaves exactly as it did before
 * the axis existed, which is a degradation and not an outage.
 *
 * @param env injectable so the rules can be proved over a POPULATED overlay AND over a rotted one; reading
 *            `process.env` here (rather than at import) also keeps the id a runtime fact, which is what it is.
 */
export function coffeeStoreOverlay(
  env: Record<string, string | undefined> = process.env,
): Record<string, Record<string, PageTemplate>> {
  const id = ownStoreId(env);
  return id ? { [id]: OWN } : {};
}

/** Where a resolved template came from — the store's own overlay, the shared map, or the last-resort default.
 *  Rendering does not depend on it; it is what makes "the fallback happened" observable to a test and to a
 *  dev warning instead of being an invisible property of a lookup. */
export type PageTemplateScope = 'store' | 'shared' | 'default';

export type ResolvedPageTemplate = {
  template: PageTemplate;
  /** True only for the last-resort default — a `template_key` no map claims. Unchanged meaning. */
  fallback: boolean;
  scope: PageTemplateScope;
};

/**
 * The store identities a template lookup is allowed to match, MOST SPECIFIC FIRST.
 *
 * Today that is exactly one: the store the request is in — the `/s/<store>` segment, which the read port
 * defines as the store ID and nothing else (*'the "store" param takes a store ID (`sto_…`), not a store
 * handle, a display name or a hostname'* — the port's own refusal). The edge also routes `/s/cafe*` to this
 * container, but that path never becomes an identity here: the read the page came from would already have
 * been refused, so nothing renders to be keyed.
 *
 * It is an ARRAY rather than a string because the front may learn a second, friendlier identity later;
 * adding one then is appending to this function, not re-typing every call site.
 */
export function storeTemplateAxis(store: string): readonly string[] {
  return [store];
}

/**
 * Build a resolver over a given pair of maps. The module-level `resolvePageTemplate` is one instance of it;
 * a test builds its own so the rules can be proved against a POPULATED overlay and against an EMPTY one
 * without either being able to cover for the other.
 */
export function createPageTemplateResolver(maps: {
  shared: Record<string, PageTemplate>;
  overlay: Record<string, Record<string, PageTemplate>>;
}) {
  return function resolve(key: string, axis: readonly string[]): ResolvedPageTemplate {
    for (const identity of axis) {
      const own = maps.overlay[identity]?.[key];
      if (own) return { template: own, fallback: false, scope: 'store' };
    }
    const shared = maps.shared[key];
    if (shared) return { template: shared, fallback: false, scope: 'shared' };
    console.warn(`[cms] unknown template_key "${key}", falling back to "${DEFAULT_TEMPLATE_KEY}"`);
    return { template: InstitutionalDefault, fallback: true, scope: 'default' };
  };
}

/**
 * ONCE PER PROCESS, AND ONLY WHEN THE WIRING IS BROKEN. A rotted `FORGE_COFFEE_STORE_ID` costs this shop its
 * own pages and changes nothing a reader can see — the page still renders, in somebody else's words. That is
 * the shape of failure this repository has paid for twice (the hand-written caddy id, the empty purge
 * secret), so it gets a voice. The RED lives in `bin/coffee-store-id.guard.mjs`; this is the runtime half.
 */
let warnedAboutOwnStore = false;
function warnOnceIfRotted(env: Record<string, string | undefined>): void {
  if (warnedAboutOwnStore) return;
  const problem = ownStoreProblem(env);
  if (!problem) return;
  warnedAboutOwnStore = true;
  console.warn(`[cms] ${problem}`);
}

/** Test seam: the "once" above is per process, and a suite that proves the warning needs to prove it twice. */
export function resetOwnStoreWarning(): void {
  warnedAboutOwnStore = false;
}

/**
 * Resolve a `template_key` for the store the request is in.
 *
 * Order: the store's own overlay → the shared map → the default template + `fallback: true` (and a warn), so
 * the caller can render it and, if it wants, signal the degradation — never throw.
 *
 * ★ `axis` IS REQUIRED, with no default: a caller that forgot it would silently render another store's words,
 * and a compile error is the cheapest place to find that out. Pass `storeTemplateAxis(store)`.
 */
export function resolvePageTemplate(key: string, axis: readonly string[]): ResolvedPageTemplate {
  warnOnceIfRotted(process.env);
  return createPageTemplateResolver({ shared: SHARED, overlay: coffeeStoreOverlay() })(key, axis);
}
