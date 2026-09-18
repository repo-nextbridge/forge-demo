// THE DEMONSTRATION RIBBON, UNDER THE WHOLE COUNTER — the counter is as honest as every other face of this
// box about what it is.
//
// ★★ IT IS MOUNTED HERE BECAUSE THIS APP OWNS ITS LAYOUT, and that is the one thing about it that has not
// changed. The counter is not a cut of a Forge surface: it has no slot registry, no `ExtensionOutlet` and no
// Compose board, so a block that reaches the two vitrines by being DROPPED somewhere reaches this host only
// by being written in. What stood here before was the same shape around a different thing — a gate, resolved
// from the port and wrapped around the flow.
//
// ⛔⛔ AND THE GATE IS WHAT LEFT, WITH EVERYTHING THAT ASKED THE PORT ABOUT IT. `lib/gate/mount.ts` used to
// ask `read.extensions` which app filled `storefront:gate` for this store, and `lib/gate/registry.tsx` held
// the hand-written map from that answer to a component. Both are gone, because the thing they resolved is
// gone: filling that slot is what put every store of this box on the dynamic tree, and the sentence a visitor
// is owed never needed a front door to carry it. What is left is one import and one component.
//
// ★ SO THE COUNTER'S RIBBON IS NOT A PLACEMENT AND NOBODY CAN DRAG IT. On the two vitrines this same block is
// an operator's gesture in Compose; here it is a line of this app's layout, which is the honest difference
// between a front with slots and a front without them — and the same asymmetry `seed/demo-setup.json` already
// writes for the counter's marks, where the store is declared `null` rather than silently skipped.
//
// ⚠️ THE LANGUAGE IS DECLARED, NOT GUESSED. The counter's `<html lang>` is `pt-BR` and there is no visitor to
// negotiate with — the shopper is standing at a till in a café — so the locale is handed over as the literal
// the layout already states, rather than read from a header that does not exist on a kiosk.

import { DemoRibbon } from '@forge/ext-demo-setup/block/ribbon';
import type { ReactNode } from 'react';

/** The language this counter's screen is drawn in — the same literal `app/layout.tsx` puts on `<html lang>`. */
export const COUNTER_LOCALE = 'pt-BR';

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DemoRibbon locale={COUNTER_LOCALE} />
    </>
  );
}
