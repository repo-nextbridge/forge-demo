// The architecture screen: the three languages, everything the model says, and the SHAPE held against the box's
// own declaration. jsdom; the visual fidelity is the human gate (screenshots against design-base/gate.dc.html).
//
// ⚠️ NOT ONE LANGUAGE LIST IS TYPED HERE. The language loop walks `LANGS` and the expected copy comes out of
// `ARCH`, so a fourth language is covered by existing, and a language whose `ArchStrings` went missing a key does
// not compile. (pk29 spent a whole slice killing transcribed lists; this is the same rule applied early.)
//
// ⚠️ AND THE SHAPE COMES OUT OF `seed/box.json`. The screen states how many tenants this demo has and how many
// shops each one runs; the box is BORN from that file. Reading it here is what makes a third shop a red test
// instead of a screen that quietly lies. It is read, never skipped when absent: a guard that answers "not
// checked" about the one file it grades is the ninth entry in this leva's list of signals that cannot say no.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ARCH, LANGS } from '../i18n';
import { ArchScreen, archTenants, DATA, SURFACES } from './arch';

const noop = () => {};

/** vitest runs from the app root (apps/demo-gate); the box's declaration is two levels up. */
const BOX_PATH = join(process.cwd(), '..', '..', 'seed', 'box.json');
const box = JSON.parse(readFileSync(BOX_PATH, 'utf8')) as {
  tenants: { id: string; stores: { handle: string }[] }[];
};

/** How many times `needle` occurs in `haystack`. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test('the box declaration this file grades against is really there (no vacuum)', () => {
  expect(box.tenants.length, `${BOX_PATH} declares no tenant`).toBeGreaterThan(1);
  for (const tenant of box.tenants) {
    expect(tenant.stores.length, `tenant ${tenant.id} declares no store`).toBeGreaterThan(0);
  }
});

test('the screen draws one card per tenant the box declares, with one card per store', () => {
  const tenants = archTenants(ARCH.pt);
  expect(
    tenants.length,
    `the screen draws ${tenants.length} tenant(s); ${BOX_PATH} declares ${box.tenants.length}`,
  ).toBe(box.tenants.length);
  for (const [i, declared] of box.tenants.entries()) {
    const drawn = tenants[i];
    expect(
      drawn?.shops.length,
      `tenant ${declared.id} runs ${declared.stores.length} store(s) (${declared.stores
        .map((s) => s.handle)
        .join(', ')}); the screen draws ${drawn?.shops.length}`,
    ).toBe(declared.stores.length);
  }
});

test('the two cards are in the order the box declares them (the coffee tenant is the second)', () => {
  // The accents and the copy are per-tenant, so an order that disagreed with the box would dress the shoe
  // tenant in the coffee card's facts and still count right.
  const accents = archTenants(ARCH.pt).map((t) => t.accent);
  const coffeeIndex = box.tenants.findIndex((t) => /cafe|coffee/i.test(t.id));
  expect(coffeeIndex, `no tenant of ${BOX_PATH} has a coffee-ish id`).toBeGreaterThanOrEqual(0);
  expect(accents[coffeeIndex]).toBe('cafe');
  expect(accents.filter((a) => a === 'cafe')).toHaveLength(1);
});

test('the three languages say three different things (the loop below is not rendering PT thrice)', () => {
  expect(LANGS.length).toBeGreaterThan(2);
  const titles = new Set(LANGS.map((lang) => ARCH[lang].title));
  expect(titles.size, `two languages share a title: ${[...titles].join(' / ')}`).toBe(LANGS.length);
});

for (const lang of LANGS) {
  test(`[${lang}] the screen renders its own title, lede and the way back`, () => {
    const t = ARCH[lang];
    const { container } = render(<ArchScreen lang={lang} onClose={noop} />);
    expect(screen.getByRole('heading', { name: t.title })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.back })).toBeTruthy();
    // The lede is split around the one emphasised word ("kernel"), so `getByText` would see only the halves
    // either side of the <strong> — the whole sentence exists in the rendered text, and that is what is checked.
    expect(container.textContent ?? '').toContain(t.lede.join(''));
  });

  test(`[${lang}] every line of the model is on the screen, as many times as the model says`, () => {
    const t = ARCH[lang];
    const { container } = render(<ArchScreen lang={lang} onClose={noop} />);
    const text = container.textContent ?? '';

    // The rows, counted: a row dropped from the render (or rendered twice) is named here, not averaged away.
    const expected = new Map<string, number>();
    for (const tenant of archTenants(t)) {
      expected.set(tenant.label, (expected.get(tenant.label) ?? 0) + 1);
      expected.set(tenant.admin, (expected.get(tenant.admin) ?? 0) + 1);
      for (const shop of tenant.shops) {
        expected.set(shop.label, (expected.get(shop.label) ?? 0) + 1);
        for (const row of shop.rows) {
          const line = row.value ? `${row.term} ${row.value}` : row.term;
          expected.set(line, (expected.get(line) ?? 0) + 1);
        }
      }
    }
    expect(
      expected.size,
      'the model yielded no line: this assertion would be vacuous',
    ).toBeGreaterThan(10);
    for (const [line, count] of expected) {
      expect(occurrences(text, line), `"${line}" on the screen`).toBe(count);
    }

    // And the stack under both tenants: the surfaces, the port, the kernel, the data, the infra.
    for (const surface of SURFACES) expect(text).toContain(surface);
    for (const datum of DATA) expect(text).toContain(datum);
    expect(text).toContain(t.port);
    expect(text).toContain(t.kernel);
    expect(text).toContain(t.kernelParts);
    expect(text).toContain(t.infra);
    expect(text).toContain(t.infraParts);
  });
}

// ★★★ THE ACCENT OF THE SHOE TENANT IS GRADED AGAINST THE ARTBOARD, exactly like this screen's words are
// graded against `seed/box.json`. Everything else in this file asks "does the screen say what the box
// declares"; nothing asked "does it look like the drawing", so a pass that recoloured one file and not the
// other would have left the screen and its truth disagreeing in silence.
const DESIGN_PATH = join(process.cwd(), 'design-base', 'gate.dc.html');
const design = readFileSync(DESIGN_PATH, 'utf8');
const css = readFileSync(join(process.cwd(), 'block', 'arch.module.css'), 'utf8');

/** The declarations of one rule of a stylesheet, by selector — so a colour is asserted WHERE it is set rather
 *  than anywhere in the file. A selector that is not there THROWS: an absent rule must never read as an
 *  absent colour. ⚠️ Five lines carried twice (`hub.test.tsx` has the same) rather than imported from the
 *  other suite: importing a test module re-registers its tests inside this one, measured at +24 duplicated
 *  cases here, and a shared helper is not worth a source file this app would ship to say it. */
