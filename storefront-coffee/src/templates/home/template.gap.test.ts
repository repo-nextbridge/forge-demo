// R4 item 3 — the home is the SINGLE source of vertical rhythm between its composed blocks. Each block
// (banners/shelves/category tiles/brands) brings its own `margin: var(--space-section-gap) 0`; stacked on the
// container's flex `gap` that DOUBLED (and between two self-margined blocks tripled) the spacing, so the gaps
// read both too large and uneven. The fix lives here at the wrapper — never in the sibling-owned blocks — as a
// container `gap` plus a child margin reset. This scans the stylesheet so the intent cannot silently regress.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'template.module.css'),
  'utf8',
);

test('the home container is the one uniform section gap (a single token, no ad-hoc value)', () => {
  // The `.home` flex column sets exactly one vertical rhythm token as its `gap` — the home-specific rhythm
  // (o4 #18: tighter than the generic --space-section-gap that #295 reused).
  const home = css.match(/\.home\s*\{[^}]*\}/)?.[0] ?? '';
  expect(home).toMatch(/gap:\s*var\(--space-section-gap-home\)/);
});

test('the wrapper neutralizes each block own vertical margin (single source of spacing)', () => {
  // `.home.home > *` zeroes the block margins so the container `gap` is the ONLY gap — regardless of the margin
  // a sibling-owned block carries. Reaching `> *` is correct: <Slot>/<ExtensionOutlet> add no DOM node. The
  // class is DOUBLED for specificity (0,2,0): a plain `.home > *` tied the block's own single-class `.root
  // { margin: … }` (0,1,0) and lost on source order (the block CSS module loads later), so the 64px margins
  // survived in production. The doubled class must not silently regress to a single one.
  expect(css).toMatch(/\.home\.home\s*>\s*\*\s*\{[^}]*margin-block:\s*0/);
});
