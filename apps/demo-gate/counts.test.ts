// ★★★ THE NUMBERS ON THE FIRST SCREEN COME FROM THE PORT — and what happens when the port cannot answer is
// decided HERE, not left to whatever `undefined` renders as.
//
// The design writes each shop's size into its own sentence, and this box is reborn from a dataset that
// changes, so the size cannot be typed. What this file grades is the whole contract of that read:
//
//   · one entry per declared SHOP, always — present and `null` rather than missing, so no reader of the map
//     can confuse "not asked" with "no products";
//   · `0` and `null` are DIFFERENT and stay different (a shop emptied by a bad seed is visible as empty);
//   · every failure — no read base wired, a hostname the directory has not claimed, a refusal, a body that is
//     not a number — degrades that ONE face and nothing else;
//   · the face the visitor is standing on skips the directory hop, because the slot already handed the gate
//     that store's id. That is also the only face that can answer before a box has been promoted.

import { afterEach, expect, test, vi } from 'vitest';
import { readShopCounts } from './counts';
import type { GateFace } from './faces.generated';

const face = (over: Partial<GateFace> & { key: string }): GateFace => ({
  kind: 'shop',
  tenant: 'forgeco',
  store: over.key.split('/')[1] ?? null,
  host: null,
  env: null,
  ...over,
});

const FACES: GateFace[] = [
  face({ key: 'forgeco/forge', host: 'store.example' }),
  face({ key: 'forgeco/outlet', host: 'outlet.example' }),
  face({ key: 'forgeco/admin', kind: 'admin', store: null, host: 'admin.example' }),
];

/** A port that answers the two capabilities this module asks for, out of a host → (id, total) fixture. */
function portWith(stores: Record<string, { id: string; total?: unknown; status?: number }>) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/store.by_host')) {
      const hit = stores[url.searchParams.get('host') ?? ''];
      if (!hit) return new Response('null', { status: 404 });
      return Response.json({ store_id: hit.id });
    }
    if (url.pathname.endsWith('/product_paths')) {
      const hit = Object.values(stores).find((s) => s.id === url.searchParams.get('store'));
      if (!hit) return new Response('null', { status: 404 });
      if (hit.status && hit.status >= 400) return new Response('nope', { status: hit.status });
      return Response.json({ items: [], page: 1, limit: 1, total: hit.total });
    }
    throw new Error(
      `the gate asked for a capability it has no business asking for: ${url.pathname}`,
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FORGE_READ_BASE_URL;
});

test('★ every declared shop is in the answer, and no admin is', async () => {
  process.env.FORGE_READ_BASE_URL = 'http://kernel:3000';
  vi.stubGlobal(
    'fetch',
    portWith({
      'store.example': { id: 'sto_1', total: 2777 },
      'outlet.example': { id: 'sto_2', total: 55 },
    }),
  );
  expect(await readShopCounts({}, FACES)).toEqual({
    'forgeco/forge': 2777,
    'forgeco/outlet': 55,
  });
});

test('⛔ with no read base wired the map is FULL of nulls, never empty and never a guess', async () => {
  // An unset base means this process has no port to ask. Guessing `localhost:3001` would turn a wiring mistake
  // into a connection refused reported as a fact about the shop; an empty map would let a reader think the
  // declaration carries no shops.
  const port = vi.fn();
  vi.stubGlobal('fetch', port);
  expect(await readShopCounts({ here: 'store.example' }, FACES)).toEqual({
    'forgeco/forge': null,
    'forgeco/outlet': null,
  });
  expect(port, 'the gate called the port with no base url').not.toHaveBeenCalled();
});

test('★★ a hostname the directory has not claimed yet degrades ONE face, not the screen', async () => {
  // The state of every bench and of every box before promotion: the declaration names the published hostnames
  // and the directory has claimed none of them.
  process.env.FORGE_READ_BASE_URL = 'http://kernel:3000';
  vi.stubGlobal('fetch', portWith({ 'store.example': { id: 'sto_1', total: 2777 } }));
  expect(await readShopCounts({}, FACES)).toEqual({
    'forgeco/forge': 2777,
    'forgeco/outlet': null,
  });
});

