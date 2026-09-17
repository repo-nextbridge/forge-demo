// WHO IS COLLECTING THE ORDER — the counter asks for a name and nothing else, and this file is why that is
// enough.
//
// ★ THE CONTRACT (frozen for this wave). `cart.set_buyer` needs an e-mail; a person at a counter does not
// have one to give and must not be asked for one. So the totem synthesizes a per-order address and sends the
// REAL name beside it. The kernel is untouched and the order enters the same queue as any other.
//
// ★★ `<n>` IS DERIVED FROM THE CART, NOT COUNTED. An in-process counter was the obvious first idea and it is
// wrong twice: it restarts at zero when the container restarts (two orders of the same day colliding on one
// address) and it collides across replicas. The cart id is already unique, already per-order, and already in
// hand — so the suffix is its last six characters, lowercased. Stable for one order, no state of ours, and it
// survives a restart, which was the defect. (Approved by the tech lead, 2026-09-01.)
//
// ⚠️ `cart.set_buyer` IS ORACLE-CLASS AND CAPPED AT TEN PER MINUTE PER STORE+IP. It is also mandatory for
// every order, which makes it the tightest thing on the counter's whole path — see `port.ts` for the
// measurement. That is why `identifyBuyer` below asks the KERNEL whether this cart already has its buyer
// instead of trusting a flag in the browser: going back a screen and forward again must not spend one of the
// ten. The guard for this is `buyer.test.ts`, and the sabotage that proves it is in the slice report.

import type { CheckoutView } from '@forgeco/storefront-kit/read-client';
import { totemCommand } from './port';
import { resolveTotemStore } from './store';

/** The local part of every synthetic address this counter mints. Frozen: `balcao+<n>@forge.demo`. */
const BUYER_EMAIL_LOCAL = 'balcao';
const BUYER_EMAIL_DOMAIN = 'forge.demo';
/** How many characters of the cart id become `<n>`. Six is short enough to read in the admin and long enough
 * that two live carts of one day cannot collide in practice. */
const SUFFIX_LENGTH = 6;

/** `cart_01M1EYH8K7272E6R0BBTR1NECH` → `balcao+r1nech@forge.demo`. */
export function syntheticBuyerEmail(cartId: string): string {
  const suffix = cartId.slice(-SUFFIX_LENGTH).toLowerCase();
  return `${BUYER_EMAIL_LOCAL}+${suffix}@${BUYER_EMAIL_DOMAIN}`;
}

/**
 * Is the cart ALREADY carrying this exact person? The kernel masks the name it stored (`Ma••••`), so this
 * compares what can honestly be compared: that a buyer exists, and that the visible initial still matches.
 *
 * ⚠️ IT ERRS TOWARDS "ALREADY SET" ONLY WHEN THE MASK AGREES. A different name always re-sends — a customer
 * who corrects their name before paying gets the correction, and spends one of the ten to get it.
 */
export function buyerAlreadySet(view: CheckoutView | null, name: string): boolean {
  if (!view?.has_buyer) return false;
  const stored = view.buyer_masked?.name?.trim();
  if (!stored) return false;
  const typed = name.trim();
  if (!typed) return false;
  // The mask keeps the leading character(s); comparing the first is all the port lets us do honestly.
  return stored.slice(0, 1).toLocaleUpperCase() === typed.slice(0, 1).toLocaleUpperCase();
}

/**
 * Attach the collector's name to the cart — AT MOST ONCE per cart per name.
 *
 * Returns whether the port was actually called, so a test (and the report) can prove that walking back and
 * forth across the payment screen does not spend the store's budget.
 */
export async function identifyBuyer(
  view: CheckoutView | null,
  cartId: string,
  name: string,
): Promise<{ called: boolean }> {
  if (buyerAlreadySet(view, name)) return { called: false };
  const store = resolveTotemStore();
  await totemCommand().setBuyer(store.id, cartId, {
    email: syntheticBuyerEmail(cartId),
    name: name.trim(),
    guest: true,
  });
  return { called: true };
}
