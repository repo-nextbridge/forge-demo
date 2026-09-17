// The sitemap's catalog walk, and the cache that keeps it from running on every request.
//
// ── THE MECHANISM, MEASURED (do not re-derive it from the symptom) ──────────────────────────────────────
// `/sitemap.xml` cost 9.3–9.6s on Staging for ~3.100 URLs, on EVERY request, and the obvious explanation is
// wrong: `force-dynamic` does NOT opt the port reads out of the data cache. Next only forces `no-store` for a
// fetch that carries no config of its own (`patch-fetch.js`: `!pageFetchCacheMode && !currentFetchCacheConfig
// && !currentFetchRevalidate && forceDynamic`), and `read-client.ts` always sends `next: { revalidate, tags }`.
// The reads were eligible the whole time.
//
// What actually happens is a SIZE cliff. Next refuses any data-cache entry over 2MB and, in production, the
// refusal is a bare `return` — no log, no warning (`incremental-cache/index.js`). The body is stored base64,
// so the real ceiling is ~1.57MB of payload. Measured against the demo catalog (2.790 products, 28 pages of
// 100): pages ran 0.6–2.6MB and **18 of the 28 were over the limit**. Those 18 were therefore re-fetched from
// the port on every single request, forever — which is why the cost fell from 3.5s to ~2.3s and STOPPED there
// (the 10 that fit did cache), instead of collapsing to milliseconds the way a small store's sitemap does.
//
// ⇒ Caching the READS cannot fix this: a page of `ProductDoc` is simply bigger than the cache will hold. What
// gets cached here is the DERIVED result — ~3.200 short strings, ~350KB — which is what the file needed all
// along. It pulls ~50MB of product JSON to emit 428KB of XML.
//
// ── ★★ B2 — AND THE 2MB CLIFF IS A LIMIT ON THE CACHE, NEVER ON THE CATALOG ─────────────────────────────
// That cliff used to be enforced by the WALK: `PATHS_MAX_PAGES * PATHS_PAGE` = 10.000 products, past which the
// catalog was cut off mid-page. It kept the entry small by publishing a shorter store than the merchant has —
// the same date in the calendar the feed carried (M3), one consumer over. The number was right and the place
// was wrong: a ceiling on what may be CACHED is not a ceiling on what may be SERVED. So the walk now runs to
// the end of the catalog and the ceilings that are left say so out loud, in the unit each one is really in:
//   · `CACHEABLE_ENTRIES` (10.000, unchanged) — above it the sitemap is served WHOLE and cached NOT AT ALL,
//     which is what a >10.000 store already got, except that what it got was also truncated;
//   · `SITEMAP_MAX_URLS` (50.000) — the sitemap protocol's own, and the only one that still drops a URL. It
//     drops PRODUCTS and names them, because the catalog is the last section for exactly that reason.
//
// ── PORTA-PROJEÇÃO-LEVE — AND THEN THE PULL ITSELF WENT AWAY ────────────────────────────────────────────
// The paragraph above fixed what this file STORES. It could not fix what this file PULLS: on every miss the
// walk still dragged the whole catalog through `read.products`, because the port had no narrower way to
// enumerate. Re-measured on the demo catalog (2.791 products, 3.186 URLs) before the fix, warm, 6 runs with
// the first discarded — median 3.197 ms, CV 1,0 %, and byte-identical on all six:
//
//     pulled from the port  46.692.765 B  (44,53 MB)   ← 28 pages of ProductDoc
//     cached (derived)         275.272 B  (268,8 KB)
//     emitted XML              409.207 B  (399,6 KB)   ← ratio pulled/emitted: 114 to 1
//
// A `ProductDoc` is 13.346 bytes, of which 9.739 are `skus` and 1.653 are `media`. What this file reads off it
// is the handle and one ltree path: 51 bytes. So the walk now goes through `read.product_paths`, which answers
// about EXACTLY the same published set (it shares `products`' own `storeScope` object, not a copy of its
// clause) and carries nothing else. The 18-of-28 oversized pages stop existing at the source rather than being
// worked around: a page of 1000 path rows is ≈88 KB, 17× under the ceiling.
//
// ⚠️ THE FEED IS NOT FIXED BY THIS, and that is measured, not assumed: `FeedProduct` needs title, description,
// metadata, brand_id, media and skus — nearly the whole document — so `app/feeds/google.xml` still walks
// `read.products` and still pays the 44,53 MB. That toll is irreducible by this read; it has its own card.
//
// ── ★★★ WHOSE BUDGET THE WALK SPENDS, AND WHY IT STOPPED BEING THE SHOPPER'S ───────────────────────────
// This walk answers nobody's click. It is the INSTANCE enumerating ITSELF, exactly like the Google feed and
// the cache warmer, and it used to knock on `/v1/read` — the ANONYMOUS face, one `400 / 60 s` bucket per
// store+IP shared with every server-side read the store's own pages make. So a crawler asking for this
// document competed with the first real visitor, and on a big enough store it WON.
//
// MEASURED on the product bench (491 products, 755 URLs) from the port's own totals: ONE walk is 6 calls —
// `ceil(491/1000)` of `product_paths`, one page of `pages.published`, and one each of `categories`,
// `category_paths`, `brands`, `collections` — i.e. 1,5 % of a store's whole window, up to twelve times an
// hour (`CATALOG_REVALIDATE_SECONDS`). Small, and that is the honest number for a store this size.
//
// ⚠️ THE NUMBER THAT IS NOT SMALL IS THE UNCACHED ONE, and it is this file's own design: a store over
// `CACHEABLE_ENTRIES`, or one whose walk went short, is served WHOLE and cached NOT AT ALL (`UncachedSitemap`
// below) — so the walk runs on EVERY request. At 50.000 products that is 55 calls a request, and eight
// crawler hits inside one minute spend the entire window the shopper's pages live on. That is the case the
// bulk face exists for, and it is the case nobody would have noticed: the sitemap would look perfect while
// the PLPs started answering 429.
//
// ⇒ the client is `instanceReadClient()`. WHICH face that is is decided in ONE place, `instanceReadFace()`,
// off one variable: with `FORGE_BULK_READ_TOKEN` the walk goes out on `/v1/read/bulk` against the box's own
// per-credential × store budget; WITHOUT it — the state every box is born in — this file behaves EXACTLY as
// it did before, on the anonymous face, because an instance nobody configured must still serve its sitemap.
// The bulk face carries all six of these reads and answers them byte for byte, so the face trades the budget
// and never the document.
//
// ⚠️ ONE READ OF THE SITEMAP STAYS ANONYMOUS AND MUST: `read.store.by_host`, in `app/sitemap.ts`. It is a
// caller-bounded lookup and is deliberately NOT on the bulk face — the crawler's Host is the crawler's
// question, not an enumeration.
//
// ── WHAT IS CACHED, AND WHAT IS NOT ─────────────────────────────────────────────────────────────────────
// PATHS, never absolute URLs. One deployment serves many hosts, and host → store is data (MS-STORE): two hosts
// resolving to the same store must share one entry, and the origin is applied by the caller AFTER the cache.
// That is the same `requestOrigin()` / `storeOrigin()` boundary PERF-B drew, arrived at from the other side.
//
// The window is `CATALOG_REVALIDATE_SECONDS`, the number the rest of the storefront already uses — not a new
// knob. It is a BACKSTOP, not the authority: the entry is tagged `store:<id>`, which the kernel's storefront
// invalidation consumer posts on every catalog event, so a publish is visible on the next request rather than
// up to five minutes later. A sitemap is read by robots, rarely; minutes of staleness are free, and inventing
// a second TTL for it would only be one more number to keep in agreement with the first.

