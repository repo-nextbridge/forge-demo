// SearchBox is a native GET form to the platform search route — no JS needed to reach /search?q=.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { act, createEvent, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SearchBox } from './SearchBox';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('is a GET form to /search with a q field', () => {
  const { getByTestId, getByLabelText } = render(<SearchBox base={HOST_BASE} />);
  const form = getByTestId('search-box') as HTMLFormElement;
  expect(form.getAttribute('action')).toBe('/search');
  expect(form.getAttribute('method')).toBe('get');
  const input = getByLabelText('Buscar produtos') as HTMLInputElement;
  expect(input.name).toBe('q');
});

test('echoes the current query as the default value', () => {
  const { getByLabelText } = render(<SearchBox base={HOST_BASE} defaultValue="tenis" />);
  expect((getByLabelText('Buscar produtos') as HTMLInputElement).value).toBe('tenis');
});

// SF-SUGGEST-429 — the DoD of the card, in one test. The kernel caps the autocomplete at 60 req/min per IP;
// a shopper who types fast (or a store behind one NAT) gets a 429, and the ONE thing that must not happen is
// the shopper finding out. "Nothing the application produces": no exception, no console output, no half-open
// dropdown — and the submitted search untouched, because that is the baseline autocomplete only ever enhances.
//
// ⚠ The component ALREADY degraded this way (it only opens the panel on `res.ok`). This test is not the fix,
// it is the LOCK: the behaviour was never asserted, so nothing stopped a future `setOpen(true)` from moving
// out of the `if` — which is exactly how a silent degrade becomes an error in the shopper's face.
test('★★ a rate-limited suggest never opens the dropdown and never reaches the console', async () => {
  vi.useFakeTimers();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // ⚠ THE BODY IS A FULL RESULT ON PURPOSE, which no real 429 carries. A rate-limited answer with an EMPTY
  // body cannot tell the two failures apart: the panel would stay shut because there is nothing to show, not
  // because the status was respected — and the test would pass against a component that ignores the status
  // entirely (it did, when this was written with an error body; the sabotage stayed green). Answering a
  // renderable payload under a 429 is what makes the assertion discriminate: only reading `res.ok` keeps the
  // panel closed here.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({
        products: [
          {
            handle: 'tenis-x',
            title: 'Tênis X',
            price: 19990,
            compare_at: null,
            image: null,
            category: 'Tênis',
          },
        ],
        categories: [],
      }),
    })),
  );
  const { getByLabelText, getByTestId } = render(<SearchBox base={HOST_BASE} />);
  fireEvent.change(getByLabelText('Buscar produtos'), { target: { value: 'tenis' } });
  await act(async () => void (await vi.advanceTimersByTimeAsync(200))); // 150ms debounce + fetch settle

  expect(getByTestId('suggest-dropdown').hasAttribute('data-open')).toBe(false);
  expect(consoleError, 'the shopper was shown the rate limit').not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
  // The half that must keep working: submitting still reaches the SSR search page.
  const form = getByTestId('search-box') as HTMLFormElement;
  expect(form.getAttribute('action')).toBe('/search');
  expect((getByLabelText('Buscar produtos') as HTMLInputElement).value).toBe('tenis');
  consoleError.mockRestore();
  consoleWarn.mockRestore();
});

test('§2.2 — clicking inside the suggest panel does NOT close it (mousedown preventDefault)', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        products: [
          {
            handle: 'tenis-x',
            title: 'Tênis X',
            price: 19990,
            compare_at: null,
            image: null,
            category: 'Tênis',
          },
        ],
        categories: [],
      }),
    })),
  );
  const { getByLabelText, getByTestId } = render(<SearchBox base={HOST_BASE} />);
  fireEvent.change(getByLabelText('Buscar produtos'), { target: { value: 'tenis' } });
  await act(async () => void (await vi.advanceTimersByTimeAsync(200))); // 150ms debounce + fetch settle
  const panel = getByTestId('suggest-dropdown');
  expect(panel.hasAttribute('data-open')).toBe(true);
  // A mousedown inside the panel is defaultPrevented → the input never blurs → the panel stays open and the
  // subsequent click reaches the link. (The panel also never unmounts — it's a FadeLayer.)
  const ev = createEvent.mouseDown(panel);
  fireEvent(panel, ev);
  expect(ev.defaultPrevented).toBe(true);
});
