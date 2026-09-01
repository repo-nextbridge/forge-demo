// The storefront theme's SITE-WIDE responsive boundaries (S7-SF-CLOSE §10.9 / HANDOVER §9). CSS custom
// properties do NOT work inside `@media` queries, so the boundaries can't be a single token — they live here
// as JS constants (consumed by the matchMedia islands) PLUS a convention that CSS modules express the SAME two
// boundaries as the canonical px literals below, enforced by the `structure.test.ts` breakpoint guard (an
// arbitrary new breakpoint fails it). Component-local reflows (a form stacking at 560px, an account grid at
// 720px) are NOT these site boundaries — they stay local and are listed in the guard's allow-list, annotated.

/** The mobile boundary: at/under this the layout is "mobile" (drawers, stacked, 4-col tiles). Prototype §10.9. */
export const MOBILE_MAX = 768;

/** The exclusive twin of MOBILE_MAX for a clean split (mobile `max-width: 767.98px` ↔ desktop `min-width: 768px`,
 * no 1px overlap) — used where a component must be EITHER mobile OR desktop, never both (e.g. the filter drawer). */
export const MOBILE_MAX_EXCLUSIVE = 767.98;

/** The checkout two-column boundary: at/over this the 50/50 split appears (checkout is the one 900px surface). */
export const CHECKOUT_MIN = 900;

/** The matchMedia query for "desktop" (≥ the mobile boundary) — the JS side of the boundary (CSS uses the px
 * literal). The order-detail map is desktop-only and reads this. */
export const DESKTOP_MEDIA_QUERY = `(min-width: ${MOBILE_MAX}px)`;
