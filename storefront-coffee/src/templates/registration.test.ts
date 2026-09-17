// ★ Registration guard: TEMPLATE_MANIFESTS (templates/registry.ts) is a MANUAL import list, not filesystem
// discovery. A template/subtemplate whose `*.manifest.ts` exists but is NOT listed there is invisible to
// slotRegistry() → `/api/slots` → the admin Compose editor, so its slots can never be composed. This guard
// eagerly loads every manifest module in the app and fails the build if any declared manifest is unregistered
// — the "subtemplates must register their slots to appear" invariant, enforced instead of remembered.
//
// Its sibling `registration.guard.test.ts` holds the other half of GEN-SLOTS — the one that reads the
// generated `docs/reference/slots.md`. That file exists in the Forge repository and nowhere else, so the
// assertion is about THIS repo rather than about any storefront, and only this file travels to a customer's
// copy (FRONT-OWN).

import type { TemplateManifest } from '@forgeco/storefront-kit/slots/registry';
import * as kitSubtemplates from '@forgeco/storefront-kit/subtemplates';
import { expect, test } from 'vitest';
import { TEMPLATE_MANIFESTS } from '@/templates/registry';

// `import.meta.glob` is a Vite/vitest compile-time macro (not in the Next app's tsconfig lib): it must be
// called DIRECTLY to be transformed, so we augment the type instead of aliasing it.
declare global {
  interface ImportMeta {
    glob: (pattern: string, opts: { eager: true }) => Record<string, Record<string, unknown>>;
  }
}

// Every manifest module this app can reach, as pure data.
//
// ★ CHECKOUT-APP (K1) — TWO SOURCES, AND THE SECOND IS NOT A GLOB ON PURPOSE. This app's own manifests
// (templates + the minicart composition) are DISCOVERED by the glob. The header/footer manifests moved to
// `@forgeco/storefront-kit` with the chrome, and a glob for them would have to spell a path across a
// package boundary — `../../../../packages/…`, true in this monorepo and false in the packed copy this very
// file travels to, where it would resolve to nothing and leave the count silently short. The kit's own barrel
// is asked instead, and the kit polices ITS half (`subtemplates/registration.test.ts` there asserts every
// manifest under its tree is re-exported by that barrel). Two halves, one guarantee, neither vacuous.
const modules = {
  ...import.meta.glob('../**/*.manifest.ts', { eager: true }),
  '@forgeco/storefront-kit/subtemplates': kitSubtemplates as Record<string, unknown>,
};

function isManifest(v: unknown): v is TemplateManifest {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.template === 'string' && Array.isArray(o.slots);
}

test('every declared template/subtemplate manifest is registered in TEMPLATE_MANIFESTS', () => {
  const registered = new Set(TEMPLATE_MANIFESTS.map((m) => m.template));
  const found = new Set<string>();
  for (const [path, mod] of Object.entries(modules)) {
    for (const value of Object.values(mod)) {
      if (!isManifest(value)) continue;
      found.add(value.template);
      expect(
        registered.has(value.template),
        `manifest "${value.template}" (${path}) is not in TEMPLATE_MANIFESTS — its slots won't reach Compose`,
      ).toBe(true);
    }
  }
  // Guard against a vacuous pass: the glob must actually match the shipped manifests.
  expect(found.size).toBe(registered.size);
});
