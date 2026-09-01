// E4-ALPHA — what the derivative door tells the Next optimizer it accepts, per lane. Extracted from the route
// so a test can drive the MECHANISM instead of retyping it (a `route.ts` may only export HTTP methods and the
// route segment config, so the map cannot live there and still be importable).
//
// WHY THIS IS NOT A CONSTANT MAP ANY MORE — the measured defect. The `orig` lane promises the master's own
// format, served through untouched. It kept that promise by asking for a media type the optimizer negotiates
// NOTHING from (`image/jpeg,image/png,image/gif` intersects `images.formats` — webp only — in nothing), which
// makes Next fall back to "keep the upstream type". Except it does not always keep it:
//
//     if (mimeType) contentType = mimeType;
//     else if (upstreamType?.startsWith('image/') && getExtension(upstreamType)
//              && upstreamType !== WEBP && upstreamType !== AVIF) contentType = upstreamType;
//     else contentType = JPEG;                    // ← a WEBP or AVIF master lands HERE
//                                                 (next/dist/server/image-optimizer.js, Next 15.2.9)
//
// and `optimizeImage` then runs `sharp.jpeg({ mozjpeg: true })`, which composites alpha onto BLACK. Measured on
// the real optimizer: a fully transparent webp master through the `orig` lane came back `image/jpeg`, alpha 255,
// pixel `[0,0,0]`. Same for avif. PNG and GIF are safe on both lanes; a JPEG master has no alpha to lose.
//
// It is reachable, not theoretical: `packages/core/src/media/plan-upload.ts` accepts `image/webp` and
// `image/avif` uploads, and the `orig` lane is the `<img>`'s own `src`/`srcSet` inside MediaImage's `<picture>`
// — what every webp-less browser, crawler and `onError` fallback fetches, plus any direct hit on the URL.
//
// THE FIX, AND WHY IT IS A FUNCTION OF THE KEY. The only honest signal of the master's format available before
// the fetch is the provider_key's extension, which `plan-upload` mints per accepted mime (jpg/png/webp/gif/avif)
// — so the lane asks for a format that CARRIES alpha whenever the default would flatten it, and is unchanged
// (byte for byte, the request it always sent) for every other master. An extension we do not know falls back to
// the original list: today's behaviour, which is safe for every master Next keeps.

import type { ImageFormat } from '@forgecommerce/storefront-kit/media/driver';

/** What the `orig` lane asks for when the optimizer will keep the master's own format anyway. No wildcard:
 * `image/*` would match `image/webp` and the optimizer would transcode, which would make the URL a lie. */
const ORIG_ACCEPT = 'image/jpeg,image/png,image/gif';

/**
 * The master extensions Next would flatten to JPEG on a lane that negotiates nothing → what the `orig` lane must
 * ask for instead. The value has to be a member of the optimizer's configured `images.formats`, because that is
 * the only thing `getSupportedMimeType` matches the `Accept` against — asking for a type Next does not have
 * configured changes nothing and the master still lands in the JPEG branch (measured).
 *
 * ⚠️ AND HERE THE `orig` LANE KNOWINGLY BREAKS ITS OWN PROMISE — say it plainly, because a lane that quietly
 * does not do what its name says is worse than one that documents the exception. `orig` means "the master's own
 * format" (media/driver.ts), and for an AVIF master it serves WEBP. It is a deliberate exception with a price
 * attached: making it honest means putting `image/avif` in `apps/storefront/next.config.mjs`'s `images.formats`,
 * and that setting is PROCESS-WIDE while `/_next/image` is a route this server mounts and a browser can ask for
 * directly. That is a PERFORMANCE decision (measured: +59% encode time at w=640, +40% at w=1920, for a 41%
 * smaller file), and it does not belong smuggled inside a transparency fix.
 *
 * ⚠️ THE ARGUMENT ABOVE IS WEAKER SINCE D2-F3 — weaker, and not gone, which is the distinction that matters
 * here. It used to rest on `extensions/banners/render.tsx` rendering a real `next/image`, so the optimizer was
 * not merely mountable but ACTIVELY ADDRESSED by every store's hero, negotiating on the browser's own `Accept`.
 * That call site is gone (the block draws through the derivative door now) and no front emits a `/_next/image`
 * URL any more. What has NOT changed: the route still exists, `images.formats` still applies process-wide to it,
 * and nothing stops a request arriving at it. So enabling AVIF remains a decision about the whole app rather
 * than a contained one — it is just no longer a decision about what every shopper is served by default.
 * WebP keeps the alpha — which is the whole point of this rule — and reaches nothing outside this route. Both
 * formats decode anywhere an AVIF master could have decoded at all, so no shopper loses an image over it.
 * Changing the call is one entry here plus one line in `next.config.mjs`; the alpha matrix asserts the PIXEL, so
 * it holds either way — only `ENCODED_AS` in `img-alpha.test.ts` moves.
 */
const ALPHA_CARRYING_ACCEPT: Record<string, string> = {
  webp: 'image/webp',
  avif: 'image/webp',
};

/**
 * Every canonical image extension the kernel mints a provider_key with (`plan-upload`'s allow-list, one per
 * accepted upload mime). This module has an answer for each of them, and `img-alpha.test.ts` builds its
 * per-pixel matrix FROM this list — so a format the kernel starts accepting cannot quietly become a sixth
 * unproven path: `derivative-accept.guard.test.ts` grades this list against the kernel's own and goes red
 * naming the new one, and adding it here is what puts it under the alpha proof.
 */
export const MASTER_EXTENSIONS = ['jpg', 'png', 'webp', 'gif', 'avif'] as const;

/** The master's canonical extension, as `plan-upload` mints it. Lower-cased; empty when the key carries none. */
export function masterExtension(providerKey: string): string {
  const lastSegment = providerKey.slice(providerKey.lastIndexOf('/') + 1);
  const dot = lastSegment.lastIndexOf('.');
  return dot === -1 ? '' : lastSegment.slice(dot + 1).toLowerCase();
}

/** The `Accept` this lane sends to the optimizer for this master. The browser never gets a vote — that is the
 * whole point of the derivative door — so this is the only place the output format is decided. */
export function acceptFor(format: ImageFormat, providerKey: string): string {
  if (format === 'webp') return 'image/webp';
  return ALPHA_CARRYING_ACCEPT[masterExtension(providerKey)] ?? ORIG_ACCEPT;
}
