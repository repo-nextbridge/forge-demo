// ⛔⛔ THE TEST THAT WAS MISSING, AND THE DEFECT IT WOULD HAVE CAUGHT.
//
// The v2 screen shipped its art as a path built at render time — `` `./art/card-${face.store ?? 'store'}.webp` ``
// — and every test in this app stayed green while two things were wrong at once: the bundler never emitted a
// single one of the six files (a template literal is text, not an import), and two of the four cards named a
// file that does not exist, because the store handles are `forge|outlet|cafe|balcao` and the art is named for
// what each shop IS — `store|outlet|cafe|totem`. Measured by grepping the baked `.next` of all four fronts:
// zero art in all four.
//
// ★ SO THE RULE HERE IS THE ONE THE OLD SHAPE COULD NOT HAVE: the relationship between a face and its picture
// is DECLARED (`./art.ts`), and it is held against the box's own declaration IN BOTH DIRECTIONS. A face the
// box publishes with no art is red BY NAME; art left behind by a face that went away is red BY NAME. Neither
// is a thing a reader would notice, and both are a thing a bake happily ships.
//
// ⚠️ AND THE FILE IS ASSERTED TO BE ON DISK, not merely named in the map. The import is what makes the
// bundler emit the asset, and an import of a missing file is a BUILD error rather than a test failure — which
// sounds like enough until you remember where that build runs: inside the oven, minutes in, on a machine
// nobody is watching. This suite is the loop everybody already runs.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { GATE_TENANTS } from '../faces.generated';
import { ADMIN_ART, CARD_ART } from './art';

const shops = GATE_TENANTS.flatMap((t) => t.faces.filter((f) => f.kind === 'shop'));
const ART_DIR = join(__dirname, 'art');

test('★★★ every SHOP the box declares has a picture, and no picture outlives its shop', () => {
  const declared = shops.map((f) => f.key).sort();
  expect(
    declared.filter((key) => !CARD_ART[key]),
    'a shop this box publishes has no art: its card draws a blank where the design puts the photograph',
  ).toEqual([]);
  expect(
    Object.keys(CARD_ART).filter((key) => !declared.includes(key)).sort(),
    'art is declared for a face this box does not publish — a picture nothing draws, carried into every image',
  ).toEqual([]);
});

test('★★★ every TENANT has its admin screenshot, and no screenshot outlives its tenant', () => {
  const ids = GATE_TENANTS.map((t) => t.id).sort();
  expect(
    ids.filter((id) => !ADMIN_ART[id]),
    'a tenant has no screenshot: its admin window draws an empty screen',
  ).toEqual([]);
  expect(
    Object.keys(ADMIN_ART).filter((id) => !ids.includes(id)).sort(),
    'a screenshot is declared for a tenant this box does not have',
  ).toEqual([]);
});

test('⛔ every picture the map names is a FILE IN THIS TREE — the import is a promise the disk keeps', () => {
  // The values are what the bundler produced, so in this environment `.src` is the module path rather than the
  // emitted URL. What is asserted is therefore the FILE, by the name the import used — which is the thing that
  // was wrong before (`card-forge.webp`, `card-balcao.webp`: neither has ever existed).
  const named = [
    ...Object.entries(CARD_ART).map(([key, a]) => [key, a] as const),
    ...Object.entries(ADMIN_ART).map(([key, a]) => [key, a] as const),
  ];
  const missing = named
    .map(([key, a]) => [key, (a.src ?? '').split('/').pop() ?? ''] as const)
    .filter(([, file]) => file !== '' && !existsSync(join(ART_DIR, file)))
    .map(([key, file]) => `${key} → block/art/${file}`);
  expect(missing, 'the map names a picture that is not in block/art/').toEqual([]);
});

test('⛔ ANTI-VACUUM — the two maps are not empty, and the box really declares faces to hold them against', () => {
  // Every assertion above is satisfied by two empty maps and a box with no faces. That is not a hypothetical
  // state: `faces.generated.ts` is GENERATED, and a generator that produced an empty declaration would turn
  // this whole file green while the screen drew nothing at all.
  expect(shops.length, 'the box declares no shop — every rule above compared two empty lists').toBeGreaterThan(1);
  expect(GATE_TENANTS.length, 'the box declares no tenant').toBeGreaterThan(1);
  expect(Object.keys(CARD_ART).length, 'no card art is declared').toBeGreaterThan(1);
  expect(Object.keys(ADMIN_ART).length, 'no admin art is declared').toBeGreaterThan(1);
});

