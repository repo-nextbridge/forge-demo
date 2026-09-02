// ★★ WHAT THE OUTLET'S THEME PROMISES THE OUTLET, GRADED BY RESOLVING IT RATHER THAN BY READING IT.
//
// A theme in this product is a `tokens.css` and nothing else — an OVERRIDE loaded after the reference file,
// carrying only what differs. That shape has one failure mode and this file exists for it: a token the theme
// FORGOT is not an error anywhere. The declaration simply is not there, the base's value answers, and the
// store renders — correctly, in the wrong colour, with nothing red and nothing logged. Both findings below
// are exactly that, reported by a human looking at a screen weeks later:
//
//   A42 #1 — the PDP's buy bar is `background: var(--color-primary)` and fades to `var(--color-accent)` on
//            hover. The reference defines `--color-primary: var(--ink-900)` — DARK. The outlet re-points
//            `--copper-600` and stopped there, so the button was ink at rest and carmine only under the
//            pointer. Reported as "the button is only sometimes pink".
//   A37 #3 — the announcement strip paints `var(--color-ink)`, which this theme must NOT re-point (ink is
//            the text of the whole store). So the app names a token of its OWN,
//            `--ext-banners-announcement-surface`, and the theme dresses it.
//
// ★ SO THE ASSERTION IS THE RESOLVED VALUE, NOT THE SPELLING. `--color-primary: var(--copper-600)` and
// `--color-primary: #be123c` are the same promise and either may be written; `--color-primary:
// var(--color-primary-outlet)` with no such token is a promise that silently is not kept, and only following
// the chain tells those apart. The chain is followed INSIDE THIS FILE on purpose: a var this theme does not
// define is, by construction, one the base answers — which is the very fall-through being guarded against.
//
//   node --test bin/theme-tokens.guard.mjs        (or: bash bin/test.sh)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THEME = join(ROOT, 'themes/outlet/tokens.css');

/** The `:root` custom properties of a stylesheet, as a name→value map. Comments are stripped FIRST: this
 *  file's prose spells several of the tokens it documents, and a parser that read the sentences would grade
 *  the commentary. */
function customProperties(path) {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
    out[name] = value.trim();
  }
  return out;
}

/** Follow `var(--a)` → `var(--b)` → a literal, within one map. Returns the literal, or `null` when the chain
 *  leaves this file — which is precisely the fall-through to the base theme this guard is about. */
function resolve(map, name, seen = new Set()) {
  if (seen.has(name)) return null; // a cycle: CSS discards BOTH declarations, so it is not a value either
  seen.add(name);
  const value = map[name];
  if (value === undefined) return null;
  const alias = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return alias ? resolve(map, alias[1], seen) : value;
}

const theme = customProperties(THEME);

test('★ the guard parsed a real theme (an empty map would make every check below vacuous)', () => {
  assert.ok(
    Object.keys(theme).length >= 5,
    `themes/outlet/tokens.css parsed to ${Object.keys(theme).length} declaration(s). ` +
      'This guard is reading the wrong thing — re-read it before believing anything it says.',
  );
  // The accent primitive is what the whole theme hangs off; without it the two checks below are trivially
  // satisfiable by pointing everything at nothing.
  assert.match(
    resolve(theme, '--copper-600') ?? '',
    /^#[0-9a-fA-F]{6}$/,
    '--copper-600 does not resolve to a literal colour inside this theme.',
  );
});

test('★★ A42 #1 — the buy button is the theme\'s accent AT REST, not only on hover', () => {
  const primary = resolve(theme, '--color-primary');
  const accent = resolve(theme, '--copper-600');
  assert.ok(
    primary !== null,
    '`--color-primary` is not defined by themes/outlet/tokens.css (or its chain leaves the file).\n' +
      '  The reference theme then answers with `var(--ink-900)` and the outlet\'s PDP buy bar renders DARK,\n' +
      '  turning carmine only under the pointer. That is the defect, and nothing goes red when it returns:\n' +
      '  a missing override is a theme falling back, never an error.',
  );
  assert.equal(
    primary,
    accent,
    `\`--color-primary\` resolves to ${primary}, and the theme's accent is ${accent}. The outlet's CTA is ` +
      'supposed to be the shop\'s own colour at rest.',
  );
});

test('★★ A37 #3 — the announcement strip has a token of its own, and the theme dresses it', () => {
  const NAME = '--ext-banners-announcement-surface';
  const surface = resolve(theme, NAME);
  assert.ok(
    surface !== null,
    `${NAME} is not defined by themes/outlet/tokens.css.\n` +
      '  Undefined, the `banners` app\'s fallback (`var(--color-ink)`) answers and the strip renders DARK\n' +
      '  while the artboard shows it carmine. The theme may NOT fix that by re-pointing --color-ink: ink is\n' +
      '  the text colour of the entire store.',
  );
  assert.equal(
    surface,
    resolve(theme, '--copper-600'),
    'the strip is dressed in something that is not this theme\'s accent.',
  );
});

test('★ the extension token is NAMESPACED — a bare name here would be a theme writing product vocabulary', () => {
  const ext = Object.keys(theme).filter((name) => name.startsWith('--ext-'));
  assert.ok(ext.length > 0, 'no --ext-* token at all; the check above should have caught this first.');
  for (const name of ext) {
    // `--ext-<app>-<thing>`: the app that READS it is in the name, which is the whole reason a theme is
    // allowed to define it. A token called `--announcement-surface` would be the theme inventing a word the
    // product has to honour forever.
    assert.match(
      name,
      /^--ext-[a-z0-9]+(-[a-z0-9]+)+$/,
      `${name} is not shaped --ext-<app>-<thing>. A theme may dress an app's own token; it may not mint one ` +
        'in the product\'s namespace.',
    );
  }
});

// ── A43 #2 · THE COFFEE HERO'S PHOTO ──────────────────────────────────────────────────────────────────────
// A different shop and a different file, and it is here because it is the same KIND of fact: a number in a
// stylesheet that nothing else in the repository knows the reason for.
test('★ A43 #2 — the coffee hero\'s shot leaves the headline room to hold two lines', () => {
  const css = readFileSync(join(ROOT, 'storefront-coffee/src/templates/home/coffee.module.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = css.match(/(^|[};\s])\.heroShotImg\s*\{([^}]*)\}/);
  assert.ok(rule, 'no .heroShotImg rule — this guard is arguing about a class that moved.');
  const width = (rule[2].match(/max-width\s*:\s*(\d+)px/) ?? [])[1];
  assert.ok(width, `.heroShotImg declares no px max-width; it reads: ${rule[2].trim()}`);
  assert.ok(
    Number(width) <= 430,
    `.heroShotImg is ${width}px wide. Its container is \`flex: 1.7 1 340px\`, so the shot and the copy column ` +
      'share the hero\'s width — at 520px the headline was squeezed into a body that re-wrapped its second ' +
      'line, and the two-line hero rendered as three. Widening this undoes the copy fix next door.',
  );
});