function rule(sheet: string, selector: string): string {
  const at = sheet.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`${selector} is not a rule of this stylesheet`);
  return sheet.slice(at, sheet.indexOf('}', at));
}

test('⛔ the design this colour rule grades against is really the gate artboard', () => {
  expect(design.length, `${DESIGN_PATH} is empty`).toBeGreaterThan(2000);
  expect(design, 'this is not the gate artboard').toContain(ARCH.pt.title);
});

test('★★ the shoe tenant wears the artboard’s TERRACOTTA — border, label, admin block — on both sides', () => {
  // The strong orange used three times around one card made the shoe tenant shout over the coffee tenant
  // beside it, which is a false claim on a screen whose whole point is that the two are the same kernel.
  expect(design, 'the artboard does not outline the shoe panel').toContain(
    'border:1px solid rgba(232,161,114,.35)',
  );
  expect(design).toContain(`color:#E8A172">${ARCH.pt.tenantShoes}<`);
  expect(design, 'the artboard does not fill the shoe admin block').toContain(
    'background:rgba(232,161,114,.12)',
  );
  expect(design, 'the artboard’s admin glyph is not the accent').toContain('stroke="#E8A172"');
  expect(rule(css, '.tenantShoes')).toContain('rgba(232, 161, 114, 0.35)');
  expect(rule(css, '.labelShoes')).toContain('#e8a172');
  expect(rule(css, '.adminShoes')).toContain('rgba(232, 161, 114, 0.12)');
  expect(rule(css, '.iconShoes')).toContain('#e8a172');
  // ⛔ AND THE STRONG ORANGE IS ON NEITHER SIDE — asserted WHERE it was, because `#C2410C` is still the
  // port's dot on this same screen and the wordmark's dot on the other one.
  for (const selector of ['.tenantShoes', '.labelShoes', '.adminShoes', '.iconShoes']) {
    const declarations = rule(css, selector).toLowerCase();
    expect(declarations, `${selector} is still the strong orange`).not.toContain('194, 65, 12');
    expect(declarations, `${selector} is still the strong orange`).not.toContain('#c2410c');
  }
  expect(design.includes('rgba(194,65,12,'), 'the artboard still draws the strong orange').toBe(
    false,
  );
});
