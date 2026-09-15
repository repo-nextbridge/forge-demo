#!/usr/bin/env bash
# ★★★ THE SCHEDULED CYCLE — ONE SCRIPT, ONE SCHEDULE, FOUR GESTURES IN THE ONLY ORDER THAT WORKS.
#
#   bash bin/box-cycle.sh --promote <tailnet|localhost|hostname>   reborn, promoted, warmed
#   bash bin/box-cycle.sh --no-promote                             reborn and left where it is born (localhost)
#   bash bin/box-cycle.sh --plan [--promote <where>]               print what it would do; touch NOTHING
#   bash bin/box-cycle.sh --dry-run [--promote <where>]            the whole mechanism — lock, log, roteiro,
#                                                                  verdict — with every gesture PRINTED, not run
#
# ── ★ WHY ONE SCRIPT AND ONE SCHEDULE, AND NOT FOUR ENTRIES IN A CRONTAB ────────────────────────────────────
#
# The obvious arrangement is a line per gesture — `03:00 reset`, `04:00 warm`. It is wrong for three reasons,
# and each of them is already written down somewhere in this repository:
#
#  1 · THE ORDER IS THE DECISION, AND IT ALREADY HAS A GUARD. `bin/reset-complete.guard.mjs` exists to prove
#      that the birth *reborns, then purges the edge, then warms, then grades* — "and that order is the whole
#      decision". Split across schedules, the order becomes arithmetic on a clock, and A CLOCK IS NOT A
#      DEPENDENCY: on a night the seed runs long, the 04:00 entry fires at a box that is still being born,
#      warms nothing, and reports success.
#  2 · THE STEPS ARE ALREADY ONE SCRIPT. `bin/box-up.sh` is fifteen steps that each exist because the one
#      before it produced something they need — including the purge (13), the warming (14) and the two
#      verdicts (12, 15). This file does not re-derive any of that. It ORCHESTRATES: four calls, in order.
#  3 · THE EXIT CODE HAS TO BE DECIDED IN ONE PLACE. `bin/box-up.sh` exits 1 on purpose for seven distinct
#      reasons. A schedule that alerts on any non-zero alerts every night; one that ignores non-zero alerts
#      never. See THE EXIT POLICY below — it is the question this file exists to answer.
#
# ── ★★ THE FOUR GESTURES, AND WHY THE WARMING IS LAST ───────────────────────────────────────────────────────
#
#   1 · bash bin/box-down.sh                    the STATE dies; the ~3.6 GB photo cache LIVES (`--all` would
#                                               drop it too: ~40 minutes to re-pull, and it proves nothing)
#   2 · bash bin/box-up.sh --no-warm            the birth: the fifteen steps, warming left for gesture 4
#   3 · bash bin/box-up.sh --promote <where>    the box is pointed at the address it is really reached at
#   4 · bash bin/box-up.sh --warm-only          the warming, now at the promoted address
#
# ★★★ GESTURE 3 IS NOT OPTIONAL WHERE THERE IS A DESTINATION, AND THAT IS A MEASUREMENT RATHER THAN A TASTE.
# A rebirth DE-PROMOTES the admin: the database dies, so the kernel's admin directory comes back holding only
# the `localhost` doors `seed/box.json` claims, and step 3d rewrites the sibling list back to `localhost` —
# while the shop goes on answering on the network. The box ends up HALF PROMOTED, and step 15 is red about it
# for exactly that reason (see `bin/box-up.sh`, step 15's own header). A scheduled reset without gesture 3
# loses the admin on every run.
#
# ★★★ AND GESTURE 4 COMES AFTER GESTURE 3 BECAUSE THE PROMOTION THROWS WARMTH AWAY. The promotion ends with
# `dc up -d --force-recreate kernel caddy admin storefront checkout storefront-coffee totem` — every front
# that HOLDS the warmth (route cache, ISR entries, image derivatives) is destroyed and replaced there. Warming
# before it would pay ~1h10 for a cache that is deleted minutes later. The older reason still holds too: on a
# first promotion `FORGE_PUBLIC_ORIGIN` is only right AFTER the promotion writes it, so a warm run before it
# warms an address no shopper types.
#
# ⚠️ AND THE LOOP THAT WARMS IS NOT COPIED INTO THIS FILE. Warming is once per tenant with THAT TENANT'S own
# token, because the read face that lists a tenant's stores resolves the tenant from the credential — and the
# rule for a tenant's secret name (the first keeps the unsuffixed one) already has two authors. So gesture 4
# asks `bin/box-up.sh --warm-only`, which drives the same `warm_every_tenant` step 14 drives. A third copy of
# that rule here would drift on the day a tenant is added to `seed/box.json`.
#
# ── ⛔ THE EXIT POLICY, WHICH IS THE QUESTION THIS FILE EXISTS TO ANSWER ─────────────────────────────────────
#
# WHICH NON-ZERO IS ACCEPTABLE? Today: NONE. `cycle_verdict` below is "any non-zero is red", and
# `CYCLE_TOLERATED` — the list of pardons — is EMPTY on purpose.
#
# ⛔ IT IS EMPTY BECAUSE NOTHING HAS BEEN MEASURED YET, AND A LIST WRITTEN IN ADVANCE IS THE DISEASE
# `bin/verify-config.mjs` already names: *"the obvious answer is a checklist, and the checklist is the
# disease"*. A pardon guessed today is a red this box will never see again, for a reason nobody will remember.
# ⇒ Run the cycle for real, read the log, and only then add the entry — WITH THE MEASUREMENT GLUED TO IT:
#
#       CYCLE_TOLERATED='2=1|<what was measured, when, and why it is not a failure of the cycle>'
#
# ★ THE ONE CANDIDATE THAT IS ALREADY EXPECTED, stated so the first real run knows what it is looking at:
# gesture 2 is a birth of a box that WAS promoted, so it can end `MISCONFIGURED` — the de-promotion described
# above, which gesture 3 then repairs. If the first real cycle shows exactly that and gesture 3 and 4 are
# green, that is the entry to write. ⚠️ It is NOT written yet, because `bin/box-up.sh` exits 1 for seven
# reasons and its status alone cannot tell them apart: a pardon for "2 exited 1" would also pardon a box with
# doors a shopper cannot open. What the first run has to produce is the LINE from the log that names the
# reason — and if the pardon cannot be narrowed to one reason, the repair belongs in `bin/box-up.sh` (a
# distinct exit code for the half-promoted case), not in a blanket pardon here.
#
# ⚠️ AND THE CYCLE DOES NOT STOP AT THE FIRST RED. It runs all four gestures and grades at the end, because
# the one non-zero already expected — gesture 2 coming back half promoted — is repaired by the gesture that
# follows it. Stopping there would leave the box in exactly the state this cycle exists to end.
#
# ── THE LOCK, THE LOG, AND THE ENVIRONMENT A SCHEDULER GIVES YOU ────────────────────────────────────────────
#
# LOCK. Two overlapping runs destroy each other: the second tears down the box the first is seeding. The lock
# is a file holding the PID, and it REFUSES AND SAYS SO — it never waits in silence. A lock left behind by a
# run that died is detected (the PID is not alive any more), reported, and TAKEN OVER, because a lock that
# outlives its process forever turns one crash into a box that is never reset again.
#
# LOG. A cycle is ~90 minutes and has no terminal. Every run writes one timestamped log, and the path is
# printed BEFORE the work starts as well as after it. When stdout is not a terminal — which is what a
# scheduler gives you — the body goes to the file and only the header and the verdict reach the scheduler's
# own output, so the mail it sends is short and says where the rest is.
#
# NODE. A cron or a systemd unit inherits a minimal PATH and has neither `node` nor `jq`. `bin/require-node.sh`
# is what answers that case (it refuses by name, before anything is read, started or written) and it is the
# first thing this script does — before the lock, before the log — so the refusal reaches the scheduler.
# ⇒ The unit MUST be given the directory holding the Node this release pins. See docs/operations/reset-cycle.md.
#
# COMPOSE_PROJECT_NAME. Never call docker without it: it is what names the volumes `bin/box-down.sh` destroys
# by name. It is defaulted here to the same value `bin/box-down.sh` defaults to, and EXPORTED, so all four
# gestures speak about one project even if the unit's environment says nothing.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 2

