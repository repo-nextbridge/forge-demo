# @forge/ext-demo-gate

The public **demo's** gate app: a full-screen interstitial ("Demo store" — nothing here is real) that
covers every storefront route until the visitor chooses a way in, plus the persistent ribbon that says it
again while they browse. PT/EN/ES embedded.

## This app is one instance's, not the platform's

It fills the neutral platform slot `storefront:gate`, and it is the demo's own implementation of that
slot. **It is not published** (`private: true`) and it is **not a dependency of the reference
storefront** — DEMO-OUT. The reference storefront ships the slot and its machinery (the dismissal cookie,
the `dismiss`/`reopen` Server Actions, the full-screen interstitial that preserves the deep link) with an
**empty** gate registry, because who gates a store is that store's decision.

**Why the package is `@forge/…` and not `@forgecommerce/…`.** Two different names live here and only one
of them moved. The extension **id** (`demo-gate`) and the **slot** (`storefront:gate`) are runtime
identity — manifest, `read.extensions`, Compose, the row in the database of whoever installed it — and
they are frozen. The npm **scope** is the distribution label, and N1 governs it: `@forgecommerce/*` is
what crosses the border into a customer's repo, `@forge/*` stays inside. Since this app is no longer
published, the old scope was a name promising an install nobody could perform. It was not renamed; it was
relabelled to tell the truth about where it can be installed FROM. When DEMO-OUT step 2 moves it into the
demo's own repo it stops being ours entirely, and it gets called whatever the demo wants — which is what
happens to any customer's own app.

If you want a gate on your storefront, this app is the worked example, not the answer: write your own app,
fill the same slot, and register it in your own copy of the storefront exactly as below.

## Mounting it in a storefront

Two halves, both required — the kernel says the app is *installed*, the front says the build can *render*
it:

1. **Install the app for the tenant.** Its manifest declares the hook targeting `storefront:gate`, so
   installing it is what makes the store ask for a gate at all.

   > ⚠️ **In THIS repository that is no longer a hand gesture, and the correction is the whole news.** Until
   > 2026-09-11 this line was the only place the install was described, so it was a step somebody had to
   > remember — and nobody did: the demo served its shops with the front door open for days while every birth
   > reported green. The birth installs it now (`seed/vitrine.json` → `apps` for the shoe brand,
   > `seed/coffee.mjs` → `APPS` for the coffee shop), `bin/gate-at-birth.guard.mjs` keeps that true in the test
   > loop, and step 14-bis opens every door of every store on **both sides of the dismissal cookie** — the gate
   > without it, the shop with it — so a box where this screen is missing is red at birth, naming the store.
   >
   > ⚠️ **An install is TENANT-wide** and the kernel places the block on **every store of the tenant**, which
   > is why one of the four is deliberately taken back out: `seed/coffee.mjs::dropGateOnTheCafe` removes the
   > placement from `cafe`, whose forked vitrine carries no gate registry and would therefore refuse the page
   > rather than draw it. That store declares `gate: false` in `seed/box.json`, with the reason.
2. **One import + one entry** in that storefront's `src/lib/extensions/gate-registry.tsx`:

```tsx
import { GateBlock } from '@forge/ext-demo-gate/block/gate';
import { GateRibbon } from '@forge/ext-demo-gate/block/ribbon';
import { GATE_LANG_COOKIE, resolveLang } from '@forge/ext-demo-gate/i18n';
import { gateWiring } from '@forge/ext-demo-gate/wiring';
import { cookies, headers } from 'next/headers';

/** The visitor's picked language PERSISTS via the gate's own cookie (the splash's footer selector writes
 *  it); it wins over the Accept-Language guess, so the splash, the ribbon and a re-opened splash agree. */
async function initialLang() {
  const picked = (await cookies()).get(GATE_LANG_COOKIE)?.value;
  const accept = (await headers()).get('accept-language') ?? '';
  return resolveLang(picked ?? accept.split(',')[0]);
}

const GATE_REGISTRY: Record<string, GateImplementation> = {
  'demo-gate': {
    Interstitial: async ({ dismiss }) => {
      const { siteUrl, adminUrl } = gateWiring();
      return (
        <GateBlock
          siteUrl={siteUrl}
          adminUrl={adminUrl}
          initialLang={await initialLang()}
          dismiss={dismiss}
        />
      );
    },
    Ribbon: async ({ reopen }) => <GateRibbon lang={await initialLang()} reopen={reopen} />,
  },
};
```

Note where the per-instance knowledge lives: **inside the entry**, never in the layout. Reading the env
(`FORGE_GATE_SITE_URL`, `FORGE_GATE_ADMIN_URL` — see `wiring.ts`) and the language cookie is this gate's
business, and the layout that renders it must not learn any of it.

3. **One line in `next.config`.** This package ships its components as **source** (`.tsx` + CSS Modules),
   so your bundler compiles them along with your own code — that is what keeps the styles, the tokens and
   the tree-shaking working. Next skips `node_modules` unless you say otherwise:

```js
// next.config.mjs
export default {
  transpilePackages: ['@forge/ext-demo-gate'],
};
```

Without it the build fails loudly (`Module parse failed: Unexpected token`) — it never degrades into an
unstyled page.

The blocks style themselves in semantic design tokens, never literal colours, so install
`@forgecommerce/theme-storefront-vanilla` (or provide the same token names from your own theme) and import
its `tokens.css` once in your root layout.

## Licence

Apache-2.0. The Forge kernel itself is BUSL-1.1; the app's own code is permissive on purpose.
