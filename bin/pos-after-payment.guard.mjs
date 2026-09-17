// ★★ THE COUNTER MAY ONLY SPEAK FOR ITS OWN CHARGES — the rule, and the reason it needed a guard.
//
// WHAT HAPPENED (caderno pk21 §R3, 07/09, seen on the box itself). An order in the COFFEE
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
// ── WHOSE ANSWER IT IS (pk23/p4, the product half) ───────────────────────────────────────────────────────
//
// The confirmation slot compares WHO IT IS CALLING against WHO THE KERNEL SAYS CHARGED and hands each block
// the verdict as `settledByThisApp: 'yes' | 'no' | 'unknown'`. So this app never recognises its own id — which
// it could only do by HARDCODING it (an app cannot import its own manifest without dragging
// `@forgeco/contracts` into the front bundle), and a fork or a rename would then restore the class
// defect in silence.
//
// ⚠️ ONLY `'no'` IS SILENCE. `'unknown'` means the kernel named NOBODY — no payment intent was ever opened —
// and that is a real population on this very box, not a hole: `apps/api/src/seed-history.ts:551,676` leaves
// `pending_payment` orders at `place_order` and never calls `payment.initiate`. Reading it as silence would
// delete a screen that is not about anybody else's charge. The two answers are graded separately below, in
// both directions, because collapsing them is the one change that would look like tightening and be a bug.
//
// ── WHAT THIS FILE PROVES, AND WHY IT IS HERE RATHER THAN IN THE APP ─────────────────────────────────────
//
// ⚠️ THE SENTENCE THAT USED TO BE HERE IS NO LONGER TRUE, and it is left standing because it is the reason
// this file has the shape it has. Until pk24/d3 it read: `apps/payment-pos/` carries a vitest suite
// (`manifest.test.ts`, `provider.test.ts`) that NOTHING in this repository runs — `bash bin/test.sh` collects
// `bin/` and `seed/` `.mjs` only (bin/test.sh:33), and `bin/fork-suite.guard.mjs` / `bin/fork-typecheck.guard.mjs`
// both enumerate through `bin/forks.mjs`, which requires a dependency on the storefront kit that this app does
// not have. That was measured and it was correct: a rule written there ran only inside a `docker build`, weeks
// later, if at all.
//
// `bin/instance-app.guard.mjs` now runs both suites (23 tests) and compiles the app, out of the same
// `bash bin/test.sh`. ⇒ THE CONSTRAINT THIS FILE WAS DESIGNED AROUND IS GONE, and what remains is a
// DECISION nobody has taken: whether the rule below belongs beside the code it grades. It is not taken here
// because moving it is a different diff from the one that made moving it possible.
//
// That is why the DECISION lives in `apps/payment-pos/after-payment-notice.ts`, JSX-free, and this guard
// imports and RUNS it: Node strips types from a `.ts` on import and refuses JSX outright. The product's own
// four payment apps keep the line inline, correctly — over there a suite reaches them. The markup half is held
// to the split structurally, below.
//
// ── ⚠️ THE NAME AND THE THREE MEMBERS ARE A CONTRACT WITH THE OTHER REPOSITORY ────────────────────────────
//
// `settledByThisApp` and `'yes' | 'no' | 'unknown'` are declared in BOTH repositories (an app never imports
// the storefront) and no CI crosses them. A renamed member is the dangerous one: `=== 'no'` would simply stop
// matching, every test here would stay green, and the defect would be back on the box.
//
//   FORGE_MONOREPO=<a Forge checkout> node --test bin/pos-after-payment.guard.mjs   ← grades the two halves
//
// It is OPT-IN rather than searched for on purpose: the pinned tree this box's other guards use
// (`bin/release-tree.mjs`) is the commit the images were BAKED from, which may predate the product half — and
// a check against "whatever tree was lying around" is not a measurement.
//
//   node --test bin/pos-after-payment.guard.mjs        (or: bash bin/test.sh)

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { afterPaymentNotice } from '../apps/payment-pos/after-payment-notice.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'apps', 'payment-pos');
const BLOCK = readFileSync(join(APP, 'after-payment.tsx'), 'utf8');
const NOTICE = readFileSync(join(APP, 'after-payment-notice.ts'), 'utf8');

