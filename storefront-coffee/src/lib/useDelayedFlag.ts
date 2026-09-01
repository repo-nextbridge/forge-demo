// useDelayedFlag — the delayed-spinner primitive of the fluidity doctrine (S7-SF-FOUNDATION).
//
// Mutations in the storefront are OPTIMISTIC by default (add-to-cart, qty, remove): the UI updates
// immediately and shows NO progress indicator. Only when a response outlives the delay do we admit
// we're waiting — this hook returns `true` only after `active` has been continuously true for
// `delayMs`, and snaps back to `false` the instant `active` clears. Wire an indicator to its return.
//
// Threshold: 1000ms (locked with Renan — "~1s"; the spec's earlier 800ms lean is superseded). A fast
// mutation never flashes a spinner; a slow one earns one at exactly 1s.
'use client';

import { useEffect, useState } from 'react';

/** True only after `active` has been continuously true for `delayMs`; resets to false when `active` clears. */
export function useDelayedFlag(active: boolean, delayMs = 1000): boolean {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    if (!active) {
      setFlag(false);
      return;
    }
    const id = setTimeout(() => setFlag(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);

  return flag;
}
