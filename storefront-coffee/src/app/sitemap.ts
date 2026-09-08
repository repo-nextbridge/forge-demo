// Dynamic sitemap — resolves the store from the request host, then describes everything that store SERVES:
// the home page, its categories, its published CMS pages, its products (in their canonical category-path form)
// its active brands and its collection landings.
//
// THIS FILE IS THE PER-HOST HALF, and that is all it is. The walk, the derivation and the cache live in
// `lib/sitemap-data.ts`, keyed by STORE; what is left here is the one thing that cannot be cached — the origin
// the crawler asked for. One deployment serves many hosts (MS-STORE), so two hosts pointing at the same store
// must share one cache entry and differ only in the `https://<host>` they get prefixed with. Same boundary
// PERF-B drew between `requestOrigin()` and `storeOrigin()`, reached from the other side.
//
// `force-dynamic` STAYS, and it is not what made this slow. The route reads `headers()`, so it is dynamic no
// matter what is declared; the directive only keeps it off the build path (no build-time port fetch). The real
// cost, and why the cache had to go one level down instead of onto the route, is measured in `sitemap-data.ts`
// — read that comment before changing anything here.

import { readClient, resolveStoreForHost } from '@forgecommerce/storefront-kit/config';
import type { MetadataRoute } from 'next';
import { requestOrigin } from '@/lib/seo/origin';
import { sitemapEntries } from '@/lib/sitemap-data';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const req = await requestOrigin();
  if (!req) return [];
  const store = await resolveStoreForHost(req.host);
  if (!store) return [];

  // ★★ pk9/P1 — A STORE WITH NO PUBLIC PAGE HAS NOTHING TO OFFER A CRAWLER. `storefront_enabled: false`
  // is how a store says it is not a street store (a counter, a wholesale desk, a test store), and every URL
  // below would answer 404 for it — `requirePublicStorefront`, mounted in both store-scoped trees. Handing a
  // search engine that list is a lie told in the one file whose entire audience is machines.
  //
  // THIS ROUTE HAS TO ASK FOR ITSELF, and that is the whole reason the line exists here rather than in a
  // layout: `sitemap.xml` is excluded from the middleware matcher and sits above every `[store]` segment, so
  // neither store-scoped tree frames it and their refusal cannot reach it. The fork inherited this file
  // WITHOUT the question and served the full list for a store with no page; `bin/fork-refusal-drift.guard.mjs`
  // is what now notices when that happens again, on this route or on the next one.
  //
  // `=== false` FOR THE REASON THE KIT ITSELF GIVES (read-client.ts, `StoreFlags.storefront_enabled`): the
  // field is optional on the wire, so absent is a kernel older than it — never a store off the street — and
  // `!flags.storefront_enabled` would 404 every store on such an instance.
  if ((await readClient().storeFlags(store))?.storefront_enabled === false) return [];

  return (await sitemapEntries(store)).map((entry) => ({
    url: `${req.origin}${entry.path === '/' ? '/' : entry.path}`,
    changeFrequency: entry.changeFrequency,
    ...(entry.lastModified ? { lastModified: new Date(entry.lastModified) } : {}),
  }));
}
