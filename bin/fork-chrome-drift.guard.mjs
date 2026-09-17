// ★★ ONE SHOP, ONE CHROME — the rule the café's vitrine lost by being a CUT of a two-tree storefront.
//
// ── THE DEFECT, MEASURED IN THIS REPOSITORY 2026-09-05, IN SOURCE ────────────────────────────────────────
//
//     storefront-coffee/src/app/s/[store]/(storefront)/layout.tsx  →  <CoffeeChrome>    the shop's own
//     storefront-coffee/src/app/c/[store]/layout.tsx               →  <StorefrontChrome> the REFERENCE's
//
// One deployable, one store, TWO identities — and which one a shopper got was decided by the EDGE, not by the
// shop. The reference vitrine serves every store URL from two trees (PERF-B: `/c/<store>/…` cacheable,
// `/s/<store>/…` dynamic), and a fork that rewrites the header rewrites the tree it was looking at. The other
// one keeps the header it was cut with, compiles, renders and is never asserted against its twin.
//
// ⚠️ WHERE IT SHOWS, AND WHY THE BENCH HID IT. The cacheable tree is what the middleware sends a CLEAN
// catalogue request to — the home, the unfiltered PLP, the PDP. It is reached by resolving a HOST, so on this
// bench, where one origin serves several stores and the café is browsed at `/s/<store>/…` (path-scoped, always
// dynamic), the café never entered it. A store with its own domain — production — enters it on every page.
// The hybrid the tech lead saw on 01/09 when `/` was pointed at this container (the café's body inside the
// reference's menu and logo) is this file's subject, and the card written for it
// (`FORK-RAIZ-SEM-CHROME`) blamed `src/app/page.tsx`, which is the reference's landing stub, wears no chrome
// at all, and is unreachable behind the middleware.
//
// ── WHY THIS IS A SECOND GUARD AND NOT A LINE IN THE FIRST ───────────────────────────────────────────────
//
// `bin/store-mount-drift.guard.mjs` cannot see this and could not be taught to cheaply. Its jurisdiction is
// the STORE-SCOPED ROOT LAYOUT, discovered as `src/app/<tree>/[store]/layout.tsx` (see `storeRootLayouts`
// there) — so it reads `s/[store]/layout.tsx` and `c/[store]/layout.tsx` and nothing else. The chrome of the
// dynamic tree is mounted one level DOWN, in the route group `s/[store]/(storefront)/layout.tsx`, which that
// sweep never opens; and what it compares is KIT bindings (`@forgeco/*`), while a chrome is the app's
// own module. Both halves of this defect are outside it by construction. It is also asked a different
// question: "did the fork fall behind the reference at the mount point?" — the answer here is that the fork
// is deliberately AHEAD, in one tree and not the other.
//
// ── WHAT THIS GUARD IS ──────────────────────────────────────────────────────────────────────────────────
//
// A chrome is not identified by its NAME here — a fork may call its header anything. It is identified by what
// a chrome structurally IS: the component a layout wraps `{children}` in. So the rule is derived twice over —
// the REFERENCE's own layouts say which files are supposed to carry one, and the FORK's own source says which
// component it chose — and this file names neither `StorefrontChrome` nor `CoffeeChrome`.
//
//   1. every layout where the reference mounts a chrome, the fork mounts one too   (…or loses its own header)
//   2. across those layouts the fork mounts exactly ONE chrome                     (…or serves two identities)
//
// ⚠️ It compares SOURCE, so it proves the MOUNT and never the response. What a shopper is actually served is
// proven by rendering both layouts, in the fork's own suite
// (`storefront-coffee/src/app/chrome-identity.test.tsx`) — which, on the day this was written, was run by
// nobody but the author (see `pk14/d3`). That is exactly why the rule also lives out here, where
// `bash bin/test.sh` runs it.
//
//   node --test bin/fork-chrome-drift.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/fork-chrome-drift.guard.mjs

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import test from 'node:test';
import { surfaceForks, surfaces } from './forks.mjs';
import { pinnedCommit, releaseTree } from './release-tree.mjs';

const say = (line) => console.error(`[fork-chrome] ${line}`);

/**
 * ★ LAYOUTS THIS FORK HAS DECIDED TO LEAVE CHROME-LESS — empty today, and it is what makes rule 1 a decision
 * instead of an order. A fork owns its front: serving a tree bare is a legitimate answer, and the only thing
 * it may not be is a surprise.
 *
 * One entry per layout: `{ fork, layout, why }`. Every entry is PRINTED on every run, and an entry naming a
 * layout the reference no longer gives a chrome is RED — a waiver outlives its reason by one run.
 */
