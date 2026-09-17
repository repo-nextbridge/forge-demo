// WHY A COUPON WAS REFUSED — and it lives here, not beside the action, for a reason with teeth.
//
// ⛔ A `'use server'` MODULE MAY ONLY EXPORT ASYNC FUNCTIONS. Every export of `app/actions.ts` is a Server
// Action the client is allowed to call over the wire, so a plain exported helper there is a build error, not
// a style question. This classifier is neither an action nor callable from the browser: it reads an error the
// server already holds.

import {
  COUPON_ERROR_COPY,
  couponFailureOf,
} from '@forgeco/storefront-kit/promo/coupon-error';

/**
 * ★★ THE REASON IS THE KERNEL'S OWN WORD, READ WITH THE KIT'S OWN READER.
 *
 * `cart.apply_coupon` refuses with `details.reason`. Measured against the live box, 02/09:
 *
 *     POST /v1/cart/commands/cart.apply_coupon {"code":"CAFEGRATIS"}
 *     → 400 {"code":"validation_failed","message":"this coupon does not exist",
 *            "details":{"reason":"coupon_not_found"}}
 *
 * `couponFailureOf` and `COUPON_ERROR_COPY` come from `@forgeco/storefront-kit/promo/coupon-error` —
 * the same five sentences the reference storefront shows, over the vocabulary the kernel wave agreed to.
 * Re-writing that map here would put the product's vocabulary in a second place, and this would be the copy
 * that rots: a reason added upstream would arrive as `unknown` and the till would say nothing new.
 *
 * ⚠️ `unknown` FALLS THROUGH ON PURPOSE. It means the port said something this build has never heard of, and
 * that IS the system's failure — so it keeps the system's voice and the attendant is called. Exported for the
 * guard, which drives it with the kernel's real payload.
 */
export function couponRefusal(error: unknown): { kind: 'coupon'; message: string } | null {
  const failure = couponFailureOf(error);
  return failure === 'unknown' ? null : { kind: 'coupon', message: COUPON_ERROR_COPY[failure] };
}
