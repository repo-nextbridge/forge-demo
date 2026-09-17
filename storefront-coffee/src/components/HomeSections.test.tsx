// S7-SF-HOME — the two theme blocks that fill the new home slots (CategoryTiles / BrandsGrid). They read CORE
// maps (read.categories / read.brands) and DEGRADE to nothing when empty (never an empty grid). Async server
// components, so the tests call and await them.

import type { BrandMap, CategoryMap } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { render, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { BrandsGrid } from './BrandsGrid';
import { CategoryTiles } from './CategoryTiles';

const categories = vi.fn<() => Promise<CategoryMap | null>>();
const brands = vi.fn<() => Promise<BrandMap | null>>();
vi.mock('@forgeco/storefront-kit/config', () => ({
  readClient: () => ({ categories, brands }),
}));

beforeEach(() => {
  categories.mockReset();
  brands.mockReset();
});

// ── CategoryTiles ────────────────────────────────────────────────────────────────────────────────────────────

test('category tiles render the TOP-LEVEL categories with their icon + link', async () => {
  categories.mockResolvedValue({
    c1: { name: 'Tênis', path: 'tenis', icon_url: 'https://h/tenis.png' },
    c2: { name: 'Botas', path: 'botas' },
    c3: { name: 'Corrida', path: 'tenis.corrida' }, // depth 2 → not a tile
  });
  const { container } = render(await CategoryTiles({ store: 'acme', base: HOST_BASE }));
  const q = within(container);
  expect(q.getByText('Tênis')).toBeTruthy();
  expect(q.getByText('Botas')).toBeTruthy();
  expect(q.queryByText('Corrida')).toBeNull(); // only top-level
  expect(container.querySelector('a[href="/tenis"]')).toBeTruthy();
  expect(container.querySelector('img[src="https://h/tenis.png"]')).toBeTruthy();
});

// ★ IMAGEM-DE-CATEGORIA-NO-SEED — RENAMED from "category tiles fall back to an empty icon slot", which described
// the DEFECT as if it were the feature. It asserted that a category with no icon rendered an empty <span>; that
// span was a bare 44x44 box, and on a row of tiles it reads as a broken image. Measured on the seed: 5 of the 33
// categories carry an icon (the manifest's contract is root-only by design), so the no-art tile is the normal
// case and now has a deliberate look — the category's initial.
//
// WHY THE RULE IS POSITIVE. Every tile must render EITHER art with a real src OR the named empty state; it is
// checked over whatever the store's category map produced, tile by tile, never against a list of handles or file
// names. A list would go green the day a good fix renames those categories — and green while announcing it
// guards. What must NOT grow alongside it: a third branch that renders neither (an unguarded <img> whose src can
// be empty, a `null`, a spacer), or an empty state that stops carrying the initial and becomes a blank box again.
// Both are what this catches; both are what the tile row had before.
test('★ EVERY tile renders art or the NAMED empty state — never a blank box', async () => {
  const map: CategoryMap = {
    c1: { name: 'Tênis', path: 'tenis', icon_url: 'https://h/tenis.png' }, // has art
    c2: { name: 'Botas', path: 'botas' }, // no icon_url at all
    c3: { name: 'Óculos', path: 'oculos', icon_url: '' }, // declared but EMPTY — an <img src=""> is a blank box
    c4: { name: 'Sapatos', path: 'sapatos', icon_url: 'https://h/sapatos.png' },
  };
  categories.mockResolvedValue(map);
  const { container } = render(await CategoryTiles({ store: 'acme', base: HOST_BASE }));

  const tiles = [...container.querySelectorAll('ul li')];
  // The rule is stated over the tiles the store actually produced, so it cannot silently cover fewer than it
  // claims: a filter change that drops tiles has to change this count too.
  expect(tiles.length).toBe(Object.keys(map).length);

  let art = 0;
  let empty = 0;
  for (const tile of tiles) {
    const label = tile.querySelector('span:not([data-category-icon])')?.textContent ?? '';
    expect(label).not.toBe(''); // a tile always names its category — that is what the empty state derives from
    const slots = tile.querySelectorAll('[data-category-icon]');
    expect(slots.length).toBe(1); // exactly one icon slot per tile: no tile without one, none with two
    const slot = slots[0] as HTMLElement;
    if (slot.dataset.categoryIcon === 'art') {
      expect(slot.tagName).toBe('IMG');
      expect(slot.getAttribute('src')).toBeTruthy(); // art means a real address, not `src=""`
      art++;
    } else {
      expect(slot.dataset.categoryIcon).toBe('empty');
      // The empty state is NAMED by what it shows: the category's own initial, upper-cased. A box with no text
      // is exactly the defect this replaces, so an empty textContent fails here.
      expect(slot.textContent).toBe([...label][0]?.toLocaleUpperCase('pt-BR'));
      empty++;
    }
  }
  // Both branches were exercised — a fixture that drifted to all-art would leave the empty state unproven.
  expect(art).toBe(2);
  expect(empty).toBe(2);
});

test('no categories (empty map or port down) → the block renders nothing', async () => {
  categories.mockResolvedValue({});
  expect(await CategoryTiles({ store: 'acme', base: HOST_BASE })).toBeNull();
  categories.mockResolvedValue(null);
  expect(await CategoryTiles({ store: 'acme', base: HOST_BASE })).toBeNull();
});

test('category tiles are capped at 8', async () => {
  const map: CategoryMap = {};
  for (let i = 0; i < 12; i++)
    map[`c${i}`] = { name: `Cat ${String.fromCharCode(65 + i)}`, path: `cat${i}` };
  categories.mockResolvedValue(map);
  const { container } = render(await CategoryTiles({ store: 'acme', base: HOST_BASE }));
  // 8 tiles inside the grid (the "Ver todas" link lives in the header, outside the <ul>).
  expect(container.querySelectorAll('ul a').length).toBe(8);
});

test('category tiles carry a "Ver todas" link to the browse-all surface', async () => {
  categories.mockResolvedValue({ c1: { name: 'Tênis', path: 'tenis' } });
  const { container, getByText } = render(await CategoryTiles({ store: 'acme', base: HOST_BASE }));
  const seeAll = getByText('Ver todas').closest('a');
  expect(seeAll?.getAttribute('href')).toBe('/search');
  // The tile grid still renders inside the <ul>.
  expect(container.querySelectorAll('ul a').length).toBe(1);
});

// ── BrandsGrid ───────────────────────────────────────────────────────────────────────────────────────────────

test('brands render the FEATURED brands (logo or name fallback) linking to /b/<slug>, dropping archived + non-featured', async () => {
  // The home now shows a CURATED set of featured brands (by slug), not every active brand alphabetically.
  brands.mockResolvedValue({
    b1: {
      name: 'Nike', // featured + logo → wordmark image
      slug: 'nike',
      status: 'active',
      logo_media: 'm1',
      logo_url: 'https://h/nike.png',
    },
    b2: { name: 'Adidas', slug: 'adidas', status: 'active', logo_media: null }, // featured, no logo → name fallback
    b3: { name: 'Oculto', slug: 'ugg', status: 'archived', logo_media: null }, // featured slug but archived → dropped
    b4: { name: 'Puma', slug: 'puma', status: 'active', logo_media: null }, // active but NOT featured → dropped
  });
  const { container } = render(await BrandsGrid({ store: 'acme', base: HOST_BASE }));
  const q = within(container);
  expect(container.querySelector('a[href="/b/nike"] img[src="https://h/nike.png"]')).toBeTruthy();
  expect(q.getByText('Adidas')).toBeTruthy(); // no logo → name fallback
  expect(q.queryByText('Oculto')).toBeNull(); // archived dropped
  expect(q.queryByText('Puma')).toBeNull(); // active but not in the featured list → dropped
});

test('no active brands → the block renders nothing', async () => {
  brands.mockResolvedValue({ b: { name: 'X', slug: 'x', status: 'archived', logo_media: null } });
  expect(await BrandsGrid({ store: 'acme', base: HOST_BASE })).toBeNull();
  brands.mockResolvedValue(null);
  expect(await BrandsGrid({ store: 'acme', base: HOST_BASE })).toBeNull();
});
