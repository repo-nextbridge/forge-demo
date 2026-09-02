// WHICH STORE IS A TENANT'S BOOTSTRAP ONE, AND WHO GETS TO SAY SO — one function, because two files answer
// and only one of them is read by anything that acts (A13).
//
// ── ⛔ THE DISAGREEMENT, MEASURED ────────────────────────────────────────────────────────────────────────
//
//     seed/box.json     forgeco → `forge`   (bootstrap: true)  · forgecafe → `cafe`
//     seed/catalog.json forgeco → `outlet`  (bootstrap: true)  · forgecafe → `cafe`
//     .env.example:34   FORGE_REF_STORE_HANDLE=forge
//     bin/box-up.sh:194 `jq … select(.bootstrap) | .handle` — from box.json, NEVER from catalog.json
//
// So `box.json` is what the box is actually built from, and `catalog.json` is wrong about `forgeco`.
//
// ⚠️ AND IT IS NOT INERT, THOUGH IT LOOKS IT. Today `bin/seed.mjs` runs at step 8, when both stores already
// exist, so nobody notices. On the day the bootstrap store is genuinely missing — a half-finished box, a
// one-shot that failed — `stores()` dies with *"the bootstrap store `outlet` does not exist. Run the
// one-shot first"*, which names the WRONG STORE and prescribes a command that would never create it. The
// reader then verifies a thing that is fine and is left with nothing. It is the same family as the two
// defects this slice exists to fix: the failure is not the write, it is the sentence sending somebody to
// the wrong place, and it only shows up on the bad day.
//
// ⚠️ WHY THE `bootstrap` FLAG IN `catalog.json` IS NOT SIMPLY FLIPPED HERE, and this is a decision and not a
// dodge. `box.json`'s own `_readme` declares that file's `stores` array SUPERSEDED and says it is being
// restructured by another slice in this wave — *"two hands in one file is how a merge eats a decision"*.
// And flipping the flag is NOT a no-op: `stores()` treats a bootstrap store as "check it, and apply the
// theme the catalogue declares" and a non-bootstrap one as "create it, or skip it if it is already there".
// Moving `outlet` off the flag would therefore stop `theme_key: "outlet"` ever being applied to a store that
// already exists — trading a bad error message for a shop that silently loses its theme.
//
// So: the flag stays where the restructuring slice will find it, and the MESSAGE stops lying. This function
// is the source of the true answer, and `topologyDisagreement` is the sentence that names the conflict
// instead of picking a side in silence.

/**
 * The bootstrap store of one tenant, according to `seed/box.json` — the file `bin/box-up.sh` reads.
 *
 * @returns the store row, or `null` when that file names none for this tenant.
 */
export function bootstrapStoreOf(box, tenant) {
  const spec = (box?.tenants ?? []).find((t) => t.id === tenant);
  return (spec?.stores ?? []).find((s) => s.bootstrap) ?? null;
}

/**
 * The two files' answers, side by side, or `null` when they agree.
 *
 * ⚠️ IT REPORTS RATHER THAN RESOLVES. A helper that quietly returned "the right one" would leave the two
 * files disagreeing forever with nothing to notice it — which is the state that produced A13.
 */
export function topologyDisagreement(box, catalogStores, tenant) {
  const authority = bootstrapStoreOf(box, tenant);
  const claimed = (catalogStores ?? []).filter((s) => (s.tenant ?? tenant) === tenant && s.bootstrap);
  const claimedHandles = claimed.map((s) => s.handle);
  if (authority && claimedHandles.length === 1 && claimedHandles[0] === authority.handle) return null;
  return {
    tenant,
    authority: authority?.handle ?? null,
    claimed: claimedHandles,
    sentence:
      `seed/box.json says the bootstrap store of "${tenant}" is ` +
      `${authority ? `"${authority.handle}"` : 'none'}, and seed/catalog.json marks ` +
      `${claimedHandles.length ? claimedHandles.map((h) => `"${h}"`).join(', ') : 'none'}.\n` +
      '  ⚠️ box.json WINS: `bin/box-up.sh` reads the bootstrap handle from it and never from catalog.json,\n' +
      '  and `.env.example` (FORGE_REF_STORE_HANDLE) agrees with it. The `stores` array in catalog.json is\n' +
      "  declared SUPERSEDED by box.json's own header and is being restructured by another slice.",
  };
}
