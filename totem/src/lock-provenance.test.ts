// THE PROVENANCE GUARD — the totem is NOT in `forge.lock`, and this is the test that keeps the reason true.
//
// ★★ THE DECISION, AND THE ARGUMENT IS A FACT ABOUT THE FILE RATHER THAN AN ANALOGY.
//
// `forge.lock` pins the four PRODUCT images by digest: artifacts with an upstream, re-stamped from a registry
// the day this box stops being pre-release. The coffee vitrine is not among them and `compose.override.yml`
// says why — it is ours, it has no upstream, and claiming provenance for it would be claiming a lineage it
// does not have. The totem is the same species, so the same answer would already be defensible.
//
// But there is a stronger reason, and it was measured rather than reasoned: `bin/build-local.sh` REWRITES
// `forge.lock` from scratch with `jq -n` from a fixed four-image template. A `totem` key added there by hand
// is therefore deleted, in silence, by the next oven run. A lock cannot carry a claim its own generator
// discards — that is not provenance, it is a comment with an expiry date.
//
// ⚠️ SO THE ANSWER LIVES WHERE IT IS EXECUTED — the tag in `compose.override.yml` — AND THIS TEST IS WHAT
// MAKES THE ABSENCE DELIBERATE INSTEAD OF FORGOTTEN. Put the totem in the lock and it goes red, naming the
// reason. (Approved by the tech lead, 2026-09-01, together with the note that this makes the spec's "forge.lock
// ganha a 6ª imagem" false — the tech lead carries that back to the architect; this repository does not edit
// somebody else's spec.)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = join(__dirname, '../..');
const lock = JSON.parse(readFileSync(join(repo, 'forge.lock'), 'utf8')) as {
  images: Record<string, string>;
};
const override = readFileSync(join(repo, 'compose.override.yml'), 'utf8');

/** The four the product releases, and the four `bin/images-from-lock.sh` demands. */
const PRODUCT_IMAGES = ['kernel', 'storefront', 'checkout', 'admin'];

describe('forge.lock pins the product, and only the product', () => {
  it('carries exactly the four product images', () => {
    expect(Object.keys(lock.images).sort()).toEqual([...PRODUCT_IMAGES].sort());
  });

  it('does not pin the totem — see this file’s header for why that is the decision', () => {
    expect(Object.keys(lock.images)).not.toContain('totem');
  });

  it('does not pin the coffee vitrine either — the same species, the same answer', () => {
    expect(Object.keys(lock.images)).not.toContain('storefront-coffee');
  });

  it('every pin it does carry is a DIGEST, never a tag', () => {
    for (const [name, ref] of Object.entries(lock.images)) {
      expect(ref, `${name} is pinned by tag; a tag is a label its owner can repoint`).toContain('@sha256:');
    }
  });
});

describe('what the lock does not say, the compose file does', () => {
  it('names the totem image by the tag bin/build-totem.sh produces', () => {
    expect(override).toContain('forge-demo-totem:local');
  });

  it('and carries the reason in prose, next to the service', () => {
    // Not a spell-check of the paragraph — a check that the paragraph is there at all. A service with a tag
    // and no explanation is exactly how the next person concludes it was an oversight.
    const totemBlock = override.slice(override.indexOf('forge-demo-totem:local') - 4000);
    expect(totemBlock).toMatch(/forge\.lock/);
  });
});
