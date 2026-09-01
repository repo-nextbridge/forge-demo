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
#   5. kernel + edge + fronts    now that a tenant exists for them to serve
#   6. seed-box.mjs   × TENANT   the remaining stores, the settings every screen inherits
#   7. seed-demo      × TENANT   the CATALOGUE — the one-shot that fills, run once per tenant
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
dc up -d kernel caddy admin storefront checkout >/dev/null 2>&1 || die 'could not start the tier.'
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
  FORGE_SEED_TOKEN="$tokval" node "$HERE/bin/seed-box.mjs" --tenant "$t" || die "seed-box failed for $t."
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

# ── 7 · the catalogue, once per tenant ──────────────────────────────────────────────────────────────────────
say '7 · seed-demo (the catalogue, once per tenant)'
for t in $TENANTS; do
  handle="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' "$BOX")"
  # FORGE_SEED_DEMO=1 is the entrypoint's own opt-in: the in-process runner bypasses the type-to-confirm, so it
  # demands an explicit one. POPULATE-only; the destructive `wipe` is not on this path.
  dc run --rm -e "FORGE_REF_TENANT=$t" -e "FORGE_REF_STORE_HANDLE=$handle" -e FORGE_SEED_DEMO=1 \
    kernel node dist/seed-demo.js 2>&1 | tail -6 >&2 \
    || note "⚠️ seed-demo failed for $t — the terrain is built; re-run this script to retry."
done

say 'the bench'
note "shop      ${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}"
for t in $TENANTS; do
  note "admin     http://$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.admin_host' "$BOX")   → $t"
done
note "totem     http://localhost:${FORGE_TOTEM_HTTP_PORT:-8203}"
printf '\n' >&2
