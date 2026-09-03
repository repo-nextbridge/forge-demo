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
composition.json       WHICH APPS the images compose. An instance's answer, not the product's — and
                       since 02/09 that answer is EVERY app the platform offers (17) plus the two this box
                       wrote, because a demo that ships apps missing hides capabilities that exist. An app
                       the product carries and this box does NOT compose is named in `notComposed` with a
                       reason; `bin/composition.guard.mjs` grades that against the monorepo.
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

bash bin/box-up.sh                           # ← THE ONE COMMAND: a virgin box becomes this bench
```

### What `bin/box-up.sh` does, in order

It is one command to TYPE, not one step. Seven, and each needs what the one before it produced — this is the
map of how the box is born:

| # | step | why it is where it is |
|---|---|---|
| 1 | `postgres` + `redis` | somewhere to put a schema before migrating one |
| 2 | `migrate` | system schema first; "tenants: none registered yet" is correct here, not an error |
| 3 | **`provision-ref` × tenant** | tenant + its FIRST store + FIRST operator + login driver + the admin-host claim |
| 4 | `admin-platform-token` | the ONE box credential that lets one admin container serve both tenants |
| 5 | kernel + edge + fronts | now that there is a tenant for them to serve |
| 6 | **`seed-box.mjs` × tenant** | the remaining stores, the settings every screen inherits, and — for a tenant the mounted dataset is **not** about — its apps, its freight and its checkout flag |
| 7 | **the totem** | last of the six images: it needs the counter store id step 6 resolved |
| 8 | **`seed.mjs` × tenant** | the **curated** data — what a human wrote, and what the assortment publishes |
| 9 | **`seed-demo` × DATASET tenant** | the **massive** catalogue — filled **only** into the tenant the mounted dataset is about (`dataset: true` in `seed/box.json`) |
| 10 | **`seed-history` × tenant** | the **past** — 180 days of it, written **inside the mail silence** |
| 10b | **wait for the dispatcher** | the silence only holds while the queue is behind it |
| 11 | **`seed.mjs --phase window` × tenant** | the shop **window**: promotions, blocks, cache bust, and the **re-arm** |
| 12 | **`verify-seed.mjs` × tenant** | the **verdict** — the box graded on what it *holds*; a tenant that did not settle makes `box-up` exit non-zero |

(Not in the table because they are not steps of the birth: **3b/3c/3d** wire the host → store map, the coffee
fork's edge rule and the admin's brand switcher, each from an id or a file that only exists by then.)

### 2b. Two things that used to be typed by hand, and died at every rebirth

Both were real arrangements on the bench that the next `bash bin/box-up.sh` erased, and neither loss was
loud — which is why they are here rather than in somebody's notes.

**The admin's brand switcher.** `FORGE_ADMIN_SIBLINGS` is the dropdown that carries an operator from one
brand's admin to the other's. It is env, so it was hand-typed and rebirths wiped it — and an unset value
yields an **empty list**, which renders the admin shell *exactly* as it did before the feature existed. It is
now **derived at birth** (step 3d) from `seed/box.json`: one entry per tenant, `settings.tenant_name` for the
name and `admin_host` for the door. Add a third tenant there and it arrives in the dropdown with no second
edit. ⚠️ Switching brands means **logging in again** — each admin is its own host and the session cookie is
host-only. That is the guard that stops an operator acting on one tenant while believing they are on the
other, not a missing feature.

**This box on a tailnet.** The bench is born on `localhost`, deliberately: a birth that depended on somebody's
private network would stop proving the product. When it has to be reachable from a phone or another machine,
that is a **promotion**, and it is one command:

```bash
# in .env — never in a tracked file; both are addresses of your own network
FORGE_TAILNET_HOST=<this machine's MagicDNS name>
FORGE_TAILNET_IP=<its tailnet address>      # optional: the safety net for a device with MagicDNS off

