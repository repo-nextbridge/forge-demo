// GET /api/categories — the way out of a 404: the store's top-level browsable categories, plus the store the
// port CONFIRMED, for the client fragment that draws them on a page whose HTML is edge-cached.
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
// chips now say which store they are standing in (NotFoundWayOut forwards it) and this reads it through the
// class's one helper. Unknown store → an empty list, never a guess.
//
// ── ⛔ p3-7 · TWO THINGS THIS ANSWER OWES THE PAGE, AND IT USED TO OWE ONLY HALF OF ONE ───────────────────
//
// ★ 1 · WHICH CATEGORIES — AND "BROWSABLE" WAS NEVER THE WHOLE QUESTION. `read.categories` is TENANT-wide by
// design (it is where the NAMES live, so a breadcrumb can resolve one whatever the store), and the only
// filter here was `isCategoryBrowsable`, which is about a category's own STATE. With one store per tenant the
// difference did not exist. Measured on this bench 2026-09-03, with three stores in one tenant: the coffee
// shop's 404 offered *Cafés · Comidas · Especiais da casa · Pra levar* — the COUNTER's four bands, tenant-wide
// rows the coffee vitrine does not fill, so the way out of a 404 was a shelf with nothing on it. The store's
// ASSORTMENT is a second question and the kernel already answers it (`read.category_paths`, the paths THIS
// store fills); `lib/sitemap-data.ts` learned the same lesson first (MT5-A2) and this is that predicate pair,
// imported rather than re-derived — the sitemap and the 404 may not hold two copies of "what this store sells".
//
// ⚠️ A FAILED assortment read leaves the OLD behaviour (state filter only), the same posture the sitemap took:
// a thin, honest chip row beats a page that silently loses its way out.
//
// ★ 2 · WHICH STORE — because a clean `href` is only half a link. The hrefs below are the CLEAN, store-
// independent paths the storefront's routing defines, which is what they must be: placing one in an address
// space is the RENDERER's job (`storeHref`), and the base is a fact about the request the browser is making,
// not about the store. What the page cannot know on its own is whether the id in its address bar is a store
// that EXISTS — and a 404 whose "Voltar à loja" points into a store nobody has is a worse 404. So this answers
// with the store the port actually resolved, and `null` when the read did not land: the fragment corrects its
// links only against a store the kernel confirmed.

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
  if (!store) return NextResponse.json({ store: null, categories: [] });

  const client = readClient();
  const [map, served] = await Promise.all([
    client.categories(store).catch(() => null),
    client.categoryPaths(store).catch(() => null),
  ]);
  // The store answered, so it exists and this request is about it — the one fact the not-found boundary
  // cannot learn for itself (App Router hands it no params, and `headers()` there de-opts the whole group).
  if (!map) return NextResponse.json({ store: null, categories: [] });

  const servedPaths = served ? new Set(served.map((c) => c.path)) : null;
  const categories = Object.values(map)
    .filter(isCategoryBrowsable) // a 404 page whose way out is another 404 is not a way out
    .filter((c) => !servedPaths || servedPaths.has(c.path)) // ...nor is one this store does not fill
    .filter((c) => ltreeToSegments(c.path).length === 1) // top-level entry points, like the tiles
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_CHIPS)
    .map((c) => ({ name: c.name, href: `/${ltreeToSegments(c.path).join('/')}` }));
  return NextResponse.json({ store, categories });
}
