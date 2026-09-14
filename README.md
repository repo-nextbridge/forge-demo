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
apps/                  the apps THIS box wrote: `demo-gate` (§4), `demo-setup` (§4b) and `payment-pos` (§4c).
                       Composed into the images.
extensions/            the FORGE_EXTENSIONS_DIR mount, for an app of ACTIONS ONLY. Empty since the gate became
                       composed (§4); `bin/pack-apps.sh` still produces this form for one that needs it.
themes/                the store themes (`theme_key` on a store names one). `outlet` and `coffee-store` arrive with D2 and C2.
seed/                  the birth data: the stores, the coffee and counter catalogues, the photos — and the
                       STOCK POOL (`catalog.json` → `stock_pool`), products this brand owns that no store
                       sells. They look like an oversight and are the opposite: step 10 builds the stock
                       screen's three alert states by ZEROING them, and refuses a pool under 13.
docs/capabilities/     what this box can DO that it could not before, one page each.
docs/operations/       how this box is OPERATED. `runbook-demo.md` is the online instance's runbook — the
                       deploy order, what to fill in, the weekly reset. This README is the BENCH; that is
                       the box anyone can reach.
bin/                   build-local · build-coffee · build-totem · revendor-forks · pack-apps ·
                       images-from-lock · verify-composition · seed
caddy/                 Caddyfile (the real edge) and Caddyfile.local (the bench edge), plus ONE extension
                       folder per edge — `extra/` (site blocks, read by Caddyfile) and `extra-local/`
                       (fragments, read by Caddyfile.local). Sharing one folder killed the production
                       edge once: `*.caddy` matches `coffee.local.caddy`. See caddy/extra-local/README.md.
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
bash bin/revendor-forks.sh ~/path/to/forge  # the Forge packages the two forks install, from THAT tree
bash bin/build-coffee.sh ~/path/to/forge    # the FORKED vitrine — this repo's own front, built not pinned
bash bin/build-totem.sh  ~/path/to/forge    # the counter's kiosk — same shape, same reason

bash bin/box-up.sh                           # ← THE ONE COMMAND: a virgin box becomes this bench
```

⚠️ **`bin/revendor-forks.sh` is there because a kit change used to cost four gestures composed by hand.**
The two fork bakes each vendor and install their OWN fork, so a bake is never stale — but a kit change that
lands while nobody is baking leaves two COMMITTED lockfiles describing a different commit of the product than
the one this box pins, and then `npm ci` in a pipeline fails `EINTEGRITY` naming a base64 digest and no
cause. This is the one step that puts every fork back in step with one checkout; it derives the forks
(`bin/forks.mjs`, never a typed list), it rewrites `package-lock.json`, and it says which locks moved so they
can be committed. `bash bin/revendor-forks.sh <tree> --check` writes nothing and is the shape a CI gate
wants. `bin/vendor-drift.guard.mjs` is the rule underneath both.

⚠️ **And `build-totem.sh` was missing from this list.** It is the fifth of five bake gestures, documented in
"Bringing the counter up" below and nowhere in the sequence anybody follows.

⚠️ **Every `docker build` above has a ceiling and a conscience.** On 2026-09-07 Docker Hub answered **500**
to the HEAD request for the base image these four Dockerfiles pull, while this box was baking: the admin
image did not rebuild,
`bin/build-local.sh` refused to write the lock — correctly, the provenance is read back OUT of the image and
compared — and a human ran `docker pull` and repeated the command. In a pipeline that minute is a red build
with no cause of its own, and the habit it teaches is worse than the outage. `bin/docker-retry.sh` repeats
it, at most three times, with 5 s and 20 s between; it says every repeat out loud with the reason, because a
silent retry hides a sick registry.

**It is not `|| true`.** `bin/registry-transient.mjs` decides, and its rule is structural rather than a
contest between error strings: a failure INSIDE a build step is never repeated (that is how a one-in-three
defect becomes a green), a registry ANSWERING — a tag that does not exist, `unauthorized`, an unknown
manifest — is never repeated, and a failure it does not recognise is not repeated either. Only transport and
registry-side illness (5xx, 429, TLS/timeout/reset/EOF/DNS) buys an attempt, and the fixtures it is tested
against are buildkit output measured on a bench, not remembered.

### ⚠️ The host's Node — checked first, and it will refuse you

Half of the birth runs **on your machine**, not in a container: `seed-box.mjs`, `seed.mjs`,
`verify-seed.mjs` and `dataset-provenance.mjs` are host processes. So the `node` your shell resolves is a real
input of the install, exactly like `.env` is — and every script here that starts one refuses to begin on a
node older than the Forge kernel supports, naming **the version it found, the path it came from and the
floor**, before it reads a file, starts a container or writes a secret.

**This is a refusal and not a warning because the old node WORKED.** On the bench that produced it, two nodes
were installed and the interactive `PATH` resolved to the smaller one; every birth of 2026-09-03 ran under the
floor and finished green. *It ran* is not *it is supported*, and nothing on the box could tell them apart.

```
[node] refusing to start: the node on this PATH is older than the Forge kernel supports.
       found     v22.22.3
       from      /home/you/.local/bin/node
       required  node major >= …  (/path/to/forge.lock: node.minMajor)
```

⚠️ **AND `jq` MISSING IS A REFUSAL ABOUT `jq`, not about your node.** The floor lives inside `forge.lock`,
which is JSON, so a machine without `jq` cannot be graded at all — and the check stops there, before
`box-up.sh` ever reaches its own `jq is required`. It says so under its own tag, and it names the node it
found precisely so you do not go and install a different one:

```
[jq] refusing to start: `jq` is not installed, and this box cannot read its own pin without it.
     missing   jq   <- install THIS; it is the only thing wrong here
     node      v24.18.0  (/home/you/.nvm/versions/node/v24.18.0/bin/node)
               ^ found, and NOT what refused you: the floor was never graded, this stopped first
