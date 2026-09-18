#!/usr/bin/env bash
# ★★★ THE BIRTH OF A BOX THAT IS NOT THIS LAPTOP — the fifteen steps, crossed to a host over ssh.
#
#   bash bin/birth-remote.sh stag                birth: the steps below, against deploy/stag.env's host
#   bash bin/birth-remote.sh stag --no-warm      the same WITHOUT step 14 (it is a report, never a gate)
#   bash bin/birth-remote.sh stag --plan         print the roteiro this invocation would run, touch nothing
#   bash bin/birth-remote.sh stag --again        a box that has ALREADY been born here — see THE REFUSAL
#   bash bin/birth-remote.sh stag --warm-only    ONLY step 14, on a deployed box already standing (§0w)
#   bash bin/birth-remote.sh stag --verdict-only ONLY steps 14-bis and 15, on a box already standing (§0v)
#
# ── ⛔⛔ WHAT THIS IS, AND WHAT `bin/deploy.sh` IS NOT ──────────────────────────────────────────────────────
#
# **A DEPLOY IS NOT A BIRTH, AND A BIRTH MAY NOT BE THE SIDE EFFECT OF ONE.**
#
# `bin/deploy.sh` runs on every adoption of a pin — that is what a pin bump IS. Seeding is reset+seed by
# nature (`bin/seed.mjs` rewrites the settings every screen inherits; `dist/seed-history.js` says «SKIPPING»
# or rebuilds a past; `seed-box.mjs` re-applies what `seed/box.json` declares over whatever an operator has
# since changed on the live box). ⇒ IF A DEPLOY SEEDED, EVERY VERSION BUMP WOULD OVERWRITE THE SHOP. So the
# birth is a gesture with its own name and its own file, and `bin/deploy.sh --birth` is the ONLY way the
# deploy reaches it — a flag that has to be typed, never a default, never an inference from an empty box.
# `bin/birth-remote.guard.mjs` proves both halves: a deploy without the flag, against a box that HOLDS data,
# touches none of it.
#
# ── ✅ WHY THIS IS A TRANSLATION AND NOT AN INVENTION ──────────────────────────────────────────────────────
#
# Everything delicate about a birth already exists and is not copied here:
#
#   · the container one-shots (`migrate`, `provision-ref`, `admin-platform-token`, `bulk-read-token`,
#     `seed-demo`, `seed-history`, `admin-host`) are entrypoints of the KERNEL IMAGE, so they cross by
#     `remote_compose` — the vehicle `bin/deploy.sh` already used for `migrate` and which now has one author
#     in `bin/remote-box.sh`;
#   · every other step is a `bin/*.mjs` of this repository that takes `--api <origin>` and a credential, so it
#     runs HERE, on the operator's node, against the box's public origin over https. That is not a new
#     posture: it is exactly what `--api` has meant since those scripts were written, and it is why the box
#     needs no node of its own (measured 2026-09-16: `forge-demo-stag` has none).
#
# ⛔ SO THE ONLY THING THIS FILE ADDS IS THE CROSSING. Where it must differ from `bin/box-up.sh` it says so at
# the step, with the measurement — and `bin/birth-remote.guard.mjs` pins this step list to that one, so a step
# added to the bench birth and not to this one is RED.
#
# ── ★★ WHAT A DEPLOYED BOX HAS THAT A BENCH DOES NOT: SIX ADDRESSES INSTEAD OF ONE ─────────────────────────
#
# The bench is ONE host (`localhost`) with six PORTS, and its root store claims it. A deployed box is SIX
# HOSTNAMES, one per face, each terminating TLS at the same edge. So the address space of this birth comes
# from `bin/deployed-faces.mjs` — the structure out of `seed/box.json` (which variable carries each face) and
# the value out of `deploy/<env>.env` (what that variable is worth on THIS box) — and every store claims its
# OWN hostname in the kernel's directory rather than one store claiming the box.
#
# ── THE REFUSAL ────────────────────────────────────────────────────────────────────────────────────────────
#
# A box that has already been born here carries `forge-operator-token` in its `.secrets` — written by step 3
# of this very script, so it is the birth's own record and not a guess. Finding it, this run REFUSES and says
# what `--again` costs. It is not a wipe (every step converges), but it is not nothing either: the settings,
# the assortments and the promotions this repository declares are re-applied over whatever the live box has
# since become.

set -uo pipefail

TAG='[birth-remote]'
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

# ── ★★ THE STEPS THIS BIRTH IS MADE OF, AS DATA — the same shape and the same ids as `bin/box-up.sh` ───────
#
# `<id>|<title>`, in the order they happen. `say` STAMPS the id as it runs, so what the roteiro prints at the
# end is what the run DID and never what this file meant to do. ⛔ THE IDS ARE THE BENCH BIRTH'S, and
# `bin/birth-remote.guard.mjs` compares the two lists: a step that exists there and not here is a step this
# box would silently never get.
BIRTH_STEPS='0c|the dataset (is it the one these images were built with?) — and it is DELIVERED
1|postgres + redis
2|migrate
3|provision-ref, once per tenant
3b|the host → store map (every face this box publishes)
3c|the coffee fork edge rule
3d|the admin sibling switcher and the gate’s per-tenant admin links
4|admin-platform-token (the box credential that serves every tenant)
4b|bulk-read-token (the reader this box owns, so its own documents stop spending the shopper ceiling)
5|kernel + edge + fronts
5b|the gate’s /enter key, once per tenant
6|seed-box (stores + settings), once per tenant
6b|every store claims the address it is published at
7|the totem (needs the counter store id step 6 resolved)
8|the curated data, once per tenant
9|seed-demo (the massive catalogue), once per DATASET tenant
10|the past (seed-history — 180 days), once per tenant
10b|waiting for the dispatcher to drain
11|the shop window (--phase window), once per tenant
12|the verdict over the DATA (verify-seed), once per tenant
13|the edge and the bucket (what only exists online)
14|warming every store the port says has a public page
14-bis|opening every door of every store
15|the verdict over the CONFIGURATION (verify-config)'

# ★ THE ONE REASON A STEP IS SKIPPED BY REQUEST, WRITTEN ONCE — the plan and the step itself print THIS
# string, so a plan cannot promise a reason the run does not give.
WARM_SKIP_WHY='asked with --no-warm — warmth is a REPORT, never a gate. ⚠️ WHAT IT COSTS: the box is handed over COLD, so the first visitor pays for every cache, and nobody learns how warm it came out. ⛔ WHAT IT DOES NOT COST: a store seed/box.json declares and this box does not hold is still graded — step 14-bis asks that question from the same two sources and is never skipped. Warm it later: `FORGE_OPERATOR_TOKEN=<token> node bin/warm-box.mjs --tenant <t> --api <origin>`'
# ★★ AND THE ONE REASON A STEP IS SKIPPED BY MEASUREMENT — see step 3c. It is a string for the same reason:
# the plan says it before the run, and the two may not be able to disagree.
COFFEE_SKIP_WHY='a DEPLOYED box routes the café by HOSTNAME and not by path. `caddy/Caddyfile` — the edge `deploy/box.env` names — already has a site block for {$FORGE_CAFE_DOMAIN} that falls through to `storefront-coffee`, so the fragment step 3c writes on the bench has nothing to add. ⛔ AND IT WOULD BE WORSE THAN USELESS: that fragment is bare `handle` blocks, only `caddy/Caddyfile.local` reads fragments, and `caddy/Caddyfile` imports /etc/caddy/extra/*.caddy at TOP level where a file must be a SITE BLOCK — `caddy validate` answered `parsed "handle" as a site address` once, which is not a broken extra host but a DEAD EDGE. ✅ The half of that step that IS about the box and not about the bench still runs: FORGE_COFFEE_STORE_ID is written, because the fork keys its own institutional pages on it'

STEPS_SKIPPED=''
STEPS_RAN=''
PLANNED_SKIPS=''

# ── THE ARGUMENTS ──────────────────────────────────────────────────────────────────────────────────────────
USAGE='usage: bash bin/birth-remote.sh <env> [--no-warm] [--plan] [--again] [--warm-only] [--verdict-only]'
ENV_NAME=''
WARM=1
PLAN_ONLY=0
AGAIN=0
# ★★ THE TWO PHASES, ASKED ALONE — and they are modes for the reason `bin/box-up.sh` states at its own §0w:
# a scheduled CYCLE has to warm AFTER everything that destroys warmth, and grade AFTER everything that could
# repair a red. On this side of the fence the ordering argument is the same and the mechanism is the same;
# what differs is where the credential comes from (§0t), because nothing was minted in this run.
MODE=birth
while [ $# -gt 0 ]; do
  case "$1" in
    --no-warm) WARM=0 ;;
    --plan)    PLAN_ONLY=1 ;;
    --again)   AGAIN=1 ;;
    --warm-only)    MODE=warm ;;
    --verdict-only) MODE=verdict ;;
    -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) printf '%s unknown option "%s".\n  %s\n' "$TAG" "$1" "$USAGE" >&2; exit 1 ;;
    *)
      [ -z "$ENV_NAME" ] || { printf '%s two environments named ("%s" and "%s"). One birth, one box.\n' "$TAG" "$ENV_NAME" "$1" >&2; exit 1; }
      ENV_NAME="$1" ;;
  esac
  shift
