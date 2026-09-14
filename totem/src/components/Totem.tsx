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
  resumePreviousOrder,
  simulatePixPayment,
  type BagResult,
} from '@/app/actions';
import type { Menu } from '@/lib/menu';
import { cardDescription } from '@/lib/menu-card';
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

/**
 * ★★ THE ROW THAT MAKES "JOÃO" POSSIBLE (s5-5, 03/09). The keyboard was A–Z, space and delete, so JOÃO, JOSÉ
 * and CONCEIÇÃO came out mutilated — and this is the one field a barista reads out loud to a room.
 *
 * ⚠️ IT IS ON THE NAME KEYBOARD ONLY, AND THE COUPON'S DELIBERATELY KEEPS A–Z0–9. A coupon code is an
 * identifier a merchant typed into the admin; offering Ç on it would invite a code that can never match.
 *
 * `À` IS ABSENT AND THAT IS A CHOICE, NOT AN OVERSIGHT: in Portuguese the grave accent marks a contraction,
 * never a given name, and eleven keys is what fits the panel's 960px of usable width without shrinking the
 * letters a wet finger has to hit.
 */
const NAME_ACCENT_KEYS = ['Á', 'Â', 'Ã', 'É', 'Ê', 'Í', 'Ó', 'Ô', 'Õ', 'Ú', 'Ç'];

/**
 * ★★ HOW LONG BEFORE THE RESET THE SCREEN ASKS (s5-3, 03/09). Measured on the bench: the till went back to
 * "Toque para começar" between 85s and 90s of stillness on the PAYMENT step — name typed, method chosen — with
 * no warning of any kind, and the bag was gone on the way back. A customer who looked down for their wallet
 * lost the whole order at the last tap.
 *
 * ⚠️ THE BAG STILL DIES, AND ON PURPOSE. "Preserve the basket instead" was the other half of the finding and
 * it is refused by the counter's own ruler: the person who walks up next must never inherit the previous
 * person's order — that is what `resetCounter` is FOR, and its own test says so. So the fix is not to keep the
 * bag longer, it is to stop taking it away from somebody who is still standing there. The warning is the
 * chance to say "I am still here"; ANY touch anywhere takes it, because any touch already re-arms the clock.
 *
 * It is a slice of `idleSeconds`, never a number of its own: a box configured with a 20-second window must not
 * warn 20 seconds before a reset that happens at 20.
 */
const IDLE_WARNING_SECONDS = 20;

const NAME_MAX = 14;
const COUPON_MAX = 16;

type Screen = 'menu' | 'cart' | 'identify' | 'terminal' | 'pix' | 'done';

type Paid = { outcome: PosOutcome; orderNumber: number; buyerName: string; bag: Bag };

/**
 * ★★ THE ORDER THIS BROWSER LEFT BEHIND — pk9/d1 (04/09), and the whole of it is one sentence on the glass.
 *
 * Present only when the cart behind the cookie already landed an order, which on a kiosk means exactly one
 * thing: somebody RELOADED the page instead of letting the till go home. Both fields are the port's own —
 * `number` is what the barista calls out and `awaitingPayment` is `display_status`, never a guess (page.tsx).
 *
 * ⚠️ THE TWO STATES ARE DIFFERENT INSTRUCTIONS, which is why it is not a boolean "something happened". A PAID
 * order needs nothing from anybody and the line exists only so the person who reloaded is not left wondering.
 * An order still AWAITING PAYMENT is a real order — and as of C5 (05/09) this screen can FINISH it.
 *
 * ★★ WHAT CHANGED, AND IT IS THE WHOLE OF THAT SLICE. The sentence pk9 wrote here said the till "can no
 * longer settle" such an order, because `providerRef` and the copy-and-paste lived in this component's state
 * and the reload destroyed them. That was true of the SCREEN and never true of the KERNEL: the envelope is
 * persisted on the payment attempt and `read.payment` publishes it verbatim. So the honest thing to say is no
 * longer "call somebody" — it is "toque para retomar", and `orderId` is what makes that tap able to name the
 * order it is recovering. `lib/pos.ts#recoverCounterPayment` carries the measurement.
 */
export type PreviousOrder = { orderId: string; number: number; awaitingPayment: boolean };

