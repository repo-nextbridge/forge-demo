// The 404's WAY OUT — the two CTAs and the category chips — as a CLIENT fragment (PERF-B, p3-7).
//
// The chips used to be fetched by `not-found.tsx` on the server, which had to learn the store from the
// `x-forge-store` request header — and that `headers()` call silently made every page of the (storefront)
// group impossible to prerender, because Next builds the not-found boundary into the route's static shell.
// The chips are a nicety on an error page; the catalog's cacheability is not. So they arrive after
// hydration, from a route handler that resolves the store from the request itself.
//
// ★★ p3-7 — AND THE CTAs COME WITH THEM, BECAUSE THE PREFIX IS THE SAME MISSING FACT.
//
// MEASURED on the bench 2026-09-03, on the coffee shop's own 404 (`/s/<cafe>/<slug que não existe>`): every
// link on the page dropped the `/s/<store>` prefix — the chips because this fetch hands back clean paths, and
// "Voltar à loja" / "Buscar cafés" because the boundary renders with `HOST_BASE`. On this box one Host serves
// three stores of TWO TENANTS, so all four links landed the shopper in the shoe shop — a different tenant,
// from a dead page inside the coffee shop. That is the exact class `store-route.ts` exists to close ("a URL
// keeps the prefix the current request already has"), reaching the one surface the prop cannot travel to:
// App Router hands `not-found.tsx` no route params, and reading `headers()` there de-opts the whole group.
//
// ⛔ SO THE CORRECTION IS MADE AGAINST THE PORT'S ANSWER AND NEVER AGAINST THE ADDRESS BAR ALONE, and the
// difference is a real page. `/s/<anything>/x` reaches this boundary — the group's layout renders the chrome
// for whatever id is in the URL and does not check it — so a base built from `window.location.pathname` would
// point "Voltar à loja" at a store that does not exist, turning one dead page into two. `/api/categories`
// answers with the store it RESOLVED (null when the read did not land), so a confirmed store is what moves
// these links and nothing else does.
//
// DEGRADES TO EXACTLY WHAT IT REPLACED: no JS, a failed fetch, or an unknown store → the server-rendered CTAs
// stand as they are and no chip row appears, which is how a store-less 404 has always rendered.
'use client';

import {
  type StoreBase,
  pathScopedBase,
  storeHref,
} from '@forgecommerce/storefront-kit/store-route';
import { useEffect, useState } from 'react';
import { currentStore, withStoreParam } from '@/lib/store-param';
import { NotFoundActions } from './NotFoundActions';
import styles from './NotFoundContent.module.css';

type Chip = { name: string; href: string };
type WayOut = { store: string | null; categories?: Chip[] };

export function NotFoundWayOut({ base }: { base: StoreBase }) {
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [categories, setCategories] = useState<Chip[]>([]);

  useEffect(() => {
    let alive = true;
    // The address bar is the QUESTION ("am I standing in a store?"); the answer below is the port's.
    const standing = currentStore();
    fetch(withStoreParam('/api/categories', standing))
      .then((res) => (res.ok ? res.json() : { store: null }))
      .then((body: WayOut) => {
        if (!alive) return;
        // Only a store the port resolved may move a link, and only to the address space this browser is
        // actually in: a confirmed store the URL never named is the Host's, and the Host's URLs are clean.
        if (body.store && body.store === standing) setConfirmed(body.store);
        setCategories(body.categories ?? []);
      })
      .catch(() => {
        /* the server-rendered CTAs are the way out */
      });
    return () => {
      alive = false;
    };
  }, []);

  const here = confirmed ? pathScopedBase(confirmed) : base;
  return (
    <>
      <NotFoundActions base={here} />
      {categories.length > 0 ? (
        <nav className={styles.chips} aria-label="Categorias" data-testid="not-found-chips">
          {categories.map((c) => (
            <a key={c.href} className={styles.chip} href={storeHref(here, c.href)}>
              {c.name}
            </a>
          ))}
        </nav>
      ) : null}
    </>
  );
}
