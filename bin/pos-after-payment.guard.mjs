// ★★ THE COUNTER MAY ONLY SPEAK FOR ITS OWN CHARGES — the rule, and the reason it needed a guard.
//
// WHAT HAPPENED (caderno pk21 §R3, 07/09, reported by the owner in front of the box). An order in the COFFEE
// store, paid by CARD through `payment-reference`, with Entrega Expressa and a delivery address in Alphaville,
// was answered by the confirmation with:
//
//     "Pagamento confirmado. Retire no balcão quando chamarmos o seu nome."
//
// directly above the block naming the carrier and Friday's estimate. The sentence belongs to `payment-pos`,
// this box's own counter app, which had not been paid a cent of that order.
//
// The block gated on `method !== 'pix' && method !== 'card'` — and `method` is the NEUTRAL kernel method, a
// house-wide vocabulary that says nothing about WHO was paid. Installing a payment app is TENANT-wide, so the
// condition matched every card and every PIX order of every store of the tenant. ⛔ And the fix is not the
// copy: the sentence is right for somebody who paid at a counter. What was wrong is who it reached.
//
// ── WHAT THIS FILE PROVES, AND WHY IT IS HERE RATHER THAN IN THE APP ─────────────────────────────────────
//
// `apps/payment-pos/` carries a vitest suite (`manifest.test.ts`, `provider.test.ts`) that NOTHING in this
// repository runs — measured: `bash bin/test.sh` collects `bin/` and `seed/` `.mjs` only (bin/test.sh:26),
// `bin/fork-suite.guard.mjs` and `bin/fork-typecheck.guard.mjs` both enumerate through `bin/forks.mjs`, which
// requires a dependency on the storefront kit that this app does not have, and the app cannot install a
// `node_modules` outside the monorepo anyway (its contracts dependency is `workspace:*`). So a rule written
// there is a rule that runs only inside a `docker build`, weeks later, if at all.
//
// This box could not afford that for a rule about who is allowed to speak on a confirmation screen. So the
// DECISION lives in `apps/payment-pos/after-payment-notice.ts`, JSX-free, and this guard imports and RUNS it:
// Node strips types from a `.ts` on import and refuses JSX outright, which is the whole reason the split
// exists. The markup half is held to the split structurally, below.
//
// ── ⚠️ THE NAME THIS APP READS IS A CONTRACT WITH THE OTHER REPOSITORY, AND NOBODY SYNCHRONISES IT ────────
//
// The block is told who charged through a prop named `providerAppId`, which is the camelCase of
// `read.payment`'s `provider_app_id` (packages/core/src/read/payment-capabilities.ts:43 in the monorepo) and
// the continuation of the three props the confirmation slot already passes (`method`, `status`, `nextAction`
// — `apps/checkout/src/lib/payment-blocks/registry.tsx`, `AfterPaymentProps`). The product half that threads
// it is `pk23/p4-provedor`, developed in PARALLEL with this one and in another repository, and there is no CI
// across the two.
//
// ⇒ if the product named it something else, the correct fix is ONE line: the prop name in
// `apps/payment-pos/after-payment.tsx`. Nothing else in this repository knows it.
// ⇒ `FORGE_MONOREPO=<a Forge checkout> node --test bin/pos-after-payment.guard.mjs` grades the two halves
// against each other. It is OPT-IN rather than searched for on purpose: the pinned tree this box's other
// guards use (`bin/release-tree.mjs`) is the commit the images were BAKED from, which by construction
// predates the product half — and a check against "whatever tree was lying around" is not a measurement.
//
//   node --test bin/pos-after-payment.guard.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  afterPaymentNotice,
  APP_ID,
  chargeOwner,
} from '../apps/payment-pos/after-payment-notice.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'apps', 'payment-pos');
const BLOCK = readFileSync(join(APP, 'after-payment.tsx'), 'utf8');

/** The sentence the whole slice is about. Written out here, verbatim, because a guard that only knew the
 *  CONDITION would go green on a "fix" that softened the copy — which the brief rules out explicitly: the
 *  words are correct for somebody who paid at a counter. */
const COUNTER_SENTENCE = 'Retire no balcão quando chamarmos o seu nome.';

/** A charge some OTHER app took, named so every failure below can say whose money it was talking about. */
const SOMEBODY_ELSE = 'payment-reference';

/** The PIX envelope this app's own provider mints, as the block receives it. */
const OUR_PIX = { type: 'pos_pix_qr', data: { copy_paste: '00020126-forge-demo-pix' } };

