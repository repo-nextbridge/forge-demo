'use client';

// ★★★ THE HUB — the gate's FIRST SCREEN, over every face this box publishes. The 10/09 layout
// (`design-base/gate.dc.html`), ported in pk35/d1 and made the whole screen in pk38/d7.
//
// ── ⛔ IT REPLACES THE FIRST SCREEN, IT IS NOT ADDED TO IT ───────────────────────────────────────────────
//
// That sentence was already written here when the port happened, and the port read it as "as well as": the
// hub was mounted UNDER a framed hero — an eyebrow, a large "Loja demo." and a paragraph — so a visitor was
// told the same thing twice, in two shapes, neither of them the design's. The hero is gone (`./gate` draws
// the design's header row: the wordmark, the count as a headline, the lede beside it), and with it went two
// things that are worth naming because they will look like omissions:
//
//   · the page-wide FRAME. There is exactly one border on this screen and it belongs to the tenant CARD.
//     A box around the page plus a box around each card reads as two levels of nesting that mean nothing.
//   · the "carry on in this window" BUTTON. This window only exists while there is no dismissal cookie, so
//     the cards ARE the choice — and the card the visitor is standing on is already the way in. What was
//     left of it is at the foot, and only on a host the box does not declare; see `hereNote` below.
//
// ── WHERE THE DESTINATIONS COME FROM, AND IT IS NOT THIS FILE ───────────────────────────────────────────
//
// Not one hostname is written here. `seed/box.json` declares one `domain` per store and one `admin_domain`
// per tenant — a hostname is DATA and that is where this box states it (pk34/d1) — and `bin/gate-faces.mjs`
// renders that declaration into `../faces.generated.ts`, which this screen imports. The generator exists
// because the app is baked into the kernel image ALONE and cannot read the file at runtime;
// `bin/gate-faces.guard.mjs` is what keeps the copy and the declaration unable to drift.
//
// ⇒ a fifth store declared in the box is a fifth card here, with no edit to this file. A store whose
// `domain` is deleted is a card that SAYS SO — see `unaddressed` below. It is never one that disappears.
//
// ── ⚠️ THE NUMBERS, THOUGH, ARE THE DESIGN'S WORDS AND NOT A READING ────────────────────────────────────
//
// Each shop's sentence carries its size ("2 777 produtos → 44 399 SKUs"), and it is TYPED, in `../i18n`,
// because this screen is the public demo's own front door rather than an app a customer installs — the long
// form of that reasoning, and the list of what was removed with the reading, is at the head of the `HUB`
// section there. ⛔ Do not turn a `blurb` back into a function of a number that may not arrive.
//
// ── THE ONE CARD THAT IS NOT A LINK ─────────────────────────────────────────────────────────────────────
//
// A gate COVERS the route a visitor asked for; it does not redirect to the home page. So the destination the
// visitor is ALREADY on must be a `dismiss` (the cookie, and the same URL re-renders with the deep link
// intact), and every other destination is an ordinary `<a href>` to another origin. Which one that is comes
// from the request's own host, resolved on the server (`./entry`) and handed in as `here`.
//
// ⚠️ AND WHEN `here` MATCHES NOTHING, THE DOOR STILL HAS TO EXIST. On a bench the box answers on
// `localhost`, on a tailnet name, or on whatever a preview publishes — none of which this box DECLARES — so
// no card matches, and a screen made only of links would be a gate with no way in. The line at the foot is
// that door: it states the condition rather than offering a seventh destination, and it names the host it is
// talking about rather than pretending to be one of the six.
//
// ⛔ THE COOKIE IS THIS ORIGIN'S, AND THAT IS A FACT ABOUT THE PRODUCT, NOT A CHOICE MADE HERE. `dismissGate`
// writes `forge_gate_dismissed` with no `domain` attribute (packages/storefront-kit/src/gate/actions.ts:57-64
// and src/cookies.ts, in the Forge monorepo), so the dismissal does NOT travel between the six hostnames: a
// visitor who came through here meets the gate again on the next one. A cookie scoped to the whole
// `.forgecommerce.pro` zone was decided on 13/09 and lands in the KIT, not in this repository — see the head
// of `./gate`.

import type { GateFace, GateTenant } from '../faces.generated';
import { GATE_TENANTS } from '../faces.generated';
import { sameHost } from '../host';
import { HUB, HUB_MARKS, type Lang } from '../i18n';
import styles from './hub.module.css';

const ArrowIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
);

