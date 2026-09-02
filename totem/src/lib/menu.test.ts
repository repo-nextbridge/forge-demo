// ★★ "THE PORT SAID NOTHING" AND "THE COUNTER SELLS NOTHING" ARE DIFFERENT SENTENCES.
//
// The store→tenant map lives in `forge_control.store_directory` and is filled by an EVENT CONSUMER, so a
// store created seconds ago is eventually consistent: `read.products` answers 404 and then, shortly after,
// 200. Measured by the T-A slice on 2026-09-01, right after `tenant.store.create`.
//
// The kit's read client turns that 404 into `null` and a real answer into a list — so the distinction is
// available, and this test is what keeps it from being flattened into `?? []`, which is the one-character
// change that would put "the counter is empty" on the screen of a counter that is merely young.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const products = vi.fn();
vi.mock('./port', () => ({ totemRead: () => ({ products }) }));
vi.mock('./store', () => ({ resolveTotemStore: () => ({ id: 'sto_test', handle: 'balcao' }) }));

const { cardDescription, readMenu, SECTIONS } = await import('./menu');

const list = (items: unknown[]) => ({ items, page: 1, limit: 50, total: items.length });
const product = (over: Record<string, unknown> = {}) => ({
  product_id: 'p1',
  title: 'Cappuccino',
  description: 'Espresso, leite vaporizado e espuma densa',
  handle: 'cappuccino',
  status: 'active',
  metadata: null,
  options: [],
  skus: [
    { id: 's1', code: 'c1', amount: 1300, currency: 'BRL', status: 'active', name: null, ref: null, ean: null, metadata: null, option_values: [], media: [] },
    { id: 's2', code: 'c2', amount: 1700, currency: 'BRL', status: 'active', name: null, ref: null, ean: null, metadata: null, option_values: [], media: [] },
  ],
  categories: [],
  media: [],
  ...over,
});

beforeEach(() => products.mockReset());

describe('a store the public face cannot resolve yet', () => {
  it('★ is invisible, never empty', async () => {
    products.mockResolvedValue(null);
    expect(await readMenu()).toEqual({ visible: false });
  });

  it('is invisible even when only ONE band 404s — a 404 is about the store, not the category', async () => {
    products.mockResolvedValueOnce(list([])).mockResolvedValue(null);
    expect(await readMenu()).toEqual({ visible: false });
  });
});

describe('a store that answers', () => {
  it('is visible even when every band is empty — that is a real, sayable answer', async () => {
    products.mockResolvedValue(list([]));
    const menu = await readMenu();
    expect(menu.visible).toBe(true);
    if (!menu.visible) throw new Error('unreachable');
    expect(menu.sections).toHaveLength(SECTIONS.length);
    expect(menu.sections.every((s) => s.items.length === 0)).toBe(true);
  });

  it('prices from the CHEAPEST active sku and says "a partir de" when they differ', async () => {
    products.mockResolvedValue(list([product()]));
    const menu = await readMenu();
    if (!menu.visible) throw new Error('unreachable');
    const card = menu.sections[0]?.items[0];
    expect(card?.priceLabel).toBe('R$ 13,00');
    expect(card?.fromPrice).toBe(true);
  });

  it('does not say "a partir de" when every sku costs the same', async () => {
    const p = product({
      skus: [
        { id: 's1', code: 'c1', amount: 900, currency: 'BRL', status: 'active', name: null, ref: null, ean: null, metadata: null, option_values: [], media: [] },
      ],
    });
    products.mockResolvedValue(list([p]));
    const menu = await readMenu();
    if (!menu.visible) throw new Error('unreachable');
    expect(menu.sections[0]?.items[0]?.fromPrice).toBe(false);
  });

  it('ignores archived skus when pricing — an inactive price is not an offer', async () => {
    const p = product({
      skus: [
        { id: 's0', code: 'c0', amount: 100, currency: 'BRL', status: 'archived', name: null, ref: null, ean: null, metadata: null, option_values: [], media: [] },
        { id: 's1', code: 'c1', amount: 1300, currency: 'BRL', status: 'active', name: null, ref: null, ean: null, metadata: null, option_values: [], media: [] },
      ],
    });
    products.mockResolvedValue(list([p]));
    const menu = await readMenu();
    if (!menu.visible) throw new Error('unreachable');
    expect(menu.sections[0]?.items[0]?.priceLabel).toBe('R$ 13,00');
  });

  it('drops a product with no sellable sku instead of printing a card with no price', async () => {
    products.mockResolvedValue(list([product({ skus: [] })]));
    const menu = await readMenu();
    if (!menu.visible) throw new Error('unreachable');
    expect(menu.sections[0]?.items).toEqual([]);
  });

  it('leaves the chip off a handle the artboard never named, rather than inventing a word', async () => {
    products.mockResolvedValue(list([product({ handle: 'algo-que-ninguem-desenhou' })]));
    const menu = await readMenu();
    if (!menu.visible) throw new Error('unreachable');
    expect(menu.sections[0]?.items[0]?.chip).toBeUndefined();
  });
});

