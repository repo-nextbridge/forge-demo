// The counter's own tests — `node --test 'seed/**/*.test.mjs'`, the same runner seed/forge.test.mjs and
// seed/vitrine.test.mjs use, and for the same reason (Node ships one; these are pure functions and data).
//
// WHAT IS WORTH TESTING HERE, and it is deliberately not "the counter is seeded". That is proven by running
// the seed against a box and counting, which the slice report does. What a run against a box CANNOT prove
// is the class of defect this slice had to design around: a write that is wrong SILENTLY — one that leaves
// a green exit code and a shop that is subtly not what the catalogue says. Every test below breaks one:
//
//   · the metadata MERGE, against a coffee that already carries the e-commerce's own fields — the write
//     that erases `regiao`/`torra`/`notas`/`sca` reports success and is found weeks later, on a PDP;
//   · the sku code, against a product with NO axis — where the inline version `bin/seed.mjs` uses for the
//     coffees yields a trailing dash, and a code that does not match is a stock pass that sets nothing;
//   · the sku expansion, against a catalogue row that names fewer values than the product has axes — a
//     variant nobody can select, accepted by the kernel;
//   · the frozen contract itself (handles, bands, photographs), because the OTHER two slices of this wave
//     were told those names and a rename here is a totem that renders an empty menu.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MEDIA_DIR, counterFieldsFor, expandSkus, mergeMetadata, productMetadata, skuCode, totem } from './totem.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));

/** The handles the wave froze in `_COMUM-T.md`. The totem app was told these; they are a contract. */
const FROZEN_HANDLES = [
  'espresso-forge',
  'coado-do-dia',
  'cappuccino',
  'latte',
  'mocha',
  'cold-brew',
  'frappe-forge-chocolate',
  'frappe-caramelo-salgado',
  'frappe-morango-chocolate-branco',
  'chai-cremoso-gelado',
  'pao-de-queijo',
  'croissant',
  'bolo-do-dia',
  'cookie-forge',
  'caneca-esmaltada',
];

const product = (handle) => totem.products.find((p) => p.handle === handle);

// ── the merge, and it is the one this slice was told to prove ───────────────────────────────────────────

test('the counter seal MERGES into a coffee bag — the e-commerce fields survive', () => {
  // ⚠️ THE COINCIDENCE THIS BREAKS, and it is not a coincidence of size but of ATTENTION.
  // `catalog.product.update` validates `metadata` and then COALESCES the column: the bag is replaced
  // wholesale. Sending the seal alone to the Alvorada leaves it with a seal and with nothing else — no
  // region, no roast, no tasting notes — and the command answers 200. The shop's product page goes blank
  // and this seed reports success.
  const alvorada = {
    regiao: 'Mogiana Paulista',
    processo: 'natural',
    torra: 'média',
    notas: 'chocolate ao leite, caramelo, nozes',
  };
  const merged = mergeMetadata(alvorada, { tag_balcao: 'blend' });
  assert.equal(merged.tag_balcao, 'blend');
  for (const [key, value] of Object.entries(alvorada)) {
    assert.equal(merged[key], value, `the coffee lost its "${key}" — that is the wholesale write`);
  }
  // And the source bag is not mutated: the caller holds it and re-reads it on the next product.
  assert.equal(alvorada.tag_balcao, undefined);
});

test('a bag that already says it costs no command — idempotent in ACT, not only in effect', () => {
  const already = { regiao: 'Cerrado Mineiro', tag_balcao: 'denominação' };
  assert.equal(mergeMetadata(already, { tag_balcao: 'denominação' }), null);
  // …and a CHANGED seal is a write again, carrying everything else with it.
  const changed = mergeMetadata(already, { tag_balcao: 'novo selo' });
  assert.deepEqual(changed, { regiao: 'Cerrado Mineiro', tag_balcao: 'novo selo' });
});

test('a metadata that is not an object is treated as empty rather than spread', () => {
  // `products_admin` types it `unknown`. Spreading a null throws; spreading an array produces `{0: …}` —
  // both of which would reach the kernel as a bag nobody wrote.
  assert.deepEqual(mergeMetadata(null, { tag_balcao: 'quente' }), { tag_balcao: 'quente' });
  assert.deepEqual(mergeMetadata(undefined, { tag_balcao: 'quente' }), { tag_balcao: 'quente' });
  assert.deepEqual(mergeMetadata(['x'], { tag_balcao: 'quente' }), { tag_balcao: 'quente' });
});