import { ltreeToSegments, productPathFrom } from '@forgeco/storefront-kit/catalog-path';
import { isCategoryBrowsable } from '@forgeco/storefront-kit/category-visibility';
import { instanceReadClient } from '@forgeco/storefront-kit/config';
import { CATALOG_REVALIDATE_SECONDS } from '@forgeco/storefront-kit/edge-cache';
import { unstable_cache } from 'next/cache';
import { collectAllParallel, PAGE, PATHS_PAGE, type Walk, walkStopText } from '@/lib/collect-pages';
import { collectionPath } from '@/templates/collection/CollectionView';

/** One row of the sitemap, as it is CACHED: a store-relative path, so one entry serves every host that
 * resolves to the store. `lastModified` is an ISO string rather than a `Date` because this crosses a cache
 * boundary — a `Date` comes back from JSON as a string, and the caller would silently emit `[object Object]`. */
export type SitemapEntry = {
  path: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
  lastModified?: string;
};

/**
 * ★★ THE 2MB CLIFF, IN PRODUCTS. What is stored is the DERIVED list, ~110 bytes of JSON per entry measured
 * against the demo catalog's rows — so 10.000 entries is ≈1,1 MB, against an effective ceiling of ~1,57 MB
 * (2MB of cache, stored base64). This is the number `PATHS_MAX_PAGES * PATHS_PAGE` used to hold by cutting the
 * catalog; it now holds it by declining to CACHE, which is the only thing it was ever protecting.
 */
