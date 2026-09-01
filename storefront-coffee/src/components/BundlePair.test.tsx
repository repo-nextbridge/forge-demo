// ★ S6-PRODUCT-CARD — the bought-together bundle, end to end in the DOM: two real cards, the variant squares of
// a multi-SKU side, the sum that follows the selection, and the "Adicionar os dois" that adds BOTH lines and
// OPENS the minicart with them. The cart is the kernel's: the button drives the injected `addToCart` action and
// the drawer is re-read (never computed here) — so we stub the actions and let the components do the rest, the
// same way checkout.e2e.test.tsx does.

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { BundlePair } from './BundlePair';
import { MinicartDrawer } from './minicart/MinicartDrawer';
import { type MinicartActions, MinicartProvider } from './minicart/MinicartProvider';

/** The page's product: one SKU (the PDP's own product, single-variant here). */
const BASE: ProductDoc = makeProduct({
  product_id: 'prod_base',
  title: 'Tênis Atual',
  handle: 'tenis-atual',
  options: [],
  skus: [
    {
      id: 'sku_base',
      code: 'TEN',
      amount: 29900,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [],
      media: [],
    },
  ],
});

/** The paired product: TWO SKUs on one axis (P cheaper, M pricier) — the case that used to render "Ver produto". */
const PAIRED: ProductDoc = makeProduct({
  product_id: 'prod_camiseta',
  title: 'Camiseta Dry',
  handle: 'camiseta',
  options: [
    {
      id: 'opt_size',
      name: 'Tamanho',
      position: 0,
      values: [
        { id: 'v_p', value: 'P', position: 0 },
        { id: 'v_m', value: 'M', position: 1 },
      ],
    },
  ],
  skus: [
    {
      id: 'sku_p',
      code: 'CAM-P',
      amount: 8900,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [
        { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'v_p', value: 'P' },
      ],
      media: [],
    },
    {
      id: 'sku_m',
      code: 'CAM-M',
      amount: 10100,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [
        { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'v_m', value: 'M' },
      ],
      media: [],
    },
  ],
});

const LINES: SummaryLine[] = [
  {
    line_id: 'line_1',
    sku_id: 'sku_base',
    qty: 1,
    unit_amount: 29900,
    line_total: 29900,
    title: 'Tênis Atual',
  },
  {
    line_id: 'line_2',
    sku_id: 'sku_m',
    qty: 1,
    unit_amount: 10100,
    line_total: 10100,
    title: 'Camiseta Dry',
    variant: 'M',
  },
];

/** The kernel's cart: empty until the two lines are added, then the re-read reports both (the front displays
 * exactly what the port returns — it never computes the cart). */
