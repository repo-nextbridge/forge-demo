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

# ── ★★ STRICT MODE — WHERE "NOT CHECKED" STOPS BEING AN ANSWER (pk24 integration) ──────────────────────────
#
# ⛔ THE DEFECT, MEASURED 2026-09-08 ON THIS TREE. Half the guards in `bin/` answer NOT CHECKED instead of
# running when the thing they grade is absent — no `node_modules` in a fork, no Forge checkout to compare the
# pinned release against. `node --test` reports those as SKIPPED, and a run that skips exits 0. Measured
# here: 19 skipped, `rc=0`, and among them the fork suites (811 tests) and every rule that needs the
# product's own lists.
#
# ★ ON A DEV MACHINE THAT IS THE RIGHT ANSWER, and it must stay. Saying "I did not check this, and here is
# what would let me" is strictly better than pretending; that virtue is written into every one of those
# guards on purpose, and this mode does not touch them.
#
# ⚠️ IN A PIPELINE IT IS A LIE. There, green means "the gate looked", and a runner that happens to lack a
# checkout would publish a green that graded almost nothing. The two machines want opposite answers to the
# same question, so the ANSWER IS A MODE, not an edit to nineteen call sites.
#
# ★★ AND IT IS ONE MECHANISM ON PURPOSE, because there are TWO ways to skip and a fix per call site would
# have missed one: `t.skip(...)` (used by fork-suite, fork-typecheck, vendor-drift, instance-app, …) and the
# `{ skip }` OPTION of `node:test` (bin/composition.guard.mjs, eight tests). Both surface in the run's own
# summary, so grading THE SUMMARY covers both — and covers the twentieth, written next month, for free.
strict=0
case "${FORGE_STRICT_CHECKS:-}" in 1|true|yes) strict=1 ;; esac
if [ "$strict" = 0 ]; then
  node --test "${files[@]}"
  exit $?
fi

echo "[test] ⚑ STRICT: a skipped test is a failure here — this run must GRADE, not report." >&2
out="$(mktemp)"; trap 'rm -f "$out"' EXIT
set -o pipefail
node --test "${files[@]}" 2>&1 | tee "$out"
rc=$?
set +o pipefail

# ⚠️ ANTI-VACUUM. If the summary line is not there, the run did not finish the way this parse assumes and the
# count cannot be trusted. Believing "no summary ⇒ no skips" is exactly the silence this mode exists to end.
skipped="$(sed -n 's/^ℹ skipped \([0-9]*\)$/\1/p' "$out" | tail -1)"
if [ -z "$skipped" ]; then
  echo "[test] ⛔ STRICT: the run printed no \`ℹ skipped\` line, so this mode cannot tell a graded run from a" >&2
  echo "              skipped one. Refusing to call it green. (node --test exited $rc.)" >&2
  exit 1
fi
if [ "$skipped" -gt 0 ]; then
  echo "" >&2
  echo "[test] ⛔ STRICT: $skipped test(s) reported NOT CHECKED instead of running:" >&2
  grep -E '^﹣' "$out" | sed 's/^/       /' >&2
  echo "" >&2
  echo "       Each line above names what would let it run — a Forge checkout (FORGE_MONOREPO), an installed" >&2
  echo "       fork (bash bin/revendor-forks.sh <checkout>). Give the runner those, or drop FORGE_STRICT_CHECKS" >&2
  echo "       and accept that this run graded less than it looks like it did." >&2
  exit 1
fi
exit $rc
