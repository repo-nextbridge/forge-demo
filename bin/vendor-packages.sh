#!/usr/bin/env bash
# THE FORGE PACKAGES THE COFFEE VITRINE INSTALLS, AS TARBALLS. EXECUTE it (it writes files); do not source it.
#
#   bash bin/vendor-packages.sh ~/nextbridge/projetos/forge                 # the coffee vitrine (default)
#   bash bin/vendor-packages.sh ~/nextbridge/projetos/forge totem           # any other app of this repo
#
# ★ THE SECOND ARGUMENT ARRIVED WITH THE TOTEM, AND IT DEFAULTS TO WHAT THIS SCRIPT ALWAYS DID.
# This repository now builds TWO Next apps of its own — `storefront-coffee/` (the forked vitrine) and
# `totem/` (the counter's kiosk) — and both install the same Forge packages the same pre-release way.
# Duplicating the script would put npm's two-shapes rule (below) in two places, and the day it changes it
# would change in one. So the directory became a parameter and the old call site did not move a letter.
#
# ⚠️ WHY A DIRECTORY OF TARBALLS INSTEAD OF `npm install` — AND WHAT CHANGED ON 2026-09-16.
#
# `storefront-coffee/` is a CUT of the Forge storefront (`pnpm pack:surface`), and the cut is honest about
# what it depends on: it names `@forgeco/storefront-kit`, the theme and the `ext-*` apps at an exact
# version, the way any npm project names a dependency.
#
# ★★ AND THOSE PACKAGES ARE PUBLISHED NOW — the reason this script was written has EXPIRED, so it is written
# down rather than left to be discovered. Until pk43 this block said «they are not published yet» and carried
# three E404s measured on 2026-08-31. The v0.3.0 cut put all nineteen on the public registry, under the scope
# this repository now names. Measured 2026-09-16, on registry.npmjs.org:
#
#     npm view @forgeco/storefront-kit version           -> 0.3.0
#     npm view @forgeco/ext-reviews version              -> 0.3.0
#     npm view @forgeco/theme-storefront-vanilla version -> 0.3.0
#
# ⚠️ THIS SCRIPT STAYS ANYWAY, FOR A DIFFERENT REASON THAN THE ONE IT WAS BORN WITH, and the new reason is
# narrower. A registry install can only ever name a RELEASED version. This box does not run a released
# version: `forge.lock`'s provenance says `local build` and names a branch and a sha, because the images are
# baked from a checkout on this machine (`bin/build-local.sh`), and `bin/vendor-drift.guard.mjs` grades each
# fork's committed lock against THAT tree, tarball by tarball. Pointing the forks at npm would have them pin
# a coarser promise than the images standing beside them — a version, where the kernel is a commit. So the
# origin does not move here: it moves when `forge.lock` stops saying `local build`, and that is a decision of
# the cut, not a consequence of a rename.
#
# ★ THIS IS NOT A WORKAROUND WE INVENTED — it is the path the Forge's own release guard takes.
# `scripts/publishing/packed-surface.guard.test.ts` proves a cut installs and boots, and it stands the
# registry in with exactly these tarballs, produced by exactly this script. What runs here is what the guard
# runs, which is the only reason to trust that this install resembles a customer's.
#
# ⚠️ AND IT IS npm's TWO SHAPES, NOT ONE. `npm install <tgz>` REWRITES that entry in package.json, so passing
# every tarball would add the kernel's own `@forgeco/contracts` as a DIRECT dependency of the vitrine —
# which the surface's `structure.test.ts` forbids, correctly (a front speaks HTTP to the port; it must never
# link the kernel's types). But an `overrides` entry for a direct dependency is refused outright
# (`EOVERRIDE ... conflicts with direct dependency`). So DIRECT dependencies go in as install targets and
# transitive ones as overrides — which is what `bin/install-storefront.sh` next door does with what this
# writes.
#
# THE TARBALLS ARE NOT COMMITTED (see .gitignore). They are megabytes of build output whose only source of
# truth is the monorepo, and committing them would make this repository the second place a package version
# lives. The day the forks install from the registry instead of from a checkout (see the block above — the
# packages are already there; the box is what still is not), this script and its sibling are deleted and the
# vitrine's `npm install` needs no argument at all.

set -euo pipefail

forge="${1:?usage: vendor-packages.sh <path to the forge monorepo checkout> [app directory]}"
app_dir="${2:-storefront-coffee}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app="$here/$app_dir"
out="$app/vendor"

[ -f "$forge/scripts/pack-publishable.sh" ] || {
  echo "[vendor] '$forge' does not look like the Forge monorepo (no scripts/pack-publishable.sh)." >&2
  exit 1
}
[ -d "$app" ] || {
  echo "[vendor] no $app_dir/ — this repository does not own an app by that name." >&2
  exit 1
}

rm -rf "$out"
mkdir -p "$out"

# The producer release.yml itself runs. It packs the `dist` already on disk rather than rebuilding — so the
# monorepo has to have been built, and the script says which path it took. That line is echoed here on
# purpose: a stale `dist` produces tarballs that install cleanly and carry last week's code, and the only
# warning anybody gets is that sentence.
( cd "$forge" && bash scripts/pack-publishable.sh "$out" ) | sed 's/^/[vendor] /'

count="$(find "$out" -name '*.tgz' | wc -l | tr -d ' ')"
[ "$count" -gt 0 ] || {
  echo "[vendor] the pack step produced no tarballs — nothing was written to $out." >&2
  exit 1
}
echo "[vendor] $count package(s) in $app_dir/vendor/"
echo "[vendor] next: bash bin/install-storefront.sh $app_dir"
