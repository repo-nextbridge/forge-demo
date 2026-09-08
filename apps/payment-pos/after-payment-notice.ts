// ★★ WHO TOOK THIS CHARGE — the question the after-payment block has to answer BEFORE it says anything, and
// the reason this file exists at all.
//
// THE DEFECT IT WAS EXTRACTED FOR, AND IT HAPPENED IN FRONT OF THE OWNER (caderno pk21 §R3, 07/09). An order
// placed in the COFFEE store — `payment-reference`, card, Entrega Expressa, a delivery address in Alphaville —
// was answered with:
//
//     "Pagamento confirmado. Retire no balcão quando chamarmos o seu nome."
//
// printed directly above the block showing the carrier and Friday's estimate. The sentence is this app's, and
// it was correct about nothing: nobody stood at a counter, and this app never saw a cent of that order.
//
// THE CAUSE WAS THE QUESTION, NOT THE COPY. The block gated on `method !== 'pix' && method !== 'card'`, and
// `method` is the NEUTRAL kernel method — the vocabulary is `pix | card | promissory | zero` for the whole
// house, so "the order was paid by card" says nothing about WHO was paid. Every card or PIX order of a store
// where this app is installed matched. And installation is TENANT-wide (`extension_installation` is unique on
// `extension_id + tenant_id`), so "a store where this app is installed" is every store of the tenant. The
// block was asking "was it card or pix?" where it needed to ask "was it ME?".
//
// ⛔ CHANGING THE SENTENCE WOULD NOT HAVE FIXED IT. The sentence is right for somebody who paid at a counter.
// What was wrong is that it reached somebody who did not.
//
// ── WHY THE DECISION LIVES IN A `.ts` AND THE MARKUP IN THE `.tsx` NEXT DOOR ──────────────────────────────
//
// So that a test can RUN it. This repository has no package manager and no bundler: `bash bin/test.sh` hands
// `*.test.mjs`/`*.guard.mjs` to `node --test`, and Node strips types from a `.ts` on import while refusing JSX
// outright. Measured — that is why `apps/payment-pos/*.test.ts` (vitest) is collected by nothing in this repo
// and only ever runs inside a monorepo build. A rule about who may speak on a confirmation screen is not a
// rule this box can afford to leave un-run, so the part that decides is JSX-free and the part that draws is a
// switch over its answer. `bin/pos-after-payment.guard.mjs` is what holds both halves.

/** This app's extension id — the name the kernel records on a charge THIS app served, and the only name that
 * makes the counter's sentences true. It is the `id` in `manifest.ts` and in `composition.json`'s
 * `instanceApps`; the guard next door compares all three rather than trusting this line. */
export const APP_ID = 'payment-pos';

/**
 * Whose charge this confirmation is about.
 *
 * ★ THREE ANSWERS AND NOT TWO, because absence is not a denial. `another-app` is the kernel naming somebody
 * else; `unknown` is nobody having said — an order with no charge at all (a zero-value order, a pay-on-
 * delivery one), or a front that has not threaded the field yet. Collapsing the two would make this app's
 * silence unreadable the day somebody asks why a block did not draw.
 */
export type ChargeOwner = 'us' | 'another-app' | 'unknown';

/** @param providerAppId what the confirmation says settled this order (`read.payment`'s `provider_app_id`),
 * as it arrives — a front that predates the field hands over nothing at all, so this takes `unknown`. */
export function chargeOwner(providerAppId: unknown): ChargeOwner {
  if (typeof providerAppId !== 'string' || providerAppId.length === 0) return 'unknown';
  return providerAppId === APP_ID ? 'us' : 'another-app';
}

/** The initiate's envelope, as this app's provider produced it. Declared HERE rather than imported: an app
 * never imports the storefront. */
export type PaymentNextAction = { type: string; data: Record<string, unknown> } | null;

/** What the block draws, once it has established it may speak at all. `null` is a first-class answer and the
 * common one: the slot renders nothing and moves on to the next app. */
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
 * ⚠️ ONLY `us` DRAWS, AND `unknown` IS SILENCE ON PURPOSE — the one judgement call in this file, so here is
 * the reason. Every sentence this block can print is a CLAIM that money changed hands at a counter of this
 * box, and a claim needs positive evidence, not the absence of a denial. The two worlds inside `unknown` both
 * argue for silence rather than against it: an order with no provider was not charged by anybody, so it was
 * certainly not charged by us; and a confirmation that has not said who charged is EXACTLY the state that
 * printed "retire no balcão" over a delivery address in the first place. Drawing on ignorance is the defect,
 * not the fallback for it.
 *
 * The price is stated too, because it is real: on a front that never threads `providerAppId`, this app goes
 * quiet everywhere, including for the counter's own orders. That is the cheap side of the trade. A silent
 * block costs a shopper nothing — the slot renders nothing at all, no empty wrapper — while a wrong one sends
 * somebody expecting a delivery to go and queue for a coffee.
 *
 * ⛔ THERE IS NO `method` CHECK LEFT, and it is gone rather than demoted. This app declares `pix` and `card`
 * and no other method, so a charge the kernel attributes to us is one of those two by construction. Keeping
 * the old condition next to the new one would leave two gates where only one is the truth, and the weaker one
 * is the one that let the sentence out.
 */
export function afterPaymentNotice(input: {
  /** `read.payment`'s `provider_app_id`, as the confirmation slot hands it over. */
  providerAppId?: unknown;
  /** The NEUTRAL kernel method. Kept in the shape because it is part of the role's contract — it is NOT what
   * decides whether this app speaks; see above. */
  method?: string;
  /** The neutral payment status (read.payment): 'pending' | 'approved' | 'rejected'. */
  status: string;
  nextAction?: PaymentNextAction;
}): AfterPaymentNotice | null {
  if (chargeOwner(input.providerAppId) !== 'us') return null;
  if (input.status === 'rejected') return { kind: 'rejected' };
  if (input.status === 'approved') return { kind: 'approved' };
  // Not settled yet. For `card` this is a hiccup and the honest less is all this block may say; for `pix` it
  // is the normal state, and the copy-paste is the whole point of rendering at all.
  return { kind: 'waiting', copyPaste: copyPasteOf(input.nextAction ?? null) };
}
