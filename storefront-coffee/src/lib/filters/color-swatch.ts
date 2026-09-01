// Color-swatch dictionary (S7-SF-PLP-FIDELITY, theme presentation). The PLP's "Cor" facet renders as SOLID
// color chips (the design source's colorMap), not product photos — a color name → hex map lives in the THEME
// because a swatch hue is pure presentation (the read port's facet carries only the value name, never a hex, and
// it must not: a hex is a look, not catalog truth). A value with no known hue degrades to a neutral chip (still
// selectable), so an unmapped color is never a broken swatch. Lookup is accent/case-insensitive and falls back
// to the first word ("Azul Marinho" → "azul").
//
// The seed hues mirror themes/storefront-vanilla/design-base/Busca.dc.html `colorMap` so the storefront matches the
// prototype pixel-for-pixel on the demo palette. New brands add names here (theme edit), never in the kernel.

const COLOR_HEX: Record<string, string> = {
  branco: '#ffffff',
  'off-white': '#f5f5f2',
  offwhite: '#f5f5f2',
  gelo: '#f5f5f2',
  preto: '#17181a',
  cinza: '#9aa0a6',
  chumbo: '#4b4d52',
  grafite: '#2b2d31',
  prata: '#c0c3c8',
  azul: '#2b4bd7',
  marinho: '#1f2a5c',
  verde: '#3d5c4a',
  vermelho: '#e5352b',
  rosa: '#f0b8a4',
  pink: '#ec4899',
  bege: '#d9c7a7',
  nude: '#e8c4a0',
  marrom: '#7a5230',
  caramelo: '#a4632b',
  laranja: '#e07b39',
  amarelo: '#eecb3f',
  dourado: '#c9a24b',
  coral: '#f08070',
  roxo: '#6b3fa0',
  lilas: '#b39ddb',
  vinho: '#7a1f2b',
  turquesa: '#2bb3a3',
};

/** Normalize a color name for lookup: lowercase, strip accents/diacritics, collapse spaces. */
function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** The hex for a color option value, or undefined when unmapped (→ a neutral chip). Tries the full normalized
 * name, then the first token (so "Azul Marinho" resolves through "marinho"/"azul"). */
export function colorHex(value: string): string | undefined {
  const key = normalize(value);
  if (key in COLOR_HEX) return COLOR_HEX[key];
  const [first] = key.split(/\s+/);
  if (first && first in COLOR_HEX) return COLOR_HEX[first];
  const last = key.split(/\s+/).at(-1);
  if (last && last in COLOR_HEX) return COLOR_HEX[last];
  return undefined;
}

/** Whether an option axis is the color axis (renders as swatches). Name-based (accent-insensitive). */
export function isColorAxis(axisName: string): boolean {
  const n = normalize(axisName);
  return n === 'cor' || n === 'color' || n === 'cores';
}
