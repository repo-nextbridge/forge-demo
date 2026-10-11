#!/usr/bin/env bash
# ★ THE DEMO'S SEED HOOK FOR THE FORGE BENCH KIT. Run by `bash bench/up.sh` (step 7/8) on EVERY `up`, because
# bench/bench.env declares it (`FORGE_BENCH_SEED_HOOK`). Not meant to be run by hand.
#
# What the kit hands it — the contract is at step 7 of bench/up.sh (kit of IB-4): every tenant
# (FORGE_BENCH_TENANT_IDS, the first is the one the shop's door serves) and, per tenant, its store and the FILE
# holding its operator credential (FORGE_BENCH_TENANTS_FILE = .forge-bench/tenants.json — read here, never
# printed); the shop's public and loopback origins; FORGE_BENCH_CA_FILE when promoted to a host or IP; and two
# files to write: what it learned (FORGE_BENCH_HOOK_ENV_FILE) and what it skipped (FORGE_BENCH_HOOK_REPORT_FILE).
#
# What it runs — the steps of `bin/box-up.sh` that are this box's DATA, for BOTH tenants of seed/box.json, by
# the same scripts and in the same order (the numbers are box-up's):
#    6     seed-box      × tenant  the second stores (outlet, balcão) and the settings every screen inherits
#    3c/7  the café's ids          its store (the kit provisioned it) and the counter's (seed-box created it)
#                                  written to .forge-bench/hook.env, and the café's edge rule generated from
#                                  box-up's OWN template (read out of bin/box-up.sh, never copied)
#    6b    store-host              the root store claims FORGE_BENCH_ORIGIN — a promotion is a re-`up`, so the
#                                  claim moves with the address
#    7     the café's fork and the totem, started here (they are held by the kit: FORGE_BENCH_AFTER_HOOK)
#    8     seed          × tenant  the CURATED catalogue
#    9-12  only with FORGE_DEMO_BENCH_DATASET=1 in the shell: the MASSIVE catalogue (seed-demo, ~23 min on a
#          bench, README "What it costs") for every tenant seed/box.json gives the dataset to (`dataset: true` —
#          box-up's rule: the coffee shop is never filled with shoes), speaking every minute through box-up's OWN
#          block (read out of bin/box-up.sh between its markers); then, for EVERY tenant, the shop window (11)
#          and the data verdict (12). Without the massive, verify-seed is RED by construction (measured
#          2026-10-10: "7 check(s) NOT settled" — it grades the catalogue the one-shot fills), so 12 runs only
#          after 9.
#    14-bis prove-doors  × tenant  every door of the tenant's stores, opened anonymously — the café's fork and
#                                  the counter's totem included
#
# Every call goes to the shop's LOOPBACK door (FORGE_BENCH_LOOPBACK_ORIGIN), also on a promoted bench: it stays
# open after a promotion (bench/up.sh says so). What it does NOT do is written to the kit's report, which `up`
# repeats at its end; README §2 "What the kit bench does not cover" says why each is still box-up's.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

say() { echo "[bench-demo] $*" >&2; }
die() {
  echo "[bench-demo] ⛔ $*" >&2
  exit 1
}

for name in FORGE_BENCH_TENANT FORGE_BENCH_TENANTS_FILE FORGE_BENCH_LOOPBACK_ORIGIN FORGE_BENCH_ORIGIN FORGE_BENCH_HOOK_ENV_FILE FORGE_BENCH_HOOK_REPORT_FILE; do
  [ -n "${!name:-}" ] || die "$name is not set — this hook is run by \`bash bench/up.sh\`, which sets it."
done

# shellcheck source=../bin/require-node.sh
. "$HERE/bin/require-node.sh"
require_node || exit 1

