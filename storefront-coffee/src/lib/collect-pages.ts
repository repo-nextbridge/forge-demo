// Walking a paginated read to the end — ONE implementation, shared by the reads that describe a whole catalog.
//
// It lived inline in `app/feeds/google.xml/route.ts` while the sitemap kept a SERIAL copy of its own, and the
// two were already drifting: only one of them knew whether the walk had finished. A second copy of a walk is a
// second answer to "did we get everything?", so it moved here rather than being duplicated a third time.

import type { ReadList } from '@forgeco/storefront-kit/read-client';

/** The read port's hard ceiling for one products page (LIST_LIMITS.products.max). More is a 400, not a clamp. */
export const PAGE = 100;

/**
 * ★ PORTA-PROJEÇÃO-LEVE — the page size of `read.product_paths` (LIST_LIMITS.product_paths.max).
 *
 * A row of that read is a handle plus one ltree path — 51 bytes measured against the demo catalog, against the
 * 13.346 of a `ProductDoc` — so a page of 1000 is ≈88 KB and the port serves the whole thing in three requests
 * instead of twenty-eight.
 */
export const PATHS_PAGE = 1000;

/** How many page requests are in flight at once. Bounded so a large catalog cannot open 100 sockets at the
 * kernel in one breath — the point is to stop paying for 30 round trips IN SERIES, not to remove the limit. */
export const CONCURRENCY = 8;

/**
 * ★★ B2 — WHY A WALK STOPPED, WITH THE NUMBERS THAT SAY WHAT TO DO ABOUT IT. A walk that ends short used to
 * answer `complete: false` and nothing else, so every caller could report THAT it was short and none could
 * report BY HOW MUCH. `stop` is present exactly when `complete` is false: an incomplete walk that cannot name
 * itself is the silent truncation this type exists to make unrepresentable.
 */
export type WalkStop =
  /** The first page did not answer at all — the port is down or the capability is closed. */
  | { kind: 'no_answer' }
  /** `total` was not a count (`Infinity`, `NaN`, a negative). No page ceiling makes such a number true. */
  | { kind: 'unusable_total'; declared: unknown }
  /** The port declared more items than the CALLER can publish. What it has, and what fits. */
  | { kind: 'cut'; declared: number; fits: number }
  /** The port never delivered what it declared — a hole in a page, or a catalog shorter than its own count. */
  | { kind: 'short'; declared: number; collected: number };

export type Walk<T> = {
  items: T[];
  total: number;
  complete: boolean;
  /** Set if and only if `complete` is false. */
  stop?: WalkStop;
};

/**
 * Walk every page of a paginated read — first page SERIALLY (it carries `total`), the rest CONCURRENTLY.
 *
 * The sequential version of this walk is half of what made the sitemap cost seconds: ~30 pages one after
 * another, when only the first one is actually a dependency. `total` arrives with page 1, so the remaining page
 * count is known before any of them is fetched — there is nothing to discover by going in order.
 *
 * ★ THE PAGE SIZE COMES FROM THE ANSWER, NOT FROM `PAGE`. The caller does not always ask for a limit —
 * `read.pages.published` is walked with no `limit` at all and the port applies its own default. Dividing
 * `total` by our constant instead of by the page the port actually served computes ONE page for a 30-item
 * store that answers 24 at a time, and the tail is dropped in silence. `head.limit` is the port's own word for
 * how big a page is; the fallbacks exist only so a port that omits it cannot produce a division by zero.
 *
 * A page that fails resolves to nothing rather than taking the whole walk down; the caller compares what it got
 * against `total` through `complete` and `stop`, and decides — the sitemap refuses to CACHE short. It cannot
 * make that call without being told.
 *
 * ★★ B2 — AND THE BACKSTOP IS COUNTED IN ITEMS, NEVER IN REQUESTS. It used to be `MAX_PAGES = 100` (with a
 * `PATHS_MAX_PAGES = 10` over it for the 10× wider paths page), which reads as "a misbehaving port cannot spin
 * a walk forever" and behaves as "this store may have 10.000 products": past that the walk stopped mid-catalog
 * and the caller published a truncated document. `opts.maxItems` is the same protection stated in the unit the
 * caller actually has a limit in — the sitemap can publish 50.000 URLs, so it walks at most 50.000 rows — and
 * reaching it is a NAMED `cut`, never a quiet stop. Three things bound this loop, none of them a page count:
 *   1. a `total` that is not a count is refused on the FIRST answer — `Infinity`/`NaN` divide into a loop
 *      nobody stops;
 *   2. the walk asks for exactly the pages `min(total, maxItems)` implies, and never a page beyond them;
 *   3. A PAGE SHORTER THAN THE PORT'S OWN `limit` IS THE LAST PAGE. A port that claims a million products and
 *      serves one ends the walk after that first answer, instead of after a thousand requests.
 * ⚠️ A page that answers NULL is a HOLE, not an end: it stops nothing and it makes the walk short, because a
 * failed request is not evidence about what comes after it.
 */
export async function collectAllParallel<T>(
  fetchPage: (page: number) => Promise<ReadList<T> | null>,
  opts: { maxItems?: number } = {},
): Promise<Walk<T>> {
  const head = await fetchPage(1);
  if (!head) return { items: [], total: 0, complete: false, stop: { kind: 'no_answer' } };

  const declared = head.total ?? head.items.length;
  if (!Number.isSafeInteger(declared) || declared < 0) {
    return {
      items: [...head.items],
      total: 0,
      complete: false,
      stop: { kind: 'unusable_total', declared },
    };
  }

  const pageSize = head.limit || head.items.length || PAGE;
  const ceiling = opts.maxItems ?? Number.POSITIVE_INFINITY;
  const wanted = Math.min(declared, ceiling);
  const pages = Math.ceil(wanted / pageSize);
  const items = [...head.items];
  let lastPageSeen = head.items.length < pageSize;

  for (let start = 2; start <= pages && !lastPageSeen; start += CONCURRENCY) {
    const batch: Promise<ReadList<T> | null>[] = [];
    for (let page = start; page < start + CONCURRENCY && page <= pages; page++) {
      batch.push(fetchPage(page));
    }
    for (const list of await Promise.all(batch)) {
      if (!list) continue; // a hole, and the walk goes short for it below
      items.push(...list.items);
      if (list.items.length < pageSize) lastPageSeen = true;
    }
  }

  if (declared > ceiling) {
    return {
      items: items.slice(0, ceiling),
      total: declared,
      complete: false,
      stop: { kind: 'cut', declared, fits: ceiling },
    };
  }
  return items.length >= declared
    ? { items, total: declared, complete: true }
    : {
        items,
        total: declared,
        complete: false,
        stop: { kind: 'short', declared, collected: items.length },
      };
}

/** A `stop` in words, for the log line that has to tell an operator what to raise and by how much. Kept beside
 * the type so a new `kind` cannot be added without a sentence for it — the compiler checks the switch. */
export function walkStopText(section: string, stop: WalkStop): string {
  switch (stop.kind) {
    case 'no_answer':
      return `${section}: the port did not answer`;
    case 'unusable_total':
      return `${section}: the port declared a total that is not a count (${String(stop.declared)})`;
    case 'cut':
      return `${section}: ${stop.declared} available, ${stop.fits} fit`;
    case 'short':
      return `${section}: ${stop.declared} declared, ${stop.collected} collected`;
  }
}
