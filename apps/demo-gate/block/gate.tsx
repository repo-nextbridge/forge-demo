'use client';

// THE DEMO GATE — one screen, and it is the whole app's face.
//
// ★★★ v2 REPLACED THREE SCREENS WITH ONE, AND THAT IS THE POINT RATHER THAN A TIDY-UP. The gate used to be a
// page holding a hub, with a switch into a second screen that EXPLAINED the architecture in prose. The v2
// artboard shows the architecture instead: four shops across the top, each tenant's admin gathered under a
// bracket, and both brackets running down to one kernel. A visitor sees the claim being made rather than
// reading it, which is the only reason a demo exists at all. `./arch` and its copy left with the screen.
//
// ── WHAT IS DERIVED AND WHAT IS TYPED, because the line matters here more than anywhere ────────────────────
//
// DERIVED, always: the destinations. `seed/box.json` declares them, `bin/gate-faces.mjs` renders that into
// `../faces.generated.ts`, and this file renders whatever that carries — tenants in declaration order, their
// shops, their admin. A fifth shop appears on this screen by being declared, and nothing here is edited.
//
// TYPED, on purpose: the copy (`../i18n`). This screen is the public demo's own front door, not an app a
// customer installs — the head of the HUB section says why a figure typed here is right and would be wrong
// on a customer's box.
//
// ── THE TWO WAYS THROUGH THE GATE ──────────────────────────────────────────────────────────────────────────
//
//  · the face the visitor is ALREADY on → a <form> posting the `dismiss` Server Action. The same route then
//    renders the real store with the deep link intact (the gate covers the route; it never redirects home).
//  · every other face → its own origin, and the click dismisses FIRST (see `ShopCard`).
//  · an admin → that tenant's `/enter`, which redeems the operator access key server-side and lands signed
//    in. It opens in a NEW TAB: an admin is a side trip from the tour, not the next step of it.
//
// The page is one CSS module read off the artboard value by value. Text rides the theme's Urbanist; v2 sets
// the coffee brand in it too, so this app ships no font at all now — see `./gate.font-guard.test.ts`.

import { useEffect, useState } from 'react';
import { GATE_TENANTS, type GateFace, type GateTenant } from '../faces.generated';
import { GATE_LANG_COOKIE, HUB, HUB_MARKS, LANGS, type Lang, resolveLang, STRINGS } from '../i18n';
import styles from './gate.module.css';
import { GATE_MARK } from './marks';

export type GateBlockProps = {
  /** The "← back" target (the marketing site). */
  siteUrl: string;
  /** The admin origins this box really publishes (`FORGE_GATE_ADMIN_URLS`), one PER TENANT and keyed by
   *  tenant id; a tenant's window opens `${origin}/enter`. A tenant absent from the map keeps the address
   *  the declaration gives it. */
  adminUrls?: Readonly<Record<string, string>>;
  /** The host the browser asked for, as the server saw it — which face is "here". */
  here?: string;
  /** The server's Accept-Language guess (PT default). `?lang=` on the URL overrides it on mount. */
  initialLang: Lang;
  /** A Server Action that sets the dismissal cookie; the way IN, on this origin. */
  dismiss: () => Promise<void>;
};

/** The narrow arrangement is a different LAYOUT, not the same one squeezed: per-tenant carousels instead of
 *  one row of four. The artboard branches at 760 and so does this. */
const NARROW = 760;

/** ★ THE ACCENT IS THE BRAND'S, AND THE OUTLET IS THE ONE FACE THAT CARRIES ITS OWN.
 *
 * The artboard gives tenant 1 the product's orange and its outlet a rose; tenant 2 is sand on both faces.
 * Keyed by POSITION rather than by store handle — a table keyed by `outlet` is a list that rots the day a
 * shop is renamed, and position is what the declaration actually guarantees. ⚠️ A third tenant falls back to
 * the neutral brand accent rather than inventing a colour nobody drew. */
function accentOf(tenantIndex: number, shopIndex: number): string {
  if (tenantIndex === 0) return shopIndex === 0 ? '#C2410C' : '#E11D48';
  return '#A9793F';
}

