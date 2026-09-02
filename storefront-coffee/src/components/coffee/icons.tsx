// The icon set of this storefront, EXTRACTED from the design rather than redrawn.
//
// Every path below is copied verbatim from the two artboards this store was designed in (Forge Home,
// Forge PDP). A redrawn icon is an infidelity nobody asked for, and it is the kind that survives review
// because it looks fine — so the rule here is transcription, not interpretation.
//
// ── TWO SHAPES OF DATA, AND THE SPLIT IS THE ARTBOARD'S OWN ────────────────────────────────────────────
// `ICONS` holds the icons the design places by HAND (the header's two, the value props, the trust strip).
// The families below it — notes, facts, grinds, perks, seals — are the ones the artboard itself drives
// from a table of `d` strings, and they stay tables here for the same reason: the label picks the icon.
//
// ⚠️ `stroke="currentColor"`, NEVER THE LITERAL COLOUR THE ARTBOARD WRITES. The design paints these with the
// accent and the deep green inline; here the colour is inherited from a token on the parent. That is not a
// liberty — `src/structure.test.ts` forbids a literal colour value under `components/`, so that a re-skin
// stays a token edit. (It scans the file as TEXT, this comment included, which is why the two values are
// named here and not spelled.)
//
// ⚠️ THE NOTE MAP IS THE HOME'S, ON BOTH PAGES. The PDP artboard carries its own `noteIcon` with only
// three branches (chocolate, nuts, and a default drop), so on that page "Mel" and "Floral" both drew a
// drop. That is a defect of the artboard, not a decision: the home's map is the complete one and it is
// the one used here. The PDP catching up to the home is fidelity, not deviation.

import type { ReactElement } from 'react';

/** The icons the design places one by one. 24×24, stroke-drawn, `fill: none`. */
const ICONS: Record<string, ReactElement> = {
  // Header — the account button.
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  // Header — the bag. The only cart affordance this storefront has.
  bag: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  // Home — "Compra direta".
  leaf: (
    <>
      <path d="M12 20.5c-3.6-1-6-4.2-6-8.2 0-3.4 2-6.6 6-9.8 4 3.2 6 6.4 6 9.8 0 4-2.4 7.2-6 8.2Z" />
      <path d="M12 20.5V9" />
      <path d="M12 13.5 9 11" />
      <path d="M12 16.5 15 14" />
    </>
  ),
  // Home — "Moagem no seu método".
  grinder: (
    <>
      <path d="M6 4h12l-1.2 5.5a3 3 0 0 1-1.4 2L12 13l-3.4-1.5a3 3 0 0 1-1.4-2L6 4Z" />
      <path d="M12 13v3.5" />
      <path d="M8.5 20h7l-.7-3.5h-5.6L8.5 20Z" />
    </>
  ),
  // Home — "Torrado nesta semana".
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 1.5" />
      <path d="M9 2.5h6" />
    </>
  ),
  // Home — "Notas no rótulo".
  label: (
    <>
      <path d="M6.5 3h11v18l-5.5-3-5.5 3V3Z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 11.5h3" />
    </>
  ),
  // Trust strip — "Frete grátis acima de R$ 149".
  truck: (
    <>
      <rect x="1.5" y="7" width="13" height="9.5" rx="1" />
      <path d="M14.5 10.5h4l3 3v3h-7z" />
      <circle cx="6" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
    </>
  ),
  // Trust strip — "10% OFF em toda assinatura".
  percent: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 15l6-6" />
      <circle cx="9.6" cy="9.6" r="1.1" />
      <circle cx="14.4" cy="14.4" r="1.1" />
    </>
  ),
  // Trust strip — "Torrado na semana do seu pedido".
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 3.5V7h-3.5" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  // Trust strip — "Não gostou? Trocamos o pacote".
  shield: (
    <>
      <path d="M12 2.8 20 6v6c0 4.2-3.2 7.7-8 9.2-4.8-1.5-8-5-8-9.2V6l8-3.2Z" />
      <path d="M8.6 12.2l2.4 2.4 4.4-4.6" />
    </>
  ),
  // PDP — the three subscription perks. TRIMMED variants of the three above: the artboard draws them at
  // 14px, where the wheels and the clock hands are noise. Kept as their own entries because that is what
  // the design does; collapsing them into the full versions would change what a reader sees.
  truckSmall: (
    <>
      <rect x="1.5" y="7" width="13" height="9.5" rx="1" />
      <path d="M14.5 10.5h4l3 3v3h-7z" />
    </>
  ),
  percentSmall: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 15l6-6" />
    </>
  ),
  refreshSmall: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 3.5V7h-3.5" />
    </>
  ),
  // ★ A34 — the footer's "Compra segura" seal, and it is the ONE icon here the coffee artboards do not draw.
  //
  // The rule of this file is transcription, not interpretation — so it is transcribed from the PRODUCT rather
  // than invented: `Lock` in `@forgecommerce/storefront-kit/src/icons.tsx`, path for path. That is not an
  // arbitrary donor. The kit's own comment calls it "the 'compra segura' cue", and the checkout header
  // (`subtemplates/header/variants/checkout.tsx`) already renders exactly this padlock beside exactly these
  // two words. So a shopper who walks from this shop's footer into the checkout meets the same mark twice.
  //
  // ⚠️ COPIED RATHER THAN IMPORTED, which is this file's standing trade: every other glyph here is a local
  // `ICONS` entry rendered by the local `Icon` (24×24, `currentColor`, stroke widths from the artboard), and
  // importing one component's worth of SVG from the kit would give the footer a second icon vocabulary — a
  // different default size, a different stroke weight — for one mark.
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

