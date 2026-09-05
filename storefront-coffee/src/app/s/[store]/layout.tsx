// The store-scoped root layout, the single parent of BOTH route groups ((storefront) + (checkout)), so it
// wraps EVERY store route including deep links. It renders the neutral theme slot `storefront:gate`: if an
// installed app fills that target, this build has an implementation registered for it, AND the dismissal
// cookie is absent, the implementation's block replaces the whole page in a full-screen interstitial (SSR —
// the store never flashes underneath); otherwise it renders the route as-is.
//
// It names NO app. WHICH extension fills the slot comes from read.extensions at runtime; WHAT to render for
// it comes from the static gate registry (`@forgecommerce/storefront-kit/gate/registry`, one import + one entry, empty in
// the reference storefront). Everything a particular gate needs beyond `store` + the two actions — its env,
// its language cookie, its copy — is read inside its own registry entry, never here. That separation is the
// whole point of the slot: the layout owns the MACHINERY (when a gate shows, the dismissal cookie, the two
// Server Actions); an instance owns the gate.
//
// Zero cost when no gate renders: the gate presence is resolved from read.extensions (the SAME ISR-cached
// call the outlets already make) and the registry is a plain object lookup, so the cookie is read ONLY when
// a gate is actually going to render — a store with no gate keeps its pages static (no dynamic opt-in) and
// is byte-identical to before this file. Asserted in gate-slot.test.tsx, not merely claimed here.

import { readClient } from '@forgecommerce/storefront-kit/config';
import { GATE_DISMISSED_COOKIE } from '@forgecommerce/storefront-kit/cookies';
import { dismissGate, reopenGate } from '@forgecommerce/storefront-kit/gate/actions';
import { resolveGate } from '@forgecommerce/storefront-kit/gate/registry';
import {
  requirePublicStorefront,
  requireStore,
} from '@forgecommerce/storefront-kit/require-store.server';
import { storeThemeStyle } from '@forgecommerce/storefront-kit/theme/store-theme';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

const GATE_TARGET = 'storefront:gate';

export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;

  // ★★ P4 — THE FIRST QUESTION, AND IT IS ASKED HERE FOR THE REASON THE GATE IS: this layout is the single
  // parent of every route group, so a store that does not exist is refused on EVERY entrance rather than on
  // the ones somebody remembered. Until this line, `/s/<anything>` answered 200 with the full chrome — the
  // status line said OK about a store the read port had already refused (see `requireStore` for the
  // measurement and for why the handle is not resolved instead).
  //
  // ★★ pk12/D2 — AND THIS FORK IS WHY THE RULE HAS A GUARD OF ITS OWN. The fix above shipped in the
  // reference vitrine and did not travel here: measured on the bench 2026-09-04, `/s/outlet`, `/s/forge` and
  // `/s/inexistente-xyz` answered 404 (`x-forge-served-by: storefront`) while `/s/cafe` answered 200
  // (`x-forge-served-by: storefront-coffee`) — the same segment, two answers, because a fork inherits the
  // code and not the rule. `bin/store-mount-drift.guard.mjs` is the rule; this is the code.
  const flags = await requireStore(store);

  // ★★ pk9/P1 — THE SECOND QUESTION, AND IT IS A DIFFERENT ONE: the store exists, but is it a STREET store?
  // A counter, a wholesale desk, an employee shop or a test store has no public page, and until that slice
  // there was no way for it to say so — `store.status` was a dead column, so every store that existed was
  // served here. It costs no round trip: the answer rides on the flags `requireStore` just fetched.
  // ⚠️ It turns off THIS PAGE and nothing else: that store's catalogue, prices, stock and orders are
  // untouched and the port keeps answering for it, which is how a totem at that counter keeps selling.
  requirePublicStorefront(flags);

  // MS-M2 — the store's own skin, above everything this layout can return (the route, the gate's interstitial,
  // the dismissed-gate ribbon): a themed store is themed on all three, and the gate is full-screen, so leaving
  // it out would show the base palette exactly where a brand's first impression is. Null — and free — on the
  // reference theme. It stays an ISR-cached read, so a store with no gate keeps its pages static.
  // ★ D2-E2 — the empty prefix is the VITRINE'S OWN FACT, not a placeholder: this deployable answers the
  // edge's fall-through, so its asset URLs are the bare ones. The checkout, which shares the host, passes
  // `/_checkout` instead. See `storeThemeStyle` for why the parameter has no default.
  const theme = await storeThemeStyle(store, '');

  // Is an app filling `storefront:gate`? ISR-cached; no cookie read yet, so a store with no gate stays static.
  const installed = await readClient().extensions(store);
  const filling = installed?.find((ext) => ext.hooks.some((h) => h.target === GATE_TARGET));
  if (!filling)
    return (
      <>
        {theme}
        {children}
      </>
    );

  // Installed, but this build has no implementation registered for it — the reference storefront's own case,
  // since a gate belongs to the instance that wants one. Degrade to "no gate": the route renders, and it is
  // still static (no cookie read below).
  const gate = resolveGate(filling.extension_id);
  if (!gate)
    return (
      <>
        {theme}
        {children}
      </>
    );

  // A gate WILL render — now (and only now) the cookie is read, making this instance dynamic.
  const cookieStore = await cookies();
  const dismissed = cookieStore.get(GATE_DISMISSED_COOKIE)?.value === '1';

  // Dismissed → the shopper is browsing; render the route, with the implementation's persistent affordance
  // (if it has one) at the very bottom, after the footer. This layout wraps BOTH route groups, so the ribbon
  // sits under the storefront AND the checkout footers with one mount. It re-opens the gate.
  if (dismissed) {
    const { Ribbon } = gate;
    return (
      <>
        {theme}
        {children}
        {Ribbon ? <Ribbon store={store} reopen={reopenGate} /> : null}
      </>
    );
  }

  // Not dismissed → the interstitial COVERS the route that was asked for. Never a redirect: the same URL
  // renders the gate now and the deep link's content the moment `dismiss` is posted.
  const { Interstitial } = gate;
  return (
    <>
      {theme}
      <Interstitial store={store} dismiss={dismissGate} />
    </>
  );
}
