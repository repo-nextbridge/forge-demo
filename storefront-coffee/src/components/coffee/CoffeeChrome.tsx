// THE COFFEE SHOP'S CHROME — this store's own header and footer, replacing the reference vitrine's.
//
// The reference chrome (`@forgecommerce/storefront-kit/chrome`) is a shop-shaped header: search box, mega
// menu, a mini-cart drawer, the merchant's composed header regions. This shop has none of that by design —
// two links, a logo, an account button and a bag — so it is written here rather than configured there. That
// is what forking the vitrine IS, and it is the one place where writing our own is cheaper than bending
// somebody else's.
//
// ── WHAT IS KEPT FROM THE KIT, AND WHY IT WOULD BE A MISTAKE TO REWRITE IT ───────────────────────────────
// `MinicartProvider` stays. It is not "the drawer" — it is the CART STATE MACHINE: it seeds the count from
// the port after hydration, re-reads after every mutation, and owns the busy/error handling. The drawer was
// only one of its consumers. Dropping it to "simplify" would mean re-implementing the read-after-write
// against the port, which is exactly the code a fork should be inheriting.
//
// What this shop does NOT mount from it: the drawer, the search box, the account modal. The bag is a LINK to
// the checkout, and the badge is the only feedback — see SacolaBadge.tsx.

import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { MinicartProvider } from '@/components/minicart/MinicartProvider';
import {
  addToCartAction,
  cartSummaryAction,
  chooseGiftAction,
  removeLineAction,
  updateLineAction,
} from '@/lib/cart-actions';
import logoNegative from './forge-co-logo-negativo.png';
import logo from './forge-co-logo.png';
import { Icon } from './icons';
import { SacolaBadge } from './SacolaBadge';
import styles from './CoffeeChrome.module.css';

/** What the announcement bar says. Copy, in the shop's own words — not a token and not store data: this
 *  strip is part of the design the fork owns, and a merchant who wants it editable asks for a block. */
const ANNOUNCEMENT =
  'Frete grátis acima de R$ 149 · 10% OFF na primeira compra com o cupom PRIMEIRAXICARA';

/**
 * ★ THE LOGO ARRIVES AS A MODULE IMPORT, NOT FROM `public/`.
 *
 * Next emits an imported image under `/_next/static/`, which the edge middleware already excludes from
 * host->store rewriting and the Dockerfile already copies. A file in `public/` needs BOTH of those to have
 * been arranged for it — they have been, under `public/assets/`, but an import needs neither and cannot be
 * got wrong. The `<img>` is deliberate over `next/image`: this mark is cropped by the design (see the CSS)
 * and never resized, so the optimizer would be a round trip that changes nothing.
 */
function Logo({ href, negative = false }: { href: string; negative?: boolean }) {
  const asset = negative ? logoNegative : logo;
  return (
    <a href={href} className={negative ? styles.footerLogo : styles.logo} aria-label="forge.co">
      <img src={asset.src} alt="forge.co" />
    </a>
  );
}

export function CoffeeChrome({
  store,
  base,
  children,
}: {
  store: string;
  base: StoreBase;
  children: ReactNode;
}) {
  const home = `${base}/`;
  const minicartActions = {
    readCart: cartSummaryAction.bind(null, store),
    addLine: addToCartAction.bind(null, store),
    updateLine: updateLineAction.bind(null, store),
    removeLine: removeLineAction.bind(null, store),
    chooseGift: chooseGiftAction.bind(null, store),
  };

  return (
    <MinicartProvider actions={minicartActions}>
      <div className={styles.announce}>{ANNOUNCEMENT}</div>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <nav className={styles.nav}>
            <a href={`${home}#produtos`}>Nossos cafés</a>
            <a href={`${home}#assinatura`}>Assinatura</a>
          </nav>

          <Logo href={home} />

          <div className={styles.actions}>
            {/* The account door is the CHECKOUT's, on the same hostname by a path the edge routes there.
             * The vitrine never served it and does not start now.
             *
             * ⚠️⚠️ AND IT STILL CARRIES THE STORE BASE, which is the whole of this fix. These two were
             * written as bare `/account` and `/checkout` — correct on a store with its own hostname, and
             * WRONG the moment one origin serves more than one store: the checkout then resolves the store
             * from the HOST, and this bench's host is the SHOE shop. Measured before the fix, on the
             * coffee PDP: `/checkout` answered with store sto_01M1DE555DZ… (the shoes, no theme) while
             * `/s/<café>/checkout` answered with sto_01M1DE555TJ… and `data-forge-theme="coffee-store"`.
             * A shopper clicking the bag in the coffee shop landed in the shoe shop's checkout.
             *
             * `storeHref` is the same helper every other link in this fork already uses, and it is right in
             * BOTH worlds: it yields a bare `/checkout` when the base is host-resolved (production, where
             * each store has its own DNS) and `/s/<store>/checkout` when the URL is path-scoped. The edge
             * routes both to the checkout container — `caddy/Caddyfile.local` carries a `handle` block for
             * the store-scoped checkout and account prefixes for exactly this reason.
             * (The glob is not spelled out here on purpose: its star-slash would close this comment.) */}
            <a href={storeHref(base, '/account')} className={styles.account} aria-label="Minha conta">
              <Icon name="user" size={16} strokeWidth={1.5} />
            </a>
            <a href={storeHref(base, '/checkout')} className={styles.bag}>
              <Icon name="bag" size={15} strokeWidth={1.5} />
              Sacola
              <SacolaBadge />
            </a>
          </div>
        </div>
      </header>

      <main id="conteudo">{children}</main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Logo href={home} negative />
          <nav className={styles.footerNav}>
            <a href={`${home}#produtos`}>Nossos cafés</a>
            <a href={`${home}#assinatura`}>Assinatura</a>
            <a href={storeHref(base, '/checkout')}>Minha sacola</a>
          </nav>
          {/* ★ A34 — WHAT THE LAST LINE OF THE FOOTER IS FOR. It used to be a copyright notice, which is a
           * claim nobody reads and this demo does not need to make. The line a shop actually wants there is
           * the one that answers the question a shopper has at the bottom of the page, and the mark that
           * answers it is the same padlock the checkout's own header carries. */}
          <div className={styles.copy}>
            <Icon name="lock" size={13} strokeWidth={1.5} />
            Compra segura
          </div>
        </div>
      </footer>
    </MinicartProvider>
  );
}
