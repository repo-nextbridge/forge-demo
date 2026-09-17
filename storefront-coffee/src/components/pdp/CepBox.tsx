// S7-SF-PDP — the discreet CEP box on the PDP (HANDOVER §4): the shopper types a CEP, the shipping options fade
// in, and the CEP is PERSISTED on the cart (S7-SF-SMALLS: cart.set_postal_code → read.cart) so it survives the
// trip to the checkout and back — re-opening the PDP shows it, already quoted. The front NEVER prices: the
// options come from read.shipping_options (priced by the kernel); this only displays them. Degrades on error
// (the box just shows nothing new). Semantic tokens only.
'use client';

import { businessDays } from '@forgeco/storefront-kit/delivery-window';
import { FadeLayer } from '@forgeco/storefront-kit/FadeLayer';
import { Store, Truck } from '@forgeco/storefront-kit/icons';
import { digitsOf, maskCep } from '@forgeco/storefront-kit/masks';
import { formatMoney } from '@forgeco/storefront-kit/money';
import { pickupSummary } from '@forgeco/storefront-kit/pickup';
import type { ShippingOption } from '@forgeco/storefront-kit/read-client';
import { useEffect, useState } from 'react';
import { cartPostalCodeAction, setPdpCepAction } from '@/lib/cart-actions';
import { useDelayedFlag } from '@/lib/useDelayedFlag';
import styles from './CepBox.module.css';

/** "2 a 4 dias úteis" / "até 3 dias úteis" / "até 1 dia útil" — the kernel's window, humanized. The agreement
 * comes from the one module every screen shares (QA29 · g1e-6); the "até" framing is this box's own. */
function deliveryLabel(min: number, max: number): string {
  if (max <= 0) return '';
  if (min <= 0 || min === max) return `até ${businessDays(max)}`;
  return `${min} a ${max} dias úteis`;
}

