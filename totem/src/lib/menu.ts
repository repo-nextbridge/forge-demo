// THE MENU — the four bands of the counter, read from the port.
//
// ★ THE SECTIONS ARE KERNEL CATEGORIES, NOT A LIST IN THIS FILE. What IS in this file is the editorial copy
// the artboard carries and the kernel has no field for (the kicker over each band, the one-line note under
// its title, and the small chip on a card). That split is deliberate: prices, names, photographs, variants
// and availability are the store's and are read live; a sentence a designer wrote is the fork's own.
//
// ⚠️ THE CHIP DEGRADES TO NOTHING ON AN UNKNOWN HANDLE. It is keyed by the product handles frozen for this
// wave, and a product this map has never heard of simply renders without a chip. Inventing a word for it
// would be putting copy on a screen that no human wrote.
//
// ★★ A NULL LIST IS NOT AN EMPTY COUNTER, AND CONFUSING THE TWO WOULD PUT "we sell nothing" ON A SCREEN.
// The kit's read client returns `null` when the port answers 404 and a list when it answers 200 — and a
// store the public face does not know about is exactly a 404. That happens for real: the store→tenant map
// lives in `forge_control.store_directory` and is filled by an EVENT CONSUMER
// (packages/core/src/read/store-directory-consumer.ts), so a store created seconds ago is eventually
// consistent — `read.products` 404s and then, shortly after, 200s. Measured by the T-A slice, 2026-09-01.
//
// So the two answers are kept apart all the way to the screen: `null` → `visible: false`, the counter says
// it is warming up and the screen tries again; `[]` → the section is genuinely empty and says so. Nothing
// caches the negative answer, because the negative answer has a short shelf life by construction.

import type { CatalogList, ProductDoc } from '@forgeco/storefront-kit/read-client';
import type { MenuCard } from './menu-card';
import { coverOf, mediaSrc } from '@forgeco/storefront-kit/media/src';
import { money } from './money';
import { totemRead } from './port';
import { resolveTotemStore } from './store';

/**
 * ★★ THE FOUR BANDS, IN THE ORDER THE COUNTER SHOWS THEM — AND THE ORDER IS OURS, NOT THE KERNEL'S.
 *
 * This is the sentence that stops somebody "simplifying" this list into a loop over `read.categories`: a
 * kernel category HAS NO POSITION, and that read answers a MAP keyed by category id — an object, with no
 * order to trust and no field to sort by. Measured on the counter store, 2026-09-01:
 *
 *     GET /v1/read/categories?store=<balcao>
 *     → {"cat_01M1EYPQA4…":{"name":"Cafés","path":"cafes",…}, "cat_01M1EYPQA9…":{…}, …}
 *
 * The sequence the demo wants — Cafés, Especiais da casa, Comidas, Pra levar — is an EDITORIAL decision that
 * lives in the seed's own list and here. Reading it back out of the kernel is not possible, so it is written
 * down once, in the order it is meant to be walked.
 *
 * ⚠️ THE PATHS ARE `ltree` LABELS, WHICH IS WHY "PRA LEVAR" IS `pra_levar` AND NOT `pra-levar`. An ltree
 * label takes letters, digits and underscores — never a hyphen. The wave's frozen contract wrote the
 * hyphenated spelling, and it was never a shape the kernel could store; the counter store really carries
 * `cafes` (6 products), `especiais` (4), `comidas` (4) and `pra_levar` (7). Measured, same day.
 */
