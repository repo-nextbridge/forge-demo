#!/usr/bin/env node
// THE PLACEHOLDER ART — a window slot that has no picture gets one that SAYS it has no picture.
//
//   node bin/make-placeholders.mjs            # write the missing ones into seed/placeholder-media/
//   node bin/make-placeholders.mjs --check    # write nothing; exit 1 if any is missing or has drifted
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────────────
//
// Order of the Renan, 2026-09-01: *"onde precisa de banner mas não tem imagem, cria uma imagem qualquer e
// sobe. Eu depois faço a curadoria."* A shop window with an empty slot is not a shop that is "missing art":
// it is a shop that renders wrong, and the wrongness is invisible in a seed log.
//
// ── THE FIVE DECISIONS, AND EACH ONE IS THE DIFFERENCE BETWEEN USEFUL AND LANDFILL ──────────────────────
//
//   1. GENERATED, NEVER FOUND. No download, no stock photo, no external placeholder service. Art that
//      arrives from outside is art somebody has to have the right to use, and a demo is exactly where a
//      borrowed picture escapes. ImageMagick is on the box and draws what we ask for.
//
//   2. ★★ IT SAYS WHAT IT IS, IN WORDS, INSIDE THE IMAGE. `home.hero · cafe · 1504x560`. This is the
//      decision that matters: the curation that follows is a person going through a LIST, and a wall of
//      identical grey rectangles is not a list — they would have to click each one to learn which slot it
//      belongs to. Written on the picture, the browsing IS the list. And nobody can mistake it for final.
//
//   3. THE REAL DIMENSION OF THE REAL SLOT. Measured from the art that already works in that slot (see
//      `SLOTS`), never guessed. A placeholder in the wrong ratio teaches a layout that does not exist, and
//      the curation would then be done against a lie — the picture would be replaced and the page would
//      move.
//
//   4. FINDABLE IN ONE GESTURE. Every file is named `placeholder-<store>-<slot>-<w>x<h>.png`, and it is
//      uploaded to the Asset Library under that exact filename. So the whole set is one search for
//      `placeholder-` in the admin's Asset Library (or `read.internal.assets` filtered by the same prefix),
//      and they can be swapped one at a time.
//
//   5. DETERMINISTIC, BYTE FOR BYTE. Same slot, same bytes, every run — so the seed's content index sees
//      "same name, same bytes" and uploads nothing on a re-run. A generator that re-encodes on every run
//      would add an object to the bucket every time the seed is run and leave the library growing forever,
//      which is the exact defect `bin/seed.mjs` already documents about `media.request_upload`. That is why
//      the ImageMagick invocation pins `-define png:exclude-chunk=time` and sets no timestamp.
//
// ⚠️ AND IT NEVER DRAWS OVER CURATED ART. A slot whose picture exists is left alone — `--check` will not
// even mention it. Placeholder is for the HOLE; painting over the outlet's campaign art or the counter's
// photographs would be this script destroying the thing it exists to protect.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORY_SHOTS, placeholderForPhoto, storyFileFor } from '../seed/media.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PLACEHOLDER_DIR = join(HERE, 'seed', 'placeholder-media');

/** The prefix every generated file carries — the one gesture that lists them all. Exported so the seed and
 *  the tests name it once. */
export const PLACEHOLDER_PREFIX = 'placeholder-';

/**
 * ★ THE SLOTS, AND THE DIMENSION EACH ONE REALLY WANTS.
 *
 * Every size below was MEASURED from the picture that already serves that slot in the shoe shop's window
 * (`instances/demo/dataset/assets/banners/`, read with `identify`), not chosen. Where a slot has no
 * incumbent anywhere, the row says so and the number is the theme's declared box.
 *
 * A store gets a row only if its ARCHETYPE has that slot. The counter is deliberately absent from every
 * banner row: the totem is an app of its own with four bands and no hero, and generating a hero for it
 * because the generator knows how would be exactly the absurd data the archetype rule exists to refuse.
 */
