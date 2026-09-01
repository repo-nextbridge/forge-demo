// The drawer as a VIEW over the re-read snapshot: rich lines, edit that drives the port + re-reads, a total
// that is RELAYED (never computed on the front — CHK-FRONT-1b), the two declared slots, the empty state, and
// the a11y contract (dialog + Esc). The port is faked; the drawer never touches it directly.

import {
  EMPTY_SNAPSHOT,
  type MinicartSnapshot,
} from '@forgecommerce/storefront-kit/minicart-types';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import { MinicartDrawer } from './MinicartDrawer';
import type { MinicartActions } from './MinicartProvider';
import { MinicartProvider, useMinicart } from './MinicartProvider';

const SNAP: MinicartSnapshot = {
  lines: [
    {
      line_id: 'ln_1',
      sku_id: 'sku_1',
      qty: 2,
      unit_amount: 5000,
      line_total: 10000,
      title: 'Tênis Esportivo',
      variant: 'Preto / 40',
      imageUrl: 'https://cdn.example/media/tenis.jpg',
    },
  ],
  totalizers: [{ id: 'subtotal', name: 'Subtotal', amount: 10000 }],
  // DELIBERATELY not the sum of the lines — proves the drawer RELAYS the kernel total, never computes it.
  totalAmount: 12345,
  currency: 'BRL',
  count: 2,
};

function Opener() {
  const { openDrawer } = useMinicart();
  return (
    <button type="button" data-testid="open" onClick={openDrawer}>
      open
    </button>
  );
}

/** Opens the drawer the way an "Adicionar ao carrinho" does — via addAndOpen, which arms the 4s auto-close. */
function AddOpener() {
  const { addAndOpen } = useMinicart();
  return (
    <button type="button" data-testid="add" onClick={() => addAndOpen('sku_1')}>
      add
    </button>
  );
}

/** Render the drawer inside a provider, then open it. `actions` is the faked port; `top`/`belowItems` are
 * the slot fills. Returns the actions for assertions. */
async function openDrawer(
  over: { actions?: Partial<MinicartActions>; top?: ReactNode; belowItems?: ReactNode } = {},
) {
  const actions: MinicartActions = {
    readCart: vi.fn(async () => SNAP),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
    ...over.actions,
  };
  render(
    <MinicartProvider actions={actions}>
      <Opener />
      <MinicartDrawer base={HOST_BASE} top={over.top} belowItems={over.belowItems} />
    </MinicartProvider>,
  );
  await waitFor(() => expect(actions.readCart).toHaveBeenCalled()); // mount seed done
  fireEvent.click(screen.getByTestId('open'));
  await screen.findByTestId('minicart-drawer');
  return actions;
}

test('RICH lines — photo + name + variant (never a raw sku_id); dialog is accessible', async () => {
  await openDrawer();
  expect(screen.getByText('Tênis Esportivo')).toBeTruthy();
  expect(screen.getByText('Preto / 40')).toBeTruthy();
  // S6-FIXPACK — the line renders the RESOLVED media url (the raw provider_key never reaches an <img src>).
  const img = screen.getByAltText('Tênis Esportivo') as HTMLImageElement;
  expect(img.src).toBe('https://cdn.example/media/tenis.jpg');
  expect(screen.queryByText('sku_1')).toBeNull();
  const dialog = screen.getByTestId('minicart-drawer');
  expect(dialog.getAttribute('role')).toBe('dialog');
});

test('the TOTAL is relayed from the snapshot, not computed from the lines', async () => {
  await openDrawer();
  // 12345 cents = R$ 123,45 — which is NOT 2 × R$ 50,00. If the front summed the lines this would be 100,00.
  expect(screen.getByTestId('minicart-total').textContent).toContain('123,45');
});

