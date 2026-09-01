# forge-demo — the Forge demo instance

This repository **is one box**: the public demonstration store, and the first Forge instance that is not
Forge's own infrastructure. Cliente 1.

It holds what an instance holds — the pin, the configuration, the theme, the composition, its own app, its
birth data — and **no kernel code at all**. Forge arrives as four images, pinned by digest in `forge.lock`.
That is the whole relationship, and the reason there is never a merge:

| this repo owns | this repo pins |
|---|---|
| `compose.yml` and the infra · the themes · the apps it wrote · its data and configuration | the kernel, storefront, checkout and admin **images** |

If you find yourself copying something out of the Forge monorepo into here that is not an image reference or
a list, stop: the kernel is never forked, and everything a customer is supposed to change lives in one of
four places (an app, a decision, its own fields, its storefront).

```
compose.yml            the stack. Ours to edit — three ★-marked differences from the template, each with its reason.
forge.lock             the pin: which Forge this box runs, by digest, and where those bytes came from.
composition.json       WHICH APPS the images compose. An instance's answer, not the product's.
env-source.sh          the one file that knows this box's secrets. Sourced, never read from disk by a container.
.env.example           the boring configuration. Copy to `.env`.
apps/                  the apps THIS box wrote: `demo-gate` (§4) and `payment-pos` (§4b). Composed into the images.
extensions/            the FORGE_EXTENSIONS_DIR mount, for an app of ACTIONS ONLY. Empty since the gate became
                       composed (§4); `bin/pack-apps.sh` still produces this form for one that needs it.
themes/                the store themes (`theme_key` on a store names one). `outlet` and `coffee-store` arrive with D2 and C2.
seed/                  the birth data: the stores, the coffee and counter catalogues, the photos.
docs/                  the capability pages: what this box can DO that it could not before, one page each.
bin/                   build-local · build-coffee · pack-apps · images-from-lock · verify-composition · seed
caddy/                 Caddyfile (the real edge) and Caddyfile.local (the bench edge)
```

---

## ⚠️ 1. The pin is a PRE-RELEASE LOCAL BUILD, and re-stamping it is somebody's job

`forge.lock` normally carries the digests published with a Forge release, read back from the registry, so
that what it names is what a `docker pull` gets. **This one does not.** It carries the digests of images
built **on a workstation**, from a branch, and it says so in a `provenance` block:

```json
"provenance": {
  "origin": "local build",
  "built_from": "d2/d1-repo@…",
  "restamp": "OBLIGATION, NOT A REMINDER: the first real deploy replaces every ref below …"
}
```

**Why.** The features this demo exists to show — the store's own vocabulary, the theme's fonts, the anonymous
list face's publication rule, the subscriptions app — live on a branch that has not been merged or promoted.
The registry's digests for this release predate all of them. A lock pinning the registry today would be
perfectly honest about bytes and unable to run the demo. (Decision of 2026-08-31.)

**What does NOT bend:** the images are still pinned **by digest**. `bin/images-from-lock.sh` refuses a
tag-pinned lock and is not relaxed here — `<name>@sha256:<id>` resolves a locally built image exactly as a
registry digest does. The pre-release mode costs a paragraph of honesty and no weakening of the pin.

**The obligation.** The first deploy of this instance to anywhere anyone else can reach re-stamps
`forge.lock` with registry digests from a promoted release and deletes the `provenance` block. A lock that
still says `local build` on a shared box is a box nobody can reproduce. That is part of that deploy's
definition of done, not a note to self.

Rebuilding here: `bash bin/build-local.sh <path to the forge monorepo>`.

---

## 2. Bringing it up

On a bench, in order. Every step is idempotent except the two one-shots, which say so.