```

⚠️ **A cron or a systemd unit has no node at all.** `env -i` with a minimal `PATH` finds neither `node` nor
`pnpm`; only the nvm directory holds the compatible pair. The scheduled reset of this box runs in exactly that
environment, so give the unit that directory before it runs any of this.

**The number is not this repository's.** It travels in `forge.lock`, the file this box pins the product with,
as `node.minMajor` — the floor already resolved to a whole major, because everything that acts on it is a shell
— next to `node.engines`, the range it was resolved from. `bin/require-node.sh` **reads** it and states nothing
of its own; `bin/build-local.sh`, the one script here that is handed the monorepo, **stamps** it, through the
product's own derivation (`infra/cicd/node-floor.sh`). Raising the floor is a release, not an edit here.

⚠️ **A lock that states no floor is still a valid pin.** The field was added to an artifact that had already
left the product's hands, and the lifecycle is forward-only, so a lock stamped by an older release simply does
not answer the question. This box then says so and refuses nothing on account of it — it has no floor to check
and will not invent one. Re-stamp the pin to get the check back.

`bin/node-floor.guard.mjs` proves all of it by RUNNING the check: the same fake `node` against two locks with
different floors, in both directions; a lock with no floor letting an ancient node through while saying so; a
floor the lock states but a shell cannot grade being refused rather than rounded; and no tracked file here
declaring a floor of its own.

### What `bin/box-up.sh` does, in order

It is one command to TYPE, not one step. Fifteen, and each needs what the one before it produced — this is
the map of how the box is born:

```bash
bash bin/box-up.sh                     # the birth, on localhost
bash bin/box-up.sh --no-warm           # the same birth WITHOUT step 14 (a cron warms later)
bash bin/box-up.sh --plan [--no-warm]  # print the roteiro this invocation would run, and do nothing
```

★ **The run says which steps it RAN and which it SKIPPED, with the reason** — `BIRTH_STEPS` declares them,
each step's own `say` stamps itself as it happens, and `bin/roteiro.mjs` prints and grades the ledger at the
end. ⛔ **A step that neither ran nor was declared skipped makes the birth exit non-zero**: a summary that
omits a step is how a birth quietly stops doing something and nobody notices. `bin/birth-roteiro.guard.mjs`
proves all of it — including that `--no-warm` drops step 14 and **not** 14-bis, because warmth is a report
and whether every shop can be signed in to is not.

| # | step | why it is where it is |
|---|---|---|
| 1 | `postgres` + `redis` | somewhere to put a schema before migrating one |
| 2 | `migrate` | system schema first; "tenants: none registered yet" is correct here, not an error |
| 3 | **`provision-ref` × tenant** | tenant + its FIRST store + FIRST operator + login driver + the admin-host claim |
| 4 | `admin-platform-token` | the ONE box credential that lets one admin container serve both tenants |
| 5 | kernel + edge + fronts | now that there is a tenant for them to serve |
| 6 | **`seed-box.mjs` × tenant** | the remaining stores, the settings every screen inherits, and — for a tenant the mounted dataset is **not** about — its apps, its freight and its checkout flag |
| 6b | **`store-host.mjs` × tenant** | the **root store claims this box's address** in the kernel's directory (`tenant.store.update` → `host`), so `read.store.by_host` answers it. Without it the fronts route through their `FORGE_STORE_HOSTS` override and every consumer that asks the PORT — the warmer's address space first — is wrong while the shop looks perfect |
| 7 | **the totem** | last of the six images: it needs the counter store id step 6 resolved |
| 8 | **`seed.mjs` × tenant** | the **curated** data — what a human wrote, and what the assortment publishes, ending with the **cache bust** over every store the port lists |
| 9 | **`seed-demo` × DATASET tenant** | the **massive** catalogue — filled **only** into the tenant the mounted dataset is about (`dataset: true` in `seed/box.json`) |
| 10 | **`seed-history` × tenant** | the **past** — 180 days of it, written **inside the mail silence** |
| 10b | **wait for the dispatcher** | the silence only holds while the queue is behind it |
| 11 | **`seed.mjs --phase window` × tenant** | the shop **window**: promotions, blocks, the **admin home's widget order**, the **re-arm**, and the **cache bust** last — over every store the port lists, not just the sports shop |
| 12 | **`verify-seed.mjs` × tenant** | the **verdict over the DATA** — the box graded on what it *holds*; a tenant that did not settle makes `box-up` exit non-zero |
| 13 | **`online-only.mjs`** | the edge and the bucket: **what only exists online**, run **after** the rebirth — see below for why "after" is the whole decision |
| 14 | **`warm-box.mjs` × tenant** | every store the **port** says has a public page (`storefront_enabled`), warmed and **measured** — and **reported**: warmth does **not** make `box-up` exit non-zero (see below). A store this repository **declares** and the box does not hold still does |
| 15 | **`verify-config.mjs`** | the **verdict over the CONFIGURATION** — the box graded on what it *is*. This is the one a rebirth eats |

(Not in the table because they are not steps of the birth: **3b/3c/3d** wire the host → store map, the coffee
fork's edge rule and the admin's brand switcher, each from an id or a file that only exists by then. **3c
writes two things from the one id it resolves**: the edge rule (into `caddy/extra-local/`, never `caddy/extra/`
— see below) AND `FORGE_COFFEE_STORE_ID` in `.env`, which is what tells the café's own vitrine **which shop it
is** — the store its clean addresses serve and whose institutional pages it renders. The id cannot be typed
into either, for the same reason, and `bin/coffee-store-id.guard.mjs` grades all four legs of it.)

### ★★ 13–15 are the reset's own tail: reborn → purge → warm → grade

Renan, 04/09, on what a reset has to guarantee: *"no fim dele … sobe tudo novamente"*, and *"ele precisaria
também garantir que ligue tudo que só tem online, exemplo cdn se tiver na demo… ou qualquer coisa assim que
morre no reset."*

**Warming is part of DONE, not a courtesy**, and the argument is commercial: *"ele também vai ser testado por
exemplo performance e tal, se ele falhar em um teste de performance é prejudicial ao meu comercial"*. A box
handed over cold makes the **first visitor** pay for every cache this box could have filled by itself in the
minutes nobody was watching — and here that visitor may be whoever is evaluating it. Step 14 drives
`POST /api/warm`, which the **vitrine itself publishes** (guarded by `FORGE_REVALIDATE_SECRET`, the secret the
admin already uses to invalidate). One call warms three containers, because the run fetches
`$FORGE_PUBLIC_ORIGIN/…` and caddy routes each URL to whichever front owns it — the café's fork included.

### ★★ Step 14 REPORTS; it stopped grading — and that was the point

Renan, 05/09: *"D1 - Pode ser só relatório"*. Three measurements, all from real births of this box:

1. **Red by construction** — ★ **and this one was repaired in pk21**, see below. The plan is not made of
   pages: ~420 pages plus ~20 400 **image derivatives** discovered in each HTML's `srcset` —
   `planned=20822`, `warmed=4964`, `15865 urls were never visited`. What cut it was the **vitrine's** own
   *default* (`DEFAULT_MAX_DURATION_MS = 15 * 60_000`, in the product — **removed in pk35/p1**). ⚠️ Not the
   same number as this box's `--deadline-ms`, which is only how long it waits for an answer. **Every** run
   ended this way.
2. **And it invented red.** `failed=198` and `failed=189` on two births — and the same brands and collections
   answered **200** on the idle box, with this same step reporting **`failed=0`**. Those are the load the
   warmer imposes on a box that is still settling: it is the last step of the birth and it races the tail of
   the seed.
3. **And the `p95` it publishes is not the visitor's.** `735 ms` for the coffee shop against **19–29 ms**
   measured with `curl` at the same instant.

★ **A step that is always red is a step people learn to skip** — and then it is worth nothing on the day it is
right. So warmth left the exit conjunction of `bin/box-up.sh`. ⛔ **Nothing was deleted, silenced or
`|| true`d**: the step still runs, and it now says **more** than it used to — every URL that **did not answer**
by name (with the status or timeout it gave), and every URL that was **never visited**, which is a different
fact and a different repair. The old report said `198 of 419 pages did not answer` and named **none** of them,
so nobody reading a birth could check whether the pages were broken or the warmer had overloaded a settling
box. They were the second.

### ⛔ …and the DERIVED ceiling is what cut the birth of 13/09 (pk35)

The section below is **history**, and it is kept because one image still runs it. On 2026-09-13 the derived
number came out **`4 034 947 ms`** and cut the `outlet` at **879/1 224** images, with `failed=0` and
`busy=0` — a box that was **working**, filling its derivative cache at ~330 images/min. A ceiling that grows
with the plan is still a ceiling **carrying a number of SIZE**, which this house forbade on 2026-09-11:
*limit by PROGRESS; the clock is a net, never a judge.*

`pk35/p1` moved the judge into the **product** — a window of **non-progress**
(`apps/storefront/src/lib/warm/limit.ts`), with `max_duration_ms` demoted to an **optional** safety net and a
new `report.stoppedBecause` (`finished` · `no-progress` · `safety-net`) saying which limit fired. ⇒ **Step 14
stopped sending a ceiling.**

⚠️ **With one MEASURED exception, and it is not a hedge.** This box pins its fronts by digest: the storefront
`forge.lock` pins today compiles `max_duration_ms")??9e5` into its warm route and carries the string
`stoppedBecause` **nowhere** (measured on the bench, 2026-09-13). An image that cannot say how it stopped is
an image that **cannot bound itself by progress** — it is on a clock either way, and a derived clock beats its
own 900 000 ms. So the derivation survives **exactly there**, and the report says so out loud. ⛔ The
discriminator is the **field**, never `skipped`: the same plan and the same cut, on a run that publishes
`no-progress`, gets **no ceiling at all**.

★ And `stoppedBecause` has **four** readings, not three: **absent** is *"this run cannot say"* — never
`finished`. It is the same rule the `busy` column already obeys.

### ★★★ The run's ceiling DERIVES FROM THE PLAN (pk21 — see above: superseded except on a pre-p1 image)

Renan, 07/09: *"deriva do plano"*. Measurement 1 above was not a fact about the box, it was a fact about a
**constant**: 20 800 planned URLs against 900 000 ms. ⚠️ And the note that this box "cannot raise" that
ceiling was simply **false** — `/api/warm?max_duration_ms=` overrode the vitrine's default
(`apps/storefront/src/app/api/warm/route.ts`, its `parse` block); the product had always exposed it. What was
missing was a number to send, and the only honest one is derived:

```
ceiling = (urls the run PLANNED + the urls its verify pass revisits) × (ms per url it MEASURED)
```

Both factors come from a run of **this** box: the plan it enumerated from the port, and its wall clock over
the URLs it warmed. So a catalogue twice the size gets a ceiling twice as large with **no edit anywhere** —
which a bigger constant could never do, and that is why none was chosen.

**The plan cannot be known before the run**: the pages come from the port's enumeration and the images come
from the **bytes** those pages serve (each `srcset`). So the **first** run is the *observation* — it runs
under the product's default, which is a first probe rather than a promise — and the **second** runs under the
ceiling derived from what the first one measured. On a box whose plan already fits, the first run is not cut
and **there is no second**. It derives **once** and reports; it does not chase.

📌 **What this does NOT repair, said plainly:** the **false** red of measurement 2. The only effect is
incidental and is not claimed as a fix — the derived re-run is a second visit made later, and the report
printed is the **last** run's, so a URL that failed only because of the birth's tail gets another chance to
answer. A URL that is really broken fails twice.

