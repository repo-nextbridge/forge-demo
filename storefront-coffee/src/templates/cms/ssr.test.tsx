// ★ SSR (CMS-1): the SERVED HTML of an institutional page carries its title + template content — a crawler
// sees everything without JS. We renderToString PageView (the same server render Next produces) and assert
// the raw markup. Also proves the DoD's unknown-template_key fallback renders (never a 500).

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { PageView } from './PageView';

const page = (over: Partial<PageDoc> = {}): PageDoc => ({
  slug: 'about',
  title: 'Sobre a loja',
  template_key: 'institutional-default',
  meta_title: null,
  meta_description: null,
  ...over,
});

test('the raw server HTML of a page carries its title (crawler-visible)', () => {
  const html = renderToString(
    <PageView base={HOST_BASE} page={page({ title: 'Nossa história' })} />,
  );
  expect(html).toContain('Nossa história');
});

test('the faq template renders its content statically (theme code, not stored)', () => {
  const html = renderToString(
    <PageView base={HOST_BASE} page={page({ template_key: 'faq', title: 'Perguntas' })} />,
  );
  expect(html).toContain('Perguntas');
  expect(html).toContain('prazo de entrega'); // a hardcoded FAQ item from the theme template
});

test('an unknown template_key falls back to the default template with a warning, not a 500', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const html = renderToString(
    <PageView base={HOST_BASE} page={page({ template_key: 'does-not-exist', title: 'X' })} />,
  );
  expect(html).toContain('X'); // still rendered
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('does-not-exist'));
  warn.mockRestore();
});
