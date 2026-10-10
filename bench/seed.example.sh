#!/usr/bin/env bash
# AN EXAMPLE SEED HOOK — one product, created and published through the port, the way any integration would.
#
# Declare it in bench/bench.env (or replace it with your importer, your dataset, your own app's seed action):
#
#   FORGE_BENCH_SEED_HOOK=bash bench/seed.example.sh
#
# bench/up.sh runs the hook after the box is up, from this repository's root, with:
#   FORGE_BENCH_KERNEL_URL           the kernel, as this machine reaches it
#   FORGE_BENCH_TENANT               the tenant the bench was born with
#   FORGE_BENCH_STORE_ID             its store
#   FORGE_BENCH_OPERATOR_TOKEN_FILE  a file holding the operator credential (read it; never print it)
#
# It runs on EVERY `up`, so it converges: a product that already answers is left alone.
set -euo pipefail

# @env FORGE_BENCH_TENANT required — The tenant an instance bench was born with, handed to its seed hook.
# @env FORGE_BENCH_STORE_ID required — The store an instance bench was born with, handed to its seed hook.
# @env FORGE_BENCH_OPERATOR_TOKEN_FILE required — A file holding the operator credential, handed to an instance bench's seed hook (read it, never print it).
kernel="${FORGE_BENCH_KERNEL_URL:?run by bench/up.sh}"
tenant="${FORGE_BENCH_TENANT:?run by bench/up.sh}"
store="${FORGE_BENCH_STORE_ID:?run by bench/up.sh}"
token="$(cat "${FORGE_BENCH_OPERATOR_TOKEN_FILE:?run by bench/up.sh}")"
handle=bench-sample

published() { curl -fsS -o /dev/null "$kernel/v1/read/product.by_handle?store=$store&handle=$handle" 2>/dev/null; }

if published; then
  echo "[seed] '$handle' already answers on the public read — nothing to do" >&2
  exit 0
fi

# Every command is a POST to /v1/commands/<name> with the credential and the tenant it acts in. The input of
# each one is its page in the Forge reference (catalog.product.create, catalog.product.publish).
command() { # <name> <json>
  curl -fsS -X POST "$kernel/v1/commands/$1" \
    -H "Authorization: Bearer $token" -H "x-forge-tenant: $tenant" -H 'content-type: application/json' \
    -d "$2"
}

product_id="$(command catalog.product.create \
  "{\"title\":\"Bench sample\",\"handle\":\"$handle\",\"status\":\"active\",\"skus\":[{\"code\":\"BENCH-1\",\"amount\":12900,\"currency\":\"BRL\"}]}" |
  jq -r '.product_id')"
command catalog.product.publish "{\"product_id\":\"$product_id\",\"store_id\":\"$store\"}" >/dev/null

# The public read is a PROJECTION, filled from the event log a moment after the command commits — a read in
# the same second answers 404. Wait for it, so whatever runs after the hook finds the product there.
for _ in $(seq 1 60); do
  published && {
    echo "[seed] '$handle' ($product_id) published in store $store" >&2
    exit 0
  }
  sleep 0.5
done
echo "[seed] '$handle' was created and published but the public read never answered for it" >&2
exit 1
