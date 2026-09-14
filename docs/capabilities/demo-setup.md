# `demo-setup` — the shop's own mark, from an app this box wrote

**What this box can do that it could not before:** put its own name and logo in each of the three places its
**shop window** shows one, **separately**, from an app that lives in this repository and in no Forge release.

---

## The capability, in one paragraph

A Forge storefront draws a wordmark in four places: the header bar, the mobile drawer's head, the footer's
brand column and the login box of the account screens. Out of the box all four say `forge.`, and the footer
adds *"Leve. Inteligente. Sua."* under it. `demo-setup` declares **three blocks** — the three the **vitrine**
draws — each placed and configured on its own in Compose. Every one of them draws either a **logo** picked
from the asset library or a **wordmark** — a name plus a tail painted with the theme's accent — and the
footer's block also carries the shop's own **tagline**.

⛔ **The fourth place is not this app's, and the line is the DEPLOYABLE.** The login box belongs to the
**checkout**, which Forge hosts and nobody forks; the vitrine is the one a customer forks and makes theirs.
Identity in something you fork may live in an app of your own — that is this app. Identity in something you
cannot fork has to be configurable **without** a fork, which makes it a capability of the **product**: from
pk28 the OOTB `chrome` app carries the login box's mark. The owner said it in one line, 09/09: *"no chrome
OOTB fica para pôr logo na caixa de login. E o config da demo fica só as outras 3 … pois essas 3 são do
storefront e a caixa de login é do checkout."*

## Why it is an app, and why it is OURS

*A logo is content.* The Forge régua is explicit: whatever is specific to one shop is an app, a decision, its
own fields or its storefront — never the kernel. So the product ships the four **slots** with a bare default
and nothing else; the block that fills them belongs to whoever wants a mark. This box wanted one, so this box
wrote it. It is composed into this instance's images (`instanceApps` in `composition.json`), stamped not
offerable, and a fleet list that named it would be refused with rule `not-carried`.

★ **That is the demonstration, and it is deliberate.** The app is small on purpose: three blocks, one shared
render, no admin page, no scope, no table, no migration. A customer asking *"how do I extend Forge?"* is shown
this directory, and the answer is a package and a declaration.

## A block per place and not one for all — what changed and why

Until pk26 the mark was the `brand` block of the platform's `chrome` app: **one placement read in four
renders**. An operator dragged one row in Compose and changed four places, with no way for the board to say
where. The owner named the defect — *"o compose não faz sentido, está configurando algo lá que nem sabe onde
vai aparecer"* — Forge gave each place its own slot, and the mark moved here.

⛔ **One component per place is the kernel's rule, not a preference.** `placement: 'single'` is enforced per
*(store, app, component)*: the same component dropped into a second slot is refused with `conflict`. So four
places require four components — which is what makes the Compose board literal again.

★ **And the liberty is the point.** A shop may now put a different mark in each of its places. This box does
not (a rule holds its spellings equal), but the ability is real and was accepted out loud:
*"tudo bem se tiver que configurar a logo em cada lugar, normal, e dá mais liberdade ainda."*

| block | slot | draws in |
|---|---|---|
| `header_brand` | `storefront:header.brand` | the shop's top bar |
| `drawer_brand` | `storefront:header.drawer_brand` | the mobile drawer's head |
| `footer_brand` | `storefront:footer.brand` | the footer's brand column (**+ the tagline**) |

⚠️ `storefront:account.brand` — the login box — is the **fourth slot and not a fourth block here**. The slot
did not move and still cedes its whole node; what changed in pk28 is who fills it.

## The fields

