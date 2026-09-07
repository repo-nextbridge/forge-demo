// ★★ THE SEAL IN THE FUNNEL'S FOOTER IS DRAWN IN THE FOOTER'S OWN INK — measured off the PNG's PIXELS.
//
//   node --test bin/chrome-seal-ink.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT THIS GUARD PROVES, SO THE NEXT PERSON KNOWS WHAT BROKE WHEN IT BREAKS ────────────────────────────
//
// `seed/chrome.json` gives the two shoe shops a padlock in the RIGHT area of the checkout footer
// (`checkout_footer.end_image`). The art is a stroke on a TRANSPARENT ground — it carries its own ink and
// re-tints itself with nothing. The footer's ground and the footer's ink, however, are the STORE'S THEME:
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
// for the white footer and the padlock is rgb(75,77,82) on rgb(23,24,26): a dark line on a dark ground, still
// there, still 200 OK, invisible to a shopper and to every other test in this repository. The two files are
// four kilobytes apart and one character apart in `chrome.json`.
//
// ── WHY IT DECODES THE PNG INSTEAD OF TRUSTING THE FILENAME ───────────────────────────────────────────────
//
// `compra-segura-escuro.png` is a NAME. A guard that graded names would grade the label on the tin and stay
// green through a re-cut that changed the bytes, which is the likelier accident of the two: the art is
// rasterised from an SVG whose `stroke` is a literal colour, and re-exporting it with the other stroke is one
// undo away. So this file inflates the IDAT, un-filters the scanlines and TALLIES THE OPAQUE PIXELS. The ink
// is the colour more than 90% of them carry (the rest is the anti-aliased fringe of a 1.9px stroke rasterised
// at 8×: 7 614 opaque pixels, 7 529 of them exactly on the nominal colour, measured 2026-09-07).
//
// ── AND THE INK IT IS COMPARED AGAINST IS DERIVED, NEVER TYPED TWICE ──────────────────────────────────────
//
// The store's theme comes from `seed/catalog.json` (`theme_key`), and the ink comes out of that theme's own
// `themes/<key>/tokens.css`. One exception, and it is the same one `seed/chrome.test.mjs` already carries for
// `KIT_DEFAULT_CART`: a store with `theme_key: null` wears the REFERENCE theme, which lives in the OTHER
// repository (`themes/storefront-vanilla/tokens.css`, `--color-muted: var(--ink-700)` at :194 and
// `--ink-700: #4b4d52` at :38). Nothing crosses the two repos, so that one value is transcribed below with
// its `file:line` — and it going red because the reference theme moved IS the report we want.
//
// ── THE VÁCUO ────────────────────────────────────────────────────────────────────────────────────────────
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

/** The colour of the opaque pixels of an 8-bit PNG, and how large a share of them carry it.
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
  let opaque = 0;
  for (let i = 0; i < head.width * head.height; i++) {
    const o = i * channels;
    if (alphaAt !== null && out[o + alphaAt] < 250) continue;
    const rgb = head.color === 0 || head.color === 4 ? [out[o], out[o], out[o]] : [out[o], out[o + 1], out[o + 2]];
    const key = rgb.join(',');
    tally.set(key, (tally.get(key) ?? 0) + 1);
    opaque += 1;
  }
  assert.ok(opaque > 0, `${path} has no fully opaque pixel — there is no ink to measure`);
  const [top, count] = [...tally].sort((x, y) => y[1] - x[1])[0];
  return { rgb: top.split(',').map(Number), share: count / opaque, opaque };
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
      'padlock, and every ink rule below would then pass by iterating over one store less.',
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

test('★★★ the padlock is drawn in the ink of the footer it lands in — measured off the PNG, not the name', () => {
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
          `${(got.share * 100).toFixed(1)}% of ${got.opaque} opaque pixels. This art is a stroke on a ` +
          'transparent ground; a photograph or a filled badge cannot be graded this way and must not be ' +
          'dropped in here without deciding what "its ink" means.',
      );
      assert.deepEqual(
        got.rgb,
        want.rgb,
        `store "${handle}", ${seal.component}.${seal.area}_image = "${seal.file}": the art is drawn in ` +
          `rgb(${got.rgb.join(',')}) and that footer's ink is rgb(${want.rgb.join(',')}) ` +
          `(${want.source}). The padlock has a transparent ground and re-tints itself with NOTHING, so this ` +
          'is a line the shopper cannot see against the footer it sits on — and no exception, no 4xx and no ' +
          'other test in this repository would say so. Each shop takes the file cut for ITS ink.',
      );
      graded += 1;
    }
  }
  assert.equal(graded, 2, 'two shops, one padlock each — a smaller number is this rule grading less than it claims');
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
