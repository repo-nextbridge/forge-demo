'use client';

// THE BAG COUNTER, AND THE ONLY FEEDBACK THIS SHOP GIVES WHEN SOMETHING IS ADDED.
//
// There is no mini-cart drawer here — that was a decision of the design, not an omission — so this badge is
// the whole answer to "did my click work?". A shopper who adds a bag and sees nothing move clicks again, and
// the second click is a second bag of coffee. That is why the animation is not decoration.
//
// ── HOW IT REDISPLAYS, and why the key is the COUNT ──────────────────────────────────────────────────────
// A CSS animation replays when the element is REMOUNTED, and React remounts on a changed `key`. The design's
// artboard keys it on a counter it increments per add (`badgeKey = "b" + added`); here the key is the count
// itself, which is the same signal derived from the truth instead of kept in parallel. Every successful add
// moves the count — that is what an add IS — so every successful add replays the pop, and a count that did
// not move is an add that did not happen.
//
// ⚠️ `prefers-reduced-motion` TAKES THE ANIMATION AND MUST NOT TAKE THE FEEDBACK. The stylesheet drops the
// pop; what survives is the number changing, plus the button's own "Adicionado" label on the page that did
// the adding. A reduced-motion shopper is not a shopper who deserves to wonder.

import { useMinicart } from '@/components/minicart/MinicartProvider';
import styles from './CoffeeChrome.module.css';

export function SacolaBadge() {
  const { snapshot } = useMinicart();
  const count = snapshot.count;
  return (
    <span
      key={count}
      className={count > 0 ? styles.badgeFull : styles.badgeEmpty}
      // The count is announced rather than merely drawn: the visual pop says "something happened" to a
      // sighted shopper and nothing at all to a screen reader, and this is the only confirmation there is.
      aria-live="polite"
      aria-label={count === 1 ? '1 item na sacola' : `${count} itens na sacola`}
    >
      {count}
    </span>
  );
}
