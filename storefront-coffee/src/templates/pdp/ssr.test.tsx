// ★ SSR: the SERVED HTML (no JS) must contain the product content — a crawler sees everything. We
// renderToString the PDP template (the same server render Next produces) and assert the raw markup
// carries title, price and description. Hydration is not involved: this is the bytes a crawler gets.
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { PdpTemplate } from './template';

test('the raw server HTML contains title, price and description (crawler-visible)', () => {
  const html = renderToString(
    <PdpTemplate product={makeProduct()} crumbs={[{ label: 'Roupas', path: '/roupas' }]} />,
  );
  expect(html).toContain('Tênis Esportivo'); // title
  expect(html).toContain('Calçado preto para corrida'); // description
  expect(html).toContain('79,90'); // the default SKU's price, server-rendered (no JS)
});