TAG='[cycle]'

# ── ★★ THE GESTURES, AS DATA — because a list that only exists in a comment cannot grade anything ───────────
#
# `<id>|<title>`, in the order they happen. `bin/roteiro.mjs` prints and GRADES this against what really ran:
# a gesture that neither ran nor was declared skipped is a red there, which is the shape a wrapper of four
# calls is otherwise perfectly able to hide. `bin/box-cycle.guard.mjs` reads this list and the commands below
# and reds if a gesture is removed or the order changes.
CYCLE_STEPS='1|tear the box down (state dies, the photo cache lives)
2|the birth, warming left for gesture 4 (bin/box-up.sh --no-warm)
3|the promotion — the box points at the address it is reached at (bin/box-up.sh --promote)
4|the re-warm, at the address this box publishes itself at (bin/box-up.sh --warm-only)'

# ★ THE ONE REASON A GESTURE IS SKIPPED, WRITTEN ONCE. The plan and the run both print THIS string, so a plan
# cannot promise a reason the run does not give.
SKIP_WHY_PROMOTE='asked with --no-promote: this box has no address beyond the one it is born on, so there is nothing to point it at. A promotion to a guessed destination would claim a hostname that routes nowhere and leave every admin answering `unknown_admin_host`. ⚠️ The box is therefore handed over ON LOCALHOST — correct for a bench, wrong for anything a browser reaches from another machine.'

