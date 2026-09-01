// THE TOTEM'S DOORS TO THE PORT — the kit's clients, built here so this app can see a 429 for what it is.
//
// ★ THE CLIENTS ARE THE KIT'S. Nothing about a read or a command is re-implemented: `createReadClient` and
// `createCommandClient` come from `@forgecommerce/storefront-kit`, the same code the reference storefront and
// the coffee vitrine run. What this module adds is the ONE thing the kit's own factories cannot take — an
// instrumented `fetch` — and it adds it by passing the parameter those factories already accept.
//
// ★★ WHY THE INSTRUMENTED FETCH EXISTS: A REFUSAL THIS SCREEN HAS TO BE ABLE TO SAY OUT LOUD.
//
// Two commands on the totem's only path are ORACLE-CLASS and capped per store+IP at ten a minute
// (`ORACLE_IP_CAP`, apps/api/src/anonymous-caps.ts): `cart.apply_coupon` and — the one that matters —
// `cart.set_buyer`, which every single counter order must call. Measured on the isolated bench, 2026-09-01:
//
//     cart.set_buyer ×10 → 200 · the 11th → 429
//     headers: RateLimit-Limit: 10 · RateLimit-Remaining: 0 · RateLimit-Reset: 60 · Retry-After: 60
//     and the bucket is SHARED: five calls on one cart plus five on another refuse the eleventh.
//
// The kit's `post` turns any non-2xx into `CommandFailed` built from `body.code`/`body.message`, and the
// kernel's 429 body is shaped `{error:{kind,message}}` — so the status arrives as the string "HTTP 429" and
// the `Retry-After` is gone. A counter cannot afford that: the eleventh customer of the minute is not a bug,
// they are a person standing at a screen, and the screen has to tell them how long. So the wrapper below
// intercepts the status BEFORE the kit reads the body and throws something with the number in it.
//
// ⚠️ IT DOES NOT WIDEN ANYTHING. It reads a response header; it does not retry, it does not queue, and above
// all it does not forge an address to spread the bucket — that would be defeating a security cap with an
// invented IP, and it is refused here on purpose (tech lead, 2026-09-01).

import { createCommandClient } from '@forgecommerce/storefront-kit/command-client';
import { commandBaseUrl, readBaseUrl } from '@forgecommerce/storefront-kit/config';
import { createReadClient } from '@forgecommerce/storefront-kit/read-client';
import { shopperIp } from '@forgecommerce/storefront-kit/shopper-ip';

/** The port refused this caller for going too fast. Carries the port's OWN number — never a guess. */
export class PortRateLimited extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`the port refused this call for ${retryAfterSeconds}s (rate limited)`);
    this.name = 'PortRateLimited';
  }
}

/** The port's `Retry-After` when it sent a usable one, else the window the oracle cap declares. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

function retryAfterOf(res: Response): number {
  const raw = res.headers.get('retry-after');
  const n = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETRY_AFTER_SECONDS;
}

/** `fetch`, plus: a 429 becomes `PortRateLimited` with the port's own window, before any body is read. */
export const totemFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input as RequestInfo, init as RequestInit);
  if (res.status === 429) throw new PortRateLimited(retryAfterOf(res));
  return res;
};

let cachedRead: ReturnType<typeof createReadClient> | undefined;
/** The read door. Server-side only. */
export function totemRead() {
  if (!cachedRead)
    cachedRead = createReadClient({ baseUrl: readBaseUrl(), locale: 'pt-BR' }, totemFetch);
  return cachedRead;
}

let cachedCommand: ReturnType<typeof createCommandClient> | undefined;
/**
 * The write door. Server-side only.
 *
 * ★ `shopperIp` IS WIRED ON PURPOSE, and it is the kit's own, not an invention. Without it the port sees no
 * `x-forwarded-for` and buckets this caller under the literal string `unknown` — a bucket shared with every
 * other unattributed caller of the same store (the kit says exactly this in `kernel-write-clients.ts`, and
 * the bench measurement above confirms it). With it, the counter's own address is what the cap counts. It
 * does not RAISE the ceiling — one kiosk is one address, so ten a minute stands — but it stops this store's
 * budget from being spent by somebody else's server-side call.
 */
export function totemCommand() {
  if (!cachedCommand)
    cachedCommand = createCommandClient({ baseUrl: commandBaseUrl(), shopperIp }, totemFetch);
  return cachedCommand;
}
