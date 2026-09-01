// PriceSlider — the price facet's dual square-thumb slider (S7-SF-PLP, HANDOVER §5: "Preço slider até R$ 1.000+,
// thumb quadrado"). PROGRESSIVE ENHANCEMENT: until the island mounts (and forever with JS off) it renders the
// GET `<form method=get>` number inputs — the honest no-JS baseline that navigates on submit. Once mounted it
// swaps in two overlaid native <input type=range> thumbs (accessible, keyboard-friendly, no new library); the
// bounds are the facet's real price {min,max} (the max is the "R$ 1.000+"). Moving a thumb updates the readout
// live; RELEASING it navigates through the same filter-url codec (a bound left at its facet extreme is omitted,
// so a full-range drag clears the filter instead of writing a no-op). Tokens only.
//
// ★ QA20/B16 — ONE NAVIGATION PER GESTURE, and a step a human can use. The rail had no `step`, and a native
// range steps by 1: since the wire unit is CENTS, an arrow key moved R$ 0,01 (measured: `price_max=198999 →
// 198998 → 198997`) and EVERY key press committed, so each one fired a navigation the next one aborted. The
// filter was unusable by keyboard (~99.000 presses to cross a R$ 1.000 rail) and a flood on the storefront.
//
// The gesture, not the event, is the unit of intent. A drag says so by ending (mouse/touch release → commit at
// once, exactly as before). A keyboard gesture has no end event — holding an arrow repeats `change` and only
// ever fires one `keyup` — so it is bounded by SILENCE: `PRICE_COMMIT_DELAY_MS` after the last change. A drag
// suppresses that timer while the pointer is down, so a pause mid-drag never navigates under the finger.
'use client';

import { formatMoney } from '@forgecommerce/storefront-kit/money';
import type { StorePath } from '@forgecommerce/storefront-kit/store-route';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  buildFilterUrl,
  clearPrice,
  type FilterState,
  toQueryParams,
} from '@/lib/filters/filter-url';
import styles from './PriceSlider.module.css';

/** How long after the last keyboard change the navigation fires. Long enough to swallow a held arrow key (the
 * OS repeat rate is ~30/s), short enough that a single deliberate press still feels immediate. */
export const PRICE_COMMIT_DELAY_MS = 400;

/** The rail's keyboard step in CENTS: about 1% of the span, snapped UP to the nearest 1/2/5 decade so it lands
 * on round money (R$ 10, R$ 20, R$ 50 …), with a R$ 1,00 floor. Derived from the facet's own bounds rather than
 * fixed, so a R$ 50 rail does not step in R$ 20 jumps and a R$ 2.000 one is still crossable in ~100 presses. */
export function priceStep(min: number, max: number): number {
  const span = Math.max(0, max - min);
  const target = span / 100;
  if (!(target > 0)) return 100;
  const decade = 10 ** Math.floor(Math.log10(target));
  const ratio = target / decade;
  const snapped = decade * (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10);
  return Math.max(100, Math.round(snapped));
}

