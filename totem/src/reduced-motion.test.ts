// THE REDUCED-MOTION GUARD — a public screen must not move for somebody who asked the world to hold still.
//
// A totem is the hardest case for this preference: whoever is standing in front of it did not choose the
// page and cannot navigate away. So the requirement is not "most animations" — it is all nine of the
// artboard's, and the tenth one somebody adds next month.
//
// ⚠️ THIS IS WHY THE SHEET USES A BLANKET RULE RATHER THAN A LIST. A per-animation opt-out is a list to
// remember; the one that gets forgotten is always the newest. The guard below encodes exactly that: it does
// not check that nine names appear in the media block — it checks that the block disables animation for the
// UNIVERSAL selector, with `!important`, and that the keyframes declared are the nine that were approved.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const globals = readFileSync(join(root, 'src/styles/globals.css'), 'utf8');
const artboard = readFileSync(join(root, 'design-base/Totem forge.co.dc.html'), 'utf8');

const APPROVED = [
  'fgPulse',
  'fgArrow',
  'fgIn',
  'fgFade',
  'fgSlide',
  'fgToast',
  'fgGlow',
  'fgWait',
  'fgCaret',
];

/** The `@media (prefers-reduced-motion: reduce) { … }` body, or null when there is none at all. */
function reducedMotionBlock(css: string): string | null {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  if (start === -1) return null;
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

describe('every animation of the artboard is in the sheet', () => {
  const declared = [...globals.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1] as string);

  it('declares exactly the nine the artboard declares', () => {
    expect([...declared].sort()).toEqual([...APPROVED].sort());
  });

  it.each(APPROVED)('%s is an animation the approved artboard really has', (name) => {
    expect(artboard).toContain(`@keyframes ${name}`);
  });
});

describe('prefers-reduced-motion turns all of them off', () => {
  const block = reducedMotionBlock(globals);

  it('the sheet has a prefers-reduced-motion block at all', () => {
    expect(block, 'src/styles/globals.css declares no @media (prefers-reduced-motion: reduce)').not.toBeNull();
  });

  it('it covers the UNIVERSAL selector, so a tenth animation is covered on the day it is written', () => {
    // `*` plus the two pseudo-elements: an animation on ::before is still an animation.
    expect(block).toMatch(/(^|[\s,{])\*\s*,/);
    expect(block).toContain('*::before');
    expect(block).toContain('*::after');
  });

  it('it neutralises animation AND transition, and does so with !important', () => {
    expect(block).toMatch(/animation-duration:\s*[^;]*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).toMatch(/transition-duration:\s*[^;]*!important/);
  });

  it('no keyframe escapes it: there is no second, narrower opt-out that could shadow the blanket', () => {
    const blocks = globals.match(/@media \(prefers-reduced-motion/g) ?? [];
    expect(blocks.length, 'more than one reduced-motion block is how one of them starts lying').toBe(1);
  });
});
