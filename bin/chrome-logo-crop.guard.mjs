// ★★ THE SHOP'S MARK IS A TRIMMED WORDMARK, NOT AN ARTBOARD EXPORT — measured off the PNG's own pixels.
//
//   node --test bin/chrome-logo-crop.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT THIS GUARD PROVES, SO THE NEXT PERSON KNOWS WHAT BROKE WHEN IT BREAKS ─────────────────────────────
//
// This box's TWO block declarations hand three shops a `logo`, and both apps draw it in a box sized BY
// HEIGHT ALONE:
//
//     seed/chrome.json      → extensions/chrome/chrome.module.css  .logo  { height: 2em;   width: auto }
//     seed/demo-setup.json  → apps/demo-setup/block/marks.module.css .logo { height: 1.6em; width: auto }
//
// ★★ pk26/D2 SPLIT THE SECOND ONE OUT OF THE FIRST, and this guard had to move with it. The café's mark used
// to be declared three times in `seed/chrome.json`; the shop's own `brand` block became `demo-setup`'s
// marks, in a file this guard did not read. A guard that kept reading only `chrome.json` would have stayed
// GREEN while grading the vitrine's mark not at all — «guard que não importa o sujeito não falha, para de
// perguntar», which is the same failure this guard was written for, one file to the left.
//
// with the reason written beside the first — «`width:auto` keeps whatever ratio the operator uploaded,
// because the next logo is not this one's shape». ⇒ THE FILE'S OWN GEOMETRY DECIDES HOW BIG THE MARK LOOKS.
// Nothing in the stylesheet, nothing in the seed and nothing in the kernel can make a mark that floats in the
// middle of a large transparent canvas draw any bigger: the browser scales the CANVAS to 2em and the drawing
// keeps whatever fraction of that canvas it always had.
//
// ⛔ AND THAT IS WHY THE FIX FOR «the mark is too small» IS NEVER A BIGGER `height`. Growing the `em` grows
// the BOX; the ink stays the same fraction of it, and the bar gets taller for nothing.
//
// ── THE DEFECT THIS WAS WRITTEN FOR, MEASURED 2026-09-08 ───────────────────────────────────────────────────
//
// The café's mark shipped as the artboard export — `seed/photos/forge-co-logo.png`, 1536x1024, with the
// wordmark occupying an 856x231 island in the middle of it. In a `height: 2em` bar that is:
//
//     file                                   canvas       ink bbox    ink fills   drawn at 2em
//     seed/photos/forge-co-logo.png (before)  1536x1024    856x231       22.6%      0.451em tall
//     the same drawing, trimmed               898x273      856x231       84.6%      1.692em tall
//
// SAME PIXELS OF INK — 856x231 in both, byte for byte the same drawing — and 3.75x the mark on screen. The
// café's wordmark was being drawn a THIRD the height of the words next to it, in the one bar that carries the
// shop's name, and nothing in this repository said so.
//
// ⚠️ AND THE CAUSE IS A HALF-DONE FIX, NOT A BAD EXPORT. This repository holds the café's mark TWICE: the
// forked vitrine bundles its own copy (`storefront-coffee/src/components/coffee/forge-co-logo.png`) and the
// hosted funnel uploads `seed/photos/`'s. s3-11 trimmed the FORK's copy (858x233) and wrote
// `CoffeeChrome.logo.guard.test.tsx` to keep it trimmed — «that is a canvas, not a wordmark». The seed's copy
// was not brought along and no guard has ever looked at it, so the same shop drew the same mark correctly in
// its vitrine and a third of the size in its checkout, for months, with a green suite.
//
// ── WHY EVERY RULE BELOW IS ABOUT PROPORTION AND NEVER ABOUT A FILENAME ────────────────────────────────────
//
// A rule that named `forge-co-logo.png` would grade the accident of this week and stay green when the next
// mark arrives as an artboard export. The mechanism is geometric, so the rules are:
//
//   1. the drawing fills at least HALF the file's height (it is trimmed);
//   2. the canvas is a wordmark's shape, not an artboard's;
//   3. the art carries its own transparent ground — WITHOUT WHICH RULE 1 GRADES NOTHING (below);
//   4. and the café's two copies still draw the SAME wordmark.
//
// ★ RULE 3 IS NOT HYGIENE, IT IS WHAT KEEPS RULE 1 HONEST. «The drawing fills the file» is measured as the
// bounding box of the OPAQUE pixels. Flatten a mark onto a white ground and every pixel becomes opaque, the
// bounding box becomes the whole canvas, and rule 1 reports 100% for art that is a slab. That failure is not
// hypothetical here: the two seals of pk22 arrived exactly like that and `bin/chrome-seal-ink.guard.mjs`
// caught them. It cannot catch these — that guard grades `<area>_image` in the two footers and has never
// looked at a `logo`. And a slab is visibly wrong in this bar: `.bar` draws on
// `var(--color-chrome-canvas, var(--color-canvas))`, which for the café is `#f3ede3`
// (themes/coffee-store/tokens.css:39) — a white rectangle on warm sand.
//
// ── THE VÁCUO ──────────────────────────────────────────────────────────────────────────────────────────────
//
// Every rule loops over the logos the DECLARATION names, so a store that lost its `logo` would make the loop
// shorter and greener. The three shops that carry one are therefore pinned by name, `balcao`'s `null` is
// asserted rather than skipped, and the count of graded files is asserted at the end of each rule.
//
// ⚠️ AND `seed/photos/` IS INVENTORIED, because the file that is not declared is the one nobody grades. The
// last rule requires every picture in that folder to be named by a seed declaration or listed as a known
// orphan with its reason — which is how `forge-co-logo-negativo.png` came to be understood: it is 1536x1024
// with the same defect, and it is drawn NOWHERE, because nothing in this repository declares it.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { blocksFor } from '../seed/blocks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTOS = join(ROOT, 'seed/photos');

