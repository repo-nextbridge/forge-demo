// ★★ v031/G2 — THE DEMO CATALOGUE'S CURATION RULER, held against the dataset THIS repo tracks.
//
//   node --test seed/dataset-curation.test.mjs        (or: bash bin/test.sh)
//
// ⛔ WHY IT LIVES HERE. Until v0.3.1 the product carried `extensions/demo-data/catalog.demo.test.ts`. Slice F1
// moved it out: 16 of its 21 assertions were STRUCTURAL and stayed in the product, run against the product's
// `reference` dataset. The other 5 are a ruler for THIS catalogue — the `reference` carries ugly rows ON
// PURPOSE, so those 5 are red there and had nowhere to live. Without this file nothing anywhere would say any
// more that the demo's catalogue is well curated: a converter run that drops an axis, writes a float price or
// a broken EAN would reach every birth in silence.
//
// The five, by intent (original: product `6d0cf2d93:extensions/demo-data/catalog.demo.test.ts`):
//   1. nine FACETABLE axes + two informational numbers, all owned by `product`          (:88-106)
//   2. exactly ONE default SKU per product — the middle size, in the first declared color (:134-155)
//   3. every option value is covered by a SKU, and every SKU tuple is a declared option   (:156-188)
//   4. prices are integer CENTAVOS, never a float, never zero                             (:209-221)
//   5. every SKU carries a ref and a checksum-VALID EAN-13, and every EAN is unique       (:222-244)
//
// MEASURED 2026-10-08 on `seed/dataset/` (catalog version c3962ed84cb2ffc8): 2 790 products, 44 427 SKUs,
// 11 custom fields, and ZERO findings under each of the five — the numbers below were not adjusted to pass.
//
// ★ EACH RULE IS A FUNCTION THAT RETURNS ITS FINDINGS, and each is run twice: over the real dataset (must be
// empty) and over a COPY of one real product broken in exactly the way the rule exists to catch (must name
// it). The second half is what keeps a rule from passing over nothing — the catalogue is 37 MB, and a rule
// that silently looked at the wrong key would read as green forever. The tracked dataset is never written.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const DATASET = join(dirname(fileURLToPath(import.meta.url)), 'dataset');
const { products } = JSON.parse(readFileSync(join(DATASET, 'catalog.json'), 'utf8'));
const customFields = JSON.parse(readFileSync(join(DATASET, 'custom-fields.json'), 'utf8'));

/**
 * ★ THE CURATED FACET VOCABULARY — typed here ON PURPOSE, because it is the curation, not a measurement of it.
 * These nine are the filters the shop window offers a footwear buyer; deriving the list from
 * `custom-fields.json` would make rule 1 agree with whatever the dataset says, which is the one thing it
 * exists not to do. Losing an axis (or one turning informational) is a curation regression and must be red.
 */
const FACETABLE = ['amortecimento', 'cano', 'fechamento', 'genero', 'impermeavel', 'material', 'pisada', 'solado', 'uso'];
/** The two numbers a PDP shows but nobody filters by. */
const INFORMATIONAL = ['drop_mm', 'peso_g'];

/** The star's size: the middle element, the LOWER centre on an even list — the converter's own choice. */
const middle = (values) => values[Math.floor((values.length - 1) / 2)];
const optionValue = (sku, option) => sku.option_values?.find((v) => v.option === option)?.value;

// ── the five rules — each answers a list of findings, empty when the catalogue is well curated ────────────────

function facetProblems(fields) {
  const problems = [];
  for (const d of fields) if (d.owner_entity !== 'product') problems.push(`${d.key} is owned by ${d.owner_entity}, not product`);
  const facetable = fields.filter((d) => d.facetable).map((d) => d.key).sort();
  const informational = fields.filter((d) => !d.facetable).map((d) => d.key).sort();
  if (JSON.stringify(facetable) !== JSON.stringify(FACETABLE)) {
    problems.push(`facetable axes are [${facetable}], the curation declares [${FACETABLE}]`);
  }
  if (JSON.stringify(informational) !== JSON.stringify(INFORMATIONAL)) {
    problems.push(`informational fields are [${informational}], the curation declares [${INFORMATIONAL}]`);
  }
  return problems;
}

