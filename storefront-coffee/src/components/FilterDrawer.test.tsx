// FilterDrawer — the mobile "Filtrar (N)" trigger + left slide-in drawer (S7-SF-PLP, HANDOVER §5). It wraps the
// SAME filter sidebar the desktop shows inline; on mobile the panel starts off-canvas and the trigger opens it.
// It never unmounts (FadeLayer scrim) and holds its open state, so filtering (which is a soft-nav) keeps the
// drawer open. Desktop visibility is a pure-CSS concern (the trigger/scrim hide, the panel is inline).
import { fireEvent, render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FilterDrawer } from './FilterDrawer';

test('trigger shows the active-filter count as a badge (only when > 0)', () => {
  const { getByTestId, rerender } = render(
    <FilterDrawer count={0}>
      <div>sidebar</div>
    </FilterDrawer>,
  );
  expect(getByTestId('filter-trigger').textContent).toBe('Filtrar');
  rerender(
    <FilterDrawer count={3}>
      <div>sidebar</div>
    </FilterDrawer>,
  );
  expect(getByTestId('filter-trigger').textContent).toContain('(3)');
});

test('trigger carries the sliders icon (design source: "▤ Filtrar") to the LEFT of the label (#11)', () => {
  const { getByTestId } = render(
    <FilterDrawer count={2}>
      <div>sidebar</div>
    </FilterDrawer>,
  );
  const trigger = getByTestId('filter-trigger');
  const svg = trigger.querySelector('svg');
  expect(svg).toBeTruthy(); // the filter glyph is present
  // icon first, then the label text (icon on the left).
  expect(trigger.firstElementChild?.tagName.toLowerCase()).toBe('svg');
  expect(trigger.textContent).toContain('Filtrar (2)');
});

test('renders the wrapped sidebar (one copy, shared desktop/mobile)', () => {
  const { getByText } = render(
    <FilterDrawer count={0}>
      <div>the-filters</div>
    </FilterDrawer>,
  );
  expect(getByText('the-filters')).toBeTruthy();
});

test('starts CLOSED with the no-JS :target wiring (trigger anchors to the panel id) — no reload flash', () => {
  const { getByTestId } = render(
    <FilterDrawer count={0}>
      <div>sidebar</div>
    </FilterDrawer>,
  );
  const panel = getByTestId('filter-panel');
  const trigger = getByTestId('filter-trigger');
  // Closed from first render — the flash was the panel starting inline/open then sliding closed on mount.
  expect(panel.hasAttribute('data-open')).toBe(false);
  // The trigger is a real anchor pointing at the panel's id, so with JS off the drawer still opens via :target.
  expect(trigger.tagName).toBe('A');
  expect(trigger.getAttribute('href')).toBe(`#${panel.id}`);
  expect(panel.id).toBeTruthy();
});

test('trigger opens the panel (data-open), scrim and close button close it — never unmounts', () => {
  const { getByTestId } = render(
    <FilterDrawer count={1}>
      <div>sidebar</div>
    </FilterDrawer>,
  );
  const panel = getByTestId('filter-panel');
  const overlay = getByTestId('filter-overlay');
  expect(panel.hasAttribute('data-open')).toBe(false);

  fireEvent.click(getByTestId('filter-trigger'));
  expect(panel.hasAttribute('data-open')).toBe(true);
  expect(overlay.hasAttribute('data-open')).toBe(true);

  fireEvent.click(getByTestId('filter-scrim'));
  expect(panel.hasAttribute('data-open')).toBe(false); // closed, but still mounted

  fireEvent.click(getByTestId('filter-trigger'));
  fireEvent.click(getByTestId('filter-close'));
  expect(panel.hasAttribute('data-open')).toBe(false);
});