⛔ **One half of step 14 still fails the birth: a store `seed/box.json` DECLARES and the box does not hold**
(`bin/warm-box.mjs` exits **3**). That is not warmth — it is "the birth did not build it" — and step 14 is the
**only** step that can see it: step 12 grades the stores the **port reports** and step 14-bis opens the doors
of the stores the **port reports**, so a store that was never created is a store neither of them asks about.
`bin/reset-complete.guard.mjs` executes the real exit block and holds both halves in place.

⚠️ **Which stores have a page is the PORT's answer, and a skip is ANNOUNCED.** The same read that lists the
stores (`read.internal.stores`) publishes `storefront_enabled`, derived from each store's `status`, and
`bin/servable.mjs` is the one place that reads it — steps 14 and 14-bis both import it. A store the port says
has **no public page** is skipped **by name, with that reason**; a store simply missing from a report reads
exactly like a store that failed. ★ **`seed/box.json` declares no `servable` flag** (pk21): it used
to mark `balcao` `servable: false` by hand, which was a **second truth** about a store the same answer
already described, with nothing to keep the two in agreement — which is exactly why both steps had had to
learn the counter **by name**.

★★★ **The counter is OFF THE STREET, and that is a decision this box makes through the port** (pk22).
`seed/box.json` declares `status: "private"` on `balcao` — its front is the **totem**, so the reference
vitrine has no business serving it — and `bin/seed-box.mjs` writes it with `tenant.store.create` /
`tenant.store.update` at step 6. Everything else follows with **no list anywhere**: the kernel derives
`storefront_enabled: false` from that word, step 14 does not warm the counter's pages and step 14-bis
demands its `/s/<balcao>` **404**. ⚠️ **`private` is not «off»**: `/s/<balcao>/checkout`,
`/s/<balcao>/account` and `/s/<balcao>/account/login` are the **checkout** deployable and keep answering —
step 14-bis opens all three, by name — the port answers for the store exactly as before, and the totem keeps
selling. Put the counter back on the street with `"status": "active"` in that file; removing the key does
**not** leave it undecided (an undeclared status is «no opinion» and the column keeps `active`).
⛔ **The counter declares no Public URL**, and the measurement is in `_public_url_why` in `seed/box.json`:
`public_url` **is** the `host` column, which the kernel also turns into the order link in transactional
messages — declaring the totem's address there would put an «Acompanhar o pedido» button on every counter
receipt pointing at a route the totem does not serve.

⚠️ **The run SAYS which URLs it warmed, and on this box that is not the shopper's.** One rule decides a
store's addresses and the **port** answers it: does the origin's own host resolve to this store? Yes → clean
URLs (`/tenis`); no → path-scoped (`/s/<id>/tenis`). **Measured 04/09:
`read.store.by_host` answers 404 for every hostname this bench uses** (`localhost`, `localhost:8200`,
`127.0.0.1:8200`, the tailnet name) — the kernel's `store_directory` is empty here because this box resolves
hosts through the **`FORGE_STORE_HOSTS` override**, which `packages/storefront-kit/src/resolve-store.ts`
checks first by design and which the warmer's `storeForOrigin`
(`apps/storefront/src/lib/warm/targets.ts`) cannot see. So every store is warmed **path-scoped**, and the
pages a visitor reaches at the root of this origin are a different set of route-cache entries that the run
did not fill. Step 14 states this in the words of the read that decided it; it is **not** made red, because
the seam is the product's and nobody operating this box can close it. The day a store claims the origin in
the directory, the line turns into the other one by itself.

⚠️ **`warm.threshold_ms` is `null` and that is deliberate.** A latency ceiling nobody measured is an invented
promise, so the run asserts that the pages **warmed** and says out loud that it asserts nothing about **how
fast**. Put a measured number in `seed/box.json` → `warm.threshold_ms` and every birth from then on grades it.

⚠️ **Step 13 runs AFTER the rebirth, and the obvious order is the wrong one.** A CDN purged *before* the
teardown spends the ~17 minutes of the birth refilling itself from the origin being destroyed, and comes out
of the reset holding exactly what the purge was for. Step 14 is what refills it, with the new box's answers.
On this bench both facilities are **no-ops that say so**: caddy caches nothing, and the media is a docker
volume `bin/box-down.sh` destroys by name. **Online a bucket is not a volume** — the rebirth writes ~18 500
objects under fresh keys and last week's stay, paid for and pointed at by nothing.

### ★★★ Step 15, and why the answer is a verdict rather than a list

The obvious way to "turn back on everything that only exists online" is a checklist. **The checklist is the
disease**: it ages in silence, somebody adjusts the live box and forgets to add the item, and the next reset
erases it with nothing saying so. In a list the forgotten item is invisible; in a verdict it is **the answer
that is missing**.

So `bin/verify-config.mjs` derives every check from one rule — **this box publishes itself at ONE address, and
every face it declares must be published there** — and compares each face with what the box **answers**:

| what it grades | derived from |
|---|---|
| the address the box publishes itself at | `FORGE_PUBLIC_ORIGIN`, probed with a `Host:` header through the edge |
| the shop, at every hostname it claims | every key of `FORGE_STORE_HOSTS` |
| one admin door per tenant, on that hostname, **claimed in the directory** | `seed/box.json` × `FORGE_ADMIN_SIBLINGS` × `read.admin.by_host` |
| the link the gate sends an operator to | `FORGE_GATE_ADMIN_URL` × the directory |
| the purge secret | `FORGE_REVALIDATE_SECRET` |
| **any address ON THIS BOX that a promotion would not move** | the `put_env` calls parsed out of `box-up.sh`'s own promotion block |
| what only exists online | `seed/box.json` → `online_only` |

⛔ **The measured defect it exists for.** A promoted box torn down and reborn comes back **half promoted**: the
database dies so the directory holds only `seed/box.json`'s `localhost` doors; step 3d rewrites the sibling
list back to `localhost`; step 3b rewrites the host map and **keeps** `$FORGE_TAILNET_HOST`, so the shop still
answers on the network. The shop opens, the login refuses `unknown_admin_host`, and `box-up` used to exit 0
with one warning line under four hundred. Step 15 names the tenant and the hostname, and the run exits 1.

⚠️ **The host probe is `node:http`, never `fetch`** — undici **silently drops** a `host` header. Measured
against the live bench: `fetch(origin, {headers:{host:'nope.invalid'}})` answered **200** where `node:http`
answered **404**. A fetch-based probe would have graded every hostname as resolving, on every box, for ever.

### ⏱ What a birth COSTS — and it is a number nobody could quote until 2026-09-03

`bash bin/box-up.sh` on a virgin box is a **19 min 17 s** job on this bench, and **it used to be 74**. Both
ends of that are measured, and the 19 is a whole birth that finished with exit 0 (the run of 2026-09-04, with
the defaults) rather than an estimate — the run prints its own numbers now, so nobody has to take this
paragraph's word for it.

⚠️ **This paragraph said "~12 minutes" until 2026-09-04 and that number was never a birth.** It was the
arithmetic of the two measurements below, extrapolated from a run that **died** in the window phase and
therefore never wrote the past, the window or the verdict. Of the real 19 min, **113 s** is waiting on rate
limits — and **102 s of that is 52 calls** through the `ext_public` face, which is the review form.

The difference was not Docker and not Postgres. `bin/seed.mjs` paces itself below
the kernel's rate limits rather than discovering them with 429s, and until this slice it did so with **one**
knob over **every** call. The kernel has three ceilings, not one, and they are 200× apart:

| face | what goes through it | ceiling | seed's pace |
|---|---|---|---|
| credential | `/v1/commands/*`, `/v1/read/internal/*` — everything the catalogue is made of | 6000/60 s (`FORGE_RATE_LIMIT_PER_CREDENTIAL`) | 85/s |
| anonymous | the public reads and the cart/checkout/payment faces | 400/60 s, per store+IP | 6/s |
| ext_public | an app's anonymous create face — the PDP review form | 30/60 s, per IP | 0,5/s |

Two births of the same box, both measured on the night of 2026-09-03:

| pace | result |
|---|---|
| 85/s (the old default) | **~11 min**, then dead: `HTTP 429` on the first anonymous review post |
| 0,5/s (the only global pace that fitted that face) | **~74 min**, and it completed |

The seed writes **52** open reviews through the tight face — `52 × 2 s = 104 s`. Every other call in the run
(~1840 of them, by the arithmetic of the two clocks above) waited two seconds each for a ceiling that never
applied to it. Measured on a recording stub of the door, the first 240 calls of a `forgeco` curated run are
**240 credential, 0 anonymous, 0 ext_public** — and 188 of them are the media pair
(`media.request_upload` + `asset.create`), a face with 100/s available spending 0,5.

