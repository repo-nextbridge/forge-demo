// THE COUNTER'S PAYMENT SEAM — everything this app knows about `payment-pos`, behind one module.
//
// The app itself belongs to another slice (T-B) and travels in the instance's composition; what is here is
// the totem's half of the contract published in `CONTRATO-POS.md` (T-B, 2026-09-01). It is one module on
// purpose: when the app changes, one file changes, and the screens never learn a provider's name.
//
// ★★ THE TWO THINGS THAT LOOK LIKE BUGS AND ARE NOT. Both are written here because both would otherwise be
// discovered at a counter, by a customer.
//
// (1) `pos_card` SETTLES INSIDE `payment.initiate`, AND ITS ENVELOPE ARRIVES EMPTY.
//     The provider answers `{type:'settled', data:{status:'approved'}}` and the kernel's payment adapter
//     REPLACES the envelope with a clean `{type:'settled', data:{}}` before persisting and replying — the
//     verdict travels to `payment.reconcile`, which runs in the same request. So `data.status` does not
//     exist, and waiting for it is waiting forever. THE TYPE IS THE SIGNAL: `settled` means the order is
//     already paid by the time the call returns. There is no polling, no timer, no second state. The "~2
//     seconds" in the spec are this screen's animation and nothing else.
//
// (2) A WEBHOOK THAT FAILED STILL ANSWERS 200.
//     The kernel's webhook face acknowledges whatever it receives so a real provider is never told to retry
//     — so a kernel-side refusal (an unknown ref, say) comes back as HTTP 200 with an `error` in the BODY.
//     `res.ok` therefore does NOT mean "paid". Success is 200 AND `ok: true`, and `simulateScan` below is
//     the only place that rule lives. `pos.test.ts` proves the two are not confused.

import { commandBaseUrl } from '@forgecommerce/storefront-kit/config';
import type { NextAction } from '@forgecommerce/storefront-kit/command-client';
import { totemCommand } from './port';
import { resolveTotemStore } from './store';

/** The app that serves this counter's two methods. Its id in the instance's composition. */
export const POS_APP_ID = 'payment-pos';

/**
 * ⚠️ `pos_pix` AND `pos_card` ARE NOT KERNEL METHODS. `paymentMethods` is frozen as
 * `['pix','card','promissory','zero']` (packages/contracts/src/payment.ts), and `cart.set_payment_method`
 * takes one of those plus the APP that serves it. `pos_pix`/`pos_card` are the app's own identity and the
 * names of its ficha toggles (`pos_pix_enabled`, `pos_card_enabled`). Sending `pos_pix` as a method is a
 * refusal, and it is the kind that sends somebody looking in the wrong file for an hour.
 */
export type CounterMethod = 'pix' | 'card';

/** What the screen has to draw after `payment.initiate`, already read for what it means. */
export type PosOutcome =
  | {
      /** `pos_pix`: the order is placed and waiting. The QR is on screen until somebody pays it. */
      kind: 'pix_pending';
      copyPaste: string;
      /** ★ The capability to approve THIS attempt. Screen memory only — never a URL, never a cookie. */
      providerRef: string;
      expiresInSeconds: number;
    }
  | {
      /** `pos_card`: the machine already said yes. The order is paid; the screen only has to catch up. */
      kind: 'settled';
    };

/** The envelope shape `pos_pix` returns. Named so a change in the app is a type error here, not a blank QR. */
const PIX_NEXT_ACTION = 'pos_pix_qr';

/** Tell the kernel which method (and which app) this cart is paying with. */
export async function chooseCounterMethod(cartId: string, method: CounterMethod): Promise<void> {
  const store = resolveTotemStore();
  await totemCommand().setPaymentMethod(store.id, cartId, method, POS_APP_ID);
}

/** Start the charge for a placed order and read the envelope for what the screen must do next. */
export async function initiateCounterPayment(orderId: string): Promise<PosOutcome> {
  const store = resolveTotemStore();
  const { next_action } = await totemCommand().initiatePayment(store.id, orderId, 'pix');
  return readOutcome(next_action);
}

/**
 * The envelope → what the screen draws. Exported for the test: this is the function that must never mistake
 * a settled card for a pending pix, and never look for `data.status`.
 */
export function readOutcome(next: NextAction | null): PosOutcome {
  if (next?.type === 'settled') return { kind: 'settled' };
  if (next?.type === PIX_NEXT_ACTION) {
    const data = next.data as {
      copy_paste?: unknown;
      provider_ref?: unknown;
      expires_in?: unknown;
    };
    if (typeof data.copy_paste === 'string' && typeof data.provider_ref === 'string')
      return {
        kind: 'pix_pending',
        copyPaste: data.copy_paste,
        providerRef: data.provider_ref,
        expiresInSeconds: typeof data.expires_in === 'number' ? data.expires_in : 900,
      };
  }
  throw new Error(
    `payment-pos answered an envelope this counter cannot draw: ${next ? next.type : 'null'}. ` +
      'The contract is CONTRATO-POS.md; a new type means the app changed and this screen has not.',
  );
}

/**
 * THE "TOUCH THE QR" OF THE PROTOTYPE — the simulated scan, and the only place its rule is written.
 *
 * ⚠️ SUCCESS IS 200 **AND** `ok: true`. See note (2) at the top of this file: the kernel acknowledges a
 * failed webhook with 200 so a real provider is not told to retry, so `res.ok` alone is a lie.
 *
 * It posts to the KERNEL directly rather than to the public edge. The edge routes `/webhooks/payment/*`
 * straight through, so both work — but this process already talks to `kernel:3000` on the compose network
 * for every other call, and going out to the edge and back would make the screen depend on the totem's own
 * hostname being resolvable from inside its own container.
 */
export async function simulateScan(providerRef: string): Promise<{ paid: boolean; reason?: string }> {
  const store = resolveTotemStore();
  const url = `${commandBaseUrl().replace(/\/$/, '')}/webhooks/payment/${encodeURIComponent(store.id)}/${POS_APP_ID}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider_ref: providerRef, event: 'approved' }),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: unknown; error?: { code?: string } };
  if (res.status === 200 && body.ok === true) return { paid: true };
  return { paid: false, reason: body.error?.code ?? `HTTP ${res.status}` };
}