export const SLOTS = [
  {
    slot: 'storefront:home.hero',
    label: 'home.hero',
    width: 1504,
    height: 560,
    // Measured: banner-grande-jordan.jpg, the incumbent of this slot in the shoe shop's carousel.
    why: 'the hero carousel, desktop frame',
  },
  {
    slot: 'storefront:home.hero',
    label: 'home.hero (mobile)',
    width: 2048,
    height: 2048,
    variant: 'M',
    // Measured: banner-grande-jordan-M.jpg. The mobile frame is SQUARE and it is not a crop of the desktop
    // one — a seed that generated one file for both would put a 1504x560 strip on a phone.
    why: 'the hero carousel, mobile frame',
  },
  {
    slot: 'storefront:home.below_categories',
    label: 'below_categories',
    width: 500,
    height: 250,
    // Measured: banner-social2.jpg, the widest tile of the mosaic row.
    why: 'the mosaic tile under the categories',
  },
];

/** `placeholder-<store>-<slot>-<w>x<h>.png` — the name IS the index. */
export function fileNameFor(store, slot) {
  const label = slot.label.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase();
  return `${PLACEHOLDER_PREFIX}${store}-${label}-${slot.width}x${slot.height}.png`;
}

/** The words drawn on the picture. The slot first, because that is what the curator is looking for. */
export function captionFor(store, slot) {
  return `${slot.label} · ${store} · ${slot.width}x${slot.height}`;
}

/**
 * The colour of one placeholder — derived from the store handle, so the four shops are told apart at a
 * glance while a shop's own slots stay one family. Deterministic and deliberately UNLOVELY: a placeholder
 * that looked designed would get shipped.
 */
export function colourFor(store) {
  let hash = 0;
  for (let i = 0; i < store.length; i++) hash = (hash * 31 + store.charCodeAt(i)) % 360;
  return `hsl(${hash},22%,42%)`;
}

/**
 * ⚠️ THE TEXT HAS TO FIT INSIDE THE PICTURE, and the first version's did not: a caption sized only by the
 * BOX ("a twelfth of the shorter side") is fine for `home.hero · cafe · 1504x560` and runs off both edges of
 * a 1208-wide frame captioned with a whole filename. A placeholder whose words are cut in half is a
 * placeholder that fails at the one job it has — saying which file it is standing in for.
 *
 * So the size is bounded by BOTH: the box, and the width the caption needs. ~0.6 em per glyph is the
 * measured average for the default font; 1.5 = 0.92 (the margin) / 0.6.
 */
export function pointSizeFor(caption, slot) {
  const byBox = Math.round(Math.min(slot.width, slot.height) / 12);
  const byText = Math.floor((slot.width * 1.5) / Math.max(1, caption.length));
  return Math.max(11, Math.min(byBox, byText));
}

/** The ImageMagick invocation, as an argv array — exported so a test can assert the flags that make it
 *  deterministic without running the binary. */
export function magickArgs(store, slot, out, caption = captionFor(store, slot)) {
  return [
    '-size',
    `${slot.width}x${slot.height}`,
    `xc:${colourFor(store)}`,
    '-gravity',
    'center',
    '-fill',
    'rgba(255,255,255,0.92)',
    '-pointsize',
    String(pointSizeFor(caption, slot)),
    '-annotate',
    '0',
    caption,
    // ⚠️ THE TWO FLAGS THAT MAKE IT BYTE-STABLE. A PNG carries a creation time by default, so the same
    // picture generated twice is two different files — and this seed's "same name, same bytes?" check would
    // upload a new object on every single run, forever.
    '-define',
    'png:exclude-chunk=time',
    '-strip',
    out,
  ];
}

/** Which placeholders a set of shops needs, given the art that already exists. Pure — the test drives it. */
export function planPlaceholders(stores, existing) {
  const plan = [];
  for (const store of stores) {
    for (const slot of SLOTS) {
      const file = fileNameFor(store, slot);
      // ⚠️ NEVER OVER CURATED ART. `existing` is what the shop already has for this slot; a slot that is
      // filled is not this script's business, and drawing on it would destroy the thing being protected.
      if (existing.has(`${store}:${slot.label}`)) continue;
      plan.push({ store, slot, file });
    }
  }
  return plan;
}