So the pace is **per face** now (`seed/pacer.mjs`), and every run ends by saying where its minutes went —
the SHAPE of that line, with `<n>` where the run puts its own count (nothing here is a recorded run):

```
[seed] pace — <n> call(s) through 3 face(s) in <n>s, <n>s of it pacing:
    credential  <n> call(s) at 85/s — <n>s waiting on its own bucket
    anonymous   <n> call(s) at 6/s — <n>s waiting on its own bucket
    ext_public  <n> call(s) at 0.5/s — <n>s waiting on its own bucket
```

⚠️ **If a birth is slow, read that line before blaming the box.** And if a 429 kills one, the refusal now
**echoes the kernel's own words**: since `pk7/p1` a 429 carries `error.details.{limit_bucket, limit,
window_seconds, limit_env}`, and `limit_env` is an explicit `null` when that ceiling has no variable at all.
The seed prints what arrives; against an older kernel — **the one this box's `forge.lock` still pins** — it
says out loud that it is falling back to this repo's table instead of quoting the kernel. The seed's own
three knobs are in `.env.example`, all optional, all defaulting to the ceiling they were measured against.

⛔ **Do not export `FORGE_SEED_RATE_PER_SECOND=0.5`.** It was the way past the 429 on the night this was
measured, and it is now the one value that restores the 74 minutes while curing nothing: that knob paces the
*credential* face, which was never the face that refused. The seed says so out loud if it finds it set.

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

bash bin/box-up.sh --promote tailnet        # and `--promote localhost` puts it back
```

★★ **pk29/D1 — and the BIRTH now says when that command is still owed.** On 2026-09-09 a birth finished
green and `https://<tailnet>:8443/login` answered `?error=unknown_host`: the box had claimed `localhost:8201`
and `localhost:8202` and `tailscale serve` was already in front of it. The decision is unchanged — the box is
born on `localhost` and the promotion is **not** forced — but the run no longer leaves `unknown_host` to
explain it. When `tailscale serve` really publishes a door on a name the box's own host → store map does not
claim, the summary ends with a report naming those doors and the one command that fixes them. It is derived
from **both** sides and never from `FORGE_TAILNET_HOST` merely being set, which is in `.env` here whether or
not anything is serving; `bin/promotion-gap.guard.mjs` proves it is loud in that case and mute in every other.

★ **pk24/§B5 — and the tailnet is one DESTINATION of that step, not its definition.** Online there is no
tailnet and the box needs the same thing, so the address is an argument: `--promote <hostname>` points this
box at any address it really answers at, `--promote localhost` undoes it (reading the names to release off
the box's own host → store map, so a box promoted by a pipeline can be demoted by one), and `--tailnet` /
`--localhost` remain as aliases. `--promote` with no destination **refuses and names the destinations** —
it never falls through to a default. ⚠️ Only a tailnet publishes a table this box can read, so for any other
destination the doors are the box's own ports, and the run says so rather than implying it read something.

It rebuilds the host → store map, re-points `FORGE_PUBLIC_ORIGIN` (**not cosmetic** — the kernel mints every
product-image URL from it, so a box reached over the tailnet with `localhost` here serves a catalogue of
images a phone cannot fetch, and nothing logs an error) and `FORGE_GATE_ADMIN_URL`, re-derives the sibling
list against the new hostname, claims each tenant's admin door **through the port** (`admin-host.js`, the same
two platform commands `provision-ref` drives — never a second write path), and recreates the services that
read all of it at boot. Idempotent and reversible; it touches no store, product or order.

★★★ **pk30/§2 — and the way BACK no longer blames the doors for something else.** Measured on this box on
09/09: `--promote localhost` exited **non-zero on its first pass** saying `the promotion is INCOMPLETE: 0 of 0
admin door(s) claimed. See the REFUSED line(s) above.` — and `0 of 0` could not have been the cause. On the way
back those two counters are **structurally zero** (the claim loop is inside the `out` branch: the way back
claims nothing, it **releases**), so that sentence was a fixed string printed over a failure in a completely
different check — the **shop's address** in the kernel's directory — pointing the operator at REFUSED lines
that were never printed. The verdict is now derived from the **destination** (`bin/promotion-verdict.mjs`): the
way out owes a claim per tenant per spelling and claiming fewer **stays red**; the way back owes **none**, so a
door count never appears there; the shop's address is graded on **both**, because both directions move it; and
facts that do not describe a promotion at all exit **2**, which no caller may publish as green. A way back that
fails on its first try is what an operator reaches for **in a hurry, at the worst moment**.

⛔ **It does not CONFIGURE `tailscale`.** Getting the machine onto the network is your gesture; this only
wires the box to the fact that it is.

⚠️ **The port it claims is the one `tailscale serve` publishes, not the one this box listens on.** They are
different numbers whenever `serve` is doing the publishing — it terminates TLS on ports of its own — so the
promotion reads `tailscale serve status --json` and derives every address from it. Assuming the internal port
was the published one is what made the admin unreachable from anywhere but the laptop, and it failed
**silently in both directions**: over `http://<tailnet>:8201` the admin's session cookie is `Secure`, a
browser stores no `Secure` cookie over plain http outside `localhost`, so the login "works" and the next
click bounces back to `/login`; over `https://<tailnet>:8443` — the address `serve` really answers on — the
admin directory held no claim, so the login refused with `unknown_admin_host`.

⛔ **And since pk24/d4 it REFUSES rather than falling back to the direct ports.** That fallback was the whole
trap written down — `http://<tailnet>:8201` is exactly the address whose login "works" and then bounces — and
now that the doors are published on `127.0.0.1` (`FORGE_BENCH_BIND`, see "The bench's addresses") it is not
even reachable: the port refuses to connect. So `--tailnet` with nothing published stops before its first
`.env` write, names the host it could not promote to, and says what to do (publish with `tailscale serve`, or
set `FORGE_BENCH_BIND=` empty on purpose and read what that costs). A **partial** publication — `serve`
fronting the shop and both admins but not the counter — is not a refusal: those doors are real. The one that
is not gets its own `UNREACHABLE` line and the run exits non-zero, like every other half-promotion here.

⚠️ **It refuses on a box that was never born, and it announces only the doors it really claimed.** `--tailnet`
is a promotion, not a step of the birth, so it is easy to run first — and it used to print the whole green
summary anyway: both admins listed *by tenant name read from `seed/box.json`*, `edge → 200`, exit 0, with
`0 claim(s) set` buried among the green lines. Measured on the birth of 03/09, five minutes after the box was
torn down. The same evening, with the box up, the claim loop reached one tenant of two — and the door block,
re-reading the same file, printed both. So the count is now stated against what it expected
(`admin directory · 2 of 4 claim(s) set`), **zero of N is a refusal** that names `bash bin/box-up.sh` and
writes *nothing* to `.env` (the refusal is atomic on purpose: birth rewrites `FORGE_STORE_HOSTS` and never
`FORGE_PUBLIC_ORIGIN`, so a half-promoted box would be born minting image URLs on an origin no page is opened
at), the door block prints only the doors **the admin directory accepted**, and a promotion that claimed some
and not others lists the rest under `⚠️ INCOMPLETE` and exits non-zero.

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
the window ran. **The crutch was hiding the dependency; removing it did not create one.**

⚠️ **The cache bust is the LAST line of each phase, and it says so because it was not.** It used to be step 7
of `seed/vitrine.mjs` — one shop's seeder — so it busted the **sports store and no other** (the outlet, the
café, the counter and the chrome were composed and never invalidated), and it ran **mid-phase**, with
`seedLogistics`, `seedAudience` and `seedCommerce` still to write after it. It lives in `seed/purge.mjs` now,
driven from `bin/seed.mjs` as the last statement of both phases over **every store the port lists**, and
`bin/purge.guard.mjs` holds that word *last*. A cache bust belongs where nothing follows it: it invalidates
shops that are finished, never one with a step still to come.

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

### ★★ A RED birth keeps its own witness — `postmortem/`

⛔ **The defect this exists for, measured on the birth of 2026-09-05 04:01.** The curated seed died on
`catalog.collection.pin → HTTP 502` after ~300 good calls. A 502 is the EDGE saying *the upstream did not
answer me*; the only witness to why is the kernel container. The failure told the operator to run
`bash bin/box-up.sh --tailnet` — and the promotion's last act recreates seven services, the kernel among
them. `docker inspect`, after the fact: **the kernel that served the seed was created 04:01:44 and its
replacement 04:02:06.** Twenty-two seconds. And `bin/box-down.sh` removes the containers outright.

