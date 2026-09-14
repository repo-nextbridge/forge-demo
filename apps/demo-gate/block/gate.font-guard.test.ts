// Font guard (DEMO-GATE DoD #5) — the gate uses the THEME's own type stack (Urbanist, inherited from the
// storefront body). The design's display face (Geigyll) is dropped: no `@font-face`, no `@import`, no font CDN
// (fonts.googleapis / fonts.gstatic) may enter the gate's diff. This proves the H1 rides the theme font, not a
// bundled or fetched one — the fidelity contract's font clause.
//
// ★ pk35/d1 — AND THE THIRD RULE IS NOW A PROPERTY RATHER THAN A WORD; see `fallsThroughToAGeneric` below for
// the measurement that moved it.
//
// ⚠️ IT WALKS THE BLOCK DIRECTORY, IT DOES NOT READ TWO NAMES. Until FAXINA/F2a this file opened
// `gate.module.css` and `gate.tsx` by name, and everything else the block ships was outside its eyes. That was
// not a hypothetical: `ribbon.module.css` and `ribbon.tsx` were already sitting beside them, unread, and a
// sabotage confirmed it — an `@font-face` with a Geigyll `src` on a fonts.gstatic URL, planted in
// `ribbon.module.css`, left all three tests green. A rule stated over a hand-written file list stops covering
// the block the moment the block grows, which is exactly what a block does.
//
// So the population is DERIVED from disk: every `.css` and `.tsx` under `block/`, recursively. A third
// stylesheet, a `gate.mobile.tsx`, a subdirectory of parts — all in scope by existing, with nobody remembering
// to add a case. The anti-vacuity tests below are what make the derivation trustworthy: a walk that returned
// nothing would satisfy every forbidden-pattern assertion in this file by having nothing to match against, and
// the `font-family` loop in particular would iterate zero declarations and pass on silence.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { expect, test } from 'vitest';

// vitest runs from the package root (extensions/demo-gate); resolve the source files relative to it. (jsdom's
// import.meta.url is not a file:// URL, so fileURLToPath can't be used here.)
const root = process.cwd();
const BLOCK = join(root, 'block');

/** What the block SHIPS: stylesheets and components. `.ts` is deliberately out — this file is one, and a guard
 *  that has to exempt itself from its own scan has a back door by construction. */
const SHIPPED = ['.css', '.tsx'];

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else if (SHIPPED.includes(extname(path))) found.push(path);
  }
  return found;
}

const files = filesUnder(BLOCK).map((path) => ({
  name: path.slice(BLOCK.length + 1),
  source: readFileSync(path, 'utf8'),
}));
const stylesheets = files.filter((f) => f.name.endsWith('.css'));

/** Assert a forbidden pattern over every shipped file, one at a time: the offender is NAMED. Asserting over the
 *  concatenation would report the defect against a wall of joined sources, which is the message nobody reads. */
function noneMatch(pattern: RegExp, why: string): void {
  const offenders = files.filter((f) => pattern.test(f.source)).map((f) => `${f.name} (${why})`);
  expect(offenders, why).toEqual([]);
}

test('the guard is looking at the whole block (it did not walk into an empty directory)', () => {
  // The floor, and both halves of the population. Measured 2026-08-21: 5 files — gate.module.css, gate.tsx,
  // ribbon.module.css, ribbon.tsx, gate.test.tsx. The floor is 4 so that deleting the ribbon (a real
  // possibility) is not a red build, while a walk that broke and returned one file or none is.
  expect(
    files.length,
    `block/ files walked: ${files.map((f) => f.name).join(', ')}`,
  ).toBeGreaterThan(3);
  expect(
    stylesheets.length,
    'no stylesheet in the walk: the CSS assertions would be vacuous',
  ).toBeGreaterThan(0);
  expect(
    files.filter((f) => f.name.endsWith('.tsx')).length,
    'no component in the walk: the source assertions would be vacuous',
  ).toBeGreaterThan(0);
});

