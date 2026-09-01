// RICH (S2): the PLP (category list) shows a header (banner + markdown description) when the category has rich
// content; a category with no content (or a null category) renders the current bare PLP — zero regression.

import type { CategoryDoc } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE, storeHref } from '@forgecommerce/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ListTemplate } from './template';

const base = {
  title: 'Roupas',
  crumbs: [],
  products: [],
  page: 1,
  total: 0,
  basePath: storeHref(HOST_BASE, '/roupas'),
  // SEARCH (S2) made these required props of ListTemplate; the RICH header renders the same either way.
  facets: undefined,
  state: { options: {}, cf: {} },
};

const richCategory: CategoryDoc = {
  category_id: 'cat_1',
  name: 'Roupas',
  path: 'roupas',
  handle: 'roupas',
  status: 'active',
  description: 'As melhores **roupas**',
  banner: {
    provider_key: 'cdn/b.jpg',
    kind: 'image',
    role: null,
    position: 0,
    url: 'https://h/b.jpg',
  },
  meta_title: null,
  meta_description: null,
};

test('category with banner + description → the header renders (img + markdown)', () => {
  const html = renderToString(<ListTemplate base={HOST_BASE} {...base} category={richCategory} />);
  expect(html).toContain('https://h/b.jpg'); // banner img
  expect(html).toContain('<strong>roupas</strong>'); // description markdown rendered
});

test('no category content (null) → bare PLP, no banner/description (regression)', () => {
  const html = renderToString(<ListTemplate base={HOST_BASE} {...base} category={null} />);
  expect(html).toContain('Roupas'); // the title still renders
  expect(html).not.toContain('<img'); // no banner
});

test('a category with a banner but no resolved url renders no img (base unset)', () => {
  const noUrl: CategoryDoc = {
    ...richCategory,
    description: null,
    banner: { provider_key: 'cdn/b.jpg', kind: 'image', role: null, position: 0 },
  };
  const html = renderToString(<ListTemplate base={HOST_BASE} {...base} category={noUrl} />);
  expect(html).not.toContain('<img'); // no url → no img (graceful degradation)
});
