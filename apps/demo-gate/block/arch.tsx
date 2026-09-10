'use client';

// ★★ THE GATE'S SECOND SCREEN — "A arquitetura da demo", faithful to the `showArch` half of
// design-base/gate.dc.html. The owner closed this layout on 10/09 and it is the answer to a question the first
// screen cannot answer: that one says WHAT to open, this one says WHY it is hard. Its reader is a visitor who has
// never heard the word multi-tenant, so it draws the box instead of describing it — the two tenants side by side,
// each with its two shops and a single admin under both, and then the one stack they all stand on: the surfaces,
// the single command port, the kernel, the data, the infra.
//
// ★ WHY IT IS ITS OWN MODULE. `gate.tsx` was 347 lines before this screen existed and the screen is ~200 more;
// the brief's suggestion was to measure and choose, and the measurement is one-sided — the two screens share
// nothing but the language and the switch, so one file per screen keeps each one readable and lets the gate hold
// just the `view` state. What they DO share lives here, used by both: `ArchSwitch`, so the two affordances cannot
// drift apart.
//
// ⚠️ WHAT IS A FACT AND WHAT IS A WORD. The STRUCTURE below — two tenants, two shops each, which storefront is
// forked, which theme each shop wears — is a fact about THIS box and lives in code; the words are in `../i18n`
// in three languages. `arch.test.tsx` checks the structure against `seed/box.json`, the box's own declaration, so
// a third tenant or a third shop turns a test red instead of leaving this screen quietly lying. The numbers on
// the FIRST screen (2 777 products → 44 399 SKUs, 55 in the outlet) were measured against the live box by the
// tech lead; nothing here recomputes them.

import { ARCH, type ArchStrings, type Lang } from '../i18n';
import styles from './arch.module.css';

/** The monitor-and-phone glyph: a shop with a storefront on a screen. */
const ScreenIcon = ({ className }: { className: string }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="4" width="13" height="9" rx="1" />
    <path d="M6 18h5" />
    <path d="M8.5 13v5" />
    <rect x="17" y="9" width="5" height="11" rx="1" />
  </svg>
);

/** The counter totem: one tall screen on a foot — a shop with no storefront and no checkout. */
const TotemIcon = ({ className }: { className: string }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="7" y="2" width="10" height="16" rx="1" />
    <path d="M10 6h4" />
    <path d="M12 18v3" />
    <path d="M8 21h8" />
  </svg>
);

const DownArrow = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </svg>
);

const UpArrow = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);

/**
 * The affordance that moves between the two screens, in both directions. ONE component because the design draws
 * them identically apart from the arrow: `direction` is 'open' (label above a down arrow — you are descending
 * into the explanation) or 'close' (up arrow above the label — you are coming back up).
 */
export function ArchSwitch({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: 'open' | 'close';
  onClick: () => void;
}) {
  const opening = direction === 'open';
  return (
    <div
      className={`${styles.switchWrap} ${opening ? styles.switchWrapOpen : styles.switchWrapClose}`}
    >
      <button type="button" className={styles.switch} onClick={onClick}>
        {opening ? null : <UpArrow size={18} />}
        {label}
        {opening ? <DownArrow size={18} /> : null}
      </button>
    </div>
  );
}

/** One line inside a shop card: a term, and optionally what it is. `tone` is the value's accent. */
type ArchRow = {
  term: string;
  value?: string;
  tone?: 'plain' | 'outlet' | 'cafe';
  /** A row that states an ABSENCE ("no storefront"): dimmer, and it has no value half. */
  muted?: boolean;
};

type ArchShop = { label: string; icon: 'screen' | 'totem'; rows: readonly ArchRow[] };

type ArchTenant = {
  /** Which of the two accent families this tenant wears. */
  accent: 'shoes' | 'cafe';
  label: string;
  shops: readonly ArchShop[];
  admin: string;
};

/**
 * ★ THE SHAPE OF THIS BOX, in the reader's language. Exported so `arch.test.tsx` can hold it against
 * `seed/box.json` — the declaration the box is actually born from — instead of against a number typed twice.
 */
