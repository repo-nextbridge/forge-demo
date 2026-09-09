# `demo-setup` — the shop's own mark, from an app this box wrote

**What this box can do that it could not before:** put its own name and logo in each of the four places a
shop shows one, **separately**, from an app that lives in this repository and in no Forge release.

---

## The capability, in one paragraph

A Forge storefront draws a wordmark in four places: the header bar, the mobile drawer's head, the footer's
brand column and the login box of the account screens. Out of the box all four say `forge.`, and the footer
adds *"Leve. Inteligente. Sua."* under it. `demo-setup` declares **four blocks**, one per place, each placed
and configured on its own in Compose. Every one of them draws either a **logo** picked from the asset library
or a **wordmark** — a name plus a tail painted with the theme's accent — and the footer's block also carries
the shop's own **tagline**.

## Why it is an app, and why it is OURS

*A logo is content.* The Forge régua is explicit: whatever is specific to one shop is an app, a decision, its
own fields or its storefront — never the kernel. So the product ships the four **slots** with a bare default
and nothing else; the block that fills them belongs to whoever wants a mark. This box wanted one, so this box
wrote it. It is composed into this instance's images (`instanceApps` in `composition.json`), stamped not
offerable, and a fleet list that named it would be refused with rule `not-carried`.

★ **That is the demonstration, and it is deliberate.** The app is small on purpose: four blocks, one shared
render, no admin page, no scope, no table, no migration. A customer asking *"how do I extend Forge?"* is shown
this directory, and the answer is a package and a declaration.

## Four blocks and not one — what changed and why

Until pk26 the mark was the `brand` block of the platform's `chrome` app: **one placement read in four
renders**. An operator dragged one row in Compose and changed four places, with no way for the board to say
where. The owner named the defect — *"o compose não faz sentido, está configurando algo lá que nem sabe onde
vai aparecer"* — Forge gave each place its own slot, and the mark moved here.

⛔ **One component per place is the kernel's rule, not a preference.** `placement: 'single'` is enforced per
*(store, app, component)*: the same component dropped into a second slot is refused with `conflict`. So four
places require four components — which is what makes the Compose board literal again.

★ **And the liberty is the point.** A shop may now put a different mark in each of its four places. This box
does not (a rule holds its four spellings equal), but the ability is real and was accepted out loud:
*"tudo bem se tiver que configurar a logo em cada lugar, normal, e dá mais liberdade ainda."*

| block | slot | draws in |
|---|---|---|
| `header_brand` | `storefront:header.brand` | the shop's top bar |
| `drawer_brand` | `storefront:header.drawer_brand` | the mobile drawer's head |
| `footer_brand` | `storefront:footer.brand` | the footer's brand column (**+ the tagline**) |
| `account_brand` | `storefront:account.brand` | the login box of the account screens |

## The fields

| field | type | what it does |
|---|---|---|
| `logo` | `id` | an asset-library reference. The generated drawer renders the shared media picker and the kernel stamps `logo_url` beside it at read time — zero lines of admin code in this app. |
| `text` | `string` | the name. **With a logo it becomes the picture's alt** — a logo *is* the store's name to a screen reader. |
| `tail` | `string` | drawn in `var(--color-accent)`. This is what makes one config look like two shops. |
| `tagline` | `string` | **footer block only.** One line under the mark. |

⛔ **The picture and the words are EXCLUSIVE.** A block draws the image *or* the wordmark, never both — so a
logo dropped beside a wordmark deletes the wordmark. That is why the two shoe shops keep TEXT (a word re-tints
itself when the theme moves; a raster does not) and the café keeps its art.

⛔ **Nothing configured ⇒ nothing drawn.** These slots *replace* the front's own wordmark, so a block that
fell back to Forge's would print our mark inside somebody else's shop — the exact outcome the mechanism exists
to remove. An operator mid-configuration sees no mark for as long as they have written none, and the seed
refuses to place an empty one (`markless()` in `seed/demo-setup.mjs`).

## The tagline, and why it is a field rather than a second block

`footer.brand`'s Forge fallback cedes its node **as a unit** — the wordmark AND *"Leve. Inteligente. Sua."* —
deliberately, because the sentence is Forge's and leaving it standing under somebody else's logo would be the
same defect one element to the right. ⇒ **placing a mark in the footer deletes the sentence.** `tagline` is
how a shop says one of its own, and from pk26 on the demo's two shoe shops say that line **because they
configured it** — which is a better thing to show a customer than a shop that inherited it.

⛔ Only `forge` and `outlet` say it (the owner named those two). The café has a footer of its own; the counter
has no shop window at all and is declared `null`.

## Where the demo's own answers live

`seed/demo-setup.json` — the declaration: which store wears what, with the reason for each.
`seed/demo-setup.mjs` — the hand: install, upload the pictures, place and fill in. It shares
`seed/blocks.mjs` with `seed/chrome.mjs`, because the two declarations have the same shape and a second copy
of a placement engine is a second thing to drift.

A birth writes all of it: **the app is born installed, placed AND configured**, and a re-birth re-asserts the
declaration. An operator's own edit in Compose survives until the next birth — the same contract every other
declared thing in this box has.

## What `chrome` still is

The platform's `chrome` app keeps its four honest OOTB blocks — the checkout header and footer and the
account header and footer — one block per bar, each rendering in exactly the place its name says. Those bars
carry the shops' marks as **pictures**, and they always did; nothing about the funnel changed here.

## Graded by

- `apps/demo-setup/manifest.test.ts` — four blocks, four areas, no default hook, no scope, the tagline on one
  block only, and the wiring against the package's own exports.
- `apps/demo-setup/block/marks.test.tsx` — what the four actually draw, including the exclusivity, the trim,
  the store-scoped link and the tagline having exactly one home.
- `seed/demo-setup.test.mjs` — the declaration and the whole seed driven over a fake port: install, upload,
  place, and the filename becoming an asset id.
- `bin/chrome-logo-crop.guard.mjs` — every declared logo in **both** declarations, by proportion, off the
  PNG's own pixels.
