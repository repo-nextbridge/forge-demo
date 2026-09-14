// ★★ WHAT THE COUNTER'S CONFIRMATION BLOCK SAYS — including the case where it must say nothing at all.
//
// THE DEFECT THIS EXISTS FOR, AND IT WAS SEEN ON THE BENCH, ON SCREEN (caderno pk21 §R3). An order in
// the COFFEE store — `payment-reference`, card, Entrega Expressa, a delivery address in Alphaville — was
// answered with:
//
//     "Pagamento confirmado. Retire no balcão quando chamarmos o seu nome."
//
// printed directly above the block showing the carrier and Friday's estimate. The sentence is this app's, and
// it was correct about nothing: nobody stood at a counter, and this app never saw a cent of that order.
//
// THE CAUSE WAS THE QUESTION, NOT THE COPY. The block gated on `method !== 'pix' && method !== 'card'`, and
// `method` is the NEUTRAL kernel method — `pix | card | promissory | zero` for the whole house, so "the order
// was paid by card" says nothing about WHO was paid. Installing a payment app is TENANT-wide, so the
// condition matched every card and every PIX order of every store of the tenant.
//
// ⛔ CHANGING THE SENTENCE WOULD NOT HAVE FIXED IT. The sentence is right for somebody who paid at a counter.
// What was wrong is that it reached somebody who did not.
//
// ── ★★ THE ANSWER ARRIVES; THIS APP DOES NOT WORK IT OUT (pk23/p4, the product half) ──────────────────────
//
// The confirmation slot now compares WHO IT IS CALLING against WHO THE KERNEL SAYS CHARGED, and hands each
// block the verdict as `settledByThisApp`. The comparison belongs there and not here, and the reason is worth
// keeping written down: an app that recognised its own id would have to HARDCODE that id — it cannot import
// its own manifest without dragging `@forgecommerce/contracts` into the front bundle — and then a fork or a
// rename would put the class defect back in silence. This app therefore knows the answer without knowing its
// own name.
//
// ⚠️ ONLY `'no'` IS SILENCE, AND `'unknown'` IS NOT `'no'`. This is the opposite of the rule this slice was
// first written with, and the reversal is deliberate:
//
//   · `'no'` — the kernel named a DIFFERENT app. Speaking here is speaking for somebody else's money.
//   · `'unknown'` — the kernel named NOBODY: no payment intent was ever opened. Measured on this box's own
//     data, that is a real and legitimate population, not a hole: `apps/api/src/seed-history.ts:551,676`
//     leaves `pending_payment` orders at `place_order` and never calls `payment.initiate`, so the demo's own
//     history carries dozens of orders with no intent at all — and they are rendered, by the account's order
//     page as well as the confirmation. Falling silent there would delete a screen that is not about anybody
//     else's charge.
//   · The first version of this file read `'unknown'` as silence, on the argument that a front which had not
//     threaded the field was exactly the state that printed the sentence over a delivery address. THAT
//     ARGUMENT IS DEAD, and p4 is what killed it: the slot's own `providerAppId` is REQUIRED and never
//     defaulted (`apps/checkout/src/lib/payment-blocks/AfterPaymentSlot.tsx:55`), so a render site that does
//     not know has to say so. `'unknown'` stopped meaning "nobody told us" and now means "no charge was
//     recorded" — a fact, not an absence of one.
//
// ── WHY THE DECISION LIVES IN A `.ts` AND THE MARKUP IN THE `.tsx` NEXT DOOR ──────────────────────────────
//
// So that a test can RUN it, and this is about THIS repository's tooling rather than about the pattern above.
// The demo box has no package manager and no bundler: `bash bin/test.sh` hands `*.test.mjs`/`*.guard.mjs` to
// `node --test`, and Node strips types from a `.ts` on import while refusing JSX outright. Measured — that is
// why `apps/payment-pos/*.test.ts` (vitest) is collected by nothing here and only ever runs inside a monorepo
// build. A rule about who may speak on a confirmation screen is not one this box can leave un-run. The
// product's four payment apps keep the line inline (`extensions/payment-reference/after-payment.tsx:55`)
// because over there a suite reaches them. `bin/pos-after-payment.guard.mjs` is what holds both halves here.

/** ★★ pk23/p4 — WAS THIS CHARGE MINE? Answered by the render site, which knows both which app it is calling
 * and who the kernel says took the money. Declared HERE rather than imported: an app never imports the
 * storefront. The three members are the product's, character for character — the guard next door grades them
 * against the monorepo when the operator names a checkout, because a renamed member would make the `'no'`
 * below match nothing and restore the defect without a single red test. */
export type SettledByThisApp = 'yes' | 'no' | 'unknown';

/** The initiate's envelope, as this app's provider produced it. Declared HERE rather than imported: an app
 * never imports the storefront. */
export type PaymentNextAction = { type: string; data: Record<string, unknown> } | null;

/** What the block draws, once it has established it may speak at all. `null` is a first-class answer: the slot
 * renders nothing at all, no empty wrapper, and moves on to the next app. */
export type AfterPaymentNotice =
  | { kind: 'rejected' }
  | { kind: 'approved' }
  | { kind: 'waiting'; copyPaste: string | null };

/** The PIX copy-paste string the provider put in its own envelope, when this render has one. Read defensively:
 * a front may hand the block a persisted envelope, a null, or the cleaned `settled` one. */
function copyPasteOf(nextAction: PaymentNextAction): string | null {
  const value = nextAction?.type === 'pos_pix_qr' ? nextAction.data.copy_paste : undefined;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * ★ THE WHOLE DECISION. `null` means this app has nothing to say about this order.
 *
 * ⛔ THERE IS NO `method` CHECK, and it is gone rather than demoted. It was never what shaped the copy — the
 * old condition was a GATE and `status` alone chose the words, which is still true: a settled card and a
 * settled PIX both mean "paid, come and get it". Keeping the method beside `settledByThisApp` would leave two
 * gates where only one is the truth, and the weaker one is what let the sentence out.
 */
export function afterPaymentNotice(input: {
  /** ★★ The verdict from the render site. Absent = `'unknown'`, matching the default the component declares
   * and the product's own blocks: a storefront that predates the field renders as it always did. */
  settledByThisApp?: SettledByThisApp;
  /** The neutral payment status (read.payment): 'pending' | 'approved' | 'rejected'. */
  status: string;
  nextAction?: PaymentNextAction;
}): AfterPaymentNotice | null {
  // ★★ NOT MY CHARGE, NOT MY SCREEN. Asked before anything else, because every question below it is about a
  // payment this app may not have taken.
  if (input.settledByThisApp === 'no') return null;
  if (input.status === 'rejected') return { kind: 'rejected' };
  if (input.status === 'approved') return { kind: 'approved' };
  // Not settled yet. For `card` this is a hiccup and the honest less is all this block may say; for `pix` it
  // is the normal state, and the copy-paste is the whole point of rendering at all.
  return { kind: 'waiting', copyPaste: copyPasteOf(input.nextAction ?? null) };
}