/** The destination of one shop face, carrying the chosen language across the origin hop. */
function urlOf(face: GateFace, lang: Lang): string {
  const base = face.host ? `https://${face.host}` : '/';
  return `${base}?lang=${lang}`;
}

/** A tenant's admin origin: what the box was PROMOTED to wins over what the declaration guessed. */
function adminHrefOf(tenant: GateTenant, adminUrls: Readonly<Record<string, string>> | undefined): string | null {
  const promoted = adminUrls?.[tenant.id];
  const face = tenant.faces.find((f) => f.kind === 'admin');
  const origin = promoted ?? (face?.host ? `https://${face.host}` : null);
  return origin ? `${origin.replace(/\/+$/, '')}/enter` : null;
}

function ArrowOut() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 3v18" />
      <path d="M13 8h5" />
      <path d="M13 12h5" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

/** The card's own contents — identical whether it ends up inside a link or inside a form's button, which is
 *  why it is a function and not two copies. */
function CardBody({ face, lang, accent }: { face: GateFace; lang: Lang; accent: string }) {
  const copy = HUB[lang].faces[face.key];
  const mark = HUB_MARKS[face.key];
  const art = `./art/card-${face.store ?? 'store'}.webp`;
  return (
    <>
      <span className={styles.cardMark}>
        {/* A face nobody wrote a mark for still draws its key: an unnamed card is a declaration nobody
            finished, and drawing nothing would hide it. */}
        <span className={styles.wordmarkStrong}>
          {mark?.[0] ?? face.key}
          <span className={styles.dot} style={{ color: accent }}>
            {mark?.[1] ?? ''}
          </span>
        </span>
        <span className={styles.cardMarkTail} style={{ color: accent }}>
          {mark?.[2] ?? ''}
        </span>
        {mark?.[3] ? <span className={styles.cardMarkAside}>{mark[3]}</span> : null}
      </span>
      <span className={styles.cardBlurb}>{copy?.blurb ?? ''}</span>
      <span className={styles.hairline} />
      <span className={styles.cardPlace}>{copy?.place ?? ''}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- the gate ships its own art and no optimiser */}
      <img className={styles.cardArt} src={art} alt="" />
      <span className={styles.cardFoot}>
        <span>{copy?.foot ?? ''}</span>
        <ArrowOut />
      </span>
    </>
  );
}

function ShopCard({
  face,
  accent,
  lang,
  here,
  dismiss,
}: {
  face: GateFace;
  accent: string;
  lang: Lang;
  here: string | undefined;
  dismiss: () => Promise<void>;
}) {
  const isHere = Boolean(here && face.host && here === face.host);
  const url = urlOf(face, lang);
  const addressed = Boolean(face.host);

  return (
    <div className={styles.shopCell} data-face={face.key}>
      <div className={styles.shopFrame}>
        <div className={styles.pocket} />
        {!addressed ? (
          // ⛔ NAMED, NEVER HIDDEN. The box DECLARES this destination and declares no address for it, and a
          // card that vanished would make a half-finished declaration look like a complete one. It is drawn
          // exactly like its siblings and is not a link, because there is nowhere to go.
          <div className={styles.card} data-unaddressed={face.key}>
            <CardBody face={face} lang={lang} accent={accent} />
            <span className={styles.unaddressed}>{HUB[lang].noAddress}</span>
          </div>
        ) : isHere ? (
          // The face the visitor is standing on. A form, so the way in survives with no JavaScript at all —
          // this is the first screen of the demo and it may not depend on a bundle having arrived.
          <form action={dismiss} className={styles.cardForm}>
            <button type="submit" className={styles.card}>
              <CardBody face={face} lang={lang} accent={accent} />
            </button>
          </form>
        ) : (
          // ── ★★ CLICKING A CARD *IS* PASSING THROUGH THE GATE ────────────────────────────────────────────
          //
          // ⛔ MEASURED 2026-09-17: dismissing here and THEN opening the outlet worked, but pressing the
          // outlet's own card inside this screen opened it still gated. The dismissal was only ever written
          // by the card the visitor stood on; every other card was a bare link that navigated and told
          // nobody. The cards ARE the choice, so a cross-origin card has to keep that.
          //
          // ⚠️ IT WORKS ONLY BECAUSE THE COOKIE IS ZONE-SCOPED. `deploy/box.env` declares the suffix, so a
          // dismissal written on THIS origin is sent by the browser to the one we are about to open. On a
          // bench, where the kit correctly falls back to host-only, this click dismisses here and the next
          // face still greets — honest behaviour for a box whose addresses share no suffix, not a regression.
          //
          // ⚠️ AND THE NAVIGATION WAITS FOR THE ACTION. Firing it and letting the browser leave is a race the
          // cookie usually loses; `finally` keeps the visitor moving even when the dismissal fails, because a
          // shop that greets twice is better than a shop nobody reaches. A modifier-click is left alone: the
          // browser's own "open in a new tab" is not ours to cancel, and the dismissal still goes out.
          <a
            className={styles.card}
            href={url}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                void dismiss();
                return;
              }
              event.preventDefault();
              void dismiss().finally(() => {
                window.location.assign(url);
              });
            }}
          >
            <CardBody face={face} lang={lang} accent={accent} />
          </a>
        )}
      </div>
    </div>
  );
}

