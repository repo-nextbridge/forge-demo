// Minicart — the cart panel ANCHORED to the header cart icon (§2.3, HANDOVER: a dropdown, NOT a side drawer).
// It is a VIEW over the provider's re-read snapshot: lines (photo/name/variant + an inline qty stepper / swipe-
// remove that drive cart.update_line / cart.remove_line and then RE-READ), the kernel-formed subtotal (NEVER
// computed on the front — relayed from read.checkout, CHK-FRONT-1b), a CTA to the checkout, and an empty state.
// Two declared-but-empty slots (minicart.top / minicart.below_items) let apps enrich later.
//
// FLUIDITY (§2.3 / §10.1):
//   • It never unmounts — the panel lives inside a <FadeLayer>, so the exit fade can play.
//   • TWO open modes: opened BY AN ADD → a 2px line at the top shrinks scaleX(1)→scaleX(0) over 4s and it
//     auto-closes; opened by the cart ICON → no timer, a transparent full-screen BACKDROP closes it on an
//     outside click, and on mobile a one-time SWIPE HINT nudges the first line (−56px then back).
//   • The qty control is a compact "un N" box that expands 42→118px to reveal − / + (they stay in the DOM; the
//     expand is visual). Zeroing removes the line.
//   • Mobile: swiping a line left past 90px slides it to −110% and removes it 240ms later (else it snaps back).
// Semantic tokens only.
'use client';

import { backorderNotice } from '@forgecommerce/storefront-kit/checkout/backorder';
import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import { FadeLayer } from '@forgecommerce/storefront-kit/FadeLayer';
import { Trash2, X } from '@forgecommerce/storefront-kit/icons';
import { MediaImage } from '@forgecommerce/storefront-kit/MediaImage';
import { formatMoney } from '@forgecommerce/storefront-kit/money';
import {
  lineDiscountLabels,
  linePricePair,
  savingsFrom,
  totalizerLabel,
  totalRowsFor,
} from '@forgecommerce/storefront-kit/promo/discount-lines';
import { GiftBlock, GiftDepartedNotice } from '@forgecommerce/storefront-kit/promo/GiftBlock';
import { departedGifts } from '@forgecommerce/storefront-kit/promo/gifts';
import { ThresholdProgress } from '@forgecommerce/storefront-kit/promo/ThresholdProgress';
import type { GiftLine } from '@forgecommerce/storefront-kit/read-client';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Slot } from '@/lib/slots/Slot';
import styles from './MinicartDrawer.module.css';
import { type MinicartErrorOp, useMinicart } from './MinicartProvider';

/** PT display labels for the kernel's stable totalizer ids — the same three the cart column localizes. A
 * DISCOUNT row is never in this map on purpose: it keeps the merchant's own words (see discount-lines.ts). */
/** The sentence for each refused command (approved by the Renan, 2026-08-12). Two, not four: the add says the
 * item did not go in, and the three EDITS share one, because "atualizar o carrinho" is what all three failed to
 * do — a shopper who pressed "−" and was told the ADD failed would look for an add they never made.
 *
 * The word is `carrinho` everywhere now — the storefront used to say "sacola" on one CTA and "Seu carrinho" on
 * this panel, and the two were unified onto `carrinho` (his call, same day).
 *
 * They are shaped on the coupon's honest fallback (lib/promo/coupon-error.ts): say what happened and what to
 * do, never blame the shopper, never relay the port's own English message. `cart.add_line` has no refusal
 * VOCABULARY to relay anyway — it answers a bare `validation_failed` (packages/core/src/commands/cart.ts),
 * unlike the coupon's five named reasons. One sentence per class is all the port can honestly support. */
const EDIT_FAILED = 'Não foi possível atualizar o carrinho agora. Tente de novo em instantes.';
const ERROR_COPY: Record<MinicartErrorOp, string> = {
  add: 'Não foi possível adicionar o item ao carrinho agora. Tente de novo em instantes.',
  update: EDIT_FAILED,
  remove: EDIT_FAILED,
  gift: EDIT_FAILED,
};

/** §2.3 — auto-close delay when opened by an add. Kept in sync with the shrink line's CSS duration (--dur-timer). */
const AUTO_CLOSE_MS = 4000;
/** §10.3 — leftward distance (px) past which a swipe deletes the line. */
const SWIPE_THRESHOLD = 90;
/** How far a line can be dragged before it stops following the pointer. */
const SWIPE_MAX = 120;
/** §10.3 — after crossing the threshold the line slides out, then the removal fires. */
const REMOVE_ANIM_MS = 240;

