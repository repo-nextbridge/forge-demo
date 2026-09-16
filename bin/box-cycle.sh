#!/usr/bin/env bash
# ★★★ THE SCHEDULED CYCLE — ONE SCRIPT, ONE SCHEDULE, FIVE GESTURES IN THE ONLY ORDER THAT WORKS.
#
#   bash bin/box-cycle.sh --promote <tailnet|localhost|hostname>   reborn, promoted, warmed, JUDGED
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
#  3 · THE EXIT CODE HAS TO BE DECIDED IN ONE PLACE. `bin/box-up.sh` exits 1 on purpose for eight distinct
#      reasons. A schedule that alerts on any non-zero alerts every night; one that ignores non-zero alerts
#      never. See THE EXIT POLICY below — it is the question this file exists to answer.
#
# ── ★★ THE FIVE GESTURES, WHY THE WARMING IS LAST BUT ONE, AND WHY THE VERDICT IS LAST ──────────────────────
#
#   1 · bash bin/box-down.sh                    the STATE dies; the ~3.6 GB photo cache LIVES (`--all` would
#                                               drop it too: ~40 minutes to re-pull, and it proves nothing)
#   2 · bash bin/box-up.sh --no-warm            the birth: the fifteen steps, warming left for gesture 4
#   3 · bash bin/box-up.sh --promote <where>    the box is pointed at the address it is really reached at
#   4 · bash bin/box-up.sh --warm-only          the warming, now at the promoted address
#   5 · bash bin/box-up.sh --verdict-only       ★ THE VERDICT: the birth's two questions asked AGAIN, of the
#                                               box as it is handed over — and it is THIS one that grades
#
# ★★★ GESTURE 5 EXISTS BECAUSE A VERDICT TAKEN BEFORE THE STATE IT GRADES IS FINISHED IS NOT A VERDICT, and
# that is a measurement rather than a principle. On the first real run of this cycle (2026-09-15) gesture 2
# exited 1 for two reasons — `cafe/` with no gate on it (step 14-bis) and an admin published at `localhost`
# while the box publishes itself on the tailnet (step 15) — and BOTH had stopped being true before the cycle
# ended: after gesture 3, `prove-doors` answered `every door answers as it must (8)` and `verify-config`
# answered `VERDICT: settled`. The birth was asked about the PROMOTED address of a box that is born on
# `localhost` by decision and had not claimed it yet.
#
# ⛔ SO THE REPAIR IS NOT A SOFTER GESTURE 2 — IT IS A LATER ASKING. Gesture 2 still says everything it says
# and still comes back non-zero; what changed is that the cycle no longer grades on it alone. See THE EXIT
# POLICY below: a reason gesture 2 gave is forgiven ONLY where a later gesture put the SAME question and
# answered ✓, and every reason nobody asks again stays red.
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
# ⚠️ AND NEITHER THE LOOP THAT WARMS NOR THE LOOP THAT OPENS THE DOORS IS COPIED INTO THIS FILE. Warming is once per tenant with THAT TENANT'S own
# token, because the read face that lists a tenant's stores resolves the tenant from the credential — and the
# rule for a tenant's secret name (the first keeps the unsuffixed one) already has two authors. So gesture 4
# asks `bin/box-up.sh --warm-only`, which drives the same `warm_every_tenant` step 14 drives. A third copy of
# that rule here would drift on the day a tenant is added to `seed/box.json`. Gesture 5 asks
# `bin/box-up.sh --verdict-only` for exactly the same reason, and it drives the same `prove_every_tenant`
# step 14-bis drives.
#
# ── ⛔ THE EXIT POLICY, WHICH IS THE QUESTION THIS FILE EXISTS TO ANSWER ─────────────────────────────────────
#
# WHICH NON-ZERO IS ACCEPTABLE? ★ THE ANSWER IS NOT A GESTURE, IT IS A REASON, AND IT IS THIS ONE SENTENCE:
#
#       A REASON A GESTURE GAVE IS FORGIVEN ONLY WHERE A LATER GESTURE PUT THE SAME QUESTION AND ANSWERED ✓.
#       A REASON NOBODY ASKS AGAIN STAYS RED.
#
# ⛔ AND THAT IS WHY THERE IS NO `<gesture>=<status>` PARDON HERE ANY MORE. `bin/box-up.sh` exits 1 for eight
# distinct reasons; a pardon for "gesture 2 exited 1" would forgive a box whose shopper cannot sign in, a
# tenant holding another brand's catalogue, a totem that never started and a run that cannot account for its
# own steps — all four of them invisible behind the one reason that was measured. A blanket pardon is not a
# looser rule, it is a DIFFERENT rule: it stops reading the reason at all.
#
# ★★ HOW THE REASON IS READ, AND WHY IT IS THE SENTENCE AND NOT THE STATUS. Two ways were on the table:
# teach `bin/box-up.sh` a distinct exit CODE per family, or read the NAMED SENTENCES it already prints. The
# measurement decided it, and it is the first real run itself: gesture 2 came back with TWO reasons at once
# (`SHUT` and `MISCONFIGURED`). A status is ONE number and cannot carry a set — and a bitmask does not fit
# either. RE-MEASURED 2026-09-16, because the arithmetic is the whole answer: eight families have 2^8 − 1 =
# 255 non-empty subsets, and a shell status carries 125 usable values (0 is green, 126 is "not executable",
# 127 is "not found", 128+N is "killed by signal N" and nothing downstream can tell a deliberate 137 from a
# SIGKILL) — short by a factor of two. The low numbers are spoken for besides: `bin/box-up.sh` has 41 `die`
# call sites and 11 direct `exit 1` lines, all of them leaving status 1. And a code per family, without the
# set, would have had to DROP one of the two reasons the very run that opened this question produced.
#
# ⇒ So the reasons are read from the sentences, and `CYCLE_REASONS` below is that table — token, sentence,
# who asks it again, and the measurement. ⚠️ THE COST OF THAT IS PROSE, AND IT IS PAID BY A GUARD:
# `bin/box-cycle.guard.mjs` derives the eight red families out of `bin/box-up.sh` itself and reds if a
# sentence here stops matching the one printed there, if a family is added there and not named here, or if a
# reason nobody asks again is given a pardon.
#
# ⛔ AND AN UNRECOGNISED NON-ZERO IS RED, WHICH IS THE HALF THAT KEEPS THIS HONEST. A gesture that exits
# non-zero and names no reason in this table — a `die` in the middle of the birth, a promotion that refused,
# `bin/box-down.sh` failing — is graded red with its status, never forgiven for being unfamiliar.
#
# ⚠️ AND THE CYCLE DOES NOT STOP AT THE FIRST RED. It runs all five gestures and grades at the end, which is
# the whole mechanism: the reasons gesture 2 gives are answered by gestures that come AFTER it. Stopping
# there would leave the box in exactly the state this cycle exists to end — and would also leave the cycle
# unable to tell "not yet" from "broken", which is the defect this file was rewritten to end.
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
4|the re-warm, at the address this box publishes itself at (bin/box-up.sh --warm-only)
5|THE VERDICT — the birth’s two questions asked again, of the box as it is handed over (bin/box-up.sh --verdict-only)'

