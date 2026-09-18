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

const transpilePackages = ['@forgeco/storefront-kit', '@forge/ext-demo-setup'];

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
export default {
  reactStrictMode: true,

  // ★ THIS BOX'S OWN APP TRAVELS AS SOURCE (.tsx + CSS Modules) from `apps/demo-setup/`, because this front
  // does not go through the fleet oven that composes instance apps into the product images. Next has to
  // compile it like our own code. `src/components/DemoNotice.tsx` says why it is mounted by hand here.
  //
  // ⚠️ IT IS A `file:` DEPENDENCY THAT NPM INSTALLS AS A SYMLINK, and the install needs `--legacy-peer-deps`
  // the first time a tree is built from scratch — npm 10.9.8 crashes resolving vitest's optional peer set
  // ("Cannot read properties of null (reading 'edgesOut')"). Once `package-lock.json` exists, the ordinary
  // `bin/install-storefront.sh totem` works unchanged, which is why the lock is committed.
  // Both of this app's source-shipped dependencies. The kit travels as TypeScript (it is a `pack-surface`
  // package, not a built one) and the instance app travels as .tsx + CSS Modules, so Next compiles both like
  // our own code — exactly as `storefront-coffee/next.config.mjs` does for the same kit.
  transpilePackages,

  // The other half of the same seam: the app's real path is one directory up, so the standalone tracer has
  // to be allowed to reach outside this app when it copies the server's files.
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,

  // The counter's screen is a fixed 1080x1920 panel on a LAN, and every product photograph it shows is
  // already a kernel media URL. There is nothing for the image optimiser to negotiate — no responsive
  // breakpoints, no unknown viewport — so the totem serves the media URL as it is and keeps one moving part
  // out of a machine that has to survive a day unattended.
  images: { unoptimized: true },

  webpack: forkWebpack,
  ...(standalone
    ? {
        output: 'standalone',
      }
    : {}),
};
