// The minicart's two enrichment slots are DISCOVERED (declared in the manifest, aggregated by the registry) —
// not a hardcoded list. This is the coordination surface COMPOSE reads. If a rename ever drops them from
// discovery, <Slot name="minicart.top"> would throw in dev — this guards the declaration↔render contract.

import { expect, test } from 'vitest';
import { slotRegistry } from '@/templates/registry';

test('minicart.top and minicart.below_items are discovered slots', () => {
  const slots = slotRegistry();
  expect(slots.has('minicart.top')).toBe(true);
  expect(slots.has('minicart.below_items')).toBe(true);
  expect(slots.get('minicart.top')?.template).toBe('minicart');
});
