// QA-PACK-1 C1 — the PDP said "Cor: selecione" and sold the first colour anyway.
//
// Eight testers on the bench, and this is the one that costs a return: no swatch marked, the legend literally
// reading "selecione", and "Adicionar ao carrinho" putting the DEFAULT colour in the bag — a colour nobody
// clicked. The shopper is not told; they find out when the box arrives.
//
// The state was never missing. `colorPicked` already exists, already governs the gallery and the swatch ring,
// and is already handed to the SkuSelector — it simply never reached the CTA, which is gated on `soldOut` and
// nothing else. So this file proves the two halves of one sentence: **while the colour axis is unpicked, the
// button does not buy; once it is picked, it buys the colour that was picked.**
//
// Not a duplicate of the earlier fix: that one was about clicking the DEFAULT swatch not lighting up (a pick
// that changed no value). This is about buying with no pick at all.

import { EMPTY_SNAPSHOT } from '@forgeco/storefront-kit/minicart-types';
import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MinicartProvider } from '@/components/minicart/MinicartProvider';
import { makeProduct } from '@/test/fixtures';
import { PdpGallerySelector } from './PdpGallerySelector';

const PATH = '/calcados/tenis';
beforeEach(() => window.history.replaceState(null, '', PATH));

const colorValue = (id: string, value: string, position: number) => ({ id, value, position });

/** A colour axis is only a colour axis when its values are PHOTO-BACKED (`colorAxisId`): the theme renders
 * swatches from the variants' images, so a colour with no photo is just another text axis. The fixtures below
 * carry one image per SKU for that reason — without it this file would test a product the shopper never sees. */
const photo = (name: string) => [
  {
    provider_key: `cdn/${name}.jpg`,
    kind: 'image' as const,
    role: null,
    position: 0,
    url: `https://h/${name}.jpg`,
  },
];

/** A product with a REAL colour axis (two values) — the case the bug lives in. */
function twoColourProduct(): ProductDoc {
  return makeProduct({
    options: [
      {
        id: 'opt_color',
        name: 'Cor',
        position: 0,
        values: [colorValue('v_black', 'Preto', 0), colorValue('v_white', 'Branco', 1)],
      },
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
        media: photo('black'),
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
        media: photo('white'),
      },
    ],
  });
}

/** A colour axis with a SINGLE value: there is nothing to choose, so demanding a choice would be friction we
 * invented. The shopper must be able to buy immediately. */
function oneColourProduct(): ProductDoc {
  const p = twoColourProduct();
  return makeProduct({
    ...p,
    options: [
      { id: 'opt_color', name: 'Cor', position: 0, values: [colorValue('v_black', 'Preto', 0)] },
    ],
    skus: p.skus.filter((s) => s.id === 'sku_black'),
  });
}

function renderPdp(product: ProductDoc, addLine = vi.fn(async () => {})) {
  const actions = {
    readCart: async () => EMPTY_SNAPSHOT,
    addLine,
    updateLine: async () => {},
    removeLine: async () => {},
  };
  render(
    <MinicartProvider actions={actions}>
      <PdpGallerySelector product={product} store="demo" />
    </MinicartProvider>,
  );
  return { addLine };
}

test('★ no colour picked → the CTA does not buy, and says what it wants instead', () => {
  const { addLine } = renderPdp(twoColourProduct());

  const cta = screen.getByTestId('pdp-add-to-cart') as HTMLButtonElement;
  // It asks for the choice rather than pretending the choice was made.
  expect(cta.textContent).toContain('Escolha uma cor');
  expect(cta.disabled).toBe(true);

  // ★ The whole finding: clicking adds NOTHING. Both paths are closed — the JS one (the port call below) and
  // the no-JS one (a disabled submit never posts the form).
  fireEvent.click(cta);
  fireEvent.submit(screen.getByTestId('pdp-buy-row'));
  expect(addLine).not.toHaveBeenCalled();
});

test('★ after picking, the CTA buys — and buys the colour that was picked, not the default', () => {
  const { addLine } = renderPdp(twoColourProduct());

  fireEvent.click(screen.getByLabelText('Branco'));

  const cta = screen.getByTestId('pdp-add-to-cart') as HTMLButtonElement;
  expect(cta.disabled).toBe(false);
  expect(cta.textContent).toContain('Adicionar ao carrinho');

  fireEvent.submit(screen.getByTestId('pdp-buy-row'));
  // The white SKU, at qty 1 — never sku_black, which is what the bug added.
  expect(addLine).toHaveBeenCalledWith('sku_white', 1);
});

test('picking the DEFAULT colour is a pick too — the first swatch also unlocks the CTA', () => {
  // The default SKU already carries Preto, so this click changes no value. It is still a choice, and the
  // shopper who makes it has chosen: gating on "the value changed" would leave this product unbuyable.
  const { addLine } = renderPdp(twoColourProduct());
  fireEvent.click(screen.getByLabelText('Preto'));

  expect((screen.getByTestId('pdp-add-to-cart') as HTMLButtonElement).disabled).toBe(false);
  fireEvent.submit(screen.getByTestId('pdp-buy-row'));
  expect(addLine).toHaveBeenCalledWith('sku_black', 1);
});

test('a colour axis with ONE value demands nothing — there is no choice to make', () => {
  const { addLine } = renderPdp(oneColourProduct());

  const cta = screen.getByTestId('pdp-add-to-cart') as HTMLButtonElement;
  expect(cta.disabled).toBe(false);
  expect(cta.textContent).toContain('Adicionar ao carrinho');
  fireEvent.submit(screen.getByTestId('pdp-buy-row'));
  expect(addLine).toHaveBeenCalledWith('sku_black', 1);
});

test('a product with NO colour axis is untouched (size-only keeps buying on first paint)', () => {
  // The demand is about the colour axis specifically — the axis the gallery and the legend already treat as
  // "unpicked". A size-only product never showed "selecione" and must not start.
  const sizeOnly = makeProduct({});
  const { addLine } = renderPdp(sizeOnly);

  expect((screen.getByTestId('pdp-add-to-cart') as HTMLButtonElement).disabled).toBe(false);
  fireEvent.submit(screen.getByTestId('pdp-buy-row'));
  expect(addLine).toHaveBeenCalled();
});