/** The sentence the whole slice is about. Written out here, verbatim, because a guard that only knew the
 *  CONDITION would go green on a "fix" that softened the copy — which the brief rules out explicitly: the
 *  words are correct for somebody who paid at a counter. */
const COUNTER_SENTENCE = 'Retire no balcão quando chamarmos o seu nome.';

/** The PIX envelope this app's own provider mints, as the block receives it. */
const OUR_PIX = { type: 'pos_pix_qr', data: { copy_paste: '00020126-forge-demo-pix' } };

/** The three neutral statuses a confirmation can carry, and what this app says about each when it may speak. */
const WHEN_ALLOWED_TO_SPEAK = [
  ['approved', { kind: 'approved' }],
  ['rejected', { kind: 'rejected' }],
  ['pending', { kind: 'waiting', copyPaste: null }],
];

// ── 1. the verdict decides, and only `'no'` is silence ──────────────────────────────────────────────────

test("★★ THE POSITIVE CONTROL: 'yes' — the counter still speaks for the counter’s own charge", () => {
  // ⚠️ THE RULE AGAINST THE VACUUM, and it is the first one to read. The section below expects `null`, so a
  // "fix" that made this block draw NOTHING EVER — or a decision module that threw its subject away — would
  // satisfy all of it and leave the app broken in the opposite direction. This is the test that is red for
  // that. The sentence the defect printed is the RIGHT sentence here.
  for (const [status, expected] of WHEN_ALLOWED_TO_SPEAK) {
    assert.deepEqual(afterPaymentNotice({ settledByThisApp: 'yes', status }), expected);
  }
  assert.deepEqual(
    afterPaymentNotice({ settledByThisApp: 'yes', status: 'pending', nextAction: OUR_PIX }),
    { kind: 'waiting', copyPaste: OUR_PIX.data.copy_paste },
    'a PIX this counter is waiting on still shows its own copy-paste — that is the whole point of the block.',
  );
});

test("★★ THE DEFECT: 'no' — a charge another app took draws nothing at the counter", () => {
  // The reported order, reproduced. An approved CARD is exactly what the old condition matched on, and it stays
  // matched — what changed is that the method is no longer the question.
  for (const [status] of WHEN_ALLOWED_TO_SPEAK) {
    assert.equal(
      afterPaymentNotice({ settledByThisApp: 'no', status, nextAction: OUR_PIX }),
      null,
      `another installed payment app settled this order ('${status}') and the counter's block drew anyway. ` +
        `That is the pk21 §R3 defect: "${COUNTER_SENTENCE}" printed over a delivery address, because the ` +
        `block asked what the METHOD was instead of who was PAID. Only 'no' is silence, and this is 'no'.`,
    );
  }
});

test("★★ AND 'unknown' IS NOT 'no' — an order nobody charged still gets its screen", () => {
  // ⚠️ THE REVERSAL, GRADED. This slice was first written with `unknown` as silence, on the argument that a
  // front which had not threaded the field was the state that printed the sentence over a delivery address.
  // pk23/p4 killed that argument by making the slot's own `providerAppId` REQUIRED and never defaulted
  // (apps/checkout/src/lib/payment-blocks/AfterPaymentSlot.tsx:55), so a render site that does not know has to
  // say so. `unknown` stopped meaning "nobody told us" and now means "no charge was recorded".
  //
  // And the population is real on this box: `apps/api/src/seed-history.ts:551,676` leaves `pending_payment`
  // orders at `place_order` and never calls `payment.initiate` — dozens of them, rendered by the account's
  // order page (`apps/checkout/src/templates/order/OrderTemplate.tsx:688`) as well as the confirmation.
  for (const [status, expected] of WHEN_ALLOWED_TO_SPEAK) {
    assert.deepEqual(
      afterPaymentNotice({ settledByThisApp: 'unknown', status }),
      expected,
      `an order with no payment intent ('${status}') got SILENCE. 'unknown' is not 'no': nobody was named, ` +
        `which is not the same claim as somebody else having been. Reading it as a denial deletes a screen.`,
    );
  }
});

