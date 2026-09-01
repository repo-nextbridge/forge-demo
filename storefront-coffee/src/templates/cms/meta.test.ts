// CMS page metadata (CMS-1) — the per-page <head> the route emits via generateMetadata. meta_title/description
// feed title/description; canonical is the page's own clean path; meta_title falls back to the title.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import { expect, test } from 'vitest';
import { pageMetadata } from './meta';

const page = (over: Partial<PageDoc> = {}): PageDoc => ({
  slug: 'about',
  title: 'About us',
  template_key: 'institutional-default',
  meta_title: null,
  meta_description: null,
  ...over,
});

test('meta uses meta_title/description and the clean-path canonical', () => {
  expect(
    pageMetadata(page({ meta_title: 'About | Shop', meta_description: 'Who we are' })),
  ).toEqual({
    title: 'About | Shop',
    description: 'Who we are',
    alternates: { canonical: '/about' },
  });
});

test('meta_title falls back to the page title; a missing description is omitted', () => {
  const meta = pageMetadata(page({ title: 'Contact', slug: 'contact' }));
  expect(meta.title).toBe('Contact');
  expect(meta.description).toBeUndefined();
  expect(meta.alternates?.canonical).toBe('/contact');
});