describe('the order of the bands is ours, and the kernel has no opinion to borrow', () => {
  it('is exactly the sequence the counter is meant to be walked in', () => {
    expect(SECTIONS.map((s) => s.title)).toEqual([
      'Cafés',
      'Especiais da casa',
      'Comidas',
      'Pra levar',
    ]);
  });

  it('★ every category path is a legal ltree label — which is why it is `pra_levar`, never `pra-levar`', () => {
    // An ltree label takes letters, digits and underscores. The wave's frozen contract wrote the hyphenated
    // spelling; it was never a shape the kernel could store, and this is the test that keeps somebody from
    // "fixing" the code back towards the contract.
    for (const s of SECTIONS) expect(s.category).toMatch(/^[A-Za-z0-9_]+$/);
  });
});

// ── A48 · THE COUNTER'S OWN ONE-LINER ───────────────────────────────────────────────────────────────────
//
// "no totem a descrição curta ficou grande demais… o ideal é talvez um campo próprio só para descrição
// totem. Na rolagem aparece essa mini descrição e ao abrir o modal a descrição curta. E na loja de café
// normal aparece só a descrição curta." (Renan, 2026-09-02)
//
// The whole feature is a product CUSTOM FIELD plus a `??`. What these tests defend is the `??`: a card that
// went mute for every product nobody wrote a line for would turn an upgrade into a requirement, and it is
// exactly the kind of regression that looks like nothing in a diff.

/** The one card of a one-product menu, refusing to guess. Keeps the A48 cases about the FIELD, not about
 * whether an index exists. */
async function onlyCard() {
  const menu = await readMenu();
  if (!menu.visible) throw new Error('the menu was invisible — the fixture answered null somewhere');
  const card = menu.sections[0]?.items[0];
  if (!card) throw new Error('the fixture produced no card');
  return card;
}

describe('desc_totem — the counter reads its own field, and falls back when there is none', () => {
  it('★ prefers the counter\'s one-liner over the shop\'s paragraph', async () => {
    products.mockResolvedValue(
      list([
        product({
          handle: 'forge-alvorada',
          description: 'O café de todo dia. Torra média, corpo redondo e doçura fácil — chocolate ao leite, caramelo e nozes. Vem da Mogiana Paulista, onde a altitude e a colheita tardia dão ao grão o açúcar que sustenta a xícara.',
          metadata: { tag_balcao: 'blend', desc_totem: 'Torra média, doce e fácil — todo dia' },
        }),
      ]),
    );
    const card = await onlyCard();
    expect(cardDescription(card)).toBe('Torra média, doce e fácil — todo dia');
    // …and the SHORT description is still on the wire, because the modal is the surface that shows it.
    expect(card.description).toMatch(/^O café de todo dia\./);
  });

  it('★★ THE FALLBACK: a product with no desc_totem keeps its description — the card is never mute', async () => {
    products.mockResolvedValue(list([product({ metadata: { tag_balcao: 'quente' } })]));
    const card = await onlyCard();
    expect(card.descTotem).toBeUndefined();
    expect(cardDescription(card)).toBe('Espresso, leite vaporizado e espuma densa');
  });

  it('falls back on a product with no metadata bag at all', async () => {
    products.mockResolvedValue(list([product({ metadata: null })]));
    expect(cardDescription(await onlyCard())).toBe('Espresso, leite vaporizado e espuma densa');
  });

  it('falls back on a CLEARED field — deleting the text in the admin must not blank the card', async () => {
    products.mockResolvedValue(list([product({ metadata: { desc_totem: '   ' } })]));
    expect(cardDescription(await onlyCard())).toBe('Espresso, leite vaporizado e espuma densa');
  });

  it('survives a metadata bag that is not an object — a strange bag must not take the menu down', async () => {
    for (const bag of [['x'], 'text', 7]) {
      products.mockResolvedValue(list([product({ metadata: bag })]));
      expect(cardDescription(await onlyCard())).toBe('Espresso, leite vaporizado e espuma densa');
    }
  });
});
