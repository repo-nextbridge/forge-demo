#!/usr/bin/env bash
# OUR APPS, PACKED INTO WHAT THE KERNEL LOADS. EXECUTE it (it writes files); do not source it.
#
#   bash bin/pack-apps.sh
#
# `apps/<id>/` is the SOURCE — TypeScript, a `manifest.ts`, React blocks. `extensions/<id>/` is the ARTIFACT
# — a manifest as JSON, the icon as a file, every declared script bundled self-contained — and it is what
# `FORGE_EXTENSIONS_DIR` mounts and the kernel scans at boot.
#
# ⚠️ THE TWO ARE NOT INTERCHANGEABLE, and mounting the wrong one fails in a way that reads like a broken app
# rather than a missing step. Measured on this bench, with an app of this box mounted directly from `apps/`:
#
#     /health → "invalid manifest: ENOENT … open '/app/extensions/<id>/forge-extension.json'"
#
# The kernel READS manifests, it never RUNS them: an extension directory is scanned at boot, long before
# anybody installs anything, so nothing in it may execute at that moment. A `.ts` manifest is refused with a
# message saying exactly that. (Node also refuses to strip types under `node_modules`, so a raw `.ts` could
# not be loaded at runtime even if the kernel wanted to.)
#
# THE ARTIFACT IS COMMITTED, and that is the template's own shape — `templates/instance/extensions/` ships the
# packed form of its example decision. It means this box can be brought up from a clone with no build step
# and no monorepo. The price is that `extensions/` is GENERATED: change anything under `apps/` and run this
# again, or the box goes on serving the app you had before.
#
# ★ v032/C — NO MONOREPO. The producer is `forge pack-extension`, published in `@forgeco/cli` from v0.3.2 (spec
# v032, decision 3), and the contracts a manifest compiles against are `@forgeco/contracts` — both installed by
# this repository's own `package.json`, at the release the forks pin (`npm ci` at the root). Until v0.3.2 this
# script took a checkout as its argument, linked the contracts out of it and ran `pnpm exec tsx
# scripts/publishing/pack-extension.ts` there; both halves of that wall are gone. `forge pack-extension` asks
# the manifest to resolve `@forgeco/contracts` from where it sits — this repo's root `node_modules/`, found by
# walking up from `apps/<id>/`.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The host's node, before anything is fetched, written or built — the CLI is a node process on this host.
# shellcheck source=bin/require-node.sh
. "$here/bin/require-node.sh"
require_node || exit 1

forge_cli="$here/node_modules/.bin/forge"
[ -x "$forge_cli" ] && [ -d "$here/node_modules/@forgeco/contracts" ] || {
  echo "[pack-apps] the release's tools are not installed here (node_modules/.bin/forge, @forgeco/contracts)." >&2
  echo "[pack-apps]   npm ci   # at the root of this repository — package.json pins them at the release" >&2
  exit 1
}
[ -d "$here/apps" ] || {
  echo "[pack-apps] no apps/ directory — this repo owns no app, and there is nothing to pack." >&2
  exit 1
}

packed=0
for source in "$here"/apps/*/; do
  id="$(basename "$source")"
  [ -f "$source/package.json" ] || continue
  # ⚠️ THE APP-LOCAL SHADOW IS REMOVED FIRST. `bin/instance-app.guard.mjs` links the app's declared
  # dependencies into `apps/<id>/node_modules/` out of an installed fork; Node resolves upward, so that copy
  # would WIN over the root's. One `@forgeco/contracts` — the one this repository installed at the release.
  rm -rf "$source/node_modules/@forgeco/contracts"
  out="$here/extensions/$id"
  echo "[pack-apps] $id → extensions/$id" >&2
  "$forge_cli" pack-extension "$source" "$out" >&2
  packed=$((packed + 1))
done

[ "$packed" -gt 0 ] || {
  echo "[pack-apps] apps/ holds no package — nothing packed." >&2
  exit 1
}

echo "[pack-apps] packed ${packed} app(s). They are mounted read-only at \$FORGE_EXTENSIONS_DIR; the kernel" >&2
echo "[pack-apps]   scans them at boot, so: docker compose up -d kernel" >&2
