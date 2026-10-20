// A14 (the DATASET half) — THE BOX IS BORN WITHOUT THE MERCADO PAGO, AND WITHOUT LOSING ANYTHING ELSE.
//
// ★ THE INSTRUCTION, AND BOTH HALVES OF IT MATTER: this app does not need to arrive installed — it is an
// interesting feature that has to be EXPLAINED, so it belongs to a demo somebody gives on purpose, INSTALLED
// BY HAND at that moment. So the app must NOT be installed at birth and must REMAIN INSTALLABLE — which is
// why it stays on `composition.json`. An app absent from the composition has no row in the admin's Apps
// area, no command and no screen, so dropping it there would have removed the very gesture that was reserved.
//
// ⚠️ AND THE TWO APPS THIS MUST NOT TOUCH ARE NAMED, because both are one careless edit away:
//   · `payment-pos` is what the counter's TOTEM charges through. Removing it breaks the balcão.
//   · `payment-zero` serves a cart with nothing to pay, and the coffee tenant NEVER HAD IT — "the same for
//     the café" is about the Mercado Pago and only about it. Adding it there would be INVENTING a
//     capability under cover of removing one.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SEED = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SEED, '..');
const BOX = JSON.parse(readFileSync(join(SEED, 'box.json'), 'utf8'));
const COMPOSITION = JSON.parse(readFileSync(join(ROOT, 'composition.json'), 'utf8'));
const COFFEE = readFileSync(join(SEED, 'coffee.mjs'), 'utf8');

const MP = 'payment-mercadopago';

/** Everything this repository INSTALLS by hand, per tenant — the box's own lists, which is all it controls. */
const declaredApps = () =>
  BOX.tenants.flatMap((t) => (t.apps ?? []).map((id) => `${t.id}:${id}`));

test('★★★ no tenant of this box installs the Mercado Pago at birth', () => {
  const guilty = declaredApps().filter((entry) => entry.endsWith(`:${MP}`));
  assert.deepEqual(
    guilty,
    [],
    'seed/box.json still installs the Mercado Pago. The consequence is visible and was accepted: the ' +
      '«Pagar com» line disappears from the checkout, because with one provider per method there is no ' +
      'choice to offer.',
  );
  // …and the OTHER seeder that installs payment apps by hand is checked too, by reading it: `seed/coffee.mjs`
  // holds a literal list, and a second place to install is a second place to forget.
  assert.ok(!COFFEE.includes(MP), 'seed/coffee.mjs names the Mercado Pago in its APPS list');
});

test('★★★ …and it is STILL COMPOSED, so it can be installed by hand when somebody wants to show it', () => {
  // The half that is easy to get wrong: removing the app from the composition would ALSO stop it being
  // installed, and it would do it by deleting the app from the image. That is not the same outcome.
  assert.ok(
    COMPOSITION.apps.some((app) => app.id === MP),
    'the Mercado Pago left composition.json. It then has no row in the admin\'s Apps area, and installing ' +
      'it by hand to show it stops being possible — which was the condition the removal was accepted under.',
  );
});

test('⛔ `payment-pos` is untouched — it is what the counter’s totem charges through', () => {
  assert.ok(
    COFFEE.includes("'payment-pos'"),
    'seed/coffee.mjs no longer installs payment-pos. The balcão cannot take money without it.',
  );
  // ⚠️ IT IS AN **INSTANCE APP**, NOT A COMPOSED ONE, AND THE DISTINCTION IS A RED BUILD IF CONFUSED. This
  // repository WROTE it, so it reaches the bake by being adopted (`--instance-apps`); putting it on `apps`
  // collides with a release that already carries an app of that name and the oven refuses by name. Asserting
  // it in the wrong list would have been this test asking for the failure it exists to prevent.
  assert.ok(
    COMPOSITION.instanceApps.some((app) => app.id === 'payment-pos'),
    'payment-pos left `instanceApps` — the totem\'s payment provider is this box\'s own code, and nothing ' +
      'else carries it',
  );
  assert.ok(!COMPOSITION.apps.some((app) => app.id === 'payment-pos'));
});

test('⛔ `payment-zero` was neither removed from the shoe brand nor INVENTED in the café', () => {
  // It is installed in `forgeco` by the platform's own curated seeder (read off the composition), not by
  // this repository — so what this box can get wrong is inventing it where it never was.
  assert.ok(COMPOSITION.apps.some((app) => app.id === 'payment-zero'));
  const cafeApps = BOX.tenants.find((t) => t.id === 'forgecafe')?.apps ?? [];
  assert.ok(
    !cafeApps.includes('payment-zero'),
    'the coffee tenant now installs payment-zero. It never had it, and "the same for the café" was about ' +
      'the Mercado Pago — adding a capability is not removing one.',
  );
});

