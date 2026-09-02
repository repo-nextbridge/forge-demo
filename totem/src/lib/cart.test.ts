// ★★ THE POINTER THIS BROWSER BROUGHT, AND WHETHER THIS COUNTER MAY WRITE TO IT — the A52 fix, measured.
//
// The reproduction that produced this file, against the LIVE counter through its own server action:
//
//     addItem(sku_…, 1) with Cookie: forge_cart=<a cart created on the COFFEE SHOP's store>
//     → {"ok":false,"kind":"refused","message":"command cart.add_line failed: validation_failed (cart not found)"}
//
// and the same answer for a cart id from a previous seed of the box. It never recovered, because the cookie
// was reused unconditionally and nothing rewrote it. On the bench the shop and the totem are the same HOST on
// two ports, and cookies ignore the port (RFC 6265 §8.5) — so the shop's `forge_cart` really is what the till
// receives.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
const cookieStore = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
  set: (name: string, value: string) => void jar.set(name, value),
  delete: (name: string) => void jar.delete(name),
};

vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const readCart = vi.fn();
const createCart = vi.fn(async () => ({ cart_id: 'cart_MINTED' }));
vi.mock('./port', () => ({
  totemRead: () => ({ cart: readCart, checkout: vi.fn() }),
  totemCommand: () => ({ createCart }),
}));
vi.mock('./store', () => ({ resolveTotemStore: () => ({ id: 'sto_balcao', handle: 'balcao' }) }));

const { ensureCartId } = await import('./cart');

const active = { cart_id: 'cart_OWN', store_id: 'sto_balcao', status: 'active', lines: [] };

beforeEach(() => {
  jar.clear();
  readCart.mockReset();
  createCart.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ensureCartId', () => {
  it('mints when there is no pointer at all — the first touch of a new customer', async () => {
    expect(await ensureCartId()).toBe('cart_MINTED');
    expect(readCart).not.toHaveBeenCalled();
    expect(jar.get('forge_cart')).toBe('cart_MINTED');
  });

  it('reuses a pointer that names an ACTIVE cart of THIS counter — one basket per customer, still', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCart.mockResolvedValue(active);

    expect(await ensureCartId()).toBe('cart_OWN');
    expect(createCart).not.toHaveBeenCalled();
  });

  it('★ A52 — discards the pointer the port does not recognise (the coffee shop\'s cart, a swept cart, an old seed)', async () => {
    jar.set('forge_cart', 'cart_FROM_THE_SHOP');
    readCart.mockResolvedValue(null); // read.cart scoped to this store answers 404 → the kit returns null

    expect(await ensureCartId()).toBe('cart_MINTED');
    // …and REBINDS the cookie, which is what makes the recovery permanent instead of once per tap.
    expect(jar.get('forge_cart')).toBe('cart_MINTED');
    expect(readCart).toHaveBeenCalledWith('sto_balcao', 'cart_FROM_THE_SHOP');
  });

  it('discards a cart this counter owns but may no longer write to (any status but active)', async () => {
    jar.set('forge_cart', 'cart_OLD');
    readCart.mockResolvedValue({ ...active, cart_id: 'cart_OLD', status: 'converted' });

    expect(await ensureCartId()).toBe('cart_MINTED');
  });

  it('⚠️ a READ BLIP must not throw away a live basket: an unanswered probe reuses the pointer', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCart.mockRejectedValue(new Error('the port did not answer'));

    expect(await ensureCartId()).toBe('cart_OWN');
    expect(createCart).not.toHaveBeenCalled();
  });

  it('says out loud that it threw a pointer away — an invisible recovery is the next A52', async () => {
    jar.set('forge_cart', 'cart_FROM_THE_SHOP');
    readCart.mockResolvedValue(null);
    const said: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void said.push(a.map(String).join(' ')));

    await ensureCartId();

    expect(said.join('\n')).toContain('cart_FROM_THE_SHOP');
  });
});
