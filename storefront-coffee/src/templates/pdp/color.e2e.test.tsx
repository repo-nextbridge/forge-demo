// S7-SF-PDP — the color axis drives the buybox AND the gallery: a "Cor" option renders as photo swatches, a
// pick marks the swatch, narrows the gallery to that color's photos, updates the price/name, and rewrites the
// `?sku=` deep-link. A size-only product keeps the S5/S6 gallery mechanic (covered by media/deeplink tests).

import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { PdpGallerySelector } from './PdpGallerySelector';

const PATH = '/calcados/tenis';
const at = (search: string) => window.history.replaceState(null, '', `${PATH}${search}`);
beforeEach(() => at(''));

/** A two-color × one-size product: each color's SKU carries its own photo (→ the "Cor" axis is photo-backed). */
function colorProduct(): ProductDoc {
  return makeProduct({
    options: [
      {
        id: 'opt_color',
        name: 'Cor',
        position: 0,
        values: [
          { id: 'v_black', value: 'Preto', position: 0 },
          { id: 'v_white', value: 'Branco', position: 1 },
        ],
      },
    ],
    media: [
      { provider_key: 'cdn/p.jpg', kind: 'image', role: null, position: 0, url: 'https://h/p.jpg' },
    ],
    skus: [
      {
        id: 'sku_black',
        code: 'TEN-BLACK',
        amount: 7990,
        currency: 'BRL',
        status: 'active',
        name: 'Preto',
        ref: null,
        ean: null,
        is_default: true,
        metadata: {},
        option_values: [
          { option_id: 'opt_color', option_name: 'Cor', value_id: 'v_black', value: 'Preto' },
        ],
        media: [
          {
            provider_key: 'cdn/black.jpg',
            kind: 'image',
            role: null,
            position: 0,
            url: 'https://h/black.jpg',
          },
        ],
      },
      {
        id: 'sku_white',
        code: 'TEN-WHITE',
        amount: 8990,
        currency: 'BRL',
        status: 'active',
        name: 'Branco',
        ref: null,
        ean: null,
        metadata: {},
        option_values: [
          { option_id: 'opt_color', option_name: 'Cor', value_id: 'v_white', value: 'Branco' },
        ],
        media: [
          {
            provider_key: 'cdn/white.jpg',
            kind: 'image',
            role: null,
            position: 0,
            url: 'https://h/white.jpg',
          },
        ],
      },
    ],
  });
}

test('the Cor axis renders as photo swatches, not text buttons', () => {
  const { getByTestId } = render(<PdpGallerySelector product={colorProduct()} />);
  const selector = getByTestId('sku-selector');
  // The color fieldset is flagged data-axis="color" and carries <img> swatches (no "Preto"/"Branco" text button).
  expect(selector.querySelector('[data-axis="color"]')).not.toBeNull();
  expect(selector.querySelectorAll('[data-axis="color"] img').length).toBe(2);
});

/** The image srcs INSIDE the gallery only (never the buybox swatches, which always show their color photo). */
function gallerySrcs(container: HTMLElement): (string | null)[] {
  const gallery = container.querySelector('[data-testid="gallery"]');
  return [...(gallery?.querySelectorAll('img') ?? [])].map((i) => i.getAttribute('src'));
}

test('no color picked yet → the gallery shows ALL colors (every variant photo)', () => {
  const { container } = render(<PdpGallerySelector product={colorProduct()} />);
  const thumbs = gallerySrcs(container);
  // Both colors' photos are present before any pick (the "todas as cores" initial state).
  expect(thumbs).toContain('https://h/black.jpg');
  expect(thumbs).toContain('https://h/white.jpg');
});

test('picking a color marks the swatch, filters the gallery, updates price + name + ?sku=', () => {
  const { getByTestId, getByLabelText, container } = render(
    <PdpGallerySelector product={colorProduct()} />,
  );
  // default (starred) = Preto
  expect(getByTestId('sku-code').textContent).toBe('TEN-BLACK');

  const white = getByLabelText('Branco');
  fireEvent.click(white);

  // the swatch is marked
  expect(white.getAttribute('data-active')).toBe('true');
  // price + variant name + code react
  expect(getByTestId('sku-code').textContent).toBe('TEN-WHITE');
  expect(getByTestId('price').textContent).toContain('89,90');
  expect(getByTestId('variant-name').textContent).toBe('Branco');
  // the URL is the shareable deep-link
  expect(window.location.search).toBe('?sku=TEN-WHITE');
  // the gallery narrowed to the white photo; the black one is gone from the stage/strip
  const stage = container.querySelector('.main img')?.getAttribute('src');
  expect(stage).toBe('https://h/white.jpg');
  expect(gallerySrcs(container)).not.toContain('https://h/black.jpg');
});

/** The colour legend's value ("Cor: <valor>") — the strong inside the axis label. */
function colorLegend(container: HTMLElement): string | undefined {
  return container.querySelector('#sku-axis-opt_color strong')?.textContent ?? undefined;
}

// The FIRST swatch is the default SKU's colour, so picking it changes no value — but it IS a pick. The gallery
// must narrow and the legend must name the colour, exactly as it does for any other swatch.
test('picking the FIRST (default) color counts as a pick: legend, swatch and gallery all follow it', () => {
  const { getByLabelText, container } = render(<PdpGallerySelector product={colorProduct()} />);
  // Before any pick: the legend asks for a choice and no swatch is marked (the prototype's initial state).
  expect(colorLegend(container)).toBe('selecione');
  expect(getByLabelText('Preto').getAttribute('data-active')).toBe('false');

  const black = getByLabelText('Preto');
  fireEvent.click(black);

  expect(colorLegend(container)).toBe('Preto');
  expect(black.getAttribute('data-active')).toBe('true');
  // and the gallery narrowed to black — the white photo is gone
  expect(gallerySrcs(container)).not.toContain('https://h/white.jpg');
});

test('opening ?sku=TEN-WHITE lands on white: swatch, gallery, price, name all follow the color link', () => {
  at('?sku=TEN-WHITE');
  const { getByTestId, getByLabelText, container } = render(
    <PdpGallerySelector product={colorProduct()} />,
  );
  expect(getByTestId('sku-code').textContent).toBe('TEN-WHITE');
  expect(getByLabelText('Branco').getAttribute('data-active')).toBe('true');
  expect(container.querySelector('.main img')?.getAttribute('src')).toBe('https://h/white.jpg');
  // a deep-link IS an explicit color pick → the gallery is already filtered (black absent)
  expect(gallerySrcs(container)).not.toContain('https://h/black.jpg');
});
