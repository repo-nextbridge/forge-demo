// ★★★ THE ORDER A RELOAD LEFT BEHIND CAN BE FINISHED — and the capability comes back from the PORT.
//
// The defect (C5, 04/09): `providerRef` and the copy-and-paste lived in the component's state and nowhere
// else, so a reload over the pix QR destroyed the only way to settle an order the kernel had already
// accepted. pk9 made the glass SAY so ("chame um atendente"); it did not recover anything.
//
// ── ★ WHERE THE CAPABILITY ACTUALLY LIVES, MEASURED IN THE KERNEL RATHER THAN ASSUMED ────────────────────
//
// `read.payment` publishes the attempt's `next_action` VERBATIM
// (packages/core/src/read/payment-capabilities.ts: `coalesce(pa.next_action, pi.next_action) as next_action`,
// returned untouched at the bottom of `loadPaymentView`), and `payment-pos` puts `copy_paste` and
// `provider_ref` INSIDE that envelope (apps/payment-pos/provider.ts, `pixPending`). So the QR is already
// public, PII-zero and anonymous — the till does not need a second place to keep it, and asking again cannot
// cost money because a read charges nobody.
//
// ⚠️ WHICH IS WHY THIS DOES **NOT** USE `initiatePayment(…, resume: true)`, and the brief that asked for it
// is the thing the source corrected. `resume` is the EXPIRED-QR door: it forces the adapter to re-invoke the
// app (apps/api/src/payment-adapter.ts:111-113) so the app can answer `attempt_failed`, and the kit's own
// comment restricts it to an explicit act of the buyer for that reason. Two measurements say it buys this
// counter nothing:
//   1. the READ already carries the envelope, so there is nothing to re-invoke FOR; and
//   2. `payment-pos` derives both fields from `idempotency_key`, which is the attempt id and does not change
//      (`posPixRef(req.idempotency_key)` → `fakePixCode(providerRef)`), so a re-invoke can only reproduce
//      byte for byte what the read already answered.
// A flag that cannot change the answer and CAN reach a provider is not a door, it is a risk.
//
// ── THE ONE CASE THE READ CANNOT ANSWER, AND THE KERNEL ALREADY HANDLES IT ────────────────────────────────
//
// An attempt claimed but never invoked (the process died between the two) has `next_action: null`. There the
// till DOES have to ask the port — and a plain `payment.initiate` is enough, because the adapter's own
// condition already re-invokes exactly that shape: `!settled && (!reused || next_action === null || resume)`.
// Same intent, same attempt, same `idempotency_key`. ONE ORDER, ONE CHARGE, by construction and not by care.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const payment = vi.fn();
const initiatePayment = vi.fn();

vi.mock('./port', () => ({
  totemRead: () => ({ payment }),
  totemCommand: () => ({ initiatePayment }),
}));
vi.mock('./store', () => ({ resolveTotemStore: () => ({ id: 'sto_test', handle: 'balcao' }) }));
vi.mock('@forgeco/storefront-kit/config', () => ({ commandBaseUrl: () => 'http://kernel:3000' }));

const { recoverCounterPayment } = await import('./pos');