/**
 * ★★ pk26/D2 — TWO DECLARATIONS, ONE RULE, AND THE MOVE IS WHY THIS IS A LIST.
 *
 * The café's mark used to be declared THREE times in `seed/chrome.json` — the two funnel bars and the shop's
 * own `brand`. pk26/D2 split that last one out into `demo-setup`, this box's own app, and a guard that had
 * kept reading only `chrome.json` would have gone on being green while grading one file less: the vitrine's
 * mark would have left this rule's sight, which is the exact shape of the defect this guard was WRITTEN for
 * (`storefront-coffee`'s copy was trimmed, `seed/photos`'s was not, and nothing looked at the second).
 *
 * ⇒ THE SUBJECT IS «EVERY LOGO ANY DECLARATION OF THIS BOX NAMES», never «the logos of the chrome app».
 */
const DECLARATIONS = ['seed/chrome.json', 'seed/demo-setup.json'].map((file) => ({
  file,
  spec: JSON.parse(readFileSync(join(ROOT, file), 'utf8')),
}));

/** The shops that wear a mark, and the one that wears no chrome and no mark at all. Pinned so that a
 *  declaration losing a `logo` shortens no loop in silence. */
const DRESSED = ['cafe', 'forge', 'outlet'];
const BARE = ['balcao'];

/** How many declared logos the rules below must each grade, spelled once. MEASURED: the café names its mark
 *  in five blocks (two funnel bars + three marks) and the two shoe shops in two bars each.
 *
 *  ⚠️ IT WAS 10 UNTIL pk28, when `demo-setup`'s fourth mark — the login box — left that app: the checkout is
 *  the deployable nobody forks, so its mark is the product's to configure. The count is spelled here so that
 *  a declaration losing a logo shortens no loop in silence. */
const DECLARED_LOGOS = 9;

/** The mark fills at least half the height of its own file.
 *
 *  ⚠️ A FRACTION AND NOT AN `em`, because the two boxes are different sizes (2em in the bars, 1.6em in the
 *  vitrine's brand slot) and the property being graded belongs to the FILE. MEASURED on the three today:
 *  forge-store 65.8%, forge-outlet 60.6%, forge-co 84.6% — against 22.6% for the artboard export this
 *  replaced. The floor sits below the tightest of the three by a fifth and above the defect by 2.2x. */
const IS_TRIMMED = 0.5;

