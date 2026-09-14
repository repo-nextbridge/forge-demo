// ⛔ THE STORE A BOUNDARY MOVES ITS LINKS TO IS THE ONE THE PORT CONFIRMED — never the one in the address bar.
//
// The not-found and error boundaries get no route params and cannot call `headers()`, so neither can know
// whether the id it is standing in is a store that exists. This answer is where they find out, and a `null`
// here is what stops a boundary pointing "Voltar à loja" into a store nobody has.
//
// ⚠️ AND THE ANSWER CARRIES NO CATALOGUE. This route used to return a chip row of top-level categories for the
// 404 to offer as a way out; the shop wants no browsable category links, so the row and the two reads behind
// it went with it. A test asserting a shelf here would be the row growing back through another door — so the
// guard below is that the body has exactly one key.

import { beforeEach, expect, test, vi } from 'vitest';

const { storeFlags, resolveStoreForHost } = vi.hoisted(() => ({
  storeFlags: vi.fn(),
  resolveStoreForHost: vi.fn(),
}));
vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({ storeFlags }),
  resolveStoreForHost,
}));

import { GET } from './route';

const CAFE = 'sto_cafe';

function call(qs = '') {
  return GET(new Request(`https://loja.test/api/store${qs}`, { headers: { host: 'loja.test' } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveStoreForHost.mockResolvedValue(CAFE);
  storeFlags.mockResolvedValue({ name: 'Café', storefront_enabled: true });
});

test('★★ the answer names the store it RESOLVED — the fact the boundaries cannot learn for themselves', async () => {
  const body = await (await call(`?store=${CAFE}`)).json();
  expect(body.store).toBe(CAFE);
});

test('⛔ a store the port does not know is NOT confirmed, even though the caller named it', async () => {
  storeFlags.mockResolvedValue(null);
  const body = await (await call('?store=sto_nao_existe')).json();
  expect(body).toEqual({ store: null });
});

test('⛔ a REFUSED read is not a confirmation either — a throw may not become a link', async () => {
  storeFlags.mockRejectedValue(new Error('port down'));
  expect(await (await call(`?store=${CAFE}`)).json()).toEqual({ store: null });
});

test('⛔ no store at all — never a guess', async () => {
  resolveStoreForHost.mockResolvedValue(undefined);
  expect(await (await call()).json()).toEqual({ store: null });
});

test('★ MS-M1α — the caller’s explicit store beats the Host, which answers for whoever owns the hostname', async () => {
  await call('?store=sto_outro');
  expect(storeFlags).toHaveBeenCalledWith('sto_outro');
});

test('⛔ the body is a store and nothing else — no shelf comes back through this door', async () => {
  const body = await (await call(`?store=${CAFE}`)).json();
  expect(Object.keys(body)).toEqual(['store']);
});
