// ★★ THE VITRINE'S CART WRITES — its own Server Actions over the SHARED cart logic.
//
// WHY THIS FILE EXISTS (CHECKOUT-APP, C1). A Server Action is not a function a second program can import: it
// is an HTTP endpoint of the app that declares it, addressed by a build-time id. Before the cut, the vitrine's
// mini-cart, its "Comprar" button, its variant selector and its PDP CEP box all called actions declared in
// `(checkout)/checkout/actions.ts` — one app, so an import was enough. The checkout is a DIFFERENT DEPLOYABLE
// now, and importing its actions from here would either not resolve or, worse, resolve to an endpoint this
// build cannot serve.
//
// So each app owns its own entrypoints and the LOGIC is shared: everything below delegates to
// `@forgecommerce/storefront-kit/checkout/checkout-flow`, which is dependency-injected and framework-free and
// is where the rules actually live (proven in isolation, in the kit's own suite). What is duplicated is the
// thin `'use server'` wrapper — which is the correct amount to duplicate, because it is the part that is
// per-app by definition.
//
// ⚠️ THE COOKIE IS THE SAME COOKIE. `forge_cart` is a frozen name with one attribute bag
// (`@forgecommerce/storefront-kit/cart-cookie`), so a cart born here is the cart the checkout picks up on the
// next path of the same host. That is the whole handoff; there is nothing else to keep in step.
//
// ⚠️ WHAT IS DELIBERATELY NOT HERE: everything past the cart. Address, shipping choice, identity, payment,
// finalize and the confirmation are the checkout's, and a vitrine that could drive them would be a second
// checkout nobody maintains.
'use server';

import { CART_COOKIE } from '@forgecommerce/storefront-kit/cart-cookie';
import type {
  CouponResult,
  GiftResult,
} from '@forgecommerce/storefront-kit/checkout/cart-write-results';
import {
  addManyToCart,
  addToCart,
  applyCoupon,
  type CheckoutDeps,
  type CookieStore,
  chooseGift,
  removeCoupon,
  removeLine,
  resolveState,
  setPostalCode,
  updateLine,
} from '@forgecommerce/storefront-kit/checkout/checkout-flow';
import { buildProductIndex, enrichLines } from '@forgecommerce/storefront-kit/checkout/enrich';
import { quotedOptions } from '@forgecommerce/storefront-kit/checkout/quote-result';
import { readClient } from '@forgecommerce/storefront-kit/config';
import { commandClient } from '@forgecommerce/storefront-kit/kernel-write-clients';
import {
  EMPTY_SNAPSHOT,
  type MinicartSnapshot,
} from '@forgecommerce/storefront-kit/minicart-types';
import { couponFailureOf, giftFailureOf } from '@forgecommerce/storefront-kit/promo/coupon-error';
import { giftCatalogOf, skuIdsForCart } from '@forgecommerce/storefront-kit/promo/gifts';
import type { ShippingOption } from '@forgecommerce/storefront-kit/read-client';
import { storeRedirect } from '@forgecommerce/storefront-kit/store-navigation';
import type { StoreBase } from '@forgecommerce/storefront-kit/store-route';
import { cookies } from 'next/headers';

/** A cookie store over next/headers — writable inside a Server Action. httpOnly: the cart capability is never
 * exposed to client JS. It FORWARDS the attributes the flow named; it does not invent any. */
async function serverCookieStore(): Promise<CookieStore> {
  const jar = await cookies();
  return {
    get: (name) => jar.get(name)?.value,
    set: (name, value, options) => jar.set(name, value, options),
    delete: (name) => jar.delete(name),
  };
}

async function deps(store: string): Promise<CheckoutDeps> {
  return {
    store,
    commands: commandClient(),
    reads: readClient(),
    cookies: await serverCookieStore(),
  };
}

