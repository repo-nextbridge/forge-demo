// ★ The slot mechanism is DISCOVERY, not a hardcoded enum: a slot declared in a template manifest is
// found by the same discovery the app uses, with zero edit to a central list. If the slot set were a
// fixed enum, a newly-declared name would not appear.

import { discoverSlots } from '@forgecommerce/storefront-kit/slots/registry';
import { expect, test } from 'vitest';
import { slotRegistry, TEMPLATE_MANIFESTS } from '@/templates/registry';

test('the real registry discovers the slots declared by the shipped templates', () => {
  const reg = slotRegistry();
  expect(reg.has('pdp.below_gallery')).toBe(true);
  expect(reg.has('pdp.below_buybox')).toBe(true);
  expect(reg.has('pdp.below_cross_sell')).toBe(true); // S7 order fix — the "related" shelf's own body area
  expect(reg.has('list.above_shelf')).toBe(true);
});

test('discovery covers the new templates (home/header/footer) with no central-list change', () => {
  // The SF-PAGES templates declared their slots in their own manifests; the SAME discovery finds them.
  const reg = slotRegistry();
  for (const name of [
    'home.hero',
    'home.below_shelf',
    'header.start',
    'header.end',
    'footer.start',
    'footer.end',
  ]) {
    expect(reg.has(name), `slot ${name} should be discovered`).toBe(true);
  }
  expect(reg.get('header.end')?.template).toBe('header');
});

test("★ CHECKOUT-APP (C1) — the checkout slots are NOT this registry's any more", () => {
  // They were, and the day they stopped is the day the cut landed: `checkoutManifest`, `orderManifest` and
  // `accountManifest` moved with their templates into `apps/checkout`, which aggregates them in its own
  // registry (and asserts them there, in `apps/checkout/src/lib/slots/registry.test.ts`).
  //
  // ⚠️ THE SLOTS DID NOT CHANGE OWNER — the KERNEL still calls them `storefront:checkout.payment`, and every
  // placement already in a tenant's database still points at that target. What changed is which PROCESS
  // discovers and renders them. This assertion exists so that "the vitrine no longer knows them" is a
  // deliberate state somebody wrote down, not a hole somebody will re-fill by reflex.
  const reg = slotRegistry();
  for (const name of ['checkout.payment', 'order.top', 'account.top']) {
    expect(reg.has(name), `${name} belongs to the checkout deployable now`).toBe(false);
  }
  // …and the chrome's slots are in BOTH, because both wear it.
  expect(reg.get('header.end')?.template).toBe('header');
});
test('a NEW slot declared in a template is discovered — no central list / kernel edit', () => {
  // Declaring a slot = adding it to a template manifest. Discovery is a function of the declarations.
  const withNew = [
    ...TEMPLATE_MANIFESTS,
    { template: 'promo', slots: [{ name: 'promo.brand_new' }] },
  ];
  const reg = discoverSlots(withNew);
  expect(reg.has('promo.brand_new')).toBe(true);
  expect(reg.get('promo.brand_new')?.template).toBe('promo');

  // Proof it is not a constant: the same name is absent from the shipped registry until declared.
  expect(slotRegistry().has('promo.brand_new')).toBe(false);
});

test('slot names are global: a duplicate across templates throws (caught, not shadowed)', () => {
  expect(() =>
    discoverSlots([
      { template: 'a', slots: [{ name: 'dup.name' }] },
      { template: 'b', slots: [{ name: 'dup.name' }] },
    ]),
  ).toThrow(/global/);
});
