// NotFoundContent — the shared body of the theme's 404 (HANDOVER §9): the giant "4·0·4" with the zero in the
// copper accent, a pt-BR line, and the two CTAs (filled "Voltar à loja" + house icon → accent on hover; outline
// "Buscar cafés" + search icon → accent on hover).
//
// ★ s3-16 — THE SECOND CTA SAYS WHAT THIS SHOP SELLS, AND THE MEASUREMENT BEHIND THAT IS WORTH THE LINE.
// It was reported as a promise the store cannot keep ("o café não tem busca, mas o 404 manda buscar"). Half
// of that is false and the half that is true is a different thing. MEASURED on the bench 2026-09-03:
// `/s/<cafe>/search?q=cafe` answers 200 with five real results, facets and sort — the search this page links
// to WORKS, and this CTA is the honest way out of a dead link. What the shop has no search BOX: the café's
// chrome deliberately mounts no search field (`CoffeeChrome.tsx` says so, and the artboard draws none), so
// this page is the only door to it. That is a design decision of the shop's header, not a lie on this page.
//
// What WAS wrong is the word. This is a fork, and a fork's copy is the shop's own: the reference storefront
// says "produtos" because it does not know what it sells, and this one does. Same href, same behaviour, the
// shop's noun.
//
// Two hosts render it: the store-scoped `(storefront)/not-found.tsx` and its cached twin `c/[store]`, which
// pass `wayOut` (the client fragment that draws the CTAs and the real chips against the store the port
// confirmed — p3-7), and the store-LESS root `app/not-found.tsx` (unknown host — no store, so `brand` shows
// the logo and there is no fragment: category data is a store's, never faked). Semantic tokens for color.

import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { NotFoundActions } from './NotFoundActions';
import styles from './NotFoundContent.module.css';

export function NotFoundContent({
  base,
  brand = false,
  categories = [],
  wayOut,
}: {
  /** MULTISTORE M1-β — the store prefix of the current request, as far as the SERVER can know it here.
   *
   * ⚠️ The store-scoped boundary passes `HOST_BASE` and cannot do better: App Router hands `not-found.tsx` no
   * route params, and the boundary is built into the route's STATIC SHELL, so `headers()` there de-opts (and
   * 500s) every page in the group — the same trap that turned the chips into a client fragment.
   *
   * ★ p3-7 — SO THE PREFIX ARRIVES THE SAME WAY THE CHIPS DO. It was the one surface in the M1-β pass where
   * the rule could not be honoured, and on a box whose single Host serves two TENANTS the cost was measured:
   * every way out of the coffee shop's 404 landed in the shoe shop. `wayOut` renders these CTAs a second time
   * against the store `/api/categories` confirmed; this `base` is what a shopper with no JS keeps. */
  base: StoreBase;
  /** Show the `forge.` logo (the store-LESS root 404 has no header to carry it). */
  brand?: boolean;
  /** Real category chips, already resolved (the preview gallery and the tests pass them; the store-less root
   * passes none — never faked). */
  categories?: { name: string; href: string }[];
  /** PERF-B / p3-7 — the CTAs and the chips as a CLIENT fragment (<NotFoundWayOut/>), used by the two
   * store-scoped 404s: resolving either on the server would need `headers()`, which turns the whole route
   * group dynamic. It REPLACES the server-rendered actions rather than sitting beside them — two rows of the
   * same two buttons is what "add the chips fragment" would have drawn. Omitted (the store-less root, the
   * preview gallery) → the actions render from `base` alone. */
  wayOut?: ReactNode;
}) {
  return (
    <main className={styles.root} data-testid="not-found">
      {brand ? (
        <a className={styles.brand} href={storeHref(base, '/')}>
          forge<span className={styles.brandDot}>.</span>
        </a>
      ) : null}

      <p className={styles.code} aria-hidden="true">
        4<span className={styles.zero}>0</span>4
      </p>

      <div className={styles.group}>
        <h1 className={styles.title}>Página não encontrada</h1>
        <p className={styles.text}>
          O link pode estar quebrado ou a página saiu do ar. Volte para a loja ou procure o café que
          você queria.
        </p>
      </div>

      {wayOut ?? <NotFoundActions base={base} />}

      {categories.length > 0 ? (
        <nav className={styles.chips} aria-label="Categorias" data-testid="not-found-chips">
          {categories.map((c) => (
            <a key={c.href} className={styles.chip} href={storeHref(base, c.href)}>
              {c.name}
            </a>
          ))}
        </nav>
      ) : null}
    </main>
  );
}
