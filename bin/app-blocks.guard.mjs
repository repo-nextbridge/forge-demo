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

import { ADMIN_SLOT, ADMIN_WIDGET_APPS, ADMIN_WIDGETS, APP_BLOCK_APPS, APP_BLOCKS, STOREFRONT } from './app-blocks.mjs';
import { hooksOf, parseHooks } from './app-manifest.mjs';
import { boardAuthority, datasetAdminWidgets } from './release-dataset.mjs';

const say = (line) => console.error(`[app-blocks] ${line}`);

/** Every app either fixture speaks for — the store blocks' and the admin board's — as ONE set, so a manifest
 *  an app on both lists declares is read once. */
const APPS = [...new Set([...APP_BLOCK_APPS, ...ADMIN_WIDGET_APPS])];

/** What each app declares at the pinned commit: `id -> { hooks, from } | { tried }`, asked for once. */
const DECLARED = new Map(APPS.map((id) => [id, hooksOf(id)]));

say(`fixture: ${APP_BLOCKS.length} block(s) across ${APP_BLOCK_APPS.join(', ')}`);
say(`board: ${ADMIN_WIDGETS.length} widget(s) at ${ADMIN_SLOT} from ${ADMIN_WIDGET_APPS.join(', ')}`);
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

// ── 3. the operator's board against the release (pk35/D6, pk36/D2) ──────────────────────────────────────
//
// ⛔ THE DEFECT, AND IT IS §2 OF THE SAME CARD THAT BOUGHT THIS FILE. pk34/D3 derived the STORE placements and
// left the admin home's seven widgets typed inside `bin/verify-seed.test.mjs`, under a sentence nothing could
// check. The remedy was already here: `hooksOf` returns the `admin:` hooks too — the rules above throw them
// away on purpose, which is not the same thing as nobody grading them.
//
// ⛔ AND pk36/D2 IS THE SECOND HALF OF THAT SAME MISS, measured 2026-09-14: pk35/D6 graded the board against
// the MANIFEST and only the manifest, while the seven names are also declared by the INSTANCE, in
// `<forge.lock → dataset.source>/storefront.json` → `admin_widgets` — the list `seed/widgets.mjs` hands
// `composition.reorder` at birth and `bin/verify-seed.mjs` grades a live tenant against. At the pinned commit
// the two are byte-identical, so the rule passed BY COINCIDENCE: reorder only the dataset and this file would
// have gone on asserting the manifest's order, green, about boards that open in another one.
//
// ★★★ THE ORDER HAS THREE OWNERS (his decision of 2026-09-14, after withdrawing a stronger one): the MANIFEST
// is the product's default, the DATASET is this instance's arrangement applied AT BIRTH, and COMPOSE is the
// merchant's last word that ⛔ nobody rewrites. So the fixture answers to the dataset when the dataset
// declares and to the manifests when it does not — and `boardAuthority` makes the run SAY WHICH, because an
// instrument that cannot name its own source is the defect this arc is named after.

/** The widgets one app declares at the admin home's slot, in the manifest's own order — `<app>/<component>`. */
const widgetsDeclaredBy = (id) =>
  DECLARED.get(id)
    .hooks.filter((hook) => hook.target === ADMIN_SLOT)
    .map((hook) => `${id}/${hook.component}`);

