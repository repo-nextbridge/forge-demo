// S6-PDP — THE SHARED LINK: pick the green one, share the URL, whoever opens it gets GREEN.
// Browser e2e (jsdom, port mocked): the PDP is mounted at a URL carrying `?sku=`, and we assert the whole page
// state follows — variant, price, gallery and title — and that choosing another variant rewrites the URL.

import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { PdpGallerySelector } from './PdpGallerySelector';

const PATH = '/roupas/calcados/tenis-esportivo';

function product(): ProductDoc {
  const base = makeProduct();
  const s39 = base.skus[0];
  const s40 = base.skus[1];
  if (!s39 || !s40) throw new Error('fixture needs two skus');
  return makeProduct({
    media: [
      { provider_key: 'cdn/p.jpg', kind: 'image', role: null, position: 0, url: 'https://h/p.jpg' },
    ],
    skus: [
      { ...s39, name: 'Verde Xtreme', media: [] },
      {
        ...s40,
        name: 'Rosa Choque',
        media: [
          {
            provider_key: 'cdn/rosa.jpg',
            kind: 'image',
            role: null,
            position: 0,
            url: 'https://h/rosa.jpg',
          },
        ],
      },
    ],
  });
}

const at = (search: string) => window.history.replaceState(null, '', `${PATH}${search}`);

beforeEach(() => at(''));

test('a clean browser opening ?sku=TEN-40 lands on that variant: price, code, gallery and title', () => {
  at('?sku=TEN-40');
  const { getByTestId, container } = render(<PdpGallerySelector product={product()} />);

  expect(getByTestId('sku-code').textContent).toBe('TEN-40');
  expect(getByTestId('price').textContent).toContain('89,90');
  expect(getByTestId('variant-name').textContent).toBe('Rosa Choque');
  expect(container.querySelector('h1')?.textContent).toBe('Tênis Esportivo - Rosa Choque');
  expect(container.querySelector('.main img')?.getAttribute('src')).toBe('https://h/rosa.jpg');
});

test('the sku ID also resolves (a pasted/older link is not a dead link)', () => {
  at('?sku=sku_40');
  const { getByTestId } = render(<PdpGallerySelector product={product()} />);
  expect(getByTestId('sku-code').textContent).toBe('TEN-40');
});

test('an unknown sku param is ignored (the default variant renders, never a broken page)', () => {
  at('?sku=NOPE');
  const { getByTestId } = render(<PdpGallerySelector product={product()} />);
  expect(getByTestId('sku-code').textContent).toBe('TEN-39');
});

test('choosing a variant rewrites the URL (that IS the shareable link) and keeps the other params', () => {
  at('?utm=news');
  const { getByText, getByTestId } = render(<PdpGallerySelector product={product()} />);
  expect(getByTestId('sku-code').textContent).toBe('TEN-39');

  fireEvent.click(getByText('40'));

  expect(window.location.search).toBe('?utm=news&sku=TEN-40');
  expect(window.location.pathname).toBe(PATH); // replaceState, not a navigation
  expect(getByTestId('sku-code').textContent).toBe('TEN-40');
});
