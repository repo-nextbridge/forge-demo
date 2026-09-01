import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// INFRA-1b-i: the storefront ships as a self-contained server (a container that reaches the kernel over the
// compose network). `output: 'standalone'` emits that minimal server + traced deps under `.next/standalone`,
// and `outputFileTracingRoot` (discovered below, not hardcoded) lets the tracer reach the workspace deps it
// imports (@forgecommerce/ext-*, @forgecommerce/theme-storefront-vanilla). In THIS repo it is the monorepo root,
// so the entry lands at `.next/standalone/apps/storefront/server.js`, which is what infra/storefront.Dockerfile
// copies; in a customer's packed copy it is the app itself, so the entry is `.next/standalone/server.js`.
//
// It is GATED behind FORGE_BUILD_STANDALONE=1 (set only by infra/storefront.Dockerfile) so the everyday
// `next build` — which the test suite runs (apps/api depends on the storefront build) — stays non-standalone
// and skips the standalone trace-copy step. That copy has a known intermittent ENOENT race under Next 15's
// standalone+middleware; keeping it out of the shared build hot path keeps CI deterministic. The image is
// still proven standalone by the Docker build + the local smoke.
const standalone = process.env.FORGE_BUILD_STANDALONE === '1';

// FRONT-OWN: the tracing root is discovered, not assumed. This same file builds in TWO places — here, where
// the app sits at `apps/storefront` of a pnpm workspace and the tracer must reach the linked workspace deps
// two levels up, and in the COPY a customer owns, where the app IS the root and its deps are a plain
// `node_modules`. Hardcoding `../..` was correct only in the first: in the copy it made the standalone output
// land at `.next/standalone/apps/storefront/server.js` — a path the customer's Dockerfile has no reason to
// expect, from directories that do not exist in their repo. The workspace manifest is the honest signal.
const workspaceRoot = new URL('../../pnpm-workspace.yaml', import.meta.url);
const tracingRoot = fileURLToPath(
  existsSync(workspaceRoot) ? new URL('../..', import.meta.url) : new URL('.', import.meta.url),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The storefront is a pure read-port consumer; nothing here touches a DB.
  reactStrictMode: true,
  // ⚠️ DO NOT REMOVE AS DEAD WEIGHT — it looks like a no-op in here, and it is: pnpm links the block packages
  // as symlinks, so their real path is OUTSIDE node_modules and Next already compiles them like first-party
  // source. It is here because this storefront IS the reference implementation a customer COPIES (FRONT-PKG),
  // and there the same packages arrive as installed tarballs, under node_modules for real — which Next skips
  // unless they are listed here. Without the line the copy fails to build ("Module parse failed: Unexpected
  // token" on the first `export type`, then on the first CSS Module import). With it, the copy is born
  // correct. Proven on a Next app outside this monorepo: scripts/publishing/front-consumer.guard.test.ts.
  transpilePackages: [
    '@forgecommerce/ext-banners',
    '@forgecommerce/ext-feed',
    '@forgecommerce/ext-leads',
    '@forgecommerce/ext-payment-mercadopago',
    '@forgecommerce/ext-payment-promissory',
    '@forgecommerce/ext-payment-reference',
    '@forgecommerce/ext-payment-zero',
    '@forgecommerce/ext-recommendations',
    '@forgecommerce/ext-reviews',
    '@forgecommerce/ext-shelves',
    '@forgecommerce/ext-subscriptions',
    '@forgecommerce/storefront-kit',
  ],
  // PERF — the media masters are CONTENT-ADDRESSED (immutable: the provider_key changes when the bytes do), so the
  // next/image derivatives are safe to cache for a year. Without this the optimizer stamps its default 60s
  // (`max-age=60, must-revalidate`) on every /_next/image response, so repeat visits re-fetch and Lighthouse's
  // "efficient cache policy" audit flags them. A changed image mints a new key → new URL → no stale hit.
  // Since PERF-C the THEME's images do not go through `/_next/image`: the derivative door
  // (`/api/img/<format>/<width>/<key>`) fronts it so the FORMAT lives in the URL instead of in `Accept`. The
  // optimizer is still what transforms, and this TTL is still what keeps its on-disk cache warm across the
  // loopback call.
  //
  // ⚠️ AND SINCE D2-F3 THAT IS TRUE OF THE APPS TOO — it was not, and the correction is worth keeping because
  // of how long the false version stood. This comment once said "the browser never sees `/_next/image`"; E4
  // measured the opposite (`extensions/banners/render.tsx` rendered a real `next/image`, its block is in the
  // generated registry of BOTH fronts, and ONE banner emitted 8 `/_next/image` URLs, w=640 to w=3840, fetched
  // by the browser with its own `Accept`) — the Cloudflare-Free failure PERF-C exists to remove, alive in the
  // hero and very likely the page's LCP. F3 moved the block onto the door: it now emits `/api/img/…`, in two
  // explicit lanes, and `scripts/composition/next-image.guard.test.ts` is red if any composed app imports
  // `next/image` again.
  //
  // ⚠️ WHAT IS STILL NOT TRUE: that `/_next/image` is unreachable. Every Next server mounts it, this one
  // included, and a browser can ask for it by hand — what changed is that no page EMITS one. So the reason
  // `images.formats` stays untouched here is WEAKER than E4 had to state it, and it has not gone away: the
  // setting is process-wide and this route is browser-reachable, so `image/avif` here would still be a
  // performance decision about the whole app rather than a containment one. See
  // `src/lib/derivative-accept.ts`, which is where that trade is written out.
  images: { minimumCacheTTL: 31536000 },
  // DEMO CAPTURE — hide the Next dev indicator (the bottom-corner badge) so a screen recording of the local demo
  // shows ZERO framework chrome. Opt-in via FORGE_HIDE_DEV_INDICATORS=1; unset → normal dev, indicator visible.
  //
  // ⚠️ IT IS `devIndicators: false`, AND THE TWO KEYS IT REPLACES WOULD HAVE MADE THE SENTENCE ABOVE A LIE.
  // `appIsrStatus` and `buildActivity` are deprecated as of Next 15.2 — "deprecated and no longer
  // configurable" — so they warn once each per build and are then IGNORED. Measured on 15.2.9, counting the
  // elements the dev overlay actually PAINTS inside its `<nextjs-portal>` shadow root: the old spelling drew
  // NINE, `button[data-nextjs-dev-tools-button]` at 32x32 among them; this one draws ZERO. The version bump
  // that carries the no-JS server-action fix is what put the old spelling out of date, so it dies with it.
  ...(process.env.FORGE_HIDE_DEV_INDICATORS === '1' ? { devIndicators: false } : {}),
  ...(standalone
    ? {
        output: 'standalone',
        outputFileTracingRoot: tracingRoot,
      }
    : {}),
};

export default nextConfig;
