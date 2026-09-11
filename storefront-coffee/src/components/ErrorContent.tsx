// ★★★ pk32/d3 — THE OTHER DEAD END OF THIS FORK, AND UNTIL NOW IT HAD NOTHING.
//
// ── WHAT WAS MEASURED, IN THIS REPOSITORY, 2026-09-10 ─────────────────────────────────────────────────────
//
//     find storefront-coffee/src totem/src -name 'error.tsx' -o -name 'global-error.tsx'   → EMPTY
//     grep -rl busy-boundary storefront-coffee/src totem/src                                → EMPTY
//
// `bin/fork-refusal-drift.guard.mjs` was already saying it out loud, per route: "storefront-coffee: NOT
// CHECKED — no src/app/error.tsx (the reference serves that route and this fork does not)". So every throw
// inside a Server Component of this shop reached the customer as Next's white "Application error: a
// server-side exception has occurred" — no chrome, no café, no Portuguese, and no way back. The 404 of this
// fork has had a body since S7-SF-CLOSE; the OTHER way a page fails to render had none.
//
// ⚠️ AND THE FORK DOES NOT INHERIT ANYTHING. The reference storefront grew three of these boundaries (pk27/p2)
// and taught all of them to tell busy from broken (pk31/p1) — none of that travels, because a fork is a CUT,
// and the files it did not cut do not arrive later. That is the whole reason this file is written rather than
// imported: the BODY is the shop's own copy; only the vocabulary of "not now" comes from the kit.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────────────────────────────────────
//
// It does not diagnose. Next strips a Server Component's error message in production and hands the boundary a
// `digest` only, so any explanation written here would be a guess printed at a customer. What it can honestly
// offer is the truth of every case at once, the doors out, and the digest in small print so whoever reads a
// screenshot can find the line in the log. The ONE cause this shop can explain — the read ceiling — has a page
// of its own (`BusyContent.tsx`), because that one is not a defect and has an answer to "when do I come back?".

import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { ErrorActions } from './ErrorActions';
import styles from './NotFoundContent.module.css';

export function ErrorContent({
  base,
  brand = false,
  digest,
  reset,
  wayOut,
}: {
  /** The store prefix of the current request, as far as this boundary can know it (see the 404 beside it). */
  base: StoreBase;
  /** Show the `forge.` logo — the store-LESS root boundary has no header to carry one. */
  brand?: boolean;
  /** Next's correlation id for the server-side throw. Absent on a client-side error. */
  digest?: string;
  /** Re-render the segment that failed. */
  reset: () => void;
  /** The CTAs as a client fragment that corrects the store prefix — same slot, same reason, as the 404's
   * (`NotFoundWayOut`): on this box one Host serves two TENANTS, so a boundary that falls back to `HOST_BASE`
   * sends a coffee customer into the shoe shop. Omitted → the actions render from `base` alone. */
  wayOut?: ReactNode;
}) {
  return (
    <main className={styles.root} data-testid="error-boundary">
      {brand ? (
        <a className={styles.brand} href={storeHref(base, '/')}>
          forge<span className={styles.brandDot}>.</span>
        </a>
      ) : null}

      <div className={styles.group}>
        <h1 className={styles.title}>Não foi possível carregar esta página</h1>
        <p className={styles.text}>
          Pode ter sido um instante de instabilidade. Tente de novo. Se continuar, volte à loja e
          siga escolhendo seu café.
        </p>
      </div>

      {wayOut ?? <ErrorActions base={base} reset={reset} kind="error" />}

      {digest ? (
        <p className={styles.text} data-testid="error-digest">
          <small>Código: {digest}</small>
        </p>
      ) : null}
    </main>
  );
}