function starProblems(catalog) {
  const problems = [];
  for (const p of catalog) {
    const stars = p.skus.filter((s) => s.is_default);
    if (stars.length !== 1) {
      problems.push(`${p.handle} has ${stars.length} default SKUs, not exactly one`);
      continue;
    }
    const sizes = p.options?.find((o) => o.name === 'Tamanho')?.values;
    const colors = p.options?.find((o) => o.name === 'Cor')?.values;
    if (sizes && optionValue(stars[0], 'Tamanho') !== middle(sizes)) {
      problems.push(`${p.handle}: the star is size ${optionValue(stars[0], 'Tamanho')}, not the middle ${middle(sizes)}`);
    }
    if (colors && optionValue(stars[0], 'Cor') !== colors[0]) {
      problems.push(`${p.handle}: the star is color ${optionValue(stars[0], 'Cor')}, not the first ${colors[0]}`);
    }
  }
  return problems;
}

function coverageProblems(catalog) {
  const problems = [];
  for (const p of catalog) {
    const declared = new Map((p.options ?? []).map((o) => [o.name, new Set(o.values)]));
    const sold = new Map();
    for (const sku of p.skus) {
      for (const v of sku.option_values ?? []) {
        if (!sold.has(v.option)) sold.set(v.option, new Set());
        sold.get(v.option).add(v.value);
        if (!declared.get(v.option)?.has(v.value)) {
          problems.push(`${p.handle}/${sku.code}: ${v.option}=${v.value} is not a declared option value`);
        }
      }
    }
    for (const option of p.options ?? []) {
      for (const value of option.values) {
        if (!sold.get(option.name)?.has(value)) problems.push(`${p.handle}: no SKU for ${option.name}=${value}`);
      }
    }
  }
  return problems;
}

function priceProblems(catalog) {
  const problems = [];
  for (const p of catalog) {
    for (const s of p.skus) {
      if (!Number.isInteger(s.amount)) problems.push(`${s.code}: amount ${s.amount} is not integer centavos`);
      else if (s.amount <= 0) problems.push(`${s.code}: amount ${s.amount} is not > 0`);
    }
  }
  return problems;
}