test('★★ the face the visitor is STANDING on skips the directory hop', async () => {
  // `here` is the host the browser asked for and `store` the id the slot handed in for it, so that face needs
  // no lookup — and on a box answering at an address it does not declare, it is the only one that can answer.
  process.env.FORGE_READ_BASE_URL = 'http://kernel:3000';
  const port = portWith({ 'store.example': { id: 'sto_here', total: 41 } });
  vi.stubGlobal('fetch', port);
  const counts = await readShopCounts(
    { here: 'https://STORE.example:8200/tenis', store: 'sto_here' },
    [FACES[0] as GateFace],
  );
  expect(counts['forgeco/forge']).toBe(41);
  expect(
    port.mock.calls.map(([url]) => String(url)),
    'the gate looked a store up in the directory after being handed its id',
  ).toEqual(['http://kernel:3000/v1/read/product_paths?store=sto_here&limit=1']);
});

test('⛔ an id handed in for ANOTHER host is not used — anchored, never a substring', async () => {
  process.env.FORGE_READ_BASE_URL = 'http://kernel:3000';
  vi.stubGlobal('fetch', portWith({ 'store.example': { id: 'sto_1', total: 7 } }));
  const counts = await readShopCounts(
    { here: 'notstore.example', store: 'sto_somebody_else' },
    FACES,
  );
  // The lookalike host is NOT this face, so the id is ignored and the declared hostname is asked about.
  expect(counts['forgeco/forge']).toBe(7);
});

test('⛔ a refusal, a timeout or a body with no total is a null — never a zero and never a throw', async () => {
  process.env.FORGE_READ_BASE_URL = 'http://kernel:3000';
  vi.stubGlobal(
    'fetch',
    portWith({
      'store.example': { id: 'sto_1', status: 429 },
      'outlet.example': { id: 'sto_2', total: 'many' },
    }),
  );
  expect(await readShopCounts({}, FACES)).toEqual({
    'forgeco/forge': null,
    'forgeco/outlet': null,
  });

  // …and a port that is not there at all is the same answer, not an exception out of a Server Component.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }),
  );
  expect(await readShopCounts({}, FACES)).toEqual({
    'forgeco/forge': null,
    'forgeco/outlet': null,
  });
});

test('★ zero is ZERO — a shop that publishes nothing is not a shop nobody could ask about', async () => {
  process.env.FORGE_READ_BASE_URL = 'http://kernel:3000';
  vi.stubGlobal('fetch', portWith({ 'store.example': { id: 'sto_1', total: 0 } }));
  const counts = await readShopCounts({}, FACES);
  expect(counts['forgeco/forge']).toBe(0);
  expect(counts['forgeco/forge']).not.toBeNull();
});

test('★★ the gate asks the PUBLIC read face, and asks it for one row', async () => {
  // The gate consents to no scope (`manifest.ts`), so the only face it may use is the anonymous one — and the
  // budget on that face is the shop's, shared by every visitor. `limit=1` is what keeps a count from being a
  // page of catalogue; `product_paths` is the cheapest row that carries a total.
  process.env.FORGE_READ_BASE_URL = 'http://kernel:3000/';
  const port = portWith({ 'store.example': { id: 'sto_1', total: 3 } });
  vi.stubGlobal('fetch', port);
  await readShopCounts({}, [FACES[0] as GateFace]);
  const asked = port.mock.calls.map(([url]) => String(url));
  expect(asked).toEqual([
    'http://kernel:3000/v1/read/store.by_host?host=store.example',
    'http://kernel:3000/v1/read/product_paths?store=sto_1&limit=1',
  ]);
});
