// The theme's 404 body (HANDOVER §9). Proves the two shapes: the store-LESS root (the logo, since there is no
// header to carry it) and the store-scoped (no logo). Both carry the "404" + the two CTAs (home + search) and
// NOTHING ELSE — this page used to end in a row of category chips, and the shop wants no browsable category
// links, so the second test below is a rule over the page's anchors AS A SET rather than a list of names.

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { NotFoundContent } from './NotFoundContent';

describe('NotFoundContent', () => {
  test('store-less: shows the logo, the 404 and the two CTAs', () => {
    render(<NotFoundContent base={HOST_BASE} brand />);
    expect(screen.getByTestId('not-found')).toBeTruthy();
    // The two CTAs point to the store home and the search page (clean URLs)...
    const home = screen.getByTestId('not-found-home');
    const search = screen.getByTestId('not-found-search');
    expect(home.getAttribute('href')).toBe('/');
    expect(search.getAttribute('href')).toBe('/search');
    // ...and each carries its leading icon (house / magnifier), per the prototype.
    expect(home.querySelector('svg')).toBeTruthy();
    expect(search.querySelector('svg')).toBeTruthy();
    // ★ s3-16 — AND THE WAY OUT IS WORDED IN THIS SHOP'S NOUN, not the reference storefront's "produtos".
    // The href is unchanged and the search behind it works (measured: /search?q=cafe → 5 results); what was
    // wrong was a fork repeating a word written by a storefront that does not know what it sells. Asserted
    // because copy with no test is copy that drifts back on the next cut.
    expect(search.textContent).toContain('cafés');
    expect(search.textContent).not.toContain('produtos');
  });

  test('⛔ store-scoped: the two CTAs are the WHOLE way out — no shelf grows back under them', () => {
    const { container } = render(<NotFoundContent base={HOST_BASE} />);
    const links = [...container.querySelectorAll('a')];
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(
      hrefs,
      `the 404 offers links this shop did not ask for: ${hrefs.join(' · ')}. The way out is the two CTAs; a ` +
        'category row here is the chip row coming back through another door.',
    ).toEqual(['/', '/search']);
  });
});