/**
 * The scroll hint under the hero. ITS OWN COMPONENT because it is the one icon that is not 24×24 — the
 * artboard draws it in a 14×22 box, and forcing it into the shared viewBox would change its proportions.
 */
export function ScrollHintIcon(): ReactElement {
  return (
    <svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
      <path d="M7 1v18" />
      <path d="M1.5 14.5 7 20.5l5.5-6" />
    </svg>
  );
}

/** One of the hand-placed icons. `strokeWidth` follows the artboard: 1.5 in the header, 1.2 elsewhere. */
export function Icon({
  name,
  size = 24,
  strokeWidth = 1.2,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

/** A family drawn from a single `d` (subpaths separated by a space), the way the artboard drives them. */
export function PathIcon({
  d,
  size = 24,
  strokeWidth = 1.2,
}: {
  d: string;
  size?: number;
  strokeWidth?: number;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

// ── SENSORY NOTES ─────────────────────────────────────────────────────────────────────────────────────
// The nine drawings behind the note chips, and the label→drawing rule. Both verbatim from the home
// artboard's `noteIcon()`, INCLUDING the order of the tests: `mel$` has to be asked before the bare
// `mel`, or "melaço" would draw honey. Order is the rule here, not a formatting choice.

const NOTE_PATHS = {
  choc: 'M4.5 6.5h15v11h-15z M9.5 6.5v11 M14.5 6.5v11 M4.5 12h15',
  drop: 'M12 3.5c0 0 5 5.6 5 9A5 5 0 0 1 7 12.5c0-3.4 5-9 5-9z',
  nut: 'M12 3.5c3.6 0 5.8 3.3 5.8 7.2s-2.4 9.8-5.8 9.8-5.8-5.9-5.8-9.8S8.4 3.5 12 3.5z M12 4.5v15',
  honey: 'M12 3.5l7 4v9l-7 4-7-4v-9l7-4z',
  fruit: 'M12 7.5c1.8-3 6-2.8 6 1.4 0 4.4-3 11-6 11s-6-6.6-6-11c0-4.2 4.2-4.4 6-1.4z M12 7.5V4',
  floral:
    'M12 12c0-3 2-5 5-5-1 3-2 5-5 5z M12 12c0 3 2 5 5 5-1-3-2-5-5-5z M12 12c0-3-2-5-5-5 1 3 2 5 5 5z M12 12c0 3-2 5-5 5 1-3 2-5 5-5z',
  spice: 'M12 3.8l2.6 5.6 5.6 2.6-5.6 2.6L12 20.2l-2.6-5.6L3.8 12l5.6-2.6L12 3.8z',
  cookie: 'M20 12a8 8 0 1 1-8-8 8 8 0 0 1 8 8z M9.4 9.6h.01 M14.4 10.4h.01 M11.4 15h.01',
  cane: 'M8 20.5V9a4 4 0 0 1 8 0v1.5 M8 14.5h8 M8 11.5h8',
} as const;

/**
 * The drawing for a tasting note, BY THE NAME THE MERCHANT WROTE. This is the convention the dossier
 * calls "ícone por convenção de nome": the fork owns the mapping, the merchant owns the words, and the
 * admin grows no icon picker. A note nothing matches draws the drop, which is a coffee note either way.
 */
export function noteIcon(label: string): string {
  const l = label.toLowerCase();
  if (/(chocolate|cacau)/.test(l)) return NOTE_PATHS.choc;
  if (/(caramelo|melaço|mel$|melado)/.test(l)) return /mel$/.test(l) ? NOTE_PATHS.honey : NOTE_PATHS.drop;
  if (/mel/.test(l) && !/melaço/.test(l)) return NOTE_PATHS.honey;
  if (/(noz|avel)/.test(l)) return NOTE_PATHS.nut;
  if (/(maçã|pêssego|fruta)/.test(l)) return NOTE_PATHS.fruit;
  if (/(floral|jasmim)/.test(l)) return NOTE_PATHS.floral;
  if (/especiaria/.test(l)) return NOTE_PATHS.spice;
  if (/biscoito/.test(l)) return NOTE_PATHS.cookie;
  if (/(cana|rapadura)/.test(l)) return NOTE_PATHS.cane;
  return NOTE_PATHS.drop;
}

// ── THE PDP's THREE OTHER FAMILIES ────────────────────────────────────────────────────────────────────

/** The little facts beside the photo. `sca` is the same star the spice note draws — one drawing, two jobs,
 *  exactly as the artboard has it. */
export const FACT_PATHS = {
  sca: 'M12 3.8l2.6 5.6 5.6 2.6-5.6 2.6L12 20.2l-2.6-5.6L3.8 12l5.6-2.6L12 3.8z',
  roast:
    'M7 20c-1.2-2.4-.6-4.4 1-6.2 1.6-1.8 2.2-3.6 1.4-5.8 2.6 1 4 3 4 5.4 1-.8 1.6-2 1.7-3.4 1.6 2 2.3 4 1.6 6a5.6 5.6 0 0 1-2.4 4',
  lot: 'M5 5.5h14v14H5z M9 3.5v4 M15 3.5v4 M5 10.5h14',
  shipping:
    'M1.5 7h13v9.5h-13z M14.5 10.5h4l3 3v3h-7z M6 18.5a1.8 1.8 0 1 0 0 .01 M17 18.5a1.8 1.8 0 1 0 0 .01',
} as const;

/**
 * The grind selector, KEYED BY THE MERCHANT'S OPTION VALUE — the same name convention as the notes, over
 * the option the port serves. The design's own words: label the grind by the customer's METHOD, never by
 * the particle size.
 */
const GRIND_PATHS = {
  graos:
    'M8.5 6.5c0-1.7 1.6-3 3.5-3s3.5 1.3 3.5 3-1.6 3-3.5 3-3.5-1.3-3.5-3z M5 13.5c0-1.7 1.6-3 3.5-3s3.5 1.3 3.5 3-1.6 3-3.5 3-3.5-1.3-3.5-3z M12 20c0-1.7 1.6-3 3.5-3s3.5 1.3 3.5 3-1.6 3-3.5 3S12 21.7 12 20z',
  filtro:
    'M5.5 5h13l-2 5.5a4 4 0 0 1-2 2.3L12 14l-2.5-1.2a4 4 0 0 1-2-2.3L5.5 5z M12 14v3.5 M8.5 21h7l-.8-3.5H9.3L8.5 21z',
  espresso: 'M4 7h13v4a6.5 6.5 0 0 1-13 0V7z M17 8.5h2.5a2 2 0 0 1 0 4H17 M4.5 20h13',
} as const;

/** The drawing for a grind option value. An unrecognised value draws nothing — a chip with a wrong icon
 *  is worse than a chip with none, and the label still says what it is. */
export function grindIcon(value: string): string | null {
  const v = value.toLowerCase();
  if (/(grão|grao)/.test(v)) return GRIND_PATHS.graos;
  if (/(filtr|v60|coad|prensa|hario)/.test(v)) return GRIND_PATHS.filtro;
  if (/(espresso|expresso|moka|cápsula|capsula)/.test(v)) return GRIND_PATHS.espresso;
  return null;
}

/** The four seals under the rich photos. */
export const SEAL_PATHS = {
  directTrade: 'M12 20.5c-3.6-1-6-4.2-6-8.2 0-3.4 2-6.6 6-9.8 4 3.2 6 6.4 6 9.8 0 4-2.4 7.2-6 8.2Z M12 20.5V9',
  weeklyRoast: 'M20 12a8 8 0 1 1-2.3-5.6 M20 3.5V7h-3.5 M12 8v4.5l3 1.8',
  valve: 'M6.5 3h11v18l-5.5-3-5.5 3V3Z M9.5 8h5',
  guarantee: 'M12 2.8 20 6v6c0 4.2-3.2 7.7-8 9.2-4.8-1.5-8-5-8-9.2V6l8-3.2Z M8.6 12.2l2.4 2.4 4.4-4.6',
} as const;