```bash
cp .env.example .env                 # the bench's values are already in it
$EDITOR .env                         # ports, if 8080/8081 are taken here

# the secrets. env-source.sh reads them from a gitignored `.secrets` on a bench;
# implement its `secret()` against a real secret manager anywhere else.
printf 'forge-postgres-password=%s\n' "$(openssl rand -hex 16)"  >> .secrets
printf 'forge-vault-key=%s\n'         "$(openssl rand -base64 32)" >> .secrets

bash bin/build-local.sh ~/path/to/forge     # PRE-RELEASE ONLY — builds the four images, writes forge.lock
bash bin/pack-apps.sh   ~/path/to/forge     # apps/ → extensions/ (the form the kernel loads)
bash bin/build-coffee.sh ~/path/to/forge    # the FORKED vitrine — this repo's own front, built not pinned

source ./env-source.sh
source bin/images-from-lock.sh
docker compose run --rm kernel node dist/migrate.js        # forward-only, idempotent, transactional
docker compose run --rm kernel node dist/provision-ref.js  # ONE-SHOT: tenant + first store + first operator
#   → capture BOTH tokens it prints into your secret store, as
#     `forge-admin-service-token` and `forge-operator-access-key`. Shown once.
source ./env-source.sh                                     # so the admin picks the service token up
docker compose up -d
```

Then:

```bash
curl -fsS http://localhost:8080/health
bash bin/verify-composition.sh        # does the running image compose the apps this lock pins?
```

The shop is `http://localhost:8080` and the admin is `http://localhost:8081`
(**its own port, not a path** — the admin is a Next app with no `basePath`, so `/admin*` 307s to a rooted
`/login` that the edge hands to the vitrine as a 404. Measured; `caddy/Caddyfile.local` carries it).

A store is reached at `/s/<store id>` until a hostname claims it — host → store is DATA, set in the admin
(Settings ▸ General ▸ Stores), never configuration.

⚠️ **It is the ID (`sto_…`), not the handle, and `/s/<handle>` fails QUIETLY.** The read face takes a store
id and answers a handle with a 404 that says so; the page itself still returns **200**, because a store
whose facts cannot be read degrades to a neutral shell rather than to an error. What you get is a shop
titled "Loja", with no theme, no products and no composed blocks — which looks like a store that was never
seeded rather than like a URL that was never right. `docker compose exec kernel …`, the admin's store list,
or `read.internal.stores` all give you the id.

With no SMTP configured the login code is written to the kernel's stdout: `docker compose logs kernel` is
the inbox.

---

## 3. The first day closes by script — and the one refusal that will fool you

Everything below runs with the **`Reference Operator`** credential that `provision-ref` printed at
bootstrap. No admin, no browser, no second secret to mint.

```bash
source ./env-source.sh                       # exports FORGE_SEED_TOKEN from your secret store
node bin/seed.mjs --api http://localhost:8080
```

That creates the stores, declares the `cf.*` vocabulary and creates the six coffees **with their photos**,
all through the door: the script holds an API key, never a database credential, exactly like an ERP would.
It is idempotent — re-running it is a no-op.

The same run stands the **Outlet** up (`seed/outlet.mjs`, its data in `seed/outlet.json`): it installs the
two apps that store composes with, uploads its photographs and campaign art, publishes eight products with
their prices and their stock, pins the two collections its shelves are sourced from, and places the four
Compose blocks that are its home page. Not one line of front-end code — a theme, data, and a composition.

The same run also stands the **Balcão** up (`seed/totem.mjs`, its data in `seed/totem.json`) — the counter
store the totem serves, handle `balcao`, on the same tenant and with no theme (the totem is an app of its
own and resolves none). It creates the four bands of the menu as **kernel categories** (`cafes` ·
`especiais` · `comidas` · `pra_levar`), the fifteen drinks and foods only the counter sells, with their
photographs and with their size/milk/flavour axes as ordinary variants, a pickup point and the pickup
shipping method every order needs, the `PRIMEIROCAFE` coupon scoped to that store, and the "Combo da manhã"
promotion. ⚠️ **It creates no coffee.** The six the counter sells "pra levar" are the coffee shop's OWN
products, PUBLISHED into a second store — so the price the totem prints is the same SKU the e-commerce
sells, live from the kernel. That is the multistore assortment, and it is the one thing a second catalogue
could not fake. It runs after the coffee step and says so if they are not there.

⚠️ **The pickup point and its shipping method are TENANT-WIDE, not per store.** Neither
`shipping.method.create` nor `pickup_location.create` takes a `store_id`, so "Retirar no balcão" appears in
the other stores' checkouts too. On this box that is additive — the tenant had no shipping configuration at
all before it — and it is the same shop; it is written here so nobody discovers it from a checkout screen.

