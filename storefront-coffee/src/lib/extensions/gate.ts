// ★★ HOW THIS FORK RESOLVES THE GATE SLOT — composed first, welded second.
//
// ⛔ WHY IT EXISTS AT ALL, AND IT IS A TWO-WEEK STORY. `src/app/s/[store]/layout.tsx` used to import
// `resolveGate` straight from `@forgeco/storefront-kit/gate/registry`, whose map is `{}` BY DESIGN and
// stays `{}` — the kit cannot name one instance's apps. So the café resolved every gate to `undefined`, and
// since pk32 `storefront:gate` is a STRUCTURAL target: a slot a front cannot draw makes it REFUSE the page.
// That is why `seed/box.json` carried `gate: false` for this store — not an oversight, a declaration that
// stopped the café from serving «Esta loja está temporariamente indisponível» on every route.
//
// ★ WHAT CHANGED (pk35): the fork learned to regenerate its own surfaces (pk35/d3 gave it a
// `composition.json`, the `codegen` script and a real dependency on the tool), and pk35/p6 knocked down the
// three product-side walls that stopped the generator from running against a cut at all — the worst of them a
// missing shebang, which made `/bin/sh` run the ESM `import {` as ImageMagick's `import` and HANG on the X
// display instead of failing. With those gone, `npm run codegen` writes `generated/gate-registry.tsx` from
// this fork's own list, and this module is the half that reads it.
//
// The order mirrors the reference (apps/storefront/src/lib/extensions/gate.ts): COMPOSED wins, because an app
// this instance composes is this instance's answer; the welded map is the fallback for anything a front
// hard-wires for itself.
import {
  type GateImplementation,
  resolveGate as resolveWeldedGate,
} from '@forgeco/storefront-kit/gate/registry';

import { resolveComposedGate } from './generated/gate-registry';

export type { GateImplementation };

export function resolveGate(extensionId: string): GateImplementation | undefined {
  return resolveComposedGate(extensionId) ?? resolveWeldedGate(extensionId);
}
