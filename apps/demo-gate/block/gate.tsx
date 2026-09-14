'use client';

// The demo-gate block — the full-screen demo interstitial, and the switch into the SECOND screen
// (`./arch`, "A arquitetura da demo"). A client component so the footer PT/EN/ES selector switches live, so
// `?lang=` on the URL can win over the server's Accept-Language guess, and so the two screens can trade places
// without a navigation (`view` below). Responsive is pure CSS, with no breakpoint of the page's own.
//
// ★★★ THE FIRST SCREEN IS THE 10/09 LAYOUT (`design-base/gate.dc.html`) AND NOTHING ELSE. It is a HUB over
// every face this box publishes (`./hub`), and this file is the page it sits on: the ground, the `forge.demo`
// wordmark, the headline, the lede beside it, the notice and the language selector at the foot, the way back,
// and the switch into the architecture screen.
//
// ⛔ pk38/d7 — WHAT THIS SCREEN NO LONGER DRAWS, because "replaces" had been read as "as well as". A framed
// hero stood above the hub — an eyebrow, `<h1>Loja demo.</h1>` and a paragraph — so the first screen said the
// same thing twice and the page wore two nested borders. All of it is gone, and with it:
//   · the SECOND FRAME. One border on this screen, and it belongs to the tenant card.
//   · the "carry on in this window" BUTTON. This window only exists while there is no dismissal cookie, so
//     the six cards ARE the choice and "carry on here" names nothing. What is left of that door is a foot
//     line drawn only on a host the box does not declare (`./hub`).
// The headline that took the hero's place, and the size on each shop's card, are the DESIGN's own words —
// typed, on purpose, because this screen is the demo's own front door and not an app a customer installs.
// The reasoning, and what was removed with the port reading that used to produce those numbers, is at the
// head of the `HUB` section of `../i18n`.
//
// The destinations are not written anywhere near here — `seed/box.json` declares them and `bin/gate-faces.mjs`
// renders that declaration into `../faces.generated.ts`. The two paths a visitor has are the hub's:
//   · the destination the visitor is ALREADY on → a <form> posting the `dismiss` Server Action (sets the
//     dismissal cookie); the SAME route then renders the real store, deep link preserved (the gate covers the
//     route, it never redirects to home). When no declared face matches the host — a bench, a tailnet — that
//     door moves to a line at the foot of the hub, which names the host it is talking about.
//   · every other destination → a top-level link to that face's own origin; an admin row goes to its `/enter`
//     route, which redeems the operator access key server-side and lands signed in (the key never touches the
//     browser; SameSite=Lax allows the nav).
// The page and the cards are the two CSS modules. Text rides the theme's own stack (Urbanist, self-hosted by
// the storefront); the one face this app ships is the serif the design gives the coffee brand's card, which
// travels with the app rather than being fetched from a CDN — see `./hub.module.css` and the font guard.
//
// ⚠️ WHAT THIS PORT DID *NOT* BRING, AND THE REASON IS A REPOSITORY BOUNDARY. The head of this file used to
// say the hub "needs a decision nobody in this repository can take alone", because `dismissGate()` set a
// cookie and returned void. HALF of that fell: since pk33 the action takes a destination
// (`dismissGate(to?)`, packages/storefront-kit/src/gate/actions.ts:53 in the Forge monorepo) — but
// `safeNextPath` admits SAME-ORIGIN PATHS only, and five of the six faces are other HOSTNAMES, so that
// argument cannot carry a visitor to the outlet. The other half did NOT fall: the dismissal cookie is written
// with no `domain` attribute (same file, :57-64; the name is `GATE_DISMISSED_COOKIE` in
// packages/storefront-kit/src/cookies.ts), so it is host-only and a visitor who came through here meets the
// gate again on the next face that has one.
//
// ⇒ MEASURED, NOT ESTIMATED (bench `forge-preseed`, 2026-09-13): of the six, the two admins have no gate by
// decision (pk33: an admin needs no front door), the café declared `gate: false`, and the outlet and the
// counter DO show one. So it was two second gates, not five. ⚠️ THAT COUNT MOVED TO **THREE** IN pk36/d1 and
// the sentence is corrected rather than left standing: the café's exception is gone — its fork regenerates a
// gate registry of its own now — so four of the six faces carry a gate and only the two admins do not. A
// cookie scoped to the whole `.forgecommerce.pro` zone — decided on 13/09, one dismissal for all six faces,
// with a ribbon that reopens any of them — is a change to the KIT and belongs to the product; this
// repository names it rather than remedying it from here, and the change above makes it worth one more face.

