// S5-SKU-EXPAND — the PDP gallery follows the variant: the selected SKU's media drives the gallery, falling back
// to the product's media when the variant has none. The selected variant's name shows under the title.
import { fireEvent, render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { PdpGallerySelector } from './PdpGallerySelector';

test('gallery swaps to the selected variant media, falls back to product media, shows the variant name', () => {
  const base = makeProduct();
  const s39 = base.skus[0];
  const s40 = base.skus[1];
  if (!s39 || !s40) throw new Error('fixture needs two skus');
  const product = makeProduct({
    media: [
      {
        provider_key: 'cdn/prod.jpg',
        kind: 'image',
        role: null,
        position: 0,
        url: 'https://h/prod.jpg',
      },
    ],
    skus: [
      {
        ...s39,
        name: 'Green',
        media: [
          {
            provider_key: 'cdn/g.jpg',
            kind: 'image',
            role: null,
            position: 0,
            url: 'https://h/green.jpg',
          },
        ],
      },
      { ...s40, name: 'Red', media: [] }, // no media → falls back to the product's
    ],
  });

  const { getByText, getByTestId, container } = render(<PdpGallerySelector product={product} />);
  // default selection = sku_39 → its own media + name.
  expect(getByTestId('variant-name').textContent).toBe('Green');
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://h/green.jpg');

  // select sku_40 (no media) → gallery falls back to the product media; the variant name updates.
  fireEvent.click(getByText('40'));
  expect(getByTestId('variant-name').textContent).toBe('Red');
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://h/prod.jpg');
});
