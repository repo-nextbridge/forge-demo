#!/usr/bin/env bash
# THE COUNTER'S TOTEM, BUILT. EXECUTE it (it writes files and an image); do not source it.
#
#   bash bin/build-totem.sh ~/nextbridge/projetos/wt-v03/t-forno
#
# ── WHY IT IS ITS OWN SCRIPT, LIKE `build-coffee.sh` AND UNLIKE `build-local.sh` ─────────────────────────
#
# `build-local.sh` makes the four PRODUCT images and rewrites `forge.lock`: artifacts with an upstream,
# pinned BY DIGEST, re-stamped from a registry the day this box stops being pre-release. The totem is not
# one of them, for the same reason the coffee vitrine is not — its source is `totem/` in this repository, it
# has no upstream and never will — plus a second reason that is a fact about the file rather than an
# analogy: `build-local.sh` REWRITES `forge.lock` from a fixed four-image template (`jq -n`, near its end),
# so a `totem` key added there by hand is deleted in silence by the next oven run. A lock cannot carry a
# claim its own generator discards. The decision and its argument live in `compose.override.yml`, beside the
# service, and a guard test (`totem/src/lock-provenance.test.ts`) keeps it true.
#
# So: `build-local.sh` for what we PIN, `build-coffee.sh` and this for what we OWN.
#
# ── WHY THERE IS A BUILD STEP AT ALL — the Dockerfile is thin ON PURPOSE ─────────────────────────────────
#
# `totem/Dockerfile` copies `.next/standalone` instead of running the build in a layer: the build that ships
# is the build that was TESTED, byte for byte, and a container that rebuilds needs the whole toolchain
# inside it. Without this script `docker compose up` fails at
#
#     failed to compute cache key: "/.next/standalone": not found
#
# which is a true message about a missing step and reads like a broken image.

set -euo pipefail

forge="${1:?usage: build-totem.sh <path to the forge monorepo checkout>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The host's node, before anything is fetched, written or built. The `npm run build` below is a host node process, and the bytes it produces are the ones that ship
# inside the image.
# shellcheck source=bin/require-node.sh
. "$here/bin/require-node.sh"
require_node || exit 1
app="$here/totem"
# The tag compose.override.yml pins this service to. One name, two files, and a grep finds both.
image="forge-demo-totem:local"

[ -d "$app" ] || {
  echo "[totem] no totem/ — this repository does not own a counter kiosk." >&2
  exit 1
}

# 1. The Forge packages, as tarballs. Re-run unconditionally: the monorepo moves, and a kiosk built against
#    last week's kit is exactly the kind of stale artifact nobody can see.
bash "$here/bin/vendor-packages.sh" "$forge" totem

# 2. Install them.
bash "$here/bin/install-storefront.sh" totem

# 3. The build the image copies. STANDALONE is not optional — it is what emits `.next/standalone/server.js`,
#    the path the Dockerfile looks for and the only layout that works outside a monorepo.
( cd "$app" && FORGE_BUILD_STANDALONE=1 npm run build )

# ⚠️ THE ENTRY IS NESTED, AND IT IS NOT THE VITRINE'S PATH. `totem/next.config.mjs` sets
# `outputFileTracingRoot` to the REPOSITORY root, because the demo gate this app renders lives one directory
# up (`apps/demo-gate/`) and the tracer has to be allowed to reach it. Next then mirrors the path from that
# root into the output, so the server lands at `.next/standalone/totem/server.js` — the coffee vitrine, whose
# tracing root is the app itself, gets `.next/standalone/server.js`. The Dockerfile's CMD says the same thing
# from the other side; checking the wrong one here would let a broken image build.
[ -f "$app/.next/standalone/totem/server.js" ] || {
  echo "[totem] the build produced no .next/standalone/totem/server.js — the image would fail to copy it." >&2
  exit 1
}

# 4. The image compose refers to, by the tag `compose.override.yml` names.
#
# ⚠️ `docker build` AND NOT `docker compose build` — the same measured reason as the vitrine's: compose
# interpolates the WHOLE merged file before building anything, so asking it for this one service still
# demands every required variable of every other one, and this script would need the box's SECRETS sourced
# just to compile a front that has none.
( cd "$app" && docker build -t "$image" . )

echo "[totem] built $image — \`docker compose up -d\` will now start it."
