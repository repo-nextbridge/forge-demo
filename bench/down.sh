#!/usr/bin/env bash
# TAKE THIS INSTANCE'S BENCH DOWN.
#
#   bash bench/down.sh        stop and remove the containers; the database and the bench's secrets are KEPT
#   bash bench/down.sh -v     …and the volumes and .forge-bench/ too: the next `up` is born from zero — on
#                             localhost, since the promotion lives in .forge-bench/address.env — except the
#                             volumes bench/bench.env says to keep (FORGE_BENCH_KEEP_VOLUMES: a cache that costs
#                             an hour to refill), and any volume ANOTHER project created
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
      sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
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

# Every profile named — the instance's own and the bench's `edge-tls`: compose leaves a profiled service's
# container, its network and its volume behind when the profile is not named (measured 2026-10-10, compose 5.3.1
# — `down -v` left all three).
mapfile -t profiles < <(bench_profiles)

# ★ WHICH VOLUMES `-v` REMOVES. `compose down -v` removes every volume the project DECLARES, by its name — and a
# volume declared with a fixed `name:` (one cache shared by every bench of a machine) is removed by the `down -v`
# of ANY project that declares it, whoever created it (measured on the reference instance, 2026-10-10, compose
# 5.3.1: «volume … created for project "a" (expected "b")», then removed). So when this instance declares a
# volume to keep (FORGE_BENCH_KEEP_VOLUMES, its key in the compose file or its full name) or a volume with a
# name of its own, `-v` is done by hand instead: the containers and their anonymous volumes, the network, then
# the volumes compose labelled as THIS project's — never one another project created, never one declared kept.
# With neither, it is compose's own `down -v`, exactly as before.
# @env FORGE_BENCH_KEEP_VOLUMES optional — Volumes an instance bench's `bench/down.sh -v` keeps (space separated; the key in the compose file or the volume's full name) — a cache that is expensive to refill.
selective=''
if [ "$volumes" = 1 ]; then
  named="$(bench_compose config --format json 2>/dev/null | jq -r --arg p "$COMPOSE_PROJECT_NAME" '
    (.volumes // {}) | to_entries[] | select((.value.external // false) | not)
    | select((.value.name // ($p + "_" + .key)) != ($p + "_" + .key)) | .key' 2>/dev/null || true)"
  [ -z "${FORGE_BENCH_KEEP_VOLUMES:-}$named" ] || selective=1
fi
if [ "$volumes" = 1 ] && [ -z "$selective" ]; then
  bench_say "taking '$COMPOSE_PROJECT_NAME' down WITH its volumes — the database and the bench's secrets go too"
  bench_compose "${profiles[@]}" down -v --remove-orphans
elif [ "$volumes" = 1 ]; then
  keep_list="${FORGE_BENCH_KEEP_VOLUMES:-}"
  bench_say "taking '$COMPOSE_PROJECT_NAME' down WITH its volumes, volume by volume — only those compose labelled as this project's, and not the ones declared kept (FORGE_BENCH_KEEP_VOLUMES: ${keep_list:-nothing declared})${named:+; declared with a name of their own: $(echo $named)}"
  bench_compose "${profiles[@]}" rm -s -f -v
  bench_compose "${profiles[@]}" down --remove-orphans
  kept=''
  while read -r vol key; do
    [ -n "$vol" ] || continue
    case " ${FORGE_BENCH_KEEP_VOLUMES:-} " in
      *" $vol "* | *" $key "*) kept="$kept $vol" && continue ;;
    esac
    docker volume rm "$vol" >/dev/null || bench_die "could not remove the volume $vol (above)."
  done < <(docker volume ls --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
    --format '{{.Name}} {{.Label "com.docker.compose.volume"}}' 2>/dev/null || true)
else
  bench_say "taking '$COMPOSE_PROJECT_NAME' down — the database is kept (bash bench/down.sh -v drops it)"
  bench_compose "${profiles[@]}" down --remove-orphans
fi

survivors="$(docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.Names}}' 2>/dev/null || true)"
networks="$(docker network ls --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.Name}}' 2>/dev/null || true)"
if [ -n "$survivors$networks" ]; then
  bench_die "'$COMPOSE_PROJECT_NAME' is NOT down — still here: $(printf '%s ' $survivors $networks)"
fi
if [ "$volumes" = 1 ]; then
  rm -rf "$BENCH_STATE"
  left=''
  for vol in $(docker volume ls --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.Name}}' 2>/dev/null || true); do
    case " ${kept:-} " in *" $vol "*) ;; *) left="$left $vol" ;; esac
  done
  [ -z "$left" ] || bench_die "volumes of '$COMPOSE_PROJECT_NAME' survived:$left"
  [ -z "${kept:-}" ] || bench_say "kept, as bench/bench.env declares (FORGE_BENCH_KEEP_VOLUMES):$kept — \`docker volume rm\` to drop one"
fi
bench_say "'$COMPOSE_PROJECT_NAME' is down: no container and no network carries its label."
# A bench that was on the tailnet leaves its doors published there, pointing at ports nothing answers now. Said,
# never run: releasing a door is configuring the network.
[ "${BENCH_LAST_DESTINATION:-$BENCH_DESTINATION}" != tailnet ] || bench_tailnet_release_notice
