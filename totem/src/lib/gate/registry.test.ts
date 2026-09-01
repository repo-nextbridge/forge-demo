// ★★ THE GATE ENTRY IS COPIED FROM THE APP'S OWN DECLARATION, AND THIS IS WHAT KEEPS IT COPIED.
//
// The kit's `GATE_REGISTRY` is empty everywhere; what fills it for this box's storefront and checkout is the
// fleet oven, which reads `forge.wiring.gate` out of the app's package.json. The totem does not go through
// that oven, so its entry is written by hand — and a hand-written mirror of somebody else's declaration is
// exactly the thing that goes stale in silence.
//
// ⚠️ THE FAILURE THIS PREVENTS HAS ALREADY HAPPENED ONCE, upstream: before Forge P1 the gate could install,
// fill its slot in the data and render NOTHING AT ALL. A renamed export here would reproduce that symptom on
// the counter's host — a gate that is installed, believed to be working, and invisible.
//
// ⚠️⚠️ IT CHECKS SOURCES, NOT MODULES, AND THAT IS A LIMITATION WORTH STATING. Importing the gate here makes
// vitest's transformer read `apps/demo-gate/tsconfig.json`, which extends `../tsconfig.base.json` — a
// MONOREPO path that does not exist in this repository ("Failed to load tsconfig '../tsconfig.base.json'").
// Next's build has no such trouble, and that is the division of labour: `next build` proves the two imports
// RESOLVE (it fails otherwise), and this proves they are the two the app declares. Neither half is enough
// alone; together they cover the renamed export.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = join(__dirname, '../../../..');
const manifest = JSON.parse(readFileSync(join(repo, 'apps/demo-gate/package.json'), 'utf8')) as {
  name: string;
  forge?: { wiring?: { gate?: Record<string, { module: string; export: string }> } };
};
const registrySource = readFileSync(join(__dirname, 'registry.tsx'), 'utf8');
const gateEntrySource = readFileSync(join(repo, 'apps/demo-gate/block/entry.tsx'), 'utf8');

describe('the registry says what the gate app itself declares', () => {
  const wiring = manifest.forge?.wiring?.gate;
  const interstitial = wiring?.interstitial;
  const ribbon = wiring?.ribbon;

  it('the app really declares a gate wiring (if this goes, the whole mirror is moot)', () => {
    expect(interstitial?.export).toBeTruthy();
    expect(ribbon?.export).toBeTruthy();
    // Both faces come from one module in this app; the registry imports exactly that path.
    expect(interstitial?.module).toBe(ribbon?.module);
  });

  it('★ this build imports the module the app names', () => {
    const subpath = String(interstitial?.module).replace(/^\.\//, '');
    expect(registrySource).toContain(`from '${manifest.name}/${subpath}'`);
  });

  it('★ and renders the two exports the app names', () => {
    expect(registrySource).toContain(`Interstitial: ${interstitial?.export}`);
    expect(registrySource).toContain(`Ribbon: ${ribbon?.export}`);
  });

  it('★ and those exports really exist on the app’s side', () => {
    expect(gateEntrySource).toMatch(new RegExp(`export\\s+(async\\s+)?function\\s+${interstitial?.export}\\b`));
    expect(gateEntrySource).toMatch(new RegExp(`export\\s+(async\\s+)?function\\s+${ribbon?.export}\\b`));
  });

  it('is keyed by the extension_id the KERNEL knows, not by the package name', () => {
    // `read.extensions` answers `extension_id: 'demo-gate'`; the package is `@forge/ext-demo-gate`.
    expect(registrySource).toContain("'demo-gate': {");
    expect(manifest.name).toBe('@forge/ext-demo-gate');
  });
});
