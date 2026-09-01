// SEO-FINISH — /robots.txt, resolved per host like the sitemap beside it. There was none: the middleware
// matcher already excluded `robots.txt` from the store rewrite, so the path fell straight through to a 404 and
// nothing ever told a crawler where the sitemap lived. `force-dynamic` keeps it off the build path and lets one
// deployment answer for every store it serves (host → store is data — MS-STORE).
//
// ★ IT DISALLOWS NOTHING, DELIBERATELY. `Disallow: /search` is the reflex — internal search results are
// duplicate-by-parameter and eat crawl budget — and it is the wrong tool here. `/search` already ships
// `robots: {index: false}`. Google's doc: "For the `noindex` rule to be effective, the page or resource must not
// be blocked by a robots.txt file", and "if the page is blocked by a robots.txt file [...] the crawler will
// never see the `noindex` rule". A blocked URL can also still be indexed — "A page that's disallowed in
// robots.txt can still be indexed if linked to from other sites" — as a bare URL with no content
// ("Indexed, though blocked by robots.txt"). Blocking would therefore switch OFF the only thing keeping /search
// out of the index and offer an empty listing in exchange. The two mechanisms do not stack; you choose one.
// We keep the `noindex`. If a future crawl-budget problem ever makes blocking the right call, the `noindex` on
// the search route has to come off in the same commit — they are one decision, not two.
//
// robots.txt is also not an access mechanism: the demo's gate blocks by itself, so nothing here emits noindex on
// its behalf.

import { resolveStoreForHost } from '@forgecommerce/storefront-kit/config';
import type { MetadataRoute } from 'next';
import { requestOrigin } from '@/lib/seo/origin';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const rules = [{ userAgent: '*', allow: '/' }];
  const req = await requestOrigin();
  if (!req) return { rules };

  // A host claimed by no store 404s every route; advertising its /sitemap.xml would point crawlers at a file
  // that is not served. Crawling stays allowed either way.
  const store = await resolveStoreForHost(req.host);
  if (!store) return { rules };

  return { rules, sitemap: `${req.origin}/sitemap.xml` };
}
