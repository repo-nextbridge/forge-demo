// The edge-purge seam. What matters here is that it CANNOT break the invalidation it rides on: the origin
// cache is already dropped by the time a driver is asked, so a driver that fails, hangs on an exception, or
// does not exist must still leave the caller with a clean answer.

import { expect, test, vi } from 'vitest';
import { type EdgePurgeDriver, edgePurgeDriver, purgeEdge } from './edge-purge';

test('the default driver is `none` — the origin is purged, the edge converges on the TTL', () => {
  expect(edgePurgeDriver().name).toBe('none');
});

test('an unknown driver id degrades to `none` instead of crashing the invalidation path', () => {
  const previous = process.env.FORGE_EDGE_PURGE_DRIVER;
  process.env.FORGE_EDGE_PURGE_DRIVER = 'not-a-driver';
  try {
    expect(edgePurgeDriver().name).toBe('none');
  } finally {
    process.env.FORGE_EDGE_PURGE_DRIVER = previous;
  }
});

test('a registered driver is handed every tag, once', async () => {
  const purge = vi.fn(async () => true);
  const driver: EdgePurgeDriver = { name: 'test', purge };
  const result = await purgeEdge(['store:demo', 'product:tenis'], driver);

  expect(purge).toHaveBeenCalledTimes(1);
  expect(purge).toHaveBeenCalledWith(['store:demo', 'product:tenis']);
  expect(result).toEqual({ driver: 'test', purged: true });
});

test('a driver that throws is reported as "not purged", never propagated', async () => {
  const driver: EdgePurgeDriver = {
    name: 'flaky',
    purge: async () => {
      throw new Error('CDN API down');
    },
  };
  await expect(purgeEdge(['store:demo'], driver)).resolves.toEqual({
    driver: 'flaky',
    purged: false,
  });
});

test('no tags → no driver call', async () => {
  const purge = vi.fn(async () => true);
  await purgeEdge([], { name: 'test', purge });
  expect(purge).not.toHaveBeenCalled();
});
