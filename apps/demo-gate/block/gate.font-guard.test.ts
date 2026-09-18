// Font guard (DEMO-GATE DoD #5) — WHAT THE GATE IS ALLOWED TO SET TEXT IN.
//
// ★★★ pk38/d7 — THE RULE CHANGED, DELIBERATELY AND IN ONE DIRECTION, AND THIS PARAGRAPH IS THE CHANGE.
//
// It used to be «no `@font-face` at all», and under it the H1 rode the theme's Urbanist and the design's serif
// simply did not exist here. That was the right rule while the gate's first screen was a hero in one voice.
// It stopped being the right rule when that screen became the 10/09 hub: there the SECOND tenant was a coffee
// brand whose card — its headline and its two wordmarks — was drawn in a serif, and that contrast was the
// card's whole argument. A rule that forbids a font forbids the design. (The artboard that drew it was
// `design-base/gate.dc.html`, deleted with the v2 redesign; `git log` is where it lives now.)
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
// theme — that is the face the hub shipped.
//
// ★★★ GATE-V2 — AND NOW THE APP SHIPS NO FACE AT ALL, WHICH IS NOT A HOLE IN THIS FILE. The v2 artboard sets
// the whole screen in Urbanist, the coffee card included, so the serif left and the two Fraunces files left
// with it. That moves the rule's SUBJECT and nothing else: it used to read «if you declare a face it must be
// one you ship», and this app now declares none. The property the file exists to defend — the first screen
// of this demo does not call a third party — is held MORE strongly by declaring nothing than by declaring a
// local face, because there is no url to get wrong.
//
// ⚠️ WHAT THAT COST, AND WHAT PAYS IT BACK. The two `src` rules iterate the faces found on disk, and with none
// found they assert over an empty list and pass on silence — the exact state a DELETED `@font-face` would
// return them to. The old anti-vacuum answered that by requiring a face to exist, and v2 made that
// requirement false. So it is answered the other way now, by a CONTROL NEGATIVE: the same extractor and the
// same two filters are held against a stylesheet fabricated in the test, carrying the two defects this file
// forbids, and both have to be caught. That proves the rules BITE with the app shipping nothing — which the
// old form could never prove, because it could only ever report that the app still shipped something.
//
// ⚠️ Urbanist itself is not this app's to guard: the gate renders inside the storefront that hosts it, and
// that app self-hosts the face (`storefront-coffee/src/app/fonts/urbanist-latin-*.woff2`). Verified
// 2026-09-17 — the gate names a family and fetches nothing, which is the whole of what is asked of it here.
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

/** Directories a walk must not descend into: they are not this app's source, and `node_modules` in
 *  particular carries thousands of font files belonging to packages nobody here ships. */
const NOT_OURS = new Set(['node_modules', '.next', 'dist', '.turbo', '.git']);

function filesUnder(dir: string, extensions: readonly string[] = SHIPPED): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (NOT_OURS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path, extensions));
    else if (extensions.includes(extname(path).toLowerCase())) found.push(path);
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

type Sheet = { name: string; dir: string; source: string };
type FontSource = { where: string; dir: string; url: string };

/** Every `url(…)` that a `src:` inside an `@font-face` points at, with the stylesheet that wrote it.
 *  ⚠️ A FUNCTION, NOT AN EXPRESSION, so the anti-vacuum below can run the SAME extraction over a sheet it
 *  fabricates. A control negative that re-implements the thing it is checking checks its own copy. */
function facesIn(sheets: readonly Sheet[]): FontSource[] {
  return sheets.flatMap((sheet) =>
    (sheet.source.match(/@font-face\s*\{[^}]*\}/gi) ?? []).flatMap((rule) =>
      (rule.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi) ?? []).map((raw) => ({
        where: sheet.name,
        dir: sheet.dir,
        url: (raw.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i)?.[1] ?? '').trim(),
      })),
    ),
  );
}

