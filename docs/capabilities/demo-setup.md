# `demo-setup` — the shop's own mark, from an app this box wrote

**What this box can do that it could not before:** put its own name and logo in each of the three places its
**shop window** shows one, **separately**, from an app that lives in this repository and in no Forge release.

★★★ **AND SINCE v0.4 IT CARRIES ONE MORE BLOCK THAT IS NOT A MARK: the demonstration ribbon** — the bar that
tells a visitor nothing here is charged or shipped. It arrived here because the box's other UI app was
retired: that one filled `storefront:gate`, and an app merely INSTALLED on that slot takes every store off the
cacheable tree (`private, no-cache, no-store` on every route, and an interstitial handed to every robot at
every URL, with no `<title>` — measured on the deployed box, 18/09). A block costs the cache nothing.

---

## The capability, in one paragraph

A Forge storefront draws a wordmark in four places: the header bar, the mobile drawer's head, the footer's
brand column and the login box of the account screens. Out of the box all four say `forge.`, and the footer
adds *"Leve. Inteligente. Sua."* under it. `demo-setup` declares **three marks** — the three the **vitrine**
draws — each placed and configured on its own in Compose, plus the **demonstration ribbon**. Every one of them draws either a **logo** picked
from the asset library or a **wordmark** — a name plus a tail painted with the theme's accent — and the
footer's block also carries the shop's own **tagline**.

⛔ **The fourth place is not this app's, and the line is the DEPLOYABLE.** The login box belongs to the
**checkout**, which Forge hosts and nobody forks; the vitrine is the one a customer forks and makes theirs.
Identity in something you fork may live in an app of your own — that is this app. Identity in something you
cannot fork has to be configurable **without** a fork, which makes it a capability of the **product**: from
pk28 the OOTB `chrome` app carries the login box's mark. In one line: the OOTB `chrome` app is where the login
box's logo goes and this demo's config keeps only the other three — **those three are the storefront's, and the
login box is the checkout's.**

## Why it is an app, and why it is OURS

*A logo is content.* The Forge régua is explicit: whatever is specific to one shop is an app, a decision, its
own fields or its storefront — never the kernel. So the product ships the four **slots** with a bare default
and nothing else; the block that fills them belongs to whoever wants a mark. This box wanted one, so this box
wrote it. It is composed into this instance's images (`instanceApps` in `composition.json`), stamped not
offerable, and a fleet list that named it would be refused with rule `not-carried`.

★ **That is the demonstration, and it is deliberate.** The app is small on purpose: four blocks, two shared
renders, no admin page, no scope, no table, no migration. A customer asking *"how do I extend Forge?"* is shown
this directory, and the answer is a package and a declaration.

## A block per place and not one for all — what changed and why

Until pk26 the mark was the `brand` block of the platform's `chrome` app: **one placement read in four
renders**. An operator dragged one row in Compose and changed four places, with no way for the board to say
where. That is the defect by name — **a Compose board that configures something without knowing where it will
show up makes no sense** — so Forge gave each place its own slot, and the mark moved here.

⛔ **One component per place is the kernel's rule, not a preference.** `placement: 'single'` is enforced per
*(store, app, component)*: the same component dropped into a second slot is refused with `conflict`. So four
places require four components — which is what makes the Compose board literal again.

★ **And the liberty is the point.** A shop may now put a different mark in each of its places. This box does
not (a rule holds its spellings equal), but the ability is real and was accepted deliberately: configuring
the logo in each place is a fair price, and it buys more freedom.

| block | slot | draws in |
|---|---|---|
| `header_brand` | `storefront:header.brand` | the shop's top bar |
| `drawer_brand` | `storefront:header.drawer_brand` | the mobile drawer's head |
| `footer_brand` | `storefront:footer.brand` | the footer's brand column (**+ the tagline**) |
| `demo_ribbon` | `storefront:footer.end` *(no `area` — the block accepts any slot of the surface)* | every vitrine page **and** the account screens of the checkout, which wear the STORE's chrome |