test('★★★ the choice between the two declarations is itself graded — and it can never be made in silence', () => {
  // ⛔ ANTI-VACUUM, AND IT IS DELIBERATELY FIRST AND PURE. Every rule below compares the fixture against
  // "whichever declaration won"; a resolver that always picked the manifest would satisfy all of them today,
  // because at this pinned commit the two lists are IDENTICAL. So the resolver is graded here on staged
  // inputs, on a machine with no Forge clone at all, and what is graded is that each branch NAMES its source.
  const manifest = { declared: ['a-app/one', 'a-app/two'], where: 'the pinned manifests of a-app' };

  const declares = boardAuthority({ declared: ['a-app/two', 'a-app/one'], where: 'ds/storefront.json @ abc' }, manifest);
  assert.deepEqual(declares.expected, ['a-app/two', 'a-app/one'], 'a declaring dataset outranks the default');
  assert.equal(declares.source, 'dataset');
  assert.match(declares.sentence, /THE DATASET ANSWERS: ds\/storefront\.json @ abc/);
  // ★ AND THE LOSER IS NAMED: a dataset that departs from the default says so, one that matches says that.
  assert.match(declares.sentence, /DEPARTS from the product default: the manifests place a-app\/one · a-app\/two/);
  const agrees = boardAuthority({ declared: [...manifest.declared], where: 'ds/storefront.json @ abc' }, manifest);
  assert.equal(agrees.source, 'dataset');
  assert.match(agrees.sentence, /IDENTICAL to the product default/);

  const silent = boardAuthority({ declared: [], where: 'ds/storefront.json @ abc' }, manifest);
  assert.deepEqual(silent.expected, manifest.declared, 'a dataset that declares nothing leaves the default standing');
  assert.equal(silent.source, 'manifest');
  // ★ AND IT SAYS SO. "Fell back" is the sentence that was missing: a run graded against the product default
  // while a reader believed it was graded against this instance is a green that means something else.
  assert.match(silent.sentence, /THE MANIFESTS ANSWER .* declares no admin_widgets/);

  const blind = boardAuthority({ tried: ['no clone holds the blob'] }, manifest);
  assert.deepEqual(blind.expected, manifest.declared);
  assert.equal(blind.source, 'manifest');
  assert.match(blind.sentence, /could not be read \(no clone holds the blob\)/);

  // ⛔ AND A MALFORMED DECLARATION IS NOT AN ABSENT ONE. Falling back there would grade the default while the
  // box born from that dataset is refused at seed time.
  assert.throws(
    () => boardAuthority({ declared: null, why: 'ds/storefront.json @ abc → admin_widgets is not a list of names' }, manifest),
    /unusable admin board.*is not a list of names/s,
  );
});

/** What the RELEASE'S OWN INSTANCE DATASET declares, read once — a git blob at the pinned commit. */
const DATASET_BOARD = datasetAdminWidgets();
say(
  DATASET_BOARD.tried
    ? `dataset: NOT READ — ${DATASET_BOARD.tried.join(' · ')}`
    : `dataset: ${DATASET_BOARD.declared?.length ?? 'unusable'} widget(s) from ${DATASET_BOARD.where}`,
);