USAGE='usage: bash bin/box-cycle.sh --promote <tailnet|localhost|hostname>
       bash bin/box-cycle.sh --no-promote                 reborn, and left on localhost (declared)
       bash bin/box-cycle.sh --plan    [--promote <where>|--no-promote]
       bash bin/box-cycle.sh --dry-run [--promote <where>|--no-promote]'

MODE=run
PROMOTE_TO=''
PROMOTION_DECLARED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --promote)
      PROMOTE_TO="${2:-}"
      case "$PROMOTE_TO" in
        '' | --*)
          printf '\n%s --promote needs a DESTINATION, and it will not guess one.\n  tailnet     this machine on its tailnet\n  localhost   the box left where it is born\n  <hostname>  any address this box is really reachable at, e.g. demo.example.com\n\n%s\n\n' "$TAG" "$USAGE" >&2
          exit 2 ;;
      esac
      PROMOTION_DECLARED=1
      shift 2 ;;
    --no-promote) PROMOTION_DECLARED=1; PROMOTE_TO=''; shift ;;
    --plan)       MODE=plan; shift ;;
    --dry-run)    MODE=dry-run; shift ;;
    *) printf '\n%s unknown argument "%s".\n%s\n\n' "$TAG" "$1" "$USAGE" >&2; exit 2 ;;
  esac
done

# ── ⚠️ THE NODE FLOOR, AND IT IS THE FIRST THING THIS SCRIPT DOES ───────────────────────────────────────────
# Both gestures that matter run node processes on the HOST. A unit with no node would die AFTER
# `bin/box-down.sh` had already destroyed the database, which is the one ordering this refusal exists to
# prevent. It refuses by name, reads nothing and starts nothing.
# shellcheck source=bin/require-node.sh
. "$HERE/bin/require-node.sh"
require_node || exit 2

: "${COMPOSE_PROJECT_NAME:=forge-preseed}"
export COMPOSE_PROJECT_NAME

# ── ★★ THE DESTINATION IS A PARAMETER, NEVER A CONSTANT ─────────────────────────────────────────────────────
#
# ⛔ The address of a private network may not live in a versioned file (`bin/box-up.sh` §0b says it at
# length), so this script LEARNS the destination and refuses when it has not been told one. There are three
# ways to tell it and no default:
#
#   --promote <where>          the argument, which is what a scheduler's line carries
#   FORGE_CYCLE_PROMOTE_TO     the environment, for a unit that would rather hold it there
#   --no-promote               the DECLARED way to say "there is no destination" — gesture 3 is then skipped
#                              WITH ITS REASON, in the roteiro, rather than being quietly absent
if [ "$PROMOTION_DECLARED" = 0 ] && [ -n "${FORGE_CYCLE_PROMOTE_TO:-}" ]; then
  PROMOTE_TO="$FORGE_CYCLE_PROMOTE_TO"
  PROMOTION_DECLARED=1
fi
if [ "$PROMOTION_DECLARED" = 0 ]; then
  printf '\n%s refusing to start: this cycle has not been told where to promote the box to, and it will not\n' "$TAG" >&2
  printf '        guess. A rebirth DE-PROMOTES the admin, so a cycle that skips the promotion by accident\n' >&2
  printf '        hands over a box whose shop answers on the network and whose admin refuses every login.\n' >&2
  printf '        Say which one you mean:\n' >&2
  printf '          bash bin/box-cycle.sh --promote <tailnet|localhost|hostname>\n' >&2
  printf '          FORGE_CYCLE_PROMOTE_TO=<where> bash bin/box-cycle.sh\n' >&2
  printf '          bash bin/box-cycle.sh --no-promote      the box stays where it is born (localhost)\n' >&2
  printf '        Nothing has been read, started or written.\n\n' >&2
  exit 2