function AdminWindow({ tenant, lang, adminUrls }: { tenant: GateTenant; lang: Lang; adminUrls?: Readonly<Record<string, string>> }) {
  const copy = HUB[lang].tenants[tenant.id];
  const href = adminHrefOf(tenant, adminUrls);
  const shot = `./art/admin-dashboard${tenant.id === GATE_TENANTS[0]?.id ? '' : '-cafe'}.webp`;
  return (
    <div className={styles.window} data-admin={tenant.id}>
      <div className={styles.windowBar}>
        <span className={styles.lights}>
          <span className={`${styles.light} ${styles.lightRed}`} />
          <span className={`${styles.light} ${styles.lightAmber}`} />
          <span className={`${styles.light} ${styles.lightGreen}`} />
        </span>
        <span className={styles.windowTitle}>{copy?.window ?? tenant.name}</span>
      </div>
      <div className={styles.screen}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the gate ships its own art and no optimiser */}
        <img className={styles.screenShot} src={shot} alt="" />
        <div className={styles.screenFade} />
        {/* ⚠️ An admin with no address is a declaration nobody finished. The window still draws — the visitor
            is told this tenant HAS an admin — and the button simply is not a link. */}
        {href ? (
          <a className={styles.enter} href={href} target="_blank" rel="noreferrer">
            <AdminIcon />
            {copy?.enter ?? 'admin'}
            <ArrowRight />
          </a>
        ) : (
          <span className={styles.enter}>
            <AdminIcon />
            {copy?.enter ?? 'admin'}
          </span>
        )}
      </div>
    </div>
  );
}

