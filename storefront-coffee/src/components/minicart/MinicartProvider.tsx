// MinicartProvider — the client-side cart state for the storefront chrome: the drawer's open/closed flag and
// the last cart RE-READ (lines + kernel totalizers + unit count). It owns NO truth: every mutation drives the
// port and then RE-READS (CHK-FRONT-1b — the front never computes a total, it relays what read.checkout says).
//
// The port calls arrive as injectable async props (the store-bound Server Actions in production, fakes in the
// e2e). The forge_cart cookie is httpOnly, so the browser cannot read the cart directly — the snapshot is
// seeded on mount by a single `readCart()` (the header counter lights up just after hydration) and refreshed
// after each add/update/remove. Without JS the provider never runs; the counter simply stays hidden and the
// header's plain cart link (and the PDP form's redirect) remain the working fallback.
'use client';

import {
  EMPTY_SNAPSHOT,
  type MinicartSnapshot,
} from '@forgecommerce/storefront-kit/minicart-types';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** The port seam — each call is a store-bound Server Action (or a test fake). */
export type MinicartActions = {
  /** Re-read the cart (read.checkout + the rich join). */
  readCart: () => Promise<MinicartSnapshot>;
  /** cart.add_line — add a SKU (default qty 1; the ProductCard's stepper passes a larger qty). */
  addLine: (skuId: string, qty?: number) => Promise<void>;
  /** cart.update_line — set a line's qty. */
  updateLine: (lineId: string, qty: number) => Promise<void>;
  /** cart.remove_line — drop a line. */
  removeLine: (lineId: string) => Promise<void>;
  /** PROMO — cart.choose_gift, for a gift the shopper gets to pick. Optional: a store with no gift promotion
   * never needs it, and a host that cannot drive it renders the menu read-only instead of a dead button. */
  chooseGift?: (promotionId: string, skuId: string) => Promise<unknown>;
};

/** WHICH port call failed. The channel carries the OPERATION, never the error's own message: that message is
 * internal and English (`command cart.add_line failed: validation_failed — sku not found`, command-client.ts)
 * and a Server Action redacts it in a production build, so it is neither safe nor intact by the time it reaches
 * the browser. Same shape the coupon already takes — a reason on the wire, the sentence from a dictionary
 * (lib/promo/coupon-error.ts). `update`/`remove` name the COMMAND that ran, not the control that was touched:
 * zeroing the qty is a cart.remove_line. */
export type MinicartErrorOp = 'add' | 'update' | 'remove' | 'gift';

/** The last failed action, as the drawer needs to know it. A record, not a diagnosis: nothing here decides what
 * the cart now contains — the failed call changed nothing, and the snapshot is still the port's. */
export type MinicartError = { op: MinicartErrorOp };

type MinicartContextValue = {
  open: boolean;
  /** True only while the drawer is open because an item was just ADDED (§2.3): drives the 4s auto-close +
   * shrinking line. Opening via the header cart icon leaves this false (no timer). */
  openedByAdd: boolean;
  /** Bumped on EVERY add-open (even when the drawer is already open) — the signal the drawer's timer watches to
   * RESTART the 4s countdown + shrink line on each new add (openedByAdd alone doesn't change on a repeat add). */
  addNonce: number;
  busy: boolean;
  /** The last MUTATION that failed, or null — the drawer's channel for telling the shopper the click did not
   * take. CLEANING RULE: cleared at the START of every action (so an action that succeeds can never leave an
   * old failure on screen) and written only when the port call itself refuses; `close()` and `openDrawer()`
   * clear it too (dismissing, or opening by the icon, is not about the add that failed). */
  error: MinicartError | null;
  snapshot: MinicartSnapshot;
  openDrawer: () => void;
  close: () => void;
  refresh: () => Promise<void>;
  /** Add a SKU (default qty 1; the ProductCard's stepper passes a larger qty), re-read, and open the drawer
   * (the PDP "Adicionar ao carrinho" / the card's 2-click add, with JS). */
  addAndOpen: (skuId: string, qty?: number) => Promise<void>;
  /** Change a line's qty; qty < 1 removes the line. Re-reads after. */
  updateQty: (lineId: string, qty: number) => Promise<void>;
  /** PROMO — pick an offered gift, then re-read. Undefined when the host wired no such action. */
  chooseGift?: (promotionId: string, skuId: string) => Promise<void>;
  /** Remove a line, then re-read. */
  remove: (lineId: string) => Promise<void>;
};

const MinicartContext = createContext<MinicartContextValue | null>(null);

/** Consume the minicart context. Throws if used outside the provider (a wiring error, surfaced in dev). */
export function useMinicart(): MinicartContextValue {
  const ctx = useContext(MinicartContext);
  if (!ctx) throw new Error('useMinicart must be used within <MinicartProvider>');
  return ctx;
}

/** Consume the minicart context, tolerating its ABSENCE (returns null). The ProductCard's cart island uses
 * this: in the real storefront it is always inside the provider, but the card also renders in previews / SSR
 * shells / unit tests where no provider is mounted — there the island stays inert instead of throwing. */
