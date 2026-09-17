#!/usr/bin/env bash
# ★★ RE-VENDOR EVERY FORK OF THIS REPOSITORY AGAINST ONE FORGE CHECKOUT. EXECUTE it (it writes files and
# rewrites two lockfiles); do not source it.
#
#   bash bin/revendor-forks.sh ~/nextbridge/projetos/forge
#   bash bin/revendor-forks.sh ~/path/to/forge --check      # say what WOULD move, write nothing
#
# ── WHY IT EXISTS (caderno §B3) ─────────────────────────────────────────────────────────────────────────
#
# Twice — pk19 and pk21 — the kit moved upstream, the guards said so correctly, and the fix was FOUR gestures
# a person composed by hand out of two different failure messages:
#
#     bash bin/vendor-packages.sh   <tree> storefront-coffee
#     bash bin/install-storefront.sh       storefront-coffee
#     bash bin/vendor-packages.sh   <tree> totem
#     bash bin/install-storefront.sh       totem
#
# Nothing owned that step. `bin/build-coffee.sh` and `bin/build-totem.sh` each do it for their OWN fork as
# step 1 and 2 of producing an image — which is right, and is why a bake is never stale — but a kit change
# that lands while nobody is baking leaves two committed lockfiles disagreeing with the release and the
# suite red, and the operator has to reconstruct the pair of commands per fork from memory.
#
# ⚠️ AND IN A PIPELINE THAT IS NOT AN INCONVENIENCE, IT IS AN `EINTEGRITY`. `npm ci` verifies every tarball
# against the hash in the committed lock. A lock vendored from an older tree names a tarball this release no
# longer produces, and the failure names a base64 digest, never a cause.
#
# ★ THE FORKS ARE DERIVED, NEVER TYPED — `bin/forks.mjs`, the same single derivation `fork-typecheck`,
# `fork-suite` and `vendor-drift` use. A typed list of two directories is exactly the third fork nobody
# re-vendors. The script asks for forks that declare `build`, because building is what consumes what is
# vendored.
#
# ── ORDER, AND WHY IT IS NOT NEGOTIABLE ─────────────────────────────────────────────────────────────────
#
# vendor → install → (then, and only then, a bake). `bin/vendor-packages.sh` writes the tarballs;
# `bin/install-storefront.sh` splits them into direct install targets and `overrides` (npm forces two shapes
# — see that file) and rewrites `package.json` + `package-lock.json`. Baking before installing produces an
# image built against whatever `node_modules` already held, which is the stale artifact nobody can see.
#
# This script deliberately does NOT bake. `bin/build-coffee.sh` and `bin/build-totem.sh` own that, they call
# the same two steps themselves, and a third script that also builds images would be a second answer to
# "what does this repository ship".
#
# ── WHAT A PIPELINE DOES WITH THE RESULT ────────────────────────────────────────────────────────────────
#
# The lockfiles are COMMITTED artifacts, so this reports whether any of them moved and exits accordingly:
#   0  nothing moved — the tree was already in step
#   0  something moved and was written (the paths are listed; commit them)
#   1  --check, and something WOULD move
#   1  a fork failed to vendor or install
# `--check` is the shape a CI gate wants: it never writes, and a non-zero says "this branch's locks do not
# match the release it pins".

set -euo pipefail

forge="${1:?usage: revendor-forks.sh <path to the forge monorepo checkout> [--check]}"
mode="${2:-}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The host's node, before anything is fetched or written: `bin/install-storefront.sh` runs `node -e` and
# `npm install` on the operator's own node, and so does the derivation below.
# shellcheck source=bin/require-node.sh
. "$here/bin/require-node.sh"
require_node || exit 1

[ -f "$forge/scripts/pack-publishable.sh" ] || {
  echo "[revendor] '$forge' does not look like the Forge monorepo (no scripts/pack-publishable.sh)." >&2
  exit 1
}

case "$mode" in
  ''|--check) ;;
  *) echo "[revendor] unknown option '$mode' — the only one is --check." >&2; exit 1 ;;
esac

# ── the forks, from the one derivation ──────────────────────────────────────────────────────────────────
mapfile -t forks < <(node --input-type=module -e '
  import { forks } from "'"$here"'/bin/forks.mjs";
  for (const fork of forks("build")) process.stdout.write(fork.dir + "\n");
')
[ "${#forks[@]}" -gt 0 ] || {
  echo "[revendor] no fork of this repository installs the kit and declares a \`build\` script." >&2
  echo "[revendor] That is either the day the forks install @forgeco/* from npm instead of from a checkout" >&2
  echo "[revendor] — in which case this script, bin/vendor-packages.sh and bin/install-storefront.sh are" >&2
  echo "[revendor] deleted together — or a" >&2
  echo "[revendor] fork lost its manifest. Either way it is not something to pass over in silence." >&2
  exit 1
}
echo "[revendor] forks: ${forks[*]}" >&2
echo "[revendor] tree:  $forge ($(git -C "$forge" rev-parse --short HEAD 2>/dev/null || echo 'not a git checkout'))" >&2

# The BEFORE picture of every lock, so the report is about what actually changed rather than about what ran.
declare -A before=()
for fork in "${forks[@]}"; do
  lock="$here/$fork/package-lock.json"
  before["$fork"]="$([ -f "$lock" ] && sha256sum "$lock" | cut -d' ' -f1 || echo absent)"
done

if [ "$mode" = --check ]; then
  # ⚠️ `--check` MUST NOT LEAVE THE TREE DIFFERENT. It vendors and installs into a copy of nothing — there is
  # no such thing — so instead it asks the guard, which recomputes the integrity from the tree and compares
  # it to the committed lock without installing anything at all. One rule, one implementation, two callers.
  echo "[revendor] --check: asking bin/vendor-drift.guard.mjs, which writes nothing." >&2
  FORGE_MONOREPO="$forge" node --test "$here/bin/vendor-drift.guard.mjs" >&2 || {
    echo "[revendor] the committed locks do NOT match $forge. Re-run without --check to fix them." >&2
    exit 1
  }
  echo "[revendor] the committed locks match $forge." >&2
  exit 0
fi

for fork in "${forks[@]}"; do
  echo >&2
  echo "[revendor] ── $fork ─────────────────────────────────────────────────────" >&2
  bash "$here/bin/vendor-packages.sh" "$forge" "$fork"
  bash "$here/bin/install-storefront.sh" "$fork"
done

echo >&2
moved=()
for fork in "${forks[@]}"; do
  lock="$here/$fork/package-lock.json"
  now="$([ -f "$lock" ] && sha256sum "$lock" | cut -d' ' -f1 || echo absent)"
  [ "$now" = "${before[$fork]}" ] || moved+=("$fork/package-lock.json")
done

if [ "${#moved[@]}" -eq 0 ]; then
  echo "[revendor] every fork was already in step with $forge — no lockfile moved." >&2
else
  echo "[revendor] ${#moved[@]} lockfile(s) moved. THEY ARE COMMITTED ARTIFACTS — commit them:" >&2
  printf '[revendor]   %s\n' "${moved[@]}" >&2
  echo "[revendor] (\`bin/install-storefront.sh\` also rewrites each fork's package.json \`overrides\`.)" >&2
fi
echo "[revendor] next: bash bin/build-coffee.sh $forge · bash bin/build-totem.sh $forge" >&2
