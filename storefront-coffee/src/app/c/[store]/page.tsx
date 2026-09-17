// The store home — the EDGE-CACHEABLE entry (the render is shared: templates/home/HomeView.tsx).
//
// THE TWO EXPORTS BELOW ARE THE WHOLE MECHANISM, and neither works without the other. `generateStaticParams`
// returning [] is what makes a route with a dynamic segment eligible for the full route cache at all: without
// it, Next serves `[store]` fully dynamically and stamps `private, no-store` no matter what `revalidate`
// says (measured — this is the inverse of the old "drop generateStaticParams to make the route ƒ" rule, which
// was right only because the page then called headers()). With it, and with no dynamic API anywhere in the
// tree, the first request renders and caches, the next one answers `x-nextjs-cache: HIT`, and every response
// carries `Cache-Control: s-maxage=<revalidate>, stale-while-revalidate=…` — which is what a CDN needs to
// hold the HTML at the edge.
//
// The empty list is deliberate: nothing is prerendered at BUILD time (a build must not need a live port, and
// the set of stores is not known then). Params arrive on demand and are cached per store from the first hit.

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import type { Metadata } from 'next';
import { HomeView, homeMetadata } from '@/templates/home/HomeView';

// 300s — the value of CATALOG_REVALIDATE_SECONDS (lib/edge-cache.ts), inlined because Next requires this
// export to be a statically analyzable literal. A guard asserts the two never drift.
export const revalidate = 300;

export function generateStaticParams(): { store: string }[] {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string }>;
}): Promise<Metadata> {
  const { store } = await params;
  return homeMetadata(store);
}

export default async function CachedHomePage({ params }: { params: Promise<{ store: string }> }) {
  const { store } = await params;
  // MULTISTORE M1-β — HOST_BASE is this tree's precondition, not a default: it is reachable only through the
  // middleware's host rewrite, so the public URL is the clean one.
  return <HomeView store={store} base={HOST_BASE} />;
}
