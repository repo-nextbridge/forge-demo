#!/usr/bin/env bash
# ★ SH-2 · DOES THIS KERNEL IMAGE COMPLETE A PAST TO TODAY? — one answer, read OUT OF THE IMAGE, for the two callers
# that need it: the kit bench's seed hook (bench-demo/seed-hook.sh, step 10) and the demo's reset (bin/demo-reset.sh).
#
#   . bin/history-topup.sh
#   flag="$(<the image's dist/seed-history.js on stdin> history_topup_flag)"   # '--top-up' or ''
#
# ── WHY IT READS THE IMAGE AND NOT A VERSION ───────────────────────────────────────────────────────────────────
#
# `seed-history` of the image forge.lock pins today (v0.3.2) is reset+seed: a tenant with an order older than half
# its window is SKIPPED (exit 0, `"skipped":true`), so a past never reaches past the day it was written. The mode
# that completes it — `(last day with a history order, today]` — is SH-1's, in the product, and arrives with the
# next cut of the images. A version typed here would be wrong the day a build carries it early or a pin goes back;
# the script inside the image is what will run, so it is what is asked. Measured 2026-10-11 against v0.3.2's
# dist/seed-history.js: `flag("tenant")`, `flag("end")`, `flag("days")` 1 match each (the control: the read works
# and the pattern matches how that file reads its flags); `flag("top-up")` 0.
#
# ⚠️ THE NAME IS SH-1's TO GIVE. Its brief suggests `--top-up`; if the product names it otherwise, HISTORY_TOPUP_FLAG
# is the one line to change. ⛔ Nothing here implements the mode: completing a past is the product's (a demo that
# wrote dated orders itself would be the product patched inside an instance).
HISTORY_TOPUP_FLAG='--top-up'

history_topup_flag() { # stdin: the text of dist/seed-history.js → prints the flag if that script reads it
  grep -q -e "flag(\"${HISTORY_TOPUP_FLAG#--}\")" -e "\"$HISTORY_TOPUP_FLAG\"" && printf '%s' "$HISTORY_TOPUP_FLAG"
  return 0
}
