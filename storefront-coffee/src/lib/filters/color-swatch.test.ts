// color-swatch (S7-SF-PLP-FIDELITY) — the theme's color-name → hex dictionary that draws the PLP "Cor" facet as
// solid hue chips. Accent/case-insensitive, first/last-token fallback, and a clean `undefined` for the unmapped
// (→ a neutral chip, never a broken swatch).
import { expect, test } from 'vitest';
import { colorHex, isColorAxis } from './color-swatch';

test('maps the seed palette exactly (design source colorMap)', () => {
  expect(colorHex('Preto')).toBe('#17181a');
  expect(colorHex('Branco')).toBe('#ffffff');
  expect(colorHex('Vermelho')).toBe('#e5352b');
  expect(colorHex('Azul')).toBe('#2b4bd7');
});

test('is accent- and case-insensitive', () => {
  expect(colorHex('CINZA')).toBe('#9aa0a6');
  expect(colorHex('lilás')).toBe('#b39ddb');
  expect(colorHex('  Bege ')).toBe('#d9c7a7');
});

test('falls back to a token of a multi-word name (base color is the first token in pt-BR)', () => {
  expect(colorHex('Azul Marinho')).toBe('#2b4bd7'); // "azul" is the base
  expect(colorHex('Verde Militar')).toBe('#3d5c4a'); // "verde" is the base
  expect(colorHex('Preto Fosco')).toBe('#17181a'); // "preto" is the base
});

test('an unmapped color returns undefined (→ a neutral chip)', () => {
  expect(colorHex('Furta-cor')).toBeUndefined();
});

test('isColorAxis matches the color axis name only, accent-insensitive', () => {
  expect(isColorAxis('Cor')).toBe(true);
  expect(isColorAxis('COR')).toBe(true);
  expect(isColorAxis('color')).toBe(true);
  expect(isColorAxis('Tamanho')).toBe(false);
  expect(isColorAxis('Material')).toBe(false);
});