/** A wordmark is wide. 1.5 is an artboard; 3.0-3.5 is a cut mark.
 *  ⚠️ THIS NUMBER IS ALSO WRITTEN, DELIBERATELY, IN THE FORK'S OWN GUARD OVER ITS OWN COPY OF THIS SAME MARK
 *  (`storefront-coffee/src/components/coffee/CoffeeChrome.logo.guard.test.tsx:75`, «that is a canvas, not a
 *  wordmark»). Two files, one régua, and no import can join them: that one is a `.tsx` vitest run inside the
 *  fork's own suite. Naming it here is what keeps the two from drifting apart the way the ART did. */
const IS_WORDMARK = 2.5;

/** ⚠️ THE PICTURES IN `seed/photos/` THAT NO SEED DECLARATION NAMES, each with the reason it may stay. A file
 *  that is not declared is a file no rule in this repository grades, and that is exactly how the negative
 *  mark below kept its defect: it is the artboard export too (1536x1024, ink 808x217 = 21.2% of the height),
 *  and it is invisible because nothing draws it. The FORK carries its own trimmed copy of the same art
 *  (`storefront-coffee/src/components/coffee/forge-co-logo-negativo.png`, 809x219) and the fork's guard
 *  grades that one, so the café's dark-ground mark on screen is correct today. ⛔ Do NOT declare this file
 *  in `seed/chrome.json` without cutting it first — the rules above would go red the moment you did, which
 *  is the point of leaving it inventoried rather than deleted. */
const KNOWN_ORPHANS = {
  'forge-co-logo-negativo.png':
    'the café mark for dark grounds. Nothing in the seed declares it, so it is never uploaded and never ' +
    'drawn; the fork bundles its own trimmed copy for the vitrine footer. It is the untrimmed artboard ' +
    'export and would have to be cut before any declaration may name it.',
};

/**
 * The canvas, the bounding box of the OPAQUE ink, and whether the file carries a transparent ground.
 * No decoder and no dependency: this repository has none, and `bin/chrome-seal-ink.guard.mjs` reads the same
 * chunks the same way for a different question (the ink's COLOUR; this asks for its EXTENT).
 */
