#!/usr/bin/env bash
# INSTALL THE COFFEE VITRINE'S DEPENDENCIES from the tarballs `bin/vendor-packages.sh` produced.
#
#   bash bin/vendor-packages.sh ~/nextbridge/projetos/forge   # once, and again whenever the monorepo moves
#   bash bin/install-storefront.sh                            # the coffee vitrine (default)
#   bash bin/install-storefront.sh totem                      # any other app of this repo — see its sibling
#
# ⚠️ npm FORCES TWO SHAPES AND THIS SCRIPT IS THAT SPLIT — see the long note in vendor-packages.sh.
# A DIRECT dependency arrives as an install target (`npm install ./vendor/x.tgz`), because that is what
# rewrites its entry to the local file. A TRANSITIVE one arrives as an `overrides` entry, because an
# override for a direct dependency is refused outright (`EOVERRIDE ... conflicts with direct dependency`).
# Getting it backwards adds `@forgecommerce/contracts` to the vitrine's own dependencies, which its
# `src/structure.test.ts` then fails — correctly: a front speaks HTTP to the port and never links the
# kernel's types.
#
# ⚠️ IT EDITS `storefront-coffee/package.json`, and the edit is COMMITTED. The `overrides` block it writes
# uses paths RELATIVE to that file, so it is the same on any clone of this repository and describes a real
# state of the world: this project installs Forge packages from a directory because no registry serves them
# yet. It leaves at the same moment the tarballs do.

set -euo pipefail

app_dir="${1:-storefront-coffee}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The host's node, before anything is fetched, written or built. This runs `node -e` and then `npm install` on the host, and both are the operator's own node.
# shellcheck source=bin/require-node.sh
. "$here/bin/require-node.sh"
require_node || exit 1
app="$here/$app_dir"

[ -d "$app/vendor" ] || {
  echo "[install] no $app_dir/vendor/ — run \`bash bin/vendor-packages.sh <forge checkout> $app_dir\` first." >&2
  exit 1
}

# The split, decided from the manifest rather than from a list somebody keeps: a Forge package the manifest
# NAMES is direct, and every other tarball is something one of them pulls in.
targets="$(node -e '
const { readFileSync, writeFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const app = process.argv[1];
const manifestPath = join(app, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const nameOf = (file) =>
  "@forgecommerce/" + file.replace(/^forgecommerce-/, "").replace(/-\d+\.\d+\.\d+\.tgz$/, "");

const tarballs = readdirSync(join(app, "vendor")).filter((f) => f.endsWith(".tgz"));
const direct = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }));

const targets = [];
const overrides = {};
for (const file of tarballs.sort()) {
  const name = nameOf(file);
  const spec = "./vendor/" + file;
  if (direct.has(name)) targets.push(spec);
  else overrides[name] = spec;
}
if (targets.length === 0) throw new Error("no tarball matches a dependency of the vitrine — wrong vendor dir?");

manifest.overrides = overrides;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
process.stdout.write(targets.join("\n"));
' "$app")"

echo "[install] $(echo "$targets" | wc -l | tr -d ' ') direct package(s) as install targets, the rest as overrides"

# NO `--prefer-offline`: the Forge's own guard learned that a workstation with stale npm metadata fails it
# with an ETARGET for a package this project never names. A step that dies on somebody's cache is a step
# people learn to skip.
cd "$app" && npm install --no-audit --no-fund $targets

echo "[install] done. Next: \`npm test\`, then \`FORGE_BUILD_STANDALONE=1 npm run build\`."
