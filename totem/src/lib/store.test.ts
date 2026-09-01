// The counter points at ONE store, and pointing it at the wrong one must fail loudly at boot rather than
// quietly serve somebody else's shop. See `store.ts` for the measurement that forced the two variables.
import { describe, expect, it } from 'vitest';
import { resolveTotemStore } from './store';

const ok = {
  FORGE_TOTEM_STORE_ID: 'sto_01M1EWQFH253ZE5WKJDAEZ6PNJ',
  FORGE_TOTEM_STORE_HANDLE: 'balcao',
} as NodeJS.ProcessEnv;

describe('resolveTotemStore', () => {
  it('returns the id the port is scoped by and the handle a human reads', () => {
    expect(resolveTotemStore(ok)).toEqual({
      id: 'sto_01M1EWQFH253ZE5WKJDAEZ6PNJ',
      handle: 'balcao',
    });
  });

  it('refuses a HANDLE pasted into the id slot — the mistake the two-variable shape invites', () => {
    expect(() => resolveTotemStore({ ...ok, FORGE_TOTEM_STORE_ID: 'balcao' })).toThrow(/not a store ID/);
  });

  it('refuses a missing id rather than serving a counter pointed at nothing', () => {
    expect(() => resolveTotemStore({ FORGE_TOTEM_STORE_HANDLE: 'balcao' })).toThrow(
      /FORGE_TOTEM_STORE_ID/,
    );
  });

  it('refuses a missing handle: an id alone is not something a human can review', () => {
    expect(() => resolveTotemStore({ FORGE_TOTEM_STORE_ID: ok.FORGE_TOTEM_STORE_ID })).toThrow(
      /FORGE_TOTEM_STORE_HANDLE/,
    );
  });

  it('tolerates the whitespace a copy-paste into an .env leaves behind', () => {
    expect(
      resolveTotemStore({
        FORGE_TOTEM_STORE_ID: '  sto_01M1EWQFH253ZE5WKJDAEZ6PNJ  ',
        FORGE_TOTEM_STORE_HANDLE: ' balcao ',
      }).id,
    ).toBe('sto_01M1EWQFH253ZE5WKJDAEZ6PNJ');
  });
});