const DIVERGENCES = [];

const PINNED = pinnedCommit();
const TREE = PINNED ? releaseTree(PINNED) : { tried: [] };

// ── reading a layout ────────────────────────────────────────────────────────────────────────────────────

/** Comments are prose ABOUT the mount; only the code is the mount. Stripped before anything is matched, so a
 *  commented-out chrome cannot satisfy the rule and prose naming one cannot satisfy the wrap. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every STORE-SCOPED `layout.tsx` under `src/app`, relative to the surface root. Walked rather than listed:
 *  the chrome of the dynamic tree lives in a ROUTE GROUP (`(storefront)`), one level below the store-scoped
 *  root layout, and a rule that only looked where the last defect was would have missed this one.
 *
 *  ⚠️ `[store]` IN THE PATH IS THE JURISDICTION, and it is not a convenience. A chrome is a STORE's header —
 *  its logo, its links, its announcement — so it can only be mounted where the store is known. The root
 *  `src/app/layout.tsx` sits ABOVE every `[store]` segment and says so in its own header ("the chrome is NOT
 *  here — it lives in the store-scoped route groups, because the header needs `store`"); what it wraps
 *  `{children}` in is a provider, and calling that a second chrome would be this rule inventing a defect. */
function layouts(base) {
  const app = join(base, 'src', 'app');
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'layout.tsx') out.push(relative(base, full));
    }
  };
  walk(app);
  return out.filter((rel) => rel.split(sep).includes('[store]')).sort();
}

/** The modules an app owns — `@/…` (its own alias) and a relative path. Anything else it INSTALLED. */
const ownModule = (spec) => spec.startsWith('@/') || spec.startsWith('.');