export function GateBlock({ siteUrl, adminUrls, here, initialLang, dismiss }: GateBlockProps) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [narrow, setNarrow] = useState(false);

  // `?lang=` on the URL wins (the marketing site links with the locale). Read on mount; every string is
  // embedded, so the switch is instant and touches no network.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q) setLang(resolveLang(q));
  }, []);

  // PERSIST the choice so it survives the gate → ribbon → re-opened gate (the server reads this cookie for
  // its initialLang instead of re-guessing Accept-Language).
  useEffect(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: CookieStore is Chromium-only; this is a non-secret UI pref.
    document.cookie = `${GATE_LANG_COOKIE}=${lang};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  }, [lang]);

  // ⚠️ THE BRANCH IS MEASURED ON THE CLIENT AND STARTS FALSE, which is deliberate: the server cannot know the
  // viewport, and rendering the carousel first would make every desktop visitor watch a layout swap. The wide
  // arrangement is the one that reads acceptably at both widths for the instant before this runs.
  useEffect(() => {
    const read = () => setNarrow(window.innerWidth < NARROW);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const t = STRINGS[lang];
  const hub = HUB[lang];
  const shopsOf = (tenant: GateTenant) => tenant.faces.filter((f) => f.kind === 'shop');

  return (
    // ⚠️ `data-testid` IS LOAD-BEARING, not test scaffolding: it is the only handle a probe outside the
    // browser has to tell "the visitor met the gate" from "the visitor walked into the shop" — both answer
    // 200. `bin/prove-doors.mjs` builds the attribute from the id the PORT answers, never from a literal.
    <div className={styles.page} data-testid={GATE_MARK}>
      <div className={styles.column}>
        <div className={styles.masthead}>
          <div className={styles.wordmark}>
            <span className={styles.wordmarkStrong}>
              forge<span className={styles.dot}>.</span>
            </span>
            <span className={styles.wordmarkTail}>demo</span>
          </div>
          <h1 className={styles.headline}>
            {hub.headline} <em className={styles.headlineAccent}>{hub.headlineAccent}</em>
          </h1>
        </div>

        {narrow ? (
          <div className={styles.mobile}>
            {GATE_TENANTS.map((tenant, ti) => (
              <div key={tenant.id} className={styles.mobile}>
                <div className={`${styles.tenantChip} ${styles.mobileChip}`}>{hub.tenants[tenant.id]?.chip ?? tenant.name}</div>
                <div className={styles.rail}>
                  {shopsOf(tenant).map((face, si) => (
                    <div key={face.key} className={styles.railItem}>
                      <ShopCard face={face} accent={accentOf(ti, si)} lang={lang} here={here} dismiss={dismiss} />
                    </div>
                  ))}
                  <div className={styles.railTail} />
                </div>
                <AdminWindow tenant={tenant} lang={lang} adminUrls={adminUrls} />
                <div className={styles.mobileGap} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className={styles.shops}>
              {GATE_TENANTS.flatMap((tenant, ti) =>
                shopsOf(tenant).map((face, si) => (
                  <ShopCard key={face.key} face={face} accent={accentOf(ti, si)} lang={lang} here={here} dismiss={dismiss} />
                )),
              )}
            </div>

            <div className={styles.admins}>
              {GATE_TENANTS.map((tenant) => (
                <div key={tenant.id} className={styles.adminCell}>
                  <div className={styles.bracketRow}>
                    <div className={styles.bracket} />
                    <div className={styles.bracketStem} />
                  </div>
                  <div className={styles.tenantChip}>{hub.tenants[tenant.id]?.chip ?? tenant.name}</div>
                  <div className={styles.dashDown} />
                  <AdminWindow tenant={tenant} lang={lang} adminUrls={adminUrls} />
                </div>
              ))}
            </div>

            <div className={styles.trunk}>
              <div className={`${styles.trunkUp} ${styles.trunkUpLeft}`} />
              <div className={`${styles.trunkUp} ${styles.trunkUpRight}`} />
              <div className={styles.trunkAcross} />
              <div className={styles.trunkDown} />
              <div className={styles.live} />
            </div>

            <div className={styles.kernel}>
              <span className={styles.kernelTile}>
                <span className={styles.kernelTileMark}>
                  f<span className={styles.dot}>.</span>
                </span>
              </span>
              <span className={styles.kernelText}>
                <span className={styles.kernelName}>{hub.kernel.name}</span>
                <span className={styles.kernelBlurb}>{hub.kernel.blurb}</span>
              </span>
            </div>
          </>
        )}

        {/* ⚠️ ONLY ON A BOX WHOSE ADDRESS NOBODY DECLARED. On the public demo the visitor is always standing
            on a face and this never draws; on a bench or a tailnet it is the only way in, and it NAMES the
            host rather than pretending the box knows where it is. */}
        {here && !GATE_TENANTS.some((t) => t.faces.some((f) => f.host === here)) ? (
          <div className={styles.hereLine} data-here={here}>
            <span className={styles.notice}>
              {hub.hereNote} <strong>{here}</strong>
            </span>
            <form action={dismiss}>
              <button type="submit" className={styles.hereCta}>
                {hub.hereCta}
              </button>
            </form>
          </div>
        ) : null}

        <div className={styles.foot}>
          <div className={styles.footLeft}>
            <div className={styles.langs}>
              <GlobeIcon />
              {LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`${styles.lang} ${code === lang ? styles.langOn : ''}`}
                  onClick={() => setLang(code)}
                >
                  {code}
                </button>
              ))}
            </div>
            <span className={styles.notice}>{hub.notice}</span>
          </div>
          <a className={styles.back} href={siteUrl}>
            {t.back}
          </a>
        </div>
      </div>
    </div>
  );
}