bash bin/box-up.sh --tailnet        # and `--localhost` puts it back
```

It rebuilds the host → store map, re-points `FORGE_PUBLIC_ORIGIN` (**not cosmetic** — the kernel mints every
product-image URL from it, so a box reached over the tailnet with `localhost` here serves a catalogue of
images a phone cannot fetch, and nothing logs an error) and `FORGE_GATE_ADMIN_URL`, re-derives the sibling
list against the new hostname, claims each tenant's admin door **through the port** (`admin-host.js`, the same
two platform commands `provision-ref` drives — never a second write path), and recreates the services that
read all of it at boot. Idempotent and reversible; it touches no store, product or order.

⛔ **It does not run `tailscale`.** Getting the machine onto the network is your gesture; this only wires the
box to the fact that it is. It assumes the same published ports already answer there.

### Step 10 has two halves, the second in a `finally` — and it must run inside the silence

`seed-history` refuses to run when a tenant has **more than one active delivery method** — it will not pick
one at random. That refusal is right, and it is the exact fork where step 9 once chose *silently* by
`order by id limit 1`: in `forgecafe` the oldest id was the totem wave's pickup counter, so the seeder picked
PICKUP, wrote a delivery address, never set a pickup location, and the kernel refused every order. **Same
data, same junction, two opposite behaviours — one guessed and was wrong for an afternoon, one stops and
names the ambiguity.**

⛔ **And it runs BETWEEN 8 and 11, which is a mailbox and not a preference.** `seed/commerce.mjs`
silences the buyer's order mail in the curated phase and re-arms it in the window, and its own comment
names this script: *the decision to send is taken at EMIT, so silencing late is silencing nothing.* This
box speaks real SMTP and `customers.json` holds one real address. A past seeded after the re-arm mails a
person. The step therefore **refuses to start** unless every buyer `order.*` channel is off — measured
at both ends: it passes on a silent box and refuses on a box with one type armed, naming the store and
the type. (The read parameter is `store`, not `store_id`; the kernel ignores the wrong one silently and
answers with tenant defaults, which a bogus-id comparison is what exposes.)

⚠️ **And silence→seed→re-arm has a scale limit, which this step found.** Dispatch is asynchronous. On the
first birth that ran the past, step 11 re-armed while the dispatcher was still draining ~1,466 orders, and
the tail went out through the door that had just opened — 88 messages attempted. They failed only because
every dataset address is `@example.com` and the provider answered `550 Invalid "to" field`. **The fix is
the wait, not the luck of an undeliverable domain.** Step 10b blocks until the queue is quiet for 30s
(derived: the dispatcher's longest observed gap is 2.1s and `attempts = 1`, so there is no retry backoff to
outlast) and **dies rather than continues** — a mute box is one command from fixed; a mailed person is not.

So the box does not satisfy the seeder by shrinking: two delivery options is something the demo *wants* to
show. The refusal is about the **moment** the script runs, not the box's final state, so step 11 changes the
moment — **silence** the extra method, **seed** the past, **re-arm** it — the same pattern the curated seed
already uses for notification channels. The re-arm is on an `EXIT INT TERM` trap rather than the happy path,
because a box left with one delivery method by a step that died halfway is a defect nobody would ever trace
back to a seed. It was proven on the path that matters: a run where `seed-history` **failed** mid-way still
ended with the tenant's methods exactly as it found them.

⚠️ **`seed-history` is reset+seed, and its skip is a green.** If the tenant already holds one order older
than half the window (90 of the 180 days), it prints `SKIPPING`, writes nothing, and **exits 0** with
`"skipped": true`. A step that trusted the exit code would report a past this box does not have. Step 10
therefore reads the **summary**, not the status — the same discipline the credential check above applies, one
layer down. There is no `--force`; the only remedy the history offers is to wipe the tenant and run it again.

⚠️ **8 → 9 → 10 is one direction, not a cycle** — it only reads as circular if 8 and 10 are taken for one
step. The window seeds the dataset's promotions and resolves each target through the **public** read (the
only one that answers *"is this on sale in this store?"*, and a promotion on something nobody can buy never
fires), so its targets are **massive** products and it must follow 9. Step 9 publishes an assortment naming
**curated** handles, so it must follow 8. They are three moments because the massive is another **process** —
the one-shot inside the container — not a line in the curated script.

Until the sports catalogue retired from the curated seed, that script created the 2,790 itself moments before
the window ran. **The crutch was hiding the dependency; removing it did not create one.** The revalidate
lands in step 10, at the end, which is where a cache bust belongs: it invalidates a store that is finished
rather than one with a step still to come.

⚠️ **Step 8 must precede step 9, and that order is forced rather than chosen.** The boundary is
CURATED × MASSIVE: `bin/seed.mjs` owns what a human wrote (the six coffees, the counter's menu, the outlet's
assortment) while the dataset owns the generated volume **and the assortment** — and an assortment *publishes* a
handle it did not define. Run the one-shot first and the publish step has nothing to point at:

```
populate refused (unknown_product): store "cafe" declares product "forge-alvorada" in its assortment,
and no such product exists — neither in this dataset nor in this tenant.
```

Both run **per tenant, each with its own token**. The shoe tenant happens to survive without the curated
step — its assortment selects by category rather than by handle — but the outlet's products are curated by
handle, so skipping it there leaves that store quietly different from what the demo expects.

⚠️ **Step 8 raises the action ceiling, and only on its own invocation.** The kernel caps app code at
`DEFAULT_ACTION_TIMEOUT_MS` = 5 minutes. That cap is a **liveness guard for whoever calls** — it exists so an
operator who fires an action is not left with a spinner forever. A bulk import one-shot is not an interactive
action: nobody is watching a screen, and the process exists in order to finish. So `bin/box-up.sh` passes
`FORGE_EXTENSION_ACTION_TIMEOUT_MS` on that `docker compose run` alone (30 min, override with
`FORGE_SEED_ACTION_TIMEOUT_MS`) and **the standing kernel keeps the 5-minute default**.

The number is derived: a run that hit the cap had written 1,287 of 2,790 products in 300s, so the full
catalogue needs ~650s. Thirty minutes is nearly 3x that, with head-room for the first run's media hydration.

⚠️ **If it is exceeded anyway, a plain re-run does not help.** The timeout does not *cancel* the action — the
caller stops waiting, the writer keeps writing — and the entrypoint then closes its pool underneath that
writer. What comes out is a **half-written catalogue** and an error naming the pool rather than the ceiling.
What changes the outcome is the ceiling, not the repetition.

⚠️ **This box is SIX images, not four.** Four are pinned by digest in `forge.lock` — kernel, storefront,
checkout, admin. **Two are built here** and carry this repository's own front code:
`forge-demo-storefront-coffee:local` (the coffee shop's forked vitrine) and `forge-demo-totem:local` (the
counter). A box that starts only the four pinned ones comes up **green and missing exactly the two screens
this demo exists to show**, which is why `bin/box-up.sh` names them.

**Steps 3, 6, 8, 10 and 11 each run once per tenant, and that is the shape rather than a workaround.**
`provision-ref` and `seed-demo` both read `referenceOptionsFromEnv()` — one tenant, one store, from the
environment — and a credential belongs to one tenant, which the write face enforces with a `403`. Widening
either entrypoint to take N tenants would move a boundary the kernel exists to hold into a script.

### ⛔ Step 9 is the one that does **not** run per tenant, and the difference cost this bench a whole shop

A box mounts **one** example dataset, and a dataset is a **brand's** — this one is the footwear catalogue.
`dist/seed-demo.js` fills the tenant it is *pointed at*, from whatever is mounted. Step 9 used to loop over
every tenant, so on the bench of **02/09** the coffee tenant held **2 811 products** (its own 21 plus the
dataset's 2 790), **44 490 SKUs**, 351 brands nobody sells, a category tree of `botas/sandalias/sapatos/tenis`
and the eleven footwear custom fields in the form of every café. The footwear products were *unpublished* in
both coffee stores, so the vitrine was spotless — the dirt was in the tenant's **data** and on the merchant's
**screens**, which is why no check caught it.

**The kernel was innocent, and establishing that decided where the repair went.** The same handles carry
**different** product ids in the two schemas (`adidas-golf-braided-stretch-belt` is `prod_01M1FRFC9D…` in
`forgeco` at 00:32:03 and `prod_01M1FS95MQ…` in `forgecafe` at 00:46:08): two independent, correctly-scoped
writes, not one crossing a boundary. The entrypoint filled exactly the tenant the loop named. **The loop was
the defect**, so the fix is here and not in the monorepo.

So `seed/box.json` now declares **`dataset`** per tenant, and step 9 reads that. ⚠️ **Skipping it is not
free:** `seed-demo.js` fuses two jobs — fill the store from the dataset, *and* provision the tenant (apps,
freight, checkout flags). Only the first is the dataset's, so a `dataset: false` tenant declares `apps` and
`delivery` in `seed/box.json` and **step 6** applies them. A `dataset: true` tenant must **not** declare them:
`populate` is idempotent by its own app ledger and cannot see a method a script wrote, so two owners means a
second *"Entrega Padrão"* — and **step 10 refuses a tenant with two active delivery methods**.
`bin/seed-box.mjs` refuses that arrangement before writing anything.

**The mirror had the same shape and a different author.** `bin/seed.mjs` declared the nine coffee words
(`torra`, `fazenda`, `produtor`, `sca`, …) on whatever tenant it was pointed at, so every shoe in the footwear
shop offered a roast. The registry names each author in its `source` column — `merchant` for those nine,
`app:demo-data` for the dataset's eleven — and that is what proved both halves belong to this repository. The
coffee vocabulary now lives in `seed/catalog.json`, behind the same gate the six coffees are.

`bin/tenant-isolation.guard.mjs` grades all of it by **effect**: the tenants the real shell derivation selects,
the commands that leave the door, and the lines `verify-seed` prints when it is shown the 02/09 bench.

**No token is ever printed.** Steps 3 and 4 each emit a secret exactly once; the script captures them straight
into `.secrets` through a temp file it shreds, and reports only `filed`.

**It converges.** Re-running is the supported way to repair a half-built box: migrate is a no-op,
`provision-ref` returns the same store id, the box seeder creates nothing, `seed-demo` is idempotent.

### ⚠️ A container path may never reach a host process

`bin/box-up.sh` runs some steps **inside** the kernel (`docker compose run`) and some **on this machine**
(`node bin/seed.mjs`). It sources `.env` for both, so a host process inherits every variable — including the
ones whose values are only true inside a container:

| variable | true for | false for |
|---|---|---|
| `FORGE_SEED_DATASET_DIR=/app/seed-dataset` | the kernel | anything on this machine |
| `FORGE_SEED_PHOTOS_DIR=/data/seed-photos` | the kernel | anything on this machine (it is a **named volume** — there is no honest host path at all) |

**The rule: a variable whose value is a CONTAINER path is never handed to a host process.** The
`..._DIR` / `..._HOST_DIR` pair exists for exactly this — but the two names are far too similar to trust
anyone's attention with. This cost two failed births in one evening: first
`FORGE_SEED_DATASET_DIR=/app/seed-dataset does not exist`, then
`ENOENT: /data/seed-photos/…/cover.jpg` — each naming a path that genuinely exists, three metres away, inside
a container.

**So it is enforced rather than remembered.** Host steps go through `host_node`, which replaces each known
container path with its host counterpart and then **refuses to launch** if any `FORGE_*` variable still holds
a value under `/app` or `/data`, naming every offender. The replacement list covers what we know; the refusal
covers what we do not — a variable of that shape added next month is caught on its first run.

### Tearing it down to be born again

```bash
bash bin/box-down.sh          # state dies, the photo cache lives
bash bin/box-down.sh --all    # everything, cache included (re-pulls 3.6 GB)
```

⚠️ **Do not use `docker compose down -v` for this.** One flag takes everything, and it does not distinguish
the two kinds of thing this box holds:

| | what it is | in a birth proof |
|---|---|---|
| `pgdata`, `redisdata`, `media`, `caddy_*` | **state** — what the box DERIVED | **destroy it**, or nothing is being born |
| `seed_photos` | **cache** — 3.6 GB FETCHED from a bucket, re-fetchable | **keep it**; destroying proves nothing and costs ~40 min |

The claim a birth proof makes is *"the box is born from nothing"* — not *"the network is re-read from
nothing"*. `bin/box-down.sh` makes the cheap, correct thing the default and puts the expensive one behind a
flag, because a habit beats a paragraph: this distinction was explained, written down, and then violated by
hand one minute later.

### The seed dataset — pointed at, never copied

Step 7 fills the stores from a dataset that lives in the **monorepo** (`instances/demo/dataset`). This box
points at it by path:

| variable | what it is |
|---|---|
| `FORGE_SEED_DATASET_HOST_DIR` | where the dataset is on this machine — what compose mounts |
| `FORGE_SEED_DATASET_DIR` | where the kernel reads it (`/app/seed-dataset`). **Unset → `seed-demo` answers "nothing to seed"**, which is the correct state for a box that wants no example data |
| `FORGE_SEED_PHOTOS_DIR` | where the photographs are hydrated to (`/data/seed-photos`, a named volume) |

**It is pointed at rather than copied** because it is 40 MB of JSON naming 3.6 GB of photographs — a
generator's output, and copying it here would put it where a human edits.

⚠️ **The dataset mount is READ-ONLY and the photos go somewhere else, and that pairing is the point.** The
seed WRITES as it hydrates, and what it writes is the photo tree. Mounting the dataset read-write would land
gigabytes inside a git worktree somebody else is working in. `FORGE_SEED_PHOTOS_DIR` exists for exactly this
("a VM whose container layer cannot hold the gigabytes points it at a big-disk mount"), and it is what lets
the dataset stay read-only. The volume is named, so a re-seed skips what is already on disk.

**The photographs are pulled at runtime** from the bucket the dataset's pointer names — measured reachable
from the host and from inside the kernel container. ⚠️ Note that the pointer carries **two versions**, the
catalog's and the photos', **and they use different URL shapes** (`<base>/dataset/<catalog version>/<rel>`
against `<base>/<photos version>/<rel>`). Probing one with the other's shape answers 404 and looks exactly
like an empty bucket.

If a pull cannot complete, the seed **refuses**: *"Refusing to seed a partial dataset"*, naming what is
missing. It does not fill a catalogue with broken images.

### The bench's addresses

| face | address | serves |
|---|---|---|
| shop (all storefronts + checkout) | `http://localhost:8200` | every store, at `/s/<store id>` until a host claims one |
| **admin · T1** | `http://localhost:8201` | tenant `forgeco` |
| **admin · T2** | `http://localhost:8202` | tenant `forgecafe` |
| totem (the counter) | `http://localhost:8203` | store `balcao` |
| https (edge) | `8243` | |

