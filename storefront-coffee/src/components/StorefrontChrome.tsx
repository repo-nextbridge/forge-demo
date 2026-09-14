// ⛔⛔ pk15/D2 — THIS IS THE CONTROL. NO LAYOUT OF THIS APP MOUNTS IT, AND THAT IS DELIBERATE.
//
// It is the REFERENCE vitrine's chrome, inherited with the cut. Since pk14/D5 both trees of this deployable
// wear the shop's own <CoffeeChrome> (`app/c/[store]/layout.tsx:77`, `app/s/[store]/(storefront)/layout.tsx:26`),
// so nothing a shopper can open renders this file. Measured 2026-09-05, in source: its only importers are
// `chrome-parity.test.tsx` and `app/chrome-identity.test.tsx` — both TESTS, neither a route.
//
// ★ IT IS KEPT ANYWAY, because deleting it would delete a rule rather than dead
// code. `chrome-identity.test.tsx` judges the two trees by what they must NOT look like, and it re-derives
// that marker from THIS component on every run instead of trusting a literal: the day `site-header` stops
// being what the reference chrome renders, its negative assertions would quietly become true of everything.
// A control that is not rendered is not a control.
//
// ⚠️ SO DO NOT MOUNT IT, AND DO NOT PUT A RULE ABOUT THIS SHOP ON IT. The accessibility rule used to live
// here (`components/SkipLink.test.tsx`) and it was green while the café chrome had no skip link at all —
// measured under sabotage in pk15/D2. It now lives on the chrome the deployable wears:
// `components/coffee/CoffeeChrome.skiplink.guard.test.tsx`.
//
// ── WHAT THE COMPONENT IS, FOR WHOEVER RE-FORKS FROM IT ─────────────────────────────────────────────────
//
// The STOREFRONT's chrome: the kit's composition, this app's three fragments.
//
// The chrome itself — skip link, header, main landmark, footer, and every `header.*`/`footer.*` extension
// outlet — lives in `@forgecommerce/storefront-kit/chrome`, because the checkout deployable wears the same
// one and neither half may import the other's routes. What is the VITRINE's and could never be the kit's:
//
//   · the minicart CONTEXT and its five store-bound Server Actions (`(checkout)/checkout/actions`);
//   · the account affordance — a LINK now, not the modal: see `AccountLink.tsx` for why the cut turned it
//     into one, and what that costs and buys;
//   · the rich `SearchBox`, which renders the theme's ProductCard in its suggestion panel.
//
// All three are app modules the kit may not name — the first two move to `apps/checkout` in wave 2 of
// CHECKOUT-APP — so they are bound HERE and handed in as nodes. The rendered HTML is unchanged.
//
// ── ★★ M4 — AND THE VITRINE ADOPTS THE MERCHANT'S OWN CHROME, which P2 built and wired to one front ──────
//
// P2 shipped the mechanism in the kit and left ADOPTION to each deployable ("o mecanismo é o mesmo e mora no
// kit; quem adere é decisão do deployable"), taking the checkout first: a checkout WE host must never be
// worth forking over a footer. The vitrine was the open half, on the argument that its chrome is theme code
// a forker already owns.
//
// It adopts it here because of what a SHOPPER sees, which is the fact neither argument covered: both fronts
// serve the same host under one address, and a merchant who writes "Atendimento 9h às 18h" into their store
// gets it on the checkout and not on the shelf — the header changing halfway through a visit, on a screen
// nobody can point at. The setting is called "the store's header", so it is the store's, on every page of
// it. Most merchants never fork; the reference vitrine IS their shop.
//
// ⛔ THE `chrome` PROP IS GONE, and with it the read this comment used to justify. `chrome_header` and
// `chrome_footer` were REPLACE-the-whole-thing fields; the `chrome` APP (Identidade da loja) fills the same
// regions in PARTS, per store, from Compose. The kit dropped the prop and the `chrome/store-chrome` subpath
// in pk11/p3, so a fork that kept passing it stopped compiling — which is how THIS fork found out.
// ★ The fork is the piece that does not inherit the platform's rules for free: the monorepo's typecheck is
// green without it. Measured 2026-09-04, on the bake that produced this image.

import { StorefrontChrome as KitChrome } from '@forgecommerce/storefront-kit/chrome';
import type { StoreBase } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { AccountLink } from '@/components/AccountLink';
import { MinicartProvider } from '@/components/minicart/MinicartProvider';
import { MinicartTrigger } from '@/components/minicart/MinicartTrigger';
import { SearchBox } from '@/components/SearchBox';
import {
  addToCartAction,
  cartSummaryAction,
  chooseGiftAction,
  removeLineAction,
  updateLineAction,
} from '@/lib/cart-actions';
import { ExtensionOutlet } from '@/lib/extensions/ExtensionOutlet';

export async function StorefrontChrome({
  store,
  base,
  children,
}: {
  store: string;
  /** MULTISTORE M1-β — the store prefix of the current request. The two layout hosts answer it differently and
   * that IS the mechanism: `c/[store]` is only ever reached by a host rewrite, so its base is the constant
   * HOST_BASE (asking would turn a cacheable route into a 500); `s/[store]` reads it per request. */
  base: StoreBase;
  children: ReactNode;
}) {
  const minicartActions = {
    readCart: cartSummaryAction.bind(null, store),
    addLine: addToCartAction.bind(null, store),
    updateLine: updateLineAction.bind(null, store),
    removeLine: removeLineAction.bind(null, store),
    // PROMO — picking an offered gift is a cart write like the others: bound here, re-read by the provider.
    chooseGift: chooseGiftAction.bind(null, store),
  };
  return (
    <MinicartProvider actions={minicartActions}>
      <KitChrome
        store={store}
        base={base}
        outlet={ExtensionOutlet}
        account={<AccountLink base={base} />}
        minicart={
          <MinicartTrigger
            base={base}
            top={<ExtensionOutlet name="minicart.top" store={store} storeBase={base} />}
            belowItems={
              <ExtensionOutlet name="minicart.below_items" store={store} storeBase={base} />
            }
          />
        }
        search={<SearchBox base={base} />}
      >
        {children}
      </KitChrome>
    </MinicartProvider>
  );
}
