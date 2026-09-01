'use client';

// THE BUY BOX — grind, weight, buy-once-or-subscribe, quantity, and the one button that spends money.
//
// ── WHAT IT WRITES, AND WHY THAT IS THE WHOLE INTEGRATION ────────────────────────────────────────────────
// Adding a subscribed bag is `cart.add_line` with ONE extra key: the app's declared `sub_plan`. The kernel
// validates it against the declaration (a rhythm outside the vocabulary is refused), and because a line's
// identity is `sku + custom fields`, the same coffee bought once and subscribed monthly are two lines with
// no code here doing anything about it. That is the entire subscription integration on this page: a UI of
// this shop's own over the app's contract. The app's own block is not mounted and does not need to be.
//
// ── THE FEEDBACK, AND ITS REDUCED-MOTION HALF ────────────────────────────────────────────────────────────
// There is no drawer in this shop, so after a successful add two things happen and both matter: the header
// badge's number changes (and pops — `SacolaBadge`), and this button says "Adicionado" for a moment. The
// second one is not decoration: under `prefers-reduced-motion` the pop is gone, and a shopper who saw
// nothing at all clicks again and buys two bags of coffee.
//
// ⚠️ A FAILED ADD SAYS SO. The optimistic version of this button — "Adicionado" on click — is a shop that
// tells a shopper their coffee is in the bag when the port refused. The label only changes after the action
// resolves, and a refusal says so instead.

import { formatMoney } from '@forgecommerce/storefront-kit/money';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { useState, useTransition } from 'react';
import { useMinicart } from '@/components/minicart/MinicartProvider';
import { grindIcon, PathIcon } from '@/components/coffee/icons';
import {
  DEFAULT_PLAN,
  initialSelection,
  isSubscribable,
  OFFERED_PLANS,
  type PlanKey,
  PLAN_FIELD,
  SUBSCRIBER_PERCENT_LABEL,
  skuForSelection,
  subscriptionAmount,
} from '@/lib/coffee/subscription';
import styles from './coffee.module.css';

export type BuyBoxProps = {
  product: ProductDoc;
  /** Adds the chosen sku, with the line's declared fields. Bound to the store by the server. */
  addLine: (skuIds: string[], qty: number, customFields: Record<string, string>) => Promise<void>;
};

const MAX_QTY = 9;

export function CoffeeBuyBox({ product, addLine }: BuyBoxProps) {
  const [chosen, setChosen] = useState<Record<string, string>>(() => initialSelection(product));
  const [subscribed, setSubscribed] = useState(false);
  const [plan, setPlan] = useState<PlanKey>(DEFAULT_PLAN);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const { refresh } = useMinicart();

  const sku = skuForSelection(product, chosen);
  const canSubscribe = isSubscribable(sku);
  // ⚠️ THE MODE FOLLOWS THE BAG. Picking a 1 kg that the merchant did not curate must not leave the page
  // showing a subscription option for a bag that cannot be subscribed — so the flag is READ here rather
  // than trusted from state. The shopper's intent is remembered; what is DRAWN is what is true.
  const isSub = subscribed && canSubscribe;

  const once = sku?.amount ?? 0;
  const unit = isSub ? subscriptionAmount(once) : once;
  const currency = sku?.currency ?? 'BRL';

  const options = [...(product.options ?? [])].sort((a, b) => a.position - b.position);

  function pick(optionId: string, valueId: string) {
    setChosen((prev) => ({ ...prev, [optionId]: valueId }));
    setAdded(false);
    setFailed(false);
  }

  function add() {
    if (!sku) return;
    setAdded(false);
    setFailed(false);
    startTransition(async () => {
      try {
        // The ONE line of subscription integration: the plan travels as the line's declared field.
        await addLine([sku.id], qty, isSub ? { [PLAN_FIELD]: plan } : {});
        await refresh();
        setAdded(true);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className={styles.buybox}>
      {options.map((option) => {
        const values = [...option.values].sort((a, b) => a.position - b.position);
        const isGrind = /moagem|grind/i.test(option.name);
        return (
          <div className={styles.axis} key={option.id}>
            <div className={styles.axisLabel}>{option.name}</div>
            <div className={styles.axisValues}>
              {values.map((value) => {
                const active = chosen[option.id] === value.id;
                const icon = isGrind ? grindIcon(value.value) : null;
                return (
                  <button
                    type="button"
                    key={value.id}
                    onClick={() => pick(option.id, value.id)}
                    aria-pressed={active}
                    className={
                      icon ? (active ? styles.chipOn : styles.chip) : active ? styles.pillOn : styles.pill
                    }
                  >
                    {icon ? <PathIcon d={icon} size={19} strokeWidth={1.3} /> : null}
                    <span>{value.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ⚠️ A COMBINATION THE MERCHANT NEVER CREATED SAYS SO. Silently selling the nearest bag is the one
       * behaviour that costs a shopper money they did not agree to. */}
      {!sku ? (
        <p className={styles.unavailable} role="status">
          Essa combinação não está à venda. Escolha outra moagem ou outro peso.
        </p>
      ) : null}

      <div className={styles.modes}>
        <button
          type="button"
          onClick={() => {
            setSubscribed(false);
            setAdded(false);
          }}
          className={!isSub ? styles.modeOn : styles.mode}
          aria-pressed={!isSub}
        >
          <span className={styles.modeLeft}>
            <span className={!isSub ? styles.dotOn : styles.dotOff} />
            <span className={styles.modeName}>Compra única</span>
          </span>
          <span className={styles.modePrice}>{formatMoney(once, currency)}</span>
        </button>

        {/* ★ THE SUBSCRIPTION OPTION IS NOT DRAWN AT ALL for a bag the merchant did not curate. Not
         * disabled, not greyed: absent. A disabled control is an offer with an apology attached. */}
        {canSubscribe ? (
          <div className={isSub ? styles.modeBoxOn : styles.modeBox}>
            <button
              type="button"
              onClick={() => {
                setSubscribed(true);
                setAdded(false);
              }}
              className={styles.modeInner}
              aria-pressed={isSub}
            >
              <span className={styles.modeLeft}>
                <span className={isSub ? styles.dotOn : styles.dotOff} />
                <span className={styles.modeName}>Assinatura</span>
              </span>
              <span className={styles.modeLeft}>
                <span className={styles.was}>{formatMoney(once, currency)}</span>
                <span className={styles.subPrice}>
                  {formatMoney(subscriptionAmount(once), currency)}
                </span>
              </span>
            </button>

            <div className={isSub ? styles.freqs : styles.freqsOff}>
              <div className={styles.freqRow}>
                {OFFERED_PLANS.map((p) => (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => setPlan(p.key)}
                    aria-pressed={plan === p.key}
                    className={plan === p.key ? styles.freqOn : styles.freq}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className={styles.perks}>
                <span>Frete grátis</span>
                <span>{SUBSCRIBER_PERCENT_LABEL} OFF sempre</span>
                <span>Pause quando quiser</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.buyRow}>
        <div className={styles.stepper}>
          <button
            type="button"
            aria-label="Menos"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className={styles.stepBtn}
          >
            −
          </button>
          <span className={styles.qty}>{qty}</span>
          <button
            type="button"
            aria-label="Mais"
            onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
            className={styles.stepBtn}
          >
            +
          </button>
        </div>
        <button type="button" onClick={add} disabled={!sku || pending} className={styles.add}>
          {failed
            ? 'Não deu certo — tente de novo'
            : `${added ? 'Adicionado' : 'Adicionar'} · ${formatMoney(unit * qty, currency)}`}
        </button>
      </div>
    </div>
  );
}
