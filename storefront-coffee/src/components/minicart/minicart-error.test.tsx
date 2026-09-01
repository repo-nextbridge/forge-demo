// MINICART-ERRO — the shopper finds out that the add failed.
//
// Before this, a failed add produced NOTHING: `run()` had a try/finally with no catch, so the rejection killed
// `addAndOpen`'s `setOpen(true)` (the drawer did not even OPEN) and every call site swallowed what was left
// with `.catch(() => {})`, because `MinicartContextValue` had no error field to send it to.
//
// Two halves are proven here: the CHANNEL and its cleaning rule (the context), and what the shopper actually
// SEES (the drawer opening on the failure and saying so inside itself — never a toast, never a banner).

import { EMPTY_SNAPSHOT } from '@forgecommerce/storefront-kit/minicart-types';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MinicartDrawer } from './MinicartDrawer';
import type { MinicartActions } from './MinicartProvider';
import { MinicartProvider, useMinicart } from './MinicartProvider';

/** The rejection the last driven action handed back to its caller (the re-throw must survive the channel). */
let lastRejection: unknown = null;

function actions(over: Partial<MinicartActions> = {}): MinicartActions {
  return {
    readCart: vi.fn(async () => EMPTY_SNAPSHOT),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
    chooseGift: vi.fn(async () => {}),
    ...over,
  };
}

/** A port call that refuses the way the kernel does — `cart.add_line` answers `validation_failed` for a sku it
 * cannot find (packages/core/src/commands/cart.ts), and the command client wraps that into this message. */
function refuse(command: string) {
  return async () => {
    throw new Error(`command ${command} failed: validation_failed — sku not found`);
  };
}

/** Drives every mutation of the context and publishes the channel. Each button owns the rejection (as the real
 * call sites do) and parks it in `lastRejection` so a test can assert the re-throw still happens. */
function Driver() {
  const { error, addAndOpen, updateQty, remove, chooseGift, close, openDrawer } = useMinicart();
  const own = (p: Promise<unknown>) => {
    p.catch((e) => {
      lastRejection = e;
    });
  };
  return (
    <>
      <span data-testid="error-op">{error ? error.op : 'none'}</span>
      <button type="button" data-testid="add" onClick={() => own(addAndOpen('sku_1'))}>
        add
      </button>
      <button type="button" data-testid="update" onClick={() => own(updateQty('ln_1', 3))}>
        update
      </button>
      <button type="button" data-testid="zero" onClick={() => own(updateQty('ln_1', 0))}>
        zero
      </button>
      <button type="button" data-testid="remove" onClick={() => own(remove('ln_1'))}>
        remove
      </button>
      <button
        type="button"
        data-testid="gift"
        onClick={() => own(chooseGift?.('promo_1', 'sku_2') ?? Promise.resolve())}
      >
        gift
      </button>
      <button type="button" data-testid="close" onClick={close}>
        close
      </button>
      <button type="button" data-testid="open" onClick={openDrawer}>
        open
      </button>
    </>
  );
}

/** Mount the provider over a faked port and wait for the mount seed read to settle. */
async function mount(over: Partial<MinicartActions> = {}) {
  lastRejection = null;
  const acts = actions(over);
  render(
    <MinicartProvider actions={acts}>
      <Driver />
    </MinicartProvider>,
  );
  await waitFor(() => expect(acts.readCart).toHaveBeenCalled());
  return acts;
}

const channel = () => screen.getByTestId('error-op').textContent;

test('a REFUSED add lands on the channel as `add` — and still rejects for its caller', async () => {
  const acts = await mount({ addLine: vi.fn(refuse('cart.add_line')) });
  fireEvent.click(screen.getByTestId('add'));
  await waitFor(() => expect(acts.addLine).toHaveBeenCalledWith('sku_1'));
  await waitFor(() => expect(channel()).toBe('add'));
  // The re-throw is load-bearing: ProductCardView's own catch is what keeps the card open for a retry.
  expect(String((lastRejection as Error)?.message)).toContain('cart.add_line');
});

