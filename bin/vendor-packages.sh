#!/usr/bin/env bash
# THE FORGE PACKAGES THE COFFEE VITRINE INSTALLS, AS TARBALLS. EXECUTE it (it writes files); do not source it.
#
#   bash bin/vendor-packages.sh ~/nextbridge/projetos/forge
#
# ⚠️ WHY A DIRECTORY OF TARBALLS INSTEAD OF `npm install`, AND WHEN THIS SHOULD STOP EXISTING.
#
# `storefront-coffee/` is a CUT of the Forge storefront (`pnpm pack:surface`), and the cut is honest about
# what it depends on: it names `@forgecommerce/storefront-kit`, the theme and the `ext-*` apps at an exact
# version, the way any npm project names a dependency. Those packages are not published yet. Measured on
# 2026-08-31:
#
#     npm view @forgecommerce/storefront-kit version           -> E404 Not Found
#     npm view @forgecommerce/ext-reviews version              -> E404
#     npm view @forgecommerce/theme-storefront-vanilla version -> E404
#
# So `npm install` in that directory dies on a package nobody can fetch. This is the same pre-release moment
# `bin/build-local.sh` and `bin/pack-apps.sh` are in, with the same shape of answer: build it from the
# monorepo on this machine, and SAY SO.
#
# ★ THIS IS NOT A WORKAROUND WE INVENTED — it is the path the Forge's own release guard takes.
# `scripts/publishing/packed-surface.guard.test.ts` proves a cut installs and boots, and it stands the
# registry in with exactly these tarballs, produced by exactly this script. What runs here is what the guard
# runs, which is the only reason to trust that this install resembles a customer's.
#
# ⚠️ AND IT IS npm's TWO SHAPES, NOT ONE. `npm install <tgz>` REWRITES that entry in package.json, so passing
# every tarball would add the kernel's own `@forgecommerce/contracts` as a DIRECT dependency of the vitrine —
# which the surface's `structure.test.ts` forbids, correctly (a front speaks HTTP to the port; it must never
# link the kernel's types). But an `overrides` entry for a direct dependency is refused outright
# (`EOVERRIDE ... conflicts with direct dependency`). So DIRECT dependencies go in as install targets and
# transitive ones as overrides — which is what `bin/install-storefront.sh` next door does with what this
# writes.
#
# THE TARBALLS ARE NOT COMMITTED (see .gitignore). They are megabytes of build output whose only source of
# truth is the monorepo, and committing them would make this repository the second place a package version
# lives. The day `@forgecommerce/*` is published, this script and its sibling are deleted and the vitrine's
# `npm install` needs no argument at all.

set -euo pipefail

forge="${1:?usage: vendor-packages.sh <path to the forge monorepo checkout>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$here/storefront-coffee/vendor"

[ -f "$forge/scripts/pack-publishable.sh" ] || {
  echo "[vendor] '$forge' does not look like the Forge monorepo (no scripts/pack-publishable.sh)." >&2
  exit 1
}
[ -d "$here/storefront-coffee" ] || {
  echo "[vendor] no storefront-coffee/ — cut it first with \`pnpm pack:surface storefront\`." >&2
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
echo "[vendor] $count package(s) in storefront-coffee/vendor/"
echo "[vendor] next: bash bin/install-storefront.sh"
