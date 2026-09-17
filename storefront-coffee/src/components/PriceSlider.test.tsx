// PriceSlider — the dual square-thumb price island (S7-SF-PLP). Bounds come from facets.price; releasing a
// thumb navigates to the price-filtered URL through the same filter-url codec. The GET number-input form is the
// no-JS baseline (rendered until the island mounts). jsdom has no PointerEvent, so we drive the native <input
// type=range> via fireEvent.change + a release event (mouseUp) — the accessible, library-free path.

import { HOST_BASE, storeHref } from '@forgeco/storefront-kit/store-route';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { FilterState } from '@/lib/filters/filter-url';
import { PRICE_COMMIT_DELAY_MS, PriceSlider, priceStep } from './PriceSlider';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const STATE: FilterState = { options: {}, cf: {} };

afterEach(() => {
  vi.useRealTimers();
});

function mount(state: FilterState = STATE, extra?: Record<string, string>) {
  push.mockClear();
  render(
    <PriceSlider
      min={5000}
      max={100000}
      state={state}
      basePath={storeHref(HOST_BASE, '/tenis')}
      extra={extra}
    />,
  );
}

test('once mounted, exposes two range thumbs bounded by the facet price {min,max}', () => {
  mount();
  const min = screen.getByTestId('price-thumb-min') as HTMLInputElement;
  const max = screen.getByTestId('price-thumb-max') as HTMLInputElement;
  expect(min.min).toBe('5000');
  expect(min.max).toBe('100000');
  expect(max.min).toBe('5000');
  expect(max.max).toBe('100000');
});

test('dragging the max thumb and releasing navigates with price_max in cents', () => {
  mount();
  const max = screen.getByTestId('price-thumb-max') as HTMLInputElement;
  fireEvent.change(max, { target: { value: '50000' } });
  fireEvent.mouseUp(max);
  expect(push).toHaveBeenCalledTimes(1);
  expect(String(push.mock.calls[0]?.[0])).toContain('price_max=50000');
});

test('dragging the min thumb and releasing navigates with price_min in cents', () => {
  mount();
  const min = screen.getByTestId('price-thumb-min') as HTMLInputElement;
  fireEvent.change(min, { target: { value: '20000' } });
  fireEvent.mouseUp(min);
  expect(push).toHaveBeenCalledTimes(1);
  expect(String(push.mock.calls[0]?.[0])).toContain('price_min=20000');
});

test('a bound left at the facet extreme is omitted from the URL (no no-op filter noise)', () => {
  mount();
  const min = screen.getByTestId('price-thumb-min') as HTMLInputElement;
  // move min up, leave max at the facet max
  fireEvent.change(min, { target: { value: '30000' } });
  fireEvent.mouseUp(min);
  const url = String(push.mock.calls[0]?.[0]);
  expect(url).toContain('price_min=30000');
  expect(url).not.toContain('price_max=');
});

test('preserves extra params (e.g. the search q) on navigation', () => {
  mount(STATE, { q: 'tenis' });
  const max = screen.getByTestId('price-thumb-max') as HTMLInputElement;
  fireEvent.change(max, { target: { value: '40000' } });
  fireEvent.mouseUp(max);
  expect(String(push.mock.calls[0]?.[0])).toContain('q=tenis');
});

// ★ QA20/B16 — the keyboard defect, COUNTED. Measured by the QA on staging: the rail carried no `step`, so a
// native range steps by 1 — and the unit here is CENTS, so one arrow key moved R$ 0,01 (`price_max=198999 →
// 198998 → 198997`). Worse, every key press committed: 3 keys = 3 navigations, the earlier ones aborted. To
// walk from R$ 1.990 to R$ 1.000 that is ~99.000 key presses and ~99.000 requests. Counting is what separates
// "it got better" from "it is fixed", so these tests count pushes, not feelings.

test('the rail carries a USEFUL step: R$ 20 on the QA range, never one cent', () => {
  push.mockClear();
  render(
    <PriceSlider
      min={10000}
      max={199000}
      state={STATE}
      basePath={storeHref(HOST_BASE, '/tenis')}
    />,
  );
  // BOTH thumbs, always: they are a pair, and a rail is only usable if the two ends step alike (the first
  // version of this test watched the max thumb alone — the sabotage that removed the min thumb's step stayed
  // green).
  const min = screen.getAllByTestId('price-thumb-min')[0] as HTMLInputElement;
  const max = screen.getAllByTestId('price-thumb-max')[0] as HTMLInputElement;
  expect(max.step).toBe('2000'); // R$ 20,00 — ~95 presses cross the whole rail, not 18.900.000
  expect(min.step).toBe('2000');
  expect(priceStep(10000, 199000)).toBe(2000);
});

test('the step scales with the rail and never falls under R$ 1,00', () => {
  expect(priceStep(5000, 100000)).toBe(1000); // R$ 950 span → R$ 10
  expect(priceStep(1000, 6000)).toBe(100); // R$ 50 span → the R$ 1,00 floor
  expect(priceStep(5000, 5000)).toBe(100); // degenerate facet
});

test('ten arrow keys are ONE navigation, and it carries the value the tenth key landed on', () => {
  vi.useFakeTimers();
  mount();
  const max = screen.getAllByTestId('price-thumb-max')[0] as HTMLInputElement;
  for (let i = 1; i <= 10; i += 1) {
    fireEvent.change(max, { target: { value: String(100000 - i * 1000) } });
    fireEvent.keyUp(max, { key: 'ArrowLeft' });
  }
  // Nothing has been requested yet: the shopper is still holding the key.
  expect(push).toHaveBeenCalledTimes(0);
  act(() => void vi.advanceTimersByTime(PRICE_COMMIT_DELAY_MS));
  expect(push).toHaveBeenCalledTimes(1);
  expect(String(push.mock.calls[0]?.[0])).toContain('price_max=90000');
});

test('a drag still commits ONCE, on release, with no debounce lag', () => {
  vi.useFakeTimers();
  mount();
  const max = screen.getAllByTestId('price-thumb-max')[0] as HTMLInputElement;
  fireEvent.mouseDown(max);
  for (const v of ['80000', '70000', '60000']) fireEvent.change(max, { target: { value: v } });
  expect(push).toHaveBeenCalledTimes(0); // a drag in progress never navigates mid-gesture
  fireEvent.mouseUp(max);
  expect(push).toHaveBeenCalledTimes(1);
  expect(String(push.mock.calls[0]?.[0])).toContain('price_max=60000');
  act(() => void vi.advanceTimersByTime(PRICE_COMMIT_DELAY_MS));
  expect(push).toHaveBeenCalledTimes(1); // and the release cancels any pending debounce
});
