'use client';

// THE COUNTER'S FLOW — the seven screens of the artboard, in one client component.
//
// ★ WHY ONE COMPONENT AND NOT SEVEN ROUTES. A totem has no address bar, no back button and no bookmarks; the
// only navigation is a finger, and every step has to be instant and must never blink. Routes would give the
// panel a white frame between taps and would put the flow's state — the bag, the name, the chosen method —
// into a URL nobody can see. So the screens are states of one panel, exactly as the artboard drew them on
// one page.
//
// ★★ AND EVERY NUMBER ON IT COMES BACK FROM THE KERNEL. Each action returns the fresh bag; this file never
// adds, discounts or totals. `bag.totalLabel` is `read.checkout`'s `total_amount`, formatted — which is what
// makes "the coupon takes exactly 10%" a fact about the store and not about this file.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addItem,
  applyCoupon,
  changeQty,
  openProduct,
  payWith,
  removeCoupon,
  removeItem,
  resetCounter,
  simulatePixPayment,
  type BagResult,
} from '@/app/actions';
import type { Menu } from '@/lib/menu';
import type { CounterMethod, PosOutcome } from '@/lib/pos';
import { deltaFor, priceLabelOf, type ProductDetail, skuFor } from '@/lib/product-select';
import { money } from '@/lib/money';
import type { Bag } from '@/lib/view';
import { BagIcon, CardTerminalIcon, DecorativeQr, PixIcon } from './Icons';
import styles from './Totem.module.css';

/** The artboard's two keyboards. Letters for a name, letters + digits for a coupon. */
const NAME_KEYS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];
const COUPON_KEYS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ...NAME_KEYS,
];

const NAME_MAX = 14;
const COUPON_MAX = 16;

type Screen = 'menu' | 'cart' | 'identify' | 'terminal' | 'pix' | 'done';

type Paid = { outcome: PosOutcome; orderNumber: number; buyerName: string; bag: Bag };

