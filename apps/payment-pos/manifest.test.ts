// What the manifest DECLARES, held to it — plus the copy rule this repository has to enforce for itself.
//
// ★★ WHY THE i18n CHECK IS COPIED HERE INSTEAD OF INHERITED. The monorepo owns this rule
// (`scripts/i18n/manifest-copy.guard.test.ts`: every operator-facing field must exist in every locale, and the
// `en` entry must EQUAL the literal in the manifest, because the literal is the source language and the
// fallback). Measured: that guard walks `readdirSync(EXTENSIONS)` — the monorepo's OWN `extensions/` directory
// — so it never sees an app that lives in a customer's repository. This app only appears under `extensions/`
// inside a `docker build`, where no test runs. So nothing upstream checks this app's copy, and a rule nobody
// checks is a rule that decays. The enumeration below is small and local on purpose: it is not a fork of the
// house guard, it is this app holding itself to the same sentence.

import { describe, expect, test } from 'vitest';
import { manifest } from './manifest';

const LOCALES = ['en', 'pt-BR', 'es'] as const;

/** Every operator-facing string this manifest declares, with the key it must resolve under. Mirrors
 * `operatorCopy()` in /contracts for the field kinds this app actually uses (name, description, block labels,
 * config field labels). An app that later declares an action or a data model has to extend this. */
function operatorFacing(): { key: string; literal: string }[] {
  return [
    { key: 'name', literal: manifest.name },
    { key: 'description', literal: manifest.description ?? '' },
    ...(manifest.contact.blocks ?? []).map((b) => ({
      key: `block.${b.component}.label`,
      literal: b.label ?? '',
    })),
    ...(manifest.config?.fields ?? []).map((f) => ({
      key: `config.${f.name}.label`,
      literal: f.label ?? '',
    })),
  ].filter((entry) => entry.literal !== '');
}

describe('the two methods, and the opposite settlements they promise', () => {
  test('★ it declares the KERNEL’s neutral methods, never its own names', () => {
    // `paymentMethods` in /contracts is a CLOSED enum and this schema validates against it: `pos_pix` would
    // throw at parse, so the app would not load at all. `pos_pix`/`pos_card` stay this app's OWN words for
    // its two behaviours (the ref prefixes, the next_action type) and are never spoken to the kernel.
    expect(manifest.paymentProvider?.methods).toEqual(['pix', 'card']);
  });

  test('★ every method holds stock in MINUTES, never days', () => {
    // The mirror of the promissory app's thirty days, and the reason both apps exist separately: a counter's
    // stock is what is ON the counter. A regression to a long window silently freezes a shop's inventory.
    const windows = manifest.paymentProvider?.reservationWindowSeconds ?? {};
    expect(Object.keys(windows).sort()).toEqual(['card', 'pix']);
    for (const [method, seconds] of Object.entries(windows)) {
      expect(seconds, method).toBeGreaterThan(0);
      expect(seconds, method).toBeLessThanOrEqual(60 * 15);
    }
  });

  test('★ it declares NO applicableWhen — a counter charges whatever is on the tray', () => {
    // Absence is the statement here. `payment-zero` declares `{min:0,max:0}` because "nothing to pay" is its
    // reason to exist; bounds on this app would invent an eligibility rule nobody asked for.
    expect(manifest.paymentProvider?.applicableWhen).toBeUndefined();
  });
});

describe('the shape every payment app in this house has', () => {
  test('both roles, under the ids and targets the others use', () => {
    expect((manifest.contact.hooks ?? []).map((h) => [h.component, h.target])).toEqual([
      ['payment-options', 'storefront:checkout.payment'],
      ['after-payment', 'storefront:checkout.confirmation'],
    ]);
  });

  test('PAY-TOGGLES: an `active` master plus one switch per method', () => {
    const fields = (manifest.config?.fields ?? []).map((f) => f.name);
    expect(fields).toEqual(['active', 'pix_enabled', 'card_enabled']);
    for (const method of manifest.paymentProvider?.methods ?? []) {
      expect(fields).toContain(`${method}_enabled`);
    }
  });

  test('★ it asks for NO scope, because it drives no command', () => {
    // Both settlements are the kernel calling the app, never the app calling the kernel: the adapter's neutral
    // `settled` convention and the webhook face. A scope here would be authority nothing uses.
    expect(manifest.scopes).toEqual([]);
  });
});

describe('the copy rule the monorepo’s guard cannot reach this app to enforce', () => {
  test('★ every operator-facing field exists in every locale', () => {
    const catalog = manifest.i18n ?? {};
    for (const locale of LOCALES) {
      const entries = catalog[locale];
      expect(entries, locale).toBeDefined();
      for (const { key } of operatorFacing()) {
        expect(entries?.[key], `${locale} is missing ${key}`).toBeTruthy();
      }
    }
  });

  test('★ the `en` entry EQUALS the literal, or the fallback is a lie', () => {
    const en = manifest.i18n?.en ?? {};
    for (const { key, literal } of operatorFacing()) {
      expect(en[key], `en.${key} must equal the manifest literal`).toBe(literal);
    }
  });

  test('★ no copy string carries an em dash (PK3-TRAVESSAO)', () => {
    // The house banned the character from every word a person reads: it is evidence of a machine having
    // written the sentence. Comments keep it — that is the codebase's own voice — so this walks the COPY only.
    const copy = [
      ...operatorFacing().map((e) => e.literal),
      ...LOCALES.flatMap((l) => Object.values(manifest.i18n?.[l] ?? {})),
    ];
    for (const text of copy) {
      expect(text, text).not.toContain('—');
    }
  });
});