# >>> THE EXIT POLICY — sourced verbatim by bin/box-cycle.guard.mjs, which runs it over fabricated results
#
# ── ★★★ THE REASONS `bin/box-up.sh` CAN COME BACK WITH, AND WHO ASKS EACH ONE AGAIN ─────────────────────────
#
# `<token>|<the sentence bin/box-up.sh prints for it>|<the gesture that asks it AGAIN, empty if nobody>|<the
# measurement that justifies the pardon>`. One row per red family `bin/box-up.sh` has — all eight of them,
# including the six nobody asks again, because a family that is missing from this table would be read as an
# UNRECOGNISED non-zero, which is red but says nothing useful at 3am.
#
# ⛔ THE THIRD COLUMN IS THE WHOLE POLICY. A row with an empty third column can never be forgiven, no matter
# what the rest of the cycle did — which is the difference between this table and a list of pardons.
#
# ⚠️ THE SENTENCES ARE PINNED TO `bin/box-up.sh` BY `bin/box-cycle.guard.mjs`, in both directions. That guard
# is not decoration here: reading prose is the price of being able to tell two reasons apart in one status,
# and a pin that is not graded is a pin that rots.
CYCLE_REASONS='SHUT|HAS DOORS A SHOPPER CANNOT OPEN|5|measured on the first real cycle, 2026-09-15: the birth opens every door at the address it is PROMOTED to, which a box born on localhost has not claimed yet — `cafe/` came back with no gate on it. Gesture 5 opens the same doors after the promotion and the re-warm, and answered `every door answers as it must (8)` with the gate ✓ on that same door.
DOORS_UNKNOWN|NOTHING WAS LEARNED ABOUT|5|the other answer of the same step 14-bis, and gesture 5 IS that step asked again: a tenant whose doors could not be asked about during the birth is asked about again at the end, over the box as it is handed over. ⛔ Read it as UNPROVEN, and it is only forgiven where gesture 5 proved the doors open.
MISCONFIGURED|THE CONFIGURATION IS NOT WHAT THIS BOX DECLARES|5|measured on the first real cycle, 2026-09-15: a rebirth DE-PROMOTES the admin, so between gesture 2 and gesture 3 the box really is half promoted and step 15 is right to say so. Gesture 5 runs the same verify-config after the promotion, and answered `VERDICT: settled` with all 11 faces ✓.
MISSING_STORE|IS MISSING A STORE THIS REPOSITORY DECLARES||a store seed/box.json declares and the box does not hold is not a state anything later in this cycle builds. Gesture 4 does ask the same question — it is the one red the warmer still carries — but gesture 2 runs with --no-warm and can never report this, so a pardon here would be a rule nothing exercises.
UNSETTLED|DID NOT SETTLE. Everything above is standing||the verdict over the DATA (verify-seed, step 12). No gesture of this cycle seeds anything after the birth, so nothing asks it again: a tenant that came out holding the wrong catalogue is still holding it when the box is handed over.
UNSETTLED_EXTRA|IS NOT. The summary above says so||the box is standing and something it declares is not — the totem. Nothing later starts it, so nothing re-asks it.
ONLINE_ONLY_FAILED|A FACILITY THAT ONLY EXISTS ONLINE WAS CONFIGURED AND COULD NOT RUN||the edge and the bucket (step 13). It runs once, inside the birth, and no gesture after it re-runs the purge — a CDN that refused to be purged is still holding the dead box’s answers at the end of the cycle.
ROTEIRO_INCOMPLETE|THIS RUN CANNOT ACCOUNT FOR EVERY STEP IT DECLARES||a birth that cannot account for its own steps is not a birth anything can re-ask ABOUT: the question is about that run, and that run is over. ⛔ It is also the one reason that says the summary itself is unreliable, which is the last thing to forgive.'

