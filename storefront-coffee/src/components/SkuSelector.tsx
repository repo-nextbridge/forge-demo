// SkuSelector — the catalog model made interactive: per-product option groups (Size × Color); the chosen
// tuple resolves a SKU; the price shown is THE SKU's price, not the product's. A client component so the
// shopper can switch; but it server-renders the DEFAULT sku's price, so the crawler/SSR sees a price.
//
// S7-SF-PDP — the buybox wears the prototype's skin (HANDOVER §4): the COLOR axis (the photo-backed one, D1 —
// never the literal "Cor") renders as 64px photo swatches (grid of 5 on mobile), the other axes as 48×44 text
// buttons; an unavailable combination strikes through (the sparse-matrix `isOffered`). The price carries the
// "Frete grátis" tag (store threshold) and the "ou Nx de R$ X" installment line (store payment config), both
// DATA threaded as props; and the CTA is ONE full-width "Adicionar ao carrinho" with the qty embedded, adding
// optimistically and opening the minicart. Color swatches use the variant's own SKU photo (catalog data, the
// one allowed literal-image exception in the green zone).
//
// ★★ QA16 / S2A-4 — THE AXES ARE A GET FORM, and that is what makes a variant buyable with JS off. Each value
// is a `<button type="submit" name="sku" value="<the code that pick resolves to>">` inside a `method="get"`
// form with no action, so a click the browser handles natively becomes `?sku=<code>` on this very URL — which
// the server now resolves (PdpGallerySelector's `initialSku`). With JS the click is intercepted exactly as the
// FilterDrawer's anchor is: `preventDefault` and the lifted state drives everything, so the enhanced path
// never navigates and the URL stays owned by `replaceState`. Progressive enhancement, the house pattern: the
// base case is what HTML already does, JS only takes it over.
//
// The form wraps ONLY the axes — the buybox below it holds the buy `<form>`, and nesting forms is not markup
// a browser will accept. `styles.axes` is `display: contents`, so the fieldsets remain flex items of
// `.selector` and the layout is byte-identical to the pre-form one.
'use client';

import { coverOf } from '@forgecommerce/storefront-kit/media/src';
import { formatMoney } from '@forgecommerce/storefront-kit/money';
import {
  PRICE_AMOUNT_ATTR,
  PRICE_SKU_ATTR,
  PRICE_WAS_ATTR,
} from '@forgecommerce/storefront-kit/prices/apply';
import { badgesFor } from '@forgecommerce/storefront-kit/promo/badges';
import { displayPrice } from '@forgecommerce/storefront-kit/promo/display-price';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { SKU_PARAM } from '@forgecommerce/storefront-kit/sku-url';
import { HOST_BASE, type StoreBase } from '@forgecommerce/storefront-kit/store-route';
import { useMemo, useState } from 'react';
import { PdpBuyRow } from '@/components/pdp/PdpBuyRow';
import { addToCartThenCheckoutAction } from '@/lib/cart-actions';
import { colorAxisId, orderedOptions } from '@/lib/variant-axes';
import styles from './SkuSelector.module.css';

type Sku = ProductDoc['skus'][number];
export type Selected = Record<string, string>; // option_id -> value_id

/** The sku whose option tuple matches the full selection (or the lone default sku for option-less products). */
export function resolveSku(skus: readonly Sku[], selected: Selected): Sku | undefined {
  const keys = Object.keys(selected);
  return skus.find(
    (sku) =>
      sku.option_values.length === keys.length &&
      sku.option_values.every((ov) => selected[ov.option_id] === ov.value_id),
  );
}

/** Every sku that carries (option,value) AND is still compatible with the picks made on the OTHER axes. This is
 * the cross-axis filter: with Red chosen, only Red skus survive, so a size no Red sku carries drops out. */
