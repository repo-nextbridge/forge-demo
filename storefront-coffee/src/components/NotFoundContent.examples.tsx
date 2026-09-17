// Catalog examples for NotFoundContent (/ui-storefront). The theme's 404 body (HANDOVER §9): the giant
// "4·0·4" with the zero in the copper accent + the two CTAs. Two shapes — store-less (the logo, since there is
// no header to carry it) and store-scoped (no logo).

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { NotFoundContent } from './NotFoundContent';

export function NotFoundContentExamples() {
  return (
    <div style={{ display: 'grid', gap: 40 }}>
      <div>
        <p style={{ marginBottom: 8, color: 'var(--color-subtle)' }}>
          store-less (root, unknown host)
        </p>
        <NotFoundContent base={HOST_BASE} brand />
      </div>
      <div>
        <p style={{ marginBottom: 8, color: 'var(--color-subtle)' }}>
          store-scoped (unknown handle)
        </p>
        <NotFoundContent base={HOST_BASE} />
      </div>
    </div>
  );
}
