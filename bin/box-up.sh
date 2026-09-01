#!/usr/bin/env bash
# ★★ THE ONE COMMAND — a virgin box becomes this demo's bench. EXECUTE it; do not source it.
#
#   bash bin/box-up.sh
#
# WHAT "ONE COMMAND" PROMISES, AND WHAT IT DOES NOT. It promises that a human types ONE thing and gets a
# working bench — not that there is only one step underneath. There are seven, they are listed below in the
# order they must happen, and each one is here because the step before it produced something it needs. That
# order IS the map of how this box is born, so it is written out rather than hidden behind a single verb:
#
#   1. postgres + redis          the box needs somewhere to put a schema before it can migrate one
#   2. migrate                   system schema first; tenants have none yet, and that is not an error
#   3. provision-ref  × TENANT   tenant + its FIRST store + FIRST operator + login driver + admin-host claim
#   4. admin-platform-token      the ONE box credential that lets one admin container serve both tenants
#   5. kernel + edge + fronts    now that a tenant exists for them to serve (INCLUDING the coffee fork)
#   6. seed-box.mjs   × TENANT   the remaining stores, the settings every screen inherits
#   7. totem                     LAST of the six images: it needs the counter store id step 6 resolved
#   8. seed.mjs       × TENANT   the CURATED data — what a human wrote, and what the assortment publishes
#   9. seed-demo      × TENANT   the MASSIVE catalogue — the one-shot that fills, run once per tenant
#
# ⚠️ SIX IMAGES, NOT FOUR. Four are pinned by digest in `forge.lock` (kernel, storefront, checkout, admin);
# TWO are built here and carry this box's own front code — `forge-demo-storefront-coffee:local` (the coffee
# shop's forked vitrine) and `forge-demo-totem:local` (the counter). A box that comes up with four of them is
# missing exactly the two screens this demo exists to show, and it comes up GREEN, which is why they are
# named in this list rather than left to `docker compose up`.
#
# ⚠️ 3, 6 AND 7 ARE EACH RUN TWICE, ONCE PER TENANT, AND THAT IS THE SHAPE RATHER THAN A WORKAROUND.
# `provision-ref` and `seed-demo` both read `referenceOptionsFromEnv()` — ONE tenant, ONE store, from the
# environment — and a credential belongs to ONE tenant, which the write face enforces with a 403. So "seed two
# tenants" is two runs with two environments and two tokens, in the same way and in the same place. Widening
# either entrypoint to take N tenants would move a boundary the kernel exists to hold into a script.
#
# ⚠️ NO TOKEN IS EVER PRINTED. `provision-ref` and `admin-platform-token` each emit a secret exactly once, on
# stderr/stdout; this script captures them straight into `.secrets` through a temp file it shreds. A token that
# reaches a terminal reaches a scrollback, a log and anything reading either.
#
# IDEMPOTENT. Every step converges on a second run: migrate is a no-op, `provision-ref` returns the same store
# id (retiring the login driver it minted last time — the count is printed), the box seeder creates nothing,
# and `seed-demo` is documented as converging. Re-running is the supported way to repair a half-built box.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

: "${COMPOSE_PROJECT_NAME:=forge-preseed}"
export COMPOSE_PROJECT_NAME

# `docker` needs a group shim on this box, and that shim takes ONE STRING — which is the whole hazard here.
#
# ⚠️ EVERY ARGUMENT IS RE-QUOTED, because `"$*"` is not the same as `"$@"` once a value contains a space. The
# first version flattened the arguments into the string this shim runs, so `-e FORGE_REF_STORE_NAME=Forge Café`
# arrived at the inner shell as two words and compose answered `no such service: Café`. The tenant whose store
# is called "Forge" provisioned fine and the one called "Forge Café" did not — a bug that only exists for
# SOME of the data, which is the kind that ships. `printf %q` makes the round trip lossless.
DOCKER_SH="${FORGE_DOCKER_SH:-sg docker -c}"
dc() {
  local quoted='' a
  for a in "$@"; do quoted+=" $(printf '%q' "$a")"; done
  $DOCKER_SH "cd $(printf '%q' "$HERE") && docker compose$quoted"
}

