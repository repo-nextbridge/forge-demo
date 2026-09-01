#!/usr/bin/env bash
# DOES THIS BOX RUN WHAT IT PINNED? — the list half of `forge.lock`, checked against the image that is
# actually running (A5 · ONDA 4).
#
#   bash bin/verify-composition.sh                        # ask the running kernel
#   bash bin/verify-composition.sh --declaration <file>   # compare a declaration you already have
#
# `forge.lock` states TWO things: which bytes (the digests) and which apps (`composition`). The digests are
# self-enforcing — a digest cannot resolve to anything else. The list is not: the image build takes the
# composition as an input, so a box can legitimately pull the exact bytes it pinned and still be running a
# list nobody intended, because the wrong image was baked, or the right image was baked from the wrong list.
#
# Every Forge kernel image carries `/app/composition.json`, written by the oven at build time
# (scripts/fleet/apply-composition.ts). This compares the two, and it is the only check that can: the lock is
# what you asked for, the declaration is what you got.
#
# Run it after `docker compose up -d`, and in your deploy right after the health check. It reads; it changes
# nothing.

set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${FORGE_LOCK:=$here/forge.lock}"
: "${FORGE_KERNEL_SERVICE:=kernel}"

declaration=''
while [ $# -gt 0 ]; do
  case "$1" in
    --declaration) declaration="${2:-}"; shift 2;;
    *) echo "usage: verify-composition.sh [--declaration <file>]" >&2; exit 2;;
  esac
done

die() { echo "[forge-composition] $1" >&2; exit 1; }

command -v jq >/dev/null || die '`jq` is required (apt install jq / brew install jq).'
[ -f "$FORGE_LOCK" ] || die "no lock file at ${FORGE_LOCK}."

want_id="$(jq -r '.composition.id // ""' "$FORGE_LOCK")"
want_apps="$(jq -r '.composition.apps // [] | sort | join(" ")' "$FORGE_LOCK")"
want_version="$(jq -r '.forgeVersion // ""' "$FORGE_LOCK")"
[ -n "$want_id" ] && [ -n "$want_apps" ] ||
  die "${FORGE_LOCK} names no composition — it pins the bytes and is silent about the apps. Copy the forge.lock published with the release."

if [ -z "$declaration" ]; then
  command -v docker >/dev/null || die 'docker is not on PATH; pass --declaration <file> instead.'
  got="$(docker compose exec -T "$FORGE_KERNEL_SERVICE" cat /app/composition.json 2>/dev/null)" || got=''
  [ -n "$got" ] ||
    die "could not read /app/composition.json from the '${FORGE_KERNEL_SERVICE}' service. Is the stack up (\`docker compose ps\`)? An image OLDER than the oven does not carry it — that is itself the answer: it was not baked from a declared list."
else
  [ -f "$declaration" ] || die "no declaration file at '$declaration'."
  got="$(cat "$declaration")"
fi

jq -e . >/dev/null 2>&1 <<<"$got" || die 'the composition the kernel declares is not valid JSON.'

got_apps="$(jq -r '[.apps[].id] | sort | join(" ")' <<<"$got")"
got_version="$(jq -r '.forgeRelease // ""' <<<"$got")"
got_id="$(jq -r '.compositionId // "(unnamed)"' <<<"$got")"

failed=0
if [ "$want_apps" != "$got_apps" ]; then
  failed=1
  echo "[forge-composition] THE RUNNING IMAGE COMPOSES A DIFFERENT LIST FROM THE ONE YOU PINNED." >&2
  echo "[forge-composition]   forge.lock (${want_id}): ${want_apps}" >&2
  echo "[forge-composition]   the image (${got_id}):   ${got_apps}" >&2
  # Both directions, because they are different accidents: an app you pinned and did not get is a feature
  # that will 404; an app you did not pin and did get is somebody else's code on your box.
  for app in $want_apps; do
    case " $got_apps " in *" $app "*) ;; *) echo "[forge-composition]   MISSING: ${app} — pinned, not in the image" >&2;; esac
  done
  for app in $got_apps; do
    case " $want_apps " in *" $app "*) ;; *) echo "[forge-composition]   EXTRA:   ${app} — in the image, not pinned" >&2;; esac
  done
fi

if [ -n "$got_version" ] && [ "$want_version" != "$got_version" ]; then
  failed=1
  echo "[forge-composition] the image was built from release ${got_version}, but this lock pins ${want_version}." >&2
fi

if [ "$failed" -ne 0 ]; then
  echo "[forge-composition] this box is NOT running what it pinned." >&2
  exit 1
fi

echo "[forge-composition] ${want_version} × ${want_id} — the running image composes exactly the list this lock pins: ${want_apps}" >&2