export function Totem({
  initialMenu,
  initialBag,
  idleSeconds,
  previousOrder = null,
}: {
  initialMenu: Menu;
  initialBag: Bag;
  idleSeconds: number;
  previousOrder?: PreviousOrder | null;
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
  /** The refusal that belongs INSIDE the dialog, beside the code that caused it. See `submitCoupon`. */
  const [couponError, setCouponError] = useState<string | null>(null);
  /** "Você ainda está aí?" — armed `IDLE_WARNING_SECONDS` before the reset. See the constant. */
  const [idleWarning, setIdleWarning] = useState(false);
  const [name, setName] = useState('');
  const [method, setMethod] = useState<CounterMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<Paid | null>(null);

  const scroller = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * ★★ THE LATCH `busy` COULD NOT BE (s5-4, 03/09) — AND THE REASON IS THAT `busy` IS STATE.
   *
   * Every write already opened with `if (… || busy) return;` and every button already carried
   * `disabled={busy}`, and two quick taps on "Pagar" still put TWO identical POSTs on the wire, with the
   * button still `disabled=false` afterwards. Both defences are one render behind the finger: `setBusy(true)`
   * schedules a re-render, so the second tap of the same tick reads the OLD `busy` and the `disabled`
   * attribute has not been written to the DOM yet. React batching is not a race the UI can win with state.
   *
   * A ref is written SYNCHRONOUSLY, so the second tap of the same tick sees the first one. That is the whole
   * mechanism, and it is why the guard drives real double taps rather than asserting on `disabled`.
   *
   * ⚠️ IT IS NOT THE ONLY DEFENCE AND MUST NOT BE READ AS ONE. `checkout.place_order` answers a duplicate
   * with the SAME order, so one that beats this latch does not become two. This is the cheap half, and it is
   * the half the customer sees: the till stops looking like it ignored them.
   *
   * ⚠️⚠️ AND "IDEMPOTENT BY THE CART" IS TOO LOOSE A WAY TO SAY IT — this comment used to, and pk9/d1 (04/09)
   * measured what the looseness hides. The kernel's own rule is a CONJUNCTION: the lines of that voyage are
   * gone AND the landing is recent (30 min) — "with lines it is a new voyage (the totem)", in its own words
   * (packages/core/src/commands/checkout.ts). Measured on the live counter, one cart, one set of lines, only
   * the header differing:
   *
   *     place_order, no idempotency-key         → a NEW order (ord_…D8R)
   *     place_order, a key already used         → the OLD order, replayed
   *
   * So a converted cart with something in it orders AGAIN, and what pins one cart to one order is the
   * `idempotency-key` this app sends — see `payWith` in app/actions.ts and `cartForThisCustomer` in
   * lib/cart.ts for why that is deliberate and where it had to be fenced.
   */
  const inFlight = useRef(false);
  /**
   * ★ THE IDLE CLOCK'S OWN RE-ARM, REACHABLE FROM OUTSIDE THE EFFECT THAT OWNS IT.
   *
   * ⚠️ WRITTEN BECAUSE THE GUARD CAUGHT IT: "Estou aqui" first only hid the question, on the reasoning that
   * every touch re-arms the clock anyway. It does — for a POINTER. The button's own activation is a `click`,
   * which a keyboard, an assistive device and `HTMLElement.click()` all produce without a `pointerdown`
   * anywhere, so the question vanished and the till reset on schedule regardless. The one button whose whole
   * job is to say "I am still here" must not depend on how the finger said it.
   */
  const rearmIdle = useRef<() => void>(() => {});

  /** Run one write at a time. The second caller of the same tick is dropped, not queued — see `inFlight`. */
  const exclusive = useCallback(async (run: () => Promise<void>): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await run();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

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
   * ★★★ THE ONE STATE IN WHICH STILLNESS IS NOT ABSENCE (p5-1, 03/09) — the live pix's own window, in
   * seconds, or `null` on every other screen.
   *
   * ── THE DEFECT, MEASURED. Pix chosen, "Pagar" tapped, ORDER #5 PLACED IN THE KERNEL, QR on the glass — and
   * at 90 seconds of stillness the till went home. The order stayed behind, "Aguardando", and the admin has no
   * way to close it (p7-3). The rodada-1 fix (`IDLE_WARNING_SECONDS`, s5-3 above) did not touch this case: it
   * made the reset polite, and a polite reset is still a reset.
   *
   * ── WHY THE FIX IS ABOUT STATE AND NOT ABOUT TIME. The inactivity clock measures ONE thing — "did the person
   * walk away?" — and its only evidence is stillness on the glass. That inference is sound on the menu, the
   * bag, the name and the method, where the next move is a finger. It is FALSE on exactly one screen: the QR,
   * where the next move is in the customer's banking app and stillness is precisely what PAYING looks like.
   * So there is no window long enough to fix this; the premise of the clock is what is wrong there.
   *
   * ── AND THE ASYMMETRY THAT SAYS WHICH WAY TO ERR. Before `place_order`, forgetting is free: the bag belongs
   * to somebody who left. After it, three measured facts make forgetting expensive.
   *   1. THE ORDER IS ALREADY IN THE KERNEL, and nothing this screen does removes it — `resetCounter` deletes
   *      a cart POINTER (see lib/cart.ts), and by this moment the cart is spent. So the reset never "cancels"
   *      anything; it only stops the totem from being able to finish.
   *   2. THE SCREEN HOLDS THE ONLY COPY OF THE CAPABILITY TO SETTLE IT. `providerRef` and `copy_paste` live in
   *      this component's state and nowhere else — never a URL, never a cookie (lib/pos.ts). The reset throws
   *      them away, and with them the "toque no QR" path.
   *   3. THE CUSTOMER LOSES THE ONE THING THEY CAME FOR. `orderNumber` is on this screen and on no other; a
   *      pix paid at second 91 is a paid order whose number its buyer never saw.
   *
   * ── SO THE INACTIVITY CLOCK STOPS, AND THE PAYMENT'S OWN CLOCK RUNS INSTEAD. `expires_in` is published by
   * `payment-pos` and was already read and thrown away (`PosOutcome.expiresInSeconds`, grepped: no reader
   * before this line). It is the honest clock for this screen because it measures the PAYMENT, not the
   * customer's attention: once the pix has expired the QR is worthless, so going home discards nothing that
   * still worked, and the till is not parked forever waiting on somebody who left.
   *
   * ★ AND IT IS THE KERNEL'S OWN WINDOW, NOT A NUMBER THE APP INVENTED FOR THE SCREEN. `payment-pos` sends
   * `PIX_EXPIRES_IN_SECONDS = 900` (apps/payment-pos/provider.ts) and declares the SAME 900 as its
   * `reservationWindowSeconds.pix` (apps/payment-pos/manifest.ts) — the time the kernel holds stock for an
   * unsettled intent. So the moment this timer fires is the moment the reservation behind the QR is gone. The
   * till frees itself exactly when, and never before, there is nothing left to free.
   *
   * ⚠️ MEASURED END TO END on the live counter, 03/09: order #6 placed, QR up, 110 SECONDS of absolute
   * stillness — the QR never left the glass, no question was asked, and the payment still completed from that
   * same screen. The positive control matters as much: the identical page, the identical observation, with
   * NOTHING placed, still asked at 70s and still went home at 90s.
   *
   * ⚠️ A WINDOW THAT IS NOT A POSITIVE NUMBER ARMS NOTHING AT ALL. `readOutcome` defaults to 900 only when
   * `expires_in` is absent; a literal `0` would arrive as a number and become an instant wipe of a QR that was
   * just drawn. A parked till is recoverable by a finger ("Trocar forma de pagamento"); a payment taken off
   * the glass is not.
   */
  const pixWindowSeconds =
    screen === 'pix' && paid?.outcome.kind === 'pix_pending' ? paid.outcome.expiresInSeconds : null;

  /**
   * ★★ THE COUNTER GOES HOME — ONE FUNCTION, BECAUSE THERE ARE NOW TWO WAYS TO REACH IT.
   *
   * It used to live inside the inactivity effect, where the clock was the only caller. The receipt screen
   * now has a button of its own (see `.doneFooter`), and a second copy of this reset would be a second
   * answer to "what does an empty till look like" — the two would drift the day a screen adds state.
   *
   * ⚠️ `resetCounter` IS A SERVER WRITE AND NOT A STATE CHANGE. The cart pointer is an httpOnly cookie, so a
   * reset that only cleared React state would look identical on the glass and leave the basket alive on the
   * next render. That is what `Totem.idle.test.tsx` measures, and the button inherits the same guarantee.
   */
  const goHome = useCallback(async () => {
    const { bag: empty } = await resetCounter();
    setBag(empty);
    setScreen('menu');
    setDetail(null);
    setCouponOpen(false);
    setCouponInput('');
    setCouponError(null);
    setIdleWarning(false);
    setName('');
    setMethod(null);
    setPaid(null);
    setAttract(true);
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
   *
   * ⚠️ AND NEITHER DOES A PIX WAITING TO BE PAID — see `pixWindowSeconds` for the measurement.
   */
  useEffect(() => {
    if (attract) return;
    let warn: ReturnType<typeof setTimeout>;
    let timer: ReturnType<typeof setTimeout>;
    // ★★★ PAYMENT IN FLIGHT: the inactivity clock is not armed at all, and neither is its question. What runs
    // in its place is the pix's own window — see `pixWindowSeconds` above for why one replaces the other.
    if (pixWindowSeconds !== null) {
      setIdleWarning(false);
      if (pixWindowSeconds <= 0) return;
      const expired = setTimeout(goHome, pixWindowSeconds * 1000);
      return () => clearTimeout(expired);
    }

    const arm = () => {
      clearTimeout(warn);
      clearTimeout(timer);
      setIdleWarning(false);
      // ★ THE WARNING IS A SLICE OF THE SAME WINDOW, NOT AN EXTENSION OF IT. The reset still happens at
      // `idleSeconds`; what changes is that the last `IDLE_WARNING_SECONDS` of it are spent asking. A window
      // shorter than the warning gets no warning rather than one that fires at zero.
      const warnAfter = (idleSeconds - IDLE_WARNING_SECONDS) * 1000;
      if (warnAfter > 0) warn = setTimeout(() => setIdleWarning(true), warnAfter);
      timer = setTimeout(goHome, idleSeconds * 1000);
    };
    arm();
    rearmIdle.current = arm;
    // ⚠️ ANY TOUCH DISMISSES THE QUESTION, and that is the answer to it — `arm` is already bound to every
    // touch on the panel, so "Estou aqui" needs no handler of its own to work. It has one anyway, because a
    // button a customer can see and press is what makes the question answerable rather than merely survivable.
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll'];
    for (const e of events) window.addEventListener(e, arm, true);
    return () => {
      clearTimeout(warn);
      clearTimeout(timer);
      rearmIdle.current = () => {};
      for (const e of events) window.removeEventListener(e, arm, true);
    };
  }, [attract, goHome, idleSeconds, pixWindowSeconds]);

  /**
   * ★★ THE BACK GESTURE STAYS INSIDE THE KIOSK (s5-6, 03/09).
   *
   * The whole flow is states of one panel on one URL, so the browser's history held exactly one entry for it —
   * and "back" left the application entirely (measured: `about:blank`). A totem in a chromeless shell has no
   * back button, but a stray edge swipe, a keyboard somebody plugged in, or a mouse's fourth key all produce
   * the same event, and the till is then a blank page nobody at the counter can recover.
   *
   * One sentinel entry is pushed and pushed again whenever a back consumes it, so the gesture is absorbed.
   *
   * ⚠️ IT DELIBERATELY DOES NOT MAP BACK ONTO THE FLOW'S STEPS. `screen` is the one truth about where the
   * customer is; a history stack mirroring it would be a second one, and the two disagree the moment a step is
   * added — a "back" that lands on a screen the flow already left is worse than a back that does nothing. The
   * screens have their own "Voltar" buttons, which are the ones a finger can find.
   */
  useEffect(() => {
    const guard = { forgeTotem: true };
    window.history.pushState(guard, '');
    const absorbBack = () => window.history.pushState(guard, '');
    window.addEventListener('popstate', absorbBack);
    return () => window.removeEventListener('popstate', absorbBack);
  }, []);

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
      // The kernel named this as the CUSTOMER's mistake (see `lib/coupon.ts`), so it gets the kernel's own
      // sentence and never "chame um atendente".
      else if (r.kind === 'coupon') say(r.message, true);
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
    await exclusive(async () => {
      const d = await openProduct(handle, kicker);
      if (!d) {
        say('Esse item saiu do cardápio agora há pouco.', true);
        return;
      }
      setDetail(d);
      // Open on the cheapest variant, which is the price the card promised.
      const cheapest = d.variants.find((v) => v.skuId === d.defaultSkuId);
      setChosen(cheapest ? cheapest.valueIds.slice() : []);
      setQty(1);
    });
  }

  const currentSku = detail ? skuFor(detail, chosen) : undefined;

  async function add() {
    if (!detail || !currentSku) return;
    const sku = currentSku;
    await exclusive(async () => {
      const r = await addItem(sku, qty);
      if (absorb(r)) {
        say(`${qty}× ${detail.name} na sacola`);
        setBump(true);
        if (bumpTimer.current) clearTimeout(bumpTimer.current);
        bumpTimer.current = setTimeout(() => setBump(false), 320);
      }
      setDetail(null);
    });
  }

  /**
   * ⚠️ THE COUPON IS SENT ONCE, ON A TAP, AND NEVER ON A RE-RENDER. `cart.apply_coupon` is capped at ten a
   * minute for the WHOLE counter (store + IP, and the totem is one address), so a field that re-submitted as
   * the customer typed would take the till down for a minute with nobody doing anything wrong.
   */
  /**
   * ★★ A CODE THE CUSTOMER GOT WRONG IS ANSWERED IN THE DIALOG, WITH THE CODE STILL IN IT (s5-2, 03/09).
   *
   * This used to close the dialog, wipe the field and raise "Não foi possível concluir. Chame um atendente."
   * for a coupon that simply does not exist — the system's voice for the customer's typo, and the one recovery
   * (fix the letter) made impossible by the same gesture. The kernel had said exactly what was wrong all along
   * (`details.reason: coupon_not_found`); the totem was throwing it away.
   *
   * ⚠️ ONLY A REAL SYSTEM FAILURE CLOSES THE DIALOG NOW, and the rule is "can retyping help?". A wrong code,
   * a code this cart does not qualify for, an exhausted code, even the rate limit — all of those are answered
   * where the keyboard is, because the next thing the person does is at that keyboard. An unrecognised refusal
   * is ours, so it keeps the attendant's sentence and closes.
   */
  async function submitCoupon() {
    if (!couponInput.trim()) return;
    await exclusive(async () => {
      const r = await applyCoupon(couponInput);
      setBag(r.bag);
      if (r.ok && r.bag.couponCode) {
        setCouponOpen(false);
        setCouponInput('');
        setCouponError(null);
        say(`Cupom ${r.bag.couponCode} aplicado`);
        return;
      }
      // ★ THE PORT ACCEPTED THE CALL AND THE CART CAME BACK WITHOUT A COUPON. Nothing was refused, so there is
      // no reason to read: the code exists and this basket does not qualify.
      if (r.ok) {
        setCouponError('Esse cupom não vale para este pedido.');
        return;
      }
      if (r.kind === 'coupon') {
        setCouponError(r.message);
        return;
      }
      if (r.kind === 'rate_limited') {
        setCouponError(
          `O balcão recebeu muitos pedidos ao mesmo tempo. Tente de novo em ${r.retryAfterSeconds} segundos.`,
        );
        return;
      }
      setCouponOpen(false);
      setCouponInput('');
      setCouponError(null);
      absorb(r);
    });
  }

  async function dropCoupon() {
    const code = bag.couponCode;
    if (!code) return;
    await exclusive(async () => {
      absorb(await removeCoupon(code));
    });
  }

  const readyToPay = bag.count > 0 && name.trim().length > 0 && method !== null;

  /**
   * ⚠️ THE ONE TAP THAT MUST NEVER HAPPEN TWICE. `exclusive` is what makes that true synchronously — see
   * `inFlight` for why `busy` and `disabled` were not enough, and `Totem.pay.test.tsx` for the double tap.
   */
  async function pay() {
    if (!readyToPay || !method) return;
    const chosenMethod = method;
    await exclusive(async () => {
      const r = await payWith(name, chosenMethod);
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
    });
  }

  /**
   * ★★★ PICK UP THE ORDER THIS BROWSER LEFT BEHIND (C5, 05/09) — the tap the attract panel now offers.
   *
   * ⚠️ IT IS A TAP AND NEVER A RENDER, deliberately. The attract panel redraws on its own (the idle clock,
   * the glow, a re-render for anything else); a recovery wired to the render would ask the port about an
   * order on every one of them. The kit says the same thing about the `resume` flag it is NOT using, and for
   * the same reason: a screen that polls a payment path is a screen that spends somebody's budget.
   */
  async function resume() {
    if (!previousOrder?.awaitingPayment) return;
    const orderId = previousOrder.orderId;
    await exclusive(async () => {
      const r = await resumePreviousOrder(orderId);
      if (!r.ok) {
        if (r.kind === 'rate_limited')
          say(`O balcão recebeu muitos pedidos ao mesmo tempo. Tente de novo em ${r.retryAfterSeconds} segundos.`, true);
        // ⚠️ `gone` IS NOT A BREAKAGE AND MUST NOT SOUND LIKE ONE. The order was paid while the screen was
        // away, or the attempt ended — the till is fine and the person needs a different instruction from
        // the one a refusal gives.
        else if (r.kind === 'gone')
          say('Esse pedido não está mais aguardando pagamento. Chame um atendente se precisar do comprovante.', true);
        else say('Não foi possível retomar o pagamento. Chame um atendente.', true);
        return;
      }
      setPaid(r);
      setAttract(false);
      // The same reading as `pay`: `settled` means it is already paid by the time this returns.
      setScreen(r.outcome.kind === 'settled' ? 'done' : 'pix');
    });
  }

  async function simulate() {
    if (!paid || paid.outcome.kind !== 'pix_pending') return;
    const ref = paid.outcome.providerRef;
    await exclusive(async () => {
      const r = await simulatePixPayment(ref);
      if (r.paid) setScreen('done');
      else say('O pagamento ainda não foi confirmado.', true);
    });
  }

  /**
   * ★★★ THE QUEUE'S WAY PAST A RECEIPT THAT IS NOT THEIRS (M9).
   *
   * ── THE DEFECT. The confirmation screen had no control on it at all: the only thing that cleared it was
   * the inactivity clock, so after "Pagamento confirmado" the glass held the previous customer's order
   * number, name and basket for the whole window — measured on the bench at ~90s — while the next person in
   * line stood reading somebody else's receipt and had no way to say "I am next".
   *
   * ⚠️ THE FIX IS A BUTTON, AND DELIBERATELY NOT A SHORTER WINDOW. A window tuned short enough to free the
   * till takes the receipt away from the person who is still writing down their number; one tuned long
   * enough to keep it blocks the queue. No number is both, so the answer is not a number — it is a target
   * for the finger that is already there. The inactivity reset stays exactly as it was, for the customer who
   * walks off without tapping anything.
   *
   * It is the SAME `goHome` the clock runs — server reset included — so "the next person never inherits the
   * previous person's order" holds however the till was freed.
   */
  async function newOrder() {
    await exclusive(goHome);
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
                              {/* A48 — the counter's own one-liner when the product has one, the short
                                  description when it does not. The MODAL below keeps `description`. */}
                              <div className={styles.cardDesc}>{cardDescription(p)}</div>
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
                  {/* ★★ pk9/d1 — the reload's only trace, said out loud. See `PreviousOrder`. */}
                  {previousOrder ? (
                    <div
                      className={styles.attractPrevious}
                      role="status"
                      data-testid="previous-order"
                    >
                      {previousOrder.awaitingPayment
                        ? `O pedido ${previousOrder.number} foi registrado mas ainda não foi pago. Use o botão abaixo para retomar o pagamento.`
                        : `O pedido ${previousOrder.number} foi registrado e pago. Toque para começar um novo.`}
                    </div>
                  ) : null}
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

            {/*
              ★★ THE WAY OUT OF AN UNPAID ORDER, AND IT IS A SIBLING OF THE ATTRACT PANEL — never a child.
              The panel is itself one big `<button>` (that is what makes the whole glass tappable), and a
              button inside a button is invalid HTML that React hydrates wrong. So this sits BESIDE it with a
              higher z-index: the panel keeps its "Toque para começar" for the next customer — the notice
              above is a line and never a wall, which pk9 asserted and this slice keeps — and the person who
              reloaded gets a target of their own.
            */}
            {attract && previousOrder?.awaitingPayment ? (
              <div className={styles.attractResumeBar}>
                <button
                  type="button"
                  className={styles.attractResume}
                  onClick={resume}
                  disabled={busy}
                  data-testid="resume-order"
                >
                  Retomar o pagamento do pedido {previousOrder.number}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {screen === 'cart' && (
          <div className={styles.step}>
            <div className={styles.stepHeader}>
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

              {/*
                ★★ B14 — THE COUPON IS OFFERED WHEN THERE IS SOMETHING TO DISCOUNT, AND NOT BEFORE.
                An empty review used to carry the whole card: "Adicionar cupom de desconto", a keyboard
                behind it, and a code the customer could type into a basket with no lines — `cart.apply_coupon`
                is capped at ten a minute for the WHOLE counter, so an invitation that can only be refused
                spends a shared budget on nothing. `bag.lines` is the condition rather than `couponCode`,
                because it is the LINES that a promotion takes its percentage of.
              */}
              {bag.lines.length > 0 ? (
                <button
                  type="button"
                  className={`${styles.couponButton} ${bag.couponCode ? styles.couponButtonOn : ''}`}
                  onClick={() =>
                    bag.couponCode
                      ? dropCoupon()
                      : (setCouponInput(''), setCouponError(null), setCouponOpen(true))
                  }
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
              ) : null}
            </div>

            <div className={styles.stepFooter}>
              {/*
                ★★ B14 — A SUM OF NOTHING IS NOT PRINTED. An empty review used to state **Subtotal R$ 0,00**
                and **Total R$ 0,00** in the same type as a real bill. Both are honest arithmetic and neither
                is a fact anybody needs: the screen already says "Sua sacola está vazia" above, and a total
                the size of the one a customer is about to pay reads as a price at a glance. The numbers come
                back the moment there is a line to total — they are never computed here either way.
              */}
              {bag.lines.length > 0 ? (
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
              ) : null}
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

            {/* The step seal, at the foot of the panel — see `stepSeal` in Totem.module.css for the measurement. */}
            <div className={styles.stepSeal}>Etapa 1 de 2</div>

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
                  {couponError ? (
                    <div className={styles.dialogError} role="alert">
                      {couponError}
                    </div>
                  ) : null}
                  <div className={styles.keyboard}>
                    {COUPON_KEYS.map((row, i) => (
                      <div key={row.join('')} className={styles.keyRow}>
                        {row.map((k) => (
                          <button
                            key={k}
                            type="button"
                            className={`${styles.key} ${styles.keySmall}`}
                            onClick={() => {
                              setCouponError(null);
                              setCouponInput((v) => (v + k).slice(0, COUPON_MAX));
                            }}
                          >
                            {k}
                          </button>
                        ))}
                        {i === COUPON_KEYS.length - 1 ? (
                          <button
                            type="button"
                            className={`${styles.key} ${styles.keySmall} ${styles.keyMedium}`}
                            onClick={() => {
                              setCouponError(null);
                              setCouponInput((v) => v.slice(0, -1));
                            }}
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
                <div className={styles.keyRow}>
                  {NAME_ACCENT_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`${styles.key} ${styles.keyAccent}`}
                      onClick={() => setName((v) => (v + k).slice(0, NAME_MAX))}
                    >
                      {k}
                    </button>
                  ))}
                </div>
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

            {/* The step seal, at the foot of the panel — see `stepSeal` in Totem.module.css for the measurement. */}
            <div className={styles.stepSeal}>Etapa 2 de 2</div>
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
                {/* A recovered order has no name to print: `read.order_confirmation` is PII-limited and does
                    not carry one (C5). An empty element reads as a broken card, so it is not drawn. */}
                {paid.buyerName ? <div className={styles.numberName}>{paid.buyerName}</div> : null}
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
              <button
                type="button"
                className={styles.newOrderButton}
                onClick={newOrder}
                disabled={busy}
                data-testid="new-order"
              >
                Novo pedido
              </button>
            </div>
          </div>
        )}

        {/* ★ THE QUESTION BEFORE THE RESET (s5-3). Not on `done`: there the order exists, its number is on the
            glass, and the till going home by itself is the correct end of the transaction — asking a customer
            who already paid whether they are still there would be the till doubting its own receipt. */}
        {idleWarning && screen !== 'done' ? (
          <div className={styles.overlay} style={{ zIndex: 70 }}>
            <div className={styles.scrim} />
            <div className={styles.idleDialog} role="alertdialog" aria-live="assertive">
              <div className={styles.dialogTitle}>Você ainda está aí?</div>
              <div className={styles.dialogNote}>
                Em instantes o balcão volta para a tela inicial e o seu pedido é apagado. Toque para continuar.
              </div>
              <button
                type="button"
                className={styles.dialogPrimary}
                onClick={() => rearmIdle.current()}
              >
                Estou aqui
              </button>
            </div>
          </div>
        ) : null}

        {toast ? (
          <div className={`${styles.toast} ${toast.warn ? styles.toastWarn : ''}`}>
            <span>{toast.text}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
