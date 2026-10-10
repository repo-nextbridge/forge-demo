#!/usr/bin/env bash
# ★ IB-3 — THE DEMO'S SEED HOOK FOR THE FORGE BENCH KIT. Run by `bash bench/up.sh` (step 7/7) on EVERY `up`,
# because bench/bench.env declares it (`FORGE_BENCH_SEED_HOOK`). Not meant to be run by hand.
#
# What the kit hands it (bench/up.sh, step 7): FORGE_BENCH_TENANT, FORGE_BENCH_STORE_ID, and the operator
# credential as a FILE (FORGE_BENCH_OPERATOR_TOKEN_FILE — read here, never printed); plus what `up` exported:
# FORGE_BENCH_ORIGIN (the address a browser opens — localhost, or the promoted https door) and FORGE_HTTP_PORT.
#
# What it runs — the steps of `bin/box-up.sh` that are this box's DATA, for the kit's one tenant, by the same
# scripts and in the same order (the numbers are box-up's):
#    6     seed-box      the second store (outlet) and the settings every screen inherits
#    6b    store-host    the root store claims FORGE_BENCH_ORIGIN in the kernel's directory — so a promotion,
#                        which is a re-`up`, moves the claim with the address
#    8     seed          the CURATED catalogue
#    9-12  only with FORGE_DEMO_BENCH_DATASET=1 in the shell: the MASSIVE catalogue (seed-demo, ~23 min on a
#          bench, README "What it costs"), speaking every minute through box-up's OWN block (read out of
#          bin/box-up.sh between its markers, never copied), then the shop window (11) and the data verdict (12).
#          Without the massive, verify-seed is RED by construction (measured 2026-10-10: "7 check(s) NOT
#          settled" — it grades the catalogue the one-shot fills), so 12 runs only after 9.
#    14-bis prove-doors  every door of the tenant's stores, opened anonymously
#
# Every call goes to the shop's LOOPBACK door (http://localhost:<NN00>), also on a promoted bench: the https
# door answers with the kit's local CA, which this machine's Node does not trust, and the loopback door stays
# open after a promotion (bench/up.sh says so).
#
# NOT here, and why — README §2 "What the kit bench does not cover": the second tenant (3 × forgecafe, 7 the
# totem, 3c the café's edge rule), the box credentials (4 platform token, 4b bulk reader, 5b access keys), the
# past (10 seed-history), the edge and the bucket (13), the warming (14), the configuration verdict (15).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

say() { echo "[bench-demo] $*" >&2; }
die() {
  echo "[bench-demo] ⛔ $*" >&2
  exit 1
}

for name in FORGE_BENCH_TENANT FORGE_BENCH_STORE_ID FORGE_BENCH_OPERATOR_TOKEN_FILE FORGE_BENCH_ORIGIN FORGE_HTTP_PORT; do
  [ -n "${!name:-}" ] || die "$name is not set — this hook is run by \`bash bench/up.sh\`, which sets it."
done
[ -s "$FORGE_BENCH_OPERATOR_TOKEN_FILE" ] || die "the kit's operator credential file is empty: $FORGE_BENCH_OPERATOR_TOKEN_FILE"

# shellcheck source=../bin/require-node.sh
. "$HERE/bin/require-node.sh"
require_node || exit 1

tenant="$FORGE_BENCH_TENANT"
api="http://localhost:$FORGE_HTTP_PORT"
FORGE_OPERATOR_TOKEN="$(cat "$FORGE_BENCH_OPERATOR_TOKEN_FILE")"
export FORGE_OPERATOR_TOKEN

say "6 · seed-box ($tenant)"
node bin/seed-box.mjs --tenant "$tenant" --api "$api" || die "seed-box failed for $tenant (above)."

say "6b · the root store claims $FORGE_BENCH_ORIGIN"
node bin/store-host.mjs --tenant "$tenant" --api "$api" --origin "$FORGE_BENCH_ORIGIN" --store "$FORGE_BENCH_STORE_ID" ||
  die "the root store could not claim $FORGE_BENCH_ORIGIN (above)."

say "8 · the curated data ($tenant)"
node bin/seed.mjs --tenant "$tenant" --api "$api" || die "the curated seed failed for $tenant (above)."

if [ "${FORGE_DEMO_BENCH_DATASET:-}" = 1 ]; then
  # box-up's speaking seed, sourced from box-up itself: `dc` and `note` are the two names it calls, given
  # the kit's meaning here (every compose call of a kit bench goes through bench/compose.sh).
  speaking="$(sed -n '/^# >>> THE SPEAKING SEED$/,/^# <<< THE SPEAKING SEED$/p' bin/box-up.sh)"
  [ -n "$speaking" ] || die "bin/box-up.sh no longer carries the block between '# >>> THE SPEAKING SEED' and its end marker."
  dc() { bash "$HERE/bench/compose.sh" "$@" </dev/null; }
  note() { printf '   %s\n' "$*" >&2; }
  eval "$speaking"
  handle="$(jq -r --arg t "$tenant" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' seed/box.json)"
  say "9 · seed-demo ($tenant, store $handle) — the massive catalogue; it speaks every ${FORGE_SEED_HEARTBEAT_S:-60} s"
  seed_demo_speaking "$tenant" "$handle" || die "seed-demo failed for $tenant (above)."
  say "11 · the shop window ($tenant)"
  node bin/seed.mjs --tenant "$tenant" --api "$api" --phase window || die "the window failed for $tenant (above)."
  say "12 · the verdict over the data ($tenant)"
  node bin/verify-seed.mjs --tenant "$tenant" --api "$api" || die "verify-seed: $tenant did not settle (above)."
  node bin/verify-content.mjs --tenant "$tenant" --api "$api" || die "verify-content: $tenant did not settle (above)."
else
  say "9-12 · skipped — the massive catalogue is asked with FORGE_DEMO_BENCH_DATASET=1 (~23 min); this bench holds the curated one"
fi

say "14-bis · every door of $tenant, opened anonymously"
node bin/prove-doors.mjs --tenant "$tenant" --api "$api" || die "a door of $tenant does not answer as it must (above)."