/** The identifiers this file imports from its own app. */
function ownImports(source) {
  const names = new Set();
  for (const [, clause, spec] of source.matchAll(/import\s+\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    if (!ownModule(spec)) continue;
    for (const part of clause.split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/**
 * The component(s) a layout WRAPS `{children}` IN — which is what a chrome structurally is, and the reason
 * this file names no chrome of its own: not `StorefrontChrome`, not `CoffeeChrome`, so a fork may call its
 * header anything. A fragment (`<>{children}</>`) is not one: it decides nothing about what a shopper sees,
 * which is why the gate layout — whose job is to REPLACE the page rather than frame it — reports none.
 *
 * ⚠️ AND IT MUST BE THE APP'S OWN MODULE. The kit ships wrappers a layout legitimately puts around the whole
 * tree (the image-driver provider is one), and those are plumbing every fork shares — the identity is the file
 * the fork WROTE. Filtering on the import specifier is what tells the two apart without naming either.
 */
function chromeMounts(source) {
  const own = ownImports(source);
  const found = new Set();
  for (const [, name] of source.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) {
    if (found.has(name) || !own.has(name)) continue;
    const wraps = new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?\\{children\\}[\\s\\S]*?</${name}>`);
    if (wraps.test(source)) found.add(name);
  }
  return [...found].sort();
}

// ── what every run says out loud, before any assertion ──────────────────────────────────────────────────

const FORKS = surfaceForks(TREE);

say(`forge.lock pins: ${PINNED ? PINNED.ref : 'no branch@sha — this lock names registry digests'}`);
if (TREE.path) {
  say(`the reference read from: ${TREE.path} @ ${TREE.head.slice(0, 9)} (${TREE.how})`);
} else if (PINNED) {
  say(`⚠️ NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine.`);
  for (const line of TREE.tried) say(`   tried: ${line}`);
  say("   set FORGE_MONOREPO=<the release's checkout>. Nothing below can compare this fork to anything.");
}
say(`forks of a packed surface: ${FORKS.map((f) => `${f.dir} (cut of ${f.surface.dir})`).join(', ') || 'none'}`);
for (const d of DIVERGENCES) say(`declared divergence: ${d.fork}/${d.layout} mounts NO chrome — ${d.why}`);

// ── the rule ────────────────────────────────────────────────────────────────────────────────────────────

test('a Forge checkout at the pinned commit was found (otherwise nothing here is a measurement)', (t) => {
  if (!PINNED) {
    t.skip('NOT CHECKED — forge.lock no longer names a branch@sha, so there is no tree to read');
    return;
  }
  if (!TREE.path) {
    t.skip(`NOT CHECKED — no Forge checkout at ${PINNED.ref} on this machine (set FORGE_MONOREPO)`);
    return;
  }
  assert.ok(surfaces(TREE).length > 0, `${TREE.path} has no scripts/publishing/surfaces.json entries to map a fork to`);
});

test('this repository owns at least one fork of a packed surface', (t) => {
  if (!TREE.path) {
    t.skip('NOT CHECKED — without the release tree there is no table of packed surface names to match against');
    return;
  }
  assert.ok(FORKS.length > 0, 'no directory of this repo declares a `packedName` from the release — the fork left, or was renamed');
});

for (const fork of FORKS) {
  const referenceBase = join(TREE.path, fork.surface.dir);
  /** The layouts the REFERENCE frames its pages in — the jurisdiction, derived from the release. */
  const framed = layouts(referenceBase).filter(
    (rel) => chromeMounts(code(readFileSync(join(referenceBase, rel), 'utf8'))).length > 0,
  );

  test(`⛔ THE VACUUM CHECK — ${fork.surface.dir} still frames its pages in a chrome somewhere`, () => {
    // Without this, a reference that stopped mounting a chrome (a rename of the pattern, a move, a wrong
    // tree read) would leave `framed` empty and every rule below would pass by having no subject. That is
    // the quietest way a sweep dies, and this repository has paid for it before.
    assert.ok(
      framed.length > 0,
      `no layout under ${fork.surface.dir}/src/app wraps {children} in a component. Either the reference ` +
        'stopped framing its pages — in which case this whole file is about nothing and must be re-derived ' +
        '— or the tree above is not the one that was baked.',
    );
    say(`${fork.surface.dir} frames its pages at: ${framed.join(', ')}`);
  });

  const stale = DIVERGENCES.filter((d) => d.fork === fork.dir && !framed.includes(d.layout));
  test(`${fork.dir}: every declared divergence still names a layout the reference frames`, () => {
    assert.deepEqual(
      stale.map((d) => d.layout),
      [],
      `${fork.dir}: a declared divergence names a layout the reference no longer gives a chrome. The reason ` +
        'it was written for is gone; delete the entry rather than leave a waiver nobody can read.',
    );
  });

  test(`★★ ${fork.dir} frames every tree the reference frames, and wears ONE chrome across them`, (t) => {
    if (framed.length === 0) {
      t.skip('NOT CHECKED — the vacuum check above already failed; there is no jurisdiction to apply');
      return;
    }
    const bare = [];
    const worn = new Map();
    for (const rel of framed) {
      const forkFile = join(fork.path, rel);
      if (!existsSync(forkFile)) {
        // A fork may delete a whole tree; then it serves no URL through that layout. Said out loud rather
        // than passed over, so the sweep never looks like it checked a file it never opened.
        say(`${fork.dir}: NOT CHECKED — no ${rel} (the reference serves that tree and this fork does not)`);
        continue;
      }
      if (DIVERGENCES.some((d) => d.fork === fork.dir && d.layout === rel)) continue;
      const mounts = chromeMounts(code(readFileSync(forkFile, 'utf8')));
      if (mounts.length === 0) bare.push(rel);
      else for (const name of mounts) worn.set(name, [...(worn.get(name) ?? []), rel]);
    }

    assert.deepEqual(
      bare,
      [],
      `${fork.dir} SERVES A TREE BARE that the reference frames:\n${bare.map((r) => `    · ${r}`).join('\n')}\n\n` +
        '  Nothing wraps {children} there, so every URL that tree answers arrives with no header and no\n' +
        `  footer — including the one a shopper on this store's own host opens first. Two ways out, and both\n` +
        '  are decisions: mount the shop\'s chrome, or declare the divergence in DIVERGENCES above, with a\n' +
        '  reason somebody can read.',
    );

    const names = [...worn.keys()].sort();
    assert.deepEqual(
      names.length,
      1,
      `${fork.dir} WEARS ${names.length} DIFFERENT CHROMES, and which one a shopper gets is decided by the\n` +
        `  EDGE rather than by the shop:\n${names.map((n) => `    · <${n}> at ${worn.get(n).join(', ')}`).join('\n')}\n\n` +
        '  The reference storefront serves every store URL from two trees (PERF-B: the cacheable one for a\n' +
        '  clean catalogue request, the dynamic one for everything else) and they must render the same shop.\n' +
        '  A fork that re-wrote the header of one of them wrote half a front: the same URL then answers with\n' +
        "  this shop's body inside the reference vitrine's menu and logo, on precisely the pages a store with\n" +
        '  its own domain lands on.',
    );
    say(`${fork.dir}: <${names[0]}> at ${worn.get(names[0]).join(', ')}`);
  });
}