#
# ── ⛔ THE EXIT POLICY, AS FUNCTIONS SO THAT IT CAN BE GRADED WITHOUT A 90-MINUTE CYCLE ──────────────────────
#
# Everything below takes its whole subject from its arguments and from `CYCLE_REASONS`, which is what lets
# `bin/box-cycle.guard.mjs` source this block out of this file and run it over fabricated results — every
# direction, in milliseconds. The header states the rule these implement; this is the mechanism.

# WHICH OF `bin/box-up.sh`'S NAMED REASONS ARE IN THIS GESTURE'S OUTPUT. Substring, fixed-string and
# case-sensitive on purpose: the reasons are SHOUTED in upper case by the closing block of `bin/box-up.sh`,
# and the same words in a step's own prose ("⛔ forgecafe has SHUT doors", "did NOT settle") are the report
# rather than the verdict. Matching those too would read a step's running commentary as the run's answer.
reasons_named_in() { # <file> → the tokens, space separated
  local line token sentence found=''
  [ -s "${1:-}" ] || { printf ''; return 0; }
  while IFS='|' read -r token sentence _asker _why; do
    [ -n "$token" ] || continue
    grep -qF -- "$sentence" "$1" 2>/dev/null && found="$found $token"
  done <<REASONS
$CYCLE_REASONS
REASONS
  printf '%s' "${found# }"
}