function skusOffering(
  skus: readonly Sku[],
  selected: Selected,
  optionId: string,
  valueId: string,
): Sku[] {
  return skus.filter(
    (sku) =>
      sku.option_values.some((ov) => ov.option_id === optionId && ov.value_id === valueId) &&
      Object.entries(selected).every(
        ([oid, vid]) =>
          oid === optionId ||
          sku.option_values.some((ov) => ov.option_id === oid && ov.value_id === vid),
      ),
  );
}

/** A value is offered if some sku carries that (option,value) pair AND is compatible with the current partial
 * selection on the OTHER axes (sparse-matrix, cross-axis aware). Once Red is picked, an XL that no Red sku carries
 * pre-disables — the shopper never reaches the "Combinação indisponível" dead end by clicking. Recomputed every
 * render, so the greyed set follows each selection. The currently-selected value is always offered (the resolved
 * sku carries it and matches the others), so a live pick never disables itself. */
function isOffered(
  skus: readonly Sku[],
  selected: Selected,
  optionId: string,
  valueId: string,
): boolean {
  return skusOffering(skus, selected, optionId, valueId).length > 0;
}

/** The SKU CODE that picking (option,value) resolves to, given the picks already made on the other axes —
 * i.e. exactly what `choose` below produces, expressed as the deep link that reproduces it. It is the `value`
 * of the native submit, so the no-JS path and the JS path compute the SAME destination from the SAME rule
 * instead of agreeing by coincidence. `skusOffering` is the fallback for the (unreachable) case where the
 * tuple names no sku: an offered value always has one, and a value that is not offered is `disabled`. */
function skuCodeFor(
  skus: readonly Sku[],
  selected: Selected,
  optionId: string,
  valueId: string,
): string | undefined {
  const next = { ...selected, [optionId]: valueId };
  return (resolveSku(skus, next) ?? skusOffering(skus, selected, optionId, valueId)[0])?.code;
}

/** ★ SF-BACKORDER-NAO-RENDERIZA — the merchant's promise for a sku the shop keeps selling past zero. Keyed by
 * sku id, and PRESENT means "buyable"; `extra_days: null` inside it means "buyable, estimate unchanged". */
export type BackorderMap = Record<string, { extra_days: number | null }>;

/** True when EVERY sku offering (option,value) under the current cross-axis selection has 0 available (out of
 * stock) AND none of them is on backorder. Unknown availability counts as in-stock; with no availability data
 * at all (`availability` absent) the PDP shows no sold-out state, so tests/previews without stock wiring keep
 * the old behaviour.
 *
 * ★ THE BACKORDER CLAUSE IS THE FIX. `available <= 0` was read as "cannot be sold", and that inference is the
 * defect: whether zero stock stops a sale is the WAREHOUSE POLICY's call, not arithmetic's, and the kernel
 * already made it — that is what a non-null `backorder` is. */
function isValueSoldOut(
  skus: readonly Sku[],
  availability: Record<string, number> | undefined,
  backorder: BackorderMap | undefined,
  selected: Selected,
  optionId: string,
  valueId: string,
): boolean {
  if (!availability) return false;
  const relevant = skusOffering(skus, selected, optionId, valueId);
  if (relevant.length === 0) return false; // not offered at all → that is the cross-axis case, not OOS
  return relevant.every((sku) => (availability[sku.id] ?? 1) <= 0 && !backorder?.[sku.id]);
}

/** True when the value is out of stock everywhere it is offered but EVERY one of those skus is still sellable
 * on backorder — the dashed-border state (design guide, CHANGELOG-LOGISTICA §1). Distinct from sold out, and
 * deliberately not a fallback of it: "esgotado" and "sob encomenda" are opposite answers to "can I buy this?". */
function isValueBackordered(
  skus: readonly Sku[],
  availability: Record<string, number> | undefined,
  backorder: BackorderMap | undefined,
  selected: Selected,
  optionId: string,
  valueId: string,
): boolean {
  if (!availability || !backorder) return false;
  const relevant = skusOffering(skus, selected, optionId, valueId);
  if (relevant.length === 0) return false;
  return relevant.every((sku) => (availability[sku.id] ?? 1) <= 0 && backorder[sku.id]);
}

