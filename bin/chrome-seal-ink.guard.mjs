// ★★ THE SEAL IN THE FUNNEL'S FOOTER IS DRAWN IN THE FOOTER'S OWN INK — measured off the PNG's PIXELS.
//
//   node --test bin/chrome-seal-ink.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT THIS GUARD PROVES, SO THE NEXT PERSON KNOWS WHAT BROKE WHEN IT BREAKS ─────────────────────────────
//
// `seed/chrome.json` gives the two shoe shops a SEAL in the RIGHT area of the checkout footer
// (`checkout_footer.end_image`). Since pk22/D4 that seal is a LOCKUP — the padlock AND the words
// «Compra Segura» in one piece of art — and the reason is the app's contract, not taste: the picture
// REPLACES the word on screen (`extensions/chrome/logic.ts:53-61` returns `{kind:'image', url, alt: text}`
// as soon as the image resolved, and `footer-block.tsx:38-43` draws `<img alt=…>`), so a lone padlock meant
// the shopper saw no word at all. The owner chose that shape out of three on 07/09: «b está bom».
// `end_text` stays «Compra Segura» and is now the picture's accessible name — the ONE place the phrase is
// still spelled out, and `seed/chrome.test.mjs`'s dictation table is what pins the spelling.
//
// The art is a stroke and letters on a TRANSPARENT ground — it carries its own ink and re-tints itself with
// nothing. The footer's ground and the footer's ink, however, are the STORE'S THEME:
//
//     extensions/chrome/chrome.module.css:90-99   background: var(--color-chrome-canvas, var(--color-canvas))
//                                                 color:      var(--color-chrome-muted, var(--color-muted))
//
// MEASURED, and it is the whole reason there are TWO files rather than one:
//
//     store    theme            footer ground              footer ink
//     forge    (vanilla)        #ffffff  rgb(255,255,255)  #4b4d52  rgb(75,77,82)
//     outlet   themes/outlet    #17181a  rgb(23,24,26)     #e4e6ea  rgb(228,230,234)
//
// ⇒ THE FAILURE THIS EXISTS TO CATCH IS NOT AN EXCEPTION AND NOT A BLANK SCREEN. Hand the outlet the file cut
// for the white footer and the lockup is rgb(75,77,82) on rgb(23,24,26): dark art on a dark ground, still
// there, still 200 OK, invisible to a shopper and to every other test in this repository. The two files sit
// in the same directory and their names differ in one word.
//
// ── WHY IT DECODES THE PNG INSTEAD OF TRUSTING THE FILENAME ────────────────────────────────────────────────
//
// `compra-segura-lockup-escuro.png` is a NAME. A guard that graded names would grade the label on the tin and
// stay green through a re-cut that changed the bytes, which is the likelier accident of the two: this art is
// rendered inside each shop's own checkout page, and rendering it in the wrong shop is one tab away. So this
// file inflates the IDAT, un-filters the scanlines and TALLIES THE OPAQUE PIXELS.
//
// ⚠ AND THAT RULE HAS ALREADY PAID FOR ITSELF ONCE, on the very hand-off it was written for. The two lockups
// arrived FLATTENED ONTO WHITE — PNG colour type 2, no alpha channel at all — and this guard went red naming
// the forge and «its commonest opaque colour is only 86.6% of 177 408 opaque pixels». On the outlet that file
// would have been near-white art (rgb(228,230,234)) inside its own opaque white slab, on a #17181a footer:
// unreadable twice over. Every non-white pixel of both files was exactly `a·ink + (1-a)·white` (worst
// reconstruction error 1/255 over the 23 822 and the 24 419 non-white pixels of the two, measured), so the
// transparent original was recovered by solving for `a` — the ink was never touched. That is why both files
// carry EXACTLY ONE opaque colour where the old padlocks carried eight and four: the alpha holds the
// anti-aliasing that the flatten had baked into the colour. (The canvas WAS changed afterwards, deliberately
// and vertically only — see «THE ART FITS THE SLOT» below. Two edits to these bytes, both named, neither a
// re-cut: the ground was given back, and empty rows were added above and below.)
//
// ── AND WHY IT ALSO COUNTS THE ISLANDS OF INK ──────────────────────────────────────────────────────────────
//
// The ink rules above are blind to WHAT the art draws: the lone padlock pk21/D3 shipped passes every one of
// them, and putting it back would silently undo pk22/D4 and leave the funnel wordless again. So the shape is
// graded too, by two numbers that separate a lockup from a badge without pretending to read:
//
//     art                                 canvas      aspect   4-connected islands of opaque ink
//     compra-segura-escuro.png (pk21)     192x192     1.000     2   (the outline and the keyhole)
//     compra-segura-lockup-*.png (pk22)   1008x296    3.405    14   (those 2 + the twelve letters)
//
// ⚠ WHAT IT DOES NOT PROVE, said plainly rather than implied: it cannot READ. Fourteen islands and a 5.7:1
// canvas say «there is a word beside the stroke»; they do not say the word is «Compra Segura», and art
// spelling something else entirely would pass. The phrase itself is pinned as text, in the `end_text` that is
// this picture's `alt` — `seed/chrome.test.mjs`'s `DICTATED` table, verbatim.
//
// ── THE ART FITS THE SLOT, AND THAT IS WHY THE CANVAS IS 296 ROWS TALL FOR 112 ROWS OF DRAWING ────────────
//
// ⚠ READ THIS BEFORE CONCLUDING THAT SOMEBODY PADDED THE FILE TO DODGE A RULE. Nobody did; the padding is
// the point, and it is aimed at the BROWSER, not at this file — every number below gets WORSE for the guard,
// not better (the aspect fell from 5.727 to 3.405, i.e. closer to the floor it has to clear).
//
// `.areaImage` clamps the HEIGHT and throws the file's own scale away (`max-height: 2.5em; width: auto`,
// chrome.module.css:111-115). That is right for a badge and wrong for art that CONTAINS TYPE: the seal is
// drawn 2.5× the footer's own font-size tall whatever scale it was rendered at, so the letters inside it are
// sized by the ratio `cap-height ÷ canvas`, which is a property of the FILE. MEASURED: the capitals span 83
// rows (the `C` of «Compra» and the `S` of «Segura», y=98..180 in both files). At the original 176-row
// canvas that is 47.16% of the height, i.e. 1.179em on screen — against the ≈0.70em a sans face's capitals
// take at its own size — so the seal's words read about 1.7× the words beside them.
//
// The clamp lives in the PRODUCT repository and a general rule bent for one picture is how debt is invented,
// so the ART was adapted instead: 60 fully transparent rows above and 60 below, width untouched, not one
// pixel of ink moved or recoloured. 83 ÷ 296 = 28.04% ⇒ 0.7010em, which is parity with the text beside it.
//
// ⇒ AND THE SAME NUMBER FALLS OUT OF A SECOND, INDEPENDENT ROUTE, which is the reason to believe it: the art
// was rendered at 8× inside each shop's own checkout page, and at a 296-row canvas the clamp draws it at
// scale 2.5 × 14.5 ÷ 296 = 0.1225 — within 2% of the 0.125 the art was drawn at. The padding does not invent
// a size; it gives back the size the art already had.
//
// ⚠ WHAT THIS COSTS, said out loud: the `end` area's picture now reserves 2.5em of height for 0.95em of
// drawing. The footer is a centred grid row (`align-items: center`, chrome.module.css:90-99) so the
// transparent rows fall equally above and below and nothing is pushed — but a future rule that gives
// `.areaImage` a BACKGROUND, a border or a hit-target would find a box far larger than the mark inside it.
//
// ── AND THE INK IT IS COMPARED AGAINST IS DERIVED, NEVER TYPED TWICE ───────────────────────────────────────
//
// The store's theme comes from `seed/catalog.json` (`theme_key`), and the ink comes out of that theme's own
// `themes/<key>/tokens.css`. One exception, and it is the same one `seed/chrome.test.mjs` already carries for
// `KIT_DEFAULT_CART`: a store with `theme_key: null` wears the REFERENCE theme, which lives in the OTHER
// repository (`themes/storefront-vanilla/tokens.css`, `--color-muted: var(--ink-700)` at :194 and
// `--ink-700: #4b4d52` at :38). Nothing crosses the two repos, so that one value is transcribed below with
// its `file:line` — and it going red because the reference theme moved IS the report we want.
//
// ── THE VÁCUO ──────────────────────────────────────────────────────────────────────────────────────────────
//
// Every store of the box is decided here, by name: `balcao` has no chrome at all (`null` in chrome.json) and
// is skipped with its `null` asserted; `cafe` wears chrome but no seal and is named in a list this file
// asserts, so deleting the forge's `end_image` makes that list say `['cafe','forge']` and goes red. A rule
// pointed at a store with no footer therefore accuses itself instead of iterating zero times in green.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { blocksFor } from '../seed/chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = JSON.parse(readFileSync(join(ROOT, 'seed/chrome.json'), 'utf8'));
const CATALOG = JSON.parse(readFileSync(join(ROOT, 'seed/catalog.json'), 'utf8'));

