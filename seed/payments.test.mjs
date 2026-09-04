// A14 (the DATASET half) — THE BOX IS BORN WITHOUT THE MERCADO PAGO, AND WITHOUT LOSING ANYTHING ELSE.
//
// ★ HIS WORDS, AND BOTH HALVES OF THEM MATTER: «não precisa vir instalado, é feature interessante mas precisa
// ser explicada, aí quando eu quiser fazer uma demo pra alguém EU INSTALO MANUALMENTE e mostro». So the app
// must NOT be installed at birth and must REMAIN INSTALLABLE — which is why it stays on `composition.json`.
// An app absent from the composition has no row in the admin's Apps area, no command and no screen, so
// dropping it there would have removed the very gesture he reserved for himself.
//
// ⚠️ AND THE TWO APPS THIS MUST NOT TOUCH ARE NAMED, because both are one careless edit away:
//   · `payment-pos` is what the counter's TOTEM charges through. Removing it breaks the balcão.
//   · `payment-zero` serves a cart with nothing to pay, and the coffee tenant NEVER HAD IT — «mesma coisa
//     para o café» is about the Mercado Pago and only about it. Adding it there would be INVENTING a
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

test('★★★ …and it is STILL COMPOSED, so he can install it by hand when he wants to show it', () => {
  // The half that is easy to get wrong: removing the app from the composition would ALSO stop it being
  // installed, and it would do it by deleting the app from the image. That is not the same outcome.
  assert.ok(
    COMPOSITION.apps.some((app) => app.id === MP),
    'the Mercado Pago left composition.json. It then has no row in the admin\'s Apps area, and «eu instalo ' +
      'manualmente e mostro» stops being possible — which was the condition he accepted the removal under.',
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
    'the coffee tenant now installs payment-zero. It never had it, and «mesma coisa para o café» was about ' +
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
