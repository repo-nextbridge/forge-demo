// ProductCardView — the theme's ONE card, rendered faithfully to the design source (ProductCard.dc.html). A
// CLIENT component so the card can be fully interactive: choosing a COLOR swaps the card photo, and the 2-click
// add button + variation panel drive the REAL cart. Media URLs are resolved SERVER-SIDE by <ProductCard> and
// handed in as props (never mediaSrc() on the client — the hydration/guard rule); this view only renders them.
//
// STRUCTURE (§2.8): a stretched <a> covers the whole card → the PDP (works with no JS); the interactive controls
// (the add pill, the swatches) are raised above it, so they never navigate. The variation panel is IN-FLOW below
// the body, so opening it grows the card (a 0fr -> 1fr row track), exactly like the source.
//
// THE ADD (the fix Renan called out — "an add that didn't work"): the selected color+size RESOLVE to a SKU id
// and the click calls the MinicartProvider's addAndOpen(skuId, qty) — opening the minicart via the 'add' path
// (its 4s timer bar). With no provider (a preview/SSR shell) the island is inert.
//
// ★ HOW MANY CLICKS THE SALE COSTS, AND WHY (QA6/A7 — "Comprar no card não vende nada, sem toast, sem erro").
// It cost two, always, and the first one was unreadable: it swapped a black square for an orange one carrying
// the SAME cart icon, which is what a completed add would look like. A QA agent, then, read it as a dead
// button on every card it tried — and a shopper has no more information than that agent had.
//   · NOTHING TO CHOOSE (one sku / no options) → the FIRST click sells. There was never a second question to
//     ask, and the quantity the shopper may want is the minicart's business: it opens on the add, with the
//     line's own stepper. This is the common card and it is now one click, like every listing quick-buy is.
//   · A CHOICE TO MAKE (sizes/colours) → the first click still opens the chooser, because adding a size the
//     shopper never picked is worse than asking. What changed is that the button then SAYS "Adicionar": the
//     second click is a word, not a colour.
// And the price stops disappearing at exactly that moment — see `.priceRow[data-open]` in the stylesheet.
'use client';

import { ShoppingCart, Star } from '@forgecommerce/storefront-kit/icons';
import { MediaImage } from '@forgecommerce/storefront-kit/MediaImage';
import {
  PRICE_AMOUNT_ATTR,
  PRICE_SKU_ATTR,
  PRICE_WAS_ATTR,
} from '@forgecommerce/storefront-kit/prices/apply';
import { type Badge, badgeOf } from '@forgecommerce/storefront-kit/promo/badges';
import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type CartModel, defaultSelection, resolveSkuId } from '@/lib/cardModel';
import { useOptionalMinicart } from './minicart/MinicartProvider';
import styles from './ProductCardView.module.css';

export type ProductCardData = {
  /** The PDP link (store-scoped by the middleware). */
  href: string;
  title: string;
  /** Resolved cover url + optimizer key (server-side). Undefined url → the striped placeholder. */
  imageUrl?: string;
  imageProviderKey?: string;
  imageAlt: string;
  sizes: string;
  priority?: boolean;
  /** PACK item 16 — the badges the THEME decided, already ordered and already capped at two
   * (lib/promo/badges.ts). The view no longer decides which tags light: it places each one in the corner the
   * design gives it. */
  tags: Badge[];
  /** Reviews aggregate (absent → the row is reserved but empty). */
  rating?: { average: number; count: number };
  price: string;
  oldPrice?: string;
  /** CUST-CLUSTER wave 4 — the sku this price belongs to, so the identity overlay can find it. */
  priceSku?: string;
  installments?: string;
  badges?: ReactNode;
  /** The interactive 2-click add island. Off → a display-only card (search featured, bundle). */
  cart: boolean;
  compact?: boolean;
  /** The variation model — resolves a selection → SKU id and carries the color swatch photos. */
  model: CartModel;
};

