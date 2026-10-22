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
#
# ★ KP-3 — AND THE APPS THE KERNEL RECEIVES MOUNTED. A box whose own apps are declared `"kernel": "mounted"`
# pulls the release's kernel and hands it their kernel half as packed directories (extensions/<id>, mounted at
# FORGE_EXTENSIONS_DIR). Its lock says so in `composition.mounted`, and then this compares TWO things:
#   · the kernel's declaration against `composition.apps − composition.mounted` (the release kernel never
#     composed those, and must not: an id on both sides kills the boot), and
#   · the mount against `composition.mounted`, proven by the RUNNING kernel: the ids in its
#     FORGE_EXTENSIONS_DIR and its /health (`extensions.mounted`, `extensions.failed`). A declared app the kernel
#     does not hold is `MISSING (mounted)`, one it holds and failed to load is `FAILED (mounted)`, and one on the
#     mount that the lock does not declare (in `composition.mounted` or `extensions`) is `EXTRA (mounted)`.
# A lock WITHOUT `composition.mounted` is checked exactly as before — the mount is not looked at.
#
#   bash bin/verify-composition.sh --declaration <file> --health <file> [--mounted-dir <dir>]
#       offline, for a lock with `composition.mounted`: the kernel's /health body, and the directory it mounts
#       (default: ./extensions, what compose.yml mounts).
#
# ⚠️ This script is COPIED into your repository. A lock with `composition.mounted` read by a copy older than
# this block is refused as MISSING apps — loud, never silent; take this file together with the lock.

set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${FORGE_LOCK:=$here/forge.lock}"
# @env FORGE_KERNEL_SERVICE optional — The compose service name the verification script asks for the running composition.
: "${FORGE_KERNEL_SERVICE:=kernel}"

declaration=''
health=''
mounted_dir=''
while [ $# -gt 0 ]; do
  case "$1" in
    --declaration) declaration="${2:-}"; shift 2;;
    --health) health="${2:-}"; shift 2;;
    --mounted-dir) mounted_dir="${2:-}"; shift 2;;
    *) echo "usage: verify-composition.sh [--declaration <file> [--health <file>] [--mounted-dir <dir>]]" >&2; exit 2;;
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

# ★ KP-3 — the kernel's half of the list. Without `composition.mounted` it IS the list, as it always was.
has_mounted="$(jq -r '.composition | has("mounted")' "$FORGE_LOCK")"
want_mounted=''
want_kernel_apps="$want_apps"
if [ "$has_mounted" = 'true' ]; then
  [ "$(jq -r '.composition.mounted | type' "$FORGE_LOCK")" = 'array' ] ||
    die "${FORGE_LOCK} has a composition.mounted that is not an array of app ids."
  want_mounted="$(jq -r '.composition.mounted | sort | join(" ")' "$FORGE_LOCK")"
  want_kernel_apps="$(jq -r '(.composition.apps - .composition.mounted) | sort | join(" ")' "$FORGE_LOCK")"
  # What may sit on the mount: the apps mounted for the fronts, and the data-only apps `extensions` inventories.
  allowed_on_mount=" $want_mounted $(jq -r '[.extensions // [] | .[].id] | join(" ")' "$FORGE_LOCK") "
fi

if [ -z "$declaration" ]; then
  command -v docker >/dev/null || die 'docker is not on PATH; pass --declaration <file> instead.'
  got="$(docker compose exec -T "$FORGE_KERNEL_SERVICE" cat /app/composition.json 2>/dev/null)" || got=''
  [ -n "$got" ] ||
    die "could not read /app/composition.json from the '${FORGE_KERNEL_SERVICE}' service. Is the stack up (\`docker compose ps\`)? An image OLDER than the oven does not carry it — that is itself the answer: it was not baked from a declared list."
else
  [ -f "$declaration" ] || die "no declaration file at '$declaration'."
  got="$(cat "$declaration")"
fi