/** Initial selection = the option tuple of the sku the PDP opens on, so a valid SKU + price renders on first
 * paint. PRE-S7-DEFAULT-SKU — that sku is the one the merchant STARRED; with no star it is `skus[0]`, which is
 * today's behaviour and is arbitrary (the doc is `order by id`) — which is precisely why the star exists.
 * A `?sku=` deep-link still wins over both: the PDP wrapper resolves it with selectionForSku, above this. */
export function defaultSelection(skus: readonly Sku[]): Selected {
  const first = skus.find((s) => s.is_default) ?? skus[0];
  const out: Selected = {};
  if (first) for (const ov of first.option_values) out[ov.option_id] = ov.value_id;
  return out;
}

/** S6-PDP — the reverse of resolveSku: the option tuple of the sku a `?sku=` deep-link names. The link carries
 * the CODE (readable, what we write); a raw id is accepted too, so a pasted/older link still resolves. */
export function selectionForSku(skus: readonly Sku[], codeOrId: string): Selected | null {
  const sku = skus.find((s) => s.code === codeOrId) ?? skus.find((s) => s.id === codeOrId);
  if (!sku) return null;
  const out: Selected = {};
  for (const ov of sku.option_values) out[ov.option_id] = ov.value_id;
  return out;
}

/** One value's swatch photo (the first image of a SKU carrying it) — resolved off the port-provided `url`. */
function swatchUrlFor(skus: readonly Sku[], optionId: string, valueId: string): string | undefined {
  for (const s of skus) {
    if (s.option_values.some((ov) => ov.option_id === optionId && ov.value_id === valueId)) {
      const url = coverOf(s.media)?.url;
      if (url) return url;
    }
  }
  return undefined;
}

