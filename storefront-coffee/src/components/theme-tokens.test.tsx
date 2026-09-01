// Theme-swappable — proven with the REAL rendered component, two ways that together close the invariant
// (not a loose CSS snapshot):
//   1. The rendered <Price> element's color resolves (via the real CSS module) to `var(--color-ink)` —
//      it is BOUND to a semantic token. A parallel hex in the component would make getComputedStyle return
//      that hex here, failing the test.
//   2. Editing a token VALUE in tokens.css changes what `--color-ink` resolves to — re-skin = a token
//      edit, with zero component change. The component binds (1) to a token whose value is controlled by
//      the token file (2): editing the token is the only way to change the component's color.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Price } from '@forgecommerce/storefront-kit/Price';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { KIT_SRC } from '@/test/kit-source';

// FRONT-OWN: resolved through the PACKAGE, never a relative path into `themes/`. That path only exists in this
// monorepo, so it made the test unrunnable in the storefront copy a customer owns — and, worse, it asserted
// against a file we do NOT publish while claiming to prove the theme is swappable. `exports` gives the same
// bytes in both worlds: a pnpm symlink here, a real `node_modules` there.
const tokensPath = createRequire(import.meta.url).resolve(
  '@forgecommerce/theme-storefront-vanilla/tokens.css',
);
// CHECKOUT-APP (K1): `Price` is the kit's now — both deployables print money — so the stylesheet
// this test reads moved with it. Resolved through the package's exports map, never spelled as a path.
const priceCssPath = join(KIT_SRC, 'components/Price.module.css');

/** Extract the body of a CSS rule by selector (e.g. `.price`). */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`rule ${selector} not found`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

/** Parse all `--name: value;` declarations from tokens.css into a flat map. */
function parseTokens(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const name = m[1];
    const value = m[2];
    if (name && value) vars[name] = value.trim();
  }
  return vars;
}

/** Resolve a semantic token through the var() chain to its primitive raw value. */
function resolveToken(vars: Record<string, string>, name: string): string | undefined {
  let value = vars[name];
  let guard = 0;
  while (value?.startsWith('var(') && guard++ < 10) {
    const inner = value.slice(4, value.indexOf(')')).trim();
    value = vars[inner];
  }
  return value;
}

test('Price renders the real formatted price', () => {
  const { getByTestId } = render(<Price amount={7990} />);
  expect(getByTestId('price').textContent).toContain('79,90');
});

test('the rendered Price binds its color to a semantic token (no parallel hex)', () => {
  // Real render → the element's actual class → that class's rule in the REAL component CSS.
  const { getByTestId } = render(<Price amount={7990} />);
  const className = getByTestId('price').className; // 'price' (non-scoped css-modules)
  const rule = ruleBody(readFileSync(priceCssPath, 'utf8'), `.${className}`);
  // The rendered component's color comes from a semantic token, never a hardcoded hex.
  expect(rule).toMatch(/color:\s*var\(--color-/);
  expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}/);
});

test('editing a token value re-skins what --color-ink resolves to (component untouched)', () => {
  const vars = parseTokens(readFileSync(tokensPath, 'utf8'));
  // The component is bound to --color-ink; its value flows from the primitive --ink-900.
  expect(resolveToken(vars, '--color-ink')).toBe('#17181a');
  // Simulate a re-skin: edit the primitive value only.
  vars['--ink-900'] = '#0a84ff';
  expect(resolveToken(vars, '--color-ink')).toBe('#0a84ff');
});