Installing the app is one call on the same credential:

```bash
curl -X POST "$FORGE_PUBLIC_ORIGIN/v1/commands/extension.install" \
  -H "authorization: Bearer $FORGE_SEED_TOKEN" -H "x-forge-tenant: $FORGE_REF_TENANT" \
  -H 'content-type: application/json' -d '{"extension_id":"demo-gate"}'
```

⚠️ **THE REFUSAL THAT WILL COST YOU AN HOUR IF NOBODY WARNS YOU.** The write face takes the tenant as a
**header**, and without it every command answers:

```
HTTP 403  {"code":"forbidden","message":"tenant required"}
```

That reads like a permissions problem and is not one. The same credential, on the same box, in the same
minute, answers `GET /v1/read/internal/stores` with **200 and real data** — the internal read face resolves
the tenant on its own and the write face does not (`apps/api/src/adapter.ts:42`,
`packages/core/src/dispatcher.ts:272`). **Send `x-forge-tenant: <tenant>` on every write.** `bin/seed.mjs`
does it for you and refuses to start without a tenant, saying exactly this.

**A narrower key is the better long-term answer**, and it needs no admin either — `iam.api_key.create` is
reachable on the same door. Mint one with only `tenant.store.write`, `catalog.product.write`,
`catalog.sku.write`, `custom_fields.write` and `media.write`, and keep the bootstrap operator credential for
the things that really need an operator.

⚠️ **`bin/seed.mjs` holds no catalogue of its own beyond these three stores.** The three supporting products
the catalogue document promises for bought-together are **not** invented here — they are named as a gap in
`seed/catalog.json`. The `forge` store is filled from the platform's example dataset instead of from a
catalogue written here; the section below says where that comes from and why.

⚠️ **And it is not the platform's seeder, which exists.** Forge ships `demo-data` (the `Seeder` app,
`node dist/seed-demo.js`), and it owns the dataset. It is not used here for two measured reasons, both about
this box: it cannot be **aimed** at a store — it picks `handle === 'demo-store'` or else the tenant's oldest
store, which here is `outlet` — and aiming it would mean changing the app and rebuilding the kernel image,
which on a pinned pre-release box moves the binary that is serving it. The right long-term fix is a store
target on that action; until then this module drives the same port with the same dataset.

### Where the `forge` store's catalogue comes from — and why it is not in this repository

The coffee store and the outlet carry their content here (`seed/catalog.json`, `seed/outlet.json`): six and
eight products, small enough to read in a diff. The **`forge`** store — the sports shop the box serves at its
root — does not. Its catalogue is the **platform's example dataset**: 33 categories, 351 brands, 2 790
products, 44 427 SKUs and 18 582 photographs. It arrives by **path**, and the path is configuration:

```bash
source ./env-source.sh
FORGE_SEED_DATASET_DIR=<path to the forge monorepo>/instances/demo/dataset \
  node bin/seed.mjs --api http://localhost:8080
```

Unset, the variable means what it means everywhere else in Forge: **no example data, and that is a legitimate
state.** The seed writes one line saying the sports store stays empty and carries on. A clone of this
repository with no monorepo beside it still brings up the coffees and the outlet.

**Why by path and not committed here.** The obvious alternative — "a customer's catalogue is his own data, so
it belongs in his repo" — was measured before it was rejected, and it does not deliver what it promises:

- `instances/demo/dataset/` is **41 MB** of catalogue JSON and shared art, and
- the **3.6 GB of per-product photographs are git-ignored in the monorepo too**
  (`instances/demo/dataset/assets/catalog/.gitignore`). They live in a public bucket and are pulled on demand
  by the platform's own hydrate step.

So committing the dataset here would add 41 MB of weight to this repository **and still depend on the same
bucket** for the half that actually matters — the pictures. The path costs nothing and is honest about what
this box is today: a demo whose example catalogue is still ours, pointed at from where it is maintained. It
is the same gesture `bin/build-local.sh <path to the forge monorepo>` already asks for, and the same variable
name the platform's own compose uses (`FORGE_SEED_DATASET_DIR` / `FORGE_SEED_DATASET_HOST_DIR`).