import { useEffect, useState } from 'react';
import { ARCH, GATE_LANG_COOKIE, HUB, LANGS, type Lang, resolveLang, STRINGS } from '../i18n';
import { ArchScreen, ArchSwitch } from './arch';
import styles from './gate.module.css';
import { GateHub } from './hub';
import { GATE_MARK } from './marks';

export type GateBlockProps = {
  /** The "← back" target (the marketing site). */
  siteUrl: string;
  /** The FIRST tenant's admin origin as this box really publishes it (`FORGE_GATE_ADMIN_URL`); its row opens
   *  `${origin}/enter`, the server-side redeem handoff — one origin PER TENANT, keyed by tenant id. Every
   *  face whose tenant is absent from the map keeps the address the declaration gives it. */
  adminUrls?: Readonly<Record<string, string>>;
  /** The host the browser asked for, as the server saw it — which of the hub's faces is "here". */
  here?: string;
  /** The server's Accept-Language guess (PT default). `?lang=` on the URL overrides it on mount. */
  initialLang: Lang;
  /** A Server Action that sets the dismissal cookie; the way IN, on this origin. */
  dismiss: () => Promise<void>;
};

/** Which of the gate's two screens is on. One at a time: the other is unmounted, so each fades itself in. */
type View = 'gate' | 'arch';

export function GateBlock({ siteUrl, adminUrls, here, initialLang, dismiss }: GateBlockProps) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [view, setView] = useState<View>('gate');

  /** Move between the screens. The new screen is a whole page tall, so the visitor has to start at ITS top —
   *  without this, opening the architecture from the foot of the gate lands mid-diagram. */
  const show = (next: View) => {
    setView(next);
    window.scrollTo(0, 0);
  };

  // `?lang=` on the URL wins (the marketing site links with the locale). Read it on mount; the strings are all
  // embedded, so the switch is instant (no network).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q) setLang(resolveLang(q));
  }, []);

  // PERSIST the chosen language so it survives the gate → ribbon → re-opened gate (the server reads this cookie
  // for its initialLang, instead of re-guessing Accept-Language). Written on every lang change (mount, ?lang=,
  // footer selector). Client-side document.cookie — a non-secret UI preference, 1-year, path=/.
  useEffect(() => {
    // The rule's alternative is the CookieStore API, which Safari and Firefox do not ship — and this gate is
    // the FIRST thing a visitor meets, so it cannot depend on a Chromium-only API. The value is a non-secret UI
    // preference (the chosen language); the server only ever reads it as a hint for initialLang.
    // biome-ignore lint/suspicious/noDocumentCookie: CookieStore is Chromium-only; this is a non-secret UI pref.
    document.cookie = `${GATE_LANG_COOKIE}=${lang};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  }, [lang]);

  const t = STRINGS[lang];
  const hub = HUB[lang];

  // The second screen REPLACES the first rather than sitting under it: the switch is a move between two
  // full-height pages, and the language the visitor chose travels with them.
  if (view === 'arch') return <ArchScreen lang={lang} onClose={() => show('gate')} />;

  return (
    // ⚠️ `data-testid` IS LOAD-BEARING HERE, not test scaffolding: it is the only handle a probe on the other
    // side of the wire has for "the visitor met the gate" (the class names are build hashes). See `./marks`.
    <div className={styles.backdrop} data-testid={GATE_MARK}>
      <div className={styles.shell}>
        <div className={styles.masthead}>
          <div>
            <div className={styles.brand}>
              <span className={styles.brandName}>
                forge<span className={styles.brandDot}>.</span>
              </span>
              <span className={styles.brandDemo}>demo</span>
            </div>
            {/* ★ THE HEADLINE IS THE DESIGN'S, word for word ("Dois tenants. Quatro lojas. Dois admins.").
                One clause per LINE, declared rather than left to a character measure — see `.title`. */}
            <h1 className={styles.title}>
              {hub.headline.map((clause) => (
                <span key={clause} className={styles.titleLine}>
                  {clause}
                </span>
              ))}
            </h1>
          </div>
          <p className={styles.lede}>
            {hub.lede[0]}
            <strong className={styles.ledeWord}>{hub.lede[1]}</strong>
            {hub.lede[2]}
          </p>
        </div>

        <GateHub lang={lang} here={here} adminUrls={adminUrls} dismiss={dismiss} />

        <div className={styles.foot}>
          <p className={styles.notice}>{hub.notice}</p>
          <div className={styles.langWrap}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6E6A63"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {LANGS.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`${styles.langBtn} ${lang === code ? styles.langActive : ''}`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.backRow}>
          <a className={styles.backLink} href={siteUrl}>
            {t.back}
          </a>
        </div>

        <ArchSwitch label={ARCH[lang].open} direction="open" onClick={() => show('arch')} />
      </div>
    </div>
  );
}

export default GateBlock;