test('each mutation names ITSELF on the channel — update, remove, zeroing, gift', async () => {
  const acts = await mount({
    updateLine: vi.fn(refuse('cart.update_line')),
    removeLine: vi.fn(refuse('cart.remove_line')),
    chooseGift: vi.fn(refuse('cart.choose_gift')),
  });

  fireEvent.click(screen.getByTestId('update'));
  await waitFor(() => expect(channel()).toBe('update'));

  fireEvent.click(screen.getByTestId('remove'));
  await waitFor(() => expect(channel()).toBe('remove'));

  fireEvent.click(screen.getByTestId('gift'));
  await waitFor(() => expect(channel()).toBe('gift'));

  // Zeroing the qty IS a removal (the provider routes qty < 1 to cart.remove_line): the channel must say the
  // command that actually ran, not the control the shopper touched.
  fireEvent.click(screen.getByTestId('zero'));
  await waitFor(() => expect(channel()).toBe('remove'));
  expect(acts.updateLine).toHaveBeenCalledTimes(1); // the zero click never reached update_line
});

test('CLEANING — a later action that SUCCEEDS wipes the failure (no stale error on screen)', async () => {
  let refused = true;
  await mount({
    addLine: vi.fn(async (skuId: string) => {
      if (refused) throw new Error(`command cart.add_line failed: validation_failed — ${skuId}`);
    }),
  });
  fireEvent.click(screen.getByTestId('add'));
  await waitFor(() => expect(channel()).toBe('add'));

  refused = false;
  fireEvent.click(screen.getByTestId('add'));
  await waitFor(() => expect(channel()).toBe('none'));
});

test('CLEANING — closing the drawer, and re-opening it by the ICON, both drop the failure', async () => {
  await mount({ addLine: vi.fn(refuse('cart.add_line')) });

  fireEvent.click(screen.getByTestId('add'));
  await waitFor(() => expect(channel()).toBe('add'));
  fireEvent.click(screen.getByTestId('close')); // the shopper dismisses it
  expect(channel()).toBe('none');

  fireEvent.click(screen.getByTestId('add'));
  await waitFor(() => expect(channel()).toBe('add'));
  fireEvent.click(screen.getByTestId('open')); // an icon-open is not about the add that failed
  expect(channel()).toBe('none');
});

// ── What the SHOPPER sees: the drawer, opened by the failure, saying so ───────────────────────────────────

/** Mount the drawer over a faked port, with a button that adds the way the PDP does. */
async function mountDrawer(over: Partial<MinicartActions> = {}) {
  lastRejection = null;
  const acts = actions(over);
  render(
    <MinicartProvider actions={acts}>
      <Driver />
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );
  await waitFor(() => expect(acts.readCart).toHaveBeenCalled());
  return acts;
}

const drawerOpen = () => screen.getByTestId('minicart-overlay').hasAttribute('data-open');

test('a REFUSED add OPENS the drawer and says so inside it — the shopper is never left guessing', async () => {
  await mountDrawer({ addLine: vi.fn(refuse('cart.add_line')) });
  // Before the click there is nothing to say, and the drawer is shut.
  expect(screen.queryByTestId('minicart-error')).toBeNull();
  expect(drawerOpen()).toBe(false);

  fireEvent.click(screen.getByTestId('add'));

  // The drawer opens ON THE FAILURE (it used to stay shut: the rejection killed addAndOpen's setOpen).
  await waitFor(() => expect(drawerOpen()).toBe(true));
  const alert = await screen.findByTestId('minicart-error');
  expect(alert.textContent).toBe(
    'Não foi possível adicionar o item ao carrinho agora. Tente de novo em instantes.',
  );
  // It is announced, not just drawn: a shopper on a screen reader hears it without moving focus.
  expect(alert.getAttribute('role')).toBe('alert');
});

