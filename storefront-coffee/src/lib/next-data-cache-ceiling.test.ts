// ★★ THE FRAMEWORK FACT THE STOREFRONT'S CACHING RESTS ON, asserted against the installed Next rather than
// remembered.
//
// Every `fetch` in this app that declares `next: { revalidate }` is asking for the DATA CACHE. That cache has
// a per-entry ceiling nobody here chose: Next drops any entry over 2 MiB, and it stores the response body
// BASE64-ENCODED, so a payload is 4/3 of its wire size by the time it is measured. A 1,77 MiB answer becomes
// a 2,36 MiB entry and is refused — in PRODUCTION IN SILENCE (`return`), loudly only in dev (`throw`).
//
// That is not a hypothetical. `cardRatings` fetched the whole store's reviews with `revalidate: 60` written
// on it and was re-fetched on every render for as long as the demo store had more than ~6.150 reviews,
// because the cache it declared was refusing every entry and telling nobody. EXT-DATA-PROJECTION fixed it by
// making the answer smaller, which means the fix is only a fix WHILE THESE TWO FACTS HOLD.
//
// So they are read off the installed package. If a Next upgrade moves the ceiling or stops base64-ing the
// body, this goes red and the numbers get re-derived — instead of a comment somewhere claiming a limit that
// stopped existing. `extensions/reviews/cache-ceiling.test.ts` grades a payload against the same constant.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);

function nextSource(relative: string): string {
  return readFileSync(require.resolve(`next/${relative}`), 'utf8');
}

test('the fetch data cache still DROPS an entry over 2 MiB', () => {
  const source = nextSource('dist/server/lib/incremental-cache/index.js');
  // The guard, as Next writes it. Matched on the expression rather than on the message, because the message
  // is prose and the expression is the behaviour.
  expect(source).toMatch(/itemSize\s*>\s*2\s*\*\s*1024\s*\*\s*1024/);
  // And it is measured over the SERIALIZED entry, which is what makes the base64 below count.
  expect(source).toMatch(/itemSize\s*=\s*JSON\.stringify\(data\)\.length/);
});

test('the cached body is BASE64 — the 4/3 that turns 1,77 MiB into 2,36', () => {
  const source = nextSource('dist/server/lib/patch-fetch.js');
  expect(source).toMatch(/body:\s*(?:Buffer\.from\()?bodyBuffer\)?\.toString\('base64'\)/);
});

test('production is SILENT about it, which is why a size test exists at all', () => {
  const source = nextSource('dist/server/lib/incremental-cache/index.js');
  // In dev it throws; outside dev the branch simply returns. A dropped entry is therefore invisible on a
  // deployed box: nothing but a size assertion can tell you the cache you declared is not running.
  expect(source).toMatch(/items over 2MB can not be cached/);

  // ⚠️ THIS USED TO BUDGET 200 CHARACTERS BETWEEN THE BRACES, and the budget is what broke on the bump to
  // 15.2.9 — not the behaviour. Next 15.2 started stamping `__NEXT_ERROR_CODE` on every Error it builds, so
  // the dev branch grew from 136 characters to 313 and the regex stopped matching a block that had not
  // changed meaning. Measured across three versions: the four facts above hold on 15.1.6, 15.2.9 and
  // 15.5.23; only the LENGTH moved (136 → 313 → 237). A length is a proxy for the mechanism, and the proxy
  // is the thing that rots — so the branch is now isolated by its own boundaries and read for what it DOES.
  const open = source.indexOf('if (this.dev) {');
  expect(open).toBeGreaterThan(-1);
  const branch = source.slice(open, source.indexOf('return;', open) + 'return;'.length);

  // What makes production silent: the ONLY thing between the guard and the fall-through is a throw, and the
  // fall-through is an unconditional `return;`. If Next ever logs, counts or reports the drop outside dev,
  // this stops holding and the size assertions downstream get re-derived instead of quietly trusted.
  expect(branch).toMatch(/^if\s*\(this\.dev\)\s*\{/);
  expect(branch).toMatch(/throw\b/);
  expect(branch).toMatch(/\}\s*return;$/);
  expect(branch).toContain('items over 2MB can not be cached');

  // Non-vacuity, permanent: exactly one such branch exists. Without this the assertions above would pass on a
  // file where the dev guard had been renamed and `indexOf` found some other `this.dev` — or none, and the
  // slice `source.slice(-1, …)` quietly measured the wrong text.
  expect(source.match(/if\s*\(this\.dev\)\s*\{/g)).toHaveLength(1);
});