export function CepBox({
  store,
  initialCep,
  skuId,
}: {
  store: string;
  initialCep?: string | null;
  /** QA-PACK-1 C2 — the resolved SKU this box is asking about. Absent (the preview gallery, a host with no
   * product) → the old cart question, unchanged. */
  skuId?: string;
}) {
  const [cep, setCep] = useState(() => maskCep(initialCep ?? ''));
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [done, setDone] = useState(false);
  // leva-4 #8 — a failed quote must not fail silently: track it so we can show an inline retry message.
  const [error, setError] = useState(false);

  /** Quote and publish the outcome into state. It NEVER rejects: the awaited action is wrapped in
   * try/catch/finally, a failure becomes `error` (rendered inline, leva-4 #8) and `quoting` always clears.
   * That is why the three callers below may `void` it — the result is already on screen. */
  async function quote(digits: string) {
    setQuoting(true);
    setError(false);
    setDone(false);
    setOptions([]);
    try {
      const opts = await setPdpCepAction(store, digits, skuId);
      setOptions(opts);
      setDone(true);
    } catch {
      // Surface the failure inline (was a silent degrade); the shopper can retry by retyping.
      setError(true);
    } finally {
      setQuoting(false);
    }
  }

  // Re-open with a persisted CEP → fill the field and quote once, so the options are already there (the
  // round trip). PERF-B: the persisted CEP is FETCHED here (cartPostalCodeAction) instead of arriving as a
  // server-rendered prop — the PDP's HTML is edge-cached, so the page cannot read the cart cookie; this box
  // asks for it after hydration, the same way the minicart seeds its own count. `initialCep` survives as an
  // override for hosts that already know it (the preview gallery's fixtures), and short-circuits the call.
  useEffect(() => {
    let alive = true;
    const seeded = digitsOf(maskCep(initialCep ?? '')); // maskCep caps at 8
    if (seeded.length === 8) {
      void quote(seeded); // settles into state on its own (see quote) — nothing here to await
      return;
    }
    cartPostalCodeAction(store)
      .then((persisted) => {
        if (!alive || !persisted) return;
        const masked = maskCep(persisted);
        const digits = digitsOf(masked);
        if (digits.length !== 8) return;
        setCep(masked);
        void quote(digits); // idem — quote owns its own failure
      })
      .catch(() => {
        /* no persisted CEP — the box just starts empty */
      });
    return () => {
      alive = false;
    };
    // ⚠️ MOUNT-ONCE, AND THE EMPTY ARRAY IS LOAD-BEARING. `quote` is a bound Server Action: a NEW identity
    // on every render. With it in the dependency list this effect re-runs on every render, sets state, and
    // renders again — an infinite loop that ends in `JavaScript heap out of memory`. It got there once, from
    // `biome check --write --unsafe`, and neither `tsc` nor the linter could see it: only the suite could,
    // and it took the whole storefront run down with an OOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(raw: string) {
    const masked = maskCep(raw);
    setCep(masked);
    const digits = digitsOf(masked); // capped at 8 by the mask
    // idem — quote owns its own failure
    if (digits.length === 8) void quote(digits);
    else {
      // Incomplete/invalid CEP → neutral: clear any previous result or message, show nothing.
      setDone(false);
      setError(false);
      setOptions([]);
    }
  }

  const hasOptions = done && options.length > 0;
  // L4 · PICKUP — the summary in the block's footer. It counts the points the KERNEL attached to the pickup
  // option, so it appears only when retrieval is actually offered for this CEP (a pickup method with a rate
  // covering it) — never as a standing promise.
  //
  // ★ NO DISTANCE HERE, AND THAT IS THE DEGRADATION THE SPEC ASKS FOR (decision 3). Distance needs the
  // browser's position, the PDP is not where a shopper expects a geolocation prompt, and the CEP they just
  // typed cannot produce one (that is geocoding — an app). So the line says how MANY and sends the choice to
  // the checkout, where the button to share a position lives.
  const pickupPoints = options.find((o) => o.kind === 'pickup')?.pickup_locations ?? [];
  const pickup = hasOptions ? pickupSummary(pickupPoints) : null;
  // Delayed-spinner: "Calculando…" appears only if the quote outlives 1s (a fast quote fades the options in
  // without a flash of the label).
  const showQuoting = useDelayedFlag(quoting);

  // leva-4 #8 — the two "no options" outcomes get an inline message (only once the quote settles):
  //   error (catch)     → could not compute, retry
  //   valid CEP, 0 opts → out of delivery coverage
  // ★ QA29 · g1e-4 — and the second line is now EARNED. The action refuses a quote that was never made (no
  // cart, unknown sku, no destination) instead of relaying it as an empty list (lib/checkout/quote-result.ts),
  // so those land in the first branch. An empty list here means the kernel looked and this store does not
  // deliver there — which is the only case that sentence is true of.
  const message = quoting
    ? null
    : error
      ? 'Não foi possível calcular agora. Tente de novo.'
      : done && options.length === 0
        ? 'Não entregamos nesse CEP.'
        : null;

  return (
    <div className={styles.box} data-testid="pdp-cep">
      {/* HANDOVER §4 — a discreet inline row: truck glyph + label + a small CEP field, all on one baseline. */}
      <div className={styles.head}>
        <Truck size={16} className={styles.icon} />
        <label className={styles.label} htmlFor="pdp-cep-input">
          Calcule o frete e o prazo
        </label>
        <div className={styles.field} data-input-box>
          <input
            id="pdp-cep-input"
            className={styles.input}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            data-testid="pdp-cep-input"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
      <FadeLayer open={hasOptions} className={styles.optionsLayer}>
        <ul className={styles.options} data-testid="pdp-cep-options">
          {options.map((o) => (
            <li key={o.method_id} className={styles.option}>
              <span className={styles.method}>{o.method_name}</span>
              {/* ★★ QA9 · A5 — THE WINDOW IS PRINTED VERBATIM, and this box is where it stopped being so.
                  It used to add `extraDays` here, and it was the ONLY place in the product that added them:
                  the checkout two clicks later, the frozen order snapshot and every date derived from it read
                  the un-extended number, so the buyer was quoted "11 a 12 dias" on the product page and
                  promised a date three business days out on the confirmation (g1e-1). The sum now happens in
                  the quote (shipping/quote-cart.ts), which is where a prazo is decided; nothing here does
                  arithmetic on a date, exactly as nothing here does arithmetic on a price. */}
              <span className={styles.window}>
                {deliveryLabel(o.delivery_min_days, o.delivery_max_days)}
              </span>
              {/* SHIP-ADM — "Grátis" carries the price it replaced, struck through. The distinction the
                  port draws is honoured here: `free_applied` means a THRESHOLD was cleared (there is a
                  saving to show), while a method that simply costs nothing shows only "Grátis". */}
              <span className={styles.price}>
                {o.free_applied ? (
                  <>
                    <span className={styles.free}>Grátis</span>
                    <s className={styles.struck}>{formatMoney(o.undiscounted_price, 'BRL')}</s>
                  </>
                ) : o.price === 0 ? (
                  <span className={styles.free}>Grátis</span>
                ) : (
                  formatMoney(o.price, 'BRL')
                )}
              </span>
            </li>
          ))}
        </ul>
      </FadeLayer>
      {pickup ? (
        <div className={styles.pickup} data-testid="pdp-cep-pickup">
          <Store size={14} className={styles.icon} />
          <span className={styles.pickupCount}>{pickup}</span>
          <span className={styles.pickupHint}>Escolha o ponto no checkout</span>
        </div>
      ) : null}
      {message ? (
        <span
          className={styles.message}
          data-testid="pdp-cep-message"
          data-variant={error ? 'error' : 'empty'}
          role="status"
        >
          {message}
        </span>
      ) : null}
      {showQuoting && !hasOptions ? <span className={styles.quoting}>Calculando…</span> : null}
    </div>
  );
}
