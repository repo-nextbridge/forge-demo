// FilterDrawer — the PLP filter sidebar's mobile shell (S7-SF-PLP, HANDOVER §5). Desktop: the panel is inline
// (this wrapper is transparent, the sidebar reads as a 236px column). Mobile: a "Filtrar (N)" trigger opens the
// SAME panel as a left slide-in over a scrim. One copy of the children (no duplicated filter markup) — CSS alone
// switches the panel between inline (desktop) and off-canvas drawer (mobile). It NEVER unmounts (FadeLayer), and
// because filtering is a Next soft-nav that keeps this island mounted, the drawer stays open while the shopper
// taps facets (the prototype's on-change-in-drawer behaviour; there is no "Aplicar" button — confirmed in the
// .dc.html). `count` is the active-filter tally, shown as the badge.
//
// FLASH FIX (#16): the mobile panel is off-canvas CLOSED from the SERVER render — its closed transform is the
// initial paint, so hydration changes nothing and there is no slide-in-then-out flash. (The previous version
// rendered the panel INLINE until it mounted, then flipped it to off-canvas with a transition — the drawer
// visibly opened on every reload and slid closed.) No-JS access is kept via the pure-CSS `:target` fallback: the
// trigger is a real `#filters` anchor, so with JS off the drawer still opens; with JS on, onClick preventDefault
// keeps the URL clean and the `open` state drives everything.
'use client';

import { FadeLayer } from '@forgeco/storefront-kit/FadeLayer';
import { SlidersHorizontal } from '@forgeco/storefront-kit/icons';
import { useState } from 'react';
import styles from './FilterDrawer.module.css';

/** The panel's DOM id, also the `:target` the no-JS trigger anchors to. */
const PANEL_ID = 'plp-filters';

export function FilterDrawer({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrap}>
      {/* A real fragment anchor (not a button) so the drawer still OPENS with JS OFF, via `:target`. With JS the
       * click is intercepted (preventDefault) and the `open` state drives the panel, leaving the URL untouched.
       * No-JS close then happens naturally: tapping any facet is a GET navigation that clears the `:target`. */}
      <a
        href={`#${PANEL_ID}`}
        className={styles.trigger}
        data-testid="filter-trigger"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <SlidersHorizontal size={15} />
        {count > 0 ? `Filtrar (${count})` : 'Filtrar'}
      </a>

      {/* The scrim (mobile only; CSS hides it on desktop). FadeLayer fades it and keeps it mounted. */}
      <FadeLayer open={open} className={styles.overlay} data-testid="filter-overlay">
        <button
          type="button"
          className={styles.scrim}
          aria-label="Fechar filtros"
          data-testid="filter-scrim"
          onClick={() => setOpen(false)}
        />
      </FadeLayer>

      {/* The panel: inline on desktop, an off-canvas slide-in on mobile. It starts CLOSED off-canvas at first
       * paint; `data-open` (JS) or `:target` (no-JS) drives the slide in. */}
      <div
        className={styles.panel}
        id={PANEL_ID}
        data-open={open ? '' : undefined}
        data-testid="filter-panel"
      >
        <div className={styles.head}>
          <span className={styles.headTitle}>Filtros</span>
          <button
            type="button"
            className={styles.close}
            aria-label="Fechar"
            data-testid="filter-close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
