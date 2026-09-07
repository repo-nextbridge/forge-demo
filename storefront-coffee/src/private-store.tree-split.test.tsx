// ★★ pk22/D3 — A STORE THAT EXISTS BUT HAS NO PUBLIC PAGE ANSWERS 404 IN THIS FORK TOO, IN BOTH TREES.
//
// WHY THIS FILE IS HERE AND NOT ONLY IN THE MONOREPO. The café's vitrine is a CUT of the reference one, and a
// cut is a snapshot: pk9/P1 taught the reference to refuse a store with no public page, pk21/P1 taught it to
// forward a store that is open somewhere else, and neither travelled here — `bin/store-mount-drift.guard.mjs`
// is what said so, in SOURCE. That guard's own header is careful about its limit: "it compares SOURCE, so it
// proves the mount and never the response". This file is the response, on this fork's own layouts.
//
// ⚠️ AND IT EXISTS BECAUSE THE CAFÉ IS `active`, NOT IN SPITE OF IT. The one store this deployable serves is
// on the street today, so adopting the rule changes nothing anybody can see on the bench — which is exactly
// the shape of a change that rots unnoticed. The table below FORCES the case the bench cannot produce.
//
// ★★ BOTH TREES, AND THAT IS THE POINT OF THE FILE. `s/[store]` serves the dynamic pages; `c/[store]`
// (PERF-B) serves the CACHED HTML — home, PDP, clean PLP — and `middleware.ts` routes there by resolving a
// HOST, never by asking whether the store is on the street. Wiring only the first would leave the FAST pages
// serving a store the SLOW ones already 404: the worst possible split, because the cached tree is the one a
// crawler and a CDN see most.
//
// ⚠️ WHY THE ASSERTION IS `notFound()` AND NOT `HTTP/1.1 404`: a Server Component has no other way to set a
// status — `notFound()` IS the 404 in App Router — so asserting the call is asserting the mechanism. And the
// SECOND assertion of each case (nothing rendered) is not decoration: `requirePublicStorefront` became async
// in pk21/P1, so an unawaited call throws into a floating promise and the layout serves the store anyway,
// green on the "was it called?" half alone.
//
// ★ AND IT COVERS TWO THINGS THE SOURCE GUARD MEASURABLY CANNOT, both checked by sabotage on 2026-09-07:
//   · dropping the `await` in front of the refusal leaves the guard GREEN (4/4) and serves the private store
//     in both trees — the import is there, the name is used, and only a render says otherwise;
//   · deleting a layout makes the guard say NOT CHECKED (a skip, by its own design) while `bash bin/test.sh`
//     still reports 0 failures. With this file present the same deletion is RED, because the table below
//     imports the layouts by path and `bin/fork-suite.guard.mjs` runs this suite.
//
// ⚠️ WHAT IS NOT HERE, ON PURPOSE: turning off the page must not turn off the STORE. The port keeps answering
// for a private store — that is how the counter's totem keeps selling — and it is proven in the monorepo,
// next to the kernel that implements it, never by mocking a port here.

import type { StoreFlags } from '@forgecommerce/storefront-kit/read-client';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

/** The store → `storefront_enabled` table the port would answer with. `undefined` is a kernel older than the
 *  field, which every front pinned to one must read as "on the street". */
const PUBLIC_FACE: Record<string, boolean | undefined> = {
  'sto-rua': true,
  'sto-balcao': false,
  'sto-antigo': undefined,
  'sto-outro-front': false,
};

/** The store that is off our street and OPEN somewhere else: the merchant kept the kernel and replaced the
 *  front. Nothing in the layouts knows this store, or any store, by name. */
const ELSEWHERE: Record<string, string> = { 'sto-outro-front': 'https://balcao.example.com' };

