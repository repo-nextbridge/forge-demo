// Filters (SEARCH-6 → S7-SF-PLP-FIDELITY): the PLP/search facet UI, dressed to the design source. EVERYTHING is
// still a plain GET link/form built from filter-url — the sidebar, chips, sort and the price fallback all work
// WITHOUT JS (on-change filtering IS a navigation). It renders what the port returned in `facets` with each
// value's COUNT. Enhancements layer on: the price gets a dual-thumb slider island, the mobile collapse is the
// FilterDrawer.
//
// GROUPS (design source): Cor/Tamanho/Preço/Marca are ALWAYS-OPEN blocks (a caps label, no toggle); only the
// facetable cf axes collapse (a <details> with a +/− marker, CLOSED by default).
//
// SWATCHES: the color axis renders SOLID hue chips from the theme color dictionary (lib/filters/color-swatch —
// the facet contract carries no hex, and must not: a hue is a look, not catalog truth). An unmapped color name
// degrades to the harvested product photo, then to a neutral chip. Every other axis is a text grid / checkbox
// list. The read intelligence is the port's; this is a view over `facets` + the current `FilterState`.

import { X } from '@forgeco/storefront-kit/icons';
import type { Facets } from '@forgeco/storefront-kit/read-client';
import type { StorePath } from '@forgeco/storefront-kit/store-route';
import Link from 'next/link';
import { cfLabel, cfValueLabel } from '@/lib/filters/cf-label';
import { colorHex, isColorAxis } from '@/lib/filters/color-swatch';
import {
  activeChips,
  buildFilterUrl,
  type FilterState,
  hasActiveFilters,
  SORT_KEYS,
  type SortKey,
  setBrand,
  setCf,
  toggleOption,
} from '@/lib/filters/filter-url';
import type { SwatchImages } from '@/lib/filters/plp';
import styles from './Filters.module.css';
import { PriceSlider } from './PriceSlider';

const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Relevância',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  newest: 'Novidades',
  name: 'Nome (A–Z)',
};

/** S6-IMAGES — how many products of the matched set carry this value ("Verde (12)"). The parenthesis is
 * decoration, so the number carries the meaning for a screen reader too. In swatch mode it is visually hidden
 * (a color chip shows a photo, not a number) but stays in the DOM (counts remain assertable). */
function FacetCount({ count }: { count: number }) {
  return (
    <span className={styles.count} data-testid="facet-count">
      {` (${count})`}
    </span>
  );
}

/** The chips row (active filters), each a GET link that removes itself. Rendered above the shelf. */
export function ActiveChips({
  state,
  basePath,
  extra,
}: {
  state: FilterState;
  basePath: StorePath;
  extra?: Record<string, string>;
}) {
  const chips = activeChips(state);
  if (chips.length === 0) return null;
  return (
    <div className={styles.chips} data-testid="active-chips">
      {chips.map((chip) => (
        <Link
          key={`${chip.kind}:${chip.label}`}
          href={buildFilterUrl(basePath, chip.next, extra)}
          className={styles.chip}
          rel="nofollow"
        >
          <span>{chip.label}</span>
          <span aria-hidden className={styles.chipX}>
            ✕
          </span>
          <span className={styles.srOnly}>remover filtro</span>
        </Link>
      ))}
      {hasActiveFilters(state) ? (
        <Link
          href={buildFilterUrl(basePath, { options: {}, cf: {}, sort: state.sort }, extra)}
          className={styles.clearAll}
          rel="nofollow"
        >
          <X size={12} />
          Limpar filtros
        </Link>
      ) : null}
    </div>
  );
}

/** The sort control — underlined tabs (HANDOVER §5), each a GET link (no JS needed), the active one marked.
 * `available` narrows which sort keys make sense (search offers relevance; a category list drops it). */
export function SortControl({
  state,
  basePath,
  extra,
  available = SORT_KEYS,
}: {
  state: FilterState;
  basePath: StorePath;
  extra?: Record<string, string>;
  available?: readonly SortKey[];
}) {
  // With no explicit ?sort=, the FIRST available key is the effective default (relevance on search/listing,
  // where SORT_KEYS leads with it) — so the control always shows a selected tab, never a blank one (o6).
  const effectiveSort = state.sort ?? available[0];
  return (
    <div className={styles.sort} data-testid="sort-control">
      <span className={styles.sortLabel}>Ordenar:</span>
      {available.map((key) => {
        const active = effectiveSort === key;
        return (
          <Link
            key={key}
            href={buildFilterUrl(basePath, { ...state, sort: key }, extra)}
            className={styles.sortLink}
            data-active={active}
            aria-current={active ? 'true' : undefined}
            rel="nofollow"
          >
            {SORT_LABELS[key]}
          </Link>
        );
      })}
    </div>
  );
}