export const SECTIONS = [
  {
    id: 'cafes',
    category: 'cafes',
    kicker: 'Extraído na hora',
    title: 'Cafés',
    note: 'Espresso e coado feitos no balcão',
  },
  {
    id: 'especiais',
    category: 'especiais',
    kicker: 'Só aqui',
    title: 'Especiais da casa',
    note: 'Bebidas geladas cremosas, feitas com blends Forge',
  },
  {
    id: 'comidas',
    category: 'comidas',
    kicker: 'Do forno',
    title: 'Comidas',
    note: 'Assados ao longo do dia',
  },
  {
    id: 'pra-levar',
    category: 'pra_levar',
    kicker: 'Grãos e souvenirs',
    title: 'Pra levar',
    note: 'Torrados nesta semana, moídos na hora se você quiser',
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

/** The artboard's per-product chip, by the handle frozen for this wave. Absent → the card shows no chip. */
const CHIP_BY_HANDLE: Record<string, string> = {
  'espresso-forge': 'quente',
  'coado-do-dia': 'da semana',
  cappuccino: 'quente',
  latte: 'quente',
  mocha: 'quente',
  'cold-brew': 'gelado',
  'frappe-forge-chocolate': 'gelado',
  'frappe-caramelo-salgado': 'gelado',
  'frappe-morango-chocolate-branco': 'gelado',
  'chai-cremoso-gelado': 'gelado',
  'pao-de-queijo': 'do forno',
  croissant: 'do forno',
  'bolo-do-dia': 'do dia',
  'cookie-forge': 'do forno',
  'caneca-esmaltada': 'souvenir',
  'forge-alvorada': 'blend',
  'forge-serra-do-caparao': 'single origin',
  'forge-cerrado-mineiro': 'denominação',
  'forge-noturno': 'torra escura',
  'forge-descafeinado': 'descafeinado',
  'forge-edicao-do-produtor': 'lote numerado',
};

/** The counter's own one-liner off a product's metadata bag, or undefined. Never throws on a strange bag. */
function descTotemOf(p: ProductDoc): string | undefined {
  const bag = p.metadata;
  if (typeof bag !== 'object' || bag === null || Array.isArray(bag)) return undefined;
  const value = (bag as Record<string, unknown>).desc_totem;
  // An empty string is somebody clearing the field in the admin, and it must fall back like an absent one —
  // otherwise "I deleted the text" and "the card went blank" are the same gesture.
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export type MenuSection = {
  id: SectionId;
  kicker: string;
  title: string;
  note: string;
  items: MenuCard[];
  /** The photograph the side rail shows for this band: the first card's, so nothing new is authored. */
  railImageUrl: string | undefined;
};

export type Menu =
  | { visible: true; sections: MenuSection[] }
  | {
      /** The public face does not know this store YET (or at all). Never rendered as "the counter is empty". */
      visible: false;
    };

/** Active, purchasable SKUs of a product — the only ones whose price may appear on a counter. */
function sellableSkus(p: ProductDoc) {
  return p.skus.filter((s) => s.status === 'active');
}

/** The cheapest active SKU's amount, and whether the product has more than one price. */
function priceOf(p: ProductDoc): { cents: number; from: boolean } | undefined {
  const amounts = sellableSkus(p).map((s) => s.promotional_price?.promotional_amount ?? s.amount);
  if (amounts.length === 0) return undefined;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return { cents: min, from: min !== max };
}

function toCard(p: ProductDoc): MenuCard | undefined {
  const price = priceOf(p);
  if (!price) return undefined; // a product with no sellable sku has no price to put on a card
  return {
    handle: p.handle,
    name: p.title,
    description: p.description ?? '',
    descTotem: descTotemOf(p),
    imageUrl: mediaSrc(coverOf(p.media)).url,
    chip: CHIP_BY_HANDLE[p.handle],
    fromPrice: price.from,
    priceLabel: money(price.cents),
  };
}

/**
 * The whole menu, one read per band.
 *
 * ⚠️ ONE `null` MAKES THE WHOLE MENU INVISIBLE, and that is the cautious answer on purpose: a 404 means the
 * port could not resolve this store, which is a fact about the STORE and not about one category. Rendering
 * three bands and silently dropping the fourth would be the version of this that nobody notices.
 */
export async function readMenu(): Promise<Menu> {
  const store = resolveTotemStore();
  const lists = await Promise.all(
    SECTIONS.map((s) => totemRead().products(store.id, { category: s.category, limit: 50 })),
  );
  if (lists.some((l) => l === null)) return { visible: false };

  const sections = SECTIONS.map((s, i) => {
    const list = lists[i] as CatalogList;
    const items = list.items.map(toCard).filter((c): c is MenuCard => c !== undefined);
    return {
      id: s.id,
      kicker: s.kicker,
      title: s.title,
      note: s.note,
      items,
      railImageUrl: items[0]?.imageUrl,
    };
  });
  return { visible: true, sections };
}

export { cardDescription, type MenuCard } from './menu-card';
