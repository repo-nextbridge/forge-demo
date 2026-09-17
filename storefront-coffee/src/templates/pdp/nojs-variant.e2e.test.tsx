// ★★ QA16 / S2A-4 — WITHOUT JAVASCRIPT, A PRODUCT WITH VARIATIONS WAS UNBUYABLE.
//
// Measured in Staging on 2026-08-28: a single-variant product buys end to end with JS off (the pipeline is
// there, the item lands in /checkout), while a product WITH a colour axis serves a CTA frozen on "Escolha uma
// cor". Two halves, both in the served bytes:
//
//   1. the swatches/chips were `<button type="button">` OUTSIDE any form — a control whose ONLY effect is an
//      onClick handler, so with no JS a click is worth nothing;
//   2. `?sku=<code>` — the deep link the PDP itself writes into the address bar — was read on the CLIENT only
//      (a layout effect over `window.location`), so the SERVER answered the same default variant for every
//      value of it. The HTML for `?sku=TEN-WHITE` was byte-identical to the HTML for no query at all.
//
// Either half alone leaves the shopper stuck: a link that leads nowhere, or a form with nothing to click.
//
// ⚠️ WHY EVERY ASSERTION HERE IS OVER `renderToStaticMarkup` AND NOT OVER A RENDERED COMPONENT. A test that
// mounts the selector in a DOM runs React, and React is the very thing that is absent in the failure being
// fixed — such a test stays green with the defect fully intact (it did: `color.e2e`, `deeplink.e2e` and
// `color-required.e2e` all pass against the broken build). The subject here is the BYTES the server sends.
// The markup is parsed with DOMParser purely to query it; nothing in this file mounts, hydrates or clicks.

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { SKU_PARAM } from '@forgeco/storefront-kit/sku-url';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { PdpTemplate } from './template';

const value = (id: string, v: string, position: number) => ({ id, value: v, position });

/** A colour axis is only a colour axis when its values are PHOTO-BACKED (`colorAxisId`) — same reason the
 * `color-required` fixtures carry an image per sku: without it this would test a product nobody sees. */
const photo = (name: string) => [
  {
    provider_key: `cdn/${name}.jpg`,
    kind: 'image' as const,
    role: null,
    position: 0,
    url: `https://h/${name}.jpg`,
  },
];

