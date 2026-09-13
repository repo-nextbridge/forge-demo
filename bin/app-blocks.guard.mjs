// ★★ pk34/D3 — THE FIXTURE THAT SAYS WHERE AN APP'S BLOCKS LAND, GRADED AGAINST THE RELEASE THAT PLACES THEM.
//
// ⛔ THE DEFECT, MEASURED 2026-09-12. The owner moved `subscriptions/my_subscriptions` from `account.top` to
// `account.bottom` on 11/09 — a one-line change to the manifest, IN THE PRODUCT. This repository's only
// mention of that placement is a fixture (`bin/app-blocks.mjs`, then inside `bin/verify-seed.test.mjs`), and
// nothing here could notice: the fixture went on asserting the old slot, green, describing a bench that no
// longer exists. On the live box of that day all four stores — `forge`, `outlet`, `cafe`, `balcao` — carried
// the row at `account.bottom`, born there by `extension.install` from the pinned image.
//
// ⇒ SO THE FIXTURE IS NOT THE SUBJECT OF THIS FILE. The subject is that NOTHING DERIVED IT. A list typed in
// one repository about a declaration that lives in another rots silently by construction, and the way this
// house ends that is not "remember to edit both" — it is a rule that reads the declaration.
//
// ── WHERE THE TRUTH IS READ FROM, AND WHY IT IS NOT "a Forge checkout" ──────────────────────────────────
//
// `hooksOf` (bin/app-manifest.mjs) reads `extensions/<app>/manifest.ts` AT THE COMMIT `forge.lock` pins —
// the commit the running images were baked from, and therefore the manifest the kernel on this bench is
// actually validating against. ⚠️ THAT DISTINCTION IS NOT ACADEMIC HERE: on the machine this was written on,
// the monorepo's `main` still said `account.top` while the pinned `v03/integra@d981dee6a` said
// `account.bottom`. A guard that had graded "whatever tree was lying around" would have called the CORRECT
// fixture wrong, and been believed.
//
// A machine with no clone that holds the pinned commit gets NOT CHECKED, by name. Never a silent green.
//
//   node --test bin/app-blocks.guard.mjs        (or: bash bin/test.sh)
//   FORGE_MONOREPO=~/path/to/forge node --test bin/app-blocks.guard.mjs

import assert from 'node:assert/strict';
import test from 'node:test';

import { APP_BLOCK_APPS, APP_BLOCKS, STOREFRONT } from './app-blocks.mjs';
import { hooksOf, parseHooks } from './app-manifest.mjs';

const say = (line) => console.error(`[app-blocks] ${line}`);

/** What each app declares at the pinned commit: `id -> { hooks, from } | { tried }`, asked for once. */
const DECLARED = new Map(APP_BLOCK_APPS.map((id) => [id, hooksOf(id)]));

say(`fixture: ${APP_BLOCKS.length} block(s) across ${APP_BLOCK_APPS.join(', ')}`);
for (const [id, found] of DECLARED) {
  say(found.tried ? `${id}: NOT READ — ${found.tried.join(' · ')}` : `${id}: ${found.hooks.length} hook(s) from ${found.from}`);
}

/** The apps this run could not read, with the reason — the sentence a skip has to carry. */
const unreadable = [...DECLARED].filter(([, found]) => found.tried);

// ── 1. the parser, which runs on EVERY machine ──────────────────────────────────────────────────────────

test('★ the reader sees a `hooks` array, its targets, and the difference between the two surfaces', () => {
  // ⛔ ANTI-VACUUM, AND IT IS THE FIRST RULE ON PURPOSE. Every rule below is "the fixture equals what the
  // manifest declares"; a reader that returned [] for a manifest it did not understand would satisfy all of
  // them against nothing. This grades the reader itself, on a source this file owns, so a machine with no
  // Forge clone still proves the instrument works.
  const source = [
    "const SHARED = [{ component: 'spread', target: 'storefront:pdp.below_buybox' }] as const;",
    'export const manifest = {',
    "  blocks: [{ component: 'ignored', surface: 'storefront', config_schema: [] }],",
    '  hooks: [',
    "    { component: 'one', target: 'storefront:account.bottom' },",
    '    ...SHARED,',
    "    { component: 'board', target: 'admin:admin.home.widgets' }, // an operator's face, never a shopper's",
    '  ],',
    '};',
  ].join('\n');
  const hooks = parseHooks(source, 'a fixture in app-blocks.guard.mjs');
  assert.deepEqual(
    hooks.map((h) => `${h.component}@${h.target}`),
    ['one@storefront:account.bottom', 'spread@storefront:pdp.below_buybox', 'board@admin:admin.home.widgets'],
    'the reader must follow a spread of a top-level const and must NOT stop at the `blocks` array above it',
  );
  assert.equal(hooks.filter((h) => h.target.startsWith(STOREFRONT)).length, 2);
});