/** PDP "Comprar": ensure the cart (cookie) + add the SKU. Accumulates across visits (no cart page). */
export async function addToCartAction(store: string, skuId: string, qty = 1): Promise<void> {
  await addToCart(await deps(store), skuId, qty);
}

/** The recommendations "adicionar os dois": add several SKUs (current + paired) into ONE cart. Passed (bound to
 * the store) to extension blocks by the PDP, so a block drives the real forge_cart flow without owning the
 * cookie or the port URL. */
export async function addManyToCartAction(
  store: string,
  skuIds: string[],
  qty = 1,
  /** ★ SUB-S2 — the line's own DECLARED fields, so a block can add a MARKED line (a subscription plan) rather
   * than only the plain one. The mark is part of the line's identity (`cart.add_line` aggregates by sku +
   * custom fields), which is what makes a cart holding the same coffee once and monthly work by construction.
   * The kernel refuses any key the merchant did not declare, so this widens what a block may ask for, never
   * what the port accepts. Omitted → `{}`: every caller before this one is byte-identical. */
  customFields: Record<string, string> = {},
): Promise<void> {
  await addManyToCart(await deps(store), skuIds, qty, customFields);
}

/** MINICART base (progressive enhancement / no-JS): add the SKU then REDIRECT to the checkout — the exact
 * v0.1 fallback. The PDP "Adicionar ao carrinho" form posts here when JS is off; with JS the client intercepts
 * and opens the drawer instead (staying on the page), so this redirect only runs as the graceful fallback.
 *
 * MULTISTORE M1-β — `base` is not decoration. This redirect used to be the literal `/checkout`, so a shopper
 * with JS off under `/s/<store>` was handed to whichever store the Host resolves, with a cart they could no
 * longer see. It is the same line, in the same file, as the post-purchase redirect that produced three
 * identical approved charges. */
export async function addToCartThenCheckoutAction(
  store: string,
  base: StoreBase,
  skuId: string,
): Promise<void> {
  await addToCart(await deps(store), skuId);
  storeRedirect(base, '/checkout');
}

/** MINICART re-read: the drawer + header counter's single source of truth. Reads the cart (read.checkout via
 * the httpOnly cookie), enriches lines with name/photo/variant (read.products_by_skus, the same join the
 * checkout summary uses), and returns the kernel-formed totalizers/total + the unit count. The front NEVER
 * computes the total — it relays what the port returns. Empty/absent cart → EMPTY_SNAPSHOT. */
export async function cartSummaryAction(store: string): Promise<MinicartSnapshot> {
  const reads = readClient();
  const state = await resolveState(await deps(store));
  if (state.phase !== 'cart') return EMPTY_SNAPSHOT;
  const { checkout } = state;
  // PROMO — the gift lines are SYNTHETIC (no title, no photo), so the same catalog join that names the cart
  // lines is widened to cover the gift's sku and, in `offered` mode, its menu. One read, not two.
  const index = buildProductIndex(
    await reads.productsBySkus(
      store,
      skuIdsForCart(
        checkout.lines.map((l) => l.sku_id),
        checkout.pricing?.gift_lines,
      ),
    ),
  );
  return {
    lines: enrichLines(checkout.lines, index),
    totalizers: checkout.totalizers,
    totalAmount: checkout.total_amount,
    currency: checkout.currency,
    count: checkout.lines.reduce((n, l) => n + l.qty, 0),
    // PROMO — carried on the same re-read the drawer already does; no extra round trip for the bars/gifts.
    pricing: checkout.pricing,
    // The catalog facts for the SYNTHETIC gift skus, resolved by the join above.
    giftCatalog: giftCatalogOf(index, checkout.pricing?.gift_lines),
    // ★ QA9 · A5 — carried on the re-read the drawer already does, like `pricing` above it.
    backorder: checkout.backorder,
  };
}

/** Inline edit (pre-order) — change a line's qty. The client calls router.refresh() after → the summary
 * re-reads read.checkout (live totals from the kernel). */
