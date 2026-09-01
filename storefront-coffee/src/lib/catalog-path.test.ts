// URL <-> catalog-path helpers: canonical product URL from the primary category, breadcrumbs, ltree.

import {
  canonicalProductPath,
  crumbsForPath,
  ltreeToSegments,
  segmentsToLtree,
} from '@forgecommerce/storefront-kit/catalog-path';
import type { CategoryMap } from '@forgecommerce/storefront-kit/read-client';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';

test('ltree <-> URL segments round-trip', () => {
  expect(ltreeToSegments('roupas.calcados')).toEqual(['roupas', 'calcados']);
  expect(segmentsToLtree(['roupas', 'calcados'])).toBe('roupas.calcados');
});

test('canonical product URL is the primary-category path + handle', () => {
  expect(canonicalProductPath(makeProduct())).toBe('/roupas/calcados/tenis-esportivo');
});

test('an uncategorized product canonicalizes to /p/<handle>', () => {
  expect(canonicalProductPath(makeProduct({ categories: [] }))).toBe('/p/tenis-esportivo');
});

test('crumbs resolve category names from the map', () => {
  const catmap: CategoryMap = {
    cat_roupas: { name: 'Roupas', path: 'roupas', status: 'active' },
    cat_calcados: { name: 'Calçados', path: 'roupas.calcados', status: 'active' },
  };
  // ★ CAT-CRUMB-GAP — the happy path is UNCHANGED: every ancestor the store serves keeps its link.
  expect(crumbsForPath('roupas.calcados', catmap)).toEqual([
    { label: 'Roupas', path: '/roupas' },
    { label: 'Calçados', path: '/roupas/calcados' },
  ]);
});

// CAT-CRUMB-GAP — the crumb has to AGREE WITH THE RESOLVER. `resolveCatchAll` 404s a path for two distinct
// reasons, and a crumb that links to either is a link into a 404 — so both lose the href and keep the label.
// The two cases below are deliberately separate tests: they look alike and are NOT the same rule, and the
// difference is exactly what CAT-STATUS-GAP got wrong once already (see the `status`-absent test further down).

test('an INACTIVE ancestor keeps its label and loses its link (the resolver 404s it)', () => {
  const catmap: CategoryMap = {
    cat_acessorios: { name: 'Acessórios', path: 'acessorios', status: 'active' },
    cat_palmilhas: { name: 'Palmilhas', path: 'acessorios.palmilhas', status: 'inactive' },
  };
  const crumbs = crumbsForPath('acessorios.palmilhas', catmap);

  // The hierarchy is still told in full — the shopper sees where they are.
  expect(crumbs.map((c) => c.label)).toEqual(['Acessórios', 'Palmilhas']);
  // ★ but the deactivated node is not clickable, and the active sibling is untouched.
  expect(crumbs[0]?.path).toBe('/acessorios');
  expect(crumbs[1]?.path).toBeUndefined();
});

test('an ancestor ABSENT from the map keeps its slug label and loses its link', () => {
  // ⚠️ THIS ASSERTION CHANGED, and the old one was wrong — not inconvenient. It used to claim
  // `{ label: 'novidades', path: '/roupas/novidades' }`, i.e. that a path with no entry in the category map is
  // linkable. The map is what decides whether a path IS a category, so `resolveCatchAll` 404s exactly this
  // path — the assertion encoded a behaviour CAT-STATUS-GAP made invalid and nobody went back to check.
  // What this test COVERS is unchanged (the slug fallback for the label); only what it AFFIRMS about the href
  // is corrected. `label: 'novidades'` still holds, and still holds for the same reason.
  const catmap: CategoryMap = {
    cat_roupas: { name: 'Roupas', path: 'roupas', status: 'active' },
  };
  const crumbs = crumbsForPath('roupas.novidades', catmap);

  expect(crumbs[1]?.label).toBe('novidades'); // slug fallback — unchanged
  expect(crumbs[1]?.path).toBeUndefined(); // ★ corrected: a path the resolver 404s is not a link
  expect(crumbs[0]).toEqual({ label: 'Roupas', path: '/roupas' }); // the known ancestor is untouched
});

test('★ `status` ABSENT on an entry that IS in the map ⇒ NAVIGABLE (the old Redis blob)', () => {
  // The trap CAT-STATUS-GAP was built around: the category map is served from a Redis blob cached for an hour,
  // so right after a deploy every entry arrives WITHOUT `status`. Reading that as "hidden" would strip the link
  // from every crumb of every store for an hour, with no error and no alarm.
  //
  // This is NOT the same case as the test above, and the difference is the whole principle: an entry present
  // without a status EXISTS and merely has an unknown state (the resolver serves it — assume active); an entry
  // absent from the map does not exist at all (the resolver 404s it — no link). Both follow from "the crumb
  // agrees with the resolver"; neither is "absence is permissive", and inverting one of them for symmetry
  // breaks the store.
  const catmap: CategoryMap = {
    cat_roupas: { name: 'Roupas', path: 'roupas' }, // the pre-`status` blob shape
    cat_calcados: { name: 'Calçados', path: 'roupas.calcados' },
  };
  expect(crumbsForPath('roupas.calcados', catmap)).toEqual([
    { label: 'Roupas', path: '/roupas' },
    { label: 'Calçados', path: '/roupas/calcados' },
  ]);
});