// ── the sku code ────────────────────────────────────────────────────────────────────────────────────────

test('a product with NO axis has the handle as its code — no trailing dash', () => {
  // ⚠️ `bin/seed.mjs` builds this inline as `${handle}-${values.map(slug).join('-')}`, which is correct for
  // six coffees that all have two axes. The enamel mug has none, and that expression yields
  // "caneca-esmaltada-": a code a merchant reads on an order line, and the key `stock()` matches on — so a
  // mismatch here is a mug that is published, priced and permanently out of stock.
  assert.equal(skuCode('caneca-esmaltada', []), 'caneca-esmaltada');
  assert.doesNotMatch(skuCode('caneca-esmaltada', []), /-$/);
});

test('accents and punctuation in an option value survive as one readable code', () => {
  assert.equal(skuCode('pao-de-queijo', ['Porção c/ 3']), 'pao-de-queijo-porcao-c-3');
  assert.equal(skuCode('cold-brew', ['Com tônica e limão']), 'cold-brew-com-tonica-e-limao');
  assert.equal(skuCode('cappuccino', ['G', 'Aveia']), 'cappuccino-g-aveia');
});

// ── the expansion ───────────────────────────────────────────────────────────────────────────────────────

test('two axes expand to one sku per point on the grid, first one starred', () => {
  const skus = expandSkus(product('cappuccino'));
  assert.equal(skus.length, 6);
  assert.equal(skus[0].is_default, true);
  assert.equal(skus.filter((s) => s.is_default).length, 1);
  const oatLarge = skus.find((s) => s.code === 'cappuccino-g-aveia');
  assert.deepEqual(oatLarge.option_values, [
    { option: 'Tamanho', value: 'G' },
    { option: 'Leite', value: 'Aveia' },
  ]);
});

test('a sku that names fewer values than the product has axes is REFUSED, by name', () => {
  // The kernel would accept it: `option_values` is optional, so this lands as a variant with no point on
  // the grid — invisible in the totem's chip rows and unpickable, on a product that looks fine in a list.
  assert.throws(
    () =>
      expandSkus({
        handle: 'cappuccino',
        options: [
          { name: 'Tamanho', values: ['P', 'G'] },
          { name: 'Leite', values: ['Integral', 'Aveia'] },
        ],
        skus: [{ options: ['G'], amount: 1500 }],
      }),
    /declares 2 axis\/axes and a sku with 1 value/,
  );
});

test('a sku on a value the axis does not declare is REFUSED, by name', () => {
  assert.throws(
    () =>
      expandSkus({
        handle: 'latte',
        options: [{ name: 'Leite', values: ['Integral', 'Aveia'] }],
        skus: [{ options: ['Amêndoas'], amount: 1500 }],
      }),
    /"Leite" = "Amêndoas"/,
  );
});

test('a product with no axis expands to exactly one sku, and it carries no option_values', () => {
  const skus = expandSkus(product('caneca-esmaltada'));
  assert.equal(skus.length, 1);
  assert.equal(skus[0].option_values, undefined);
  assert.equal(skus[0].is_default, true);
});

// ── the whole catalogue expands ─────────────────────────────────────────────────────────────────────────

test('every product expands, and no two skus of the counter share a code', () => {
  const codes = totem.products.flatMap((p) => expandSkus(p).map((s) => s.code));
  assert.equal(codes.length, 38);
  assert.equal(new Set(codes).size, codes.length, 'two skus with one code is a stock pass that overwrites');
});

// ── the frozen contract ─────────────────────────────────────────────────────────────────────────────────

test('the fifteen handles are exactly the ones the wave froze', () => {
  // The totem app and the tech lead were told these names. A rename here is an empty menu there, and the
  // failure would appear in another repository's screen rather than in this file.
  assert.deepEqual(
    totem.products.map((p) => p.handle).sort(),
    [...FROZEN_HANDLES].sort(),
  );
});

test('the four menu bands are the frozen ones, and every path is a legal ltree label', () => {
  assert.deepEqual(
    totem.categories.map((c) => c.handle),
    ['cafes', 'especiais', 'comidas', 'pra-levar'],
  );
  for (const category of totem.categories) {
    // ⚠️ `catalog.category.create` measures the path against `^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$` and lets
    // `::ltree` be the final authority. A hyphen is refused — which is why `pra-levar`'s PATH is
    // `pra_levar`, and why this assertion is here rather than in a comment.
    assert.match(category.path, /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/, `band "${category.handle}"`);
  }
  assert.equal(totem.categories.find((c) => c.handle === 'pra-levar').path, 'pra_levar');
});

