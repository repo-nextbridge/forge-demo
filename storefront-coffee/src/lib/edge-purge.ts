// PERF-B — purging the CDN, as a DRIVER.
//
// Since the catalog's HTML carries `s-maxage`, an event that invalidates a page now has TWO caches to reach:
// the origin's route cache (revalidateTag — immediate, proven by scripts/edge-cache-proof.mjs) and whatever
// edge sits in front (bounded by the TTL unless it is told). Telling it is vendor-specific — tag purge is a
// Cloudflare-Enterprise feature, Fastly calls it surrogate keys, some CDNs only purge by URL — and the
// platform's rule for anything vendor-specific is the OTel rule: a driver, never a dependency (PERF decision 4).
//
// WHAT SHIPS: the seam and the `none` driver, which is the honest default. `none` does not mean "broken": the
// origin cache IS purged on every event, so a redeploy or a warm origin serves the new HTML immediately, and
// the edge converges within the TTL (300s by default — the backstop that decision 2 is explicit about). An
// instance that wants instant edge convergence registers its driver here and points
// FORGE_EDGE_PURGE_DRIVER at it. No half-working vendor driver is shipped that nobody here can execute
// against a real account; the runbook documents what to configure instead
// (docs/operations/performance.md).

/** What an edge driver must do: drop the cached HTML associated with these invalidation tags. */
export type EdgePurgeDriver = {
  /** Driver id, as `FORGE_EDGE_PURGE_DRIVER` names it and as the hook reports back. */
  name: string;
  /** True when the edge was actually told. `false` is a legitimate answer (the `none` driver), never a throw:
   * a CDN that cannot be reached must not fail the invalidation that already succeeded at the origin. */
  purge(tags: string[]): Promise<boolean>;
};

/** The default: the origin cache is purged, the edge converges on its TTL. */
const NONE: EdgePurgeDriver = {
  name: 'none',
  purge: async () => false,
};

/** Registered drivers, by id. An instance adds its own here — one import, one entry (the block/gate registry
 * shape), so what a build can purge with is a fact of the build, not of an env string. */
const DRIVERS: Record<string, EdgePurgeDriver> = {
  none: NONE,
};

/** The driver this instance runs. Unknown id → `none` (never a crash on the invalidation path). */
export function edgePurgeDriver(): EdgePurgeDriver {
  const id = process.env.FORGE_EDGE_PURGE_DRIVER?.trim();
  return (id ? DRIVERS[id] : undefined) ?? NONE;
}

/** Ask the edge to drop these tags. Reports which driver answered and whether it did anything; never throws. */
export async function purgeEdge(
  tags: string[],
  driver: EdgePurgeDriver = edgePurgeDriver(),
): Promise<{ driver: string; purged: boolean }> {
  if (tags.length === 0) return { driver: driver.name, purged: false };
  try {
    return { driver: driver.name, purged: await driver.purge(tags) };
  } catch {
    return { driver: driver.name, purged: false };
  }
}
