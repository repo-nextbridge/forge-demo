// ⛔ p2-4 · EVERY 404 BOUNDARY OF THIS SHOP NAMES ITS OWN TAB.
//
// ── WHAT WAS MEASURED (bench, 2026-09-03, headless Chromium) ────────────────────────────────────────────
// `document.title` was `""` on both 404s tested and `"Forge Café"` on the store home. The full diagnosis —
// the title is resolved, streamed, and dropped by the `__next_error__` shell — is in `NotFoundTitle.tsx`.
//
// ── WHY THE GUARD ENUMERATES THE BOUNDARIES INSTEAD OF NAMING THEM ──────────────────────────────────────
// This fork has THREE `not-found.tsx` and they were written at three different times: the store-less root,
// the store-scoped one, and the cached twin under `/c/[store]` that was copied from it. Asserting the title
// on the one the sonda opened would leave the other two nameless and nobody would learn of it until the next
// sonda. So the files are found on DISK, under `src/app`, and each one is RENDERED — a fourth boundary added
// next month is graded the day it is written.
//
// Rendering (rather than grepping for an import) is the part that matters: an import that is never placed in
// the returned JSX compiles, satisfies a source scan, and puts nothing in the tab.

import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'react-dom/server';
import type { ComponentType } from 'react';
import { expect, test } from 'vitest';
import { NOT_FOUND_TITLE } from '@/lib/site-metadata';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

/** Every 404 boundary this app ships, found on disk. */
function boundaries(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...boundaries(full));
    else if (entry === 'not-found.tsx') found.push(full);
  }
  return found;
}

test('★★ every 404 boundary renders a <title> — the tab was empty on all of them', async () => {
  const files = boundaries(APP);
  expect(files.length, 'the app tree moved — this guard is looking in the wrong place').toBeGreaterThanOrEqual(3);

  const nameless: string[] = [];
  for (const file of files) {
    const mod = (await import(/* @vite-ignore */ file)) as { default: ComponentType };
    const html = renderToString(<mod.default />);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1];
    if (title !== NOT_FOUND_TITLE) nameless.push(`${relative(APP, file)} → ${title ?? '(no <title> at all)'}`);
  }
  expect(
    nameless,
    `a 404 of this shop opens a nameless browser tab: ${nameless.join(' · ')}. The metadata pipeline cannot ` +
      'close this — the title it resolves is streamed to an `__next_error__` shell that drops it (see ' +
      'NotFoundTitle.tsx), so the boundary has to render the element itself.',
  ).toEqual([]);
});

test('★ the title is the shop\'s copy and says what happened, in the language the page is written in', () => {
  // A control over the constant itself: a tab reading "Loja" (the root layout's neutral fallback, which is
  // what the payload was carrying) is a named tab that tells the shopper nothing about why the page is empty.
  expect(NOT_FOUND_TITLE).toBe('Página não encontrada');
  expect(renderToString(<title>{NOT_FOUND_TITLE}</title>)).toContain(NOT_FOUND_TITLE);
});
