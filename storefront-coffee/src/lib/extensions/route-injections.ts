// ★ F3 — THE SEAM A GENERATED PUBLIC ROUTE PULLS FROM, and the sibling of `injections.tsx`.
//
// An app can produce a public DOCUMENT (the Google Shopping feed) but it cannot serve one: the kernel is
// unreachable from outside — the edge routes only `/webhooks/payment/*` and `/health` to it — so the file a
// crawler fetches has to live in the storefront. That file used to be hand-written, and importing the app was
// the only way to write it, which is precisely the weld the composition list exists to make impossible. Now
// the app DECLARES the URL (`forge.wiring.publicRoutes`) and the codegen writes the route.
//
// ★★ CHECKOUT-APP (C2 · §2.3b) — AND "THE SURFACE" IS NOW TWO SURFACES, WHICH IS WHY THREE SEAMS LEFT THIS
// FILE. `myOrder`, `customerCreate` and `accountOrderPath` are capabilities over a SIGNED-IN SHOPPER: the
// first two reach the session cookie, the third names an address inside `/account`. They live in
// `apps/checkout/src/lib/extensions/route-injections.ts` now, beside the screens that own the session.
//
// ⚠️ AND THAT MOVE IS WHAT DECIDES WHERE A GENERATED ROUTE IS WRITTEN. The codegen does not carry a list of
// which app gets which route: it asks which consumer can PROVIDE every injection a route declares, and writes
// the route there (see `frontConsumerOfRoute` in packages/codegen/src/composition.ts). So this file is not
// merely shorter — it is the reason `/apps/reviews/submit` is no longer generated into the vitrine, and the
// reason a future account-shaped route cannot be either.
//
// ★ WHAT IS INJECTED IS THE SURFACE'S KNOWLEDGE, NEVER THE WORK. Everything a route handler DOES — reading
// the app's settings through the public port, walking the catalog, batching the stock reads, the conditional
// GET, the refusals, building the bytes — is the app's, and it lives in the app. What cannot be the app's is
// what only the storefront knows:
//
//   · `requestOrigin`  — the scheme/host policy PERF-B wrote down (fixed `https`, one response per host);
//   · `storeForHost`   — MULTISTORE host->store resolution (dev override map, then `read.store.by_host`);
//   · `productPath`    — the canonical product URL. THE STOREFRONT'S ROUTING, and it has exactly one source
//                        in this repo (`catalog-path.ts`). An app that built this itself would publish links
//                        into a Merchant account that 404 the first time a client changed their scheme;
//   · `readBaseUrl` / `revalidateSeconds` — where the port is and how long its answers stay fresh;
//   · `readFace`       — WHICH read face this instance's server-side documents are built on: the path, the
//                        credential (if it has one), the two ceilings a client pages against, and whether
//                        that face's budget is the one the store's own pages spend. It replaced a bare
//                        `availabilityMaxSkus`, which told an app one number and let it assume the rest.
//
// ⚠️ THE APP DECLARES WHAT IT WANTS, NEVER WHERE IT COMES FROM — same sentence as the block seam next door.
// A route names `productPath` in its own package.json; the generated file turns that into
// `injectProductPath` and passes it. A name no surface provides is a COMPILE error in the generated route,
// naming the missing injection — not a feed that publishes wrong URLs at 3am.
//
// ⚠️ EVERY INJECTION IS A FUNCTION, including the ones that look like constants. `readBaseUrl` reads the
// environment; evaluated at module load it would freeze whatever the process had when Next first imported
// this file. Called at request time it cannot.

import { canonicalProductPath } from '@forgeco/storefront-kit/catalog-path';
import {
  bulkReadToken,
  readBaseUrl,
  resolveStoreForHost,
  revalidateSeconds,
} from '@forgeco/storefront-kit/config';
import {
  AVAILABILITY_MAX_SKUS,
  BULK_AVAILABILITY_MAX_SKUS,
  BULK_PRODUCTS_MAX_PAGE,
  PRODUCTS_MAX_PAGE,
} from '@forgeco/storefront-kit/read-client';
import { requestOrigin } from '@/lib/seo/origin';