★ **The fourth one breaks two of this app's own rules, and both on purpose.** It declares **no `area`**,
because a notice belongs wherever a store is looked at and WHICH slot that is gets decided in Compose; and it
is **`repeatable`** where the marks are `single`, because a mark CEDES a node the front would otherwise draw
itself (two in one header is two wordmarks) while this one stands beside whatever is there. It also takes
**no config**: a sentence an operator can edit is a sentence an operator can empty, and an emptied honesty
notice looks exactly like a shop that never had one.

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

⛔ Only `forge` and `outlet` say it — those two are the declared ones. The café has a footer of its own;
the counter has no shop window at all and is declared `null`.

## Where the demo's own answers live

`seed/demo-setup.json` — the declaration: which store wears what, with the reason for each.
`seed/demo-setup.mjs` — the hand: install, upload the pictures, place and fill in. It shares
`seed/blocks.mjs` with `seed/chrome.mjs`, because the two declarations have the same shape and a second copy
of a placement engine is a second thing to drift.

A birth writes all of it: **the app is born installed, placed AND configured**, and a re-birth re-asserts the
declaration. An operator's own edit in Compose survives until the next birth — the same contract every other
declared thing in this box has.

### ★★★ …and the NOTICE is in that sentence since v0.4/F5, because it was not

⛔ **The block was declared, both forks were wired to draw it, and NO STEP OF THE BIRTH PLACED IT.** The
placement was a `hook_placement` row an operator wrote in Compose: it survives a deploy and does **not**
survive a reset, and this box resets itself. That is the defect of 11/09 in another coat — the gate app *"was
installed by no step of the birth"* and the demo served its shops without one for days with every birth
reporting green. `bin/gate-at-birth.guard.mjs` retired with the app it graded, and the notice inherited the
hole without inheriting the fence.

⇒ `seed/demo-setup.json` declares `demo_ribbon` in `storefront:footer.end`, per store, and
`bin/ribbon-at-birth.guard.mjs` is the fence. Both halves of that fence are **derived**: the block is the one
this app's manifest ships with **no `config_schema`** (the app's own way of saying *this exists to be true,
not to be filled in*), and the stores are every store `seed/box.json` keeps **on the street** — the kernel's
own rule, spelled once in `bin/servable.mjs`. The counter is the exclusion, and it is excluded by its
`status: "private"` rather than by its handle: the vitrine 404s it, and `totem/` carries the notice by hand.

⛔ **And `markless()` had to get more precise rather than more permissive.** Its refusal — *a block with no
logo and no word* — is about a slot that **cedes its whole node** and draws nothing when empty. The notice
cedes nothing and takes no config at all, so an empty config is the only one it can have. The refusal now
asks its question of the blocks whose own `config_schema` offers somewhere to put a mark, read off the
manifest: a fifth mark is covered without anybody remembering, and a second notice is left alone without a
list to maintain.

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

`seed/demo-setup.json` declares the café wearing the notice and **no mark**. The rule behind the missing mark:
**a fork is the customer's, with 100% freedom** ⇒ **when
a fork draws by itself what a declared block would draw, the instance removes that
store's placement.** `seed/outlet.mjs` uses the same pattern for the PLP shelf.

⚠️ **The other example this line used to cite was the café's gate, and there is no gate any more (v0.4).**
That removal was never the same rule as this one: this is a fork that draws the thing ITSELF, that was a fork
that could draw NOTHING. Only this one is the 100%-freedom rule.

⛔ **And the ribbon is neither, which is why `"cafe"` stopped being `null` in v0.4/F5.** It is not the
customer's content — it is this box saying out loud that its prices are not real — and the fork draws nothing
of the kind by itself. So the café's vitrine COMPOSES the app (see below), its own slot catalogue publishes
`footer.end`, and **the birth places the notice there**. The café's entry now declares one block and no mark:
the mark is the fork's, the notice is the box's.

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

## ★★★ AND THE FORK REACHES THIS APP NOW — the other half, closed in v0.4

