// ⛔⛔ A WELD, NOT A DESIGN — AND IT EXISTS BECAUSE THE KIT SHIPS THIS FILE AND DOES NOT PUBLISH IT.
//
// ── WHAT WAS MEASURED, 2026-09-10, ON THE VENDORED TARBALL OF THE PINNED RELEASE ──────────────────────────
//
//     import { isCeilingRefusalDigest } from '@forgecommerce/storefront-kit/ceiling-digest';
//       → Error: "./ceiling-digest" is not exported under the conditions ["node","development","import"]
//         from package …/node_modules/@forgecommerce/storefront-kit
//
// The module is IN the tarball — `node_modules/@forgecommerce/storefront-kit/src/ceiling-digest.ts` exists,
// because `files` lists it. What is missing is the door: the kit narrows what a consumer may import through
// `publishConfig.exports`, and that map has 91 entries where `exports` has 92. The one it lacks is this one.
//
//     packages/storefront-kit/package.json:236   "publishConfig": { "exports": { … } }   ← `./ceiling-digest` absent
//     packages/storefront-kit/package.json       "exports": { "./ceiling-digest": "./src/ceiling-digest.ts" }  ← present
//
// ⇒ inside the Forge monorepo the import resolves (pnpm links workspace packages as directories and the full
// `exports` map applies); from a tarball it cannot. That is the exact asymmetry the product's own
// `wiring-surface.guard.test.ts` was written about — "green here, broken in the copy the client owns" — and its
// jurisdiction is EXTENSION APPS contributing to a packed surface, not the kit itself, so nothing saw this one.
// ⚠️ AND IT IS NOT ONLY OUR PROBLEM: the reference `apps/storefront/src/app/error.tsx` imports that same
// subpath, so a fork cut by `pnpm pack:surface` TODAY carries three boundaries that cannot resolve it either.
// Here the consumer is `lib/port.ts` as well as the boundary: `PortRateLimited` BUILDS a digest, because
// `totemFetch` intercepts a 429 before the kit can label it.
//
// ⛔ THE FIX IS IN THE PRODUCT REPOSITORY AND IS ONE LINE, SO IT IS NOT MADE HERE. A slice names one repo; this
// is the demo's. Reported to the tech lead with the file and the line above.
//
// ⚠️ AND THIS IS THE SECOND COPY IN THIS REPOSITORY — `storefront-coffee/src/lib/ceiling-digest.ts` is the other,
// byte for byte. They are not shared because the two forks are two npm projects with no code path between them
// (that is what being a fork means), and the kit is exactly where a shared rule is supposed to live. ⇒ TWO copies
// is the measure of the defect, not a style choice: the day the kit publishes the subpath, both go.
//
// ── WHY A COPY IS LESS BAD THAN THE ALTERNATIVES, AND WHAT KEEPS IT HONEST ─────────────────────────────────
//
//   · importing `@forgecommerce/storefront-kit/read-client` instead would work (it IS published, and it imports
//     this module) — but it re-exports nothing of it, and the kit's own header forbids the shape anyway: a
//     CLIENT boundary has no business bundling the whole port client to read four characters of a digest.
//   · deep-importing the file inside node_modules by relative path compiles and is a lie about what a package
//     boundary means.
//   · so: a copy, and `ceiling-digest.guard.test.ts` beside it drives BOTH implementations — this one and the
//     one in the vendored tarball, imported off disk — over the same matrix and demands identical answers. The
//     duplicate is therefore PROVEN equivalent on every run, not hoped to be. That guard also reddens the day
//     the kit starts publishing the subpath, which is the day this file is deleted.

/** The well-known digest that says "this throw was a CEILING refusal, not a broken shop". */
export const CEILING_REFUSAL_DIGEST = 'forge.read.ceiling';

/** `forge.read.ceiling;<seconds>` when the port said when to come back, `forge.read.ceiling;-` when it did not. */
export function ceilingRefusalDigest(retryAfter: string | null): string {
  const seconds = parseRetryAfterSeconds(retryAfter);
  return `${CEILING_REFUSAL_DIGEST};${seconds === null ? '-' : seconds}`;
}

/** Was this the ceiling saying "not now"? Reads the digest, which is all a boundary gets. */
export function isCeilingRefusalDigest(digest: string | undefined): boolean {
  return (
    digest === CEILING_REFUSAL_DIGEST || digest?.startsWith(`${CEILING_REFUSAL_DIGEST};`) === true
  );
}

/**
 * How long the port asked the caller to wait, in whole seconds — null when it did not say, or when the digest
 * is not a ceiling refusal.
 *
 * ⚠️ NULL AND ZERO ARE DIFFERENT ANSWERS and a page must not collapse them: "come back in a moment" is what
 * the shop can honestly say when the port named no delay, while a number is a promise it can keep.
 */
export function ceilingRefusalWaitSeconds(digest: string | undefined): number | null {
  if (!isCeilingRefusalDigest(digest)) return null;
  return parseRetryAfterSeconds(digest?.slice(CEILING_REFUSAL_DIGEST.length + 1) ?? null);
}

/** `Retry-After` is delta-seconds or an HTTP date (RFC 9110 §10.2.3); only the delta form is meaningful to a
 *  page that wants to print "in N seconds", and an unparsable value is no answer rather than a zero. */
function parseRetryAfterSeconds(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.ceil(n);
}

/** The wait, in the customer's language. It never fabricates: `null` becomes a vague sentence, never a count. */
export function ceilingWaitSentence(seconds: number | null): string {
  if (seconds === null) return 'Tente de novo em alguns instantes.';
  return `Tente de novo em cerca de ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}.`;
}