export function ProductCardView(data: ProductCardData) {
  const {
    href,
    title,
    imageUrl,
    imageProviderKey,
    imageAlt,
    sizes,
    priority,
    tags,
    rating,
    price,
    oldPrice,
    priceSku,
    installments,
    badges,
    cart,
    compact,
    model,
  } = data;

  const minicart = useOptionalMinicart();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<Record<string, string>>(() => defaultSelection(model));
  const [colorPicked, setColorPicked] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // The decided list, split into the three places the design puts a badge. `stacked` is whatever is left after
  // the two that own a corner — today free-shipping and new, and anything a client adds to the theme's list.
  // OOS card (ronda3 #11) — the dimmed photo and the "Esgotado" pill are now ONE fact: the theme's badge
  // decision. The caller still turns `cart` off upstream (no add path for a sold-out product) and the card
  // stays clickable → the PDP.
  const soldOutBadge = badgeOf(tags, 'sold-out');
  const discountBadge = badgeOf(tags, 'discount');
  const stacked = tags.filter((b) => b.kind !== 'sold-out' && b.kind !== 'discount');

  const hasVariations = cart && model.options.length > 0;
  const maxShow = compact ? 3 : 4;

  // Outside click collapses (never adds). Armed only while open.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // The card photo swaps to the picked color's swatch (source: colorPicked → colors[selC].img).
  const colorOpt = model.options.find((o) => o.kind === 'swatch');
  const pickedSwatch = colorOpt?.values.find((v) => v.valueId === selection[colorOpt.optionId]);
  const showSwapped = colorPicked && Boolean(pickedSwatch?.swatchUrl);
  const imgSrc = showSwapped ? pickedSwatch?.swatchUrl : imageUrl;
  // The swapped color photo optimizes too now (it carries its own provider_key) — no more raw master on hover.
  const imgKey = showSwapped ? pickedSwatch?.swatchProviderKey : imageProviderKey;

  const onAdd = useCallback(async () => {
    if (busy) return;
    if (hasVariations && !open) {
      setOpen(true); // there IS a choice to make: reveal the qty + variations, and ask for the 2nd click
      return;
    }
    setBusy(true);
    try {
      await minicart?.addAndOpen(resolveSkuId(model, selection), qty);
      setOpen(false);
      setQty(1);
    } catch {
      // keep it open so the shopper can retry
    } finally {
      setBusy(false);
    }
  }, [busy, hasVariations, open, minicart, model, selection, qty]);

  const stop = (e: { stopPropagation: () => void; preventDefault?: () => void }) => {
    e.stopPropagation();
    e.preventDefault?.();
  };
  const fullStars = rating ? Math.round(rating.average) : 0;

  return (
    <article
      ref={rootRef}
      className={styles.card}
      data-open={open || undefined}
      data-testid="product-card"
    >
      {/* Stretched link: the whole card navigates to the PDP; the controls below are raised above it. */}
      <Link href={href} className={styles.stretch} aria-label={title} />

      <div className={styles.image} data-soldout={soldOutBadge ? '' : undefined}>
        <MediaImage
          src={imgSrc}
          providerKey={imgKey}
          alt={imageAlt}
          fill
          sizes={sizes}
          priority={priority}
          className={styles.img}
          placeholderClassName={styles.placeholder}
        />
        {/* Each badge keeps the corner the design gave it — the centred overlay for sold-out, the top-right
            chip for the percentage, the top-left stack for the rest. What changed is that nothing here decides
            WHETHER it lights: the list arrives decided (and capped) from the theme's one badge function. */}
        {soldOutBadge ? (
          <span className={styles.soldOut} data-testid={soldOutBadge.testId}>
            {soldOutBadge.text}
          </span>
        ) : null}
        <div className={styles.tags} data-testid="product-card-tags">
          {stacked.map((badge) => (
            <span
              key={badge.kind}
              className={`${styles.tag} ${badge.kind === 'new' ? styles.tagNew : styles.tagFree}`}
              data-testid={badge.testId}
            >
              {badge.text}
            </span>
          ))}
        </div>
        {discountBadge ? (
          <span className={styles.off} data-testid={discountBadge.testId}>
            {discountBadge.text}
          </span>
        ) : null}
        {badges ? (
          <div className={styles.badges} data-testid="product-card-badges">
            {badges}
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        <div className={styles.rating} data-testid="product-card-rating">
          {rating ? (
            <>
              <span className={styles.stars} aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    size={13}
                    className={i < fullStars ? styles.starOn : styles.starOff}
                  />
                ))}
              </span>
              <span className={styles.ratingCount}>({rating.count})</span>
            </>
          ) : null}
        </div>

        {/* QA6/A7 — `data-open` here is what reserves the open bar its own band: without it the bar
            (absolute, bottom:0, full width) paints straight over the price and the installment line, and the
            shopper chooses a size with no price on the card. */}
        <div className={styles.priceRow} data-open={open || undefined}>
          {/* CUST-CLUSTER wave 4 — the identity overlay's anchor. Stamped for EVERY visitor, signed in or not:
              an attribute that appeared only for members would be personalised HTML, which decision 7 vetoes
              and the anonymous byte-for-byte test catches. Absent `priceSku` = no anchor at all. */}
          <div className={styles.priceBlock} {...(priceSku ? { [PRICE_SKU_ATTR]: priceSku } : {})}>
            <span className={styles.compareRow} data-testid="product-card-compare-row">
              {oldPrice ? (
                <s
                  className={styles.compare}
                  data-testid="price-compare"
                  {...{ [PRICE_WAS_ATTR]: '' }}
                >
                  {oldPrice}
                </s>
              ) : null}
            </span>
            <span className={styles.price} data-testid="price" {...{ [PRICE_AMOUNT_ATTR]: '' }}>
              {price}
            </span>
            <span className={styles.installment} data-testid="product-card-installment">
              {installments ?? ''}
            </span>
          </div>

          {cart ? <div className={styles.spacer} aria-hidden="true" /> : null}

          {cart ? (
            <div
              className={styles.addPill}
              data-open={open || undefined}
              data-compact={compact || undefined}
            >
              {/* The stepper belongs to the OPEN state, and only a card with a choice to make ever opens: a
                  no-choice card sells on the first click, so rendering its qty controls would be markup no
                  pointer can reach (the quantity is the minicart's, which opens on the add). */}
              {hasVariations ? (
                <div className={styles.stepper} data-open={open || undefined}>
                  <button
                    type="button"
                    className={styles.step}
                    aria-label="Diminuir quantidade"
                    data-testid="card-qty-minus"
                    tabIndex={open ? 0 : -1}
                    onClick={(e) => {
                      stop(e);
                      setQty((q) => Math.max(1, q - 1));
                    }}
                  >
                    −
                  </button>
                  <span className={styles.qty} data-testid="card-qty">
                    {qty}
                  </span>
                  <button
                    type="button"
                    className={styles.step}
                    aria-label="Aumentar quantidade"
                    data-testid="card-qty-plus"
                    tabIndex={open ? 0 : -1}
                    onClick={(e) => {
                      stop(e);
                      setQty((q) => q + 1);
                    }}
                  >
                    +
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className={styles.addBtn}
                disabled={busy}
                aria-label={open ? 'Adicionar ao carrinho' : 'Comprar'}
                data-testid="card-cart-button"
                data-open={open || undefined}
                onClick={(e) => {
                  stop(e);
                  // onAdd never rejects (try/catch/finally around the add, and it clears `busy` itself) —
                  // there is no outcome left for this handler to own.
                  void onAdd();
                }}
              >
                {/* Open, the button carries the WORD: the click that sells has to be legible as such, and the
                    icon alone was read as "already added" (QA6/A7). Closed, it is the design's icon square. */}
                {open ? (
                  <span className={styles.addLabel}>Adicionar</span>
                ) : (
                  <ShoppingCart size={16} />
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {hasVariations ? (
        <div
          className={styles.varPanel}
          data-open={open || undefined}
          data-testid="card-cart-panel"
        >
          <div className={styles.varInner}>
            <div className={styles.varList}>
              {model.options.map((o) => {
                const visible = o.values.slice(0, maxShow);
                const overflow = o.values.length - visible.length;
                return (
                  <div key={o.optionId} className={styles.varRow} data-kind={o.kind}>
                    <div className={styles.varOptions}>
                      {visible.map((v) => {
                        const selected = selection[o.optionId] === v.valueId;
                        return (
                          <button
                            key={v.valueId}
                            type="button"
                            className={o.kind === 'swatch' ? styles.swatch : styles.size}
                            data-selected={selected || undefined}
                            data-testid={`card-value-${v.valueId}`}
                            aria-label={v.label}
                            aria-pressed={selected}
                            onClick={(e) => {
                              stop(e);
                              setSelection((s) => ({ ...s, [o.optionId]: v.valueId }));
                              if (o.kind === 'swatch') setColorPicked(true);
                            }}
                          >
                            {o.kind === 'text' ? (
                              v.label
                            ) : open && v.swatchUrl ? (
                              // PERF — the chip is ~48px, so it must NOT paint the full-size master as a CSS
                              // background. next/image through the same-origin door serves a tiny webp derivative.
                              // Gated on `open`: the variation panel is collapsed (a 0fr row track) until the card
                              // is opened, but next/image's lazy loader still fetches a 0-height-but-in-viewport chip —
                              // so on a listing every card's swatches downloaded eagerly (33 of 54 images on a PLP).
                              // Mounting the swatch image only when the panel actually opens defers that download to
                              // the moment the shopper is choosing a color (the only time the chips are visible).
                              <MediaImage
                                src={v.swatchUrl}
                                providerKey={v.swatchProviderKey}
                                alt=""
                                fill
                                sizes="48px"
                                className={styles.swatchImg}
                              />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {overflow > 0 ? (
                      <span className={styles.overflow} data-testid="card-overflow">
                        +{overflow}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
