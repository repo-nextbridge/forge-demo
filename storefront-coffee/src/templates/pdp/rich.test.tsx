// RICH (S2 + S4 fix-pack) + S7-SF-PDP: the PDP renders content_sections as TABS (CSS-only, all panels in the
// SSR HTML) IN ORDER, markdown runs, and embedded HTML renders but SANITIZED (rehype-raw + rehype-sanitize) —
// safe tags survive, a `<script>` is stripped. A doc projected BEFORE RICH (no content_sections) with no custom
// fields renders no tabs and does not crash (defensive default). All asserted on the raw server HTML
// (renderToString = the crawler's bytes).
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { PdpTemplate } from './template';

test('content_sections render as tabs IN ORDER, with markdown', () => {
  const html = renderToString(
    <PdpTemplate
      product={makeProduct({
        content_sections: [
          { title: 'Descrição', body: 'texto **rico**' },
          { title: 'Especificações', body: 'algodão' },
          { title: 'FAQ', body: 'perguntas' },
        ],
      })}
      crumbs={[]}
    />,
  );
  // titles present, in order (the array order is the render order)
  const iDesc = html.indexOf('Descrição');
  const iSpec = html.indexOf('Especificações');
  const iFaq = html.indexOf('FAQ');
  expect(iDesc).toBeGreaterThan(-1);
  expect(iSpec).toBeGreaterThan(iDesc);
  expect(iFaq).toBeGreaterThan(iSpec);
  // tabs block + markdown rendered
  expect(html).toContain('data-testid="pdp-tabs"');
  expect(html).toContain('<strong>rico</strong>'); // **rico** → <strong> (markdown ran)
});

test('embedded HTML is SANITIZED: a <script> is stripped, but safe tags render', () => {
  const html = renderToString(
    <PdpTemplate
      product={makeProduct({
        content_sections: [
          { title: 'X', body: '<script>alert(1)</script><strong>bold</strong> <em>hi</em>' },
        ],
      })}
      crumbs={[]}
    />,
  );
  // The dangerous element is removed entirely by rehype-sanitize (not present, not escaped-as-text).
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('&lt;script&gt;');
  expect(html).not.toContain('alert(1)');
  // Safe embedded HTML is rendered as real elements (rehype-raw parsed it, sanitize kept it).
  expect(html).toContain('<strong>bold</strong>');
  expect(html).toContain('<em>hi</em>');
});

test('a dangerous attribute (onerror / javascript: url) is stripped from embedded HTML', () => {
  const html = renderToString(
    <PdpTemplate
      product={makeProduct({
        content_sections: [
          { title: 'X', body: '<a href="javascript:alert(1)" onclick="alert(2)">link</a>' },
        ],
      })}
      crumbs={[]}
    />,
  );
  expect(html).toContain('link'); // the anchor text survives
  expect(html).not.toContain('javascript:'); // the dangerous protocol is dropped
  expect(html).not.toContain('onclick'); // the event handler attribute is stripped
});

test('a doc WITHOUT content_sections OR custom fields renders no tabs and does not crash', () => {
  const product = makeProduct();
  expect(product.content_sections).toBeUndefined(); // the fixture is a pre-RICH doc
  const html = renderToString(<PdpTemplate product={product} crumbs={[]} />);
  expect(html).toContain('Tênis Esportivo'); // the PDP still renders
  expect(html).not.toContain('data-testid="pdp-tabs"'); // no tabs block (no sections, no CFs)
});