test("★ an ABSENT verdict behaves as 'unknown' — a front that predates the field renders as it always did", () => {
  for (const [status, expected] of WHEN_ALLOWED_TO_SPEAK) {
    assert.deepEqual(afterPaymentNotice({ status }), expected);
  }
});

test('★ the block never recognises its OWN id — that comparison belongs to the render site', () => {
  // An app that hardcoded its id would survive a rename or a fork with the defect quietly restored, which is
  // exactly why pk23/p4 put the comparison in the slot. A literal 'payment-pos' in the decision is that
  // mistake coming back.
  assert.ok(
    !/'payment-pos'|"payment-pos"/.test(NOTICE),
    'after-payment-notice.ts hardcodes this app\'s own id. The verdict arrives ready (settledByThisApp); an ' +
      'app that recognises itself by a typed-in name is one rename away from the pk21 §R3 defect, in silence.',
  );
});

// ── 2. the markup half asks; it does not decide ─────────────────────────────────────────────────────────

test('★★ after-payment.tsx routes every verdict through the decision module', () => {
  assert.match(
    BLOCK,
    /import \{[\s\S]*?afterPaymentNotice[\s\S]*?\} from '\.\/after-payment-notice'/,
    'the block no longer imports afterPaymentNotice — whatever it draws now, this guard is not grading it.',
  );
  assert.match(
    BLOCK,
    /afterPaymentNotice\(\{/,
    'the block imports the decision and never calls it. A gate nothing invokes is not a gate.',
  );
  assert.match(
    BLOCK,
    /settledByThisApp = 'unknown'/,
    "the block must default settledByThisApp to 'unknown', like the product's own blocks do — an absent " +
      'verdict is not a denial.',
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

// ── 3. the other repository, when the operator names it ─────────────────────────────────────────────────

test('★★ the product half declares the field and the members this app reads (FORGE_MONOREPO=<checkout>)', (t) => {
  const forge = process.env.FORGE_MONOREPO;
  const registry = forge && join(forge, 'apps/checkout/src/lib/payment-blocks/registry.tsx');
  if (!registry || !existsSync(registry)) {
    t.skip(
      'NOT CHECKED — no FORGE_MONOREPO. The field name and its three members are declared in BOTH ' +
        'repositories and no CI crosses them: `FORGE_MONOREPO=~/path/to/forge bash bin/test.sh` grades it.',
    );
    return;
  }
  const source = readFileSync(registry, 'utf8');
  const props = source.match(/export type AfterPaymentProps = \{[\s\S]*?\n\};/)?.[0];
  assert.ok(props, `${registry} no longer declares AfterPaymentProps — this check has lost its subject.`);
  assert.match(
    props,
    /\bsettledByThisApp\b/,
    "the checkout's AfterPaymentProps does not declare `settledByThisApp`, which is the field " +
      'apps/payment-pos/after-payment.tsx reads to answer "was this charge mine?". Either the product half ' +
      '(pk23/p4-provedor) is not in this tree, or it renamed the field — in which case the fix is the prop ' +
      "name in this app. Until they agree, this box's counter block speaks for other apps' charges again.",
  );
  // The dangerous half: a RENAMED MEMBER breaks nothing loudly. `=== 'no'` would stop matching, every test
  // above would stay green, and the block would be back to speaking for somebody else's money.
  const union = source.match(/export type SettledByThisApp =[^;]*;/)?.[0];
  assert.ok(
    union,
    `${registry} no longer exports the SettledByThisApp union — this app declares its own copy of it and has ` +
      'nothing left to compare against.',
  );
  for (const member of ['yes', 'no', 'unknown']) {
    assert.match(
      union,
      new RegExp(`'${member}'`),
      `the product's SettledByThisApp no longer carries '${member}' (${union.trim()}). This app compares ` +
        `\`=== 'no'\` and defaults to 'unknown'; a renamed member makes that comparison match nothing, in ` +
        'silence, with every test in this file still green.',
    );
  }
});
