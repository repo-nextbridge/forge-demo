// ★★★ v04/F6 — THIS SHOP'S CHROME PUBLISHES `footer.end`, IN THE PLACE THE REFERENCE PUBLISHES IT.
//
// ── ⛔ WHAT WENT WRONG, AND WHY NOTHING IN THIS SUITE SAW IT ───────────────────────────────────────────────
//
// The demonstration notice (`demo-setup/demo_ribbon` — "nothing here is charged or shipped") was placed in
// `storefront:footer.end` on the three shops of this box from Compose, and enabled on all three. The two that
// run the vanilla image drew it. THIS ONE DID NOT: it is a fork, it draws its own chrome, and that chrome
// never republished the slot the chrome it replaced was publishing. Every half of the mechanism was in place
// — the app is composed into this build, `lib/extensions/generated/registry.tsx` resolves the block, the port
// answers the placement — and there was no render site in this app for any of it to land in.
//
// Nothing here was red, and nothing could have been: every test of this chrome renders it and asks about what
// it DOES draw. A slot that is missing is an assertion nobody wrote.
//
// ── ★ SO WHAT IS GRADED IS THE PAIR: THE NAME AND THE POSITION ─────────────────────────────────────────────
//
// A slot with the kit's name in a place the kit does not mean would be worse than not having one — Compose's
// board is a map of PLACES, and a merchant who drops a block into "the foot of the footer" has to get the
// foot of the footer. `FooterDefault` (@forgeco/storefront-kit) closes with `<Slot name="footer.end">` as the
// LAST thing inside its `<footer>`, after everything the footer draws itself, and so does this one.
//
// ⛔ AND THE POSITION IS ASSERTED AGAINST THE FOOTER'S OWN LAST LINE, not against a count of children. "It is
// in the footer" is satisfied by a slot published at the TOP of it, which is a different place with the same
// name — the exact defect this file exists to stop from arriving by the other road.
//
// ⇒ SABOTAGE (measured): delete the `<Slot name="footer.end">` from `CoffeeChrome.tsx` and the first test
//   below fails naming the slot; move it ABOVE `.footerInner` and the second one does.

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CoffeeChrome } from './CoffeeChrome';

// The outlet is an async Server Component and React cannot render one here — see the note this stub carries
// in `CoffeeChrome.footer.guard.test.tsx`. It marks the slot it was mounted for, which is what is graded.
vi.mock('@/lib/extensions/ExtensionOutlet', () => ({
  ExtensionOutlet: ({ name }: { name: string }) => <i data-outlet={name} />,
}));

const CAFE = 'sto_01M1DE555TJ36TQB6E9PR5VSJ4';

/** The slot this chrome owes the box's own declaration (`seed/demo-setup.json` → `demo_ribbon`). */
const SLOT = 'footer.end';

function footer(): HTMLElement {
  const { container } = render(
    <CoffeeChrome store={CAFE} base={HOST_BASE}>
      <div />
    </CoffeeChrome>,
  );
  const found = container.querySelector('footer');
  if (!found) throw new Error('the chrome rendered no <footer> — this guard is arguing about a moved door');
  return found as HTMLElement;
}

test(`★★★ the footer publishes the \`${SLOT}\` outlet`, () => {
  expect(
    footer().querySelector(`[data-outlet="${SLOT}"]`),
    `components/coffee/CoffeeChrome.tsx draws no \`${SLOT}\` outlet in its footer. A placement pointing here ` +
      'renders NOTHING and says so nowhere: the port answers it, the admin lists it, and the page simply ' +
      'does not have it. This is how the demonstration notice was missing from this shop while its two ' +
      'siblings wore it.',
  ).not.toBeNull();
});

test('★★ …at the FOOT of it, after the footer’s own last line — the place the reference puts it', () => {
  const el = footer();
  const outlet = el.querySelector(`[data-outlet="${SLOT}"]`);
  const seal = [...el.querySelectorAll('div')].findLast((d) =>
    /compra segura/i.test(d.textContent ?? ''),
  );
  expect(seal, 'the footer no longer closes with its seal, so there is nothing to be after').not.toBeNull();
  expect(outlet).not.toBeNull();
  // `compareDocumentPosition` is the DOM's own answer to "which of these two comes first", and it is the one
  // that keeps working when the footer is restructured — a child index would be asserting today's markup.
  expect(
    // biome-ignore lint/style/noNonNullAssertion: both are asserted non-null one line up.
    seal!.compareDocumentPosition(outlet!) & Node.DOCUMENT_POSITION_FOLLOWING,
    `the \`${SLOT}\` outlet is drawn BEFORE the footer's own last line. It carries the kit's name, so it ` +
      "carries the kit's meaning: `FooterDefault` places it last inside the <footer>, after everything the " +
      'footer draws. A slot with the right name in the wrong place is a Compose board that lies about where ' +
      'a block will land.',
  ).toBeTruthy();
});

test('⛔ THE CONTROL — the stub really marks the outlets, so the assertions above are not vacuous', () => {
  // If the stub stopped setting `data-outlet`, both greens above would become "null is null" and this file
  // would grade nothing. The header of this chrome mounts no outlet, so the footer's is the only one there
  // is — which is itself the claim of the decision comment in `CoffeeChrome.tsx`.
  const outlets = [...footer().ownerDocument.querySelectorAll('[data-outlet]')].map((el) =>
    el.getAttribute('data-outlet'),
  );
  expect(outlets).toEqual([SLOT]);
});
