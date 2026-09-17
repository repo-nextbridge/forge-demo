// Catalog example for the empty-search suggestions (/ui-storefront/search-suggestions) — the "don't dead-end"
// fallback (SEARCH-6): the EmptyState heading + a row of suggested CATEGORY links from the catmap + a "Novidades"
// shelf of newest products. Shown with a full catmap+products and a reduced (categories-only) variant. Inline
// fixtures only — no data port is touched.
import type { CategoryMap, ProductDoc } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { SearchSuggestions } from './SearchSuggestions';

/** A 1×1 colored square as a data URI — a stand-in product cover so the shelf renders offline. */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

const COVERS = ['%23e7e9ec', '%23d9dde1', '%23c7cdd4', '%23eceef1'];
const NAMES = ['Tênis Velocity 9', 'Tênis Pace Runner', 'Tênis Glide Boost', 'Tênis Fresh Foam X'];

function product(i: number): ProductDoc {
  const amount = 44990 + i * 6000;
  return {
    product_id: `prod_${i}`,
    title: NAMES[i % NAMES.length] ?? `Tênis ${i}`,
    description: null,
    handle: `tenis-${i}`,
    status: 'active',
    metadata: {},
    options: [],
    skus: [
      {
        id: `sku_${i}`,
        code: `T${i}`,
        amount,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: null,
        is_default: true,
        metadata: {},
        option_values: [],
        media: [
          {
            provider_key: `demo/${i}`,
            kind: 'image',
            role: null,
            position: 0,
            url: square(COVERS[i % COVERS.length] ?? '%23e7e9ec'),
          },
        ],
      },
    ],
    categories: [{ category_id: 'cat', path: 'tenis', is_primary: true }],
    media: [
      {
        provider_key: `demo/${i}`,
        kind: 'image',
        role: 'hero',
        position: 0,
        url: square(COVERS[i % COVERS.length] ?? '%23e7e9ec'),
      },
    ],
  };
}

const PRODUCTS: ProductDoc[] = Array.from({ length: 4 }, (_, i) => product(i));

const CATMAP: CategoryMap = {
  tenis: { name: 'Tênis', path: 'tenis' },
  roupas: { name: 'Roupas', path: 'roupas' },
  acessorios: { name: 'Acessórios', path: 'acessorios' },
  corrida: { name: 'Corrida', path: 'tenis.corrida' },
  casual: { name: 'Casual', path: 'tenis.casual' },
};

export function SearchSuggestionsExamples() {
  return (
    <div
      style={{
        display: 'grid',
        gap: 32,
        maxWidth: 'var(--size-container)',
        margin: '0 auto',
        padding: 24,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>
          Full: empty message + suggested categories + “Novidades” shelf
        </p>
        <SearchSuggestions
          base={HOST_BASE}
          title="Nenhum resultado para “xyzzy”"
          message="Não encontramos produtos com esse termo. Tente uma categoria abaixo."
          catmap={CATMAP}
          products={PRODUCTS}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--color-subtle)' }}>Categories only: no product suggestions</p>
        <SearchSuggestions
          base={HOST_BASE}
          title="Sua busca não retornou nada"
          message="Explore as categorias da loja para continuar."
          catmap={CATMAP}
          products={[]}
        />
      </div>
    </div>
  );
}