/** One cart line: swipe-to-delete surface (mobile) over a red trash reveal + the expanding qty control. */
function Line({
  line,
  base,
  busy,
  onQty,
  onRemove,
  currency,
  pair,
  promos,
  hint,
}: {
  line: SummaryLine;
  /** MULTISTORE M1-β — the enriched line carries the product's CLEAN canonical path (lib/checkout/enrich);
   * the store context is the request's, and is applied here. */
  base: StoreBase;
  busy: boolean;
  onQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  currency: string;
  /** PACK item 14 — the de/por an ITEM-class promotion puts on this line (kernel numbers). Null → the chip
   * prints `qty × unit` exactly as before. */
  pair: { was: number; now: number } | null;
  /** ★ QA21 · G1C-7 — the shopper-facing labels of the ITEM-class promotions that landed here. */
  promos: { promotion_id: string; label: string }[];
  /** Swipe-hint tick (§10.3): a changing positive number nudges this line −56px then back, teaching the gesture. */
  hint?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dx, setDx] = useState(0);
  const [removing, setRemoving] = useState(false);
  const drag = useRef<{ startX: number; axis: 'none' | 'x' | 'y' } | null>(null);
  const qtyBoxRef = useRef<HTMLDivElement>(null);
  const editable = Boolean(line.line_id);

  // The qty box stays open until a click OUTSIDE it (the shopper may bump the quantity several times). A plain
  // onBlur would close it the instant a step button disables mid-update (busy → the button drops focus), so the
  // close is driven by a document pointerdown-outside listener instead, only while expanded.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (qtyBoxRef.current && !qtyBoxRef.current.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [expanded]);

  // The one-time swipe hint on a mobile icon-open: slide −56px then back (clean 1302-1311).
  useEffect(() => {
    if (!hint) return;
    setDx(-56);
    const id = setTimeout(() => setDx(0), 600);
    return () => clearTimeout(id);
  }, [hint]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    drag.current = { startX: e.clientX, axis: 'none' };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    if (d.axis === 'none') {
      // Axis lock (§10.3): commit to horizontal only past 8px so vertical scroll is never hijacked.
      if (Math.abs(delta) < 8) return;
      d.axis = 'x';
    }
    if (d.axis !== 'x') return;
    setDx(Math.max(-SWIPE_MAX, Math.min(0, delta))); // left-only reveal
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (dx <= -SWIPE_THRESHOLD && line.line_id) {
      // Slide the line out (−110% via CSS) then remove it 240ms later (§10.3).
      setRemoving(true);
      const id = line.line_id;
      setTimeout(() => onRemove(id), REMOVE_ANIM_MS);
      return;
    }
    setDx(0);
  };

  const unit = line.qty ? Math.round(line.line_total / line.qty) : line.line_total;
  const transform = removing ? 'translateX(-110%)' : `translateX(${dx}px)`;

  return (
    <li className={styles.line} data-testid="minicart-line">
      <div className={styles.swipeBg} aria-hidden="true">
        <Trash2 className={styles.swipeIcon} size={18} />
      </div>
      <div
        className={styles.swipeSurface}
        style={{ transform }}
        data-testid="minicart-line-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.qtySlot}>
          {editable ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: a focus-out container that collapses the qty box when focus leaves the group — the interactive targets are the buttons inside.
            <div
              ref={qtyBoxRef}
              className={styles.qtyBox}
              data-expanded={expanded ? '' : undefined}
              data-testid="minicart-qty-box"
              onBlur={(e) => {
                // Keyboard focus-out closes the box — but NOT while a step is in flight (busy disables the button,
                // which drops focus): that transient blur must not collapse it (click-outside owns the close).
                if (busy) return;
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setExpanded(false);
              }}
            >
              <button
                type="button"
                className={styles.qtyLabel}
                aria-label={`Quantidade: ${line.qty}. Editar`}
                onClick={() => setExpanded((v) => !v)}
              >
                <span className={styles.qtyUn}>un</span>
                <span className={styles.qtyNum} data-testid="minicart-line-qty">
                  {line.qty}
                </span>
              </button>
              <div className={styles.stepGroup}>
                {/* ★ QA29 · s2b-8 — DISABLED AT ONE, like the cart page. The same click used to delete the
                    line here and do nothing there: a shopper who learnt either surface was wrong about the
                    other, and the destructive reading is the one with no confirmation and no undo. Removal is
                    the × beside the row, which now exists for eyes as well as for screen readers. */}
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label="Diminuir quantidade"
                  disabled={busy || line.qty <= 1}
                  tabIndex={expanded ? 0 : -1}
                  onClick={() => onQty(line.line_id as string, line.qty - 1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label="Aumentar quantidade"
                  disabled={busy}
                  tabIndex={expanded ? 0 : -1}
                  onClick={() => onQty(line.line_id as string, line.qty + 1)}
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <span className={styles.qtyStatic}>{line.qty}×</span>
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.nameRow}>
            {/* r4 #25 — the title links to the product's PDP (desktop click; a mobile swipe never fires a click).
             * The link wraps ONLY the title text, never the .qtySlot stepper or the .swipeSurface, so the qty
             * edit and swipe-to-delete gesture stay intact. Falls back to a plain span when the catalog lookup
             * did not resolve a product path (an unfound/frozen line). */}
            {line.href ? (
              <a
                className={styles.lineTitle}
                href={storeHref(base, line.href)}
                data-testid="minicart-line-title"
              >
                {line.title}
              </a>
            ) : (
              <span className={styles.lineTitle} data-testid="minicart-line-title">
                {line.title}
              </span>
            )}
            {line.variant ? <span className={styles.variant}>{line.variant}</span> : null}
          </div>
          {/* ★★ QA21 · G1C-7 — the merchant's own words for the discount on this line. The promotion editor
              promises it ("o rótulo do cliente é o que aparece no carrinho…") and an automatic ITEM promotion
              said it on no surface at all. ITEM class only: an order-class discount already has its own named
              row in the totals below. */}
          {promos.map((promo) => (
            <span
              key={promo.promotion_id}
              className={styles.linePromo}
              data-testid="line-promo-label"
            >
              {promo.label}
            </span>
          ))}
          {/* PACK item 14 — the same story the listing tells: what it cost, and what it costs now. The pair
              is the LINE's (not per unit), because a BXGY line has no honest per-unit price — three for the
              price of two divides into nothing a shopper would recognise. */}
          {pair ? (
            <span className={styles.chip} data-testid="minicart-line-price">
              <s className={styles.chipWas}>{formatMoney(pair.was, currency)}</s>{' '}
              {formatMoney(pair.now, currency)}
            </span>
          ) : (
            <span className={styles.chip} data-testid="minicart-line-price">
              {/* ★ QA27 · B15 — the merchant's own struck "de" (`compare_at_amount`), which this drawer was
                  the only surface of the flow to drop: the card, the PDP and the checkout column all print it
                  (`displayPrice` is the one decider), so the same product read "de R$ 1.286,90 por R$ 990,00"
                  on the shelf and "1 × R$ 990,00" here. The closing line below sums what is SHOWN, so the
                  drawer hiding it was also the drawer under-counting it. The quantity stays: unlike a
                  promotional pair (which is the LINE's, and has no honest per-unit price), both of these are
                  per-unit numbers and "de X, 2 × Y" is the whole of what happened. */}
              {line.compareAtAmount != null && line.compareAtAmount > unit ? (
                <>
                  <s className={styles.chipWas}>
                    {formatMoney(line.compareAtAmount, currency)}
                  </s>{' '}
                </>
              ) : null}
              {line.qty} × {formatMoney(unit, currency)}
            </span>
          )}
        </div>

        <div className={styles.thumb}>
          <MediaImage
            src={line.imageUrl}
            alt={line.title}
            className={styles.thumbImg}
            placeholderClassName={styles.placeholder}
          />
        </div>

        {editable ? (
          <button
            type="button"
            className={styles.remove}
            data-testid="minicart-line-remove"
            aria-label={`Remover ${line.title}`}
            disabled={busy}
            onClick={() => onRemove(line.line_id as string)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function MinicartDrawer({
  base,
  top,
  belowItems,
}: {
  /** MULTISTORE M1-β — the store prefix of the current request (the line links + "Finalizar compra"). */
  base: StoreBase;
  /** Fill for the minicart.top slot (an <ExtensionOutlet> from the layout; absent/null in V1). */
  top?: ReactNode;
  /** Fill for the minicart.below_items slot (absent/null in V1). */
  belowItems?: ReactNode;
}) {
  const {
    open,
    openedByAdd,
    addNonce,
    close,
    snapshot,
    busy,
    error,
    updateQty,
    remove,
    chooseGift,
  } = useMinicart();
  // PROMO — which gifts LEFT since the last re-read. Kept in a ref rather than in state: it is a comparison
  // against the previous render's data, not a second source of truth about the cart.
  const previousGifts = useRef<GiftLine[]>([]);
  const gifts = snapshot.pricing?.gift_lines ?? [];
  const departed = departedGifts(previousGifts.current, gifts);
  useEffect(() => {
    previousGifts.current = gifts;
  }, [gifts]);
  // ★ QA9 · A5 — one sentence, decided in one place (lib/checkout/backorder.ts), so the drawer and the
  // checkout column cannot end up saying two different things about the same basket.
  const backorderMessage = backorderNotice(snapshot.backorder);
  const [paused, setPaused] = useState(false);
  const [hintKey, setHintKey] = useState(0);
  // Bumped on every add-open so the countdown line REMOUNTS (via its React key) and its keyframe animation
  // replays from full — the panel itself never unmounts (fluidity doctrine), so without this the second add
  // would find the animation already finished (stuck empty).
  const [timerRunKey, setTimerRunKey] = useState(0);

  // §2.3 — auto-close 4s after an ADD (not after an icon-open); hovering pauses the countdown. `addNonce` is in
  // the deps so a fresh add — even with the drawer already open — re-runs this effect, clearing the old timeout
  // and starting a fresh 4s window (the countdown restarts instead of firing early on the previous add's clock).
  useEffect(() => {
    if (!open || !openedByAdd || paused) return;
    const id = setTimeout(close, AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [open, openedByAdd, paused, close, addNonce]);

  // Reset the hover-pause on (re)open OR on each new add; on an ICON open (mobile), fire the one-time swipe hint.
  useEffect(() => {
    if (!open) return;
    setPaused(false);
    if (openedByAdd) {
      setTimerRunKey((k) => k + 1); // restart the countdown line on each add-open (incl. a repeat add)
    } else if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setHintKey((k) => k + 1);
    }
  }, [open, openedByAdd, addNonce]);

  const lines = snapshot.lines;
  const isEmpty = lines.length === 0;
  // PROMO item 13 — the rows the footer prints, reconciled exactly the way the cart column reconciles them
  // (the totalizers are the canonical channel; `pricing.discount_lines` only rescues a port that did not put
  // them there). No arithmetic on this surface: the amounts are the kernel's, verbatim.
  const rows = totalRowsFor(snapshot.totalizers, snapshot.pricing);
  // PACK item 14-bis — the closing line. Summed from `rows` (what this footer prints), never from a field the
  // shopper cannot see: nothing may appear only in the savings.
  // ★ QA27 · B15 — the LINES ride along: this footer's closing has to count the struck `compare_at` the lines
  // above it print, exactly as the checkout column does. Same cart, same sentence, same number.
  const savings = savingsFrom(
    rows,
    snapshot.pricing?.shipping_discount,
    snapshot.pricing,
    snapshot.lines,
  );

  return (
    <>
      {/* r4 #12 — a transparent full-screen backdrop closes the panel on a click anywhere OUTSIDE it, in BOTH
       * open modes (icon-open and add-open; add-open still ALSO auto-closes on the timer). Rendered outside the
       * FadeLayer so it can be page-wide, and BELOW the panel (z-index) so clicks inside the panel never close it.
       * The opening click can't re-close: the backdrop only mounts after `open` flips, so that click is long done. */}
      {open ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Fechar carrinho"
          data-testid="minicart-backdrop"
          onClick={close}
        />
      ) : null}

      <FadeLayer open={open} className={styles.overlay} data-testid="minicart-overlay">
        <span className={styles.arrow} aria-hidden="true" />
        {/* §2.3 — the auto-close countdown line (only when opened by an add). */}
        {openedByAdd ? (
          <span
            key={timerRunKey}
            className={styles.timer}
            data-running={open ? '' : undefined}
            data-paused={paused ? '' : undefined}
            data-testid="minicart-timer"
            aria-hidden="true"
          />
        ) : null}

        <div
          className={styles.panel}
          role="dialog"
          aria-label="Carrinho"
          data-testid="minicart-drawer"
          onPointerEnter={() => setPaused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <header className={styles.head}>
            <span className={styles.eyebrow}>Seu carrinho</span>
            {!isEmpty ? <span className={styles.headline}>Adicionados agora</span> : null}
          </header>

          {/* MINICART-ERRO — what the last refused command has to say, INSIDE the drawer (his decision: not a
           * toast, not a banner, not a page). It sits ABOVE the two slots and OUTSIDE the isEmpty branch on
           * purpose: the commonest failure of all is the very first add, when the cart is still empty and that
           * branch renders nothing but "Seu carrinho está vazio". `role="alert"` announces it without stealing
           * focus. The panel states nothing about the cart itself — the failed call changed nothing, and the
           * lines below are still the port's last word. */}
          {error ? (
            <p className={styles.error} role="alert" data-testid="minicart-error">
              {ERROR_COPY[error.op]}
            </p>
          ) : null}

          <Slot name="minicart.top">{top}</Slot>

          {/* ★ QA9 · A5 — the cart says out loud that part of it is a backorder. It is the drawer that stayed
              silent while an item ran out under a built cart (s2b-2): the line kept its price and its
              quantity and nothing on any screen said the store no longer had it. */}
          {backorderMessage ? (
            <p className={styles.backorder} data-testid="minicart-backorder">
              {backorderMessage}
            </p>
          ) : null}

          {isEmpty ? (
            <p className={styles.empty} data-testid="minicart-empty">
              Seu carrinho está vazio.
            </p>
          ) : (
            <>
              <ul className={styles.lines}>
                {lines.map((line: SummaryLine, i: number) => (
                  <Line
                    key={line.line_id ?? line.sku_id}
                    line={line}
                    base={base}
                    busy={busy}
                    onQty={updateQty}
                    onRemove={remove}
                    currency={snapshot.currency}
                    // PACK 03/09 — this takes the LINE now, not its id: the struck price has to be the
                    // merchant's own `compare_at` where there is one, and only the line carries it.
                    pair={linePricePair(line, snapshot.pricing)}
                    promos={lineDiscountLabels(line.line_id, snapshot.pricing)}
                    hint={i === 0 ? hintKey : 0}
                  />
                ))}
              </ul>

              {/* PROMO — the gift the engine granted, and the menu when it is the shopper's to choose. */}
              {snapshot.pricing?.gift_lines?.length ? (
                <div className={styles.gifts}>
                  <GiftBlock
                    gifts={gifts}
                    catalog={snapshot.giftCatalog ?? {}}
                    onChoose={chooseGift}
                    compact
                  />
                </div>
              ) : null}
              {/* …and the word it leaves behind when the cart stops qualifying (never in silence). */}
              <GiftDepartedNotice gifts={departed} />

              <Slot name="minicart.below_items">{belowItems}</Slot>

              <div className={styles.footer}>
                {/* PROMO — "faltam R$ X para …", from the engine's near-misses. It sits ABOVE the subtotal
                    because it is about what the cart could still earn, and it draws whatever the merchant
                    marked — this surface neither orders nor caps the list. */}
                {snapshot.pricing?.near_misses?.length ? (
                  <div className={styles.progress}>
                    <ThresholdProgress
                      nearMisses={snapshot.pricing.near_misses}
                      currency={snapshot.currency}
                    />
                  </div>
                ) : null}
                {/* PROMO item 13 — the drawer used to print ONE row: the label "Subtotal" over the kernel's
                    TOTAL. With a discount in play those are two different numbers, so the word was simply
                    false — "Subtotal R$ 560,00" for a R$ 700,00 product, with nothing naming the R$ 140,00
                    that went missing. It now relays the SAME rows the cart column does (the kernel's
                    totalizers, discounts named by the merchant), discreet, with the total as the total.
                    Every number here is the port's — this surface displays and explains, never computes. */}
                {rows.map((t) => (
                  <div
                    key={t.id}
                    className={styles.totalRow}
                    data-money-row
                    data-testid="minicart-totalizer"
                  >
                    <span className={styles.totalLabel} data-money-label>
                      {totalizerLabel(t)}
                    </span>
                    <span className={styles.totalValue} data-money-amount>
                      {t.id === 'shipping' && t.amount === 0
                        ? 'Grátis'
                        : formatMoney(t.amount, snapshot.currency)}
                    </span>
                  </div>
                ))}
                <div className={styles.subtotalRow} data-money-row>
                  <span className={styles.subtotalLabel} data-money-label>
                    Total
                  </span>
                  <span
                    className={styles.subtotalAmount}
                    data-money-amount
                    data-testid="minicart-total"
                  >
                    {formatMoney(snapshot.totalAmount, snapshot.currency)}
                  </span>
                </div>
                {savings > 0 ? (
                  <div className={styles.savingsRow} data-money-row>
                    <span className={styles.savingsLabel} data-money-label>
                      Você economizou
                    </span>
                    <span
                      className={styles.savingsAmount}
                      data-money-amount
                      data-testid="minicart-savings"
                    >
                      {formatMoney(savings, snapshot.currency)}
                    </span>
                  </div>
                ) : null}
                <a
                  className={styles.checkout}
                  href={storeHref(base, '/checkout')}
                  data-testid="minicart-checkout"
                >
                  Finalizar compra
                </a>
              </div>
            </>
          )}
        </div>
      </FadeLayer>
    </>
  );
}
