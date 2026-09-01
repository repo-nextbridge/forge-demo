// CUST-CLUSTER wave 4 — the identity overlay, on the side the shopper's browser runs.
//
// Every case here is about a MECHANISM rather than about markup. The COLL wave taught that the expensive way:
// two sabotages went green against assertions that only checked a name appeared in the HTML, and a field with
// the right name is not a picker. So these count requests, read headers, and inspect what lands in the DOM.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyIdentityPrices,
  PRICE_APPLIED_ATTR,
  skusOnPage,
} from '@forgecommerce/storefront-kit/prices/apply';
import { beforeEach, expect, test, vi } from 'vitest';
import { batchSkus, fetchIdentityPrices, MY_PRICES_MAX_SKUS } from './overlay';

const here = dirname(fileURLToPath(import.meta.url));
const KERNEL_READ = join(here, '../../../../../packages/core/src/read/customer-capabilities.ts');

const skus = (n: number, prefix = 'sku_') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i.toString().padStart(3, '0')}`);

beforeEach(() => vi.restoreAllMocks());

// ── The ceiling, and what happens above it ──────────────────────────────────────────────────────────────

test('★ the ceiling matches the PORT, read from the kernel source', () => {
  // A mirror that drifts here is a 400 nobody expected: the client would batch in 48s against a port that
  // moved to 24, and every second batch would fail with the page half-overlaid — the exact inconsistency the
  // whole ceiling decision exists to prevent.
  //
  // ⚠️ THE TARBALL GUARD RUNS THIS SUITE FROM A COPY IN /tmp, where the kernel is not a sibling — so the file
  // can be legitimately absent. That is asserted rather than SKIPPED: a silent skip is how a guard stops
  // running and nobody notices, and this house has paid for that twice. Outside the monorepo the case proves
  // it is outside; inside it, it compares.
  if (!existsSync(KERNEL_READ)) {
    expect(
      existsSync(join(here, '../../../../../packages')),
      'the kernel source is missing but this IS the monorepo — the guard would be silently not running',
    ).toBe(false);
    return;
  }
  const source = readFileSync(KERNEL_READ, 'utf8');
  const match = /export const MY_PRICES_MAX_SKUS = (\d+);/.exec(source);
  expect(
    match,
    'MY_PRICES_MAX_SKUS is no longer a literal in the kernel — teach this guard',
  ).not.toBeNull();
  expect(MY_PRICES_MAX_SKUS).toBe(Number(match?.[1]));
});

test('★★ the page is asked about EVERY sku — ceil(N / 48), never a silent truncation', () => {
  // THE DECISION, as arithmetic. Truncating at 48 would leave card 49 showing the anonymous price beside card
  // 48 showing the member one, and a shopper cannot tell "no discount" from "not asked about". Inconsistency
  // inside one page is worse than no overlay at all, so every sku is asked about.
  expect(batchSkus(skus(20))).toHaveLength(1);
  expect(batchSkus(skus(48))).toHaveLength(1);
  expect(batchSkus(skus(49))).toHaveLength(2);
  expect(batchSkus(skus(96))).toHaveLength(2);
  expect(batchSkus(skus(97))).toHaveLength(3);
  // And nothing is dropped on the way.
  expect(batchSkus(skus(49)).flat()).toHaveLength(49);
  expect(new Set(batchSkus(skus(49)).flat()).size).toBe(49);
});

test('no batch ever exceeds the ceiling — the port must never have to refuse us', () => {
  for (const batch of batchSkus(skus(200))) {
    expect(batch.length).toBeLessThanOrEqual(MY_PRICES_MAX_SKUS);
  }
});

test('duplicates collapse — one card repeated is not two questions', () => {
  expect(batchSkus(['a', 'b', 'a', 'b'])).toEqual([['a', 'b']]);
});

// ── The request itself ──────────────────────────────────────────────────────────────────────────────────

test('★ the ORDINARY page is ONE request — and it is never one per product', () => {
  // "One batched request" is what the DoD asks for, and the anti-pattern it forbids is a request per card.
  // Both halves are asserted: 40 cards cost one call, and they never cost 40.
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    calls.push(String(url));
    return new Response('{}', { status: 200 });
  });
  return fetchIdentityPrices(skus(40), fetchImpl as unknown as typeof fetch).then(() => {
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(calls[0]).toContain('/api/my-prices?skus=');
    // And it really carried the whole page: 40 skus in ONE query string, not one call per card.
    expect(decodeURIComponent(calls[0] ?? '').split(',')).toHaveLength(40);
  });
});

test('a page past the ceiling costs ceil(N / 48) requests, not N', async () => {
  const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
  await fetchIdentityPrices(skus(60), fetchImpl as unknown as typeof fetch);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('★ an ANONYMOUS visit gets 204 and nothing is drawn', async () => {
  // The route answers 204 before touching the port, so this is the whole cost of the overlay for a visitor
  // with no session: one empty response, and the page keeps the price it rendered.
  const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
  expect(await fetchIdentityPrices(skus(10), fetchImpl as unknown as typeof fetch)).toEqual({});
});

test('a failed batch degrades to the anonymous price instead of failing the page', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ sku_000: { amount: 1, was: 2, label: 'x' } })),
    )
    .mockRejectedValueOnce(new Error('network'));
  const out = await fetchIdentityPrices(skus(60), fetchImpl as unknown as typeof fetch);
  // The first batch's prices still land; the second batch's cards keep what the HTML shows.
  expect(out.sku_000).toBeDefined();
});

// ── What lands in the DOM ───────────────────────────────────────────────────────────────────────────────

function pageWith(skuIds: string[]): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = skuIds
    .map(
      (id) =>
        `<div data-price-sku="${id}"><s data-price-was>R$ 100,00</s><span data-price-amount>R$ 90,00</span><span data-price-label></span></div>`,
    )
    .join('');
  return root;
}

test('skusOnPage reads the anchors the server stamped', () => {
  expect(skusOnPage(pageWith(['a', 'b']))).toEqual(['a', 'b']);
});

test('★ the overlay rewrites the amount AND the struck price, and marks what it touched', () => {
  const root = pageWith(['a', 'b']);
  const applied = applyIdentityPrices(
    root,
    { a: { amount: 7000, was: 9000, label: 'Member price' } },
    (n) => `R$ ${(n / 100).toFixed(2)}`,
  );
  expect(applied).toBe(1);
  const a = root.querySelector('[data-price-sku="a"]');
  expect(a?.querySelector('[data-price-amount]')?.textContent).toBe('R$ 70.00');
  expect(a?.querySelector('[data-price-was]')?.textContent).toBe('R$ 90.00');
  expect(a?.getAttribute(PRICE_APPLIED_ATTR)).toBe('1');
  // The sku the response did not mention is untouched — no half-applied state.
  const b = root.querySelector('[data-price-sku="b"]');
  expect(b?.querySelector('[data-price-amount]')?.textContent).toBe('R$ 90,00');
  expect(b?.getAttribute(PRICE_APPLIED_ATTR)).toBeNull();
});

test('applying twice changes nothing the second time', () => {
  const root = pageWith(['a']);
  const prices = { a: { amount: 7000, was: 9000, label: 'Member price' } };
  const fmt = (n: number) => `R$ ${n}`;
  expect(applyIdentityPrices(root, prices, fmt)).toBe(1);
  expect(applyIdentityPrices(root, prices, fmt)).toBe(0);
});

test('★★ the LABEL that lands is the promotion’s — a segment name has nowhere to travel', () => {
  // Decision 7: the cluster's name never reaches the storefront. There is no field for it in the payload and
  // none in the anchor, so this asserts the only thing that CAN land: the merchant's own promotion label.
  const root = pageWith(['a']);
  applyIdentityPrices(root, { a: { amount: 1, was: 2, label: 'Clube 10% off' } }, String);
  expect(root.querySelector('[data-price-label]')?.textContent).toBe('Clube 10% off');
  // And the whole DOM never mentions a cluster.
  expect(root.innerHTML.toLowerCase()).not.toContain('cluster');
});

test('markup the overlay does not understand is left exactly as the server rendered it', () => {
  const root = document.createElement('div');
  root.innerHTML = '<div data-price-sku="a"><span>R$ 90,00</span></div>';
  expect(applyIdentityPrices(root, { a: { amount: 1, was: 2, label: 'x' } }, String)).toBe(0);
  expect(root.innerHTML).toContain('R$ 90,00');
});