### ★ Two tenants, four stores, ONE admin container

| tenant | stores | theme |
|---|---|---|
| `forgeco` | `forge` (bootstrap) · `outlet` | — · `outlet` |
| `forgecafe` | `cafe` (bootstrap) · `balcao` | `coffee-store` · — |

**A second tenant does NOT need a second admin.** With `FORGE_ADMIN_TENANT` **empty** the admin runs in HOST
mode: it asks the kernel which tenant the request's `Host` belongs to (`read.admin.by_host`) and mints a
1-hour login-driver for it from `FORGE_ADMIN_PLATFORM_TOKEN`. That lookup keys on **`host:port` first** and
the bare host second — which is why the two admins above differ only by port, and why `:81` and `:83` in
`caddy/Caddyfile.local` both proxy the same container. The map is DATA, claimed at bootstrap:

```bash
curl -s 'http://localhost:8200/v1/read/admin.by_host?host=localhost:8201'   # {"tenant_id":"forgeco"}
curl -s 'http://localhost:8200/v1/read/admin.by_host?host=localhost:8202'   # {"tenant_id":"forgecafe"}
```

⚠️ **Each tenant has its OWN seed credential.** `.secrets` carries `forge-seed-token` (forgeco) and
`forge-seed-token-forgecafe`; `env-source.sh` exports both. A token pointed at the other tenant is refused —
and `bin/seed-box.mjs` asks `whoami` first so the refusal names the real cause instead of guessing.

