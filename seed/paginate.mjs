// THE PAGINATOR — the shared half of every "did I already make this?" in this repo.
//
// ★★ WHY IT IS A MODULE AND NOT FOUR CALLS WITH `limit: '100'`, which is what it replaces.
//
// The idempotence of this whole seed rests on reads that answer "does this already exist?". Those reads are
// PAGINATED — `read.internal.products_admin` caps `limit` at 100, `read.internal.stock_levels` at 200 — and
// every caller asked for ONE page and treated the answer as the whole catalogue.
//
// ⚠️ That was correct BY COINCIDENCE OF SIZE, never by construction, and the coincidence had an expiry date.
// With six coffees and eight outlet products the first page IS everything. The sports store puts 2790
// products in the same tenant, and one of those reads is not even store-scoped (measured on this bench:
// `read.internal.products?store=<cafe>` answers all 14 products of the TENANT, `total: 14`, ignoring the
// parameter). So a first page that does not happen to contain the eight outlet handles makes the outlet's
// `existing` map empty — and the next move there is `catalog.product.create`, which the kernel refuses with
// 409 on the unique handle. A seed that could not be run twice.
//
// It is here, in its own file, because the fix belongs to the SHARED read and not to the caller that
// happened to notice: the other three would have hit the same wall on the day somebody grew them.
//
// ⚠️ IT REFUSES TO GUESS, in both directions. An envelope it cannot page is a LOUD failure and never an
// empty list (`rows` below is the caller's, and it already refuses); a read that keeps answering full pages
// past any plausible end stops rather than looping forever. Guessing empty is the one answer that turns a
// read bug into a write bug — this repo has the 409 to prove it.

/**
 * Build a paginator over one read function.
 *
 * @param deps.read  `(name, params) => Promise<payload>` — the transport (internal or public face).
 * @param deps.rows  the envelope reader; it refuses shapes it does not know rather than answering empty.
 * @param deps.fail  how this script dies. Called with a message; must not return.
 * @param deps.defaultLimit  the page size when the caller names none.
 */
export function createReadAll({ read, rows, fail, defaultLimit = 100 }) {
  return async function readAll(name, params = {}) {
    const limit = Number(params.limit ?? defaultLimit);
    if (!Number.isFinite(limit) || limit < 1) fail(`readAll(${name}): limit must be a positive number.`);
    const all = [];
    for (let page = 1; ; page++) {
      const payload = await read(name, { ...params, limit: String(limit), page: String(page) });
      const batch = rows(payload);
      // ★ A BARE ARRAY IS THE WHOLE LIST, and this line is not defensiveness — without it this paginator
      // LOOPS FOREVER on the reads that answer one. Measured on this bench: `read.internal.brands_admin`,
      // `assets`, `categories_admin`, `custom_field_definitions` and `stores` all answer a plain array and
      // IGNORE `limit`/`page` (they 200 and hand back everything). With 351 brands that is a 351-row "page"
      // — never shorter than a limit of 100, carrying no `total` — so the walk would ask page 2, get the
      // same 351, and keep going until the loop guard, having accumulated millions of duplicates.
      //
      // An unpaginated read has no second page BY CONSTRUCTION. Asking for one is the mistake.
      if (Array.isArray(payload)) return batch;
      all.push(...batch);
      // A short page is the end of the list — the only signal every one of these reads gives honestly.
      if (batch.length < limit) return all;
      // `total`, when the envelope carries it, ends the walk one request earlier than a short page would.
      const total = Number(payload?.total);
      if (Number.isFinite(total) && all.length >= total) return all;
      if (page > 10_000) {
        fail(
          `readAll(${name}): still full pages after ${page} of them (${all.length} rows). Refusing to loop —\n` +
            '  a read that never ends is a read this script does not understand, and guessing is what the\n' +
            '  single-page version did.',
        );
      }
    }
  };
}
