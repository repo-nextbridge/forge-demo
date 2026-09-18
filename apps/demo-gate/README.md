# @forge/ext-demo-gate

The public **demo's** gate app: a full-screen interstitial that covers every storefront route until the
visitor chooses a way in, plus the persistent ribbon that says the store is a demo while they browse.
PT/EN/ES embedded, on the one selector at the foot.

It has **ONE view**, and that is the v2 news. The screen is a DIAGRAM of this box: every shop it publishes
drawn as a card across the top, the cards bracketed under the tenant that owns them, each tenant's admin
drawn as a window beside its bracket, and dashed connectors carrying all of it down to one kernel chip at the
foot. The layout is `design-base/gate-v2.dc.html`, the headline is that layout's own sentence ("Dois tenants.
Quatro lojas. Dois admins. **Mesmo kernel!**"), and the notice that nothing here is real is the line at its
foot. Embedded copy — `config_schema` stays `[]`.

⛔ **The second view is gone, and it was not cut for space.** *"A arquitetura da demo"* was a screen of prose
— two tenants, two shops each, one admin under both, and the stack they stand on — reached by an affordance
at the foot of the first. It explained in words what the first screen was already showing, which is the exact
failure this redesign was asked to fix: people were arriving, reading a hub of cards, and not seeing the one
fact the demo exists to make obvious. A visitor who must switch views to learn what they are looking at has
been told the architecture is somewhere else. Now the diagram **is** the explanation, and there is nothing to
switch to — `block/gate.test.tsx` asserts that, so a second screen cannot quietly come back.

⛔ **No address is written in this app.** `seed/box.json` declares them and `bin/gate-faces.mjs`
renders that declaration into `faces.generated.ts`, which the screen imports; `bin/gate-faces.guard.mjs`
regenerates and compares, so the two cannot drift. A face whose `domain` is deleted keeps its card and
**says** it has no published address — it never disappears. The destination the visitor is already on is
the one that posts `dismiss` (the deep link survives); every other one is an ordinary link. On a host this
box does not declare, a line at the foot says so and carries the way in — that is the only place a "go in
anyway" door exists, because on a published face the cards on the diagram *are* the choice.

⚠️ **Those two sentences survive a redesign that has no place for them, deliberately.** The v2 artboard was
drawn for the DEPLOYED box, where every face has an address and the visitor is standing on one of them.
Neither is guaranteed — a bench is neither — so `hereNote`/`hereCta` and `noAddress` are still in `i18n.ts`
and still drawn, at the foot where the diagram is not. Dropping them with the artboard would have removed an
honesty the screen owes, not a decoration the design retired.

✅ **The COPY, on the other hand, is typed — and that is the decision.** Each card carries the sentences the
design writes for it: what the shop is ("Loja completa · 44 399 SKUs"), where it sits in the box ("Tenant 1 ·
Loja I") and what its front IS ("storefront vanilla"). `block/gate.test.tsx` holds every one of those
sentences against `design-base/gate-v2.dc.html`, word for word, so the screen and the artboard cannot drift.
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
