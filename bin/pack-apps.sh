#!/usr/bin/env bash
# OUR APPS, PACKED INTO WHAT THE KERNEL LOADS. EXECUTE it (it writes files); do not source it.
#
#   bash bin/pack-apps.sh ~/nextbridge/projetos/forge
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
# ⚠️ IT NEEDS THE MONOREPO because the producer (`pnpm pack:extension`) lives there, along with the contracts
# the manifest compiles against. `@forgeco/contracts` reached npm on 2026-09-16 (0.3.0), so the CONTRACTS
# half of that sentence stopped being a wall — but the PRODUCER half did not: `pnpm pack:extension` is a
# script of the monorepo and no package publishes it. This argument leaves when both halves do, not one.

set -euo pipefail

forge="${1:?usage: pack-apps.sh <path to the forge monorepo checkout>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The host's node, before anything is fetched, written or built. `pnpm exec tsx` runs on the host, out of the monorepo — and on this bench `pnpm` exists only beside
# the node that satisfies the floor.
# shellcheck source=bin/require-node.sh
. "$here/bin/require-node.sh"
require_node || exit 1

[ -d "$forge/scripts/publishing" ] || {
  echo "[pack-apps] '$forge' does not look like the Forge monorepo (no scripts/publishing/)." >&2
  exit 1
}
[ -d "$here/apps" ] || {
  echo "[pack-apps] no apps/ directory — this repo owns no app, and there is nothing to pack." >&2
  exit 1
}

# ⚠️ THE CONTRACTS PACKAGE, LINKED — the pre-release shape of a dependency that will be an `npm install`.
#
# The producer IMPORTS each app's `manifest.ts` (it has to: a manifest is TypeScript here and JSON in the
# artifact, and something must evaluate it once to make that trip). That import reaches for
# `@forgeco/contracts`, which inside the monorepo is a workspace link and in this repository is
# nothing at all. Measured, before this block existed:
#
#     Cannot find package '@forgeco/contracts' imported from …/apps/<id>/manifest.ts
#
# So it is linked at this repo's root, where Node's upward resolution finds it from any app. It is
# GITIGNORED and rebuilt by this script every run: it points into a checkout on THIS machine and would be a
# broken link in anybody else's clone.
#
# THE DAY THIS GOES AWAY is the day this repository INSTALLS the package instead of linking it. The release
# publishes it now (`@forgeco/contracts@0.3.0`, measured 2026-09-16), so what is left is a decision, not a
# wall: `npm install @forgeco/contracts@<the release>` here, pinned like everything else. It is deliberately
# NOT taken by the slice that moved the scope — a link into the checkout these images are baked from and a
# version off the registry are two different promises, and swapping them is the cut's call.
contracts="$forge/packages/contracts"
[ -d "$contracts" ] || {
  echo "[pack-apps] '$contracts' is missing — cannot link the contracts an app's manifest compiles against." >&2
  exit 1
}
mkdir -p "$here/node_modules/@forgeco"
rm -f "$here/node_modules/@forgeco/contracts"
ln -s "$contracts" "$here/node_modules/@forgeco/contracts"
echo "[pack-apps] linked @forgeco/contracts → $contracts (gitignored, pre-release only)" >&2

packed=0
for source in "$here"/apps/*/; do
  id="$(basename "$source")"
  [ -f "$source/package.json" ] || continue
  # ⚠️ AND THE APP-LOCAL SHADOW OF THAT LINK IS REMOVED FIRST. `bin/instance-app.guard.mjs` (pk24/D3) puts
  # the app's declared dependencies in `apps/<id>/node_modules/`, contracts among them, out of whatever Forge
  # checkout it could find. Node resolves upward, so that copy would WIN over the one just written above —
  # and if the two checkouts differ, the manifest would be validated against a `@forgeco/contracts`
  # this pack is not producing for. One link, the one named on this command line. The guard rewrites its own
  # every run, so nothing is broken by taking it away.
  rm -rf "$source/node_modules/@forgeco/contracts"
  out="$here/extensions/$id"
  echo "[pack-apps] $id → extensions/$id" >&2
  # The producer takes the extension as INPUT and names none of its own — it is run from the monorepo (its
  # own tooling lives there) against an absolute path into this repo.
  ( cd "$forge" && pnpm exec tsx scripts/publishing/pack-extension.ts "$source" "$out" ) >&2
  packed=$((packed + 1))
done

[ "$packed" -gt 0 ] || {
  echo "[pack-apps] apps/ holds no package — nothing packed." >&2
  exit 1
}

echo "[pack-apps] packed ${packed} app(s). They are mounted read-only at \$FORGE_EXTENSIONS_DIR; the kernel" >&2
echo "[pack-apps]   scans them at boot, so: docker compose up -d kernel" >&2