test('★ the simulator stays: a store with no payment app is a checkout with no method at all', () => {
  const cafeApps = BOX.tenants.find((t) => t.id === 'forgecafe')?.apps ?? [];
  assert.ok(
    cafeApps.includes('payment-reference'),
    'the coffee shop lost its last payment app — its cart would reach the payment step with nothing to pick, ' +
      'which reads as a broken checkout rather than as a missing install.',
  );
});

// ── v0.3.3 — THE OFFER IS PER STORE: the café stops offering the counter's driver, the counter keeps it ─────
//
// `payment.offer.set` (v0.3.3): a store with no row offers every installed payment app; a withheld one is not
// listed by `read.payment_methods` there and is refused at checkout (`payment_not_offered`). `seed/coffee.mjs`
// writes the café's row right after it installs `payment-pos`, and no row for the counter.

const { seedCoffee, withholdPayments, WITHHELD_HERE } = await import('./coffee.mjs');

const CAFE = { id: 'sto_cafe', handle: 'cafe' };
const BALCAO = { id: 'sto_balcao', handle: 'balcao' };

function fakePort(offers, answer = (input) => ({ ...input, position: null })) {
  const commands = [];
  const failures = [];
  return {
    commands,
    failures,
    port: {
      read: async (name) => (name === 'payment_offers' ? offers : null),
      command: async (name, input) => {
        commands.push({ name, input });
        return answer(input);
      },
      log: () => {},
      fail: (message) => {
        failures.push(message);
      },
    },
  };
}

const offersWith = (cafeOffered) => ({
  stores: [
    {
      store_id: CAFE.id,
      providers: [
        { app_id: 'payment-reference', methods: ['pix', 'card'], offered: true, position: null },
        { app_id: 'payment-pos', methods: ['pix', 'card'], offered: cafeOffered, position: null },
      ],
    },
    {
      store_id: BALCAO.id,
      providers: [
        { app_id: 'payment-reference', methods: ['pix', 'card'], offered: true, position: null },
        { app_id: 'payment-pos', methods: ['pix', 'card'], offered: true, position: null },
      ],
    },
  ],
});

test('★★ the café withholds `payment-pos` — one row, for the café, and none for the counter', async () => {
  assert.deepEqual(WITHHELD_HERE, ['payment-pos']);
  const { port, commands, failures } = fakePort(offersWith(true));
  await withholdPayments(port, CAFE);
  assert.deepEqual(failures, []);
  assert.deepEqual(commands, [
    { name: 'payment.offer.set', input: { store_id: CAFE.id, extension_id: 'payment-pos', offered: false } },
  ]);
  assert.ok(
    !commands.some((c) => c.input.store_id === BALCAO.id),
    'a row was written for the counter — the totem charges through payment-pos and must keep the default',
  );
});

test('★ a second run converges: an app the café already withholds costs no command', async () => {
  const { port, commands } = fakePort(offersWith(false));
  await withholdPayments(port, CAFE);
  assert.deepEqual(commands, []);
});

test('a read this seed does not recognise counts as «not withheld yet» — the upsert is sent', async () => {
  for (const offers of [null, {}, { stores: 'nope' }, { stores: [{ store_id: CAFE.id }] }]) {
    const { port, commands } = fakePort(offers);
    await withholdPayments(port, CAFE);
    assert.equal(commands.length, 1, `shape ${JSON.stringify(offers)} sent ${commands.length} command(s)`);
  }
});

test('⛔ THE CONTROL: a kernel that saves the app as still offered is a seed failure, not a log line', async () => {
  const { port, failures } = fakePort(offersWith(true), (input) => ({ ...input, offered: true }));
  await withholdPayments(port, CAFE);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /payment-pos/);
});

test('⛔ the offer is written AFTER the install — the kernel refuses an offer for an app not installed', async () => {
  // Driven through `seedCoffee` itself up to the point this rule is about: the order of the two writes.
  const order = [];
  const stop = new Error('stop after the two steps this test is about');
  await assert.rejects(
    seedCoffee({
      read: async (name) => {
        if (name === 'stores') return [CAFE, BALCAO];
        if (name === 'installed_extensions') return [];
        if (name === 'payment_offers') return offersWith(true);
        throw stop;
      },
      rows: (payload) => payload ?? [],
      command: async (name, input) => {
        order.push(name === 'extension.install' ? `install ${input.extension_id}` : name);
        return { ...input, position: null };
      },
      readAll: async () => {
        throw stop;
      },
      minted: { skusOf: () => [], productOf: () => undefined },
      log: () => {},
      fail: (message) => {
        throw new Error(message);
      },
    }),
    (error) => error === stop,
  );
  assert.ok(order.includes('install payment-pos'), `payment-pos was not installed: ${order.join(', ')}`);
  assert.ok(
    order.indexOf('payment.offer.set') > order.indexOf('install payment-pos'),
    `the offer was written before the install: ${order.join(' → ')}`,
  );
});