// ── ⟂ THE PICTURE HAS TO KEEP THE SHAPE THE DESIGN GAVE IT (2026-09-18) ────────────────────────────────────
//
// ⛔ WHAT BOUGHT THIS, and it reached production. Making the art an `import` (the slice above) also put
// `width`/`height` attributes on the `<img>` — the bundler's intrinsic size, which is what stops the card
// reflowing when the photograph arrives. Those attributes are PRESENTATIONAL HINTS: `height` lands as a
// specified `height: 900px`, and `aspect-ratio` computes a dimension only when the OTHER one is `auto`. So
// the `aspect-ratio: 1 / 1` in the stylesheet was silently ignored and every card drew 100% wide by 900px
// tall — a stretched photograph in a card the design gives a square, seen on the deployed box before any test
// had anything to say about it.
//
// ⚠️ AND NO TEST IN THIS APP COULD HAVE SEEN IT. The suite asserts copy against the artboard and destinations
// against the declaration — both true the whole time. Nothing asserted SHAPE, because shape lives in CSS and
// CSS is where this house had no rule. This is that rule, and it is narrow on purpose: it does not try to
// judge a design, it holds ONE invariant that the markup and the stylesheet have to agree on.

import { readFileSync as readCss } from 'node:fs';

/** Every class this component renders with an intrinsic `height` attribute on it. Derived from the component,
 *  never typed: an `<img>` added tomorrow with the same shape is in scope by existing. */
function classesWithIntrinsicHeight(): string[] {
  const tsx = readCss(join(__dirname, 'gate.tsx'), 'utf8');
  const found = new Set<string>();
  for (const tag of tsx.match(/<img[^>]*>/g) ?? []) {
    if (!/height=\{/.test(tag)) continue;
    const cls = tag.match(/className=\{styles\.(\w+)\}/)?.[1];
    if (cls) found.add(cls);
  }
  return [...found].sort();
}

/** ⛔⛔ CSS WITH THE COMMENTS TAKEN OUT, and this is not tidiness — the first version of the rule below was
 *  GREEN AGAINST THE VERY DEFECT IT DESCRIBES. The comment explaining why `height: auto` is load-bearing
 *  contains the string `height: auto`, so the declaration could be deleted and the prose alone satisfied the
 *  match. Measured 2026-09-18 by sabotage: the stylesheet was broken on purpose and the test passed.
 *
 *  It is the third time in one day that a rule in this house was satisfied by text ABOUT the rule (the
 *  owner-voice guard and the recorder guard were the other two). A rule that reads source has to read CODE. */
const codeOf = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('★★★ a picture with an intrinsic HEIGHT also declares `height: auto` — or `aspect-ratio` is dead letter', () => {
  const css = codeOf(readCss(join(__dirname, 'gate.module.css'), 'utf8'));
  const guilty: string[] = [];
  for (const cls of classesWithIntrinsicHeight()) {
    const rule = css.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    const hasRatio = /aspect-ratio\s*:/.test(rule);
    const hasAuto = /height\s*:\s*auto/.test(rule);
    if (hasRatio && !hasAuto) guilty.push(cls);
  }
  expect(
    guilty,
    'this class sets `aspect-ratio` and the component gives its <img> a `height` attribute, which wins as a ' +
      'presentational hint — the ratio never applies and the picture draws at its full intrinsic height. ' +
      'Add `height: auto` to the rule. (Measured in production 2026-09-18.)',
  ).toEqual([]);
});

test('⛔ ANTI-VACUUM — there really ARE pictures carrying an intrinsic height to judge', () => {
  // The rule above passes perfectly against a component with no <img> at all, which is the state a refactor
  // could produce while the cards still draw through some other element.
  expect(
    classesWithIntrinsicHeight().length,
    'no <img> in gate.tsx carries a height attribute — either the art stopped being imported, or the rule ' +
      'above is now judging nothing',
  ).toBeGreaterThan(1);
});
