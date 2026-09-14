// ★★★ THE ADMIN HOME'S WIDGET ORDER — the one thing about this box's admin that was decided by the ORDER ITS
// APPS HAPPENED TO BE INSTALLED IN.
//
// ⛔ THE DEFECT THIS FILE IS THE ANSWER TO, reported by the owner on 10/09 after using both admins: *"o bloco
// de últimas assinaturas na demo ainda está vindo no topo, o admin de café está certo mas o de sapato está
// errado."* Measured on the live box, `hook_placement` where `target_override = 'admin:admin.home.widgets'`:
//
//   forgeco  (shoes)  subs · bt-curator · revenue · recent · shipping · status · stores · promos · stock
//   forgecafe (coffee) bt-curator · revenue · recent · shipping · status · stores · promos · stock · subs
//
// ★★ AND THE COFFEE SHOP IS NOT RIGHT — IT IS LUCKY, which is the half that makes this a slice. Installing an
// app AUTO-PLACES its widgets at `coalesce(max(position)+1, 0)`, so a widget's position IS the order its app
// was installed in. `forge_control.extension_installation`, measured: `forgecafe` installed recommendations →
// admin-dashboard → subscriptions (last), `forgeco` installed subscriptions FIRST. Two tenants in two install
// states, and one of them happened to land on what the owner wanted. The coffee shop turns wrong the day
// somebody reorders `apps` in `seed/box.json` or `STOREFRONT_MANIFESTS` upstream, and NOTHING would say so.
//
// ── ★ WHY THE DEMO NEEDS ITS OWN STEP WHEN THE KERNEL ALREADY HAS ONE ────────────────────────────────────
//
// The kernel's `seedCuratedStorefront` applies this declaration (`orderAdminWidgets`, apps/api/src/seed-
// storefront.ts) — and it runs ONLY from `dist/seed-demo.js`, which `bin/box-up.sh` runs at step 9 for the
// DATASET tenants alone. `forgecafe` carries no dataset (`seed/box.json`: `dataset: false`), so step 9 never
// runs there and nothing has ever ordered its board. One tenant of two is the exact shape of "correct by
// accident": the step that exists reaches the brand the example data is about, and the brand this repository
// writes by hand is left to its install sequence.
//
// ⇒ So this step runs in the WINDOW phase, ONCE PER TENANT, from the SAME declaration. It is CONVERGENT with
//   step 9 and not redundant — the identical relationship `seed/vitrine.mjs` already has with that one-shot's
//   placement, and for the identical reason: two pieces deriving one answer from one declaration, the later
//   one winning if they ever disagree. ⛔ What would be a defect is a SECOND LIST: the seven names are in the
//   dataset, they are read from there, and nothing here types a widget name.
//
// ── ★★ WHY THE DECLARATION IS THE DATASET'S AND NOT `seed/box.json`'s ────────────────────────────────────
//
// Because it is already written there and read from there. `<dataset>/storefront.json` → `admin_widgets` is
// where the owner's evening of dragging widgets by hand was finally recorded (upstream, 09/09), and the
// kernel's step reads that key and no other. A copy in this repository would be a second declaration of one
// decision — and the one that goes stale is always the copy nobody's tooling validates.
//
// ⚠️ A BOX THAT MOUNTS NO DATASET DECLARES NOTHING, and that is a legitimate state, not a misconfiguration —
// the same rule `seedForge` and `seedVitrine` already write for the same env var. It is a logged no-op.
//
// ── THE ORDER IS A PREFIX, NEVER THE WHOLE BOARD ─────────────────────────────────────────────────────────
//
// The declaration names the seven widgets somebody decided about; every other instance keeps the relative
// place it had, after them. That is the kernel's own rule (`widgetOrder`) and it is why `subscriptions` falls
// to the end without the dataset ever naming it. A declaration that had to enumerate the widgets it does NOT
// care about would go stale the first time an app version adds one.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DATASET_DIR_ENV, datasetDir } from './forge.mjs';

/** The slot the admin home's widgets fill. `admin:` placements carry a NULL store in the kernel, so this is a
 *  TENANT-wide board: one pass per tenant, never one per shop. */
export const ADMIN_WIDGETS_SLOT = 'admin:admin.home.widgets';

/** The dataset key that carries the decision. Named once, read once. */
export const ADMIN_WIDGETS_KEY = 'admin_widgets';

