// PRE-S7-DEFAULT-SKU — the star drives what the product shows, and BOTH paths of every fallback are proved
// here: with a star, and without one.
//
// The one that matters most is WITHOUT: a product nobody starred must behave EXACTLY as it did before this
// task — cheapest on the card, first on the PDP, no photo fallback at all. There is no backfill and nothing is
// auto-starred, so "without" is the state of every product that exists today.

import { productImageUrls } from '@forgeco/storefront-kit/media/seo';
import type { MediaRef, ProductDoc } from '@forgeco/storefront-kit/read-client';
import { coverMediaOf, defaultSku, displaySku } from '@forgeco/storefront-kit/sku';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ProductCard } from '@/components/ProductCard';
import { defaultSelection } from '@/components/SkuSelector';
import { orderGalleryItems } from '@/lib/gallery';
import { productJsonLd } from '@/templates/pdp/meta';
import { makeProduct } from '@/test/fixtures';

type Sku = ProductDoc['skus'][number];

const img = (key: string): MediaRef => ({
  provider_key: key,
  kind: 'image',
  role: null,
  position: 0,
  url: `https://cdn/${key}`,
});

function sku(id: string, amount: number, overrides: Partial<Sku> = {}): Sku {
  return {
    id,
    code: id.toUpperCase(),
    amount,
    currency: 'BRL',
    status: 'active',
    name: null,
    ref: null,
    ean: null,
    metadata: {},
    option_values: [{ option_id: 'opt_size', option_name: 'Tamanho', value_id: id, value: id }],
    media: [],
    ...overrides,
  };
}

// ---- which SKU speaks for the product --------------------------------------------------------------

test('displaySku: the STARRED sku wins — even when it is not the cheapest', () => {
  const product = makeProduct({
    skus: [sku('a', 9990), sku('b', 19990, { is_default: true })],
  });
  expect(displaySku(product)?.id).toBe('b');
  expect(defaultSku(product)?.id).toBe('b');
});

test('displaySku: with NO star, the cheapest — byte-identical to the pre-PRE-S7 rule', () => {
  const product = makeProduct({ skus: [sku('a', 19990), sku('b', 9990)] });
  expect(displaySku(product)?.id).toBe('b');
  expect(defaultSku(product)).toBeUndefined();
});

// ---- the card --------------------------------------------------------------------------------------

test("the card shows the STARRED sku's price and its struck-through was", () => {
  const { getByTestId } = render(
    <ProductCard
      base={HOST_BASE}
      product={makeProduct({
        skus: [
          sku('cheap', 9990, { compare_at_amount: 14990 }),
          sku('starred', 19990, { compare_at_amount: 24990, is_default: true }),
        ],
      })}
    />,
  );
  expect(getByTestId('price').textContent).toMatch(/199,90/);
  expect(getByTestId('price-compare').textContent).toMatch(/249,90/);
});

test('the card with NO star still shows the CHEAPEST — the behaviour that shipped', () => {
  const { getByTestId } = render(
    <ProductCard
      base={HOST_BASE}
      product={makeProduct({
        skus: [
          sku('hi', 19990, { compare_at_amount: 24990 }),
          sku('lo', 9990, { compare_at_amount: 14990 }),
        ],
      })}
    />,
  );
  expect(getByTestId('price').textContent).toMatch(/99,90/);
  expect(getByTestId('price-compare').textContent).toMatch(/149,90/);
});

// ---- the PDP's first paint -------------------------------------------------------------------------

test('the PDP opens on the STARRED sku (not on skus[0], which is an arbitrary id order)', () => {
  const skus = [sku('a', 9990), sku('b', 19990, { is_default: true })];
  expect(defaultSelection(skus)).toEqual({ opt_size: 'b' });
});

test('the PDP with NO star opens on the FIRST sku — today, unchanged', () => {
  const skus = [sku('a', 9990), sku('b', 19990)];
  expect(defaultSelection(skus)).toEqual({ opt_size: 'a' });
});

// ---- the photo -------------------------------------------------------------------------------------

test("a product with NO media of its own shows the STARRED sku's photo", () => {
  const product = makeProduct({
    media: [],
    skus: [
      sku('a', 9990, { media: [img('a.jpg')] }),
      sku('b', 19990, { media: [img('b.jpg')], is_default: true }),
    ],
  });
  expect(coverMediaOf(product)).toEqual([img('b.jpg')]); // the STARRED one — never "whichever sku sorted first"
  expect(productImageUrls(product)).toEqual(['https://cdn/b.jpg']); // og:image + JSON-LD + the category card
});

test("the PRODUCT's own media always WINS over the star — the default only fills a hole", () => {
  const product = makeProduct({
    media: [img('product.jpg')],
    skus: [sku('a', 9990), sku('b', 19990, { media: [img('b.jpg')], is_default: true })],
  });
  expect(coverMediaOf(product)).toEqual([img('product.jpg')]);
  expect(productImageUrls(product)).toEqual(['https://cdn/product.jpg']);
});

