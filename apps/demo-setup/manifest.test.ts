// What the manifest PROMISES, held here — because the app that draws the shop's name is the one whose
// declaration nobody looks at twice.
//
// ⚠️ THE MONOREPO'S GUARDS CANNOT SEE THIS APP. `scripts/i18n/manifest-copy.guard.test.ts` enumerates the
// monorepo's own `extensions/` directory, so an app living in a customer's repository is invisible to it —
// the same measured reason `apps/payment-pos/manifest.test.ts` duplicates its half of the rule here.

import { describe, expect, it } from 'vitest';
import { manifest } from './manifest';
import pkg from './package.json' with { type: 'json' };

const blocks = manifest.contact?.blocks ?? [];

/** The MARKS, and the slot each one is meant for. ⛔ `demo_ribbon` is deliberately NOT here: it is not a mark
 *  and it names no `area`, which is the whole difference between the two kinds of block this app declares. */
const SLOT_OF = {
  header_brand: 'storefront:header.brand',
  drawer_brand: 'storefront:header.drawer_brand',
  footer_brand: 'storefront:footer.brand',
} as const;

const MARKS = Object.keys(SLOT_OF);
const marks = blocks.filter((b) => MARKS.includes(b.component));

/** The demonstration notice — one block, and the rules that hold for it are the opposite of the marks'. */
const RIBBON = 'demo_ribbon';

// ⛔ THE FOURTH MARK LEFT IN pk28 AND THE SLOT DID NOT. `storefront:account.brand` — the login box — is drawn
// by the CHECKOUT, which we host and nobody forks, so a mark there must be configurable without a fork: it is
// the PRODUCT's job now (the OOTB `chrome` app), never an instance app's. The vitrine is the opposite, which
// is why these three stayed: these three are the STOREFRONT's, and the login box is the CHECKOUT's.
const GONE_TO_THE_PRODUCT = 'account_brand';

