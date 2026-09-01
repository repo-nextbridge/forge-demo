// BUY ONCE OR SUBSCRIBE — this shop's own control, over the app's contract and nothing else.
//
// ── THE CONTRACT, MEASURED IN THE APP RATHER THAN ASSUMED ────────────────────────────────────────────────
//
//   · THE INTENTION rides the CART LINE as the app's declared custom field `sub_plan`
//     (`extensions/subscriptions/manifest.ts`, `owner_entity: 'cart_line'`, type `select`). The kernel
//     validates the value against the declaration on `cart.add_line` — a rhythm outside the vocabulary is
//     REFUSED, not silently stored — and freezes it onto the order line at `place_order`. This fork writes
//     the field and nothing else: no plumbing, no second model, no state of its own on the server.
//
//   · THE VOCABULARY is closed and it is the app's: weekly, biweekly, monthly, bimonthly, quarterly. What a
//     store OFFERS is a subset an operator changes on a Tuesday. This shop offers the three the design draws.
//     Closed vocabulary, open offer — and the keys are identity, compared byte for byte across the life of a
//     subscription somebody signed, which is why they are not translated anywhere but on screen.
//
//   · THE CURATION is on the SKU: `sku.metadata.sub_enabled === true`, strictly. Absent, null, false, the
//     STRING "true", a bag that is not an object — none of those is a mark. This is what keeps the Edição do
//     Produtor out of the subscription offer WITHOUT ONE LINE OF `if` naming it here: it is out because the
//     merchant did not mark it, and a seventh coffee is out until somebody marks it too.
//
// ── ⚠️ THE 10% HAS A TWIN, AND THIS IS ONE HALF OF IT ────────────────────────────────────────────────────
// The other half is the promotion in `seed/coffee.mjs` (`percent_bp: 1000`, target `custom_field sub_plan
// exists`), which is what the checkout actually takes off. They cannot be one constant: one lives in a
// container and the other in a database.
//
// It is a duplication and it was chosen over the alternatives with the port measured first: the anonymous
// face publishes only `sku.promotional_price`, stamped with NO buyer and NO line — and a `custom_field`
// target is a fact of the line the shopper builds, which does not exist until the line is in the cart. The
// reads that can answer (`promotion_simulate`, `promotion_store`) are the INTERNAL face, behind
// `promotion.read`, which a storefront page may not hold. So the number is repeated, each file names the
// other, and the kanban carries `DERIVAR-DESCONTO-DE-LINHA` with what the port would need to end it.
//
// CHANGE THIS AND CHANGE `seed/coffee.mjs`.

import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';

type Sku = ProductDoc['skus'][number];

/** The app's key on the SKU bag (`@forgecommerce/ext-subscriptions`, `subscribable.ts`). */
const SUB_ENABLED_FIELD = 'sub_enabled';

/** The app's declared cart-line field (`cycle.ts`, `PLAN_FIELD`). The name the kernel validates against. */
export const PLAN_FIELD = 'sub_plan';

/** The subscriber discount, in basis points. ⚠️ TWIN of `seed/coffee.mjs` — see the header. */
export const SUBSCRIBER_PERCENT_BP = 1000;

/** The rhythms this store offers, in the app's own vocabulary, with the words the design shows. The KEY is
 *  what travels to the kernel; the label is only ever read by a human. */
export const OFFERED_PLANS = [
  { key: 'weekly', label: 'Semanal' },
  { key: 'biweekly', label: 'Quinzenal' },
  { key: 'monthly', label: 'Mensal' },
] as const;

export type PlanKey = (typeof OFFERED_PLANS)[number]['key'];

/** The rhythm a shopper lands on. Quinzenal: the middle of the three, and the one a bag of coffee actually
 *  runs out on — a default is a recommendation whether or not it was meant as one. */
export const DEFAULT_PLAN: PlanKey = 'biweekly';

/**
 * Is THIS SKU one the merchant curated into the subscription offer?
 *
 * ⚠️ STRICT `=== true`, not truthiness, and the strictness is the whole default. This bag arrives over a
 * PUBLIC face that also accepts undeclared keys, so `"false"` — a string, and truthy — is a value somebody
 * can put there. Every state of the world other than the boolean `true` means NOT MARKED, which is what
 * makes an app installed and untouched change no product page.
 */
export function isSubscribable(sku: Sku | undefined): boolean {
  const bag = sku?.metadata;
  if (typeof bag !== 'object' || bag === null) return false;
  return (bag as Record<string, unknown>)[SUB_ENABLED_FIELD] === true;
}

/**
 * What a subscribed unit costs, from what one costs once.
 *
 * Integer arithmetic in CENTS, rounding HALF UP to the cent — the same direction the kernel's percentage
 * benefit rounds. A page that rounded the other way would advertise a price one cent below what the
 * checkout charges, which is the only rounding error a shopper ever notices.
 */
export function subscriptionAmount(onceAmount: number): number {
  return Math.round((onceAmount * (10_000 - SUBSCRIBER_PERCENT_BP)) / 10_000);
}

/** The percentage as a human reads it — derived from the basis points, never written twice. */
export const SUBSCRIBER_PERCENT_LABEL = `${SUBSCRIBER_PERCENT_BP / 100}%`;

/**
 * The SKU a set of chosen option values resolves to.
 *
 * Matching is by the option VALUE ids the port serves, so nothing here depends on a label a merchant may
 * rename. A combination the merchant never created (a 1 kg of a coffee sold only in 250 g) resolves to
 * `undefined`, and the buy box has to be able to say so rather than silently sell a different bag.
 */
export function skuForSelection(
  product: ProductDoc,
  chosen: Readonly<Record<string, string>>,
): Sku | undefined {
  const wanted = Object.entries(chosen);
  if (wanted.length === 0) return undefined;
  return (product.skus ?? []).find(
    (sku) =>
      sku.status === 'active' &&
      wanted.every(([optionId, valueId]) =>
        sku.option_values.some((ov) => ov.option_id === optionId && ov.value_id === valueId),
      ),
  );
}

/** The option values a page opens on: the starred SKU's own combination when the merchant starred one, else
 *  the first value of each axis. Either way the page opens on something that EXISTS. */
export function initialSelection(product: ProductDoc): Record<string, string> {
  const starred = (product.skus ?? []).find((s) => s.is_default);
  if (starred) {
    return Object.fromEntries(starred.option_values.map((ov) => [ov.option_id, ov.value_id]));
  }
  const chosen: Record<string, string> = {};
  for (const option of product.options ?? []) {
    const first = [...option.values].sort((a, b) => a.position - b.position)[0];
    if (first) chosen[option.id] = first.id;
  }
  return chosen;
}