test('every product names a band that exists, and every band has at least one product', () => {
  const paths = new Set(totem.categories.map((c) => c.path));
  const filled = new Set();
  for (const p of totem.products) {
    assert.ok(paths.has(p.category), `product ${p.handle} names band "${p.category}"`);
    filled.add(p.category);
  }
  assert.ok(paths.has(totem.publish_also.category));
  filled.add(totem.publish_also.category);
  assert.deepEqual([...paths].filter((path) => !filled.has(path)), [], 'an empty band is a blank screen');
});

test('every product photograph is a file in seed/totem-media, named after its handle', () => {
  for (const p of totem.products) {
    assert.equal(p.photo, `${p.handle}.png`, `photo of ${p.handle} does not carry its handle`);
    assert.ok(existsSync(join(MEDIA_DIR, p.photo)), `seed/totem-media/${p.photo} is missing`);
  }
});

test('the six coffees the counter re-sells are the e-commerce\'s own, and each carries a seal', () => {
  const known = new Set(catalog.products.map((p) => p.handle));
  for (const handle of totem.publish_also.handles) {
    // A handle here that seed/catalog.json does not carry is a product this seed would try to PUBLISH and
    // never find — and the counter's "Pra levar" band would silently be one coffee short.
    assert.ok(known.has(handle), `${handle} is not in seed/catalog.json — it cannot be published`);
    assert.ok(totem.publish_also.tags[handle], `${handle} has no counter seal`);
  }
  assert.equal(Object.keys(totem.publish_also.tags).length, totem.publish_also.handles.length);
});

test('the coffee of the week points at a coffee that exists', () => {
  const known = new Set(catalog.products.map((p) => p.handle));
  const pointers = totem.products
    .map((p) => [p.handle, p.custom_fields?.cafe_da_semana])
    .filter(([, week]) => week);
  // The thread that ties the counter to the retail shelf — two products carry it today, and a rotation that
  // names a coffee nobody sells is a menu promising something the shop cannot pour.
  assert.equal(pointers.length, 2);
  for (const [handle, week] of pointers) {
    assert.ok(known.has(week), `${handle} points at "${week}", which is not one of the six coffees`);
  }
});

test('every custom field a product writes is declared in the same file', () => {
  const declared = new Set(totem.custom_fields.map((f) => f.key));
  for (const p of totem.products) {
    for (const key of Object.keys(productMetadata(p))) {
      // An undeclared key is written happily by the kernel and then read by nothing that consults
      // declarations — the silent half `bin/seed.mjs` orders its steps to avoid.
      assert.ok(declared.has(key), `product ${p.handle} writes "${key}", which nothing declares`);
    }
  }
  // The six coffees are written by MERGE and not by `productMetadata`, so their keys need the same check —
  // this is the half that would have shipped an undeclared `desc_totem` and a field nothing could edit.
  for (const handle of totem.publish_also.handles) {
    for (const key of Object.keys(counterFieldsFor(handle))) {
      assert.ok(declared.has(key), `the counter writes "${key}" on ${handle}, which nothing declares`);
    }
  }
  assert.ok(declared.has('tag_balcao'), 'the seal itself has to be declared');
  assert.ok(declared.has('desc_totem'), 'A48 — the counter\'s own one-liner has to be declared');
});

// ── A48 · the counter's own one-liner on the six coffees ────────────────────────────────────────────────
test("the six coffees carry a SHORT desc_totem — they are the ones whose paragraph overflowed the card", () => {
  for (const handle of totem.publish_also.handles) {
    const line = totem.publish_also.desc_totem?.[handle];
    assert.ok(line, `${handle} has no desc_totem — its card would show the shop's paragraph again`);
    // The whole point of the field is length. A "short" line longer than the paragraph it replaces would
    // pass every other test in this file and still be the defect Renan reported.
    assert.ok(line.length <= 60, `desc_totem of ${handle} is ${line.length} chars — that is not a card line`);
  }
});

