// ★★ THE COUNTER'S HERO IS CENTRED IN ITS OWN BAND — the free space is SPLIT, never parked at one end.
//
//   node --test bin/totem-hero-balance.guard.mjs        (or: bash bin/test.sh)
//
// ── THE DEFECT, MEASURED ───────────────────────────────────────────────────────────────────────────────────
//
// THE RULE, SETTLED 2026-09-08: the counter's hero band is to be CENTRED, because it left a large run of
// empty green below it. `.menuHeader` is a FIXED 372px band of `--totem-header` at the top of the panel,
// holding three things stacked: the wordmark, «Faça seu pedido» and the scroll arrow. It declared
// `justify-content: flex-start` with `padding: 16px 0 0`.
//
// MEASURED — headless Chromium, the panel's own 1080x1920 geometry, the counter's own self-hosted Fraunces
// and Poppins (`totem/src/app/fonts/`), so these are the real line boxes and not an estimate:
//
//     element                       top      bottom     height
//     .menuHeader                     0         372        372
//     .headerWordmark (64px)         28         107         79
//     .headerTitle (46px)           121         178         57
//     .headerArrow                  186         230         44
//
//   ⇒ 28px of band above the mark and 142px of empty green below it. The content is 214px in a 372px band,
//     and `flex-start` put every one of the 142 spare pixels in one lump at the bottom.
//
// After `justify-content: center` and a SYMMETRIC `padding: 16px 0`: 91px above, 79px below. The residue of
// 12px is the wordmark's own `margin-top` — the artboard's number (`design-base/Totem forge.co.dc.html:36`
// carries it on the mark), so it stays and is named here rather than trimmed to make an assertion prettier.
//
// ⚠️ WHY THE PADDING HAD TO CHANGE TOO, and it is the same defect one order of magnitude down: with
// `justify-content: center` the content is centred in the CONTENT BOX, which an asymmetric padding has
// already pushed off centre. Leaving `16px 0 0` gives 99 above / 71 below — measured — i.e. a "centred"
// header that is 28px off. A centre inside an off-centre box is not a centre.
//
// ── WHAT THIS GUARD ASSERTS, AND WHY IT IS ABOUT THE MECHANISM RATHER THAN THE PIXELS ─────────────────────
//
// This repository has no layout engine in its test suite — `bin/` is plain `node --test` and the fork's
// vitest runs in jsdom, which has no layout at all. So a rule that asserted "142px" would be asserting a
// number it cannot re-measure, and it would go red the day somebody legitimately changes a font size.
//
// What CAN be graded, and is exactly what broke, is the LAYOUT'S SHAPE: a column of fixed height whose
// content does not fill it must SPLIT the slack, and its vertical padding must be symmetric so that "split"
// means the same thing at both ends. Both are properties of the stylesheet, both are the two declarations
// that were wrong, and neither depends on a font.
//
// ⛔ AND TWO THINGS THIS GUARD MUST NEVER GROW INTO, both decisions recorded on 2026-09-08:
//   · THE PANEL IS NOT RESPONSIVE AND MUST NOT BECOME SO (`Totem.module.css:7-10`). It is one physical
//     portrait screen scaled to fit, so there is no media query to write here and none to grade.
//   · «Estou aqui» STAYS AS IT IS. `.dialogPrimary` is 104px tall in a 1080x1920 panel — 2.4x the 44px touch
//     floor. The "thin" button was the browser's own scale, not the design.
//
// ── THE VÁCUO ──────────────────────────────────────────────────────────────────────────────────────────────
//
// Every rule below reads ONE named rule out of the stylesheet, and a rule that has been renamed or deleted
// would leave a regex matching nothing and a guard passing over an empty set. So `ruleOf` THROWS when the
// selector is gone, the band's `height` and `flex-direction` are asserted before anything is said about how
// its slack is shared, and the three children the band lays out are asserted to exist in the component that
// draws them — because centring a column that turned out to hold one thing proves nothing.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_PATH = join(ROOT, 'totem/src/components/Totem.module.css');
const TSX_PATH = join(ROOT, 'totem/src/components/Totem.tsx');

/** The sheet with its comments removed. This repository's CSS spells the very declarations being graded in
 *  its prose (the file's own header quotes `justify-content` and the panel's fixed size), and a parser that
 *  read the sentences would grade the commentary. `bin/pdp-shot-width.guard.mjs` strips them for the same
 *  reason. */
function stylesheet(path) {
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const CSS = stylesheet(CSS_PATH);
const TSX = readFileSync(TSX_PATH, 'utf8');

/** The body of one class rule. ⛔ THROWS when the selector is absent — a guard whose subject has been renamed
 *  must say so, not pass over nothing. */
function ruleOf(selector) {
  const found = new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!found?.[1]) {
    throw new Error(
      `totem/src/components/Totem.module.css has no .${selector} rule — this guard is arguing about a door ` +
        'that moved. Point it at the rule that replaced it, or delete it with the layout it graded.',
    );
  }
  return found[1];
}

/** One declaration's value inside a rule body, or null when the rule does not state it. */
function decl(selector, property) {
  const found = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(ruleOf(selector));
  return found?.[1]?.trim() ?? null;
}

/** The four vertical/horizontal parts of a `padding` shorthand, in CSS order (top, right, bottom, left). */
function paddingBox(shorthand) {
  const parts = shorthand.split(/\s+/);
  const [a, b = a, c = a, d = b] = parts;
  return { top: a, right: b, bottom: c, left: d, parts: parts.length };
}

/** The band whose slack this guard is about. Named once so a rename is one edit and not four. */
const BAND = 'menuHeader';

