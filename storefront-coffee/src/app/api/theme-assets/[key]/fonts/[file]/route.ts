// D2-E2 — the vitrine serves its own theme's font file. Mounted from the kit so both fronts answer this
// identically; the implementation, the allow-list and the caching all live in
// `@forgecommerce/storefront-kit/theme/asset-route`.
//
// This deployable is the edge's fall-through, so the URL is the bare one and no handle is needed for it. The
// middleware already skips `/api/` (see its matcher), so nothing rewrites this into a store tree.
export { GET } from '@forgecommerce/storefront-kit/theme/asset-route';
