// ★★ THE MARKS ARE THE APP'S OWN ID, AND THEY REACH THE DOM — both halves, because either alone is a lie.
//
// `bin/prove-doors.mjs` does not carry either of these strings: it asks the port which extension fills
// `storefront:gate` for a store and builds `data-testid="<that id>"` from the answer. So the two ends agree
// only as long as the id in the markup IS the manifest's. Renaming the app without renaming the mark makes the
// birth's door step blind in exactly the way it was blind before pk33 — green while the gate is missing — and
// this file is what makes that rename red here instead.
//
// ⚠️ AND THE CONSTANT AGREEING WITH THE MANIFEST PROVES NOTHING ON ITS OWN. The probe reads HTML, not this
// module, so what has to be true is that the attribute is on an element that the server renders. Both
// components are therefore rendered below and the DOM is asked, exactly as the probe asks the body.

import { render } from '@testing-library/react';
import { beforeAll, expect, test, vi } from 'vitest';
import { manifest } from '../manifest';
import { GateBlock } from './gate';
import { GATE_MARK, GATE_RIBBON_MARK } from './marks';
import { GateRibbon } from './ribbon';

const noop = async () => {};

// jsdom ships no IntersectionObserver and the ribbon arms its reveal with one on mount. Stubbed rather than
// avoided: what this file grades is the ATTRIBUTE in the markup, and the server renders the ribbon VISIBLE
// (the observer is progressive enhancement — see `./ribbon`), so the reveal is beside the point here.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  );
});

test('the interstitial mark IS the extension id the kernel knows this app by', () => {
  expect(GATE_MARK).toBe(manifest.id);
});

test('the ribbon mark is that id plus `-ribbon`, which is what the probe derives', () => {
  expect(GATE_RIBBON_MARK).toBe(`${manifest.id}-ribbon`);
});

test('★ the two marks are DIFFERENT — one mark cannot grade two opposite states', () => {
  // A probe reads one body and has to answer "gate" or "store". Were these equal, the side that must NOT show
  // the gate and the side that must would both match, and the whole two-sided proof would be a tautology.
  expect(GATE_MARK).not.toBe(GATE_RIBBON_MARK);
});

test('the interstitial RENDERS its mark — the attribute a probe reads off the wire', () => {
  const { container } = render(
    <GateBlock siteUrl="https://x" adminUrl="https://a" initialLang="pt" dismiss={noop} />,
  );
  expect(container.querySelector(`[data-testid="${GATE_MARK}"]`)).toBeTruthy();
  // …and it does NOT carry the other state's mark, which is what lets one body answer one question.
  expect(container.querySelector(`[data-testid="${GATE_RIBBON_MARK}"]`)).toBeNull();
});

test('the ribbon RENDERS its mark, and never the interstitial one', () => {
  const { container } = render(<GateRibbon lang="pt" reopen={noop} />);
  expect(container.querySelector(`[data-testid="${GATE_RIBBON_MARK}"]`)).toBeTruthy();
  expect(container.querySelector(`[data-testid="${GATE_MARK}"]`)).toBeNull();
});
