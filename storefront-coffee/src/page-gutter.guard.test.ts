// ★ pk31 §9 — THE TOP BAR LINES UP WITH THE SITE, AND IT IS ONE VALUE THAT SAYS SO.
//
// Renan, 11/09: *"esse eh bobo, mas quero alinhar a barra de cima a largura do site."* He was right, and the
// measurement says where: the box was never the problem — every centred column in this shop is the same
// 1240px — the SIDE INSET was. Measured on the cut before this guard:
//
//   .headerInner  padding: 6px clamp(14px, 3vw, 32px)      ← the top bar
//   nine bands    padding:  …   clamp(18px, 4vw, 32px)     ← every other page edge, footer included
//
// Floor 14 vs 18 is 4px out on a phone; 3vw vs 4vw GROWS with the window (7px at 700px) and only converges
// above ~1070px, where both clamps hit their 32px ceiling. One outlier out of ten, so the defect had exactly
// one exemplar — and the fix is one source rather than a tenth literal.
//
// ── WHY THIS FILE IS NOT A STRING COMPARISON ──────────────────────────────────────────────────────────────
//
// ⚠️ A test that asserts two stylesheets spell the same characters proves the two texts match and stays green
// with both of them wrong. So this grades the CLAIM — *the top bar's side inset is the side inset of the page
// content* — by DERIVING both numbers from the source and resolving them, and it discovers the list of page
// edges instead of carrying one. Editing either side alone turns it red NAMING the rule that drifted.
//
// ⚠️⚠️ AND IT PROVES THE TOKENS EXIST. CSS has no such thing as an undefined-variable error: `var(--typo)`
// is dropped in silence and every assertion about the text that referenced it still passes. So the token
// table is built from the stylesheets this app actually loads — the vanilla theme package imported by
// `app/layout.tsx`, plus `styles/globals.css` on top of it — and a reference with no declaration is the
// loudest failure here.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const src = dirname(fileURLToPath(import.meta.url));

/** The stylesheets that dress the café: the chrome, and the two page templates. */
const SHEETS = {
  chrome: join(src, 'components/coffee/CoffeeChrome.module.css'),
  home: join(src, 'templates/home/coffee.module.css'),
  pdp: join(src, 'templates/pdp/coffee.module.css'),
} as const;

/**
 * The cascade this app really builds, in load order — `app/layout.tsx` imports the theme package and then
 * `styles/globals.css`. Resolved through the package's `exports` map and never as a relative path into a
 * `themes/` folder, the way `components/theme-tokens.test.tsx` does it: the same bytes in this repository and
 * in a checkout that installed the tarball.
 */
const TOKEN_SHEETS = [
  createRequire(import.meta.url).resolve('@forgecommerce/theme-storefront-vanilla/tokens.css'),
  join(src, 'styles/globals.css'),
];

/** Every `--name: value` declaration in load order — later wins, which is what the browser does. */
function tokenTable(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const file of TOKEN_SHEETS) {
    for (const m of readFileSync(file, 'utf8').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const [, name, value] = m;
      if (name && value) vars[name] = value.trim();
    }
  }
  return vars;
}

