// MS-M1α — the SERVER half of the explicit store context: the one function every public surface the
// middleware does not rewrite must use to answer "which store is this request about?".
//
// Read `lib/store-param.ts` first — it holds the mechanism and why the class exists. This file is the rule:
//
//     explicit `?store=`  →  falls back to  →  the request Host
//
// ── THE CLASS, AND HOW TO ENUMERATE IT (never by memory) ──────────────────────────────────────────────────
// It is exactly what `middleware.ts`'s `matcher` EXCLUDES: those requests never see the `/s/<store>` rewrite,
// so nothing but themselves can resolve their store. Today that is `/api/**`, `/feeds/**`, `/robots.txt` and
// `/sitemap.xml`. `store-context.guard.test.ts` walks those directories and fails on a route that resolves a
// store without going through here — a new sibling is born red rather than born leaking.
//
// ── THE TWO SURFACES THAT ARE HOST-ONLY BY CONSTRUCTION, AND WHY THAT IS THE RIGHT ANSWER ─────────────────
// `app/sitemap.ts`, `app/robots.ts` and `app/feeds/google.xml` are CRAWLER DOCUMENTS, and every URL they emit
// is ABSOLUTE on the origin that asked. Honouring `?store=` there would publish store B's product URLs under
// store A's hostname — where they resolve to store A. That is a worse leak than the one this pass closes, so
// they stay host-only and keep filtering their CONTENT by the store the Host resolves to.
//   ⚠️ It is also structurally impossible for two of them: Next builds `sitemap.ts`/`robots.ts` into a route
//   handler it invokes as `GET(_, ctx)` — the Request is DISCARDED (next-metadata-route-loader), so they can
//   read `headers()` and nothing else. A query parameter cannot reach them even if we wanted it to.
// Their multi-store defect is a different one and is fixed where it lives: the sitemap advertised categories
// the store does not fill (see `lib/sitemap-data.ts`).
//
// ── AND THE ONES THAT ARE NOT STORE-SCOPED AT ALL ─────────────────────────────────────────────────────────
// Session-scoped (`my-prices`, `account/*`), theme-scoped (`slots`), key-scoped (`media`, `img`) and the
// secret-guarded `revalidate` hook resolve no store and must not start: adding one would invent a dimension
// the answer does not have. They are listed BY NAME in the guard — an exception to an isolation rule is
// written down, never inferred (the same doctrine as the kernel's `GLOBAL_READS`).

import { resolveStoreForHost } from '@forgecommerce/storefront-kit/config';
import { STORE_PARAM } from '@/lib/store-param';

/**
 * The store this request is about: the caller's explicit `?store=` when it named one, the request Host
 * otherwise. Undefined → no store claims this request, and the caller serves its own empty/404 answer.
 *
 * ★ THE ORDER IS THE WHOLE POINT. The Host is a FALLBACK, not the authority: on a deployment serving many
 * stores it answers for whichever one owns the hostname, which is precisely the wrong store for a fragment
 * fetched from inside `/s/<other>/`.
 */
export async function resolveRequestStore(req: Request): Promise<string | undefined> {
  const explicit = new URL(req.url).searchParams.get(STORE_PARAM)?.trim();
  if (explicit) return explicit;
  return resolveStoreForHost(req.headers.get('host'));
}