# ★★ A CONTAINER PATH MAY NEVER REACH A HOST PROCESS — enforced, not remembered.
#
# THE DEFECT THIS EXISTS FOR, TWICE IN ONE EVENING. `FORGE_SEED_DATASET_DIR=/app/seed-dataset` and
# `FORGE_SEED_PHOTOS_DIR=/data/seed-photos` are TRUE for the kernel and FALSE for anything running on this
# machine. This script sources `.env`, so every host process it starts INHERITS both — and a seeder that
# reads them dies with `does not exist` or `ENOENT`, naming a path that genuinely exists three metres away
# inside a container. The `..._DIR` / `..._HOST_DIR` pair exists precisely for this, and the two names are
# far too similar to trust anyone's attention with, mine included.
#
# So a host process is started through `host_node`, which (1) REPLACES each known container path with its
# host counterpart, and (2) REFUSES to launch if any FORGE_* variable still holds a value under /app or
# /data — naming every offender. A new variable of that shape added later is caught by (2) on its first run,
# which is the half that keeps this from going stale: the list in (1) is what I know, (2) is what I do not.
CONTAINER_PATH_VARS='FORGE_SEED_DATASET_DIR:FORGE_SEED_DATASET_HOST_DIR FORGE_SEED_PHOTOS_DIR:'
host_node() { # <script> [args…]
  local pair name host_name value overrides='' blanked=''
  # (1) THE KNOWN PAIRS — remapped to their host sibling. A pair whose sibling is EMPTY is the one case that
  #     is genuinely fatal: something has declared it needs this on the host, and there is no host value to
  #     give it. Guessing one is how a seeder ends up writing into the wrong place instead of failing.
  for pair in $CONTAINER_PATH_VARS; do
    name="${pair%%:*}"; host_name="${pair#*:}"
    if [ -n "$host_name" ]; then
      eval "value=\${$host_name:-}"
      eval "cur=\${$name:-}"
      case "$cur" in
        /app|/app/*|/data|/data/*)
          [ -n "$value" ] || { die "$name is a container path ($cur) and its host sibling $host_name is EMPTY.
     A host process cannot be given either. Set $host_name, or take $name out of CONTAINER_PATH_VARS."; return 1; }
          ;;
      esac
      overrides="$overrides $name=$(printf '%q' "$value")"
    else
      # No host counterpart can exist (a named volume has no honest host address). Blank it: a host process
      # that needs it must fail saying UNSET, never chase a path into /data.
      overrides="$overrides $name="
    fi
  done
  # (2) EVERYTHING ELSE THAT LOOKS LIKE A CONTAINER PATH IS BLANKED, NOT REFUSED — and this is the correction
  #     that the box itself taught. The first version REFUSED on any FORGE_* under /app or /data, and the run
  #     died on `FORGE_THEMES_DIR=/app/themes-instance` and `FORGE_EXTENSIONS_DIR=/app/extensions` — container
  #     paths that are perfectly correct for the kernel and that NO host script reads. The rule was stated one
  #     notch too wide: what must never happen is a host process RECEIVING a container path, not one EXISTING
  #     in the environment. Blanking is strictly stronger than the old refusal (it covers every such variable
  #     rather than the two named above) and it stops nothing that does not need stopping. A host process that
  #     genuinely wanted one now fails with UNSET, which names itself.
  while IFS='=' read -r name value; do
    case "$name" in FORGE_*) ;; *) continue;; esac
    case " ${overrides} " in *" $name="*) continue;; esac
    case "$value" in
      /app|/app/*|/data|/data/*)
        overrides="$overrides $name="
        blanked="$blanked $name" ;;
    esac
  done < <(env)
  [ -z "$blanked" ] || note "host run: blanked container path(s) —$blanked"
  env $overrides node "$@"
}

say() { printf '\n\033[1m── %s\033[0m\n' "$*" >&2; }
note() { printf '   %s\n' "$*" >&2; }
die() { printf '\n[box-up] %s\n' "$*" >&2; exit 1; }

command -v jq >/dev/null || die 'jq is required.'
[ -f "$HERE/.env" ] || die 'no .env — copy .env.example to .env first.'

# ── THE TOPOLOGY, read from the ONE file that states it ─────────────────────────────────────────────────────
# `seed/box.json` is where the tenants, their stores and their settings are declared. Reading it here rather
# than repeating the ids means the sequence below cannot drift from what the seeder applies.
BOX="$HERE/seed/box.json"
[ -f "$BOX" ] || die "no seed/box.json — this script has no topology to build."
TENANTS="$(jq -r '.tenants[].id' "$BOX")"

secret_name_for() { # <tenant> <kind: seed|driver>
  # T1 keeps the unsuffixed names the box was born with, so nothing that already refers to them has to move.
  local t="$1" kind="$2" base
  base="$([ "$kind" = seed ] && echo forge-seed-token || echo forge-admin-service-token)"
  if [ "$t" = "$(echo "$TENANTS" | head -1)" ]; then printf '%s' "$base"; else printf '%s-%s' "$base" "$t"; fi
}

put_secret() { # <name> <value>  — never echoes the value
  local name="$1" value="$2" file="$HERE/.secrets"
  [ -n "$value" ] || return 1
  touch "$file"
  local tmp; tmp="$(mktemp)"
  grep -v "^${name}=" "$file" > "$tmp" 2>/dev/null || true
  printf '%s=%s\n' "$name" "$value" >> "$tmp"
  mv "$tmp" "$file"
  chmod 600 "$file"
}

# ── 0 · the environment ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ BEFORE STEP 1, AND THE VIRGIN-BOX TEST IS WHAT PUT IT HERE. This was sourced at step 5, on the reasoning
# that the tokens it exports are only minted at step 3 — and the very first `docker compose` call died on
# `required variable DATABASE_URL is missing a value`. Compose interpolates the WHOLE file on every command,
# so every variable any service needs must exist before the first one runs, not before the service that uses
# it starts. It is sourced AGAIN after step 4 to pick up what steps 3 and 4 minted.
#
# ⚠️ AND `.env` IS READ INTO THIS SHELL TOO, WHICH IS NOT THE SAME AS COMPOSE READING IT. Compose loads `.env`
# by itself for interpolation, so the CONTAINERS were always right — but this script's own `curl`s and its
# calls to `bin/seed-box.mjs` run on the HOST, where those variables did not exist. Measured on a virgin box:
# `FORGE_PUBLIC_ORIGIN` was unset here, the health check fell through to its `:-http://localhost:8200` default,
# and it cheerfully got a 200 FROM A DIFFERENT BOX that happened to be running on that port. A green that
# proves another machine is healthy is worse than a red.
# shellcheck disable=SC1091
set -a
. "$HERE/env-source.sh" >/dev/null 2>&1
[ -f "$HERE/.env" ] && . "$HERE/.env"
. "$HERE/bin/images-from-lock.sh" >/dev/null 2>&1
set +a
[ -n "${DATABASE_URL:-}" ] || die 'env-source.sh exported no DATABASE_URL — is .secrets missing forge-postgres-password?'
[ -n "${FORGE_PUBLIC_ORIGIN:-}" ] || die 'no FORGE_PUBLIC_ORIGIN in .env — this script would otherwise probe a default port that may belong to another box.'

# ── 1 · the data tier ───────────────────────────────────────────────────────────────────────────────────────
say '1 · postgres + redis'
dc up -d postgres redis >/dev/null 2>&1 || die 'could not start postgres/redis.'
note 'up'

# ── 2 · migrate ─────────────────────────────────────────────────────────────────────────────────────────────
say '2 · migrate'
dc run --rm kernel node dist/migrate.js 2>&1 | grep -E '^\[migrate\]' >&2 || die 'migrate failed.'

# ── 3 · provision-ref, once per tenant ──────────────────────────────────────────────────────────────────────
say '3 · provision-ref (once per tenant)'
for t in $TENANTS; do
  handle="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' "$BOX")"
  name="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.name' "$BOX")"
  ahost="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.admin_host // empty' "$BOX")"
  [ -n "$handle" ] || die "seed/box.json declares no bootstrap store for tenant \"$t\"."

  out="$(mktemp)"; err="$(mktemp)"
  dc run --rm \
    -e "FORGE_REF_TENANT=$t" -e "FORGE_REF_STORE_HANDLE=$handle" -e "FORGE_REF_STORE_NAME=$name" \
    ${ahost:+-e "FORGE_ADMIN_HOST=$ahost"} \
    kernel node dist/provision-ref.js > "$out" 2> "$err"

  # The two secrets ride out on stderr, each on the line after its label. Read them here and nowhere else.
  op="$(sed -n '/operator token/{n;s/^[[:space:]]*//;p;q;}' "$err")"
  drv="$(sed -n '/login-driver token/{n;s/^[[:space:]]*//;p;q;}' "$err")"
  store="$(tail -1 "$out" | tr -d '\r\n')"
  if [ -z "$store" ]; then
    # The run produced no store id, so something refused. Print the reason BEFORE shredding: a provisioning
    # failure that leaves only "store = ?" is the shape that sends somebody reading the wrong file.
    note "⚠️ provision-ref produced no store id for \"$t\" — its output follows:"
    sed 's/^/     /' "$err" >&2
    shred -u "$out" "$err" 2>/dev/null || rm -f "$out" "$err"
    die "provisioning \"$t\" failed."
  fi
  put_secret "$(secret_name_for "$t" seed)" "$op"   && s1=filed || s1='ABSENT'
  put_secret "$(secret_name_for "$t" driver)" "$drv" && s2=filed || s2='ABSENT'
  note "$t · store $handle = ${store:-?} · $(secret_name_for "$t" seed): $s1 · $(secret_name_for "$t" driver): $s2"
  grep -E 'retired|hostname claimed' "$err" | sed 's/^[[:space:]]*/   /' >&2
  shred -u "$out" "$err" 2>/dev/null || rm -f "$out" "$err"