function renderBundle({ wired = true }: { wired?: boolean } = {}) {
  let added = false;
  const addToCart = vi.fn(async (_skuIds: string[]) => {
    added = true;
  });
  const actions: MinicartActions = {
    readCart: vi.fn(async () =>
      added
        ? { lines: LINES, totalizers: [], totalAmount: 40000, currency: 'BRL', count: 2 }
        : { lines: [], totalizers: [], totalAmount: 0, currency: 'BRL', count: 0 },
    ),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
  render(
    <MinicartProvider actions={actions}>
      <BundlePair
        base={BASE}
        paired={PAIRED}
        maxInstallments={12}
        addToCart={wired ? addToCart : undefined}
      />
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );
  return { addToCart, actions };
}

test('★ two compact products + the paired product’s variant squares (the "Ver produto" dead end is gone)', () => {
  renderBundle();
  // Both sides are the theme's compact bundle product — not a name-only, not a link the app invented.
  expect(screen.getAllByTestId('bundle-product').length).toBe(2);
  expect(screen.getByText('Tênis Atual')).toBeTruthy();
  expect(screen.getByText('Camiseta Dry')).toBeTruthy();
  expect(screen.queryByText('Ver produto')).toBeNull();

  // The multi-SKU side offers one square per option value; the single-SKU side has nothing to choose.
  expect(screen.getAllByTestId('bundle-picker').length).toBe(1);
  expect(screen.getByTestId('bundle-value-v_p')).toBeTruthy();
  expect(screen.getByTestId('bundle-value-v_m')).toBeTruthy();
});

test('★ switching the SKU recomputes the sum', () => {
  renderBundle();
  // Defaults to the first sellable SKU: 29900 + 8900 = 38800.
  expect(screen.getByTestId('bundle-sum').textContent).toMatch(/388,00/);

  fireEvent.click(screen.getByTestId('bundle-value-v_m')); // M costs more: 29900 + 10100 = 40000.
  expect(screen.getByTestId('bundle-sum').textContent).toMatch(/400,00/);
  expect(screen.getByTestId('bundle-value-v_m').getAttribute('aria-pressed')).toBe('true');
});

test('★ "Adicionar os dois" adds BOTH selected SKUs and opens the minicart with them', async () => {
  const { addToCart, actions } = renderBundle();

  fireEvent.click(screen.getByTestId('bundle-value-v_m')); // pick M → that is what must be added
  fireEvent.click(screen.getByTestId('bundle-add-both'));

  // The two lines go in ONE call (cart.add_line ×2, server-side) — with the SELECTED sku, not the first one.
  await waitFor(() => expect(addToCart).toHaveBeenCalledWith(['sku_base', 'sku_m']));

  // …and the drawer OPENS showing the re-read cart (both products in it).
  //
  // ⚠️ THE LINES ARE AWAITED, NOT READ SYNCHRONOUSLY, and that is the whole difference between a test that is
  // correct and one that is lucky. The drawer element exists as soon as it opens; its LINES arrive from
  // `readCart`, one await later. `getAllByTestId` right after `findByTestId('minicart-drawer')` therefore
  // asserts a post-condition of a promise nobody waited for — it passes while the re-read is instant and fails
  // the moment the machine is busy. Measured: with `readCart` delayed 200ms (a loaded runner), the old form
  // fails with exactly the CI's error, `Unable to find an element by: [data-testid="minicart-line"]`.
  const drawer = await screen.findByTestId('minicart-drawer');
  expect(drawer).toBeTruthy();
  expect((await screen.findAllByTestId('minicart-line')).length).toBe(2);
  expect(actions.readCart).toHaveBeenCalled();
});

test('no action wired (a pure SSR snapshot) → the CTA is inert, never a broken add', () => {
  renderBundle({ wired: false });
  expect(screen.getByTestId('bundle-add-both').hasAttribute('disabled')).toBe(true);
});

/** A sparse two-axis paired product: Vermelho only in P, Azul in P and M (Vermelho+M is not a real SKU). */
const SPARSE: ProductDoc = makeProduct({
  product_id: 'prod_sparse',
  title: 'Camiseta Sparse',
  handle: 'camiseta-sparse',
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
        { id: 'vp', value: 'P', position: 0 },
        { id: 'vm', value: 'M', position: 1 },
      ],
    },
  ],
  skus: [
    {
      id: 'sku_red_p',
      code: 'RP',
      amount: 8900,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [
        { option_id: 'opt_color', option_name: 'Cor', value_id: 'red', value: 'Vermelho' },
        { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'vp', value: 'P' },
      ],
      media: [],
    },
    {
      id: 'sku_blue_p',
      code: 'BP',
      amount: 8900,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [
        { option_id: 'opt_color', option_name: 'Cor', value_id: 'blue', value: 'Azul' },
        { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'vp', value: 'P' },
      ],
      media: [],
    },
    {
      id: 'sku_blue_m',
      code: 'BM',
      amount: 9900,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [
        { option_id: 'opt_color', option_name: 'Cor', value_id: 'blue', value: 'Azul' },
        { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'vm', value: 'M' },
      ],
      media: [],
    },
  ],
});

