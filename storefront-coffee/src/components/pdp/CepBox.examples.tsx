// Catalog examples for CepBox (/ui-storefront). The discreet PDP CEP field: type an 8-digit CEP and the
// shipping options fade in (read.shipping_options), and the CEP persists on the cart (survives the trip to
// checkout and back). Here it renders empty (no store round-trip in the gallery).

import { CepBox } from './CepBox';

export function CepBoxExamples() {
  return (
    <div style={{ maxWidth: 360 }}>
      <CepBox store="demo" />
    </div>
  );
}
