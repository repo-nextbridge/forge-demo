// ★★★ THE ADMIN HOME'S WIDGET ORDER, AND THE ONE THING THIS SUITE EXISTS TO STOP: "some tenant is right".
//
// ⛔ THE DEFECT, measured on the live box of 10/09 after the owner reported it from the screen. The two boards
// came back in DIFFERENT orders, and only one of them was what he wanted:
//
//   forgeco  (shoes)  subs · bt-curator · revenue · recent · shipping · status · stores · promos · stock 🔴
//   forgecafe (coffee) bt-curator · revenue · recent · shipping · status · stores · promos · stock · subs ✅
//
// ★★ AND THE GREEN ONE IS THE DANGEROUS ONE. Installing an app auto-places its widgets at the END of the slot,
// so a widget's position IS the order its app was installed in — `forgecafe` installed `subscriptions` last and
// `forgeco` installed it first. Nothing had decided anything. ⇒ A rule asked as "does SOME tenant look right?"
// is green on this box today and says nothing; every test below therefore asks it of ONE BOARD AT A TIME and
// requires the answer to NAME which.
//
// ⚠️ AND A RULE THAT PASSES BECAUSE IT FOUND NO WIDGET IS THE SAME FAILURE ONE LAYER DOWN. An empty board
// satisfies every comparison here vacuously, so the vacuum has its own tests — both in the rule and in what
// the seeder does when it meets one.

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  ADMIN_WIDGETS_KEY,
  ADMIN_WIDGETS_SLOT,
  declaredAdminWidgets,
  seedAdminWidgets,
  widgetName,
  widgetOrder,
  widgetPrefixProblem,
  widgetsOnBoard,
} from './widgets.mjs';
import { DATASET_DIR_ENV } from './forge.mjs';

/** One widget instance as `read.internal.extension_composition` answers it — `target`, never `slot`. */
const widget = (app, component, position, extra = {}) => ({
  extension_id: app,
  component,
  target: ADMIN_WIDGETS_SLOT,
  position,
  placement_id: `hp_${app}_${component}`,
  enabled: true,
  ...extra,
});

/** The SEVEN the mounted dataset declares, in the order the owner left them. Spelled here because this is the
 *  SHAPE under test and the real file is a monorepo file a machine running this suite may not have — the same
 *  posture `bin/verify-seed.test.mjs` takes with `storefront.json`. */
const DECLARED = [
  'admin-dashboard/revenue',
  'admin-dashboard/recent_orders',
  'admin-dashboard/shipping',
  'admin-dashboard/order_status',
  'admin-dashboard/stores_sales',
  'admin-dashboard/promos',
  'admin-dashboard/stock',
];

/** `forgeco`'s board as it was MEASURED on 10/09 — `subscriptions` first, because its app was installed first. */
const FORGECO_BOARD = [
  widget('subscriptions', 'latest_subscriptions', 0),
  widget('recommendations', 'bt_curator', 1),
  widget('admin-dashboard', 'revenue', 2),
  widget('admin-dashboard', 'recent_orders', 3),
  widget('admin-dashboard', 'shipping', 4),
  widget('admin-dashboard', 'order_status', 5),
  widget('admin-dashboard', 'stores_sales', 6),
  widget('admin-dashboard', 'promos', 7),
  widget('admin-dashboard', 'stock', 8),
];

/** `forgecafe`'s board as it was MEASURED on 10/09 — the seven first, by the accident of its install order. */
const FORGECAFE_BOARD = [
  widget('recommendations', 'bt_curator', 0),
  ...DECLARED.map((name, i) => widget('admin-dashboard', name.split('/')[1], i + 1)),
  widget('subscriptions', 'latest_subscriptions', 8),
];

/** A dataset directory holding one `storefront.json`, and the env that points at it. */
function mount(storefront) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-widgets-'));
  if (storefront !== undefined) {
    writeFileSync(join(dir, 'storefront.json'), JSON.stringify(storefront));
  }
  return { dir, env: { [DATASET_DIR_ENV]: dir } };
}

// ── 1 · THE DECLARATION: READ, ABSENT, AND "I COULD NOT LOOK" ARE THREE ANSWERS ───────────────────────────

