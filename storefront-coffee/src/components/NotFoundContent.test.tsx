// The theme's 404 body (HANDOVER §9). Proves the two shapes: the store-LESS root (logo, no category chips —
// category data is a store's, never faked) and the store-scoped (real chips, no logo since the header carries
// it). Both always carry the "404" + the two CTAs (home + search).

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { NotFoundContent } from './NotFoundContent';

describe('NotFoundContent', () => {
  test('store-less: shows the logo and NO category chips', () => {
    render(<NotFoundContent base={HOST_BASE} brand />);
    expect(screen.getByTestId('not-found')).toBeTruthy();
    expect(screen.queryByTestId('not-found-chips')).toBeNull();
    // The two CTAs point to the store home and the search page (clean URLs)...
    const home = screen.getByTestId('not-found-home');
    const search = screen.getByTestId('not-found-search');
    expect(home.getAttribute('href')).toBe('/');
    expect(search.getAttribute('href')).toBe('/search');
    // ...and each carries its leading icon (house / magnifier), per the prototype.
    expect(home.querySelector('svg')).toBeTruthy();
    expect(search.querySelector('svg')).toBeTruthy();
  });

  test('store-scoped: renders real category chips linking to their paths', () => {
    render(
      <NotFoundContent
        base={HOST_BASE}
        categories={[
          { name: 'Tênis', href: '/tenis' },
          { name: 'Botas', href: '/botas' },
        ]}
      />,
    );
    const chips = screen.getByTestId('not-found-chips');
    expect(chips).toBeTruthy();
    const links = chips.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute('href')).toBe('/tenis');
    expect(links[0]?.textContent).toBe('Tênis');
  });
});
