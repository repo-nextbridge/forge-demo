// DEMO-OUT — the `storefront:gate` slot MACHINERY, proven with a FIXTURE gate.
//
// This is the test that separates "the slot works" from "the demo works". The slot, its dismissal cookie
// and its two Server Actions are the platform's (a sibling of `checkout.payment`, `home.hero`); the demo's
// gate was only its first consumer, and it left. So the machinery is exercised here by a gate that exists
// nowhere but in this file — if it could only be proven by installing our demo's app, the slot would not
// be a platform slot at all.
//
// The four states are the whole contract:
//   · nobody fills the slot                        → the route renders as-is
//   · someone fills it, this build cannot render it → the route renders as-is
//   · fillable, not dismissed                       → the gate REPLACES the page (deep link preserved: the
//                                                     same URL, no redirect)
//   · fillable, dismissed                           → the page, plus the reopen affordance after it
//
// The first two also assert that `cookies()` is NEVER called. That is the "zero cost when no gate is
// installed" claim from the layout's own header, which until now was a comment: reading a cookie opts the
// route into dynamic rendering, so a store with no renderable gate would silently lose its static pages.

import type { InstalledExtension } from '@forgeco/storefront-kit/read-client';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

const extensionsMock = vi.fn<() => Promise<InstalledExtension[] | null>>();
const cookiesMock = vi.fn();
const resolveGateMock = vi.fn();

vi.mock('next/headers', () => ({ cookies: () => cookiesMock() }));
vi.mock('@forgeco/storefront-kit/config', () => ({
  GATE_DISMISSED_COOKIE: 'forge_gate_dismissed',
  readClient: () => ({
    extensions: () => extensionsMock(),
    // ★★ pk14/D3 — THIS ANSWER USED TO BE `null`, AND `null` STOPPED MEANING "no flags" ON THE DAY P4 LANDED.
    // MS-M2 put the read here for the THEME, where a store with no flags simply wore the base skin. P4 gave
    // the same answer a second meaning — `null` is the port's 404, "not a store of this instance"
    // (`require-store.server.ts`) — and pk12/D2 dragged that layout change into this fork. The mock did not
    // move, so from that day every case in this file rendered a 404 instead of a page, and all six were red
    // until `bin/fork-suite.guard.mjs` ran this suite for the first time on 2026-09-05.
    // The flags below are therefore the MINIMUM that says "this store exists and is on the street": a name for
    // the theme layer, and `storefront_enabled` left absent on purpose — `requirePublicStorefront` refuses
    // only on an explicit `false`, so absence is what a store served by an older kernel looks like.
    storeFlags: async () => ({
      name: 'Acme',
      masked_checkout_enabled: false,
      guest_checkout_enabled: true,
      timezone: 'America/Sao_Paulo',
    }),
  }),
}));
vi.mock('@forgeco/storefront-kit/gate/actions', () => ({
  dismissGate: async () => {},
  reopenGate: async () => {},
}));
vi.mock('@forgeco/storefront-kit/gate/registry', () => ({
  resolveGate: (extensionId: string) => resolveGateMock(extensionId),
}));

/** A gate implementation owned by no app — the point of the fixture. Both faces receive the store and the
 *  action the slot hands them; rendering them is what proves the layout wires both. */
const FIXTURE_GATE = {
  Interstitial: ({ store, dismiss }: { store: string; dismiss: () => Promise<void> }) => (
    <div id="fixture-interstitial" data-store={store} data-wired={typeof dismiss} />
  ),
  Ribbon: ({ store, reopen }: { store: string; reopen: () => Promise<void> }) => (
    <div id="fixture-ribbon" data-store={store} data-wired={typeof reopen} />
  ),
};

const PAGE = <p id="page">the store</p>;

function gateHook(extensionId: string, target = 'storefront:gate'): InstalledExtension {
  return { extension_id: extensionId, hooks: [{ component: 'gate', target, position: 0 }] };
}

function dismissalCookie(value: string | undefined) {
  return {
    get: (name: string) => (name === 'forge_gate_dismissed' && value ? { value } : undefined),
  };
}

async function renderLayout(children: ReactNode = PAGE): Promise<string> {
  const { default: StoreLayout } = await import('./layout');
  return renderToString(
    await StoreLayout({ children, params: Promise.resolve({ store: 'acme' }) }),
  );
}

