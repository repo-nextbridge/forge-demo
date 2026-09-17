// The bought-together pair (S6-PRODUCT-CARD → S7 fidelity) — the THEME's side of the recommendations "Compre
// junto". Redesigned to the prototype (Produto.dc.html §Compre junto): a bordered card with the two products —
// each a 72px thumb + name/price, its COLOR axis as photo swatches and its size axis as text chips — a copper
// "+" disc between them, and a footer that offers one "Adicionar os 2".
//
// ★ THE PRICE IS THE KERNEL'S, INCLUDING THE DISCOUNT. This block used to SUM the two SKUs and say so, because
// the front never invents a price (trava #7) and no primitive could answer "what do these two cost together" —
// a pair promotion is unsatisfiable by a one-product quote. `read.price_together` answers it now, so the block
// shows de/por on EACH line AND on the pair total.
//
// ★ AND WITH NO PAIR QUOTE IT PRICES EACH LINE THROUGH `displayPrice`, the theme's one rule — not through the
// raw `sku.amount` it used to sum. A quote of null means "no promotion applies to the SET", which is a
// different sentence from "these two cost their catalogue price": a sku with a promotion of its own carries it
// as `promotional_price`, stamped by the kernel on the same document the buybox reads. See `lineNumbers`.
// It still computes nothing: every number here came from the port.
//
// The de/por is on BOTH lines on purpose. The cart will show the discount ON THE TWO LINES (an item-class
// benefit lands there), so a block that announced only a pair total would show one number on the PDP and two
// in the cart — the "two prices on two screens" ambiguity this epic closed. The per-line split the read
// carries is the kernel's own allocation, the same one the order freezes.
//
// ★ AND THE VARIANT CHANGE RE-ASKS. Prices differ per SKU, so a quote for the previous selection is a wrong
// number. While the new answer is in flight the old one is HELD and marked (`aria-busy`, dimmed, "atualizando…"),
// never silently swapped and never flashed against the plain sum: a wrong number for 300ms is a wrong number.
// Out-of-order answers are dropped by sequence, so a slow first response cannot overwrite a fast second. Two cards sit side by side (the block's grid); on mobile
// each card stacks its two products with the "+" between.
//
// The block owns the curated pairs (its data); the theme owns this bundle line — so the block still prints no
// image, no price and no PDP link (structure.test.ts). This client leaf owns the selection, the sum and the add.
// Media is resolved through `mediaSrcOf(cover, optimized)` with `optimized` handed down (a client component never
// reads the media env — lib/media/src.ts), so the thumb + swatches follow the chosen SKU.
//
// The add drives the SAME cart the native buybox drives: `addToCart` is the store-bound `addManyToCartAction`
// the PDP hands to its blocks (it owns the httpOnly cart cookie), and the drawer is re-read from the kernel
// afterwards — the front never computes the cart.
'use client';

import { ShoppingCart } from '@forgeco/storefront-kit/icons';
import { MediaImage } from '@forgeco/storefront-kit/MediaImage';
import { altOf, coverOf, mediaSrcOf } from '@forgeco/storefront-kit/media/src';
import { formatMoney } from '@forgeco/storefront-kit/money';
import { displayPrice } from '@forgeco/storefront-kit/promo/display-price';
import type {
  PriceTogether,
  ProductDoc,
  TogetherLine,
} from '@forgeco/storefront-kit/read-client';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useDelayedFlag } from '@/lib/useDelayedFlag';
import { colorAxisId, orderedOptions } from '@/lib/variant-axes';
import styles from './BundlePair.module.css';
import { useMinicart } from './minicart/MinicartProvider';

type Sku = ProductDoc['skus'][number];
/** option_id -> value_id — the variant the shopper picked on one side. */
type Selection = Record<string, string>;

/** A SKU the shopper may buy. `status` is absent on docs projected before it existed → treat as sellable. */
function sellableSkus(product: ProductDoc): Sku[] {
  return (product.skus ?? []).filter((s) => (s.status ? s.status === 'active' : true));
}

function selectionOf(sku: Sku): Selection {
  const sel: Selection = {};
  for (const ov of sku.option_values ?? []) sel[ov.option_id] = ov.value_id;
  return sel;
}

function matches(sku: Sku, selection: Selection): boolean {
  return Object.entries(selection).every(([optionId, valueId]) =>
    (sku.option_values ?? []).some((ov) => ov.option_id === optionId && ov.value_id === valueId),
  );
}

