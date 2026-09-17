import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// INFRA-1b-i: the storefront ships as a self-contained server (a container that reaches the kernel over the
// compose network). `output: 'standalone'` emits that minimal server + traced deps under `.next/standalone`,
// and `outputFileTracingRoot` (discovered below, not hardcoded) lets the tracer reach the workspace deps it
// imports (@forgeco/ext-*, @forgeco/theme-storefront-vanilla). In THIS repo it is the monorepo root,
// so the entry lands at `.next/standalone/apps/storefront/server.js`, which is what infra/storefront.Dockerfile
// copies; in a customer's packed copy it is the app itself, so the entry is `.next/standalone/server.js`.
//
// It is GATED behind FORGE_BUILD_STANDALONE=1 (set only by infra/storefront.Dockerfile) so the everyday
// `next build` — which the test suite runs (apps/api depends on the storefront build) — stays non-standalone
// and skips the standalone trace-copy step. That copy has a known intermittent ENOENT race under Next 15's
// standalone+middleware; keeping it out of the shared build hot path keeps CI deterministic. The image is
// still proven standalone by the Docker build + the local smoke.
const standalone = process.env.FORGE_BUILD_STANDALONE === '1';

// FRONT-OWN: the tracing root is discovered, not assumed. This file was cut from a front that builds in TWO
// places — inside the Forge workspace, where the app sits at `apps/storefront` and the tracer must reach the
// linked workspace deps two levels up, and in the COPY a customer owns, where the app IS the root and its
// deps are a plain `node_modules`. Hardcoding `../..` was correct only in the first: in the copy it made the
// standalone output land at `.next/standalone/apps/storefront/server.js` — a path the customer's Dockerfile
// has no reason to expect, from directories that do not exist in their repo.
//
// ── ★★ pk35/d3 — AND THE COPY'S HALF IS NO LONGER `.`, BECAUSE THIS COPY REACHES A SIBLING DIRECTORY ─────
//
// This box writes apps of its own (`apps/demo-gate`), and a front renders an app by IMPORTING it: the
// dependency is `"@forge/ext-demo-gate": "file:../apps/demo-gate"`, which npm installs as a SYMLINK pointing
// OUT of this directory. The standalone tracer never copies a file from above its root, so with the root at
// `.` the build stays green and the IMAGE is short a module — the failure `bin/front-apps.mjs` calls
// `untraced`, and the one that is invisible until a container runs. `totem/next.config.mjs` reached the same
// answer first, for the same app, and this is the same value said the same way.
//
// ⚠️ IT MOVES THE STANDALONE ENTRY, AND THE DOCKERFILE CARRIES THE OTHER HALF. With the root one directory
// up, the server lands at `.next/standalone/storefront-coffee/server.js` and the workspace's node_modules
// beside it — which is why `Dockerfile` copies to `./storefront-coffee/` and runs that path, exactly as
// `totem/Dockerfile` does. Proven by `bin/build-coffee.sh`, which asserts the entry where it now is.
//
// ⚠️ AND IT IS UNCONDITIONAL, unlike `output: 'standalone'` below. `bin/front-app-reach.guard.mjs` IMPORTS
// this config to read the tracer's root, and it does so without `FORGE_BUILD_STANDALONE` set; a value that
// only exists inside the image build would read as "the default" — the fork's own directory — and the rule
// would grade a root this project never uses.
const workspaceRoot = new URL('../../pnpm-workspace.yaml', import.meta.url);
const tracingRoot = fileURLToPath(
  existsSync(workspaceRoot) ? new URL('../..', import.meta.url) : new URL('..', import.meta.url),
);

// ⚠️ DO NOT REMOVE AS DEAD WEIGHT — it looks like a no-op in here, and it is: pnpm links the block packages
// as symlinks, so their real path is OUTSIDE node_modules and Next already compiles them like first-party
// source. It is here because this storefront IS the reference implementation a customer COPIES (FRONT-PKG),
// and there the same packages arrive as installed tarballs, under node_modules for real — which Next skips
// unless they are listed here. Without the line the copy fails to build ("Module parse failed: Unexpected
// token" on the first `export type`, then on the first CSS Module import). With it, the copy is born
// correct. Proven on a Next app outside this monorepo: scripts/publishing/front-consumer.guard.test.ts.
//
// ★ pk35/d3 — AND `@forge/ext-demo-gate` IS HERE FOR THE SAME REASON, arriving a different way. It is an app
// THIS BOX wrote, so it travels as a DIRECTORY of source (`file:../apps/demo-gate`, a symlink) rather than as
// a tarball; either way it is .tsx + CSS Modules under `node_modules`, which is exactly what Next skips
// unless it is listed here.
const transpilePackages = [
  '@forge/ext-demo-gate',
  '@forgeco/ext-banners',
  '@forgeco/ext-feed',
  '@forgeco/ext-leads',
  '@forgeco/ext-payment-mercadopago',
  '@forgeco/ext-payment-promissory',
  '@forgeco/ext-payment-reference',
  '@forgeco/ext-payment-zero',
  '@forgeco/ext-recommendations',
  '@forgeco/ext-reviews',
  '@forgeco/ext-shelves',
  '@forgeco/ext-subscriptions',
  '@forgeco/storefront-kit',
];

