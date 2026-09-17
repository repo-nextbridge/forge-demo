#!/usr/bin/env bash
# THE COFFEE STORE'S VITRINE, BUILT. EXECUTE it (it writes files and an image); do not source it.
#
#   bash bin/build-coffee.sh ~/nextbridge/projetos/forge
#
# ── WHY THIS EXISTS AS ITS OWN SCRIPT, AND NOT AS A LINE IN `build-local.sh` ─────────────────────────────
#
# `build-local.sh` makes the four PRODUCT images and writes `forge.lock`: artifacts that have an upstream,
# are pinned BY DIGEST, and are re-stamped from a registry the day this box stops being pre-release. The
# coffee vitrine is not one of them. It is a FORK — its source is `storefront-coffee/` in this repository,
# it has no upstream and never will, and `forge.lock` has nothing true to say about it. Putting it in the
# lock's provenance block would be claiming a lineage it does not have; putting it in that script without
# the lock would make one script mean two things.
#
# So: two gestures, in order, and the README says so. `build-local.sh` for what we PIN, this for what we OWN.
#
# ── WHY THERE IS A BUILD STEP AT ALL — the Dockerfile is thin ON PURPOSE ─────────────────────────────────
#
# `storefront-coffee/Dockerfile` copies `.next/standalone` instead of running the build inside a layer, and
# it says why in its own header: the build that ships is the build that was TESTED, byte for byte, and a
# container that rebuilds needs the whole toolchain and the registry credentials inside it. That is the
# right trade and this script is its other half. Without it, `docker compose up` fails at
#
#     failed to compute cache key: "/.next/standalone": not found
#
# which is a true message about a missing step and reads like a broken image.
#
# ⚠️ THE `npm install` COMES FROM A CHECKOUT, NOT FROM npm, AND SAYS SO. The cut names `@forgeco/*` at an
# exact version, and since 2026-09-16 the registry does serve those (0.3.0) — what it cannot serve is the
# tree these images are baked from, which `forge.lock` records as a `local build` of a branch. So the
# packages are still built from the monorepo as tarballs, the same stand-in the Forge's own release guard
# uses. See `bin/vendor-packages.sh`, which carries the measurement and the reason. It leaves when the box
# pins a released kernel, together with this argument.

set -euo pipefail

forge="${1:?usage: build-coffee.sh <path to the forge monorepo checkout>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The host's node, before anything is fetched, written or built. The `npm run build` below is a host node process, and the bytes it produces are the ones that ship
# inside the image.
# shellcheck source=bin/require-node.sh
. "$here/bin/require-node.sh"
require_node || exit 1

# ★ pk24/D2 — the oven's patience. This script's `docker build` pulls a base image like every other one, and
# a registry that answers 5xx for a minute is not a fact about this fork. See `bin/docker-retry.sh`.
# shellcheck source=bin/docker-retry.sh
. "$here/bin/docker-retry.sh"
app="$here/storefront-coffee"
# The tag compose.override.yml pins this service to. One name, two files, and a grep finds both.
image="forge-demo-storefront-coffee:local"

[ -d "$app" ] || {
  echo "[coffee] no storefront-coffee/ — this repository does not own a forked vitrine." >&2
  exit 1
}

# 1. The Forge packages, as tarballs. Re-run unconditionally: the monorepo moves, and a vitrine built
#    against last week's kit is exactly the kind of stale artifact nobody can see.
bash "$here/bin/vendor-packages.sh" "$forge"

# 2. Install them.
bash "$here/bin/install-storefront.sh"

# 3. The build the image copies. STANDALONE is not optional — it is what emits `.next/standalone/server.js`,
#    the path the Dockerfile looks for and the only layout that works outside a monorepo.
( cd "$app" && FORGE_BUILD_STANDALONE=1 npm run build )

# ★★ pk35/d3 — AND THE ENTRY MOVED ONE DIRECTORY DOWN, because the tracing root moved one directory UP.
# This front imports `@forge/ext-demo-gate` from `file:../apps/demo-gate`; the standalone tracer copies
# nothing from above its root, so `next.config.mjs` roots it at the repository and Next mirrors the path from
# there. The path is DERIVED from the directory this script already knows, so a rename moves both at once.
entry="$app/.next/standalone/$(basename "$app")/server.js"
[ -f "$entry" ] || {
  echo "[coffee] the build produced no ${entry#"$here/"} — the image would fail to copy it." >&2
  echo "[coffee] (if it landed at .next/standalone/server.js instead, next.config.mjs's outputFileTracingRoot" >&2
  echo "[coffee]  is back at this directory — and then the gate app one level up is NOT in the image.)" >&2
  exit 1
}

# 4. The image compose refers to, by the tag `compose.override.yml` names.
#
# ⚠️ `docker build` AND NOT `docker compose build`, and the reason is measured rather than stylistic:
# compose interpolates the WHOLE merged file before it builds anything, so asking it for this one service
# still demands every required variable of every other one —
#
#     error while interpolating services.kernel.environment.DATABASE_URL: required variable ... is missing
#
# — and this script would then need the box's SECRETS sourced just to compile a front that has none. Built
# directly, it needs nothing but the source, which is also what lets it run in CI one day.
( cd "$app" && docker_build_retry -t "$image" . )

echo "[coffee] built $image — \`docker compose up -d\` will now start it."
