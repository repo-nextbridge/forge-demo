'use client';
// The category tile's icon slot — the ONE place a category's art is rendered in the storefront, and therefore
// the one place that has to answer "what does a category with no art look like?".
//
// IMAGEM-DE-CATEGORIA-NO-SEED. It used to answer "nothing": an empty 44x44 <span>, which on a tile row reads as
// a defect rather than as a design. The seed measures 5 of 33 categories with an icon (the manifest's contract is
// root-only by design — `packages/seed-dataset/src/photos.ts`), so the no-art tile is the NORMAL case, not the
// exception, and it gets a deliberate look: the category's own initial on the sunken surface. Decorative, so
// aria-hidden — the label underneath already carries the name (same reason the <img> takes an empty alt).
//
// It degrades in BOTH gaps, which is why this is a client component at all:
//   1. no `iconUrl` — the category simply has no icon declared; and
//   2. a url that is set but does not load (stale key, object not in the bucket) — onError needs the browser.
// Before this, (2) showed the browser's broken-image glyph: the tiles were the only category image in the
// product NOT routed through MediaImage's degrade. The first paint is still the <img> (or the initial), so a
// page with no JS renders exactly what it rendered before — the error branch is enhancement, never the baseline.

import { useState } from 'react';
import styles from './CategoryTiles.module.css';

/** The initial the empty state shows. `Array.from` so a name opening on an astral character keeps its glyph
 * whole, and locale-aware upper-casing because the labels are PT-BR. */
function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? '?').toLocaleUpperCase('pt-BR');
}

export function CategoryTileIcon({ iconUrl, name }: { iconUrl?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  // `data-category-icon` is the CONTRACT, not decoration: exactly one of these two nodes exists per tile, and it
  // says which of the two it is. The guard reads it, so it can state the positive rule ("every tile renders art
  // or the named empty state") over whatever categories a store happens to have, instead of listing handles.
  if (!iconUrl || broken) {
    return (
      <span className={styles.iconEmpty} data-category-icon="empty" aria-hidden="true">
        {initialOf(name)}
      </span>
    );
  }
  // Decorative image (the label carries the meaning) → empty alt.
  return (
    // The address the read port resolves for an icon is ABSOLUTE and on the kernel's media host, and
    // `apps/storefront/next.config.ts` declares no `images.remotePatterns` — next/image would refuse it at
    // runtime on every deployment whose kernel host differs, which is every deployment. The art is also 44x44
    // line work, so the optimizer buys nothing here. Same argument MediaImage makes at length (PERF-C).
    // biome-ignore lint/performance/noImgElement: absolute cross-origin master, no remotePatterns to allow it.
    <img
      src={iconUrl}
      alt=""
      className={styles.icon}
      data-category-icon="art"
      onError={() => setBroken(true)}
      loading="lazy"
      decoding="async"
    />
  );
}
