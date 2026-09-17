// The store home — the DYNAMIC entry (the twin that gets edge-cached is `c/[store]/page.tsx`; the render is
// shared, in templates/home/HomeView.tsx). The middleware sends a request here only when the store cannot be
// served from cache at all: a store with a GATE installed, whose layout reads the dismissal cookie on every
// route. Everything else takes the twin.
//
// DYNAMIC: this entry exists to serve requests that are per-visitor by definition, so it must never be
// prerendered. No generateStaticParams — its mere presence marks the route SSG (● in the build), and force-
// dynamic does NOT override it.

import { requestStoreBase } from '@forgeco/storefront-kit/store-route.server';
import type { Metadata } from 'next';
import { HomeView, homeMetadata } from '@/templates/home/HomeView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string }>;
}): Promise<Metadata> {
  const { store } = await params;
  return homeMetadata(store);
}

export default async function HomePage({ params }: { params: Promise<{ store: string }> }) {
  const { store } = await params;
  return <HomeView store={store} base={await requestStoreBase(store)} />;
}
