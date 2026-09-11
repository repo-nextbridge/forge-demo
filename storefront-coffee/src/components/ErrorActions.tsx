// The three ways out of a boundary that is NOT a 404 — "Tentar de novo", "Voltar à loja", "Buscar cafés".
//
// It is a sibling of `NotFoundActions` and not a parameter on it, because the two pages differ by exactly one
// door and it is the important one: a 404 has nothing to retry (the page does not exist), while a throw is
// very often transient — a ceiling refusal is cured by the next attempt once the window rolls. So the primary
// action here is `reset`, which re-renders the failed segment without reloading the chrome around it.
//
// Same shop voice as the 404 beside it: this store sells coffee, so the second door says "Buscar cafés" and
// not the reference storefront's "Buscar produtos". `NotFoundContent.tsx` carries the measurement behind that
// noun (the search works; what the café has no search BOX, which is its header's decision).
//
// No 'use client' of its own: it is rendered only from boundaries that already are client components, and a
// directive here would be a second, pointless bundle boundary.

import { House, Search } from '@forgecommerce/storefront-kit/icons';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import styles from './NotFoundContent.module.css';

export function ErrorActions({
  base,
  reset,
  /** The marker prefix of the page hosting these — `busy` or `error`, so a test can tell which body it got. */
  kind,
}: {
  base: StoreBase;
  reset: () => void;
  kind: 'busy' | 'error';
}) {
  return (
    <div className={styles.actions}>
      <button type="button" className={styles.primary} onClick={reset} data-testid={`${kind}-retry`}>
        Tentar de novo
      </button>
      <a
        className={styles.secondary}
        href={storeHref(base, '/')}
        data-testid={`${kind}-home`}
      >
        <House size={15} />
        Voltar à loja
      </a>
      <a
        className={styles.secondary}
        href={storeHref(base, '/search')}
        data-testid={`${kind}-search`}
      >
        <Search size={15} />
        Buscar cafés
      </a>
    </div>
  );
}
