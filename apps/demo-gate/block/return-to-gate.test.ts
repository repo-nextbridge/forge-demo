// ⛔ THE BACK BUTTON'S THREE CONDITIONS, one test each — because each of them excludes a different way of
// making the visitor's life worse, and two of the three failures are worse than the bug being fixed.
//
// The rule, settled 2026-09-18: entering a shop from the gate and pressing BACK returns to the gate, because
// that is what someone does when they want to see a different shop. See the head of `./return-to-gate` for
// why it cannot simply work, and for the product-side fix this stands in for.

import { beforeEach, expect, test, vi } from 'vitest';
import { markLeavingGate, RETURN_MARK_KEY, shouldReopenGate } from './return-to-gate';

const GATE = 'https://store.exemplo/';

/** jsdom has no navigation timing; every test states the kind of load it is about. */
function arriveBy(type: 'navigate' | 'back_forward' | 'reload'): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type }] as never);
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

test('★★★ the gate marked the exit and the visitor pressed BACK — the gate comes back', () => {
  markLeavingGate(GATE);
  arriveBy('back_forward');
  expect(shouldReopenGate(GATE)).toBe(true);
});

test('⛔ a BACK the gate never sent them on does NOT reopen — a product back to the list stays in the shop', () => {
  // Without the mark this is the common case: somebody browsing, pressing back. Reopening there would be a
  // hoarding dropped in front of a shopper who never asked for it.
  arriveBy('back_forward');
  expect(shouldReopenGate('https://store.exemplo/p/tenis')).toBe(false);
});

test('⛔ an ORDINARY load after the gate sent them away does NOT reopen — this is the trap that matters', () => {
  // The mark is standing (they did come through the gate), but this load is a normal navigation. If the mark
  // alone were enough, the gate would reappear on the first page they opened and the visitor would be stuck
  // going in circles — a worse screen than the one this file exists to fix.
  markLeavingGate(GATE);
  arriveBy('navigate');
  expect(shouldReopenGate(GATE)).toBe(false);
});

test('⛔ a BACK to a DIFFERENT address does not reopen, even with the mark standing', () => {
  markLeavingGate(GATE);
  arriveBy('back_forward');
  expect(shouldReopenGate('https://store.exemplo/colecao/inverno')).toBe(false);
});

test('★★ the query and the fragment do not count — back may bring `/?x` where `/` was left', () => {
  markLeavingGate(GATE);
  arriveBy('back_forward');
  expect(shouldReopenGate('https://store.exemplo/?utm=x#topo')).toBe(true);
});

test('⛔ the mark is CONSUMED — a second back does not reopen the gate again', () => {
  markLeavingGate(GATE);
  arriveBy('back_forward');
  expect(shouldReopenGate(GATE)).toBe(true);
  expect(shouldReopenGate(GATE), 'the mark survived its own use and would fire forever').toBe(false);
});

test('⛔ a reload is not a back — refreshing the shop keeps the shop', () => {
  markLeavingGate(GATE);
  arriveBy('reload');
  expect(shouldReopenGate(GATE)).toBe(false);
});

test('⛔ storage that THROWS never takes the page down — a lost hint costs the back button, nothing else', () => {
  // Private modes and third-party iframes throw on `sessionStorage`. This is a navigation convenience; it may
  // not be the reason a storefront fails to render.
  const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  try {
    arriveBy('back_forward');
    expect(() => markLeavingGate(GATE)).not.toThrow();
    expect(() => shouldReopenGate(GATE)).not.toThrow();
    expect(shouldReopenGate(GATE)).toBe(false);
  } finally {
    if (original) Object.defineProperty(window, 'sessionStorage', original);
  }
});

test('⛔ ANTI-VACUUM — the mark really lands in sessionStorage under the key this file publishes', () => {
  // Every test above is satisfied by two functions that agree with each other and touch nothing. The ribbon
  // and the gate are separate bundles on separate pages; what joins them is this key in this storage.
  markLeavingGate(GATE);
  expect(window.sessionStorage.getItem(RETURN_MARK_KEY)).toBe(GATE);
});