fi

PROMOTES=1
[ -n "$PROMOTE_TO" ] || PROMOTES=0
PLANNED_SKIPS=''
[ "$PROMOTES" = 1 ] || PLANNED_SKIPS="3=$SKIP_WHY_PROMOTE"

LOG_DIR="${FORGE_CYCLE_LOG_DIR:-$HERE/cycle-logs}"
LOCK="$LOG_DIR/cycle.lock"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
[ "$MODE" = dry-run ] && STAMP="$STAMP-dry-run"
LOG="$LOG_DIR/$STAMP.log"

# ── ★ `--plan` · THE ROTEIRO WITHOUT THE CYCLE ──────────────────────────────────────────────────────────────
#
# It answers "what would this command do?" in milliseconds, where the answer otherwise costs ~90 minutes and
# a box. ⛔ IT TOUCHES NOTHING: no directory is created, no lock is taken, no log is opened, no container is
# spoken to. It is also how this slice is reviewed without a box: see `bin/box-cycle.guard.mjs`.
if [ "$MODE" = plan ]; then
  node "$HERE/bin/roteiro.mjs" --mode plan --steps "$CYCLE_STEPS" --skipped "$PLANNED_SKIPS" || exit 2
  printf '\n   destination   %s\n' "${PROMOTE_TO:-<none: --no-promote, gesture 3 is skipped above>}"
  printf '   project       %s   (COMPOSE_PROJECT_NAME)\n' "$COMPOSE_PROJECT_NAME"
  printf '   log would be  %s\n' "$LOG"
  printf '   lock          %s\n' "$LOCK"
  printf '\n   the commands, in order:\n'
  printf '     1   bash bin/box-down.sh\n'
  printf '     2   bash bin/box-up.sh --no-warm\n'
  if [ "$PROMOTES" = 1 ]; then
    printf '     3   bash bin/box-up.sh --promote %s\n' "$PROMOTE_TO"
  else
    printf '     3   SKIPPED — see the reason above\n'
  fi
  printf '     4   bash bin/box-up.sh --warm-only\n\n'
  printf '   nothing was read, started or written by this invocation.\n\n'
  exit 0
fi

# ── ★★ THE LOCK — IT REFUSES OUT LOUD, AND IT IS NOT ETERNAL ────────────────────────────────────────────────
#
# ⛔ TWO OVERLAPPING RUNS DESTROY EACH OTHER: the second one's `bin/box-down.sh` tears down the box the first
# one is seeding, and what comes out is a half-seeded box that no verdict describes. So the second run
# REFUSES, naming the pid, the age and the log of the run that holds the lock. ⛔ It does not wait: a cycle
# queued behind a cycle is two resets in one night, which nobody asked for.
#
# ⚠️ AND A LOCK WHOSE PROCESS IS GONE IS NOT A LOCK. A run killed at minute 40 (a reboot, an OOM, a hand on
# Ctrl-C) would otherwise leave a file that silently stops every future cycle — one crash, and the box is
# never reset again, with nothing saying why. So liveness is CHECKED and a dead holder is taken over LOUDLY.
#
# ⚠️ LIVENESS IS TWO QUESTIONS, NOT ONE. `kill -0` also fails with EPERM — a live process owned by somebody
# else — so a unit running as another user would read "alive" as "dead" and take the lock from a running
# cycle. `/proc/<pid>` answers the existence question without permission to signal; either one saying yes
# means the holder is alive.
mkdir -p "$LOG_DIR" || { printf '\n%s could not create %s — the log and the lock both live there.\n\n' "$TAG" "$LOG_DIR" >&2; exit 2; }

holder_is_alive() { # <pid>
  local pid="$1"
  case "$pid" in '' | *[!0-9]*) return 1 ;; esac
  [ -d "/proc/$pid" ] && return 0
  kill -0 "$pid" 2>/dev/null
}