# ⛔ A CONTAINER PATH MAY NEVER REACH A HOST PROCESS (README §2, and `host_node` in bin/box-up.sh, which this
# mirrors). bench/bench.env declares FORGE_SEED_DATASET_DIR=/app/seed-dataset for the KERNEL, and the kit exports
# it into this hook too. Measured 2026-10-10 on the first live run with the dataset: step 9 rc=0 after 29 min,
# then step 11 died «FORGE_SEED_DATASET_DIR=/app/seed-dataset holds no forge-seed-dataset.json». So every host
# script gets the dataset's HOST path (FORGE_SEED_DATASET_HOST_DIR, made absolute) and no other /app or /data path.
host_node() {
  local ds="${FORGE_SEED_DATASET_HOST_DIR:-}" name value blank=()
  case "$ds" in '' | /*) ;; *) ds="$HERE/${ds#./}" ;; esac
  while IFS='=' read -r name value; do
    case "$name" in FORGE_*) ;; *) continue ;; esac
    case "$value" in /app | /app/* | /data | /data/*) blank+=("$name=") ;; esac
  done < <(env)
  env ${blank[@]+"${blank[@]}"} FORGE_SEED_DATASET_DIR="$ds" node "$@"
}

root="$FORGE_BENCH_TENANT"
api="$FORGE_BENCH_LOOPBACK_ORIGIN"
# ⛔ PROMOTED TO A HOST OR IP, THE STORE'S ADDRESS IS THE https DOOR, and the scripts below follow it: 6b claims
# it, and 14-bis opens every door AT the address the store claims — not at --api. Measured 2026-10-10 (IB-3),
# first promotion of this hook to 192.168.1.221 without this: «forge/ — could not be reached: fetch failed» on
# all four doors, «NOT ONE door of forgeco was opened», the `up` red — Node does not trust the bench's local CA.
# The kit hands the file it proved those doors with (empty on localhost and on a tailnet, whose CA is public).
[ -z "${FORGE_BENCH_CA_FILE:-}" ] || export NODE_EXTRA_CA_CERTS="$FORGE_BENCH_CA_FILE"
# A tenant's credential is a FILE the kit wrote (tenants.json says whose); it is read into the one variable the
# scripts read, never printed.
token_of() {
  local f
  f="$(jq -r --arg t "$1" '.[] | select(.tenant == $t) | .operator_token_file' "$FORGE_BENCH_TENANTS_FILE")"
  [ -s "$f" ] || die "the kit filed no operator credential for $1 (tenants.json: '$f')."
  cat "$f"
}
as_tenant() { FORGE_OPERATOR_TOKEN="$(token_of "$1")" && export FORGE_OPERATOR_TOKEN; }
store_of() { jq -r --arg t "$1" '.[] | select(.tenant == $t) | .store_id' "$FORGE_BENCH_TENANTS_FILE"; }
report() { printf '%s\n' "$*" >>"$FORGE_BENCH_HOOK_REPORT_FILE"; }
# What seed/box.json says about the tenants the kit was told about (bench/bench.env FORGE_BENCH_TENANTS): who owns
# the counter (the café, whose fork and totem this hook starts), and who the mounted dataset is about.
in_bench() { case " $FORGE_BENCH_TENANT_IDS " in *" $1 "*) return 0 ;; esac; return 1; }
counter_tenant="$(jq -r '.tenants[] | select(any(.stores[]; .handle == "balcao")) | .id' seed/box.json | head -1)"
in_bench "$counter_tenant" ||
  die "the café ('$counter_tenant', the tenant of seed/box.json that owns the counter) is not a tenant of this bench ($FORGE_BENCH_TENANT_IDS) — its fork and totem are held for after this hook (FORGE_BENCH_AFTER_HOOK) and could not start."

for tenant in $FORGE_BENCH_TENANT_IDS; do
  as_tenant "$tenant"
  say "6 · seed-box ($tenant)"
  host_node bin/seed-box.mjs --tenant "$tenant" --api "$api" || die "seed-box failed for $tenant (above)."
done

# 3c/7 · What the café's two services need, learned here and handed to the kit: the café's store (provisioned by
# the kit) and the counter's (created by seed-box just now) — box-up writes the same two names into `.env`.
cafe_store="$(store_of "$counter_tenant")"
counter="$(curl -fsS -m 10 "$FORGE_BENCH_KERNEL_URL/v1/read/internal/stores" -H "authorization: Bearer $(token_of "$counter_tenant")" \
  -H "x-forge-tenant: $counter_tenant" | jq -r '.[] | select(.handle == "balcao") | .id')"
[ -n "$cafe_store" ] && [ -n "$counter" ] || die "the café's store or its counter store is unknown (cafe='$cafe_store' counter='$counter')."
printf 'FORGE_COFFEE_STORE_ID=%s\nFORGE_TOTEM_STORE_ID=%s\n' "$cafe_store" "$counter" >"$FORGE_BENCH_HOOK_ENV_FILE"
say "3c/7 · the café is $cafe_store, its counter $counter — handed to the kit (.forge-bench/hook.env)"
# 3c · the café fork's edge rule, generated from the café's id by box-up's OWN template (the heredoc of its
# step 3c, read out of bin/box-up.sh — a copy here would rot the day box-up's rule changes).
mkdir -p caddy/extra-local
sed -n '/^  cat > "$HERE\/caddy\/extra-local\/coffee.caddy" <<CADDY$/,/^CADDY$/p' bin/box-up.sh | sed '1d;$d' |
  sed "s/\${CAFE_STORE}/$cafe_store/g" >caddy/extra-local/coffee.caddy
grep -q "$cafe_store" caddy/extra-local/coffee.caddy || die "bin/box-up.sh no longer carries step 3c's template."
# caddy/Caddyfile.local runs with `admin off` — a reload is a restart.
bash "$HERE/bench/compose.sh" restart caddy </dev/null >/dev/null 2>&1 || die "the edge did not restart with the café's rule."

as_tenant "$root"
say "6b · the root store claims $FORGE_BENCH_ORIGIN"
host_node bin/store-host.mjs --tenant "$root" --api "$api" --origin "$FORGE_BENCH_ORIGIN" --store "$FORGE_BENCH_STORE_ID" ||
  die "the root store could not claim $FORGE_BENCH_ORIGIN (above)."

# 7 · The café's fork and the totem are held by the kit until this hook ends (FORGE_BENCH_AFTER_HOOK), and 14-bis
# below opens their doors. Measured 2026-10-10 (IB-4, the first run of this hook): left to the kit's step 8, the
# café answered 502 to 14-bis. So they start here, through the kit's compose, which reads hook.env.
say "7 · the café's fork and the totem (with the ids learned above)"
bash "$HERE/bench/compose.sh" up -d --wait --no-deps storefront-coffee totem </dev/null >&2 ||
  die "the café's fork or the totem did not come up (above)."

for tenant in $FORGE_BENCH_TENANT_IDS; do
  as_tenant "$tenant"
  say "8 · the curated data ($tenant)"
  host_node bin/seed.mjs --tenant "$tenant" --api "$api" || die "the curated seed failed for $tenant (above)."
done

if [ "${FORGE_DEMO_BENCH_DATASET:-}" = 1 ]; then
  # box-up's speaking seed, sourced from box-up itself: `dc` and `note` are the two names it calls, given
  # the kit's meaning here (every compose call of a kit bench goes through bench/compose.sh).
  speaking="$(sed -n '/^# >>> THE SPEAKING SEED$/,/^# <<< THE SPEAKING SEED$/p' bin/box-up.sh)"
  [ -n "$speaking" ] || die "bin/box-up.sh no longer carries the block between '# >>> THE SPEAKING SEED' and its end marker."
  dc() { bash "$HERE/bench/compose.sh" "$@" </dev/null; }
  note() { printf '   %s\n' "$*" >&2; }
  eval "$speaking"
  # ⛔ ONLY THE TENANTS THE DATASET IS ABOUT (seed/box.json `dataset: true`) — box-up's step 9 rule, and its
  # measurement (02/09): the same one-shot pointed at the café filled it with 2 790 footwear products.
  for tenant in $FORGE_BENCH_TENANT_IDS; do
    if [ "$(jq -r --arg t "$tenant" '.tenants[] | select(.id == $t) | .dataset == true' seed/box.json)" != true ]; then
      say "9 · $tenant does not carry the example dataset (seed/box.json: dataset != true) — not filled, as box-up does"
      continue
    fi
    handle="$(jq -r --arg t "$tenant" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' seed/box.json)"
    say "9 · seed-demo ($tenant, store $handle) — the massive catalogue; it speaks every ${FORGE_SEED_HEARTBEAT_S:-60} s"
    seed_demo_speaking "$tenant" "$handle" || die "seed-demo failed for $tenant (above)."
  done
  for tenant in $FORGE_BENCH_TENANT_IDS; do
    as_tenant "$tenant"
    say "11 · the shop window ($tenant)"
    host_node bin/seed.mjs --tenant "$tenant" --api "$api" --phase window || die "the window failed for $tenant (above)."
  done
  for tenant in $FORGE_BENCH_TENANT_IDS; do
    as_tenant "$tenant"
    say "12 · the verdict over the data ($tenant)"
    host_node bin/verify-seed.mjs --tenant "$tenant" --api "$api" || die "verify-seed: $tenant did not settle (above)."
    host_node bin/verify-content.mjs --tenant "$tenant" --api "$api" || die "verify-content: $tenant did not settle (above)."
  done
else
  say "9-12 · skipped — the massive catalogue is asked with FORGE_DEMO_BENCH_DATASET=1 (~23 min); this bench holds the curated one"
  report "9-12 skipped — the massive catalogue is asked with FORGE_DEMO_BENCH_DATASET=1 (~23 min); this bench holds the curated one"
fi
report "10, 13-15 and the roteiro are bin/box-up.sh's (history, edge/bucket, warming, configuration verdict) — README §2"

for tenant in $FORGE_BENCH_TENANT_IDS; do
  as_tenant "$tenant"
  say "14-bis · every door of $tenant, opened anonymously"
  host_node bin/prove-doors.mjs --tenant "$tenant" --api "$api" || die "a door of $tenant does not answer as it must (above)."
done
