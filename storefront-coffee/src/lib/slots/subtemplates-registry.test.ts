// ★ Discovery (not an enum): the NEW slots that the header/footer subtemplates declare in their manifests
// are found by the SAME discovery the rest of the front uses — with zero edit to a central list. This mirrors
// lib/slots/registry.test.ts for the subtemplate slots, and asserts the variant record exposes both variants.

import { footerVariants, headerVariants } from '@forgeco/storefront-kit/subtemplates';
import { expect, test } from 'vitest';
import { knownSlotRegistry } from '@/templates/registry';

test('the new subtemplate slots are discovered without editing any central list', () => {
  // ★ MZ-9 — asked of the KNOWN registry (what <Slot> accepts), not the published one: this fork renders the
  // kit's header and footer only in its gallery and its control, and publishes none of their slots but the
  // `footer.end` <CoffeeChrome> draws. The published half is `CoffeeChrome.slots.guard.test.ts`'s.
  const reg = knownSlotRegistry();
  for (const name of ['header.announcement', 'header.account', 'header.minicart', 'footer.aside']) {
    expect(reg.has(name), `slot ${name} should be discovered`).toBe(true);
  }
  // The moved subtemplates still own their pre-existing slots (regression).
  expect(reg.get('header.account')?.template).toBe('header');
  expect(reg.get('footer.aside')?.template).toBe('footer');
});

test('the variant record exposes both header and footer variants', () => {
  expect(Object.keys(headerVariants).sort()).toEqual(['checkout', 'default']);
  expect(Object.keys(footerVariants).sort()).toEqual(['checkout', 'default']);
});
