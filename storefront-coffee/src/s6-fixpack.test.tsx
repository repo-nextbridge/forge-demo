import type { CategoryMap } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { cleanup } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test } from 'vitest';
import { ProductCustomFields } from '@/components/ProductCustomFields';
import type { FilterState } from '@/lib/filters/filter-url';
import { HomeTemplate } from '@/templates/home/template';
import { SearchTemplate } from '@/templates/search/template';
import { makeProduct } from '@/test/fixtures';

afterEach(cleanup);

// ── item 8 — the search page has no in-page search box ─────────────────────────────────────────────────────

test('the search results page renders NO search box of its own (only the header has one)', () => {
  const html = renderToString(
    <SearchTemplate
      base={HOST_BASE}
      q="tenis"
      products={[makeProduct()]}
      page={1}
      total={1}
      facets={undefined}
      state={{ options: {}, cf: {} } as FilterState}
      catmap={{} as CategoryMap}
      suggestions={[]}
    />,
  );
  expect(html).toContain('Resultados para'); // still the results page
  expect(html).not.toContain('data-testid="search-box"');
});

test('an uncomposed home is EMPTY — no hardcoded hero, no default product shelf', () => {
  const html = renderToString(<HomeTemplate />);
  expect(html).not.toContain('Bem-vindo');
  expect(html).not.toContain('Conheça nossos produtos');
  expect(html).not.toContain('Tênis Esportivo'); // no shelf of "recent products" invented by the theme
  // S7-SF-HOME — the two new slots (categories/brands) are ALSO empty by default: the template invents no
  // "Compre por categoria" / "Marcas" content; the page fills them, never the template.
  expect(html).not.toContain('Compre por categoria');
  expect(html).not.toContain('Marcas');
});

// ── item 8 — the search page has no in-page search box ─────────────────────────────────────────────────────
// ── item 9 — the home renders ONLY what Compose fills ──────────────────────────────────────────────────────
test('a composed home renders exactly the fills Compose put in the slots', () => {
  const html = renderToString(
    <HomeTemplate
      hero={<p>HERO FILL</p>}
      bannerStrip={<p>BANNER FILL</p>}
      belowShelf={<p>SHELF FILL</p>}
      categories={<p>CATEGORIES FILL</p>}
      brands={<p>BRANDS FILL</p>}
    />,
  );
  expect(html).toContain('HERO FILL');
  expect(html).toContain('BANNER FILL');
  expect(html).toContain('SHELF FILL');
  expect(html).toContain('CATEGORIES FILL');
  expect(html).toContain('BRANDS FILL');
});

test('product custom fields render as a spec list (and nothing at all when there are none)', () => {
  const html = renderToString(
    <ProductCustomFields metadata={{ material: 'Couro', peso_gramas: 320, impermeavel: true }} />,
  );
  expect(html).toContain('Material');
  expect(html).toContain('Couro');
  expect(html).toContain('Peso gramas'); // the key is humanized (the kernel definition has no label)
  expect(html).toContain('320');
  expect(html).toContain('Impermeavel');
  expect(html).toContain('Sim'); // boolean

  expect(renderToString(<ProductCustomFields metadata={{}} />)).toBe('');
  expect(renderToString(<ProductCustomFields metadata={null} />)).toBe('');
});