export function Totem({
  initialMenu,
  initialBag,
  idleSeconds,
}: {
  initialMenu: Menu;
  initialBag: Bag;
  idleSeconds: number;
}) {
  const [menu, setMenu] = useState(initialMenu);
  const [bag, setBag] = useState(initialBag);
  const [screen, setScreen] = useState<Screen>('menu');
  const [attract, setAttract] = useState(true);
  const [active, setActive] = useState<string>('cafes');
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [bump, setBump] = useState(false);
  const [toast, setToast] = useState<{ text: string; warn: boolean } | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [name, setName] = useState('');
  const [method, setMethod] = useState<CounterMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<Paid | null>(null);

  const scroller = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((text: string, warn = false) => {
    setToast({ text, warn });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), warn ? 3200 : 1600);
  }, []);

  /** The panel is a fixed 1080×1920 and is SCALED to whatever glass it lands on. Never a reflow. */
  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920, 1);
      document.documentElement.style.setProperty('--totem-scale', String(s));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  /**
   * ★★ THE RESET BETWEEN CUSTOMERS — the whole reason a kiosk is different from a phone.
   *
   * Any touch anywhere restarts the clock. When it runs out the screen goes back to "Toque para começar" AND
   * the cart pointer is destroyed on the SERVER (the cookie is httpOnly, so only a server action can clear
   * it) — which is what makes the next person's basket empty rather than merely hidden.
   *
   * ⚠️ THE ATTRACT SCREEN ITSELF DOES NOT ARM THE TIMER. A totem nobody is using would otherwise reset
   * itself every 90 seconds forever, posting a write to the kernel each time.
   */
  useEffect(() => {
    if (attract) return;
    let timer: ReturnType<typeof setTimeout>;
    const goHome = async () => {
      const { bag: empty } = await resetCounter();
      setBag(empty);
      setScreen('menu');
      setDetail(null);
      setCouponOpen(false);
      setCouponInput('');
      setName('');
      setMethod(null);
      setPaid(null);
      setAttract(true);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(goHome, idleSeconds * 1000);
    };
    arm();
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll'];
    for (const e of events) window.addEventListener(e, arm, true);
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, arm, true);
    };
  }, [attract, idleSeconds]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (bumpTimer.current) clearTimeout(bumpTimer.current);
    },
    [],
  );

  /** Every action answers with the kernel's bag; the two failures a counter must SAY get said. */
  const absorb = useCallback(
    (r: BagResult): boolean => {
      setBag(r.bag);
      if (r.ok) return true;
      if (r.kind === 'rate_limited')
        say(
          `O balcão recebeu muitos pedidos ao mesmo tempo. Tente de novo em ${r.retryAfterSeconds} segundos.`,
          true,
        );
      else say('Não foi possível concluir. Chame um atendente.', true);
      return false;
    },
    [say],
  );

  const onScroll = () => {
    const sc = scroller.current;
    if (!sc || !menu.visible) return;
    const base = sc.getBoundingClientRect().top;
    let act = menu.sections[0]?.id ?? 'cafes';
    for (const s of menu.sections) {
      const el = sc.querySelector(`#band-${s.id}`);
      if (el && el.getBoundingClientRect().top - base <= 300) act = s.id;
    }
    if (act !== active) setActive(act);
  };

  const goBand = (id: string) => {
    const sc = scroller.current;
    const el = sc?.querySelector(`#band-${id}`);
    if (!sc || !el) return;
    sc.scrollTo({
      top: el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 16,
      behavior: 'smooth',
    });
  };

  async function open(handle: string, kicker: string) {
    setBusy(true);
    const d = await openProduct(handle, kicker);
    setBusy(false);
    if (!d) {
      say('Esse item saiu do cardápio agora há pouco.', true);
      return;
    }
    setDetail(d);
    // Open on the cheapest variant, which is the price the card promised.
    const cheapest = d.variants.find((v) => v.skuId === d.defaultSkuId);
    setChosen(cheapest ? cheapest.valueIds.slice() : []);
    setQty(1);
  }

  const currentSku = detail ? skuFor(detail, chosen) : undefined;

  async function add() {
    if (!detail || !currentSku) return;
    setBusy(true);
    const r = await addItem(currentSku, qty);
    setBusy(false);
    if (absorb(r)) {
      say(`${qty}× ${detail.name} na sacola`);
      setBump(true);
      if (bumpTimer.current) clearTimeout(bumpTimer.current);
      bumpTimer.current = setTimeout(() => setBump(false), 320);
    }
    setDetail(null);
  }

  /**
   * ⚠️ THE COUPON IS SENT ONCE, ON A TAP, AND NEVER ON A RE-RENDER. `cart.apply_coupon` is capped at ten a
   * minute for the WHOLE counter (store + IP, and the totem is one address), so a field that re-submitted as
   * the customer typed would take the till down for a minute with nobody doing anything wrong.
   */
  async function submitCoupon() {
    if (!couponInput.trim() || busy) return;
    setBusy(true);
    const r = await applyCoupon(couponInput);
    setBusy(false);
    setCouponOpen(false);
    if (r.ok && r.bag.couponCode) say(`Cupom ${r.bag.couponCode} aplicado`);
    else if (r.ok) say('Esse cupom não vale para este pedido.', true);
    else absorb(r);
    if (r.ok) setBag(r.bag);
    setCouponInput('');
  }

  async function dropCoupon() {
    if (!bag.couponCode || busy) return;
    setBusy(true);
    const r = await removeCoupon(bag.couponCode);
    setBusy(false);
    absorb(r);
  }

  const readyToPay = bag.count > 0 && name.trim().length > 0 && method !== null;

  async function pay() {
    if (!readyToPay || !method || busy) return;
    setBusy(true);
    const r = await payWith(name, method);
    setBusy(false);
    if (!r.ok) {
      if (r.kind === 'rate_limited')
        say(
          `O balcão recebeu muitos pedidos ao mesmo tempo. Tente de novo em ${r.retryAfterSeconds} segundos.`,
          true,
        );
      else say('Não foi possível fechar o pedido. Chame um atendente.', true);
      return;
    }
    setPaid(r);
    // ★ `settled` IS THE WHOLE SIGNAL for the machine: by the time this returns, the order is already paid.
    // There is no polling and no `data.status` — see lib/pos.ts.
    setScreen(r.outcome.kind === 'settled' ? 'done' : 'pix');
  }

  async function simulate() {
    if (!paid || paid.outcome.kind !== 'pix_pending' || busy) return;
    setBusy(true);
    const r = await simulatePixPayment(paid.outcome.providerRef);
    setBusy(false);
    if (r.paid) setScreen('done');
    else say('O pagamento ainda não foi confirmado.', true);
  }

  // ── the counter is not visible on the public face yet ────────────────────────────────────────────────
  if (!menu.visible)
    return (
      <div className={styles.frame}>
        <div className={styles.panel}>
          <div className={styles.warming}>
            <div className={styles.warmingTitle}>O balcão está abrindo</div>
            <div className={styles.warmingNote}>
              A loja deste totem ainda não respondeu. Isso costuma durar alguns segundos depois de uma loja
              ser criada — a tela volta sozinha.
            </div>
          </div>
        </div>
      </div>
    );

  const sections = menu.sections;

  return (
    <div className={styles.frame}>
      <div className={styles.panel}>
        {screen === 'menu' && (
          <div className={styles.screen}>
            <div className={styles.menuHeader}>
              <div className={styles.headerWordmark}>forge.co</div>
              <div className={styles.headerTitle}>Faça seu pedido</div>
              <div className={styles.headerArrow}>
                <i />
              </div>
            </div>

            <div ref={scroller} className={styles.scroller} onScroll={onScroll}>
              <div className={styles.scrollerSpacer} />
              <div className={styles.sheet}>
                <div className={styles.rail}>
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goBand(s.id)}
                      className={`${styles.railItem} ${active === s.id ? styles.railItemOn : ''}`}
                    >
                      <div className={styles.railBar} />
                      <div className={styles.railDisc}>
                        {s.railImageUrl ? <img src={s.railImageUrl} alt="" /> : null}
                      </div>
                      <div className={styles.railLabel}>{s.title}</div>
                    </button>
                  ))}
                </div>

                <div className={styles.bands}>
                  {sections.map((s) => (
                    <div key={s.id} id={`band-${s.id}`} className={styles.band}>
                      <div className={styles.bandKicker}>
                        <span>{s.kicker}</span>
                        <i />
                      </div>
                      <div className={styles.bandTitle}>{s.title}</div>
                      <div className={styles.bandNote}>{s.note}</div>
                      <div className={styles.grid}>
                        {s.items.map((p) => (
                          <button
                            key={p.handle}
                            type="button"
                            className={styles.card}
                            onClick={() => open(p.handle, s.title)}
                          >
                            <div className={styles.cardShot}>
                              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : null}
                              {p.chip ? <div className={styles.chip}>{p.chip}</div> : null}
                            </div>
                            <div>
                              <div className={styles.cardName}>{p.name}</div>
                              <div className={styles.cardDesc}>{p.description}</div>
                            </div>
                            <div className={styles.cardFoot}>
                              <div>
                                <div className={styles.cardFrom}>{p.fromPrice ? 'a partir de' : ''}</div>
                                <div className={styles.cardPrice}>{p.priceLabel}</div>
                              </div>
                              <div className={styles.cardPlus}>+</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.footer}>
              <button
                type="button"
                className={`${styles.bagButton} ${bump ? styles.bagBump : ''}`}
                onClick={() => setScreen('cart')}
              >
                <div className={styles.bagIconWrap}>
                  <BagIcon size={46} />
                  <div className={styles.bagCount}>{bag.count}</div>
                </div>
                <div>
                  <div className={styles.bagLabel}>Sacola</div>
                  <div className={styles.bagTotal}>{bag.totalLabel}</div>
                </div>
              </button>
              <button
                type="button"
                className={styles.primaryWide}
                onClick={() => setScreen('cart')}
                disabled={bag.count === 0}
              >
                <span>Revisar pedido</span>
                <span className={styles.arrow}>→</span>
              </button>
            </div>

            {detail ? (
              <div className={styles.overlay}>
                <button type="button" className={styles.scrim} onClick={() => setDetail(null)} aria-label="Fechar" />
                <div className={styles.modal}>
                  <button type="button" className={styles.modalClose} onClick={() => setDetail(null)}>
                    ×
                  </button>
                  <div className={styles.modalHead}>
                    <div className={styles.modalShot}>
                      {detail.imageUrl ? <img src={detail.imageUrl} alt={detail.name} /> : null}
                    </div>
                    <div className={styles.modalCopy}>
                      <div className={styles.modalKicker}>{detail.kicker}</div>
                      <div className={styles.modalName}>{detail.name}</div>
                      <div className={styles.modalDesc}>{detail.description}</div>
                    </div>
                  </div>

                  <div className={styles.axes}>
                    {detail.axes.map((axis, i) => (
                      <div key={axis.optionId} className={styles.axis}>
                        <div className={styles.axisLabel}>{axis.label}</div>
                        <div className={styles.axisOptions}>
                          {axis.values.map((v) => {
                            const on = chosen[i] === v.valueId;
                            const delta = deltaFor(detail, chosen, i, v.valueId);
                            return (
                              <button
                                key={v.valueId}
                                type="button"
                                className={`${styles.option} ${on ? styles.optionOn : ''}`}
                                onClick={() => {
                                  const next = chosen.slice();
                                  next[i] = v.valueId;
                                  setChosen(next);
                                }}
                              >
                                <span className={styles.optionName}>{v.label}</span>
                                <span className={styles.optionDelta}>
                                  {delta === null ? '' : delta > 0 ? `+ ${money(delta)}` : delta < 0 ? money(delta) : 'incluso'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.modalFoot}>
                    <div className={styles.stepper}>
                      <button type="button" className={styles.stepperKey} onClick={() => setQty(Math.max(1, qty - 1))}>
                        −
                      </button>
                      <div className={styles.stepperValue}>{qty}</div>
                      <button type="button" className={styles.stepperKey} onClick={() => setQty(Math.min(9, qty + 1))}>
                        +
                      </button>
                    </div>
                    <button type="button" className={styles.addButton} onClick={add} disabled={!currentSku || busy}>
                      <span>{currentSku ? 'Adicionar' : 'Indisponível'}</span>
                      <span className={styles.addTotal}>{priceLabelOf(detail, currentSku, qty)}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {attract ? (
              <button type="button" className={styles.attract} onClick={() => setAttract(false)}>
                <div className={styles.attractGlow} />
                <div className={styles.attractWordmark}>forge.co</div>
                <div className={styles.attractCopy}>
                  <div className={styles.attractTitle}>Toque para começar</div>
                  <div className={styles.attractKicker}>auto atendimento</div>
                </div>
                <div className={styles.attractShots}>
                  {sections
                    .map((s) => s.railImageUrl)
                    .filter((u): u is string => Boolean(u))
                    .slice(0, 4)
                    .map((u) => (
                      <div key={u} className={styles.attractShot}>
                        <img src={u} alt="" />
                      </div>
                    ))}
                </div>
                <div className={styles.attractFoot}>Pedido no totem · retire no balcão</div>
              </button>
            ) : null}
          </div>
        )}

        {screen === 'cart' && (
          <div className={styles.step}>
            <div className={styles.stepHeader}>
              <div className={styles.stepEyebrow}>Etapa 1 de 2</div>
              <div className={styles.stepTitle}>Seu pedido</div>
              <div className={styles.stepNote}>
                {bag.count === 1 ? '1 item · confira antes de pagar' : `${bag.count} itens · confira antes de pagar`}
              </div>
            </div>

            <div className={styles.stepBody}>
              {bag.lines.map((l) => (
                <div key={l.lineId} className={styles.line}>
                  <div className={styles.lineShot}>{l.imageUrl ? <img src={l.imageUrl} alt={l.name} /> : null}</div>
                  <div className={styles.lineCopy}>
                    <div className={styles.lineName}>{l.name}</div>
                    <div className={styles.lineVariant}>{l.variant}</div>
                    <button
                      type="button"
                      className={styles.removeLink}
                      onClick={async () => absorb(await removeItem(l.lineId))}
                    >
                      Remover
                    </button>
                  </div>
                  <div className={styles.lineStepper}>
                    <button
                      type="button"
                      className={styles.lineStepperKey}
                      onClick={async () => absorb(await changeQty(l.lineId, l.qty - 1))}
                    >
                      −
                    </button>
                    <div className={styles.lineStepperValue}>{l.qty}</div>
                    <button
                      type="button"
                      className={styles.lineStepperKey}
                      onClick={async () => absorb(await changeQty(l.lineId, l.qty + 1))}
                    >
                      +
                    </button>
                  </div>
                  <div className={styles.lineTotal}>{l.lineTotalLabel}</div>
                </div>
              ))}

              {bag.lines.length === 0 ? (
                <div className={styles.emptyBag}>
                  <div className={styles.emptyBagTitle}>Sua sacola está vazia</div>
                  <div className={styles.emptyBagNote}>Volte ao menu e escolha seu café</div>
                </div>
              ) : null}

              <button
                type="button"
                className={`${styles.couponButton} ${bag.couponCode ? styles.couponButtonOn : ''}`}
                onClick={() => (bag.couponCode ? dropCoupon() : (setCouponInput(''), setCouponOpen(true)))}
              >
                <div className={styles.couponMark}>%</div>
                <div className={styles.couponCopy}>
                  <div className={styles.couponTitle}>
                    {bag.couponCode ? `Cupom ${bag.couponCode} aplicado` : 'Adicionar cupom de desconto'}
                  </div>
                  <div className={styles.couponSub}>
                    {bag.couponCode
                      ? `${bag.discountTitle ?? 'Desconto'} no seu pedido · toque para remover`
                      : 'Toque para digitar o código do seu cupom'}
                  </div>
                </div>
                <div className={styles.couponIcon}>{bag.couponCode ? '✓' : '+'}</div>
              </button>
            </div>

            <div className={styles.stepFooter}>
              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <span>Subtotal</span>
                  <span>{bag.subtotalLabel}</span>
                </div>
                {bag.discountLabel ? (
                  <div className={`${styles.totalRow} ${styles.discountRow}`}>
                    <span>{bag.discountTitle}</span>
                    <span>{bag.discountLabel}</span>
                  </div>
                ) : null}
                <div className={styles.grandRow}>
                  <span className={styles.grandLabel}>Total</span>
                  <span className={styles.grandValue}>{bag.totalLabel}</span>
                </div>
              </div>
              <div className={styles.stepActions}>
                <button type="button" className={styles.ghostButton} onClick={() => setScreen('menu')}>
                  <span className={styles.arrow}>←</span>
                  <span>Adicionar mais itens</span>
                </button>
                <button
                  type="button"
                  className={styles.payButton}
                  onClick={() => setScreen('identify')}
                  disabled={bag.count === 0}
                >
                  <span>Ir para o pagamento</span>
                  <span className={styles.arrow}>→</span>
                </button>
              </div>
            </div>

            {couponOpen ? (
              <div className={styles.overlay} style={{ zIndex: 50 }}>
                <button type="button" className={styles.scrim} onClick={() => setCouponOpen(false)} aria-label="Fechar" />
                <div className={styles.couponDialog}>
                  <div>
                    <div className={styles.dialogTitle}>Cupom de desconto</div>
                    <div className={styles.dialogNote}>Digite o código do cupom e toque em adicionar</div>
                  </div>
                  <div className={styles.entry}>
                    <span className={`${styles.entryText} ${couponInput ? '' : styles.entryPlaceholder}`}>
                      {couponInput || 'CÓDIGO'}
                    </span>
                    <span className={styles.caret} />
                  </div>
                  <div className={styles.keyboard}>
                    {COUPON_KEYS.map((row, i) => (
                      <div key={row.join('')} className={styles.keyRow}>
                        {row.map((k) => (
                          <button
                            key={k}
                            type="button"
                            className={`${styles.key} ${styles.keySmall}`}
                            onClick={() => setCouponInput((v) => (v + k).slice(0, COUPON_MAX))}
                          >
                            {k}
                          </button>
                        ))}
                        {i === COUPON_KEYS.length - 1 ? (
                          <button
                            type="button"
                            className={`${styles.key} ${styles.keySmall} ${styles.keyMedium}`}
                            onClick={() => setCouponInput((v) => v.slice(0, -1))}
                          >
                            apagar
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className={styles.dialogActions}>
                    <button type="button" className={styles.dialogGhost} onClick={() => setCouponOpen(false)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.dialogPrimary}
                      onClick={submitCoupon}
                      disabled={!couponInput || busy}
                    >
                      Adicionar cupom
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {screen === 'identify' && (
          <div className={styles.step}>
            <div className={styles.stepHeader}>
              <div className={styles.stepEyebrow}>Etapa 2 de 2</div>
              <div className={styles.stepTitle}>Quem vai retirar?</div>
              <div className={styles.stepNote}>Chamamos esse nome quando o pedido ficar pronto</div>
            </div>

            <div className={styles.identifyBody}>
              <div className={styles.nameCard}>
                <div className={styles.fieldLabel}>Nome ou apelido</div>
                <div className={styles.nameValue}>
                  <span className={`${styles.nameText} ${name ? '' : styles.entryPlaceholder}`}>
                    {name || 'Seu nome'}
                  </span>
                  <span className={`${styles.caret} ${styles.caretTall}`} />
                </div>
              </div>

              <div className={styles.keyboard}>
                {NAME_KEYS.map((row, i) => (
                  <div key={row.join('')} className={styles.keyRow}>
                    {row.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={styles.key}
                        onClick={() => setName((v) => (v + k).slice(0, NAME_MAX))}
                      >
                        {k}
                      </button>
                    ))}
                    {i === 2 ? (
                      <>
                        <button
                          type="button"
                          className={`${styles.key} ${styles.keyWide}`}
                          onClick={() => setName((v) => (v + ' ').slice(0, NAME_MAX))}
                        >
                          espaço
                        </button>
                        <button
                          type="button"
                          className={`${styles.key} ${styles.keyMedium}`}
                          onClick={() => setName((v) => v.slice(0, -1))}
                        >
                          apagar
                        </button>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              <div>
                <div className={styles.fieldLabel}>Forma de pagamento</div>
                <div className={styles.methods}>
                  <button
                    type="button"
                    className={`${styles.method} ${method === 'pix' ? styles.methodOn : ''}`}
                    onClick={() => setMethod('pix')}
                  >
                    <div className={styles.methodIcon}>
                      <PixIcon size={54} />
                    </div>
                    <div className={styles.methodName}>Pix</div>
                    <div className={styles.methodDesc}>QR Code na tela · confirmação imediata</div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.method} ${method === 'card' ? styles.methodOn : ''}`}
                    onClick={() => setMethod('card')}
                  >
                    <div className={styles.methodIcon}>
                      <CardTerminalIcon size={54} />
                    </div>
                    <div className={styles.methodName}>Cartão</div>
                    <div className={styles.methodDesc}>Pague na maquininha ao lado do totem</div>
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.identifyFooter}>
              <button type="button" className={styles.ghostButton} onClick={() => setScreen('cart')}>
                <span className={styles.arrow}>←</span>
                <span>Voltar</span>
              </button>
              <button
                type="button"
                className={`${styles.payButton} ${styles.confirmButton}`}
                onClick={pay}
                disabled={!readyToPay || busy}
              >
                <span>Pagar {bag.totalLabel}</span>
                <span className={styles.arrow}>→</span>
              </button>
            </div>
          </div>
        )}

        {screen === 'terminal' && paid && (
          <div className={styles.terminal}>
            <div className={styles.terminalMark}>
              <CardTerminalIcon size={120} />
            </div>
            <div>
              <div className={styles.terminalTitle}>Pague na maquininha</div>
              <div className={styles.terminalNote}>
                Aproxime, insira ou passe o cartão na maquininha ao lado do totem. Aguardando a confirmação.
              </div>
            </div>
            <div className={styles.terminalFacts}>
              <div className={styles.factColumn}>
                <div className={styles.factLabel}>Pedido</div>
                <div className={styles.factValue}>{paid.orderNumber}</div>
              </div>
              <div className={styles.factDivider} />
              <div className={styles.factColumn}>
                <div className={styles.factLabel}>Total</div>
                <div className={`${styles.factValue} ${styles.factValueAccent}`}>{paid.bag.totalLabel}</div>
              </div>
            </div>
            <button type="button" className={styles.darkGhost} onClick={() => setScreen('identify')}>
              Trocar forma de pagamento
            </button>
          </div>
        )}

        {screen === 'pix' && paid && paid.outcome.kind === 'pix_pending' && (
          <div className={styles.step}>
            <div className={styles.pixHeader}>
              <div className={styles.stepEyebrow}>Pagamento via Pix</div>
              <div className={styles.pixTitle}>Escaneie o QR Code para pagar</div>
            </div>
            <div className={styles.pixBody}>
              <button type="button" className={styles.qrButton} onClick={simulate} disabled={busy}>
                <div className={styles.qrCanvas}>
                  <DecorativeQr payload={paid.outcome.copyPaste} />
                </div>
                <div className={styles.qrHint}>toque no QR Code para simular o pagamento</div>
              </button>
              <div className={styles.pixFacts}>
                <div className={styles.pixFact}>
                  <div className={styles.pixFactLabel}>Pedido</div>
                  <div className={styles.pixFactValue}>{paid.orderNumber}</div>
                </div>
                <div className={`${styles.pixFact} ${styles.pixFactStrong}`}>
                  <div className={styles.pixFactLabel}>Total a pagar</div>
                  <div className={styles.pixFactValue}>{paid.bag.totalLabel}</div>
                </div>
              </div>
              <div className={styles.pixNote}>Abra o app do seu banco · Pix · Pagar com QR Code</div>
            </div>
            <div className={styles.pixFooter}>
              <button type="button" className={styles.ghostButton} onClick={() => setScreen('identify')}>
                Trocar forma de pagamento
              </button>
            </div>
          </div>
        )}

        {screen === 'done' && paid && (
          <div className={styles.done}>
            <div className={styles.doneHeader}>
              <div className={styles.doneWordmark}>forge.co</div>
              <div className={styles.doneTitle}>Pagamento confirmado</div>
              <div className={styles.doneNote}>Estamos preparando o seu pedido agora</div>
            </div>
            <div className={styles.doneBody}>
              <div className={styles.numberCard}>
                <div className={styles.numberLabel}>Número do pedido</div>
                <div className={styles.numberValue}>{paid.orderNumber}</div>
                <div className={styles.numberName}>{paid.buyerName}</div>
              </div>
              <div className={styles.summary}>
                <div className={styles.fieldLabel}>Resumo do pedido</div>
                {paid.bag.lines.map((l) => (
                  <div key={l.lineId} className={styles.summaryRow}>
                    <div className={styles.summaryQty}>{l.qty}×</div>
                    <div className={styles.summaryCopy}>
                      <div className={styles.summaryName}>{l.name}</div>
                      <div className={styles.summaryVariant}>{l.variant}</div>
                    </div>
                    <div className={styles.summaryTotal}>{l.lineTotalLabel}</div>
                  </div>
                ))}
                <div className={styles.summaryGrand}>
                  <span className={styles.summaryGrandLabel}>
                    Total pago · {paid.outcome.kind === 'settled' ? 'Cartão na maquininha' : 'Pix'}
                  </span>
                  <span className={styles.summaryGrandValue}>{paid.bag.totalLabel}</span>
                </div>
              </div>
            </div>
            <div className={styles.doneFooter}>
              <div className={styles.doneCall}>Retire no balcão quando chamarmos {paid.orderNumber}</div>
              <div className={styles.doneCallNote}>Fique de olho no painel · tempo médio de 6 minutos</div>
            </div>
          </div>
        )}

        {toast ? (
          <div className={`${styles.toast} ${toast.warn ? styles.toastWarn : ''}`}>
            <span>{toast.text}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