describe('demo-setup manifest', () => {
  it('is an app of ONE instance — the declaration the oven and the fleet both read', () => {
    // `forge.origin` is what `bin/build-local.sh:114` checks before it copies this directory into the image,
    // and what makes a fleet list naming this app illegal (`not-carried`). It is the whole of "ours".
    expect((pkg as { forge?: { origin?: string } }).forge?.origin).toBe('instance');
    expect(manifest.id).toBe('demo-setup');
    expect(manifest.kind).toBe('app');
  });

  it('★★ declares THREE marks — one per place the VITRINE shows one, never one placed three times', () => {
    // ⛔ THE RULE THE PREVIOUS DESIGN BROKE, and it is the kernel's: `placement: 'single'` is enforced per
    // (store, app, component), so one component in two slots is refused with `conflict`. A component per
    // place is what lets a store put its mark in each of them at all — and what makes the board say which.
    expect(marks.map((b) => b.component).sort()).toEqual(MARKS.slice().sort());
    expect(new Set(blocks.map((b) => b.component)).size).toBe(blocks.length);
    for (const block of marks) {
      expect(block.placement).toBe('single');
    }
    // …and every block of this app, mark or not, renders on the storefront surface. `admin` is the only
    // other value the contract offers, and this app draws nothing in the operator's face.
    for (const block of blocks) expect(block.surface).toBe('storefront');
  });

  it('★★★ the demo NOTICE is a BLOCK — never a gate, which is what filling `storefront:gate` would be', () => {
    // ⛔ THE MEASUREMENT THIS SLICE WAS BORN FROM. An app INSTALLED on `storefront:gate` takes the whole
    // store off the cacheable tree — the product asks at the edge of every store route whether an installed
    // app fills it — so the deployed box answered `private, no-cache, no-store` on every route and served a
    // robot the interstitial, with no `<title>`, at every URL. This block costs none of that: it renders
    // where it was dropped, and a store with nothing placed renders exactly what it rendered before.
    // ⇒ SABOTAGE: give this app a hook on that target and `bin/no-gate.guard.mjs` names it.
    const ribbon = blocks.find((b) => b.component === RIBBON);
    expect(ribbon, 'the app declares no demo notice at all').toBeTruthy();
    for (const hook of manifest.contact?.hooks ?? []) expect(hook.target).not.toBe('storefront:gate');
  });

  it('★★ the notice names NO `area` and is `repeatable` — the two ways it is not a mark', () => {
    const ribbon = blocks.find((b) => b.component === RIBBON);
    // An absent `area` is the contract's own way of saying «no page constraint»: the notice belongs wherever
    // a store is looked at, and WHICH slot that is gets decided in Compose, not here.
    expect(ribbon?.area).toBeUndefined();
    // It cedes no node — it stands beside whatever is in the slot — and the box needs it in more than one
    // place per store, because the shop's chrome and the funnel's chrome are two different pairs of slots.
    expect(ribbon?.placement).toBe('repeatable');
    // ⛔ And it takes no config: a sentence an operator can edit is a sentence an operator can EMPTY, and an
    // emptied honesty notice looks exactly like a shop that never had one.
    expect(ribbon?.config_schema).toBeUndefined();
  });

  it("★★ every block's `area` is the PREFIX of the slot it is meant for — the kernel validates by prefix", () => {
    // The kernel never learns a theme's slot set (trava 7): it checks the surface prefix and, when the block
    // declares one, the page prefix. An `area` that disagrees with the slot the seed places into is a
    // placement refused at birth — which is a red nobody sees until a box is being born.
    for (const block of marks) {
      const slot = SLOT_OF[block.component as keyof typeof SLOT_OF];
      expect(slot, `block ${block.component} is not one this test knows a slot for`).toBeTruthy();
      expect(block.area).toBe(slot.slice('storefront:'.length).split('.')[0]);
    }
  });

  it('★★ the login box is NOT this app’s — the deployable decides, and the checkout is the one nobody forks', () => {
    // ⇒ SABOTAGE: put `account_brand` back and this names it in all three places it would have to be declared.
    //   The block is not a duplicate to be tidied away: it is a capability that moved to the product, and an
    //   instance app that kept a copy would fight the OOTB `chrome` block for the same slot. Both would live
    //   there — the kernel's `assertSingleFree` is keyed on (store, app, COMPONENT) and never on the slot
    //   (packages/core/src/commands/composition.ts:185), so nothing would refuse the pair.
    expect(blocks.map((b) => b.component)).not.toContain(GONE_TO_THE_PRODUCT);
    const wiring = (pkg as { forge: { wiring: { blocks: Record<string, unknown> } } }).forge.wiring
      .blocks;
    expect(Object.keys(wiring)).not.toContain(GONE_TO_THE_PRODUCT);
    for (const locale of ['en', 'pt-BR', 'es'] as const) {
      expect(
        manifest.i18n?.[locale]?.[`block.${GONE_TO_THE_PRODUCT}.label`],
        `${locale} still names a block this app does not declare`,
      ).toBeUndefined();
    }
    // …and no block of this app claims the checkout's page. `area` confines by PREFIX, so an `account` area
    // here would be this app asking for a slot on the screen it just gave up.
    expect(blocks.map((b) => b.area)).not.toContain('account');
  });

  it('⛔ declares NO manifest-default hook — installing must not strip every store of its mark', () => {
    // A hook is materialised as a real placement in EVERY store at install (`seedDefaultPlacements`), and
    // these blocks REPLACE the front's own wordmark while drawing nothing when unconfigured. So a default
    // hook would take the mark off every store of the tenant — the counter included — the moment somebody
    // installed the app. Placement here is per store, and the seed is what makes it.
    expect(manifest.contact?.hooks ?? []).toEqual([]);
  });

  it('⛔ asks for NO scope: it renders config, it drives no command', () => {
    expect(manifest.scopes).toEqual([]);
  });

  it('★ the TAGLINE is on the footer block and on NO other — the asymmetry is the point', () => {
    // Only `footer.brand`'s fallback cedes a sentence along with the mark, so only that block has to be able
    // to say one. A tagline offered on the header would be a field that renders nowhere.
    for (const block of marks) {
      const fields = (block.config_schema ?? []).map((f) => f.name);
      expect(fields).toEqual(
        block.component === 'footer_brand'
          ? ['logo', 'text', 'tail', 'tagline']
          : ['logo', 'text', 'tail'],
      );
    }
  });

  it('★ the logo is a `type:id` ref — which is what buys the asset picker for zero lines of admin', () => {
    for (const block of marks) {
      const logo = (block.config_schema ?? []).find((f) => f.name === 'logo');
      expect(logo?.type).toBe('id');
      // Every field is optional: a freshly dropped block is a legal state, and a required field would make
      // the drop itself refusable — the wrong moment to argue with an operator.
      for (const field of block.config_schema ?? []) expect(field.optional).toBe(true);
    }
  });

  it('★★ every operator-facing word is translated in all three locales, and `en` IS the literal', () => {
    const keys = [
      ...blocks.map((b) => `block.${b.component}.label`),
      ...['logo', 'text', 'tail', 'tagline'].flatMap((f) => [`compose.${f}`, `compose.${f}.hint`]),
    ];
    for (const locale of ['en', 'pt-BR', 'es'] as const) {
      const bag = manifest.i18n?.[locale];
      expect(bag, `no ${locale} catalogue`).toBeTruthy();
      expect(bag?.name, `${locale}.name`).toBeTruthy();
      expect(bag?.description, `${locale}.description`).toBeTruthy();
      for (const key of keys) expect(bag?.[key], `${locale} is missing ${key}`).toBeTruthy();
    }
    // The `en` entry is the source language AND the fallback, so an `en` that disagrees with the literal
    // above makes the fallback a lie.
    expect(manifest.i18n?.en?.name).toBe(manifest.name);
    expect(manifest.i18n?.en?.description).toBe(manifest.description);
  });

  it('★★ the wiring names an export for each block, and the package EXPORTS the module it names', () => {
    // The composition solders these bindings by reading `forge.wiring` against `exports`; a module the
    // package does not export is a build that fails at compose time, and an export the module does not have
    // is a block that renders nothing. Both halves are declared in this one file, so both are graded here.
    const wiring = (pkg as { forge: { wiring: { blocks: Record<string, { module: string; export: string; props: string[]; surface: string }> } } }).forge.wiring.blocks;
    const exports = (pkg as { exports: Record<string, string> }).exports;
    // The two halves are DERIVED from each other rather than typed twice: every block the manifest declares
    // is wired, and every wired component is declared. A wiring entry for a block nobody declares is a
    // component the composition would solder and the kernel would never place.
    expect(Object.keys(wiring).sort()).toEqual(blocks.map((b) => b.component).sort());
    for (const [component, entry] of Object.entries(wiring)) {
      expect(entry.surface).toBe('storefront');
      expect(exports[entry.module], `${component} points at ${entry.module}, which is not exported`).toBeTruthy();
      // ⚠️ `storeHref` IS NOT OPTIONAL FOR A MARK. Without it the mark's anchor is a bare `/`, which walks a
      // shopper straight out of the store they are in under `/s/<id>`. ⛔ And the notice asks for NEITHER of
      // the mark's props: it renders no config and its one link deliberately LEAVES the store, so a
      // `storeHref` there would be a function with nothing to apply to. What it asks for is `locale`, which
      // is what picks between the three languages its copy ships in.
      expect(entry.props).toEqual(component === RIBBON ? ['locale'] : ['config', 'storeHref']);
    }
  });
});