/** The two facts a canonical product address is made of — declared STRUCTURALLY, deliberately not imported
 * from an app: this module must not know an app's name (the composition guard forbids it), and a type taken
 * from one app would silently become that app's injection. */
type Addressable = {
  handle: string;
  categories: { category_id: string; path: string; is_primary: boolean }[];
};

/** The request's host and absolute origin, or null when there is no Host header to trust. */
export const injectRequestOrigin: () => Promise<{ host: string; origin: string } | null> =
  requestOrigin;

/** MULTISTORE — which store this host serves, or undefined (the route then serves its own honest 404). */
export const injectStoreForHost: (host: string | undefined | null) => Promise<string | undefined> =
  resolveStoreForHost;

/** The canonical path of a product on THIS storefront (`/roupas/camisetas/<handle>`). */
export const injectProductPath: (product: Addressable) => string = canonicalProductPath;

/** The read port's base URL — the only "backend" the storefront knows. */
export const injectReadBaseUrl: () => string = readBaseUrl;

/** The data-cache window the storefront gives a port read (`next: { revalidate }`). */
export const injectRevalidateSeconds: () => number = revalidateSeconds;

/**
 * ★★ BULK-READ — WHICH READ FACE THIS INSTANCE'S SERVER-SIDE DOCUMENTS ARE BUILT ON.
 *
 * It REPLACES `availabilityMaxSkus`, and the replacement is the point. That injection handed an app ONE
 * number and left it to assume everything else about the port: which path, whether to send a credential,
 * how big a page may be, and — the one that mattered — whose budget it was spending. The app then paced
 * against a ceiling it shared with the store's own pages without ever being told it was sharing.
 *
 * A face is now one value with all of it in it:
 *   · `path`   — where a capability hangs off (`/v1/read` · `/v1/read/bulk`);
 *   · `headers` — what every read must carry on it (a Bearer on the bulk face, nothing on the anonymous one);
 *   · the two CEILINGS the client pages against (the port refuses above them and never truncates);
 *   · `budgetSharedWithShopper` — whether the budget this face publishes is the SAME one the store's own
 *     server-rendered pages spend. It is a FACT about the face, and what the app does with it (a reserve,
 *     a wording, nothing) stays the app's policy about its own document.
 *
 * ★ WHICH FACE, AND WHY IT DEGRADES RATHER THAN REFUSES. Bulk when this instance was given a bulk credential
 * (`FORGE_BULK_READ_TOKEN`), anonymous otherwise. An instance nobody configured must still serve its feed and
 * its sitemap; what it pays is the shopper's ceiling, and the app's refusals name the face by `label` so the
 * bill is legible instead of mysterious.
 *
 * ⚠️ IT IS A FUNCTION, like every injection here, and here the reason is sharper than usual: the token is
 * environment, and a value evaluated at module load would freeze whatever the process held when Next first
 * imported this file — an instance that gained a credential would keep walking the shopper's face until the
 * next deploy, silently.
 */
export const injectReadFace = (): {
  path: string;
  headers: Readonly<Record<string, string>>;
  productsPageMax: number;
  availabilityMaxSkus: number;
  budgetSharedWithShopper: boolean;
  label: string;
} => {
  const token = bulkReadToken();
  return token
    ? {
        path: '/v1/read/bulk',
        headers: { authorization: `Bearer ${token}` },
        productsPageMax: BULK_PRODUCTS_MAX_PAGE,
        availabilityMaxSkus: BULK_AVAILABILITY_MAX_SKUS,
        // Nobody else spends this bucket: it is per credential × tenant, and this credential is this
        // instance's own server-side reader.
        budgetSharedWithShopper: false,
        label: 'the bulk read face',
      }
    : {
        path: '/v1/read',
        headers: {},
        productsPageMax: PRODUCTS_MAX_PAGE,
        availabilityMaxSkus: AVAILABILITY_MAX_SKUS,
        // ⚠️ TRUE, AND IT IS THE WHOLE REASON THE BULK FACE EXISTS. This budget is one store+IP bucket shared
        // with every server-side read the storefront makes, so a document that drains it takes the store's
        // own pages down with it for the rest of the window.
        budgetSharedWithShopper: true,
        label: 'the anonymous read face',
      };
};
