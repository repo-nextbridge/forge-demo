// ★★ THE TWO TRAPS OF `payment-pos`, EACH WITH THE TEST THAT CATCHES IT.
//
// Both come from `CONTRATO-POS.md` (T-B, 2026-09-01) and both are the kind that only show up at a counter,
// with a customer waiting:
//
//  (1) `pos_card` settles INSIDE `payment.initiate` and its envelope arrives EMPTY — the kernel's payment
//      adapter replaces `{status:'approved'}` with `{}` before replying, because the verdict travels to
//      `payment.reconcile` in the same request. Waiting for `data.status` is waiting forever.
//  (2) A webhook the kernel REFUSED still answers HTTP 200, because the webhook face acknowledges everything
//      so a real provider is never told to retry. `res.ok` therefore does not mean "paid".
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./port', () => ({ totemCommand: () => ({}) }));
vi.mock('./store', () => ({ resolveTotemStore: () => ({ id: 'sto_test', handle: 'balcao' }) }));
vi.mock('@forgeco/storefront-kit/config', () => ({
  commandBaseUrl: () => 'http://kernel:3000',
}));

const { readOutcome, simulateScan } = await import('./pos');

describe('reading the envelope payment.initiate returns', () => {
  it('★ takes `settled` as "already paid" WITHOUT looking for data.status', () => {
    // Exactly what the kernel replies for pos_card: the type carries the whole meaning, data is empty.
    expect(readOutcome({ type: 'settled', data: {} })).toEqual({ kind: 'settled' });
  });

  it('still takes `settled` as paid if a future kernel does leave something in data', () => {
    expect(readOutcome({ type: 'settled', data: { status: 'approved' } })).toEqual({ kind: 'settled' });
  });

  it('reads the pix envelope, and keeps the provider_ref that makes the simulated scan possible', () => {
    expect(
      readOutcome({
        type: 'pos_pix_qr',
        data: { copy_paste: '00020126580014BR.GOV.BCB.PIX', provider_ref: 'pospix_abc', expires_in: 900 },
      }),
    ).toEqual({
      kind: 'pix_pending',
      copyPaste: '00020126580014BR.GOV.BCB.PIX',
      providerRef: 'pospix_abc',
      expiresInSeconds: 900,
    });
  });

  it('never confuses a pending pix for a settled card', () => {
    const pix = readOutcome({
      type: 'pos_pix_qr',
      data: { copy_paste: 'x', provider_ref: 'pospix_abc' },
    });
    expect(pix.kind).not.toBe('settled');
  });

  it('refuses an envelope it cannot draw instead of showing a blank QR', () => {
    expect(() => readOutcome({ type: 'pix_qr', data: { copy_paste: 'x' } })).toThrow(/cannot draw/);
    expect(() => readOutcome(null)).toThrow(/cannot draw/);
  });

  it('refuses a pix envelope with no provider_ref — a QR nobody could ever approve', () => {
    expect(() => readOutcome({ type: 'pos_pix_qr', data: { copy_paste: 'x' } })).toThrow(/cannot draw/);
  });
});

describe('the simulated scan reads the BODY, not the status', () => {
  afterEach(() => vi.unstubAllGlobals());

  const answer = (status: number, body: unknown) =>
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status, json: async () => body } as unknown as Response),
    );

  it('200 with ok:true is the only thing that counts as paid', async () => {
    answer(200, { ok: true });
    expect(await simulateScan('pospix_abc')).toEqual({ paid: true });
  });

  it('★ 200 with an error in the body is NOT paid — the trap res.ok walks straight into', async () => {
    answer(200, { error: { code: 'validation_failed', message: 'intent not found' } });
    expect(await simulateScan('pospix_unknown')).toEqual({ paid: false, reason: 'validation_failed' });
  });

  it('400 from the app is not paid either', async () => {
    answer(400, { error: { kind: 'reconcile_failed' } });
    expect((await simulateScan('poscard_abc')).paid).toBe(false);
  });

  it('an empty 200 body is not paid: silence is not a yes', async () => {
    answer(200, {});
    expect((await simulateScan('pospix_abc')).paid).toBe(false);
  });

  it('posts the ref and the approved event to the kernel’s webhook face for this store and app', async () => {
    answer(200, { ok: true });
    await simulateScan('pospix_abc');
    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://kernel:3000/webhooks/payment/sto_test/payment-pos');
    expect(JSON.parse(String(init.body))).toEqual({ provider_ref: 'pospix_abc', event: 'approved' });
  });
});

describe('the charge is opened on the method the customer chose', () => {
  it('★ passes the method through instead of assuming pix', async () => {
    const initiatePayment = vi.fn().mockResolvedValue({ payment_id: 'pay_1', next_action: { type: 'settled', data: {} } });
    vi.doMock('./port', () => ({ totemCommand: () => ({ initiatePayment }) }));
    vi.resetModules();
    const { initiateCounterPayment } = await import('./pos');
    await initiateCounterPayment('ord_1', 'card');
    expect(initiatePayment).toHaveBeenCalledWith('sto_test', 'ord_1', 'card');
    vi.doUnmock('./port');
    vi.resetModules();
  });
});