export function cropOf(path) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', `${path} is not a PNG`);
  let head = null;
  const idat = [];
  for (let off = 8; off + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      head = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  assert.ok(head, `${path} has no IHDR`);
  assert.equal(head.depth, 8, `${path} is ${head.depth}-bit; this reader handles 8-bit samples only`);
  assert.equal(head.interlace, 0, `${path} is interlaced; this reader handles the non-interlaced layout only`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[head.color];
  assert.ok(channels, `${path} has colour type ${head.color}; this reader handles greyscale/RGB(A) only`);

  // Un-filter the scanlines (PNG spec §9): every line is prefixed by the filter it was written with.
  const stride = head.width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(head.height * stride);
  for (let y = 0, p = 0; y < head.height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const guess = a + b - c;
        const pa = Math.abs(guess - a);
        const pb = Math.abs(guess - b);
        const pc = Math.abs(guess - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }

  // ★ THE DRAWING IS EVERY PIXEL A SHOPPER CAN SEE AT ALL, which is a different question from the seal
  // guard's. That one tallies the FULLY opaque pixels because it wants the ink's colour and the
  // anti-aliased fringe is not the ink; this one wants the mark's EXTENT, and the fringe is part of it.
  const alphaAt = head.color === 6 || head.color === 4 ? channels - 1 : null;
  const VISIBLE = 8; // out of 255 — below this a pixel adds nothing a human eye separates from the ground.
  let x0 = head.width;
  let y0 = head.height;
  let x1 = -1;
  let y1 = -1;
  let clear = 0;
  for (let y = 0; y < head.height; y++) {
    for (let x = 0; x < head.width; x++) {
      const alpha = alphaAt === null ? 255 : out[(y * head.width + x) * channels + alphaAt];
      if (alpha < VISIBLE) {
        clear += 1;
        continue;
      }
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  assert.ok(x1 >= 0, `${path} draws nothing at all — every pixel of it is transparent`);
  return {
    canvas: { width: head.width, height: head.height },
    ink: { width: x1 - x0 + 1, height: y1 - y0 + 1, x: x0, y: y0 },
    hasAlphaChannel: alphaAt !== null,
    clearShare: clear / (head.width * head.height),
  };
}

/** Every `logo` EITHER declaration gives a store, as `{app, store, component, file}` — derived through the
 *  same reader the seeds themselves use, never listed a second time here. */
function logosDeclared() {
  const found = [];
  for (const { spec } of DECLARATIONS) {
    for (const handle of Object.keys(spec.stores)) {
      if (spec.stores[handle] === null) continue;
      for (const block of blocksFor(spec, handle)) {
        const file = block.config?.logo;
        if (typeof file === 'string' && file.trim().length > 0) {
          found.push({ app: spec.app, store: handle, component: block.component, file });
        }
      }
    }
  }
  return found;
}

/** The box the app draws this block's mark in. Both apps size by HEIGHT ALONE and let the width follow, and
 *  the two numbers differ: the funnel's bars are 2em (extensions/chrome/chrome.module.css:22-26), every mark
 *  of `demo-setup` is 1.6em (apps/demo-setup/block/marks.module.css). The property being graded belongs to
 *  the FILE either way — this number only decides how the failure is reported. */
const boxOf = (app) => (app === 'demo-setup' ? 1.6 : 2);

test('★★ every store of the box is DECIDED here — dressed with a mark, or wearing no chrome at all', () => {
  // ⛔ THE VÁCUO. Every rule below loops over the declared logos; a store that lost its `logo` would make
  // that loop shorter and greener, so the sets are pinned first and by name.
  const dressed = [...new Set(logosDeclared().map((l) => l.store))].sort();
  assert.deepEqual(
    dressed,
    DRESSED,
    'these are the shops the two declarations give a mark to. A shop leaving this list has lost the logo ' +
      'from its funnel or from its shop window — and every geometric rule below would then pass by grading ' +
      'one store less.',
  );
  // ⛔ AND BOTH DECLARATIONS ARE ASKED, SEPARATELY. A file that stopped declaring anything at all would make
  // the union above shorter, and the union is the only place that could tell — so each is made to speak for
  // the counter and for its own store list. This is what pk26/D2's split would otherwise have hidden.
  for (const { file, spec } of DECLARATIONS) {
    for (const handle of BARE) {
      assert.equal(
        spec.stores[handle],
        null,
        `"${handle}" wears no mark and ${file} must say so with null, never by being silent`,
      );
    }
    assert.deepEqual(
      Object.keys(spec.stores).sort(),
      [...DRESSED, ...BARE].sort(),
      `a store ${file} does not name is a store nothing here grades`,
    );
  }
});

test('★★★ the mark is TRIMMED — the drawing fills its own file, because the bar sizes by HEIGHT', () => {
  // ⇒ SABOTAGE: put the 1536x1024 artboard export back as any of the three and this names the file, the
  //   canvas, the ink inside it and how tall the mark is actually drawn in the bar.
  let graded = 0;
  for (const { app, store, component, file } of logosDeclared()) {
    const art = cropOf(join(PHOTOS, file));
    const fill = art.ink.height / art.canvas.height;
    const box = boxOf(app);
    assert.ok(
      fill >= IS_TRIMMED,
      `store "${store}", ${app}/${component}.logo = "${file}": the drawing fills ${(fill * 100).toFixed(1)}% of the ` +
        `file's height (canvas ${art.canvas.width}x${art.canvas.height}, ink ${art.ink.width}x${art.ink.height} ` +
        `at ${art.ink.x},${art.ink.y}). The app scales the CANVAS to ${box}em and lets the width follow ` +
        '(extensions/chrome/chrome.module.css:22-26, apps/demo-setup/block/marks.module.css), so the mark ' +
        'is drawn ' +
        `${(box * fill).toFixed(3)}em tall — the transparent margin is what the shopper sees. ⛔ The fix is ` +
        'to CUT THE FILE, never to grow the `em`: a bigger box scales the same empty canvas and only makes ' +
        'the bar taller. (Measured floor: the three marks in this box fill 60.6%, 65.8% and 84.6%.)',
    );
    graded += 1;
  }
  assert.equal(
    graded,
    DECLARED_LOGOS,
    `${DECLARED_LOGOS} declared logos over three files, across BOTH declarations — the café names its mark ` +
      'in five blocks (two funnel bars in `chrome`, three marks in `demo-setup`) and the two shoe shops in ' +
      'two bars each. A smaller number is this rule grading less than it claims.',
  );
});

test('★★ the canvas is a WORDMARK\'s shape, not an artboard\'s', () => {
  // ⇒ SABOTAGE: the same one. The artboard export is 1.500 and this floor is 2.5.
  //
  // ⚠️ WHAT THIS ADDS OVER THE RULE ABOVE, said plainly rather than implied: a mark can be trimmed and still
  // be square — a monogram — and that is a legitimate logo this rule would refuse. It is kept because every
  // mark this box actually wears is a wordmark, because the fork already grades its own copies by this same
  // number, and because a square file in a height-sized bar is a decision somebody should have to make out
  // loud. The rule that carries the mechanism is the one above.
  let graded = 0;
  for (const { app, store, component, file } of logosDeclared()) {
    const art = cropOf(join(PHOTOS, file));
    const ratio = art.canvas.width / art.canvas.height;
    assert.ok(
      ratio >= IS_WORDMARK,
      `store "${store}", ${app}/${component}.logo = "${file}": the canvas is ${art.canvas.width}x${art.canvas.height}, ` +
        `i.e. ${ratio.toFixed(3)}:1. Nothing about a wordmark is 1.5 wide — that is the shape of the ` +
        'artboard it was exported from, with the mark floating in the middle of it. The three marks in this ' +
        'box are 3.032, 3.289 and 3.452.',
    );
    graded += 1;
  }
  assert.equal(
    graded,
    DECLARED_LOGOS,
    `${DECLARED_LOGOS} declared logos over three files, across BOTH declarations — the café names its mark ` +
      'in five blocks (two funnel bars in `chrome`, three marks in `demo-setup`) and the two shoe shops in ' +
      'two bars each. A smaller number is this rule grading less than it claims.',
  );
});

test('★★★ the mark carries its own transparent ground — WITHOUT WHICH THE TRIM RULE GRADES NOTHING', () => {
  // ⇒ SABOTAGE: flatten one of the three onto white. The trim rule above then reports 100.0% — every pixel
  //   is opaque, so the bounding box IS the canvas — and would pass a slab. This rule is what stops that.
  //
  // ⚠️ AND THE SLAB IS VISIBLY WRONG, not merely impure: `.bar` draws on
  // `var(--color-chrome-canvas, var(--color-canvas))` (chrome.module.css:15), which is `#f3ede3` for the café
  // (themes/coffee-store/tokens.css:39) and `#17181a` for the outlet (themes/outlet/tokens.css). A mark
  // flattened onto white is a white rectangle sitting on warm sand, or on near-black.
  //
  // ⚠️ THIS IS NOT HYPOTHETICAL IN THIS REPOSITORY. The two checkout seals of pk22 were handed over exactly
  // like this — PNG colour type 2, no alpha channel at all — and `bin/chrome-seal-ink.guard.mjs` caught them
  // on the spot. That guard cannot catch these: it grades `<area>_image` in the two footers and has never
  // looked at a `logo`.
  const FLOOR = 0.15; // measured: the three carry 77.5%, 78.9% and 79.3% clear pixels.
  let graded = 0;
  for (const { app, store, component, file } of logosDeclared()) {
    const art = cropOf(join(PHOTOS, file));
    assert.ok(
      art.hasAlphaChannel,
      `store "${store}", ${app}/${component}.logo = "${file}": the PNG has no alpha channel at all, so it is art ` +
        'FLATTENED ONTO A GROUND. In this bar that is a rectangle of somebody else\'s colour on the shop\'s ' +
        'own canvas — and it also makes the trim rule above report 100%, because every pixel is opaque.',
    );
    assert.ok(
      art.clearShare >= FLOOR,
      `store "${store}", ${app}/${component}.logo = "${file}": only ${(art.clearShare * 100).toFixed(1)}% of this ` +
        'file is transparent. A wordmark on a transparent ground is mostly ground (measured: 77.5%, 78.9% ' +
        'and 79.3% here); a file this full is a slab with an alpha channel, which draws as a coloured ' +
        'rectangle on the shop\'s own bar and passes the trim rule for the wrong reason.',
    );
    graded += 1;
  }
  assert.equal(
    graded,
    DECLARED_LOGOS,
    `${DECLARED_LOGOS} declared logos over three files, across BOTH declarations — the café names its mark ` +
      'in five blocks (two funnel bars in `chrome`, three marks in `demo-setup`) and the two shoe shops in ' +
      'two bars each. A smaller number is this rule grading less than it claims.',
  );
});

test('★★★ the café\'s mark is ONE drawing in TWO deployables — and the two copies still agree', () => {
  // ★ THIS IS THE RULE FOR THE CAUSE, not for the symptom. The café's vitrine is a FORK and bundles the mark
  // as a build-time import; its checkout and account screens are OURS and upload `seed/photos/`'s copy. Two
  // files, one shop, one mark — and s3-11 trimmed one of them and left the other, which is how the same
  // wordmark came to be drawn 1.983em tall in the vitrine and 0.451em tall in the checkout of the same shop.
  //
  // ⇒ SABOTAGE: put the artboard export back in `seed/photos/` and this goes red naming BOTH copies, their
  //   two canvases, and the fact that the ink inside them is identical — i.e. it names the half-done cut.
  //
  // ⚠️ IT GRADES THE INK AND NOT THE CANVAS, deliberately. The two are cut to different margins on purpose
  // (858x233 in the fork, 898x273 in the seed) and neither is wrong; what must not differ is the DRAWING.
  const FORK = join(ROOT, 'storefront-coffee/src/components/coffee/forge-co-logo.png');
  const SEED = join(PHOTOS, 'forge-co-logo.png');
  assert.ok(
    logosDeclared().some((l) => l.store === 'cafe' && l.file === 'forge-co-logo.png'),
    'the café stopped declaring `forge-co-logo.png`, so this rule is comparing a file nothing draws',
  );
  const fork = cropOf(FORK);
  const seed = cropOf(SEED);
  assert.deepEqual(
    { width: seed.ink.width, height: seed.ink.height },
    { width: fork.ink.width, height: fork.ink.height },
    `the two copies of the café's mark no longer draw the same wordmark: seed/photos/forge-co-logo.png ` +
      `holds ${seed.ink.width}x${seed.ink.height} of ink on a ${seed.canvas.width}x${seed.canvas.height} ` +
      `canvas and storefront-coffee/src/components/coffee/forge-co-logo.png holds ` +
      `${fork.ink.width}x${fork.ink.height} on ${fork.canvas.width}x${fork.canvas.height}. One of the two was ` +
      're-cut and the other was not — which is exactly the defect pk25/D2 was written for, in the other ' +
      "direction. The vitrine and the funnel are the same shop to a shopper; they must draw the same mark.",
  );
  // …and both must be trimmed, because "they agree" is also true of two untrimmed copies.
  for (const [name, art] of [
    ['seed/photos/forge-co-logo.png', seed],
    ['storefront-coffee/src/components/coffee/forge-co-logo.png', fork],
  ]) {
    const fill = art.ink.height / art.canvas.height;
    assert.ok(
      fill >= IS_TRIMMED,
      `${name} fills ${(fill * 100).toFixed(1)}% of its own height — two copies that agree are still two ` +
        'artboard exports if neither was cut.',
    );
  }
});

test('★★ every picture in `seed/photos/` is DECLARED somewhere, or listed here as a known orphan', () => {
  // ⛔ THE OTHER HALF OF THE VÁCUO, and the reason it is worth its lines: the file nobody declares is the
  // file no rule grades. `seed/photos/forge-co-logo-negativo.png` is the artboard export too — 1536x1024,
  // 808x217 of ink, 21.2% of its own height — and it has been sitting in this folder harmless, because
  // NOTHING draws it. That is a measurement, not a hope, and this rule is what keeps it one.
  const declared = new Set();
  for (const name of readdirSync(join(ROOT, 'seed')).filter((f) => f.endsWith('.json'))) {
    const body = readFileSync(join(ROOT, 'seed', name), 'utf8');
    for (const file of readdirSync(PHOTOS)) if (body.includes(`"${file}"`)) declared.add(file);
  }
  const orphans = readdirSync(PHOTOS).filter((f) => !declared.has(f));
  assert.deepEqual(
    orphans.sort(),
    Object.keys(KNOWN_ORPHANS).sort(),
    'a picture in seed/photos/ that no seed declaration names is uploaded by nothing and graded by nothing. ' +
      'Either declare it (and the rules above will grade it) or add it to KNOWN_ORPHANS with the reason it ' +
      'may stay.',
  );
  assert.ok(declared.size > 20, 'this rule found almost nothing declared — the scan is broken, not the folder');
});