| field | type | what it does |
|---|---|---|
| `logo` | `id` | an asset-library reference. The generated drawer renders the shared media picker and the kernel stamps **three** sidecars beside it at read time — `logo_url` (the master's address), `logo_kind` and `logo_provider_key` (the opaque catalog key) — zero lines of admin code in this app. The block draws the **key**, through the front's own `/api/media/<key>` door: a same-origin path, a 1-year immutable cache, and an address the warmer can reach. The master has none of the three. See *The media door*, below. |
| `text` | `string` | the name. **With a logo it becomes the picture's alt** — a logo *is* the store's name to a screen reader. |
| `tail` | `string` | drawn in `var(--color-accent)`. This is what makes one config look like two shops. |
| `tagline` | `string` | **footer block only.** One line under the mark. |

⛔ **The picture and the words are EXCLUSIVE.** A block draws the image *or* the wordmark, never both — so a
logo dropped beside a wordmark deletes the wordmark. That is why the two shoe shops keep TEXT — a word
re-tints itself when the theme moves and a raster does not. **No store of this box declares a picture here
since pk35/d7**: the café was the one that did, and its placements were removed (below).

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

The platform's `chrome` app keeps its honest OOTB blocks — the checkout header and footer and the account
header and footer — one block per bar, each rendering in exactly the place its name says. Those bars carry
the shops' marks as **pictures**, and they always did; nothing about the funnel changed here. From pk28 it
also carries the **login box's** mark, for the reason above.

⚠️ **This box does not place that one yet, and the order matters.** `seed/chrome.json` may only declare a
block the app in the **pinned image** actually ships — `composition.place` validates the component against
the installed manifest and refuses an unknown one, which would fail the birth rather than skip a mark. So
adding `account_brand` to `seed/chrome.json` waits for a kernel image baked from the product slice that
declares it.

⚠️ **And the row this app already wrote does not disappear on its own.** `hook_placement` has no FK to any
component registry and nothing prunes a placement whose component the manifest stopped declaring: uninstall
keeps placements, the manifest reconciliation is purely additive, and this box's seed only places and
updates. On a box **re-seeded rather than reborn**, the café's old `demo-setup/account_brand` row survives,
still counts as a *fill* in the slot — and because fills are counted before the component is resolved, the
slot then draws **nothing at all**, not even the `forge.` fallback. The only hand that removes it is
`composition.remove`. A birth from zero never writes it in the first place, which is what this box gets.

⚠️ **And the same is now true of the café's three rows.** `"cafe": null` stops the seed from *writing* them;
it does not *delete* rows a previous birth already wrote. On a box **re-seeded rather than reborn** the café
keeps three `demo-setup` placements that draw nothing (they drew nothing before either — see below), and only
`composition.remove` takes them out. The benches are reborn from zero at the end of a wave, which is the
state this box is meant to be read in.

## The media door — the block draws the KEY, never the master url

The kernel stamps `<field>_provider_key` beside `<field>_url` for exactly one reason, written in its own
source: *"so a consumer can route the MASTER through its own `/api/media/<key>` door … instead of pointing an
`<img>` at the raw bucket url"*. A block that reads the url and ignores the key walks past a door the kernel
opened for it, and nothing goes red.

⚠️ **It is a species, not a case.** The same cause has been repaired four times, one block at a time —
`banners` (D2-F3), the theme's own images (K3-M2), the shelf banner (pk34/p5) and the whole `chrome` app
(pk35/p2) — with nothing red in between. Measured on this bench 2026-09-13: the master answers **with no
`Cache-Control` at all**, the same object through the door answers `public, max-age=31536000, immutable`, and
`/v1/media/` is on no door the warmer knows — so such an image is cold for the first shopper of every page,
forever. An absolute url is also a mixed-content hazard: a path has no origin to be wrong about.

⇒ `bin/config-media-door.guard.mjs` derives the family from the **manifests** of every app of this box — every
`type:'id'` field of every block, the same walk the kernel makes when it stamps — and goes red when a new
block is born reading the url alone. **⛔ Never a list of blocks written by hand:** a typed list is exactly
what rotted through four repairs.

## ⛔ THE CAFÉ WEARS NONE OF THESE — the instance removed them (pk35/d7)

`seed/demo-setup.json` says `"cafe": null`. The rule is the owner's, 11/09: *"o fork é do cliente, 100%
liberdade"* ⇒ **when a fork draws by itself what a declared block would draw, the instance removes that
store's placement.** The same pattern `seed/coffee.mjs::dropGateOnTheCafe` already uses for the gate.

⚠️ **And the sentence that used to justify dressing it had become false.** It said the café's three
placements *"render on the screens the café's buyers reach through us"*. Measured against the pinned release,
2026-09-14:

- the café's vitrine is the **fork**. `header.brand`, `header.drawer_brand` and `footer.brand` appear **nowhere**
  in `storefront-coffee/src` (0 hits); a live fetch of the café home renders `CoffeeChrome_*` and **zero**
  `demo-setup-*` marks;
- the **account screens** mount `StorefrontChrome` and then **replace both of its regions**: the checkout's
  layout wraps header and footer in `account.header` / `account.footer` outlets and passes the reference
  chrome only as a *fallback*. Every store of this box has `chrome/account_header` and `chrome/account_footer`
  placed, so the fallback never renders. A live fetch of the café's `/account/login`: **zero** `demo-setup-*`
  marks, and 2 of 2 `<img>` from the `chrome` app.

⇒ the three rows drew **nothing, anywhere** — *"three rows an operator can drag and never see the effect of"*,
which is the sentence this box already writes for the counter.

★ **Nothing is lost.** The café's mark on the screens **we host** is carried by `chrome`
(`account_brand`, `account_header`, `checkout_header` all hold `forge-co-logo.png`), and its vitrine bundles
its own copy of the same drawing. The art is still this repository's and still graded by
`bin/chrome-logo-crop.guard.mjs`.

## ⚠️ AND THE FORK STILL CANNOT REACH THIS APP'S CODE — measured 2026-09-11 (pk32/d1)

That is a different question from which store is dressed, and removing the placements does not answer it. The
café is served by `storefront-coffee/`, a **fork** of the reference vitrine, and a fork reaches an app of this
box only if somebody wires the two together. It is not wired: the fork's `package.json` does not name
`@forge/ext-demo-setup`, its `next.config.mjs` does not transpile it, and no file of it imports
`@forge/ext-demo-setup/block/marks`.

★ **It is still a defect even though the page looks right.** The café has chrome of its own (`CoffeeChrome`)
and a mark of its own, so the shop is not visibly broken; the fork's owner is entitled to *decide* he does not
want this block. What nobody is entitled to is not knowing. Since pk32/d1 `bin/front-app-reach.guard.mjs` says
it by name on every run, and the decision is written there as a declared divergence rather than implied by
silence.

★ **E desde a pk35/d7 nada é colocado no café** — `seed/demo-setup.json` declara `"cafe": null`, porque as
três marcas foram **medidas desenhando em zero telas** ali: o layout de conta do checkout **substitui as duas
regiões**, e o chrome de referência só chega como *fallback* que nunca renderiza. ⇒ hoje isto **não custa nada
a um comprador**, e continua declarado porque o ALCANCE ainda falta: no dia em que um operador arrastar um
destes blocos para o café no Compose, ele **não desenharia nada**.

⚠️ **Why it is not simply wired yet:** the file that connects an app to a front is
`storefront-coffee/src/lib/extensions/generated/registry.tsx`, a **generated** surface (its own first line says
*do not edit*), and nothing in this repository regenerates it — `bin/build-coffee.sh` mentions no codegen.
Welding the import by hand is what `totem/src/lib/gate/registry.tsx` did, and that file's prose had already
rotted by the time pk31/d1 read it.

⛔ **And the sentence that used to end this paragraph — "the tool is owed by the product (pk32/p1-parto)" — is
false, measured 13/09.** `@forgecommerce/surface-codegen` is a package of the pinned release *and* on its
publishable list, so `bin/vendor-packages.sh` already writes its tarball into `storefront-coffee/vendor/` on
every build, and the fork's `package.json` already pins it under `overrides`. What is missing is **this
repository's**: the fork carries no `composition.json` list of its own, no `codegen` script, and no dependency
on the tool. Run against the fork it answers `6 generated file(s) do not match composition.json` — so wiring
this app is one slice with the café's gate and with the fork's five other generated surfaces, not three lines
in a package.json. The declared divergence in `bin/front-app-reach.guard.mjs` now carries those three
conditions as `until`, and goes **red** the day they are all met and the entry is still there.

## Graded by

- `apps/demo-setup/manifest.test.ts` — three blocks, their areas, no default hook, no scope, the tagline on
  one block only, the wiring against the package's own exports, and the login box being **absent** from all
  three of the places that would have to name it.
- `apps/demo-setup/block/marks.test.tsx` — what the three actually draw, including the exclusivity, the trim,
  the store-scoped link, the tagline having exactly one home, and no export claiming the `account` place.
- `seed/demo-setup.test.mjs` — the declaration and the whole seed driven over a fake port: install, upload,
  place, and the filename becoming an asset id.
- `bin/chrome-logo-crop.guard.mjs` — every declared logo in **both** declarations, by proportion, off the
  PNG's own pixels.
- `bin/config-media-door.guard.mjs` — that no block of any app of this box paints the kernel's **master**
  address while holding the catalog key it stamped beside it. Jurisdiction derived from the manifests, both
  spellings of the sidecar name (written out and composed), and the scanner proven to read code rather than
  the prose that explains it.
- `bin/front-app-reach.guard.mjs` — whether a front of this box can actually DRAW each of the three, derived
  from `composition.json` + `forge.wiring` against each front's manifest, Next config and source. The rule
  itself is graded on fixtures in `bin/front-apps.test.mjs`, because this tree is healthy wherever its
  declared divergences are and a rule proven only against a healthy tree is a rule proven to be quiet.