const storeFlagsMock = vi.fn(
  async (store: string): Promise<StoreFlags | null> => ({
    name: store,
    masked_checkout_enabled: false,
    guest_checkout_enabled: true,
    timezone: 'America/Sao_Paulo',
    ...(PUBLIC_FACE[store] === undefined ? {} : { storefront_enabled: PUBLIC_FACE[store] }),
    ...(ELSEWHERE[store] ? { public_url: ELSEWHERE[store] } : {}),
  }),
);

const notFoundMock = vi.fn(() => {
  // The real `notFound()` throws — a layout that kept rendering after it would still serve the store.
  throw new Error('NEXT_NOT_FOUND');
});
const redirectMock = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
  redirect: (to: string) => redirectMock(to),
}));
vi.mock('@forgecommerce/storefront-kit/config', () => ({
  readClient: () => ({
    storeFlags: (store: string) => storeFlagsMock(store),
    // The `s/[store]` layout also asks who fills the gate slot. Nobody does here.
    extensions: async () => [],
  }),
}));
vi.mock('@forgecommerce/storefront-kit/gate/actions', () => ({
  dismissGate: async () => {},
  reopenGate: async () => {},
}));
vi.mock('@forgecommerce/storefront-kit/gate/registry', () => ({ resolveGate: () => undefined }));

// `headers()` JOINS `cookies()` HERE, and the two are mocked for OPPOSITE reasons. The cookie read must never
// be reached by a refused store (the gate machinery is below the refusal). The header read is the refusal's
// own: the dynamic tree asks which address this request came in on before it decides between a redirect and a
// 404 — and it must ask ONLY then, which is what the `sto-rua` case below holds in place.
const requestHost = { value: 'cafe.example.com' };
const headersMock = vi.fn(async () => new Headers({ host: requestHost.value }));

