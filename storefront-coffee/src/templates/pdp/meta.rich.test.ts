// RICH (S2): the PDP SEO meta override the defaults when present, and fall back to title/description when the
// meta fields are empty/absent (a pre-RICH stale doc). Zero regression on the current behavior.
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { pdpMetadata } from './meta';

test('meta_title/meta_description override the title/description defaults', () => {
  const m = pdpMetadata(
    makeProduct({ meta_title: 'SEO Title', meta_description: 'SEO Description' }),
  );
  expect(m.title).toBe('SEO Title');
  expect(m.description).toBe('SEO Description');
});

test('absent meta (pre-RICH doc) → title/description fallback', () => {
  const m = pdpMetadata(makeProduct());
  expect(m.title).toBe('Tênis Esportivo'); // the product title
  expect(m.description).toBe('Calçado preto para corrida'); // the product description
});
