#!/usr/bin/env bash
# TAKE THIS INSTANCE'S BENCH DOWN.
#
#   bash bench/down.sh        stop and remove the containers; the database and the bench's secrets are KEPT
#   bash bench/down.sh -v     …and the volumes and .forge-bench/ too: the next `up` is born from zero — on
#                             localhost, since the promotion lives in .forge-bench/address.env
#
# Refused from any copy of this repository but the one that brought the project up (the same check `up` makes):
# from another copy, a teardown would take that copy's bench down while reading this copy's files.
#
# Exits non-zero, naming them, if any container or network of the project survives — an exit code is what a
# script that runs this reads, and `docker compose down` exits 0 with survivors in more than one situation.
set -euo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

volumes=0
for arg in "$@"; do
  case "$arg" in
    -v | --volumes) volumes=1 ;;
    -h | --help)
      sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) bench_die "unknown argument '$arg' (expected -v)" ;;
  esac
done

bench_prepare
bench_refuse_foreign_project
# A bench that never came up has no secrets yet; compose still has to parse the files to find the project.
: "${FORGE_BENCH_POSTGRES_PASSWORD:=not-minted}" "${FORGE_VAULT_KEY:=not-minted}"
export FORGE_BENCH_POSTGRES_PASSWORD FORGE_VAULT_KEY

# `--profile edge-tls`: the https edge of a promoted bench is a profiled service, and compose leaves a profiled
# service's container, its network and its volume behind when the profile is not named (measured 2026-10-10,
# compose 5.3.1 — `down -v` left all three).
if [ "$volumes" = 1 ]; then
  bench_say "taking '$COMPOSE_PROJECT_NAME' down WITH its volumes — the database and the bench's secrets go too"
  bench_compose --profile edge-tls down -v --remove-orphans
else
  bench_say "taking '$COMPOSE_PROJECT_NAME' down — the database is kept (bash bench/down.sh -v drops it)"
  bench_compose --profile edge-tls down --remove-orphans
fi

survivors="$(docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.Names}}' 2>/dev/null || true)"
networks="$(docker network ls --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.Name}}' 2>/dev/null || true)"
if [ -n "$survivors$networks" ]; then
  bench_die "'$COMPOSE_PROJECT_NAME' is NOT down — still here: $(printf '%s ' $survivors $networks)"
fi
if [ "$volumes" = 1 ]; then
  rm -rf "$BENCH_STATE"
  left="$(docker volume ls --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.Name}}' 2>/dev/null || true)"
  [ -z "$left" ] || bench_die "volumes of '$COMPOSE_PROJECT_NAME' survived: $(printf '%s ' $left)"
fi
bench_say "'$COMPOSE_PROJECT_NAME' is down: no container and no network carries its label."
# A bench that was on the tailnet leaves its doors published there, pointing at ports nothing answers now. Said,
# never run: releasing a door is configuring the network.
[ "${BENCH_LAST_DESTINATION:-$BENCH_DESTINATION}" != tailnet ] || bench_tailnet_release_notice
