// The 404's WAY OUT — the two CTAs, with the store prefix CORRECTED — as a CLIENT fragment (PERF-B, p3-7).
//
// ⚠️ THE WAY OUT IS TWO CTAs AND NOTHING ELSE. It used to end in a row of category chips fetched after
// hydration, and this shop wants no browsable category links: not in its chrome (`CoffeeChrome` mounts two)
// and not as a consolation on a dead page. The fragment stayed a client component anyway, because the reason
// it became one was never the chips — it is the PREFIX below, and that is a fact only a fetch can supply here.
//
// ★★ p3-7 — WHY A PREFIX NEEDS A ROUND TRIP AT ALL.
//
// MEASURED on the bench 2026-09-03, on the coffee shop's own 404 (`/s/<cafe>/<slug que não existe>`): every
// link on the page dropped the `/s/<store>` prefix, because the boundary renders with `HOST_BASE`. On this box
// one Host serves three stores of TWO TENANTS, so the links landed the shopper in the shoe shop — a different
// tenant, from a dead page inside the coffee shop. That is the exact class `store-route.ts` exists to close
// ("a URL keeps the prefix the current request already has"), reaching the one surface the prop cannot travel
// to: App Router hands `not-found.tsx` no route params, and reading `headers()` there de-opts the whole group.
//
// ⛔ SO THE CORRECTION IS MADE AGAINST THE PORT'S ANSWER AND NEVER AGAINST THE ADDRESS BAR ALONE, and the
// difference is a real page. `/s/<anything>/x` reaches this boundary — the group's layout renders the chrome
// for whatever id is in the URL and does not check it — so a base built from `window.location.pathname` would
// point "Voltar à loja" at a store that does not exist, turning one dead page into two. `/api/store` answers
// with the store it RESOLVED (null when the read did not land), so a confirmed store is what moves these links
// and nothing else does.
//
// DEGRADES TO EXACTLY WHAT IT REPLACED: no JS, a failed fetch, or an unknown store → the server-rendered CTAs
// stand as they are, which is how a store-less 404 has always rendered.
'use client';

import { type StoreBase, pathScopedBase } from '@forgeco/storefront-kit/store-route';
import { useEffect, useState } from 'react';
import { currentStore, withStoreParam } from '@/lib/store-param';
import { NotFoundActions } from './NotFoundActions';

export function NotFoundWayOut({ base }: { base: StoreBase }) {
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // The address bar is the QUESTION ("am I standing in a store?"); the answer below is the port's.
    const standing = currentStore();
    fetch(withStoreParam('/api/store', standing))
      .then((res) => (res.ok ? res.json() : { store: null }))
      .then((body: { store: string | null }) => {
        if (!alive) return;
        // Only a store the port resolved may move a link, and only to the address space this browser is
        // actually in: a confirmed store the URL never named is the Host's, and the Host's URLs are clean.
        if (body.store && body.store === standing) setConfirmed(body.store);
      })
      .catch(() => {
        /* the server-rendered CTAs are the way out */
      });
    return () => {
      alive = false;
    };
  }, []);

  return <NotFoundActions base={confirmed ? pathScopedBase(confirmed) : base} />;
}
