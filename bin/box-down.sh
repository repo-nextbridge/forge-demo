#!/usr/bin/env bash
# ★★ TEAR THE BOX DOWN SO IT CAN BE BORN AGAIN — destroying STATE and keeping CACHE.
#
#   bash bin/box-down.sh              # the normal one: state dies, the photo cache lives
#   bash bin/box-down.sh --all        # everything, cache included (you will re-pull 3.6 GB)
#   bash bin/box-down.sh --env prod   # THE SAME GESTURES, on a deployed box (deploy/<env>.env names it)
#   bash bin/box-down.sh --env prod --plan   # say what WOULD go and what would stay; destroy nothing
#
# ── ★★ WHY `--env` IS A DESTINATION AND NOT A SECOND SCRIPT ─────────────────────────────────────────────────
#
# ⛔ MEASURED 2026-09-17: there was NO way to tear a deployed box down. `bin/box-cycle.sh` calls this file
# directly, so the weekly rebirth the INFRA-EXEMPLAR spec asks for (decision 5, prod only) could not exist;
# and the one remote gesture that did exist, `bin/birth-remote.sh --again`, CONVERGES. Convergence does not
# finish on a box that has had commerce: 17 SKUs carrying a reservation made `inventory.adjust` refuse to put
# stock back below what is reserved, and the kernel is right to refuse.
#
# ⇒ So the destination moved and nothing else did. Every rule below — which volume is state, which is
# identity, which is cache, and the sweep that names an unclassified one — has ONE author, and a remote run
# reads exactly the same lists. A second script would be a second opinion about what a certificate is.
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
#   IDENTITY is what the box IS at an address — the edge's TLS certificates and its ACME account key. Same
#          species as an SSH host key: not derived, not fetched, and re-minting it on every birth is not
#          hygiene, it is a new machine wearing the old name.
#
# ★★ THE THIRD CATEGORY WAS ADDED 2026-09-16, AND THE MEASUREMENT THAT PUT IT HERE IS NOT ABOUT TIDINESS.
# `caddy_data` and `caddy_config` sat in STATE, so every rebirth destroyed the six certificates AND the ACME
# account. On this bench that is free — `caddy/Caddyfile.local` carries `auto_https off` and no certificate is
# ever issued. ONLINE it is not: `caddy/Caddyfile` declares `tls { load /etc/caddy/certs }` and its own comment
# says an EMPTY folder is the normal state, i.e. Caddy issues its own from Let's Encrypt and keeps them in
# /data — which is this volume.
#
# ⇒ A box reborn WEEKLY BY CRON would re-issue six certificates and re-register an ACME account every week.
# In steady state that fits the allowances. The danger is not steady state: the DUPLICATE CERTIFICATE limit is
# 5 per week for the same exact set of names, so a rebirth that fails and is retried three or four times in
# one day burns it — and the box comes back with NO TLS and stays that way until the week rolls over. A limit
# that only bites once something else has already gone wrong is the worst kind to discover in production.
# ⚠️ It also puts an EXTERNAL dependency inside the unattended 90-minute window: the birth gains a way to fail
# that has nothing to do with this box.
#
# ⛔ DO NOT "fix" this by moving them back and adding a flag. A flag is a paragraph, and the header above
# already explains why a paragraph loses to a habit. The certificates survive because they are not state.
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
DOCKER_SH="${FORGE_DOCKER_SH:-sg docker -c}"
dc() {
  local quoted='' a
  for a in "$@"; do quoted+=" $(printf '%q' "$a")"; done
  $DOCKER_SH "cd $(printf '%q' "$COMPOSE_DIR") && ${REMOTE_PRELUDE}docker compose$quoted"
}
note() { printf '   %s\n' "$*" >&2; }

ALL=0
PLAN=0
ENV_NAME=''
while [ $# -gt 0 ]; do
  case "$1" in
    --all) ALL=1 ;;
    --plan) PLAN=1 ;;
    --env) ENV_NAME="${2:?--env needs an environment name (a file in deploy/)}"; shift ;;
    *) printf 'box-down: unknown option %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