// ── ★★ pk29/D2 · THE BLOCK EVERY FORK OF THIS REPOSITORY CARRIES, WORD FOR WORD ─────────────────────────
//
// `bin/fork-bundle-freshness.guard.mjs` compares it byte for byte across every fork, because the failure it
// closes is silent in production and green everywhere else — a copy that drifts would go unnoticed for days.
//
// ★ WHAT THIS APP COMPILES LIKE ITS OWN SOURCE, IT MUST ALSO INVALIDATE LIKE ITS OWN SOURCE — AND THE
// DEFAULT DOES THE OPPOSITE.
//
// Measured 2026-09-09 on the image this box was born with. The container answered EVERY request with:
//
//     TypeError: (0 , i.isServerActionSubmission) is not a function
//         at tx (.next/server/src/middleware.js)
//
// The kit installed next to it DID export that function. `tsc` was green, `next build` was green, and the
// emitted middleware carried `function te(e,t,r)` — the THREE-argument `isCacheableRequest` of a kit six
// days older — while the file on disk had four parameters. The bundle was compiled from a copy webpack
// never re-read.
//
// WHY: webpack validates anything under `snapshot.managedPaths` by the package's VERSION, never by its
// bytes, and Next marks ALL of `node_modules` managed (`^(.+?[\\/]node_modules[\\/])`). The Forge packages
// arrive here as local tarballs pinned at one version forever (`bin/vendor-packages.sh`), so the version
// never moves and the compilation cached in `.next/cache/webpack` is reused across re-vendors, re-installs
// and image rebuilds alike. `bin/install-storefront.sh` had already learned the npm-shaped half of this
// lesson (it evicts the vendored entries from the lock so npm re-reads the tarballs); this is the webpack
// half, and it is why re-baking the image "from zero" did not move the defect.
//
// ⚠️ IT IS NOT "`transpilePackages` DID NOT COVER IT". It did: nothing of the kit is in the image's
// node_modules, the whole thing is bundled. What was bundled was stale.
//
// The scopes are DERIVED from `transpilePackages` above — that list already means "compile this like our own
// code", and this is the other half of the same sentence, so a package added there tomorrow is covered
// without anybody remembering that this block exists.
const sourceScopes = [...new Set(transpilePackages.map((name) => name.split('/')[0]))];
const pathSep = String.raw`[\\/]`;
const contentCheckedManagedPaths = [
  new RegExp(
    String.raw`^(.+?${pathSep}node_modules${pathSep})(?!(?:${sourceScopes.join('|')})${pathSep})`,
  ),
];

/**
 * ★★ AND A MISSING EXPORT BECOMES A BUILD ERROR, WHICH IS WORTH MORE THAN THE FIX ABOVE.
 *
 * webpack's default answer to "this module imports a name the module it imports from does not export" is a
 * WARNING (`exportsPresence: 'auto'`). `next build` prints it and exits 0, and the code it emits keeps the
 * ORIGINAL name as a property lookup on the namespace object — which is literally the
 * `(0 , i.isServerActionSubmission)` in the stack trace above — so the app throws in production instead.
 * At `error`, the same fact is a red build that NAMES the symbol and the module it was looked for in.
 *
 * ⚠️ WEBPACK ONLY. A build switched to Turbopack never calls this hook and gets neither half back.
 */
function forkWebpack(config) {
  config.snapshot = { ...config.snapshot, managedPaths: contentCheckedManagedPaths };
  config.module.parser = {
    ...config.module.parser,
    javascript: { ...config.module.parser?.javascript, exportsPresence: 'error' },
  };
  return config;
}
// ── end of the shared block ─────────────────────────────────────────────────────────────────────────────

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ★★ D2-C1 — THIS SHOP'S ASSETS GET THEIR OWN NAMESPACE, and the failure it prevents is the silent one.
  //
  // This box serves THREE Next apps on ONE origin: the reference vitrine (the fall-through), the checkout
  // (`/_checkout`), and this fork under `/s/cafe`. All three ask the browser for their JavaScript and CSS at
  // `/_next/static/…` by default — the SAME namespace — and the edge can only send that path to ONE of them.
  // The other two then load chunks from a server that has never heard of their build id.
  //
  // It is NOT an error anywhere: the HTML arrives, no server logs a thing, and the shopper meets an UNSTYLED
  // SHOP. The checkout paid for this lesson in CHECKOUT-APP C3; this front would have paid for it again,
  // because splitting by path prefix (`/s/cafe`) does nothing for an asset URL that starts at the root.
  //
  // ⚠️⚠️ AND THE EDGE HAS TO STRIP IT — `handle_path`, never `handle`. Measured on the real image in C3: a
  // Next server with an `assetPrefix` set EMITS the prefixed URL into its HTML and then answers 404 to it;
  // it serves those files at `/_next/static/…` and nowhere else. The prefix is an instruction to the edge,
  // not a route this app owns. See `caddy/extra-local/coffee.caddy`, which carries the other half.
  //
  // ⚠️ IT DOES NOT MOVE `/_next/image` (measured in D2-F3: Next keeps `images.path` at the bare path with a
  // prefix set). This shop never mints such a URL — its photographs go through the derivative door
  // (`/api/img/...`), which is this container's own route under `/s/cafe`'s neighbour paths — so there is
  // nothing here to route. A `next/image` added to this fork later would need its own edge block.
  assetPrefix: '/_coffee',

  // The storefront is a pure read-port consumer; nothing here touches a DB.
  reactStrictMode: true,
  transpilePackages,
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
  webpack: forkWebpack,
  // ★ pk35/d3 — DECLARED ALWAYS, not only for the image. See the note beside `tracingRoot`: a rule that reads
  // this config to ask "does the tracer cover the app you import from ../apps?" runs an ordinary import, and a
  // value hidden behind an env var would answer for a build nobody makes.
  outputFileTracingRoot: tracingRoot,
  ...(standalone ? { output: 'standalone' } : {}),
};

export default nextConfig;
