// The two ways out of the 404 — "Voltar à loja" and "Buscar cafés" — as MARKUP ONLY.
//
// It is its own module because the same two anchors are drawn from both sides of the server/client line: the
// store-LESS root 404 renders them once, on the server, from the base it was given; the store-scoped one
// renders them inside `NotFoundWayOut`, which re-renders them against the store the port confirmed. One copy
// of the markup, so the corrected pair cannot drift from the server-rendered pair it replaces.
//
// No 'use client' here, deliberately: a module without the directive is server-rendered where a server
// component imports it and bundled where a client component does. Adding one would drag the store-less 404
// into the browser bundle for nothing.

import { House, Search } from '@forgecommerce/storefront-kit/icons';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import styles from './NotFoundContent.module.css';

export function NotFoundActions({ base }: { base: StoreBase }) {
  return (
    <div className={styles.actions}>
      <a className={styles.primary} href={storeHref(base, '/')} data-testid="not-found-home">
        <House size={15} />
        Voltar à loja
      </a>
      <a
        className={styles.secondary}
        href={storeHref(base, '/search')}
        data-testid="not-found-search"
      >
        <Search size={15} />
        Buscar cafés
      </a>
    </div>
  );
}