done

# ── 4 · the box's own platform credential ───────────────────────────────────────────────────────────────────
say '4 · admin-platform-token (the box credential that serves every tenant)'
out="$(mktemp)"
dc run --rm kernel node dist/admin-platform-token.js > "$out" 2>/dev/null
tok="$(grep -oE '^fo[a-z]{2}_[A-Za-z0-9_-]+' "$out" | tail -1)"
put_secret forge-admin-platform-token "$tok" && note 'forge-admin-platform-token: filed' \
  || note '⚠️ forge-admin-platform-token: ABSENT — host mode will answer not_configured on every login'
shred -u "$out" 2>/dev/null || rm -f "$out"

# ── 5 · the rest of the tier ────────────────────────────────────────────────────────────────────────────────
say '5 · kernel + edge + fronts'
# RE-read here, after steps 3 and 4 wrote to `.secrets`: the tokens they minted have to reach the containers
# this step starts, and the copy loaded at step 0 predates them.
# shellcheck disable=SC1091
set -a; . "$HERE/env-source.sh" >/dev/null 2>&1; [ -f "$HERE/.env" ] && . "$HERE/.env"; . "$HERE/bin/images-from-lock.sh" >/dev/null 2>&1; set +a
dc up -d kernel caddy admin storefront checkout storefront-coffee >/dev/null 2>&1 || die 'could not start the tier.'
for i in $(seq 1 30); do
  code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}/health" || true)"
  [ "$code" = 200 ] && break
  sleep 2
