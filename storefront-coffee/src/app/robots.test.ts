// SEO-FINISH — /robots.txt, per host. The storefront had none at all: the middleware matcher already excluded
// `robots.txt` from the store rewrite, so the path fell through to a 404 and every crawler found the sitemap
// only by luck.
//
// ★ THE `Disallow` THAT IS NOT HERE, AND WHY. The obvious move is `Disallow: /search` — internal search results
// are duplicate-by-parameter and cost crawl budget. It is the wrong move HERE, and the reason is a trap worth
// naming, because the fix looks like the bug's opposite. `/search` already serves `robots: {index: false}`
// (search/page.tsx). Google's doc is explicit: "For the `noindex` rule to be effective, the page or resource
// must not be blocked by a robots.txt file", and "if the page is blocked by a robots.txt file [...] the crawler
// will never see the `noindex` rule". Worse, a blocked URL can still be indexed — "A page that's disallowed in
// robots.txt can still be indexed if linked to from other sites" — just with no content behind it (the
// "Indexed, though blocked by robots.txt" state). So blocking would not tighten anything: it would DISABLE the
// one mechanism keeping /search out of the index and invite a bare URL in its place. The two tools do not
// stack — you pick one. We keep the `noindex`, and robots.txt blocks nothing.
//
// This test pins that absence on purpose. Without it, "the robots.txt looks empty" is an invitation for someone
// to helpfully fill it in six months from now.

import { beforeEach, expect, test, vi } from 'vitest';

const { headersMock, resolveStoreForHost } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  resolveStoreForHost: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: headersMock }));
vi.mock('@forgeco/storefront-kit/config', () => ({ resolveStoreForHost }));

import robots from './robots';

/** A Headers-like stub carrying just the Host of the request under test. */
function onHost(host: string | null) {
  headersMock.mockResolvedValue({ get: (k: string) => (k === 'host' ? host : null) });
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveStoreForHost.mockResolvedValue('sto_a');
});

test('★ robots.txt points at the sitemap of the host that asked — absolute, per store', async () => {
  onHost('loja-a.com.br');
  expect(await robots()).toEqual({
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://loja-a.com.br/sitemap.xml',
  });
});

test('a sibling host gets ITS own sitemap, never the first store to boot (multi-store by construction)', async () => {
  onHost('outlet.example');
  const out = await robots();
  expect(out.sitemap).toBe('https://outlet.example/sitemap.xml');
  expect(JSON.stringify(out)).not.toContain('loja-a.com.br');
});

test('★ NOTHING is disallowed — /search is kept out of the index by its noindex, not by a block', async () => {
  onHost('loja-a.com.br');
  const out = await robots();

  // The whole rule set, flattened: no rule may carry a disallow, and /search may not appear anywhere.
  const rules = Array.isArray(out.rules) ? out.rules : [out.rules];
  for (const rule of rules) expect(rule.disallow).toBeUndefined();
  expect(JSON.stringify(out)).not.toContain('/search');
});

test('a host with no store still serves a valid robots.txt — but advertises no sitemap', async () => {
  onHost('unclaimed.example');
  resolveStoreForHost.mockResolvedValue(undefined);
  // A host that resolves to no store 404s every route, so pointing at /sitemap.xml would advertise a file that
  // is not there. Crawling stays allowed: robots.txt is not an access mechanism.
  expect(await robots()).toEqual({ rules: [{ userAgent: '*', allow: '/' }] });
});

test('no Host header at all → the same inert answer, and the port is never asked', async () => {
  onHost(null);
  expect(await robots()).toEqual({ rules: [{ userAgent: '*', allow: '/' }] });
  expect(resolveStoreForHost).not.toHaveBeenCalled();
});
