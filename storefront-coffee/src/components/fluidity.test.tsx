// The structural fluidity guard (HANDOVER §10.1 / S7-SF-FOUNDATION doctrine): a component with an exit
// transition must NOT conditionally unmount its animated node — unmounting rips the node out before the
// fade can play. This test renders fade layers in their CLOSED state and asserts the animated node is still
// in the DOM (just hidden). FadeLayer is the sanctioned way to satisfy it; the anti-pattern below shows what
// the guard catches. WS4 extends this file to assert the real chrome (minicart, submenu, modal, drawer).

import { FadeLayer } from '@forgeco/storefront-kit/FadeLayer';
import { EMPTY_SNAPSHOT } from '@forgeco/storefront-kit/minicart-types';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { MegaMenu } from '@forgeco/storefront-kit/subtemplates/header/MegaMenu';
import { MobileNavDrawer } from '@forgeco/storefront-kit/subtemplates/header/MobileNavDrawer';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FilterDrawer } from './FilterDrawer';
import { MinicartDrawer } from './minicart/MinicartDrawer';
import { MinicartProvider } from './minicart/MinicartProvider';
import { SearchBox } from './SearchBox';

test('FadeLayer keeps its animated node mounted when closed (just hidden)', () => {
  const { queryByText, rerender, container } = render(
    <FadeLayer open={false}>
      <span>panel body</span>
    </FadeLayer>,
  );
  // Closed: the node is STILL in the DOM — the exit fade needs it.
  expect(queryByText('panel body')).not.toBeNull();
  const layer = container.querySelector('[data-fade-layer]');
  expect(layer).not.toBeNull();
  expect(layer?.hasAttribute('data-open')).toBe(false);

  // Open: same node, now marked visible.
  rerender(
    <FadeLayer open>
      <span>panel body</span>
    </FadeLayer>,
  );
  expect(queryByText('panel body')).not.toBeNull();
  expect(container.querySelector('[data-fade-layer]')?.hasAttribute('data-open')).toBe(true);
});

test('the conditional-unmount anti-pattern the doctrine forbids DOES rip the node out', () => {
  // A naive `{open && <Panel/>}`: closed → the node is gone, so no exit fade can play. This is the exact
  // shape FadeLayer replaces; asserting it here documents what the structural guard is protecting against.
  function Naive({ open }: { open: boolean }) {
    return <div>{open && <span>panel body</span>}</div>;
  }
  const { queryByText, rerender } = render(<Naive open={false} />);
  expect(queryByText('panel body')).toBeNull(); // ← the defect: unmounted when closed
  rerender(<Naive open />);
  expect(queryByText('panel body')).not.toBeNull();
});

// The doctrine applied to a REAL chrome component. Before S7-SF-FOUNDATION the MinicartDrawer did
// `if (!open) return null` — this assertion was born red against it; the FadeLayer retrofit makes it green.
test('MinicartDrawer keeps its overlay mounted while closed (no conditional unmount)', () => {
  const actions = {
    readCart: async () => EMPTY_SNAPSHOT,
    addLine: async () => {},
    updateLine: async () => {},
    removeLine: async () => {},
  };
  const { getByTestId } = render(
    <MinicartProvider actions={actions}>
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );
  // Closed on mount: the overlay node exists (the exit fade needs it), just without data-open.
  const overlay = getByTestId('minicart-overlay');
  expect(overlay).not.toBeNull();
  expect(overlay.hasAttribute('data-open')).toBe(false);
});

// WS4 (S7-SF-CLOSE belt): the doctrine over the theme's overlays. Each is rendered in its CLOSED state and its
// animated node must still be in the DOM without `data-open` — an exit fade needs it. The list IS the
// inventory: a new overlay that unmounts on close makes this table go red.
//
// ★ CHECKOUT-APP (C1) — IT IS THE VITRINE'S INVENTORY NOW. The login modal and the order sheet's two overlays
// moved to `apps/checkout` with the screens that mount them, and the same table lives there
// (`apps/checkout/src/components/fluidity.test.tsx`). One doctrine, two inventories — because an inventory
// that names a component its own build no longer contains is not an inventory.
test.each([
  ['search suggest', 'suggest-dropdown', <SearchBox base={HOST_BASE} key="s" />],
  [
    'mobile nav drawer',
    'mobile-nav-overlay',
    <MobileNavDrawer base={HOST_BASE} key="m" open={false} onClose={() => {}} />,
  ],
  [
    'filter drawer',
    'filter-overlay',
    <FilterDrawer key="f" count={0}>
      <span>filtros</span>
    </FilterDrawer>,
  ],
] as const)('%s keeps its overlay mounted while closed (fades never unmount)', (_label, testid, el) => {
  const { getByTestId } = render(el);
  const overlay = getByTestId(testid);
  expect(overlay).not.toBeNull();
  expect(overlay.hasAttribute('data-open')).toBe(false);
});

// The submenu is the one overlay that is NOT a FadeLayer: it is a pure-CSS `:hover`/`:focus-within` panel, so
// its node must be present in the SSR DOM at all times (display never toggled by JS) — that IS the "never
// unmount" invariant for it. Assert the panel exists on a plain render (no interaction).
test('MegaMenu submenu panel is in the DOM without any interaction (CSS-only reveal, never unmounted)', () => {
  const { container } = render(<MegaMenu base={HOST_BASE} />);
  // The parent "Tênis" carries a submenu panel with its child link — present on render, revealed by CSS hover.
  const panels = container.querySelectorAll('[data-testid="mega-menu"] ul ul');
  expect(panels.length).toBeGreaterThan(0);
});