/** The envelope `payment-pos` stores for a live counter pix — the shape `read.payment` hands straight back. */
const QR = {
  type: 'pos_pix_qr',
  data: {
    copy_paste: '00020126580014BR.GOV.BCB.PIX0136POSPIX01ABC0000FORGEBALCAO00QR',
    provider_ref: 'pospix_pat_01ABC',
    expires_in: 900,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recovering the payment of an order this screen no longer remembers', () => {
  it('★★★ hands back the SAME QR the kernel is holding — the capability was never lost, only forgotten', async () => {
    payment.mockResolvedValue({ payment_id: 'pay_1', status: 'pending', method: 'pix', next_action: QR });

    expect(await recoverCounterPayment('ord_01ABC')).toEqual({
      kind: 'pix_pending',
      copyPaste: QR.data.copy_paste,
      providerRef: QR.data.provider_ref,
      expiresInSeconds: 900,
    });
    expect(payment).toHaveBeenCalledWith('sto_test', 'ord_01ABC');
  });

  it('⛔ and it does it with NO WRITE AT ALL — a recovery that could charge is not a recovery', async () => {
    payment.mockResolvedValue({ payment_id: 'pay_1', status: 'pending', method: 'pix', next_action: QR });
    await recoverCounterPayment('ord_01ABC');
    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it('★★ the claim→invoke gap (next_action null) is the ONE case that asks the port, and it asks plainly', async () => {
    // The attempt exists and was never invoked. `payment.initiate` re-enters the same attempt with the same
    // idempotency key — see the header. The METHOD comes from the port's own answer, never from this screen:
    // a card order initiated as a pix would be a charge against the wrong rail.
    payment.mockResolvedValue({ payment_id: 'pay_1', status: 'pending', method: 'pix', next_action: null });
    initiatePayment.mockResolvedValue({ payment_id: 'pay_1', next_action: QR });

    expect(await recoverCounterPayment('ord_01ABC')).toMatchObject({ kind: 'pix_pending', providerRef: QR.data.provider_ref });
    expect(initiatePayment).toHaveBeenCalledTimes(1);
    const [store, orderId, method, methodData, resume] = initiatePayment.mock.calls[0] ?? [];
    expect([store, orderId, method]).toEqual(['sto_test', 'ord_01ABC', 'pix']);
    expect(methodData).toBeUndefined();
    // ⚠️ `resume` STAYS OFF: it exists to re-invoke a provider so an expired attempt can be failed, and here
    // the attempt has no envelope precisely because nobody has invoked it yet. See the header.
    expect(resume).toBeFalsy();
  });

  it('★ an order already PAID offers nothing — a settled order must never draw a QR again', async () => {
    payment.mockResolvedValue({ payment_id: 'pay_1', status: 'approved', method: 'pix', next_action: null });
    expect(await recoverCounterPayment('ord_01ABC')).toBeNull();
    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it('★ a rejected or failed attempt offers nothing either — this screen may not re-open a charge', async () => {
    for (const status of ['rejected', 'failed']) {
      vi.clearAllMocks();
      payment.mockResolvedValue({ payment_id: 'pay_1', status, method: 'pix', next_action: QR });
      expect(await recoverCounterPayment('ord_01ABC')).toBeNull();
      expect(initiatePayment).not.toHaveBeenCalled();
    }
  });

  it('an order the port knows nothing about is null, not a crash on the attract panel', async () => {
    payment.mockResolvedValue(null);
    expect(await recoverCounterPayment('ord_01ABC')).toBeNull();
  });

  it('a method this counter does not serve is refused rather than initiated blind', async () => {
    // `promissory` and `zero` are real neutral methods. A till that re-initiated one of them would be opening
    // a charge on a rail it has no screen for.
    payment.mockResolvedValue({ payment_id: 'pay_1', status: 'pending', method: 'promissory', next_action: null });
    expect(await recoverCounterPayment('ord_01ABC')).toBeNull();
    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it('an envelope this screen cannot draw does not throw at the attract panel — it answers null', async () => {
    // A future `payment-pos` type, or a provider swapped underneath. `readOutcome` THROWS by design (a blank
    // QR is worse than a refusal); the attract panel is not a place to throw, so this path answers instead.
    payment.mockResolvedValue({ payment_id: 'pay_1', status: 'pending', method: 'pix', next_action: { type: 'pix_qr', data: { copy_paste: 'x' } } });
    initiatePayment.mockResolvedValue({ payment_id: 'pay_1', next_action: { type: 'pix_qr', data: { copy_paste: 'x' } } });
    expect(await recoverCounterPayment('ord_01ABC')).toBeNull();
  });

  it('a port that refuses the read is silence, never a promise the till cannot keep', async () => {
    payment.mockRejectedValue(new Error('boom'));
    expect(await recoverCounterPayment('ord_01ABC')).toBeNull();
  });
});
