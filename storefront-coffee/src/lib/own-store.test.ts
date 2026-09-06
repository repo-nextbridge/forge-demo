// WHICH STORE THIS IMAGE IS THE FORK OF — the refusals, one case per way the wiring rots.
//
// ⚠️ THE SENTINEL IS THE CASE WORTH HAVING A FILE FOR. `sto_PENDING_SEED` starts with `sto_`, so the obvious
// implementation — "does it look like a store id?" — grades it VALID and keys the overlay on a string no
// store will ever carry. That is a box that has been copied from `.env.example` and never born, and it is
// indistinguishable at runtime from a box whose step 3c is broken. Both must reach nothing.

import { expect, test } from 'vitest';
import { OWN_STORE_ENV, ownStoreId, ownStoreProblem, PENDING_STORE_SENTINEL } from './own-store';

const CAFE = 'sto_01M1JS22WZ4RN8PGH9GG56PJPW';

test('a store id written by box-up is accepted, trimmed', () => {
  expect(ownStoreId({ [OWN_STORE_ENV]: CAFE })).toBe(CAFE);
  expect(ownStoreId({ [OWN_STORE_ENV]: `  ${CAFE}  ` })).toBe(CAFE);
  expect(ownStoreProblem({ [OWN_STORE_ENV]: CAFE })).toBeUndefined();
});

test('★ absent, empty, the sentinel and a HANDLE all resolve to nothing — and each says why', () => {
  const dead: [string, string | undefined, RegExp][] = [
    ['compose never passed it', undefined, /is not set/],
    ['it arrived empty', '', /is not set/],
    ['the box was never born', PENDING_STORE_SENTINEL, /has not been born yet/],
    ['somebody pasted the handle', 'cafe', /not a store ID/],
  ];
  for (const [why, value, expected] of dead) {
    const env = value === undefined ? {} : { [OWN_STORE_ENV]: value };
    expect(ownStoreId(env), why).toBeUndefined();
    expect(ownStoreProblem(env), why).toMatch(expected);
  }
});

test('★ the reason names the variable and the two places that write and deliver it', () => {
  // A warning that says "misconfigured" costs a reader the whole investigation. The one thing an operator
  // needs is where the value is supposed to come from.
  const problem = ownStoreProblem({}) ?? '';
  expect(problem).toContain(OWN_STORE_ENV);
  expect(problem).toContain('bin/box-up.sh');
  expect(problem).toContain('compose.override.yml');
});

test('⛔ the sentinel is spelled exactly as .env.example and bin/box-up.sh spell it', () => {
  // Three copies of this string exist (this file, `.env.example`, `bin/box-up.sh`) and a typo in any of them
  // is silent. `bin/coffee-store-id.guard.mjs` compares them across files; this pins the one in the source.
  expect(PENDING_STORE_SENTINEL).toBe('sto_PENDING_SEED');
});
