// Catalog example for the "Marcas" home block (/ui-storefront/brands-grid) — the presentational BrandsGridView
// rendered with a fixture list of brand cells (the async BrandsGrid reads the CORE brands map, which the gallery
// has no port for). Shows both cell modes: a wordmark image when the brand has a logo, else its uppercase name.

import { type BrandCell, BrandsGridView } from './BrandsGrid';

/** A wordmark-shaped SVG data URI — a stand-in for the seed's brand logos (they are art on white). */
function wordmark(name: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='48' viewBox='0 0 160 48'%3E%3Ctext x='80' y='30' text-anchor='middle' font-family='sans-serif' font-size='20' font-weight='700' fill='%232b2d31'%3E${name}%3C/text%3E%3C/svg%3E`;
}

const NAMES = ['ATLAS', 'VERTEX', 'NORDIC', 'PRIMA', 'ÓRBITA', 'KELVIN', 'SOMA', 'FAROL'];

// Half the cells carry a logo image, half fall back to the uppercase label — so both branches render side by side.
const WITH_LOGOS: BrandCell[] = NAMES.map((name, i) => ({
  slug: name.toLowerCase(),
  name,
  logoUrl: i % 2 === 0 ? wordmark(name) : null,
  href: '#',
}));

const NAMES_ONLY: BrandCell[] = NAMES.map((name) => ({
  slug: name.toLowerCase(),
  name,
  href: '#',
}));

export function BrandsGridExamples() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 'var(--size-container)', margin: '0 auto' }}>
      <p style={{ color: 'var(--color-subtle)' }}>Logo quando a marca tem imagem, senão o nome.</p>
      <BrandsGridView brands={WITH_LOGOS} />
      <p style={{ color: 'var(--color-subtle)' }}>
        Todas sem logo (fallback do nome em maiúsculas).
      </p>
      <BrandsGridView brands={NAMES_ONLY} />
    </div>
  );
}
