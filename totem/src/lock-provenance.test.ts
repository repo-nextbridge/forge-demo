// THE PROVENANCE GUARD — the totem IS in `forge.lock`, by digest, and this is the test that keeps it there.
//
// ★★ v032/C — THE DECISION TURNED, AND THE REASON IT USED TO HOLD IS GONE. Until v0.3.2 this file asserted
// the opposite: the totem was NOT in the lock, because `bin/build-local.sh` rewrote `forge.lock` from a fixed
// four-image template (`jq -n`) and would have deleted a `totem` key in silence — a lock cannot carry a claim
// its own generator discards. That generator is gone. `bin/bake.sh` bakes the six images of this box in one
// gesture (in its CI, `.github/workflows/bake.yml`) and writes all six into the lock (spec v032, decision 7),
// so the claim now has a writer, and a fork that travels by tag is the defect `bin/deploy.sh` measured on
// 2026-09-18: an 18-hour-old front, served in silence, because a tag existed on the far side.
//
// ⚠️ WHAT THIS HOLDS: the lock pins the six — the four the recipe bakes and the two this repository owns —
// each by DIGEST, and `compose.override.yml` starts the totem from the lock and from nothing else.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = join(__dirname, '../..');
const lock = JSON.parse(readFileSync(join(repo, 'forge.lock'), 'utf8')) as {
  images: Record<string, string | { ref: string }>;
};
const override = readFileSync(join(repo, 'compose.override.yml'), 'utf8');

const refOf = (entry: string | { ref: string }) => (typeof entry === 'string' ? entry : entry.ref);

/** The four the recipe bakes with this box's list, and the two forks this repository owns. */
const SIX = ['kernel', 'storefront', 'checkout', 'admin', 'storefront-coffee', 'totem'];

describe('forge.lock pins every image this box runs', () => {
  it('carries exactly the six', () => {
    expect(Object.keys(lock.images).sort()).toEqual([...SIX].sort());
  });

  it('pins the totem — see this file’s header for why that turned', () => {
    expect(Object.keys(lock.images)).toContain('totem');
  });

  it('every pin is a DIGEST, never a tag', () => {
    for (const [name, entry] of Object.entries(lock.images)) {
      expect(refOf(entry), `${name} is pinned by tag; a tag is a label its owner can repoint`).toContain('@sha256:');
    }
  });
});

describe('the compose file starts the totem from the lock', () => {
  it('reads its image from FORGE_TOTEM_IMAGE, which bin/images-from-lock.sh exports from the lock', () => {
    expect(override).toMatch(/image: \$\{FORGE_TOTEM_IMAGE:\?/);
  });

  it('and no longer names a `:local` tag a deploy could find stale on the far side', () => {
    expect(override).not.toContain('forge-demo-totem:local');
  });
});
