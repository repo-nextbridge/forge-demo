// ★★ v031/H29 — ONE BLOCK, TWO PLACES: the plan matches placements by (component, SLOT), and stays idempotent.
//
//   node --test seed/blocks.test.mjs        (or: bash bin/test.sh)
//
// ⛔ THE DEFECT THE OLD KEY WOULD HAVE BEEN. `planBlocks` matched what was placed by COMPONENT alone. With the
// demonstration notice declared in the shop's chrome AND in the funnel (`seed/demo-setup.json`), the second
// declaration found the FIRST placement, «updated» it, and never placed itself: the checkout would carry no
// notice and every birth would report it dressed. These tests drive the real hand (`seedDeclaredBlocks`) over
// a port that REMEMBERS what was placed — the second run is asked of the state the first one left — and hold
// the refusal that keeps a `single` block from being declared twice.

import assert from 'node:assert/strict';
import test from 'node:test';

import { blocksFor, multiSlotProblems, planBlocks, seedDeclaredBlocks, slotsOf } from './blocks.mjs';
import { DEMO_SETUP, placementOf } from './demo-setup.mjs';

const RIBBON = 'demo_ribbon';
const SHOP = 'storefront:footer.end';
const FUNNEL = 'storefront:checkout.bottom';

/** A minimal declaration: one repeatable block in two slots, one single block in one. */
const spec = (ribbonSlots = [SHOP, FUNNEL]) => ({
  app: 'demo-setup',
  slots: { header_brand: 'storefront:header.brand', [RIBBON]: ribbonSlots },
  stores: { forge: { header_brand: { text: 'forge' }, [RIBBON]: {} } },
});
const PLACEMENT = { header_brand: 'single', [RIBBON]: 'repeatable' };
const placement = (c) => PLACEMENT[c];

/** The rows `read.extension_composition` would answer after placing `plan` — `target` is the slot. */
const rowsAfter = (plan) =>
  plan.map((step, i) => ({
    extension_id: 'demo-setup',
    placement_id: `hp_${i}`,
    component: step.component,
    target: step.slot,
    enabled: true,
    config: step.config,
  }));

test('★★★ a block declared in TWO slots is planned as TWO placements — one per slot', () => {
  const plan = planBlocks(blocksFor(spec(), 'forge'), []);
  assert.deepEqual(
    plan.filter((s) => s.component === RIBBON).map((s) => `${s.action} ${s.slot}`),
    [`place ${SHOP}`, `place ${FUNNEL}`],
  );
});

test('★★★ …and a second run over what the first placed plans NOTHING — not one place, not one update', () => {
  const first = planBlocks(blocksFor(spec(), 'forge'), []);
  assert.deepEqual(planBlocks(blocksFor(spec(), 'forge'), rowsAfter(first)), []);
});

test('★★ a box that already wears the notice in the shop gets ONLY the funnel placement (the stag box today)', () => {
  // The state a box born before v031/H29 is in: the notice in `footer.end`, nothing in the funnel.
  const before = rowsAfter(planBlocks(blocksFor(spec([SHOP]), 'forge'), []));
  const plan = planBlocks(blocksFor(spec(), 'forge'), before);
  assert.deepEqual(plan.map((s) => `${s.action} ${s.component}@${s.slot}`), [`place ${RIBBON}@${FUNNEL}`]);
});

