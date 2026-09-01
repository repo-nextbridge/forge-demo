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

import type { InstalledExtension } from '@forgecommerce/storefront-kit/read-client';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

const extensionsMock = vi.fn<() => Promise<InstalledExtension[] | null>>();
const cookiesMock = vi.fn();
const resolveGateMock = vi.fn();

vi.mock('next/headers', () => ({ cookies: () => cookiesMock() }));
vi.mock('@forgecommerce/storefront-kit/config', () => ({
  GATE_DISMISSED_COOKIE: 'forge_gate_dismissed',
  readClient: () => ({
    extensions: () => extensionsMock(),
    // MS-M2 — the layout also asks this store which theme it wears (`storeThemeStyle`). It answers null here:
    // the gate machinery is what this file is about, and a store with no flags renders the base theme, which
    // adds nothing to the markup the assertions below read.
    storeFlags: async () => null,
  }),
}));
vi.mock('@forgecommerce/storefront-kit/gate/actions', () => ({
  dismissGate: async () => {},
  reopenGate: async () => {},
}));
vi.mock('@forgecommerce/storefront-kit/gate/registry', () => ({
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

test('the slot is filled but this build has no implementation → the route renders as-is, still static', async () => {
  // The reference storefront's own case: the app is installed for the tenant, but the front that renders
  // it lives in that instance's own copy. It must degrade to "no gate", never to a blank page.
  extensionsMock.mockResolvedValue([gateHook('some-gate')]);
  resolveGateMock.mockReturnValue(undefined);

  const html = await renderLayout();

  expect(html).toContain('the store');
  expect(resolveGateMock).toHaveBeenCalledWith('some-gate');
  expect(
    cookiesMock,
    'an unrenderable gate must not cost a cookie read either',
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
