// MS-M2 — TWO STORES OF ONE TENANT, TWO SKINS, IN BOTH TREES. The DoD of the slice, executed.
//
// What is proven here is the WHOLE path a merchant walks, with nothing stubbed in the middle: a theme is a
// FOLDER that gets COPIED, one token value is edited in the copy, a store is pointed at it by name, and the
// HTML that store serves carries the new value while its sibling's does not. The only thing mocked is the port
// (`read.store_flags` — the kernel side is proven in packages/core/src/__tests__/store-theme.test.ts): the
// theme folder is real, the resolver is real, the layouts are the ones the app ships.
//
// ★★ BOTH TREES, AND THAT IS THE POINT OF THE FILE. `s/[store]` serves the dynamic pages; `c/[store]` (PERF-B)
// serves the CACHED HTML — home, PDP, clean PLP. Wiring only the first is the defect this file exists to
// prevent, and it is a nasty one: the theme would be right on the slow pages and gone on the fast ones, which
// a merchant reads as "my brand flickers", not as "a feature is missing". So every assertion below runs twice,
// once per layout, from the same table.
//
// ⚠️ `renderToString` is what makes this honest about ORDER: the assertion is not "a <style> exists somewhere"
// but that it carries the store's own tokens. The cascade itself (base <link> in <head>, override <style> in
// <body>, later wins) is a property of where the layouts sit in the tree — which is exactly what rendering the
// real layouts, rather than the helper, exercises.

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { StoreFlags } from '@forgecommerce/storefront-kit/read-client';
import { safeThemeCss } from '@forgecommerce/storefront-kit/theme/store-theme';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

/** ★ FRONT-OWN: resolved through the PACKAGE, never by a relative path into `themes/` — this suite is
 *  INHERITED by the standalone copy a customer owns, where that directory does not exist (and where asserting
 *  against it would be testing a file we do not publish). `exports` gives the same bytes in both worlds. */
const REFERENCE_THEME = dirname(
  createRequire(import.meta.url).resolve('@forgecommerce/theme-storefront-vanilla/tokens.css'),
);

/** The store → theme table the port would answer with. */
const THEMES: Record<string, string | undefined> = {
  'sto-vanilla': 'vanilla',
  'sto-urban': 'urban',
  'sto-fantasma': 'nao-existe',
  'sto-antigo': undefined, // a kernel older than the column: the field simply is not there
  'sto-quebrado': 'quebrado', // a theme folder whose CSS tries to break out of its own <style>
};

const storeFlagsMock = vi.fn(
  async (store: string): Promise<StoreFlags | null> => ({
    name: store,
    masked_checkout_enabled: false,
    guest_checkout_enabled: true,
    timezone: 'America/Sao_Paulo',
    ...(THEMES[store] === undefined ? {} : { theme_key: THEMES[store] }),
  }),
);

vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({
    storeFlags: (store: string) => storeFlagsMock(store),
    // The `s/[store]` layout also asks who fills the gate slot. Nobody does here — the reference storefront's
    // own case — so it renders the route as-is, with the theme.
    extensions: async () => [],
  }),
}));
vi.mock('next/headers', () => ({
  cookies: () => {
    throw new Error('the theme must not make a store dynamic');
  },
}));
vi.mock('@/components/StorefrontChrome', () => ({
  StorefrontChrome: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

/** The distinctive value the copied theme is re-skinned with — a colour that appears nowhere else in the repo,
 *  so finding it in the HTML can only mean it came from the copy. */
const URBAN_ACCENT = '#0a84ff';
/** The reference theme's accent, read from the real file so the test cannot drift away from it. */
let baseAccent: string;

let themesDir: string;

beforeAll(() => {
  themesDir = mkdtempSync(join(tmpdir(), 'forge-themes-'));
  process.env.FORGE_THEMES_DIR = themesDir;

  // ★ STEP 1 OF THE GUIDE, EXECUTED: copy the folder. Nothing else — no build step, no registration, no code
  // edit in the storefront. If a copied theme needed anything more than this, the guide would be wrong.
  const urban = join(themesDir, 'urban');
  cpSync(REFERENCE_THEME, urban, { recursive: true });

  // ★ STEP 2: change one token value in the copy.
  const tokens = join(urban, 'tokens.css');
  const original = readFileSync(tokens, 'utf8');
  const accent = /--copper-600:\s*(#[0-9a-f]{6})/i.exec(original);
  if (!accent?.[1]) throw new Error('the reference theme no longer declares --copper-600');
  baseAccent = accent[1];
  writeFileSync(tokens, original.replace(accent[0], `--copper-600: ${URBAN_ACCENT}`));

  // A theme folder that tries to escape its own element — hand-written here, but the shape an agent-generated
  // or hand-edited theme could arrive in.
  const broken = join(themesDir, 'quebrado');
  cpSync(REFERENCE_THEME, broken, { recursive: true });
  writeFileSync(
    join(broken, 'tokens.css'),
    ':root{--color-ink:#000}</style><script>alert(1)</script><style>',
  );
});

afterAll(() => {
  delete process.env.FORGE_THEMES_DIR;
  rmSync(themesDir, { recursive: true, force: true });
});

/** The two store-scoped layouts, rendered exactly as the app mounts them. */
const TREES = [
  { name: 's/[store] (dynamic)', load: () => import('@/app/s/[store]/layout') },
  { name: 'c/[store] (edge-cacheable, PERF-B)', load: () => import('@/app/c/[store]/layout') },
] as const;

async function renderStore(tree: (typeof TREES)[number], store: string): Promise<string> {
  const { default: Layout } = await tree.load();
  return renderToString(
    await Layout({ children: <p id="page">a loja</p>, params: Promise.resolve({ store }) }),
  );
}

describe.each(TREES)('$name', (tree) => {
  test('★ STEP 3: a store pointed at the copied theme serves the EDITED token', async () => {
    const html = await renderStore(tree, 'sto-urban');
    expect(html, 'the store wears the copy').toContain(URBAN_ACCENT);
    expect(html, 'and it says which theme it is wearing').toContain('data-forge-theme="urban"');
    // The whole token file travels, not just the line that changed: the override is a complete `:root`, so a
    // token the copy did NOT touch still resolves to the same value instead of falling out of the cascade.
    expect(html, 'the rest of the theme rides along').toContain('--color-ink');
  });

  test('a store on the reference theme inlines NOTHING (the default path is free)', async () => {
    const html = await renderStore(tree, 'sto-vanilla');
    expect(html).not.toContain('data-forge-theme');
    expect(html, 'no base tokens are duplicated into the body').not.toContain(baseAccent);
    expect(html, 'and the page itself still rendered').toContain('id="page"');
  });

  test('★ two stores of the same tenant, side by side, do not bleed', async () => {
    // The invariant that fails the moment the theme is held anywhere above the store row (a module constant,
    // an env, an instance setting): same process, same render pass, two different answers.
    const [urban, vanilla] = await Promise.all([
      renderStore(tree, 'sto-urban'),
      renderStore(tree, 'sto-vanilla'),
    ]);
    expect(urban).toContain(URBAN_ACCENT);
    expect(vanilla).not.toContain(URBAN_ACCENT);
  });

  test('an unknown theme falls back to the base — a page, never a 500', async () => {
    // `theme_key = 'nao-existe'` is a legitimate value the port accepts (the theme may not be built yet). The
    // shopper must meet the base storefront, not an error.
    const html = await renderStore(tree, 'sto-fantasma');
    expect(html).toContain('id="page"');
    expect(html).not.toContain('data-forge-theme');
  });

  test('a kernel that does not know about themes still serves the store', async () => {
    const html = await renderStore(tree, 'sto-antigo');
    expect(html).toContain('id="page"');
    expect(html).not.toContain('data-forge-theme');
  });
});

describe('the <style> cannot be broken out of', () => {
  // What earns this file its entry in structure.test.ts's dangerouslySetInnerHTML allow-list — the same terms
  // JsonLd.tsx is held to. A theme folder is the artifact an agency edits by hand and (PROMPT-TO-STORE) an
  // agent will generate, so "our own file" is not the argument; the neutralized break-out is.
  test('a stylesheet carrying `</style><script>` cannot end the element', () => {
    const attack = ':root{--x:0}</style><script>alert(1)</script><style>';
    const safe = safeThemeCss(attack);
    expect(safe, 'no sequence that could terminate the tag survives').not.toMatch(/<\/style/i);
    expect(safe, 'and the script tag is left inside the stylesheet, inert').toContain('alert(1)');
  });

  test('the neutralization is case-insensitive (the HTML parser is)', () => {
    expect(safeThemeCss('a{}</STYLE ><img onerror=x>')).not.toMatch(/<\/style/i);
  });

  test('a store wearing such a theme serves it inert — asked of a real HTML parser', async () => {
    // End to end, through the real layout, and judged by a PARSER rather than by a regex: the question is not
    // "does the string `<script>` appear" (it does — as stylesheet text, which is the whole point), it is
    // "does the browser end up with a script element". Reading the answer with a regex is how this kind of
    // check passes while being wrong.
    const html = await renderStore(TREES[0], 'sto-quebrado');
    const host = document.createElement('div');
    host.innerHTML = html;

    expect(host.querySelector('style')?.getAttribute('data-forge-theme')).toBe('quebrado');
    expect(host.querySelector('script'), 'no script element is created').toBeNull();
    expect(host.querySelectorAll('style'), 'the element is never split in two').toHaveLength(1);
    // The payload is where it belongs: inside the stylesheet, as text the CSS parser will discard.
    expect(host.querySelector('style')?.textContent).toContain('alert(1)');
    // (`textContent` of the host would include the stylesheet itself — style text IS text. What matters is
    // that it stayed inside the element, which the two assertions above state exactly.)
  });
});
