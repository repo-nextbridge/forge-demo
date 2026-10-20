// The counter's invalidation hook keeps the café's contract, because the kernel posts the same call to every
// target it lists: the secret is enforced, every tag is dropped in one call, and a crafted call is capped.

import { NextRequest } from 'next/server';
import { afterEach, expect, test, vi } from 'vitest';

const { revalidateTag, revalidateSecret } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  revalidateSecret: vi.fn((): string | undefined => 'shh'),
}));

vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('@forgeco/storefront-kit/config', () => ({ revalidateSecret }));

const { POST } = await import('./route');

const call = (query: string, secret: string | null = 'shh') =>
  POST(
    new NextRequest(`http://totem:3000/api/revalidate${query}`, {
      method: 'POST',
      headers: secret === null ? {} : { 'x-revalidate-secret': secret },
    }),
  );

afterEach(() => {
  vi.clearAllMocks();
  revalidateSecret.mockReturnValue('shh');
});

test('no secret header → 401, and nothing is invalidated', async () => {
  expect((await call('?tag=store:balcao', null)).status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

test('a wrong secret → 401', async () => {
  expect((await call('?tag=store:balcao', 'guess')).status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

test('a totem with NO secret configured refuses everything (never open by default)', async () => {
  revalidateSecret.mockReturnValue(undefined);
  expect((await call('?tag=store:balcao', 'shh')).status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

test('no tag → 400', async () => {
  const res = await call('');
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ ok: false });
});

test('MANY tags in ONE call: every one is dropped', async () => {
  const res = await call('?tag=store:a&tag=store:b&tag=product:x');
  expect(res.status).toBe(200);
  expect(revalidateTag.mock.calls.flat()).toEqual(['store:a', 'store:b', 'product:x']);
  expect(await res.json()).toEqual({ ok: true, revalidated: ['store:a', 'store:b', 'product:x'] });
});

test('a tag of a shop this counter never cached still answers 200 — the kernel posts every tenant here', async () => {
  const res = await call('?tag=store:sto_somebody_else');
  expect(res.status).toBe(200);
});

test('blank tags are ignored, not invalidated as ""', async () => {
  await call('?tag=&tag=%20&tag=store:a');
  expect(revalidateTag.mock.calls.flat()).toEqual(['store:a']);
});

test('a crafted call cannot sweep the whole cache in one request', async () => {
  const many = Array.from({ length: 120 }, (_, i) => `tag=t${i}`).join('&');
  await call(`?${many}`);
  expect(revalidateTag).toHaveBeenCalledTimes(50);
});
