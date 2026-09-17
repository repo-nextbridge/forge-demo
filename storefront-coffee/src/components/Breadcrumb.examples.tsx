// Catalog example for Breadcrumb (/ui-storefront/breadcrumb) — the muted category-path trail that sits above the
// PDP title: caption-type links + a faint "/" separator + the ink current item. Shown at two depths (a single
// crumb and a deeper path) so the separator/spacing is reviewable.

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { Breadcrumb } from './Breadcrumb';

export function BreadcrumbExamples() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <p style={{ marginBottom: 8, color: 'var(--color-subtle)' }}>single crumb</p>
        <Breadcrumb
          base={HOST_BASE}
          crumbs={[{ label: 'Tênis', path: '/tenis' }]}
          current="Tênis Speed Elite"
        />
      </div>
      <div>
        <p style={{ marginBottom: 8, color: 'var(--color-subtle)' }}>deeper path</p>
        <Breadcrumb
          base={HOST_BASE}
          crumbs={[
            { label: 'Tênis', path: '/tenis' },
            { label: 'Corrida de rua', path: '/tenis/corrida' },
            { label: 'Competição', path: '/tenis/corrida/competicao' },
          ]}
          current="Tênis Speed Elite"
        />
      </div>
    </div>
  );
}
