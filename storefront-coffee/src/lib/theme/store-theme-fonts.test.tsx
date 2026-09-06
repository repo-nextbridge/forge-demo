// ★ D2-E2 — THE VITRINE'S HALF, IN BOTH OF ITS TREES.
//
// The sibling of `apps/checkout/src/lib/theme/store-theme-fonts.test.tsx`, and it exists for the reason MS-M2
// wrote into `c/[store]/layout.tsx`: this deployable serves the same store from TWO trees — `s/…` (dynamic)
// and `c/…` (edge-cacheable, PERF-B) — and a font wired into only one of them would be present on the slow
// pages and absent on the fast ones. A shopper reads that as a brand that flickers, not as a missing feature.
//
// The URL here is the BARE one: the vitrine answers the edge's fall-through, so it has no asset prefix. That
// is the fact its sibling's `/_checkout` is measured against.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { StoreFlags } from '@forgecommerce/storefront-kit/read-client';
import { safeThemeCss } from '@forgecommerce/storefront-kit/theme/store-theme';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

/** `apps/storefront/src`, from this file's own location. */
const APP_SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');

const THEMES: Record<string, string> = { 'sto-cafe': 'cafe', 'sto-cores': 'cores' };

vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({
    storeFlags: async (store: string): Promise<StoreFlags | null> => ({
      name: store,
      masked_checkout_enabled: false,
      guest_checkout_enabled: true,
      timezone: 'America/Sao_Paulo',
      theme_key: THEMES[store],
    }),
    extensions: async () => [],
  }),
}));
vi.mock('next/headers', () => ({
  cookies: () => {
    throw new Error('the theme must not make a store dynamic');
  },
}));
// ★ pk14/D5 — THE CHROME THIS MOCK HAS TO NAME MOVED, and naming the old one would have been a silent pass:
// `vi.mock` of a module nothing imports stubs nothing, so the real chrome would render here and this suite
// would be asserting the theme through a component it never meant to exercise. Both trees mount <CoffeeChrome>
// since the cacheable tree stopped wearing the reference vitrine's header.
vi.mock('@/components/coffee/CoffeeChrome', () => ({
  CoffeeChrome: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const FONT_BYTES = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0xd2, 0xe2, 0xfa, 0xce]);
const FONT_FILE = 'poppins-400-normal.woff2';
/** The face goes in `fonts.css` (hand-written); the token that uses it in `tokens.css` (generated from
 *  `tokens.json`, which is why a hand edit to it would be a red build). */
const CAFE_FACES = `@font-face{font-family:"Poppins";src:url("fonts/${FONT_FILE}") format("woff2")}\n`;
const CAFE_TOKENS = ':root{--font-sans:"Poppins",sans-serif}\n';
const CORES_TOKENS = ':root{--color-ink:#2b1a12}\n';

let themesDir: string;

beforeAll(() => {
  themesDir = mkdtempSync(join(tmpdir(), 'forge-themes-fonts-sf-'));
  process.env.FORGE_THEMES_DIR = themesDir;
  mkdirSync(join(themesDir, 'cafe', 'fonts'), { recursive: true });
  writeFileSync(join(themesDir, 'cafe', 'tokens.css'), CAFE_TOKENS);
  writeFileSync(join(themesDir, 'cafe', 'fonts.css'), CAFE_FACES);
  writeFileSync(join(themesDir, 'cafe', 'fonts', FONT_FILE), FONT_BYTES);
  mkdirSync(join(themesDir, 'cores'), { recursive: true });
  writeFileSync(join(themesDir, 'cores', 'tokens.css'), CORES_TOKENS);
});

afterAll(() => {
  delete process.env.FORGE_THEMES_DIR;
  rmSync(themesDir, { recursive: true, force: true });
});

/** The two store-scoped trees, rendered exactly as the app mounts them. */
const TREES = [
  { name: 's/[store] (dynamic)', load: () => import('@/app/s/[store]/layout') },
  { name: 'c/[store] (edge-cacheable, PERF-B)', load: () => import('@/app/c/[store]/layout') },
] as const;

async function render(tree: (typeof TREES)[number], store: string): Promise<string> {
  const { default: Layout } = await tree.load();
  return renderToString(
    await Layout({ children: <p id="page">a loja</p>, params: Promise.resolve({ store }) }),
  );
}

function fontUrlIn(html: string): string {
  const match = /url\("([^"]+)"\)/.exec(html);
  expect(match, 'the rendered page declares no font URL at all').not.toBeNull();
  return match?.[1] as string;
}

