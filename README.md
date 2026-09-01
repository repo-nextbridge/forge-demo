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
apps/                  the apps THIS box wrote. `demo-gate` today; composed into the images (see §4).
extensions/            the FORGE_EXTENSIONS_DIR mount, for an app of ACTIONS ONLY. Empty since the gate became
                       composed (§4); `bin/pack-apps.sh` still produces this form for one that needs it.
themes/                the store themes (`theme_key` on a store names one). `outlet` and `coffee-store` arrive with D2 and C2.
seed/                  the birth data: the stores, the coffee catalogue, the photos.
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

⚠️ **`bin/seed.mjs` is not a seeder and is not trying to be.** Forge ships one; this is the minimum that
makes the demo stand up. The full seed is a later slice, written from what the finished demo turns out to
need (decision of Renan, 2026-08-31). The three supporting products the catalogue document promises for
bought-together are **not** invented here — they are named as a gap in `seed/catalog.json`.

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