/** The dataset file that carries it. ⛔ NAMED HERE AND NOWHERE ELSE: `bin/release-dataset.mjs` reads the same
 *  file out of the RELEASE at the pinned commit, and a second spelling of the name would let one of the two
 *  readers go on grading a file the other had stopped writing. */
export const STOREFRONT_DECL_FILE = 'storefront.json';

/**
 * ★ WHAT A PARSED `storefront.json` DECLARES — the shape half, with no filesystem under it.
 *
 * ⛔ IT IS A FUNCTION AND NOT FOUR LINES INSIDE THE READER BELOW because there are now TWO readers of this one
 * key: the seeder's (the dataset this box MOUNTS, from disk) and the guard's (the dataset the RELEASE carries,
 * from a git blob at the pinned commit — `bin/release-dataset.mjs`). Two copies of "what counts as a
 * declaration" is exactly the drift that let a fixture and a dataset disagree in silence.
 *
 * The three answers are kept APART, because collapsing the first two is how a guard goes green over nothing:
 *
 *   `{ declared: null, why: … }`  it is THERE and it is not a declaration — malformed, never read as empty.
 *   `{ declared: [], from }`      it was read and it declares NO order. The board keeps its install sequence.
 *   `{ declared: [names…], from }` the decision, in the order it is to appear.
 *
 * @param parsed {unknown} the parsed contents of a `storefront.json`
 * @param where {string} how to name that file in a sentence a human has to act on
 */
export function adminWidgetsIn(parsed, where) {
  const raw = parsed?.[ADMIN_WIDGETS_KEY];
  if (raw === undefined || raw === null) return { declared: [], from: where };
  if (!Array.isArray(raw) || raw.some((name) => typeof name !== 'string' || name.trim() === '')) {
    return { declared: null, why: `${where} → ${ADMIN_WIDGETS_KEY} is not a list of names` };
  }
  return { declared: raw.map((name) => name.trim()), from: where };
}

/**
 * ★ WHAT THE MOUNTED DATASET DECLARES — `adminWidgetsIn` above, with the door in front of it.
 *
 *   `{ declared: null, why: … }`  I COULD NOT LOOK — no dataset is mounted, or it holds no `storefront.json`.
 *   `{ declared: [] }`            it was read and it declares NO order. The board keeps its install sequence.
 *   `{ declared: [names…] }`      the decision, in the order it is to appear.
 *
 * @param env {Record<string,string|undefined>} so a test can aim this at a staged directory
 */
export function declaredAdminWidgets(env = process.env) {
  const dir = datasetDir(env);
  if (!dir) return { declared: null, why: `no ${DATASET_DIR_ENV} — this box mounts no example dataset` };
  const path = join(dir, STOREFRONT_DECL_FILE);
  if (!existsSync(path)) return { declared: null, why: `${path} does not exist` };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { declared: null, why: `${path} could not be parsed: ${error.message}` };
  }
  return adminWidgetsIn(parsed, path);
}

/** The key a declaration spells a widget with: `<app>/<component>`. */
export const widgetName = (row) => `${row.extension_id}/${row.component}`;

/**
 * The widget instances of the admin home slot, as the port answers them — PLACED ones only, in the order the
 * board holds them.
 *
 * ⚠️ `placement_id: null` IS NOT A WIDGET ON THE BOARD. `read.internal.extension_composition` is the admin
 * EDITOR's model: it also answers a manifest's declared hooks that nobody ever placed, and `composition.
 * reorder` writes `position` BY PLACEMENT ID. Handing it a null would update no row and report success —
 * exactly the silent half-applied order this whole file exists to end.
 */
