'use client';

// ★★ THE VITRINE'S ACCOUNT AFFORDANCE — A LINK, AND THAT IS THE DECISION, NOT A SIMPLIFICATION.
//
// CHECKOUT-APP (C1) — WHAT THIS REPLACES AND WHY. The header used to mount `AccountNav`, which opened the
// LOGIN MODAL in place and drove `customer.request_otp` / `customer.verify_otp` through two Server Actions
// declared in `(storefront)/account/actions.ts`. Those actions — and the modal — now live in
// `apps/checkout`, and a Server Action is not a function a second program can import: it is an HTTP endpoint
// of the app that declares it, addressed by a build-time id. A vitrine that kept the modal would have to
// carry a second copy of the login, which is precisely the maintenance a fork is being spared.
//
// So the guest state is a LINK to `/account/login`, which the edge routes to the checkout. The shopper meets
// one login, in one deployable, and the invitation *"esse e-mail já tem conta"* stays where it always was:
// inside the checkout.
//
// ⚠️ THE SIGNED-IN STATE IS UNCHANGED, and it is why this component still asks the port. `/api/account/status`
// STAYS in the vitrine (it reads the session through the kit's `readCustomerSession`, which is the whole point
// of the vitrine being able to READ a session it cannot mint). It answers a BOOLEAN — never the token; the
// httpOnly cookie stays server-side.
//
// ⚠️ AND IT IS ASKED AFTER HYDRATION, NOT RENDERED ON THE SERVER. The chrome renders inside the edge-cached
// tree (`app/c`), where one HTML is shared by every shopper: a signed-in state baked into that HTML would be
// served to the next visitor. This is the same "by-possession pieces arrive a beat later" pattern the
// mini-cart uses.

import { Check, UserRound } from '@forgeco/storefront-kit/icons';
import { type StoreBase, storeHref } from '@forgeco/storefront-kit/store-route';
import { useEffect, useState } from 'react';
import styles from './AccountLink.module.css';

export function AccountLink({ base }: { base: StoreBase }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/account/status')
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((d: { signedIn?: boolean }) => {
        if (alive) setSignedIn(Boolean(d.signedIn));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <a
      className={styles.account}
      // Signed in → the account itself. Guest → the login, which is a CHECKOUT route: same host, other
      // container, path routing at the edge. Built through `storeHref` like every other in-store URL, so a
      // store served from `/s/<id>` keeps its prefix instead of walking the shopper into another store.
      href={storeHref(base, signedIn ? '/account' : '/account/login')}
      aria-label={signedIn ? 'Minha conta' : 'Entrar'}
      data-testid="account-nav"
    >
      <UserRound size={19} />
      {signedIn ? (
        /* r4 #11 — a small blue "signed-in" dot, in the minicart badge's style, only while logged in. */
        <span className={styles.badge} data-testid="account-signed-in" aria-hidden="true">
          <Check size={9} strokeWidth={3} />
        </span>
      ) : null}
    </a>
  );
}
