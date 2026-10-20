// VC-1 (Forge v0.3.3) — the `cacheHandler` next.config.mjs names: the kit's capped data cache
// (`@forgeco/storefront-kit/data-cache-handler`; the ceiling, the free-disk floor and the directory are the
// FORGE_DATA_CACHE_* variables compose hands this container). Copied from the Forge reference storefront
// (`apps/storefront/data-cache-handler.mjs` at v0.3.3), which is what `templates/surfaces/storefront/README.md`
// tells a copy to keep. A file of this app, and not the kit's path, because Next imports it untranspiled at
// server start and because THIS directory is the one that reaches `next` inside the standalone image — so the
// app hands Next's own file-system cache (pages) to the kit instead of the kit looking for it.
import { createRequire } from 'node:module';
import { withPagesCache } from '@forgeco/storefront-kit/data-cache-handler';

const fileSystemCache = createRequire(import.meta.url)(
  'next/dist/server/lib/incremental-cache/file-system-cache.js',
);

export default withPagesCache(fileSystemCache.default ?? fileSystemCache);
