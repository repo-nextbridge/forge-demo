#!/usr/bin/env bash
# ★ SH-2 · WHAT `seed-history` DID, AND WHETHER AN IMAGE'S `seed-history` COMPLETES A PAST BY ITSELF — for the two
# callers that need it: the kit bench's seed hook (bench-demo/seed-hook.sh, step 10) and the reset (bin/demo-reset.sh).
#
#   . bin/history-mode.sh
#   history_outcome <log of one plain run>        → full | top-up | up-to-date | refused | skipped | unknown
#   <dist/seed-history.js on stdin> history_completes_by_itself && …
#
# ── THE TWO IMAGES, AND THE DESIGN THIS READS (SH-1, product PR #659, e0f025738) ───────────────────────────────
#
# There is NO flag. `node dist/seed-history.js --tenant <t>` decides by the tenant's state and says what it did in
# the JSON report it prints on stdout: `"mode": "full" | "top-up" | "up-to-date" | "refused"`. The image forge.lock
# pins today (v0.3.2) has no `mode`: a tenant with a past is SKIPPED (exit 0, `"skipped":true`, «SKIPPING») and the
# past never reaches past its first day. So the caller always makes the SAME plain run and reads the report AFTER it
# — nothing is detected before, and nothing is passed that a script might not read.
#
# ⚠️ AN EARLIER VERSION OF THIS FILE LOOKED FOR A `--top-up` FLAG IN THE IMAGE'S TEXT. The real design has no flag,
# and the text "top-up" IS in the new script (as a value of `mode`) — that detection would have passed the new
# script a flag it does not read. What the reset needs before running anything (it does not run it — see there)
# is the one literal only a state-deciding script carries: the mode `"up-to-date"`. Measured 2026-10-11: v0.3.2's
# dist/seed-history.js has it 0 times (`"top-up"` 0, «SKIPPING» 1); the kernel built from e0f025738 — RESULTADOS-sh-2.
history_outcome() { # <log>: stdout report (one JSON line) and stderr mixed, as both callers capture them
  local report mode
  report="$(grep '^{' "$1" | tail -1)"
  [ -n "$report" ] || { echo unknown; return 0; }
  mode="$(printf '%s' "$report" | jq -r '.mode // empty' 2>/dev/null)"
  case "$mode" in
    full | top-up | up-to-date | refused) echo "$mode" ;;
    '') # an image older than SH-1: no mode, only `skipped`
      case "$(printf '%s' "$report" | jq -r '.skipped' 2>/dev/null)" in true) echo skipped ;; false) echo full ;; *) echo unknown ;; esac ;;
    *) echo unknown ;;
  esac
}
history_orders() { grep '^{' "$1" | tail -1 | jq -r '.orders // 0' 2>/dev/null; }

history_completes_by_itself() { # stdin: the text of dist/seed-history.js
  grep -q '"up-to-date"'
}