/** The uppercase, letter-spaced group label (HANDOVER §5 / design source): COR, TAMANHO, PREÇO, … */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.groupLabel}>{children}</span>;
}

/** One option axis, rendered as an ALWAYS-OPEN block (the design source keeps Cor/Tamanho open, no toggle — only
 * the cf groups collapse). Color → SOLID swatches from the theme color dictionary (a value with no known hue
 * with no known hue falls to a neutral chip — never a product photo). Every other axis → a 4-up text grid. */
function OptionGroup({
  axis,
  state,
  basePath,
  extra,
}: {
  axis: Facets['options'][number];
  state: FilterState;
  basePath: StorePath;
  extra?: Record<string, string>;
  /** Accepted for call-site compatibility but INTENTIONALLY ignored: a color chip is ALWAYS a solid hue, never
   * a harvested product photo — an unmapped hue falls to the neutral `.swatchImg` background. */
  swatches?: Record<string, string>;
}) {
  const nameKey = axis.name.toLowerCase();
  const selected = state.options[nameKey] ?? [];
  // ONLY the color axis renders as swatches (the design source: Cor = solid hue chips, Tamanho = numeric text
  // grid). Routing is name-based via isColorAxis — never "does a photo exist for this value", so a size value
  // that happens to carry a harvested photo can NEVER slip into the image path (S7-SF-PLP-FIDELITY size fix).
  const asSwatch = isColorAxis(axis.name);
  // Numeric-aware order for the size grid (2 before 10); swatches keep the port order.
  const values = asSwatch ? axis.values : [...axis.values].sort(compareSize);

  return (
    <div className={styles.group} data-testid="filter-group">
      <GroupLabel>{axis.name}</GroupLabel>
      <ul className={asSwatch ? styles.swatches : styles.grid}>
        {values.map((v) => {
          const active = selected.includes(v.value);
          const href = buildFilterUrl(basePath, toggleOption(state, nameKey, v.value), extra);
          if (asSwatch) {
            const hex = colorHex(v.value);
            // ALWAYS a solid hue — a color name with no known hue falls to the neutral `.swatchImg` background
            // (never the product photo it used to harvest, which read as a random shoe in the Cor filter).
            const fill = hex ? { backgroundColor: hex } : undefined;
            return (
              <li key={v.value}>
                <Link
                  href={href}
                  className={styles.swatch}
                  data-active={active}
                  title={`${v.value} (${v.count})`}
                  rel="nofollow"
                >
                  <span className={styles.swatchImg} style={fill} aria-hidden />
                  <span className={styles.srOnly}>
                    {v.value}
                    <FacetCount count={v.count} />
                  </span>
                </Link>
              </li>
            );
          }
          return (
            <li key={v.value}>
              <Link href={href} className={styles.value} data-active={active} rel="nofollow">
                {v.value}
                <FacetCount count={v.count} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Leading number of a size value ("40" → 40, "25.5-31.5" → 25.5, "MD (34\")" → null). */
function sizeNum(v: string): number | null {
  const raw = v.trim().match(/^(\d+(?:[.,]\d+)?)/)?.[1];
  return raw ? Number(raw.replace(',', '.')) : null;
}
/** Order size values NUMERICALLY (2 before 10, not the string order "10,2"); letter sizes (G/M/P, "MD (34\")")
 * sort alphabetically AFTER the numbers. Used for the Tamanho grid (any non-color option axis). */
function compareSize(a: { value: string }, b: { value: string }): number {
  const na = sizeNum(a.value);
  const nb = sizeNum(b.value);
  if (na !== null && nb !== null) return na - nb;
  if (na !== null) return -1;
  if (nb !== null) return 1;
  return a.value.localeCompare(b.value, 'pt-BR');
}

/** The full filter sidebar. Option axes (swatch/grid) + facetable cf (collapsible) + brand checkboxes + a price
 * slider, all GET. Rendered inside the FilterDrawer (mobile) / as the 236px column (desktop). */
export function Filters({
  facets,
  state,
  basePath,
  extra,
  swatchImages,
}: {
  facets: Facets | undefined;
  state: FilterState;
  basePath: StorePath;
  extra?: Record<string, string>;
  /** axisNameLower -> value -> photo url (S7-SF-PLP, harvested from the loaded products). */
  swatchImages?: SwatchImages;
}) {
  const optionFacets = facets?.options ?? [];
  const cfFacets = facets?.custom_fields ?? [];
  const priceFacet = facets?.price ?? null;
  const brandFacets = facets?.brands ?? [];
  const hasAny =
    optionFacets.length > 0 || cfFacets.length > 0 || priceFacet !== null || brandFacets.length > 0;
  // O1-A — nothing to offer AND nothing to undo → no sidebar at all (an empty catalog shows no facet chrome).
  // But an ACTIVE filter always keeps the panel, even with zero axes: the facet base is store+category+brand+q+cf
  // (packages/core/src/read/facets.ts — only the option and price axes are excluded from it), so a `cf` filter
  // narrow enough to empty the listing empties its own facets too. Collapsing here would leave the mobile drawer
  // opening on nothing, which is the very trap this rail exists to prevent, one level in.
  if (!hasAny && !hasActiveFilters(state)) return null;

  return (
    <div className={styles.panel} data-testid="filters">
      {hasActiveFilters(state) ? (
        <Link
          href={buildFilterUrl(basePath, { options: {}, cf: {}, sort: state.sort }, extra)}
          className={styles.clearAll}
          rel="nofollow"
          data-testid="filters-clear"
        >
          <X size={12} />
          Limpar filtros
        </Link>
      ) : null}

      {optionFacets.map((axis) => (
        <OptionGroup
          key={axis.name}
          axis={axis}
          state={state}
          basePath={basePath}
          extra={extra}
          swatches={swatchImages?.[axis.name.toLowerCase()]}
        />
      ))}

      {priceFacet ? (
        <div className={styles.group} data-testid="filter-group">
          <GroupLabel>Preço</GroupLabel>
          <PriceSlider
            min={priceFacet.min}
            max={priceFacet.max}
            state={state}
            basePath={basePath}
            extra={extra}
          />
        </div>
      ) : null}

      {brandFacets.length > 0 ? (
        // Marca is COLLAPSED by default — a demo store carries hundreds of brands, so an always-open list is a
        // wall. (Deliberate deviation from the design-source's always-open Marca block.) Gênero opens instead.
        <details className={styles.groupCollapsible} data-testid="filter-group">
          <summary className={styles.summary}>Marca</summary>
          <ul className={styles.checks}>
            {brandFacets.map((b) => {
              const active = state.brand === b.slug;
              return (
                <li key={b.slug}>
                  <Link
                    href={buildFilterUrl(
                      basePath,
                      setBrand(state, active ? undefined : b.slug),
                      extra,
                    )}
                    className={styles.check}
                    data-active={active}
                    rel="nofollow"
                  >
                    <span className={styles.checkbox} aria-hidden />
                    <span className={styles.checkLabel}>{b.name}</span>
                    <FacetCount count={b.count} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {/* Facetable custom fields (Gênero, Material, …) — collapsible groups. CLOSED by default, EXCEPT Gênero,
          which opens (the shopper's first cut on a shoe store). The summary shows a titled label, not the raw key. */}
      {cfFacets.map((cf) => {
        const current = state.cf[cf.key];
        return (
          <details
            key={cf.key}
            className={styles.groupCollapsible}
            data-testid="filter-group"
            open={cf.key === 'genero'}
          >
            <summary className={styles.summary}>{cfLabel(cf.key)}</summary>
            <ul className={styles.checks}>
              {cf.values.map((v) => {
                const active = current === v.value;
                return (
                  <li key={v.value}>
                    <Link
                      href={buildFilterUrl(
                        basePath,
                        setCf(state, cf.key, active ? undefined : v.value),
                        extra,
                      )}
                      className={styles.check}
                      data-active={active}
                      rel="nofollow"
                    >
                      <span className={styles.checkbox} aria-hidden />
                      <span className={styles.checkLabel}>{cfValueLabel(v.value)}</span>
                      <FacetCount count={v.count} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
