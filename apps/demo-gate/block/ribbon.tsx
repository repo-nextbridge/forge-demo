// DEMO-GATE — the persistent "demo store" ribbon, shown at the very bottom of every store page WHILE the store is
// being browsed (the gate is installed AND dismissed). A thin red bar (the header AnnouncementBar's thickness,
// inverted to a warning red) with white copy; the WHOLE bar is a form button that RE-OPENS the gate — it clears
// the dismissal cookie through the injected server action (the mirror of "Abrir a loja"), and the route re-renders
// with the full-screen gate back. Part of the gate app: it only appears where the gate is installed, and
// uninstalling the app removes it together with the gate. No JS required (a plain <form> POST).
//
// L3-3 — the ~2s reveal starts when the ribbon SCROLLS into view, not on load. Since the bar lives at the very
// foot of the page it is off-screen initially; an IntersectionObserver arms the fade+rise once it enters the
// viewport (then a 2s beat). Progressive enhancement: the server renders it VISIBLE, so with JavaScript OFF the
// ribbon is simply there (no observer, no reveal). When JS mounts it "arms" (hides) the ribbon off-screen — no
// visible flash — and reveals it on scroll.
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import { STRINGS } from '../i18n';
import styles from './ribbon.module.css';

export function GateRibbon({ lang, reopen }: { lang: Lang; reopen: () => Promise<void> }) {
  const ref = useRef<HTMLFormElement>(null);
  const [armed, setArmed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // JS is present: arm the reveal. The bar sits at the page foot (off-screen), so hiding it now is invisible.
    setArmed(true);
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Wait ~2s after it enters the viewport, then ease it in — once.
          timer = setTimeout(() => setRevealed(true), 2000);
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
    <form
      ref={ref}
      action={reopen}
      className={styles.ribbon}
      data-armed={armed || undefined}
      data-revealed={revealed || undefined}
    >
      <button type="submit" className={styles.button}>
        {STRINGS[lang].ribbon}
      </button>
    </form>
  );
}
