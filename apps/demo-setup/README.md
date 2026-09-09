# `@forge/ext-demo-setup` — the demo's own marks

An app of **one instance**. It is composed into this box's images and offered to nobody: `forge.origin:
"instance"` is what the oven reads to adopt it (`bin/build-local.sh`), `instanceApps` in the repository's
`composition.json` is where it is asked for, and a Forge fleet list that named it would be refused with rule
`not-carried`.

It exists twice over: this box wants its four shops to wear their own names, **and** it is the shortest true
answer to *"how does a customer extend Forge?"* — four blocks, one shared render, no admin page, no scope, no
table, no migration.

## What it declares

| component | slot | area | draws |
|---|---|---|---|
| `header_brand` | `storefront:header.brand` | `header` | the shop's top bar |
| `drawer_brand` | `storefront:header.drawer_brand` | `header` | the mobile drawer's head |
| `footer_brand` | `storefront:footer.brand` | `footer` | the footer's brand column, **plus a tagline** |
| `account_brand` | `storefront:account.brand` | `account` | the login box |

Config: `logo` (`type: 'id'` — the generated drawer renders the shared asset picker and the kernel stamps
`logo_url` beside it), `text`, `tail`, and `tagline` on the footer block only.

Props injected by the surface: `config` and **`storeHref`**. ⚠️ `storeHref` is not optional — without it the
mark's anchor is a bare `/`, which walks a shopper out of the store they are in under `/s/<id>`.

## Four components, one drawing

`block/marks.tsx` holds one implementation (`Mark`) and four exports. Sharing the render is why *"one logo
becoming another"* is a config change and not four maintenance jobs; declaring four is what lets a store put
its mark in four places **at all** — `placement: 'single'` is enforced by the kernel per *(store, app,
component)*, so one component in a second slot is refused with `conflict`.

The four differ only where the place differs, which today is one thing: the footer's column is the one that
also carries a sentence.

## The rules that are easy to break in silence

- **The picture and the words are exclusive.** `logo ? <img> : (text + tail)`. A logo dropped beside a
  wordmark deletes the wordmark.
- **Nothing configured ⇒ nothing drawn.** These four slots *replace* the front's own wordmark, so a fallback
  here would print the Forge mark inside somebody else's shop.
- **A ref with no url draws nothing**, never a broken image: an asset that has gone away is the one case
  where the config is complete and the picture is not.
- **Every word is trimmed and the two halves are glued.** A separator written as a leading space (`" Outlet"`)
  is deleted before it is drawn and the header reads `ForgeOutlet`. Use a printable character — a point.
- **The tagline is never drawn without a mark above it.** A sentence standing where a shop's name should be is
  the same defect one element to the right, which is the kit's own reason for ceding the node as a unit.

## No admin page, and why

There is no path from a page to the vitrine's mark: the only access is the slot, and the shops that wear this
run the **vanilla** storefront image, unforked. A page would either mirror what the seed already writes or
invite a visitor to edit what the weekly reset erases. Page administers, block renders. `demo-gate`, this
box's other UI app, has never needed one either.

## Running its suite

`bash bin/test.sh` at the repository root does it — `bin/instance-app.guard.mjs` links this app's declared
dependencies out of the pinned Forge checkout (the manifest speaks `catalog:` and `workspace:*`, protocols
only pnpm understands inside a workspace this app is not in), then runs `tsc --noEmit` and `vitest run` here.
A machine with no Forge checkout is told **NOT CHECKED**, never quietly passed.

## The data this box feeds it

`seed/demo-setup.json` — which store wears what, with the reason for each — driven by `seed/demo-setup.mjs`,
which shares its placement engine with `seed/chrome.mjs` (`seed/blocks.mjs`). The capability page is
`docs/capabilities/demo-setup.md`.
