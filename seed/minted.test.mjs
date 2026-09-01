// THE RUN'S REGISTRY, and the sentence for a lookup that came up empty — the two halves of the structural
// answer to a defect this repository paid for FOUR times in one day.
//
// The class: a step CREATES something, then asks a READ whether it exists, and loses the race with the
// projection. Three point fixes in one file is not three bugs — it is one design missing. These tests pin
// the design, and the message tests pin the thing that made each occurrence expensive: an error that named a
// cause it had not measured, sending the reader to verify something that was already correct.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMinted, unresolved } from './minted.mjs';

test('★ what the run created is answerable immediately — no read, no wait', () => {
  const minted = createMinted();
  minted.rememberProduct('forge-alvorada', 'prod_1');
  minted.rememberSku('forge-alvorada-graos-250g', 'sku_1');
  assert.equal(minted.product('forge-alvorada'), 'prod_1');
  assert.equal(minted.sku('forge-alvorada-graos-250g'), 'sku_1');
});

test('★★ something this run did NOT create answers null — a fact, not a failure', () => {
  // This is what keeps the registry from becoming a second catalogue. It answers about a strictly smaller
  // set — the run's own — and null is the signal to fall through to the read, which is the authority for
  // everything an earlier run made and where there is no race to lose.
  const minted = createMinted();
  assert.equal(minted.product('forge-noturno'), null);
  assert.equal(minted.sku('anything'), null);
});

test('a half-answer is never registered — an id without a handle registers nothing', () => {
  // A command that returned no id must not put `undefined` in the registry under a real handle: the next
  // lookup would "resolve" to nothing and the caller would treat it as found.
  const minted = createMinted();
  minted.rememberProduct('x', undefined);
  minted.rememberProduct(undefined, 'prod_1');
  minted.rememberSku('y', null);
  assert.equal(minted.product('x'), null);
  assert.deepEqual(minted.counts, { products: 0, skus: 0 });
});

test('the sku registry hands itself to the stock planner in the planner’s own shape', () => {
  const minted = createMinted();
  minted.rememberSku('espresso-forge-simples', 'sku_a');
  assert.deepEqual(minted.asCatalogueRows(), [{ skus: [{ code: 'espresso-forge-simples', id: 'sku_a' }] }]);
});

test('counts report what the run made — the number the honest error message quotes', () => {
  const minted = createMinted();
  minted.rememberProduct('a', '1');
  minted.rememberSku('b', '2');
  minted.rememberSku('c', '3');
  assert.deepEqual(minted.counts, { products: 1, skus: 2 });
});

// ── the message ─────────────────────────────────────────────────────────────────────────────────────────

test('★★ the message NAMES NO CAUSE — it says what it measured and sends the reader to re-read', () => {
  // The three messages this helper replaces each ASSERTED a cause, and in every case the real one was a
  // lagging projection that none of them listed. The worst was the most helpful-sounding: it explained the
  // module order, so the reader verified the order, found it correct, and was left with nothing.
  const text = unresolved({
    what: 'product(s)',
    names: ['forge-alvorada', 'forge-noturno'],
    measured: 'the read answered 15 product(s); this run created 0.',
    andThen: 'they were never created.',
  });
  assert.match(text, /MEASURED: the read answered 15/);
  assert.match(text, /THIS DOES NOT SAY WHY/);
  assert.match(text, /PROJECTION/);
  assert.match(text, /ASK THE READ\s*\n?\s*AGAIN/);
  assert.match(text, /forge-alvorada, forge-noturno/);
});

test('it caps the list and says how many it did not show', () => {
  // A message that prints 2790 names is a message nobody reads to the end.
  const text = unresolved({
    what: 'sku code(s)',
    names: Array.from({ length: 9 }, (_, i) => `code-${i}`),
    measured: 'x',
    andThen: 'y',
  });
  assert.match(text, /code-0, code-1, code-2, code-3, code-4 … \(\+4\)/);
});