⇒ So a run that is about to lose a container copies its log to the HOST first:

```
postmortem/2026-09-05T04-01-44Z__8-the-curated-data/
  MANIFEST.md            reason, instant, and per container: id, CREATED AT, state, log size
  kernel.log             docker logs --timestamps, stdout AND stderr
  kernel.inspect.json
  caddy.log  admin.log  …
```

Two call sites, and `bin/evidence-order.guard.mjs` grades both: **`die()`** (every red exit of a birth) and
the promotion, **immediately before** the recreate. By hand, and this is what to run the moment a birth goes
red for any other reason:

```bash
node bin/capture-evidence.mjs --reason seed-red
```

⚠️ **It can never change the verdict of the run that called it** — a birth that already failed is not
improved by a second failure, and a promotion that worked must not go red over an unnecessary post-mortem.
⚠️ **And pointed at a box that is not there it ACCUSES rather than writing an empty folder.** Measured:
`docker ps -a --filter label=com.docker.compose.project=<none such>` exits **0** with an empty list, so the
obvious implementation creates a tidy directory of nothing and reports success. A post-mortem folder full of
0-byte files is worse than no folder — somebody reads it and concludes the kernel was silent.
`postmortem/` is gitignored: container logs carry tokens, hostnames and buyer data.

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

#### ⛔ …and the box refuses to seed from a dataset that is not the one its images were built with

**The birth of 2026-09-03.** `FORGE_SEED_DATASET_HOST_DIR` pointed at a worktree **166 commits behind** the
tree the four images were baked from. The box came up **green**; the admin's stock panel was born empty with
the feature that fills it *inside the image*; and the whole demo — 2 790 products, its categories, its brands
— came from yesterday's checkout. Nothing anywhere said so.

**Every other input of this box is pinned.** Four images by digest, and `bin/images-from-lock.sh` refuses even
a tag. The dataset is the one that is not — deliberately: there is one `infra/Dockerfile`, so baking one
instance's catalogue into the kernel image would put it in *every customer's* kernel, which is the defect the
platform's own `instance-content.guard.test.ts` forbids in both directions. (Measured before choosing: the
directory is **40 MB** — the 3.6 GB of photographs are not in it. Size was never the obstacle; the boundary
is.)

**So it is recorded and compared, in two halves:**

| where | what |
|---|---|
| `bin/build-local.sh` | copies the dataset's own content stamp (`forge-seed-dataset.json`, written by `pnpm pack:dataset`) into `forge.lock` → `dataset` as it bakes the images |
| `bin/box-up.sh` step **0c** | compares that record against the pointer of the directory this box mounts, **before a single container starts**, and refuses **naming both stamps** |

⚠️ **The block below is the TRANSCRIPT of the refusal that bought this check, on the night it was written —
not this box's numbers.** Both stamps are that night's pair and neither has been current since; `pk18/p1`
alone moved the catalogue. It is kept verbatim because what it shows is the *shape* of the refusal (two
stamps, both named), and because the same pair is the fixture `bin/dataset-provenance.test.mjs` reproduces the
night with. **For what this box carries today, read `forge.lock` → `dataset`, or ask: `node
bin/dataset-provenance.mjs`.** A number restated in prose ages in silence — the same reason the node floor is
pointed at here rather than spelled out.

```
     the IMAGES   v0.3.0-pre.cb2154ef7 · pk6/integra@cb2154ef7
                  were built with  demo · catalog 81bd9fb7658719db · photos 9aa8af0d782b82ec
     the DATASET  …/wt-v03/t-forno/instances/demo/dataset
                  declares         demo · catalog c51b5e4b49324fa9 · photos 9aa8af0d782b82ec
```

**And the stamp is graded against its own directory first.** A comparison is worth exactly what the stamp is
worth, and nothing upstream keeps the pointer in step with the bytes (`instances/demo/README.md` states the
order of the day — *write → `check:dataset` → `pack:dataset` → mount* — and no test enforces it). So an edit
without a re-pack is refused as **stale**, naming what the pointer declares against what the directory holds.
`catalog.totalBytes` is exactly the sum of the files it lists, so this costs 26 `stat`s. It does **not**
re-derive the content hash — that algorithm lives in the platform, and a second copy here would be a second
source of one fact.

Ask the same question by hand with `node bin/dataset-provenance.mjs`. A lock that **records no** `dataset` (one
downloaded from a promoted release) is a *note*, never a refusal — a check that refuses what it cannot judge is
a check people route around.

### The bench's addresses

| face | address | serves |
|---|---|---|
| shop (all storefronts + checkout) | `http://localhost:8200` | every store, at `/s/<store id>` until a host claims one |
| **admin · T1** | `http://localhost:8201` | tenant `forgeco` |
| **admin · T2** | `http://localhost:8202` | tenant `forgecafe` |
| totem (the counter) | `http://localhost:8203` | store `balcao` |
| https (edge) | `8243` | |

⚠️ **All five are published on `127.0.0.1` and nothing else** — `FORGE_BENCH_BIND`, which `.env.example`
ships. `localhost` is a **secure context**, so every address above keeps working over plain http exactly as
it always did; any OTHER plain-http origin is the trap this bind removes. Every door here is plain http and
every front runs `NODE_ENV=production`, so the cookies are `Secure` and a browser silently refuses them off
`localhost`: measured 2026-09-08, `http://<magicdns>:8200/health`, `:8201/login`, `:8202/login` and `:8203/`
all answered **200** from another machine, and each of them then dropped the cart or the admin session with
nothing on screen saying why. Off this laptop the box is reached through `tailscale serve`, over **https** —
it terminates TLS and proxies to `http://127.0.0.1:<port>`, so loopback costs the tailnet nothing.
The variable is DEMANDED, not defaulted (`${FORGE_BENCH_BIND?…}`, no colon): an empty value is the legal
answer "every interface" — what a deployment says, and byte-for-byte what this box published before — while
saying nothing at all stops `docker compose` by name before the first container.
`bin/bench-http-door.guard.mjs` grades the interface; `bin/bench-ports.guard.mjs` grades the numbers.

### ★★★ A DEPLOYMENT'S addresses — the SIX, and where each one is declared (pk34/d1)

The bench above is **one origin and four ports**. A deployment of this instance is **six hostnames**, and he
named them on 2026-09-12 — *"vão ser essas urls das demos"*:

| face | address | the front behind it | variable |
|---|---|---|---|
| shop · `forge` | `store.forgecommerce.pro` | `storefront` + `checkout` | `FORGE_DOMAIN` |
| shop · `outlet` | `outlet.store.forgecommerce.pro` | `storefront` + `checkout` | `FORGE_OUTLET_DOMAIN` |
| shop · `cafe` | `cafe.forgecommerce.pro` | **`storefront-coffee`** + `checkout` | `FORGE_CAFE_DOMAIN` |
| admin · `forgeco` | `admin.store.forgecommerce.pro` | `admin` | `FORGE_ADMIN_DOMAIN` |
| admin · `forgecafe` | `admin.cafe.forgecommerce.pro` | `admin` | `FORGE_CAFE_ADMIN_DOMAIN` |
| counter · `balcao` | `totem.cafe.forgecommerce.pro` | `totem` | `FORGE_TOTEM_DOMAIN` |

⛔ **This table is not the source — `seed/box.json` is.** Every store declares a `domain` and every tenant an
`admin_domain`, because **a hostname is DATA**: it is the `host` column the kernel keys its directory on. The
`caddy/Caddyfile` owns the other half — which CONTAINER answers there — and it holds ONE definition of a shop
hostname (a snippet; each hostname passes only the container its fall-through reaches). Nothing is copied
three times by hand. `bin/box-domains.guard.mjs` grades the pairing in **both** directions and the third end
with it: compose has to DELIVER each variable to the edge container.

⚠️ **The bench names none of them and nothing changes.** The box is born on `localhost` (the promotion is a
named step) and it reads `caddy/Caddyfile.local`, which knows nothing about hostnames.

⛔⛔ **A forgotten one used to take the WHOLE BOX down.** Measured 2026-09-12 on the live bench:
`docker inspect …-caddy-1` held **three** `FORGE_*` variables and `FORGE_TOTEM_DOMAIN` was not one of them,
so `{$FORGE_TOTEM_DOMAIN}` resolved to the empty string — and an empty site address is not a missing host,
it is a file that does not parse (`server block without any key is global configuration`). `./caddy/Caddyfile`
is compose's default, so the edge a deployment gets could not load: store, checkout and admin down together.
Every address now falls back to a `<something>.unset.localhost` sentinel — measured with `caddy:2` v2.11.4, a
`.localhost` name is issued by Caddy's **own internal CA** (`issuer:"local"`, 11 ms, no ACME request at all) —
declared in **both** compose and the Caddyfile, because Caddy's `{$VAR:fallback}` does **not** fire for a
variable that is present and EMPTY. A forgotten variable now costs **one face**, and step 15
(`bin/verify-config.mjs`) names it.

