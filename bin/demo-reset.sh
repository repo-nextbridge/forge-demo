#!/usr/bin/env bash
# ★★★ THE DEMO GOES BACK TO ITS GOLD — the POLICY over `bin/snapshot.sh`, and the only file that knows the data
# is a demonstration.
#
#   bash bin/demo-reset.sh stag --take-gold [--label <l>]   prove the box as it stands, THEN take its gold
#   bash bin/demo-reset.sh stag [--label <l>] [--warm]      back to the gold, then the verdicts
#   bash bin/demo-reset.sh stag --plan                      what a reset would refuse, destroy and run
#
# ── WHY THIS EXISTS (measured by the TL, 2026-10-09) ────────────────────────────────────────────────────────
#
# The demo's admin is PUBLIC: any visitor can dirty or break the shop, and the owner will want it back often.
# Until now the only way back was to be born again — `box-down --env stag && deploy.sh stag --birth` — which
# took 80–89 minutes on the rehearsals of 09/10, 51–59 of them the seed. A restore puts back the bytes the seed
# took that hour to write, so the reset costs what moving those bytes costs (minutes — `bin/snapshot.sh` header
# and RESULTADOS-g carry the measured numbers).
#
# ── ⛔ WHAT IS POLICY HERE, AND WHY IT IS NOT IN `bin/snapshot.sh` ─────────────────────────────────────────
#
#   · A GOLD IS ONLY TAKEN FROM A BOX THAT ANSWERS ITS VERDICTS NOW. `bin/snapshot.sh take` would snapshot any
#     box — on a customer's that is exactly right (the state you have is the state you back up). Here the gold
#     is the thing every reset returns to, so a gold taken from a box that was already dirty or half-born would
#     be restored faithfully, forever. The proof is the one the TL closes a birth with: `prove-shop` and step
#     12 (`birth-remote.sh --data-only`). Both only READ.
#   · AFTER A RESTORE, THE SAME VERDICTS — plus `--verdict-only` (every door, every face's configuration),
#     because that is the question the PAIR answers: a token or a host map that does not match the restored
#     database opens no door, while every row count is equal to the gold.
#   · THE VITRINE'S CACHE IS NOT PURGED BY A SEPARATE STEP, AND THAT IS MEASURED, NOT FORGOTTEN. The restore's
#     box-down REMOVES every container and its start recreates them; no front keeps its render cache on a volume
#     (compose.yml: the fronts mount only `themes` and `i18n`, read-only; no `cacheHandler` in any front). So
#     the cache `seed/purge.mjs` busts — which reaches the reference vitrine only — dies with its container,
#     together with the café fork's and the checkout's, which that hook cannot reach at all. Measured on the
#     proof box of 2026-10-09: a stale render planted in three fronts, 0 left after the restore; the control
#     (a plain `restart`) kept it. `bin/snapshot.guard.mjs` holds the volume half of that sentence.
#   · NO WARMING BY DEFAULT: step 14 is a report that costs about as long as the reset saves. `--warm` runs it.

set -uo pipefail
TAG='[demo-reset]'
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

die() { printf '\n%s ⛔ %s\n\n' "$TAG" "$*" >&2; exit 1; }
say() { printf '\n\033[1m%s %s\033[0m  (+%ss)\n' "$TAG" "$*" "$SECONDS" >&2; }

ENV_NAME=''
LABEL=()
TAKE=0
PLAN=0
WARM=0
while [ $# -gt 0 ]; do
  case "$1" in
    --take-gold) TAKE=1 ;;
    --plan) PLAN=1 ;;
    --warm) WARM=1 ;;
    --label) LABEL=(--label "${2:?--label needs a name}"); shift ;;
    -h|--help) sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "unknown option $1" ;;
    *) [ -z "$ENV_NAME" ] || die 'one environment at a time.'; ENV_NAME="$1" ;;
  esac
  shift
done
[ -n "$ENV_NAME" ] || die 'usage: bash bin/demo-reset.sh <env> [--take-gold | --plan] [--label <l>] [--warm]'
[ -f "$HERE/deploy/$ENV_NAME.env" ] || die "no deploy/$ENV_NAME.env — the demo is reset on a deployed box."

# The verdicts, each named, each graded on its own exit code. Nothing here repairs: a red is reported.
VERDICTS_RED=''
verdict() { # <name> <command…>
  local name="$1"; shift
  say "verdict · $name"
  "$@" || VERDICTS_RED="$VERDICTS_RED $name"
}

if [ "$TAKE" = 1 ]; then
  say "the gold of $ENV_NAME — proved first, taken only if every verdict is green"
  verdict prove-shop node "$HERE/bin/prove-shop.mjs" "$ENV_NAME"
  verdict data-only bash "$HERE/bin/birth-remote.sh" "$ENV_NAME" --data-only
  [ -z "$VERDICTS_RED" ] || die "NO GOLD TAKEN — the box does not answer:$VERDICTS_RED. A gold is what every reset returns to; it is never taken from a box that is not proved."
  bash "$HERE/bin/snapshot.sh" take --env "$ENV_NAME" "${LABEL[@]}" || die 'the snapshot refused (above).'
  say "gold taken and copied off the box · $SECONDS s"
  exit 0
fi

if [ "$PLAN" = 1 ]; then
  bash "$HERE/bin/snapshot.sh" restore --env "$ENV_NAME" "${LABEL[@]}" --plan || exit 1
  printf '   then: prove-shop · birth-remote --data-only · birth-remote --verdict-only%s\n' "$([ "$WARM" = 1 ] && printf ' · birth-remote --warm-only')" >&2
  exit 0
fi

say "reset of $ENV_NAME — back to the gold"
bash "$HERE/bin/snapshot.sh" restore --env "$ENV_NAME" "${LABEL[@]}" || die 'the restore did not finish — its own message says where it stopped and whether anything was destroyed.'
restored_at=$SECONDS
verdict prove-shop node "$HERE/bin/prove-shop.mjs" "$ENV_NAME"
verdict data-only bash "$HERE/bin/birth-remote.sh" "$ENV_NAME" --data-only
verdict verdict-only bash "$HERE/bin/birth-remote.sh" "$ENV_NAME" --verdict-only
[ "$WARM" = 0 ] || bash "$HERE/bin/birth-remote.sh" "$ENV_NAME" --warm-only || true
if [ -n "$VERDICTS_RED" ]; then
  die "THE BOX IS BACK ON ITS GOLD AND DOES NOT ANSWER:$VERDICTS_RED (restore ${restored_at}s, total ${SECONDS}s)."
fi
say "reset · green · restore ${restored_at}s · total ${SECONDS}s"
