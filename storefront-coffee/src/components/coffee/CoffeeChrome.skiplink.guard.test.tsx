// ★ QA20 (S2A-9) — the keyboard shortcut into the page, proven where it has to hold: in the CHROME, ahead of
// everything else. Measured on staging before this: 90 Tabs from the top of /tenis to the first product card,
// on every page load. The assertion is not "a skip link exists somewhere" but "the FIRST focusable element of
// the document is it, and it lands on the wrapper around the page's content" — a skip link that is second is
// not a skip link.
//
// ── ★★ pk15/D2 — AND THE SUBJECT IS THE CHROME THIS DEPLOYABLE WEARS, WHICH IT WAS NOT ────────────────────
//
// This file was inherited with the cut and it rendered `components/StorefrontChrome.tsx`, the REFERENCE
// vitrine's. That was true of this fork until pk14/D5: `c/[store]/layout.tsx` mounted the reference chrome,
// so the rule was being asserted over something a shopper here could actually get. It is not true any more —
// both trees now mount <CoffeeChrome> (`c/[store]/layout.tsx:77`, `s/[store]/(storefront)/layout.tsx:26`) and
// NO layout of this app mounts the reference one. Measured 2026-09-05, in source: its only importers are
// `chrome-parity.test.tsx`, `chrome-identity.test.tsx` and this file before the move.
//
// ⇒ so the rule moved with the chrome. Left where it was, it would have been a green that no page of this
// shop was covered by: deleting `<SkipLink />` from the café chrome — the header every visitor gets — kept
// this file green, because it was rendering the other one.
//
// ── WHERE THE OTHER HALF OF THIS RULE LIVES, AND WHY IT IS NOT A SECOND COPY ─────────────────────────────
//
// `src/app/chrome-identity.test.tsx` also asserts a skip link, over the two LAYOUTS. That is a different
// subject with the same rule: this file says the café chrome carries the shortcut, that one says neither
// TREE lost it on the way to the shopper (a tree that stopped mounting this chrome, or mounted another).
// Both derive the anchor from the kit's own `MAIN_CONTENT_ID`; neither restates the other's claim.

import { MAIN_CONTENT_ID, SkipLink } from '@forgecommerce/storefront-kit/SkipLink';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CoffeeChrome } from './CoffeeChrome';

const CAFE = 'sto_01M1DE555TJ36TQB6E9PR5VSJ4';

/** Everything a Tab can land on, in document order. */
const FOCUSABLE = 'a[href], button, input, select, textarea';

/** The café chrome around a page, exactly as both layouts mount it. */
function chrome(): HTMLElement {
  const { container } = render(
    <CoffeeChrome store={CAFE} base={HOST_BASE}>
      <div data-testid="page">conteúdo da página</div>
    </CoffeeChrome>,
  );
  return container;
}

test("★ the skip link is the FIRST focusable element of the coffee shop's chrome", () => {
  const first = chrome().querySelector(FOCUSABLE);
  expect(
    first,
    'components/coffee/CoffeeChrome.tsx renders nothing a keyboard can land on at all',
  ).not.toBeNull();
  expect(
    first?.getAttribute('data-testid'),
    'the first thing a keyboard reaches in the CAFÉ chrome (components/coffee/CoffeeChrome.tsx) is ' +
      `<${first?.tagName.toLowerCase()}>, not the skip link. A skip link that is second is not a skip link: ` +
      'every page of this shop then answers a Tab with the whole header before the first product.',
  ).toBe('skip-link');
  expect(first?.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`);
});

test('★ …and it lands on the wrapper that HOLDS the page, not on nothing', () => {
  const container = chrome();
  const target = container.querySelector(`#${MAIN_CONTENT_ID}`);
  expect(
    target,
    `the café chrome has no #${MAIN_CONTENT_ID} — the link jumps at an anchor that is not there`,
  ).not.toBeNull();
  // Reachable by focus after the jump: without this the browser moves the viewport and leaves the keyboard
  // where it was, which lands the next Tab back in the header.
  expect(target?.getAttribute('tabindex')).toBe('-1');
  // The page really is INSIDE it. A target that sits after the content would skip nothing.
  const page = container.querySelector('[data-testid="page"]');
  expect(page, 'the café chrome stopped rendering the page at all').not.toBeNull();
  expect(
    target?.contains(page),
    `#${MAIN_CONTENT_ID} does not contain the page — the shortcut jumps past the header to another header`,
  ).toBe(true);
});

test('★ the shortcut is the KIT’s own link, not a look-alike written here', () => {
  // The id and the words come from one place, so this shop and `SkipLink`'s other consumers are talking about
  // the same anchor rather than two that resemble each other. Asserted as the WHOLE element: a hand-written
  // copy in the fork would satisfy any single attribute and drift on the next kit change.
  const { container } = render(<SkipLink />);
  const kit = container.querySelector('a');
  expect(kit?.textContent).toBe('Pular para o conteúdo');
  expect(kit?.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`);
  expect(
    chrome().querySelector('[data-testid="skip-link"]')?.outerHTML,
    'the café chrome renders its own skip link instead of the kit component',
  ).toBe(kit?.outerHTML);
});
