// ★★ THE GUARD OF A52: A REFUSAL THIS APP SWALLOWS IS A DEFECT NOBODY CAN DIAGNOSE.
//
// The original defect was not "the totem cannot add a SKU". It was that when it could not, the process said
// NOTHING — the container's whole log after several failed taps was `✓ Ready in 181ms` — while the screen
// showed a calm "Não foi possível concluir. Chame um atendente.". The port had been answering
// `validation_failed (cart not found)` the entire time.
//
// ⚠️ THIS GUARD WATCHES THE RESULT, NOT THE SOURCE. It does not grep for `console.error` and it does not
// assert that `logPortRefusal` was imported: it makes the port refuse, runs the real server action, and
// demands that a line CARRYING THE PORT'S OWN CODE AND MESSAGE was actually emitted. Any rewrite that goes
// back to a polite sentence and silence — a different logger, an early return, a `catch {}` — turns this red.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The shape the kit's `CommandFailed` really has (command-client.ts): `.commandName` + `.error{code,message}`. */
class FakeCommandFailed extends Error {
  override readonly name = 'CommandFailed';
  constructor(
    readonly commandName: string,
    readonly error: { code: string; message: string },
  ) {
    super(`command ${commandName} failed: ${error.code} (${error.message})`);
  }
}

const addLine = vi.fn();
const updateLine = vi.fn();
const removeLine = vi.fn();
const applyCouponCmd = vi.fn();
const removeCouponCmd = vi.fn();
const checkout = vi.fn().mockResolvedValue(null);

class FakePortRateLimited extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`rate limited for ${retryAfterSeconds}s`);
  }
}

vi.mock('@/lib/port', () => ({
  PortRateLimited: FakePortRateLimited,
  totemCommand: () => ({
    addLine,
    updateLine,
    removeLine,
    applyCoupon: applyCouponCmd,
    removeCoupon: removeCouponCmd,
  }),
  totemRead: () => ({ checkout, productsBySkus: vi.fn().mockResolvedValue([]) }),
}));
vi.mock('@/lib/store', () => ({
  resolveTotemStore: () => ({ id: 'sto_test', handle: 'balcao' }),
}));
vi.mock('@/lib/cart', () => ({
  ensureCartId: vi.fn().mockResolvedValue('cart_test'),
  currentCartId: vi.fn().mockResolvedValue('cart_test'),
  startFresh: vi.fn().mockResolvedValue('cart_test'),
  endSession: vi.fn().mockResolvedValue(undefined),
  readCheckout: () => checkout(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { addItem, applyCoupon, changeQty, removeCoupon, removeItem } = await import('./actions');

let said: string[] = [];
beforeEach(() => {
  said = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    said.push(args.map(String).join(' '));
  });
  for (const m of [addLine, updateLine, removeLine, applyCouponCmd, removeCouponCmd]) m.mockReset();
});
afterEach(() => vi.restoreAllMocks());

/** Every line the process emitted while the action ran, as one blob — what an operator would `docker logs`. */
const log = () => said.join('\n');

describe('the port refuses, and the counter SAYS SO', () => {
  it('★ the add that started A52: the log carries the code and the message, not just the polite sentence', async () => {
    addLine.mockRejectedValue(
      new FakeCommandFailed('cart.add_line', { code: 'validation_failed', message: 'cart not found' }),
    );

    const r = await addItem('sku_01M1FRET3M41MX8F9GECWACN0C', 1);

    // The screen still gets its calm answer — the customer's experience is NOT what changed.
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.kind).toBe('refused');
    // And the operator gets the thing that was missing: the port's own words.
    expect(log()).toContain('validation_failed');
    expect(log()).toContain('cart not found');
    // …with enough context to find it: which action, which command, which cart, which sku.
    expect(log()).toContain('addItem');
    expect(log()).toContain('cart.add_line');
    expect(log()).toContain('cart_test');
    expect(log()).toContain('sku_01M1FRET3M41MX8F9GECWACN0C');
  });

  it('says so for EVERY write of the counter, not only the one that was reported', async () => {
    const cases: [string, () => Promise<unknown>, ReturnType<typeof vi.fn>][] = [
      ['changeQty', () => changeQty('cl_1', 3), updateLine],
      ['changeQty(0 → remove)', () => changeQty('cl_1', 0), removeLine],
      ['removeItem', () => removeItem('cl_1'), removeLine],
      ['applyCoupon', () => applyCoupon('CAFE10'), applyCouponCmd],
      ['removeCoupon', () => removeCoupon('CAFE10'), removeCouponCmd],
    ];
    for (const [action, run, command] of cases) {
      said = [];
      command.mockRejectedValue(
        new FakeCommandFailed('cart.whatever', { code: 'validation_failed', message: 'refused on purpose' }),
      );
      await run();
      expect(log(), `${action} refused in silence`).toContain('refused on purpose');
      expect(log(), `${action} did not name itself`).toContain(action);
    }
  });

  it('says so for a RATE LIMIT too — the one refusal an operator can act on while the queue waits', async () => {
    addLine.mockRejectedValue(new FakePortRateLimited(60));

    const r = await addItem('sku_1', 1);

    expect(r.ok === false && r.kind).toBe('rate_limited');
    expect(log()).toContain('addItem');
    expect(log()).toMatch(/rate limited/i);
  });

  it('⚠️ never prints what the customer typed: the coupon code stays out of the log', async () => {
    applyCouponCmd.mockRejectedValue(
      new FakeCommandFailed('cart.apply_coupon', { code: 'validation_failed', message: 'no such coupon' }),
    );

    await applyCoupon('SEGREDO-DA-CASA');

    expect(log()).toContain('applyCoupon');
    expect(log()).not.toContain('SEGREDO-DA-CASA');
  });

  it('stays QUIET when the port accepts — a log that speaks on success teaches an operator to ignore it', async () => {
    addLine.mockResolvedValue({ line_id: 'cl_1', qty: 1 });

    const r = await addItem('sku_1', 1);

    expect(r.ok).toBe(true);
    expect(said).toEqual([]);
  });
});