reason_field() { # <token> <field number> → that column of the row, empty if there is no such row
  local line token
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    token="${line%%|*}"
    [ "$token" = "$1" ] || continue
    printf '%s' "$(printf '%s' "$line" | cut -d'|' -f"$2")"
    return 0
  done <<REASONS
$CYCLE_REASONS
REASONS
  printf ''
}

gesture_status() { # <gesture id> <results> → its exit status, empty if that gesture never ran
  local line id
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    id="${line%%=*}"
    [ "$id" = "$1" ] || continue
    line="${line#*=}"
    printf '%s' "${line%%=*}"
    return 0
  done <<RESULTS
$2
RESULTS
  printf ''
}

# ★★★ THE VERDICT. One line per reason, and every one of them says WHY it was forgiven or why it was not —
# a pardon nobody can read is a silenced red, and a red with no reason is a red people learn to skip.
cycle_verdict() { # <results: "<id>=<status>=<seconds>=<reason tokens>" per line> → 0 green, 1 red
  local tag="${TAG:-[cycle]}" line id status reasons token asker asker_status red=0
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    id="${line%%=*}"
    line="${line#*=}"
    status="${line%%=*}"
    line="${line#*=}"
    reasons="${line#*=}"
    [ "$reasons" = "$line" ] && reasons=''
    [ "$status" = 0 ] && continue
    # ⛔ AN UNRECOGNISED NON-ZERO IS RED. A `die` in the middle of the birth, a promotion that refused, a
    # teardown that failed: none of them names a reason in the table, and none of them is forgivable by a
    # gesture that asks a different question.
    if [ -z "$reasons" ]; then
      printf '%s ⛔ gesture %s exited %s and named NO reason this cycle knows how to re-ask. Unforgivable by\n' "$tag" "$id" "$status" >&2
      printf '        construction: a pardon is a reason that was asked again, and this run named none.\n' >&2
      red=1
      continue
    fi
    for token in $reasons; do
      asker="$(reason_field "$token" 3)"
      if [ -z "$asker" ]; then
        printf '%s ⛔ gesture %s · %s — NOBODY ASKS THIS AGAIN, so it stays red: %s\n' "$tag" "$id" "$token" "$(reason_field "$token" 4)" >&2
        red=1
        continue
      fi
      if [ "$asker" = "$id" ]; then
        printf '%s ⛔ gesture %s · %s — this IS the gesture that asks it again, and nothing comes after it.\n' "$tag" "$id" "$token" >&2
        red=1
        continue
      fi
      asker_status="$(gesture_status "$asker" "$1")"
      if [ -z "$asker_status" ]; then
        printf '%s ⛔ gesture %s · %s — gesture %s was to ask it again and never ran.\n' "$tag" "$id" "$token" "$asker" >&2
        red=1
      elif [ "$asker_status" = 0 ]; then
        printf '%s ⚠️  gesture %s · %s — PARDONED: gesture %s put the same question and answered ✓. %s\n' "$tag" "$id" "$token" "$asker" "$(reason_field "$token" 4)" >&2
      else
        printf '%s ⛔ gesture %s · %s — gesture %s was to ask it again and came back %s, so nothing answered it.\n' "$tag" "$id" "$token" "$asker" "$asker_status" >&2
        red=1
      fi
    done
  done <<RESULTS
$1
RESULTS
  return "$red"
}
# <<< THE EXIT POLICY


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
  printf '     4   bash bin/box-up.sh --warm-only\n'
  printf '     5   bash bin/box-up.sh --verdict-only        ← the gesture that decides the exit code\n\n'
  printf '   the verdict grades REASONS, not gestures: a reason gesture 2 gave is forgiven only where a later\n'
  printf '   gesture put the same question and answered ✓. These are the ones with an answer coming:\n'
  while IFS='|' read -r token _sentence asker _why; do
    [ -n "$token" ] || continue
    [ -n "$asker" ] || continue
    printf '     %-18s re-asked by gesture %s\n' "$token" "$asker"
  done <<PLAN_REASONS