**What changes the day the demo has a catalogue of its own.** Nothing in `seed/forge.mjs`: it reads a dataset
directory, and a dataset directory is a `forge-seed-dataset.json` pointer, a `catalog.json`, a
`custom-fields.json` and an `assets/` tree. On that day the directory moves into this repository (or into
this instance's own bucket), `FORGE_SEED_DATASET_DIR` points at it, `seed/forge.json` names its id instead of
`"demo"` — and the seed refuses to run against any other, by name, which is the check that makes the move
safe. The 41 MB objection disappears with it: it is his data then, and weight you carry for your own
catalogue is weight that belongs to you.

**The photographs.** If the directory you point at has none on disk, hydrate it first from the monorepo — the
platform's step pulls what is missing over plain HTTPS and does nothing when the disk is already complete.
Measured on this box: **18 582 photos / 3.5 GB in 319 seconds.**

⚠️ **`FORGE_SEED_PHOTOS_DIR` moves ONLY the per-product tree**, never the shared art (brand logos, category
icons, the strips). That asymmetry is the platform's and it is deliberate — pointing the override at a shared
photo mount and expecting the icons to follow is a documented way to break the seed.

### ⚠️ The fronts do not notice a theme or a placement on their own

Two ways to spend half an hour deciding a feature is broken when it is not, both measured on this box:

- **A NEW THEME FOLDER NEEDS A RESTART, not a reload.** `themes/<key>` is mounted, but the resolver
  MEMOISES its answer in production — including the answer "there is no such theme". Create
  `themes/outlet/` while the box is up and every page keeps serving the base theme until the process is
  replaced: `docker compose restart storefront checkout`. Editing a token inside a folder the process has
  already resolved is the same story. (In `next dev` the cache is off, which is why nobody meets this
  while building a theme.)

- **A PLACEMENT DRIVEN THROUGH THE PORT NEEDS A CACHE BUST.** The admin calls the storefront's
  revalidation hook when an operator saves; a script driving `composition.place` does not, so the page
  keeps its cached render until the TTL. Ask for it by hand:

  ```bash
  curl -X POST "http://localhost:8080/api/revalidate?tag=extensions:<store id>&tag=store:<store id>" \
       -H "x-revalidate-secret: $FORGE_REVALIDATE_SECRET"
  ```

  ⚠️ **The checkout has no such hook** — measured: `/_checkout/api/revalidate` is a 404 and that container
  carries no `FORGE_REVALIDATE_SECRET`. Restarting it is the only lever there, which matters the day a
  block is composed into a checkout slot.

---

## 3b. ⭐ THE SEED HAS TWO STEPS, AND THE SECOND ONE RUNS INSIDE THE CONTAINER

Everything in §3 drives the port from outside, which is the right shape for almost all of it. There is
exactly one thing it cannot do, and it is not a matter of effort:

> **An order created through the port is dated TODAY.** `sales_order.created_at` takes the `default now()` of
> its migration. The kernel's clock IS injectable — but on the DISPATCHER (`createDispatcher({ now })`), and
> only the process that BUILDS one can move it. There is no backdating parameter on the port and there never
> will be: a caller that could choose when an order happened is a caller that could rewrite the books.

So a box seeded only from outside gets its whole past on ONE calendar day. Measured on the isolated bench
before this existed: every order the port had created was dated the day it ran — 2 orders across 1 calendar
day, which is the same shape an older bench showed at scale (**64 orders across three days**, one per time
somebody ran the seed). A dashboard drawn from that is a spike, not a shop.

The second step is therefore a **one-shot inside the container**, the same shape this box already uses for
`migrate` and `provision-ref`:

```bash
# 1. from OUTSIDE — the catalogue, the commerce, the stores' own data
node bin/seed.mjs --api http://localhost:8200

# 2. from INSIDE — the dated past, one tenant at a time
docker compose run --rm kernel node dist/seed-history.js --tenant forgeco
docker compose run --rm kernel node dist/seed-history.js --tenant forgecafe
```

⚠️ **THE ORDER IS NOT A PREFERENCE.** Step 2 SELLS what step 1 published — it refuses to start on a tenant
with no sellable shelf — and it RESOLVES the logistics step 1 created rather than creating any of its own. It
also needs a payment app installed for the tenant, or the first order is answered `no payment provider for
method`. Run it first and it fails, correctly and loudly, naming what is missing.

⚠️ **`--tenant`, AND NOT `--schema`.** A tenant provisioned by `platform.tenant.provision` gets a MINTED
schema name recorded in `forge_control.tenant.schema_name`, and **no port publishes it** — so there is no way
for an operator to discover the value except from provisioning output they may never have seen. The one-shot
therefore resolves it from the registry itself, and `--schema` exists only as an override. It used to default
to the tenant id, which is true of the legacy `demo` tenant and of nothing else; the symptom was
`relation "promotion" does not exist`, which reads like a broken database and is in fact a missing flag.

⚠️ **IT IS RESET-AND-SEED BY NATURE.** On a tenant that already carries a history it stops and says so rather
than laying a second past on top. Wipe and re-run to rebuild it.

---

## 4. The gate — this box's own app, with a screen

`demo-gate` is this box's own app: the first one, and the reason the species exists. It fills
`storefront:gate` with the full-screen "Demo store" interstitial and the ribbon under it, and it renders on
**the reference storefront — the one the Outlet runs unforked.**

**That last sentence used to say the opposite, and the fix was upstream.** Until Forge P1 an app belonging to
ONE box could not be on a composition list at all, and both front registries are built from that list — so
this app could load, install and fill its slot in the data, and show nothing. The Outlet had no gate. The
refusal that caused it was wider than its own reason ("does not offer it to ANOTHER box" — and the box that
OWNS the app is not another box), and P1 split it into two axes: the platform's OFFER stays exactly as shut,
the instance's own LIST opens.

**How it reaches the image now.** It is on `instanceApps` in `composition.json`, NOT on `apps` — the second
list is what the platform offers and this box chose, the first is what this repository wrote.
`bin/build-local.sh` copies it into the Forge build context and the oven adopts it: it checks the app declares
`forge.origin: "instance"`, composes it like any other app, and links its dependencies from what the image
already carries. **No install runs and no lockfile line moves.**

⚠️ **It is no longer mounted through `FORGE_EXTENSIONS_DIR`, and it must never be both.** A composed app is
already in the image; mounting the same id on top of it is a duplicate the kernel refuses at boot. The mount
seam is still there for an app of ACTIONS ONLY, which needs no rebuild.

⚠️ **The images this box builds are stamped NOT OFFERABLE, on purpose.** An image carrying one customer's app
may never be promoted as a Forge release artifact — `forge.lock` says so in `offerable`, and Forge's own
release gate refuses it. This is a property of what this box asked for, not a defect.

⚠️ **`FORGE_GATE_SITE_URL` / `FORGE_GATE_ADMIN_URL` are now read by the FRONTS, not by the kernel.** The gate's
entry is a Server Component in the storefront and the checkout, so its wiring lives where the component runs
(`compose.yml` sets both on those two services). They never reach the browser.

---

## 4b. The counter's payment app — this box's own payment DRIVER

`payment-pos` (`apps/payment-pos/`) is the second app this repository owns, and the first that is not a
screen. It serves the totem's two ways to pay: the card machine (`card`, settled the moment the kernel is
told, because the machine already took the money) and the totem's PIX QR (`pix`, which waits for a scan).

