// SkuSelector reflects the catalog model: option tuple -> SKU -> the SKU's price (not the product's).

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { fireEvent, render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { resolveSku, SkuSelector } from './SkuSelector';

/** A sparse two-axis product (Cor × Tamanho) with no media (so both axes render as text chips): Vermelho exists
 * only in 39, Azul in 39 and 40 — i.e. Vermelho+40 is NOT a real SKU. */
function sparseProduct(): ProductDoc {
  const sku = (id: string, code: string, color: [string, string], size: [string, string]) => ({
    id,
    code,
    amount: 8000,
    currency: 'BRL',
    status: 'active' as const,
    name: null,
    ref: null,
    ean: null,
    metadata: {},
    option_values: [
      { option_id: 'opt_color', option_name: 'Cor', value_id: color[0], value: color[1] },
      { option_id: 'opt_size', option_name: 'Tamanho', value_id: size[0], value: size[1] },
    ],
    media: [],
  });
  return makeProduct({
    options: [
      {
        id: 'opt_color',
        name: 'Cor',
        position: 0,
        values: [
          { id: 'red', value: 'Vermelho', position: 0 },
          { id: 'blue', value: 'Azul', position: 1 },
        ],
      },
      {
        id: 'opt_size',
        name: 'Tamanho',
        position: 1,
        values: [
          { id: 's39', value: '39', position: 0 },
          { id: 's40', value: '40', position: 1 },
        ],
      },
    ],
    skus: [
      sku('sku_red_39', 'R39', ['red', 'Vermelho'], ['s39', '39']),
      sku('sku_blue_39', 'B39', ['blue', 'Azul'], ['s39', '39']),
      sku('sku_blue_40', 'B40', ['blue', 'Azul'], ['s40', '40']),
    ],
  });
}

test('default selection resolves the first SKU and shows ITS price', () => {
  const { getByTestId } = render(<SkuSelector product={makeProduct()} />);
  expect(getByTestId('price').textContent).toContain('79,90'); // sku_39 = 7990 centavos
  expect(getByTestId('sku-code').textContent).toBe('TEN-39');
});

test('choosing another option value re-resolves the SKU and updates the price', () => {
  const { getByTestId, getByText } = render(<SkuSelector product={makeProduct()} />);
  fireEvent.click(getByText('40'));
  expect(getByTestId('price').textContent).toContain('89,90'); // sku_40 = 8990 centavos
  expect(getByTestId('sku-code').textContent).toBe('TEN-40');
});

// PRE-S7-FIXPACK — the "was" price on the PDP. The data was already on the sku (the ProductCard renders it)
// but the buybox handed <Price> only the amount, so a promoted SKU looked unpromoted. The strike-through is
// PER SKU: it must appear for the promoted one and be GONE the moment the shopper picks a plain one.
function promotedProduct() {
  const base = makeProduct();
  const [s39, s40] = base.skus;
  if (!s39 || !s40) throw new Error('fixture has no skus');
  return makeProduct({
    skus: [
      { ...s39, compare_at_amount: 9990 },
      { ...s40, compare_at_amount: null },
    ],
  });
}

test('a SKU on sale shows the struck-through "was" price in the buybox', () => {
  const { getByTestId } = render(<SkuSelector product={promotedProduct()} />);
  expect(getByTestId('price-compare').textContent).toContain('99,90');
  expect(getByTestId('price').textContent).toContain('79,90');
});

test('picking a SKU with no compare_at hides the "was" price (it follows the selection)', () => {
  const { getByText, getByTestId, queryByTestId } = render(
    <SkuSelector product={promotedProduct()} />,
  );
  fireEvent.click(getByText('40'));
  expect(queryByTestId('price-compare')).toBeNull();
  expect(getByTestId('price').textContent).toContain('89,90');
});

test('resolveSku matches the full option tuple; an option-less product resolves its lone SKU', () => {
  const product = makeProduct();
  expect(resolveSku(product.skus, { opt_size: 'v_40' })?.code).toBe('TEN-40');

  const first = makeProduct().skus[0];
  if (!first) throw new Error('fixture has no sku');
  const simple = makeProduct({ options: [], skus: [{ ...first, option_values: [] }] });
  expect(resolveSku(simple.skus, {})?.code).toBe('TEN-39');
});

// o4 #22 — the buybox renders the COLOUR axis before Tamanho even when the doc lists Tamanho first (derived from
// the colour-axis role, never the stored option order). We assert the DOM order of the two axis labels.
test('renders Cor before Tamanho when the doc lists Tamanho first', () => {
  const baseSku = makeProduct().skus[0];
  if (!baseSku) throw new Error('fixture has no sku');
  const colorProduct = makeProduct({
    options: [
      {
        id: 'size',
        name: 'Tamanho',
        position: 0,
        values: [{ id: '38', value: '38', position: 0 }],
      },
      {
        id: 'color',
        name: 'Cor',
        position: 1,
        values: [{ id: 'preto', value: 'Preto', position: 0 }],
      },
    ],
    skus: [
      {
        ...baseSku,
        id: 'sku_p_38',
        code: 'X-P-38',
        option_values: [
          { option_id: 'size', option_name: 'Tamanho', value_id: '38', value: '38' },
          { option_id: 'color', option_name: 'Cor', value_id: 'preto', value: 'Preto' },
        ],
        media: [
          { provider_key: 'p/preto', kind: 'image', role: null, position: 0, url: 'u/preto' },
        ],
      },
    ],
  });
  const { container } = render(<SkuSelector product={colorProduct} />);
  const html = container.innerHTML;
  expect(html.indexOf('Cor:')).toBeGreaterThan(-1);
  expect(html.indexOf('Cor:')).toBeLessThan(html.indexOf('Tamanho:')); // Cor first
  // o4 #21 — the axis groups use a <span> label, NOT a <legend> (a legend straddled the section divider); two
  // fieldsets, zero legends.
  expect(container.querySelectorAll('fieldset').length).toBe(2);
  expect(container.querySelectorAll('legend').length).toBe(0);
});

// #11a — cross-axis disabling: with Vermelho picked (the default sku's colour), size 40 pre-disables because no
// Vermelho sku carries 40; picking Azul (which has 40) re-enables it. The impossible pair is never reachable.
test('cross-axis: an impossible size pre-disables under the current colour and re-enables when compatible', () => {
  const { getByRole } = render(<SkuSelector product={sparseProduct()} />);
  // Default resolves the first sku (Vermelho, 39). Vermelho has no 40 → 40 is greyed from the start.
  expect(getByRole('button', { name: '40' }).hasAttribute('disabled')).toBe(true);
  expect(getByRole('button', { name: '39' }).hasAttribute('disabled')).toBe(false);

  fireEvent.click(getByRole('button', { name: 'Azul' })); // Azul carries 40
  expect(getByRole('button', { name: '40' }).hasAttribute('disabled')).toBe(false);
});

// #11b — out of stock on the PDP: a sku at 0 available disables the CTA and relabels it "Esgotado", and its
// swatch/size is marked out of stock (data-oos). No availability data → the old behaviour (no sold-out state).
test('out of stock: the resolved sku at 0 disables the CTA ("Esgotado") and marks the sold-out size', () => {
  const product = makeProduct(); // single Tamanho axis: sku_39 (default) + sku_40
  const { getByTestId, getByRole, rerender } = render(
    <SkuSelector product={product} store="s1" availability={{ sku_39: 0, sku_40: 5 }} />,
  );
  const cta = getByTestId('pdp-add-to-cart');
  expect(cta.textContent).toContain('Esgotado');
  expect(cta.hasAttribute('disabled')).toBe(true);
  expect(getByRole('button', { name: /39.*esgotado/i }).getAttribute('data-oos')).toBe('true');

  // Selecting the in-stock 40 clears the sold-out state.
  fireEvent.click(getByRole('button', { name: '40' }));
  const cta2 = getByTestId('pdp-add-to-cart');
  expect(cta2.textContent).toContain('Adicionar ao carrinho');
  expect(cta2.hasAttribute('disabled')).toBe(false);

  // With no availability wired, the CTA is never sold out.
  rerender(<SkuSelector product={product} store="s1" />);
  expect(getByTestId('pdp-add-to-cart').textContent).toContain('Adicionar ao carrinho');
});

// ── ★ SF-BACKORDER-NAO-RENDERIZA — the shop sells past zero and the PDP said it could not ────────────────────
//
// `read.availability` has answered `backorder: { extra_days }` on the PUBLIC face since the epic. Nothing in
// the storefront consumed it, so a merchant who deliberately turned "keep selling" on watched the buybox tell
// every visitor "Esgotado" — the exact opposite of the decision they made in the admin, on the one screen
// where the sale is won or lost.
//
// The treatment is the design guide's (CHANGELOG-LOGISTICA §1), not invented here: dashed border on the size,
// amber notice above the price, and +N days added to the delivery windows (that last one lives in CepBox).
test('★ backorder: a sold-out sku the shop still sells is BUYABLE, dashed, and says +N days', () => {
  const product = makeProduct(); // single Tamanho axis: sku_39 (default) + sku_40
  const { getByTestId, getByRole, queryByTestId } = render(
    <SkuSelector
      product={product}
      store="s1"
      availability={{ sku_39: 0, sku_40: 5 }}
      backorder={{ sku_39: { extra_days: 7 } }}
    />,
  );
  // 1. The CTA buys. This is the whole defect: `available <= 0` is NOT "unsellable" once the policy says so.
  const cta = getByTestId('pdp-add-to-cart');
  expect(cta.textContent).toContain('Adicionar ao carrinho');
  expect(cta.hasAttribute('disabled')).toBe(false);
  // 2. The size wears the dashed border, and it is NOT the sold-out marker (two different states, two skins).
  const chip = getByRole('button', { name: /39/ });
  expect(chip.getAttribute('data-backorder')).toBe('true');
  expect(chip.hasAttribute('data-oos')).toBe(false);
  // 3. The amber notice, above the price, carrying the number the buyer is owed.
  const notice = getByTestId('pdp-backorder');
  expect(notice.textContent).toContain('Sob encomenda');
  expect(notice.textContent).toContain('7');

  // 4. Picking a sku with stock clears all of it.
  fireEvent.click(getByRole('button', { name: '40' }));
  expect(queryByTestId('pdp-backorder')).toBeNull();
  expect(getByRole('button', { name: '40' }).hasAttribute('data-backorder')).toBe(false);
});

test('★ backorder with no extra days is still a promise — buyable, noticed, and no invented number', () => {
  // `extra_days: null` means "buyable, delivery estimate unchanged" (the kernel says so explicitly). Reading
  // it as "no promise" is how the sku lands back under Esgotado; inventing a number is the other failure.
  const product = makeProduct();
  const { getByTestId } = render(
    <SkuSelector
      product={product}
      store="s1"
      availability={{ sku_39: 0, sku_40: 5 }}
      backorder={{ sku_39: { extra_days: null } }}
    />,
  );
  expect(getByTestId('pdp-add-to-cart').hasAttribute('disabled')).toBe(false);
  const notice = getByTestId('pdp-backorder');
  expect(notice.textContent).toContain('Sob encomenda');
  expect(notice.textContent).not.toMatch(/\d/);
});

test('★ THE FENCE — with no backorder wiring, a sold-out sku is exactly as sold out as it was', () => {
  const product = makeProduct();
  const { getByTestId, getByRole, queryByTestId } = render(
    <SkuSelector product={product} store="s1" availability={{ sku_39: 0, sku_40: 5 }} />,
  );
  const cta = getByTestId('pdp-add-to-cart');
  expect(cta.textContent).toContain('Esgotado');
  expect(cta.hasAttribute('disabled')).toBe(true);
  expect(getByRole('button', { name: /39.*esgotado/i }).getAttribute('data-oos')).toBe('true');
  expect(queryByTestId('pdp-backorder')).toBeNull();
});