/**
 * ★★ THE URL THE PAGE EMITTED, MATCHED AGAINST THE ROUTES THIS APP ACTUALLY MOUNTS — the router's own rule,
 * written out: a `route.ts` answers the path of its directory, `[param]` matching one segment.
 *
 * Without this the chain has a hole that a green test would not see. Calling the handler directly proves the
 * HANDLER works; it does not prove the URL in the page is an address that reaches it. Rename the route
 * constant, move the directory, or mount it under a different path, and the page would ask for something no
 * file answers — a font that 404s, which does not break a page, it just falls back and looks wrong.
 */
function mountedRouteFor(pathname: string): string | null {
  const appDir = join(APP_SRC, 'app');
  const segments = pathname.split('/').filter(Boolean);
  const walk = (dir: string, depth: number): string | null => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isFile()) {
        if (entry.name === 'route.ts' && depth === segments.length) return full;
        continue;
      }
      if (!entry.isDirectory()) continue;
      // `(group)` segments are not part of the URL; `[param]` matches any one segment.
      if (/^\(.*\)$/.test(entry.name)) {
        const hit = walk(full, depth);
        if (hit) return hit;
        continue;
      }
      const segment = segments[depth];
      if (segment === undefined) continue;
      if (entry.name.startsWith('[') || entry.name === segment) {
        const hit = walk(full, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(appDir, 0);
}

/**
 * ★★ THE HANDLER IS FOUND THROUGH THE URL, NEVER IMPORTED BY A PATH THIS FILE TYPED. A static import would
 * prove the handler works while saying nothing about whether the address in the page reaches it — and the two
 * come apart the moment somebody moves the directory: the page would ask for something no file answers, the
 * font would 404, and a 404 font does not break a page. It falls back, and looks merely wrong.
 */
async function askTheRoute(url: string): Promise<Response> {
  const routeFile = mountedRouteFor(url);
  expect(
    routeFile,
    `the page renders ${url}, and no route.ts under apps/storefront/src/app answers that path`,
  ).not.toBeNull();
  const { GET } = (await import(pathToFileURL(routeFile as string).href)) as {
    GET: (
      req: Request,
      ctx: { params: Promise<{ key: string; file: string }> },
    ) => Promise<Response>;
  };
  const segments = url.split('/').filter(Boolean);
  const [key, file] = [segments.at(-3) as string, segments.at(-1) as string];
  return GET(new Request(`http://loja.test${url}`), { params: Promise.resolve({ key, file }) });
}

describe.each(TREES)('$name', (tree) => {
  test('★★ the page asks for the theme’s file at the BARE route, and the vitrine answers it', async () => {
    const url = fontUrlIn(await render(tree, 'sto-cafe'));
    expect(url, 'the vitrine is the edge fall-through: no asset prefix').toBe(
      `/api/theme-assets/cafe/fonts/${FONT_FILE}`,
    );
    const res = await askTheRoute(url);
    expect(res.status, `the page renders ${url} — the route it mounts must answer it`).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer()), `the bytes served at ${url}`).toEqual(
      FONT_BYTES,
    );
  });

  test('★ the route matcher is not vacuous — it says no to a path nothing mounts', () => {
    // A matcher that answered "yes" to everything would make the assertion above decorative. Two shapes that
    // must NOT resolve: one segment short of the route, and a path no directory spells.
    expect(mountedRouteFor('/api/theme-assets/cafe/fonts')).toBeNull();
    expect(mountedRouteFor('/api/theme-fontes/cafe/fonts/a.woff2')).toBeNull();
  });

  test('★ a theme with no font serves the bytes of before', async () => {
    const html = await render(tree, 'sto-cores');
    expect(html).toContain(safeThemeCss(readFileSync(join(themesDir, 'cores/tokens.css'), 'utf8')));
    expect(html).not.toContain('theme-assets');
  });

  test('a store on the reference theme inlines nothing at all', async () => {
    const html = await render(tree, 'sto-sem-tema');
    expect(html).not.toContain('data-forge-theme');
    expect(html, 'the page still renders').toContain('id="page"');
  });
});