test('★ the reader refuses a manifest it did not understand instead of answering []', () => {
  // The other half of the same sentence: silence is the failure mode this house catalogues, so the reader has
  // to be unable to stay quiet. A `hooks` array that is gone, and one whose entries lost a field.
  assert.throws(
    () => parseHooks('export const manifest = { blocks: [] };', 'no-hooks.ts'),
    /declares no `hooks` array/,
  );
  assert.throws(
    () => parseHooks("export const manifest = { hooks: [{ component: 'x' }] };", 'half.ts'),
    /without `component` and `target`/,
  );
});

// ── 2. the fixture against the release ──────────────────────────────────────────────────────────────────

test('★★★ every block of the fixture is where the PINNED manifest places it', (t) => {
  if (unreadable.length > 0) {
    t.skip(
      `NOT CHECKED — ${unreadable.map(([id, f]) => `${id}: ${f.tried.join('; ')}`).join(' | ')} ` +
        '(set FORGE_MONOREPO=<a Forge clone that has fetched the pinned commit>)',
    );
    return;
  }
  // Sorted, because the CLAIM is the set of (app, component, target) triples and not the order somebody typed
  // them in. A manifest that reorders its hooks changes nothing a store sees.
  const key = (a, c, t2) => `${a}/${c} @ ${t2}`;
  const declared = APP_BLOCK_APPS.flatMap((id) =>
    DECLARED.get(id)
      .hooks.filter((h) => h.target.startsWith(STOREFRONT))
      .map((h) => key(id, h.component, h.target)),
  ).sort();
  const fixture = APP_BLOCKS.map(([app, component, target]) => key(app, component, target)).sort();

  assert.deepEqual(
    fixture,
    declared,
    'the fixture and the release disagree about where an app places its blocks. The manifest is the truth — ' +
      'it is what `extension.install` materializes on a store — so this repository follows it: fix ' +
      '`bin/app-blocks.mjs` (and say in the commit WHICH block moved, because the bench born before the move ' +
      'keeps the row it has: `default_placement_seed` remembers the offer and no migration rewrites a ' +
      "merchant's arrangement).",
  );
});

test('★★ the fixture speaks for the SHOPPER only — an `admin:` hook in it is the pk31/3e defect returning', () => {
  // A rule and not a comment, because the sentence it replaces was a comment and comments do not go red.
  // `subscriptions/latest_subscriptions` is seeded once per TENANT with a NULL store; counting it as a store
  // block is what made an earlier verifier expect five rows per store and accuse a correct box of four.
  const operatorFacing = APP_BLOCKS.filter(([, , target]) => !target.startsWith(STOREFRONT));
  assert.deepEqual(
    operatorFacing,
    [],
    'these are not blocks a store shows. An `admin:` hook is placed once per tenant with a null store, so ' +
      'staging it as a store row makes the verifier expect a placement that is not there.',
  );
});

test('★★ and the omission is REAL — the release declares admin hooks this fixture is right to leave out', (t) => {
  // ⛔ ANTI-VACUUM FOR THE RULE ABOVE. "No admin hook in the fixture" is trivially true of a list nobody ever
  // had the chance to get wrong. This proves there IS something to leave out — and if a release ever stops
  // declaring one, the rule above stops being a statement and this goes red to say so.
  if (unreadable.length > 0) {
    t.skip(`NOT CHECKED — ${unreadable.map(([id]) => id).join(', ')} could not be read at the pinned commit`);
    return;
  }
  const omitted = APP_BLOCK_APPS.flatMap((id) =>
    DECLARED.get(id)
      .hooks.filter((h) => !h.target.startsWith(STOREFRONT))
      .map((h) => `${id}/${h.component} @ ${h.target}`),
  );
  assert.ok(
    omitted.length > 0,
    'no app of this fixture declares a hook outside the storefront, so "the fixture omits the admin hooks" ' +
      'grades nothing. Either the release stopped shipping admin widgets — in which case the rule above is ' +
      'about a world that is gone — or this reader is looking at the wrong manifests.',
  );
  say(`deliberately outside the fixture: ${omitted.join(', ')}`);
});
