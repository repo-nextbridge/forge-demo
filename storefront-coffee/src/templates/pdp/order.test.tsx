// ★ PDP BODY ORDER (S7 fix): below the gallery/buybox hero the body slots must render in this exact sequence —
// pdp.below_gallery (reviews) → pdp.below_buybox (the "compre junto" cross-sell) → pdp.below_cross_sell (the
// "related" shelf) — and the description TABS must render LAST, below all three. Renan's ask: frete → avaliações
// → compre junto → shelfs → abas. Asserted on the raw server HTML (renderToString = the crawler's bytes): the
// template just places the slot fills it is handed, so their DOM order IS the rendered page order.
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { PdpTemplate } from './template';

test('the body slots render reviews → bought-together → related, then the tabs LAST', () => {
  const html = renderToString(
    <PdpTemplate
      product={makeProduct({
        content_sections: [{ title: 'Descrição', body: 'texto' }],
      })}
      crumbs={[]}
      belowGallery={<div data-testid="mk-reviews">avaliações</div>}
      belowBuybox={<div data-testid="mk-bought-together">compre junto</div>}
      belowCrossSell={<div data-testid="mk-related">você também vai gostar</div>}
    />,
  );

  const iReviews = html.indexOf('data-testid="mk-reviews"');
  const iBought = html.indexOf('data-testid="mk-bought-together"');
  const iRelated = html.indexOf('data-testid="mk-related"');
  const iTabs = html.indexOf('data-testid="pdp-tabs"');

  // every marker present
  expect(iReviews).toBeGreaterThan(-1);
  expect(iBought).toBeGreaterThan(-1);
  expect(iRelated).toBeGreaterThan(-1);
  expect(iTabs).toBeGreaterThan(-1);

  // the exact requested order: avaliações → compre junto → shelfs → abas
  expect(iBought).toBeGreaterThan(iReviews);
  expect(iRelated).toBeGreaterThan(iBought);
  expect(iTabs).toBeGreaterThan(iRelated);
});

test('the cross-sell no longer sits tucked inside the buybox info column (it is a body section below reviews)', () => {
  // The buybox's info column keeps the native document links; the bought-together fill is a distinct body node
  // that follows the reviews fill — not a child rendered above it under the buybox.
  const html = renderToString(
    <PdpTemplate
      product={makeProduct()}
      crumbs={[]}
      belowGallery={<div data-testid="mk-reviews" />}
      belowBuybox={<div data-testid="mk-bought-together" />}
    />,
  );
  expect(html.indexOf('data-testid="mk-bought-together"')).toBeGreaterThan(
    html.indexOf('data-testid="mk-reviews"'),
  );
});
