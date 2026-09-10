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
