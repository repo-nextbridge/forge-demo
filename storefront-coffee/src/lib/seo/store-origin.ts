// PERF-B — the origin to advertise FOR A STORE, without reading the request.
//
// Its sibling `origin.ts` answers "the host the crawler asked for" and needs `headers()`; that is right for
// robots.txt and the sitemap (their own dynamic routes, one response per host) and impossible for anything
// rendered inside an edge-cached page — one cached HTML is served to every host that resolves to the store,
// so a per-request host would be baked in and then handed to the next host. Advertising store A's URLs on
// store B's domain is worse than advertising none.
//
// They are TWO FILES and not two exports on purpose: the cacheable render graph may not so much as import
// `next/headers` (the structural guard walks it), and that separation is exactly the distinction being made.
//
// The RIGHT source is the store's canonical host as DATA — the directory already stores the hosts a store
// claims (EDGE-HOSTS uses them to decide TLS); there is simply no public read that returns them. That is
// kernel work with its own card; when it lands, this becomes a read and both env knobs become its fallback.
//
// The scheme is fixed `https`, the same choice the sitemap made: a store is served over TLS anywhere a
// crawler can reach it, and deriving it from a proxy header would let a misconfiguration publish `http://`.

import { hostMap, publicOrigin } from '@forgeco/storefront-kit/config';

/** The absolute origin for a store, or null when the instance declared none and the dev map does not name it
 * — the caller then omits the absolute URL entirely rather than guessing a domain. */
export function storeOrigin(store: string): { host: string; origin: string } | null {
  const declared = publicOrigin();
  if (declared) {
    try {
      const url = new URL(declared);
      return { host: url.host, origin: url.origin };
    } catch {
      // A malformed FORGE_PUBLIC_ORIGIN must not take the page down; fall through to the map.
    }
  }
  // The dev override map is host -> store; the first host claiming this store is its address on this bench.
  const host = Object.entries(hostMap()).find(([, id]) => id === store)?.[0];
  return host ? { host, origin: `https://${host}` } : null;
}
