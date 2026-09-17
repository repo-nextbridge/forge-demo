// PRE-S7-STOREFRONT-DEBT — the brand page draws the brand's LOGO. The data has been there since S5-BRAND (the
// read port resolves `logo_url` at read time, and the page already ships it as the og:image); the body simply
// dropped it on the floor. Both paths are proven here, because a storefront never shows a broken image:
//   • a brand WITH a logo → the header renders it (the img, and the brand's name as its alt);
//   • a brand WITHOUT one → nothing renders (the bare heading — byte-for-byte the page that shipped before).

import { HOST_BASE, storeHref } from '@forgeco/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ListTemplate } from './template';

const base = {
  title: 'Aurora',
  crumbs: [],
  products: [],
  page: 1,
  total: 0,
  basePath: storeHref(HOST_BASE, '/b/aurora'),
  facets: undefined,
  state: { options: {}, cf: {} },
};

test('brand WITH a logo → the header draws it, alt = the brand name', () => {
  const html = renderToString(
    <ListTemplate
      base={HOST_BASE}
      {...base}
      brand={{ name: 'Aurora', logo_url: 'https://h/aurora.png' }}
    />,
  );
  expect(html).toContain('https://h/aurora.png');
  expect(html).toContain('alt="Aurora"');
  expect(html).toContain('Aurora'); // the heading still names the brand
});

test('brand WITHOUT a logo → no img at all (the bare page, never a broken image)', () => {
  const html = renderToString(
    <ListTemplate base={HOST_BASE} {...base} brand={{ name: 'Aurora' }} />,
  );
  expect(html).toContain('Aurora');
  expect(html).not.toContain('<img');
});

test('no brand (a category PLP) → unchanged, no brand header', () => {
  const html = renderToString(<ListTemplate base={HOST_BASE} {...base} title="Roupas" />);
  expect(html).not.toContain('<img');
});