/** The SKU a selection resolves to; falls back to the first sellable one (a product with no option axis). */
function skuFor(product: ProductDoc, selection: Selection): Sku | undefined {
  const skus = sellableSkus(product);
  return skus.find((s) => matches(s, selection)) ?? skus[0];
}

/** Picking a value never dead-ends: if the resulting combination has no SKU, we land on the first sellable SKU
 * carrying that value (the other axes follow it). A value no sellable SKU carries is not offered at all. */
function pick(
  product: ProductDoc,
  current: Selection,
  optionId: string,
  valueId: string,
): Selection {
  const wanted = { ...current, [optionId]: valueId };
  const exact = sellableSkus(product).find((s) => matches(s, wanted));
  if (exact) return selectionOf(exact);
  const any = sellableSkus(product).find((s) => matches(s, { [optionId]: valueId }));
  return any ? selectionOf(any) : current;
}

/** The value ids some sellable SKU actually carries — which VALUES render at all (a value no sku carries is
 * never shown). Cross-axis reachability is a separate, per-selection test (`isReachable`). */
function offeredValueIds(product: ProductDoc): Set<string> {
  const out = new Set<string>();
  for (const s of sellableSkus(product))
    for (const ov of s.option_values ?? []) out.add(ov.value_id);
  return out;
}

/** Cross-axis reachability (same family as SkuSelector item 11a): is (option,value) carried by a sellable sku that is
 * ALSO compatible with the picks already made on the OTHER axes? Once one axis is chosen, a value no surviving sku
 * carries is unreachable → the square disables (greyed), never a dead-end pick. The currently-selected value stays
 * reachable (the resolved sku carries it and matches the rest), so a live pick never disables itself. */
function isReachable(
  product: ProductDoc,
  selection: Selection,
  optionId: string,
  valueId: string,
): boolean {
  return sellableSkus(product).some(
    (sku) =>
      (sku.option_values ?? []).some(
        (ov) => ov.option_id === optionId && ov.value_id === valueId,
      ) &&
      Object.entries(selection).every(
        ([oid, vid]) =>
          oid === optionId ||
          (sku.option_values ?? []).some((ov) => ov.option_id === oid && ov.value_id === vid),
      ),
  );
}

/** One color VALUE's swatch photo — the cover of the first sellable SKU carrying it, resolved through the media
 * door (optimized handed down). The color axis is photo-backed (variant-axes D1), so a swatch always has one. */
function swatchSrcFor(product: ProductDoc, optionId: string, valueId: string, optimized: boolean) {
  const sku = sellableSkus(product).find((s) =>
    (s.option_values ?? []).some((ov) => ov.option_id === optionId && ov.value_id === valueId),
  );
  return mediaSrcOf(coverOf(sku?.media ?? []), optimized);
}

/** One compact side of a pair (the prototype's vertical stack): a thumb + name/price row, then the COLOR axis as
 * photo swatches (when the product has ≥2 colors) and the remaining axes as text chips. A single-color product
 * shows its color as a text line instead of an empty swatch row. */
