// The totem's Next config, and it is SHORTER than the coffee vitrine's on purpose — the difference is the
// whole architecture of this slice.
//
// The vitrine shares one origin with the checkout, so it carries an `assetPrefix` and a middleware that
// rewrites a bare path into a store tree. THIS app serves the counter's host BY ITSELF: every path under it
// is the totem's, there is no second Next server behind the same hostname, and therefore no prefix, no
// basePath and no store in the URL. The store comes from the environment (see `src/lib/store.ts`), which is
// what "one image serving the whole host" means in a config file.
//
// `output: 'standalone'` is gated behind FORGE_BUILD_STANDALONE for the same reason the vitrine gates it:
// the standalone trace-copy is only needed for the image, and keeping it off the ordinary build keeps
// `npm run build` deterministic.
const standalone = process.env.FORGE_BUILD_STANDALONE === '1';

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,

  // ★ THE DEMO GATE TRAVELS AS SOURCE (.tsx + CSS Modules) from `apps/demo-gate/`, because this app does not
  // go through the fleet oven that composes instance apps into the product images. Next has to compile it
  // like our own code. `src/lib/gate/registry.tsx` says why the registry entry is written by hand here.
  //
  // ⚠️ IT IS A `file:` DEPENDENCY THAT NPM INSTALLS AS A SYMLINK, and the install needs `--legacy-peer-deps`
  // the first time a tree is built from scratch — npm 10.9.8 crashes resolving vitest's optional peer set
  // ("Cannot read properties of null (reading 'edgesOut')"). Once `package-lock.json` exists, the ordinary
  // `bin/install-storefront.sh totem` works unchanged, which is why the lock is committed.
  // Both of this app's source-shipped dependencies. The kit travels as TypeScript (it is a `pack-surface`
  // package, not a built one) and the gate travels as .tsx + CSS Modules, so Next compiles both like our own
  // code — exactly as `storefront-coffee/next.config.mjs` does for the same kit.
  transpilePackages: ['@forgecommerce/storefront-kit', '@forge/ext-demo-gate'],

  // The other half of the same seam: the gate's real path is one directory up, so the standalone tracer has
  // to be allowed to reach outside this app when it copies the server's files.
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,

  // The counter's screen is a fixed 1080x1920 panel on a LAN, and every product photograph it shows is
  // already a kernel media URL. There is nothing for the image optimiser to negotiate — no responsive
  // breakpoints, no unknown viewport — so the totem serves the media URL as it is and keeps one moving part
  // out of a machine that has to survive a day unattended.
  images: { unoptimized: true },

  ...(standalone
    ? {
        output: 'standalone',
      }
    : {}),
};