vi.mock('next/headers', () => ({
  cookies: () => {
    throw new Error('a refused store must never reach the cookie read');
  },
  headers: () => headersMock(),
}));
vi.mock('@/components/coffee/CoffeeChrome', () => ({
  CoffeeChrome: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

/** The two store-scoped layouts of THIS fork, rendered exactly as the app mounts them. */
const TREES = [
  { name: 's/[store] (dynamic)', load: () => import('@/app/s/[store]/layout') },
  { name: 'c/[store] (edge-cacheable, PERF-B)', load: () => import('@/app/c/[store]/layout') },
] as const;

async function renderStore(
  tree: (typeof TREES)[number],
  store: string,
): Promise<string | undefined> {
  const { default: Layout } = await tree.load();
  // Settled either way ON PURPOSE, so the assertion that fails first is the NAMED one: a bare
  // `rejects.toThrow` reports "promise resolved instead of rejecting", which says nothing about what broke.
  try {
    return renderToString(
      await Layout({ children: <p id="page">a loja</p>, params: Promise.resolve({ store }) }),
    );
  } catch {
    return undefined;
  }
}

afterEach(() => {
  storeFlagsMock.mockClear();
  notFoundMock.mockClear();
  redirectMock.mockClear();
  headersMock.mockClear();
  requestHost.value = 'cafe.example.com';
});

describe.each(TREES)('$name', (tree) => {
  test('★ a store with NO public page is refused — 404, never an empty 200', async () => {
    const rendered = await renderStore(tree, 'sto-balcao');

    expect(
      notFoundMock,
      "the café's vitrine served a store that has no public page: the status line answers 200 about an " +
        'address that is not supposed to exist, which is what a monitor, a CDN and a crawler read as a live ' +
        'page — the same defect pk12/D2 measured here, one flag further along',
    ).toHaveBeenCalledOnce();
    expect(
      rendered,
      'nothing of the store may reach a shopper who asked for a store with no public page — this is also ' +
        'the assertion that fails if the refusal is called without being awaited',
    ).toBe(undefined);
  });

  test('a STREET store still renders — taking one off must not take them all off', async () => {
    const html = await renderStore(tree, 'sto-rua');

    expect(html).toContain('id="page"');
    expect(notFoundMock, 'a store on the street must never be 404ed').not.toHaveBeenCalled();
  });

  test('★ the flag ABSENT means the street — a front older than the kernel must not go dark', async () => {
    // The wire field is optional so a storefront pinned to a kernel that predates it still renders. Read as
    // "falsy means private", this would 404 EVERY store on such an instance: the whole shop, from a missing
    // key nobody would think to look for. This fork pins the kernel it ships with, but it is the same code.
    const html = await renderStore(tree, 'sto-antigo');

    expect(html).toContain('id="page"');
    expect(
      notFoundMock,
      'an absent flag is not a store taking itself off the street; it is a kernel that never had the field',
    ).not.toHaveBeenCalled();
  });

  test('★★ a STREET store never reads the request address: the tree stays as static as it was', async () => {
    // The address is read with `headers()`, a dynamic api. Reading it on every render would opt every page of
    // every store into per-request rendering to answer a question only a store with no page ever asks — and
    // in the CACHED tree it is a runtime 500 outright. Both trees are held to it from one table.
    await renderStore(tree, 'sto-rua');
    expect(
      headersMock,
      'the request address was read for a store that has a public page',
    ).not.toHaveBeenCalled();
  });
});

// ── ★★ AND HERE THE TWO TREES DIVERGE, WHICH IS THE ONE ASYMMETRY THIS FILE ASSERTS ─────────────────────
//
// A store off our street WITH an address of its own is a merchant who replaced the front (AGENTS.md rule #4).
// The dynamic tree can ask which address the request came in on — `middleware.ts` reaches it both by host
// rewrite (line 141) and by letting a literal `/s/…` through (line 79) — so it forwards the shopper to the
// shop that is actually open. The cached tree cannot ask (a dynamic API in that static shell is a runtime
// 500, as its own `not-found.tsx` says) and does not need to: `middleware.ts` only rewrites into `/c/…` after
// resolving the request Host to the store, so the address is HERE and a redirect would loop.
//
// ⚠️ THIS IS THE ONE PLACE THE TWO ANSWERS DIFFER ON PURPOSE, and the cases above are why that is safe: both
// trees still refuse the store, so no page of it is ever served by either. What differs is where the visitor
// is put down.

// ★ FIX THE SUBJECT FIRST. The three tests below all assert about a store that is off our street AND has an
// address; with no such row in the table two of them (the loop guard and the cached tree) would go green on
// the ORDINARY 404 while proving nothing about the address at all.
test('★ the table has a subject: a store off our street WITH an address of its own', () => {
  const subjects = Object.keys(ELSEWHERE).filter((store) => PUBLIC_FACE[store] === false);
  expect(
    subjects,
    'no store here is both off the street and addressable, so the three assertions below pass over nothing',
  ).not.toHaveLength(0);
});

test('★★ the DYNAMIC tree sends the shopper to the front that serves the store', async () => {
  await renderStore(TREES[0], 'sto-outro-front');

  expect(redirectMock).toHaveBeenCalledWith('https://balcao.example.com');
  expect(
    notFoundMock,
    'a shop that is open somewhere else must not be reported as a shop that does not exist',
  ).not.toHaveBeenCalled();
});

test('★★ …unless the request already IS at that address — the loop guard, on the real layout', async () => {
  requestHost.value = 'balcao.example.com';
  await renderStore(TREES[0], 'sto-outro-front');

  expect(
    redirectMock,
    'the vitrine redirected a request to the address it was reached at: an infinite loop on every visit',
  ).not.toHaveBeenCalled();
  expect(notFoundMock).toHaveBeenCalledOnce();
});

test('★★ the CACHED tree refuses without asking — it is already at the store address, and may not ask', async () => {
  await renderStore(TREES[1], 'sto-outro-front');

  expect(
    headersMock,
    'a dynamic api in the cacheable tree is a runtime 500',
  ).not.toHaveBeenCalled();
  expect(redirectMock).not.toHaveBeenCalled();
  expect(notFoundMock).toHaveBeenCalledOnce();
});