done
[ -n "$ENV_NAME" ] || {
  printf '%s %s\n' "$TAG" "$USAGE" >&2
  printf '%s   environments this repository declares:' "$TAG" >&2
  for f in "$HERE"/deploy/*.env; do b="$(basename "$f" .env)"; [ "$b" = 'box' ] || printf ' %s' "$b" >&2; done
  printf '\n' >&2
  exit 1
}
[ "$WARM" = 1 ] || PLANNED_SKIPS="14=$WARM_SKIP_WHY"
PLANNED_SKIPS="${PLANNED_SKIPS:+$PLANNED_SKIPS
}3c=$COFFEE_SKIP_WHY"

# ── THE VOICE ──────────────────────────────────────────────────────────────────────────────────────────────
# ★★ AND IT STAMPS THE CLOCK, because HOW LONG a step takes on a VM is a finding rather than trivia. The
# bench's birth is ~17 min on a laptop with sixteen threads; the staging box is ONE vCPU. A cron that fires
# the reset at 03:00 and the warm at 04:00 is sized on these numbers, so they have to be printed by the run
# that produced them and not remembered by whoever watched it.
STEP_NOW=''
STEP_STARTED=0
STEP_TIMES=''
say() {
  local now; now=$(date +%s)
  if [ -n "$STEP_NOW" ] && [ "$STEP_STARTED" != 0 ]; then
    STEP_TIMES="$STEP_TIMES${STEP_NOW%% ·*}=$(( now - STEP_STARTED ))s
"
  fi
  STEP_NOW="$*"
  STEP_STARTED=$now
  case "${1%% ·*}" in
    [0-9]*) STEPS_RAN="$STEPS_RAN ${1%% ·*}" ;;
  esac
  printf '\n\033[1m── %s   \033[0m\033[2m(%s)\033[0m\n' "$*" "$(date -u +%H:%M:%SZ)" >&2
}
note() { printf '   %s\n' "$*" >&2; }
# ⛔ THE ONLY OTHER HONEST ENDING FOR A STEP, AND IT COSTS A REASON — `bin/roteiro.mjs` reds on an empty one.
skip() { # <step id> <why>
  STEPS_SKIPPED="$STEPS_SKIPPED$1=$2
"
  printf '\n\033[1m── %s · SKIPPED\033[0m\n' "$1" >&2
  note "why: $2"
}
# ⛔⛔ EVERY STEP THAT FAILS ENDS THE BIRTH HERE, AND THAT IS THE LESSON THIS FILE WAS WRITTEN AROUND:
# «a gesture that refuses and does not interrupt what comes after is not a refusal, it is a warning».
# A half-seeded box handed over as if it were born is the failure this whole file exists to make impossible,
# so there is exactly one way past a step — `skip`, with a reason — and `die` is the only other exit.
die() { printf '\n%s ⛔ %s\n\n%s   THE BIRTH STOPPED HERE. Nothing after this step ran, so this box is NOT born —\n%s   it is standing at whatever state the step above left. Read the step, repair, run again.\n\n' \
  "$TAG" "$*" "$TAG" "$TAG" >&2; exit 1; }

# ── 0a · THE HOST'S NODE, AND IT IS THE FIRST THING THIS SCRIPT DOES ───────────────────────────────────────
# Most steps below are node processes on THIS machine (see the header), so the operator's node is an input of
# the birth. `bin/require-node.sh` READS the floor out of `forge.lock` — it is a property of the release this
# box pins, not of this repository — and `bin/node-floor.guard.mjs` proves this line comes before any `node`.
# shellcheck source=bin/require-node.sh
. "$HERE/bin/require-node.sh"
require_node || exit 1

command -v jq >/dev/null || die 'jq is required.'

# ── THE VEHICLE, AND IT HAS ONE AUTHOR ─────────────────────────────────────────────────────────────────────
# shellcheck source=bin/remote-box.sh
. "$HERE/bin/remote-box.sh"
remote_box_load "$ENV_NAME" "$HERE" die || exit 1

COMPOSE_FILES=(-f compose.yml -f compose.override.yml)

# ── THE TOPOLOGY, read from the ONE file that states it ────────────────────────────────────────────────────
BOX="$HERE/seed/box.json"
[ -f "$BOX" ] || die "no seed/box.json — this script has no topology to build."
TENANTS="$(jq -r '.tenants[].id' "$BOX")"
# ⛔ `$DATASET_TENANTS`, NEVER `$TENANTS` — the 02/09 defect `bin/box-up.sh` carries the measurement for: step
# 9 fills the tenant it is POINTED AT from whatever dataset the box mounts, and a dataset is ONE brand's
# catalogue. Looping every tenant handed the coffee shop 2 790 footwear products.
DATASET_TENANTS="$(jq -r '.tenants[]|select(.dataset == true)|.id' "$BOX")"
[ -n "$DATASET_TENANTS" ] || die "seed/box.json declares no tenant with \`dataset: true\`."

# The secret-name rule has ONE author and it is `bin/box-up.sh`'s; this is the same rule, and
# `bin/admin-access-key.mjs::accessKeySecretName` is the third reader of it. T1 keeps the unsuffixed names.
secret_name_for() { # <tenant> <kind: seed|driver|access>
  local t="$1" kind="$2" base
  case "$kind" in
    seed)   base=forge-operator-token ;;
    access) base=forge-admin-access-key ;;
    *)      base=forge-admin-service-token ;;
  esac
  if [ "$t" = "$(echo "$TENANTS" | head -1)" ]; then printf '%s' "$base"; else printf '%s-%s' "$base" "$t"; fi
}

# ── THE ADDRESS SPACE OF A DEPLOYED BOX, READ AND REFUSED BEFORE ANYTHING IS TOUCHED ───────────────────────
#
# ★ IT IS A READ AND A REFUSAL, ABOVE EVERY WRITE — the same placement `bin/box-up.sh`'s promotion keeps, for
# the same reason: a box refused here is byte-for-byte the box that ran the command.
FACES="$(node "$HERE/bin/deployed-faces.mjs")" || die "this environment cannot be born into — the [deployed-faces] line(s) above name
     the face and the variable. Nothing has been sent to ${FORGE_DEPLOY_HOST}."

face_value_of() { # <kind> <tenant> <store|->   → the hostname, or empty
  printf '%s\n' "$FACES" | awk -F'\t' -v k="$1" -v t="$2" -v s="$3" '$1==k && $2==t && $3==s {print $5}'
}
admin_origin_of() { # <tenant>  → https://<that tenant's admin face>
  local h; h="$(face_value_of admin "$1" -)"
  [ -n "$h" ] && printf 'https://%s' "$h"
}

# ── 0f · ★★ THE THREE PHASES THAT HAVE TWO CALLERS, AS FUNCTIONS ──────────────────────────────────────────
#
# ⚠️ THEY ARE FUNCTIONS RATHER THAN COPIES BECAUSE OF WHAT THEY KNOW, not to be tidy. Each one needs the
# tenant list (`$TENANTS`, out of `seed/box.json`) AND the rule for the name of a tenant's secret
# (`secret_name_for` — the first tenant keeps the unsuffixed name), and that rule already has three authors
# (`bin/box-up.sh`, this file, `bin/admin-access-key.mjs::accessKeySecretName`). A fourth, written inside a
# `--warm-only` block, would drift on the day a tenant is added to `seed/box.json` — and it would drift
# SILENTLY, because a tenant nobody warms is a tenant nobody reports on.
#
# ⛔ THEY SET THE SAME VARIABLES THE BIRTH'S CLOSING BLOCK READS, and that is deliberate: the modes below and
# the birth grade through ONE set of names, so a sentence can never mean one thing in a birth and another in
# a cycle. `bin/box-cycle.guard.mjs` pins those sentences across the fence.
warm_every_tenant() {
  local t tokvar tokval
  for t in $TENANTS; do
    tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
    eval "tokval=\${$tokvar:-}"
    FORGE_OPERATOR_TOKEN="$tokval" FORGE_REVALIDATE_SECRET="$BOX_REVALIDATE" \
      node "$HERE/bin/warm-box.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN"
    case $? in
      0) ;;
      2) WARM_UNKNOWN="$WARM_UNKNOWN $t" ;;
      3) MISSING_STORE="$MISSING_STORE $t" ;;
      *) COLD="$COLD $t" ;;
    esac
  done
}
prove_every_tenant() {
  local t tokvar tokval
  for t in $TENANTS; do
    tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
    eval "tokval=\${$tokvar:-}"
    FORGE_OPERATOR_TOKEN="$tokval" node "$HERE/bin/prove-doors.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN"
    case $? in
      0) note "$t · every door opened" ;;
      2) DOORS_UNKNOWN="$DOORS_UNKNOWN $t" ;;
      *) SHUT="$SHUT $t" ;;
    esac
  done
}
# ⚠️ AND IT IS ASKED OF THE BOX'S OWN `.env`, fetched for the length of this call — the file on this laptop
# describes the bench, and grading a deployed box against a bench's declaration answers a question nobody
# asked. The copy is removed on the way out, in the same function that made it.
verify_the_configuration() {
  local boxenv; boxenv="$(mktemp)"
  if "${REMOTE_SSH[@]}" "cat $(printf '%q' "$REMOTE_BOX_DIR/.env")" </dev/null > "$boxenv" 2>/dev/null; then
    node "$HERE/bin/verify-config.mjs" --api "$FORGE_PUBLIC_ORIGIN" --env "$boxenv" || MISCONFIGURED=1
  else
    MISCONFIGURED=1
    note '⛔ the box’s own .env could not be read, so the configuration was NOT graded.'
  fi
  rm -f "$boxenv"
}

# ── 0t · ⛔⛔ WHERE THE CREDENTIAL COMES FROM WHEN NOTHING WAS MINTED ───────────────────────────────────────
#
# In a birth, step 3 mints each tenant's operator token and holds it in this shell. The two modes below are
# asked of a box that was born days ago, by a scheduler — so the token has to come BACK off the box, and
# `remote_secret_get` is that read (its own header carries the custody argument).
#
# ⛔ AND AN ABSENT SECRET IS A REFUSAL, NEVER AN EMPTY STRING PASSED ALONG. An empty credential does not fail
# loudly at the port: it comes back `unauthorized`, which reads exactly like a box whose kernel is broken —
# and a scheduled run that reports the wrong failure is worse than one that reports none.
load_operator_tokens() {
  local t name val missing=''
  for t in $TENANTS; do
    name="$(secret_name_for "$t" seed)"
    val="$(remote_secret_get "$name")"
    if [ -z "$val" ]; then missing="$missing $name"; continue; fi
    eval "$(printf '%s' "$name" | tr 'a-z-' 'A-Z_')=\$val"
  done
  [ -z "$missing" ] || die "this box carries no$missing in its .secrets, so no credential can be presented for
     the tenant(s) that name. That is what a box which has NEVER BEEN BORN here looks like — birth it
     first (\`bash bin/birth-remote.sh ${ENV_NAME}\`); a warming or a verdict is not a birth."
}

# ── 0w · ★★★ `--warm-only` · STEP 14 ALONE, ON A BOX THAT IS ALREADY STANDING ──────────────────────────────
#
# ★★ WHY A CYCLE WARMS LAST, WHICH IS THE WHOLE REASON THIS MODE EXISTS: everything that holds warmth — the
# route cache, the ISR entries, the image derivatives — lives in a FRONT CONTAINER, and every gesture that
# recreates a front throws it away. Warming inside the birth and recreating afterwards hands over a box as
# cold as one that never warmed, having paid the ~1h10 for it.
#
# ⚠️ THIS MODE IS NOT A BIRTH AND DOES NOT PRETEND TO BE ONE. It runs one step, it stamps no roteiro, and its
# exit carries exactly what step 14's carries: warmth is a REPORT, and a store `seed/box.json` DECLARES that
# the box does not hold is still red. It opens no door and grades no configuration — `--verdict-only` does.
if [ "$MODE" = warm ]; then
  note "${ENV_NAME} · ${REMOTE_BOX_TARGET}:${REMOTE_BOX_DIR} · ${FORGE_PUBLIC_ORIGIN}"
  load_operator_tokens
  BOX_REVALIDATE="$(remote_env_get FORGE_REVALIDATE_SECRET)"
  COLD=''
  WARM_UNKNOWN=''
  MISSING_STORE=''
  say 'the re-warm · warming every store the port says has a public page, on a box already standing'
  note 'this is step 14 and nothing else — no door is opened and no configuration is graded here.'
  warm_every_tenant
  [ -z "$COLD" ] || printf '\n%s ⚠️  REPORT — THE RE-WARM DID NOT LEAVE%s FULLY WARM. Not a failure: warmth reports, it\n         does not grade. The ⚠ lines above name every url.\n\n' "$TAG" "$COLD" >&2
  [ -z "$WARM_UNKNOWN" ] || printf '\n%s ⚠️  REPORT — WARMTH IS UNKNOWN FOR%s: the warmer could not ASK. That is a different\n         sentence from "they are cold", and nothing above claims either.\n\n' "$TAG" "$WARM_UNKNOWN" >&2
  if [ -n "$MISSING_STORE" ]; then
    printf '\n%s ⛔ %s IS MISSING A STORE THIS REPOSITORY DECLARES. That is not warmth — the birth did not\n         build it, and this run only noticed. The ✗ line above names the store.\n\n' "$TAG" "$MISSING_STORE" >&2
    exit 1
  fi
  exit 0
fi

# ── 0v · ★★★ `--verdict-only` · STEPS 14-bis AND 15 ALONE, ASKED AGAIN OF A STANDING BOX ───────────────────
#
# ★★★ A VERDICT TAKEN BEFORE THE STATE IT GRADES IS FINISHED IS NOT A VERDICT. That is a measurement, not a
# principle: a birth can name a red that a later gesture has already repaired, and a cycle that graded on the
# birth alone would alert every week about a box that is perfectly well. So the two questions are put AGAIN,
# of the box as it is handed over — and a red HERE has nothing after it to repair it, which is what makes it
# worth waking somebody for.
if [ "$MODE" = verdict ]; then
  note "${ENV_NAME} · ${REMOTE_BOX_TARGET}:${REMOTE_BOX_DIR} · ${FORGE_PUBLIC_ORIGIN}"
  load_operator_tokens
  SHUT=''
  DOORS_UNKNOWN=''
  MISCONFIGURED=''
  say 'the verdict · the two questions of the birth, asked again of the box as it stands now'
  note 'this is 14-bis and 15 and nothing else — nothing is built, nothing is warmed, no address is moved.'
  prove_every_tenant
  say 'the verdict over the CONFIGURATION (verify-config)'
  verify_the_configuration
  [ -z "$SHUT" ] || printf '\n%s ⛔ THE BOX IS UP AND%s HAS DOORS A SHOPPER CANNOT OPEN. This was asked AGAIN, after the\n         birth and the warming, and it is still true: nothing comes after this to repair it.\n\n' "$TAG" "$SHUT" >&2
  [ -z "$DOORS_UNKNOWN" ] || printf '\n%s ⛔ NOTHING WAS LEARNED ABOUT%s'"'"'S DOORS. Read it as UNPROVEN, never as proven-open.\n\n' "$TAG" "$DOORS_UNKNOWN" >&2
  [ -z "$MISCONFIGURED" ] || printf '\n%s ⛔ THE CONFIGURATION IS NOT WHAT THIS BOX DECLARES. Asked AGAIN, of the box as it stands.\n\n' "$TAG" >&2
  if [ -n "$SHUT" ] || [ -n "$DOORS_UNKNOWN" ] || [ -n "$MISCONFIGURED" ]; then exit 1; fi
  note 'both questions of the birth were asked again here and both answered ✓.'
  exit 0
fi

# ── ★ `--plan` · THE ROTEIRO WITHOUT THE BIRTH ─────────────────────────────────────────────────────────────
# It reads nothing on the host and starts nothing. Placed AFTER the node floor and the face plan (both are
# reads, and both are exactly what a rehearsal is for) and BEFORE the first thing that touches the box.
if [ "$PLAN_ONLY" = 1 ]; then
  note "${ENV_NAME} · ${REMOTE_BOX_TARGET}:${REMOTE_BOX_DIR} · ${FORGE_PUBLIC_ORIGIN}"
  node "$HERE/bin/roteiro.mjs" --mode plan --steps "$BIRTH_STEPS" --skipped "$PLANNED_SKIPS" || exit 1
  printf '\n%s ✓ plan only. The face plan above DID run, against the real deploy/%s.env.\n\n' "$TAG" "$ENV_NAME"
  exit 0
fi

note "${ENV_NAME} · ${REMOTE_BOX_TARGET}:${REMOTE_BOX_DIR} · ${FORGE_PUBLIC_ORIGIN}"

# ── ⛔⛔ THE REFUSAL — A BOX THAT HAS ALREADY BEEN BORN HERE ────────────────────────────────────────────────
#
# The signal is the birth's OWN record and not a guess: step 3 files `forge-operator-token` into the box's
# `.secrets`, so its presence means this exact script has run against this exact box. Asked over the same
# channel everything else travels on, and the VALUE is never read — only whether the name is there.
#
# ⛔⛔ AND IT ASKS A SECOND QUESTION, BECAUSE THE FIRST ONE ALONE TORE A BOX DOWN AND LEFT IT DOWN.
#
# MEASURED on the first real remote cycle, 2026-09-17: gesture 1 (`bin/box-down.sh --env stag`) destroyed the
# state volumes and — correctly — KEPT `.secrets`, which is identity and not state. Gesture 2 then read that
# same `.secrets`, concluded the box had already been born, and REFUSED. The box stayed on the floor, with a
# cycle that had done exactly what each of its parts promised.
#
# ⇒ THE REFUSAL IS ABOUT A BOX SOMEBODY IS USING, AND A BOX WITH NO STATE IS NOT ONE. What it protects is
# "the settings, the assortments and the promotions this repository declares being re-applied over whatever
# the live box has since become" — a sentence with no subject when the database volume is gone. So the
# question is asked of the STATE (`<project>_pgdata`, the first name in `bin/box-down.sh`'s own STATE list),
# and identity left behind by a teardown stops being read as a life.
#
# ⚠️ THE TWO ANSWERS ARE DIFFERENT SENTENCES, deliberately. A box with secrets AND state is a live box and is
# refused; a box with secrets and NO state is a REBIRTH and says so out loud — a run that quietly did the
# right thing here would be one nobody could tell from the run that did the wrong one.
"${REMOTE_SSH[@]}" true 2>/dev/null || die "cannot reach ${REMOTE_BOX_TARGET} with ${REMOTE_BOX_KEY}. This script does not provision a
     host and does not deploy to one: run \`bash bin/deploy.sh ${ENV_NAME}\` first, which delivers the box."
if remote_secret_has "$(secret_name_for "$(echo "$TENANTS" | head -1)" seed)"; then
  # ⚠️ THE PROJECT NAME IS DERIVED THE WAY `bin/box-down.sh` DERIVES IT — `basename "$FORGE_DEPLOY_DIR"` —
  # and not defaulted here. It is the name the volumes carry, so a second author of it would ask about a
  # volume that does not exist and read every torn-down box as a rebirth, which is the failure inverted.
  if "${REMOTE_SSH[@]}" "docker volume inspect $(basename "$FORGE_DEPLOY_DIR")_pgdata" </dev/null >/dev/null 2>&1; then
    [ "$AGAIN" = 1 ] || die "${FORGE_DEPLOY_HOST} HAS ALREADY BEEN BORN AND STILL HOLDS ITS STATE — its .secrets carries the
     operator token step 3 files, and its pgdata volume is there. Every step below converges rather than
     wipes, so this is not a request to confirm a deletion. What it IS: the settings, the assortments, the
     promotions and the freight this repository DECLARES get re-applied over whatever the live box has since
     become, and \`seed-history\` will either rebuild the past or say it is SKIPPING one that is already
     there. On a box somebody is using, that is a decision.
       bash bin/birth-remote.sh ${ENV_NAME} --again"
    note '⚠️ --again: this box has been born before AND still holds its state; this run re-applies what the repository declares over it.'
  else
    note "⚠️ this box carries secrets from an earlier birth but its state volume is GONE — it was torn down."
    note '   Read as a REBIRTH, not a convergence: there is no live box to re-apply anything over. The'
    note '   identity a teardown deliberately keeps (certificates, the operator token) is reused; everything'
    note '   the state held is built again from zero by the steps below.'
  fi
fi

# ── 0c · ★★ THE DATASET — GRADED HERE, AND THEN DELIVERED, WHICH IS THE HALF A BENCH NEVER NEEDS ───────────
#
# On the bench the dataset is a host path that `compose.yml` mounts straight into the kernel. A deployed box
# has no such tree, so the birth carries it: ~40 MB of JSON (measured 2026-09-16: `catalog.json` is 36 MB and
# everything else together is 4 MB). ⛔ IT IS THE BIRTH'S CARGO AND NOT THE DEPLOY'S, deliberately — a pin
# bump has no business moving a catalogue, and `bin/deploy.sh`'s DELIVER list is the shape of a box rather
# than the shape of its data.
#
# ★ GRADED FIRST, DELIVERED SECOND. `bin/dataset-provenance.mjs` compares the stamp in the tree with the one
# `forge.lock` recorded at bake time; being wrong costs the ~74 minutes step 9 spends filling a whole store
# with the wrong catalogue, and the answer costs milliseconds. Sending an ungraded 40 MB first would be
# paying the transfer for a tree we are about to refuse.
#
# ⚠️⚠️ TWO VARIABLES WITH ONE NAME, AND THEY ARE ON TWO MACHINES. `FORGE_SEED_DATASET_HOST_DIR` means «the
# path this box's compose mounts the dataset from» — and `deploy/box.env` declares the BOX's answer
# (`./seed/dataset`, relative to the deploy directory), while this laptop's `.env` holds the OPERATOR's
# (a checkout of the monorepo). `remote_box_load` sourced the first into this shell, so the second has to be
# read out of the file explicitly rather than inherited. It is the same class of confusion `bin/box-up.sh`
# built `host_node` to prevent — one variable name serving two filesystems — arriving from the other side.
say '0c · the dataset (is it the one these images were built with?) — and it is DELIVERED'
DATASET_SRC="${FORGE_SEED_DATASET_SOURCE:-$(grep -m1 '^FORGE_SEED_DATASET_HOST_DIR=' "$HERE/.env" 2>/dev/null | cut -d= -f2-)}"
[ -n "$DATASET_SRC" ] || die "this machine does not say where the dataset is. The birth carries it to the box, so it has to
     exist here: put FORGE_SEED_DATASET_HOST_DIR in .env (the bench's own value is the same tree), or name it
     for this run with FORGE_SEED_DATASET_SOURCE=<path> bash bin/birth-remote.sh $ENV_NAME."
[ -d "$DATASET_SRC" ] || die "the dataset source \"$DATASET_SRC\" is not a directory on this machine."
provenance="$(FORGE_SEED_DATASET_HOST_DIR="$DATASET_SRC" node "$HERE/bin/dataset-provenance.mjs" "$HERE/forge.lock" 2>&1)" || {
  printf '%s\n' "$provenance" >&2
  die 'refusing to seed. Both stamps are named above — one of them is the tree you meant.'
}
while IFS= read -r line; do note "$line"; done <<EOF
$provenance
EOF
# ⚠️ THE DESTINATION IS DERIVED FROM WHAT THE CONTAINER WILL READ, never from a path typed twice: `compose.yml`
# mounts `${FORGE_SEED_DATASET_HOST_DIR:-./seed/dataset}` and that value is `deploy/box.env`'s.
DATASET_DEST="${REMOTE_BOX_DIR}/$(printf '%s' "${FORGE_SEED_DATASET_HOST_DIR:-./seed/dataset}" | sed 's|^\./||')"
case "${FORGE_SEED_DATASET_HOST_DIR:-./seed/dataset}" in
  /*) DATASET_DEST="$FORGE_SEED_DATASET_HOST_DIR" ;;
esac

# ── ★★★ A CONTAINER PATH MAY NEVER REACH A HOST PROCESS — and this script found that out the hard way ──────
#
# ⛔ MEASURED ON THE STAGING BOX 2026-09-16, AT STEP 11, AFTER TWENTY MINUTES OF SEEDING:
#
#     [seed] FORGE_SEED_DATASET_DIR=/app/seed-dataset holds no forge-seed-dataset.json.
#
# `deploy/box.env` declares the paths the BOX's containers read — `/app/seed-dataset`, `/data/seed-photos` —
# and `remote_box_load` sources that file into THIS shell, because that is where the host, the key and the
# hostnames come from. So every node process this script starts on the operator's machine INHERITED a path
# that is true three thousand kilometres away and false here.
#
# ★ IT IS THE SAME DEFECT `bin/box-up.sh::host_node` WAS WRITTEN FOR, ARRIVING FROM THE OTHER SIDE — there the
# container paths come from the bench's own `.env`, here from the deployed box's declaration. That function is
# a shell function inside a script this slice may not touch, so the RULE is re-stated rather than shared, and
# it is re-stated in the general form rather than as two variable names:
#
#   (1) the dataset is REMAPPED to the tree this machine really holds — the one step 0c just graded;
#   (2) every other FORGE_* still pointing under /app or /data is BLANKED, and the blanking is NAMED. A host
#       process that genuinely needs one then fails saying UNSET, which names itself, instead of chasing a
#       path into a filesystem that is not its own.
#
# ⚠️ (2) IS THE HALF THAT KEEPS THIS FROM GOING STALE: (1) is what I know, (2) is what I do not — a variable
# of that shape added to `deploy/box.env` next month is caught on its first run.
export FORGE_SEED_DATASET_DIR="$DATASET_SRC"
blanked=''
while IFS='=' read -r cpvar cpval; do
  case "$cpvar" in FORGE_*) ;; *) continue ;; esac
  [ "$cpvar" != 'FORGE_SEED_DATASET_DIR' ] || continue
  case "$cpval" in
    /app|/app/*|/data|/data/*) export "$cpvar="; blanked="$blanked $cpvar" ;;
  esac
done < <(env)
[ -z "$blanked" ] || note "blanked container path(s) for the steps that run HERE —$blanked"

"${REMOTE_SSH[@]}" "install -d -m 755 $(printf '%q' "$DATASET_DEST")" </dev/null || die 'could not make room for the dataset on the box.'
dataset_bytes="$(du -sk "$DATASET_SRC" | cut -f1)"
note "delivering $(( dataset_bytes / 1024 )) MiB of dataset to ${DATASET_DEST}"
tar -C "$DATASET_SRC" -czf - . | "${REMOTE_SSH[@]}" "tar -C $(printf '%q' "$DATASET_DEST") -xzf -" \
  || die 'delivering the dataset failed; step 9 would have filled the store with nothing.'
remote_stamp="$("${REMOTE_SSH[@]}" "cat $(printf '%q' "$DATASET_DEST/forge-seed-dataset.json") 2>/dev/null | jq -r '.stamp // .generated_at // \"?\"'" </dev/null)"
note "delivered · the box's copy stamps ${remote_stamp:-?}"

# ── 1 · the data tier ──────────────────────────────────────────────────────────────────────────────────────
# ⛔ NO MAILBOX SERVICE HERE, AND IT IS NOT AN OMISSION. `compose.yml` puts the bench collector behind
# `profiles: ['bench-mailbox']`, and a deployment asks for no profile — so `docker compose` never creates it
# and the box mails a real provider or nothing at all. `bin/box-up.sh` derives the same answer from the same
# `docker compose config --services`; here the answer is structurally empty and saying so is cheaper than
# asking a question with one possible answer.
say '1 · postgres + redis'
remote_compose "${COMPOSE_FILES[@]}" up -d postgres redis >/dev/null \
  || die 'could not start postgres/redis on the box. `docker compose ps` there says more.'
note 'up'

# ── 2 · migrate ────────────────────────────────────────────────────────────────────────────────────────────
# ★ A ONE-SHOT AND NEVER A BOOT HOOK, which is the model's own rule: a migration that runs as a container
# starts runs again on every restart, and a half-applied one on a box that is restarting is the state nobody
# can reason about. `run --rm` is a gesture with an exit code.
say '2 · migrate'
remote_compose "${COMPOSE_FILES[@]}" run --rm kernel node dist/migrate.js 2>&1 | grep -E '^\[migrate\]' >&2
# shellcheck disable=SC2181
[ "${PIPESTATUS[0]}" = 0 ] || die 'migrate failed. The stack is NOT being seeded — a box whose schema is half-applied must not serve.'

# ── 3 · provision-ref, once per tenant ─────────────────────────────────────────────────────────────────────
#
# ★★ AND THE ADMIN HOST IT CLAIMS IS THE **DEPLOYED** ONE. `seed/box.json` says `admin_host: localhost:8201`
# — true of a bench and false of this box — so the claim is made with the face `deploy/<env>.env` carries.
# A tenant whose directory holds `localhost:8201` answers `unknown_admin_host` to every operator who opens
# its real admin, after a login page that looked fine.
#
# ⚠️ NO TOKEN IS EVER PRINTED. The two secrets ride out on the container's stderr, are captured here into a
# temp file this script shreds, and are piped to the box's `.secrets` on STDIN — never in a command line,
# where `ps` on that host would show them.
say '3 · provision-ref (once per tenant)'

# ── ⛔⛔ AN ADMIN WITH NO OPERATOR IS AN ADMIN NOBODY CAN ENTER, AND IT LOOKS PERFECT FROM OUTSIDE ───────────
#
# `reference-env.ts` reads an unset FORGE_ADMIN_SEED_EMAIL as «seed no operator», so the line below creates
# the tenant, the bootstrap store and the two tokens — and NOBODY. Measured on the staging box 2026-09-17:
# both tenants held ZERO rows in `admin_user`, after a birth that ended green.
#
# ⚠️ AND THE THREE WAYS IN ARE CLOSED AT THE SAME TIME on a deployed box, which is what turns a missing row
# into a locked door: `FORGE_ADMIN_OPS_LOGIN` is off (deploy/box.env), the OTP needs `forge-smtp-pass`, and
# social login can only recognise an operator who already exists. So this is asked HERE, before the tenant is
# made, rather than discovered at a login screen that renders correctly.
if ! remote_env_has FORGE_ADMIN_SEED_EMAIL; then
  die "${FORGE_DEPLOY_HOST} has no FORGE_ADMIN_SEED_EMAIL, so this birth would create an admin with no
     operator in it — and on a deployed box there is then no way in at all (ops-login off, no OTP without
     \`forge-smtp-pass\`, and social login can only recognise somebody who already exists).
     It is a real person's inbox, so this repository does not carry it. Write it on the box, once:
       ssh ${FORGE_DEPLOY_USER}@${FORGE_DEPLOY_HOST} \"printf 'FORGE_ADMIN_SEED_EMAIL=%s\\nFORGE_ADMIN_SEED_NAME=%s\\n' \\
         'you@example.invalid' 'Your Name' >> ${FORGE_DEPLOY_DIR}/.env\"
     \`deploy/box.env\` deliberately does NOT declare it: a declared key beats a carried one, so declaring it
     empty is how the value got erased on every deploy before 2026-09-17."
fi

ADMIN_STORE_IDS='{}'
BOOTSTRAP_STORE_OF=''
for t in $TENANTS; do
  handle="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' "$BOX")"
  name="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.name' "$BOX")"
  ahost="$(face_value_of admin "$t" -)"
  [ -n "$handle" ] || die "seed/box.json declares no bootstrap store for tenant \"$t\"."
  [ -n "$ahost" ] || die "tenant \"$t\" has no admin face in this environment — bin/deployed-faces.mjs should have refused first."

  out="$(mktemp)"; err="$(mktemp)"
  remote_compose "${COMPOSE_FILES[@]}" run --rm \
    -e "FORGE_REF_TENANT=$t" -e "FORGE_REF_STORE_HANDLE=$handle" -e "FORGE_REF_STORE_NAME=$name" \
    -e "FORGE_ADMIN_HOST=$ahost" \
    kernel node dist/provision-ref.js > "$out" 2> "$err"

  op="$(sed -n '/operator token/{n;s/^[[:space:]]*//;p;q;}' "$err")"
  drv="$(sed -n '/login-driver token/{n;s/^[[:space:]]*//;p;q;}' "$err")"
  store="$(tail -1 "$out" | tr -d '\r\n')"
  if [ -z "$store" ]; then
    note "⚠️ provision-ref produced no store id for \"$t\" — its output follows:"
    sed 's/^/     /' "$err" >&2
    shred -u "$out" "$err" 2>/dev/null || rm -f "$out" "$err"
    die "provisioning \"$t\" failed."
  fi
  remote_secret_put "$(secret_name_for "$t" seed)" "$op" && s1=filed || s1='ABSENT'
  remote_secret_put "$(secret_name_for "$t" driver)" "$drv" && s2=filed || s2='ABSENT'
  # ★ AND IT IS EXPORTED INTO THIS SHELL TOO, because the node steps below run HERE. It never touches disk on
  # this machine and it never reaches a command line: `FORGE_OPERATOR_TOKEN=… node …` is an environment.
  eval "$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')=\$op"
  note "$t · store $handle = $store · admin door $ahost · $(secret_name_for "$t" seed): $s1 · $(secret_name_for "$t" driver): $s2"
  ADMIN_STORE_IDS="$(printf '%s' "$ADMIN_STORE_IDS" | jq -c --arg t "$t" --arg s "$store" '. + {($t): $s}')"
  BOOTSTRAP_STORE_OF="$BOOTSTRAP_STORE_OF$t $handle $store