/** The shape the achado is about: two colours, so a choice is genuinely required before buying. */
function twoColourProduct(): ProductDoc {
  return makeProduct({
    options: [
      {
        id: 'opt_color',
        name: 'Cor',
        position: 0,
        values: [value('v_black', 'Preto', 0), value('v_white', 'Branco', 1)],
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

/** The served HTML of the PDP, exactly as a browser with JS disabled receives it. */
function serve(product: ProductDoc, initialSku?: string): Document {
  const html = renderToStaticMarkup(
    <PdpTemplate product={product} crumbs={[]} store="demo" initialSku={initialSku} />,
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

const axisControls = (doc: Document) =>
  [...doc.querySelectorAll('[data-testid="sku-selector"] fieldset button')] as HTMLButtonElement[];

test('★★ the served HTML gives every variation control a NATIVE effect: a GET submit carrying the sku it picks', () => {
  const doc = serve(twoColourProduct());
  const controls = axisControls(doc);
  expect(controls.length).toBe(2); // Preto, Branco

  for (const control of controls) {
    // A submit button, not a `type="button"` whose only effect is a handler that no-JS never runs.
    expect(control.getAttribute('type')).toBe('submit');
    // It NAMES the parameter and carries the code of the sku that pick resolves to — the server's whole input.
    expect(control.getAttribute('name')).toBe(SKU_PARAM);
    // And it is inside a GET form, so the browser turns the click into `?sku=<code>` on this same URL.
    const form = control.closest('form');
    expect(form).not.toBeNull();
    expect(form?.getAttribute('method')).toBe('get');
    // No `action`: the submission targets the current URL, so the store prefix and the product path survive.
    expect(form?.hasAttribute('action')).toBe(false);
  }

  // The two controls point at the two variants, and at the RIGHT ones.
  expect(controls.map((c) => c.getAttribute('value'))).toEqual(['TEN-BLACK', 'TEN-WHITE']);
});

test('★★ the SERVER honours ?sku= — the HTML for a named variant is that variant', () => {
  const chosen = serve(twoColourProduct(), 'TEN-WHITE');

  expect(chosen.querySelector('[data-testid="sku-code"]')?.textContent).toBe('TEN-WHITE');
  expect(chosen.querySelector('[data-testid="price"]')?.textContent).toContain('89,90');
  // The legend stops asking for a choice that the URL already made.
  expect(chosen.querySelector('[data-testid="sku-selector"] .legend')?.textContent).toContain(
    'Branco',
  );
});

test('★★ and the CTA can then BUY: not disabled, inside a real form, bound to the chosen sku', () => {
  const chosen = serve(twoColourProduct(), 'TEN-WHITE');
  const cta = chosen.querySelector('[data-testid="pdp-add-to-cart"]') as HTMLButtonElement;

  expect(cta.hasAttribute('disabled')).toBe(false);
  expect(cta.textContent).toContain('Adicionar ao carrinho');
  expect(cta.closest('form')?.getAttribute('data-testid')).toBe('pdp-buy-row');
  // The buy row is bound server-side to the sku the URL named, not to the default one.
  expect(chosen.querySelector('[data-testid="sku-code"]')?.textContent).toBe('TEN-WHITE');
});

test('★ the two HTMLs differ — the defect was that they did NOT', () => {
  // The measurement that named the cause: before the fix the served bytes for `?sku=TEN-WHITE` and for no
  // query at all were the same document. This is that comparison, kept as the assertion.
  const plain = renderToStaticMarkup(
    <PdpTemplate product={twoColourProduct()} crumbs={[]} store="demo" />,
  );
  const chosen = renderToStaticMarkup(
    <PdpTemplate product={twoColourProduct()} crumbs={[]} store="demo" initialSku="TEN-WHITE" />,
  );
  expect(chosen).not.toBe(plain);
});

test('★ with no ?sku the page is exactly what it was: the colour is still to be picked', () => {
  // The JS path must not be degraded to fix the no-JS one, and neither must the honest "pick a colour" gate
  // (QA-PACK-1 C1): an unnamed variant still refuses to sell the default colour.
  const doc = serve(twoColourProduct());
  const cta = doc.querySelector('[data-testid="pdp-add-to-cart"]') as HTMLButtonElement;
  expect(cta.hasAttribute('disabled')).toBe(true);
  expect(cta.textContent).toContain('Escolha uma cor');
  expect(doc.querySelector('[data-testid="price"]')?.textContent).toContain('79,90');
});

test('★ a size-only product: nothing to gate, and the sizes submit natively all the same', () => {
  const doc = serve(makeProduct()); // the base fixture: one "Tamanho" axis, 39 and 40
  const controls = axisControls(doc);
  expect(controls.map((c) => c.getAttribute('value'))).toEqual(['TEN-39', 'TEN-40']);
  // No colour axis → no gate: the CTA already buys, exactly as it did before this fix.
  const cta = doc.querySelector('[data-testid="pdp-add-to-cart"]') as HTMLButtonElement;
  expect(cta.hasAttribute('disabled')).toBe(false);

  // And the named size is served as the named size.
  const forty = serve(makeProduct(), 'TEN-40');
  expect(forty.querySelector('[data-testid="price"]')?.textContent).toContain('89,90');
});

test('★★ a combination the catalog does not carry stays unclickable — a disabled submit submits nothing', () => {
  // The cross-axis strike (`data-offered="false"`) was enforced by `disabled`, and it must keep being: a
  // native form must not be able to send a tuple that resolves to no sku.
  const p = twoColourProduct();
  const sparse = makeProduct({
    ...p,
    options: [
      ...p.options,
      { id: 'opt_size', name: 'Tamanho', position: 1, values: [value('v_40', '40', 0)] },
    ],
    // Only BLACK is carried in size 40; white has no sku at all under that size.
    skus: [
      {
        ...(p.skus[0] as ProductDoc['skus'][number]),
        option_values: [
          { option_id: 'opt_color', option_name: 'Cor', value_id: 'v_black', value: 'Preto' },
          { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'v_40', value: '40' },
        ],
      },
    ],
  });
  const white = axisControls(serve(sparse)).find(
    (c) => c.getAttribute('aria-label') === 'Branco',
  ) as HTMLButtonElement;
  expect(white.getAttribute('data-offered')).toBe('false');
  expect(white.hasAttribute('disabled')).toBe(true);
});