// The selector is OPTIONALLY controlled: the PDP wrapper (PdpGallerySelector) lifts the selection so the gallery
// can react to the chosen variant (passes `selected`/`onSelect`); used standalone it manages its own state. Either
// way the DEFAULT sku renders on first paint (SSR-first — the crawler/SSR sees a price).
export function SkuSelector({
  product,
  store,
  base = HOST_BASE,
  selected: selectedProp,
  onSelect,
  colorPicked = true,
  freeShippingThreshold,
  maxInstallments,
  availability,
  backorder,
}: {
  product: ProductDoc;
  store?: string;
  /** MULTISTORE M1-β — the store prefix of the current request. It rides into the no-JS Server Action bind
   * below: that action REDIRECTS, and a redirect that forgets the store is the exact line that triplicated an
   * order (see lib/store-route.ts). */
  base?: StoreBase;
  selected?: Selected;
  /** Called with the new tuple AND the axis the shopper clicked. The axis matters on its own: re-picking the
   * value an axis already holds changes no tuple, yet it IS a pick — the wrapper needs to tell the two apart. */
  onSelect?: (next: Selected, optionId: string) => void;
  /** S7-SF-PDP-FIDELITY — whether the shopper has explicitly picked a colour yet. Until they do, the colour
   * legend reads "selecione" and NO swatch shows the accent ring (the prototype's initial state). The wrapper
   * lifts this together with the selection; standalone the selector treats the default as already picked. */
  colorPicked?: boolean;
  /** The store's free-shipping floor in cents (S7-SF-SMALLS read) → the "Frete grátis" tag. Absent → no tag. */
  freeShippingThreshold?: number | null;
  /** The store's max installments (payment app config) → "ou Nx de R$ X". Absent → no installment line. */
  maxInstallments?: number | null;
  /** STK-1 read.availability wired per sku (sku_id → units available). Absent → no sold-out state at all (the
   * SSR/preview path). A resolved sku at 0 disables the CTA ("Esgotado"); a value whose only skus are all at 0
   * is marked out of stock on its swatch/chip. */
  availability?: Record<string, number>;
  /** ★ SF-BACKORDER-NAO-RENDERIZA — sku_id → the merchant's promise, for the skus the shop sells past zero
   * (read.availability's `backorder`, through /api/availability). A sku listed here is BUYABLE even at 0. */
  backorder?: BackorderMap;
}) {
  const [internal, setInternal] = useState<Selected>(() => defaultSelection(product.skus));
  const selected = selectedProp ?? internal;
  const choose = (optionId: string, valueId: string) => {
    const next = { ...selected, [optionId]: valueId };
    if (onSelect) onSelect(next, optionId);
    else setInternal(next);
  };
  const sku = useMemo(() => resolveSku(product.skus, selected), [product.skus, selected]);
  const colorOptionId = useMemo(() => colorAxisId(product), [product]);
  // o4-PDP — the axes render in ROLE order (colour first), not in the doc's stored order. Derived, never hardcoded.
  const options = useMemo(() => orderedOptions(product), [product]);

  const freeShipping =
    sku !== undefined && freeShippingThreshold != null && sku.amount >= freeShippingThreshold;
  // PROMO — the buybox prices through the SAME rule as the card: the kernel's anonymous-safe promotional
  // preview when there is one, else the merchant's static "was". The de/por stays honest — what is struck is
  // the catalog price the shopper would otherwise pay, never a `compare_at` inflated to look bigger.
  const shown = displayPrice(sku);
  const effective = shown?.amount ?? sku?.amount ?? 0;
  const installmentEach = maxInstallments ? Math.round(effective / maxInstallments) : null;
  const compareAtShown = shown?.was !== undefined;
  // ★ SF-BACKORDER-NAO-RENDERIZA — the merchant's promise for the sku the buybox is currently about. Present
  // = the shop sells this past zero, and the CTA must buy.
  const skuBackorder = sku && backorder ? (backorder[sku.id] ?? null) : null;
  // STK-1 — the resolved sku is sold out when availability is wired AND its counter is 0 (unknown → in stock)
  // AND no policy says otherwise. That last clause is the fix: "0 available" was being read as "unsellable",
  // and it is the warehouse's oversell policy — not the counter — that decides whether a sale can happen.
  const soldOut =
    sku !== undefined &&
    availability !== undefined &&
    (availability[sku.id] ?? 1) <= 0 &&
    skuBackorder === null;
  // QA-PACK-1 C1 — the colour is still to be picked, so the CTA must not buy the default one.
  //
  // WHY THE WRONG PIECE EXISTED: `colorPicked` arrived here to drive the LEGEND ("Cor: selecione") and the
  // swatch ring, and stopped there — the buy row was gated on `soldOut` alone. So the screen said "selecione"
  // and the button sold the first colour, which is the one state a shopper cannot detect before the box
  // arrives. The truth was already in the component; it just never reached the one control that spends money.
  //
  // An axis with a SINGLE value is exempt: there is no choice to make, so demanding one would be friction we
  // invented (`defaultSelection` already holds that value, and the legend already names it).
  const colorValuesCount = colorOptionId
    ? (options.find((o) => o.id === colorOptionId)?.values.length ?? 0)
    : 0;
  const needsColor = colorOptionId != null && colorValuesCount > 1 && !colorPicked;

  // ★ PACK item 15 — the badge was composed on the CARD and nowhere else, so the same product read "-20%" in
  // the listing and showed a bare de/por here. It comes from the theme's ONE badge function now, over the same
  // signals the card feeds it. The PDP is not a card, so it takes the whole ordered list rather than the card's
  // cap of two — there is room in the buybox, and hiding a badge the shopper already saw in the listing is the
  // very asymmetry this item is about. Sold-out keeps its own treatment below (the CTA), so it is not asked
  // for here: this row is about the price, and the badge function makes sold-out exclusive.
  const badges = badgesFor({
    soldOut: false,
    percentOff: shown?.percent ?? null,
    freeShipping,
    isNew: false,
  });

  return (
    <div className={styles.selector} data-testid="sku-selector">
      {/* No `action`: the submission targets the CURRENT url, so the store prefix, the category path and the
       * product handle all survive without this component having to know any of them. */}
      <form method="get" className={styles.axes} data-testid="sku-axes">
        {options.map((option) => {
          const isColor = option.id === colorOptionId;
          // The label echoes the chosen value ("Cor: Preto" / "Tamanho: 40"); an unpicked colour reads "selecione".
          const unpicked = isColor && !colorPicked;
          const selectedValue = option.values.find((v) => v.id === selected[option.id])?.value;
          const legendValue = unpicked ? 'selecione' : (selectedValue ?? 'selecione');
          const labelId = `sku-axis-${option.id}`;
          return (
            // A <div role="group"> (not <fieldset>/<legend>): the section divider is a plain border-top on the div,
            // so it never runs THROUGH the label — a <legend> renders anchored to the fieldset's top border and the
            // hairline crossed the "Tamanho:"/"Cor:" text (o4 #21). Grouping semantics kept via role + aria-labelledby.
            // A <fieldset> (grouping semantics) BUT with a plain <span> label, NOT a <legend>: a legend anchors to
            // the top border and the section hairline crossed the "Tamanho:"/"Cor:" text (o4 #21). The span is
            // normal-flow, so the border-top sits cleanly ABOVE it; aria-labelledby ties the group to its label.
            <fieldset
              key={option.id}
              className={styles.group}
              data-axis={isColor ? 'color' : 'text'}
              aria-labelledby={labelId}
            >
              <span id={labelId} className={styles.legend}>
                {option.name}: <strong className={styles.legendValue}>{legendValue}</strong>
              </span>
              <div className={isColor ? styles.swatches : styles.chips}>
                {option.values.map((value) => {
                  const offered = isOffered(product.skus, selected, option.id, value.id);
                  // Out of stock: offered (the combination exists) but every matching sku is at 0. Marked, not
                  // disabled — the shopper can select it to read the "Esgotado" CTA (VTEX-style visible OOS).
                  const valueSoldOut =
                    offered &&
                    isValueSoldOut(
                      product.skus,
                      availability,
                      backorder,
                      selected,
                      option.id,
                      value.id,
                    );
                  // Sob encomenda: offered, at zero, and sellable anyway → the dashed border (design guide §1).
                  const valueBackordered =
                    offered &&
                    isValueBackordered(
                      product.skus,
                      availability,
                      backorder,
                      selected,
                      option.id,
                      value.id,
                    );
                  const active = selected[option.id] === value.id && !unpicked;
                  const swatchUrl = isColor
                    ? swatchUrlFor(product.skus, option.id, value.id)
                    : undefined;
                  return (
                    // ★★ QA16 — a SUBMIT that names the destination variant, not a `type="button"` whose only
                    // effect is the handler below. With JS off the browser turns this click into
                    // `?sku=<code>` on the current URL, and the server answers with that variant.
                    <button
                      type="submit"
                      name={SKU_PARAM}
                      value={skuCodeFor(product.skus, selected, option.id, value.id) ?? ''}
                      key={value.id}
                      className={isColor && swatchUrl ? styles.swatch : styles.chip}
                      data-active={active}
                      data-offered={offered}
                      data-oos={valueSoldOut || undefined}
                      data-backorder={valueBackordered || undefined}
                      aria-pressed={active}
                      disabled={!offered}
                      title={
                        valueSoldOut
                          ? `${value.value}, esgotado`
                          : valueBackordered
                            ? `${value.value}, sob encomenda`
                            : value.value
                      }
                      aria-label={
                        valueSoldOut
                          ? `${value.value} (esgotado)`
                          : valueBackordered
                            ? `${value.value} (sob encomenda)`
                            : value.value
                      }
                      onClick={(e) => {
                        // The FilterDrawer's bargain: with JS the native effect is cancelled and the lifted
                        // state drives the page (no navigation, the URL stays `replaceState`'s); with JS off
                        // this handler never runs and the submit above is what happens.
                        e.preventDefault();
                        choose(option.id, value.id);
                      }}
                    >
                      {isColor && swatchUrl ? (
                        // The swatch photo is the variant's own image (catalog data — the port resolved the url).
                        <img src={swatchUrl} alt="" className={styles.swatchImg} />
                      ) : (
                        value.value
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </form>

      <div className={styles.buybox}>
        {sku ? (
          <>
            {/* CUST-CLUSTER wave 4 — the identity overlay's anchor, stamped for EVERY visitor (see
                lib/prices/apply.ts for why an attribute that appeared only for members would be the
                personalised HTML decision 7 vetoes). */}
            {/* ★ SF-BACKORDER-NAO-RENDERIZA — the amber notice, ABOVE the price (design guide §1). It says the
                one thing the buyer cannot find out any other way before the box fails to arrive: this is
                bought now and shipped later. The number is the merchant's own (`extra_days`); when they chose
                to sell past zero WITHOUT changing the promise the kernel sends null, and the sentence simply
                stops there — inventing a "+0 dias" or a vague "alguns dias" would be the front making up a
                delivery promise, which is the failure this whole card is about. */}
            {skuBackorder ? (
              <p className={styles.backorder} data-testid="pdp-backorder" role="status">
                <strong className={styles.backorderStrong}>Sob encomenda</strong>
                {skuBackorder.extra_days
                  ? ` · envio em até ${skuBackorder.extra_days} ${
                      skuBackorder.extra_days === 1 ? 'dia útil' : 'dias úteis'
                    } a mais`
                  : ' · enviado assim que chegar, sem mudança no prazo'}
              </p>
            ) : null}
            <div className={styles.priceBlock} {...{ [PRICE_SKU_ATTR]: sku.id }}>
              {/* Line 1: the struck "was" + the "Frete grátis" chip (HANDOVER §4 — the chip is a hairline box,
                  not a coloured badge). Rendered only when there is a "was" and/or the store's floor is cleared. */}
              {(compareAtShown || badges.length > 0) && (
                <div className={styles.priceTop}>
                  {compareAtShown ? (
                    <s
                      className={styles.compare}
                      data-testid="price-compare"
                      {...{ [PRICE_WAS_ATTR]: '' }}
                    >
                      {formatMoney(shown?.was ?? 0, sku.currency)}
                    </s>
                  ) : null}
                  {badges.map((badge) => (
                    <span
                      key={badge.kind}
                      className={badge.kind === 'discount' ? styles.offTag : styles.freeTag}
                      data-testid={
                        badge.kind === 'free-shipping' ? 'pdp-free-shipping' : badge.testId
                      }
                    >
                      {badge.text}
                    </span>
                  ))}
                </div>
              )}
              {/* Line 2: the current price (headline) with the installment line pushed to the right baseline. */}
              <div className={styles.priceRow}>
                <span className={styles.price} data-testid="price" {...{ [PRICE_AMOUNT_ATTR]: '' }}>
                  {formatMoney(effective, sku.currency)}
                </span>
                {installmentEach !== null && maxInstallments ? (
                  <span className={styles.installment} data-testid="pdp-installment">
                    ou {maxInstallments}x de {formatMoney(installmentEach, sku.currency)}
                  </span>
                ) : null}
              </div>
            </div>
            {/* The resolved SKU code — exposed for deep-link/e2e proofs, not shown (the prototype omits it). */}
            <span className={styles.sku} data-testid="sku-code">
              {sku.code}
            </span>
            {store ? (
              <PdpBuyRow
                action={addToCartThenCheckoutAction.bind(null, store, base, sku.id)}
                skuId={sku.id}
                soldOut={soldOut}
                needsColor={needsColor}
              />
            ) : null}
          </>
        ) : (
          <span className={styles.unavailable}>Combinação indisponível</span>
        )}
      </div>
    </div>
  );
}