/** `justify-content` values that PARK the free space at one end instead of sharing it. `space-between` is
 *  here too: with three children it would pin the mark to the very top of the band and the arrow to the very
 *  bottom, which is the same defect turned inside out. */
const PARKS_THE_SLACK = ['flex-start', 'start', 'normal', 'flex-end', 'end', 'space-between'];

test('★★ the band this guard is about still exists, is a COLUMN, and its height is FIXED', () => {
  // ⛔ THE VÁCUO. Everything below is only a defect because the band cannot grow to fit its content: a column
  // whose height is its content's has no slack to park anywhere. So the premise is asserted, not assumed.
  const height = decl(BAND, 'height');
  assert.ok(
    height && /^\d+(\.\d+)?px$/.test(height),
    `.${BAND} declares height: ${height ?? '(nothing)'} — this guard exists because that height is a fixed ` +
      'number of the panel\'s own pixels and the content inside it is shorter. An auto height shares no slack ' +
      'because it has none, and every rule below would then be grading a layout that cannot go wrong.',
  );
  assert.equal(decl(BAND, 'flex-direction'), 'column', `.${BAND} is no longer a column — the axis moved`);
  assert.equal(decl(BAND, 'display'), 'flex', `.${BAND} is no longer a flex container`);
});

test('★★★ the band SPLITS its free space instead of parking all of it below the content', () => {
  // ⇒ SABOTAGE: put `justify-content: flex-start` back and this names the value and what it does — 142px of
  //   empty green under the arrow, measured, in a 372px band holding 214px of content.
  const value = decl(BAND, 'justify-content');
  assert.ok(value, `.${BAND} states no justify-content at all, so the slack falls to the initial value`);
  assert.ok(
    !PARKS_THE_SLACK.includes(value),
    `.${BAND} declares justify-content: ${value}. The band is a fixed 372px and its three children measure ` +
      '214px together (measured in headless Chromium with the counter\'s own fonts: wordmark 79px + margins ' +
      '18, title 57px, arrow 44px, two 8px gaps), so 142px of it is empty — and this value puts all 142 in ' +
      'one lump. The opposite was settled on 2026-09-08: the band is CENTRED, because the slack read as a ' +
      'run of empty green below the content. ⛔ The fix is to SHARE the slack, not to shrink the band: 372px is ' +
      'the artboard\'s (design-base/Totem forge.co.dc.html:35) and the scroller\'s spacer is cut to it.',
  );
});

test('★★★ and the band\'s vertical padding is SYMMETRIC — a centre inside an off-centre box is not a centre', () => {
  // ⇒ SABOTAGE: restore `padding: 16px 0 0` beside `justify-content: center` and this goes red. That pair is
  //   not a typo: it is the half-fix, and it measures 99px above / 71px below where the symmetric one
  //   measures 91 / 79. Nothing else in this repository would report the difference.
  const shorthand = decl(BAND, 'padding');
  assert.ok(shorthand, `.${BAND} states no padding — state it, or the two ends are equal by accident`);
  const box = paddingBox(shorthand);
  assert.equal(
    box.top,
    box.bottom,
    `.${BAND} declares padding: ${shorthand} — ${box.top} at the top and ${box.bottom} at the bottom. ` +
      'The children are centred in the CONTENT box, so an asymmetric padding moves the centre by exactly ' +
      'the difference and the band looks off by that much for a reason nobody can see in the layout.',
  );
  assert.ok(
    decl(BAND, 'padding-top') === null && decl(BAND, 'padding-bottom') === null,
    `.${BAND} restates padding-top/padding-bottom beside the shorthand, which is how the two ends drift ` +
      'apart again without the shorthand above ever looking wrong.',
  );
});

test('★★ the band really does lay out THREE things — centring one item proves nothing', () => {
  // A guard over a column that quietly lost two of its children would stay green while the header emptied.
  for (const child of ['headerWordmark', 'headerTitle', 'headerArrow']) {
    ruleOf(child); // throws when the rule is gone
    assert.ok(
      new RegExp(`styles\\.${child}\\b`).test(TSX),
      `totem/src/components/Totem.tsx no longer draws .${child}, so the band this guard balances holds ` +
        'less than it did and the measurement above describes a screen that does not exist.',
    );
  }
  assert.ok(
    new RegExp(`styles\\.${BAND}\\b`).test(TSX),
    `totem/src/components/Totem.tsx no longer draws .${BAND} at all`,
  );
});

test('⛔ the panel is still NOT responsive, and the settled touch target is untouched', () => {
  // ⚠️ THE TWO DECISIONS OF 2026-09-08 THIS SLICE WAS TOLD NOT TO CROSS, kept as assertions so that crossing
  // them is a red build and not a diff nobody reads.
  //
  //   · «THE PANEL IS A FIXED 1080x1920 AND IS SCALED TO FIT. It is not responsive and must not become so.»
  //     (Totem.module.css:7-10) — a media query here is a second layout for a screen that does not exist.
  //   · «Estou aqui» stays: `.dialogPrimary` is 104px in a 1080x1920 panel, 2.4x the 44px touch floor. What
  //     looked thin was the browser's own scale.
  assert.ok(
    !/@media[^{]*\((?:max|min)-(?:width|height)/.test(CSS),
    'a width/height media query has appeared in the counter\'s stylesheet. The panel is one physical ' +
      'portrait screen scaled to fit; a breakpoint here dresses glass nobody has.',
  );
  assert.equal(
    decl('dialogPrimary', 'height'),
    '104px',
    '«Estou aqui» changed height. It was settled on 2026-09-08 after being measured: 104px in a ' +
      'fixed 1080x1920 panel is 2.4x the 44px touch floor, and the "thin" button was the browser\'s scale. ' +
      'If it is being changed on purpose, this line is the place to say so.',
  );
});
