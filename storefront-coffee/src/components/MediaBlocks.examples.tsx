// Catalog example for the PDP's non-image media block (/ui-storefront/media-blocks) — DocumentLinks renders a
// `document` MediaRef as a download link, served with the url the read port already resolved (or the provider
// key as a fallback). Shows a labelled document, one with the default label, and a key-only fallback url.
import type { MediaRef } from '@forgeco/storefront-kit/read-client';
import { DocumentLinks } from './MediaBlocks';

const MEDIA: MediaRef[] = [
  {
    provider_key: 'demo/size-guide',
    kind: 'document',
    role: 'Guia de tamanhos (PDF)',
    position: 0,
    url: '#size-guide',
  },
  {
    provider_key: 'demo/warranty',
    kind: 'document',
    role: null, // no role → the default "Documento (PDF)" label
    position: 1,
    url: '#warranty',
  },
  {
    provider_key: 'demo/spec-sheet', // no url → falls back to the provider key
    kind: 'document',
    role: 'Ficha técnica (PDF)',
    position: 2,
  },
];

export function MediaBlocksExamples() {
  return (
    <div style={{ maxWidth: 'var(--size-container)', margin: '0 auto', padding: 24 }}>
      <DocumentLinks media={MEDIA} />
    </div>
  );
}