Then:

```bash
curl -fsS http://localhost:8200/health
bash bin/verify-composition.sh        # does the running image compose the apps this lock pins?
bash bin/test.sh                      # this repo's guards
```

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
node bin/seed.mjs --api http://localhost:8200 --tenant forgeco
node bin/seed.mjs --api http://localhost:8200 --tenant forgecafe   # with THAT tenant's credential
```

⚠️ **TWO TENANTS, TWO RUNS, TWO CREDENTIALS.** This demo is `forgeco` (the shoe brand: `forge` + `outlet`) and
`forgecafe` (the coffee shop: `cafe` + `balcao`) — a shoe brand and a coffee shop are not one company. Each
run fills only the stores of its own tenant and says, in a line, which ones it skipped. The box keeps one
credential per tenant (`forge-seed-token` and `forge-seed-token-forgecafe`); export the right one before each
run.

⚠️⚠️ **AND THE INTERNAL READ FACE IGNORES `x-forge-tenant`** — it resolves the tenant from the CREDENTIAL,
while only the WRITE face honours the header. Measured on this bench: a `forgeco` token asking for
`forgecafe`'s stores answers **HTTP 200 with the `forgeco` stores**; the same token WRITING into `forgecafe`
is refused **403**. Since every "does this already exist?" in the seed is a READ, the wrong credential would
make the script decide "already there, nothing to do" about a tenant it has never seen, and exit 0 having
written nothing. `bin/seed.mjs` therefore proves the credential before its first write, by asking it which
stores it can SEE — an answer the wrong token cannot fake.

### THREE MOMENTS, in this order — and the order is not taste

```bash
node bin/seed.mjs --api … --tenant forgeco                    # 1. the CURATED half
docker compose run --rm kernel node dist/seed-demo.js --confirm  # 2. the MASSIVE half (one-shot, inside)
node bin/seed.mjs --api … --tenant forgeco --phase window      # 3. the shop WINDOW
```

⚠️ **There is a dependency in each direction, and it only became visible when the massive half moved out of
this script.** The window seeds the dataset's PROMOTIONS, and each one resolves its target by handle through
the PUBLIC face — the only face that answers "is this on sale in THIS store?". Those targets are handles of
the massive catalogue, so **the window needs the massive**. And the massive publishes curated handles it does
not define, so **the massive needs the curated**. Three moments, one direction, no circle.

This script used to create the 2 790 itself, a few lines above the window, so the window always found its
targets — the crutch hid the dependency. Removing it did not create one.

### The two halves of the seed, and the order between them

**This script owns the CURATED half** — what a human wrote: the six coffees with their descriptions, the
counter's menu, the outlet's assortment, and the curated promotions (the counter's coupon, the morning combo, the
subscriber discount). It is the identity of this demo.

**The dataset and `demo-data`'s `populate` own the MASSIVE half** — what a generator produced: the 2 790
products and which shop sells what. That runs as a one-shot INSIDE the box:

```bash
docker compose run --rm kernel node dist/seed-demo.js --confirm    # once, for the DATASET tenant
```

⛔ **Once — for the tenant the dataset is about, not once per tenant.** It fills whatever tenant
`FORGE_REF_TENANT` names, from whatever dataset is mounted, so pointing it at a second brand's tenant puts one
brand's catalogue in another's. `bin/box-up.sh` reads `dataset` from `seed/box.json` to decide; running this
by hand, you are the one deciding.

⚠️ **ORDER: this script FIRST, the one-shot after.** `populate` PUBLISHES the curated handles it does not
define, so they have to exist before it runs. Inverted, the publication fails out loud naming the handle and
the shop — the right behaviour, and still a morning lost to wondering why.

⚠️ **The one-shot needs the dataset MOUNTED** (`FORGE_SEED_DATASET_DIR`, and `FORGE_SEED_DATASET_HOST_DIR` for
the bind). Without it, it writes one line saying no dataset is mounted and does nothing — which is why the
`forge` store comes up empty on a box that has not wired it.

### Proving what the seed left behind

```bash
FORGE_SEED_TOKEN=… node bin/verify-seed.mjs --api http://localhost:8200 --tenant forgeco
FORGE_SEED_TOKEN=… node bin/verify-seed.mjs --api http://localhost:8200 --tenant forgecafe
```

One tenant per run, like the seed, and for the same reason. **`bin/box-up.sh` runs it as step 12**, so the
birth itself is graded rather than merely finished. It prints the four shops against what the seed DECLARES
(never a bare count), **the negative** — no free-shipping promotion and no freight born for the counter —
**whose catalogue and whose words** the tenant is holding, the four cuts of the stock screen with a count in
each, and the placeholder art in the Asset Library.

⚠️ **The catalogue check reads `products_admin`, not the shop window, and that is the point.** The footwear
products that reached the coffee tenant on 02/09 were *unpublished*, so every count taken through the public
face was correct and the tenant was still wrong. `products_admin` answers for the whole tenant, drafts
included. The vocabulary check reads the registry's own `source` column, so it names the **author** of a
crossed field — `app:demo-data` (the dataset's, arriving with the install) or `merchant` (a seed's) — instead
of matching a list of names that would rot.

⚠️ **It refuses rather than reporting a half-filled box.** No credential, an unreachable box, a token whose
tenant is not the one asked for, a store the public face cannot resolve yet, a shop with fewer products than
declared — each is a non-zero exit and a named line, never a number that reads like a result. Exit 0 means
everything it checked is settled.

### The placeholder art

A window slot with no picture renders wrong, and the wrongness does not show up in a seed log. So
`node bin/make-placeholders.mjs` generates one — flat colour, and the slot, the store and the dimension
written **inside the image** (`home.hero · cafe · 1504x560`), at the size measured from the art that already
serves that slot. They are deterministic (same slot, same bytes, so a re-run uploads nothing) and they are
obviously not final.

**To curate them:** they are all named `placeholder-…`, so the whole set is one search for `placeholder-` in
the admin's Asset Library, or `read.internal.assets` filtered by the same prefix. Replace them one at a time.
The generator never draws over art that already exists, and it makes none for the counter — a totem is four
bands and no hero.

That creates the stores, declares the `cf.*` vocabulary and creates the six coffees **with their photos**,
all through the door: the script holds an API key, never a database credential, exactly like an ERP would.
It is idempotent — re-running it is a no-op.

The same run stands the **Outlet** up (`seed/outlet.mjs`, its data in `seed/outlet.json`): it installs the
two apps that store composes with, uploads its photographs and campaign art, publishes the products
`outlet.json` names with their prices and their stock, pins the three collections its shelves are sourced
from, and places the six Compose blocks that are its home page. Not one line of front-end code — a theme,
data, and a composition.

⚠️ **Five of those six are in ONE slot.** The reference home draws its sections in a fixed order and the two
headings this store keeps — «Compre por categoria» and «Marcas que amamos» — are theme chrome, not slots, with
exactly one slot between them (`home.below_categories`). So the mosaic, the two shelves, the «Outlet Kids»
banner and the «Outlet Kids» shelf are `position` 0..4 inside it, and `home.hero` / `home.banner_strip` / `home.below_shelf` /
`home.below_brands` and the whole PLP are **empty on purpose** — see `seed/outlet.json`'s `_home_why`. That
also makes `compose()` the one step in this seed that **removes**: it governs those slots rather than
appending to them, because a box that ran the previous version has the old page in the old slots and appending
would draw both.

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

The coffee store and the outlet carry their content here (`seed/catalog.json`, `seed/outlet.json`): a few
dozen products, small enough to read in a diff. The **`forge`** store — the sports shop the box serves at its
root — does not. Its catalogue is the **platform's example dataset**: 33 categories, 351 brands, 2 790
products, 44 427 SKUs and 18 582 photographs. It arrives by **path**, and the path is configuration:

```bash
source ./env-source.sh
FORGE_SEED_DATASET_DIR=<path to the forge monorepo>/instances/demo/dataset \
  node bin/seed.mjs --api http://localhost:8200
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
  curl -X POST "http://localhost:8200/api/revalidate?tag=extensions:<store id>&tag=store:<store id>" \
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
7. **Check the order in the admin** (`:8202` — the counter belongs to tenant `forgecafe`), in the counter's store: the buyer's name is the one that was
   typed, and the items are the ones that were chosen.
8. **Now walk away and count.** After `FORGE_TOTEM_IDLE_SECONDS` the screen returns to "Toque para começar"
   **and the bag is empty** — the cart pointer is destroyed on the server, so the next customer starts clean.
   That is the whole difference between a till and a web page, and it is worth testing on purpose. Twenty
   seconds before the end it asks "Você ainda está aí?", and any touch buys the whole window again.
   ⚠️ **Walk away from the PIX QR instead and it must NOT reset**, and that is the other half of the same
   test: by then the order exists in the kernel, and the QR on the glass is the only copy of what can settle
   it. The inactivity clock stops there and the pix's own 15-minute window runs in its place — because
   standing still while paying in the bank app is not the same fact as walking away.
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
