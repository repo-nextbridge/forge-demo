// ★★★ THE BROWSER'S BACK BUTTON GIVES THE GATE BACK — and why that needed a mechanism at all.
//
// THE PROBLEM. Clicking a shop leaves the gate and enters the store; pressing BACK does not return to the
// gate, because the gate was never a page — it was a hoarding over the store's own route. And back IS what
// somebody does when they entered one shop and want to see another: they do not go looking for a ribbon.
//
// WHY IT DOES NOT COME BACK BY ITSELF. The gate is not a PAGE, it is a hoarding over the store's route.
// Going through writes the `forge_gate_dismissed` cookie, and the decision to draw the hoarding belongs to
// the PRODUCT (`apps/storefront/src/app/s/[store]/layout.tsx`), which reads only that cookie. So back brings
// the visitor to the same address as before — now with the cookie set, and the store renders instead.
//
// ⛔ AND THAT DECISION IS NOT OURS TO CHANGE. Teaching the server to honour a `?gate` in the URL is the fix
// with no flash, and it lives in the product's kit: it ships in a release, not in this repository. This file
// is the half the DEMO can do on its own, today, and it is entirely client-side.
//
// ── HOW IT WORKS, AT TWO ENDS ─────────────────────────────────────────────────────────────────────────────
//
//   1. the gate, BEFORE leaving, records in `sessionStorage` the address it is leaving from (`markLeavingGate`);
//   2. the ribbon, ON MOUNT on any store page, asks whether this load was a BACK (`shouldReopenGate`). If it
//      was, and the mark is there, and the address matches — it calls `reopen()` and the gate returns.
//
// ⚠️ ALL THREE CONDITIONS ARE NECESSARY, and each rules out a different way of getting this wrong:
//
//   · `back_forward` — without it the ribbon would reopen the gate on every navigation after the first, and
//     the visitor would be trapped: enter the shop, click a product, the gate is back. Unusable.
//   · the MARK — without it any back WITHIN the store (a product back to the list) would reopen the gate.
//     The mark only exists when it was the GATE that sent the visitor away.
//   · the ADDRESS matching — the mark is written on the gate's own origin and `sessionStorage` is per-origin,
//     so it is only readable back on that same face. The comparison closes the case of a visitor who wandered
//     the shop and returned to `/` by another route with the mark still standing.
//
// ⚠️ AND THE COST IS ADMITTED: `reopen()` is a Server Action, so there is a round trip and the store FLASHES
// before the gate comes back. It cannot be avoided from this side — the server is what draws the hoarding.
// That is the price of doing it now instead of waiting for the release, and it was a deliberate choice.
//
// ⛔ NOTHING HERE READS OR WRITES A COOKIE. The mark is a navigation hint, deleted the moment it is used, and
// it survives neither a new tab nor a new session. The cookie stays the product's, written and cleared only
// by the kit's own Server Actions.

/** The mark's key. `sessionStorage`, per origin, gone when the tab closes. */
const KEY = 'forge_gate_left_from';

/** `sessionStorage` throws in private modes and in third-party iframes. A navigation hint never justifies
 *  taking down the page that uses it, so every read and write here is swallowed. */
function store(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** The gate is sending the visitor away FROM HERE. Called on every way through. */
export function markLeavingGate(from: string = window.location.href): void {
  try {
    store()?.setItem(KEY, from);
  } catch {
    /* a lost hint costs the back button, not the page */
  }
}

/** Was this load a BACK to the address the gate sent the visitor away from? Consumes the mark when it answers
 *  yes, so a second back does not reopen the gate again. */
export function shouldReopenGate(now: string = window.location.href): boolean {
  const s = store();
  if (!s) return false;
  let marked: string | null = null;
  try {
    marked = s.getItem(KEY);
  } catch {
    return false;
  }
  if (!marked) return false;
  if (!wasBackForward()) return false;
  if (!sameAddress(marked, now)) return false;
  try {
    s.removeItem(KEY);
  } catch {
    /* the answer is already given; a leftover mark would cost one extra reopen at worst */
  }
  return true;
}

/** Did a back/forward navigation bring this page? */
function wasBackForward(): boolean {
  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return nav?.type === 'back_forward';
  } catch {
    return false;
  }
}

/** The same address, ignoring query and fragment: the visitor left `/` and back may bring `/?x`. */
function sameAddress(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname === ub.pathname;
  } catch {
    return false;
  }
}

/** For the test only: the key, so it does not type it again. */
export const RETURN_MARK_KEY = KEY;