export function useOptionalMinicart(): MinicartContextValue | null {
  return useContext(MinicartContext);
}

export function MinicartProvider({
  actions,
  children,
}: {
  actions: MinicartActions;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Why the drawer opened: an add arms the 4s auto-close + shrinking line (§2.3); the header icon does not.
  const [openedByAdd, setOpenedByAdd] = useState(false);
  // Increments on each add-open so the drawer's timer restarts even when the drawer is already open.
  const [addNonce, setAddNonce] = useState(0);
  const [snapshot, setSnapshot] = useState<MinicartSnapshot>(EMPTY_SNAPSHOT);
  // In-flight flag for the awaited port calls (disables the stepper/remove while a mutation settles).
  const [working, setWorking] = useState(false);
  // The last refused mutation (see the cleaning rule on MinicartContextValue.error).
  const [error, setError] = useState<MinicartError | null>(null);

  // The re-read is an URGENT update: the snapshot IS the drawer's content, so it must commit before the open
  // flag flips (a deferred/transition update let the drawer open on stale/empty content — a real race).
  const refresh = useCallback(async () => {
    const next = await actions.readCart();
    setSnapshot(next);
  }, [actions]);

  // Seed the counter once on mount (post-hydration). Failures are swallowed: the counter stays hidden and the
  // fallback link keeps working — a down port never breaks the page (mirrors the read client's degrade-to-null).
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  // Drive one mutation, then RE-READ. `op` names the command for the error channel; `call` is the port call.
  //
  // The channel is written ONLY when the mutation itself refuses. A failed RE-READ leaves it alone on purpose:
  // there the write DID land and only the snapshot is stale, so "não deu certo" would be a lie in the expensive
  // direction — the shopper would add the same line twice. The rejection is still RE-THROWN in both cases: the
  // call sites own it (ProductCardView's catch is what keeps the card open for a retry).
  const run = useCallback(
    async (op: MinicartErrorOp, call: () => Promise<void>) => {
      setWorking(true);
      setError(null); // every new action starts clean — a success can never leave a stale failure on screen
      try {
        try {
          await call();
        } catch (failure) {
          setError({ op });
          throw failure;
        }
        await refresh();
      } finally {
        setWorking(false);
      }
    },
    [refresh],
  );

  const addAndOpen = useCallback(
    async (skuId: string, qty?: number) => {
      // Pass qty ONLY when a caller set it (the card's stepper) — a plain add stays a single-arg call so the
      // PDP's `addLine(skuId)` contract (and its tests) is untouched.
      try {
        await run('add', () =>
          qty === undefined ? actions.addLine(skuId) : actions.addLine(skuId, qty),
        );
      } catch (failure) {
        // The add FAILED — open the drawer ANYWAY: it is where the shopper is told (the error lives inside the
        // minicart, never in a toast or a banner). Deliberately NOT as an add-open: `openedByAdd` is forced
        // FALSE so the 4s auto-close never arms, and the sentence cannot vanish 4s after it appeared. (Forced,
        // not merely left alone: a previous successful add leaves the flag true, and re-opening would then
        // re-arm the countdown on the failure.) It closes like an icon-open — backdrop, or Esc.
        setOpenedByAdd(false);
        setOpen(true);
        throw failure;
      }
      setOpenedByAdd(true);
      setOpen(true);
      setAddNonce((n) => n + 1); // restart the auto-close timer on every add, even if already open
    },
    [run, actions],
  );

  const updateQty = useCallback(
    (lineId: string, qty: number) =>
      // qty < 1 IS a removal, and the channel says so: the command that ran, not the control that was touched.
      qty < 1
        ? run('remove', () => actions.removeLine(lineId))
        : run('update', () => actions.updateLine(lineId, qty)),
    [run, actions],
  );

  const remove = useCallback(
    (lineId: string) => run('remove', () => actions.removeLine(lineId)),
    [run, actions],
  );

  // PROMO — choosing a gift is a cart mutation like any other: drive it, then RE-READ. The gift line the
  // engine sends back is the truth; nothing here decides what the shopper won.
  const chooseGift = useMemo(
    () =>
      actions.chooseGift
        ? async (promotionId: string, skuId: string) => {
            await run('gift', async () => {
              await actions.chooseGift?.(promotionId, skuId);
            });
          }
        : undefined,
    [run, actions],
  );

  const value = useMemo<MinicartContextValue>(
    () => ({
      open,
      openedByAdd,
      addNonce,
      busy: working,
      error,
      snapshot,
      openDrawer: () => {
        setOpenedByAdd(false);
        setOpen(true);
        setError(null); // an icon-open is not about the add that failed
      },
      close: () => {
        setOpen(false);
        setError(null); // closing IS the shopper dismissing it
      },
      refresh,
      addAndOpen,
      updateQty,
      remove,
      chooseGift,
    }),
    [
      open,
      openedByAdd,
      addNonce,
      working,
      error,
      snapshot,
      refresh,
      addAndOpen,
      updateQty,
      remove,
      chooseGift,
    ],
  );

  return <MinicartContext.Provider value={value}>{children}</MinicartContext.Provider>;
}
