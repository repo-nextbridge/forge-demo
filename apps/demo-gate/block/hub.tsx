'use client';

// ★★★ THE HUB — the gate's first screen, over every face this box publishes. The owner's 10/09 layout
// (`design-base/gate.dc.html`), ported in pk35/d1.
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
// ── THE ONE CARD THAT IS NOT A LINK ─────────────────────────────────────────────────────────────────────
//
// A gate COVERS the route a visitor asked for; it does not redirect to the home page. So the destination the
// visitor is ALREADY on must be a `dismiss` (the cookie, and the same URL re-renders with the deep link
// intact), and every other destination is an ordinary `<a href>` to another origin. Which one that is comes
// from the request's own host, resolved on the server (`./entry`) and handed in as `here`.
//
// ⚠️ AND WHEN `here` MATCHES NOTHING, THE DOOR STILL HAS TO EXIST. On a bench the box answers on
// `localhost`, on a tailnet name, or on whatever a preview publishes — none of which this box DECLARES — so
// no card matches, and a screen made only of links would be a gate with no way in. The row at the foot is
// that door, and it names the host it is talking about rather than pretending to be one of the six.
//
// ⛔ THE COOKIE IS THIS ORIGIN'S, AND THAT IS A FACT ABOUT THE PRODUCT, NOT A CHOICE MADE HERE. `dismissGate`
// writes `forge_gate_dismissed` with no `domain` attribute (packages/storefront-kit/src/gate/actions.ts:57-64
// and src/cookies.ts, in the Forge monorepo), so the dismissal does NOT travel between the six hostnames: a
// visitor who came through here meets the gate again on the next one. The owner decided otherwise on 13/09
// («não tem problema o cookie valer para todas» ⇒ a `.forgecommerce.pro` cookie), and that decision lands in
// the KIT, not in this repository — see the head of `./gate`.

import type { GateFace, GateTenant } from '../faces.generated';
import { GATE_TENANTS } from '../faces.generated';
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

/**
 * Is the browser already on this face? Compared on the HOSTNAME alone: the declaration carries no port
 * (`seed/box.json` states `store.forgecommerce.pro`, the edge adds the scheme and the port), and a cookie
 * ignores the port anyway, so a bench on `:8200` and a deployment on `:443` are the same origin to the thing
 * this question is asked for.
 *
 * ⚠️ ANCHORED EQUALITY, NEVER A SUBSTRING. `cafe.forgecommerce.pro` is inside `notcafe.forgecommerce.pro`,
 * and this repository has paid for an unanchored host match more than once.
 */
export const isHere = (face: GateFace, here: string | undefined): boolean => {
  if (!face.host || !here) return false;
  const bare = here.replace(/^\w+:\/\//, '').replace(/\/.*$/, '');
  const host = bare.startsWith('[')
    ? bare.slice(1, bare.indexOf(']'))
    : (bare.match(/:/g) ?? []).length > 1
      ? bare
      : bare.replace(/:\d+$/, '');
  return host.toLowerCase() === face.host.toLowerCase();
};

export type HubProps = {
  lang: Lang;
  /** The host the browser asked for, as the server saw it. `undefined` when nothing could be read. */
  here?: string;
  /** `FORGE_GATE_ADMIN_URL` — the FIRST tenant's admin as this box really publishes it. See `adminHrefOf`. */
  adminUrl?: string;
  /** The slot's dismissal Server Action — the way IN, on this origin. */
  dismiss: () => Promise<void>;
};

function ShopFace({
  face,
  lang,
  here,
  dismiss,
}: {
  face: GateFace;
  lang: Lang;
  here: string | undefined;
  dismiss: () => Promise<void>;
}) {
  const t = HUB[lang];
  const copy = t.faces[face.key];
  const mark = HUB_MARKS[face.key];
  const url = urlOf(face);
  return (
    <div className={styles.face} data-face={face.key}>
      <div className={styles.faceHead}>
        {/* The wordmark is the shop's, and a face nobody wrote one for still draws its key — an unnamed card
            is a card a reader can trace back to the declaration it came from. */}
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
        {copy ? <span className={styles.faceBadge}>{copy.badge}</span> : null}
      </div>
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
    // navigation, and the admin has no gate of its own by decision (pk33: «não precisa de portaria no admin»).
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
    <div
      className={`${styles.tenant} ${light ? styles.tenantLight : ''}`}
      data-tenant={tenant.id}
    >
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
        .map((face) => (
          <ShopFace key={face.key} face={face} lang={lang} here={here} dismiss={dismiss} />
        ))}
      {tenant.faces
        .filter((face) => face.kind === 'admin')
        .map((face) => (
          <AdminFace key={face.key} face={face} lang={lang} light={light} override={adminUrl} />
        ))}
    </div>
  );
}

export function GateHub({ lang, here, adminUrl, dismiss }: HubProps) {
  const t = HUB[lang];
  const faces = GATE_TENANTS.flatMap((tenant) => tenant.faces);
  // ⛔ COUNTED, NEVER TYPED. The sentence the design writes out ("Dois tenants. Quatro lojas. Dois admins.")
  // is three numbers about this box, and a number typed into a screen is the defect this house keeps naming.
  const counts = t.counts(
    GATE_TENANTS.length,
    faces.filter((f) => f.kind === 'shop').length,
    faces.filter((f) => f.kind === 'admin').length,
  );
  /** Is the visitor standing on one of the faces this box publishes? If not, the foot carries the door. */
  const standingOn = faces.find((face) => isHere(face, here));

  return (
    <div data-hub-faces={faces.length}>
      <p className={styles.counts}>{counts}</p>
      <p className={styles.lede}>
        {t.lede[0]}
        <strong className={styles.ledeWord}>{t.lede[1]}</strong>
        {t.lede[2]}
      </p>
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
            adminUrl={index === 0 ? adminUrl : undefined}
            dismiss={dismiss}
          />
        ))}
      </div>
      <p className={styles.notice}>{t.notice}</p>
      {standingOn ? null : (
        <div className={styles.here} data-here-row="">
          <form action={dismiss}>
            <button type="submit" className={styles.cta}>
              {t.here}
              <ArrowIcon />
            </button>
          </form>
          {here ? <span className={styles.hereHost}>{here}</span> : null}
        </div>
      )}
    </div>
  );
}

export default GateHub;
