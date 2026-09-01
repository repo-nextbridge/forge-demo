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
apps/                  the apps THIS box wrote. `demo-gate` today.
extensions/            GENERATED from apps/ by bin/pack-apps.sh — the packed form the kernel actually loads.
themes/                the store themes (`theme_key` on a store names one). `outlet` and `coffee-store` arrive with D2 and C2.
seed/                  the birth data: the stores, the coffee catalogue, the photos.
bin/                   build-local · pack-apps · images-from-lock · verify-composition · seed
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

A store is reached at `/s/<handle>` until a hostname claims it — host → store is DATA, set in the admin
(Settings ▸ General ▸ Stores), never configuration.

With no SMTP configured the login code is written to the kernel's stdout: `docker compose logs kernel` is
the inbox.

---

## ⚠️ 3. Two things need a human in the admin, exactly once, and cannot be scripted

This is a property of the platform today, measured on this box rather than assumed. **There is no headless
path to mint a tenant API key or to install an app.** Every credential the bootstrap hands you was tried:

| credential | on `/v1/commands/*` |
|---|---|
| the operator access key from `provision-ref` | **403** |
| the admin login-driver token from `provision-ref` | **403** |
| `node dist/admin-platform-token.js` | mints a credential that says, in its own output, that it *"does NOT hold platform.iam.write: it cannot issue credentials, provision tenants **or install apps**"* |

And that is deliberate rather than missing: `iam.api_key.create` is a TENANT command, so driving it already
requires a credential — the chicken and its egg — and the one command that could break the cycle,
`platform.credential.issue`, is `system: true` **and** off the CONTROL face's explicit allow-list. The
platform is saying that minting a tenant's credentials is not something a box does to itself over HTTP.

So, once, in the admin:

1. **Create an API key** (Developers ▸ API keys) with `tenant.store.write`, `catalog.product.write`,
   `catalog.sku.write`, `custom_fields.write`, `media.write` and `asset.write`. Put it in your secret store
   as `forge-seed-token`. `bin/seed.mjs` needs it and refuses, by name, without it.
2. **Install `demo-gate`** (Apps ▸ Demo gate ▸ Install). Loading it makes it *available*; installing is what
   the tenant *consents* to.

Then:

```bash
source ./env-source.sh && node bin/seed.mjs
```

`bin/seed.mjs` creates the stores and the six coffees **through the port** — it holds an API key, not a
database credential, exactly like an ERP would. It is idempotent: re-running it is a no-op.

⚠️ **It is not a seeder and is not trying to be.** Forge ships one; this is the minimum that makes the demo
stand up. The full seed is a later slice, written from what the finished demo turns out to need
(decision of Renan, 2026-08-31).

---

## ⚠️ 4. What the gate does, and what it does not do yet

`demo-gate` is this box's own app — the first one, and the reason the species exists. It loads from
`extensions/`, appears in the admin's Apps area, installs, and fills `storefront:gate`. All of that works
and is measured (`/health` reports `"loaded": 1`).

**Its screen does not render, and that is a property of the platform's model rather than a missing value
here.** The front half of a hook resolves through a **static registry compiled into the front's build** —
`packages/storefront-kit/src/gate/registry.tsx` for gates, the block registry beside it for blocks — and
both are generated from the **composition list**. An app that belongs to ONE box can never be on a
composition list: the oven refuses it at `docker build`, by name, with `not-carried` (it does not live in
the Forge monorepo) or `not-offered` (a release does not hand one box's app to another).

So an instance-owned app can declare a screen, install, and fill its slot in the data — and show nothing,
until its owner builds its own front. **The Outlet store therefore has no gate screen**, because the Outlet
deliberately runs the reference vitrine; the coffee store will have one once it forks (slice C1).

This is reported upstream with the measurement. Nothing here works around it.

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