test('★★★ the board fixture answers to the DATASET when it declares, to the MANIFESTS when it does not — and says which', (t) => {
  if (unreadable.length > 0) {
    t.skip(
      `NOT CHECKED — ${unreadable.map(([id, f]) => `${id}: ${f.tried.join('; ')}`).join(' | ')} ` +
        '(set FORGE_MONOREPO=<a Forge clone that has fetched the pinned commit>)',
    );
    return;
  }
  // ★ ORDER, NOT SET, and BOTH declarations say so. The manifest half is written in
  // `extensions/admin-dashboard/manifest.ts` (AJ4) — "THIS ARRAY'S ORDER IS THE HOME'S ORDER", because
  // `seedDefaultPlacements` walks the hooks in array order giving each `position = max(position) + 1`. The
  // dataset half is `composition.reorder`, which writes `position` in the order it is handed the placements.
  // A sorted comparison would go green on a board shuffled upstream, and the section of the verifier this
  // fixture feeds is ABOUT the order — pk35/D6 proved it with a sabotage a set comparison survived.
  const manifest = {
    declared: ADMIN_WIDGET_APPS.flatMap(widgetsDeclaredBy),
    where: `the pinned manifests of ${ADMIN_WIDGET_APPS.join(', ')}`,
  };
  const { expected, source, sentence } = boardAuthority(DATASET_BOARD, manifest);
  say(sentence);

  assert.deepEqual(
    ADMIN_WIDGETS,
    expected,
    `the board fixture and the ${source.toUpperCase()} disagree about the admin home. ${sentence}\n` +
      `  Fix \`ADMIN_WIDGETS\` in bin/app-blocks.mjs (and say in the commit WHICH widget moved, because a\n` +
      `  tenant that already has the app keeps the arrangement it has: the seed is idempotent per (store, ext,\n` +
      `  component, slot), \`composition.reorder\` runs at BIRTH, and nobody's home is silently rewritten).\n` +
      `  ⛔ Do not "fix" this by editing the release: the dataset is this instance's arrangement and the\n` +
      `  manifests are the product's default — this repository follows whichever of the two answered above.`,
  );

  // ⛔ AND THE WINNER IS CHECKED AGAINST WHAT THE RELEASE CAN ACTUALLY PLACE. Obeying the dataset blindly
  // would let a typo there drag this fixture along and keep the file green — while `seedAdminWidgets` refuses
  // that very list at birth ("an order applied to six of seven widgets is worse than none"). ⚠️ WHEN THE
  // MANIFESTS ANSWERED THIS IS TRUE BY CONSTRUCTION and it is said so here rather than hidden: the branch
  // that grades is the dataset's. It is folded into this test instead of standing as its own — a separate
  // rule would have to SKIP on a silent dataset, and a skip turns a legitimate product state into a red
  // under FORGE_STRICT_CHECKS.
  const publishable = new Set(APPS.flatMap(widgetsDeclaredBy));
  assert.ok(
    publishable.size > 0 && expected.length > 0,
    `nothing to compare: ${publishable.size} widget(s) published at ${ADMIN_SLOT} in this release and ` +
      `${expected.length} on the board the ${source} declares. A board rule over an empty release grades nothing.`,
  );
  const phantom = expected.filter((name) => !publishable.has(name));
  assert.deepEqual(
    phantom,
    [],
    `the ${source.toUpperCase()} names widget(s) no app of this release places at ${ADMIN_SLOT}: ` +
      `${phantom.join(', ')}. A box born from it would be REFUSED at seed time — seed/widgets.mjs fails ` +
      `rather than apply an order to the others. Published here: ${[...publishable].join(', ')}.`,
  );
});

test('★★ the board fixture SEES the slot — the release declares widgets there this list is right to leave out', (t) => {
  // ⛔ ANTI-VACUUM FOR THE RULE ABOVE, and it is not decoration: `ADMIN_WIDGET_APPS` is derived FROM the
  // fixture, so the comparison is confined to the apps the fixture already names. Confined to nothing it
  // would be `[] === []`. This proves the slot is SHARED — that some other app really does put a widget on
  // this board — which is also what makes the verifier's sabotage a sabotage: it stages
  // `subscriptions/latest_subscriptions` as the intruder on top, and an intruder that did not exist would
  // make that test a statement about a fiction.
  if (unreadable.length > 0) {
    t.skip(`NOT CHECKED — ${unreadable.map(([id]) => id).join(', ')} could not be read at the pinned commit`);
    return;
  }
  assert.ok(ADMIN_WIDGETS.length > 0, 'the board fixture is empty — there is nothing for the rule above to grade');
  const foreign = APPS.filter((id) => !ADMIN_WIDGET_APPS.includes(id)).flatMap(widgetsDeclaredBy);
  assert.ok(
    foreign.length > 0,
    `no app outside ${ADMIN_WIDGET_APPS.join(', ')} declares a widget at ${ADMIN_SLOT} in this release. Either ` +
      'the product stopped shipping them — in which case the verifier stages an intruder that cannot occur — ' +
      'or this reader is looking at the wrong manifests.',
  );
  say(`the board is shared: ${foreign.join(', ')} also land at ${ADMIN_SLOT} and are deliberately off the fixture`);
});