"
  [ "$t" = "$(echo "$TENANTS" | tail -1)" ] && CAFE_STORE="$store"
  grep -E 'retired|hostname claimed' "$err" | sed 's/^[[:space:]]*/   /' >&2
  shred -u "$out" "$err" 2>/dev/null || rm -f "$out" "$err"
done

# ── 3b · THE HOST → STORE MAP — AND ON A DEPLOYED BOX IT IS ONE ENTRY PER FACE ─────────────────────────────
#
# ⚠️ WHERE THE BENCH HAS ONE HOSTNAME AND SIX PORTS, THIS BOX HAS SIX HOSTNAMES. The bench's map is every
# SPELLING of one machine pointing at the ROOT store; here each shop has an address of its own, so the map is
# `{<that shop's hostname>: <that shop's store id>}`. The fronts read it at boot
# (`packages/storefront-kit/src/resolve-store.ts`, before it asks the port), which is why it is written BEFORE
# step 5 — and why it is COMPLETED at 6b, when the stores step 6 creates finally have ids.
#
# ⚠️ SINGLE-QUOTED, AND THE QUOTES ARE THE WHOLE FIX (bin/box-up.sh step 3b): `.env` is read by TWO parsers,
# compose's and bash's, and a bare JSON value loses its inner double quotes to `source`.
say '3b · the host → store map (every face this box publishes)'
store_map='{}'
while read -r t handle store; do
  [ -n "${t:-}" ] || continue
  h="$(face_value_of store "$t" "$handle")"
  [ -n "$h" ] || continue
  store_map="$(printf '%s' "$store_map" | jq -c --arg h "$h" --arg s "$store" '. + {($h): $s}')"