done
[ "${code:-}" = 200 ] || die "the kernel never answered /health (last: ${code:-none}). \`docker compose logs kernel\`."
note "edge ${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}/health → 200"

# ── 6 · the terrain, once per tenant ────────────────────────────────────────────────────────────────────────
say '6 · seed-box (stores + settings, once per tenant)'
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"   # forge-seed-token → FORGE_SEED_TOKEN
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no \$$tokvar in the environment — step 3 filed it into .secrets; re-source env-source.sh."
  FORGE_SEED_TOKEN="$tokval" host_node "$HERE/bin/seed-box.mjs" --tenant "$t" || die "seed-box failed for $t."
done

# The counter's store id is only knowable now, and `compose.override.yml` refuses to interpolate without it.
balcao="$(jq -r '.tenants[]|.stores[]|select(.handle=="balcao")|.handle' "$BOX")"
if [ -n "$balcao" ]; then
  cafe_tok="$(secret_name_for "$(echo "$TENANTS" | tail -1)" seed | tr 'a-z-' 'A-Z_')"
  eval "cafe_tokval=\${$cafe_tok:-}"
  id="$(curl -s -m 10 "${FORGE_PUBLIC_ORIGIN}/v1/read/internal/stores" \
        -H "authorization: Bearer $cafe_tokval" -H "x-forge-tenant: $(echo "$TENANTS" | tail -1)" \
        | jq -r '.[]|select(.handle=="balcao")|.id' 2>/dev/null)"
  if [ -n "$id" ] && [ "$id" != null ]; then
    if grep -q '^FORGE_TOTEM_STORE_ID=' "$HERE/.env"; then
      sed -i "s|^FORGE_TOTEM_STORE_ID=.*|FORGE_TOTEM_STORE_ID=$id|" "$HERE/.env"
    else
      printf 'FORGE_TOTEM_STORE_ID=%s\n' "$id" >> "$HERE/.env"
    fi
    note "FORGE_TOTEM_STORE_ID → $id (written into .env)"
  fi
