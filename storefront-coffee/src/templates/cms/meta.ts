// CMS page metadata (SEO, per-page). The registry entity carries meta_title/meta_description; the route's
// generateMetadata maps them to Next Metadata. Canonical is the page's own clean path `/<slug>` (the middleware
// rewrites `/<slug>` -> `/s/<store>/<slug>`, so the public canonical is the clean one). meta_title falls back
// to the page title; meta_description is optional.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import type { Metadata } from 'next';

export function pageMetadata(page: PageDoc): Metadata {
  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
    alternates: { canonical: `/${page.slug}` },
  };
}
