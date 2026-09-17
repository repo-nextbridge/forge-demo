// The invalidation hook. Since PERF-B this is what makes "the TTL is a backstop, the event is the authority"
// true of the HTML and not just of the data — so the contract it must keep is: the secret is enforced, EVERY
// tag sent is dropped (one call per event, not one call per tag), and the edge driver is asked afterwards.
//
// That `revalidateTag` really drops a rendered PAGE is a runtime fact of Next's route cache; it is proven
// against a real server in scripts/edge-cache-proof.mjs (price change → cached page → hook → new price).

import { NextRequest } from 'next/server';
import { afterEach, expect, test, vi } from 'vitest';

const { revalidateTag, revalidateSecret, purgeEdge } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  revalidateSecret: vi.fn((): string | undefined => 'shh'),
  purgeEdge: vi.fn(async () => ({ driver: 'none', purged: false })),
}));

vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('@forgeco/storefront-kit/config', () => ({ revalidateSecret }));
vi.mock('@/lib/edge-purge', () => ({ purgeEdge }));

const { POST } = await import('./route');

const call = (query: string, secret: string | null = 'shh') =>
  POST(
    new NextRequest(`https://loja.example/api/revalidate${query}`, {
      method: 'POST',
      headers: secret === null ? {} : { 'x-revalidate-secret': secret },
    }),
  );

afterEach(() => {
  vi.clearAllMocks();
  revalidateSecret.mockReturnValue('shh');
});

test('no secret header → 401, and nothing is invalidated', async () => {
  const res = await call('?tag=store:demo', null);
  expect(res.status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

test('a wrong secret → 401', async () => {
  expect((await call('?tag=store:demo', 'guess')).status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

test('an instance with NO secret configured refuses everything (never open by default)', async () => {
  revalidateSecret.mockReturnValue(undefined);
  expect((await call('?tag=store:demo', 'shh')).status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

test('no tag → 400', async () => {
  const res = await call('');
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ ok: false });
});

test('one tag — the call the admin has always made — still works', async () => {
  const res = await call('?tag=extensions:demo');
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, revalidated: ['extensions:demo'] });
  expect(revalidateTag).toHaveBeenCalledExactlyOnceWith('extensions:demo');
});

test('MANY tags in ONE call: every one is dropped (an event touches more than one)', async () => {
  const res = await call('?tag=store:demo&tag=store:outlet&tag=product:tenis');
  expect(res.status).toBe(200);
  expect(revalidateTag.mock.calls.flat()).toEqual(['store:demo', 'store:outlet', 'product:tenis']);
  expect(await res.json()).toMatchObject({
    ok: true,
    revalidated: ['store:demo', 'store:outlet', 'product:tenis'],
  });
});

test('blank tags are ignored, not invalidated as ""', async () => {
  await call('?tag=&tag=%20&tag=store:demo');
  expect(revalidateTag.mock.calls.flat()).toEqual(['store:demo']);
});

test('the edge driver is asked for the same tags, and its answer is reported', async () => {
  purgeEdge.mockResolvedValueOnce({ driver: 'test', purged: true });
  const res = await call('?tag=store:demo');
  expect(purgeEdge).toHaveBeenCalledWith(['store:demo']);
  expect(await res.json()).toMatchObject({ edge: { driver: 'test', purged: true } });
});

test('a crafted call cannot sweep the whole cache in one request', async () => {
  const many = Array.from({ length: 120 }, (_, i) => `tag=t${i}`).join('&');
  await call(`?${many}`);
  expect(revalidateTag).toHaveBeenCalledTimes(50);
});
