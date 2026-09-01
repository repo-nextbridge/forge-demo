// S7-SF-PDP — the PDP tabs are derived from data: one tab per content_section + an automatic "Detalhes" tab that
// is the product's custom fields as a key/value table. A tab with no data never renders (no CFs → no "Detalhes";
// no sections + no CFs → no tabs at all). SSR: every panel is in the HTML (CSS-only hide).
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { ProductTabs } from './ProductTabs';

test('a product WITH custom fields shows the automatic "Detalhes" table (key → humanized, value)', () => {
  const html = renderToString(
    <ProductTabs
      product={makeProduct({
        metadata: { material: 'Couro', impermeavel: true, drop: 8, _internal: { x: 1 } },
      })}
    />,
  );
  expect(html).toContain('data-testid="pdp-tab-details"'); // the Detalhes tab exists
  expect(html).toContain('data-testid="pdp-details-table"');
  expect(html).toContain('Material'); // humanized key
  expect(html).toContain('Couro');
  expect(html).toContain('Impermeavel'); // humanized underscore key
  expect(html).toContain('Sim'); // boolean → Sim
  expect(html).toContain('Drop');
  expect(html).toContain('8'); // number → string
});

test('a product with NO custom fields has NO "Detalhes" tab', () => {
  const html = renderToString(
    <ProductTabs
      product={makeProduct({ content_sections: [{ title: 'Descrição', body: 'x' }] })}
    />,
  );
  expect(html).toContain('data-testid="pdp-tabs"'); // the Descrição tab renders
  expect(html).not.toContain('data-testid="pdp-tab-details"'); // but no Detalhes
});

test('no content_sections and no custom fields → the tabs block does not render at all', () => {
  const html = renderToString(<ProductTabs product={makeProduct()} />);
  expect(html).toBe(''); // makeProduct has {} metadata and no content_sections
});

test('content_sections precede the appended "Detalhes" tab (data order, Detalhes last)', () => {
  const html = renderToString(
    <ProductTabs
      product={makeProduct({
        content_sections: [
          { title: 'Descrição', body: 'a' },
          { title: 'Cuidados', body: 'b' },
        ],
        metadata: { peso: '232g' },
      })}
    />,
  );
  const iDesc = html.indexOf('Descrição');
  const iCare = html.indexOf('Cuidados');
  const iDetails = html.indexOf('Detalhes');
  expect(iDesc).toBeGreaterThan(-1);
  expect(iCare).toBeGreaterThan(iDesc);
  expect(iDetails).toBeGreaterThan(iCare); // Detalhes is appended after the content sections
});

test('o4 #25 — all labels live in ONE scroll strip (no wrap), and every panel is in the DOM (SSR)', () => {
  const html = renderToString(
    <ProductTabs
      product={makeProduct({
        content_sections: [
          { title: 'Descrição', body: 'a' },
          { title: 'Detalhes técnicos', body: 'b' },
          { title: 'Cuidados', body: 'c' },
        ],
        metadata: { peso: '232g' },
      })}
    />,
  );
  // The label strip is a single container (it, not the section, is the overflow-x scroller).
  expect(html).toContain('data-testid="pdp-tablist"');
  // The labels sit inside the strip, BEFORE the panels container — so the strip scrolls on its own.
  const iStrip = html.indexOf('data-testid="pdp-tablist"');
  const iFirstTabLabel = html.indexOf('data-testid="pdp-tab-s0"');
  const iLastTabLabel = html.indexOf('data-testid="pdp-tab-details"');
  const iFirstPanelBody = html.indexOf('>a<'); // the first panel's markdown body
  expect(iFirstTabLabel).toBeGreaterThan(iStrip);
  expect(iLastTabLabel).toBeGreaterThan(iFirstTabLabel);
  expect(iFirstPanelBody).toBeGreaterThan(iLastTabLabel); // labels first (strip), then panels
  // Every panel is server-rendered (crawler sees all): 3 sections + Detalhes = 4 tab labels.
  expect(html.match(/data-testid="pdp-tab-/g)).toHaveLength(4);
});
