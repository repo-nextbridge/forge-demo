// THE STRUCTURAL RULE OF ANY FRONT: it speaks HTTP to the port and never links the kernel's types.
//
// The coffee vitrine carries the same guard (`storefront-coffee/src/structure.test.ts`) and it is not
// ceremony: `@forgecommerce/contracts` is the KERNEL's compile-time vocabulary. A front that imports it stops
// being a consumer of a public port and becomes a second copy of the kernel's assumptions — and the day the
// two versions differ, the failure is a type error in somebody else's repository.
//
// `@forge/core` is the same rule one step harder: that package is the kernel.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(__dirname);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const FORBIDDEN = ['@forge/core', '@forgecommerce/contracts', '@forge/db'];

describe('the totem is a consumer of the port, not a layer of the kernel', () => {
  const files = sources(src);

  it('finds sources to check at all (a guard over an empty set proves nothing)', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(FORBIDDEN)('imports %s nowhere', (pkg) => {
    const offenders = files.filter((f) => {
      const body = readFileSync(f, 'utf8');
      // The guard's own mention of the names must not trip it.
      if (f.endsWith('structure.test.ts')) return false;
      return new RegExp(`from ['"]${pkg.replace('/', '\\/')}`).test(body);
    });
    expect(offenders).toEqual([]);
  });
});
