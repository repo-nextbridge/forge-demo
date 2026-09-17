import type { CatalogList, ProductDoc } from '@forgeco/storefront-kit/read-client';
import { describe, expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import {
  accumLimit,
  accumulateList,
  buildSwatchImages,
  hasMorePages,
  PLP_MAX_PAGES_PER_REQUEST,
  PLP_PAGE_SIZE,
  plpWindow,
} from './plp';

describe('accumLimit — the "carregar mais" page number, carried as a limit (page N asks for N·20)', () => {
  test('grows a page at a time (the window is applied downstream, over the real total)', () => {
    expect(PLP_PAGE_SIZE).toBe(20);
    expect(accumLimit(1)).toBe(20);
    expect(accumLimit(5)).toBe(100);
    expect(accumLimit(6)).toBe(120);
    expect(accumLimit(10)).toBe(200);
  });

  test('a non-positive/garbage page clamps to the first page', () => {
    expect(accumLimit(0)).toBe(20);
    expect(accumLimit(-3)).toBe(20);
    expect(accumLimit(Number.NaN)).toBe(20);
  });
});

describe('plpWindow — the per-request page ceiling (QA20/B11)', () => {
  test('the first pages accumulate exactly as before the ceiling existed', () => {
    expect(PLP_MAX_PAGES_PER_REQUEST).toBe(5);
    expect(plpWindow(1, 653)).toEqual({ firstPage: 1, lastPage: 1, totalPages: 33, from: 1 });
    expect(plpWindow(3, 653)).toEqual({ firstPage: 1, lastPage: 3, totalPages: 33, from: 1 });
    expect(plpWindow(5, 653)).toEqual({ firstPage: 1, lastPage: 5, totalPages: 33, from: 1 });
  });

  test('past the ceiling the window SLIDES — the walk to the end of the catalog is preserved', () => {
    // Page 6 still advances (nothing is unreachable), it just drops page 1 from the render.
    expect(plpWindow(6, 653)).toEqual({ firstPage: 2, lastPage: 6, totalPages: 33, from: 21 });
    expect(plpWindow(33, 653)).toEqual({ firstPage: 29, lastPage: 33, totalPages: 33, from: 561 });
  });

  test('an absurd page clamps to the LAST window, never to an empty page', () => {
    // `?page=999` is the amplification vector: it used to mean "render all 33 pages".
    expect(plpWindow(999, 653)).toEqual({ firstPage: 29, lastPage: 33, totalPages: 33, from: 561 });
    expect(plpWindow(Number.NaN, 653).lastPage).toBe(1);
    expect(plpWindow(0, 653).lastPage).toBe(1);
  });

  test('an empty catalog is one page', () => {
    expect(plpWindow(999, 0)).toEqual({ firstPage: 1, lastPage: 1, totalPages: 1, from: 1 });
  });
});

describe('hasMorePages — whether the "Carregar mais produtos" button shows', () => {
  test('shows while pages remain, hides on the last one', () => {
    expect(hasMorePages(1, 45)).toBe(true);
    expect(hasMorePages(2, 45)).toBe(true);
    expect(hasMorePages(3, 45)).toBe(false);
  });

  test('past the window ceiling the button KEEPS loading — a big category stays fully browsable', () => {
    expect(hasMorePages(5, 250)).toBe(true);
    expect(hasMorePages(12, 250)).toBe(true); // the window slid; the walk goes on
    expect(hasMorePages(13, 250)).toBe(false); // 250/20 = 12.5 → 13 pages
  });
});

describe('accumulateList — pages the port in 20s and concatenates (no single over-max call)', () => {
  /** A fake port serving `total` synthetic products, `limit` per page, recording every call. */
  function tracker(total: number) {
    const calls: { page: number; limit: number; withFacets: boolean }[] = [];
    const fetchPage = (
      page: number,
      limit: number,
      withFacets: boolean,
    ): Promise<CatalogList | null> => {
      calls.push({ page, limit, withFacets });
      const start = (page - 1) * limit;
      const n = Math.max(0, Math.min(limit, total - start));
      const items = Array.from(
        { length: n },
        (_, i) => ({ handle: `p${start + i}` }) as unknown as ProductDoc,
      );
      return Promise.resolve({ items, page, limit, total, facets: undefined });
    };
    return { calls, fetchPage };
  }

  test('page 5 of a 250-item catalog yields the 100 accumulated items, facets only on page 1', async () => {
    const t = tracker(250);
    const list = await accumulateList(t.fetchPage, 5);
    expect(list?.items).toHaveLength(100);
    expect(list?.total).toBe(250);
    expect(t.calls.map((c) => c.page)).toEqual([1, 2, 3, 4, 5]);
    expect(t.calls.every((c) => c.limit === PLP_PAGE_SIZE)).toBe(true);
    expect(t.calls[0]?.withFacets).toBe(true);
    expect(t.calls.slice(1).every((c) => c.withFacets === false)).toBe(true);
  });

  test('page 6 SLIDES the window: 100 items (pages 2..6), page 1 fetched only for total/facets', async () => {
    const t = tracker(250);
    const list = await accumulateList(t.fetchPage, 6);
    expect(list?.items).toHaveLength(100);
    expect(list?.items[0]).toMatchObject({ handle: 'p20' }); // the window starts at page 2
    expect(t.calls.map((c) => c.page)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // ★ QA20/B11 — the amplification vector. `?page=999` on the demo's tênis (653 products) used to walk the
  // WHOLE catalog: 33 port calls and 653 products in ONE html document (8.800.271 bytes, measured on staging).
  test('an absurd ?page= costs a WINDOW, never the catalog: 6 port calls, 100 items', async () => {
    const t = tracker(653);
    const list = await accumulateList(t.fetchPage, 999);
    expect(t.calls).toHaveLength(6); // 1 (total/facets) + the 5 window pages, not 33
    // 93, not 653: the window is pages 29..33 and the last page of a 653-item catalog holds 13.
    expect(list?.items).toHaveLength(93);
    expect(list?.items.length).toBeLessThanOrEqual(PLP_PAGE_SIZE * PLP_MAX_PAGES_PER_REQUEST);
    expect(list?.total).toBe(653); // the count stays honest: the catalog did not shrink
    // Clamped to the LAST window (pages 29..33), so the absurd page lands on the end of the catalog and the
    // shopper is never handed a blank shelf.
    expect(list?.items[0]).toMatchObject({ handle: 'p560' });
    expect(list?.items.at(-1)).toMatchObject({ handle: 'p652' });
  });

  test('stops early when the catalog is exhausted (never over-reads)', async () => {
    const t = tracker(45);
    const list = await accumulateList(t.fetchPage, 6); // asks for page 6, only 3 pages exist
    expect(list?.items).toHaveLength(45);
    expect(t.calls.map((c) => c.page)).toEqual([1, 2, 3]); // 20 + 20 + 5, then stops
  });

  test('a failed first page returns null', async () => {
    const list = await accumulateList(() => Promise.resolve(null), 3);
    expect(list).toBeNull();
  });

  test('uses a pre-fetched first page and only fetches pages 2..N (the search redirect-peek path)', async () => {
    const t = tracker(100);
    const first: CatalogList = {
      items: Array.from({ length: 20 }, (_, i) => ({ handle: `pre${i}` }) as unknown as ProductDoc),
      page: 1,
      limit: 20,
      total: 100,
    };
    const list = await accumulateList(t.fetchPage, 3, first);
    expect(list?.items).toHaveLength(60);
    expect(t.calls.map((c) => c.page)).toEqual([2, 3]); // page 1 was handed in, not re-fetched
    expect(list?.items[0]).toMatchObject({ handle: 'pre0' }); // the handed-in page IS the window's page 1
  });
});

describe('buildSwatchImages — best-effort photo per option value, harvested from the loaded products', () => {
  test('maps an axis value to the first SKU cover carrying it (axis name lowercased)', () => {
    const product: ProductDoc = makeProduct({
      options: [
        {
          id: 'opt_color',
          name: 'Cor',
          position: 0,
          values: [
            { id: 'v_red', value: 'Vermelho', position: 0 },
            { id: 'v_blue', value: 'Azul', position: 1 },
          ],
        },
      ],
      skus: [
        {
          id: 'sku_red',
          code: 'R',
          amount: 5000,
          currency: 'BRL',
          status: 'active',
          name: null,
          ref: null,
          ean: null,
          metadata: {},
          option_values: [
            { option_id: 'opt_color', option_name: 'Cor', value_id: 'v_red', value: 'Vermelho' },
          ],
          // The read port resolves `url` at read-time (S6-IMAGES); the swatch harvest reads that resolved url.
          media: [
            {
              provider_key: 'red',
              kind: 'image',
              role: 'cover',
              position: 0,
              url: 'https://cdn/red.jpg',
            },
          ],
        },
        {
          id: 'sku_blue',
          code: 'B',
          amount: 5000,
          currency: 'BRL',
          status: 'active',
          name: null,
          ref: null,
          ean: null,
          metadata: {},
          option_values: [
            { option_id: 'opt_color', option_name: 'Cor', value_id: 'v_blue', value: 'Azul' },
          ],
          media: [
            {
              provider_key: 'blue',
              kind: 'image',
              role: 'cover',
              position: 0,
              url: 'https://cdn/blue.jpg',
            },
          ],
        },
      ],
    });
    const swatches = buildSwatchImages([product]);
    expect(swatches.cor?.Vermelho).toBe('https://cdn/red.jpg');
    expect(swatches.cor?.Azul).toBe('https://cdn/blue.jpg');
  });

  test('an axis whose SKUs carry no photo yields no swatch map (falls back to text grid)', () => {
    // The fixture's "Tamanho" SKUs have empty media → no swatch entries.
    const swatches = buildSwatchImages([makeProduct()]);
    expect(swatches.tamanho).toBeUndefined();
  });
});
