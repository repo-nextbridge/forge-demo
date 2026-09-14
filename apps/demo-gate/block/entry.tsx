// ★★ THE GATE'S REGISTRY ENTRIES — the pair the COMPOSED gate registry renders, and the place this app's own
// wiring is read.
//
// WHY THESE EXIST AT ALL. The `storefront:gate` slot hands an implementation exactly `store` plus one Server
// Action, and that is the whole contract: the layout that mounts a gate must never learn the name of one.
// Everything else a particular gate needs — this demo's marketing-site link, the admin origin it hands off to,
// the visitor's language — is this app's business and is read HERE, inside the app, on the server.
//
// That is not a limitation of the generated registry; it is the inversion the slot was designed around, and it
// is the same one a composed BLOCK already lives under (an app declares WHAT it wants and never where the
// front keeps it). Before P1 this wiring lived in a hand-written entry inside the storefront's own source,
// which is exactly why a gate used to require forking the front.
//
// Server Components on purpose: `gateWiring()` reads environment variables that must never reach the browser,
// and the language guess comes from a cookie. The two components below are the boundary — everything under
// them (`GateBlock`, `GateRibbon`) is a client component, and gets its values as props already resolved.

import { cookies, headers } from 'next/headers';
import { GATE_LANG_COOKIE, type Lang, resolveLang } from '../i18n';
import { gateWiring } from '../wiring';
import { GateBlock } from './gate';
import { GateRibbon } from './ribbon';

/**
 * The visitor's language, best effort, on the server: the cookie this gate itself sets, then the browser's
 * `Accept-Language`. `?lang=` on the URL still wins, but that is read on the client (see `GateBlock`) because
 * a query string must not make this route uncacheable for everybody else.
 */
async function initialLang(): Promise<Lang> {
  const jar = await cookies();
  const chosen = jar.get(GATE_LANG_COOKIE)?.value;
  if (chosen) return resolveLang(chosen);
  const accept = (await headers()).get('accept-language');
  return resolveLang(accept?.split(',')[0]?.split('-')[0]);
}

/**
 * ★ WHICH HOST THE BROWSER ASKED FOR, as the server saw it — the hub's "you are here".
 *
 * ⚠️ `x-forwarded-host` FIRST, AND THAT ORDER IS A MEASUREMENT, NOT A PREFERENCE. Behind the edge, `host` is
 * whatever reached this container; after a Server Action's `redirect()` it has been observed to be the
 * SERVER'S OWN address rather than the browser's (pack 03/09, p6-1: «todo formulário cai no Dashboard» was
 * exactly this), and the true one is in `x-forwarded-host`. Undefined when neither is there — the hub then
 * matches no face and shows its own door, which is the honest answer rather than a guessed one.
 */
async function requestHost(): Promise<string | undefined> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-host')?.split(',')[0]?.trim();
  return forwarded || h.get('host') || undefined;
}

/** The full-screen interstitial. `store` is deliberately unused: this gate is the demo's, and the demo is one
 * store's worth of stores — the copy says "Forge Demo", not the name of whichever store was asked for. */
export async function GateInterstitial({ dismiss }: { store: string; dismiss: () => Promise<void> }) {
  const { siteUrl, adminUrl } = gateWiring();
  return (
    <GateBlock
      siteUrl={siteUrl}
      adminUrl={adminUrl}
      here={await requestHost()}
      initialLang={await initialLang()}
      dismiss={dismiss}
    />
  );
}

/** The persistent bar shown once the visitor is through. */
export async function GateRibbonEntry({ reopen }: { store: string; reopen: () => Promise<void> }) {
  return <GateRibbon lang={await initialLang()} reopen={reopen} />;
}
