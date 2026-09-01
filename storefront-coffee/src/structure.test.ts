// Structural guard-rails — the two invariants that cannot be a runtime assertion:
//   1. The storefront NEVER touches the DB: no pg / @forge/db / @forge/core / ioredis dependency, and no
//      such import or a `Pool` anywhere in src. Its only door to data is HTTP via the read client.
//   2. Components consume ONLY semantic tokens: no literal hex in components/ or styles/ (re-skin = a
//      tokens.css edit). The single allowed exception — product-color swatches (catalog data) — is not
//      used by any V1 component, so the scan is strict here.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { KIT_SRC } from '@/test/kit-source';

const src = dirname(fileURLToPath(import.meta.url));

/**
 * Are we in the Forge monorepo, or in the copy a customer owns? The same signal `next.config.mjs` uses —
 * the workspace manifest — because this file is cut into `templates/surfaces/storefront` verbatim and a few
 * of its assertions describe OUR layout (a sibling app directory, the kit as sources) rather than any rule
 * the fork owner should have to satisfy.
 */
const IN_MONOREPO = existsSync(join(src, '..', '..', '..', 'pnpm-workspace.yaml'));
const appRoot = join(src, '..');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      out.push(...walk(full, exts));
    } else if (exts.includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

test('no DB dependency in package.json (storefront speaks only HTTP to the port)', () => {
  const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const forbidden of [
    'pg',
    '@forge/db',
    '@forge/core',
    'ioredis',
    '@forgecommerce/contracts',
  ]) {
    expect(all[forbidden], `unexpected DB-side dependency: ${forbidden}`).toBeUndefined();
  }
});

