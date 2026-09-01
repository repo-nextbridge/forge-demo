// Catalog example for the "Compre por categoria" home block (/ui-storefront/category-tiles) — the presentational
// CategoryTilesView rendered with a fixture list of tiles (the async CategoryTiles reads the CORE categories map,
// which the gallery has no port for). Shows the section header with the "Ver todas →" affordance, tiles with an
// icon, and — IMAGEM-DE-CATEGORIA-NO-SEED — tiles with NO icon, which is what this specimen is really for: the
// no-art tile is the seed's normal case (5 of 33 categories carry an icon) and it used to render an empty 44x44
// box here, which is what got photographed as "the categories are broken". It now renders the deliberate empty
// state (the category's initial), and this page is where a human sees the two side by side.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { type CategoryTile, CategoryTilesView } from './CategoryTiles';

/** A dark line-icon glyph as a data URI — a stand-in for the seed's category icons (they are PNG art on white). */
function glyph(): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24' fill='none' stroke='%232b2d31' stroke-width='1.5'%3E%3Cpath d='M3 15l3-3 4 2 5-6 6 5v3H3z'/%3E%3C/svg%3E`;
}

const NAMES = [
  'Tênis',
  'Botas',
  'Chuteiras',
  'Sandálias',
  'Sapatos',
  'Sapatilhas',
  'Infantil',
  'Acessórios',
];

// Even tiles carry an icon, odd ones have none — so both branches render side by side. The names are the eight
// the pre-curation design drew art for; the curated tree kept five, which is exactly why the other three stand
// here without art (Chuteiras/Sapatilhas map to sub-categories, Infantil is a `genero` facet and no category
// at all — see RELATORIO-AJ8).
const TILES: CategoryTile[] = NAMES.map((name, i) => ({
  path: name.toLowerCase(),
  name,
  iconUrl: i % 2 === 0 ? glyph() : undefined,
  href: '#',
}));

export function CategoryTilesExamples() {
  return (
    <div style={{ maxWidth: 'var(--size-container)', margin: '0 auto' }}>
      <CategoryTilesView base={HOST_BASE} tiles={TILES} />
    </div>
  );
}
