// @vitest-environment jsdom
//
// The PDP's stock fragment. Two properties, and both are about what the route must NOT do.
//
// 1. IT MUST NOT TRUNCATE. It used to `.slice(0, 50)` and answer 200. A caller reading that response cannot
//    tell "this variant is sold out" from "this variant I was never told about" — the same ambiguity the port
//    refuses to create, arriving through the BFF instead. FEEDSTOCK made it a refusal.
// 2. IT MUST NOT FAN OUT. One call to the port per request, not one per sku.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const resolveStoreForHost = vi.fn(async (_host?: string | null) => 'sto_1' as string | undefined);
// Typed as the PORT's row (Availability), not as the default impl's shape — the promise the route now carries
// is optional there, and inferring the type from a fixture that omits it would make the fixture the contract.
const availabilityBySkus = vi.fn(
  async (_store: string, ids: readonly string[]): Promise<Availability[]> =>
    ids.map((id) => ({ sku_id: id, warehouse_id: 'wh_default', available: 3 })),
);

vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({ availabilityBySkus }),
  resolveStoreForHost: (host?: string | null) => resolveStoreForHost(host),
}));

import {
  AVAILABILITY_MAX_SKUS,
  type Availability,
} from '@forgecommerce/storefront-kit/read-client';
import { GET } from './route';

const request = (skus: string) =>
  new Request(`https://loja.test/api/availability?skus=${encodeURIComponent(skus)}`, {
    headers: { host: 'loja.test' },
  });

const ids = (n: number) => Array.from({ length: n }, (_, i) => `sku_${i}`);

beforeEach(() => {
  vi.clearAllMocks();
  resolveStoreForHost.mockResolvedValue('sto_1');
  availabilityBySkus.mockImplementation(async (_store: string, list: readonly string[]) =>
    list.map((id) => ({ sku_id: id, warehouse_id: 'wh_default', available: 3 })),
  );
});

describe('the shape the buybox consumes', () => {
  test('a handful of skus → one port call, a map keyed by sku id, never cached', async () => {
    availabilityBySkus.mockResolvedValue([
      { sku_id: 'sku_a', warehouse_id: 'wh_default', available: 7 },
      { sku_id: 'sku_b', warehouse_id: 'wh_default', available: 0 },
    ]);
    const res = await GET(request('sku_a, sku_b'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ availability: { sku_a: 7, sku_b: 0 }, backorder: {} });
    // ★ ONE call, not one per sku — the N+1 this route used to do is what made the batch read worth building.
    expect(availabilityBySkus).toHaveBeenCalledTimes(1);
    expect(availabilityBySkus).toHaveBeenCalledWith('sto_1', ['sku_a', 'sku_b']);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  test('no skus asked → an empty map, and the port is never touched', async () => {
    const res = await GET(request(''));
    expect(await res.json()).toEqual({ availability: {}, backorder: {} });
    expect(availabilityBySkus).not.toHaveBeenCalled();
  });

  test('the port failing degrades to an empty map — the buybox renders as it does with no wiring at all', async () => {
    availabilityBySkus.mockRejectedValue(new Error('port down'));
    const res = await GET(request('sku_a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ availability: {}, backorder: {} });
  });
});

// ★ SF-BACKORDER-NAO-RENDERIZA — the port has answered "buyable, ships in +N days" since the epic, and this
// route dropped it on the floor: it projected the NUMBER only, so the buybox read `available: 0` and drew
// "Esgotado" over stock the shop had explicitly chosen to sell. The promise travels beside the number.
describe('★ the backorder promise rides along with the number', () => {
  test('a sold-out sku the shop still sells carries its promise; an in-stock one carries none', async () => {
    availabilityBySkus.mockResolvedValue([
      { sku_id: 'sku_a', warehouse_id: 'wh_default', available: 7, backorder: null },
      { sku_id: 'sku_b', warehouse_id: 'wh_default', available: 0, backorder: { extra_days: 7 } },
    ]);
    const res = await GET(request('sku_a,sku_b'));
    expect(await res.json()).toEqual({
      availability: { sku_a: 7, sku_b: 0 },
      backorder: { sku_b: { extra_days: 7 } },
    });
  });

  test('selling past zero WITHOUT changing the promise is still a promise (extra_days null ≠ absent)', async () => {
    // The kernel draws this distinction on purpose: null means "buyable, estimate unchanged", never "unknown".
    // Collapsing it into an absent key would put the sku straight back under "Esgotado".
    availabilityBySkus.mockResolvedValue([
      {
        sku_id: 'sku_b',
        warehouse_id: 'wh_default',
        available: 0,
        backorder: { extra_days: null },
      },
    ]);
    const res = await GET(request('sku_b'));
    expect(await res.json()).toEqual({
      availability: { sku_b: 0 },
      backorder: { sku_b: { extra_days: null } },
    });
  });

  test('nobody selling past zero → an empty map, not an absent key', async () => {
    const res = await GET(request('sku_a'));
    expect(await res.json()).toEqual({ availability: { sku_a: 3 }, backorder: {} });
  });
});

describe('★ the ceiling is a refusal, not a slice', () => {
  test('at the ceiling: served, and every id is asked about', async () => {
    const res = await GET(request(ids(AVAILABILITY_MAX_SKUS).join(',')));
    expect(res.status).toBe(200);
    expect(Object.keys((await res.json()).availability)).toHaveLength(AVAILABILITY_MAX_SKUS);
  });

  test('★ one over: 400 carrying the max — NOT a 200 holding the first N', async () => {
    // The assertion that matters is the STATUS. A truncating route answers 200 with exactly `max` entries and
    // looks perfectly healthy from the outside; only "did it refuse" tells the two implementations apart.
    const res = await GET(request(ids(AVAILABILITY_MAX_SKUS + 1).join(',')));
    expect(res.status).toBe(400);
    expect(availabilityBySkus).not.toHaveBeenCalled();
    const body = (await res.json()) as { error: string; availability?: unknown };
    expect(body.availability).toBeUndefined();
    expect(body.error).toContain(String(AVAILABILITY_MAX_SKUS));
  });

  test('the ceiling counts DISTINCT ids — a repeated sku is not a bigger request', async () => {
    const repeated = [...ids(AVAILABILITY_MAX_SKUS), 'sku_0'];
    const res = await GET(request(repeated.join(',')));
    expect(res.status).toBe(200);
    expect(availabilityBySkus.mock.calls[0]?.[1]).toHaveLength(AVAILABILITY_MAX_SKUS);
  });
});
