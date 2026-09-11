// ★★ THE TWO MARKS A PROBE OUTSIDE THE BROWSER CAN SEE — and why a gate needs them at all.
//
// Until pk33 NOTHING anywhere verified that the gate APPEARS. `bin/prove-doors.mjs` opened every door of every
// store and graded the status code and the container that answered; both are identical whether the visitor
// meets the "Loja demo." screen or walks straight into the shop, because the gate answers 200 and so does the
// shop. That silence is measured, not hypothetical: the app sat UNINSTALLED on this box for days and the
// birth stayed green through all of them.
//
// ⛔ AND THE CLASS NAMES ARE NOT A MARK. The screen is styled with CSS Modules, so what reaches the HTML is
// `gate_title__oz7GS` — a hash of the build. Measured on https://demo.forgecommerce.pro on 2026-09-11: the
// live gate's only stable-looking handle was exactly that, and a probe pinned to it goes red on the next
// bundle for no reason a reader could ever guess.
//
// ★ SO THE MARK IS THE APP'S OWN ID, IN A `data-testid`, AND NOTHING IN THE MIDDLE TYPES IT. The probe asks
// the port WHICH extension fills `storefront:gate` for a store and builds the attribute it looks for from the
// id the port answered (`bin/prove-doors.mjs`); this file is the other end; and `marks.test.ts` asserts these
// two constants against `manifest.id`, so an app that is renamed renames its marks or goes red.
//
// The shape is borrowed, not invented: the product already grades bodies this way — `data-testid="busy-boundary"`
// vs `data-testid="error-boundary"` (the two refusal screens), `data-testid="composition-gap"` (the visible
// refusal of a structural slot this build cannot draw). A reader who knows one knows all of them.

/** The full-screen interstitial: the visitor has NOT been through the gate. */
export const GATE_MARK = 'demo-gate';

/** The persistent ribbon at the foot of a page: the visitor HAS been through the gate and is browsing. */
export const GATE_RIBBON_MARK = 'demo-gate-ribbon';
