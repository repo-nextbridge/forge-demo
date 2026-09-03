// ⛔⛔ THE FORK MAY NOT AUTHOR A PRICED PROMISE — the announcement bar, and the week it lied on every page.
//
// ── WHAT WAS MEASURED (bench, 2026-09-03, the café store `sto_01M1FREJV5N8KWXW0TFE3NVKSD`) ───────────────
//
// The strip read "Frete grátis acima de R$ 149 · 10% OFF na primeira compra com o cupom PRIMEIRAXICARA".
// Both halves were false and the shop had no way to notice:
//
//   promotion (café store, active)   Assinante 10% OFF        item      automatic
//                                    DEMO-HIST-01-CAFE        shipping  min_subtotal 29900  ← "acima de R$ 299"
//   shipping_rate.free_above_amount  NULL on all five rows    ← so the promotion is the ONLY author
//   promotion_code                   PRIMEIROCAFE  → store BALCÃO ·  ANIVERSARIO20 → draft
//                                    PRIMEIRAXICARA → does not exist, anywhere
//
// The coupon row is also the cause of the ALTA nobody could explain: the checkout answers `{"ok":true}` to
// PRIMEIROCAFE and takes nothing off, because the code resolves within the TENANT and pricing then skips a
// promotion scoped to a different STORE.
//
// ── WHY THE GUARD IS ON THE SHAPE OF THE SENTENCE AND NOT ON THE NUMBER ──────────────────────────────────
//
// The obvious guard — "the strip says 299" — would be the same defect with today's value: a second author for
// a rule that lives in the kernel, going stale the moment the merchant edits the promotion, and stale in
// silence. This fork cannot read the promotion either: `read.shipping_summary` exists for exactly this
// question ("the safe banner threshold") and answers `null` here, because it is computed from
// `shipping_rate.free_above_amount` alone and is blind to the shipping-class PROMOTION the admin actually
// gives merchants. That gap is the product's, and it is named in the slice report.
//
// So the rule this file enforces is the one that survives every future value: A PROMISE WITH A PRICE IN IT
// LIVES IN THE STORE'S DATA, NOT IN THE FORK. The Outlet already shows the shape — a `header.announcement`
// block whose text is seeded — and the day the café's is seeded too, this constant stops being the source and
// this guard stops having anything to guard. Until then it holds the line at the cheapest place: the string.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CoffeeChrome } from './CoffeeChrome';

const CAFE = 'sto_01M1DE555TJ36TQB6E9PR5VSJ4';

/** The strip as the shopper reads it — rendered, not read out of the source. A constant somebody stopped
 *  using would make a source-only assertion pass while the header said something else entirely. */
function announcement(): string {
  const { container } = render(
    <CoffeeChrome store={CAFE} base={HOST_BASE}>
      <div />
    </CoffeeChrome>,
  );
  const strip = container.querySelector('[class*="announce"]');
  if (!strip) throw new Error('the chrome rendered no announcement strip — this guard moved with the door');
  return strip.textContent ?? '';
}

test('⛔ the announcement names no MONEY — a floor written here is a second author over a promotion', () => {
  const text = announcement();
  expect(
    text,
    `the strip says "${text}". A free-shipping floor is a promotion's \`min_subtotal\`; typed here it is ` +
      'wrong the first time the merchant edits it, and wrong silently. Seed the sentence as store data.',
  ).not.toMatch(/R\$\s*[\d.,]+|\b\d[\d.]*\s*reais\b/i);
});

test('⛔ the announcement names no DISCOUNT — same rule, and it is how "10% na primeira compra" got there', () => {
  const text = announcement();
  expect(text, `the strip says "${text}"`).not.toMatch(/\d+\s*%|\bOFF\b|\bdesconto\b/i);
});

test('⛔ the announcement names no COUPON CODE — the one it named had never been created', () => {
  const text = announcement();
  // A coupon code is an all-caps run of letters; the shop's own words are sentence case. `PRIMEIRAXICARA`
  // matched nothing in `promotion_code` in any store of this tenant, and nothing in the strip could tell.
  const shouty = text.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{5,}\b/g) ?? [];
  expect(
    shouty,
    `the strip shouts ${shouty.join(', ')} — a code here is a promise no test in this repository can check`,
  ).toEqual([]);
});

test('★ and it still SAYS something — "no promises" must not be reachable by emptying the bar', () => {
  // The cheap way to pass the three rules above is a blank strip, which is a worse shop than a wrong one:
  // the design puts a band across every page and an empty band is a rendering fault the eye reports as ugly
  // rather than as missing.
  const text = announcement().trim();
  expect(text.length, 'the announcement strip is empty').toBeGreaterThan(20);
});

test('⛔⛔ AND NO HAND-WRITTEN COPY OF THIS SHOP NAMES A PRICE — the strip was not the only place', () => {
  // The strip was found first and it was not alone: the home's trust seals carried the SAME false floor
  // ("Frete grátis / acima de R$ 149"), on the page a shopper reads before anything else. One guard over one
  // constant would have left the twin standing and looked green — which is the shape of a fix that teaches
  // nothing. So the rule is over the shop's hand-written copy as a set.
  //
  // Scope is deliberate: these four files are the fork's OWN pages — the chrome, the home, the coffee PDP and
  // its buy box — and every string in them is copy somebody typed. Prices that come from the port are
  // formatted from cents at render time and carry no `R$` literal, so nothing legitimate is caught here.
  const files = [
    'CoffeeChrome.tsx',
    '../../templates/home/HomeCoffee.tsx',
    '../../templates/pdp/PdpCoffee.tsx',
    '../../templates/pdp/CoffeeBuyBox.tsx',
  ];
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const [hit] of src.matchAll(/R\$\s*[\d.,]+/g)) offenders.push(`${file}: ${hit}`);
  }
  expect(
    offenders,
    `a price is typed into this shop's copy: ${offenders.join(' · ')}. A figure a promotion owns is wrong ` +
      'the day the merchant edits it, and wrong in silence.',
  ).toEqual([]);
});

test('★ the guard is watching the STRING the component uses, not one that was left behind', () => {
  // Belt for the assertions above: they render, so a constant nobody reads cannot fool them — but a SECOND
  // constant carrying the old sentence, left in the file for "reference", would be a copy waiting to be
  // pasted back. The source may not carry a priced sentence at all.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'CoffeeChrome.tsx'), 'utf8')
    // The prose above the constant QUOTES the sentence that was removed, on purpose — that is the record of
    // what was measured and why. Comments are stripped before the file is graded.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  expect(src, 'a priced sentence is still spelled in the code of this chrome').not.toMatch(/R\$\s*[\d.,]+/);
});