/** The EAN-13 check digit, computed here independently of the converter (weights 1,3 from the left). */
function eanCheckDigit(first12) {
  const sum = [...first12].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function eanProblems(catalog) {
  const seen = new Map();
  const problems = [];
  for (const p of catalog) {
    for (const s of p.skus) {
      if (!s.ref) problems.push(`${s.code} has no ref`);
      if (!/^\d{13}$/.test(s.ean ?? '')) {
        problems.push(`${s.code} has no EAN-13 (${s.ean})`);
        continue;
      }
      if (eanCheckDigit(s.ean.slice(0, 12)) !== Number(s.ean[12])) problems.push(`${s.code}: EAN ${s.ean} has a wrong check digit`);
      if (seen.has(s.ean)) problems.push(`${s.code}: EAN ${s.ean} is a DUPLICATE of ${seen.get(s.ean)}`);
      else seen.set(s.ean, s.code);
    }
  }
  return problems;
}

// ── the fixtures: a COPY of one real product, broken one way ─────────────────────────────────────────────────

/** A real product with BOTH axes and more than one value on each — so every rule has something to bite. */
const SAMPLE = products.find((p) => p.options?.length === 2 && p.options.every((o) => o.values.length > 1));
const copy = () => structuredClone(SAMPLE);

test('⟂ ANTI-VACUUM — the dataset is the full catalogue and the sample reaches every rule', () => {
  assert.ok(products.length > 1000, `only ${products.length} products read from seed/dataset/catalog.json`);
  assert.ok(SAMPLE, 'no product with two multi-valued axes — the broken-copy controls below would test nothing');
  for (const rule of [starProblems, coverageProblems, priceProblems, eanProblems]) {
    assert.deepEqual(rule([copy()]), [], `${rule.name} accuses the UNBROKEN sample — the controls would prove nothing`);
  }
});

test('1 · nine FACETABLE axes + two informational numbers, all owned by `product`', () => {
  assert.deepEqual(facetProblems(customFields), []);
});

test('1 ⛔ an axis lost (or turned informational) is red, naming the axis set', () => {
  const lost = customFields.filter((d) => d.key !== 'pisada');
  assert.match(facetProblems(lost).join('\n'), /facetable axes are \[amortecimento,cano,fechamento,genero,impermeavel,material,solado,uso\]/);
  const demoted = customFields.map((d) => (d.key === 'cano' ? { ...d, facetable: false } : d));
  assert.equal(facetProblems(demoted).length, 2, 'demoting an axis must break both lists');
  const foreign = customFields.map((d) => (d.key === 'uso' ? { ...d, owner_entity: 'sku' } : d));
  assert.deepEqual(facetProblems(foreign), ['uso is owned by sku, not product']);
});

test('2 · exactly ONE default SKU per product — the middle size, in the first declared color', () => {
  assert.deepEqual(starProblems(products), []);
});

test('2 ⛔ two default SKUs, or a star off the middle size, is red naming the product', () => {
  const twin = copy();
  twin.skus.forEach((s) => (s.is_default = true));
  assert.deepEqual(starProblems([twin]), [`${twin.handle} has ${twin.skus.length} default SKUs, not exactly one`]);
  const none = copy();
  none.skus.forEach((s) => delete s.is_default);
  assert.deepEqual(starProblems([none]), [`${none.handle} has 0 default SKUs, not exactly one`]);
  const moved = copy();
  const star = moved.skus.find((s) => s.is_default);
  const other = moved.skus.find((s) => optionValue(s, 'Tamanho') !== optionValue(star, 'Tamanho'));
  delete star.is_default;
  other.is_default = true;
  assert.match(starProblems([moved]).join('\n'), new RegExp(`^${moved.handle}: the star is size`));
});

test('3 · every option value is covered by a SKU, and every SKU tuple is a declared option', () => {
  assert.deepEqual(coverageProblems(products), []);
});

test('3 ⛔ an option value with no SKU, or a SKU with an undeclared value, is red naming both', () => {
  const orphan = copy();
  orphan.options[0].values.push('Inexistente');
  assert.deepEqual(coverageProblems([orphan]), [`${orphan.handle}: no SKU for ${orphan.options[0].name}=Inexistente`]);
  const stray = copy();
  stray.skus[0].option_values[0].value = 'Fantasma';
  assert.ok(
    coverageProblems([stray]).includes(`${stray.handle}/${stray.skus[0].code}: ${stray.skus[0].option_values[0].option}=Fantasma is not a declared option value`),
    coverageProblems([stray]).join('\n'),
  );
});

test('4 · prices are integer CENTAVOS, never a float, never zero', () => {
  assert.deepEqual(priceProblems(products), []);
});

test('4 ⛔ a float price, or a zero price, is red naming the SKU', () => {
  const float = copy();
  float.skus[1].amount = 199.9;
  assert.deepEqual(priceProblems([float]), [`${float.skus[1].code}: amount 199.9 is not integer centavos`]);
  const free = copy();
  free.skus[0].amount = 0;
  assert.deepEqual(priceProblems([free]), [`${free.skus[0].code}: amount 0 is not > 0`]);
});

test('5 · every SKU carries a ref and a checksum-VALID EAN-13 — and every EAN is unique', () => {
  assert.deepEqual(eanProblems(products), []);
});

test('5 ⛔ a wrong check digit, a duplicate EAN or a missing ref is red naming the SKU', () => {
  // The check digit against a published EAN-13 (Wikipedia's worked example), so the helper is not graded by itself.
  assert.equal(eanCheckDigit('400638133393'), 1);
  const wrong = copy();
  const ean = wrong.skus[0].ean;
  wrong.skus[0].ean = ean.slice(0, 12) + ((Number(ean[12]) + 1) % 10);
  assert.deepEqual(eanProblems([wrong]), [`${wrong.skus[0].code}: EAN ${wrong.skus[0].ean} has a wrong check digit`]);
  const dup = copy();
  dup.skus[1].ean = dup.skus[0].ean;
  assert.deepEqual(eanProblems([dup]), [`${dup.skus[1].code}: EAN ${dup.skus[0].ean} is a DUPLICATE of ${dup.skus[0].code}`]);
  const nameless = copy();
  delete nameless.skus[0].ref;
  assert.deepEqual(eanProblems([nameless]), [`${nameless.skus[0].code} has no ref`]);
});