test('★★ the declaration keeps "could not look" apart from "declares none"', () => {
  // ⛔ COLLAPSING THESE IS THE VACUUM. A box with no dataset and a box whose dataset declares nothing both
  // leave the board alone — but only the second one is a DECISION, and a verifier that cannot tell them apart
  // reports "not judged" over a dataset that was there all along.
  assert.equal(declaredAdminWidgets({}).declared, null, 'an unmounted dataset must answer "I could not look"');
  assert.match(declaredAdminWidgets({}).why, new RegExp(DATASET_DIR_ENV));

  const empty = mount({ store: 'forge' });
  assert.deepEqual(declaredAdminWidgets(empty.env).declared, [], 'a file with no admin_widgets declares none');

  const gone = mount(undefined);
  assert.equal(declaredAdminWidgets(gone.env).declared, null);
  assert.match(declaredAdminWidgets(gone.env).why, /storefront\.json/);

  const full = mount({ store: 'forge', [ADMIN_WIDGETS_KEY]: DECLARED });
  assert.deepEqual(declaredAdminWidgets(full.env).declared, DECLARED);
  assert.match(declaredAdminWidgets(full.env).from, /storefront\.json$/);
});

test('a declaration that is not a list of names is "could not look", never an empty decision', () => {
  // Reading garbage as "declares none" would silently hand the board back to the install sequence — which is
  // exactly the state this whole module replaces, reached by a typo nobody is told about.
  for (const bad of [{ [ADMIN_WIDGETS_KEY]: 'admin-dashboard/revenue' }, { [ADMIN_WIDGETS_KEY]: [''] }, { [ADMIN_WIDGETS_KEY]: [1] }]) {
    const m = mount({ store: 'forge', ...bad });
    assert.equal(declaredAdminWidgets(m.env).declared, null, `${JSON.stringify(bad)} must not read as a decision`);
  }
});

// ── 2 · THE BOARD: ONLY WHAT IS PLACED, AND ONLY THIS SLOT ───────────────────────────────────────────────

test('★ a hook nobody placed is NOT on the board — `composition.reorder` writes by placement id', () => {
  // ⚠️ MEASURED SHAPE, NOT A GUESS: `read.internal.extension_composition` is the admin EDITOR's model and also
  // answers a manifest's declared hooks with `placement_id: null`. Handing one of those to the reorder would
  // update no row and report success — a half-applied order that looks deliberate on the screen.
  const rows = [
    widget('admin-dashboard', 'revenue', 0),
    { ...widget('admin-dashboard', 'ghost', 1), placement_id: null },
    { ...widget('banners', 'banner', 0), target: 'storefront:home.hero' },
  ];
  assert.deepEqual(widgetsOnBoard(rows).map(widgetName), ['admin-dashboard/revenue']);
});

// ── 3 · THE RULE: A PREFIX, AND IT NAMES WHAT IS MISSING ─────────────────────────────────────────────────

test('★★★ the declared names come first and everything else keeps the order it had', () => {
  const { ordered, missing } = widgetOrder(FORGECO_BOARD, DECLARED);
  assert.deepEqual(missing, []);
  // The seven, then the two nobody decided about, in the relative order they were in.
  const byId = new Map(FORGECO_BOARD.map((w) => [w.placement_id, widgetName(w)]));
  assert.deepEqual(ordered.map((id) => byId.get(id)), [
    ...DECLARED,
    'subscriptions/latest_subscriptions',
    'recommendations/bt_curator',
  ]);
});

test('★★ a declared widget the board does not carry comes back MISSING, never silently skipped', () => {
  const { missing } = widgetOrder(FORGECO_BOARD, [...DECLARED, 'admin-dashboard/moon_phase']);
  assert.deepEqual(missing, ['admin-dashboard/moon_phase']);
});