/**
 * ★★ THE SECOND FAMILY: THE COFFEE'S STORY PHOTOGRAPHS — same rule, a different axis.
 *
 * The rows above are the WINDOW's slots, one set per shop. These are per PRODUCT: `seed/catalog.json`
 * declares four photographs for every coffee and `seed/photos/` holds one (the bag), so the three story
 * frames of six coffees — eighteen files — have a name, a box and no bytes. A50 says they are born anyway.
 *
 * ⚠️ THE LIST IS DERIVED FROM THE DATASET AND NEVER TYPED HERE. A seventh coffee added tomorrow needs three
 * more stand-ins, and a list written in this file would go stale in silence — which is the exact defect the
 * `--check` mode exists to catch in the other family. `seed/media.mjs` owns the naming; this file only draws.
 */
export function planStoryPlaceholders(products, photosOnDisk) {
  const plan = [];
  for (const product of products) {
    const bag = product.photo ?? product.photos?.[0];
    if (!bag) continue;
    for (const shot of STORY_SHOTS) {
      const real = storyFileFor(bag, shot);
      // ⚠️ NEVER OVER THE REAL PHOTOGRAPH. The day the merchant drops `alvorada-historia-1.png` into
      // `seed/photos/`, the stand-in stops being needed AND stops being generated — the same rule the
      // window slots follow with `CURATED`.
      if (photosOnDisk.has(real)) continue;
      plan.push({ file: placeholderForPhoto(real), real, shot, handle: product.handle });
    }
  }
  return plan;
}

/** The words drawn on a story stand-in. It names the FILE the merchant has to produce, because that — not
 *  the slot — is the gesture that makes it disappear. */
export function storyCaptionFor(item) {
  return `PLACEHOLDER · ${item.real} · ${item.shot.width}x${item.shot.height}`;
}

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  // The shops whose windows this demo curates. The counter is absent by archetype, not by oversight.
  const STORES = ['forge', 'outlet', 'cafe'];
  // Nothing is curated for these slots yet in this repository; when a real picture arrives, its key goes
  // here and the placeholder stops being generated (and is deleted by hand, once, from the library).
  const CURATED = new Set();

  mkdirSync(PLACEHOLDER_DIR, { recursive: true });
  const plan = planPlaceholders(STORES, CURATED);
  // The coffee's story frames, derived from the dataset and from what `seed/photos/` already holds.
  const catalog = JSON.parse(readFileSync(join(HERE, 'seed', 'catalog.json'), 'utf8'));
  const onDisk = new Set(readdirSync(join(HERE, 'seed', 'photos')));
  const story = planStoryPlaceholders(catalog.products, onDisk);
  let wrote = 0;
  const missing = [];
  for (const item of plan) {
    const out = join(PLACEHOLDER_DIR, item.file);
    if (existsSync(out)) continue;
    if (check) {
      missing.push(item.file);
      continue;
    }
    execFileSync('magick', magickArgs(item.store, item.slot, out));
    wrote += 1;
  }
  for (const item of story) {
    const out = join(PLACEHOLDER_DIR, item.file);
    if (existsSync(out)) continue;
    if (check) {
      missing.push(item.file);
      continue;
    }
    execFileSync(
      'magick',
      magickArgs('cafe', { ...item.shot, label: item.real, width: item.shot.width, height: item.shot.height }, out, storyCaptionFor(item)),
    );
    wrote += 1;
  }
  const have = readdirSync(PLACEHOLDER_DIR).filter((f) => f.startsWith(PLACEHOLDER_PREFIX));
  if (check && missing.length > 0) {
    process.stderr.write(
      `[placeholders] MISSING ${missing.length}: ${missing.join(', ')}\n` +
        '  Run `node bin/make-placeholders.mjs` and commit them.\n',
    );
    process.exit(1);
  }
  process.stderr.write(
    `[placeholders] ${check ? 'all present' : `${wrote} written`} — ${have.length} file(s) in ` +
      `seed/placeholder-media/. In the admin they are one search for "${PLACEHOLDER_PREFIX}" in the Asset ` +
      'Library; through the port, `read.internal.assets` and filter the filename by the same prefix.\n',
  );
}
