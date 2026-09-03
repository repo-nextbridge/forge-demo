// ⛔ p1-4 · NO INSTITUTIONAL PAGE OF THIS SHOP MAY SHIP A STAND-IN.
//
// ── WHAT WAS MEASURED (bench, 2026-09-03) ───────────────────────────────────────────────────────────────
// `/contato` served *"E-mail: contato@loja.exemplo · WhatsApp: (00) 00000-0000"*, on a page a shopper
// reaches from the footer of every other page. The other six institutional pages read like a shop; this one
// read like a fixture, and nothing anywhere said so — the seed creates these pages with a title and a
// `template_key` and NO body (seed/vitrine.mjs), so every word on all seven comes from a template in this
// directory and a stand-in in one of them is a stand-in on the shop.
//
// ── WHY THE GUARD IS OVER THE SET AND OVER THE RENDER ───────────────────────────────────────────────────
// Fixing the one string and asserting the new one would pin `/contato` and leave its six siblings, which is
// how the shop got here: six were written by somebody who knew the shop and one was left as scaffolding. So
// the templates are enumerated from the REGISTRY — the one place a template becomes reachable — and each is
// RENDERED, because a constant nobody uses cannot put a fake phone number on a page and a source-only scan
// would grade one that does.
//
// The patterns are stand-in SHAPES, not a list of today's offenders: reserved example domains (RFC 2606 and
// friends), a phone made of zeros, lorem, and the scaffolding words. Real copy for a fictional shop passes —
// what is refused is copy that ANNOUNCES it was never written.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { resolvePageTemplate } from './registry';

/** The template keys that can reach a shopper, read off the registry itself — a template added there next
 *  month is graded without anybody editing this file. */
function registeredKeys(): string[] {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'registry.ts'), 'utf8');
  const body = src.slice(src.indexOf('const REGISTRY'), src.indexOf('/** Resolve a template_key'));
  const keys = [...body.matchAll(/^\s*'?([a-z-]+)'?:\s*[A-Z]/gm)].flatMap((m) => m[1] ?? []);
  if (keys.length < 2) throw new Error('the registry moved — this guard is reading the wrong shape');
  return keys;
}

const STAND_INS: [RegExp, string][] = [
  [/@[\w.-]*\.(exemplo|example|invalid|test|local)\b/i, 'an e-mail on a reserved example domain'],
  [/\b(?:exemplo|example)\.(?:com|com\.br)\b/i, 'an example.com address'],
  [/\(0{2}\)|\b0{4,}[\s-]?0{4,}\b/, 'a telephone made of zeros'],
  [/lorem ipsum/i, 'lorem ipsum'],
  // Case-SENSITIVE, and that is a measurement rather than taste: `/todo/i` matched "todo o Brasil" in the
  // shipping page — ordinary Portuguese. Scaffolding shouts; prose does not.
  [/\bTODO\b|\bTBD\b|\bXXX+\b|\bPREENCHER\b/, 'scaffolding left in the copy'],
];

const page = (key: string): PageDoc => ({
  slug: key,
  title: 'Página',
  template_key: key,
  meta_title: null,
  meta_description: null,
});

test('★★ every registered institutional template renders copy a shop could have written', () => {
  const offenders: string[] = [];
  for (const key of registeredKeys()) {
    const { template: Template, fallback } = resolvePageTemplate(key);
    expect(fallback, `"${key}" is registered but does not resolve`).toBe(false);
    const html = renderToString(<Template page={page(key)} />);
    for (const [pattern, what] of STAND_INS) {
      const hit = html.match(pattern);
      if (hit) offenders.push(`${key}: ${what} — "${hit[0]}"`);
    }
  }
  expect(
    offenders,
    `an institutional page of this shop is still wearing scaffolding: ${offenders.join(' · ')}. These pages ` +
      'have no stored body — every word comes from this directory, so a stand-in here is a stand-in on the shop.',
  ).toEqual([]);
});

test('★ the guard can SEE a stand-in — the same scan over the string it was written for', () => {
  // Control positive: without this, a pattern that silently stopped matching (an escape, a rename) would
  // leave the test above green over a page full of scaffolding.
  const wasThere = '<li>E-mail: contato@loja.exemplo</li><li>WhatsApp: (00) 00000-0000</li>';
  const caught = STAND_INS.filter(([pattern]) => pattern.test(wasThere));
  expect(caught).toHaveLength(2);
});
