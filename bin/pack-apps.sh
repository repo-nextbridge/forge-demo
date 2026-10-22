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
# ★★ KP-D2 (2026-10-22, Forge v0.3.4) — THIS IS NOW HOW THIS BOX'S APPS REACH THE KERNEL. Both are declared
# `"kernel": "mounted"` in composition.json: the kernel is the RELEASE's, pulled by digest (bin/bake.sh), and it
# knows `demo-setup` and `payment-pos` only through `extensions/<id>`. So:
#   · it packs ONLY the apps the list declares mounted, by the `source` the list names — never every directory
#     under `apps/`. An app that is COMPOSED into the images and also mounted kills the kernel's boot on a
#     duplicate id: that is how the public demo went down on 2026-09-18 (bin/composed-apps-not-mounted.guard.mjs).
#   · v0.3.4 stamps each artifact with its source's fingerprint (`forge.sourceDigest`), and the product's fence
#     (`forge-lock-provenance`, run by bin/deploy.sh and by the bake's CI) refuses an artifact OLDER than its
#     source, naming it. Edit an app ⇒ run this ⇒ commit `extensions/<id>` in the same change.
#   · each app declares the kernels it fits (`forge.kernel` in its package.json); the packer copies the range,
#     and the kernel refuses to load an app whose range excludes it (`/health` → `extensions.failed`).
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
command -v jq >/dev/null || { echo '[pack-apps] `jq` is required to read composition.json.' >&2; exit 1; }

packed=0
while IFS=$'\t' read -r id src; do
  [ -n "$id" ] || continue
  source="$here/${src#./}"
  [ -f "$source/package.json" ] || {
    echo "[pack-apps] composition.json declares \"$id\" mounted at '$src', and there is no package.json there." >&2
    exit 1
  }
  # ⚠️ THE APP-LOCAL SHADOW IS REMOVED FIRST. `bin/instance-app.guard.mjs` links the app's declared
  # dependencies into `apps/<id>/node_modules/` out of an installed fork; Node resolves upward, so that copy
  # would WIN over the root's. One `@forgeco/contracts` — the one this repository installed at the release.
  rm -rf "$source/node_modules/@forgeco/contracts"
  out="$here/extensions/$id"
  echo "[pack-apps] $id → extensions/$id" >&2
  "$forge_cli" pack-extension "$source" "$out" >&2
  packed=$((packed + 1))
done < <(jq -r '.instanceApps // [] | .[] | select(.kernel == "mounted") | [.id, .source] | @tsv' "$here/composition.json")

[ "$packed" -gt 0 ] || {
  echo "[pack-apps] composition.json declares no instance app \"kernel\": \"mounted\" — nothing to pack." >&2
  exit 1
}

echo "[pack-apps] packed ${packed} app(s). Commit extensions/ with the source change. They are mounted read-only at" >&2
echo "[pack-apps]   \$FORGE_EXTENSIONS_DIR and the kernel scans them at boot only, so on a running bench:" >&2
echo "[pack-apps]   docker compose up -d --force-recreate --no-deps kernel   (bin/deploy.sh does it when extensions/ changed)" >&2
