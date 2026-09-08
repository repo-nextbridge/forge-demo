// AFTER PAYMENT — this app's second ROLE component (PAY-APP-SHAPE): what the shopper sees AFTER the action.
// The hook is SEMANTIC, not positional: a checkout that drops a step, or renders everything on one page,
// mounts this role wherever it wants and this app is unaffected.
//
// ★ THE SECOND ROLE IS NOT THE FIRST ONE REPEATED, and here the two methods pull it in opposite directions,
// which is exactly why the role exists:
//   · `card` has already settled by the time this renders. It says so, in the past tense, and stops.
//   · `pix` has NOT. This is where the QR lives, and it must not congratulate anybody yet.
// Printing one sentence for both would be wrong for one of them at all times.
//
// ⚠️ THE `settled` ENVELOPE ARRIVES EMPTY, AND THAT IS THE KERNEL'S DOING, not a missing field. The adapter
// replaces a synchronous provider's envelope with a clean `{ type: 'settled', data: {} }` before it answers,
// so the verdict is never read off `nextAction` — it is read off `status`, which is the neutral payment status
// the kernel already resolved. Anything else here would be reading a field that is empty by design.
//
// ★★ THIS FILE DRAWS; IT DOES NOT DECIDE. Whether the counter may speak for an order at all — and what it may
// say — is `afterPaymentNotice()` in `./after-payment-notice`, which is JSX-free so that a test can execute it
// in a repository whose runner cannot load JSX (see the header there for the defect that split them, and for
// why only `'no'` is silence). The rule the guard holds this file to is exactly that split: nothing here
// compares a `method` or a `status`, because a second opinion about who was paid is how the wrong sentence got
// out the first time.
//
// Presentational, SEMANTIC THEME TOKENS only. Hook-free by design (see payment-options.tsx).

import {
  afterPaymentNotice,
  type PaymentNextAction,
  type SettledByThisApp,
} from './after-payment-notice';
import styles from './notice.module.css';

export type { PaymentNextAction, SettledByThisApp };

export type AfterPaymentProps = {
  /** ★★ pk23/p4 — WAS THIS CHARGE MINE? Answered by the RENDER SITE, which knows both which app it is calling
   * and who the kernel says took the money; never guessed here from the neutral method. `'no'` means another
   * installed payment app took this order's charge and this block must not speak for it. `'unknown'` (also the
   * default, for a storefront that predates the field) means nobody was named — no payment intent was ever
   * opened — and the block renders as it always did, because silence there would delete a legitimate screen.
   * Declared in `./after-payment-notice` rather than imported from the checkout: an app never imports the
   * storefront. */
  settledByThisApp?: SettledByThisApp;
  /** The NEUTRAL kernel method the order was placed with. REQUIRED and UNREAD, both on purpose: it is part of
   * the role's contract with the checkout and this app narrowing it would be this app editing that contract,
   * but nothing here branches on it — the old `method` condition was a GATE, and `status` alone ever chose the
   * words. A settled card and a settled PIX say the same thing at a counter. */
  method: string;
  /** The neutral payment status (read.payment). `card` settles at initiate, so `approved` is its normal case;
   * `pix` is `pending` until somebody pays it. */
  status: string;
  nextAction?: PaymentNextAction;
  config?: Record<string, unknown>;
};

export function AfterPayment({
  status,
  nextAction = null,
  settledByThisApp = 'unknown',
}: AfterPaymentProps) {
  const notice = afterPaymentNotice({ settledByThisApp, status, nextAction });
  if (!notice) return null;
  if (notice.kind === 'rejected') {
    return (
      <div className={styles.root} data-testid="pos-after-payment">
        <p className={styles.title}>Pagamento não concluído</p>
        <p className={styles.note}>Fale com o atendente do balcão para tentar de novo.</p>
      </div>
    );
  }
  if (notice.kind === 'approved') {
    return (
      <div className={styles.root} data-testid="pos-after-payment">
        <p className={styles.approved}>Pagamento confirmado.</p>
        <p className={styles.note}>Retire no balcão quando chamarmos o seu nome.</p>
      </div>
    );
  }
  return (
    <div className={styles.root} data-testid="pos-after-payment">
      <p className={styles.title}>Aguardando o pagamento</p>
      {notice.copyPaste ? (
        <>
          <p className={styles.note}>Escaneie o QR ou use o código PIX abaixo:</p>
          <p className={styles.code}>{notice.copyPaste}</p>
        </>
      ) : (
        <p className={styles.note}>Assim que o pagamento for reconhecido, o pedido é confirmado.</p>
      )}
    </div>
  );
}

export default AfterPayment;
