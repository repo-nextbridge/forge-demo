// Catalog example for ProductCustomFields (/ui-storefront/product-custom-fields) — the product's declared
// custom fields (carried in `product.metadata`) as a key/value spec list. Keys are humanized by lib/custom-fields
// (labelOf) and non-scalar values are dropped, so the fixture mixes strings, a number and a boolean to show all
// scalar shapes; an empty bag renders nothing at all (the component returns null).

import { ProductCustomFields } from './ProductCustomFields';

export function ProductCustomFieldsExamples() {
  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 480 }}>
      <div>
        <p style={{ marginBottom: 8, color: 'var(--color-subtle)' }}>a populated field bag</p>
        <ProductCustomFields
          metadata={{
            uso: 'Corrida',
            cano: 'Baixo',
            genero: 'Unissex',
            peso_liquido: '232 g',
            drop_mm: 8,
            impermeavel: false,
          }}
        />
      </div>
      <div>
        <p style={{ marginBottom: 8, color: 'var(--color-subtle)' }}>empty bag → renders nothing</p>
        <ProductCustomFields metadata={{}} />
      </div>
    </div>
  );
}