done <<EOF
$BOOTSTRAP_STORE_OF
EOF
remote_env_put FORGE_STORE_HOSTS "'$store_map'" || die 'could not write the host → store map to the box.'
note "$(printf '%s' "$store_map" | jq -r 'length') face(s) mapped — the rest arrive at 6b, when their stores exist"

if [ "$ADMIN_STORE_IDS" != '{}' ]; then
  remote_env_put FORGE_ADMIN_STORE_IDS "'$ADMIN_STORE_IDS'" || die 'could not write the gate’s store ids.'
  note "$(printf '%s' "$ADMIN_STORE_IDS" | jq -r 'length') tenant(s) have a store for the gate's /enter door"
fi

# ── 3c · THE COFFEE FORK'S EDGE RULE — SKIPPED HERE, AND THE REASON IS MEASURED ────────────────────────────
# See $COFFEE_SKIP_WHY. The half that is about the BOX rather than about the bench still runs.
skip 3c "$COFFEE_SKIP_WHY"
if [ -n "${CAFE_STORE:-}" ]; then
  remote_env_put FORGE_COFFEE_STORE_ID "$CAFE_STORE" || die 'could not write the coffee fork’s store id.'
  note "FORGE_COFFEE_STORE_ID → $CAFE_STORE (the fork's own institutional pages key on it; its absence is silent)"