$CYCLE_REASONS
PLAN_REASONS
  printf '   every other reason bin/box-up.sh can give is RED here, and so is a non-zero that names none.\n\n'
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
# ★ AND EACH GESTURE'S OWN OUTPUT IS KEPT, SEPARATELY, FOR THE LENGTH OF THE RUN. The log holds everything
# in one stream; the verdict needs to know WHICH gesture printed which reason, and a single stream cannot
# answer that. These files are scratch and die with the run — the log is the record.
GESTURE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/box-cycle-XXXXXX")" || {
  printf '\n%s could not create a scratch directory for the gestures’ output.\n\n' "$TAG" >&2
  release_lock
  exit 2
}
trap 'release_lock; rm -rf "$GESTURE_DIR"' EXIT INT TERM

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
#
# ★★ AND ITS OUTPUT IS TEED TO A FILE OF ITS OWN so that the REASONS it named can be read back. A gesture
# that comes back non-zero is not yet a fact about the box — `bin/box-up.sh` says which of its eight red
# families fired, in a named sentence, and it is that sentence the verdict grades. ⛔ Nothing is swallowed:
# the same bytes still go to the log, which is where a human reads them.
run_gesture() { # <id> <title> <command…>
  local id="$1" title="$2"
  shift 2
  local began ended status out reasons
  out="$GESTURE_DIR/$id.out"
  : > "$out"
  say "$id · $title"
  note "\$ $*"
  began="$(date +%s)"
  if [ "$MODE" = dry-run ]; then
    note '⚑ REHEARSAL — not executed. The status below is the rehearsal’s, not the box’s.'
    status=0
  else
    # ⚠️ THE STATUS IS STAMPED INSIDE THE PIPELINE, not read off it. `$?` after a pipe is the pipe's, and the
    # first version of this read `tee`'s zero over a gesture that had exited 1 — measured while writing it.
    { "$@" 2>&1; printf '%s' "$?" > "$GESTURE_DIR/$id.status"; } | tee -a "$out"
    status="$(cat "$GESTURE_DIR/$id.status" 2>/dev/null)"
    case "$status" in '' | *[!0-9]*) status=1 ;; esac
  fi
  ended="$(date +%s)"
  reasons="$(reasons_named_in "$out")"
  RAN="$RAN $id"
  RESULTS="$RESULTS$id=$status=$((ended - began))=$reasons
"
  if [ -n "$reasons" ]; then
    note "$id · exit $status · $((ended - began))s · reason(s): $reasons"
  else
    note "$id · exit $status · $((ended - began))s"
  fi
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

# ★★★ AND THEN THE SAME TWO QUESTIONS AGAIN, OF THE BOX AS IT IS HANDED OVER — which is the gesture that
# decides this cycle's exit code. It is LAST because everything before it changes the answer: gesture 3
# claims the address the doors are opened at, and gesture 4 recreates nothing but fills what gesture 3
# emptied. ⛔ Its own non-zero is nobody's "not yet": nothing comes after it, so no reason it reports is ever
# pardoned below.
run_gesture 5 'the verdict — the birth’s two questions, asked again' \
  bash "$HERE/bin/box-up.sh" --verdict-only

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
while IFS='=' read -r id status secs reasons; do
  [ -n "$id" ] || continue
  if [ "$status" = 0 ]; then note "$id · ok      · ${secs}s"; else note "$id · EXIT $status · ${secs}s · ${reasons:-<named no reason this cycle knows>}"; fi
done <<RESULTS_TABLE
$RESULTS
RESULTS_TABLE

# ★ THE VERDICT IS GRADED OVER THE REASONS, AND GESTURE 5 IS WHERE THEY ARE ANSWERED. Read the lines this
# prints as pairs: every ⚠️ names the gesture that asked a question again and answered it; every ⛔ names one
# nobody did.
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
  note "the cycle finished. Every reason any gesture gave was asked again by a later one and answered ✓ — read the ⚠️ lines above for which. log: $LOG"
  brief "finished GREEN — log: $LOG"
else
  note "⛔ the cycle is RED. Read the REASON(s) named above — each ⛔ line says which gesture gave it and why nothing answered it — in $LOG."
  brief "finished RED — read $LOG"
fi
exit "$VERDICT"