test('★★★ BOTH boards the box really held are RED against the declaration — the café only hid it better', () => {
  // ⚠️ THIS IS WHERE THE MEASUREMENT BEAT THE BRIEF. The card said the coffee admin "está certo (por sorte)" and
  // the shoe one is wrong. Graded against what the dataset DECLARES, both are wrong: `forgeco` opens with
  // `subscriptions/latest_subscriptions` (the one the owner SAW) and `forgecafe` opens with
  // `recommendations/bt_curator`, while the declaration opens with `admin-dashboard/revenue`. The café was not
  // right and not even lucky — it was wrong in a place nobody was looking, which is the whole argument for
  // grading per tenant instead of asking whether some tenant looks acceptable.
  const coffee = widgetPrefixProblem(FORGECAFE_BOARD, DECLARED);
  assert.ok(coffee, 'the coffee board opens with bt_curator and the declaration does not');
  assert.match(coffee, /recommendations\/bt_curator/);
  const shoes = widgetPrefixProblem(FORGECO_BOARD, DECLARED);
  assert.ok(shoes, 'the shoe board opens with subscriptions and must NOT be accepted');
  assert.match(shoes, /subscriptions\/latest_subscriptions/);
  assert.match(shoes, /never applied to this tenant/);
  // ★ AND A BOARD THAT HAS BEEN ORDERED IS ACCEPTED — otherwise the rule is a rule that always says no. The
  // TAIL is deliberately left in both orders the two tenants legitimately have.
  const ordered = (tail) => [
    ...DECLARED.map((name, i) => widget('admin-dashboard', name.split('/')[1], i)),
    ...tail,
  ];
  assert.equal(widgetPrefixProblem(ordered([widget('subscriptions', 'latest_subscriptions', 7), widget('recommendations', 'bt_curator', 8)]), DECLARED), null);
  assert.equal(widgetPrefixProblem(ordered([widget('recommendations', 'bt_curator', 7), widget('subscriptions', 'latest_subscriptions', 8)]), DECLARED), null);
});

test('★★ ANTI-VACUUM · an EMPTY board does not satisfy a declaration', () => {
  // ⛔ The half that would make every test above decoration. `widgetPrefixProblem([], DECLARED)` has to be a
  // problem: an admin home with no widget is not an admin home whose order is fine.
  const problem = widgetPrefixProblem([], DECLARED);
  assert.ok(problem, 'an empty board came back as "no problem" — the rule is blind, not lenient');
  assert.match(problem, /not on this tenant's admin home/);
  // And a board that declares NOTHING is genuinely no problem — the one case where silence is a decision.
  assert.equal(widgetPrefixProblem([], []), null);
});

// ── 4 · THE SEEDER: WHAT IT DRIVES, AND THAT IT KNOWS HOW TO SAY NO ─────────────────────────────────────

/** A port that records what it was asked, over a board the test hands it. */
function port(board, env, { tenant = 'forgeco' } = {}) {
  const calls = [];
  const logs = [];
  return {
    calls,
    logs,
    tenant,
    store: 'sto_root',
    env,
    command: async (name, input) => {
      calls.push({ name, input });
      return {};
    },
    read: async () => ({ items: board }),
    rows: (payload) => payload.items,
    log: (line) => logs.push(line),
    fail: (message) => {
      throw new Error(message);
    },
  };
}

test('★★★ the order is written for the tenant whose board is wrong, from the dataset and not from a list here', async () => {
  const m = mount({ store: 'forge', [ADMIN_WIDGETS_KEY]: DECLARED });
  const p = port(FORGECO_BOARD, m.env);
  await seedAdminWidgets(p);
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].name, 'composition.reorder');
  assert.equal(p.calls[0].input.slot, ADMIN_WIDGETS_SLOT);
  assert.equal(p.calls[0].input.store, 'sto_root');
  const byId = new Map(FORGECO_BOARD.map((w) => [w.placement_id, widgetName(w)]));
  assert.deepEqual(p.calls[0].input.ordered.slice(0, 7).map((id) => byId.get(id)), DECLARED);
  assert.ok(p.logs.some((l) => /it used to open with/.test(l)), 'a board that MOVED says what it moved from');
});

