// o4 #18 — the PDP is the SINGLE source of vertical rhythm between its stacked blocks (gallery/buybox hero,
// the three below_* slots, and the description tabs). The tabs carry their own `margin-top:
// var(--space-section-gap)` (64px) and the slot extension blocks may carry margins too; stacked on the
// container gap those read far too large. The fix lives here at the wrapper — a single (tighter) container gap
// plus a child margin reset — never by editing the sibling-owned blocks. This scans the stylesheet so the
// intent cannot silently regress.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'template.module.css'),
  'utf8',
);

test('the PDP container is the one uniform section gap (its own rhythm token, tighter than the generic 64)', () => {
  // The `.pdp` flex column sets exactly one vertical rhythm token as its `gap`.
  const pdp = css.match(/\.pdp\s*\{[^}]*\}/)?.[0] ?? '';
  expect(pdp).toMatch(/gap:\s*var\(--space-section-gap-pdp\)/);
});

test('the wrapper neutralizes each block own vertical margin (single source of spacing)', () => {
  // `.pdp.pdp > *` zeroes the block margins (ProductTabs' 64px margin-top, any extension-block margin) so the
  // container `gap` is the ONLY gap. Reaching `> *` is correct: <Slot>/<ExtensionOutlet> add no DOM node. The
  // class is DOUBLED for specificity (0,2,0) so it wins the cascade over the sibling blocks' single-class
  // `margin` rules that load in later CSS modules — a plain `.pdp > *` tied and lost on source order.
  expect(css).toMatch(/\.pdp\.pdp\s*>\s*\*\s*\{[^}]*margin-block:\s*0/);
});

// ★ PACK item 17 — the hero's two columns, and the three ways to get them wrong.
//
// The ratio is the PROTOTYPE's: the design file declares `1.18fr 1fr` (1.18/2.18 = 54.1%, the 54:46 measured
// off it — gallery 617 / buybox 525 at 1387px) and carries no breakpoint of its own; the only width query in
// that file is the 768px one every other grid uses. So the guard defends two things at once: the ratio, and
// the ABSENCE of anything invented beside it.
//
// The three wrong answers this catches, because each one silently undoes the fix:
//   1. a buybox frozen in px — it was 440 (85px stolen from where the shopper decides), and it was also 525,
//      which is the design's number and STILL wrong as a fixed track: it forced a breakpoint the design does
//      not ask for;
//   2. a different proportion — 54fr/46fr was mine, right shape and invented numbers;
//   3. the columns swapped, so the photo freezes and the buybox flexes.
test('★ the hero is the prototype ratio, 1.18fr to 1fr', () => {
  const twoColumn = (css.match(/\.layout\s*\{[^}]*grid-template-columns:[^;]+;/g) ?? []).find((d) =>
    d.includes('1.18fr'),
  );
  expect(twoColumn, 'the hero grid must carry the prototype ratio').toBeTruthy();
  expect(twoColumn).toMatch(/grid-template-columns:\s*minmax\(0,\s*1\.18fr\)\s+minmax\(0,\s*1fr\)/);
});

test('★ …and NEITHER column may be frozen in px — a fixed track is what forced an invented breakpoint', () => {
  for (const declaration of css.match(/grid-template-columns:[^;]*;/g) ?? []) {
    expect(declaration, `a px track in the hero grid: ${declaration}`).not.toMatch(/\d+px/);
  }
  // 440 and 525 by name: both were shipped, both were wrong, and a search for either has to fail.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  expect(code).not.toContain('440px');
  expect(code).not.toContain('525px');
});

test('★ …and the PDP invents no breakpoint of its own — the prototype has exactly one, at 768', () => {
  // The 1100px query existed for one commit, to stop a fixed 525px column collapsing the gallery to 131px at
  // 768. With the proportional hero there is nothing to floor, and the house scale went back to what it was.
  const widths = [...css.matchAll(/@media[^{]*?min-width:\s*([^)\s]+)/g)].map((m) => m[1]);
  expect(widths).toEqual(['768px']);
});
