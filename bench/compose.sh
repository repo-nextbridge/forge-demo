#!/usr/bin/env bash
# `docker compose`, as this instance's bench calls it — the same files, the same env file, the same project.
#
#   bash bench/compose.sh ps
#   bash bench/compose.sh logs -f kernel
#   bash bench/compose.sh exec postgres psql -U forge forge
#
# A bare `docker compose` in this directory runs PRODUCTION's file alone (no database, ports 80/443, your
# `.env`); use this one for the bench.
set -euo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
bench_prepare
: "${FORGE_BENCH_POSTGRES_PASSWORD:=not-minted}" "${FORGE_VAULT_KEY:=not-minted}"
export FORGE_BENCH_POSTGRES_PASSWORD FORGE_VAULT_KEY
bench_compose "$@"
