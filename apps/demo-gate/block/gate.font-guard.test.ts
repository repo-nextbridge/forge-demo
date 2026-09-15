// Font guard (DEMO-GATE DoD #5) — WHAT THE GATE IS ALLOWED TO SET TEXT IN.
//
// ★★★ pk38/d7 — THE RULE CHANGED, DELIBERATELY AND IN ONE DIRECTION, AND THIS PARAGRAPH IS THE CHANGE.
//
// It used to be «no `@font-face` at all», and under it the H1 rode the theme's Urbanist and the design's serif
// simply did not exist here. That was the right rule while the gate's first screen was a hero in one voice.
// It stopped being the right rule when that screen became the 10/09 hub: there the SECOND tenant is a coffee
// brand whose card — its headline and its two wordmarks (`design-base/gate.dc.html:68,73,79`) — is drawn in a
// serif, and that contrast is the card's whole argument. A rule that forbids a font forbids the design.
//
// ⚠️ SO WHAT THE RULE PROTECTS HAD TO BE SAID PROPERLY, because «no @font-face» was never the point — the
// point is that THE FIRST SCREEN OF THIS DEMO MUST NOT DEPEND ON A THIRD PARTY. A gate that fetches a face
// from a CDN is a gate that renders in the fallback on a network that cannot reach it, and it is a request to
// somebody else's server before the visitor has seen anything of ours. So, from here:
//
//   ALLOWED   an `@font-face` whose every `src: url(…)` is a RELATIVE path to a file this app ships, with the
//             font's licence shipped beside it.
//   REFUSED   any absolute or protocol-relative font url (a CDN, `fonts.googleapis`/`fonts.gstatic`, any
//             host at all), an `@font-face` whose file is not in the tree, a font shipped with no licence,
//             an `@import`, and any `font-family` that names a face with no generic tail.
//
// ⛔ AND THE DESIGN'S OWN DISPLAY FACE (Geigyll) STAYS OUT, unchanged and for the unchanged reason: nothing
// licences it to this app, so naming it would be a promise this repository has no way to keep. The base HTML
// falls back to `Fraunces` for the same role, which is SIL OFL and already travels with this box's coffee
// theme — that is the face the hub ships.
//
// ★ pk35/d1 — AND THE GENERIC-TAIL RULE IS A PROPERTY RATHER THAN A WORD; see `fallsThroughToAGeneric` below
// for the measurement that moved it.
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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
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
  /** Where a relative `url(…)` inside this file resolves from. */
  dir: dirname(path),
  source: readFileSync(path, 'utf8'),
}));
const stylesheets = files.filter((f) => f.name.endsWith('.css'));

/** Every `url(…)` that a `src:` inside an `@font-face` points at, with the stylesheet that wrote it. */
const fontSources = stylesheets.flatMap((sheet) =>
  (sheet.source.match(/@font-face\s*\{[^}]*\}/gi) ?? []).flatMap((rule) =>
    (rule.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi) ?? []).map((raw) => ({
      where: sheet.name,
      dir: sheet.dir,
      url: (raw.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i)?.[1] ?? '').trim(),
    })),
  ),
);

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

test('★★★ every face the gate declares is a FILE THIS APP SHIPS — never a fetch to anybody', () => {
  // The rule that replaced «no @font-face». A face is allowed; a DEPENDENCY on somebody else's server is not,
  // and those are different sentences. Each `src` is judged on its own and the offender is named with its url.
  const remote = fontSources
    .filter(({ url }) => /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith('data:'))
    .map(({ where, url }) => `${where}: ${url}`);
  expect(
    remote,
    'a @font-face points off this app: the first screen of the demo would render in the fallback on any ' +
      'network that cannot reach that host, and would call it before the visitor has seen anything of ours',
  ).toEqual([]);

  const missing = fontSources
    .filter(({ dir, url }) => !existsSync(resolve(dir, url.replace(/[?#].*$/, ''))))
    .map(({ where, url }) => `${where}: ${url}`);
  expect(
    missing,
    'a @font-face names a file that is not in this tree — the declaration is a promise nothing keeps',
  ).toEqual([]);
});

test('★ a face this app ships travels with its LICENCE', () => {
  // Shipping a font file is redistributing it. The families used here are SIL OFL, which permits exactly that
  // and requires the licence to travel along; a font in the tree with no licence beside it is the one state
  // that is worse than fetching it.
  const directories = new Set(
    fontSources.map(({ dir, url }) => dirname(resolve(dir, url.replace(/[?#].*$/, '')))),
  );
  for (const directory of directories) {
    const licences = readdirSync(directory).filter((entry) => /licen[cs]e|ofl/i.test(entry));
    expect(licences, `${directory} ships a font and no licence beside it`).not.toEqual([]);
  }
});

test('the gate imports no external font (no CDN, no @import)', () => {
  noneMatch(/fonts\.googleapis|fonts\.gstatic/i, 'fetches a font from a CDN');
  const importing = stylesheets.filter((s) => /@import/i.test(s.source)).map((s) => s.name);
  expect(importing, 'a stylesheet pulls another one in, which is where a font rule hides').toEqual(
    [],
  );
});

test('⛔ ANTI-VACUUM for the two rules above — they are held against a face that IS declared', () => {
  // Both rules iterate `fontSources`. With none found they assert over an empty list and pass on silence,
  // which is exactly the state the block was in before the serif arrived — and the state a deleted
  // `@font-face` would silently return it to. The design gives the second tenant's card a serif, so there is
  // one to find; if that ever stops being true this line is the accusation, not a quiet green.
  expect(
    fontSources.map((f) => `${f.where}: ${f.url}`),
    'no @font-face anywhere in the block: the self-hosting rules above assert nothing',
  ).not.toEqual([]);
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

test('the gate sets no font-family that needs a face nobody has', () => {
  // Geigyll — the design's dropped display face — must not appear at all, generic tail or no generic tail.
  noneMatch(/geigyll/i, "names the design's dropped display face");
  // ⚠️ THE `font-family` INSIDE AN `@font-face` IS NOT A USE, IT IS THE NAME OF THE FACE BEING DEFINED, and a
  // generic tail there would be meaningless — `@font-face { font-family: "Fraunces", serif }` names nothing.
  // The rule is about what TEXT is asked to render in, so the definitions are cut out before the scan; the
  // rules above are what judge those, by the file they point at.
  const declarations = stylesheets.flatMap((sheet) =>
    (sheet.source.replace(/@font-face\s*\{[^}]*\}/gi, '').match(/font-family:[^;]+/gi) ?? []).map(
      (decl) => ({ where: sheet.name, decl: decl.toLowerCase() }),
    ),
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