test('the counter writes seal AND one-liner in ONE bag, so neither pass erases the other', () => {
  const fields = counterFieldsFor('forge-alvorada');
  assert.deepEqual(Object.keys(fields).sort(), ['desc_totem', 'tag_balcao']);
  // And the merge onto a coffee that already carries the shop's own fields keeps every one of them.
  const merged = mergeMetadata({ regiao: 'Mogiana', torra: 'média' }, fields);
  assert.deepEqual(merged, {
    regiao: 'Mogiana',
    torra: 'média',
    tag_balcao: 'blend',
    desc_totem: totem.publish_also.desc_totem['forge-alvorada'],
  });
});

test('a coffee with no counter marks costs no write — an empty bag is not a command', () => {
  assert.deepEqual(counterFieldsFor('a-handle-nobody-marked'), {});
});

// ── the money ───────────────────────────────────────────────────────────────────────────────────────────

test('a bigger cup never costs less, and oat milk never costs less than whole', () => {
  const priceOf = (p, values) =>
    expandSkus(p).find((s) => s.code === skuCode(p.handle, values))?.amount;
  const SIZES = ['P', 'M', 'G', 'P 200ml', 'G 350ml', 'P 400ml', 'G 550ml'];

  for (const p of totem.products) {
    const sizeAxis = (p.options ?? []).findIndex((o) => o.name === 'Tamanho');
    if (sizeAxis === -1) continue;
    const order = p.options[sizeAxis].values.filter((v) => SIZES.includes(v));
    assert.equal(order.length, p.options[sizeAxis].values.length, `unknown size on ${p.handle}`);
    // Walk the sizes in the order the axis declares, holding every OTHER axis still.
    for (const sku of p.skus) {
      const others = sku.options.filter((_, i) => i !== sizeAxis);
      const at = (size) =>
        priceOf(
          p,
          p.options.map((_, i) => (i === sizeAxis ? size : others[i > sizeAxis ? i - 1 : i])),
        );
      for (let i = 1; i < order.length; i++) {
        assert.ok(
          at(order[i]) >= at(order[i - 1]),
          `${p.handle}: ${order[i]} costs less than ${order[i - 1]}`,
        );
      }
    }
  }

  for (const handle of ['cappuccino', 'latte']) {
    const p = product(handle);
    for (const size of ['P', 'M', 'G']) {
      assert.ok(
        priceOf(p, [size, 'Aveia']) > priceOf(p, [size, 'Integral']),
        `${handle} ${size}: oat milk has to cost more than whole milk`,
      );
    }
  }
});

test('every price is an integer number of cents, and none is free', () => {
  for (const p of totem.products) {
    for (const sku of expandSkus(p)) {
      assert.ok(Number.isInteger(sku.amount), `${sku.code} is not an integer of cents`);
      assert.ok(sku.amount > 0, `${sku.code} is free`);
    }
  }
});

// ── the pickup point ────────────────────────────────────────────────────────────────────────────────────

test('the counter has a pickup point with everything the kernel demands of one', () => {
  // `pickup_location.create` requires addr_line1, city, uf and postal_code, and `checkout.place_order`
  // freezes the flattened address onto the order — so an incomplete point here is an order that cannot say
  // where its buyer should walk to.
  for (const key of ['name', 'addr_line1', 'city', 'uf', 'postal_code']) {
    assert.ok(totem.pickup.location[key], `the pickup point has no ${key}`);
  }
  assert.equal(totem.pickup.zone.postal_code_from.length, 8);
  assert.equal(totem.pickup.zone.postal_code_to.length, 8);
});

// ── the promotions ──────────────────────────────────────────────────────────────────────────────────────

test('the combo names products this catalogue actually has', () => {
  const handles = new Set(totem.products.map((p) => p.handle));
  assert.ok(totem.promotions.combo.contains.length >= 2, 'a combo of one is a discount, not a combo');
  for (const handle of totem.promotions.combo.contains) {
    // A `cart_contains` condition naming a product that does not exist is a promotion that can never fire,
    // created without error and silently worth nothing.
    assert.ok(handles.has(handle), `the combo names "${handle}", which is not a counter product`);
  }
});

test('the coupon is the frozen code at the frozen ten percent', () => {
  assert.equal(totem.promotions.coupon.code, 'PRIMEIROCAFE');
  assert.equal(totem.promotions.coupon.percent_bp, 1000);
  assert.match(totem.promotions.coupon.code, /^[A-Za-z0-9._-]+$/, 'promotion.code.add refuses anything else');
});