/** Split a shorthand on top-level whitespace, so `clamp(18px, 4vw, 32px)` stays one value. */
function shorthand(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0 && /\s/.test(ch)) {
      if (current) out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

/** The INLINE (left/right) component of a padding shorthand — 1 value means all four sides. */
function inlineSide(padding: string): string {
  const parts = shorthand(padding.trim());
  const side = parts.length === 1 ? parts[0] : parts[1];
  if (!side) throw new Error(`padding shorthand with no inline component: ${padding}`);
  return side;
}

type Rule = { selector: string; body: string };

/** The rules of a stylesheet, in source order. Only class rules matter here. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  for (const m of css.matchAll(/(\.[\w-]+[^{}]*?)\{([^{}]*)\}/g)) {
    const [, selector, body] = m;
    if (selector && body !== undefined) out.push({ selector: selector.trim(), body });
  }
  return out;
}

function declaration(body: string, property: string): string | undefined {
  const found = body.match(new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;]+)`));
  return found?.[1]?.trim();
}

/**
 * Substitute every `var(--x)` for what the cascade declares, and THROW when nothing declares it — the whole
 * point of this file. No fallback form is accepted: `var(--x, 18px)` would make an undeclared token look
 * deliberate, which is exactly the silence being guarded against.
 */
function resolve(value: string, vars: Record<string, string>, where: string): string {
  let out = value;
  for (let pass = 0; pass < 10 && out.includes('var('); pass += 1) {
    out = out.replace(/var\((--[\w-]+)\)/g, (_whole, name: string) => {
      const declared = vars[name];
      if (declared === undefined) {
        throw new Error(
          `${where} references ${name}, which NOTHING in the cascade declares. CSS drops an undefined ` +
            `custom property in silence, so this would ship as no value at all while every text assertion ` +
            `about it stayed green. Declare it in styles/globals.css or stop referencing it.`,
        );
      }
      return declared;
    });
  }
  return out.trim();
}

/**
 * The page edges of one stylesheet, discovered rather than listed.
 *
 * A centred column of this shop is a rule that caps itself at the site width and centres — `max-width:
 * var(--size-container); margin: 0 auto`. That rule IS "the width of the site", so the inset that has to
 * match is the one the column sits inside: its own inline padding when it carries one (the header bar does),
 * otherwise the inline padding of the nearest preceding rule that has one (the full-bleed band around it).
 * Nothing here is spelled as a selector, so a new band or a renamed one joins the guard by existing.
 */
function pageEdges(file: string, vars: Record<string, string>): Map<string, string> {
  const all = rules(readFileSync(file, 'utf8'));
  const found = new Map<string, string>();
  all.forEach((rule, index) => {
    const width = declaration(rule.body, 'max-width');
    if (width !== 'var(--size-container)') return;
    if (declaration(rule.body, 'margin') !== '0 auto') return;
    for (let at = index; at >= 0; at -= 1) {
      const padding = declaration(all[at]?.body ?? '', 'padding');
      if (!padding) continue;
      const via =
        at === index ? rule.selector : `${rule.selector} (inset from ${all[at]?.selector})`;
      found.set(via, resolve(inlineSide(padding), vars, `${file} ${all[at]?.selector}`));
      return;
    }
    throw new Error(
      `${file} ${rule.selector} is a centred column with no page inset anywhere above it`,
    );
  });
  return found;
}

test('★★ the site width is a DECLARED token, and it is the 1240px the café used to spell by hand', () => {
  const vars = tokenTable();
  // The substitution this slice made — six literal `1240px` became `var(--size-container)` — only holds if
  // the token exists AND carries that number. A token worth another width would have moved the whole layout
  // in silence; one nobody declares would have removed the cap altogether.
  expect(
    resolve('var(--size-container)', vars, 'the site width'),
    'the café is drawn at 1240px; a different value here moves every centred column in the shop',
  ).toBe('1240px');
});

test('★ the top bar’s side inset is the side inset of the page content', () => {
  const vars = tokenTable();
  const insets = new Map<string, string>();
  for (const [name, file] of Object.entries(SHEETS)) {
    for (const [rule, inset] of pageEdges(file, vars)) insets.set(`${name}: ${rule}`, inset);
  }

  // Anti-vacuum: a scan that found nothing would agree with itself. Every one of the three stylesheets has to
  // have contributed, and the chrome's sticky bar — the thing he asked about — has to be among them.
  for (const sheet of Object.keys(SHEETS)) {
    expect(
      [...insets.keys()].some((key) => key.startsWith(`${sheet}:`)),
      `found no centred column in the ${sheet} stylesheet — this guard went blind, it did not pass`,
    ).toBe(true);
  }
  expect(
    [...insets.keys()].some((key) => key.includes('headerInner')),
    'the header bar is not in the scan, so this says nothing about the thing it claims to grade',
  ).toBe(true);

  const distinct = [...new Set(insets.values())];
  expect(
    distinct,
    `the page edges of this shop disagree:\n${[...insets]
      .map(([rule, inset]) => `  ${rule.padEnd(52)} ${inset}`)
      .join('\n')}`,
  ).toHaveLength(1);
});

test('★ and that inset has ONE spelling — no literal copy of it anywhere in the café', () => {
  const vars = tokenTable();
  const gutter = resolve('var(--space-page-gutter)', vars, 'the page gutter');
  let references = 0;
  for (const file of Object.values(SHEETS)) {
    const css = readFileSync(file, 'utf8');
    references += [...css.matchAll(/var\(--space-page-gutter\)/g)].length;
    // The literal the token replaced must not come back beside it: two spellings of one value is how the
    // header drifted 4px from the rest of the shop in the first place.
    const offenders = rules(css)
      .filter((rule) => {
        const padding = declaration(rule.body, 'padding');
        return padding !== undefined && inlineSide(padding) === gutter;
      })
      .map((rule) => rule.selector);
    expect(
      offenders,
      `${file} writes the page gutter (${gutter}) as a literal. It has a name — var(--space-page-gutter).`,
    ).toEqual([]);
  }
  // Anti-vacuum again: the rule above is satisfied by a stylesheet that uses the gutter nowhere at all.
  expect(
    references,
    'no stylesheet references the page gutter token, so nothing above was tested',
  ).toBeGreaterThan(0);
});