test('⛔ a `single` block declared in two slots is REFUSED, naming the block — and nothing is written', async () => {
  const bad = { ...spec(), slots: { ...spec().slots, header_brand: ['storefront:header.brand', 'storefront:footer.brand'] } };
  const problems = multiSlotProblems(bad, placement);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /demo-setup\/header_brand is declared in 2 slots .* placement 'single'/);
  // ⟂ the repeatable one beside it is NOT accused.
  assert.ok(!problems[0].includes(RIBBON));
  // …and with no manifest consulted, a list is never accepted on faith.
  assert.match(multiSlotProblems(spec(), undefined)[0], new RegExp(`${RIBBON} .* \\(unknown`));

  // Driven: the refusal comes BEFORE the install, the upload or any placement.
  const calls = [];
  await assert.rejects(
    seedDeclaredBlocks(bad, {
      command: async (name) => calls.push(name),
      read: async () => [],
      readAll: async () => [],
      rows: (x) => x,
      log: () => {},
      fail: (m) => {
        throw new Error(m);
      },
      placementOf: placement,
    }),
    /refusing the declaration: demo-setup\/header_brand/,
  );
  assert.deepEqual(calls, [], 'something was written before the declaration was refused');
});

test('⛔ a placement read back with NO `target` is refused — it would re-place every block, forever', () => {
  const rows = rowsAfter(planBlocks(blocksFor(spec(), 'forge'), [])).map(({ target: _t, ...row }) => row);
  assert.throws(() => planBlocks(blocksFor(spec(), 'forge'), rows), /with no `target`/);
});

test('`slots` keeps reading a single string as one slot — chrome.json and the marks are unchanged', () => {
  assert.deepEqual(slotsOf(spec(), 'header_brand'), ['storefront:header.brand']);
  assert.deepEqual(slotsOf(spec(), RIBBON), [SHOP, FUNNEL]);
  assert.deepEqual(slotsOf(spec(), 'nothing'), []);
});

test('★★★ DRIVEN over the REAL declaration and manifest: birth places the funnel notice per shop; the re-run writes nothing', async () => {
  // A stateful fake port: `composition.place` appends a row the composition read then answers, with the slot
  // as `target` — exactly the shape `read.extension_composition` publishes (target_override ?? declared).
  const stores = [
    { id: 'sto_forge', handle: 'forge' },
    { id: 'sto_outlet', handle: 'outlet' },
    { id: 'sto_cafe', handle: 'cafe' },
    { id: 'sto_balcao', handle: 'balcao' },
  ];
  const rows = [];
  const writes = [];
  const port = {
    command: async (name, input) => {
      writes.push({ name, input });
      if (name === 'composition.place') {
        rows.push({ extension_id: input.extension_id, component: input.component, target: input.slot, store: input.store, placement_id: `hp_${rows.length}`, enabled: true, config: input.config });
      }
      return {};
    },
    read: async (name, params) => {
      if (name === 'installed_extensions') return writes.some((w) => w.name === 'extension.install') ? [{ extension_id: 'demo-setup', status: 'active' }] : [];
      if (name === 'stores') return stores;
      if (name === 'extension_composition') return rows.filter((r) => r.store === params.store);
      throw new Error(`unexpected read ${name}`);
    },
    readAll: async () => [],
    rows: (x) => x,
    log: () => {},
    fail: (m) => {
      throw new Error(m);
    },
    placementOf: placementOf(DEMO_SETUP.app),
  };
  // ⟂ ANTI-VACUUM on the declaration this is about: the notice really is in the funnel, as a repeatable block.
  assert.ok(slotsOf(DEMO_SETUP, RIBBON).includes(FUNNEL), `seed/demo-setup.json does not place ${RIBBON} in ${FUNNEL}`);
  assert.equal(port.placementOf(RIBBON), 'repeatable');

  await seedDeclaredBlocks(DEMO_SETUP, port);
  const funnel = writes.filter((w) => w.name === 'composition.place' && w.input.slot === FUNNEL).map((w) => w.input.store).sort();
  assert.deepEqual(funnel, ['sto_cafe', 'sto_forge', 'sto_outlet'], 'the funnel notice is not on exactly the three shops with a checkout');

  writes.length = 0;
  await seedDeclaredBlocks(DEMO_SETUP, port);
  assert.deepEqual(
    writes.filter((w) => w.name.startsWith('composition.')).map((w) => `${w.name} ${w.input.component}@${w.input.slot ?? ''}`),
    [],
    'the second run wrote — the plan is not idempotent',
  );
});