// #11a/#12 — cross-axis disabling in the bundle picker: the default lands on Vermelho+P, so M pre-disables (no
// Vermelho sku carries M); picking Azul (which has M) re-enables it. Same rule as the PDP SkuSelector.
test('★ bundle picker cross-axis: an impossible value is disabled until a compatible axis is chosen', () => {
  render(
    <MinicartProvider
      actions={{
        readCart: vi.fn(async () => ({
          lines: [],
          totalizers: [],
          totalAmount: 0,
          currency: 'BRL',
          count: 0,
        })),
        addLine: vi.fn(async () => {}),
        updateLine: vi.fn(async () => {}),
        removeLine: vi.fn(async () => {}),
      }}
    >
      <BundlePair base={BASE} paired={SPARSE} addToCart={vi.fn(async () => {})} />
    </MinicartProvider>,
  );
  // Default = Vermelho + P → M unreachable (greyed).
  expect(screen.getByTestId('bundle-value-vm').hasAttribute('disabled')).toBe(true);
  // Switch to Azul → M becomes reachable.
  fireEvent.click(screen.getByTestId('bundle-value-blue'));
  expect(screen.getByTestId('bundle-value-vm').hasAttribute('disabled')).toBe(false);
});

// ── PROMO — the kernel's quote, and the state while it is being asked again ───────────────────────────────

/** A quote as `read.price_together` answers it: the pair total AND the per-line split. */
/** `formatMoney` uses a NON-BREAKING space after "R$" — correct, invisible, and it would make every assertion
 * below fail for a reason that has nothing to do with what they are about. */
const plain = (value: string | null | undefined): string => {
  // ⚠️ NOT `(value ?? '')`. Four of the assertions that read through this helper are NEGATIVE, and `''`
  // satisfies every one of them — a node that stopped rendering would report clean on the price it lost.
  // A caller with nothing to normalise has nothing to assert about, and says so here.
  if (value == null) throw new Error('nothing to read: the node carries no text');
  return value.replace(/[\u00A0\u202F]/g, ' ');
};

const QUOTE = {
  subtotal: 38_800,
  total: 34_920,
  discount: 3_880,
  lines: [
    { sku_id: 'sku_base', unit_amount: 29_900, promotional_amount: 26_910 },
    { sku_id: 'sku_p', unit_amount: 8_900, promotional_amount: 8_010 },
  ],
  promotions: [{ promotion_id: 'promo_1', label: 'Leve os 2' }],
};

