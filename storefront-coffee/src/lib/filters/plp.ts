// PLP accumulation + swatch harvesting (S7-SF-PLP). The "Carregar mais produtos" mechanic and the color-swatch
// photos, kept OUT of the pure filter-url codec so that codec stays the frozen URL contract. All pure — unit
// tested in isolation, reused by the templates and pages.
//
// LOAD-MORE MODEL (decision, S7-SF-PLP): the URL carries `?page=N` = "how many pages have been loaded". The
// server renders N·20 items in ONE shelf; the button is a GET link to `?page=N+1` (with JS a Next soft-nav — a
// smooth in-place append, no full reload; without JS a real navigation). Deep-linking `?page=2` SSRs 40 items.
// Honors "append client-side over the port's pagination" + "URL reflects for deep-link". The port caps a SINGLE
// `limit` at 100 (over-max is an ERROR, not a clamp), so the accumulation is fetched as N port pages of 20
// (`accumulateList`) and concatenated.
//
// ★ QA20/B11 — THE WINDOW, and why the accumulation is not unbounded (measured on staging, kernel 88e30299d):
// `GET /tenis?page=999` was answered literally. The accumulation walked the WHOLE category — 33 port calls in
// ONE request — and rendered every row it got: 8.800.271 bytes of html, 655 product links, ~2,8 s of server.
// Any stranger (or crawler following "Carregar mais") mints that request by typing a number, which is the
// amplification vector: one cheap GET buys 33 reads and 8,8 MB.
//
// The fix is NOT a cap on how far the shopper may go — "a cap nobody can lift is a capability removed in
// silence", and Renan's own reason for uncapping this in the first place stands (the demo's big categories,
// 959 in tênis, must be browsable to the END, not stuck at 100). So the ceiling is on the RESPONSE, not on the
// journey: a request renders at most `PLP_MAX_PAGES_PER_REQUEST` pages, and past that the window SLIDES —
// `?page=6` renders pages 2..6, `?page=33` renders 29..33. Every page of the catalog stays reachable, one
// click at a time, and no single request can ever cost more than the window. An absurd page clamps to the LAST
// window (not to an empty shelf), so `?page=999` lands on the end of the catalog.

import { coverOf, mediaSrc } from '@forgecommerce/storefront-kit/media/src';
import type { CatalogList, ProductDoc } from '@forgecommerce/storefront-kit/read-client';

/** The prototype's page size — 20 per "load" (HANDOVER §5). Also the per-port-call page size the accumulation
 * uses, so every call stays well under the port's 100 `limit` ceiling regardless of how many pages are loaded. */
export const PLP_PAGE_SIZE = 20;

/** How many `PLP_PAGE_SIZE` pages ONE request may render (QA20/B11). 5·20 = 100 items — the port's own single
 * `limit` ceiling, so the render can never cost more than one maximal port page's worth of rows. */
export const PLP_MAX_PAGES_PER_REQUEST = 5;

/** The slice of the catalog a `?page=N` request renders. `from` is the 1-based index of the window's first item
 * (what the counter shows), `totalPages` how many pages the whole result has. */
export type PlpWindow = { firstPage: number; lastPage: number; totalPages: number; from: number };

/** Resolve `?page=N` against the real `total` into the window this request renders. N is clamped to the last
 * page (an absurd page lands on the end of the catalog, never on a blank shelf) and the window holds at most
 * `PLP_MAX_PAGES_PER_REQUEST` pages, sliding forward as N grows. */
export function plpWindow(page: number, total: number): PlpWindow {
  const asked = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PLP_PAGE_SIZE));
  const lastPage = Math.min(asked, totalPages);
  const firstPage = Math.max(1, lastPage - PLP_MAX_PAGES_PER_REQUEST + 1);
  return { firstPage, lastPage, totalPages, from: (firstPage - 1) * PLP_PAGE_SIZE + 1 };
}

/** How many items pages 1..N represent: N·20. Used for the METADATA first-page fetch (accumLimit(1) = 20). The
 * RENDER path no longer fetches this in one call (that would trip the port's 100 ceiling past page 5) — it uses
 * `accumulateList` to page the port. A non-positive/garbage page clamps to the first page. */
export function accumLimit(page: number): number {
  const n = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return n * PLP_PAGE_SIZE;
}

/** Whether the "Carregar mais produtos" button shows: whether a page after this one exists. It asks about PAGES,
 * not about how many items are on screen, because the window slides — past the ceiling the shelf stops growing
 * while the walk goes on, and a `shown < total` test would keep the button up forever on the last page. */
export function hasMorePages(page: number, total: number): boolean {
  const w = plpWindow(page, total);
  return w.lastPage < w.totalPages;
}

/** Fetch the window of pages `?page=N` resolves to (each a `PLP_PAGE_SIZE` port page) and concatenate — the
 * "Carregar mais" accumulation, done as many small port calls instead of one over-max call (the port errors past
 * `limit` 100). Page 1 is ALWAYS fetched (or handed in): `total` and `facets` are page-invariant and come from
 * it, and the total is what resolves N into the window. So the cost of any request is at most 1 + the window
 * (6 port calls), where an uncapped `?page=999` used to cost one call per page of the whole category (33 on the
 * demo's tênis). Stops early when the catalog is exhausted or a page comes back empty/null. Returns null only if
 * the very first fetch fails. Every call uses the SAME page size so the port's offsets line up (mixing sizes
 * would skip rows). */
export async function accumulateList(
  fetchPage: (page: number, limit: number, withFacets: boolean) => Promise<CatalogList | null>,
  uiPage: number,
  // The caller may hand in page 1 already fetched (the search page fetches it first to peek for a curated
  // {redirect}); when omitted we fetch it here. Either way the window's pages are fetched below.
  firstPage?: CatalogList | null,
): Promise<CatalogList | null> {
  const first = firstPage !== undefined ? firstPage : await fetchPage(1, PLP_PAGE_SIZE, true);
  if (!first) return null;
  const win = plpWindow(uiPage, first.total);
  const items: ProductDoc[] = [];
  for (let p = win.firstPage; p <= win.lastPage; p += 1) {
    if (p === 1) {
      items.push(...first.items);
      continue;
    }
    const next = await fetchPage(p, PLP_PAGE_SIZE, false);
    if (!next || next.items.length === 0) break;
    items.push(...next.items);
  }
  return { ...first, items, page: win.firstPage, limit: PLP_PAGE_SIZE };
}

/** axisNameLower -> option value -> a representative photo url. */
export type SwatchImages = Record<string, Record<string, string>>;

/** Best-effort photo per option value, harvested from the LOADED products (the facet contract carries no image,
 * so this is the only zero-port way to draw the prototype's color swatches). Mirrors the card's buildCartModel:
 * a value maps to the resolved cover url of the FIRST SKU carrying it. A value no on-page SKU carries → no entry
 * (the sidebar renders a neutral square, still selectable). Keyed by the axis name lowercased (matches the
 * filter-url option key convention). */
export function buildSwatchImages(products: ProductDoc[]): SwatchImages {
  const out: SwatchImages = {};
  for (const product of products) {
    for (const sku of product.skus ?? []) {
      const url = mediaSrc(coverOf(sku.media ?? [])).url;
      if (!url) continue;
      for (const ov of sku.option_values ?? []) {
        const axis = ov.option_name.toLowerCase();
        let byValue = out[axis];
        if (!byValue) {
          byValue = {};
          out[axis] = byValue;
        }
        if (!(ov.value in byValue)) byValue[ov.value] = url;
      }
    }
  }
  return out;
}
