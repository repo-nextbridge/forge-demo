// GET /api/categories — the store's top-level browsable categories, for CLIENT fragments that need catalog
// navigation on a page whose HTML is edge-cached (today: the 404's category chips).
//
// It exists for the same reason /api/account/status does. The store-scoped 404 used to read the
// `x-forge-store` request header the middleware sets — and `headers()` in `not-found.tsx` made EVERY page of
// the (storefront) group dynamic at runtime, because Next renders the not-found boundary as part of the
// route's static shell (a trivial page in the group answered "Page changed from static to dynamic at
// runtime, reason: headers"). A route handler is dynamic by nature and outside any page's render, so the
// header read is free here and costs the catalog nothing.
//
// ★★ MS-M1α — THE STORE IS THE CALLER'S, AND ONLY THEN THE HOST'S. This route used to resolve the store from
// the request Host alone, and the 2026-08-13 multi-tenant test measured the consequence: on a deployment where
// one Host serves N tenants, a shopper browsing `/s/<store-of-tenant-B>` got a chip row of TENANT A's live
// categories — the fetch carries no `/s/` prefix, so the Host answered for whoever owns the hostname. The
// chips now say which store they are standing in (NotFoundChips forwards it) and this reads it through the
// class's one helper. Unknown store → an empty list, never a guess.

import { ltreeToSegments } from '@forgecommerce/storefront-kit/catalog-path';
import { isCategoryBrowsable } from '@forgecommerce/storefront-kit/category-visibility';
import { readClient } from '@forgecommerce/storefront-kit/config';
import { NextResponse } from 'next/server';
import { resolveRequestStore } from '@/lib/store-context';

export const dynamic = 'force-dynamic';

/** The 404's chip row shows at most this many — the same trim the server-rendered version made. */
const MAX_CHIPS = 8;

export async function GET(req: Request): Promise<NextResponse> {
  const store = await resolveRequestStore(req);
  if (!store) return NextResponse.json({ categories: [] });

  const map = await readClient()
    .categories(store)
    .catch(() => null);
  const categories = map
    ? Object.values(map)
        .filter(isCategoryBrowsable) // a 404 page whose way out is another 404 is not a way out
        .filter((c) => ltreeToSegments(c.path).length === 1) // top-level entry points, like the tiles
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_CHIPS)
        .map((c) => ({ name: c.name, href: `/${ltreeToSegments(c.path).join('/')}` }))
    : [];
  return NextResponse.json({ categories });
}