fi

# ── 3c-bis · THE PURGE SECRET, MINTED RATHER THAN REMEMBERED ──────────────────────────────────────────────
# Measured on the bench of 2026-09-02: an empty `FORGE_REVALIDATE_SECRET` made the kernel log
# `storefront cache invalidation OFF` at boot and every purge was silently refused — which reached the
# operator as "unpublishing a product leaves it selling for the whole TTL". Its home is `.env` and not the
# secret store, and `env-source.sh` says why at length.
if [ -z "$(remote_env_get FORGE_REVALIDATE_SECRET)" ]; then
  remote_env_put FORGE_REVALIDATE_SECRET "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" \
    || die 'could not mint the purge secret on the box.'
  note 'purge secret minted (the kernel can now bust the vitrine instead of waiting out the TTL)'
else
  note 'purge secret already present'
fi
# ★★ AND THE HOST-SIDE STEPS ARE GIVEN IT, WHICH THE FIRST RUN AGAINST THE STAG PROVED THEY NEEDED. `seed.mjs`
# busts the vitrine's cache with this value and said so out loud when it did not have one:
# «no FORGE_REVALIDATE_SECRET: everything this run wrote landed, and the STOREFRONT still serves its cached
# render until the TTL for cafe, balcao». On the bench the birth sources `.env` and inherits it; here the
# value lives on the BOX, so it is read back once and handed to every step that writes through the port.
# ⚠️ Read AFTER the mint above, never before: a run that minted one would otherwise hand out the empty string
# it read a line earlier.
BOX_REVALIDATE="$(remote_env_get FORGE_REVALIDATE_SECRET)"
[ -n "$BOX_REVALIDATE" ] || note '⚠️ the box has no purge secret, so nothing this birth writes will bust the vitrine'


# ── 3d · THE ADMIN'S SIBLING SWITCHER AND THE GATE'S ADMIN LINKS ──────────────────────────────────────────
# Both are derived from `seed/box.json` and both are ENV, read once at boot — so they are written BEFORE
# step 5. ⚠️ THE OVERRIDES ARE THIS ENVIRONMENT'S FACES, for the same reason step 3's claim is: the declared
# `admin_host` is a bench address and this box is not a bench.
say '3d · the admin sibling switcher and the gate’s per-tenant admin links'
sib_overrides='{}'
for t in $TENANTS; do
  sib_overrides="$(printf '%s' "$sib_overrides" | jq -c --arg t "$t" --arg u "$(admin_origin_of "$t")" '. + {($t): $u}')"
done
siblings="$(jq -c --argjson ov "$sib_overrides" '[ .tenants[] | { name: (.settings.tenant_name // .id), url: $ov[.id] } ]' "$BOX")"
gate_urls="$(jq -c --argjson ov "$sib_overrides" '[ .tenants[] | { key: .id, value: $ov[.id] } ] | from_entries' "$BOX")"
remote_env_put FORGE_ADMIN_SIBLINGS "'$siblings'" || die 'could not write the sibling switcher.'
remote_env_put FORGE_GATE_ADMIN_URLS "'$gate_urls'" || die 'could not write the gate’s admin links.'
note "$(echo "$TENANTS" | wc -w) admin door(s), at this environment's own hostnames"

# ── 4 · the box's own platform credential ─────────────────────────────────────────────────────────────────
say '4 · admin-platform-token (the box credential that serves every tenant)'
out="$(mktemp)"
remote_compose "${COMPOSE_FILES[@]}" run --rm kernel node dist/admin-platform-token.js > "$out" 2>/dev/null
tok="$(grep -oE '^fo[a-z]{2}_[A-Za-z0-9_-]+' "$out" | tail -1)"
remote_secret_put forge-admin-platform-token "$tok" && note 'forge-admin-platform-token: filed' \
  || note '⚠️ forge-admin-platform-token: ABSENT — host mode will answer not_configured on every login'
shred -u "$out" 2>/dev/null || rm -f "$out"

# ── 4b · the box's own reader ─────────────────────────────────────────────────────────────────────────────
# ⚠️ ABSENT IS A DEGRADED BOX, NEVER A DEAD ONE: without it the feed, the sitemap and the warm run still
# build — they pay from the shopper's budget. So this step NOTES and never dies.
say '4b · bulk-read-token (the reader this box owns, so its own documents stop spending the shopper ceiling)'
out="$(mktemp)"
remote_compose "${COMPOSE_FILES[@]}" run --rm kernel node dist/bulk-read-token.js > "$out" 2>/dev/null
tok="$(grep -oE '^fo[a-z]{2}_[A-Za-z0-9_-]+' "$out" | tail -1)"
remote_secret_put forge-bulk-read-token "$tok" && note 'forge-bulk-read-token: filed' \
  || note '⚠️ forge-bulk-read-token: ABSENT — the feed, the sitemap and the warm run will spend the shopper ceiling'
shred -u "$out" 2>/dev/null || rm -f "$out"

# ── 5 · the rest of the tier ──────────────────────────────────────────────────────────────────────────────
# ⚠️ THE COUNTER IS NOT HERE. `compose.override.yml:140` demands `FORGE_TOTEM_STORE_ID` and that store does
# not exist until step 6 — so the totem is held at zero replicas until step 7, exactly as `bin/deploy.sh`
# holds it, and with the same sentinel vocabulary (`sto_PENDING_SEED`) rather than a second one.
#
# ⚠️ AND IT NAMES NO SERVICE, WHICH IS THE OPPOSITE OF WHAT THE BENCH DOES — MEASURED ON THE STAGING BOX,
# 2026-09-16, first attempt: `up -d --scale totem=0 kernel caddy admin storefront checkout storefront-coffee`
# answered `no such service: totem: disabled` and the birth stopped. Compose refuses a `--scale` for a service
# the invocation did not ask for. `bin/box-up.sh` names its six because the bench's compose carries profile
# services it must not start; a deployed box has none (the mail collector is behind `profiles:`, so it is
# never created) — so the whole file minus the counter IS the answer, and `bin/deploy.sh` already says why
# `--scale 0` beats a shorter list: a list has to be kept in step with two compose files, which is rot this
# repository has paid for once.
say '5 · kernel + edge + fronts'
remote_compose "${COMPOSE_FILES[@]}" up -d --remove-orphans --scale totem=0 >/dev/null \
  || die 'could not start the tier on the box. `docker compose ps` there says which container.'
# ⚠️ AND THE VERDICT WAITS, because a certificate is not instant: Caddy asks Let's Encrypt for each hostname
# when it starts and a first boot with six of them takes tens of seconds (measured 2026-09-16 — a probe four
# seconds after `up` saw six unreachable faces and the same six answered a minute later).
# ⚠️ HOW LONG IT WAITS IS THE ENVIRONMENT'S, NOT THIS SCRIPT'S — the same reasoning `bin/deploy.sh` applies
# to `FORGE_DEPLOY_FACE_WAIT`. A first boot asking Let's Encrypt for six names takes tens of seconds; a
# scenario that is never going to answer should not cost three minutes to find out.
BIRTH_HEALTH_WAIT="${FORGE_BIRTH_HEALTH_WAIT:-180}"
health_deadline=$(( $(date +%s) + BIRTH_HEALTH_WAIT ))
while :; do
  code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' "${FORGE_PUBLIC_ORIGIN}/health" || true)"
  [ "$code" = 200 ] && break
  [ "$(date +%s)" -lt "$health_deadline" ] || break
  sleep 3