### ★ Two tenants, four stores — and only THREE of them on the street

| tenant | store | theme | on the reference vitrine? |
|---|---|---|---|
| `forgeco` | `forge` (bootstrap) | — | yes |
| `forgeco` | `outlet` | `outlet` | yes |
| `forgecafe` | `cafe` (bootstrap) | `coffee-store` | yes, on its **fork** |
| `forgecafe` | `balcao` | — | **no** — `status: "private"`; its front is the **totem** |

### ★★ The café's fork IS the café's vitrine — its root is the café's home, not a store the host names

The owner's rule, 09/09: *"o storefront usado é um fork, é ele que será acessado pelo subdomínio … acessar uma
home de café de storefront vanilla nem deveria existir, afinal o fork do storefront assume esse papel."* So
`storefront-coffee/` serves **one shop**: the store `FORGE_COFFEE_STORE_ID` names (`src/lib/own-store.ts`,
asked by `src/middleware.ts` **before** the host). Every clean address of that image — `/` first of all — is
that store's.

⚠️ **Asking the host instead was wrong in both directions, measured on this bench 09/09.** The café's own
container carries a `FORGE_STORE_HOSTS` mapping *every* hostname of the box (`localhost`, `127.0.0.1`,
this machine's own name, its tailnet name) to the **shoe shop** — so `/` on the café's front was the shoe
shop's home wearing
the café's header. And no hostname of the café's own resolves at all: `read.store.by_host` gives **one store
per authority** and the box's **root** store is the one that claims it (`bin/store-host.mjs`), so the café
claims none and its own subdomain answered the clean 404. Neither answer is this shop.

It does not show on the bench because the bench has **one origin**, whose root belongs to the shoe shop, and
the café is reached path-scoped (`/s/cafe…`). In production each store has its **own host**, and `/` is the
first thing a shopper opens. `storefront-coffee/src/root-is-own-shop.test.ts` is the rule.

⚠️ **The fourth store is not «off».** `balcao` keeps its catalogue, its prices, its stock, its cart and its
orders through the port — that is how the totem sells for it — and `/s/balcao/checkout`,
`/s/balcao/account` and `/s/balcao/account/login` keep answering, because those are the **checkout**
deployable and not the vitrine. What `private` switches off is one thing: the vitrine's page, which answers
**404**. It is declared in `seed/box.json` and written through the port; see the paragraph on step 14 above.

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

⚠️ **`bin/test.sh` is also who runs the FORKS' own suites.** `storefront-coffee/` and `totem/` carry vitest
suites of their own — 774 and 171 tests — and until 2026-09-05 nothing ran them: not this script, not
`bin/build-coffee.sh`, not the Dockerfiles, and this repository has no CI. `bin/fork-suite.guard.mjs` is the
loop that does, and the very first run came back **red** on the coffee vitrine: two test files left behind by
fixes that had travelled into the fork's source and stopped there. It costs ~5.6 s of work, which the
parallelism of `node --test` mostly absorbs on an idle machine and does not on a busy one, and a fork that is
not installed is reported **NOT CHECKED**, never quietly passed.

⚠️ **And it is also who runs THIS BOX'S OWN APPS.** `apps/payment-pos/` (the counter's payment driver) and
`apps/demo-gate/` (the demo interstitial) are loaded by the kernel itself, and until 2026-09-08 nothing here
compiled or ran them: not `bin/test.sh`, which scanned `bin/` and `seed/`; not the fork guards, which only see
a directory that depends on the storefront kit; not `bin/pack-apps.sh`, which packs the artifact without
reading it; not `bin/build-local.sh`, which copies it into the oven. An app of this instance could be written,
packed, baked and served without a compiler or a runner ever having read it. `bin/instance-app.guard.mjs`
closes that: it derives the list from `forge.origin: "instance"` (the property the oven itself requires),
links each app's declared dependencies out of a Forge checkout the way the oven does, runs `tsc` and the app's
own suite — 35 tests that had never run — and finally asserts that the `instanceApps` list `composition.json`
hands the bake is exactly the set it just compiled and ran. The first run found both apps unloadable, for the
same reason twice: `apps/*/tsconfig.json` extended `../../tsconfig.base.json` and
`apps/demo-gate/vitest.config.ts` imported `../../vitest.shared`, two files of the MONOREPO that this
repository has never had. Without a Forge checkout on the machine it reports **NOT CHECKED**, never a silent
green.

⚠️ **`bin/vendor-drift.guard.mjs` is who asks whether the forks' COMMITTED locks still describe this
release.** It recomputes each vendored tarball's `integrity` by packing the pinned checkout with the
product's own `scripts/pack-publishable.sh`, and compares. That is the failure a pipeline would otherwise
meet as an `EINTEGRITY` from `npm ci` with no cause attached, and its message names one command
(`bin/revendor-forks.sh`) rather than four. It also proves what is INSTALLED is what is in `vendor/` —
measured on 2026-09-08, `npm install` served a cached copy of an older tarball that had the same path, and
the fork ran 174 lines behind the release with nothing saying a word. It costs ~9 s of packing on an idle
machine (67 s measured on this bench with eight agents on it), and it says **NOT CHECKED** rather than green
when there is no Forge checkout at the pinned commit, or when a `built` package's `dist` is not on disk —
this guard never builds in a tree it does not own.

⚠️ **Two of those guards need the forks INSTALLED, and say so when they are not.**
`bin/fork-typecheck.guard.mjs` compiles `storefront-coffee/` and `totem/` against the kit in their own
`node_modules` (`tsc --noEmit`, ~5 s) — the contract that used to be checked only by the oven, four minutes
into an image build. It also proves that kit is the one `forge.lock` pins, by finding the checkout whose HEAD
is that commit (`FORGE_MONOREPO=<path>` names one; a worktree of it is found from any other). Every run
prints the tree it compiled against, and a run that cannot check prints **NOT CHECKED** with the reason —
never a silent green.

⚠️ **And `tsc` being green is not the same sentence as "the bundle is built from that kit" —
`bin/fork-bundle-freshness.guard.mjs` is the difference.** Measured 2026-09-09:
`forge-preseed-storefront-coffee-1` was born **(unhealthy)** and threw
`TypeError: (0 , i.isServerActionSubmission) is not a function` on every request, while the kit in its
`node_modules` exported that function, `tsc` was green and `next build` exited 0. The middleware it shipped
carried a kit six days old, because webpack validates everything under `snapshot.managedPaths` — all of
`node_modules`, in a Next build — by the package's **version**, and the Forge packages are vendored here as
tarballs frozen at one version forever, so `.next/cache/webpack` served a September-3 compilation to a
September-9 build. Re-baking the image did not move it: the cache lives in the fork's directory, not in the
image. Each fork's `next.config.mjs` now carries one shared block that (1) takes the scopes named in its own
`transpilePackages` out of `managedPaths`, so they are invalidated by content like first-party source, and
(2) sets `exportsPresence: 'error'`, so an import of a name the target module does not export is a **red
build naming the symbol and the module** instead of a warning, an exit 0 and a production `TypeError`. This
guard proves both facts by loading each config and calling the hook, and compares the block byte for byte
across the forks. It needs no `node_modules` and no Forge checkout, and it has no NOT CHECKED to fall back
on — the defect it grades is invisible everywhere else.

⚠️ **And one of them is about a rule this repository never asked for.** `bin/store-mount-drift.guard.mjs`
reads the REFERENCE vitrine out of that same pinned checkout and requires `storefront-coffee/`'s
store-scoped root layouts to mount whatever the reference mounts there from `@forgecommerce/*`. It exists
because `/s/cafe` answered **200** from the fork on the same bench where `/s/outlet` answered 404 from the
reference: a fix that shipped in the product does not travel to a cut of it, and until this guard the only
thing that knew was `curl`. A red here is not automatically "go copy the product" — this fork owns its
front — but a divergence has to be a decision, not a surprise.