take_lock() {
  local pid age
  if (set -o noclobber; printf 'pid=%s\nstarted=%s\nlog=%s\nhost=%s\n' "$$" "$STAMP" "$LOG" "$(uname -n)" > "$LOCK") 2>/dev/null; then
    return 0
  fi
  pid="$(sed -n 's/^pid=//p' "$LOCK" 2>/dev/null | head -1)"
  if holder_is_alive "$pid"; then
    age="$(sed -n 's/^started=//p' "$LOCK" 2>/dev/null | head -1)"
    printf '\n%s REFUSING: another cycle is running and this one will not queue behind it.\n' "$TAG" >&2
    printf '        holder    pid %s, started %s\n' "${pid:-<unreadable>}" "${age:-<unreadable>}" >&2
    printf '        its log   %s\n' "$(sed -n 's/^log=//p' "$LOCK" 2>/dev/null | head -1)" >&2
    printf '        lock      %s\n' "$LOCK" >&2
    printf '        A second run would tear down the box the first one is seeding. Nothing was touched.\n' >&2
    printf '        If that pid is NOT a cycle, delete the lock by hand — this script only takes over a\n' >&2
    printf '        lock whose process is gone.\n\n' >&2
    return 1
  fi
  printf '\n%s ⚠️  STALE LOCK TAKEN OVER: pid %s is not running any more.\n' "$TAG" "${pid:-<unreadable>}" >&2
  printf '        The cycle that wrote it died without releasing it (started %s, log %s).\n' \
    "$(sed -n 's/^started=//p' "$LOCK" 2>/dev/null | head -1)" "$(sed -n 's/^log=//p' "$LOCK" 2>/dev/null | head -1)" >&2
  printf '        Read that log before trusting the box: a cycle that died mid-birth leaves one behind.\n\n' >&2
  rm -f "$LOCK"
  (set -o noclobber; printf 'pid=%s\nstarted=%s\nlog=%s\nhost=%s\n' "$$" "$STAMP" "$LOG" "$(uname -n)" > "$LOCK") 2>/dev/null || {
    printf '\n%s could not take the lock even after removing a stale one — %s\n\n' "$TAG" "$LOCK" >&2
    return 1
  }
  return 0
}

take_lock || exit 3
# ⚠️ ONLY THE HOLDER RELEASES. `$$` is compared before the file is removed, so a run that refused above (and
# every other process) can never delete somebody else's lock on its way out.
release_lock() {
  [ "$(sed -n 's/^pid=//p' "$LOCK" 2>/dev/null | head -1)" = "$$" ] && rm -f "$LOCK"
  return 0
}
trap 'release_lock' EXIT INT TERM

# ── ★ THE LOG — ONE PER RUN, AND THE SCHEDULER IS TOLD WHERE IT IS ──────────────────────────────────────────
#
# fd 3 is the output the caller started with: the short channel. Everything else goes into the log. A human at
# a terminal watches the run live (`tee`); a scheduler gets four lines and a path, which is the difference
# between a mail somebody reads and a 90-minute transcript nobody does.
exec 3>&2
brief() { printf '%s %s\n' "$TAG" "$*" >&3; }
if [ -t 1 ] && command -v tee >/dev/null 2>&1; then
  exec > >(tee -a "$LOG") 2>&1
else
  exec >>"$LOG" 2>&1
fi

say() { printf '\n\033[1m══ %s\033[0m\n' "$*"; }
note() { printf '   %s\n' "$*"; }

REHEARSAL=''
[ "$MODE" = dry-run ] && REHEARSAL='⚑ REHEARSAL (--dry-run): no gesture below was executed. '

say "the cycle · $STAMP"
note "${REHEARSAL}project $COMPOSE_PROJECT_NAME · destination ${PROMOTE_TO:-<none: --no-promote>} · log $LOG"
brief "started $STAMP — ${REHEARSAL}log: $LOG"

RAN=''
RESULTS=''

# ★ EACH GESTURE IS TIMED AND ITS STATUS IS RECORDED, because "it ran" and "it worked" are different
# sentences and a summary that prints the first while meaning the second is the shape this repository keeps
# paying for. The duration is here for the same reason: the first real cycle is also the measurement of how
# long the schedule has to allow for.
run_gesture() { # <id> <title> <command…>
  local id="$1" title="$2"
  shift 2
  local began ended status
  say "$id · $title"
  note "\$ $*"
  began="$(date +%s)"
  if [ "$MODE" = dry-run ]; then
    note '⚑ REHEARSAL — not executed. The status below is the rehearsal’s, not the box’s.'
    status=0
  else
    "$@"
    status=$?
  fi
  ended="$(date +%s)"
  RAN="$RAN $id"
  RESULTS="$RESULTS$id=$status=$((ended - began))
"
  note "$id · exit $status · $((ended - began))s"
  return "$status"
}