export function widgetsOnBoard(rows) {
  return rows
    .filter((row) => row?.target === ADMIN_WIDGETS_SLOT && typeof row.placement_id === 'string')
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/**
 * ★★ THE RULE, PURE — the declared names first in the order given, then every other instance in the relative
 * order it already had. `missing` names a declared widget the board does not carry.
 *
 * It is the kernel's `widgetOrder` (apps/api/src/seed-storefront.ts) stated on this side of the port, because
 * this repository does not compile against the monorepo and must not grow an import of it. ⚠️ WHICH IS WHY THE
 * GUARD GRADES THE LIVE BOARD AND NOT THIS FUNCTION: if the two rules ever part company, what `bin/verify-
 * seed.mjs` reads back off the box is what decides, and it says which tenant.
 */
export function widgetOrder(current, declared) {
  const byName = new Map(current.map((row) => [widgetName(row), row.placement_id]));
  const missing = declared.filter((name) => !byName.has(name));
  const head = declared.flatMap((name) => {
    const id = byName.get(name);
    return id ? [id] : [];
  });
  const taken = new Set(head);
  return {
    ordered: [...head, ...current.map((row) => row.placement_id).filter((id) => !taken.has(id))],
    missing,
  };
}

/**
 * ★ WHAT THE BOARD SHOULD READ AS, given a declaration — the PREFIX, and nothing about the tail.
 *
 * Used by the verifier: comparing the whole board against the declaration would demand a tail order nobody
 * ever decided (the two tenants legitimately end with `subscriptions`/`bt-curator` in opposite order, because
 * that is the relative order each of them had). Returns the problem as a SENTENCE, or `null`.
 */
export function widgetPrefixProblem(current, declared) {
  if (declared.length === 0) return null;
  const onBoard = current.map(widgetName);
  const missing = declared.filter((name) => !onBoard.includes(name));
  if (missing.length > 0) {
    return (
      `${missing.length} declared widget(s) are not on this tenant's admin home: ${missing.join(', ')} — the ` +
      `order was applied to the others and these were quietly left out. On the board: ${onBoard.join(' · ')}`
    );
  }
  const head = onBoard.slice(0, declared.length);
  if (head.join('|') !== declared.join('|')) {
    return (
      `the admin home opens with ${head.join(' · ')} and the dataset declares ${declared.join(' · ')} — the ` +
      'widget order was never applied to this tenant, so its board is whatever order its apps were installed ' +
      `in. Whole board: ${onBoard.join(' · ')}`
    );
  }
  return null;
}

/**
 * APPLY the declared order to this tenant's admin home, through the port.
 *
 * @param port {{ tenant: string, store: string, command: Function, read: Function, rows: Function,
 *                log: Function, fail: Function, env?: Record<string,string|undefined> }}
 *   `store` is the tenant's ROOT store: `composition.reorder` takes one even for an `admin:` slot, where the
 *   kernel resolves the scope to the TENANT (`placementStore`) and the argument only has to be a store of it.
 */
export async function seedAdminWidgets(port) {
  const { tenant, store, command, read, rows, log, fail } = port;
  const { declared, why, from } = declaredAdminWidgets(port.env ?? process.env);
  if (declared === null) {
    log(`admin home — ${why}; the widget order stays as the installs left it. Legitimate state.`);
    return;
  }
  if (declared.length === 0) {
    log(`admin home — ${from} declares no ${ADMIN_WIDGETS_KEY}; the board keeps its install order.`);
    return;
  }

  const board = widgetsOnBoard(rows(await read('extension_composition', { store })));
  if (board.length === 0) {
    // ⛔ NOT A NO-OP. The declaration names widgets and the board carries none, so either `admin-dashboard`
    // was never installed on this tenant or the read answered about the wrong thing — and in both cases the
    // admin home this box hands over is empty. Saying "nothing to order" here is the vacuum that let a
    // tenant's board go ungraded for a whole wave.
    fail(
      `admin home — ${ADMIN_WIDGETS_SLOT} holds no placed widget on "${tenant}", and ${from} declares ` +
        `${declared.length}: ${declared.join(', ')}.\n` +
        '  A tenant with no widget on its admin home has an empty cockpit, which is not a state this box\n' +
        '  declares anywhere. `admin-dashboard` is what places them — it is installed from seed/box.json\n' +
        "  (`apps`) for a tenant the dataset is not about, and by step 9's curated seed for one it is.",
    );
  }

  const { ordered, missing } = widgetOrder(board, declared);
  if (missing.length > 0) {
    // The same refusal the kernel's step makes, for the same reason: an order applied to six of seven widgets
    // is worse than none, because the screen looks deliberate.
    fail(
      `admin home — ${missing.length} declared widget(s) are not on "${tenant}"'s board: ${missing.join(', ')}.\n` +
        `  Declared in ${from}; placed here: ${board.map(widgetName).join(', ')}.\n` +
        '  Fix the declaration, or install the app that publishes them — an order written over the others\n' +
        '  would leave these in an arbitrary place and look intentional.',
    );
  }

  const before = board.map(widgetName);
  await command('composition.reorder', { store, slot: ADMIN_WIDGETS_SLOT, ordered });
  log(
    `admin home — ${declared.join(' → ')} open the page (${ordered.length} widget(s) sequenced on "${tenant}")`,
  );
  if (before.slice(0, declared.length).join('|') !== declared.join('|')) {
    log(`admin home — it used to open with ${before.slice(0, declared.length).join(' · ')}`);
  }
}