test('★ it runs for the tenant the dataset is NOT about — the half step 9 can never reach', async () => {
  // `forgecafe` carries no dataset (`seed/box.json`: dataset:false), so `dist/seed-demo.js` never runs there
  // and `orderAdminWidgets` never sees that board. This is the reason this module exists on this side.
  const m = mount({ store: 'forge', [ADMIN_WIDGETS_KEY]: DECLARED });
  const p = port(FORGECAFE_BOARD, m.env, { tenant: 'forgecafe' });
  await seedAdminWidgets(p);
  assert.equal(p.calls.length, 1);
  assert.ok(p.logs.some((l) => /forgecafe/.test(l)), 'the log names the tenant whose board it wrote');
  assert.ok(
    p.logs.some((l) => /it used to open with recommendations\/bt_curator/.test(l)),
    'the coffee board DID move — it opened with bt_curator, which nobody had declared',
  );
});

test('★ a board already in the declared order is converged in silence — the rule can say YES', async () => {
  // Otherwise every green above proves only that the rule refuses everything.
  const m = mount({ store: 'forge', [ADMIN_WIDGETS_KEY]: DECLARED });
  const settled = [
    ...DECLARED.map((name, i) => widget('admin-dashboard', name.split('/')[1], i)),
    widget('subscriptions', 'latest_subscriptions', 7),
  ];
  const p = port(settled, m.env);
  await seedAdminWidgets(p);
  assert.equal(p.calls.length, 1, 'the write is idempotent by construction: same ids, same positions');
  assert.ok(!p.logs.some((l) => /it used to open with/.test(l)), 'nothing moved, so nothing is reported moved');
});

test('★★ an unmounted dataset is a logged no-op and NOT a failure', async () => {
  const p = port(FORGECO_BOARD, {});
  await seedAdminWidgets(p);
  assert.deepEqual(p.calls, []);
  assert.ok(p.logs.some((l) => new RegExp(DATASET_DIR_ENV).test(l)));
});

test('★★★ ANTI-VACUUM · an EMPTY board REFUSES, naming the tenant — it never reports "nothing to order"', async () => {
  const m = mount({ store: 'forge', [ADMIN_WIDGETS_KEY]: DECLARED });
  const p = port([], m.env, { tenant: 'forgecafe' });
  await assert.rejects(
    () => seedAdminWidgets(p),
    (err) => {
      assert.match(err.message, /forgecafe/, 'the refusal must name WHICH tenant has the empty cockpit');
      assert.match(err.message, /no placed widget/);
      return true;
    },
  );
  assert.deepEqual(p.calls, [], 'nothing was written');
});

test('★★ a declared widget this board does not carry REFUSES, naming it', async () => {
  const m = mount({ store: 'forge', [ADMIN_WIDGETS_KEY]: [...DECLARED, 'admin-dashboard/moon_phase'] });
  const p = port(FORGECO_BOARD, m.env);
  await assert.rejects(
    () => seedAdminWidgets(p),
    (err) => {
      assert.match(err.message, /moon_phase/);
      assert.match(err.message, /forgeco/);
      return true;
    },
  );
  assert.deepEqual(p.calls, [], 'an order applied to six of seven widgets is worse than none');
});

// ── 5 · THE WIRING — the step is really in the phase whose position makes it correct ─────────────────────

test('★★ `bin/seed.mjs` runs this in the WINDOW phase, after the installs', async () => {
  // ⚠️ THE POSITION IS THE CORRECTNESS, so it is graded and not trusted: an install auto-places its widgets at
  // the END of the slot, and the last installs of a tenant's birth happen in this phase (`seedVitrine` →
  // `installApps`) and in step 9 between the two. A call moved into the `curated` phase would write an order
  // with strangers appended to it, and every test above would still be green.
  const { readFileSync } = await import('node:fs');
  const { dirname, join: j } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = j(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(j(root, 'bin/seed.mjs'), 'utf8');
  const window = src.indexOf("if (phase === 'window') {");
  const call = src.indexOf('seedAdminWidgets({');
  assert.ok(window > 0, 'bin/seed.mjs no longer has a window phase to put this in');
  assert.ok(call > window, 'seedAdminWidgets is no longer called inside the window phase');
  const purge = src.indexOf('purgeStorefrontCache({ api, read, rows, log });', window);
  assert.ok(call < purge, 'it must run BEFORE the cache bust that closes the phase');
});