/**
 * ★★ P3A-8 — NO STAR AND NO PRODUCT MEDIA USED TO MEAN AN EMPTY TILE, on a product that HAS photos.
 *
 * Measured on Staging: "adidas Adizero Evolution SL Exo Suede" drew a blank image box in the PDP's "Você
 * também pode gostar", among neighbours that had loaded. It carries no product-level image and nobody
 * starred a SKU, so this function answered `[]` and every caller degraded to the placeholder — the
 * behaviour this file used to pin as "exactly as today".
 *
 * ⚠️ WHAT "NEVER A RANDOM VARIANT" WAS PROTECTING, AND WHY THIS IS NOT THAT. The rule PRE-S7-DEFAULT-SKU
 * removed was `skus[0]`, which is `order by id` — an arbitrary photo that could change between deploys for
 * no reason a merchant could see. `displaySku` is not arbitrary: it is the SKU whose PRICE this very card
 * prints, chosen by the one rule the card, the buybox and the JSON-LD offer already share. So the picture
 * and the number under it now come from the same SKU, which is a stronger guarantee than the blank tile was.
 *
 * The last resort below is the only place order still decides, and it decides between a photo and NO photo.
 */
test("★★ NO star + no product media → the DISPLAY sku's photo: the one whose price the card prints", () => {
  const product = makeProduct({
    media: [],
    skus: [sku('a', 9990, { media: [img('a.jpg')] }), sku('b', 19990, { media: [img('b.jpg')] })],
  });
  // `displaySku` with no star is the CHEAPEST, which is the "a partir de" price the card shows.
  expect(coverMediaOf(product)).toEqual([img('a.jpg')]);
  expect(productImageUrls(product)).toEqual(['https://cdn/a.jpg']);
});

test('★ …and when the display sku has none, the first variant that HAS one — never a blank tile', () => {
  const product = makeProduct({
    media: [],
    skus: [sku('a', 9990), sku('b', 19990, { media: [img('b.jpg')] })],
  });
  expect(coverMediaOf(product)).toEqual([img('b.jpg')]);
});

test('★ a product with no photo ANYWHERE still answers nothing — the placeholder is still reachable', () => {
  const product = makeProduct({ media: [], skus: [sku('a', 9990), sku('b', 19990)] });
  expect(coverMediaOf(product)).toEqual([]);
  expect(productImageUrls(product)).toEqual([]);
});

// ---- the gallery -----------------------------------------------------------------------------------

test('the gallery falls back to the starred sku ONLY when neither the selection nor the product has an image', () => {
  const starredMedia = [img('star.jpg')];

  // Nothing selected, product empty → the star's photo.
  expect(orderGalleryItems([], [], starredMedia).map((m) => m.provider_key)).toEqual(['star.jpg']);

  // The product HAS a photo → it wins; the star is never reached.
  expect(orderGalleryItems([], [img('p.jpg')], starredMedia).map((m) => m.provider_key)).toEqual([
    'p.jpg',
  ]);

  // The SELECTED sku has a photo → it wins over both (the S5 rule, intact).
  expect(
    orderGalleryItems([img('sel.jpg')], [img('p.jpg')], starredMedia).map((m) => m.provider_key),
  ).toEqual(['sel.jpg']);

  // No star (the 3rd argument omitted) → the chain that shipped: sku, product, then nothing.
  expect(orderGalleryItems([], [])).toEqual([]);
});

test("the videos keep coming from the PRODUCT — a starred sku's photos never drag one along", () => {
  const video: MediaRef = {
    provider_key: 'https://youtu.be/x',
    kind: 'video_external',
    role: null,
    position: 0,
  };
  const items = orderGalleryItems([], [video], [img('star.jpg')]);
  // The star supplies the IMAGE; the product still supplies the video, and it stays LAST.
  expect(items.map((m) => m.provider_key)).toEqual(['star.jpg', 'https://youtu.be/x']);
});

// ---- the JSON-LD offer -----------------------------------------------------------------------------

test('the JSON-LD offer speaks for the starred sku — so the rich result and the card cannot disagree', () => {
  const starredDoc = makeProduct({
    skus: [sku('a', 9990), sku('b', 19990, { is_default: true })],
  });
  expect(productJsonLd(starredDoc).sku).toBe('B');
  expect((productJsonLd(starredDoc).offers as { price: string }).price).toBe('199.90');

  const noStar = makeProduct({ skus: [sku('a', 19990), sku('b', 9990)] });
  expect((productJsonLd(noStar).offers as { price: string }).price).toBe('99.90'); // cheapest, as today
});
