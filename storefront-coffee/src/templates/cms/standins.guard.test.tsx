// ⛔ p1-4 · NO INSTITUTIONAL PAGE OF THIS SHOP MAY SHIP A STAND-IN.
//
// ── WHAT WAS MEASURED (bench, 2026-09-03) ───────────────────────────────────────────────────────────────
// `/contato` served *"E-mail: contato@loja.exemplo · WhatsApp: (00) 00000-0000"*, on a page a shopper
// reaches from the footer of every other page. The other six institutional pages read like a shop; this one
// read like a fixture, and nothing anywhere said so — the seed creates these pages with a title and a
// `template_key` and NO body, so every word on all seven comes from a template in this directory and a
// stand-in in one of them is a stand-in on the shop.
//
// ── WHY THE GUARD IS OVER THE SET AND OVER THE RENDER ───────────────────────────────────────────────────
// Fixing the one string and asserting the new one would pin `/contato` and leave its six siblings, which is
// how the shop got here: six were written by somebody who knew the shop and one was left as scaffolding. So
// the templates are enumerated from the REGISTRY — the one place a template becomes reachable — and each is
// RENDERED, because a constant nobody uses cannot put a fake phone number on a page and a source-only scan
// would grade one that does.
//
// ⚠️ AND THE ENUMERATION NOW READS THE MAPS, NOT THE FILE. It used to `readFileSync('registry.ts')` and
// slice between two literal strings — which is a guard coupled to the SHAPE of a source file it does not
// own. The store axis changed that shape (one `REGISTRY` became `SHARED` + `OWN`) and the slice would have
// silently produced an empty list; a guard whose enumeration can quietly become empty is a guard that goes
// green over a directory it never looked at. The exported maps ARE the registry at runtime, they cannot be
// read as empty by accident, and the emptiness check below refuses it if they somehow are.
//
// ★ IT NOW COVERS THE STORE OVERLAY TOO. `OWN` holds the templates only the café gets, and a stand-in there
// reaches exactly the same shopper on exactly the same page.
//
// The patterns are stand-in SHAPES, not a list of today's offenders: reserved example domains (RFC 2606 and
// friends), a phone made of zeros, lorem, and the scaffolding words. Real copy for a fictional shop passes —
// what is refused is copy that ANNOUNCES it was never written.

import type { PageDoc } from '@forgecommerce/storefront-kit/read-client';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { OWN, type PageTemplate, SHARED } from './registry';

/** Every template that can reach a shopper on this front: the shared set, plus the café's own overrides. */
function registeredTemplates(): [string, PageTemplate][] {
  const out: [string, PageTemplate][] = [
    ...Object.entries(SHARED).map(([key, t]): [string, PageTemplate] => [`shared:${key}`, t]),
    ...Object.entries(OWN).map(([key, t]): [string, PageTemplate] => [`cafe:${key}`, t]),
  ];
  if (out.length < 2) throw new Error('the registry moved — this guard is reading the wrong shape');
  return out;
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

/**
 * ★★ THE ONE THING A STAND-IN SHAPE CANNOT TELL APART, AND WHY THIS FUNCTION EXISTS.
 *
 * A reserved `.example` address IS the shape of scaffolding, and the list above is right to hunt it: a shopper
 * reading `@cafe.example` reads a blank somebody forgot to fill. But this box ALSO has the opposite rule, and
 * it is not a preference — `bin/fork-contact.guard.mjs` refuses any contact detail that could belong to a real
 * stranger, because this dataset shipped the owner's own address once, in fifteen files. The two rules met on
 * this page during the pk21 merge and neither is wrong.
 *
 * What tells the two cases apart is not the SHAPE of the address, it is whether anybody DECLARED it. An
 * address the dataset publishes for this very shop (`seed/chrome.json`, the account footer the shopper reaches
 * from here in one click) is a decision; the same string written by nobody is scaffolding. So the exception is
 * DERIVED from the declaration, never an allow-list: change the dataset and this guard moves with it; write
 * `@whatever.example` here without declaring it and it is still caught.
 */
function declaredByTheShop(found: string): boolean {
  const declared = new Set<string>();
  const chrome = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../../seed/chrome.json'), 'utf8'),
  ) as { stores?: Record<string, Record<string, Record<string, unknown>>> };
  for (const blocks of Object.values(chrome.stores ?? {}))
    for (const config of Object.values(blocks ?? {}))
      for (const value of Object.values(config ?? {}))
        if (typeof value === 'string' && value.trim()) declared.add(value.trim());
  return [...declared].some((d) => d.includes(found));
}

const page = (key: string): PageDoc => ({
  slug: key,
  title: 'Página',
  template_key: key,
  meta_title: null,
  meta_description: null,
});

test('★★ every registered institutional template renders copy a shop could have written', () => {
  const offenders: string[] = [];
  for (const [key, Template] of registeredTemplates()) {
    const html = renderToString(<Template page={page(key)} />);
    for (const [pattern, what] of STAND_INS) {
      const hit = html.match(pattern);
      if (hit && !declaredByTheShop(hit[0])) offenders.push(`${key}: ${what} — "${hit[0]}"`);
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

test('★ the guard has something to look at — an empty enumeration must accuse itself', () => {
  // Against the vacuum: `registeredTemplates()` throwing on a moved registry is only half of it. If both maps
  // were emptied the loop above would iterate nothing and pass, having graded no page at all.
  expect(registeredTemplates().length).toBeGreaterThanOrEqual(Object.keys(SHARED).length);
  expect(Object.keys(SHARED).length).toBeGreaterThan(1);
});
