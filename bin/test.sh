#!/usr/bin/env bash
# THE REPO'S TESTS, in one command. A guard nobody knows how to invoke is decoration.
#
#   bash bin/test.sh
#
# This repository has no package manager and no runner of its own — it is a box's configuration, not a
# library — so the tests are plain `node --test` files and this script is the thing that finds them all.
# Anything matching `*.test.mjs` or `*.guard.mjs` under `bin/` and `seed/` runs.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

# The floor first: these tests run on the HOST, on whatever node the shell resolved. A suite that passes on
# a node the product does not support has proven something about a machine, not about this box.
# shellcheck source=bin/require-node.sh
. "$HERE/bin/require-node.sh"
require_node || exit 1
mapfile -t files < <(find bin seed -type f \( -name '*.test.mjs' -o -name '*.guard.mjs' \) | sort)
if [ "${#files[@]}" -eq 0 ]; then
  echo "[test] no test files found — that is itself a failure." >&2
  exit 1
fi
echo "[test] ${#files[@]} file(s):" >&2
printf '  %s\n' "${files[@]}" >&2
node --test "${files[@]}"