⚠️ **And that guard is deliberately blind above the `[store]` segment — `bin/fork-refusal-drift.guard.mjs`
is the eye for what is up there.** `sitemap.xml`, `robots.txt` and the `api/*` handlers sit outside every
store-scoped tree and outside the middleware matcher, so no layout refuses on their behalf: whatever they
refuse, they refuse in their own body. This guard derives that complement (`src/app/**` minus every path
holding a `[store]` segment), reads which of those routes the REFERENCE refuses on before answering — a
`@forgecommerce/*` call whose value decides an early `return` out of an exported handler — and requires the
fork's file at the same path to ask the same question. It exists because the fork's `src/app/sitemap.ts`
was cut without `readClient().storeFlags`, so a store with **no public page** (`storefront_enabled: false`)
had its whole list of URLs — categories, CMS pages, products, brands, collections, every one of them a
404 — published to any crawler that asked. Neither guard above could see it, by their own design; that is
the hole this one covers. Divergences are declared in the file, printed on every run, and go red the run
after the reference stops making the refusal they waive.

A store is reached at `/s/<store id>` until a hostname claims it — host → store is DATA, set in the admin
(Settings ▸ General ▸ Stores), never configuration.

⚠️ **It is the ID (`sto_…`), not the handle — and a handle now answers 404, LOUDLY.** The read face takes a
store id and answers a handle with a 404 that says so, and since the reference vitrine started asking
(`requireStore`, in the store-scoped root layout) the PAGE says it too. Measured on this bench 2026-09-04,
by the header the edge stamps:

```
/s/outlet           → 404   x-forge-served-by: storefront
/s/inexistente-xyz  → 404   x-forge-served-by: storefront
```

It used to return **200** — a shop titled "Loja", with no theme, no products and no composed blocks, which
looked like a store that was never seeded rather than like a URL that was never right, and for `curl`, a
monitor or a crawler looked like a store answering OK. `docker compose exec kernel …`, the admin's store
list, or `read.internal.stores` all give you the id.

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

Since 2026-09-04 it also dresses and populates three things that used to come up empty, and each lives beside
its own declaration:

| what | declared in | when |
|---|---|---|
| the `chrome` app — **installed, placed and filled in**, per store | `seed/chrome.json` | curated phase |
| carriers + pickup points (the two `/logistics` screens) | `seed/logistics.json` | window phase |
| customer clusters + the promotions that condition on them | `seed/audience.json` | window phase |

⚠️ **The last two wait for the WINDOW on purpose.** A cluster's membership is materialized when the cluster is
CREATED, over the customers that exist at that instant — and this tenant's buyers arrive with the massive
one-shot (step 9) and the 180-day past (step 10). Created in the curated phase, every cluster would be born
empty, look correct, and stay that way.

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