/** The footer areas that can carry a picture, in the order `footer-block.tsx` draws them. */
const AREAS = ['start', 'middle', 'end'];
const FOOTERS = ['checkout_footer', 'account_footer'];

/** ⚠️ A COPY OF A VALUE THAT LIVES IN THE OTHER REPOSITORY, and the only one in this file.
 *  `themes/storefront-vanilla/tokens.css:194` → `--color-muted: var(--ink-700)`, `:38` → `#4b4d52`.
 *  The vanilla theme declares no `--color-chrome-muted`, so the footer falls back to `--color-muted`
 *  (`chrome.module.css:98`). Nothing keeps this in step but a human; going red is the point. */
const VANILLA_FOOTER_INK = { file: 'themes/storefront-vanilla/tokens.css:38+194', rgb: [75, 77, 82] };

/** `#rrggbb` → `[r,g,b]`. */
function hexRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, `"${hex}" is not a six-digit hex colour`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** A custom property's value in a stylesheet, comments stripped first — this repo's CSS spells the very
 *  declarations being graded in its prose, and a parser that read the sentences would grade the commentary. */
function token(css, name) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(clean);
  return m ? m[1].trim() : null;
}

/** The ink the FOOTER draws its text in, for one store. Returns `{rgb, source}` so a failure can name where
 *  the number came from.
 *
 *  ★ THE CASCADE IS THE REAL ONE AND IT HAS THREE STEPS, because a theme here is an OVERRIDE and never a copy
 *  (`themes/README.md`): the store's theme may state the chrome role, or only the page's muted role, or —
 *  like `themes/coffee-store` — neither, in which case the value that reaches the footer is the reference
 *  theme's. `chrome.module.css:98` writes the first two steps as one declaration
 *  (`var(--color-chrome-muted, var(--color-muted))`); the third is the cascade itself. */
