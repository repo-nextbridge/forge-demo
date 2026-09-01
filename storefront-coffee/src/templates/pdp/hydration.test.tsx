// PRE-S7-STOREFRONT-DEBT — the PDP's hydration mismatches, turned into tests. The overlay said "2 errors", and
// it meant it: there were TWO, from unrelated causes. Both are below.
//
// (2) THE FORM. The add-to-cart form declared `method="post"` on a <form> whose `action` is a Server Action —
// and React OWNS the method there ("Cannot specify a encType or method for a form that specifies a function as
// the action. React provides those automatically. They will get overridden."). It writes `method="POST"` into
// the server HTML and applies OUR `method="post"` on the client: same form, two methods, mismatch. The fix is
// to stop fighting it — remove the prop. The no-JS fallback is unaffected: the method in the HTML is React's,
// and it was always POST.
//
// (1) THE IMAGE. The cause was not the data: `mediaSrc()` reads
// FORGE_MEDIA_BASE_URL — a SERVER-ONLY env (no NEXT_PUBLIC_ prefix) — and the Gallery, which S6-PDP turned into
// a client component, called it. On the server the env is there (→ providerKey → next/image OPTIMIZED); in the
// browser bundle the same expression is `undefined` (→ unoptimized). Same <img>, two different `src`/`srcset`/
// `sizes`. React hydrates, compares, and screams.
//
// WHAT THIS TEST REPRODUCES — the RSC boundary, faithfully: PROPS cross it (the server serializes them), the ENV
// does not. So the server render runs with the env SET, and the hydration runs with it DELETED, against the SAME
// props. That is the browser's situation exactly. A unit test cannot catch this (it renders once, in one
// environment) — this one renders twice, in two, and hydrates across.

import { mediaOptimized } from '@forgecommerce/storefront-kit/media/src';
import { EMPTY_SNAPSHOT } from '@forgecommerce/storefront-kit/minicart-types';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AddToCartForm } from '@/components/minicart/AddToCartForm';
import { type MinicartActions, MinicartProvider } from '@/components/minicart/MinicartProvider';
import { makeProduct } from '@/test/fixtures';
import { PdpGallerySelector } from './PdpGallerySelector';

const BASE = 'https://cdn.test';

const NOOP_MINICART: MinicartActions = {
  readCart: async () => EMPTY_SNAPSHOT,
  addLine: async () => {},
  updateLine: async () => {},
  removeLine: async () => {},
};

const product = makeProduct({
  media: [
    {
      provider_key: 'ten_a/one.jpg',
      kind: 'image',
      role: 'hero',
      position: 0,
      url: `${BASE}/one.jpg`,
    },
    {
      provider_key: 'ten_a/two.jpg',
      kind: 'image',
      role: null,
      position: 1,
      url: `${BASE}/two.jpg`,
    },
  ],
});

let errors: string[] = [];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.FORGE_MEDIA_BASE_URL;
});

test('the PDP hydrates CLEAN — the browser renders the same <img> the server did (no media-env divergence)', async () => {
  // ── the server: the env is configured, so it resolves the optimizer switch and renders the island's HTML.
  // `optimized` is what the server SERIALIZES for the client — the PdpTemplate computes it the same way.
  process.env.FORGE_MEDIA_BASE_URL = BASE;
  const optimized = mediaOptimized();
  expect(optimized).toBe(true); // the server really is on the optimized path (else the test proves nothing)
  const html = renderToString(<PdpGallerySelector product={product} optimized={optimized} />);
  expect(html).toContain('<img'); // and it really did render an image

  // ── the browser: the server-only env does not exist here. Only the props crossed.
  delete process.env.FORGE_MEDIA_BASE_URL;
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  await act(async () => {
    hydrateRoot(container, <PdpGallerySelector product={product} optimized={optimized} />);
  });

  const mismatches = errors.filter((e) => /hydrat|did not match|server rendered/i.test(e));
  expect(mismatches, `hydration mismatch on the PDP:\n${mismatches.join('\n---\n')}`).toEqual([]);
});

test('the add-to-cart form leaves the method to React — a Server Action form never declares its own', () => {
  // React refuses the prop OUT LOUD on the server ("...method for a form that specifies a function as the
  // action ... will get overridden") and then hydrates the client with ours: `method="POST"` on the server,
  // `method="post"` in the browser. Rendering it must produce no such complaint.
  renderToString(
    <MinicartProvider actions={NOOP_MINICART}>
      <AddToCartForm action={async () => {}} skuId="sku_1" />
    </MinicartProvider>,
  );

  const overridden = errors.filter((e) => /encType or method|will get overridden/i.test(e));
  expect(overridden, `React is overriding a prop we set:\n${overridden.join('\n')}`).toEqual([]);
});
