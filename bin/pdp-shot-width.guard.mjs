// ★★ THE PHOTO'S CSS BOX AND THE PHOTO'S REQUESTED WIDTH ARE THE SAME NUMBER, WRITTEN IN TWO FILES.
//
// The café's PDP states the shot's box in `templates/pdp/coffee.module.css` (`.shot { max-width }`) and
// states the width it ASKS THE MEDIA PIPELINE FOR in `templates/pdp/PdpCoffee.tsx` (`width` + the default
// length of `sizes`). Those two are what a responsive `srcset` is chosen against — so widening only the
// stylesheet makes the browser fetch the SMALLER derivative and stretch it, and the result is a soft photo
// whose cause lives in a file nobody edited. Nothing goes red for it: both files are valid, the page
// renders, and the loss is one a human notices weeks later, if at all.
//
// It nearly happened here. The 2026-09-04 request was "the PDP photo can be max-width 400px, it was 360" —
// two CSS numbers, by the letter. Growing only those two would have shipped exactly the defect above.
//
// ⚠️ AND THE ONE MEASUREMENT THAT KEEPS THIS FILE HONEST: on the bench of 2026-09-04 the shot renders as a
// PLAIN `<img>` with no `srcset`, no `sizes` and no `width` attribute at all (measured through the edge on
// `/s/<sto_…>/pra_levar/forge-alvorada`). The kit's `MediaImage` only takes the optimized `<picture>` path
// when a box is stated as `fill`, `intrinsic`, or `width` AND `height` together — and this call site passes
// `width` alone — and only when the media read carries a `providerKey`, which this bench's does not. So the
// two props are INERT TODAY. They are still guarded, and deliberately: they are the call site's declared
// intent, they cost nothing, and the day either condition changes (a `height`, a media driver) the numbers
// have to be right ALREADY — a guard that waits for the defect to become visible is a guard that arrives
// after the screenshot.
//
// ── THE SECOND PAIR: the seal ───────────────────────────────────────────────────────────────────────────
// `.sealSmall` ("OFF") must be the same size as `.sealBig` ("10%") — one rule, settled 2026-09-04. It is
// written as `composes: sealBig`, so the two cannot drift: there is one number. This guard fails if anyone
// restates a `font-size` inside `.sealSmall`, because that is precisely how "the same size" stops being
// true without anybody deciding it.
//
//   node --test bin/pdp-shot-width.guard.mjs        (or: bash bin/test.sh)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORK = join(ROOT, 'storefront-coffee/src/templates');
const PDP_CSS = join(FORK, 'pdp/coffee.module.css');
const PDP_TSX = join(FORK, 'pdp/PdpCoffee.tsx');
const HOME_CSS = join(FORK, 'home/coffee.module.css');

/** A stylesheet with its comments removed — this repo's CSS carries prose that spells the very declarations
 *  being graded, and a parser that read the sentences would grade the commentary. */
function stylesheet(path) {
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The body of a single top-level rule, by class name. `null` when there is no such rule — which the caller
 *  must treat as a failure rather than as "the property is absent". */
function rule(css, className) {
  const m = css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}

/** A `<number>px` declaration inside a rule body, as a Number. `null` when the property is not declared. */
function px(body, property) {
  const m = body?.match(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+)`));
  const n = m?.[1].match(/(\d+(?:\.\d+)?)px/);
  return n ? Number(n[1]) : null;
}

const pdpCss = stylesheet(PDP_CSS);
const homeCss = stylesheet(HOME_CSS);
const pdpTsx = readFileSync(PDP_TSX, 'utf8');

// ── The guard proves it can SEE, before it proves anything about what it saw. Pointed at a file that moved
//    or a rule that was renamed, every assertion below would pass vacuously.
test('★ the guard found the three files and the two rules it grades', () => {
  assert.ok(pdpCss.length > 500, `${PDP_CSS} is empty or unreadable`);
  assert.ok(homeCss.length > 500, `${HOME_CSS} is empty or unreadable`);
  assert.ok(pdpTsx.includes('MediaImage'), `${PDP_TSX} no longer renders a MediaImage`);
  assert.ok(rule(pdpCss, 'shot') !== null, '`.shot` is gone from the PDP stylesheet');
  assert.ok(rule(homeCss, 'sealSmall') !== null, '`.sealSmall` is gone from the home stylesheet');
});

test('the shot photo asks for exactly the width its CSS box gives it', () => {
  const box = px(rule(pdpCss, 'shot'), 'max-width');
  assert.ok(box !== null, '`.shot` declares no `max-width` — the photo has no stated box');

  const width = pdpTsx.match(/\n\s*width=\{(\d+)\}/);
  assert.ok(width, 'PdpCoffee.tsx states no `width` for the shot');
  assert.equal(
    Number(width[1]),
    box,
    `the shot's CSS box is ${box}px but PdpCoffee.tsx asks the media pipeline for ${width[1]}px — the ` +
      'browser would pick the file for the smaller of the two and scale it',
  );

  const sizes = pdpTsx.match(/\n\s*sizes="([^"]*)"/);
  assert.ok(sizes, 'PdpCoffee.tsx states no `sizes` for the shot');
  // The LAST length of a `sizes` list is its default — the one that applies above every media query, which
  // is the branch the 400px box belongs to.
  const fallback = sizes[1].trim().split(',').pop().trim();
  assert.equal(
    fallback,
    `${box}px`,
    `the default length of \`sizes\` is "${fallback}" while the CSS box is ${box}px`,
  );
});

test('the buy box starts as wide as the photo it sits beside', () => {
  const basis = rule(pdpCss, 'panel')?.match(/flex\s*:\s*\d+\s+\d+\s+(\d+)px/);
  assert.ok(basis, '`.panel` declares no three-part `flex` with a px basis');
  assert.equal(
    Number(basis[1]),
    px(rule(pdpCss, 'shot'), 'max-width'),
    'the panel no longer starts at the photo width — the two columns were asked to match',
  );
});

test('the seal\'s "OFF" is the same size as its "10%", because it is the same declaration', () => {
  const small = rule(homeCss, 'sealSmall');
  assert.match(
    small,
    /composes\s*:\s*sealBig/,
    '`.sealSmall` no longer composes `.sealBig` — the two sizes can now drift apart silently',
  );
  assert.equal(
    px(small, 'font-size'),
    null,
    '`.sealSmall` restates a `font-size`, which overrides the one it composes: "the same size" is no ' +
      'longer true, and nothing else says so',
  );
  assert.ok(
    !/letter-spacing/.test(small),
    '`.sealSmall` reintroduces a `letter-spacing`: at 26px inside a fixed circle that is what pushes the ' +
      'word out of the badge',
  );
});
