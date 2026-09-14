// DEMO-GATE — the gate's instance-level links, read from env (the platform is installed, not SaaS — the
// same class as the media base URL or the Google OIDC config).
//
// It lives HERE, in the app, and not in the storefront: these two URLs are the DEMO's wiring, and the
// reference storefront must not know that a demo exists (DEMO-OUT). The storefront copy that renders this
// gate calls this from its registry entry — a Server Component — so the values never reach the browser as
// config; they arrive as props already resolved.
//
//   `siteUrl`   the "← back" target of the splash (default: the canonical site).
//   `adminUrls` the admin origin PER TENANT whose `/enter` route redeems that tenant's operator access key
//               SERVER-SIDE ("Open the admin"). The key itself is the admin's env and never touches the
//               browser.
//
// ★★ WHY `adminUrls` IS A MAP AND NOT AN ORIGIN. The hub draws one admin row per tenant, and this box has
// two of them. A single `FORGE_GATE_ADMIN_URL` could only ever win for ONE face — it was handed to the first
// tenant's card and the other kept the DECLARED hostname, which on a bench and on a tailnet is an address
// nobody publishes. One value for a plural thing is the shape this box has now paid for three times (the
// bulk token, the six faces, this), so the promotion writes what it already knows: one origin per tenant id,
// keyed exactly like `seed/box.json` declares them.

/** The admin origins this box really publishes, by tenant id. Empty when the box declares none. */
export type GateAdminUrls = Readonly<Record<string, string>>;

/**
 * `FORGE_GATE_ADMIN_URLS` — `{"<tenant id>": "<absolute origin>"}`, written by `bin/box-up.sh` from the
 * doors the admin directory accepted. Anything that is not a JSON object of non-empty strings yields an
 * EMPTY map, never a half-parsed one: the hub then falls back to the address `seed/box.json` declares, which
 * is what a box with no override has always shown. A throw here would take the whole storefront down over a
 * variable a human typed.
 */
function parseAdminUrls(raw: string | undefined): GateAdminUrls {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const out: Record<string, string> = {};
  for (const [tenant, origin] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof origin === 'string' && origin.length > 0) out[tenant] = origin;
  }
  return out;
}

export function gateWiring(): { siteUrl: string; adminUrls: GateAdminUrls } {
  return {
    // `||` not `??`: the compose passes FORGE_GATE_SITE_URL as an EMPTY string when no secret is set (`${VAR:-}`),
    // and `??` would keep that "" → an <a href=""> that reloads the gate itself. `||` falls back to the canonical
    // site for both unset and empty.
    siteUrl: process.env.FORGE_GATE_SITE_URL || 'https://forgecommerce.pro',
    adminUrls: parseAdminUrls(process.env.FORGE_GATE_ADMIN_URLS),
  };
}