fi

# ── 7 · THE COUNTER'S TOTEM — and it could not have started at step 5 ───────────────────────────────────────
#
# ★ THE ORDER IS FORCED, not chosen. `compose.override.yml` declares
# `FORGE_TOTEM_STORE_ID: ${FORGE_TOTEM_STORE_ID:?…}` — a hard requirement, and the counter store does not
# exist until step 6 creates it. On a virgin box the id is a fresh ULID, so it cannot be written down
# anywhere in advance: step 6 RESOLVES it by reading the tenant's stores for the `balcao` handle and writes
# it into `.env`, and only then is there something for this service to start with. Starting it beside the
# other fronts is what left the first build of this box with four of the instance's six images.
say '7 · the totem (needs the counter store id that step 6 just resolved)'
set -a; [ -f "$HERE/.env" ] && . "$HERE/.env"; set +a
if [ -n "${FORGE_TOTEM_STORE_ID:-}" ] && [ "${FORGE_TOTEM_STORE_ID}" != 'sto_PENDING_SEED' ]; then
  dc up -d totem >/dev/null 2>&1 && note "totem up · store ${FORGE_TOTEM_STORE_ID}" \
    || note '⚠️ the totem did not start — `docker compose logs totem`'
else
  note '⚠️ no counter store id — skipping the totem (step 6 should have resolved it)'
fi

# ── 8 · THE CURATED DATA — and it must precede the massive one-shot ─────────────────────────────────────────
#
# ★ THE ORDER IS FORCED, NOT CHOSEN — the same trap as the totem, so it is written the same way. The wave's
# boundary is CURATED × MASSIVE: `bin/seed.mjs` owns what a HUMAN wrote (the six coffees, the counter's menu,
# the outlet's eight) and the dataset owns the generated volume AND THE ASSORTMENT. An assortment PUBLISHES a
# handle it did not define — so if the curated products are not there yet, the publish step has nothing to
# point at and refuses BY NAME:
#
#   populate refused (unknown_product): store "cafe" declares product "forge-alvorada" in its assortment,
#   and no such product exists — neither in this dataset nor in this tenant.
#
# That refusal is the guard SPEC §3.3 promised, and it is what caught this step missing. Anyone who moves the
# curated seed after the one-shot, or merges the two "because both fill data", brings that red straight back.
#
# BOTH TENANTS, EACH WITH ITS OWN TOKEN. The shoe tenant passed WITHOUT this once, by an accident of shape —
# its assortment selects by category regex rather than by handle — but the outlet's eight products are
# curated and belong here, so running it only where the red appeared would leave that store quietly different
# from what the demo expects.
say '8 · the curated data (once per tenant)'
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no \$$tokvar in the environment for the curated seed."
  # ⚠️ THE DATASET PATH IS REMAPPED HERE, AND IT IS NOT A DETAIL. `FORGE_SEED_DATASET_DIR` is the CONTAINER's
  # path (`/app/seed-dataset`) because the kernel is what reads it — but THIS script runs on the HOST, where
  # that path does not exist. Handing it through unchanged is how the curated seed died with
  # `FORGE_SEED_DATASET_DIR=/app/seed-dataset does not exist`: one variable name serving two filesystems.
  # The host's copy of the same directory is `FORGE_SEED_DATASET_HOST_DIR`, and that is what a host process
  # must be given.
  FORGE_SEED_TOKEN="$tokval" host_node "$HERE/bin/seed.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN" \
    || die "the curated seed failed for \"$t\". Its own output is above; nothing further has run."
