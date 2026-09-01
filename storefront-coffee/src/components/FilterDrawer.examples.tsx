// Catalog examples for FilterDrawer (/ui-storefront). On mobile the PLP filters live in an off-canvas drawer
// opened by "Filtrar (N)" (slide + fade, N = active filters); on desktop the same panel is inline. The overlay
// is a FadeLayer (mounted while closed). Narrow the viewport to see the drawer behaviour.

import { FilterDrawer } from './FilterDrawer';

export function FilterDrawerExamples() {
  return (
    <FilterDrawer count={2}>
      <p style={{ padding: 12 }}>Os filtros da PLP entram aqui.</p>
    </FilterDrawer>
  );
}
