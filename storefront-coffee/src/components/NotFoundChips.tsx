// The 404's category chips, as a CLIENT fragment (PERF-B).
//
// They used to be fetched by `not-found.tsx` on the server, which had to learn the store from the
// `x-forge-store` request header — and that `headers()` call silently made every page of the (storefront)
// group impossible to prerender, because Next builds the not-found boundary into the route's static shell.
// The chips are a nicety on an error page; the catalog's cacheability is not. So they arrive after
// hydration, from a route handler that resolves the store from the request Host itself.
//
// Degrades to nothing: no JS, a failed fetch, or a store with no browsable categories → no chip row, exactly
// as a store-less 404 has always rendered. The two CTAs above them are the real way out and are server-rendered.
//
// ★★ MS-M1α — AND IT FORWARDS THE STORE IT IS STANDING IN. "Resolves the store from the request Host itself"
// was true and was the leak: a 404 under `/s/<store-of-tenant-B>` got tenant A's categories, because the fetch
// carries no prefix and the Host owns a different store. `withStoreParam` adds it when the address bar has one
// (it does not, on a clean host-based URL — where the Host already IS the answer).
'use client';

import { useEffect, useState } from 'react';
import { withStoreParam } from '@/lib/store-param';
import styles from './NotFoundContent.module.css';

type Chip = { name: string; href: string };

export function NotFoundChips() {
  const [categories, setCategories] = useState<Chip[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(withStoreParam('/api/categories'))
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((body: { categories?: Chip[] }) => {
        if (alive) setCategories(body.categories ?? []);
      })
      .catch(() => {
        /* no chips — the CTAs are the way out */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (categories.length === 0) return null;
  return (
    <nav className={styles.chips} aria-label="Categorias" data-testid="not-found-chips">
      {categories.map((c) => (
        <a key={c.href} className={styles.chip} href={c.href}>
          {c.name}
        </a>
      ))}
    </nav>
  );
}
