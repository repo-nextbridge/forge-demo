// ⛔ p3-7 · THE WAY OUT OF A 404 MAY NOT BE A SHELF THIS STORE DOES NOT HAVE.
//
// MEASURED on the bench 2026-09-03: the coffee shop's 404 offered *Cafés · Comidas · Especiais da casa ·
// Pra levar* — the four bands of the COUNTER, a sibling store of the same tenant. `read.categories` is
// TENANT-wide by design (it is where the names live), and the only filter this route had was the category's
// own STATE, which is a different question. With one store per tenant the two questions had the same answer;
// with three stores in one tenant the chip row became a menu of empty rooms.
//
// The kernel already answers the second question — `read.category_paths` is the paths THIS store fills — and
// `lib/sitemap-data.ts` learned it first (MT5-A2). These tests pin the PAIR, and the failure posture the
// sitemap chose: a dead assortment read leaves the state filter alone rather than emptying the row.

import { beforeEach, expect, test, vi } from 'vitest';

const { categories, categoryPaths, resolveStoreForHost } = vi.hoisted(() => ({
  categories: vi.fn(),
  categoryPaths: vi.fn(),
  resolveStoreForHost: vi.fn(),
}));
vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({ categories, categoryPaths }),
  resolveStoreForHost,
}));

import { GET } from './route';

const CAFE = 'sto_cafe';

/** The tenant's four bands — the counter's menu, shared by every store of the tenant. */
const TENANT_MAP = {
  cat_1: { name: 'Cafés', path: 'cafes', status: 'active' },
  cat_2: { name: 'Comidas', path: 'comidas', status: 'active' },
  cat_3: { name: 'Especiais da casa', path: 'especiais', status: 'active' },
  cat_4: { name: 'Pra levar', path: 'pra_levar', status: 'active' },
  cat_5: { name: 'Retirados', path: 'retirados', status: 'inactive' },
  cat_6: { name: 'Grãos', path: 'pra_levar.graos', status: 'active' },
};

function call(qs = '') {
  return GET(new Request(`https://loja.test/api/categories${qs}`, { headers: { host: 'loja.test' } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveStoreForHost.mockResolvedValue(CAFE);
  categories.mockResolvedValue(TENANT_MAP);
  categoryPaths.mockResolvedValue([{ path: 'cafes' }, { path: 'pra_levar' }, { path: 'pra_levar.graos' }]);
});

test('★★ only the categories this STORE fills — the tenant-wide map is not the store’s shelf', async () => {
  const body = await (await call()).json();
  expect(body.categories.map((c: { name: string }) => c.name)).toEqual(['Cafés', 'Pra levar']);
});

test('★ and the category’s own STATE still filters — the two predicates answer different questions', async () => {
  // The retired row is in the assortment AND inactive: only the state filter can drop it.
  categoryPaths.mockResolvedValue([{ path: 'cafes' }, { path: 'retirados' }]);
  const body = await (await call()).json();
  expect(body.categories.map((c: { name: string }) => c.name)).toEqual(['Cafés']);
});

test('★ a DEAD assortment read leaves the state filter alone — a thin row beats no way out at all', async () => {
  categoryPaths.mockRejectedValue(new Error('port down'));
  const body = await (await call()).json();
  expect(body.categories).toHaveLength(4); // the four active bands, as before the pair existed
});

// ── the store the port CONFIRMED ─────────────────────────────────────────────────────────────────────────
//
// The not-found boundary gets no route params and cannot call `headers()`, so it cannot know whether the id
// in the address bar is a store that exists. This answer is where it finds out — and a `null` here is what
// stops the fragment pointing "Voltar à loja" into a store nobody has.

test('★★ the answer names the store it RESOLVED — the fact the 404 boundary cannot learn for itself', async () => {
  const body = await (await call(`?store=${CAFE}`)).json();
  expect(body.store).toBe(CAFE);
});

test('⛔ a store the port does not know is NOT confirmed, even though the caller named it', async () => {
  categories.mockResolvedValue(null);
  const body = await (await call('?store=sto_nao_existe')).json();
  expect(body).toEqual({ store: null, categories: [] });
});

test('⛔ no store at all — never a guess', async () => {
  resolveStoreForHost.mockResolvedValue(undefined);
  expect(await (await call()).json()).toEqual({ store: null, categories: [] });
});

test('★ MS-M1α — the caller’s explicit store beats the Host, which answers for whoever owns the hostname', async () => {
  await call('?store=sto_outro');
  expect(categories).toHaveBeenCalledWith('sto_outro');
  expect(categoryPaths).toHaveBeenCalledWith('sto_outro');
});

test('★ the hrefs stay CLEAN, store-independent paths — placing one in an address space is the renderer’s job', async () => {
  const body = await (await call(`?store=${CAFE}`)).json();
  expect(body.categories.map((c: { href: string }) => c.href)).toEqual(['/cafes', '/pra_levar']);
});
