// SEO-FINISH — the BreadcrumbList graph the JsonLd.tsx header has promised since it was written ("the base
// graph: Product / ItemList / BreadcrumbList") and never emitted.
//
// WHAT GOOGLE'S RICH-RESULTS DOC ACTUALLY SAYS (checked, not remembered —
// developers.google.com/search/docs/appearance/structured-data/breadcrumb):
//   · the current page IS the last item of the trail (their own example ends on "Award Winners");
//   · `item` on that last element is OPTIONAL, not forbidden — "If the breadcrumb is the last item in the
//     breadcrumb trail, `item` is not required. If `item` isn't included for the last item, Google uses the URL
//     of the containing page";
//   · `position`, `name` and `item` are the ListItem properties (`item` excepted on the final one);
//   · the home page is NOT required — "It is not required to include a breadcrumb `ListItem` for the top level
//     path (your site's domain or host name), nor for the page itself";
//   · absolute URLs are not mandated, but every example in the doc uses one.
//
// We emit `item` on EVERY element, the last included. A depth-1 category ("/roupas") would otherwise produce a
// one-element list whose only element carries no URL at all — valid by the letter, degenerate in practice. And
// home stays out: the doc says it is unnecessary, and the visual trail in the template starts at the category
// too, so the two finally agree instead of quietly disagreeing.

import { expect, test } from 'vitest';
import { breadcrumbJsonLd } from './breadcrumb';

const ORIGIN = 'https://loja.example';

type Item = Record<string, unknown>;
const itemsOf = (graph: unknown): Item[] => (graph as { itemListElement: Item[] }).itemListElement;

/**
 * The doc's REQUIRED-properties rule for `ListItem`, encoded once so every case below is checked against the
 * same ruler (developers.google.com/search/docs/appearance/structured-data/breadcrumb, "Required properties"):
 *   · `name` — "The title of the breadcrumb displayed for the user."          → required, every element
 *   · `position` — "The position of the breadcrumb in the breadcrumb trail.
 *      Position 1 signifies the beginning of the trail."                      → required, and 1-based contiguous
 *   · `item` — "The URL to the webpage that represents the breadcrumb."       → required, ONE exception:
 *      "If the breadcrumb is the last item in the breadcrumb trail, `item` is not required."
 * We are stricter than the exception allows and emit `item` on the last element too (see the header).
 */
function expectValidBreadcrumbList(graph: unknown) {
  const items = itemsOf(graph);
  expect(items.length).toBeGreaterThan(0); // an empty itemListElement is invalid structured data
  items.forEach((item, i) => {
    expect(item['@type']).toBe('ListItem');
    expect(typeof item.name).toBe('string');
    expect(item.name).not.toBe('');
    expect(item.item).toEqual(expect.stringMatching(/^https?:\/\//)); // required except on the last; we always emit
    expect(item.position).toBe(i + 1); // 1-based AND contiguous — no holes where an item was dropped
  });
}

test('the trail is a BreadcrumbList of positioned ListItems, 1-based, with absolute item URLs', () => {
  const graph = breadcrumbJsonLd(ORIGIN, [
    { label: 'Roupas', path: '/roupas' },
    { label: 'Camisetas', path: '/roupas/camisetas' },
  ]);

  expect(graph).toEqual({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Roupas',
        item: 'https://loja.example/roupas',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Camisetas',
        item: 'https://loja.example/roupas/camisetas',
      },
    ],
  });
});

test('the LAST item is the page itself and still carries `item` (the doc permits it; a bare name does not)', () => {
  const graph = breadcrumbJsonLd(ORIGIN, [
    { label: 'Roupas', path: '/roupas' },
    { label: 'Camisetas', path: '/roupas/camisetas' },
    { label: 'Camiseta Listrada', path: '/roupas/camisetas/camiseta-listrada' },
  ]);
  const items = (graph as { itemListElement: Record<string, unknown>[] }).itemListElement;

  expect(items).toHaveLength(3);
  expect(items[2]).toEqual({
    '@type': 'ListItem',
    position: 3,
    name: 'Camiseta Listrada',
    item: 'https://loja.example/roupas/camisetas/camiseta-listrada',
  });
  // Every element is complete — no element may be missing a required property.
  for (const item of items) {
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('position');
    expect(item).toHaveProperty('item');
  }
});