★★ **pk30/§11 — and the ADMIN HOME's widget order is graded PER TENANT, because "some tenant is right" is how
it hid.** On 10/09 he used both admins and reported it: *"o bloco de últimas assinaturas na demo ainda está
vindo no topo, o admin de café está certo mas o de sapato está errado."* Installing an app **auto-places** its
widgets at the **end** of `admin:admin.home.widgets`, so a widget's position *is* the order its app was
installed in — `forgeco` installed `subscriptions` first, `forgecafe` installed it last, and neither had
decided anything. ⇒ The order is now **declared** (the mounted dataset's `admin_widgets` — the same key the
kernel's own step reads) and **applied to every tenant** by step 11, which is the half no one-shot could do:
`dist/seed-demo.js` runs for the **dataset** tenant alone, so the coffee shop's board had never been touched by
anything. This verifier grades the **prefix** against that declaration, one tenant per run — the tail keeps the
relative order it had, because nobody decided about it. A declaration over an **empty** board is a RED that
names the tenant, never a line saying there was nothing to compare.

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

⚠️ **A `⚑` line is THIS SCRIPT's defect, not the box's — do not go hunting.** On the birth of 03/09 the
verifier reported both subscriber perks as `status is undefined — a draft perk charges what the page says it
will not · scoped to the whole tenant`, and dropped `box-up` to 1. The database held them `active` and
confined to the coffee shop: the frozen promotion list publishes `state`, not `status`, and it does not
publish `store_id` at all, so both names read back `undefined` — and `undefined !== 'active'` is TRUE. A
question with no answer came out as the loudest possible accusation.

So every name is now read through an assertion that **the key came back**, and a name that did not is printed
apart, in its own sentence, naming the read and listing what the read *does* publish. The exit codes say whose
defect it is: **0** settled · **1** the box did not · **2** the QUESTION did not, so those checks measured
nothing. `bin/box-up.sh` treats 1 and 2 alike (both are "did not settle", which is right), but a `⚑` in the
birth log means fix the verifier — there is nothing to look for in the box.

### The placeholder art

A window slot with no picture renders wrong, and the wrongness does not show up in a seed log. So
`node bin/make-placeholders.mjs` generates one — flat colour, and the slot, the store and the dimension
written **inside the image** (`home.hero · cafe · 1504x560`), at the size measured from the art that already
serves that slot. They are deterministic (same slot, same bytes, so a re-run uploads nothing) and they are
obviously not final.

★ **The coffees' story frames are no longer among them (04/09).** All eighteen real photographs landed in
`seed/photos/` under the names the dataset already declared, so `resolvePhoto` stops choosing a stand-in and
the eighteen `placeholder-*-historia-*` files were retired. What is left is the nine WINDOW slots (hero,
mobile hero and below-categories, per shop). ⚠️ The generator still knows how to make a story stand-in, and
it will plan one again the day a seventh coffee is declared — that is what the placeholder suite asserts;
`seed/media.test.mjs` asserts the opposite direction, that no declared photograph resolves to a stand-in
today.

**To curate them:** they are all named `placeholder-…`, so the whole set is one search for `placeholder-` in
the admin's Asset Library, or `read.internal.assets` filtered by the same prefix. Replace them one at a time.
The generator never draws over art that already exists, and it makes none for the counter — a totem is four
bands and no hero.

That creates the stores, declares the `cf.*` vocabulary and creates the six coffees **with their photos**,
all through the door: the script holds an API key, never a database credential, exactly like an ERP would.
It is idempotent — re-running it is a no-op.

The same run stands the **Outlet** up (`seed/outlet.mjs`, its data in `seed/outlet.json`): it installs the
two apps that store composes with, uploads its photographs and campaign art, publishes the products
`outlet.json` names with their prices and their stock, pins the three collections its shelves and its
campaign art are sourced from, publishes its **seven institutional pages**, and places the four Compose
blocks that are its home page. Not one line of front-end code — a theme, data, and a composition.

⚠️ **The seven pages are CARDS, and the text on them is not this repository's.** Until 05/09 the Outlet
published none of them while the Forge store beside it published seven, in the same tenant, and the
institutional sidebar the storefront draws is hardcoded with all seven links — so the shop was drawing seven
links into its own 404. What the seed can write is the card: slug, title, meta, `template_key`, published.
The **body** is a component per `template_key` inside the storefront image, resolved by a registry with no
store axis, so the Outlet's «Trocas e devoluções» renders the same paragraphs as the Forge store's. The
measurement and the two ways out (a store axis on that registry, or a body on the page card — both the
product's, neither this repo's) are in `seed/outlet.json`'s `_pages_why`.

⚠️ **Three of those four sit in TWO slots, and where they sit is his call of 08/09.** The reference home draws
its sections in a fixed order and the two headings this store keeps — «Compre por categoria» and «Marcas que
amamos» — are theme chrome, not slots. He moved the banner mosaic ABOVE the first of them by dragging it in
Compose («arrastei os banners para o slot hero e ficou melhor. Então deixa assim no dataset»), so the mosaic
is `home.hero#0` and «Quase de graça» / «Outlet Kids» are `home.below_categories#0..1`; `home.banner_strip`,
`home.below_shelf`, `home.below_brands` and the whole PLP are **empty on purpose** — see `seed/outlet.json`'s
`_home_why`. Positions are dense **per slot**, because `place`/`move` shift everything at or after them inside
one slot. That also makes `compose()` the one step in this seed that **removes**: it governs those slots
rather than appending to them, because a box that ran the previous version has the mosaic in the old slot and
appending would draw both.

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

★ **The counter's OPENING WEEK, and why it is a check and not just seven more lines of JSON (05/09).** Until
this date `seed/totem.json` declared the point with no `hours` key at all, and the checkout's pickup card
listed the seven days as «Fechado» with «Fechado hoje» under them. Nothing was broken:
`pickup_location.create` accepts a point with no week, an **omitted day is closed exactly like a `null` one**
(`pickupHoursSchema` is `.strict()` over `mon..sun`), and the create handler stores `input.hours ?? {}` —
measured on this bench, where the row read back `Balcão · Forge Café | {}` while the shoe brand's four each
read back a full week. So the dataset was the only place that ambiguity could be refused, and it was not being refused there
either: the guard that graded a week lived in `seed/logistics.test.mjs` and had never contained this point.
`seed/pickup-hours.mjs` now holds one rule for **every** point the box declares, `bin/verify-seed.mjs` asks it
of the **live** box and names the point (and the day) it is missing, and the counter's week is a Vila Madalena
café's: 08:00–19:00 to start the week, later on Thursday, until 23:00 on Friday and Saturday, brunch on
Sunday. ⚠️ Both seed steps are idempotent **by name**, so a box born before 05/09 keeps its empty week through
every re-run — the week arrives with the next birth, and until then the verifier is red about it, by name.

⚠️ **The SHOE brand's four pickup points (04/09, `seed/logistics.json`) are a different case, and the
difference is exactly one command.** They exist so `/logistics/pickup-points` is a populated screen, and this
box deliberately creates **no `pickup`-kind shipping method** in that tenant — so they are registry rows an
operator can see and a shopper cannot reach. Adding the method would put a «Retirar na loja» option into the
Forge and Outlet funnels and would flip both live proof orders from delivery to pickup. The other half of that
subject is the card `SEED-PICKUP-SO-METADE`.

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

⚠️ **A DATASET FROM BEFORE 2026-09-06 IS REFUSED, BY NAME, BEFORE THE FIRST WRITE.** The catalog's media keys
used to carry the dataset's namespace (`demo/<handle>-cover.jpg`); the platform took it out — the demo's
`catalog.json` was writing the word `demo/` 52 669 times, and deriving a second dataset from it rewrote all
52 669 — so the namespace is now stated **once**, by `forge-seed-dataset.json`'s `id`, and a key is
`<handle>-cover.jpg`. `seed/forge.mjs` grades the whole catalog the moment it reads it and stops with the
offending keys and the keys they should be, rather than spending 2790 refusals saying *"the photo manifest
does not place it"* about photographs that are on disk. The fix is upstream and mechanical: re-run
`pnpm pack:dataset` in the monorepo and mount the directory again.

★ Nothing the byte store already holds moved. This box publishes under the key `media.request_upload`
**minted**, never the dataset's own, so the change is entirely about which file a key names on disk.

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
  keeps its cached render until the TTL. **`bin/seed.mjs` now asks for you** — `seed/purge.mjs`, the last
  statement of each phase, over every store the port lists. Ask for it by hand after any OTHER script that
  drives the port:

  ```bash
  curl -X POST "http://localhost:8200/api/revalidate?tag=extensions:<store id>&tag=store:<store id>" \
       -H "x-revalidate-secret: $FORGE_REVALIDATE_SECRET"
  ```

  ⚠️ **The checkout has no such hook** — measured: `/_checkout/api/revalidate` is a 404 and that container
  carries no `FORGE_REVALIDATE_SECRET`. Restarting it is the only lever there, which matters the day a
  block is composed into a checkout slot.

  ⚠️ **And neither does the café's fork, for a different reason: the edge.** `/api/revalidate` falls through
  to the default `handle { reverse_proxy storefront:3000 }`, so the hook reaches the **reference vitrine and
  only it**. `storefront-coffee` holds its own Next cache behind `handle /s/cafe*` and no path on this box
  reaches its revalidation route. `docker compose restart storefront-coffee` is the lever there.

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

**It has TWO screens since pk30.** The first says what to open; the second — *"A arquitetura da demo"*, opened
by the affordance at its foot and closed by the one at its own — says **why that is hard**, for a visitor who
has never heard the word multi-tenant: the two tenants side by side with their two shops each (which storefront
is forked, which theme each wears), one admin under both, and the stack they all stand on (API · CLI · MCP ·
SDK · Docs → the single command port → the kernel → PostgreSQL/Redis → infra). Both screens are PT/EN/ES, on
the one selector the gate already had, and both are embedded copy — `config_schema` stays `[]`.

⚠️ **The FIRST screen is not yet the owner's 10/09 layout, and the reason is a contract, not a backlog.** That
layout is a HUB over six destinations; `dismissGate()` (`packages/storefront-kit/src/gate/actions.ts:15`, in the
Forge monorepo) sets the dismissal cookie and returns `void`, so a gate can say *"let me through HERE"* and
cannot say *"let me through and take me to /s/outlet"*. Five of the six destinations would therefore land the
visitor on a gate again. The head of `apps/demo-gate/block/gate.tsx` carries the full note; the architecture
screen needs no URL, which is why it did not have to wait.

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

## 4b. `demo-setup` — the shop's own MARK, and the app that exists to be looked at

`demo-setup` (`apps/demo-setup/`) is the second app this repository owns, and the one written to answer a
question rather than to fill a hole: **how does a customer extend Forge?** The owner's words, 08/09 — *"esse
app me ajuda a mostrar para os clientes como eles podem fazer apps livremente (principal forma de extensão do
Forge) … esse mostra mais claramente e de forma simples um logo virando outro"*.

It declares **three blocks — one per place the SHOP WINDOW shows a name**: the header bar
(`storefront:header.brand`), the mobile drawer (`header.drawer_brand`) and the footer's brand column
(`footer.brand`). Each is placed and configured on its own in Compose; each draws either a logo from the asset
library or a wordmark whose tail takes the theme's accent, so the SAME three configs make the Outlet look like
the Outlet without a line of code.

⛔ **The login box (`account.brand`) is NOT one of them, and the line is the DEPLOYABLE (trava 4).** That
screen is the **checkout**'s — hosted by us, forked by nobody — so a mark there has to be configurable
*without* a fork, which makes it a capability of the **product**: the OOTB `chrome` app carries it from pk28
on. The **vitrine** is the opposite, a deployable the customer forks and makes theirs, so identity there may
live in an app of their own. The owner, 09/09: *"prefiro colocar N blocos em N lugares do que colocar só um
para todos … essas 3 são do storefront e a caixa de login é do checkout."* ⚠️ The slot did not move; only this
app's block did — and `seed/chrome.json` will not place the product's replacement until a kernel image baked
from that slice is pinned, because `composition.place` refuses a component the installed manifest does not
declare and would fail the birth rather than skip a mark.

**Why one per place and not one for all.** Until pk26 the mark was a single block of the OOTB `chrome` app,
read in four renders — so an operator dragged one row in Compose and changed four places, and the board could
not say which. The owner named it (*"o compose não faz sentido, está configurando algo lá que nem sabe onde
vai aparecer"*), Forge gave each place its own slot, and the vitrine's mark left the product: **a logo is
CONTENT**, and the product ships slots with a bare default while whoever wants a mark writes the block. ⛔ The
kernel already required it — `placement: 'single'` is enforced per *(store, app, component)*, so one component
cannot fill two slots.

**And it says the shop's own tagline.** `footer.brand`'s Forge fallback cedes its node as a UNIT — the
wordmark AND *"Leve. Inteligente. Sua."* — deliberately, because that sentence is Forge's. So a shop that
places a mark there LOSES the sentence; the `footer_brand` block carries a `tagline` field, and the two shoe
shops now say that line **because they configured it**. That is the half worth showing a customer.

It has **no admin page, no scope and no table**: there is no path from a page to the vitrine's mark (the only
access is the slot, and the shops that wear it run the vanilla storefront image, unforked), so a page would
either mirror what the seed writes or invite a visitor to edit what the weekly reset erases. Page administers,
block renders.

Data and reasons: `seed/demo-setup.json` (declaration) · `seed/demo-setup.mjs` (the hand, shared with
`seed/chrome.mjs` through `seed/blocks.mjs`) · `docs/capabilities/demo-setup.md` · the app's own README.

## 4c. The counter's payment app — this box's own payment DRIVER

`payment-pos` (`apps/payment-pos/`) is the third app this repository owns, and the first that is not a
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

## 4d. The counter's totem — and why this box runs SIX images, not four

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
FORGE_TOTEM_HTTP_PORT=8203          # the bench port; the site `:82` in caddy/Caddyfile.local
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

Open **http://localhost:8203** (the bench) — you should land on "Toque para começar".

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
8b. **RELOAD the page while the PIX QR is up** — the one exit from this flow that never reaches the reset.
   The till comes back to "Toque para começar" with a line naming the order and saying it is **still unpaid**,
   and — this is what C5 added — a button: **"Retomar o pagamento do pedido N"**. Tap it and the SAME QR is
   back, with the same order number and the order's own total. Touch it to settle, and the order closes.
   ⚠️ **Nothing was remembered to make that work.** The envelope lives on the payment attempt in the kernel
   and `read.payment` publishes it; the till re-reads instead of holding a live payment in memory, so no
   second charge can exist. Do the same reload after paying with **Cartão** and there is no button at all —
   an order that is already paid must never draw a QR again. And in both cases the next customer can still
   start their own order with the ordinary tap: the notice is a line, never a wall.

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
