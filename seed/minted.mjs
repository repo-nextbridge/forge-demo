// WHAT THIS RUN JUST MADE — a registry with the scope of ONE run, and the sentence to say when a lookup
// comes up empty anyway.
//
// ── ★★ THE CLASS OF DEFECT THIS EXISTS TO END, AND IT BILLED THIS REPOSITORY FOUR TIMES IN ONE DAY ────────
//
// The kernel's write face and its READ face are separated by a projection. A command commits and returns —
// with the ids it minted — and the read that answers "does this exist?" catches up a moment later. Every
// step of this seed that CREATES something and then asks a READ about it is therefore racing, and the race
// is only visible on a box where the thing is genuinely new: on a bench carrying yesterday's data the read
// always answers, and the step looks correct forever.
//
// The four, in the order they were paid for:
//   1. `publish()` — asked `products_admin` for the id of a product it had just created. Died naming the
//      product it had made seconds earlier.
//   2. the counter's stock — asked the same read for sku codes it had just minted.
//   3. the shared `stock()` — same question, same read, on the coffee tenant's first complete run.
//   4. `seedTotem` — asked by HANDLE for the six coffees the step before it had created.
//
// ⚠️ EACH ONE WAS FIXED WHERE IT HURT, AND THAT IS WHY THERE WAS A FOURTH. Three point fixes in one file is
// not three bugs; it is one design missing. So the registry is the design: **whoever CREATES registers what
// it minted, and whoever NEEDS consults the registry before falling back to a read.**
//
// ★ WHY THIS AND NOT A WAIT. `seed/forge.mjs` has `awaitQuietCatalogue`, and it is right THERE: ~2 790
// products created in pools, where no registry of that size is worth carrying and the whole catalogue has to
// become readable anyway. Here the registry is better for a reason a wait cannot match — IT COVERS EXACTLY
// THE WINDOW WHERE THE RACE EXISTS. Only something created by THIS run can race; that is precisely what the
// registry holds. A lookup for something an EARLIER run made falls through to the read, where there is no
// race to lose. No polling, no timeout that can still be wrong.
//
// ⚠️ AND IT DOES NOT REPLACE THE READS. A read is still the only thing that knows about the world this run
// did not make. The registry is asked FIRST and answers about a strictly smaller set; the read remains the
// authority for everything else.

/**
 * The run's registry. One per invocation, carried on the port object every module already receives — so a
 * module that creates in step 4 and a module that looks up in step 7 are talking about the same run without
 * either of them knowing the other exists.
 */
export function createMinted() {
  /** product handle -> product id */
  const products = new Map();
  /** sku code -> sku id */
  const skus = new Map();
  return {
    /** Register a product this run created. Call it with what the COMMAND returned, never with a read. */
    rememberProduct(handle, id) {
      if (handle && id) products.set(handle, id);
    },
    /** Register a sku this run created. */
    rememberSku(code, id) {
      if (code && id) skus.set(code, id);
    },
    /** The id, or null — `null` meaning "not made by this run", which is a fact and not a failure. */
    product(handle) {
      return products.get(handle) ?? null;
    },
    sku(code) {
      return skus.get(code) ?? null;
    },
    /** For the summary line and for the honest error message: what this run actually made. */
    get counts() {
      return { products: products.size, skus: skus.size };
    },
    /** The sku registry as catalogue-shaped rows, so `planStock` can be handed it beside the real read. */
    asCatalogueRows() {
      return [{ skus: [...skus].map(([code, id]) => ({ code, id })) }];
    },
  };
}

/**
 * ★★ THE SENTENCE FOR A LOOKUP THAT CAME UP EMPTY — one helper, used everywhere, because the same wrong
 * message was written three times today in three different voices.
 *
 * ⚠️ WHAT MAKES IT DIFFERENT: IT DOES NOT NAME A CAUSE. The three it replaces each ASSERTED one — "the
 * product was never created", "an option value was renamed", "this module runs after the catalogue step, run
 * it in that order" — and in every case the real cause was a lagging projection, which none of them listed.
 * The last one was the worst precisely because it was the most helpful-sounding: whoever read it went and
 * verified the module order, found it correct, and was left with nothing.
 *
 * So this says three things and stops: WHAT was asked for, WHAT was measured, and the GESTURE that
 * distinguishes the remaining cases. A message that asserts more than it measured spends somebody else's
 * afternoon on the author's guess.
 *
 * @param what     the kind of thing looked up, in the plural ("product(s)", "sku code(s)")
 * @param names    the identifiers that did not resolve
 * @param measured a short line of what WAS seen — the read's own answer and the run's own counts
 * @param andThen  what a reader should check IF the read is not the cause; never presented as the cause
 */
export function unresolved({ what, names, measured, andThen }) {
  const shown = names.slice(0, 5).join(', ');
  const more = names.length > 5 ? ` … (+${names.length - 5})` : '';
  return (
    `${names.length} ${what} did not resolve — neither in this run's own registry of what it created, nor ` +
    `in the read:\n    ${shown}${more}\n` +
    `  MEASURED: ${measured}\n` +
    '  ⚠️ THIS DOES NOT SAY WHY, because from here the causes are indistinguishable. The kernel\'s read face\n' +
    '  sits behind a PROJECTION: a thing committed a moment ago is real and not yet answerable. ASK THE READ\n' +
    '  AGAIN before assuming anything — if the names appear, it was the projection and nothing is wrong with\n' +
    `  the data.\n  If they do NOT appear: ${andThen}`
  );
}
