// THE PALETTE GUARD — "is the counter still wearing the design?", asked of the design itself.
//
// Fidelity to the artboard is a mandate for this slice, and a mandate with no test is a sentence in a brief.
// So this does not compare the tokens against a list retyped here: it reads
// `design-base/Totem forge.co.dc.html` — the artboard as approved — and requires every colour the tokens
// declare to appear in it, and every colour the artboard uses for a named role to be declared.
//
// ⚠️ A NEW COLOUR IS THEREFORE A FAILURE UNTIL THE DESIGN BASE CARRIES IT, which is the whole point: the way
// a design dies is one hurried `#B07A3C` at a time, and nobody ever notices the second one.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const artboard = readFileSync(join(root, 'design-base/Totem forge.co.dc.html'), 'utf8');

/** The nine of the artboard, by the role each one plays. The VALUES are asserted against the artboard below;
 *  this list is what pins the ROLES, so deleting a token is as red as changing one. */
const PALETTE: Record<string, string> = {
  '--totem-frame': '#1b1512',
  '--totem-bg': '#F3EDE3',
  '--totem-header': '#2F3B31',
  '--totem-rail': '#EDE5D8',
  '--totem-card': '#F8F4EC',
  '--totem-ink': '#2F2620',
  '--totem-amber': '#B0793C',
  '--totem-green': '#3C4A3E',
  '--totem-sand': '#DCC7A6',
};

describe('the totem palette is the artboard palette', () => {
  it.each(Object.entries(PALETTE))('%s is declared as %s', (token, hex) => {
    const declared = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(tokens);
    expect(declared, `${token} is not declared in src/styles/tokens.css`).not.toBeNull();
    expect(declared?.[1]).toBe(hex);
  });

  it.each(Object.entries(PALETTE))('%s (%s) is a colour the approved artboard actually uses', (_t, hex) => {
    // The artboard writes its hexes inline; case is the designer's, so both spellings count.
    const used =
      artboard.includes(hex) ||
      artboard.includes(hex.toLowerCase()) ||
      artboard.includes(hex.toUpperCase());
    expect(used, `${hex} appears nowhere in design-base/Totem forge.co.dc.html`).toBe(true);
  });

  it('declares no sixth-digit variant of a token colour that the artboard never had', () => {
    const declaredHexes = [...tokens.matchAll(/--totem-[a-z-]+\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)].map(
      (m) => m[1] as string,
    );
    const strays = declaredHexes.filter(
      (h) =>
        !artboard.includes(h) &&
        !artboard.includes(h.toLowerCase()) &&
        !artboard.includes(h.toUpperCase()),
    );
    expect(strays, `these colours are in tokens.css and not in the artboard: ${strays.join(', ')}`).toEqual(
      [],
    );
  });
});

describe('the two exceptions the client asked for, and they are exceptions ON PURPOSE', () => {
  // Renan, 2026-09-01: the chips are ALL beige — the artboard's divergent chip colours were a Claude Design
  // mistake, not a decision. The artboard therefore still contains the green/amber chip backgrounds, and this
  // test exists so nobody "restores fidelity" by putting them back.
  it('no component paints a chip with the artboard chip colours', () => {
    const componentCss = readFileSync(join(root, 'src/styles/globals.css'), 'utf8');
    expect(componentCss).not.toContain('rgba(60,74,62,.9)');
    expect(componentCss).not.toContain('rgba(176,121,60,.92)');
  });
});