function renderQuoted(over: Partial<Parameters<typeof BundlePair>[0]> = {}) {
  const actions: MinicartActions = {
    readCart: vi.fn(async () => ({
      lines: [],
      totalizers: [],
      totalAmount: 0,
      currency: 'BRL',
      count: 0,
    })),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
  render(
    <MinicartProvider actions={actions}>
      <BundlePair base={BASE} paired={PAIRED} maxInstallments={12} quote={QUOTE} {...over} />
    </MinicartProvider>,
  );
}

test('★ with a quote, the pair shows de/por on the TOTAL and on BOTH lines', () => {
  renderQuoted();
  // The pair total: the catalog sum struck through, the kernel's total beside it.
  const offer = plain(screen.getByTestId('bundle-sum').textContent);
  expect(offer).toContain('R$ 388,00');
  expect(offer).toContain('R$ 349,20');
  // And each line, because the CART will show the discount on the two lines — one number on the PDP against
  // two in the cart is the ambiguity this whole epic closed.
  const body = plain(document.body.textContent);
  for (const price of ['R$ 299,00', 'R$ 269,10', 'R$ 89,00', 'R$ 80,10']) {
    expect(body, `the line price ${price} is missing`).toContain(price);
  }
});

test('with NO quote it sums, exactly as it did before any of this existed', () => {
  renderQuoted({ quote: null });
  expect(plain(screen.getByTestId('bundle-sum').textContent)).toContain('R$ 388,00');
  expect(plain(screen.getByTestId('bundle-sum').textContent)).not.toContain('R$ 349,20');
});

test('★★ changing a variant HOLDS the old number, marked as updating — never a wrong price shown as right', async () => {
  let settle: (q: typeof QUOTE | null) => void = () => {};
  const requote = vi.fn(
    () =>
      new Promise<typeof QUOTE | null>((resolve) => {
        settle = resolve;
      }),
  );
  renderQuoted({ requote });

  fireEvent.click(screen.getByRole('button', { name: /^M$/ }));

  // In flight: the previous total is still on screen, and the block SAYS it is being updated (aria-busy +
  // the label). The alternative — flashing the plain sum — would show a HIGHER price the shopper never pays.
  const offer = screen.getByTestId('bundle-sum');
  await waitFor(() => expect(offer.getAttribute('aria-busy')).toBe('true'));
  expect(plain(offer.textContent)).toContain('atualizando');
  expect(plain(offer.textContent)).toContain('R$ 349,20');

  settle({
    ...QUOTE,
    subtotal: 40_000,
    total: 36_000,
    lines: [
      { sku_id: 'sku_base', unit_amount: 29_900, promotional_amount: 26_910 },
      { sku_id: 'sku_m', unit_amount: 10_100, promotional_amount: 9_090 },
    ],
  });
  await waitFor(() =>
    expect(plain(screen.getByTestId('bundle-sum').textContent)).toContain('R$ 360,00'),
  );
  expect(screen.getByTestId('bundle-sum').getAttribute('aria-busy')).toBeNull();
});

test('★ a late answer about a selection nobody is looking at changes nothing', async () => {
  // The race that leaves a wrong price on screen for good: the shopper picks M, then goes back to P before the
  // answer for M lands. Going back needs no request (that quote is already in hand), and the late one must not
  // overwrite it.
  const pending: ((q: typeof QUOTE | null) => void)[] = [];
  const requote = vi.fn(() => new Promise<typeof QUOTE | null>((resolve) => pending.push(resolve)));
  renderQuoted({ requote });

  fireEvent.click(screen.getByRole('button', { name: /^M$/ }));
  await waitFor(() => expect(pending.length).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: /^P$/ }));

  // Back on the original pair: its quote is shown again immediately, with no second round trip.
  await waitFor(() =>
    expect(plain(screen.getByTestId('bundle-sum').textContent)).toContain('R$ 349,20'),
  );
  expect(requote).toHaveBeenCalledTimes(1);

  // The answer for M arrives now. It is about a selection that is no longer on screen.
  pending[0]?.({ ...QUOTE, total: 1_000 });
  await waitFor(() =>
    expect(plain(screen.getByTestId('bundle-sum').textContent)).toContain('R$ 349,20'),
  );
  expect(plain(screen.getByTestId('bundle-sum').textContent)).not.toContain('R$ 10,00');
});

test('with no way to re-ask, a variant change DROPS the quote rather than keeping a stale one', async () => {
  renderQuoted({ requote: undefined });
  fireEvent.click(screen.getByRole('button', { name: /^M$/ }));
  await waitFor(() =>
    expect(plain(screen.getByTestId('bundle-sum').textContent)).not.toContain('R$ 349,20'),
  );
});

test('★ …and the LINE holds with it — one screen never shows two quotes', async () => {
  // Measured on the combined bench and fixed here: while the new answer was in flight the footer held the old
  // pair total (correct) but the LINE had already switched to the new sku's catalogue price with no de/por.
  // For about a second the shopper saw a line from one quote and a total from another. Hold both, or neither.
  let settle: (q: typeof QUOTE | null) => void = () => {};
  const requote = vi.fn(
    () =>
      new Promise<typeof QUOTE | null>((resolve) => {
        settle = resolve;
      }),
  );
  renderQuoted({ requote });

  fireEvent.click(screen.getByRole('button', { name: /^M$/ }));
  const offer = screen.getByTestId('bundle-sum');
  await waitFor(() => expect(offer.getAttribute('aria-busy')).toBe('true'));

  // The held total…
  expect(plain(offer.textContent)).toContain('R$ 349,20');
  // …and the held LINE, from the same quote: the de/por is still there, and it is the pair the total is about.
  const body = plain(document.body.textContent);
  expect(body).toContain('R$ 269,10'); // the base line's promotional price, held
  expect(body).toContain('R$ 80,10'); // the paired line's, held
  // The new sku's bare catalogue price must NOT be on screen while the old total is: that is the second quote.
  expect(body).not.toContain('R$ 101,00');

  settle({
    ...QUOTE,
    subtotal: 40_000,
    total: 36_000,
    lines: [
      { sku_id: 'sku_base', unit_amount: 29_900, promotional_amount: 26_910 },
      { sku_id: 'sku_m', unit_amount: 10_100, promotional_amount: 9_090 },
    ],
  });
  // Once it lands, the screen moves as ONE: new line, new total.
  await waitFor(() =>
    expect(plain(screen.getByTestId('bundle-sum').textContent)).toContain('R$ 360,00'),
  );
  expect(plain(document.body.textContent)).toContain('R$ 90,90');
});