/** A `src` that leaves this app: any scheme, protocol-relative, or a data blob. */
const pointingOffTheApp = (sources: readonly FontSource[]): string[] =>
  sources
    .filter(({ url }) => /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith('data:'))
    .map(({ where, url }) => `${where}: ${url}`);

/** A `src` whose file is not on disk beside the stylesheet that named it. */
const namingNothing = (sources: readonly FontSource[]): string[] =>
  sources
    .filter(({ dir, url }) => !existsSync(resolve(dir, url.replace(/[?#].*$/, ''))))
    .map(({ where, url }) => `${where}: ${url}`);

const fontSources = facesIn(stylesheets);

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
  expect(
    pointingOffTheApp(fontSources),
    'a @font-face points off this app: the first screen of the demo would render in the fallback on any ' +
      'network that cannot reach that host, and would call it before the visitor has seen anything of ours',
  ).toEqual([]);

  expect(
    namingNothing(fontSources),
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

test('⛔ ANTI-VACUUM for the two rules above — they are held against a face fabricated HERE', () => {
  // v2 ships no face, so the two rules above iterate an empty list and pass on silence. That is the right
  // state of the app and the wrong state of a test, and the answer is not to demand the app carry a font it
  // does not need: it is to prove the rules still bite. The SAME extractor and the SAME two filters are run
  // over a stylesheet written right here, carrying exactly the two defects this file forbids.
  const planted = [
    {
      name: 'fabricated-by-the-anti-vacuum.css',
      dir: BLOCK,
      source: [
        '@font-face { font-family: Geigyll; src: url(https://fonts.gstatic.com/s/geigyll.woff2); }',
        '@font-face { font-family: Ghost; src: url("./nao-existe-neste-repo.woff2") format("woff2"); }',
      ].join('\n'),
    },
  ];
  const found = facesIn(planted);

  expect(
    found.map((f) => f.url),
    'the extractor did not read two `src` out of two @font-face rules — it has stopped seeing faces at all, ' +
      'and everything it protects would be green by blindness',
  ).toHaveLength(2);
  expect(
    pointingOffTheApp(found),
    'a face on fonts.gstatic was NOT caught: the rule that keeps this screen off somebody else’s server is dead',
  ).toHaveLength(1);
  expect(
    namingNothing(found),
    'a face naming a file that is not in the tree was NOT caught: the rule that keeps a declaration honest is dead',
  ).toHaveLength(2);
});

test('★★★ the app declares NO face and ships NO font file — and those two facts have to agree', () => {
  // ⛔ THIS IS THE STATEMENT OF WHERE v2 STANDS, and it is red from either side. A face appearing with no file
  // beside it is caught by the rules above; a FILE appearing with no face is caught here — and that is the
  // shape of the mistake somebody makes when they bring a font back: drop the woff2 in, wire it later,
  // ship a directory of dead weight in the image. Either way this line stops being true and says so.
  //
  // ⚠️ When a face DOES come back, this test is the one to delete — not the licence rule, not the anti-vacuum.
  expect(
    fontSources.map((f) => `${f.where}: ${f.url}`),
    'this app declares an @font-face again: that is allowed, but then the paragraph at the head of this file ' +
      'and this test are both out of date — the licence rule below applies and this line should go',
  ).toEqual([]);

  const FACE_FILES = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
  const shipped = filesUnder(root, FACE_FILES).map((path) => path.slice(root.length + 1));
  expect(
    shipped,
    'this app ships a font file and declares no @font-face for it — dead weight in the image at best, and at ' +
      'worst half of a face somebody meant to finish wiring',
  ).toEqual([]);
});

/**
 * ★ THE RULE IS «THIS DECLARATION CANNOT NEED A FONT THAT IS NOT ALREADY THERE», not «the word inherit».
 *
 * ⚠️ IT USED TO BE THE WORD, and pk35/d1 met the wall the word built: the hub printed each tenant's
 * admin HOSTNAME in monospace, and `ui-monospace, SFMono-Regular, Menlo,
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
