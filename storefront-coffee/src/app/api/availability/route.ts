// GET /api/availability?skus=<id>,<id> — buyable units per sku, for the PDP's variant selector.
//
// STK-1 made this read DELIBERATELY uncached (`no-store`): stock moves, and the kernel's number is
// display-only (the reserve at checkout is the transactional guard). PERF-B is why it moved out of the render:
// an uncached fetch inside a page is not "fresh data on a cached page", it is Next refusing to cache the page
// at all — `Page changed from static to dynamic at runtime, reason: no-store fetch …/read/availability`, which
// is what kept every PDP off the edge.
//
// So the two requirements stop fighting: the HTML is cached and the stock number is fetched per visit, from
// here. It is strictly FRESHER than the old server render (which could be held in a CDN for the page's whole
// TTL) and the page's first paint is the doc's own state — a failed/slow fetch simply leaves the buybox as it
// renders today with no availability wiring at all.

// ★★ MS-M1α — AND THE STORE IS THE CALLER'S. Resolved from the Host alone, this route answered about whichever
// store owns the hostname, not the one the buybox is standing in — and the kernel then answered about a sku the
// asked store may not even publish (MT5-A1: 25/25 units for a product HIDDEN in the resolved store). Both halves
// were needed: the PDP now forwards `?store=`, and `read.availability_by_skus` scopes by publication.

import { readClient } from '@forgecommerce/storefront-kit/config';
import { AVAILABILITY_MAX_SKUS } from '@forgecommerce/storefront-kit/read-client';
import { NextResponse } from 'next/server';
import { resolveRequestStore } from '@/lib/store-context';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  const store = await resolveRequestStore(req);
  const raw = new URL(req.url).searchParams.get('skus') ?? '';
  const skus = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  // ⚠️ TOO MANY IS A REFUSAL, NOT A SLICE. This used to `.slice(0, 50)`, which is the house's named failure
  // mode: the caller gets a 200 holding SOME of the answer and cannot tell "this variant is sold out" from
  // "this variant I never got told about". The port itself refuses above its declared ceiling for exactly
  // that reason, so the BFF in front of it says the same thing rather than quietly disagreeing. A PDP asks
  // about a handful of skus; anything near the ceiling is a crafted URL, and the ceiling is what stops it
  // fanning out into the port.
  if (skus.length > AVAILABILITY_MAX_SKUS) {
    return NextResponse.json(
      { error: `too many skus: ${skus.length} (max ${AVAILABILITY_MAX_SKUS})` },
      { status: 400, headers: { 'cache-control': 'private, no-store' } },
    );
  }
  if (!store || skus.length === 0) return NextResponse.json({ availability: {}, backorder: {} });

  // ONE call to the port, not one per sku (FEEDSTOCK). The fan-out this used to do was the N+1 that made the
  // batch read worth having; the shape here — a map the selector indexes by sku id — is unchanged.
  const rows = await readClient()
    .availabilityBySkus(store, skus)
    .catch(() => null);
  const availability: Record<string, number> = {};
  // ★ SF-BACKORDER-NAO-RENDERIZA — the PROMISE travels beside the number, in its own map.
  //
  // The port has answered `backorder: { extra_days }` on the public face since the epic; this route projected
  // the number alone, so the buybox saw `available: 0` and drew "Esgotado" over stock the merchant had
  // explicitly decided to keep selling — the exact opposite of the switch they flipped in the admin.
  //
  // A SECOND MAP RATHER THAN A RICHER FIRST ONE, deliberately: `availability` is a `Record<string, number>` in
  // the selector, in the preview gallery's fixtures and in the tests, and widening it would have made every
  // one of those a migration. Additive costs one key and breaks nobody.
  const backorder: Record<string, { extra_days: number | null }> = {};
  for (const row of rows ?? []) {
    availability[row.sku_id] = row.available;
    if (row.backorder) backorder[row.sku_id] = { extra_days: row.backorder.extra_days };
  }
  // Never cached anywhere: this is the one number on the page that must not be held by a CDN. The promise
  // rides the same response for the same reason — a stale "+7 dias" is a wrong promise, not a slow one.
  return NextResponse.json(
    { availability, backorder },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
