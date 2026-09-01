// Guard: every example in the generated storefront registry renders without throwing (a broken chrome example
// fails here, not in a browser), and the manifest/registry stay in lockstep (same slugs). Mirrors the admin's
// ui-admin/catalog-examples.test.tsx.

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { COMPONENTS } from './catalog';
import { CATALOG_EXAMPLES } from './generated/registry';

test('every registry example renders to string without throwing', () => {
  for (const [slug, Example] of Object.entries(CATALOG_EXAMPLES)) {
    expect(() => renderToString(createElement(Example))).not.toThrow();
    expect(Example, `example for "${slug}" is defined`).toBeTruthy();
  }
});

test('the manifest and the registry describe the same set of components', () => {
  const manifestSlugs = COMPONENTS.map((c) => c.id).sort();
  const registrySlugs = Object.keys(CATALOG_EXAMPLES).sort();
  expect(registrySlugs).toEqual(manifestSlugs);
});

test('the chrome primitives built in this wave are in the catalog', () => {
  // ★ CHECKOUT-APP (C1/C4) — `otp-input` and `login-modal` LEFT THIS CATALOG with the screens that mount
  // them. The gallery is per deployable (it renders the components of the build it ships in); those two are
  // in `apps/checkout/src/app/ui-checkout` now, which asserts their arrival the way this asserts their
  // departure. Naming them here would demand an example for a component this app does not contain. What
  // stays is the chrome this build renders — which is the claim the test was making.
  const slugs = new Set(COMPONENTS.map((c) => c.id));
  for (const expected of ['fade-layer', 'mobile-nav-drawer']) {
    expect(slugs.has(expected), `catalog is missing "${expected}"`).toBe(true);
  }
});