**It exists instead of a config change on `payment-reference` for two measured reasons**, both the reference
app's own: that app's PIX mode is UNIVERSAL config, so auto-approving for the counter would also settle the
coffee store's PIX (the live "aguardando pagamento" the demo exists to show), and its settlement door needs a
`provider_ref` its own `initiate` never returns. `payment-pos` returns the ref inside its own `next_action`,
which is the whole difference, and it cost zero kernel.

It reaches the image exactly like `demo-gate`: `instanceApps` in `composition.json`, staged into the build
context by `bin/build-local.sh`, and the image it composes is stamped not offerable.

The capability page is `docs/capabilities/payment-pos.md`; the field-level contract is the app's own README.

⚠️ **IT OPENS A PUBLIC, UNAUTHENTICATED DOOR THAT APPROVES A PAYMENT** — the totem's "tap the QR to simulate
the scan" is a `POST /webhooks/payment/<store>/payment-pos` with no auth. It is acceptable only because this
app is never offered to anybody. What holds it is the ref being opaque plus two refusals that belong to the
KERNEL (a ref naming no attempt; a second settlement of the same intent). The app's README names all three
and says why an app-side copy of the kernel's two would be worse than none.

⚠️ **INSTALLING IT OFFERS IT IN EVERY STORE OF THIS TENANT, and nothing can scope it.** Installation is per
tenant by construction — `extension_installation` has a unique index on `(extension_id, tenant_id)`
(`system/0008`) — and a payment provider is offered straight from the installation, never from a per-store
placement. So `read.payment_methods` lists it for the coffee store and the Outlet too; the checkout's
provider chooser filters only by method; and `active: false`, the one lever that removes it, is tenant-wide
config, so it would switch the counter off as well.

