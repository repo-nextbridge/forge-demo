// SEO-FINISH — the schema.org BreadcrumbList graph. A PURE function: it takes an origin and the crumbs the
// caller already resolved (`crumbsForPath` in lib/catalog-path.ts builds them from the ltree path + the category
// map), so it needs no fetch, no `headers()`, and no mock to test.
//
// Google's rich-results doc (checked against the live page, not memory) says the current page IS the last item
// of the trail, that `item` on that last element is optional rather than forbidden, and that the site's home
// page is not required. We therefore emit the page itself as the final element and give EVERY element an
// absolute `item` — a depth-1 category would otherwise be a single element carrying no URL at all, which is
// valid by the letter and useless in practice. Home stays out, matching both the doc and the visual trail.
//
// Absolute URLs come from the REQUEST host (multi-store by construction — never an origin from env/config).
//
// ★ CAT-CRUMB-GAP — WHY THIS GRAPH DIVERGES FROM THE VISUAL TRAIL, DELIBERATELY.
//
// A crumb whose category the store no longer serves arrives here with NO `href` (see `crumbsForPath`). On
// screen the answer is "keep the label, drop the link": the shopper reads the whole hierarchy and cannot click
// into a 404. That answer is NOT expressible here. Google's doc lists `item` — "The URL to the webpage that
// represents the breadcrumb" — under REQUIRED properties of `ListItem`, and waives it in exactly one place:
// "If the breadcrumb is the last item in the breadcrumb trail, `item` is not required. If `item` isn't included
// for the last item, Google uses the URL of the containing page." A middle element carrying a bare `name` is
// therefore invalid structured data, not a label.
//
// So the graph OMITS the unlinkable element and renumbers the survivors from 1. That is not a workaround for
// the rule above; it is what the same doc asks for on its own terms: "We recommend providing breadcrumbs that
// represent a typical user path to a page, instead of mirroring the URL structure." No typical user path runs
// through a page that 404s. The screen describes the STRUCTURE (all of it, honestly); the graph describes a
// PATH (only the steps that exist). Two questions, two answers — written down here so the next reader does not
// "fix" the disagreement.
//
// Note the unlinkable element is never the last one in practice: on a category page the current category passed
// `resolveCatchAll`'s gate by construction, and on a PDP the last element is the product itself. The filter does
// not depend on that, and if it ever empties the list the function returns `null` as it always did.

/** One step of a trail: what to call it, and the store-relative path it points at. Structurally the crumb that
 * `crumbsForPath` already produces, so a caller passes its trail straight through. `path` ABSENT ⇒ the step is
 * not navigable, and is left OUT of the graph (see the header — `item` is required on a non-final ListItem).
 *
 * MULTISTORE M1-β renamed the field from `href` (see lib/catalog-path.ts): what travels is a PATH, and this is
 * one of the two consumers that prove why the distinction matters — the anchor prefixes the request's store
 * base, while THIS one prefixes the store's declared ORIGIN and must never carry an `/s/<store>` segment. */
export type Crumb = { label: string; path?: string };

/**
 * The BreadcrumbList graph for a trail, or `null` when there is nothing to describe. Null (rather than an empty
 * list) is deliberate: a `BreadcrumbList` with no `itemListElement` is invalid structured data, and a product
 * with no category has no trail — the right answer there is to emit no graph, exactly as the Product graph omits
 * `image` instead of emitting `[]`. A trail whose every step is unnavigable reduces to that same case.
 */
export function breadcrumbJsonLd(
  origin: string,
  crumbs: readonly Crumb[],
): Record<string, unknown> | null {
  // Filter BEFORE numbering: `position` is 1-based over what we actually emit ("Position 1 signifies the
  // beginning of the trail"), so numbering by the original index would leave holes where a step was dropped.
  const navigable = crumbs.filter((crumb): crumb is Required<Crumb> => Boolean(crumb.path));
  if (navigable.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: navigable.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      item: `${origin}${crumb.path}`,
    })),
  };
}
