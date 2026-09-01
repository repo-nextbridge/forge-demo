// Autocomplete proxy (SEARCH-3): the browser's search PANEL calls THIS route, which calls read.suggest on the
// port SERVER-SIDE (the storefront never exposes the port URL or touches a DB). read.suggest is the light kernel
// autocomplete — now enriched (S7 fidelity) to carry, per product, the category NAME and the compare_at "was"
// price, so a result line reads "Categoria · preço-de preço". The middleware excludes `/api/`, so store is
// resolved here from `?store=` (the client reads it off the path) OR the request Host. Best-effort: an unknown
// store or a blank q returns empty — the SearchBox still GET-submits, so autocomplete only ever ENHANCES.

import { readClient } from '@forgecommerce/storefront-kit/config';
import { ReadPortError } from '@forgecommerce/storefront-kit/read-client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveRequestStore } from '@/lib/store-context';

const EMPTY = { products: [], categories: [] };

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  // ★ THE CONTRA-EXEMPLO THAT BECAME THE RULE. This route was the only one of its class that preferred the
  // caller's `?store=` over the Host, and it was the only one that isolated. MS-M1α extracted exactly this
  // line into `resolveRequestStore` and gave it to the siblings — one place to be wrong, not N.
  const store = await resolveRequestStore(req);
  if (!q || !store) return NextResponse.json(EMPTY);
  try {
    const result = (await readClient().suggest(store, q)) ?? EMPTY;
    return NextResponse.json(result);
  } catch (error) {
    // SF-SUGGEST-429 — the kernel caps this read at 60 req/min PER IP and answers 429. It used to arrive here
    // as an exception with no catch, so Next answered 500: the storefront told the shopper the store was
    // broken when what happened was "slow down". A 429 is an INSTRUCTION, and it only works if it survives the
    // trip — the edge/WAF read it, a load harness can count it, and the browser learns WHEN to come back.
    //
    // ⚠ ONLY the 429 is translated. Everything else is re-thrown, so a 500 from the port is still a 500 here:
    // this route is a translator of one specific answer, not a proxy that launders every failure into a
    // status of its own choosing.
    if (error instanceof ReadPortError && error.status === 429) {
      return NextResponse.json(
        { error: { kind: 'rate_limited', message: 'too many requests' } },
        {
          status: 429,
          headers: {
            // The kernel's own number, carried through — never invented here (absent stays absent).
            ...(error.retryAfter ? { 'retry-after': error.retryAfter } : {}),
            // One IP's limit must never be cached and served to everybody behind the edge.
            'cache-control': 'no-store',
          },
        },
      );
    }
    throw error;
  }
}
