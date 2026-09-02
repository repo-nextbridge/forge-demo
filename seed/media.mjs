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

// ── THE COFFEE'S FOUR PHOTOGRAPHS — the list, its stand-ins, and the one rule that resolves a name ───────
//
// ★ THE CONVENTION IS POSITION, and `storefront-coffee/src/templates/pdp/PdpCoffee.tsx:5` states it: media[0]
// is the bag (the transparent shot the buy box draws), media[1..3] are the story — one wide frame and two
// squares. Nothing in the fork reads a role or a filename; it splits the list and draws what is there.
//
// ⚠️ WHICH MEANS THE DATASET WAS THE HOLE, NOT THE PAGE. `seed/catalog.json` declared `photo` — ONE — so the
// three story frames had nowhere to live and the grid was correctly absent on every coffee. The list is what
// makes them possible; the files are what make them appear.

/**
 * ★ THE THREE STORY SLOTS AND THEIR REAL DIMENSIONS, derived from the grid that draws them rather than
 * guessed — `coffee.module.css`: `.richGrid` is `max-width: 1240px` in two columns with a ~32px gap, so the
 * gallery column is ~604px; `.galleryWide` spans both at `4 / 3` and `.gallerySquare` is `1 / 1` at half the
 * column minus the 16px gap (~294px). Doubled for a 2× screen, which is what `MediaImage` will ask for.
 *
 * A placeholder in the wrong ratio teaches a layout that does not exist — the curation would then be done
 * against a lie, and the page would move when the real picture replaced it.
 */
export const STORY_SHOTS = [
  { suffix: 'historia-1', width: 1208, height: 906, why: 'the wide frame, spanning both columns (4:3)' },
  { suffix: 'historia-2', width: 588, height: 588, why: 'the left square under it (1:1)' },
  { suffix: 'historia-3', width: 588, height: 588, why: 'the right square under it (1:1)' },
];

const baseOf = (file) => String(file).replace(/\.[^.]+$/, '');

/** The FINAL name a story frame will have, derived from the bag photograph's — so the dataset names the file
 *  the merchant is going to produce, and the day it lands in `seed/photos/` nothing else has to change. */
export function storyFileFor(bagPhoto, shot) {
  return `${baseOf(bagPhoto)}-${shot.suffix}.png`;
}

/** The whole ordered list one coffee's PDP wants: the bag, then the three story frames. */
export function photoListFor(bagPhoto) {
  return [bagPhoto, ...STORY_SHOTS.map((shot) => storyFileFor(bagPhoto, shot))];
}

/**
 * The stand-in that serves a story frame until the real file exists — or `null` for a name that is not a
 * story frame at all (the bag has no stand-in: a coffee with no bag photograph is a dataset error, not a
 * hole to paper over).
 *
 * ⚠️ THE DIMENSION IS IN THE NAME, exactly as `bin/make-placeholders.mjs` does it for the window slots, and
 * for the same reason: the set is one search for `placeholder-` and each file says what box it fills.
 */
export function placeholderForPhoto(file) {
  const shot = STORY_SHOTS.find((s) => baseOf(file).endsWith(`-${s.suffix}`));
  if (!shot) return null;
  return `placeholder-${baseOf(file)}-${shot.width}x${shot.height}.png`;
}

/**
 * ⭐ WHERE A DECLARED PHOTOGRAPH ACTUALLY COMES FROM — the A50 rule as a function.
 *
 * *"prefiro que suba algo errado do que não subir, senão fica difícil eu saber o que preciso criar"* (Renan,
 * 2026-09-01). So a story frame whose real file is not on disk resolves to its stand-in and the shop is born
 * with four photographs, one of which visibly says it is a placeholder. The day the real file lands in
 * `seed/photos/` under the name the dataset already declares, this function stops choosing the stand-in —
 * the dataset is not edited, and the seed re-points the picture on its next run.
 *
 * ⚠️ IT NEVER GUESSES BOTH WAYS. A name that is neither on disk nor a story frame with a stand-in returns
 * `null`, and the caller's job is to die naming both files it looked for. Silently dropping a photograph is
 * how a four-shot page ships as a one-shot page and nobody can tell whether that was the design.
 *
 * @param have.photos       Set of file names in `seed/photos/`
 * @param have.placeholders Set of file names in `seed/placeholder-media/`
 * @returns `{ file, dir, placeholder }` — `dir` is the folder key, never a path; the caller joins.
 */
export function resolvePhoto(file, { photos, placeholders }) {
  if (photos.has(file)) return { file, dir: 'photos', placeholder: false };
  const stand = placeholderForPhoto(file);
  if (stand && placeholders.has(stand)) return { file: stand, dir: 'placeholder-media', placeholder: true };
  return null;
}

/**
 * ★★ WHAT TO DO ABOUT A PRODUCT'S WHOLE PICTURE LIST — `planRepoint` grown from one photograph to the
 * ordered several, because the coffee page reads BY POSITION and a set has no positions.
 *
 * ⚠️ ATTACH BEFORE DETACH, still, and for the same reason: a run that dies in the window leaves a product
 * with too many pictures rather than with none.
 *
 * ⚠️ AND A REFERENCE IN THE RIGHT PLACE IS NOT THE SAME AS A REFERENCE PRESENT. The bag must stay at
 * position 0 — the buy box takes `photos[0]` — so a key that is attached at the WRONG position is planned
 * for detach-and-reattach, never left alone. Matching on the key alone is what would let a re-cut list
 * silently reorder the page.
 *
 * @param refs current image references (`{id, provider_key, position, kind}`)
 * @param want the provider_keys the files on disk resolve to, IN ORDER
 * @returns `{ attach: [{provider_key, position}], detach: string[] }`
 */
export function planMediaList(refs, want) {
  const images = refs.filter((m) => m.kind === undefined || m.kind === 'image');
  const attach = [];
  const keep = new Set();
  for (const [position, provider_key] of want.entries()) {
    const at = images.find((m) => m.provider_key === provider_key && Number(m.position) === position);
    if (at) keep.add(at.id);
    else attach.push({ provider_key, position });
  }
  return { attach, detach: images.filter((m) => !keep.has(m.id)).map((m) => m.id) };
}
