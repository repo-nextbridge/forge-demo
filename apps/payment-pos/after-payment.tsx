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
// Presentational, SEMANTIC THEME TOKENS only. Hook-free by design (see payment-options.tsx).

import styles from './notice.module.css';

/** The initiate's envelope, as this app's provider produced it. Declared HERE rather than imported: an app
 * never imports the storefront. */
export type PaymentNextAction = { type: string; data: Record<string, unknown> } | null;

export type AfterPaymentProps = {
  /** The NEUTRAL kernel method the order was placed with. */
  method: string;
  /** The neutral payment status (read.payment). `card` settles at initiate, so `approved` is its normal case;
   * `pix` is `pending` until somebody pays it. */
  status: string;
  nextAction?: PaymentNextAction;
  config?: Record<string, unknown>;
};

/** The PIX copy-paste string the provider put in its own envelope, when this render has one. Read defensively:
 * a front may hand the block a persisted envelope, a null, or the cleaned `settled` one. */
function copyPasteOf(nextAction: PaymentNextAction): string | null {
  const value = nextAction?.type === 'pos_pix_qr' ? nextAction.data.copy_paste : undefined;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function AfterPayment({ method, status, nextAction = null }: AfterPaymentProps) {
  if (method !== 'pix' && method !== 'card') return null;
  if (status === 'rejected') {
    return (
      <div className={styles.root} data-testid="pos-after-payment">
        <p className={styles.title}>Pagamento não concluído</p>
        <p className={styles.note}>Fale com o atendente do balcão para tentar de novo.</p>
      </div>
    );
  }
  if (status === 'approved') {
    return (
      <div className={styles.root} data-testid="pos-after-payment">
        <p className={styles.approved}>Pagamento confirmado.</p>
        <p className={styles.note}>Retire no balcão quando chamarmos o seu nome.</p>
      </div>
    );
  }
  // Not settled yet. For `card` this is a hiccup and the honest less is all this block may say; for `pix` it
  // is the normal state, and the copy-paste is the whole point of rendering at all.
  const copyPaste = copyPasteOf(nextAction);
  return (
    <div className={styles.root} data-testid="pos-after-payment">
      <p className={styles.title}>Aguardando o pagamento</p>
      {copyPaste ? (
        <>
          <p className={styles.note}>Escaneie o QR ou use o código PIX abaixo:</p>
          <p className={styles.code}>{copyPaste}</p>
        </>
      ) : (
        <p className={styles.note}>Assim que o pagamento for reconhecido, o pedido é confirmado.</p>
      )}
    </div>
  );
}

export default AfterPayment;