// ── 1. the app is who it says it is ──────────────────────────────────────────────────────────────────────

test('APP_ID is the id the manifest and the composition already use — one name, three files', () => {
  // The decision module compares an id the kernel sends against a STRING. A string that drifted from the
  // manifest would make this app silent everywhere and look, from the outside, exactly like the bug being
  // fixed: a block that never draws.
  const manifest = readFileSync(join(APP, 'manifest.ts'), 'utf8');
  assert.ok(
    manifest.includes(`id: '${APP_ID}'`),
    `after-payment-notice.ts calls this app '${APP_ID}', and apps/payment-pos/manifest.ts does not declare that id.`,
  );
  const composition = JSON.parse(readFileSync(join(ROOT, 'composition.json'), 'utf8'));
  const listed = (composition.instanceApps ?? []).map((app) => app.id);
  assert.ok(
    listed.includes(APP_ID),
    `composition.json's instanceApps does not list '${APP_ID}' — it lists ${listed.join(', ') || '(nothing)'}.`,
  );
});

// ── 2. whose charge is it — three answers, and the third is not the second ───────────────────────────────

test('★ the kernel naming US is the only thing that reads as ours', () => {
  assert.equal(chargeOwner(APP_ID), 'us');
});

test(`★ the kernel naming ${SOMEBODY_ELSE} reads as another app's charge`, () => {
  assert.equal(
    chargeOwner(SOMEBODY_ELSE),
    'another-app',
    `a charge ${SOMEBODY_ELSE} took must be legible as somebody else's, or the counter cannot stay out of it.`,
  );
});

test('★★ ABSENCE IS NOT A DENIAL — nothing said is `unknown`, never `another-app`', () => {
  // The distinction the brief asked for out loud: an order with no provider at all (a zero-value order, a
  // pay-on-delivery one) and a front that has not threaded the field are not the same claim as "somebody
  // else was paid", and collapsing them would make this app's silence unreadable.
  for (const nothing of [undefined, null, '', 0, false, {}]) {
    assert.equal(
      chargeOwner(nothing),
      'unknown',
      `${JSON.stringify(nothing) ?? 'undefined'} is nobody having said who charged — it is not a denial and it is not a name.`,
    );
  }
});

// ── 3. what the block draws — RUN, not read ─────────────────────────────────────────────────────────────

test('★★ THE POSITIVE CONTROL: the counter still speaks for the counter’s own charge', () => {
  // ⚠️ THE RULE AGAINST THE VACUUM, and it is the first one to read. Every other assertion in this section
  // expects `null`, so a "fix" that made this block draw NOTHING EVER — or a decision module that threw its
  // subject away — would satisfy all of them and leave the app broken in the opposite direction. This is the
  // test that has to be red for that. The sentence the owner saw is the RIGHT sentence here.
  assert.deepEqual(afterPaymentNotice({ providerAppId: APP_ID, method: 'card', status: 'approved' }), {
    kind: 'approved',
  });
  assert.deepEqual(afterPaymentNotice({ providerAppId: APP_ID, method: 'card', status: 'rejected' }), {
    kind: 'rejected',
  });
  assert.deepEqual(
    afterPaymentNotice({
      providerAppId: APP_ID,
      method: 'pix',
      status: 'pending',
      nextAction: OUR_PIX,
    }),
    { kind: 'waiting', copyPaste: OUR_PIX.data.copy_paste },
    'a PIX this counter is waiting on still shows its own copy-paste — that is the whole point of the block.',
  );
});

test(`★★ THE DEFECT: a CARD charge ${SOMEBODY_ELSE} took draws nothing at the counter`, () => {
  // The owner's order, reproduced. `method: 'card'` and `status: 'approved'` are exactly what the old
  // condition matched on, and they stay matched — what changed is that they are no longer the question.
  assert.equal(
    afterPaymentNotice({ providerAppId: SOMEBODY_ELSE, method: 'card', status: 'approved' }),
    null,
    `${SOMEBODY_ELSE} settled this order and the counter's block drew anyway. That is the pk21 §R3 defect: ` +
      `"Retire no balcão quando chamarmos o seu nome." printed over a delivery address, because the block ` +
      `asked what the METHOD was instead of who was PAID.`,
  );
});

test(`★ and neither does a PIX ${SOMEBODY_ELSE} is waiting on`, () => {
  assert.equal(
    afterPaymentNotice({
      providerAppId: SOMEBODY_ELSE,
      method: 'pix',
      status: 'pending',
      nextAction: { type: 'reference_pix', data: { copy_paste: 'not-ours' } },
    }),
    null,
    `${SOMEBODY_ELSE}'s PIX is not this counter's PIX, and its envelope is not this counter's to read.`,
  );
});