test('no DB import nor a connection Pool anywhere in src', () => {
  const offenders: string[] = [];
  for (const file of walk(src, ['.ts', '.tsx'])) {
    const text = readFileSync(file, 'utf8');
    if (/from\s+['"](pg|@forge\/db|@forge\/core|ioredis)['"]/.test(text)) offenders.push(file);
    if (/\bnew\s+Pool\b/.test(text)) offenders.push(file);
  }
  expect(offenders, `DB access found in: ${offenders.join(', ')}`).toEqual([]);
});

test('components and styles contain no literal hex (semantic tokens only)', () => {
  // The ONE sanctioned exception: a third-party brand mark whose colors the vendor dictates — the social-login
  // "G" (Google), the same carve-out the templates/ scan takes for LoginTemplate. Apple's mark is monochrome
  // (currentColor), so it needs none.
  //
  // PAY-APP-SHAPE removed the other two (the card-network marks and the simulator's decorative PIX QR): they
  // were a payment APP's UI living in the theme, and they left with it — an app's own hex carve-outs are the
  // app's business now. A new exception here is a smell to interrogate, not a line to add.
  const ALLOWED_BRAND_LOGO = ['components/SocialMarks.tsx'];
  const files = [
    ...walk(join(src, 'components'), ['.css', '.tsx']),
    ...walk(join(src, 'styles'), ['.css']),
  ].filter((f) => !f.endsWith('.test.tsx') && !ALLOWED_BRAND_LOGO.some((a) => f.endsWith(a)));
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  const offenders = files.filter((f) => hex.test(readFileSync(f, 'utf8')));
  expect(offenders, `literal hex found in: ${offenders.join(', ')}`).toEqual([]);
});

// SUBT: the header/footer subtemplates were the same green zone — semantic tokens only, NO literal hex.
// CHECKOUT-APP (K1) moved them into `@forgecommerce/storefront-kit` with the rest of the chrome, and the scan
// went with them: `packages/storefront-kit/src/structure.test.ts` holds the whole package to this rule (and to
// the DB rule above), which is stricter than the carve-out this file keeps for a third-party brand mark. The
// scan is not dropped, it changed address — and it is asserted here that it did, so nobody re-adds an empty
// one.
// ★ CHECKOUT-APP (C1) — THE CHECKOUT SURFACE'S TWO SCANS MOVED WITH IT. `templates/checkout` and
// `lib/payment-blocks` are `apps/checkout`'s now, and their green zone is asserted in that app's own
// `structure.test.ts` — the same rules, over the tree that contains the files. Asserted here so nobody
// re-adds an empty scan over a directory this app no longer has.
//
// ⚠️ C3 — ONLY THE ABSENCE IS ASSERTED HERE. The other half ("…and they are over there") reads the SIBLING
// app's tree, which resolves in this monorepo and in nothing else: `pack-surface.ts` cuts this app as a
// standalone project a customer owns, and there `../../checkout/src` does not exist, so the packed suite
// failed on the customer's first `npm test`. That half now lives in `app-split.guard.test.ts`, this
// repository's convention for an assertion ABOUT this repository, which the cut leaves behind.
test('the checkout surface moved to its own deployable, taking its structural scans with it', () => {
  expect(existsSync(join(src, 'templates', 'checkout'))).toBe(false);
  expect(existsSync(join(src, 'lib', 'payment-blocks'))).toBe(false);
});

// ★★ CHECKOUT-APP (C4) — THE MIRROR OF THE CHECKOUT'S OWN RULE, AND WHAT `/api/slots` RESTS ON.
//
// `apps/checkout/src/structure.test.ts` asserts that the checkout reaches into nothing of the vitrine. This is
// the other direction, and it was missing: the cut is only two deployables while BOTH halves refuse. An import
// from here would resolve in the monorepo and bundle the other app into this build — which is how the epic's
// whole premise dies quietly, with a green test suite and a container twice the size.
//
// It is also the load-bearing premise of `app/api/slots/route.ts`: that route answers for the WHOLE surface,
// and the only reason it does so from generated DATA (`lib/slots/generated/sibling-slots.ts`) instead of an
// import is this rule. Take the rule away and the obvious "fix" for a missing slot is the one that breaks the
// build topology.
//
// ⚠️ `.guard.test.ts` IS EXEMPT, ON PURPOSE. Two of them import the sibling's registry to derive an
// expectation from the discovery the other process actually runs (`templates/registration.guard.test.ts`,
// `app/api/slots/union.guard.test.ts`). That suffix is precisely the one the pack step drops from the copy a
// customer owns (scripts/publishing/pack-surface.ts), so nothing it reaches for ships anywhere.
test('★ the vitrine imports nothing from the checkout (a guard test excepted, and only that)', () => {
  const offenders: string[] = [];
  const crossRepo: string[] = [];
  for (const file of walk(src, ['.ts', '.tsx'])) {
    const text = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = match[1] as string;
      if (!/(^|\/)apps\/checkout\//.test(spec) && !/(^|\/)\.\.\/checkout\//.test(spec)) continue;
      (file.endsWith('.guard.test.ts') ? crossRepo : offenders).push(`${file} → ${spec}`);
    }
  }
  expect(
    offenders,
    `the vitrine reaches into apps/checkout:\n  ${offenders.join('\n  ')}\n\n` +
      "Shared code goes to @forgecommerce/storefront-kit; the sibling's slot registry arrives as data " +
      'generated by `pnpm codegen`, never as an import.',
  ).toEqual([]);
  // Anti-vacuity: the scan must be finding the exempt ones, or the rule above matches nothing and is blind
  // to the import it forbids.
  //
  // ⚠️ MONOREPO ONLY. This file SHIPS — it is the reference suite inside the storefront a customer forks
  // (templates/surfaces/storefront), and there `apps/checkout` does not exist at all: the sibling arrives as
  // a container on the same host, never as a path. So the exempt guard test the scan counts on is not in the
  // copy, and demanding it would hand every fork owner a red `npm test` on their first run. The rule above
  // still runs there and still forbids the import; only its self-check is ours to make.
  if (IN_MONOREPO) {
    expect(crossRepo.length, 'the cross-repo scan matched no import at all').toBeGreaterThan(0);
  }
});

// ⚠️ MONOREPO ONLY, and for a reason worth stating: in a customer's copy the kit is an INSTALLED PACKAGE, so
// `KIT_SRC` points into node_modules — where the subtemplates do live, but the kit's own `structure.test.ts`
// does NOT, because tests are not part of a published surface. Asserting it there would be asserting that we
// shipped our test suite inside a dependency. The half that matters to a fork owner — that `src/subtemplates`
// is gone from their app — is the first line, and it holds in both worlds.
test('the subtemplates moved to the kit, taking their own structural scan with them', () => {
  expect(existsSync(join(src, 'subtemplates'))).toBe(false);
  expect(existsSync(join(KIT_SRC, 'subtemplates'))).toBe(true);
  if (IN_MONOREPO) {
    expect(existsSync(join(KIT_SRC, 'structure.test.ts'))).toBe(true);
  }
});

// S6-ACCOUNT-SKIN: EVERY stylesheet of the storefront is the green zone — the two explicit scans above cover
// the surfaces we already had; this one closes the door for any module written from now on.
test('every CSS module in src contains no literal hex (tokens only)', () => {
  const files = walk(src, ['.css']).filter((f) => f.endsWith('.module.css'));
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  const offenders = files.filter((f) => hex.test(readFileSync(f, 'utf8')));
  expect(offenders, `literal hex found in: ${offenders.join(', ')}`).toEqual([]);
});

// S7-SF-CLOSE (belt): inline hex in a `.tsx` is the same drift the CSS scans forbid, one layer up (a `style=`
// or an SVG `fill`). The component/subtemplate/checkout scans above already cover their `.tsx`; this closes
// templates/ (home/list/pdp/search/account/order/cms) and app/. Comments are stripped first (an issue ref like
// `#120` in a header is not a color). The ONE sanctioned exception is a THIRD-PARTY BRAND LOGO whose colors are
// dictated by the vendor's guidelines, not the theme (Google's "G") — the same spirit as the color-swatch
// carve-out. Apple's mark is monochrome (currentColor), so it needs no exception.
test('templates/ and app/ .tsx carry no inline hex (tokens only; brand logos excepted)', () => {
  const ALLOWED_BRAND_LOGO = ['templates/account/LoginTemplate.tsx']; // Google "G" — vendor brand colors
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  const files = [
    ...walk(join(src, 'templates'), ['.tsx']),
    ...walk(join(src, 'app'), ['.tsx']),
  ].filter((f) => !f.endsWith('.test.tsx') && !ALLOWED_BRAND_LOGO.some((a) => f.endsWith(a)));
  const offenders = files.filter((f) => hex.test(stripComments(readFileSync(f, 'utf8'))));
  expect(offenders, `inline hex found in a .tsx: ${offenders.join(', ')}`).toEqual([]);
});

// S7-SF-CLOSE (§10.5 mask unification): the theme has ONE mask util (lib/masks.ts). A raw `replace(/\D/g` (or
// `/[^\d]/`) anywhere else is a digit-strip rolled by hand — the seed of the drift the account/checkout/PDP
// duplicates already showed. The one legal home is lib/masks.ts; every other surface imports `digitsOf`/`mask*`.
test('no inline digit-strip outside lib/masks.ts (one mask util)', () => {
  const inlineStrip = /\.replace\(\s*\/(?:\\D|\[\^\\?d\])/;
  const offenders: string[] = [];
  for (const file of walk(src, ['.ts', '.tsx'])) {
    if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
    if (file.endsWith(join('lib', 'masks.ts'))) continue;
    if (inlineStrip.test(readFileSync(file, 'utf8'))) offenders.push(file);
  }
  expect(offenders, `inline digit-strip (use lib/masks) in: ${offenders.join(', ')}`).toEqual([]);
});

// S7-SF-CLOSE (§10.9 breakpoint coherence): the theme has TWO site-wide responsive boundaries — the mobile
// boundary 768px (its exclusive twin 767.98px for a clean split) and the checkout two-column boundary 900px
// (constants in lib/breakpoints.ts) — plus a couple of ANNOTATED component-local reflows. A `@media` width in
// `rem` (48rem drift) or an arbitrary new value is the incoherence this guard forbids: every width breakpoint
// must be px and in the sanctioned set. A genuinely new boundary is added here deliberately, never by accident.
test('every @media width breakpoint is a sanctioned px value (no rem drift, no arbitrary breakpoints)', () => {
  // 768 / 767.98 = the mobile boundary; 900 = checkout; 560 / 720 = documented component-local reflows.
  //
  // 1100 lived here for one commit (PACK item 17, when the PDP buybox was fixed at 525px and needed a floor)
  // and came back OUT: Renan chose the prototype's own proportional hero, which asks for no breakpoint of its
  // own. A scale this small is the point — an entry has to be paid for, and this one stopped being owed.
  const SANCTIONED = new Set(['768px', '767.98px', '900px', '560px', '720px']);
  const offenders: string[] = [];
  for (const file of walk(src, ['.css'])) {
    for (const m of readFileSync(file, 'utf8').matchAll(
      /@media[^{]*?(?:min|max)-width:\s*([^)\s]+)/g,
    )) {
      const value = m[1] as string;
      if (!SANCTIONED.has(value)) offenders.push(`${file} (${value})`);
    }
  }
  expect(offenders, `off-scale @media breakpoint in: ${offenders.join(', ')}`).toEqual([]);
});

// S6-ACCOUNT-SKIN: the bug this task fixed, turned into a net. The /account pages rendered with global class
// names (`className="account"`) that existed in NO stylesheet — HTML with zero style. A page under app/ styles
// itself through a CSS module (`className={styles.x}`), never a bare string: a literal className there is
// either dead (no such rule) or a global escape hatch this theme does not have.
test('no page under app/ styles itself with a literal class name (CSS modules only)', () => {
  const offenders: string[] = [];
  for (const file of walk(join(src, 'app'), ['.tsx'])) {
    if (file.endsWith('.test.tsx')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(/className\s*=\s*"([^"]*)"/g)) {
      offenders.push(`${file} (className="${match[1]}")`);
    }
  }
  expect(offenders, `unstyled global class name found in: ${offenders.join(', ')}`).toEqual([]);
});

// RICH (A3 + S4 fix-pack): tenant-authored markdown MAY render embedded HTML, but it is SANITIZED, never raw —
// any file that pulls `rehype-raw` (to render embedded HTML) MUST pair it with `rehype-sanitize` in the SAME file
// (parse raw → strip anything outside the allow-list). A lone rehype-raw is the XSS hole. And NOTHING uses
// dangerouslySetInnerHTML to inject raw HTML. This guard matches actual CODE (the plugin imports and the JSX
// attribute), not prose that merely names them. The ONE sanctioned dangerouslySetInnerHTML exception is
// JsonLd.tsx — schema.org structured data, escaped before embedding (its own unit test proves the `</script>`
// break-out is neutralized).
test('embedded HTML is always sanitized (rehype-raw only with rehype-sanitize; no raw-HTML injection)', () => {
  const ALLOWED_DSIH = [
    'components/JsonLd.tsx', // structured data, escaped + unit-tested
    // MS-M2 — the store's theme tokens, embedded in a <style>. Same terms as JsonLd: the break-out sequence
    // (`</style`) is neutralized before embedding and a unit test proves it (store-theme.test.tsx). Escaping
    // the text instead is not an option here — React would turn `>` in a selector into `&gt;`, which the CSS
    // parser does not decode, so the rule would silently stop matching.
    'lib/theme/store-theme.tsx',
  ];
  const offenders: string[] = [];
  for (const file of walk(src, ['.ts', '.tsx'])) {
    if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
    const text = readFileSync(file, 'utf8');
    const usesRaw = /from\s+['"]rehype-raw['"]|\brehypeRaw\b/.test(text);
    const usesSanitize = /from\s+['"]rehype-sanitize['"]|\brehypeSanitize\b/.test(text);
    if (usesRaw && !usesSanitize) offenders.push(`${file} (rehype-raw without rehype-sanitize)`);
    if (/dangerouslySetInnerHTML\s*=/.test(text) && !ALLOWED_DSIH.some((a) => file.endsWith(a))) {
      offenders.push(`${file} (dangerouslySetInnerHTML)`);
    }
  }
  expect(offenders, `unsafe raw-HTML render found in: ${offenders.join(', ')}`).toEqual([]);
});

// PRE-S7-STOREFRONT-DEBT: the PDP's hydration mismatch, turned into a net. A `'use client'` module runs TWICE —
// once on the server (SSR) and once in the browser — and `process.env.X` is only real in the first: a non-public
// env is `undefined` in the bundle. So a client component that branches on one renders two different trees and
// hydrates into a mismatch (the Gallery called `mediaSrc()`, which reads FORGE_MEDIA_BASE_URL, and the <img>'s
// src/srcset/sizes disagreed). The rule: server-only config reaches a client component as a PROP — props cross
// the RSC boundary, the environment does not. NEXT_PUBLIC_* is the sanctioned exception (it IS in the bundle,
// identical on both sides). This scan is why the class of bug cannot come back.
test('no client component reads server-only config (env crosses the boundary as a prop, never as an env)', () => {
  // Comments are stripped first: this guard matches CODE, never a header that merely NAMES the rule (the files
  // it protects explain the rule in prose, and prose must not trip it).
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const offenders: string[] = [];
  for (const file of walk(src, ['.ts', '.tsx'])) {
    if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
    const raw = readFileSync(file, 'utf8');
    if (!/^\s*['"]use client['"]/m.test(raw)) continue;
    const text = stripComments(raw);
    for (const m of text.matchAll(/process\.env\.(\w+)/g)) {
      if (!m[1]?.startsWith('NEXT_PUBLIC_')) offenders.push(`${file} (process.env.${m[1]})`);
    }
    // The env-reading resolvers themselves: calling them from the client is the same bug, one frame down.
    for (const fn of ['mediaSrc', 'mediaOptimized']) {
      if (new RegExp(`\\b${fn}\\s*\\(`).test(text))
        offenders.push(`${file} (${fn}() is server-only)`);
    }
  }
  expect(
    offenders,
    `server-only config read from a client component: ${offenders.join(', ')}`,
  ).toEqual([]);
});