done

# ── 9 · the catalogue, once per tenant ──────────────────────────────────────────────────────────────────────
say '9 · seed-demo (the catalogue, once per tenant)'
for t in $TENANTS; do
  handle="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' "$BOX")"
  # FORGE_SEED_DEMO=1 is the entrypoint's own opt-in: the in-process runner bypasses the type-to-confirm, so it
  # demands an explicit one. POPULATE-only; the destructive `wipe` is not on this path.
  # ★★ THE ACTION CEILING IS LIFTED HERE AND NOWHERE ELSE — on THIS invocation, never on the kernel service.
  #
  # `DEFAULT_ACTION_TIMEOUT_MS` is 300_000 (5 minutes) and it is a LIVENESS guard for whoever CALLS: it exists
  # so an operator who fires an action is not left with a spinner forever. A bulk import one-shot is not an
  # interactive action — nobody is watching a screen, and the process exists in order to finish. So the
  # ceiling is raised for THIS RUN and the standing kernel keeps its default.
  #
  # THE NUMBER IS DERIVED, NOT GUESSED. Measured on the run that failed: 1,287 products written in 300s, so
  # 2,790 need ~650s. 1,800,000 (30 min) is nearly 3x that — head-room because the FIRST run also hydrates
  # media, and because a ceiling you have to revisit in a fortnight is not a ceiling.
  #
  # ⚠️ AND WHY THE ANSWER IS NOT TO LET IT BLOW. The timeout does NOT cancel the action (`timeout.ts` says so
  # in its own words: the caller stops waiting, the writer does not stop), and this entrypoint's `finally`
  # then closes the pool underneath that abandoned writer. What comes out is a HALF-WRITTEN catalogue and an
  # error naming the POOL instead of the ceiling. There is no one-line repair for an abandoned bulk write.
  dc run --rm -e "FORGE_REF_TENANT=$t" -e "FORGE_REF_STORE_HANDLE=$handle" -e FORGE_SEED_DEMO=1 \
    -e "FORGE_EXTENSION_ACTION_TIMEOUT_MS=${FORGE_SEED_ACTION_TIMEOUT_MS:-1800000}" \
    kernel node dist/seed-demo.js 2>&1 | tail -6 >&2 \
    || note "⚠️ seed-demo failed for \"$t\". The kernel's own words are the six lines above — read those, not this.
     ⛔ I DO NOT KNOW WHETHER RE-RUNNING FIXES IT, and saying so is the honest answer: of the three ways this
     step has failed so far, NONE was repaired by repetition (an action ceiling, a missing step before it, and
     a curated product that did not exist yet). A default of \"just run it again\" is right for the failure
     somebody imagined and wrong for the one that happened.
     What IS known: steps 1-8 completed, so the box and its curated data are standing; only this fill did not."
done

say 'the bench'
note "shop      ${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}"
for t in $TENANTS; do
  note "admin     http://$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.admin_host' "$BOX")   → $t"
done
note "café      ${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}/s/<cafe store id>   (the forked vitrine)"
note "totem     http://localhost:${FORGE_TOTEM_HTTP_PORT:-8203}"
printf '\n' >&2
