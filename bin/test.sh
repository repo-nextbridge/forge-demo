#!/usr/bin/env bash
# THE REPO'S TESTS, in one command. A guard nobody knows how to invoke is decoration.
#
#   bash bin/test.sh
#
# This repository has no package manager and no runner of its own — it is a box's configuration, not a
# library — so the tests are plain `node --test` files and this script is the thing that finds them all.
# Anything matching `*.test.mjs` or `*.guard.mjs` under `bin/` and `seed/` runs.
#
# ★ pk14/D3 — AND THAT NOW REACHES THE FORKS' OWN SUITES TOO, which is worth saying out loud because the
# `find` below does not show it: this repository also owns two Next apps (`storefront-coffee/`, `totem/`)
# with vitest suites of their own, and until 2026-09-05 nothing ran them — not this script, not the build
# scripts, not the Dockerfiles, and there is no CI. `bin/fork-suite.guard.mjs` is the loop that does, and it
# is picked up by the same `find`. So THE ANSWER TO "who runs the fork's tests" IS THIS COMMAND. A fork whose
# `node_modules` is absent is reported NOT CHECKED, never quietly passed; see that file for the measured cost
# (~5.6 s of work, which the parallelism below mostly absorbs) and for what the first run found.
#
# ★ pk24/D3 — AND IT REACHES THE APPS THIS BOX WRITES ITSELF, for the same reason and by the same trick.
# `apps/payment-pos/` and `apps/demo-gate/` are loaded BY THE KERNEL, and until 2026-09-08 nothing compiled or
# ran them either: not this script, not `bin/pack-apps.sh`, not `bin/build-local.sh`, and there is still no CI.
# `bin/instance-app.guard.mjs` is that loop — 35 tests and two typechecks, ~2.8 s of work — and the first run
# found that NEITHER app could even be loaded here: both configs pointed at files of the Forge monorepo. Same
# posture as above: a machine with no Forge checkout is told NOT CHECKED, never quietly passed.
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
