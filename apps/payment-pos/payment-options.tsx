// PAYMENT OPTIONS — one of this app's two ROLE components (PAY-APP-SHAPE). A payment app declares hooks by
// ROLE, never by artifact: this one draws what the shopper sees BEFORE the action, its sibling
// (after-payment.tsx) what appears AFTER it. The checkout mounts the two roles wherever its layout puts them.
//
// ★ THE TOTEM RENDERS NEITHER OF THEM, AND THEY ARE STILL NOT OPTIONAL. The counter's screen is a fork with
// its own design (chips, fat buttons, a virtual keyboard) that talks to this app through the kernel and draws
// everything itself. But a payment app is not "the app for one front": the same install shows up in every
// checkout of the tenant, so an app without these two blocks is an app that renders a blank payment step
// somewhere. They are deliberately plain — enough to be correct on a front nobody has designed yet.
//
// Collects NOTHING. Neither method needs a field from the shopper: the card machine has already run, and PIX
// is a QR that appears after the order descends. So the checkout keeps its own finalize button, and this
// notice sits above it saying which of the two is about to happen.
//
// Presentational, SEMANTIC THEME TOKENS only. Hook-free by design — the render site CALLS this to learn
// whether the app draws anything at all in this role.

import styles from './notice.module.css';

/** What the shopper is told BEFORE they confirm, per neutral method. Both sentences describe a counter,
 * because that is the only place this app is ever installed. */
const BEFORE = {
  card: {
    title: 'Pague na maquininha',
    note: 'Passe ou aproxime o cartão na maquininha do balcão. O pedido é confirmado assim que a máquina aprovar.',
  },
  pix: {
    title: 'Pague com PIX',
    note: 'Um QR aparece na próxima tela. O pedido é confirmado assim que o pagamento for reconhecido.',
  },
} as const;

export type PaymentOptionsProps = {
  /** The NEUTRAL kernel method the shopper selected. This app serves `pix` and `card`. */
  method: string;
  /** This app's front-facing config (read.payment_methods). Part of the role's shape; unused today. */
  config?: Record<string, unknown>;
  /** Order total in CENTS + currency — part of the role's shape. This app takes any amount. */
  amount?: number;
  currency?: string;
  onSubmit?: (methodData: Record<string, unknown>) => Promise<void> | void;
  finalizeState?: 'idle' | 'processing' | 'approved' | 'declined' | 'error';
  finalizeLabel?: string;
};

/** This app never renders its own submit button: neither method collects anything, so the checkout's own
 * finalize places the order and the app answers in the same breath. */
export function ownsFinalize(): boolean {
  return false;
}

export function PaymentOptions({ method }: PaymentOptionsProps) {
  const copy = method === 'card' ? BEFORE.card : method === 'pix' ? BEFORE.pix : null;
  if (!copy) return null;
  return (
    <div className={styles.root} data-testid="pos-options">
      <p className={styles.title}>{copy.title}</p>
      <p className={styles.note}>{copy.note}</p>
    </div>
  );
}

export default PaymentOptions;
