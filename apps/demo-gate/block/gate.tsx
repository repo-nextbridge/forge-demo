'use client';

// The demo-gate block — the full-screen "Demo store" interstitial, faithful to design-base/Forge Demo.dc.html.
// A client component so the footer PT/EN/ES selector switches live and `?lang=` on the URL can win over the
// server's Accept-Language guess. Responsive is pure CSS (@media 760px). The two paths:
//   · "Open the store" → a <form> posting the `dismiss` Server Action (sets the dismissal cookie); the SAME route
//     then renders the real store (deep link preserved — the gate covers the route, never redirects to home).
//   · "Open the admin"  → a top-level link to the admin origin's `/enter` route, which redeems the operator
//     access key server-side and lands signed in (the key never touches the browser; SameSite=Lax allows the nav).
// The two mini-mockups are static decoration ported verbatim from the design (inline styles); the frame, text,
// buttons and footer are the CSS module. The H1 uses the theme's own font (Urbanist) — the design's own display
// face is dropped (no bundled or fetched font).

import { useEffect, useState } from 'react';
import { GATE_LANG_COOKIE, type Lang, resolveLang, STRINGS } from '../i18n';
import styles from './gate.module.css';

const ArrowIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
);

/** The storefront mini-mockup (browser chrome + a product grid) — static decoration, verbatim from the design. */
const StorefrontMock = () => (
  <div
    style={{
      width: 'min(210px,100%)',
      background: '#FAFAFA',
      border: '1px solid rgba(255,255,255,.1)',
      borderRadius: 11,
      padding: 6,
      boxShadow: '0 10px 26px -12px rgba(0,0,0,.6)',
    }}
  >
    <div style={{ background: '#fff', borderRadius: 7, overflow: 'hidden' }}>
      <div
        style={{
          height: 16,
          borderBottom: '1px solid rgba(0,0,0,.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '0 7px',
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DDD' }} />
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DDD' }} />
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DDD' }} />
      </div>
      <div style={{ padding: 8 }}>
        <div
          style={{
            height: 34,
            borderRadius: 4,
            background: 'linear-gradient(120deg,#E9E6E1,#F5F3F0)',
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 5,
            marginTop: 6,
          }}
        >
          {[
            { w1: '80%', w2: '46%' },
            { w1: '70%', w2: '52%' },
            { w1: '86%', w2: '40%' },
          ].map((c) => (
            <div key={c.w1}>
              <div style={{ height: 28, borderRadius: 4, background: '#F1EFEC' }} />
              <div
                style={{
                  height: 4,
                  width: c.w1,
                  borderRadius: 2,
                  background: '#EAE7E3',
                  marginTop: 4,
                }}
              />
              <div
                style={{
                  height: 4,
                  width: c.w2,
                  borderRadius: 2,
                  background: '#C2410C',
                  marginTop: 3,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/** The admin mini-mockup (sidebar + KPI cards + a status list) — static decoration, verbatim from the design. */
const AdminMock = () => (
  <div
    style={{
      width: 'min(210px,100%)',
      background: '#FAFAFA',
      border: '1px solid rgba(255,255,255,.1)',
      borderRadius: 11,
      padding: 6,
      boxShadow: '0 10px 26px -12px rgba(0,0,0,.6)',
    }}
  >
    <div style={{ background: '#fff', borderRadius: 7, overflow: 'hidden' }}>
      <div
        style={{
          height: 16,
          borderBottom: '1px solid rgba(0,0,0,.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '0 7px',
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DDD' }} />
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DDD' }} />
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DDD' }} />
      </div>
      <div style={{ display: 'flex' }}>
        <div
          style={{
            width: 34,
            borderRight: '1px solid rgba(0,0,0,.06)',
            padding: '7px 5px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ height: 4, borderRadius: 2, background: '#C2410C' }} />
          <div style={{ height: 4, borderRadius: 2, background: '#EAE7E3' }} />
          <div style={{ height: 4, borderRadius: 2, background: '#EAE7E3' }} />
          <div style={{ height: 4, borderRadius: 2, background: '#EAE7E3' }} />
        </div>
        <div style={{ flex: 1, padding: '7px 8px' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {[
              { w: '60%', v: '128' },
              { w: '70%', v: 'R$ 42k' },
            ].map((k) => (
              <div
                key={k.v}
                style={{
                  flex: 1,
                  border: '1px solid rgba(0,0,0,.07)',
                  borderRadius: 4,
                  padding: '4px 5px',
                }}
              >
                <div style={{ height: 3, width: k.w, borderRadius: 2, background: '#EAE7E3' }} />
                <div style={{ fontSize: 7, fontWeight: 800, color: '#17181A', marginTop: 3 }}>
                  {k.v}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 6,
              border: '1px solid rgba(0,0,0,.07)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            {[
              { c: '#16A34A', last: false },
              { c: '#C2410C', last: false },
              { c: '#1D4ED8', last: true },
            ].map((r) => (
              <div
                key={r.c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 5px',
                  borderBottom: r.last ? undefined : '1px solid rgba(0,0,0,.05)',
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: r.c,
                    flex: 'none',
                  }}
                />
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#EFEDEA' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export type GateBlockProps = {
  /** The "← back" target (the marketing site). */
  siteUrl: string;
  /** The admin origin; "Open the admin" navigates to `${adminUrl}/enter` (the server-side redeem handoff). */
  adminUrl?: string;
  /** The server's Accept-Language guess (PT default). `?lang=` on the URL overrides it on mount. */
  initialLang: Lang;
  /** A Server Action that sets the dismissal cookie; "Open the store" posts it and the real store renders. */
  dismiss: () => Promise<void>;
};

export function GateBlock({ siteUrl, adminUrl, initialLang, dismiss }: GateBlockProps) {
  const [lang, setLang] = useState<Lang>(initialLang);

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
  const adminHref = adminUrl ? `${adminUrl.replace(/\/$/, '')}/enter` : undefined;

  return (
    <div className={styles.backdrop}>
      <div className={styles.shell}>
        <div className={styles.frame}>
          <div className={styles.header}>
            <div className={styles.brand}>
              <span className={styles.brandName}>
                forge<span className={styles.brandDot}>.</span>
              </span>
              <span className={styles.brandDemo}>demo</span>
            </div>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot}>.</span>
              {t.eyebrow}
            </div>
            <h1 className={styles.title}>{t.title}</h1>
            <p className={styles.intro}>{t.intro}</p>
          </div>

          <div className={styles.grid}>
            <div className={`${styles.hatch} ${styles.hatchLeft}`} />
            <div className={styles.cards}>
              {/* Storefront */}
              <div className={styles.card}>
                <div className={styles.mockWrap}>
                  <StorefrontMock />
                </div>
                <div>
                  <div className={styles.cardTitle}>Storefront</div>
                  <p className={styles.cardDesc}>{t.storefrontDesc}</p>
                  <form action={dismiss}>
                    <button type="submit" className={styles.cta}>
                      {t.storefrontCta}
                      <ArrowIcon />
                    </button>
                  </form>
                </div>
              </div>
              {/* Admin */}
              <div className={`${styles.card} ${styles.cardDivided}`}>
                <div className={styles.mockWrap}>
                  <AdminMock />
                </div>
                <div>
                  <div className={styles.cardTitle}>Admin</div>
                  <p className={styles.cardDesc}>{t.adminDesc}</p>
                  <a className={styles.cta} href={adminHref ?? '#'}>
                    {t.adminCta}
                    <ArrowIcon />
                  </a>
                </div>
              </div>
            </div>
            <div className={`${styles.hatch} ${styles.hatchRight}`} />
          </div>
        </div>

        <div className={styles.footer}>
          <a className={styles.backLink} href={siteUrl}>
            {t.back}
          </a>
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
            {(['pt', 'en', 'es'] as const).map((code) => (
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
      </div>
    </div>
  );
}

export default GateBlock;
