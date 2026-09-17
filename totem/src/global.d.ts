// Ambient module declarations for non-TS side-effect imports. CSS (incl. the theme package subpath
// `@forgeco/theme-storefront-vanilla/tokens.css`) is handled by Next's bundler, not the TS resolver, so it
// needs an ambient declaration to typecheck.
declare module '*.css';
