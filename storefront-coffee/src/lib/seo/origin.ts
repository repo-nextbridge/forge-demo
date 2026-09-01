// SEO-FINISH — the origin the storefront advertises in ABSOLUTE URLs (robots.txt, the sitemap, the breadcrumb
// graph). host → store is data (MS-STORE), so one deployment serves many stores and an origin baked into env
// would make every store advertise the first one's URLs.
//
// PERF-B split this in two, because "the host the crawler asked for" stops being knowable the moment a page is
// edge-cached:
//
//   • requestOrigin() — reads `headers()`. Still exactly right for robots.txt and the sitemap: they are their
//     own DYNAMIC routes, one response per host, and they must answer for the host that asked.
//   • storeOrigin(store) — its sibling in `store-origin.ts`, for anything rendered INSIDE a cacheable page
//     (the breadcrumb graph on the PDP and the category list). A separate FILE, not a second export here:
//     the cacheable render graph may not even import `next/headers`, and a structural guard walks it.
//
// The scheme is fixed `https` — the same choice the sitemap already made. A store is served over TLS in every
// environment that a crawler can reach; deriving it from `x-forwarded-proto` would let a misconfigured proxy
// publish `http://` URLs into a sitemap, which is worse than being wrong only on a local http bench.

import { headers } from 'next/headers';

/** The current request's host and absolute origin, or `null` when there is no Host header to trust.
 * DYNAMIC-ONLY: calling this from a page that the build marked cacheable is a runtime 500. */
export async function requestOrigin(): Promise<{ host: string; origin: string } | null> {
  const host = (await headers()).get('host');
  if (!host) return null;
  return { host, origin: `https://${host}` };
}
