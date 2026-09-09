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
const SLOT_OF = {
  header_brand: 'storefront:header.brand',
  drawer_brand: 'storefront:header.drawer_brand',
  footer_brand: 'storefront:footer.brand',
} as const;

// ⛔ THE FOURTH MARK LEFT IN pk28 AND THE SLOT DID NOT. `storefront:account.brand` — the login box — is drawn
// by the CHECKOUT, which we host and nobody forks, so a mark there must be configurable without a fork: it is
// the PRODUCT's job now (the OOTB `chrome` app), never an instance app's. The vitrine is the opposite, which
// is why these three stayed. The owner, 09/09: «essas 3 são do storefront e a caixa de login é do checkout».
const GONE_TO_THE_PRODUCT = 'account_brand';

describe('demo-setup manifest', () => {
  it('is an app of ONE instance — the declaration the oven and the fleet both read', () => {
    // `forge.origin` is what `bin/build-local.sh:114` checks before it copies this directory into the image,
    // and what makes a fleet list naming this app illegal (`not-carried`). It is the whole of "ours".
    expect((pkg as { forge?: { origin?: string } }).forge?.origin).toBe('instance');
    expect(manifest.id).toBe('demo-setup');
    expect(manifest.kind).toBe('app');
  });

  it('★★ declares THREE blocks — one per place the VITRINE shows a mark, never one placed three times', () => {
    // ⛔ THE RULE THE PREVIOUS DESIGN BROKE, and it is the kernel's: `placement: 'single'` is enforced per
    // (store, app, component), so one component in two slots is refused with `conflict`. A component per
    // place is what lets a store put its mark in each of them at all — and what makes the board say which.
    expect(blocks.map((b) => b.component).sort()).toEqual(Object.keys(SLOT_OF).sort());
    expect(new Set(blocks.map((b) => b.component)).size).toBe(3);
    for (const block of blocks) {
      expect(block.placement).toBe('single');
      expect(block.surface).toBe('storefront');
    }
  });

  it("★★ every block's `area` is the PREFIX of the slot it is meant for — the kernel validates by prefix", () => {
    // The kernel never learns a theme's slot set (trava 7): it checks the surface prefix and, when the block
    // declares one, the page prefix. An `area` that disagrees with the slot the seed places into is a
    // placement refused at birth — which is a red nobody sees until a box is being born.
    for (const block of blocks) {
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
    for (const block of blocks) {
      const fields = (block.config_schema ?? []).map((f) => f.name);
      expect(fields).toEqual(
        block.component === 'footer_brand'
          ? ['logo', 'text', 'tail', 'tagline']
          : ['logo', 'text', 'tail'],
      );
    }
  });

  it('★ the logo is a `type:id` ref — which is what buys the asset picker for zero lines of admin', () => {
    for (const block of blocks) {
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
    expect(Object.keys(wiring).sort()).toEqual(Object.keys(SLOT_OF).sort());
    for (const [component, entry] of Object.entries(wiring)) {
      expect(entry.surface).toBe('storefront');
      expect(exports[entry.module], `${component} points at ${entry.module}, which is not exported`).toBeTruthy();
      // ⚠️ `storeHref` IS NOT OPTIONAL. Without it the mark's anchor is a bare `/`, which walks a shopper
      // straight out of the store they are in under `/s/<id>`.
      expect(entry.props).toEqual(['config', 'storeHref']);
    }
  });
});