test('qty stepper + / − drive cart.update_line and re-read; remove drives cart.remove_line', async () => {
  const actions = await openDrawer();
  fireEvent.click(screen.getByLabelText('Aumentar quantidade'));
  await waitFor(() => expect(actions.updateLine).toHaveBeenCalledWith('ln_1', 3));
  // Each mutation re-reads (readCart called again beyond the mount seed).
  await waitFor(() =>
    expect((actions.readCart as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1),
  );
  fireEvent.click(screen.getByTestId('minicart-line-remove'));
  await waitFor(() => expect(actions.removeLine).toHaveBeenCalledWith('ln_1'));
});

test('removing the last line → the drawer falls to the empty state', async () => {
  let current: MinicartSnapshot = SNAP;
  await openDrawer({
    actions: {
      readCart: vi.fn(async () => current),
      removeLine: vi.fn(async () => {
        current = EMPTY_SNAPSHOT;
      }),
    },
  });
  expect(screen.getByTestId('minicart-line')).toBeTruthy();
  fireEvent.click(screen.getByTestId('minicart-line-remove'));
  await screen.findByTestId('minicart-empty');
  expect(screen.queryByTestId('minicart-line')).toBeNull();
});

test('CTA is a real link to /checkout; the icon-mode backdrop closes it (panel never unmounts)', async () => {
  await openDrawer(); // icon mode → a transparent backdrop closes on an outside click
  expect(screen.getByTestId('minicart-checkout').getAttribute('href')).toBe('/checkout');
  fireEvent.click(screen.getByTestId('minicart-backdrop'));
  // Fluidity doctrine: the panel NEVER unmounts — closing drops data-open on the (persistent) overlay.
  await waitFor(() =>
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(false),
  );
  expect(screen.getByTestId('minicart-drawer')).toBeTruthy(); // still in the DOM, just faded out
});

// r4 #12 — the click-away backdrop now closes the drawer in the ADD-open mode too (not only icon-open).
test('an ADD-opened drawer also closes on an outside (backdrop) click', async () => {
  const actions: MinicartActions = {
    readCart: vi.fn(async () => SNAP),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
  render(
    <MinicartProvider actions={actions}>
      <AddOpener />
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );
  await waitFor(() => expect(actions.readCart).toHaveBeenCalled());
  await act(async () => {
    fireEvent.click(screen.getByTestId('add'));
  });
  await waitFor(() =>
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(true),
  );
  // The backdrop exists in add mode and closes on an outside click.
  fireEvent.click(screen.getByTestId('minicart-backdrop'));
  await waitFor(() =>
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(false),
  );
});

test('Esc closes the drawer', async () => {
  await openDrawer();
  fireEvent.keyDown(screen.getByTestId('minicart-drawer'), { key: 'Escape' });
  await waitFor(() =>
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(false),
  );
});

test('internal slots — a fill renders when present and is invisible when absent (SUBT proof)', async () => {
  await openDrawer({
    top: <div data-testid="top-fill">promo</div>,
    belowItems: <div data-testid="below-fill">cross-sell</div>,
  });
  expect(screen.getByTestId('top-fill')).toBeTruthy();
  expect(screen.getByTestId('below-fill')).toBeTruthy();
});

test('internal slots degrade invisibly when empty (V1)', async () => {
  await openDrawer();
  expect(screen.queryByTestId('top-fill')).toBeNull();
  expect(screen.queryByTestId('below-fill')).toBeNull();
});

// ── §2.3 — minicart-specific interactions ────────────────────────────────────────────────────────────────

test('opened by an ADD → shows the shrinking line and auto-closes after 4s', async () => {
  vi.useFakeTimers();
  try {
    const actions: MinicartActions = {
      readCart: vi.fn(async () => SNAP),
      addLine: vi.fn(async () => {}),
      updateLine: vi.fn(async () => {}),
      removeLine: vi.fn(async () => {}),
    };
    render(
      <MinicartProvider actions={actions}>
        <AddOpener />
        <MinicartDrawer base={HOST_BASE} />
      </MinicartProvider>,
    );
    await act(async () => void (await vi.advanceTimersByTimeAsync(0))); // mount seed
    await act(async () => {
      fireEvent.click(screen.getByTestId('add'));
      await vi.advanceTimersByTimeAsync(0); // settle addLine → refresh → open
    });
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(true);
    // The countdown line only exists when opened by an add.
    expect(screen.getByTestId('minicart-timer')).toBeTruthy();
    // Under the 4s window it stays open; at 4s it auto-closes (data-open drops, node persists).
    await act(async () => void (await vi.advanceTimersByTimeAsync(3999)));
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(true);
    await act(async () => void (await vi.advanceTimersByTimeAsync(1)));
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

test('a REPEAT add (drawer already open) RESTARTS the 4s auto-close from zero', async () => {
  vi.useFakeTimers();
  try {
    const actions: MinicartActions = {
      readCart: vi.fn(async () => SNAP),
      addLine: vi.fn(async () => {}),
      updateLine: vi.fn(async () => {}),
      removeLine: vi.fn(async () => {}),
    };
    render(
      <MinicartProvider actions={actions}>
        <AddOpener />
        <MinicartDrawer base={HOST_BASE} />
      </MinicartProvider>,
    );
    await act(async () => void (await vi.advanceTimersByTimeAsync(0))); // mount seed
    await act(async () => {
      fireEvent.click(screen.getByTestId('add'));
      await vi.advanceTimersByTimeAsync(0); // settle addLine → refresh → open
    });
    // 3s into the first add's window — still open.
    await act(async () => void (await vi.advanceTimersByTimeAsync(3000)));
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(true);
    // A SECOND add restarts the countdown from zero (the o6 fix): without it, the drawer would auto-close ~1s
    // later on the FIRST add's clock. After the restart, 3s more keeps it open (only 3s since the reset)...
    await act(async () => {
      fireEvent.click(screen.getByTestId('add'));
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => void (await vi.advanceTimersByTimeAsync(3000)));
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(true);
    // ...and only closes once the FULL 4s elapses from the second add.
    await act(async () => void (await vi.advanceTimersByTimeAsync(1001)));
    expect(screen.getByTestId('minicart-overlay').hasAttribute('data-open')).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

test('opened by the cart ICON → no auto-close line (no timer)', async () => {
  await openDrawer(); // icon path
  expect(screen.queryByTestId('minicart-timer')).toBeNull();
});

test('the countdown line runs (data-running) and PAUSES when the panel is hovered', async () => {
  const actions: MinicartActions = {
    readCart: vi.fn(async () => SNAP),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
  render(
    <MinicartProvider actions={actions}>
      <AddOpener />
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );
  await waitFor(() => expect(actions.readCart).toHaveBeenCalled());
  fireEvent.click(screen.getByTestId('add'));
  const timer = await screen.findByTestId('minicart-timer');
  // The animation is armed (data-running) and not paused yet. `waitFor`, not a bare assertion: the
  // element is rendered by `openedByAdd` while the attribute is driven by `open`, so there is a render
  // where the timer exists WITHOUT data-running and findBy can resolve on it. Asserting synchronously
  // made this pass locally and fail on a loaded CI runner (main, 2026-08-02).
  await waitFor(() => expect(timer.hasAttribute('data-running')).toBe(true));
  expect(timer.hasAttribute('data-paused')).toBe(false);
  // Hovering the panel freezes the countdown (animation-play-state: paused) — and the JS auto-close in lockstep.
  fireEvent.pointerEnter(screen.getByTestId('minicart-drawer'));
  await waitFor(() =>
    expect(screen.getByTestId('minicart-timer').hasAttribute('data-paused')).toBe(true),
  );
});

test('the "un N" box expands on click to reveal − / +', async () => {
  await openDrawer();
  expect(screen.getByTestId('minicart-qty-box').hasAttribute('data-expanded')).toBe(false);
  fireEvent.click(screen.getByTestId('minicart-line-qty'));
  expect(screen.getByTestId('minicart-qty-box').hasAttribute('data-expanded')).toBe(true);
});

// jsdom ships no PointerEvent (and drops clientX on the fallback event), so drive the drag with native
// events carrying an explicit clientX — the real runtime gets genuine PointerEvents.
function firePointer(el: Element, type: string, clientX: number) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clientX', { value: clientX });
  act(() => {
    el.dispatchEvent(ev);
  });
}

test('mobile swipe past the threshold slides the line out (−110%) then removes it (§10.3)', async () => {
  const actions = await openDrawer();
  const surface = screen.getByTestId('minicart-line-surface');
  firePointer(surface, 'pointerdown', 200);
  firePointer(surface, 'pointermove', 100); // −100px, past the −90 threshold
  firePointer(surface, 'pointerup', 100);
  // It slides fully out first, then the removal fires ~240ms later.
  expect(surface.style.transform).toBe('translateX(-110%)');
  await waitFor(() => expect(actions.removeLine).toHaveBeenCalledWith('ln_1'));
});

// ★ PACK item 13 — the drawer printed ONE row: the word "Subtotal" over `snapshot.totalAmount`, which is the
// TOTAL. With a discount in play those are two different numbers, so a R$ 700,00 product read "Subtotal
// R$ 560,00" with nothing naming the R$ 140,00 that went missing — the same word meaning two things in two
// screens of one flow, which is worse than the missing line: the shopper concludes the product costs something
// else. It now relays the SAME rows the cart column does, and each label says what it means.
const PROMO_SNAP: MinicartSnapshot = {
  ...SNAP,
  totalizers: [
    { id: 'subtotal', name: 'Subtotal', amount: 70000 },
    { id: 'discount:prom_1', name: '20% off Adistar 4', amount: -14000 },
  ],
  totalAmount: 56000,
  pricing: {
    discount_lines: [{ id: 'discount:prom_1', name: '20% off Adistar 4', amount: -14000 }],
    discount_total: 14000,
    shipping_gross: null,
    shipping_discount: 0,
    near_misses: [],
    applied_coupons: [],
    gift_lines: [],
  },
};

test('★ item 13 — "Subtotal" is the SUBTOTAL again, the discount is named, and the total is the total', async () => {
  await openDrawer({ actions: { readCart: vi.fn(async () => PROMO_SNAP) } });
  const rows = screen.getAllByTestId('minicart-totalizer');
  // Intl formats with a NON-BREAKING space after "R$" and a real minus sign; normalise so the assertion is
  // about the words and the numbers, not about which dash the runtime picked.
  const text = rows.map((r) => (r.textContent ?? '').replace(/ /g, ' ').replace(/−/g, '-'));
  expect(text).toEqual(['SubtotalR$ 700,00', '20% off Adistar 4-R$ 140,00']);
  // The row that carries the total is LABELLED Total — the word that used to lie.
  const total = screen.getByTestId('minicart-total');
  expect(total.textContent).toContain('560,00');
  expect(total.parentElement?.textContent).toContain('Total');
  // …and nothing on this surface calls 560,00 a subtotal any more.
  expect(screen.queryByText('R$ 560,00')?.previousElementSibling?.textContent).not.toBe('Subtotal');
});

test("★ item 13 — the drawer DISPLAYS the engine's numbers, it never derives them", async () => {
  // Amounts that are deliberately NOT reconcilable (700 − 140 ≠ 999): a surface that computed anything would
  // print its own arithmetic here. Every number below is the port's, verbatim.
  await openDrawer({
    actions: { readCart: vi.fn(async () => ({ ...PROMO_SNAP, totalAmount: 99900 })) },
  });
  expect(screen.getByTestId('minicart-total').textContent).toContain('999,00');
  expect(screen.getAllByTestId('minicart-totalizer')[0]?.textContent).toContain('700,00');
});

test('the merchant writes the discount label, and the drawer prints it as written', async () => {
  const absurd = 'Cupom ULTIMA10 — R$ 50 off em qualquer par da linha de inverno, válido só hoje';
  await openDrawer({
    actions: {
      readCart: vi.fn(async () => ({
        ...PROMO_SNAP,
        totalizers: [
          { id: 'subtotal', name: 'Subtotal', amount: 70000 },
          { id: 'discount:prom_1', name: absurd, amount: -5000 },
        ],
      })),
    },
  });
  expect(screen.getByText(absurd)).toBeTruthy();
  // Every row is a well-formed money row (label + amount, amount last) — the shared rule reaches it.
  for (const row of document.querySelectorAll('[data-money-row]')) {
    expect(row.querySelector(':scope > [data-money-label]')).toBeTruthy();
    expect(row.lastElementChild?.hasAttribute('data-money-amount')).toBe(true);
  }
});

// Absent `pricing`/discounts (a port at an older commit, or a cart with no promotion) the drawer is the
// pre-PROMO drawer plus one honest word: Subtotal, then Total.
test('with no promotion the footer is just the kernel rows and the total', async () => {
  await openDrawer();
  expect(screen.getAllByTestId('minicart-totalizer')).toHaveLength(1);
  expect(screen.getByTestId('minicart-total').textContent).toContain('123,45');
});

// ★ QA29 · s2b-8 — THE SAME GESTURE, TWO OUTCOMES. On the cart page "−" at quantity 1 is disabled and removal
// is the explicit ×; in this drawer the same click removed the line on the spot, with no confirmation and no
// undo. A shopper who has learnt one of the two surfaces is wrong about the other. The page's rule wins (it is
// the reversible one), so the drawer grows the × it was missing — it had one, but only for a screen reader.
test('★ "−" at quantity 1 does NOT remove the line here either (it is disabled, as on the page)', async () => {
  const single: MinicartSnapshot = {
    ...SNAP,
    lines: SNAP.lines.map((l) => ({ ...l, qty: 1 })),
  };
  const actions = await openDrawer({ actions: { readCart: vi.fn(async () => single) } });
  const minus = screen.getByLabelText('Diminuir quantidade') as HTMLButtonElement;
  expect(minus.disabled).toBe(true);
  fireEvent.click(minus);
  expect(actions.updateLine).not.toHaveBeenCalled();
  expect(actions.removeLine).not.toHaveBeenCalled();
});

test('★ …and removal has a control anyone can see, not one only a screen reader could reach', async () => {
  await openDrawer();
  const remove = screen.getByTestId('minicart-line-remove');
  // Visible: the clipped 1×1 rect that hid it is gone, and it says what it removes.
  expect(remove.className).not.toContain('srRemove');
  expect(remove.getAttribute('aria-label')).toContain('Tênis Esportivo');
});
