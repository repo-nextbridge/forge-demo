// THE STOREFRONT CACHE BUST — the box's, not one shop's.
//
// ★ WHY THIS FILE EXISTS AT ALL, AND IT IS THE HALF OF `APOSENTA-VITRINE-MJS` THAT COULD BE DONE HERE.
// The bust used to be step 7 of `seed/vitrine.mjs` — a private `revalidate()` at the bottom of the module
// that composes the SPORTS store's window. That made the whole box's cache correctness a side effect of one
// shop's seeder, and the card that wants `seed/vitrine.mjs` retired could not remove the file without
// removing the bust with it. The symptom of losing it is the worst kind: *the home serves the previous
// render*, which nobody connects to a seed. So it moves out first and gets an owner with a name.
//
// ⚠️ AND THE MOVE IS NOT A MOVE OF PLACE ONLY — THE OLD PLACEMENT WAS MEASURABLY TOO NARROW, in two ways
// that are both facts about `bin/seed.mjs` as it stands:
//
//   · ONE STORE OF FOUR. `revalidate()` was called with the `forge` store and no other. The window phase
//     also runs `priceOutlet` (`seed/outlet.mjs` — `composition.place`, `composition.update_config` and the
//     outlet's "de"), and the curated phase composes the counter, the café and the chrome. None of those
//     shops was ever busted by anything.
//   · MID-PHASE. It ran inside `seedVitrine`, and THREE further writers run after it in the same phase —
//     `seedLogistics`, `seedAudience` and `seedCommerce` (reviews, and one live order per selling store).
//     Everything they wrote landed behind a cache that had just been declared fresh.
//
// ⇒ THE OWNER IS THE PHASE, NOT THE SHOP. `bin/seed.mjs` calls this as the LAST thing each phase does, over
// every store the PORT lists — never over a handle typed here. `bin/purge.guard.mjs` holds both halves of
// that sentence: the call is there, and nothing was appended after it.
//
// ── THE TAGS ARE THE ADMIN'S OWN PAIR, NOT AN INVENTION ──────────────────────────────────────────────────
// In the product, `apps/admin/src/lib/storefront-client.ts` posts `store:<id>` when an operator saves the
// store and `extensions:<id>` when they save a composition. This seed does both kinds of write, so it asks
// for both — the same hook, the same secret, the same two words. A tag this file invented would be a tag
// the storefront never attached to anything, i.e. a purge that purges nothing and says `ok`.
//
// ── ONE REQUEST PER STORE, DELIBERATELY ──────────────────────────────────────────────────────────────────
// The route takes repeated `tag` params and caps them at `MAX_TAGS = 50` (`apps/storefront/src/app/api/
// revalidate/route.ts`), silently slicing the rest. A single call for the whole box would therefore start
// dropping stores at twenty-six with a 200 and an `ok: true`. Per store there is no cap to reach, and the
// log names the shop that was busted instead of printing a total.
//
// ── ⚠️ WHAT THIS CANNOT REACH, NAMED RATHER THAN PRETENDED ──────────────────────────────────────────────
// `/api/revalidate` at the edge falls through to the default `handle { reverse_proxy storefront:3000 }`
// (`caddy/Caddyfile.local`, `caddy/Caddyfile`), so it reaches the REFERENCE vitrine and only it. The café's
// fork (`storefront-coffee`) holds its own Next cache behind `handle /s/cafe*` and has no door on this path;
// the checkout has no such hook at all (measured: `/_checkout/api/revalidate` is a 404 and that container
// carries no `FORGE_REVALIDATE_SECRET` — README §3). Restarting the container is the only lever for those
// two. This function still asks for every store, because the tag of a store the café serves is harmless
// where nobody holds it and the day that fork gains a door nothing here changes.

/**
 * The tags one store's cache is held under — the admin's pair, spelled once.
 *
 * Exported because the guard grades it and because a second spelling of `store:` in this repository is a
 * second thing that can be wrong on its own.
 */
export function purgeTagsFor(storeId) {
  return [`extensions:${storeId}`, `store:${storeId}`];
}

/**
 * Bust the storefront's cache for every store this tenant has.
 *
 * @param port {{ api: string, read: Function, rows: Function, log: Function }}
 * @param fetchImpl the injection point the test drives; production passes nothing.
 * @returns the store ids it asked for, in order — so a caller (and the guard) can see WHAT was asked, not
 *          just that something was.
 */
export async function purgeStorefrontCache({ api, read, rows, log }, fetchImpl = fetch) {
  // No secret means a LINE, never a failure: a box may legitimately run without one, and everything this
  // seed wrote landed either way. What the human must not be left guessing is WHICH pages are now stale.
  const secret = (process.env.FORGE_REVALIDATE_SECRET ?? '').trim();
  const stores = rows(await read('stores'));
  if (stores.length === 0) {
    log('purge — the port lists no store for this tenant; nothing to bust.');
    return [];
  }
  const ids = stores.map((s) => s.id);
  if (secret === '') {
    log(
      'purge — no FORGE_REVALIDATE_SECRET: everything this run wrote landed, and the STOREFRONT still\n' +
        `        serves its cached render until the TTL for ${stores.map((s) => s.handle).join(', ')}.\n` +
        '        Bust it with the curl in the README (README §3, "A placement driven through the port").',
    );
    return ids;
  }
  for (const store of stores) {
    const query = purgeTagsFor(store.id)
      .map((tag) => `tag=${encodeURIComponent(tag)}`)
      .join('&');
    let res;
    try {
      res = await fetchImpl(`${api}/api/revalidate?${query}`, {
        method: 'POST',
        headers: { 'x-revalidate-secret': secret },
      });
    } catch (err) {
      // ⚠️ SAID, NEVER SWALLOWED. The old `revalidate()` did not catch, so a storefront that was not
      // answering ended a birth that had otherwise succeeded — after every write had landed.
      log(
        `purge — ${store.handle}: the revalidation hook did not answer (${err.message}). Everything this ` +
          'run wrote landed; the pages are stale until the TTL.',
      );
      continue;
    }
    log(
      res.ok
        ? `purge — ${store.handle} (${store.id}): cache busted; the composed pages are what the next request gets`
        : `purge — ${store.handle} (${store.id}): revalidate answered HTTP ${res.status}. The writes landed; ` +
          'the pages are stale until the TTL.',
    );
  }
  return ids;
}
