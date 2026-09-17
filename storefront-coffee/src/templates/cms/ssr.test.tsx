// ★ SSR (CMS-1): the SERVED HTML of an institutional page carries its title + template content — a crawler
// sees everything without JS. We renderToString PageView (the same server render Next produces) and assert
// the raw markup. Also proves the DoD's unknown-template_key fallback renders (never a 500).
//
// ★★ AND THE STORE AXIS ENDS UP IN THE HTML, which is the only place it is worth proving. The registry's own
// suite grades the lookup; this file grades what a shopper is actually served, through the same component
// tree the route mounts and with the environment the box hands this container.

import type { PageDoc } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { OWN_STORE_ENV } from '@/lib/own-store';
import { PageView } from './PageView';

/** The café — the store this image is the fork of — and the counter, the other store of the same tenant. */
const CAFE = 'sto_01M1JS22WZ4RN8PGH9GG56PJPW';
const BALCAO = 'sto_01M1EWQFH253ZE5WKJDAEZ6PNJ';

const page = (over: Partial<PageDoc> = {}): PageDoc => ({
  slug: 'about',
  title: 'Sobre a loja',
  template_key: 'institutional-default',
  meta_title: null,
  meta_description: null,
  ...over,
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('the raw server HTML of a page carries its title (crawler-visible)', () => {
  const html = renderToString(
    <PageView base={HOST_BASE} store={CAFE} page={page({ title: 'Nossa história' })} />,
  );
  expect(html).toContain('Nossa história');
});

test('the faq template renders its content statically (theme code, not stored)', () => {
  const html = renderToString(
    <PageView base={HOST_BASE} store={CAFE} page={page({ template_key: 'faq', title: 'Perguntas' })} />,
  );
  expect(html).toContain('Perguntas');
  expect(html).toContain('prazo de entrega'); // a hardcoded FAQ item from the theme template
});

test('an unknown template_key falls back to the default template with a warning, not a 500', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const html = renderToString(
    <PageView base={HOST_BASE} store={CAFE} page={page({ template_key: 'does-not-exist', title: 'X' })} />,
  );
  expect(html).toContain('X'); // still rendered
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('does-not-exist'));
  warn.mockRestore();
});

// ── ★★ the store axis, as a shopper receives it ─────────────────────────────────────────────────────────

test("★★ the café's /sobre is served in the CAFÉ'S words, and the shoe shop's are gone from it", () => {
  vi.stubEnv(OWN_STORE_ENV, CAFE);
  const html = renderToString(
    <PageView base={HOST_BASE} store={CAFE} page={page({ slug: 'sobre', template_key: 'about', title: 'Sobre' })} />,
  );
  expect(html).toContain('torrefação');
  // The measured defect, asserted as an absence: this exact sentence was being served on the coffee shop's
  // own «Sobre» page, under its own theme, because the body was shared with the reference vitrine.
  expect(html).not.toContain('loja de calçados');
});

test('★★ the OTHER store of this tenant still gets the shared body — the overlay is not a replacement', () => {
  vi.stubEnv(OWN_STORE_ENV, CAFE);
  const html = renderToString(
    <PageView base={HOST_BASE} store={BALCAO} page={page({ slug: 'sobre', template_key: 'about', title: 'Sobre' })} />,
  );
  expect(html).toContain('loja de calçados'); // the shared template, rendered — not a 404 and not the default
  expect(html).not.toContain('torrefação');
});
