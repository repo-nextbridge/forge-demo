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
#
# ── ★★ pk24/D2 — AND IT EVICTS THE VENDORED ENTRIES FROM THE LOCK BEFORE INSTALLING. MEASURED, 2026-09-08 ─
#
# A tarball's PATH does not change when it is re-vendored — `vendor/forgecommerce-contracts-0.3.0.tgz` is
# the same string every time — so `npm install` sees a lock entry it already satisfies and resolves it BY
# INTEGRITY out of its content-addressed cache. It never opens the file that was just rewritten. On a clean
# worktree, right after a full re-vendor from `v03/integra@217734df8`:
#
#     the tarball on disk    dist/index.js  9ca046c7…   1462 lines   ← what the release packs
#     what npm installed     dist/index.js  5967a83c…   1288 lines   ← last week's, out of the cache
#     the committed lock     sha512-SvMA4i7B…                        ← the OLD tarball's hash, unmoved
#
# 174 lines of the release's `@forgecommerce/contracts` were missing from the fork, `npm install` printed
# nothing, and the lock stayed stale — so the next `npm ci` in a pipeline would fail EINTEGRITY against a
# tarball nobody could tell had changed. The DIRECT packages escape this only because they arrive as install
# TARGETS (`npm install ./vendor/x.tgz` does re-read the file); every `overrides` entry — which is where
# `contracts`, `sdk`, `cli` and `ext-chrome` live — was silently frozen.
#
# So the entries resolved from `file:vendor/` are DELETED from `package-lock.json` first. npm then has no
# choice but to re-resolve them from the bytes on disk and write the hash of what it actually installed.
# Deleting is safe by construction: an absent entry is the one thing npm cannot satisfy from a lock.

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
const { existsSync, readFileSync, writeFileSync, readdirSync } = require("node:fs");
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

// The eviction. See the note above the `set -euo pipefail`: without it npm reinstalls the cached copy of a
// tarball that has been rewritten under the same path, and says nothing.
const lockPath = join(app, "package-lock.json");
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const evicted = Object.keys(lock.packages ?? {}).filter((key) =>
    typeof lock.packages[key]?.resolved === "string" && lock.packages[key].resolved.startsWith("file:vendor/"),
  );
  for (const key of evicted) delete lock.packages[key];
  if (evicted.length > 0) {
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
    process.stderr.write(`[install] evicted ${evicted.length} vendored entr(ies) from package-lock.json so npm re-reads the tarballs\n`);
  }
}
process.stdout.write(targets.join("\n"));
' "$app")"

echo "[install] $(echo "$targets" | wc -l | tr -d ' ') direct package(s) as install targets, the rest as overrides"

# NO `--prefer-offline`: the Forge's own guard learned that a workstation with stale npm metadata fails it
# with an ETARGET for a package this project never names. A step that dies on somebody's cache is a step
# people learn to skip.
cd "$app" && npm install --no-audit --no-fund $targets

echo "[install] done. Next: \`npm test\`, then \`FORGE_BUILD_STANDALONE=1 npm run build\`."
