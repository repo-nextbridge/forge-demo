// The counter provider's promises, executable. Four of them, and each one is a thing that would be invisible
// in production and expensive at a till:
//
//   · `pos_card` settles AT `initiate`, because the machine already said yes;
//   · `pos_pix` does NOT settle, and hands back the ref that lets a screen ask for the settlement later;
//   · the ref is the app's own and is derived from the attempt, so a re-invoke is idempotent;
//   · the scan door REFUSES anything that is not one of this app's open PIX charges.
//
// ⚠️ WHAT THESE TESTS DELIBERATELY DO NOT CLAIM. Two refusals belong to the KERNEL and cannot be asserted from
// here, because `reconcile` runs isolated with `{ raw }` and no database: a ref that names no attempt
// (`payment.reconcile` → `validation_failed: intent not found`) and a payment that has already settled (the
// conditional `update … where status = 'pending'`, whose second caller changes no row). They are measured
// LIVE against a running kernel, and the output is in `RELATORIO-T-B.md`. Asserting them here would mean
// keeping an app-side copy of state the core already holds atomically, which is the trap the README names.

import { describe, expect, test } from 'vitest';
import { provider } from './provider';
import { POS_CARD_REF_PREFIX, POS_PIX_REF_PREFIX } from './simulation';

/** `initiate` and `reconcile` here read nothing off the context: this app has no PSP to call and no config
 * that changes a verdict. The empty stub is the honest stand-in, and it is also a claim — if either function
 * ever starts reading `ctx`, these tests break rather than quietly passing. */
const ctx = {} as never;

const initiate = (method: string, idempotencyKey = 'pay_att_01K4EXAMPLE') =>
  provider.initiate(ctx, {
    idempotency_key: idempotencyKey,
    amount: 1850,
    currency: 'BRL',
    method,
  } as never);

describe('card (this app’s pos_card) — the machine approved it; the kernel only records it', () => {
  test('★ it settles AT initiate, through the neutral synchronous convention', async () => {
    const result = await initiate('card');
    // The SAME envelope the reference simulator uses for an immediate outcome, so the kernel reconciles it
    // in-process (apps/api/src/payment-adapter.ts). No webhook, no timer, no core edit.
    expect(result.next_action).toEqual({ type: 'settled', data: { status: 'approved' } });
  });

  test('★ THE "~2 SECONDS" ARE THE TOTEM’S ANIMATION AND NOTHING ELSE', async () => {
    // This test exists to be READ. The spec says the card machine approves "in about 2 seconds", and the
    // totem does draw a two-second wait, but the kernel has no state between "started" and "paid": there is
    // no pending envelope, no timer and nothing to poll. If this ever goes red because somebody made the card
    // pend, that is a contract change for the totem, not a detail.
    const result = await initiate('card');
    expect(result.next_action.type).toBe('settled');
    expect(result.next_action.type).not.toBe('pos_card_pending');
  });

  test('its ref is the app’s own and carries the card prefix', async () => {
    const result = await initiate('card');
    expect(result.provider_ref.startsWith(POS_CARD_REF_PREFIX)).toBe(true);
  });
});

describe('pix (this app’s pos_pix) — the QR waits for a scan, and hands out what it takes to simulate one', () => {
  test('★ it does NOT settle at initiate', async () => {
    const result = await initiate('pix');
    expect(result.next_action.type).toBe('pos_pix_qr');
    expect(result.next_action.type).not.toBe('settled');
  });

  test('★★ THE REF RIDES IN THE APP’S OWN ENVELOPE — the one thing payment-reference does not do', async () => {
    // This is the whole reason this app was written instead of reused. The kernel returns a non-settled
    // `next_action` VERBATIM to the caller, so a field the app puts in `data` is a field the totem reads. The
    // reference app's `pixPending()` carries `copy_paste` and `expires_in` and no ref, which is exactly why
    // no screen can ever call its webhook.
    const result = await initiate('pix');
    expect(result.next_action.data.provider_ref).toBe(result.provider_ref);
    expect(result.provider_ref.startsWith(POS_PIX_REF_PREFIX)).toBe(true);
  });

  test('it hands the screen a copy-paste string and a lifetime to print', async () => {
    const result = await initiate('pix');
    expect(typeof result.next_action.data.copy_paste).toBe('string');
    expect(result.next_action.data.copy_paste as string).toMatch(/^000201/);
    expect(result.next_action.data.expires_in).toBe(900);
  });
});

describe('the refs are derived from the attempt, never from a clock or a random', () => {
  test('★ the same attempt yields the same ref, so a re-invoke is idempotent at the provider', async () => {
    // The property `payment-adapter.ts` relies on to close the claim→invoke gap: re-invoking ONE attempt must
    // reach the same charge. A random or time-based ref would silently break that and orphan the first one.
    const [a, b] = await Promise.all([initiate('pix', 'att_same'), initiate('pix', 'att_same')]);
    expect(a.provider_ref).toBe(b.provider_ref);
  });

  test('a different attempt is a different charge', async () => {
    const [a, b] = await Promise.all([initiate('pix', 'att_1'), initiate('pix', 'att_2')]);
    expect(a.provider_ref).not.toBe(b.provider_ref);
  });
});

describe('the scan door refuses everything that is not one of this app’s open PIX charges', () => {
  const scan = (body: unknown) =>
    provider.reconcile(ctx, { raw: { headers: {}, query: {}, body } });

  test('★ it approves a well-formed event for one of its own PIX refs', async () => {
    const result = await scan({ provider_ref: 'pospix_att_1', event: 'approved' });
    expect(result).toEqual({ provider_ref: 'pospix_att_1', status: 'approved' });
  });

  test('★ it REFUSES a card ref — a machine charge settled at initiate and has no scan to simulate', async () => {
    await expect(scan({ provider_ref: 'poscard_att_1', event: 'approved' })).rejects.toThrow(
      /not one of this app/i,
    );
  });

  test('★ it REFUSES a ref that is not this app’s at all', async () => {
    await expect(scan({ provider_ref: 'mp_998877', event: 'approved' })).rejects.toThrow(
      /not one of this app/i,
    );
    await expect(scan({ provider_ref: '', event: 'approved' })).rejects.toThrow();
  });

  test('★ it REFUSES a payload that is not this app’s event', async () => {
    await expect(scan({ provider_ref: 'pospix_att_1' })).rejects.toThrow(/payload/i);
    await expect(scan({ event: 'approved' })).rejects.toThrow(/payload/i);
    await expect(scan({ provider_ref: 'pospix_att_1', event: 'yes please' })).rejects.toThrow(
      /payload/i,
    );
    await expect(scan(null)).rejects.toThrow(/payload/i);
    await expect(scan('approved')).rejects.toThrow(/payload/i);
  });

  test('a bare event (no webhook envelope) is accepted too, like the reference app allows', async () => {
    // The kernel's webhook adapter shapes `raw` as { headers, query, body }; a direct caller may hand the
    // event itself. Both are this app's own shape, and neither is more trusted than the other.
    const result = await provider.reconcile(ctx, {
      raw: { provider_ref: 'pospix_att_9', event: 'approved' },
    });
    expect(result.status).toBe('approved');
  });

  test('a rejection travels too — a scan can fail, and pretending otherwise would be a lie', async () => {
    const result = await scan({ provider_ref: 'pospix_att_1', event: 'rejected' });
    expect(result.status).toBe('rejected');
  });
});