function Side({
  product,
  sku,
  selection,
  onPick,
  disabled,
  optimized,
  unitAmount,
  promotionalAmount,
}: {
  product: ProductDoc;
  sku: Sku;
  selection: Selection;
  onPick: (optionId: string, valueId: string) => void;
  disabled: boolean;
  optimized: boolean;
  /** What this line pays inside the pair, when a promotion applies to it. Null → the catalog price alone. */
  /** The "was" price to print. Defaults to the sku's own; while a quote is in flight it is the HELD one, so
   * the line and the total never describe two different quotes. */
  unitAmount?: number;
  promotionalAmount?: number | null;
}) {
  const cover = coverOf((sku.media?.length ? sku.media : product.media) ?? []);
  const src = mediaSrcOf(cover, optimized);
  const offered = offeredValueIds(product);
  const colorId = colorAxisId(product);
  const colorValueCount = colorId
    ? ((product.options ?? [])
        .find((o) => o.id === colorId)
        ?.values.filter((v) => offered.has(v.id)).length ?? 0)
    : 0;
  const hasSwatches = colorId != null && colorValueCount >= 2;
  // A single-color product (no swatch row) shows its color name as a text line — the prototype's "Cor única · X".
  const colorText =
    !hasSwatches && colorId
      ? ((sku.option_values ?? []).find((ov) => ov.option_id === colorId)?.value ?? '')
      : '';

  return (
    <div className={styles.side} data-testid="bundle-product">
      <div className={styles.head}>
        <div className={styles.thumb}>
          <MediaImage
            src={src.url}
            providerKey={src.providerKey}
            alt={altOf(cover, product.title)}
            fill
            sizes="72px"
            className={styles.thumbImg}
            placeholderClassName={styles.thumbPlaceholder}
          />
        </div>
        <div className={styles.info}>
          <span className={styles.name}>{product.title}</span>
          {colorText ? <span className={styles.variant}>{colorText}</span> : null}
          {promotionalAmount != null ? (
            <span className={styles.price}>
              {/* de/por on the LINE, because the cart will show it on the line too. */}
              <s className={styles.was}>{formatMoney(unitAmount ?? sku.amount, sku.currency)}</s>{' '}
              <span className={styles.now}>{formatMoney(promotionalAmount, sku.currency)}</span>
            </span>
          ) : (
            <span className={styles.price}>
              {formatMoney(unitAmount ?? sku.amount, sku.currency)}
            </span>
          )}
        </div>
      </div>

      {orderedOptions(product).map((option) => {
        const values = [...option.values]
          .sort((a, b) => a.position - b.position)
          .filter((v) => offered.has(v.id));
        if (values.length < 2) return null; // a single-value axis is nothing to choose.
        const isColor = option.id === colorId && hasSwatches;
        return (
          <div
            key={option.id}
            className={isColor ? styles.swatches : styles.chips}
            data-testid="bundle-picker"
          >
            {values.map((value) => {
              const active = selection[option.id] === value.id;
              const reachable = isReachable(product, selection, option.id, value.id);
              if (isColor) {
                const swatch = swatchSrcFor(product, option.id, value.id, optimized);
                return (
                  <button
                    key={value.id}
                    type="button"
                    className={styles.swatch}
                    aria-label={value.value}
                    title={value.value}
                    aria-pressed={active}
                    data-active={active ? 'true' : undefined}
                    data-offered={reachable ? undefined : 'false'}
                    data-testid={`bundle-value-${value.id}`}
                    disabled={disabled || !reachable}
                    onClick={() => onPick(option.id, value.id)}
                  >
                    <MediaImage
                      src={swatch.url}
                      providerKey={swatch.providerKey}
                      alt=""
                      fill
                      sizes="26px"
                      className={styles.swatchImg}
                      placeholderClassName={styles.swatchPlaceholder}
                    />
                  </button>
                );
              }
              return (
                <button
                  key={value.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={active}
                  data-active={active ? 'true' : undefined}
                  data-offered={reachable ? undefined : 'false'}
                  data-testid={`bundle-value-${value.id}`}
                  disabled={disabled || !reachable}
                  onClick={() => onPick(option.id, value.id)}
                >
                  {value.value}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The pair's quote, kept in step with the selection.
 *
 * ★ THE RULE IS "NEVER A NUMBER THAT IS NOT ABOUT WHAT IS ON SCREEN". While a new answer is in flight the
 * previous one is HELD and reported as stale (the footer dims it and says "atualizando…"), because the two
 * alternatives are worse: swapping to the plain sum flashes a HIGHER price the shopper never has to pay, and
 * showing the old one unmarked is a wrong number presented as right.
 *
 * `seq` drops out-of-order answers: without it a slow first request can land after a fast second and leave the
 * previous variant's price on screen for good.
 */
function usePairQuote(
  pairKey: string,
  initial: PriceTogether | null,
  requote?: (skuIds: string[]) => Promise<PriceTogether | null>,
): { quote: PriceTogether | null; stale: boolean; quotedPair: string } {
  const initialKey = useRef(pairKey).current;
  const [state, setState] = useState<{ key: string; quote: PriceTogether | null }>({
    key: initialKey,
    quote: initial,
  });
  const [pending, setPending] = useState(false);
  const seq = useRef(0);
  // What is on screen RIGHT NOW. An answer is only allowed to land if the selection it was about is still the
  // one being looked at — `seq` alone is not enough: going BACK to a pair whose quote is already in hand asks
  // for nothing, so a slow answer for the pair in between would have arrived as the newest and won.
  const onScreen = useRef(pairKey);
  onScreen.current = pairKey;

  useEffect(() => {
    if (!pairKey || pairKey === state.key) return;
    if (!requote) {
      // No way to ask again: drop the quote rather than keep one that is about another pair.
      setState({ key: pairKey, quote: null });
      return;
    }
    seq.current += 1;
    const mine = seq.current;
    setPending(true);
    const settle = (quote: PriceTogether | null) => {
      // Two conditions, and both are needed: nothing newer was asked, AND the selection has not moved back.
      if (mine !== seq.current || onScreen.current !== pairKey) return;
      setState({ key: pairKey, quote });
      setPending(false);
    };
    requote(pairKey.split('|'))
      .then(settle)
      // Port down → no PAIR quote, and the lines then price themselves through `displayPrice` (each sku's own
      // promotion, which the document already carries). Never the raw catalogue sum — see `lineNumbers`.
      .catch(() => settle(null));
  }, [pairKey, state.key, requote]);

  // `quotedPair` is WHICH pair the quote in hand is about. While a new answer is in flight that is not the
  // pair on screen, and the lines need it for the same reason the total does — see `held` in the component.
  return { quote: state.quote, stale: pending && state.key !== pairKey, quotedPair: state.key };
}

export function BundlePair({
  base,
  paired,
  addToCart,
  optimized = false,
  maxInstallments,
  quote,
  requote,
}: {
  base: ProductDoc;
  paired: ProductDoc;
  /** The store-bound "add these SKUs" Server Action the PDP passes to its blocks. Absent → nothing to drive. */
  addToCart?: (skuIds: string[]) => Promise<void>;
  /** Whether the same-origin media door can optimize (server reads the env, hands the boolean down). */
  optimized?: boolean;
  /** The store's max installments — the honest "ou Nx de …" line under the sum. Absent → no line. */
  maxInstallments?: number | null;
  /** The kernel's quote for the DEFAULT selection, resolved on the server so the first paint is already
   * right (and cacheable). Null → no promotion applies to this pair, and the block sums. */
  quote?: PriceTogether | null;
  /** Ask the kernel again when the shopper changes a variant. Absent → the block keeps the initial quote for
   * the default selection only, and falls back to the sum for any other (never a stale number). */
  requote?: (skuIds: string[]) => Promise<PriceTogether | null>;
}): ReactNode {
  const { refresh, openDrawer } = useMinicart();
  const [baseSel, setBaseSel] = useState<Selection>(() => {
    const first = sellableSkus(base)[0];
    return first ? selectionOf(first) : {};
  });
  const [pairedSel, setPairedSel] = useState<Selection>(() => {
    const first = sellableSkus(paired)[0];
    return first ? selectionOf(first) : {};
  });
  const [busy, setBusy] = useState(false);

  const baseSku = skuFor(base, baseSel);
  const pairedSku = skuFor(paired, pairedSel);
  const pairKey = baseSku && pairedSku ? `${baseSku.id}|${pairedSku.id}` : '';
  const { quote: live, stale, quotedPair } = usePairQuote(pairKey, quote ?? null, requote);

  if (!baseSku || !pairedSku) return null; // nothing sellable on one side → no bundle (never a broken row).

  /**
   * ★ HOLD THE LINE WITH THE TOTAL, OR HOLD NEITHER.
   *
   * The footer already held the previous answer while a new one is in flight. The LINES did not, and the
   * result was measured on the combined bench: for about a second the line showed the new sku's catalogue
   * price with no de/por while the total still showed the old pair's — two quotes on one screen, which is the
   * exact disease this pack spent the day curing.
   *
   * So while `stale`, a line reads from the quote IN HAND (the pair `quotedPair` names), not from the sku the
   * shopper just selected: same numbers, same moment, dimmed and marked "atualizando…". With no quote in hand
   * there is nothing to hold and nothing being contradicted — the line simply shows its own price.
   */
  const held = quotedPair.split('|');
  const fromQuote = (line: TogetherLine): { unit: number; promotional: number | null } => ({
    unit: line.unit_amount,
    promotional: line.promotional_amount < line.unit_amount ? line.promotional_amount : null,
  });
  const lineNumbers = (sku: Sku, side: 0 | 1): { unit: number; promotional: number | null } => {
    const heldLine = stale ? live?.lines.find((l) => l.sku_id === held[side]) : undefined;
    if (heldLine) return fromQuote(heldLine);
    const quoted = live?.lines.find((l) => l.sku_id === sku.id);
    if (quoted) return fromQuote(quoted);
    /**
     * ★★ QA-FA3 — NO QUOTE IS NOT "NO DISCOUNT", AND THIS LINE USED TO SAY IT WAS.
     *
     * With no pair quote this returned `sku.amount` — the CATALOGUE price — and the footer summed two of
     * them. Measured on Staging: a PDP whose buybox read R$ 630,00 (a collection-targeted promotion) carried
     * a "Compre junto" announcing R$ 800,00 and "12x de R$ 66,67" for a pair the cart charged R$ 730,00 for.
     *
     * A sku's OWN discount is not something a pair quote has to supply: the kernel already stamped it on the
     * document, as `promotional_price`, and `displayPrice` is the theme's ONE rule for turning that into what
     * a card or a buybox prints. This block was the only place in the theme reading `amount` instead. Nothing
     * is computed here — the number came from the same port the buybox on the same page read it from.
     *
     * `displayPrice` also resolves the merchant's static `compare_at_amount`, so a sku carrying one now
     * strikes it here too. That is the consequence of having ONE rule rather than two, and it is the same
     * de/por the card and the buybox already print for that sku: the price paid does not move.
     */
    const shown = displayPrice(sku);
    return {
      unit: shown?.was ?? sku.amount,
      promotional: shown && shown.was !== undefined ? shown.amount : null,
    };
  };
  const baseNumbers = lineNumbers(baseSku, 0);
  const pairedNumbers = lineNumbers(pairedSku, 1);
  // ★ THE TOTAL IS DERIVED FROM THE LINES ON SCREEN, never from a second rule — a pair whose two lines say
  // 630 and 100 cannot announce 800. With a quote in hand the kernel's own totals win (they carry promotions
  // no per-line price can express, and holding them is what keeps a stale answer coherent).
  const paid = (n: { unit: number; promotional: number | null }) => n.promotional ?? n.unit;
  const total = live ? live.total : paid(baseNumbers) + paid(pairedNumbers);
  const subtotal = live ? live.subtotal : baseNumbers.unit + pairedNumbers.unit;
  const installmentEach =
    maxInstallments && maxInstallments > 0 ? Math.round(total / maxInstallments) : null;
  // Optimistic add; "Adicionando…" shows only if the two-line add outlives 1s (useDelayedFlag).
  const showSpinner = useDelayedFlag(busy);

  async function addBoth() {
    if (busy || !addToCart || !baseSku || !pairedSku) return;
    setBusy(true);
    try {
      await addToCart([baseSku.id, pairedSku.id]);
      await refresh(); // the kernel is the truth — re-read the cart, never compute it here.
      openDrawer();
    } catch {
      // let the shopper retry — the feedback is the button re-enabling.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.bundle} data-testid="bundle-pair">
      <div className={styles.prods}>
        <Side
          product={base}
          sku={baseSku}
          selection={baseSel}
          disabled={busy}
          optimized={optimized}
          unitAmount={baseNumbers.unit}
          promotionalAmount={baseNumbers.promotional}
          onPick={(optionId, valueId) => setBaseSel((cur) => pick(base, cur, optionId, valueId))}
        />
        <div className={styles.plus} aria-hidden>
          <span className={styles.plusDisc}>+</span>
        </div>
        <Side
          product={paired}
          sku={pairedSku}
          selection={pairedSel}
          disabled={busy}
          optimized={optimized}
          unitAmount={pairedNumbers.unit}
          promotionalAmount={pairedNumbers.promotional}
          onPick={(optionId, valueId) =>
            setPairedSel((cur) => pick(paired, cur, optionId, valueId))
          }
        />
      </div>
      <div className={styles.footer}>
        <div
          className={styles.offer}
          data-testid="bundle-sum"
          data-stale={stale ? '' : undefined}
          aria-busy={stale || undefined}
        >
          <span className={styles.offerLabel}>Leve os 2 juntos por:</span>
          <div className={styles.prices}>
            {subtotal > total ? (
              <s className={styles.wasTotal}>{formatMoney(subtotal, pairedSku.currency)}</s>
            ) : null}
            <strong className={styles.total}>{formatMoney(total, pairedSku.currency)}</strong>
            {installmentEach !== null ? (
              <span className={styles.installments}>
                ou {maxInstallments}x de {formatMoney(installmentEach, pairedSku.currency)}
              </span>
            ) : null}
          </div>
          {/* Held-and-marked while a new selection is being quoted: the number on screen is about the previous
              variant, and saying so is the only honest state (swapping to the sum would flash a higher price
              the shopper never has to pay). */}
          {stale ? <span className={styles.updating}>atualizando…</span> : null}
        </div>
        <button
          type="button"
          className={styles.add}
          onClick={addBoth}
          disabled={busy || !addToCart}
          data-testid="bundle-add-both"
        >
          <ShoppingCart size={15} />
          {showSpinner ? 'Adicionando…' : 'Adicionar os 2'}
        </button>
      </div>
    </div>
  );
}
