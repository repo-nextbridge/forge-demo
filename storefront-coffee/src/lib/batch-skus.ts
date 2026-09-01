// Splitting a list of sku ids into the batches a capped port read will accept.
//
// It was written for the identity-price overlay (`prices/overlay.ts`, ceil(N / 48)) and lives here now
// because FEEDSTOCK gave it a second caller with a different ceiling: `read.availability_by_skus` caps at 100,
// and the Google feed pages through a whole catalog's skus with it. Two callers with different maxima is
// exactly when a helper stops belonging to one of them — and importing a PRICES module to ask about STOCK
// would be a dependency that says something untrue about the code.
//
// The reason this exists at all is the house rule it serves: a declared ceiling on the port is an ERROR, never
// a silent clamp, so the CLIENT is the side that pages. `ceil(N / max)`, never N, and never a slice that drops
// the tail.

/** Split ids into batches of at most `max`, deduped, order preserved. */
export function batchSkus(skuIds: readonly string[], max: number): string[][] {
  if (max < 1) throw new RangeError('batchSkus: max must be >= 1');
  const unique = [...new Set(skuIds.filter(Boolean))];
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += max) out.push(unique.slice(i, i + max));
  return out;
}
