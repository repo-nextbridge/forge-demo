// The WAY OUT of an error boundary, with the store prefix CORRECTED — the error-page twin of `NotFoundWayOut`.
//
// ★ IT EXISTS FOR THE DEFECT p3-7 MEASURED ON THE 404, WHICH IS THE SAME DEFECT HERE. App Router hands a
// boundary no route params, and reading `headers()` in one turns the whole route group dynamic at runtime — so
// a store-scoped boundary renders with `HOST_BASE`, and on this box one Host serves three stores of TWO
// TENANTS. Measured then, on `/s/<cafe>/<slug que não existe>`: every link on the page landed the customer in
// the shoe shop. A broken page that also deports you is two defects.
//
// ⛔ AND THE CORRECTION COMES FROM THE PORT, NEVER FROM THE ADDRESS BAR ALONE — `/s/<anything>/x` reaches this
// boundary, so a base built from `window.location.pathname` would point "Voltar à loja" at a store that does
// not exist. `/api/store` answers with the store it RESOLVED; only a confirmed store moves a link.
//
// DEGRADES TO EXACTLY WHAT IT REPLACES: no JS, a failed fetch, or an unknown store → the server-rendered
// actions stand as they are.
'use client';

import { type StoreBase, pathScopedBase } from '@forgeco/storefront-kit/store-route';
import { useEffect, useState } from 'react';
import { currentStore, withStoreParam } from '@/lib/store-param';
import { ErrorActions } from './ErrorActions';

export function ErrorWayOut({
  base,
  reset,
  kind,
}: {
  base: StoreBase;
  reset: () => void;
  kind: 'busy' | 'error';
}) {
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const standing = currentStore();
    fetch(withStoreParam('/api/store', standing))
      .then((res) => (res.ok ? res.json() : { store: null }))
      .then((body: { store: string | null }) => {
        if (!alive) return;
        if (body.store && body.store === standing) setConfirmed(body.store);
      })
      .catch(() => {
        /* the server-rendered actions are the way out */
      });
    return () => {
      alive = false;
    };
  }, []);

  return <ErrorActions base={confirmed ? pathScopedBase(confirmed) : base} reset={reset} kind={kind} />;
}