test('the gate ships no @font-face', () => {
  noneMatch(/@font-face/i, 'ships a bundled font rule');
});

test('the gate imports no external font (no CDN, no @import)', () => {
  noneMatch(/fonts\.googleapis|fonts\.gstatic/i, 'fetches a font from a CDN');
  const importing = stylesheets.filter((s) => /@import/i.test(s.source)).map((s) => s.name);
  expect(importing, 'a stylesheet pulls another one in, which is where a font rule hides').toEqual(
    [],
  );
});

/**
 * ★ THE RULE IS «THIS DECLARATION CANNOT NEED A FONT THAT IS NOT ALREADY THERE», not «the word inherit».
 *
 * ⚠️ IT USED TO BE THE WORD, and pk35/d1 met the wall the word built: the hub prints each tenant's
 * admin HOSTNAME in monospace (`design-base/gate.dc.html` does), and `ui-monospace, SFMono-Regular, Menlo,
 * monospace` is not a bespoke face — every token in it is either a generic CSS family or a face the operating
 * system already ships. Nothing is bundled and nothing is fetched, which is what DoD #5 is actually about, and
 * the two tests above are what enforce that half (`@font-face` and the CDNs).
 *
 * So what this rule holds is the property that makes a stack SAFE: it ENDS IN A GENERIC FAMILY, so whatever
 * the browser cannot find falls through to something it can. A declaration naming a face with no generic tail
 * — `font-family: Geigyll` — is a promise this app has no way to keep, and stays red.
 */
const GENERIC_FAMILIES = [
  'inherit',
  'initial',
  'unset',
  'revert',
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
];

/** Does this declaration fall through to something every browser has? */
export function fallsThroughToAGeneric(declaration: string): boolean {
  const value = declaration.toLowerCase().replace(/^font-family:/, '').trim().replace(/[;!].*$/, '');
  const last = value.split(',').pop()?.trim().replace(/^['"]|['"]$/g, '') ?? '';
  return GENERIC_FAMILIES.includes(last);
}

test('★ the rule can say NO — the predicate, held against what it exists to refuse', () => {
  // ⛔ ANTI-VACUUM FOR THE RULE ITSELF, not for the walk. A predicate that answered `true` to everything would
  // make the loop below green over any stylesheet at all, and nothing else in this file would notice.
  expect(fallsThroughToAGeneric('font-family: inherit')).toBe(true);
  expect(fallsThroughToAGeneric('font-family: ui-monospace, SFMono-Regular, Menlo, monospace')).toBe(true);
  expect(fallsThroughToAGeneric("font-family: 'Urbanist', Helvetica, sans-serif")).toBe(true);
  expect(fallsThroughToAGeneric('font-family: Geigyll')).toBe(false);
  expect(fallsThroughToAGeneric("font-family: 'Geigyll Display', Geigyll")).toBe(false);
});

test('the gate sets no font-family that needs a face nobody has (the H1 uses the theme font)', () => {
  // Geigyll — the design's dropped display face — must not appear at all, generic tail or no generic tail.
  noneMatch(/geigyll/i, "names the design's dropped display face");
  const declarations = stylesheets.flatMap((sheet) =>
    (sheet.source.match(/font-family:[^;]+/gi) ?? []).map((decl) => ({
      where: sheet.name,
      decl: decl.toLowerCase(),
    })),
  );
  // Anti-vacuity for THIS loop specifically: with no declaration found it asserts nothing, and a walk that
  // stopped seeing stylesheets would read as "no bespoke font anywhere" rather than as "I looked nowhere".
  expect(
    declarations.length,
    'no font-family declaration found: the loop below asserts nothing',
  ).toBeGreaterThan(0);
  const bespoke = declarations
    .filter(({ decl }) => !fallsThroughToAGeneric(decl))
    .map(({ where, decl }) => `${where}: ${decl}`);
  expect(
    bespoke,
    'a font-family names a face this app neither bundles nor fetches and offers no generic fallback',
  ).toEqual([]);
});
