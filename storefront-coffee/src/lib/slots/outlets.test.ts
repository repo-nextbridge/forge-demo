// S6-COMPOSE-FIX — the structural guard: A DECLARED SLOT MUST BE RENDERABLE.
//
// The merchant dragged a Product Shelf into a footer slot, gave it a category, and nothing ever appeared on the
// store. The slot was real — declared in the footer's manifest, published by GET /api/slots, offered by Compose
// as a drop target — but no <ExtensionOutlet> ever mounted it. Five slots were in that state
// (footer.start/end, header.start/end, list.above_shelf): the board promised something the theme could not keep.
//
// So the theme's two halves are now held together by a test. Declaring a slot is a PROMISE to the merchant that
// a block placed there renders; this proves the promise is kept for every slot, and fails the build the day
// someone adds a slot to a manifest (or deletes an outlet) and forgets the other half. It reads the SOURCE
// rather than rendering, because the outlets live in async Server Components spread across layouts and pages —
// the fact we are asserting is "an outlet for this slot is mounted SOMEWHERE in the theme", which is exactly
// what the source says. Sibling of the registry guard (templates/registry.test.ts).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { slotRegistry } from '@/templates/registry';
import { KIT_SRC } from '@/test/kit-source';

const SRC = join(import.meta.dirname, '../..');
// ★★ CHECKOUT-APP (K1) — THE PROMISE IS KEPT ACROSS TWO TREES NOW. Every `header.*`, `footer.*` and
// `minicart.*` outlet moved with the chrome into `@forgeco/storefront-kit`, while the manifests that
// DECLARE those slots moved with it too. A sweep of this app alone would have found the declarations (through
// `slotRegistry()`, which imports them) and none of the outlets — the guard would have gone red for the wrong
// reason, and the day someone "fixed" that by narrowing the corpus it would have gone quiet for the right one.
const TREES = [SRC, KIT_SRC];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** ★ Strip comments before matching — THE VACUOUS-GUARD PATTERN, found four times in one day.
 *
 * Every instance had the same shape: a guard that matches against the TEXT of a file, and the text includes the
 * COMMENT describing the very thing the guard is looking for. Here each renderer's header opens with
 * `// <PaymentOptionsSlot> — …`, which satisfied "is this component mounted?" while nothing mounted it. Measured,
 * not deduced: renaming the mount in PaymentStep left this test green.
 *
 * A guard held up by a sentence about the code is decoration — and this one is the only thing that can prove the
 * two payment ROLES are actually rendered, which is exactly what the zero-order app needs it for. */
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const scanned = TREES.flatMap((tree) => sourceFiles(tree));
const source = scanned.map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n');

// A slot is normally rendered by a generic <ExtensionOutlet name="…">. A few slots have a SPECIALIZED
// renderer instead (same promise — a placed block renders — via a dedicated component the outlet can't
// model). `checkout.payment` is one: the PaymentOptionsSlot renders the payment app that fills the `options`
// ROLE there, in the order the operator arranged (see lib/payment-blocks/). Its twin, `checkout.confirmation`,
// carries BOTH a generic outlet (any block a merchant drops there) and the AfterPaymentSlot for the payment
// role — so it satisfies the guard through the outlet, and the specialized renderer is listed for honesty.
// Such slots keep the "declared ⇒ renderable" invariant through their own component; the guard recognises them
// so it stays HONEST (not weakened): each still requires a real, mounted renderer in the source.
const SPECIALIZED_RENDERERS: Record<string, RegExp> = {
  'checkout.payment': /<PaymentOptionsSlot[\s/>]/,
  'checkout.confirmation': /<AfterPaymentSlot[\s/>]/,
};

test('every declared slot has an ExtensionOutlet mounted for it (a slot Compose offers must render)', () => {
  const declared = [...slotRegistry().keys()];
  expect(declared.length).toBeGreaterThan(0);

  const unrenderable = declared.filter((name) => {
    // `<ExtensionOutlet` and its `name` may be split across lines by the formatter.
    if (new RegExp(`<ExtensionOutlet\\s+name="${name.replace('.', '\\.')}"`).test(source))
      return false;
    return !SPECIALIZED_RENDERERS[name]?.test(source);
  });
  expect(
    unrenderable,
    `these slots are declared (so Compose offers them as drop targets) but no <ExtensionOutlet> mounts them — ` +
      `a block placed there would silently never render: ${unrenderable.join(', ')}`,
  ).toEqual([]);
});
