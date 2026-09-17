// ⛔ p3-7 · EVERY WAY OUT OF THIS 404 STAYS IN THE STORE THE SHOPPER IS STANDING IN.
//
// ── WHAT WAS MEASURED (bench, 2026-09-03, the coffee shop's own 404) ─────────────────────────────────────
// `/s/<cafe>/<slug que não existe>` answered a real, correctly-dressed 404 — and all four of its links left
// the store: "Voltar à loja" → `/`, "Buscar cafés" → `/search`, and a row of category chips → `/cafes`,
// `/comidas`. On this box one Host serves three stores of TWO tenants, so every one of them landed the shopper
// in the shoe shop, from a dead page inside the coffee shop.
//
// The chip row is gone — the shop wants no browsable category links — so what is left to keep in the store is
// the two CTAs. The guard below is still written over the page's anchors AS A SET rather than over their
// names, and that is deliberate: the obvious test ("assert `not-found-home` carries the prefix") passes while
// a third link added next month does not, which is exactly how the chips came to differ from the CTAs in the
// first place — the CTAs were reviewed as a pair and the row arrived later, through another door (a fetch).
// Whatever this component renders, no href may address another store, and nobody has to remember anything.

import { pathScopedBase, HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NotFoundWayOut } from './NotFoundWayOut';

const CAFE = 'sto_01M1DE555TJ36TQB6E9PR5VSJ4';

/** Stand the browser inside a store, the way the shopper reached the dead page. */
function standIn(pathname: string) {
  window.history.replaceState({}, '', pathname);
}

function answer(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response),
  );
}

/** The fetch this fragment makes, once it has been made. */
function calls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
}

beforeEach(() => standIn('/'));
afterEach(() => vi.unstubAllGlobals());

/** Every in-store anchor the fragment drew, as the browser would follow it. */
function hrefs(container: HTMLElement): string[] {
  return [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
}

test('★★ under /s/<store>, NO link on the way out addresses another store — the whole set, not the two CTAs', async () => {
  standIn(`/s/${CAFE}/p/cafe-que-nao-existe`);
  answer({ store: CAFE });
  const { container } = render(<NotFoundWayOut base={HOST_BASE} />);

  const base = pathScopedBase(CAFE);
  await waitFor(() =>
    expect(screen.getByTestId('not-found-home').getAttribute('href')).toBe(base),
  );
  const links = hrefs(container);
  expect(links.length).toBeGreaterThanOrEqual(2); // the set, whatever its size
  const escaped = links.filter((href) => !href.startsWith(`${base}/`) && href !== base);
  expect(
    escaped,
    `these links leave the store the shopper is in: ${escaped.join(' · ')}. Under /s/<store> a link that ` +
      'drops the prefix resolves against the HOST, which on this box is another tenant.',
  ).toEqual([]);
});

test('★ the store home stays the store home — /s/<store>, not /s/<store>/', async () => {
  standIn(`/s/${CAFE}/rota-que-nao-existe`);
  answer({ store: CAFE });
  render(<NotFoundWayOut base={HOST_BASE} />);
  await waitFor(() =>
    expect(screen.getByTestId('not-found-home').getAttribute('href')).toBe(`/s/${CAFE}`),
  );
});

test('★ on a clean host-based URL nothing is prefixed — the Host already IS the answer', async () => {
  standIn('/p/cafe-que-nao-existe');
  // The port answers with the store the HOST resolved; the address bar named none.
  answer({ store: CAFE });
  const { container } = render(<NotFoundWayOut base={HOST_BASE} />);
  await waitFor(() => expect(calls().length).toBe(1));
  expect(hrefs(container).some((href) => href.includes('/s/'))).toBe(false);
});

// ── ⛔ THE CORRECTION IS THE PORT'S TO MAKE, AND THESE ARE THE THREE WAYS IT MUST REFUSE ─────────────────
//
// `/s/<anything>/x` reaches this boundary: the (storefront) layout renders the chrome for whatever id the URL
// carries and never checks it. A base built from `window.location.pathname` alone would therefore point
// "Voltar à loja" INTO a store that does not exist — one dead page turned into two.

test('⛔ a store the port did NOT confirm moves nothing — the address bar is a question, not an answer', async () => {
  standIn('/s/sto_nao_existe/p/x');
  answer({ store: null });
  const { container } = render(<NotFoundWayOut base={HOST_BASE} />);
  await waitFor(() => expect(calls().length).toBe(1));
  expect(hrefs(container)).toEqual(['/', '/search']);
});

test('⛔ a confirmed store that is NOT the one in the address bar moves nothing either', async () => {
  standIn('/s/sto_nao_existe/p/x');
  // The Host's own store answered — a real store, and the wrong one to send this shopper to.
  answer({ store: CAFE });
  const { container } = render(<NotFoundWayOut base={HOST_BASE} />);
  await waitFor(() => expect(calls().length).toBe(1));
  expect(hrefs(container).some((href) => href.includes('/s/'))).toBe(false);
});

test('⛔ a failed fetch leaves the server-rendered CTAs exactly as they were', async () => {
  standIn(`/s/${CAFE}/p/x`);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
  const { container } = render(<NotFoundWayOut base={HOST_BASE} />);
  await waitFor(() => expect(calls().length).toBe(1));
  expect(hrefs(container)).toEqual(['/', '/search']);
});

test('★ the fetch says which store it is standing in — MS-M1α, the leak this page already had once', async () => {
  standIn(`/s/${CAFE}/p/x`);
  answer({ store: CAFE });
  render(<NotFoundWayOut base={HOST_BASE} />);
  await waitFor(() => expect(calls().length).toBe(1));
  expect(String(calls()[0]?.[0])).toBe(`/api/store?store=${CAFE}`);
});

test('⛔ the way out is TWO links — a category row does not grow back after hydration either', async () => {
  standIn(`/s/${CAFE}/p/x`);
  // The port answering with more than a store must not put anything on the page.
  answer({ store: CAFE, categories: [{ name: 'Cafés', href: '/cafes' }] });
  const { container } = render(<NotFoundWayOut base={HOST_BASE} />);
  await waitFor(() => expect(calls().length).toBe(1));
  await waitFor(() =>
    expect(screen.getByTestId('not-found-home').getAttribute('href')).toBe(pathScopedBase(CAFE)),
  );
  expect(hrefs(container)).toHaveLength(2);
});
