// CAT-CRUMB-GAP — the screen half of "the crumb agrees with the resolver".
//
// After CAT-STATUS-GAP a category the store stopped serving answers 404. The trail kept linking it, so the
// hierarchy the shopper reads was an invitation into an error page. The answer here is (a): KEEP THE LABEL,
// DROP THE LINK — the trail stays honest about where the product sits, and nothing in it is clickable-to-404.
//
// (The BreadcrumbList answers differently — it omits the element entirely, because `item` is a required
// property of a non-final ListItem and a bare name there is invalid. That divergence is deliberate and is
// argued in lib/seo/breadcrumb.ts. This file only proves the screen.)
//
// This component had no test of its own before this card; the trail was only ever asserted through the PDP/list
// template renders, which is why "every crumb is a link" was never a claim anybody had written down.

import { HOST_BASE, pathScopedBase } from '@forgecommerce/storefront-kit/store-route';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Breadcrumb } from './Breadcrumb';

test('a crumb WITH a path renders as a link', () => {
  const { getByRole } = render(
    <Breadcrumb
      base={HOST_BASE}
      crumbs={[{ label: 'Acessórios', path: '/acessorios' }]}
      current="Palmilha Gel"
    />,
  );

  expect(getByRole('link', { name: 'Acessórios' }).getAttribute('href')).toBe('/acessorios');
});

test('★ a crumb WITHOUT a path renders as text: the label is there, and it is not a link', () => {
  const { getByText, queryByRole, getByTestId } = render(
    <Breadcrumb
      base={HOST_BASE}
      crumbs={[{ label: 'Acessórios', path: '/acessorios' }, { label: 'Palmilhas' }]}
      current="Palmilha Gel"
    />,
  );

  // The hierarchy is still told in full — dropping the crumb would have made the trail lie about the structure.
  expect(getByTestId('breadcrumb').textContent).toContain('Palmilhas');
  expect(getByText('Palmilhas').tagName).not.toBe('A');
  // ★ and it is unreachable: no anchor by that name, and no anchor anywhere pointing at the 404 path.
  expect(queryByRole('link', { name: 'Palmilhas' })).toBeNull();
  const hrefs = Array.from(getByTestId('breadcrumb').querySelectorAll('a')).map((a) =>
    a.getAttribute('href'),
  );
  expect(hrefs).toEqual(['/acessorios']);
});

test('two unlinked crumbs both render (the key must not collapse them — hrefs are no longer unique)', () => {
  // The old implementation keyed each crumb by its href. With the href gone, keying by it would give every
  // unlinked crumb the same key and React would render one of them.
  const { getByTestId } = render(
    <Breadcrumb
      base={HOST_BASE}
      crumbs={[{ label: 'Acessórios' }, { label: 'Palmilhas' }]}
      current="Palmilha Gel"
    />,
  );

  const text = getByTestId('breadcrumb').textContent ?? '';
  expect(text).toContain('Acessórios');
  expect(text).toContain('Palmilhas');
});

test('the current page stays plain text and marked, linked ancestors or not', () => {
  const { getByText } = render(
    <Breadcrumb base={HOST_BASE} crumbs={[{ label: 'Acessórios' }]} current="Palmilha Gel" />,
  );

  expect(getByText('Palmilha Gel').getAttribute('aria-current')).toBe('page');
});

test('★ MULTISTORE M1-β — the crumb carries a clean PATH; the anchor puts it in the current store', () => {
  // The same trail, rendered on the same page, differs only by the address space the request is in. That is
  // why the crumb holds `path` and not a finished href: the JSON-LD sibling turns the very same value into an
  // absolute canonical URL, which must never grow an `/s/<store>` segment.
  const { getByRole } = render(
    <Breadcrumb
      base={pathScopedBase('sto_outlet')}
      crumbs={[{ label: 'Acessórios', path: '/acessorios' }]}
      current="Palmilha Gel"
    />,
  );
  expect(getByRole('link', { name: 'Acessórios' }).getAttribute('href')).toBe(
    '/s/sto_outlet/acessorios',
  );
});