// ── QA v0.3 FA3 — the announcement may never sit ABOVE what the page already shows ────────────────────────
//
// The block asks the kernel what the pair costs and sums when the answer is null. The fallback used to sum
// `sku.amount` — the CATALOGUE price — so a page whose buybox read R$ 630,00 announced R$ 800,00 for the pair
// and R$ 66,67 as the instalment. `promotional_price` is the kernel's own answer for ONE sku, already inside
// the document the card and the buybox price through (`displayPrice`), and this block was the only place in
// the theme that did not read it. Nothing is recomputed here: with no quote, the pair costs what the two
// lines already say they cost.

/** The anchor of the Staging case: R$ 700,00 catalogue, R$ 630,00 with the collection promotion the buybox shows. */
const DISCOUNTED: ProductDoc = makeProduct({
  product_id: 'prod_runner',
  title: 'Tênis Adistar',
  handle: 'tenis-adistar',
  options: [],
  skus: [
    {
      id: 'sku_runner',
      code: 'RUN',
      amount: 70_000,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [],
      media: [],
      promotional_price: {
        unit_amount: 70_000,
        promotional_amount: 63_000,
        discount_bp: 1000,
        label: 'Semana do Cliente',
        promotion_id: 'promo_week',
      },
    },
  ],
});

/** The paired product of the Staging case: R$ 100,00, no promotion of its own. */
const INSOLE: ProductDoc = makeProduct({
  product_id: 'prod_insole',
  title: 'Palmilha UGG',
  handle: 'palmilha-ugg',
  options: [],
  skus: [
    {
      id: 'sku_insole',
      code: 'INS',
      amount: 10_000,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [],
      media: [],
    },
  ],
});

function renderDiscounted(over: Partial<Parameters<typeof BundlePair>[0]> = {}) {
  const actions: MinicartActions = {
    readCart: vi.fn(async () => ({
      lines: [],
      totalizers: [],
      totalAmount: 0,
      currency: 'BRL',
      count: 0,
    })),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
  render(
    <MinicartProvider actions={actions}>
      <BundlePair base={DISCOUNTED} paired={INSOLE} maxInstallments={12} quote={null} {...over} />
    </MinicartProvider>,
  );
}

test('★★ QA-FA3 — with no quote, the pair announces the PROMOTIONAL prices, never the catalogue sum', () => {
  renderDiscounted();
  const offer = plain(screen.getByTestId('bundle-sum').textContent);
  // R$ 630,00 + R$ 100,00 — the number the cart charges, and the one the buybox on the same page implies.
  expect(offer).toContain('R$ 730,00');
  // The catalogue sum is the "was", never the price: announcing it as the price is the defect.
  expect(offer).toContain('R$ 800,00');
  expect(offer.indexOf('R$ 730,00')).toBeGreaterThan(offer.indexOf('R$ 800,00'));
});

test('★ QA-FA3 — the instalment derives from the announced total, so it cannot outlive a wrong one', () => {
  renderDiscounted();
  // 73000 / 12 = 6083 cents. The old, catalogue-summed line said "12x de R$ 66,67".
  const offer = plain(screen.getByTestId('bundle-sum').textContent);
  expect(offer).toContain('12x de R$ 60,83');
  expect(offer).not.toContain('66,67');
});

test('★ QA-FA3 — the discounted LINE carries its own de/por, exactly as the quoted pair does', () => {
  renderDiscounted();
  const body = plain(document.body.textContent);
  for (const price of ['R$ 700,00', 'R$ 630,00', 'R$ 100,00']) {
    expect(body, `the line price ${price} is missing`).toContain(price);
  }
});