export async function updateLineAction(store: string, lineId: string, qty: number): Promise<void> {
  await updateLine(await deps(store), lineId, qty);
}

/** Inline edit (pre-order) — remove a line. */
export async function removeLineAction(store: string, lineId: string): Promise<void> {
  await removeLine(await deps(store), lineId);
}

/** PROMO — the shopper's pick among an `offered` gift's options. */
export async function chooseGiftAction(
  store: string,
  promotionId: string,
  skuId: string,
): Promise<GiftResult> {
  try {
    const chosen = await chooseGift(await deps(store), promotionId, skuId);
    return chosen ? { ok: true } : { ok: false, reason: 'unknown' };
  } catch (error) {
    return { ok: false, reason: giftFailureOf(error) };
  }
}

/** Apply a code the shopper typed. Never throws: a refusal IS the answer here, not an exception. */
export async function applyCouponAction(store: string, code: string): Promise<CouponResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, reason: 'coupon_not_found' };
  try {
    const applied = await applyCoupon(await deps(store), trimmed);
    // No cart at all (a stale tab): the same answer the kernel would give for a code that matches nothing.
    return applied ? { ok: true } : { ok: false, reason: 'coupon_not_found' };
  } catch (error) {
    return { ok: false, reason: couponFailureOf(error) };
  }
}

/** Remove an applied code. A failure here is not worth a sentence — the caller just re-reads the cart. */
export async function removeCouponAction(store: string, code: string): Promise<CouponResult> {
  try {
    await removeCoupon(await deps(store), code);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: couponFailureOf(error) };
  }
}

/** S7-SF-PDP — the PDP CEP box: PERSIST the typed CEP on the cart (the ORDERFORM seed — survives navigation to
 * the checkout and back, via the httpOnly cookie + read.cart), then quote shipping against that cart so the
 * options fade in. Ensures a cart (get-or-create) so both the persistence and the quote have a cart_id even
 * before the shopper adds anything. Returns the options for display; the front never prices. */
export async function setPdpCepAction(
  store: string,
  postalCode: string,
  skuId?: string,
): Promise<ShippingOption[]> {
  const d = await deps(store);
  const cartId = await setPostalCode(d, postalCode);
  // QA-PACK-1 C2 — the two halves of this action are now about different subjects, on purpose. PERSISTING is
  // about the CART (the orderform seed survives to the checkout, unchanged). QUOTING is about the PRODUCT the
  // shopper is looking at: asking the cart returned an empty list whenever the cart was empty, and the box
  // reads an empty list as "we do not deliver to your address" — a false no, told to someone who has not even
  // decided to buy yet. With no SKU (the preview gallery) it falls back to the cart question, as before.
  // QA29 · g1e-4 — `quotedOptions` refuses a non-answer (unknown sku, unknown cart, no destination) instead of
  // relaying it as an empty list. The box reads an empty list as "we do not deliver to your address"; that
  // sentence belongs to the ONE answer that means it.
  return quotedOptions(
    skuId
      ? await readClient().shippingOptionsForSku(store, skuId, postalCode)
      : await readClient().shippingOptions(store, cartId, postalCode),
  );
}

/** PERF-B — the CEP the shopper already persisted on their cart, read back for the PDP box (S7-SF-SMALLS's
 * round trip). It exists as an ACTION, and not as a server render, because the PDP's HTML is edge-cached: the
 * page may not read the httpOnly `forge_cart` cookie (a cookie read on a cacheable route is a runtime 500,
 * not a degrade), so the box asks for it after hydration — the same shape the minicart already uses to seed
 * itself. No cart / no CEP / port down → null, and the box simply starts empty. */
export async function cartPostalCodeAction(store: string): Promise<string | null> {
  const jar = await serverCookieStore();
  const cartId = jar.get(CART_COOKIE);
  if (!cartId) return null;
  const cart = await readClient()
    .cart(store, cartId)
    .catch(() => null);
  return cart?.postal_code ?? null;
}
