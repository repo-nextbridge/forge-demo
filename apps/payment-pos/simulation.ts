// THE SCAN DOOR'S DECISION, as a pure function — what this app will and will not accept as "somebody scanned
// the QR". It is separated from `provider.ts` so that the RULE can be read, tested and broken on purpose
// without a payment engine anywhere near it.
//
// ── ⚠️⚠️ READ THIS BEFORE YOU COPY ANY OF IT ──────────────────────────────────────────────────────────────
//
// THIS APP OPENS A PUBLIC, UNAUTHENTICATED DOOR THAT APPROVES A PAYMENT. That is not a slip and it is not
// hidden: the totem's "tap the QR to simulate the scan" has to reach the kernel somehow, and this is the
// mechanism. It is acceptable HERE, and only here, for one structural reason: this app belongs to a single box
// and is never offered to anybody (`forge.origin: "instance"`; the image that composes it is stamped
// `offerable: false` and the platform's release gate refuses to promote it). In an app we ship, this door
// would be a vulnerability. See README.md, which states the premise the safety rests on.
//
// WHAT ACTUALLY HOLDS THE DOOR SHUT — three things, and two of them are not in this file:
//   1. THE REF IS OPAQUE AND UNPREDICTABLE, and that is a PREMISE, not an accident. It is derived from the
//      attempt id, which the kernel generates and which leaves the kernel in exactly ONE place: inside the
//      `next_action` this app returns for that attempt's own `initiate`. Guessing it is guessing an id.
//   2. THE KERNEL REFUSES A REF THAT NAMES NO ATTEMPT (`payment.reconcile` → `validation_failed: intent not
//      found`). Not this app: this app has no database.
//   3. THE KERNEL REFUSES A SECOND SETTLEMENT (`update payment_intent … where status = 'pending'`; the second
//      caller changes no row, so there is no second `order.paid` and no second stock commit). Also not this
//      app.
// This file owns the fourth: it refuses anything that is not one of THIS app's open PIX charges. Do not look
// for (2) and (3) here, and do not add a copy of them: an app-side record of "already settled" would live
// outside the kernel's transaction, and the day the two disagree it would block a legitimate retry forever.

/** This app's PIX refs. A ref is the capability to settle one charge, so its prefix is also the statement of
 * WHICH method it belongs to, and the scan door reads it as such. */
export const POS_PIX_REF_PREFIX = 'pospix_';
/** This app's card refs. They exist so the ledger can name the charge; they are NEVER scannable, because a
 * machine charge is already settled by the time the ref exists. */
export const POS_CARD_REF_PREFIX = 'poscard_';

/** The event this app accepts at its scan door. Deliberately the SAME shape as the reference simulator's
 * (`{ provider_ref, event }`), because two vocabularies for one idea is how a caller ends up writing both. */
export type ScanEvent = { provider_ref: string; event: 'approved' | 'rejected' };

/** Why a payload was turned away. Two reasons, and they are different accidents: a caller that does not know
 * the shape, and a caller that knows the shape and named something this app will not settle. */
export type ScanRefusal = 'malformed_payload' | 'not_this_apps_pix_charge';

export type ScanDecision =
  | { ok: true; event: ScanEvent }
  | { ok: false; refusal: ScanRefusal; because: string };

/** The kernel's webhook adapter shapes the payload as `{ headers, query, body }`; a direct caller may hand the
 * event itself. Unwrap the first, accept the second, and trust NEITHER more than the other — the body is
 * non-authoritative in both, which is why everything below is a check and not a read. */
function unwrap(raw: unknown): unknown {
  if (typeof raw === 'object' && raw !== null && 'body' in raw) {
    return (raw as { body: unknown }).body;
  }
  return raw;
}

function isScanEvent(value: unknown): value is ScanEvent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ScanEvent>;
  return (
    typeof candidate.provider_ref === 'string' &&
    candidate.provider_ref.length > 0 &&
    (candidate.event === 'approved' || candidate.event === 'rejected')
  );
}

/**
 * Decide whether this payload is a scan this app will act on.
 *
 * ★ THE PREFIX CHECK IS THE GUARD, and it is deliberately positive: a ref is settled through this door only
 * if it is one this app MINTED FOR A PIX CHARGE. A card ref is refused by the same line, and that refusal is
 * not pedantry — a `pos_card` charge settled at `initiate`, so a scan for one is either a mistake or somebody
 * probing, and neither deserves a settlement.
 */
export function decideScan(raw: unknown): ScanDecision {
  const payload = unwrap(raw);
  if (!isScanEvent(payload)) {
    return {
      ok: false,
      refusal: 'malformed_payload',
      because: 'the payload is not this app’s scan event ({ provider_ref, event })',
    };
  }
  if (!payload.provider_ref.startsWith(POS_PIX_REF_PREFIX)) {
    return {
      ok: false,
      refusal: 'not_this_apps_pix_charge',
      because: 'the ref is not one of this app’s open PIX charges',
    };
  }
  return { ok: true, event: payload };
}

/** The ref for one PIX charge. DERIVED FROM THE ATTEMPT and nothing else: the kernel keys idempotency on the
 * attempt id, so re-invoking one attempt has to reach the same charge at the provider. A random or a
 * timestamp here would break that quietly and orphan the first ref. */
export function posPixRef(idempotencyKey: string): string {
  return `${POS_PIX_REF_PREFIX}${idempotencyKey}`;
}

/** The ref for one machine charge. Same derivation, same reason. */
export function posCardRef(idempotencyKey: string): string {
  return `${POS_CARD_REF_PREFIX}${idempotencyKey}`;
}

/**
 * A DECORATIVE PIX copy-paste string, shaped like a BR Code and deterministic from the ref.
 *
 * ⚠️ IT IS NOT SCANNABLE AND MUST NEVER BE PRESENTED AS IF IT WERE. Nobody pays a simulator. It looks the part
 * so the totem's QR has something real-shaped to draw, and the totem's own copy says the environment is a
 * demo. Same trick, and the same warning, as the reference app's `fakePixCode`.
 */
export function fakePixCode(providerRef: string): string {
  const token = providerRef
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .padEnd(20, '0')
    .slice(0, 20);
  const crc = token.slice(0, 4);
  return `00020126580014BR.GOV.BCB.PIX0136${token}FORGEBALCAO00QR5204000053039865802BR5912FORGE BALCAO6009SAO PAULO62070503***6304${crc}`;
}
