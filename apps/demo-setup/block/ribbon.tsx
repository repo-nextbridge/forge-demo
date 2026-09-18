// ★★ THE DEMO'S OWN RIBBON — the one sentence every shop of this box owes a visitor: what they are looking at
// is a demonstration, nothing here is charged and nothing is shipped.
//
// ★★★ IT IS A BLOCK, AND THAT IS THE WHOLE POINT OF THIS SLICE. The same sentence used to be drawn by the
// box's OTHER app — the GATE, retired in this slice — as one face of the `storefront:gate` slot. Filling that
// slot is not free:
// the product's storefront asks, at the very edge of every store route, whether an INSTALLED app fills
// `storefront:gate`, and an installed one takes the whole store off the cacheable tree. Measured on the
// deployed box before this app grew a ribbon: every route answered `private, no-cache, no-store`, and a robot
// asking for any URL got the interstitial, with no `<title>`. A block costs none of that: it is rendered by the
// slot it was DROPPED INTO, like every other block, and a store with nothing placed renders exactly what it
// rendered before.
//
// ⛔ AND IT ASKS NOTHING AND DISMISSES NOTHING. No cookie is read, no cookie is written, there is no `if` that
// hides the bar for a returning visitor, and there is no way back to a gate — because there is no gate. The
// machinery that dismissed one and re-opened it on a browser BACK (`return-to-gate.ts`, `shouldReopenGate`)
// left this repository with the app that owned it. What is left is a bar that is always there.
//
// ★ THE REVEAL IS THE ONE BEHAVIOUR THAT SURVIVED, AND IT IS A SECOND SHORTER NOW. The bar lives at the foot
// of the page, off-screen on arrival; an IntersectionObserver arms a fade + rise once it enters the viewport,
// then waits a beat and eases it in — once. The beat was 2000 ms and is 1000 ms (the owner's correction): at
// two seconds a visitor who scrolled to the footer had already stopped looking at it.
//
// ⚠️ PROGRESSIVE ENHANCEMENT, IN THIS ORDER, AND THE ORDER IS THE POINT. The server renders the ribbon
// VISIBLE, so with JavaScript OFF the sentence is simply there — an honesty notice that needs a bundle to
// appear is an honesty notice a crawler and a reader-mode never see. When JS mounts it "arms" (hides) the bar,
// which is invisible because the bar is below the fold, and reveals it on scroll. ⛔ And it arms ONLY where an
// `IntersectionObserver` exists to reveal it again: arming is what hides it, so a browser that has one and a
// browser that has none must end in the same visible state and never in a bar that was hidden by a mechanism
// that was not there to finish.

'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ribbon.module.css';

/** Where the sentence points. ⛔ NOT `storeHref`: that function exists to keep a shopper INSIDE the store they
 *  are browsing, and this is the one link on the page that is deliberately leaving it. */
export const DEMO_HREF = 'https://forgecommerce.pro/demo';

/** The mark a probe outside the browser can see — the shape `marks.tsx` already uses for this app's three
 *  marks (`demo-setup-header`, …). CSS Modules hash their class names into the build, so a class is not a
 *  handle anything may pin to. */
export const RIBBON_MARK = 'demo-setup-ribbon';

/** ★ THE COPY SHIPS WITH THE APP, IN THREE LANGUAGES, AND IS NOT CONFIG. A sentence an operator can edit is a
 *  sentence an operator can EMPTY, and this one is the box saying out loud that its prices are not real.
 *  ⚠️ The key is the front's own locale (`locale`, the storefront's single declaration of the language it
 *  ships in), matched on its language subtag: `pt-BR` and `pt` are the same shop. */
const STRINGS = {
  pt: {
    notice: 'Loja de demonstração: tudo fictício, nada será cobrado ou entregue.',
    cta: 'Conheça o Forge',
  },
  en: {
    notice: 'Demo store: everything is fictional, nothing will be charged or shipped.',
    cta: 'Discover Forge',
  },
  es: {
    notice: 'Tienda de demostración: todo es ficticio, no se cobrará ni se enviará nada.',
    cta: 'Descubre Forge',
  },
} as const;

type Lang = keyof typeof STRINGS;

/** The language subtag of whatever the surface handed us, or `pt` — the language this box's shops ship in.
 *  An unknown locale gets Portuguese rather than nothing: a notice in the wrong language still warns. */
export function ribbonLang(locale: string | undefined): Lang {
  const head = (locale ?? '').toLowerCase().split('-')[0];
  return head === 'en' || head === 'es' ? head : 'pt';
}

export function DemoRibbon({ locale }: { locale?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const copy = STRINGS[ribbonLang(locale)];

  useEffect(() => {
    const el = ref.current;
    // ⛔ ARM ONLY WHERE THE REVEAL CAN ALSO FIRE, AND THE ORDER OF THESE TWO LINES IS THE WHOLE RULE. Arming
    // HIDES the bar; the observer is what brings it back. A browser without `IntersectionObserver` that had
    // been armed first would hide the notice and never reveal it — the one failure this component may not
    // have. No observer ⇒ nothing is armed and the server's visible bar simply stays.
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // JS is present: arm the reveal. The bar sits at the page foot (off-screen), so hiding it now is invisible.
    setArmed(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Wait a beat after it enters the viewport, then ease it in — once.
          timer = setTimeout(() => setRevealed(true), 1000);
          io.disconnect();
        }
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={styles.ribbon}
      data-testid={RIBBON_MARK}
      data-armed={armed || undefined}
      data-revealed={revealed || undefined}
    >
      {/* A new tab on purpose: the sentence is about the shop the visitor is standing in, and sending them
          away from it to read about the product is the one thing this bar must not do. */}
      <a className={styles.link} href={DEMO_HREF} target="_blank" rel="noopener noreferrer">
        <span>{copy.notice}</span>
        <span className={styles.cta}>{copy.cta}</span>
      </a>
    </div>
  );
}

export default DemoRibbon;
