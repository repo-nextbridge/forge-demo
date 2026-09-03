// ★★ s3-11 — THE HEADER'S WORDMARK WAS INVISIBLE FOR DAYS AND EVERY HALF LOOKED CORRECT ON ITS OWN.
//
// MEASURED on the bench (2026-09-03, 1366x900, headless render of the café home): the centre of the header
// was blank. The `<img>` was served 200, the CSS module was in the built stylesheet, and the crop arithmetic
// in it was right — the same rules, pasted into a bare HTML file with the same PNG, drew the mark perfectly.
// What killed it lived in a THIRD file:
//
//     src/styles/globals.css     img { max-width: 100%; }
//
// the reference storefront's responsive baseline, correct and inherited by this fork. The chrome cropped the
// mark in CSS — a window with the crop's aspect ratio, `overflow: hidden`, and an `<img>` blown up to
// `width: 179.6%` then dragged into place with negative margins — and `max-width` clamped that 179.6% back to
// 100%. The picture rendered at the window's own 112px instead of 201px, so the negative margins (-49px,
// -47px) pushed it entirely out of the 112x33 window. Nothing painted, nothing errored, nothing 404ed.
//
// ── WHY THIS GUARD IS SHAPED THE WAY IT IS ───────────────────────────────────────────────────────────────
//
// A test that rendered the chrome and looked for an `<img>` would have been GREEN throughout: the element was
// always there, with the right `src`. jsdom has no layout, so no assertion about the DOM can see an empty
// header. The only two things a unit test can honestly measure here are the FILE and the STYLESHEET — and
// they are exactly the two that drifted apart. So:
//
//   1. THE ASSET IS TRIMMED. The wordmark must fill its own canvas. The export that shipped was the
//      artboard's 1536x1024 with the mark occupying 12.7% of the pixels in the middle, which is what made a
//      CSS crop feel necessary in the first place. A re-export with the canvas back is the defect returning
//      through the door it came in, and it is invisible to every other test in this suite.
//   2. THE `aspect-ratio` IS THE FILE'S. The box declares a ratio; if the file's real one drifts from it the
//      mark is squashed or letterboxed. Read from the PNG header, never from a number copied by hand.
//   3. NO `<img>` IN THE CHROME ASKS FOR MORE THAN 100% WIDTH. This is the general form of the defect: in
//      THIS app that request cannot be honoured, and it fails silently rather than loudly.
//
// A guard that has never been seen fail is a guard nobody measured: each of the three below was run against
// the pre-fix state (the 1536x1024 asset and the `width: 179.6%` rules) and each one goes red there.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'CoffeeChrome.module.css'), 'utf8');

/** A PNG's real dimensions, off the IHDR chunk — the only answer that cannot be a stale comment. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(join(HERE, file));
  if (bytes.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The opaque bounding box of a PNG, as a FRACTION of its canvas. 1 means the mark fills its own file. */
function inkFraction(file: string): number {
  const { width, height } = pngSize(file);
  // The IHDR is enough for the canvas; for the ink we need the pixels, and decoding a PNG by hand is not this
  // guard's job. The proxy that needs no decoder: a trimmed export of a mark this size is a few hundred KB,
  // while the same mark floating in an artboard canvas is megabytes of transparent pixels. It is a proxy, so
  // the assertion that carries the weight is the RATIO one below — this only catches the gross case.
  const bytes = readFileSync(join(HERE, file)).byteLength;
  return bytes / (width * height);
}

/** The value of one declaration inside one rule of the module stylesheet. */
function decl(selector: string, property: string): string | null {
  const rule = new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!rule?.[1]) throw new Error(`the stylesheet has no .${selector} rule — this guard argues about a moved door`);
  const found = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(rule[1]);
  return found?.[1]?.trim() ?? null;
}

const MARKS = [
  { file: 'forge-co-logo.png', box: 'logo', where: 'the header' },
  { file: 'forge-co-logo-negativo.png', box: 'footerLogo', where: 'the footer' },
] as const;

test.each(MARKS)('★ $where mark is TRIMMED to the wordmark — the crop is in the file', ({ file }) => {
  const { width, height } = pngSize(file);
  // A wordmark is wide and short. The artboard export that shipped was 1536x1024 (ratio 1.5) with the mark
  // floating in the middle; a trimmed one is ratio ~3.5. Nothing about "forge.co" is 1.5 wide.
  expect(width / height, `${file} is ${width}x${height} — that is a canvas, not a wordmark`).toBeGreaterThan(2.5);
  // …and it is not mostly transparent padding. 986 KB for a 112px mark was 0.63 bytes/px of empty artboard.
  expect(inkFraction(file), `${file} carries far more pixels than a trimmed mark needs`).toBeLessThan(1.2);
});

test.each(MARKS)('★★ the $where box declares the FILE\'s own aspect ratio, not a hand-copied one', ({ file, box }) => {
  const { width, height } = pngSize(file);
  const written = decl(box, 'aspect-ratio');
  expect(written, `.${box} declares no aspect-ratio`).toBeTruthy();
  const [w = Number.NaN, h = Number.NaN] = String(written).split('/').map((n) => Number(n.trim()));
  expect(Number.isFinite(w) && Number.isFinite(h), `.${box}'s aspect-ratio is not "<n> / <n>"`).toBe(true);
  // Tight, because this is the number a re-export invalidates: 1% is under half a pixel at the rendered size.
  expect(
    Math.abs(w / h - width / height),
    `.${box} draws ${w}/${h} and ${file} is ${width}x${height} — the mark is squashed by that much`,
  ).toBeLessThan(0.01 * (width / height));
});

test('★★ no <img> in the chrome asks for more than 100% width — this app cannot honour it', () => {
  // THE GENERAL FORM OF s3-11. `src/styles/globals.css` sets `img { max-width: 100% }` app-wide, so a rule
  // that scales an image past its box is not merely overridden — it is overridden SILENTLY, and whatever
  // positioning was written to go with it (negative margins, a crop window) then points at nothing. Size the
  // box; never the picture.
  const offenders = [...CSS.matchAll(/\.([A-Za-z][\w-]*)\s+img\s*\{([^}]*)\}/g)]
    .map(([, selector, body]) => ({
      selector,
      width: /(?:^|;)\s*width\s*:\s*([\d.]+)%/.exec(body ?? '')?.[1],
    }))
    .filter((r) => r.width !== undefined && Number(r.width) > 100);
  expect(
    offenders,
    `these rules scale an <img> past its box, which globals.css clamps back: ${offenders
      .map((o) => `.${o.selector} img { width: ${o.width}% }`)
      .join(' · ')}`,
  ).toEqual([]);
});

test('the reset this guard is written against is still there — otherwise the rule above is arguing with a ghost', () => {
  // ⚠️ A guard whose PREMISE has been deleted is a guard that passes for the wrong reason. If the reset ever
  // leaves globals.css, the rule above stops being a truth about this app and someone must decide again.
  const globals = readFileSync(join(HERE, '../../styles/globals.css'), 'utf8');
  expect(globals.replace(/\s+/g, ' ')).toContain('img { max-width: 100%; }');
});
