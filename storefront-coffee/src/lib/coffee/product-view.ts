// WHAT A COFFEE LOOKS LIKE TO THIS SHOP'S PAGES — the whole mapping from what the port serves to what the
// design draws, in one PURE module so every rule below can be tested without a kernel.
//
// ── WHERE THE DATA ACTUALLY COMES FROM, measured against the port rather than assumed ────────────────────
//
// A product's own fields (`title`, `description`, `media`) are the port's. Everything else the design shows
// — the region, the roast, the tasting notes, the SCA score, the subtitle — rides `ProductDoc.metadata`,
// which IS the custom-field bag: `custom_field.define({owner_entity:'product'})` writes into the product's
// `metadata` column, the projection copies it into the doc, and the kernel's own faceting reads it back with
// `jsonb_each_text(doc->'metadata')`. So `cf.*` needs no new read and no new field: it is already here.
//
// ⚠️ WHAT THE PORT DOES NOT SERVE, AND WHY THIS FILE CARRIES A LABEL TABLE. The anonymous face publishes the
// VALUES but not the DECLARATIONS: `read.cart_custom_field_definitions` is the cart family only, and the
// product family's definitions live on the internal face behind `tenant.settings.read`. A storefront cannot
// ask what `regiao` is called or in what order the fields should read. So the shop names them itself, by the
// same convention it draws icons by — the fork owns its vocabulary, and the admin grows no screen for it.
//
// ── ⚠️ EVERY FIELD IS OPTIONAL, AND THAT IS THE DESIGN'S OWN RULE, NOT A CONCESSION ──────────────────────
// The catalogue is uneven on purpose (a blend has no altitude; only two coffees are scored). A page that
// needs all nine keys is a page that breaks on the seventh coffee somebody adds. Nothing here invents a
// placeholder: a value that is not there produces no row, no chip and no badge.

import { displaySku } from '@forgeco/storefront-kit/sku';
import type { ProductDoc } from '@forgeco/storefront-kit/read-client';

/** The bag, narrowed once. `metadata` is `unknown` on the wire and every reader below goes through here. */
function bagOf(product: ProductDoc): Record<string, unknown> {
  const meta = product.metadata;
  return typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>) : {};
}

/** One custom field as a trimmed string, or undefined. Numbers are accepted (`sca` may arrive either way);
 *  anything else — an object, a boolean, a blank string — is treated as absent. */
export function field(product: ProductDoc, key: string): string | undefined {
  const value = bagOf(product)[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * The tasting notes, as the chips draw them.
 *
 * The merchant writes ONE string ("chocolate ao leite, caramelo, nozes") because that is what a label says
 * and what an admin text field holds. Splitting is the shop's job, and it accepts the two separators a human
 * actually types — a comma and a middle dot — because a merchant who types the second one is not wrong, they
 * are copying the bag.
 */
export function notesOf(product: ProductDoc): string[] {
  const raw = field(product, 'notas');
  if (!raw) return [];
  return raw
    .split(/[,·]/)
    .map((note) => note.trim())
    .filter((note) => note !== '');
}

/**
 * The rows of the PDP's "Características" panel: the declared vocabulary, in the order a human reads it,
 * with the ones this coffee has no value for simply absent.
 *
 * ⚠️ THE ORDER IS THIS TABLE'S AND NOT THE BAG'S. `metadata` is JSON, so its key order is whatever the
 * writer happened to use — a panel built by iterating it would reorder itself when somebody edits a product.
 */
const SPEC_LABELS: readonly (readonly [key: string, label: string])[] = [
  ['notas', 'Notas sensoriais'],
  ['regiao', 'Região'],
  ['produtor', 'Produtor'],
  ['fazenda', 'Fazenda'],
  ['altitude', 'Altitude'],
  ['variedade', 'Variedades'],
  ['processo', 'Processo'],
  ['torra', 'Torra'],
  ['sca', 'Pontuação SCA'],
];

export type Spec = { key: string; label: string; value: string };

export function specsOf(product: ProductDoc): Spec[] {
  const rows: Spec[] = [];
  for (const [key, label] of SPEC_LABELS) {
    const value = field(product, key);
    if (value !== undefined) rows.push({ key, label, value });
  }
  return rows;
}

/**
 * The variant summary under a card's price — "Grãos · Filtrado · Espresso / 250g · 1kg".
 *
 * Built from the OPTIONS the port serves, never from a written string: a coffee sold only in beans, or only
 * in 200 g, says so without anybody remembering to edit a caption. A product with no options at all yields
 * an empty string and the card simply omits the line.
 */
export function variantSummary(product: ProductDoc): string {
  return (product.options ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((option) =>
      option.values
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((value) => value.value)
        .join(' · '),
    )
    .filter((axis) => axis !== '')
    .join(' / ');
}

export type PriceView = {
  /** What it costs today, in cents. */
  amount: number;
  /** The struck-through number, in cents, or undefined when there is no honest one to show. */
  compareAt?: number;
  currency: string;
};

/**
 * The price a card prints: the SKU that speaks for the product (the merchant's starred one, else the
 * cheapest — the kit's rule, shared with the buybox and the JSON-LD offer so the three never disagree).
 *
 * ⚠️ `compareAt` IS SHOWN ONLY WHEN IT IS ABOVE THE PRICE. A "was" that is equal or lower is not a discount,
 * it is a data entry left over from one — and struck through beside the same number it strikes, it reads as
 * a shop lying about a sale.
 */
export function priceOf(product: ProductDoc): PriceView | undefined {
  const sku = displaySku(product);
  if (!sku) return undefined;
  const promotional = sku.promotional_price;
  const amount = promotional ? promotional.promotional_amount : sku.amount;
  const compareCandidate = promotional ? promotional.unit_amount : sku.compare_at_amount;
  const compareAt =
    typeof compareCandidate === 'number' && compareCandidate > amount ? compareCandidate : undefined;
  return { amount, compareAt, currency: sku.currency };
}
