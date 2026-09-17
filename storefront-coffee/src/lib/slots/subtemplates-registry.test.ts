// ★ Discovery (not an enum): the NEW slots that the header/footer subtemplates declare in their manifests
// are found by the SAME discovery the rest of the front uses — with zero edit to a central list. This mirrors
// lib/slots/registry.test.ts for the subtemplate slots, and asserts the variant record exposes both variants.

import { footerVariants, headerVariants } from '@forgeco/storefront-kit/subtemplates';
import { expect, test } from 'vitest';
import { slotRegistry } from '@/templates/registry';

test('the new subtemplate slots are discovered without editing any central list', () => {
  const reg = slotRegistry();
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
