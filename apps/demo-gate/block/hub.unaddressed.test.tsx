// ★★★ THE ANTI-VACUUM FOR THE HUB'S ONE INVISIBLE STATE: a destination the box declares and declares no
// ADDRESS for. It is a file of its own because the only honest way to grade it is to give the screen a
// generated module that HAS such a face — and this tree has none, so the assertion next door would be a green
// over nothing. «A guard that stays green while blind is worse than no guard.»
//
// This is also the sabotage the slice is proved by, held as a permanent rule: delete a `domain` from
// `seed/box.json`, run `node bin/gate-faces.mjs --write`, and the card must still be on the screen SAYING what
// it could not address. A card that quietly disappeared would be a demo with a door nobody can find and
// nothing anywhere saying which one.

import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { HUB } from '../i18n';

vi.mock('../faces.generated', () => {
  const faces = [
    {
      key: 'forgeco/forge',
      kind: 'shop' as const,
      tenant: 'forgeco',
      store: 'forge',
      host: 'store.example',
      env: 'FORGE_DOMAIN',
    },
    // ⛔ THE SUBJECT: declared, and with no address at all.
    {
      key: 'forgeco/outlet',
      kind: 'shop' as const,
      tenant: 'forgeco',
      store: 'outlet',
      host: null,
      env: null,
    },
    {
      key: 'forgeco/admin',
      kind: 'admin' as const,
      tenant: 'forgeco',
      store: null,
      host: null,
      env: null,
    },
  ];
  const GATE_TENANTS = [{ id: 'forgeco', name: 'Forge', faces }];
  return { GATE_TENANTS, GATE_FACES: faces };
});

const noop = async () => {};

test('★★★ a shop with no declared address is DRAWN and NAMED, never dropped', async () => {
  const { GateHub } = await import('./hub');
  const { container } = render(<GateHub lang="pt" here="store.example" dismiss={noop} />);

  // It is still a card…
  const card = container.querySelector('[data-face="forgeco/outlet"]');
  expect(card, 'the unaddressed shop vanished from the screen').toBeTruthy();
  // …it carries no link and no way to leave…
  expect(card?.querySelector('a')).toBeNull();
  // …and it says WHICH destination this is and WHAT is missing.
  const named = container.querySelector('[data-unaddressed="forgeco/outlet"]');
  expect(named, 'the missing address is not named').toBeTruthy();
  expect(named?.textContent).toContain('forgeco/outlet');
  expect(named?.textContent).toContain(HUB.pt.noAddress);
});

test('★★ an ADMIN with no declared address is a row that says so, not a dead link', async () => {
  const { GateHub } = await import('./hub');
  const { container } = render(<GateHub lang="pt" here="store.example" dismiss={noop} />);
  const row = container.querySelector('[data-face="forgeco/admin"]');
  expect(row?.tagName, 'the admin row is still an anchor, so it opens `null/enter`').not.toBe('A');
  expect(container.querySelector('[data-unaddressed="forgeco/admin"]')?.textContent).toContain(
    HUB.pt.noAddress,
  );
});

test('⛔ and the face that DOES have an address is unaffected — the control', async () => {
  const { GateHub } = await import('./hub');
  const { container } = render(<GateHub lang="pt" here="elsewhere.example" dismiss={noop} />);
  expect(
    container.querySelector('[data-face="forgeco/forge"] a')?.getAttribute('href'),
    'the addressed shop lost its link too, so the rule above is about the screen and not about the address',
  ).toBe('https://store.example');
  expect(container.querySelector('[data-unaddressed="forgeco/forge"]')).toBeNull();
});