That was always a different question from which store is DRESSED, and removing the placements never answered
it. The café is served by `storefront-coffee/`, a **fork** of the reference vitrine, and a fork reaches an app
of this box only if somebody wires the two together. Until this slice it was not wired — no dependency, no
`transpilePackages`, no import — and `bin/front-app-reach.guard.mjs` said so on every run as a **declared
divergence**, because whoever owns a fork is entitled to decide against a block and nobody is entitled to not
know.

⇒ **What changed is that the app stopped being only marks.** The demonstration ribbon is not the customer's
content, and the café's shop window is one of the four that owe a visitor that sentence. So the fork took all
four gestures — the `file:../apps/demo-setup` dependency, `transpilePackages`, the tracing root it already
had, and **`npm run codegen`**, which rewrote `src/lib/extensions/generated/registry.tsx` from the fork's own
`composition.json`. The waiver went with the gap: the guard **grades** the pair now and goes red the day the
fork stops reaching the app.

⛔ **It is still a GENERATED surface, and it is still not regenerated by anything in this repository.**
`bin/build-coffee.sh` mentions no codegen, so the command is a hand gesture inside `storefront-coffee/`.
Welding the import by hand is not the fix — that is what the counter's old gate registry did, and that file's
prose had already rotted by the time pk31/d1 read it.

★ **THE COUNTER IS THE EXCEPTION, AND IT IS DECLARED PER COMPONENT.** `totem/` is a cut of no Forge surface,
so its jurisdiction is the apps it NAMES — and it names this one, because it draws the ribbon
(`totem/src/components/DemoNotice.tsx`, mounted in its own layout: the counter has no Compose board). The
three MARKS are waived there, one entry each, with `waitsOn: null` — the counter has no header bar, no mobile
drawer and no footer column, which is the same decision `seed/demo-setup.json` already writes as
`"balcao": null`. ⚠️ **One waiver per component and not one per app**, so the day the ribbon's import
disappears the guard is red instead of covered.

## Graded by

- `apps/demo-setup/manifest.test.ts` — three marks and their areas, the ribbon declaring neither an `area` nor
  a config, no default hook, no hook on `storefront:gate`, no scope, the tagline on one block only, the wiring
  derived against the blocks the manifest declares, and the login box being **absent** from all three of the
  places that would have to name it.
- `apps/demo-setup/block/marks.test.tsx` — what the three marks actually draw, including the exclusivity, the
  trim, the store-scoped link, the tagline having exactly one home, and no export claiming the `account` place.
- `apps/demo-setup/block/ribbon.test.tsx` — the sentence being present with **no observer at all** (arming is
  what hides it, so a client that cannot reveal must never arm), the beat measured by the clock at **1000 ms**
  (999 ms still hidden), the reveal firing once and only on scroll, and no form, no button and no cookie.
- `bin/no-gate.guard.mjs` — that no app of this box declares a hook on `storefront:gate`, read from each
  manifest's CODE with the comments stripped first.
- `seed/demo-setup.test.mjs` — the declaration and the whole seed driven over a fake port: install, upload,
  place, and the filename becoming an asset id.
- `bin/chrome-logo-crop.guard.mjs` — every declared logo in **both** declarations, by proportion, off the
  PNG's own pixels.
- `bin/config-media-door.guard.mjs` — that no block of any app of this box paints the kernel's **master**
  address while holding the catalog key it stamped beside it. Jurisdiction derived from the manifests, both
  spellings of the sidecar name (written out and composed), and the scanner proven to read code rather than
  the prose that explains it.
- `bin/front-app-reach.guard.mjs` — whether a front of this box can actually DRAW each of the four, derived
  from `composition.json` + `forge.wiring` against each front's manifest, Next config and source. The rule
  itself is graded on fixtures in `bin/front-apps.test.mjs`, because this tree is healthy wherever its
  declared divergences are and a rule proven only against a healthy tree is a rule proven to be quiet.