run_gesture 1 'tear the box down (state dies, the photo cache lives)' \
  bash "$HERE/bin/box-down.sh"

run_gesture 2 'the birth, warming left for gesture 4' \
  bash "$HERE/bin/box-up.sh" --no-warm

if [ "$PROMOTES" = 1 ]; then
  run_gesture 3 "the promotion — $PROMOTE_TO" \
    bash "$HERE/bin/box-up.sh" --promote "$PROMOTE_TO"
else
  say '3 · SKIPPED'
  note "why: $SKIP_WHY_PROMOTE"
  SKIPPED="3=$SKIP_WHY_PROMOTE"
fi

run_gesture 4 'the re-warm, at the address the box now publishes' \
  bash "$HERE/bin/box-up.sh" --warm-only

# ── ★★ WHAT THIS RUN DID, GRADED BY THE SAME TOOL THE BIRTH USES ────────────────────────────────────────────
#
# `bin/roteiro.mjs` is given the declaration and the ledger this run STAMPED. A gesture that neither ran nor
# was declared skipped is red there — which is the accident a wrapper of four calls is otherwise perfectly
# able to hide (an `if` around a call, a copy-paste that ran gesture 2 twice).
say 'the roteiro (which gestures this cycle ran, which it skipped, and why)'
ROTEIRO_INCOMPLETE=''
node "$HERE/bin/roteiro.mjs" --mode result --steps "$CYCLE_STEPS" --ran "$RAN" --skipped "${SKIPPED:-}" \
  || ROTEIRO_INCOMPLETE=1

say 'the gestures, with their clocks'
while IFS='=' read -r id status secs; do
  [ -n "$id" ] || continue
  if [ "$status" = 0 ]; then note "$id · ok      · ${secs}s"; else note "$id · EXIT $status · ${secs}s"; fi
done <<RESULTS_TABLE
$RESULTS
RESULTS_TABLE

# ── ⛔ THE EXIT POLICY, AS A FUNCTION SO THAT IT CAN BE GRADED WITHOUT A 90-MINUTE CYCLE ─────────────────────
#
# It takes its whole subject from its argument and from `CYCLE_TOLERATED`, which is what lets
# `bin/box-cycle.guard.mjs` source it out of this file and run it over fabricated results — both directions,
# in milliseconds. ⛔ `CYCLE_TOLERATED` IS EMPTY AND MUST STAY EMPTY UNTIL A REAL RUN JUSTIFIES AN ENTRY: see
# THE EXIT POLICY in this file's header for what the first measured entry is expected to be and why it is not
# written yet. One line per pardon, `<gesture id>=<exit status>|<the measurement that justifies it>`.
CYCLE_TOLERATED=''

cycle_verdict() { # <results: "<id>=<status>=<seconds>" per line> → 0 green, 1 red; names every reason
  local tag="${TAG:-[cycle]}" line id status why tol red=0
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    id="${line%%=*}"
    line="${line#*=}"
    status="${line%%=*}"
    [ "$status" = 0 ] && continue
    why=''
    while IFS= read -r tol; do
      [ -n "$tol" ] || continue
      case "$tol" in "$id=$status|"*) why="${tol#*|}" ;; esac
    done <<TOLERATED
${CYCLE_TOLERATED:-}
TOLERATED
    if [ -n "$why" ]; then
      printf '%s ⚠️  gesture %s exited %s and this cycle TOLERATES it: %s\n' "$tag" "$id" "$status" "$why" >&2
    else
      printf '%s ⛔ gesture %s exited %s, and no measurement in this file pardons that.\n' "$tag" "$id" "$status" >&2
      red=1
    fi
  done <<RESULTS
$1
RESULTS
  return "$red"
}

say 'the verdict'
VERDICT=0
cycle_verdict "$RESULTS" || VERDICT=1
if [ -n "$ROTEIRO_INCOMPLETE" ]; then
  note '⛔ this run cannot account for every gesture it declares — the roteiro above names it.'
  VERDICT=1
fi
if [ "$MODE" = dry-run ]; then
  note '⚑ REHEARSAL: this verdict grades the MECHANISM of this script, not the box. No gesture was executed.'
fi
if [ "$VERDICT" = 0 ]; then
  note "the cycle finished and every gesture it ran came back clean. log: $LOG"
  brief "finished GREEN — log: $LOG"
else
  note "⛔ the cycle is RED. Read the gesture(s) named above, in $LOG."
  brief "finished RED — read $LOG"
fi
exit "$VERDICT"
