// THE TWO MEDIA DECISIONS, as functions, because both of them are the kind that is wrong in silence.
//
// `bin/seed.mjs` drives the port; these decide WHAT it should drive. They are here rather than in there for
// one reason: that file runs on import (it validates the env and seeds), so nothing can import it to check
// its reasoning. A decision nobody can test is a decision nobody re-reads.

import { createHash } from 'node:crypto';

/** The content hash of some bytes — the only honest answer to "is this the same picture?". */
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * WHETHER AN UPLOAD IS NEEDED AT ALL.
 *
 * ⚠️ NAME AND BYTES, NEVER ONE OR THE OTHER. Matching on the FILENAME alone is what the seed effectively did
 * before, and it is why a re-cut photograph never reached the shop: `alvorada.png` existed, so nothing
 * happened. Matching on BYTES alone would collapse two different products that happen to share a picture
 * into one library row, which is not this function's call to make.
 *
 * ⚠️ AND `size` IS NOT A CONTENT CHECK, though the read publishes it and it is tempting. A re-encode that
 * lands on the same byte count is exactly the case a designer produces, and it is the case that would be
 * missed silently — the same failure in a new costume.
 *
 * @param index Map<filename, Map<sha, provider_key>>
 * @returns the provider_key to reuse, or null when the bytes must be uploaded.
 */
export function reuseKey(index, filename, sha) {
  return index.get(filename)?.get(sha) ?? null;
}
