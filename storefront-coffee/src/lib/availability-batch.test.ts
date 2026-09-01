// FEEDSTOCK — the two things that keep the client half of `read.availability_by_skus` honest.
//
// The port declares a ceiling and REFUSES above it (it never truncates), which puts two obligations on this
// side: know the number, and page around it. Both are asserted here rather than trusted, because both fail
// silently — a drifted mirror is a 400 in production, and a slicing client is a 200 that answers about skus
// it never asked about.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVAILABILITY_MAX_SKUS,
  BULK_AVAILABILITY_MAX_SKUS,
  BULK_PRODUCTS_MAX_PAGE,
  PRODUCTS_MAX_PAGE,
} from '@forgecommerce/storefront-kit/read-client';
import { expect, test } from 'vitest';
import { batchSkus } from './batch-skus';

const here = dirname(fileURLToPath(import.meta.url));
const KERNEL_LIMITS = join(here, '../../../../packages/core/src/read/list-limits.ts');

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `sku_${i.toString().padStart(4, '0')}`);

test('★ the ceiling matches the PORT, read from the kernel source', () => {
  // ⚠️ ASSERTED, NEVER SKIPPED when the kernel is absent. The tarball guards run parts of this suite from a
  // copy outside the monorepo, where there is no sibling `packages/` — so the file can be legitimately
  // missing. A silent `return` there is how a guard stops running and nobody notices; this house has paid for
  // that. Outside the monorepo the case proves it is outside; inside it, it compares.
  if (!existsSync(KERNEL_LIMITS)) {
    expect(
      existsSync(join(here, '../../../../packages')),
      'the kernel source is missing but this IS the monorepo — the guard would be silently not running',
    ).toBe(false);
    return;
  }
  const source = readFileSync(KERNEL_LIMITS, 'utf8');
  // ★★ BULK-READ — SCOPED TO THE TABLE, and it has to be now. `availability_by_skus: { maxIds: … }` appears
  // TWICE in that file since the bulk face exists (`LIST_LIMITS` and `BULK_LIST_LIMITS`), and a regex over
  // the whole source would match whichever came first — i.e. this guard would keep passing while comparing
  // the public mirror against the bulk number, or the other way round, depending on the order of two
  // declarations nobody thinks of as load-bearing.
  const tableOf = (name: string): string => {
    const start = source.indexOf(`export const ${name} = {`);
    expect(start, `${name} is no longer a literal table — teach this guard`).toBeGreaterThan(-1);
    const end = source.indexOf('} as const;', start);
    return source.slice(start, end);
  };
  const idsIn = (table: string, key: string): number => {
    const match = new RegExp(`${key}:\\s*\\{\\s*maxIds:\\s*(\\d+)\\s*\\}`).exec(table);
    expect(match, `${key} is no longer a maxIds literal — teach this guard`).not.toBeNull();
    return Number(match?.[1]);
  };
  const maxIn = (table: string, key: string): number => {
    const match = new RegExp(`${key}:\\s*\\{[^}]*max:\\s*(\\d+)`).exec(table);
    expect(match, `${key} is no longer a max literal — teach this guard`).not.toBeNull();
    return Number(match?.[1]);
  };

  const publicLimits = tableOf('LIST_LIMITS');
  const bulkLimits = tableOf('BULK_LIST_LIMITS');
  expect(AVAILABILITY_MAX_SKUS).toBe(idsIn(publicLimits, 'availability_by_skus'));
  expect(BULK_AVAILABILITY_MAX_SKUS).toBe(idsIn(bulkLimits, 'availability_by_skus'));
  expect(BULK_PRODUCTS_MAX_PAGE).toBe(maxIn(bulkLimits, 'products'));
  expect(PRODUCTS_MAX_PAGE).toBe(maxIn(publicLimits, 'products'));
  // ★ THE ANCHOR: the two tables really are two. A `tableOf` that sliced the same text twice would make
  // every line above compare a number with itself.
  expect(BULK_AVAILABILITY_MAX_SKUS).not.toBe(AVAILABILITY_MAX_SKUS);
});

test('★ ceil(N / max) — every id is asked about, and no batch exceeds the ceiling', () => {
  const asked = ids(250);
  const batches = batchSkus(asked, AVAILABILITY_MAX_SKUS);
  expect(batches).toHaveLength(Math.ceil(250 / AVAILABILITY_MAX_SKUS));
  // The property that a slicing implementation cannot satisfy: the union is the whole input.
  expect(batches.flat()).toEqual(asked);
  for (const batch of batches) expect(batch.length).toBeLessThanOrEqual(AVAILABILITY_MAX_SKUS);
});

test('exactly at the ceiling is ONE batch — the boundary, where an off-by-one would cost a round trip', () => {
  expect(batchSkus(ids(AVAILABILITY_MAX_SKUS), AVAILABILITY_MAX_SKUS)).toHaveLength(1);
  expect(batchSkus(ids(AVAILABILITY_MAX_SKUS + 1), AVAILABILITY_MAX_SKUS)).toHaveLength(2);
});

test('duplicates and blanks are dropped before the count — a repeated sku is not a bigger request', () => {
  const batches = batchSkus(['a', 'a', '', 'b'], 10);
  expect(batches).toEqual([['a', 'b']]);
});

test('nothing in, nothing out — an empty ask is not a batch of zero', () => {
  expect(batchSkus([], AVAILABILITY_MAX_SKUS)).toEqual([]);
});
