// GET /api/account/status — the header's account widget (a client component) asks "is the shopper signed
// in?" WITHOUT ever seeing the httpOnly session token. Reading cookies() here (a route handler — dynamic by
// nature, outside any page's static/ISR render) is what keeps the ISR-cached catalog pages (home/PLP/search)
// free of a dynamic API: the layout no longer calls cookies(), so it stays statically cacheable. The token
// custody is intact (httpOnly, server-only) — the client only ever learns a boolean.

import { readCustomerSession } from '@forgecommerce/storefront-kit/session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ signedIn: Boolean(await readCustomerSession()) });
}
