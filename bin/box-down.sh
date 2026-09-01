#!/usr/bin/env bash
# ★★ TEAR THE BOX DOWN SO IT CAN BE BORN AGAIN — destroying STATE and keeping CACHE.
#
#   bash bin/box-down.sh              # the normal one: state dies, the photo cache lives
#   bash bin/box-down.sh --all        # everything, cache included (you will re-pull 3.6 GB)
#
# ── WHY THIS SCRIPT EXISTS AT ALL, WHICH IS THE ONLY INTERESTING THING ABOUT IT ─────────────────────────────
#
# `docker compose down -v` is one flag and it takes EVERYTHING. That is almost right and wrong in the one way
# that costs forty minutes: it does not distinguish the two kinds of thing a box holds.
#
#   STATE is what the box DERIVED — the database, its caches of its own derivations, the media it serves.
#          A birth proof must destroy it, or the box is not being born.
#   CACHE  is what the box FETCHED and could fetch again — the 3.6 GB photo payload pulled from a bucket.
#          Destroying it proves nothing: the claim is "the box is born from nothing", not "the network is
#          re-read from nothing". It costs ~40 minutes and buys no evidence.
#
# ⚠️ AND THIS IS A MECHANISM RATHER THAN A RULE ON PURPOSE. The distinction above was explained to me, I wrote
# it down in a report, and one minute later my hand typed `down -v` anyway and re-pulled the whole payload —
# a second time, now knowing better. A finding that is written down does not protect the person who wrote it;
# only a mechanism does. So the safe thing is the DEFAULT and the expensive thing needs a flag, because a
# habit will always beat a paragraph.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

: "${COMPOSE_PROJECT_NAME:=forge-preseed}"
export COMPOSE_PROJECT_NAME
DOCKER_SH="${FORGE_DOCKER_SH:-sg docker -c}"
dc() {
  local quoted='' a
  for a in "$@"; do quoted+=" $(printf '%q' "$a")"; done
  $DOCKER_SH "cd $(printf '%q' "$HERE") && docker compose$quoted"
}
note() { printf '   %s\n' "$*" >&2; }

ALL=0
[ "${1:-}" = '--all' ] && ALL=1

# The environment only has to be complete enough for compose to interpolate the file.
# shellcheck disable=SC1091
set -a; . "$HERE/env-source.sh" >/dev/null 2>&1; [ -f "$HERE/.env" ] && . "$HERE/.env"; set +a

printf '\n\033[1m── tearing down %s\033[0m\n' "$COMPOSE_PROJECT_NAME" >&2
dc down --remove-orphans >/dev/null 2>&1
note 'containers and network removed'

# ★ THE STATE VOLUMES, BY NAME. Named explicitly rather than swept, so that adding a volume to `compose.yml`
# without deciding which kind it is shows up here as a leftover instead of being silently destroyed — or
# silently kept.
STATE='pgdata redisdata media caddy_data caddy_config'
for v in $STATE; do
  full="${COMPOSE_PROJECT_NAME}_${v}"
  if $DOCKER_SH "docker volume inspect $full" >/dev/null 2>&1; then
    $DOCKER_SH "docker volume rm $full" >/dev/null 2>&1 && note "state    $v — destroyed"
  fi
done

CACHE='seed_photos'
for v in $CACHE; do
  full="${COMPOSE_PROJECT_NAME}_${v}"
  if $DOCKER_SH "docker volume inspect $full" >/dev/null 2>&1; then
    if [ "$ALL" = 1 ]; then
      $DOCKER_SH "docker volume rm $full" >/dev/null 2>&1 && note "cache    $v — destroyed (--all); the next birth re-pulls it"
    else
      n=$($DOCKER_SH "docker run --rm -v $full:/p alpine sh -c 'find /p -type f | wc -l'" 2>/dev/null | tr -dc '0-9')
      note "cache    $v — KEPT (${n:-?} file(s)); it is fetched bytes, not derived state. --all to drop it"
    fi
  fi
done

# Anything the lists above did not name is a volume nobody has classified. Say so rather than guess.
left=$($DOCKER_SH "docker volume ls --format '{{.Name}}'" 2>/dev/null | grep "^${COMPOSE_PROJECT_NAME}_" || true)
for v in $left; do
  short="${v#"${COMPOSE_PROJECT_NAME}_"}"
  case " $STATE $CACHE " in
    *" $short "*) ;;
    *) note "⚠️ $short — UNCLASSIFIED: not in this script's state or cache list. Decide which it is and add it." ;;
  esac
done

printf '\n' >&2
