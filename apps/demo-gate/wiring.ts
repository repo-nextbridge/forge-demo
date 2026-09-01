// DEMO-GATE — the gate's instance-level links, read from env (the platform is installed, not SaaS — the
// same class as the media base URL or the Google OIDC config).
//
// It lives HERE, in the app, and not in the storefront: these two URLs are the DEMO's wiring, and the
// reference storefront must not know that a demo exists (DEMO-OUT). The storefront copy that renders this
// gate calls this from its registry entry — a Server Component — so the values never reach the browser as
// config; they arrive as props already resolved.
//
//   `siteUrl`  the "← back" target of the splash (default: the canonical site).
//   `adminUrl` the admin origin whose `/enter` route redeems the operator access key SERVER-SIDE
//              ("Open the admin"). The key itself is the admin's env and never touches the browser.

export function gateWiring(): { siteUrl: string; adminUrl: string | undefined } {
  return {
    // `||` not `??`: the compose passes FORGE_GATE_SITE_URL as an EMPTY string when no secret is set (`${VAR:-}`),
    // and `??` would keep that "" → an <a href=""> that reloads the gate itself. `||` falls back to the canonical
    // site for both unset and empty.
    siteUrl: process.env.FORGE_GATE_SITE_URL || 'https://forgecommerce.pro',
    adminUrl: process.env.FORGE_GATE_ADMIN_URL || undefined,
  };
}