function footerInk(handle) {
  const store = CATALOG.stores.find((s) => s.handle === handle);
  assert.ok(store, `seed/catalog.json has no store "${handle}" — the theme cannot be resolved`);
  const key = store.theme_key ?? null;
  if (key !== null) {
    const path = `themes/${key}/tokens.css`;
    const css = readFileSync(join(ROOT, path), 'utf8');
    for (const name of ['--color-chrome-muted', '--color-muted']) {
      const value = token(css, name);
      if (value) return { rgb: hexRgb(value), source: `${path} (${name})` };
    }
  }
  return {
    rgb: VANILLA_FOOTER_INK.rgb,
    source: `${VANILLA_FOOTER_INK.file} (the reference theme — ${key === null ? 'this store has none' : `themes/${key} overrides neither role`})`,
  };
}

/** The colour of the opaque pixels of an 8-bit PNG, how large a share of them carry it, the canvas, and how
 *  many separate ISLANDS of opaque ink the art is made of.
 *  No decoder, no dependency: this repository has neither (`seed/media.test.mjs:149` reads IHDR the same way,
 *  and stops there because it only ever needed the size). */
export function inkOf(path) {
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

  // Tally the pixels a shopper actually sees. The fringe of an anti-aliased stroke is semi-transparent and is
  // NOT the ink — averaging it in would answer a colour that is in no pixel of the file.
  const alphaAt = head.color === 6 || head.color === 4 ? channels - 1 : null;
  const tally = new Map();
  const solid = new Uint8Array(head.width * head.height);
  let opaque = 0;
  for (let i = 0; i < head.width * head.height; i++) {
    const o = i * channels;
    if (alphaAt !== null && out[o + alphaAt] < 250) continue;
    const rgb = head.color === 0 || head.color === 4 ? [out[o], out[o], out[o]] : [out[o], out[o + 1], out[o + 2]];
    const key = rgb.join(',');
    tally.set(key, (tally.get(key) ?? 0) + 1);
    solid[i] = 1;
    opaque += 1;
  }
  assert.ok(opaque > 0, `${path} has no fully opaque pixel — there is no ink to measure`);
  const [top, count] = [...tally].sort((x, y) => y[1] - x[1])[0];
  return {
    rgb: top.split(',').map(Number),
    share: count / opaque,
    opaque,
    width: head.width,
    height: head.height,
    islands: islandsOf(solid, head.width, head.height),
  };
}