**Measured on this box: no payment provider is installed at all today** (`read.payment_methods` answers
`{"methods":[],"providers":[]}` for every store). So installing `payment-pos` does not add one option among
several — it becomes the tenant's ONLY provider for `pix` and `card`, with no chooser rendered, and its
`card` settles instantly and free. This is a known property of this box, not a defect of the app, and no
change inside this repository can fix it: a per-store offer gate would be a kernel change. The mitigation
that does exist is the name: the app is called after a PLACE ("Pagar no balcão"), so that seeing it in the
coffee store's checkout reads as a misconfiguration and never as a legitimate option.

## 4c. The counter's totem — and why this box runs SIX images, not four

The demo instance is **six images**, and only four of them are the product:

| image | whose | how it gets here |
|---|---|---|
| `kernel` · `storefront` · `checkout` · `admin` | **the product** | pinned BY DIGEST in `forge.lock`, re-stamped from a registry |
| `storefront-coffee` | **ours** | built by `bin/build-coffee.sh`, wired in `compose.override.yml` |
| `totem` | **ours** | built by `bin/build-totem.sh`, wired in `compose.override.yml` |

**The totem is the fourth posture of the customisation table, and it is the one worth understanding.** It is
not a forked vitrine plus a forked checkout: it is ONE Next app of the client's own (`totem/`) answering
**every path of the counter's host** — the menu, the bag, the identification, the payment and the order
number, all of it — while talking to the same kernel through the same public port as everything else. Not
every extra experience is a fork of ours; it can be **one more image**.

⚠️ **Neither of the two OURS is in `forge.lock`, and for the totem there is a second reason worth writing
down.** The first is the one `compose.override.yml` already gives for the vitrine: they are ours, they have
no upstream, and pinning them would claim a provenance they do not have. The second is a fact about the file:
`bin/build-local.sh` **rewrites `forge.lock` from a fixed four-image template**, so a fifth or sixth key added
there by hand is deleted, silently, by the next oven run. `totem/src/lock-provenance.test.ts` fails if anybody
puts it back.

### Bringing the counter up

The image has to exist before compose can start it — the Dockerfile is thin on purpose (it copies a build,
it does not run one), exactly like the vitrine's:

```bash
bash bin/build-totem.sh <path to the forge monorepo checkout>
source ./env-source.sh && source bin/images-from-lock.sh
docker compose up -d totem
```

Then set, in `.env` (the full block with its reasons is in `.env.example`):

```dotenv
FORGE_TOTEM_STORE_ID=sto_…          # what the process sends to the port
FORGE_TOTEM_STORE_HANDLE=balcao     # what a HUMAN reads to know which shop that id is
FORGE_TOTEM_HTTP_PORT=8102          # the bench port; the site `:82` in caddy/Caddyfile.local
FORGE_TOTEM_DOMAIN=                 # the counter's hostname in a deployment (caddy/Caddyfile)
FORGE_TOTEM_IDLE_SECONDS=90         # how long before the screen resets between customers
```

