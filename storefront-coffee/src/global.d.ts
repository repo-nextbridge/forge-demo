// Ambient module declarations for non-TS side-effect imports. CSS (incl. the theme package subpath
// `@forgecommerce/theme-storefront-vanilla/tokens.css`) is handled by Next's bundler, not the TS resolver, so it
// needs an ambient declaration to typecheck.
declare module '*.css';

// ★ s3-11 — AND IMAGES, which were NOT declared and made `tsc --noEmit` red on this cut before anyone looked.
// Next turns an imported image into a `StaticImageData` object (`.src` is the emitted `/_next/static/…` URL);
// the TS resolver knows nothing about that loader, so `import logo from './forge-co-logo.png'` was two
// standing TS2307 errors — which is how a typecheck stops being a signal. Declared with the loader's real
// shape rather than `any`: the chrome reads `asset.src`, and `any` would have typed that hole open too.
declare module '*.png' {
  const image: { src: string; height: number; width: number; blurDataURL?: string };
  export default image;
}