/** How many separate 4-connected runs of opaque ink the mask holds — a flood fill over an explicit stack,
 *  whose depth is the size of an island and not something this file gets to bound.
 *
 *  ★ 4-CONNECTED, AND OVER THE OPAQUE PIXELS ONLY — both halves are the same decision. Letters fuse where
 *  their edges brush, and the edge of a glyph is its anti-aliased fringe; fuse two and the count sags with
 *  the kerning of whatever face the shop happens to wear. And the two shops DO wear different faces:
 *  `themes/outlet/tokens.css:103` sets `--font-sans` to Figtree where the reference theme sets Urbanist, the
 *  art is rendered inside each shop's own checkout page, and no glyph of one file holds the same pixel count
 *  as any glyph of the other. MEASURED, over the four combinations: 4-connected opaque counts 14 and 14,
 *  8-connected opaque counts 14 and 14, 4-connected over the whole fringe counts 14 and 14 — and 8-connected
 *  over the whole fringe counts 13 and 14, i.e. the forge's lockup ALREADY loses a letter to its neighbour
 *  the moment both allowances are given at once. The pair chosen is the one furthest from that edge. */
function islandsOf(solid, width, height) {
  const seen = new Uint8Array(solid.length);
  const stack = [];
  let islands = 0;
  for (let start = 0; start < solid.length; start++) {
    if (!solid[start] || seen[start]) continue;
    islands += 1;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % width;
      const y = (i / width) | 0;
      const neighbours = [];
      if (x > 0) neighbours.push(i - 1);
      if (x < width - 1) neighbours.push(i + 1);
      if (y > 0) neighbours.push(i - width);
      if (y < height - 1) neighbours.push(i + width);
      for (const n of neighbours) {
        if (solid[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
  }
  return islands;
}

/** Every `<area>_image` the declaration gives a store, as `{component, area, file}`. */
function sealsOf(handle) {
  const found = [];
  for (const block of blocksFor(CHROME, handle)) {
    if (!FOOTERS.includes(block.component)) continue;
    for (const area of AREAS) {
      const file = block.config?.[`${area}_image`];
      if (typeof file === 'string' && file.trim().length > 0) found.push({ component: block.component, area, file });
    }
  }
  return found;
}

test('★★ every store of the box is DECIDED here — dressed with a seal, dressed without one, or no chrome', () => {
  // ⛔ THE VÁCUO. Every rule below loops over the stores that HAVE a seal; a store that lost its `end_image`
  // would make that loop shorter and greener, so the three sets are pinned first and by name.
  const withSeal = [];
  const withoutSeal = [];
  const noChrome = [];
  for (const handle of Object.keys(CHROME.stores)) {
    if (CHROME.stores[handle] === null) {
      noChrome.push(handle);
      continue;
    }
    (sealsOf(handle).length > 0 ? withSeal : withoutSeal).push(handle);
  }
  assert.deepEqual(
    withSeal.sort(),
    ['forge', 'outlet'],
    'the two shoe shops are the ones the owner asked to fill in on 07/09 ("compra segura precisa usar o do ' +
      'app, precisa preencher pois quero mostrar isso na demo"). A shop leaving this list has lost its ' +
      'seal, and every ink and shape rule below would then pass by iterating over one store less.',
  );
  assert.deepEqual(
    withoutSeal.sort(),
    ['cafe'],
    'the café is the ONE shop deliberately left alone — it has a footer of its own and the owner did not ' +
      'name it. Named here rather than absent, because a store missing from a list is indistinguishable ' +
      'from one that failed.',
  );
  assert.deepEqual(noChrome, ['balcao'], 'the counter has no chrome at all — see `_balcao_why`');
});

test('★★★ the seal is drawn in the ink of the footer it lands in — measured off the PNG, not the name', () => {
  // ⇒ SABOTAGE: swap the two files in `seed/chrome.json` and this names the store, the file, the ink the
  // bytes carry and the ink the theme draws in.
  let graded = 0;
  for (const handle of Object.keys(CHROME.stores)) {
    if (CHROME.stores[handle] === null) {
      // Skipped BY NAME, and the skip asserts its own reason rather than being an absence.
      assert.equal(CHROME.stores[handle], null, `"${handle}" is skipped here and chrome.json must say null`);
      continue;
    }
    const seals = sealsOf(handle);
    if (seals.length === 0) continue; // named, not silent: the set is pinned by the rule above.
    const want = footerInk(handle);
    for (const seal of seals) {
      const path = join(ROOT, 'seed/photos', seal.file);
      const got = inkOf(path);
      assert.ok(
        got.share > 0.9,
        `store "${handle}": seed/photos/${seal.file} has no single ink — its commonest opaque colour is only ` +
          `${(got.share * 100).toFixed(1)}% of ${got.opaque} opaque pixels. This art is a stroke and ` +
          'letters on a transparent ground, so every opaque pixel of it carries one colour (measured: 100.0% ' +
          'of 18 792 and of 19 891). A photograph, a filled badge, or art FLATTENED ONTO A GROUND cannot be ' +
          'graded this way — the last is not hypothetical, it is how these two files were first handed over ' +
          '— and none may be dropped in here without deciding what "its ink" means.',
      );
      assert.deepEqual(
        got.rgb,
        want.rgb,
        `store "${handle}", ${seal.component}.${seal.area}_image = "${seal.file}": the art is drawn in ` +
          `rgb(${got.rgb.join(',')}) and that footer's ink is rgb(${want.rgb.join(',')}) ` +
          `(${want.source}). The lockup has a transparent ground and re-tints itself with NOTHING, so this ` +
          'is art the shopper cannot see against the footer it sits on — and no exception, no 4xx and no ' +
          'other test in this repository would say so. Each shop takes the file cut for ITS ink.',
      );
      graded += 1;
    }
  }
  assert.equal(graded, 2, 'two shops, one seal each — a smaller number is this rule grading less than it claims');
});

test('★★★ the seal is a LOCKUP — a word beside the stroke, not the lone padlock pk21 shipped', () => {
  // ⇒ SABOTAGE: put `compra-segura-escuro.png` back and this goes red twice — 2 islands where 8 are the
  //   floor, on a 1.000 canvas where 3.0 is the floor. That file passed every ink rule above, which is
  //   exactly why this rule had to be written: the ink rules cannot see WHAT the art draws.
  //
  // ⚠️ THE TWO FLOORS ARE FLOORS AND NOT THE MEASUREMENTS, deliberately. The art carries fourteen islands on
  // a 3.405 canvas today; pinning 14 would go red the first time a designer kerns a letter into its
  // neighbour or the phrase is translated, which is a re-cut and not a regression. «Compra Segura» would
  // have to lose five of its twelve letters to fall through the island floor.
  //
  // ⚠️ AND THE ASPECT FLOOR IS 2.0 RATHER THAN 3.0 BECAUSE THE CANVAS GREW — it is 3.405 where it was 5.727,
  // and the number moved for a reason that has nothing to do with the drawing (the padding below). A floor
  // of 3.0 would have survived that change with 13% to spare, which is a floor waiting to go red on the next
  // deliberate pad rather than on a defect. 2.0 still sits at twice the square badge this rule exists to
  // refuse, and the drawing itself is graded by the islands.
  let graded = 0;
  for (const handle of Object.keys(CHROME.stores)) {
    if (CHROME.stores[handle] === null) {
      assert.equal(CHROME.stores[handle], null, `"${handle}" is skipped here and chrome.json must say null`);
      continue;
    }
    for (const seal of sealsOf(handle)) {
      const art = inkOf(join(ROOT, 'seed/photos', seal.file));
      assert.ok(
        art.islands >= 8,
        `store "${handle}", ${seal.component}.${seal.area}_image = "${seal.file}": the art is ` +
          `${art.islands} separate island(s) of opaque ink. A lockup is a stroke PLUS twelve letters and ` +
          'counts fourteen; the lone padlock this replaced counts two. The picture REPLACES the word on ' +
          'screen (extensions/chrome/logic.ts:53-61), so wordless art is a funnel whose footer promises ' +
          'nothing in writing — and «Compra Segura» survives only as the `alt` nobody looks at.',
      );
      assert.ok(
        art.width / art.height >= 2,
        `store "${handle}", ${seal.component}.${seal.area}_image = "${seal.file}": the canvas is ` +
          `${art.width}x${art.height}, i.e. ${(art.width / art.height).toFixed(3)}:1. The lockup is 3.405:1 ` +
          'and a badge is square — and the shape is not cosmetic here, because `.areaImage` clamps the ' +
          'HEIGHT (`max-height: 2.5em`, chrome.module.css:111-115) and lets the width follow, so a square ' +
          'file is a square seal wherever it lands.',
      );
      graded += 1;
    }
  }
  assert.equal(graded, 2, 'two shops, one lockup each — a smaller number is this rule grading less than it claims');
});

test('★ the two inks are DIFFERENT, which is the only reason there are two files', () => {
  // A re-cut that made both files the same colour would leave every rule above green for one of the two
  // shops by accident. The premise is that the two footers do not share an ink — so it is asserted.
  const forge = footerInk('forge').rgb.join(',');
  const outlet = footerInk('outlet').rgb.join(',');
  assert.notEqual(
    forge,
    outlet,
    `the reference footer and the outlet's footer now draw in the same ink (rgb(${forge})). If that is a ` +
      'deliberate theme change, the two stores can share ONE seal file and this whole guard shrinks to one ' +
      'rule; if it is not, a theme lost its ink.',
  );
});
