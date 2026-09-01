// ASSETS — the non-image media block on the PDP (structural, theme zone). A `document` renders as a download
// link, served with the url the read port already resolved.
// S6-PDP — a `video_external` is no longer a block down the page: it is a square of the GALLERY and plays on
// the stage (see components/Gallery.tsx). The embed mapping moved to lib/gallery.ts with it.
import type { MediaRef } from '@forgecommerce/storefront-kit/read-client';
import styles from './MediaBlocks.module.css';

export function DocumentLinks({ media }: { media: MediaRef[] }) {
  if (media.length === 0) return null;
  return (
    <section className={styles.documents} data-testid="pdp-documents">
      <ul className={styles.docList}>
        {media.map((m) => {
          const url = m.url ?? m.provider_key;
          const label = m.role ?? 'Documento (PDF)';
          return (
            <li key={m.provider_key}>
              <a href={url} className={styles.docLink} download target="_blank" rel="noreferrer">
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
