// The counter's payment provider (PAY-POS) — two methods that settle in opposite ways, and neither of them
// calls a PSP, because at this counter there is no PSP: there is a card machine that already ran, and a QR on
// a screen that somebody taps.
//
// It imports ONLY @forgeco/contracts types (no @forge/core, no pg), like every payment app in this house.
//
// ── ★ `pos_card` SETTLES AT `initiate`, AND THE "~2 SECONDS" DO NOT EXIST HERE ────────────────────────────
//
// READ THIS BEFORE LOOKING FOR A TIMER: there isn't one, anywhere, and there is not meant to be.
//
// The spec says the card machine "approves by itself in about 2 seconds", and the totem does draw a two-second
// wait — that wait is an ANIMATION ON THE TOTEM'S SCREEN and nothing else. In the kernel there is no state
// between "started" and "paid": no pending envelope, no job, no poll. By the time this code runs, the physical
// machine has already taken the payment and the customer has already put their card away; the kernel is being
// TOLD, not asked. Inventing a `pending` here would be inventing a state nobody observes, and it would need a
// second public door to close it — more surface, and not one word more of truth.
//
// The settlement goes through a seam that already exists and is NEUTRAL: a synchronous provider returns
// `next_action: { type: 'settled', data: { status } }` and the kernel reconciles in-process
// (apps/api/src/payment-adapter.ts, the same path the reference simulator uses for immediate outcomes). No
// webhook, no timer, NO core edit. The verdict comes from this app's isolated code and can never be forged by
// a buyer's request body.
//
// ⚠️ Note for whoever writes the screen: the adapter REPLACES the settled envelope with a clean
// `{ type: 'settled', data: {} }` before answering, so `data.status` never reaches the front. `type` is the
// signal; the order is already paid when the call returns.
//
// ── ★★ `pos_pix` DOES NOT SETTLE, AND IT HANDS BACK THE REF — the one line this whole app was written for ──
//
// The QR has to sit on the screen and wait, so `initiate` returns a normal envelope and the intent stays
// pending. What makes this app different from `payment-reference` is a single field: the `provider_ref` rides
// INSIDE the app's own `next_action.data`. The kernel returns a non-settled `next_action` to the caller
// verbatim, so a field this app puts in `data` is a field the totem reads — and the ref is exactly what its
// webhook needs. The reference app's `pixPending()` returns `copy_paste` and `expires_in` and no ref, which is
// precisely why no screen can ever settle one of its PIX charges. That measured gap is why reusing lost to
// writing, and closing it cost zero kernel.
//
// ── `reconcile` IS THE SCAN DOOR, and it is PUBLIC ─────────────────────────────────────────────────────────
//
// ⚠️⚠️ This function is reachable, unauthenticated, at `POST /webhooks/payment/<store>/payment-pos`. It
// approves a payment. It is acceptable only because this app is never offered to anybody — see README.md and
// `simulation.ts`, which carry the premise the safety rests on and name the two refusals that belong to the
// KERNEL rather than to this file.

import type {
  InvocationContext,
  NextAction,
  PaymentInitiateRequest,
  PaymentInitiateResult,
  PaymentProvider,
  PaymentReconcileRequest,
  PaymentReconcileResult,
} from '@forgeco/contracts';
import { decideScan, fakePixCode, posCardRef, posPixRef } from './simulation';

/** How long the totem tells the customer the QR is good for. It is the SCREEN's number; what actually expires
 * is the kernel's reservation window, which the manifest declares at the same 900s so the two agree. */
const PIX_EXPIRES_IN_SECONDS = 900;

/** The neutral synchronous envelope — the adapter reconciles it in-process. PII-zero. */
function settled(): NextAction {
  return { type: 'settled', data: { status: 'approved' } };
}

/** The pending-PIX envelope. ★ `provider_ref` IS THE POINT: it is what lets the totem's "tap the QR" reach
 * this app's own door. Everything else on it is for the screen to draw. */
function pixPending(providerRef: string): NextAction {
  return {
    type: 'pos_pix_qr',
    data: {
      copy_paste: fakePixCode(providerRef),
      provider_ref: providerRef,
      expires_in: PIX_EXPIRES_IN_SECONDS,
    },
  };
}

export const provider: PaymentProvider = {
  methods: ['pix', 'card'],

  initiate(_ctx: InvocationContext, req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    if (req.method === 'pix') {
      const providerRef = posPixRef(req.idempotency_key);
      return Promise.resolve({ provider_ref: providerRef, next_action: pixPending(providerRef) });
    }
    // `card` (this app's `pos_card`). The machine already said yes (see the header): approving here is not a favour to the
    // shopper, it is the only true answer to "was this paid?" — the money moved before this process was
    // called. The method is not re-checked against a list because the kernel resolved this app BY ID for a
    // method it declared; an unknown method cannot arrive here.
    return Promise.resolve({
      provider_ref: posCardRef(req.idempotency_key),
      next_action: settled(),
    });
  },

  // ⚠️ `async`, AND THAT IS LOAD-BEARING RATHER THAN STYLE. This function is declared to return a promise, so
  // a caller awaits it; a SYNCHRONOUS throw from it escapes before the promise exists and lands outside the
  // `await`, which is a different control path from the rejection every caller is written for. Caught by this
  // app's own refusal tests, which passed the refusal and failed the shape.
  async reconcile(
    _ctx: InvocationContext,
    req: PaymentReconcileRequest,
  ): Promise<PaymentReconcileResult> {
    // ★ THE REFUSAL IS THE FEATURE. A rejection here is answered by the kernel's webhook adapter with HTTP 400
    // `reconcile_failed` and NOTHING is settled — the crown-jewel `payment.reconcile` is never dispatched,
    // because the adapter only reaches it after this function returns a verdict.
    const decision = decideScan(req.raw);
    if (!decision.ok) {
      throw new Error(`payment-pos refused a scan (${decision.refusal}): ${decision.because}`);
    }
    return {
      provider_ref: decision.event.provider_ref,
      status: decision.event.event,
    };
  },
};

export default provider;