done
[ "${code:-}" = 200 ] || die "the kernel never answered ${FORGE_PUBLIC_ORIGIN}/health (last: ${code:-none}).
     That is the edge, DNS and the certificate as well as the container — \`docker compose logs kernel caddy\`
     on the box. Nothing has been seeded."
note "edge ${FORGE_PUBLIC_ORIGIN}/health → 200"

# ── 5b · THE GATE'S /enter KEY, ONCE PER TENANT ───────────────────────────────────────────────────────────
#
# ⛔⛔ AND ON A DEPLOYED BOX THE KEY IS MINTED AND THE MAP IS NOT ASSEMBLED — MEASURED 2026-09-16, SAY IT
# RATHER THAN DISCOVER IT. `env-source.sh` builds `FORGE_ADMIN_ACCESS_KEYS` by running
# `bin/admin-access-key.mjs --declare` ON THE BOX, and it falls back to `{}` when there is no node
# (`env-source.sh:252`, `command -v node >/dev/null 2>&1 || { printf '{}'; return 0; }`). `forge-demo-stag`
# has no node, and `bin/deploy.sh`'s DELIVER list does not carry that script — two causes, one silent `{}`.
# ⇒ THE KEYS ARE REAL AND FILED; the shortcut that trades one for a session is not wired, so the gate's
# "abrir o admin" lands on a login screen. That is a DEGRADED door and not a dead box, so this step says it
# and does not die. Recorded in RESULTADOS-d2.md as open: it is repaired by delivering that script and giving
# the box a node, or by teaching `env-source.sh` a second source — neither is this slice's to decide.
say '5b · the gate’s /enter key, once per tenant'
keys_filed=0
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || { note "⚠️ $t · no token in this shell — no key minted"; continue; }
  out="$(mktemp)"
  if FORGE_OPERATOR_TOKEN="$tokval" node "$HERE/bin/admin-access-key.mjs" \
       --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN" > "$out"; then
    keyval="$(tail -1 "$out" | tr -d '\r\n')"
    if remote_secret_put "$(secret_name_for "$t" access)" "$keyval"; then
      keys_filed=$((keys_filed + 1))
      # ★ HELD IN THIS SHELL TOO, exactly as step 3 holds the operator token and for the same reason: the
      # map below is assembled HERE. It never touches disk on this machine and never reaches a command line.
      eval "$(secret_name_for "$t" access | tr 'a-z-' 'A-Z_')=\$keyval"
      note "$t · $(secret_name_for "$t" access): filed"
    fi
    unset keyval
  else
    note "⚠️ $t · no key minted — its /enter falls through to the login screen"
  fi
  shred -u "$out" 2>/dev/null || rm -f "$out"
done
note "$keys_filed of $(echo "$TENANTS" | wc -w) tenant(s) have a gate key filed on the box"

# ── ★★ AND THE MAP IS ASSEMBLED HERE, WHICH IS THE REPAIR THE COMMENT ABOVE PROMISED ───────────────────────
#
# `--declare` reads `.secrets` and `.env` ON the box and needs a node there; this box has none, so it exported
# `{}` and the gate's "abrir o admin" landed on a login screen with real keys filed two metres away
# (measured on the deployed box 2026-09-16, still true on 2026-09-17). THIS shell holds both halves at this
# moment — it just minted every key, and it built ADMIN_STORE_IDS back in step 3 — so it assembles the map
# with `declaredAccessKeys` still the single author of the shape, and writes it like every other derived
# value. ⚠️ The keys go to node on STDIN, never on argv: `ps` on a shared host shows a command line.
if [ "$keys_filed" -gt 0 ]; then
  access_map="$(
    { printf '{"storeIds":%s,"secrets":{' "$ADMIN_STORE_IDS"
      first=1
      for t in $TENANTS; do
        kv="$(eval "printf '%s' \"\${$(secret_name_for "$t" access | tr 'a-z-' 'A-Z_'):-}\"")"
        [ -n "$kv" ] || continue
        [ "$first" = 1 ] || printf ','
        first=0
        printf '%s' "$(jq -nc --arg n "$(secret_name_for "$t" access)" --arg v "$kv" '{($n):$v}' | sed 's/^{//;s/}$//')"
      done
      printf '}}'
    } | node "$HERE/bin/admin-access-key.mjs" --assemble
  )" || access_map=''
  if [ -n "$access_map" ] && [ "$access_map" != '{}' ]; then
    remote_env_put FORGE_ADMIN_ACCESS_KEYS "$access_map"
    note "the gate's /enter map is on the box — $(printf '%s' "$access_map" | jq -r 'keys|join(", ")') enter with a session"
  else
    note '⚠️ the /enter map came out EMPTY — every admin falls through to its own login screen.'
  fi
fi

# ── 6 · the terrain, once per tenant ──────────────────────────────────────────────────────────────────────
say '6 · seed-box (stores + settings), once per tenant'
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no credential for \"$t\" in this shell — step 3 is where it is minted."
  FORGE_OPERATOR_TOKEN="$tokval" node "$HERE/bin/seed-box.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN" \
    || die "seed-box failed for $t."
done

# The counter's store id is only knowable now, and `compose.override.yml` refuses to interpolate without it.
balcao="$(jq -r '.tenants[]|.stores[]|select(.handle=="balcao")|.handle' "$BOX")"
if [ -n "$balcao" ]; then
  cafe_t="$(echo "$TENANTS" | tail -1)"
  cafe_tokvar="$(secret_name_for "$cafe_t" seed | tr 'a-z-' 'A-Z_')"
  eval "cafe_tokval=\${$cafe_tokvar:-}"
  id="$(curl -s -m 20 "${FORGE_PUBLIC_ORIGIN}/v1/read/internal/stores" \
        -H "authorization: Bearer $cafe_tokval" -H "x-forge-tenant: $cafe_t" \
        | jq -r '.[]|select(.handle=="balcao")|.id' 2>/dev/null)"
  if [ -n "$id" ] && [ "$id" != null ]; then
    remote_env_put FORGE_TOTEM_STORE_ID "$id" || die 'could not write the counter’s store id to the box.'
    note "FORGE_TOTEM_STORE_ID → $id (written into the box's .env)"
  else
    die "the counter's store could not be resolved after seed-box, so step 7 has no shop to point the totem at."
  fi
fi

# ── 6b · ★★★ EVERY STORE CLAIMS THE ADDRESS IT IS PUBLISHED AT ────────────────────────────────────────────
#
# ★ ON THE BENCH THIS IS ONE CLAIM, HERE IT IS ONE PER SHOP, and the difference is the address space rather
# than a change of rule. `read.store.by_host` resolves ONE store per authority and the key is globally unique
# (`packages/core/src/read/host-key.ts`), so on the bench — where every shop shares one hostname and differs
# by PATH — only the root store can claim it and the others are reached at `/s/<id>/…`. Here each shop has a
# hostname of its own, so each can and must claim its own: an unclaimed one answers 404 through the port while
# the front's `FORGE_STORE_HOSTS` override still routes it, which is the exact split that cost three
# misdiagnoses (bin/store-host.mjs §15.2).
#
# ⛔ THE COUNTER IS EXCLUDED, AND IT IS DECLARED RATHER THAN REMEMBERED: `seed/box.json` says
# `directory: false` on it. The edge serves `totem.…`; the store's `host` column stays null, because that
# column is also what mints the «Acompanhar o pedido» button on every counter receipt — pointing it at the
# totem's own 404 is the defect `bin/prove-doors.mjs` asserts the negative of.
#
# ★ AFTER 6 (the stores must exist) and BEFORE 9 (`dist/seed-demo.js` → `configureStore` writes this same
# column when `FORGE_SEED_STORE_HOST` is set — the A22 trap, one column down; nothing here sets it and
# `bin/store-host.test.mjs` keeps it that way, because a second author would silently win).
say '6b · every store claims the address it is published at'
address_claims=0
address_expected=0
full_map="$store_map"
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  stores_json="$(curl -s -m 20 "${FORGE_PUBLIC_ORIGIN}/v1/read/internal/stores" \
    -H "authorization: Bearer $tokval" -H "x-forge-tenant: $t")" || die "could not list \"$t\"'s stores through the port."
  while IFS=$'\t' read -r handle sid; do
    [ -n "${handle:-}" ] || continue
    face="$(printf '%s\n' "$FACES" | awk -F'\t' -v t="$t" -v s="$handle" '$1=="store" && $2==t && $3==s {print $5"\t"$6}')"
    [ -n "$face" ] || { note "$t/$handle · no face in this environment — reached path-scoped, nothing to claim"; continue; }
    fhost="${face%%$'\t'*}"; fkind="${face##*$'\t'}"
    full_map="$(printf '%s' "$full_map" | jq -c --arg h "$fhost" --arg s "$sid" '. + {($h): $s}')"
    if [ "$fkind" != 'directory' ]; then
      note "$t/$handle · $fhost is EDGE-ONLY by declaration (directory: false) — not claimed, on purpose"
      continue
    fi
    address_expected=$((address_expected + 1))
    if FORGE_OPERATOR_TOKEN="$tokval" node "$HERE/bin/store-host.mjs" \
         --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN" --origin "https://$fhost" --store "$sid" >/dev/null; then
      address_claims=$((address_claims + 1))
      note "$t/$handle · https://$fhost claimed"
    else
      die "\"$t\"/$handle could not claim https://$fhost in the directory — the reason is printed above.
     Until it does, read.store.by_host answers 404 for that shop's own address: the warmer fills /s/<id>/…
     pages while a shopper opens /, and nothing else says a word about it."
    fi
  done < <(printf '%s' "$stores_json" | jq -r '.[]|[.handle,.id]|@tsv')
done
# ⚠️ ZERO OF N IS A REFUSAL, NOT A SUCCESS — the promotion's F2 lesson. Two "nothing to claim" in a row reads
# exactly like success in a scrollback.
[ "$address_claims" -gt 0 ] || die "not one store of this box claimed a face, so NOBODY answers any of this
     environment's hostnames through the port. Every shop would 404 behind a valid certificate."
note "$address_claims of $address_expected shop face(s) claimed · read.store.by_host now answers them"

# ★ AND THE MAP IS COMPLETED HERE, then the fronts are recreated — they read it ONCE, at boot, and the copy
# they booted with at step 5 knew only the two bootstrap stores. The files right and the box wrong is the
# quietest defect this repository has (pk35/d4), and it is one recreate away.
remote_env_put FORGE_STORE_HOSTS "'$full_map'" || die 'could not complete the host → store map.'
# ⚠️ NAMED SERVICES AND NO `--scale`: the counter is not among them, and compose refuses a `--scale` for a
# service the invocation does not ask for (measured — see step 5). It is still at zero replicas from there,
# and step 7 is what starts it, once its store id exists.
remote_compose "${COMPOSE_FILES[@]}" up -d --force-recreate storefront storefront-coffee checkout admin >/dev/null \
  || die 'the fronts did not come back after the map was completed.'
note "host → store map completed · $(printf '%s' "$full_map" | jq -r 'length') face(s) · fronts recreated"

# ── 7 · THE COUNTER'S TOTEM — and it could not have started at step 5 ─────────────────────────────────────
say '7 · the totem (needs the counter store id step 6 resolved)'
TOTEM_UP=''
TOTEM_WHY=''
totem_id="$(remote_env_get FORGE_TOTEM_STORE_ID)"
if [ -n "$totem_id" ] && [ "$totem_id" != 'sto_PENDING_SEED' ]; then
  if remote_compose "${COMPOSE_FILES[@]}" up -d totem >/dev/null; then
    TOTEM_UP=1
    note "totem up · store $totem_id"
  else
    TOTEM_WHY='it did not start — `docker compose logs totem` on the box'
    note "⚠️ $TOTEM_WHY"
  fi
else
  TOTEM_WHY='step 6 resolved no counter store id'
  note '⚠️ no counter store id — skipping the totem (step 6 should have resolved it)'
fi

# ── 8 · THE CURATED DATA — and it must precede the massive one-shot ───────────────────────────────────────
# ★ THE ORDER IS FORCED, NOT CHOSEN: an assortment PUBLISHES a handle it did not define, so if the curated
# products are not there yet the publish step has nothing to point at and refuses BY NAME
# (`populate refused (unknown_product)`). Anyone who moves this after the one-shot brings that red back.
# ⚠️ AND THIS STEP SILENCES THE BUYER'S ORDER MAIL — step 10 refuses to run outside that silence and step 11
# re-arms it. The three are one direction.
say '8 · the curated data (once per tenant)'
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  # ★★ `FORGE_MEDIA_BASE_URL` TRAVELS WITH THE SEED since 2026-09-18, and it is not decoration.
  # `seed/outlet.mjs` decides whether to re-upload a picture by asking THE DESTINATION whether the bytes
  # are there — the asset library only records that a key was once minted, which survives a bucket being
  # emptied or swapped. Without this address the step cannot ask, falls back to trusting the row, and says
  # so out loud. `env-source.sh` exports it; handing it over here is what closes the question.
  FORGE_OPERATOR_TOKEN="$tokval" FORGE_REVALIDATE_SECRET="$BOX_REVALIDATE" \
    FORGE_MEDIA_BASE_URL="${FORGE_MEDIA_BASE_URL:-}" \
    node "$HERE/bin/seed.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN" \
    || die "the curated seed failed for \"$t\". Its own output is above; nothing further has run."
done

# ── 9 · the catalogue, once per DATASET tenant ────────────────────────────────────────────────────────────
# ⛔ `$DATASET_TENANTS`, NEVER `$TENANTS`. A tenant the mounted dataset is not about is NAMED rather than
# silently skipped: "the coffee shop has 23 products" and "the coffee shop was forgotten" look identical in a
# log that says nothing.
say '9 · seed-demo (the massive catalogue), once per DATASET tenant'
for t in $TENANTS; do
  case " $DATASET_TENANTS " in
    *" $t "*) ;;
    *) note "\"$t\" does not carry this box's example dataset (seed/box.json: dataset != true) — what it needed
     from this step it already has: its apps, its freight and its checkout flag were applied at step 6."
       continue ;;
  esac
  handle="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' "$BOX")"
  # ★★ THE ACTION CEILING IS LIFTED ON THIS INVOCATION AND NEVER ON THE KERNEL SERVICE. The 5-minute default
  # is a LIVENESS guard for whoever CALLS; a bulk import one-shot is not an interactive action. The number is
  # derived: 1 287 products in 300 s measured, so 2 790 need ~650 s, and 1 800 000 ms is nearly 3× that.
  # ⚠️ Letting it blow is not the alternative: the timeout does NOT cancel the action, and this entrypoint's
  # `finally` then closes the pool underneath an abandoned writer — a half-written catalogue and an error
  # naming the POOL instead of the ceiling.
  remote_compose "${COMPOSE_FILES[@]}" run --rm \
    -e "FORGE_REF_TENANT=$t" -e "FORGE_REF_STORE_HANDLE=$handle" -e FORGE_SEED_DEMO=1 \
    -e "FORGE_EXTENSION_ACTION_TIMEOUT_MS=${FORGE_SEED_ACTION_TIMEOUT_MS:-1800000}" \
    kernel node dist/seed-demo.js 2>&1 | tail -8 >&2
  # shellcheck disable=SC2181
  [ "${PIPESTATUS[0]}" = 0 ] || die "seed-demo failed for \"$t\". The kernel's own words are the lines above — read those, not this.
     ⛔ RE-RUNNING IS NOT KNOWN TO FIX IT: of the three ways this step has failed so far, none was repaired by
     repetition (an action ceiling, a missing step before it, and a curated product that did not exist yet)."
done

# ── 10 · THE PAST — and it runs INSIDE the mail silence, never after ──────────────────────────────────────
#
# ⛔ THE PLACEMENT IS LOAD-BEARING: after 8, before 11. `seed/commerce.mjs` silences the buyer's order mail in
# the curated phase and re-arms it in the window, and the decision to send is taken at EMIT — so a past seeded
# after the re-arm mails a person, and mail cannot be un-sent. The refusal below is what makes that
# independent of whoever edits this file next.
#
# ★★ AND THE DELIVERY-METHOD DANCE IS THE MOMENT'S, NOT THE BOX'S. `seed-history` stops dead when a tenant has
# more than one ACTIVE delivery method and nothing to choose between them by — correctly, because step 9 had
# the identical fork and chose SILENTLY with `order by id limit 1`, picking PICKUP in the café and writing a
# delivery address the kernel then refused. Two delivery options is something the demo WANTS to show, so what
# changes is the MOMENT: silence the extra, seed the past, RE-ARM in a `finally`.
say '10 · the past (seed-history — 180 days), once per tenant'
HISTORY_KEEP="${FORGE_HISTORY_KEEP_METHOD:-Entrega Padrão}"
SILENCED=''; REARM_TENANT=''; REARM_TOKEN=''

history_methods() { # <tenant> <token>  →  id \t name \t active   (delivery only)
  curl -fsS -m 30 "$FORGE_PUBLIC_ORIGIN/v1/read/internal/shipping_methods_admin" \
    -H "authorization: Bearer $2" -H "x-forge-tenant: $1" \
    | jq -r '.[] | select(.kind=="delivery") | [.id, .name, (.active|tostring)] | @tsv'
}
# ⚠️ THE FIELD IS `method_id`, NOT `id` — measured against the running kernel, which answered
# `validation_failed · method_id (expected string, received undefined)` when asked with `id`.
set_method_active() { # <tenant> <token> <method_id> <true|false>
  curl -fsS -m 30 -X POST "$FORGE_PUBLIC_ORIGIN/v1/commands/shipping.method.update" \
    -H "authorization: Bearer $2" -H "x-forge-tenant: $1" -H 'content-type: application/json' \
    -d "{\"method_id\":\"$3\",\"active\":$4}" >/dev/null
}
rearm_history() {
  local id
  for id in $SILENCED; do
    if set_method_active "$REARM_TENANT" "$REARM_TOKEN" "$id" true; then
      note "re-armed $id in $REARM_TENANT"
    else
      printf '\n%s ⛔ COULD NOT RE-ARM shipping method %s in tenant %s.\n   That tenant is left with fewer delivery methods than it started with. Re-arm it by hand:\n   POST %s/v1/commands/shipping.method.update  {"method_id":"%s","active":true}\n\n' \
        "$TAG" "$id" "$REARM_TENANT" "$FORGE_PUBLIC_ORIGIN" "$id" >&2
    fi
  done
  SILENCED=''
}
# ⚠️ THE RE-ARM IS IN A TRAP AND NOT ON THE HAPPY PATH. A box left with one delivery method because this step
# died halfway is a defect nobody would ever connect back to a seed — they would find it weeks later in a
# checkout.
trap 'rearm_history' EXIT INT TERM

for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  REARM_TENANT="$t"; REARM_TOKEN="$tokval"

  # ⛔ THE MAILBOX GUARD — this step REFUSES to seed a past into a tenant whose buyer mail is armed.
  # ⚠️ AND THE PARAMETER IS `store`, NOT `store_id` — measured: the kernel IGNORES the wrong one SILENTLY and
  # answers with the tenant's DEFAULTS, so a guard asking with `store_id` would read a default of "enabled" as
  # the truth about a store.
  armed="$(curl -fsS -m 30 "$FORGE_PUBLIC_ORIGIN/v1/read/internal/stores" \
             -H "authorization: Bearer $tokval" -H "x-forge-tenant: $t" \
           | jq -r '.[].id' \
           | while read -r sid; do
               curl -fsS -m 30 "$FORGE_PUBLIC_ORIGIN/v1/read/internal/notification_types?store=$sid" \
                 -H "authorization: Bearer $tokval" -H "x-forge-tenant: $t" \
               | jq -r --arg s "$sid" '.[]
                   | select((.key|startswith("order.")) or (.key|contains("review_request")))
                   | select(.channels[] | select(.channel_key=="email") | .enabled)
                   | "\($s) \(.key)"'
             done)" || die "could not read the notification channels of \"$t\" — this step will not seed a
     past it cannot prove is silent."
  if [ -n "$armed" ]; then
    die "REFUSING to seed the past for \"$t\": buyer order mail is still ARMED on:
$(printf '%s\n' "$armed" | sed 's/^/       /')
     This step writes hundreds of dated orders and the send decision is taken at EMIT, so an armed channel
     here means real e-mail to real addresses. It runs BETWEEN the curated seed (which silences) and the
     window (which re-arms) — if it has been moved outside that gap, move it back rather than disable this."
  fi
  note "$t · buyer order mail is silent — safe to write a past"

  before="$(history_methods "$t" "$tokval" | awk -F'\t' '$3=="true"' | wc -l)"
  keep_seen=0
  while IFS=$'\t' read -r id name active; do
    [ "$active" = true ] || continue
    if [ "$name" = "$HISTORY_KEEP" ]; then keep_seen=1; continue; fi
    set_method_active "$t" "$tokval" "$id" false || die "could not silence delivery method \"$name\" ($id) in \"$t\"."
    SILENCED="$SILENCED $id"
    note "silenced \"$name\" for the history run"
  done < <(history_methods "$t" "$tokval")
  [ "$keep_seen" = 1 ] || die "tenant \"$t\" has no active delivery method named \"$HISTORY_KEEP\" — set
     \$FORGE_HISTORY_KEEP_METHOD to the one the past should sell through. Nothing was seeded."

  # ⚠️⚠️ THE OUTPUT IS INSPECTED, NOT JUST THE EXIT CODE — this step has a green that means nothing happened.
  # `seed-history` is RESET+SEED by nature: a tenant that already holds one order older than half the window
  # gets "SKIPPING", nothing written, exit 0 and `"skipped":true` in its summary.
  hlog="$(mktemp)"
  remote_compose "${COMPOSE_FILES[@]}" run --rm \
    -e "FORGE_EXTENSION_ACTION_TIMEOUT_MS=${FORGE_SEED_ACTION_TIMEOUT_MS:-1800000}" \
    kernel node dist/seed-history.js --tenant "$t" >"$hlog" 2>&1
  hrc=$?
  tail -6 "$hlog" >&2
  if [ "$hrc" != 0 ]; then
    rm -f "$hlog"
    die "the past failed for \"$t\" — the kernel's own words are the six lines above. The delivery methods are
     restored by this script's trap either way."
  elif grep -q '"skipped":true' "$hlog"; then
    note "⛔ THE PAST WAS SKIPPED FOR \"$t\", AND THAT IS NOT A SUCCESS — it exited 0 having written nothing.
     This step is reset+seed: it refuses to add a past to a tenant that already has one. To rebuild it, the
     history's own remedy is the only one it offers: wipe the tenant and run this again."
  fi
  rm -f "$hlog"

  rearm_history
  after="$(history_methods "$t" "$tokval" | awk -F'\t' '$3=="true"' | wc -l)"
  [ "$after" = "$before" ] || note "⚠️ $t ended with $after active delivery methods, not the $before it began with."
done
trap - EXIT INT TERM

# ── 10b · WAIT FOR THE DISPATCHER, BECAUSE THE SILENCE ONLY HOLDS WHILE THE QUEUE IS BEHIND IT ────────────
#
# ⛔ silence → seed → re-arm HAS A SCALE LIMIT. This step writes ~1 466 orders and dispatch is ASYNCHRONOUS:
# on the birth that first ran it, step 11 re-armed while the dispatcher was still draining and the tail went
# out through the door that had just been opened. 88 messages were attempted; they failed only because every
# address in the dataset is `@example.com` — the fix is this wait, not the luck of an undeliverable domain.
# ⚠️ AND IT DIES RATHER THAN CONTINUES: a box whose window never ran is mute and one command from fixed; a box
# that mailed a real person cannot be un-mailed.
say '10b · waiting for the dispatcher to drain'
QUIET_S=30; DRAIN_CEILING_S=600
notif_total() { # <tenant> <token> [status]
  curl -fsS -m 30 "$FORGE_PUBLIC_ORIGIN/v1/read/internal/notifications?limit=1${3:+&status=$3}" \
    -H "authorization: Bearer $2" -H "x-forge-tenant: $1" | jq -r '.total'
}
drain_started=$SECONDS; quiet_since=$SECONDS; last_fingerprint=''
while :; do
  fingerprint=''; pending_total=0
  for t in $TENANTS; do
    tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"; eval "tokval=\${$tokvar:-}"
    tot="$(notif_total "$t" "$tokval")" || die "could not read the notification queue of \"$t\"; refusing to
     hand a still-draining queue to the window, which re-arms the mail."
    pend="$(notif_total "$t" "$tokval" pending)" || pend=0
    fingerprint="$fingerprint $t:$tot"; pending_total=$((pending_total + pend))
  done
  if [ "$fingerprint" = "$last_fingerprint" ] && [ "$pending_total" = 0 ]; then
    [ $((SECONDS - quiet_since)) -ge "$QUIET_S" ] && break
  else
    [ -z "$last_fingerprint" ] || note "still draining —$fingerprint (pending $pending_total)"
    last_fingerprint="$fingerprint"; quiet_since=$SECONDS
  fi
  [ $((SECONDS - drain_started)) -lt "$DRAIN_CEILING_S" ] || die "the notification queue has not gone quiet in
     ${DRAIN_CEILING_S}s (last:$fingerprint, pending $pending_total). STOPPING BEFORE THE WINDOW, because the
     window re-arms the buyer's mail and this queue would drain through it."
  sleep 5
done
note "queue quiet for ${QUIET_S}s —$last_fingerprint · safe for the window to re-arm"

# ── 11 · THE SHOP WINDOW — AFTER the one-shot ─────────────────────────────────────────────────────────────
# The window resolves each promotion target through the PUBLIC read — the only read that answers "is this on
# sale in THIS store?" — and those targets are products of the MASSIVE catalogue. So it needs 9, while 9 needs
# 8's curated handles. One direction, three moments, no cycle.
say '11 · the shop window (--phase window), once per tenant'
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  FORGE_OPERATOR_TOKEN="$tokval" FORGE_REVALIDATE_SECRET="$BOX_REVALIDATE" \
    node "$HERE/bin/seed.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN" --phase window \
    || die "the window phase failed for \"$t\". Its own output is above; the box and its catalogue are standing."
done

# ── 12 · THE VERDICT OVER THE DATA ────────────────────────────────────────────────────────────────────────
# ★ IT ASKS THE BOX, NOT THIS FILE. A check that re-read `seed/box.json` here would be the input grading the
# input: green through any road back to the same state. ⚠️ It does not stop the script where it fails — the
# box is fully standing by now, and the addresses below are what an operator needs especially when a tenant
# did not settle. The exit code is collected and spent at the very end.
say '12 · the verdict over the DATA (verify-seed), once per tenant'
UNSETTLED=''
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  if FORGE_OPERATOR_TOKEN="$tokval" node "$HERE/bin/verify-seed.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN"; then
    note "$t settled"
  else
    UNSETTLED="$UNSETTLED $t"
    note "⛔ $t did NOT settle — the ✗ lines above say which check."
  fi
done

# ── 13 · WHAT ONLY EXISTS ONLINE — and it runs AFTER the rebirth, on purpose ──────────────────────────────
# ⚠️ MEASURED 2026-09-16, AND IT CORRECTS AN ASSUMPTION: this step is NOT automatically "real" on a VM. Each
# facility names the variable that SELECTS its driver (`FORGE_EDGE_PURGE_DRIVER`, `FORGE_MEDIA_STORE_DRIVER`)
# and `deploy/box.env` declares neither, so both resolve to `none` here exactly as on the bench — and that is
# the honest state: there is no CDN in front of this box, and the `s3` driver the R2 bucket would need does
# not exist in the kernel this instance pins. The step still runs and still SAYS so, per facility.
say '13 · the edge and the bucket (what only exists online)'
ONLINE_ONLY_FAILED=''
node "$HERE/bin/online-only.mjs" --phase after-birth || ONLINE_ONLY_FAILED=1

# ── 14 · THE BOX IS WARMED, AND WHAT IT LEARNED IS A REPORT ───────────────────────────────────────────────
# ⚠️ WARMTH REPORTS, IT DOES NOT GRADE — it was ALWAYS red by construction, and a step that is always red is a
# step people learn to skip. ⛔ One thing it reports IS a red: "the box does not hold a store seed/box.json
# declares" (exit 3), which is not warmth but "the birth did not build it".
COLD=''
WARM_UNKNOWN=''
MISSING_STORE=''
if [ "$WARM" != 1 ]; then
  skip 14 "$WARM_SKIP_WHY"
else
  say '14 · warming every store the port says has a public page'
  # ★ THE LOOP ITSELF IS `warm_every_tenant`, DEFINED IN §0f — one copy, two callers (this step and
  # `--warm-only`), for the reason written there.
  warm_every_tenant
fi

# ── 14-bis · EVERY DOOR OF EVERY STORE, OPENED ────────────────────────────────────────────────────────────
# ⛔ IT EXISTS BECAUSE A BOX CAME UP GREEN WITH SIGN-IN DEAD ON THREE OF ITS FOUR SHOPS (2026-09-04): the
# store-scoped `/account/login` answered the vitrine's 404 because an edge rule stopped one slash short, and
# every other step was settled. Warming does not catch it (the login page is in no catalogue) and
# `verify-config` does not either (it grades the declaration, and the declaration was right).
say '14-bis · opening every door of every store'
SHUT=''
DOORS_UNKNOWN=''
# ★ THE LOOP ITSELF IS `prove_every_tenant`, DEFINED IN §0f — one copy, two callers (this step and
# `--verdict-only`).
prove_every_tenant

# ── 15 · THE VERDICT OVER THE CONFIGURATION ───────────────────────────────────────────────────────────────
# ★ Step 12 grades the DATA; this grades what the box IS. ⚠️ AND IT IS ASKED OF THE BOX'S OWN `.env`, fetched
# for the length of this step — the file on this laptop describes the bench, and grading a deployed box
# against a bench's declaration would answer a question nobody asked.
say '15 · the verdict over the CONFIGURATION (verify-config)'
MISCONFIGURED=''
# ★ ONE COPY, TWO CALLERS — see §0f.
verify_the_configuration

# ── THE ROTEIRO — WHAT THIS RUN RAN, WHAT IT SKIPPED, AND WHY ─────────────────────────────────────────────
# ⛔ DERIVED FROM RESULT, NEVER FROM THIS FILE'S INTENT: `$STEPS_RAN` was stamped by each step's own `say` as
# it happened. A step that neither ran nor was declared skipped is a RED — that is the accident this box has
# no other detector for.
say 'the roteiro (which steps this birth ran, which it skipped, and why)'
ROTEIRO_INCOMPLETE=''
node "$HERE/bin/roteiro.mjs" --mode result --steps "$BIRTH_STEPS" --ran "$STEPS_RAN" --skipped "$STEPS_SKIPPED" >&2 \
  || ROTEIRO_INCOMPLETE=1

say 'how long each step took on this box'
printf '%s' "$STEP_TIMES" | while IFS='=' read -r id secs; do
  [ -n "${id:-}" ] || continue
  note "$(printf '%-8s' "$id")$secs"
done

say 'the box'
note "shop      ${FORGE_PUBLIC_ORIGIN}"
printf '%s\n' "$FACES" | while IFS=$'\t' read -r kind tenant store var value dir; do
  [ -n "${kind:-}" ] || continue
  note "$(printf '%-9s' "$kind")https://$value   ($tenant${store:+/$store})"
done
[ -n "${TOTEM_UP:-}" ] || note "totem     ⚠️ NOT RUNNING — ${TOTEM_WHY:-unknown}"
printf '\n' >&2

# ⛔ THE REPORTS FIRST, THE EXITS AFTER — each is its own sentence, because "the box is cold" and "the box is
# misconfigured" are different repairs, and a report printed after an exit is a report nobody reads.
[ -z "${COLD:-}" ] || printf '%s ⚠️  REPORT — THE BOX IS UP AND%s DID NOT COME OUT FULLY WARM. This does NOT make the birth red
         (warmth races the tail of the seed and invents red). What it DOES say is in the report above, by
         name: which urls did not answer, and which were never visited.\n\n' "$TAG" "$COLD" >&2
[ -z "${WARM_UNKNOWN:-}" ] || printf '%s ⚠️  REPORT — WARMTH IS UNKNOWN FOR%s: step 14 could not ASK. That is a different sentence
         from "they are cold".\n\n' "$TAG" "$WARM_UNKNOWN" >&2
[ -z "${MISSING_STORE:-}" ] || printf '%s ⛔ THE BOX IS UP AND%s IS MISSING A STORE THIS REPOSITORY DECLARES. The birth did not build
         it — that is not warmth.\n\n' "$TAG" "$MISSING_STORE" >&2
[ -z "${SHUT:-}" ] || printf '%s ⛔ THE BOX IS UP AND%s HAS DOORS A SHOPPER CANNOT OPEN. Step 14-bis names the store and the
         path. A shop whose sign-in page 404s sells to nobody who is not already signed in.\n\n' "$TAG" "$SHUT" >&2
[ -z "${DOORS_UNKNOWN:-}" ] || printf '%s ⛔ NOTHING WAS LEARNED ABOUT%s'"'"'S DOORS. Read it as UNPROVEN, never as proven-open.\n\n' "$TAG" "$DOORS_UNKNOWN" >&2
[ -z "${MISCONFIGURED:-}" ] || printf '%s ⛔ THE CONFIGURATION IS NOT WHAT THIS BOX DECLARES. Step 15 names the face that disagrees.\n\n' "$TAG" >&2
[ -z "${ONLINE_ONLY_FAILED:-}" ] || printf '%s ⛔ A FACILITY THAT ONLY EXISTS ONLINE WAS CONFIGURED AND COULD NOT RUN. Step 13 names it.\n\n' "$TAG" >&2
[ -z "${ROTEIRO_INCOMPLETE:-}" ] || printf '%s ⛔ THIS RUN CANNOT ACCOUNT FOR EVERY STEP IT DECLARES. The roteiro above names the step.\n\n' "$TAG" >&2
# ⛔⛔ AND THE TOTEM GETS THE SHOUTED SENTENCE `bin/box-up.sh` GIVES IT, word for word. It used to be a `note`
# and nothing else — the run still exited 1 (the conjunction below has always carried it), but it exited 1
# WITHOUT NAMING A REASON. `bin/box-cycle.sh`'s exit policy reads reasons out of the text, so a remote cycle
# whose totem never started would have graded it as an UNRECOGNISED non-zero: red, correctly, and mute about
# which of eight things went wrong — at 3am, on a schedule, which is the only hour this sentence is read.
[ -n "${TOTEM_UP:-}" ] || printf '%s ⛔ THE BOX IS UP AND %s IS NOT. The summary above says so where the address would be;\n         this line is here because an exit code is what a script downstream reads.\n\n' "$TAG" 'the totem' >&2
if [ -n "$UNSETTLED" ]; then
  printf '%s ⛔ THE BOX IS UP AND%s DID NOT SETTLE. Everything above is standing; what it HOLDS is not what
         this repository declares. Re-read the ✗ lines of the verdict — they name the check.\n\n' "$TAG" "$UNSETTLED" >&2
  exit 1
fi
# ⚠️ `COLD` AND `WARM_UNKNOWN` ARE DELIBERATELY NOT IN THIS CONJUNCTION — warmth reports, it does not grade.
if [ -n "${SHUT:-}" ] || [ -n "${DOORS_UNKNOWN:-}" ] || [ -n "${MISCONFIGURED:-}" ] || [ -n "${ONLINE_ONLY_FAILED:-}" ] || [ -n "${MISSING_STORE:-}" ] || [ -n "${ROTEIRO_INCOMPLETE:-}" ] || [ -z "${TOTEM_UP:-}" ]; then
  exit 1
fi
printf '%s ✓ %s is BORN.\n\n' "$TAG" "$FORGE_DEPLOY_HOST" >&2
exit 0