// That this sentence is NOT the add's is proven where it can actually be proven — by the add test above, which
// renders a refused add and asserts its own wording. Asserting it here would compare two constants declared in
// this file and pass no matter what the drawer renders.
test('the three EDIT refusals all render ONE shared sentence', async () => {
  await mountDrawer({
    updateLine: vi.fn(refuse('cart.update_line')),
    removeLine: vi.fn(refuse('cart.remove_line')),
    chooseGift: vi.fn(refuse('cart.choose_gift')),
  });
  const EDIT = 'Não foi possível atualizar o carrinho agora. Tente de novo em instantes.';

  for (const control of ['update', 'remove', 'gift'] as const) {
    fireEvent.click(screen.getByTestId(control));
    await waitFor(() => expect(screen.getByTestId('minicart-error').textContent).toBe(EDIT));
    fireEvent.click(screen.getByTestId('close')); // clear it, so the next one cannot pass on a stale render
    await waitFor(() => expect(screen.queryByTestId('minicart-error')).toBeNull());
  }
});

test('the failure-open does NOT arm the 4s auto-close — the sentence cannot vanish while it is read', async () => {
  vi.useFakeTimers();
  try {
    let refused = false;
    const acts = actions({
      addLine: vi.fn(async () => {
        if (refused)
          throw new Error('command cart.add_line failed: validation_failed — sku not found');
      }),
    });
    render(
      <MinicartProvider actions={acts}>
        <Driver />
        <MinicartDrawer base={HOST_BASE} />
      </MinicartProvider>,
    );
    await act(async () => void (await vi.advanceTimersByTimeAsync(0))); // mount seed

    // First a SUCCESSFUL add, so the drawer is in add-mode with the countdown armed…
    await act(async () => {
      fireEvent.click(screen.getByTestId('add'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('minicart-timer')).toBeTruthy();
    await act(async () => void (await vi.advanceTimersByTimeAsync(4000))); // …and let it auto-close.
    expect(drawerOpen()).toBe(false);

    // …now a REFUSED add. It must open the drawer WITHOUT the countdown: an auto-close here would wipe the
    // message off the screen 4s after it appeared, which is the whole point of putting it there.
    refused = true;
    await act(async () => {
      fireEvent.click(screen.getByTestId('add'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(drawerOpen()).toBe(true);
    expect(screen.getByTestId('minicart-error')).toBeTruthy();
    expect(screen.queryByTestId('minicart-timer')).toBeNull();

    // Well past the 4s window: still open, still saying it.
    await act(async () => void (await vi.advanceTimersByTimeAsync(10_000)));
    expect(drawerOpen()).toBe(true);
    expect(screen.getByTestId('minicart-error')).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

test('the message shows on an EMPTY cart too — the first add that fails is the commonest one', async () => {
  // EMPTY_SNAPSHOT: the drawer renders its empty state, and the error must not be trapped inside the
  // "has lines" branch (where a first-add failure would show nothing at all).
  await mountDrawer({ addLine: vi.fn(refuse('cart.add_line')) });
  fireEvent.click(screen.getByTestId('add'));
  await screen.findByTestId('minicart-error');
  expect(screen.getByTestId('minicart-empty')).toBeTruthy();
});

test('a failed RE-READ never marks the channel — the mutation DID happen, only the snapshot is stale', async () => {
  let seeded = false;
  const acts = await mount({
    readCart: vi.fn(async () => {
      if (seeded) throw new Error('read.checkout unreachable');
      seeded = true;
      return EMPTY_SNAPSHOT;
    }),
  });
  fireEvent.click(screen.getByTestId('add'));
  await waitFor(() => expect(acts.addLine).toHaveBeenCalledWith('sku_1'));
  // The re-read blew up (the caller sees the rejection), but the add succeeded: saying "it failed" here would
  // be a lie in the expensive direction — the shopper would add the same line twice.
  await waitFor(() => expect(lastRejection).not.toBeNull());
  expect(channel()).toBe('none');
});
