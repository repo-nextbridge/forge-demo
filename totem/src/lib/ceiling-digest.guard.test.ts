// ★★★ THE WELD IS PROVEN EQUIVALENT TO THE KIT'S ORIGINAL ON EVERY RUN — and it announces its own expiry.
//
// `lib/ceiling-digest.ts` is a copy of `storefront-kit/src/ceiling-digest.ts`, made because the kit ships that
// file and does not PUBLISH it (the copy's header carries the measurement and the product file:line). A copy of
// somebody else's rule is the oldest way this repository goes quietly wrong, so it is not left to good faith:
//
//   1. both implementations are driven over the same matrix, off disk, and must answer identically. The kit's
//      copy is read from `node_modules`, which is the exact bytes this fork compiles against — so a kit that
//      changes the wait sentence, the digest name or the parsing reddens here and names the difference.
//   2. the day the kit PUBLISHES the subpath, this goes red asking for the weld to be deleted. A waiver that
//      outlives its reason is how a temporary file becomes permanent.
//
// ⚠️ AND IT MUST NOT SKIP ITSELF INTO GREEN. If the kit's module cannot be found at all, that is a red with the
// path in it, never a quiet pass: a guard that passes because it found nothing is worse than no guard.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import * as weld from './ceiling-digest';

const KIT = join(import.meta.dirname, '..', '..', 'node_modules', '@forgecommerce', 'storefront-kit');
const ORIGINAL = join(KIT, 'src', 'ceiling-digest.ts');

/** Every `Retry-After` shape that reaches either implementation, including the ones that are NOT numbers. */
const RETRY_AFTERS = ['0', '1', '40', '59.2', '  7  ', '-3', '', '   ', 'Wed, 21 Oct 2026 07:28:00 GMT', null];
/** Every digest shape a boundary can be handed, including Next's own and the absence of one. */
const DIGESTS = [
  undefined,
  '',
  '1928374655',
  'NEXT_REDIRECT;replace;/x',
  'forge.read.ceiling',
  'forge.read.ceiling;40',
  'forge.read.ceiling;-',
  'forge.read.ceiling;',
  'forge.read.ceilingX;40',
];

describe('the vendored kit is reachable at all', () => {
  test('⛔ the original module is where this guard expects it — otherwise nothing below proves anything', () => {
    expect(
      existsSync(ORIGINAL),
      `${ORIGINAL} is not there. Either the fork was never installed (run ` +
        '`bash bin/revendor-forks.sh <forge checkout>` from the repository root) or the kit stopped shipping ' +
        'the module this weld copies — in which case the weld is now the only definition and that is a ' +
        'decision somebody has to take, not a green.',
    ).toBe(true);
  });
});

describe('the weld answers exactly what the kit answers', () => {
  test('★★★ same digest built, same digest read, same sentence said — over every shape', async () => {
    const kit = (await import(/* @vite-ignore */ ORIGINAL)) as typeof weld;

    expect(weld.CEILING_REFUSAL_DIGEST).toBe(kit.CEILING_REFUSAL_DIGEST);

    for (const retryAfter of RETRY_AFTERS) {
      expect(
        weld.ceilingRefusalDigest(retryAfter),
        `the weld builds a different digest than the kit for Retry-After ${JSON.stringify(retryAfter)}`,
      ).toBe(kit.ceilingRefusalDigest(retryAfter));
    }

    for (const digest of DIGESTS) {
      expect(
        weld.isCeilingRefusalDigest(digest),
        `the weld and the kit disagree on whether ${JSON.stringify(digest)} is a ceiling refusal`,
      ).toBe(kit.isCeilingRefusalDigest(digest));
      expect(
        weld.ceilingRefusalWaitSeconds(digest),
        `the weld and the kit read a different wait out of ${JSON.stringify(digest)}`,
      ).toBe(kit.ceilingRefusalWaitSeconds(digest));
    }

    for (const seconds of [null, 0, 1, 2, 40, 90]) {
      expect(
        weld.ceilingWaitSentence(seconds),
        `the weld words the wait differently than the kit for ${seconds} — two shops, one box`,
      ).toBe(kit.ceilingWaitSentence(seconds));
    }
  });

  test('★ ANTI-VACUUM: the matrix really does exercise both branches of every function', () => {
    // A matrix of inputs that all fall on one side proves the two implementations agree about nothing in
    // particular. Each of these is the side that is easy to lose in a rewrite.
    expect(DIGESTS.filter((d) => weld.isCeilingRefusalDigest(d)).length).toBeGreaterThan(1);
    expect(DIGESTS.filter((d) => !weld.isCeilingRefusalDigest(d)).length).toBeGreaterThan(1);
    expect(weld.ceilingRefusalWaitSeconds('forge.read.ceiling;40')).toBe(40);
    expect(weld.ceilingRefusalWaitSeconds('forge.read.ceiling;-')).toBeNull();
    expect(weld.ceilingWaitSentence(1)).toContain('segundo.');
    expect(weld.ceilingWaitSentence(2)).toContain('segundos.');
  });
});

describe('the weld says when it may go', () => {
  test('⛔ the day the kit PUBLISHES `./ceiling-digest`, this weld must be deleted', () => {
    const manifest = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8')) as {
      exports?: Record<string, unknown>;
    };
    // The tarball's manifest carries the NARROWED map (`publishConfig.exports` REPLACES `exports` on pack), so
    // this reads the only map a consumer of this tarball can resolve through.
    expect(
      manifest.exports?.['./ceiling-digest'],
      'the vendored kit now publishes `./ceiling-digest`, so `src/lib/ceiling-digest.ts` is a second ' +
        'definition of a rule the kit owns. Delete the weld, delete this guard, and import the kit: ' +
        "import { isCeilingRefusalDigest } from '@forgecommerce/storefront-kit/ceiling-digest'.",
    ).toBeUndefined();
  });
});