test('a depth-1 category yields a one-element trail that still has a URL (why we keep `item` on the last)', () => {
  const graph = breadcrumbJsonLd(ORIGIN, [{ label: 'Roupas', path: '/roupas' }]);
  expect((graph as { itemListElement: unknown[] }).itemListElement).toEqual([
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Roupas',
      item: 'https://loja.example/roupas',
    },
  ]);
});

test('no crumbs → NO graph at all (an empty BreadcrumbList is invalid structured data, not an empty trail)', () => {
  expect(breadcrumbJsonLd(ORIGIN, [])).toBeNull();
});

test("the origin is the caller's (multi-store): the same trail on another host emits that host", () => {
  const crumbs = [{ label: 'Roupas', path: '/roupas' }];
  const a = breadcrumbJsonLd('https://loja-a.com.br', crumbs);
  const b = breadcrumbJsonLd('https://outlet.example', crumbs);
  const itemOf = (g: unknown) =>
    (g as { itemListElement: { item: string }[] }).itemListElement[0]?.item;

  expect(itemOf(a)).toBe('https://loja-a.com.br/roupas');
  expect(itemOf(b)).toBe('https://outlet.example/roupas');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// CAT-CRUMB-GAP — the crumb without an href, and why the graph answers it DIFFERENTLY from the screen.
//
// After CAT-STATUS-GAP an ancestor the store no longer serves reaches this function with NO `href`. On screen
// the answer is "keep the label, drop the link". In the graph that answer is not expressible: `item` sits in the
// doc's REQUIRED-properties table and is waived for the last element only ("If the breadcrumb is the last item
// in the breadcrumb trail, `item` is not required"), so a middle ListItem carrying a bare name is invalid.
// The graph therefore OMITS the element and renumbers — which is also what the doc asks for on its own terms:
// "We recommend providing breadcrumbs that represent a typical user path to a page, instead of mirroring the URL
// structure." No typical user path runs through a page that 404s.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('★ a crumb with no href is OMITTED from the graph (a middle ListItem cannot carry a bare name)', () => {
  const graph = breadcrumbJsonLd(ORIGIN, [
    { label: 'Acessórios', path: '/acessorios' },
    { label: 'Palmilhas' }, // deactivated: on screen a label, here nothing at all
    { label: 'Palmilha Gel', path: '/acessorios/palmilhas/palmilha-gel' },
  ]);

  expectValidBreadcrumbList(graph);
  expect(itemsOf(graph)).toEqual([
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Acessórios',
      item: 'https://loja.example/acessorios',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Palmilha Gel',
      item: 'https://loja.example/acessorios/palmilhas/palmilha-gel',
    },
  ]);
  // ★ the 404 path is nowhere in the graph — this is the string that was served in the HTML before this card.
  expect(JSON.stringify(graph)).not.toContain('/acessorios/palmilhas"');
});

test('★ positions are renumbered over the SURVIVORS, contiguous from 1 (never a hole where an item was dropped)', () => {
  // The doc: "Position 1 signifies the beginning of the trail." Numbering by the ORIGINAL index would emit
  // 1, 3, 4 — a trail that starts at 1 but skips, which is a different bug from the one above and would survive
  // the omission test untouched.
  const graph = breadcrumbJsonLd(ORIGIN, [
    { label: 'Sem link A' },
    { label: 'B', path: '/b' },
    { label: 'C', path: '/b/c' },
    { label: 'Sem link D' },
    { label: 'E', path: '/b/c/e' },
  ]);

  expectValidBreadcrumbList(graph);
  expect(itemsOf(graph).map((i) => i.position)).toEqual([1, 2, 3]);
  expect(itemsOf(graph).map((i) => i.name)).toEqual(['B', 'C', 'E']);
});

test('every crumb unlinked → NO graph (null), never a BreadcrumbList with an empty itemListElement', () => {
  expect(breadcrumbJsonLd(ORIGIN, [{ label: 'Acessórios' }, { label: 'Palmilhas' }])).toBeNull();
});

test('the happy path is byte-identical to the pre-CAT-CRUMB-GAP graph (no regression on a served trail)', () => {
  const graph = breadcrumbJsonLd(ORIGIN, [
    { label: 'Roupas', path: '/roupas' },
    { label: 'Camisetas', path: '/roupas/camisetas' },
  ]);

  expectValidBreadcrumbList(graph);
  expect(graph).toEqual({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Roupas', item: 'https://loja.example/roupas' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Camisetas',
        item: 'https://loja.example/roupas/camisetas',
      },
    ],
  });
});