⚠️ **The store takes TWO variables and that is not redundancy.** The public read face produces a store id from
a HOST and from nothing else; the only capability that returns a `handle` lives on the internal face, behind
the admin service token — which this app deliberately does not hold, because no other front on this box holds
one and a kiosk is a poor place to start. So the id is what the process uses and the handle is what makes that
id reviewable by a person. The app refuses to boot if either is missing, or if the handle was pasted into the
id slot.

### Testing the counter by hand

Open **http://localhost:8102** (the bench) — you should land on "Toque para começar".

1. **Touch anywhere.** The attract screen lifts and the menu appears: four bands (Cafés · Especiais da casa ·
   Comidas · Pra levar), a fixed rail on the left, big finger-sized cards.
2. **Tap a drink with milk** — a Cappuccino or a Latte. The modal opens on the cheapest variant. Choose a size
   and a milk: **two taps, fat buttons, never a dropdown**. The price beside "Adicionar" is the SKU's, and the
   "+ R$ …" beside an option is the difference between two real SKU prices, never a surcharge table.
3. **Tap a coffee from "Pra levar"** — one of the six the online shop already sells. ⚠️ **Check its price
   against the coffee store's** (`/s/cafe` on the bench edge): it is the same SKU, so it is the same number,
   read live. If they ever differ, something re-registered a product that should only have been published.
4. **Revisar pedido → CUPOM → `PRIMEIROCAFE`** on the on-screen keyboard → "Adicionar cupom". The discount
   line and the total are the kernel's own; the counter never multiplies by 0.9.
5. **Ir para o pagamento → type a name** (only a name — a person at a counter has no e-mail to give and must
   not be asked for one) → **choose Pix or Cartão**.
   · **Pix**: the QR appears; **touch it** to simulate the scan.
   · **Cartão**: "pague na maquininha", and the machine has already said yes by the time the screen draws.
6. **The confirmation** shows the order number GIANT — that is `order.number`, the kernel's per-store
   sequence, the number the barista will call — plus the name, the summary and "retire no balcão".
7. **Check the order in the admin** (`:8101`), in the counter's store: the buyer's name is the one that was
   typed, and the items are the ones that were chosen.
8. **Now walk away and count.** After `FORGE_TOTEM_IDLE_SECONDS` the screen returns to "Toque para começar"
   **and the bag is empty** — the cart pointer is destroyed on the server, so the next customer starts clean.
   That is the whole difference between a till and a web page, and it is worth testing on purpose.
9. **Turn on "reduce motion"** in the operating system and reload. Every animation stops. A public screen is
   the one place a person cannot walk away from motion they did not ask for.

⚠️ **What a busy counter runs into, and it is a property of the platform rather than of this app.**
`cart.set_buyer` and `cart.apply_coupon` are oracle-class faces capped at **ten a minute per store + IP**
(`ORACLE_IP_CAP`), and one totem is one address — so the counter's ceiling is ten identified orders a minute,
shared with any other caller of that store that does not forward an address. Measured on the bench: the
eleventh call answers `429` with `Retry-After: 60`, and the bucket really is shared (five calls on one cart
plus five on another refuse the eleventh). The screen therefore sends the buyer **at most once per cart**,
asking the kernel rather than remembering, and turns the refusal into a sentence with the port's own number in
it. Nobody taps ten orders a minute by hand, so the demo never meets this — but a real counter would.

---

## 5. Upgrading

Edit `forge.lock`, migrate, `up`. There is no merge in it — the apps and themes here keep working across
versions because they compile against a frozen contract.

```bash
$EDITOR forge.lock
source ./env-source.sh
docker compose run --rm kernel node dist/migrate.js
docker compose up -d
```

Rolling back the code is putting the previous digests back. **Rolling back the data is not a thing** —
migrations are forward-only. Snapshot the database before a version bump; that is the undo.

## 6. Backups

The database is everything, and `FORGE_VAULT_KEY` is what makes a restore readable — without it a restored
box has payment and ERP credentials it cannot decrypt. On this bench the database is a compose volume and
the demo is rebuildable on purpose; the day it holds something real, the `postgres` service comes out of
`compose.yml` and `DATABASE_URL` points at a managed instance. That is eleven lines and one variable.
