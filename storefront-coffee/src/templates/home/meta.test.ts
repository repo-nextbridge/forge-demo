// QA-PACK-1 C3 — the home shipped the developer's placeholder title.
//
// `<title>Forge Storefront</title>` and "the reference storefront consuming the read port", in English, on the
// most-linked page of a Brazilian store — while every other page already said the store's name. It is what
// Google indexes and what WhatsApp shows when the link is pasted, so the one page a merchant shares by hand
// was the one page that did not carry their name.
//
// The cause was not a bad title, it was NO title: `homeMetadata()` declared only the canonical and og:type, so
// the value fell through to the root layout's placeholder — which is correct for a chrome-less root (`/`, the
// 404) and wrong for a store home. The store's public display name comes from read.store_flags, the same read
// the theme already makes for the store clock.
//
// ⚠️ The read must be the CACHED one. `/c/[store]` is the edge-cacheable twin, and a single uncached fetch
// anywhere in its render — `generateMetadata` included — makes Next serve the whole route dynamically. That is
// asserted here as a source fact, because the failure is invisible in a unit test and expensive in production.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { KIT_SRC } from '@/test/kit-source';

const storeFlags = vi.fn(async (_store: string) => ({
  name: 'Loja Demo',
  timezone: 'America/Sao_Paulo',
}));
vi.mock('@forgecommerce/storefront-kit/config', () => ({ readClient: () => ({ storeFlags }) }));

test('★ the home titles itself with the STORE, never with "Forge Storefront"', async () => {
  const { homeMetadata } = await import('./HomeView');
  const meta = await homeMetadata('sto_a');

  expect(meta.title).toContain('Loja Demo');
  expect(JSON.stringify(meta)).not.toContain('Forge Storefront');
  // og carries it too — the share card is half the reason this matters.
  expect(JSON.stringify(meta.openGraph)).toContain('Loja Demo');
  // What was already right stays right.
  expect(meta.alternates?.canonical).toBe('/');
});

test('the store name is asked for ONCE, of read.store_flags (the read the theme already makes)', async () => {
  storeFlags.mockClear();
  const { homeMetadata } = await import('./HomeView');
  await homeMetadata('sto_a');
  expect(storeFlags).toHaveBeenCalledWith('sto_a');
  expect(storeFlags).toHaveBeenCalledTimes(1);
});

test('a store whose flags cannot be read degrades to the neutral title, never to a broken one', async () => {
  storeFlags.mockResolvedValueOnce(null as never);
  const { homeMetadata } = await import('./HomeView');
  const meta = await homeMetadata('sto_a');
  // No name to show: the page still has a title, and it is not the developer's placeholder.
  expect(typeof meta.title).toBe('string');
  expect(JSON.stringify(meta)).not.toContain('Forge Storefront');
});

test('⚠️ the home metadata uses the CACHED read — an uncached one would kill the edge cache of the route', () => {
  // read-client exposes both: `read` (ISR-tagged) and `readFresh` (no-store). `storeFlags` is the cached one,
  // and this pins the reason rather than the spelling: if it ever moves to readFresh, `/c/[store]` silently
  // stops being cacheable and every home render hits the port.
  const client = readFileSync(join(KIT_SRC, 'read-client.ts'), 'utf8');
  const decl = client.slice(client.indexOf('storeFlags(store: string)'));
  const body = decl.slice(0, decl.indexOf('},'));
  expect(body).toContain('read<StoreFlags>');
  expect(body).not.toContain('readFresh');
});