export function archTenants(t: ArchStrings): readonly ArchTenant[] {
  return [
    {
      accent: 'shoes',
      label: t.tenantShoes,
      shops: [
        {
          label: t.shopOne,
          icon: 'screen',
          rows: [
            { term: t.storefront, value: t.vanilla },
            { term: t.checkout, value: t.vanilla },
            { term: t.theme, value: t.vanilla },
          ],
        },
        {
          label: t.shopTwo,
          icon: 'screen',
          rows: [
            { term: t.storefront, value: t.vanilla },
            { term: t.checkout, value: t.vanilla },
            // The outlet is the same kernel, the same catalogue and a theme of its own — the one difference the
            // first screen's "55 products of the same catalogue" sentence is the proof of.
            { term: t.theme, value: t.themeOutlet, tone: 'outlet' },
          ],
        },
      ],
      admin: t.oneAdmin,
    },
    {
      accent: 'cafe',
      label: t.tenantCafe,
      shops: [
        {
          label: t.shopOne,
          icon: 'screen',
          // The coffee shop forked the VITRINE and kept our checkout: the doctrine's two deployables, visible.
          rows: [
            { term: t.storefront, value: t.forked, tone: 'cafe' },
            { term: t.checkout, value: t.vanilla },
            { term: t.theme, value: t.themeCafe, tone: 'cafe' },
          ],
        },
        {
          label: t.shopTwo,
          icon: 'totem',
          // The last rung: an application of its own, talking straight to the port. No storefront, no checkout.
          rows: [
            { term: t.totem, value: t.totemNote, tone: 'cafe' },
            { term: t.noStorefront, muted: true },
            { term: t.noCheckout, muted: true },
          ],
        },
      ],
      admin: t.oneAdmin,
    },
  ];
}

/** The generated surfaces, in the order the design stacks them. Proper nouns: the same in all three languages. */
export const SURFACES = ['API', 'CLI', 'MCP', 'SDK', 'Docs'] as const;
/** What the kernel keeps its truth in. Proper nouns too. */
export const DATA = ['PostgreSQL', 'Redis'] as const;

const VALUE_TONE = {
  plain: 'value',
  outlet: 'valueOutlet',
  cafe: 'valueCafe',
} as const;

function ShopCard({ shop }: { shop: ArchShop }) {
  const Icon = shop.icon === 'totem' ? TotemIcon : ScreenIcon;
  return (
    <div className={styles.shop}>
      <div className={styles.shopLabel}>
        <Icon className={styles.iconMuted} />
        {shop.label}
      </div>
      <div className={styles.rows}>
        {shop.rows.map((row) => (
          <div key={row.term} className={row.muted ? styles.rowMuted : undefined}>
            {row.term}
            {row.value ? (
              <>
                {' '}
                <strong className={styles[VALUE_TONE[row.tone ?? 'plain']]}>{row.value}</strong>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TenantCard({ tenant }: { tenant: ArchTenant }) {
  const shoes = tenant.accent === 'shoes';
  return (
    <div className={`${styles.tenant} ${shoes ? styles.tenantShoes : styles.tenantCafe}`}>
      <div className={`${styles.tenantLabel} ${shoes ? styles.labelShoes : styles.labelCafe}`}>
        {tenant.label}
      </div>
      <div className={styles.shops}>
        {tenant.shops.map((shop) => (
          <ShopCard key={shop.label} shop={shop} />
        ))}
      </div>
      <div className={styles.flow}>
        <DownArrow size={14} />
      </div>
      <div className={`${styles.admin} ${shoes ? styles.adminShoes : styles.adminCafe}`}>
        <ScreenIcon className={shoes ? styles.iconShoes : styles.iconCafe} />
        {tenant.admin}
      </div>
    </div>
  );
}

export function ArchScreen({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = ARCH[lang];
  const [ledeBefore, ledeStrong, ledeAfter] = t.lede;
  const tenants = archTenants(t);

  return (
    <div className={styles.screen}>
      <div className={styles.shell}>
        <div className={styles.head}>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.lede}>
            {ledeBefore}
            <strong className={styles.ledeStrong}>{ledeStrong}</strong>
            {ledeAfter}
          </p>
        </div>

        <div className={styles.tenants}>
          {tenants.map((tenant) => (
            <TenantCard key={tenant.label} tenant={tenant} />
          ))}
        </div>

        <div className={`${styles.flow} ${styles.flowWide}`}>
          <DownArrow size={16} />
        </div>

        <div className={styles.stack}>
          <div className={styles.surfaces}>
            {SURFACES.map((surface, i) => (
              <div
                key={surface}
                className={`${styles.surface} ${i === SURFACES.length - 1 ? styles.surfaceLast : ''}`}
              >
                {surface}
              </div>
            ))}
          </div>
          <div className={styles.port}>
            <span>{t.port}</span>
            <span className={styles.portDot} />
          </div>
          <div className={styles.kernel}>
            <span className={styles.kernelName}>{t.kernel}</span>
            <span className={styles.kernelParts}>{t.kernelParts}</span>
          </div>
          <div className={styles.data}>
            {DATA.map((datum, i) => (
              <div
                key={datum}
                className={`${styles.datum} ${i === DATA.length - 1 ? styles.datumLast : ''}`}
              >
                {datum}
              </div>
            ))}
          </div>
          <div className={styles.infra}>
            <span className={styles.infraName}>{t.infra}</span>
            <span className={styles.infraParts}>{t.infraParts}</span>
          </div>
        </div>

        <ArchSwitch label={t.back} direction="close" onClick={onClose} />
      </div>
    </div>
  );
}

export default ArchScreen;
