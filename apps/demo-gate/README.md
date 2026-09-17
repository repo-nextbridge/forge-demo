# @forge/ext-demo-gate

The public **demo's** gate app: a full-screen interstitial that covers every storefront route until the
visitor chooses a way in, plus the persistent ribbon that says the store is a demo while they browse.
PT/EN/ES embedded, on the one selector at the foot.

It has **two views**, one at a time. The first **is** a HUB over every face this box publishes — one tenant
card per brand, its shops inside it, one admin row at the card's foot — and nothing sits above it: the screen
is the layout in `design-base/gate.dc.html`, whose headline is that layout's own sentence ("Dois tenants.
Quatro lojas. Dois admins. Mesmo kernel!") and whose only frame is the tenant card's own; the notice that
nothing here is real is the line at its foot. The second — *"A arquitetura da demo"*, opened by the
affordance at the foot of the first and closed by the one at its own — says **why** that is hard for a
visitor who has never heard the word multi-tenant: the two tenants with their two shops each, one admin under
both, and the stack they stand on (API · CLI · MCP · SDK · Docs → the single command port → the kernel →
PostgreSQL/Redis → infra). Both are embedded copy — `config_schema` stays `[]`.

⛔ **No address is written in this app.** `seed/box.json` declares them and `bin/gate-faces.mjs`
renders that declaration into `faces.generated.ts`, which the screen imports; `bin/gate-faces.guard.mjs`
regenerates and compares, so the two cannot drift. A face whose `domain` is deleted keeps its card and
**says** it has no published address — it never disappears. The destination the visitor is already on is
the one that posts `dismiss` (the deep link survives); every other one is an ordinary link. On a host this
box does not declare, a line at the foot says so and carries the way in — that is the only place a "go in
anyway" door exists, because on a published face the six cards *are* the choice.

✅ **The NUMBERS, on the other hand, are typed — and that is the decision.** Each shop's sentence carries
its size ("2 777 produtos → 44 399 SKUs") exactly as the design writes it, and `block/hub.test.tsx` holds
every one of those sentences against `design-base/gate.dc.html` so the screen and the artboard cannot drift.
"Derive, never list" protects what a **customer** is handed; this screen is the public demo's own front
door, not an app a customer installs or configures, and anyone who wants a different one **forks this app**.
The screen asks the port for nothing: the only value it resolves at run time is the admin origin this box
was promoted to (`FORGE_GATE_ADMIN_URLS`, `wiring.ts`), which no design can know.

## This app is one instance's, not the platform's

It fills the neutral platform slot `storefront:gate`, and it is the demo's own implementation of that
slot. **It is not published** (`private: true`) and it is **not a dependency of the reference
storefront** — DEMO-OUT. The reference storefront ships the slot and its machinery (the dismissal cookie,
the `dismiss`/`reopen` Server Actions, the full-screen interstitial that preserves the deep link) with an
**empty** gate registry, because who gates a store is that store's decision.

**Why the package is `@forge/…` and not `@forgeco/…`.** Two different names live here and only one
of them moved. The extension **id** (`demo-gate`) and the **slot** (`storefront:gate`) are runtime
identity — manifest, `read.extensions`, Compose, the row in the database of whoever installed it — and
they are frozen. The npm **scope** is the distribution label, and N1 governs it: `@forgeco/*` is
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
   > ⚠️ **An install is TENANT-wide** and the kernel places the block on **every store of the tenant** — and
   > since pk36/d1 all four keep it. Until then `cafe` was taken back out by `seed/coffee.mjs`, because the
   > forked vitrine carried no gate registry and a structural slot it cannot draw REFUSES the page; that
   > removal, and the `gate: false` in `seed/box.json` that declared it, are both gone. What ended them is
   > pk35/d2: the fork regenerates its own surfaces, so
   > `storefront-coffee/src/lib/extensions/generated/gate-registry.tsx` resolves this app like any other front.
   > ⚠️ **The `gate: false` key itself did NOT go away** — it is how any store of any box declares it has no
   > front door, and `bin/prove-doors.mjs` still grades all four of its behaviours. With no real store
   > declaring it, `bin/prove-doors.test.mjs` keeps them graded against a fixture box of its own.
2. **One import + one entry** in that storefront's `src/lib/extensions/gate-registry.tsx` — and the two
   names come from **this app's own declaration**, never from a reader's memory:
   `package.json` → `forge.wiring.gate` names the module (`./block/entry`) and the two exports
   (`GateInterstitial`, `GateRibbonEntry`). That is the same declaration the fleet oven reads when it
   composes this app into an image, which is why a hand-written registry has to mirror it rather than
   invent one (`totem/src/lib/gate/registry.test.ts` is what keeps the counter's copy mirrored).

```tsx
import { GateInterstitial, GateRibbonEntry } from '@forge/ext-demo-gate/block/entry';

const GATE_REGISTRY: Record<string, GateImplementation> = {
  'demo-gate': {
    Interstitial: GateInterstitial,
    Ribbon: GateRibbonEntry,
  },
};
```

Note where the per-instance knowledge lives: **inside the entry**, never in the layout. The two entries are
Server Components, and reading the env (`FORGE_GATE_SITE_URL`, `FORGE_GATE_ADMIN_URLS` — see `wiring.ts`),
the request's own host and the language cookie is this gate's business. The layout that renders it hands
over exactly `store` plus one Server Action and must not learn any of the rest.

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
`@forgeco/theme-storefront-vanilla` (or provide the same token names from your own theme) and import
its `tokens.css` once in your root layout.

## Licence

Apache-2.0. The Forge kernel itself is BUSL-1.1; the app's own code is permissive on purpose.