export function PriceSlider({
  min,
  max,
  state,
  basePath,
  extra,
}: {
  /** The facet's price floor/ceiling in cents (facets.price). */
  min: number;
  max: number;
  state: FilterState;
  basePath: StorePath;
  extra?: Record<string, string>;
}) {
  // Inert without a router (a bare renderToString of a template embedding the sidebar, or SSR before the app
  // provider mounts): useRouter throws when the app-router context is absent, so we tolerate it and fall to the
  // GET form — the same "island is inert without its provider" stance the minicart takes.
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  const [mounted, setMounted] = useState(false);
  const [lo, setLo] = useState(state.priceMin ?? min);
  const [hi, setHi] = useState(state.priceMax ?? max);

  // Enhance only after mount → SSR and the first client render both show the form (no hydration mismatch).
  useEffect(() => setMounted(true), []);

  // Degenerate facet (a single price point) or no router → nothing to enhance; the form baseline still lets the
  // shopper type and GET-submit.
  const enhanced = mounted && max > min && router !== null;

  // The pending keyboard commit + whether a pointer is currently dragging a thumb.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  // A commit that never fires must not outlive the island (a filter navigation after unmount).
  useEffect(
    () => () => {
      if (pending.current !== null) clearTimeout(pending.current);
    },
    [],
  );

  function clearPending() {
    if (pending.current !== null) {
      clearTimeout(pending.current);
      pending.current = null;
    }
  }

  function commit(nextLo: number, nextHi: number) {
    clearPending();
    const next: FilterState = { ...state };
    if (nextLo > min) next.priceMin = nextLo;
    else delete next.priceMin;
    if (nextHi < max) next.priceMax = nextHi;
    else delete next.priceMax;
    router?.push(buildFilterUrl(basePath, next, extra));
  }

  /** Schedule the ONE navigation a keyboard gesture is worth: each change pushes it further out, so a burst of
   * presses collapses into a single request carrying the value the last press landed on. Silent while a pointer
   * drags (the release commits that gesture). */
  function commitAfterSilence(nextLo: number, nextHi: number) {
    if (dragging.current) return;
    clearPending();
    pending.current = setTimeout(() => {
      pending.current = null;
      commit(nextLo, nextHi);
    }, PRICE_COMMIT_DELAY_MS);
  }

  function endDrag(nextLo: number, nextHi: number) {
    dragging.current = false;
    commit(nextLo, nextHi);
  }

  if (!enhanced) {
    // No-JS baseline: the port's wire format is CENTS, so the inputs carry cents (the URL convention stays the
    // port's); the chips render the friendly R$ value. Hidden inputs preserve the non-price state on submit.
    const preserved = { ...toQueryParams(clearPrice(state)), ...(extra ?? {}) };
    return (
      <form method="get" action={basePath} className={styles.form} data-testid="price-form">
        {Object.entries(preserved).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className={styles.formRow}>
          <input
            type="number"
            name="price_min"
            min={0}
            placeholder={String(min)}
            defaultValue={state.priceMin ?? ''}
            aria-label="Preço mínimo em centavos"
            className={styles.formInput}
          />
          <span aria-hidden>–</span>
          <input
            type="number"
            name="price_max"
            min={0}
            placeholder={String(max)}
            defaultValue={state.priceMax ?? ''}
            aria-label="Preço máximo em centavos"
            className={styles.formInput}
          />
          <button type="submit" className={styles.formApply}>
            OK
          </button>
        </div>
      </form>
    );
  }

  const span = max - min;
  const step = priceStep(min, max);
  const loPct = ((lo - min) / span) * 100;
  const hiPct = ((hi - min) / span) * 100;

  return (
    <div className={styles.slider} data-testid="price-slider">
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          data-testid="price-thumb-min"
          aria-label="Preço mínimo"
          className={`${styles.thumb} ${styles.thumbMin}`}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), hi);
            setLo(next);
            commitAfterSilence(next, hi);
          }}
          onMouseDown={() => {
            dragging.current = true;
          }}
          onTouchStart={() => {
            dragging.current = true;
          }}
          onMouseUp={() => endDrag(lo, hi)}
          onTouchEnd={() => endDrag(lo, hi)}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          data-testid="price-thumb-max"
          aria-label="Preço máximo"
          className={`${styles.thumb} ${styles.thumbMax}`}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), lo);
            setHi(next);
            commitAfterSilence(lo, next);
          }}
          onMouseDown={() => {
            dragging.current = true;
          }}
          onTouchStart={() => {
            dragging.current = true;
          }}
          onMouseUp={() => endDrag(lo, hi)}
          onTouchEnd={() => endDrag(lo, hi)}
        />
      </div>
      {/* Labels BELOW the rail (design source): the floor on the left, "até {max}+" on the right. */}
      <div className={styles.readout} data-testid="price-readout">
        <span>{formatMoney(lo)}</span>
        <span>
          até{' '}
          <strong className={styles.readoutStrong}>
            {hi >= max ? `${formatMoney(max)}+` : formatMoney(hi)}
          </strong>
        </span>
      </div>
    </div>
  );
}
