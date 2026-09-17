// ★★ THE GUARD THIS FORK DID NOT HAVE, and its absence is why the bag led to the wrong shop.
//
// The kit says it in `store-route.ts`, in writing: a `StoreBase` is `''` when the store is resolved by
// HOST and `/s/<store>` when it is resolved by PATH, and "every link and redirect must repeat it or the
// next request lands in another store". The reference storefront enforces that with a guard of its own.
// This fork was cut from the reference and the guard did not come with it, so three hand-written
// `href="/checkout"` / `href="/account"` sat in the chrome, correct-looking and wrong.
//
// ⚠️ WHY THE GUARD IS A RENDER AND NOT A GREP. A grep for `href="/` would have caught these three and
// would also fail on the day someone writes `href={cond ? '/a' : '/b'}` — and, worse, would pass on
// `href={"/check" + "out"}`. What matters is not how the string is spelled in the source; it is what
// reaches the BROWSER. So the chrome is rendered with a path-scoped base and every href it emits is
// checked. That is the same thing a shopper's browser sees.
//
// ⚠️ AND IT RENDERS WITH BOTH BASES, because the failure is asymmetric. Under HOST_BASE a bare
// `/checkout` is CORRECT, so a test that only rendered host-resolved would be green on the defect. The
// path-scoped render is the one that catches it, and the host-resolved render is what stops the fix from
// over-correcting into `/s//checkout` on a store that has its own DNS.

import { HOST_BASE, pathScopedBase } from '@forgeco/storefront-kit/store-route';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CoffeeChrome } from './CoffeeChrome';

const CAFE = 'sto_01M1DE555TJ36TQB6E9PR5VSJ4';
/** The store this bench's HOST resolves to — the shoe shop. Where a bare `/checkout` actually lands. */
const HOST_RESOLVES_TO = 'the FORGE (shoe) store — this bench serves three stores from one origin';

function hrefs(base: ReturnType<typeof pathScopedBase> | typeof HOST_BASE) {
  const { container } = render(
    <CoffeeChrome store={CAFE} base={base}>
      <div />
    </CoffeeChrome>,
  );
  return [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') as string);
}

/** The in-store destinations the chrome offers. A fragment or an external URL is not one of them. */
const inStore = (list: string[]) => list.filter((h) => h.startsWith('/'));

test('★ every in-store link of the coffee chrome carries the store base', () => {
  const base = pathScopedBase(CAFE);
  const offending = inStore(hrefs(base)).filter((h) => !h.startsWith(`${base}/`) && h !== base);
  expect(
    offending,
    offending.length === 0
      ? ''
      : `these href(s) do not name the store being viewed: ${offending.join(', ')}\n` +
        `  Rendered for the COFFEE store (${CAFE}), they resolve by HOST instead — which on this bench is\n` +
        `  ${HOST_RESOLVES_TO}. A shopper clicking one leaves the shop they are standing in.\n` +
        "  Fix: storeHref(base, '<path>'), the helper every other link in this fork already uses.",
  ).toEqual([]);
});

test('the bag and the account door specifically — the two the shopper clicks', () => {
  const base = pathScopedBase(CAFE);
  const all = hrefs(base);
  expect(all, `the bag must point into ${CAFE}, not at the host's store`).toContain(
    `${base}/checkout`,
  );
  expect(all, `the account door must point into ${CAFE}`).toContain(`${base}/account`);
  // And the bare forms must be GONE, not merely joined by the right ones.
  expect(all).not.toContain('/checkout');
  expect(all).not.toContain('/account');
});

test('host-resolved stores keep CLEAN urls — the fix must not invent a prefix nobody needs', () => {
  // In production each store has its own DNS and the base is ''. Over-correcting to `/s//checkout` here
  // would trade one broken link for another, so this is the other half of the guard, not decoration.
  const all = hrefs(HOST_BASE);
  expect(all).toContain('/checkout');
  expect(all).toContain('/account');
  expect(all.filter((h) => h.startsWith('/s/'))).toEqual([]);
});