export const CACHEABLE_ENTRIES = 10_000;

/**
 * ★★ THE ONE CEILING THAT STILL DROPS A URL — and it is not ours. The sitemap protocol admits 50.000 URLs and
 * 50MB uncompressed in a single file, and `MetadataRoute.Sitemap` emits exactly one file; a document over that
 * is not a big sitemap, it is an INVALID one, and a crawler rejects the whole thing rather than the tail. So a
 * store past it is cut here, deliberately and out loud — and what is cut is the CATALOG, because the catalog is
 * assembled last for this reason. (The way past it is `generateSitemaps` and a sitemap index. That is a card,
 * not this file: nothing in the demo or in a mid-size brand's catalog is within an order of magnitude of it.)
 */
export const SITEMAP_MAX_URLS = 50_000;

/**
 * A sitemap that must NOT be cached, carrying what it DID collect and the sentence that says why. Thrown rather
 * than returned so the result cannot be stored: a sitemap served short once is a bad day, but a short sitemap
 * FROZEN for the whole window is deindexing on a timer, and nothing in the response would say so.
 * `unstable_cache` only calls `cacheNewResult` after awaiting the callback, so a rejection stores nothing and
 * the next request walks again.
 *
 * ⚠️ `why` is not decoration. Both reasons that land here (a walk that went short, and a catalog past what the
 * cache holds) are invisible in the served bytes — the file looks fine either way — so the log line is the only
 * place an operator can learn the store is running uncached, and it has to carry the numbers.
 */
export class UncachedSitemap extends Error {
  constructor(
    readonly entries: SitemapEntry[],
    readonly why: string,
  ) {
    super(`sitemap served uncached: ${why}`);
    this.name = 'UncachedSitemap';
  }
}

/** The sections whose length the port decides, and whether each one arrived whole. */
function shortSections(walks: Record<string, Walk<unknown>>): string[] {
  return Object.entries(walks)
    .filter(([, walk]) => !walk.complete)
    .map(([section, walk]) =>
      walk.stop ? walkStopText(section, walk.stop) : `${section}: incomplete`,
    );
}

