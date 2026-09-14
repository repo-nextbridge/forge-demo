// ★★ A34 — WHAT THE LAST LINE OF THIS SHOP'S FOOTER SAYS, AND WHY IT IS WORTH A GUARD.
//
// It used to carry a copyright notice. It now carries the one thing a shopper at the bottom of a page
// is actually asking — "compra segura" — beside the padlock that says it without words.
//
// ⚠️ THE GUARD IS THE PAIR, NOT THE PHRASE. Either half alone is the failure mode: the words with no mark are
// a sentence nobody reads, and the mark with no words is a glyph that means whatever the viewer decides. And
// they have to be ONE line — the padlock renders at 13px inside a 11.5px line, so without the inline-flex in
// `.copy` it drops to its own baseline and reads as a bullet ABOVE the sentence rather than beside it. That
// last part is invisible to a text assertion, so it is checked as layout: the svg is the div's own child.
//
// ⚠️ AND IT ASSERTS THE `©` IS GONE. Not tidiness: a footer that gained the seal and kept the notice would
// pass every positive check above while showing exactly what the change was meant to remove.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CoffeeChrome } from './CoffeeChrome';

const CAFE = 'sto_01M1DE555TJ36TQB6E9PR5VSJ4';

function footer(): HTMLElement {
  const { container } = render(
    <CoffeeChrome store={CAFE} base={HOST_BASE}>
      <div />
    </CoffeeChrome>,
  );
  const found = container.querySelector('footer');
  if (!found) throw new Error('the chrome rendered no <footer> — this guard is arguing about a moved door');
  return found as HTMLElement;
}

/** The seal: the footer's own last line, whatever class it happens to carry.
 *
 * ⚠️ THE **LAST** MATCH, NOT THE FIRST — and the first version of this file got it wrong, which is the useful
 * part. `querySelectorAll` is document order, so every WRAPPER around the line also "contains" the phrase and
 * `find` returned the footer's outer div: the assertion then read the whole footer's text and reported the nav
 * links as part of the seal. The deepest element on that branch is the line itself. */
function seal(): HTMLElement {
  const lines = [...footer().querySelectorAll('div')];
  const found = lines.findLast((el) => /compra segura/i.test(el.textContent ?? ''));
  if (!found) {
    throw new Error(
      `no "Compra segura" anywhere in the footer. It reads: ${JSON.stringify(footer().textContent)}`,
    );
  }
  return found as HTMLElement;
}

test('★ the footer closes with "Compra segura"', () => {
  expect(seal().textContent?.trim()).toBe('Compra segura');
});

test('★★ …and the padlock is ON that line, as its own child — not floating above it', () => {
  const svg = seal().querySelector(':scope > svg');
  expect(
    svg,
    'the seal has the words and no mark of its own. The padlock is `<Icon name="lock" />`, and it has to be ' +
      'a direct child of the line so `.copy`\'s inline-flex puts it beside the text rather than over it.',
  ).not.toBeNull();
  // It is a stroke-drawn glyph in the shop's own set, not a decorative box: it inherits the line's colour.
  expect(svg?.getAttribute('stroke')).toBe('currentColor');
  // Decorative by construction — the words next to it are what a screen reader should announce, once.
  expect(svg?.getAttribute('aria-hidden')).toBe('true');
});

test('★ the copyright notice it replaced is gone, rather than joined', () => {
  expect(footer().textContent ?? '').not.toContain('©');
});