# ── THE DESTINATION ─────────────────────────────────────────────────────────────────────────────────────────
# Local is the default and needs no ceremony. `--env` swaps the executor: `$DOCKER_SH` stops being the local
# docker group and becomes this box's ssh, `$COMPOSE_DIR` stops being this checkout and becomes the deploy
# directory, and the project name comes from that directory exactly as compose derives it there.
COMPOSE_DIR="$HERE"
REMOTE_PRELUDE=''
if [ -n "$ENV_NAME" ]; then
  # shellcheck disable=SC1091
  . "$HERE/bin/remote-box.sh"
  remote_box_load "$ENV_NAME" "$HERE" || exit 1
  COMPOSE_DIR="$FORGE_DEPLOY_DIR"
  COMPOSE_PROJECT_NAME="$(basename "$FORGE_DEPLOY_DIR")"
  DOCKER_SH="${REMOTE_SSH[*]}"
  # ⚠️ COMPOSE CANNOT INTERPOLATE THE FILE WITHOUT THE BOX'S OWN SECRETS, and they live only on the box —
  # `env-source.sh` is what puts them in a shell there. Without this the `down` dies on `${DATABASE_URL:?}`
  # and leaves the containers standing, which is the one outcome worse than not trying.
  REMOTE_PRELUDE=". ./env-source.sh >/dev/null 2>&1; export COMPOSE_PROJECT_NAME=$(printf '%q' "$COMPOSE_PROJECT_NAME"); "
fi
export COMPOSE_PROJECT_NAME

# The environment only has to be complete enough for compose to interpolate the file. ⛔ LOCAL ONLY: on a
# deployed box the secrets are the BOX's, and sourcing this checkout's would hand a remote `down` the bench's
# database URL — the prelude above is what gives a remote run its own.
if [ -z "$ENV_NAME" ]; then
  # shellcheck disable=SC1091
  set -a; . "$HERE/env-source.sh" >/dev/null 2>&1; [ -f "$HERE/.env" ] && . "$HERE/.env"; set +a
fi

printf '\n\033[1m── tearing down %s%s\033[0m\n' "$COMPOSE_PROJECT_NAME" \
  "${ENV_NAME:+ on ${FORGE_DEPLOY_USER:-?}@${FORGE_DEPLOY_HOST:-?}}" >&2
if [ "$PLAN" = 1 ]; then
  note 'PLAN — nothing below is destroyed; the containers are left standing'
else
  dc down --remove-orphans >/dev/null 2>&1
  note 'containers and network removed'
fi

# ★ THE STATE VOLUMES, BY NAME. Named explicitly rather than swept, so that adding a volume to `compose.yml`
# without deciding which kind it is shows up here as a leftover instead of being silently destroyed — or
# silently kept.
STATE='pgdata redisdata media'
for v in $STATE; do
  full="${COMPOSE_PROJECT_NAME}_${v}"
  if $DOCKER_SH "docker volume inspect $full" >/dev/null 2>&1; then
    if [ "$PLAN" = 1 ]; then
      note "state    $v — WOULD BE DESTROYED"
    else
      $DOCKER_SH "docker volume rm $full" >/dev/null 2>&1 && note "state    $v — destroyed"
    fi
  fi
done

# ★ IDENTITY — kept unconditionally, and NOT even by `--all`. `--all` means "re-fetch what you could
# re-fetch"; a certificate is not fetched, it is ISSUED to this box at this name, and re-issuing has a cost
# that is paid to somebody else's rate limiter. A box that must truly start over deletes these by hand, which
# is the friction this line is for.
IDENTITY='caddy_data caddy_config'
for v in $IDENTITY; do
  full="${COMPOSE_PROJECT_NAME}_${v}"
  if $DOCKER_SH "docker volume inspect $full" >/dev/null 2>&1; then
    note "identity $v — KEPT; TLS certificates and the ACME account are not state. Remove by hand to start over"
  fi
done

CACHE='seed_photos'
for v in $CACHE; do
  full="${COMPOSE_PROJECT_NAME}_${v}"
  if $DOCKER_SH "docker volume inspect $full" >/dev/null 2>&1; then
    if [ "$ALL" = 1 ]; then
      if [ "$PLAN" = 1 ]; then
        note "cache    $v — WOULD BE DESTROYED (--all)"
      else
        $DOCKER_SH "docker volume rm $full" >/dev/null 2>&1 && note "cache    $v — destroyed (--all); the next birth re-pulls it"
      fi
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
  case " $STATE $IDENTITY $CACHE " in
    *" $short "*) ;;
    *) note "⚠️ $short — UNCLASSIFIED: not in this script's state, identity or cache list. Decide which it is and add it." ;;
  esac
done

printf '\n' >&2