async function walkStore(store: string): Promise<SitemapEntry[]> {
  const started = Date.now();
  // ★★★ THE WALK IS THE INSTANCE ASKING ABOUT ITSELF, SO IT WALKS THE INSTANCE'S FACE. See the header's
  // budget paragraph; the decision itself is `instanceReadFace()` and is taken nowhere else.
  const client = instanceReadClient();

  const [products, pages, catmap, served, brands, collections] = await Promise.all([
    // ⚠️ `product_paths`, NEVER `products` — see the header.
    //
    // ★★ B2 — AND `maxItems`, NEVER A PAGE COUNT. The catalog is walked to its end; what bounds this walk is
    // the most URLs this document could ever publish, so a port declaring a number nobody can serve costs 50
    // requests instead of a million. Reaching it is a named cut, not a quiet stop.
    //
    // ★★ AND THE OTHER HALF ARRIVED: these pages are charged to the INSTANCE when the box has a credential.
    // It was one call site (`client.productPaths`) precisely so that the move would be a change of CLIENT and
    // not a change of this file, and that is exactly what it was — see the header.
    collectAllParallel((page) => client.productPaths(store, { page, limit: PATHS_PAGE }), {
      maxItems: SITEMAP_MAX_URLS,
    }),
    collectAllParallel((page) => client.pagesPublished(store, { page }), {
      maxItems: SITEMAP_MAX_URLS,
    }),
    client.categories(store),
    // MS-M1α — WHAT THIS STORE ACTUALLY FILLS. `categories` is tenant-wide (it is where the names live), so
    // it was never the right filter for a sitemap; with one store per tenant the difference did not exist.
    client.categoryPaths(store),
    client.brands(store),
    collectAllParallel((page) => client.collections(store, { page, limit: PAGE }), {
      maxItems: SITEMAP_MAX_URLS,
    }),
  ]);

  // The home page: the store's most important URL, and the one the sitemap used to omit entirely.
  const home: SitemapEntry[] = [{ path: '/', changeFrequency: 'daily' }];

  // Categories — the ltree path (`roupas.camisetas`) is the URL path (`/roupas/camisetas`).
  //
  // ★★ TWO PREDICATES, AND THEY ANSWER DIFFERENT QUESTIONS (MS-M1α, MT5-A2). `isCategoryBrowsable` is about
  // the category's own STATE (a link into a retired category is a link into nothing). It was the only filter
  // here, and the comment above it claimed the file "never advertises a URL that answers 404" — false the
  // moment a tenant had two stores: `categories` is TENANT-wide by design, so a category whose only product
  // is published in the Outlet was advertised in the sitemap of every OTHER store, where its PLP is empty.
  // The second predicate is the store's ASSORTMENT, and it comes from the kernel (`read.category_paths`)
  // rather than being re-derived here — the sitemap and the PLP must not hold two copies of "what this store
  // sells" (CAT-STATUS-GAP is what that costs).
  //
  // ⚠️ A FAILED assortment read leaves the OLD behaviour (state filter only) rather than an empty sitemap: a
  // sitemap that silently loses every category is a worse day than one that advertises a thin one, and the
  // walk's own `UncachedSitemap` covers the entries whose absence would be deindexing.
  const servedPaths = served ? new Set(served.map((c) => c.path)) : null;
  const categories: SitemapEntry[] = Object.values(catmap ?? {})
    .filter(isCategoryBrowsable)
    .filter((c) => !servedPaths || servedPaths.has(c.path))
    .map((c) => ({ path: `/${ltreeToSegments(c.path).join('/')}`, changeFrequency: 'weekly' }));

  // CMS-1 — the institutional pages, the only entries carrying a `lastModified` we can stand behind.
  // `page.updated_at` is bumped by every content.page.update (the publish flip included), so it genuinely
  // means "this changed". Nothing else here has a date: neither `ProductDoc` nor `CategoryMap` carries one,
  // and inventing one is worse than omitting it — a `lastmod` that does not track change teaches the crawler
  // to distrust the whole file, and nobody finds out.
  const cms: SitemapEntry[] = pages.items.map((p) => ({
    path: `/${p.slug}`,
    changeFrequency: 'monthly',
    lastModified: p.updated_at,
  }));

  // The canonical path, built from the port's two facts by the ONE function that builds product URLs here —
  // the same one the PDP and the feed go through, reached with a narrower argument.
  const catalog: SitemapEntry[] = products.items.map((p) => ({
    path: productPathFrom(p.handle, p.category_path),
    changeFrequency: 'daily',
  }));

  // S5-BRAND — one entry per ACTIVE brand page (/b/<slug>).
  const brandPages: SitemapEntry[] = Object.values(brands ?? {})
    .filter((b) => b.status === 'active')
    .map((b) => ({ path: `/b/${b.slug}`, changeFrequency: 'weekly' }));

  // COLL — one entry per collection landing (/collection/<handle>).
  //
  // ★ NO FILTER HERE, and its absence is the design. `read.collections` already answers with only what the
  // store SERVES — `internal` has no URL by construction, archived is retired, and outside the schedule is not
  // served. That is the same read the landing route resolves against, so this file cannot advertise a URL that
  // answers 404. Re-stating the predicate here is what went wrong once with categories (CAT-STATUS-GAP): one
  // source, or the file drifts from the site it claims to describe.
  const collectionPages: SitemapEntry[] = collections.items.map((c) => ({
    path: collectionPath(c.handle),
    changeFrequency: 'weekly',
  }));

  // ★★ B2 — THE CATALOG IS LAST, AND THAT IS THE MECHANISM, NOT THE ORDER OF THE PARAGRAPHS ABOVE. Crawlers
  // do not care about order; the document ceiling does. Every other section is bounded by things a merchant
  // counts on their fingers (one home, its categories, its CMS pages, its brands, its collections), so putting
  // the one unbounded section at the end makes `SITEMAP_MAX_URLS` cut PRODUCTS and never a landing page the
  // store depends on. Moving `...catalog` back up would silently change which URLs a 50.000-URL store loses.
  const fixed = [...home, ...categories, ...cms, ...brandPages, ...collectionPages];
  const room = Math.max(0, SITEMAP_MAX_URLS - fixed.length);
  // ⚠️ COUNTED AGAINST WHAT THE STORE HAS, NOT AGAINST WHAT THIS WALK HOLDS. The walk stops at
  // `SITEMAP_MAX_URLS` itself, so measuring the drop against `catalog.length` would report the handful of rows
  // trimmed HERE and hide the thousands the walk already declined to fetch — a number that is arithmetically
  // true and tells the operator nothing.
  const available = Math.max(products.total, catalog.length);
  const dropped = Math.max(0, available - room);
  const entries = [...fixed, ...catalog.slice(0, room)];

  // Only ever printed on a MISS — this function does not run on a hit. It is the one thing that keeps the next
  // person from measuring the cache and believing they measured the origin.
  console.info(
    `[sitemap] MISS store=${store} urls=${entries.length} products=${catalog.length}/${products.total} ms=${Date.now() - started}`,
  );

  // ⚠️ NAMED, NEVER SILENT. A sitemap that quietly stops at a round number is indistinguishable from a store
  // that has exactly that many products, and nobody goes looking for a defect they cannot see. Both numbers:
  // what the store has, and what a single sitemap file holds.
  if (dropped > 0) {
    console.warn(
      `[sitemap] CUT store=${store} products=${available} room=${room} dropped=${dropped}; one sitemap file holds ${SITEMAP_MAX_URLS} URLs`,
    );
  }

  const short = shortSections({ products, pages, collections });
  if (short.length > 0) throw new UncachedSitemap(entries, `walk incomplete (${short.join('; ')})`);

  if (entries.length > CACHEABLE_ENTRIES) {
    throw new UncachedSitemap(
      entries,
      `${entries.length} urls, the data cache holds ${CACHEABLE_ENTRIES}`,
    );
  }
  return entries;
}

/**
 * Every URL the store serves, as store-relative paths. Cached per store under `store:<id>`.
 *
 * The cache key has to carry the store: `unstable_cache` builds its fixed key from `cb.toString()` plus the
 * key parts, and this callback's source text is identical for every store — the key parts are the ONLY thing
 * separating one store's sitemap from another's. The tag has to be built per store for the same reason, which
 * is why the cached function is constructed here per call rather than once at module load.
 */
export async function sitemapEntries(store: string): Promise<SitemapEntry[]> {
  const cached = unstable_cache(() => walkStore(store), ['sitemap', store], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [`store:${store}`],
  });
  try {
    return await cached();
  } catch (err) {
    if (err instanceof UncachedSitemap) {
      console.warn(
        `[sitemap] UNCACHED store=${store} urls=${err.entries.length} reason=${err.why}, will walk again next request`,
      );
      return err.entries;
    }
    throw err;
  }
}