# ★ KP-3 — THE MOUNT, AS THE RUNNING KERNEL SEES IT: the ids in its FORGE_EXTENSIONS_DIR and its /health. Asked
# only when the lock mounts something. One `node` inside the kernel's own container (the image has node and no
# curl), so what is read is the directory THAT process loads, not a guess about where compose put it.
evidence=''
if [ "$has_mounted" = 'true' ]; then
  if [ -z "$declaration" ]; then
    # shellcheck disable=SC2016 # JavaScript, run inside the container — its `$` are not this shell's.
    evidence="$(docker compose exec -T "$FORGE_KERNEL_SERVICE" node -e '
      const fs = require("node:fs"), path = require("node:path");
      const directory = process.env.FORGE_EXTENSIONS_DIR || "";
      const onDisk = [];
      if (directory && fs.existsSync(directory)) {
        for (const e of fs.readdirSync(directory, { withFileTypes: true })) {
          if (!e.isDirectory()) continue;
          let id = e.name;
          try { id = JSON.parse(fs.readFileSync(path.join(directory, e.name, "forge-extension.json"), "utf8")).id || id; } catch {}
          onDisk.push(id);
        }
      }
      fetch("http://127.0.0.1:" + (process.env.PORT || 3000) + "/health")
        .then((r) => r.json())
        .then((h) => process.stdout.write(JSON.stringify({ directory, onDisk, extensions: h.extensions ?? null })))
        .catch((e) => process.stdout.write(JSON.stringify({ directory, onDisk, extensions: null, error: String(e) })));
    ' 2>/dev/null)" || evidence=''
    [ -n "$evidence" ] ||
      die "this lock mounts ${want_mounted:-nothing} into the kernel, and the '${FORGE_KERNEL_SERVICE}' service could not be asked what it mounted."
  else
    [ -n "$health" ] ||
      die "this lock mounts ${want_mounted:-nothing} into the kernel, and only the running kernel can prove it holds them: pass --health <file> (its /health body), or run without --declaration against the stack."
    [ -f "$health" ] || die "no /health file at '$health'."
    jq -e . "$health" >/dev/null 2>&1 || die "'$health' is not valid JSON."
    : "${mounted_dir:=$here/extensions}"
    on_disk='[]'
    if [ -d "$mounted_dir" ]; then
      for d in "$mounted_dir"/*/; do
        [ -d "$d" ] || continue
        id="$(jq -r '.id // empty' "$d/forge-extension.json" 2>/dev/null)"
        [ -n "$id" ] || id="$(basename "$d")"
        on_disk="$(jq -c --arg id "$id" '. + [$id]' <<<"$on_disk")"
      done
    fi
    evidence="$(jq -c --arg directory "$mounted_dir" --argjson onDisk "$on_disk" \
      '{directory: $directory, onDisk: $onDisk, extensions: (.extensions // null)}' "$health")"
  fi
fi

jq -e . >/dev/null 2>&1 <<<"$got" || die 'the composition the kernel declares is not valid JSON.'

got_apps="$(jq -r '[.apps[].id] | sort | join(" ")' <<<"$got")"
got_version="$(jq -r '.forgeRelease // ""' <<<"$got")"
got_id="$(jq -r '.compositionId // "(unnamed)"' <<<"$got")"

failed=0
if [ "$want_kernel_apps" != "$got_apps" ]; then
  failed=1
  echo "[forge-composition] THE RUNNING IMAGE COMPOSES A DIFFERENT LIST FROM THE ONE YOU PINNED." >&2
  if [ "$has_mounted" = 'true' ]; then
    echo "[forge-composition]   forge.lock (${want_id}), minus the ${want_mounted:-(none)} it mounts: ${want_kernel_apps}" >&2
  else
    echo "[forge-composition]   forge.lock (${want_id}): ${want_apps}" >&2
  fi
  echo "[forge-composition]   the image (${got_id}):   ${got_apps}" >&2
  # Both directions, because they are different accidents: an app you pinned and did not get is a feature
  # that will 404; an app you did not pin and did get is somebody else's code on your box.
  for app in $want_kernel_apps; do
    case " $got_apps " in *" $app "*) ;; *) echo "[forge-composition]   MISSING: ${app} — pinned, not in the image" >&2;; esac
  done
  for app in $got_apps; do
    case " $want_kernel_apps " in
      *" $app "*) ;;
      *)
        case " $want_mounted " in
          *" $app "*) echo "[forge-composition]   EXTRA:   ${app} — COMPOSED into the image and declared mounted: the kernel would load it twice (pull the release kernel, do not bake it)" >&2;;
          *) echo "[forge-composition]   EXTRA:   ${app} — in the image, not pinned" >&2;;
        esac;;
    esac
  done
fi

if [ "$has_mounted" = 'true' ]; then
  ext_block="$(jq -c '.extensions' <<<"$evidence")"
  if [ "$ext_block" = 'null' ]; then
    failed=1
    echo "[forge-composition] the kernel's /health carries no \`extensions\` block$(jq -r 'if .error then " (" + .error + ")" else "" end' <<<"$evidence"), so nothing proves what it mounted." >&2
  else
    on_disk_ids="$(jq -r '.onDisk | sort | join(" ")' <<<"$evidence")"
    mount_dir="$(jq -r '.directory' <<<"$evidence")"
    for app in $want_mounted; do
      case " $on_disk_ids " in
        *" $app "*) ;;
        *)
          failed=1
          echo "[forge-composition]   MISSING (mounted): ${app} — declared mounted, and the kernel's extensions directory ('${mount_dir:-FORGE_EXTENSIONS_DIR is unset}') does not hold it" >&2
          continue;;
      esac
      # A problem the loader reported about this app: `where` is its directory, `<id>`, or `<id>:<piece>`.
      reasons="$(jq -r --arg id "$app" '[.extensions.failed // [] | .[] | select(.where == $id or (.where | startswith($id + ":")) or (.where | endswith("/" + $id))) | .reason] | join("; ")' <<<"$evidence")"
      if [ -n "$reasons" ]; then
        failed=1
        echo "[forge-composition]   FAILED (mounted): ${app} — the kernel holds it and reported: ${reasons}" >&2
      fi
    done
    for app in $on_disk_ids; do
      case "$allowed_on_mount" in *" $app "*) ;; *)
        failed=1
        echo "[forge-composition]   EXTRA (mounted): ${app} — on the kernel's mount, declared neither in composition.mounted nor in extensions" >&2;;
      esac
    done
    # And the kernel's own count: every app on its mount has to be one it SERVES as the instance's
    # (`extensions.mounted`), not merely a directory it was shown — a directory the loader skipped (no `forge`
    # key, a range that excludes this kernel) is on disk and served by nobody.
    want_count="$(wc -w <<<"$on_disk_ids" | tr -d ' ')"
    served="$(jq -r '.extensions.mounted // 0' <<<"$evidence")"
    if [ "$served" -lt "$want_count" ]; then
      failed=1
      echo "[forge-composition]   the kernel serves ${served} app(s) from its mount, and ${want_count} are on it (${on_disk_ids})." >&2
    fi
  fi
fi

if [ -n "$got_version" ] && [ "$want_version" != "$got_version" ]; then
  failed=1
  echo "[forge-composition] the image was built from release ${got_version}, but this lock pins ${want_version}." >&2
fi

if [ "$failed" -ne 0 ]; then
  echo "[forge-composition] this box is NOT running what it pinned." >&2
  exit 1
fi

if [ "$has_mounted" = 'true' ]; then
  echo "[forge-composition] ${want_version} × ${want_id} — the running image composes exactly the list this lock pins minus what it mounts: ${want_kernel_apps:-(nothing)}; and the kernel serves, mounted: ${want_mounted:-(nothing)}" >&2
else
  echo "[forge-composition] ${want_version} × ${want_id} — the running image composes exactly the list this lock pins: ${want_apps}" >&2
fi