const AdminIcon = ({ tone }: { tone: string }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke={tone}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

/** The address a face is opened at. `null` when the box declares none — which the screen SAYS. */
export const urlOf = (face: GateFace): string | null => (face.host ? `https://${face.host}` : null);

/**
 * ★ THE ADMIN IS OPENED AT ITS `/enter` ROUTE, AND THAT IS THE WHOLE POINT OF THE ROW. `/enter` redeems the
 * operator access key SERVER-SIDE and lands signed in; the key never touches the browser. A link to the bare
 * origin would be a link to a login form the visitor has no password for.
 *
 * ⚠️ `override` IS THE FIRST TENANT'S DOOR AS THE BOX REALLY PUBLISHES IT — `FORGE_GATE_ADMIN_URL`, which
 * `bin/box-up.sh` derives from what the admin directory ACCEPTED at promotion (see the comment at its «THE
 * GATE'S LINK TO THE ADMIN IS THE FIRST TENANT'S DOOR»). It wins over the declaration for exactly one face,
 * because a bench and a tailnet answer at an address this box does not declare, and an operator meeting a
 * dead admin link on every birth is how a feature stops being trusted.
 */
export const adminHrefOf = (face: GateFace, override?: string): string | null => {
  const origin = override?.replace(/\/+$/, '') || urlOf(face);
  return origin ? `${origin}/enter` : null;
};

/** The hostname a URL is spelled with — what the design prints in monospace beside the admin row. */
export const hostOf = (url: string): string => url.replace(/^\w+:\/\//, '').replace(/\/.*$/, '');

/** Is the browser already on this face? Anchored on the hostname, port dropped — the rule lives in
 *  `../host`, where the sharp edge it has is stated once. */
export const isHere = (face: GateFace, here: string | undefined): boolean =>
  sameHost(face.host, here);

/** How many of each thing the box declares. The headline is the DESIGN's sentence (`../i18n`), so nothing
 *  reads this to write prose; `data-hub-faces` publishes it as the one number a probe can count the cards
 *  against, and `block/hub.test.tsx` holds it against `seed/box.json`. */
export function hubTally(tenants: readonly GateTenant[] = GATE_TENANTS) {
  const faces = tenants.flatMap((tenant) => tenant.faces);
  return {
    tenants: tenants.length,
    shops: faces.filter((face) => face.kind === 'shop').length,
    admins: faces.filter((face) => face.kind === 'admin').length,
    faces: faces.length,
  };
}

export type HubProps = {
  lang: Lang;
  /** The host the browser asked for, as the server saw it. `undefined` when nothing could be read. */
  here?: string;
  /** `FORGE_GATE_ADMIN_URLS` — the admin origin PER TENANT, as this box really publishes it, keyed by tenant
   *  id. A tenant absent from the map keeps the address `seed/box.json` declares for it. See `adminHrefOf`. */
  adminUrls?: Readonly<Record<string, string>>;
  /** The slot's dismissal Server Action — the way IN, on this origin. */
  dismiss: () => Promise<void>;
};

function ShopFace({
  face,
  index,
  lang,
  here,
  dismiss,
}: {
  face: GateFace;
  index: number;
  lang: Lang;
  here: string | undefined;
  dismiss: () => Promise<void>;
}) {
  const t = HUB[lang];
  const copy = t.faces[face.key];
  const mark = HUB_MARKS[face.key];
  const url = urlOf(face);
  // ★ The design accents the SECOND shop of a card (rose on the dark card, sand on the light one). Derived
  //   from position, exactly like the card's own tone: a colour keyed by store handle would be a list that
  //   rots the day a fifth shop is declared, and this needs no list to draw what the design draws.
  const second = index % 2 === 1;
  return (
    <div className={`${styles.face} ${second ? styles.faceSecond : ''}`} data-face={face.key}>
      {/* The wordmark is the shop's, and a face nobody wrote one for still draws its key — an unnamed card is
          a card a reader can trace back to the declaration it came from.
          ⛔ IT USED TO SHARE A ROW WITH A CHIP ("Referência", "Segunda loja", "Storefront forkado", "Totem"),
          and the row went out with the chip rather than staying as a container of one thing. */}
      <span className={styles.mark}>
        {mark ? (
          <>
            {mark[0]}
            <span className={styles.markDot}>{mark[1]}</span>
            <span className={styles.markTail}>{mark[2]}</span>
          </>
        ) : (
          face.key
        )}
      </span>
      {copy ? <p className={styles.faceBlurb}>{copy.blurb}</p> : null}
      {url === null ? (
        // ⛔ NAMED, NEVER HIDDEN. The box declares this destination and declares no address for it.
        <span className={styles.unaddressed} data-unaddressed={face.key}>
          {face.key} — {t.noAddress}
        </span>
      ) : isHere(face, here) ? (
        <form action={dismiss}>
          <button type="submit" className={styles.cta}>
            {copy?.cta ?? face.key}
            <ArrowIcon />
          </button>
        </form>
      ) : (
        <a className={styles.cta} href={url} target="_blank" rel="noreferrer">
          {copy?.cta ?? face.key}
          <ArrowIcon />
        </a>
      )}
    </div>
  );
}

function AdminFace({
  face,
  lang,
  light,
  override,
}: {
  face: GateFace;
  lang: Lang;
  light: boolean;
  override?: string;
}) {
  const t = HUB[lang];
  const url = adminHrefOf(face, override);
  const name = (
    <span className={styles.adminName}>
      <AdminIcon tone={light ? '#2F3B30' : '#C2410C'} />
      {t.adminRow}
    </span>
  );
  if (url === null) {
    return (
      <div className={styles.admin} data-face={face.key}>
        {name}
        <span className={styles.adminHost} data-unaddressed={face.key}>
          {face.key} — {t.noAddress}
        </span>
      </div>
    );
  }
  return (
    // ⛔ ALWAYS A PLAIN LINK, on purpose. The admin is another origin, this cookie would not travel with the
    // navigation, and the admin has no gate of its own by decision (pk33: an admin needs no front door).
    <a className={styles.admin} href={url} target="_blank" rel="noreferrer" data-face={face.key}>
      {name}
      <span className={styles.adminHost}>{hostOf(url)} →</span>
    </a>
  );
}

function TenantCard({
  tenant,
  index,
  lang,
  here,
  adminUrl,
  dismiss,
}: {
  tenant: GateTenant;
  index: number;
  lang: Lang;
  here: string | undefined;
  adminUrl: string | undefined;
  dismiss: () => Promise<void>;
}) {
  const t = HUB[lang];
  const copy = t.tenants[tenant.id];
  // ★ The design draws the first tenant dark and the second light. Derived from POSITION so a third tenant
  //   gets a card that looks like one of these instead of falling through a lookup keyed by a typed id.
  const light = index % 2 === 1;
  return (
    <div className={`${styles.tenant} ${light ? styles.tenantLight : ''}`} data-tenant={tenant.id}>
      <div className={styles.head}>
        <div className={styles.headTop}>
          <div className={styles.eyebrow}>{copy?.eyebrow ?? tenant.name}</div>
          <div className={styles.badge}>{copy?.badge ?? tenant.id}</div>
        </div>
        <div className={styles.headline}>{copy?.headline ?? tenant.name}</div>
        {copy ? <p className={styles.blurb}>{copy.blurb}</p> : null}
      </div>
      {tenant.faces
        .filter((face) => face.kind === 'shop')
        .map((face, shopIndex) => (
          <ShopFace
            key={face.key}
            face={face}
            index={shopIndex}
            lang={lang}
            here={here}
            dismiss={dismiss}
          />
        ))}
      {tenant.faces
        .filter((face) => face.kind === 'admin')
        .map((face) => (
          <AdminFace key={face.key} face={face} lang={lang} light={light} override={adminUrl} />
        ))}
    </div>
  );
}

export function GateHub({ lang, here, adminUrls, dismiss }: HubProps) {
  const t = HUB[lang];
  const tally = hubTally();
  /** Is the visitor standing on one of the faces this box publishes? If not, the foot carries the door. */
  const standingOn = GATE_TENANTS.flatMap((tenant) => tenant.faces).find((face) =>
    isHere(face, here),
  );

  return (
    <div data-hub-faces={tally.faces}>
      <div className={styles.hub}>
        {GATE_TENANTS.map((tenant, index) => (
          <TenantCard
            key={tenant.id}
            tenant={tenant}
            index={index}
            lang={lang}
            here={here}
            // ⚠️ ONLY THE FIRST TENANT'S. `FORGE_GATE_ADMIN_URL` is one value and `bin/box-up.sh` fills it
            // from the FIRST admin door the directory accepted; handing it to both cards would point the
            // café's admin row at the shoe brand's.
            adminUrl={adminUrls?.[tenant.id]}
            dismiss={dismiss}
          />
        ))}
      </div>
      {standingOn ? null : (
        <div className={styles.here} data-here-row="">
          <span>{t.hereNote}</span>
          {here ? <span className={styles.hereHost}>{here}</span> : null}
          <form action={dismiss}>
            <button type="submit" className={styles.hereLink}>
              {t.hereCta}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default GateHub;