test(`★ nor a rejection ${SOMEBODY_ELSE} took — "fale com o atendente do balcão" has no balcão to point at`, () => {
  assert.equal(
    afterPaymentNotice({ providerAppId: SOMEBODY_ELSE, method: 'card', status: 'rejected' }),
    null,
  );
});

test('★★ THE VACUUM: an order nobody charged is not an order WE charged', () => {
  // A zero-value order, a pay-on-delivery one, or a front that has not threaded the field. Silence, and the
  // reason is written where the decision is made: every sentence this block prints CLAIMS money changed hands
  // at a counter of this box, and a claim needs evidence rather than the absence of a denial.
  for (const nothing of [undefined, null, '']) {
    for (const status of ['approved', 'pending', 'rejected']) {
      assert.equal(
        afterPaymentNotice({ providerAppId: nothing, method: 'card', status }),
        null,
        `nobody said who charged (${JSON.stringify(nothing) ?? 'the prop is absent'}) and the counter spoke ` +
          `anyway on a '${status}' order. Drawing on ignorance IS the defect — it is not the fallback for it.`,
      );
    }
  }
});

// ── 4. the markup half asks; it does not decide ─────────────────────────────────────────────────────────

test('★★ after-payment.tsx routes every verdict through the decision module', () => {
  assert.match(
    BLOCK,
    /import \{ afterPaymentNotice[^}]*\} from '\.\/after-payment-notice'/,
    'the block no longer imports afterPaymentNotice — whatever it draws now, this guard is not grading it.',
  );
  assert.match(
    BLOCK,
    /afterPaymentNotice\(\{/,
    'the block imports the decision and never calls it. A gate nothing invokes is not a gate.',
  );
});

test('★★ THE SABOTAGE THE DEFECT WOULD BE: no second opinion about method or status in the markup', () => {
  // This is the rule that makes the fix stick. Restoring `if (method !== 'pix' && method !== 'card')` — or
  // adding any other comparison beside the one the module makes — puts two gates where only one is the truth,
  // and the weaker one is what let the sentence out. The prop stays in the shape (it is part of the role's
  // contract); comparing it here is what is forbidden.
  const offenders = [...BLOCK.matchAll(/\b(method|status)\s*(===|!==)\s*'[^']*'/g)].map((m) => m[0]);
  assert.deepEqual(
    offenders,
    [],
    `after-payment.tsx decides for itself again: ${offenders.join(', ')}. Who may speak is ` +
      `afterPaymentNotice()'s answer alone — the neutral method is the house's vocabulary, not this app's identity.`,
  );
});

test('⛔ and the counter’s sentence is UNCHANGED — the copy was never the defect', () => {
  assert.ok(
    BLOCK.includes(COUNTER_SENTENCE),
    `"${COUNTER_SENTENCE}" is gone from the block. Softening the words is not the fix: they are correct for ` +
      `somebody who paid at this counter, and the defect was that they reached somebody who did not.`,
  );
});

// ── 5. the other repository, when the operator names it ─────────────────────────────────────────────────

test('★★ the product half threads the prop this app reads (FORGE_MONOREPO=<checkout> to grade it)', (t) => {
  const forge = process.env.FORGE_MONOREPO;
  const registry = forge && join(forge, 'apps/checkout/src/lib/payment-blocks/registry.tsx');
  if (!registry || !existsSync(registry)) {
    t.skip(
      'NOT CHECKED — no FORGE_MONOREPO. The prop name below is a contract with another repository and no CI ' +
        'crosses the two: `FORGE_MONOREPO=~/path/to/forge bash bin/test.sh` grades it.',
    );
    return;
  }
  const props = readFileSync(registry, 'utf8').match(
    /export type AfterPaymentProps = \{[\s\S]*?\n\};/,
  )?.[0];
  assert.ok(props, `${registry} no longer declares AfterPaymentProps — this check has lost its subject.`);
  assert.match(
    props,
    /\bproviderAppId\b/,
    "the checkout's AfterPaymentProps does not declare `providerAppId`, which is the name " +
      'apps/payment-pos/after-payment.tsx reads to answer "was this charge mine?". Either the product half ' +
      '(pk23/p4-provedor) has not landed, or it named the field something else — in which case the fix is ' +
      'one line, the prop name in after-payment.tsx. Until they agree, this box\'s counter block is silent ' +
      'on every order, including its own.',
  );
});
