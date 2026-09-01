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

/**
 * WHAT TO DO ABOUT A PRODUCT'S PICTURE, given what it carries and what the file on disk resolves to.
 *
 * ★ ATTACH BEFORE DETACH, and the order is the whole design. For the width of one command the product
 * carries two references; the alternative — detach first — carries NONE, and a run that dies in that
 * window leaves a product with no picture at all. Two pictures for a moment is a strictly better failure
 * than zero pictures for good.
 *
 * ⚠️ AND `detach` IS NOT `delete`. It drops the reference. The library row and the bytes behind it stay,
 * because this script cannot know who else points at them and because deleting is the one move on a bench
 * somebody is testing that cannot be taken back.
 *
 * @param refs the product's current image references (`{id, provider_key}`)
 * @param want the provider_key the file on disk resolves to
 * @returns `{ attach: boolean, detach: string[] }` — media ids to detach, in the order to detach them.
 */
export function planRepoint(refs, want) {
  const images = refs.filter((m) => m.kind === undefined || m.kind === 'image');
  const stale = images.filter((m) => m.provider_key !== want);
  // ★ `attach` and `detach` are decided SEPARATELY, and the case that forced it is the interrupted window
  // this header describes: a run that died between the attach and the detach leaves BOTH references. The
  // next run must not attach a third — but it must still finish the job, or the stale reference lives
  // forever behind a picture that looks right. "The wanted key is present" answers only half the question.
  return { attach: !images.some((m) => m.provider_key === want), detach: stale.map((m) => m.id) };
}
