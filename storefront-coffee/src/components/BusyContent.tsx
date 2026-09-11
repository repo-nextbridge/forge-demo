// ★★★ pk32/d3 — "MUITA GENTE AGORA" IS NOT "A LOJA QUEBROU", AND THIS FORK HAD NO WAY TO SAY EITHER.
//
// ── WHY THIS IS A SECOND BODY AND NOT A PARAMETER ON `ErrorContent` ───────────────────────────────────────
//
// `ErrorContent` is honest about a cause nobody knows: it offers the truth of every case at once plus the
// digest in small print, so whoever reads a screenshot can find the line in the log. A CEILING refusal is the
// opposite situation — the cause is known, it is not a defect, and the digest is not a correlation id but a
// WAIT. A customer shown "Código: forge.read.ceiling;40" learns nothing; shown "tente de novo em cerca de 40
// segundos" he learns the only thing there is to know. Different knowledge, different page.
//
// ── HOW THE CAUSE REACHES THIS FORK AT ALL (measured, because the brief asked) ────────────────────────────
//
// It arrives, and it arrives through the VENDORED KIT, not through anything this fork had to be taught:
//
//   · this shop's reads go through `readClient()` (`@forgecommerce/storefront-kit/config`), which builds the
//     kit's own read client with the platform `fetch`;
//   · a non-OK answer becomes `ReadPortError` (`storefront-kit/src/read-client.ts:1003`), and a 429 — and ONLY
//     a 429 — is given `digest = forge.read.ceiling;<seconds>` from the port's own `Retry-After`;
//   · `digest` is the one field Next preserves on the way to a boundary, so the refusal survives production,
//     where the message does not.
//
// ⇒ the LABEL arrives, and so does the kit's module for READING it. ★ It did not always: `./ceiling-digest` sat
// in the kit's `exports` and missing from its `publishConfig.exports`, so a tarball could not import it and this
// fork read the digest through a weld. `pk32/p1` published the subpath, so there is ONE definition again — the
// kit's — and one wording of "not now" across the product and both forks.
//
// This page never spells 429 and never invents a number: `ceilingWaitSentence(null)` is the vague sentence for a
// port that published no delay, because a promise the shop cannot keep is the same species of lie as the white
// error page this file replaces.

import { ceilingWaitSentence } from '@forgecommerce/storefront-kit/ceiling-digest';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { ErrorActions } from './ErrorActions';
import styles from './NotFoundContent.module.css';

export function BusyContent({
  base,
  brand = false,
  waitSeconds,
  reset,
  wayOut,
}: {
  base: StoreBase;
  /** Show the `forge.` logo — the store-LESS root boundary has no header to carry one. */
  brand?: boolean;
  /** The port's own `Retry-After`, in whole seconds; null when it named none. NEVER a default. */
  waitSeconds: number | null;
  /** Re-render the refused segment — which here is the entire fix, once the window rolls. */
  reset: () => void;
  /** The CTAs with the store prefix corrected (see `ErrorWayOut`). */
  wayOut?: ReactNode;
}) {
  return (
    <main className={styles.root} data-testid="busy-boundary">
      {brand ? (
        <a className={styles.brand} href={storeHref(base, '/')}>
          forge<span className={styles.brandDot}>.</span>
        </a>
      ) : null}

      <div className={styles.group}>
        <h1 className={styles.title}>Muita gente no café agora</h1>
        <p className={styles.text}>
          A loja recebeu mais acessos do que consegue atender neste instante. Nada quebrou: é só
          esperar um momento e abrir de novo.
        </p>
        <p className={styles.text} data-testid="busy-wait">
          {ceilingWaitSentence(waitSeconds)}
        </p>
      </div>

      {wayOut ?? <ErrorActions base={base} reset={reset} kind="busy" />}
    </main>
  );
}