afterEach(() => {
  extensionsMock.mockReset();
  cookiesMock.mockReset();
  resolveGateMock.mockReset();
});

test('no extension fills the slot → the route renders as-is, and no cookie is read', async () => {
  extensionsMock.mockResolvedValue([gateHook('shelves', 'storefront:home.below_shelf')]);

  const html = await renderLayout();

  expect(html).toContain('the store');
  expect(cookiesMock, 'a store with no gate must stay static').not.toHaveBeenCalled();
  expect(resolveGateMock).not.toHaveBeenCalled();
});

test('★★ the slot is filled and this build cannot draw it → the shopper is REFUSED, not served the shop', async () => {
  // ⛔ THIS TEST USED TO ASSERT THE DEFECT, and that is worth keeping in writing. Its name was "the route
  // renders as-is, still static" and its body demanded `html` contain the page — i.e. it DEMANDED the silent
  // degrade that let this fork serve ten days of shop while the port published a gate placement nobody could
  // draw. The assertion was the bug, green the whole time. (pk32/p2 found the identical twin in the product's
  // own `gate-slot.test.tsx`; this is the fork's half of the same lie.)
  //
  // ★ `storefront:gate` is a STRUCTURAL target — the kit decides which targets may not go missing quietly, in
  // `@forgeco/storefront-kit/extensions/composition-gap` — so an implementation this build lacks is a
  // refusal the shopper READS, never a page that pretends the declaration was not there.
  extensionsMock.mockResolvedValue([gateHook('some-gate')]);
  resolveGateMock.mockReturnValue(undefined);

  const html = await renderLayout();

  expect(resolveGateMock).toHaveBeenCalledWith('some-gate');
  expect(html, 'a declared gate this build cannot draw must say so').toContain('composition-gap');
  expect(
    html,
    'and it must NOT serve the shop underneath it, which is what made this invisible',
  ).not.toContain('the store');
  expect(
    cookiesMock,
    'an undrawable gate must not cost a cookie read either — the refusal is static',
  ).not.toHaveBeenCalled();
});

test('fillable and not dismissed → the gate REPLACES the page', async () => {
  extensionsMock.mockResolvedValue([gateHook('fixture-gate')]);
  resolveGateMock.mockReturnValue(FIXTURE_GATE);
  cookiesMock.mockResolvedValue(dismissalCookie(undefined));

  const html = await renderLayout();

  expect(html).toContain('fixture-interstitial');
  // The route's content must NOT be underneath: the interstitial covers the URL that was asked for
  // (SSR, no flash of the store, no redirect away from the deep link).
  expect(html, 'the page must not render under the gate').not.toContain('the store');
  // The dismissal action reached the implementation — without it "Open the store" is a dead button.
  expect(html).toContain('data-wired="function"');
});

test('fillable and dismissed → the page renders, with the reopen affordance after it', async () => {
  extensionsMock.mockResolvedValue([gateHook('fixture-gate')]);
  resolveGateMock.mockReturnValue(FIXTURE_GATE);
  cookiesMock.mockResolvedValue(dismissalCookie('1'));

  const html = await renderLayout();

  expect(html).toContain('the store');
  expect(html).toContain('fixture-ribbon');
  expect(html).not.toContain('fixture-interstitial');
  // After the page, not before it — the ribbon sits under the storefront AND the checkout footers.
  expect(html.indexOf('fixture-ribbon')).toBeGreaterThan(html.indexOf('the store'));
});

test('an implementation with no ribbon is legal — the page renders alone once dismissed', async () => {
  // `Ribbon` is optional in the contract: a coming-soon gate or an age gate has nothing to say afterwards.
  extensionsMock.mockResolvedValue([gateHook('fixture-gate')]);
  resolveGateMock.mockReturnValue({ Interstitial: FIXTURE_GATE.Interstitial });
  cookiesMock.mockResolvedValue(dismissalCookie('1'));

  const html = await renderLayout();

  expect(html).toContain('the store');
  expect(html).not.toContain('fixture-ribbon');
});

test('the port being down is not a gate → the route renders as-is', async () => {
  extensionsMock.mockResolvedValue(null);

  const html = await renderLayout();

  expect(html).toContain('the store');
  expect(cookiesMock).not.toHaveBeenCalled();
});
