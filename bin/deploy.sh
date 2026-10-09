#!/usr/bin/env bash
# ★★★ THE DEPLOY — this box, onto a host that already exists, with a HUMAN on the trigger.
#
#   bash bin/deploy.sh stag            deliver and bring up the staging box
#   bash bin/deploy.sh prod            the same, for production
#   bash bin/deploy.sh stag --plan     say everything it would do; touch NOTHING on the host
#   bash bin/deploy.sh stag --birth    deliver, bring up — AND THEN BE BORN (bin/birth-remote.sh)
#
# ── ★ WHAT THIS SCRIPT IS, IN ONE SENTENCE ──────────────────────────────────────────────────────────────────
#
# It carries THREE things to a provisioned host — the compose files, `forge.lock`, and the `.env` assembled
# from `deploy/` — and then runs the two commands the model's README tells a customer to run (migrate, then
# `up -d`). It creates no version, decides no version and invents no second way to change one: the PIN is the
# only gesture that moves this instance, and the pin is `forge.lock`.
#
# ⛔ IT IS NOT A BIRTH. It does not seed, does not create a tenant and does not warm anything. A box that has
# never been born has no stores, and this script says so BY NAME rather than bringing up a shop with nothing
# in it — see THE DERIVED HALF below.
#
# ⛔ IT IS NOT `bin/provision-host.sh` EITHER. That one makes a bare VM survivable (docker, swap, log
# rotation, the door) and knows nothing about this box. This one knows only about this box and assumes the
# host. Keeping them apart is what lets the first be the self-host runbook's executable half for any provider.
#
# ── ★★ THE FENCE RUNS FIRST, AND BEFORE ANY REMOTE GESTURE AT ALL ───────────────────────────────────────────
#
# `forge-lock-provenance` (the product's `@forgeco/surface-codegen`) compares TWO inputs that nothing
# else compares: the composition list this instance declares, and the provenance `forge.lock` states for each
# image. For every surface, an app of THIS box that has to be compiled into a build the lock pins as `release`
# is a box whose front will not carry that app — an image the product baked from the product's list, which has
# never seen this code. It is red then, and green while the surface is baked here.
#
# ⚠️ IT FIRES ON THE DEPLOY AND NOT ONLY ON THE BAKE, WHICH IS THE WHOLE REASON IT IS IN THIS FILE. The lock
# changes at DEPLOY time with no rebake anywhere — that is what a pin bump IS — so the bake's copy of this
# question was asked about a lock that is no longer the one going up.
#
# ── ★★ WHY IT IS INVOKED AND NOT REIMPLEMENTED ──────────────────────────────────────────────────────────────
#
# The guard lives in the product on purpose (INFRA-EXEMPLAR, decision 9): «a guard in the instance repository
# would only protect whoever writes guards, and customer 2 would fall into the hole the demo fenced for
# itself». A copy here would be the second truth, and it would be the copy that ages.
#
set -uo pipefail

TAG='[deploy]'
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

note() { printf '%s %s\n' "$TAG" "$*"; }
say()  { printf '\n%s ── %s ──\n' "$TAG" "$*"; }
die()  { printf '\n%s ⛔ %s\n\n' "$TAG" "$*" >&2; exit 1; }

# ── 0 · WHICH BOX, AND THE ANSWER IS A FILE ─────────────────────────────────────────────────────────────────
#
# ★ THE ENVIRONMENT IS NAMED BY THE FILE THAT DESCRIBES IT, not by a case statement here. `deploy/<env>.env`
# is the whole definition of an environment — its host, its six hostnames, its bucket — so a third box costs
# one file and no edit to this script. A script carrying an address is a script that has to be edited to add a
# customer, which is the shape this whole repository exists to disprove.
ENV_NAME=''
PLAN=no
BIRTH=no
BIRTH_ARGS=()
ALLOW_LOCAL=no
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) PLAN=yes ;;
    # ── ⛔⛔ THE ONLY WAY A DEPLOY REACHES A BIRTH, AND IT HAS TO BE TYPED ──────────────────────────────────
    #
    # A deploy runs on every adoption of a pin. Seeding is reset+seed by nature, so a deploy that seeded would
    # OVERWRITE THE SHOP on every version bump — the settings, the assortments, the promotions, and a past
    # rebuilt or refused. ⇒ the birth is a gesture with its own name (`bin/birth-remote.sh`) and this flag is
    # a hand-off to it, never an inference: there is no "seed if the box looks empty" here, because a box that
    # looks empty to a deploy is a box whose database did not come up.
    # ⟂ `bin/birth-remote.guard.mjs` proves the negative: without this flag, against a box that HOLDS data,
    # nothing in this script reaches a seeding entrypoint.
    --birth) BIRTH=yes ;;
    # Passed straight through to the birth, and meaningless without it: warmth is step 14's and nothing in a
    # deploy warms anything. A flag accepted and silently ignored is a flag that answers a question nobody
    # asked, so it refuses below when `--birth` was not given.
    --no-warm) BIRTH_ARGS+=(--no-warm) ;;
    --again)   BIRTH_ARGS+=(--again) ;;
    # ★ v032/C — the lock gate's bench switch (bin/lock-gate.sh). Refused for stag/prod by the gate itself.
    --allow-local) ALLOW_LOCAL=yes ;;
    -h|--help)
      sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*) die "unknown option '$1'. See \`bash bin/deploy.sh --help\`." ;;
    *)
      [ -z "$ENV_NAME" ] || die "two environments named ('$ENV_NAME' and '$1'). One deploy, one box."
      ENV_NAME="$1"
      ;;
  esac
  shift
done

if [ "$BIRTH" = 'no' ] && [ "${#BIRTH_ARGS[@]}" -gt 0 ]; then
  die "${BIRTH_ARGS[*]} is an argument of the BIRTH, and this invocation has none. A deploy does not seed,
     does not warm and does not re-apply anything — see this file's header. Add --birth, or drop the flag."
fi

[ -n "$ENV_NAME" ] || {
  printf '%s usage: bash bin/deploy.sh <env> [--plan] [--birth [--no-warm] [--again]]\n' "$TAG" >&2
  printf '%s   environments this repository declares:' "$TAG" >&2
  for f in "$HERE"/deploy/*.env; do
    b="$(basename "$f" .env)"
    [ "$b" = 'box' ] || printf ' %s' "$b" >&2
  done
  printf '\n' >&2
  exit 1
}

COMMON_ENV="$HERE/deploy/box.env"
BOX_ENV="$HERE/deploy/$ENV_NAME.env"

# ── ★ THE VEHICLE HAS ONE AUTHOR, AND IT IS NOT THIS FILE ANY MORE ────────────────────────────────────────
#
# The environment loader, the ssh command and `remote_compose` were all born here, because a deploy was the
# first gesture this repository had that touched a machine which is not the operator's. `bin/birth-remote.sh`
# is the second and needs exactly the same four things — so they moved into `bin/remote-box.sh` rather than
# being copied. The copy is the one that ages: the day the box's directory moves, the deploy would learn it
# and the birth would not, and the birth is the gesture that writes data.
# shellcheck source=bin/remote-box.sh
. "$HERE/bin/remote-box.sh"
remote_box_load "$ENV_NAME" "$HERE" die || exit 1

SSH_KEY="$REMOTE_BOX_KEY"
SSH_TARGET="$REMOTE_BOX_TARGET"
SSH=("${REMOTE_SSH[@]}")

REHEARSAL=''
[ "$PLAN" = 'yes' ] && REHEARSAL='PLAN · '

note "${REHEARSAL}${ENV_NAME} · ${SSH_TARGET}:${FORGE_DEPLOY_DIR} · ${FORGE_PUBLIC_ORIGIN}"

# ── 0 · THE LOCK GATE ───────────────────────────────────────────────────────────────────────────────────────
say '0 · the lock: can anybody but this machine run it?'

# ★★ v032/C — DECISION 9, AS A MECHANISM. A lock baked on a bench (`bin/bake-local.sh`, or any lock before
# v0.3.2 with `provenance.origin: "local build"`) names images by the baking daemon's ids. It is refused for
# stag and prod before the fence, the host or a single byte is touched; `--allow-local` exists for a bench
# environment only and the gate prints why it let one through. bin/lock-gate.sh is the rule, once.
# shellcheck source=bin/lock-gate.sh
. "$HERE/bin/lock-gate.sh"
lock_gate "$HERE/forge.lock" "$ENV_NAME" "$ALLOW_LOCAL" \
  || die "forge.lock cannot go to ${ENV_NAME} — the gate above names every image and why. Nothing was sent."

# ── 1 · THE FENCE ───────────────────────────────────────────────────────────────────────────────────────────
say '1 · the fence: does every surface this box pins carry the apps this box declares?'

# ★★ THE RESOLUTION ORDER IS DECLARED, AND ITS ABSENCE IS A REFUSAL RATHER THAN A SKIP.
#
# The binary travels in `@forgeco/surface-codegen`. ★ v032/C — this repository installs it at the release
# (`package.json` at the root, `npm ci`), so it resolves from `node_modules/.bin/` with nothing configured —
# the default spec v032 item 11 asks for. The forks install the same package and are kept as fallbacks;
# `FORGE_PROVENANCE_BIN` stays an override for a bench that wants another build of it.
#
# ⛔ AND THERE IS NO `--no-fence`. A guard with a switch is a guard that is off on the day it matters; the
# refusal below names every place it looked and the one gesture that fixes each.
provenance_bin=''
for candidate in \
  "${FORGE_PROVENANCE_BIN:-}" \
  "$HERE/node_modules/.bin/forge-lock-provenance" \
  "$HERE/storefront-coffee/node_modules/.bin/forge-lock-provenance" \
  "$HERE/totem/node_modules/.bin/forge-lock-provenance"
do
  [ -n "$candidate" ] || continue
  [ -x "$candidate" ] || [ -f "$candidate" ] || continue
  provenance_bin="$candidate"
  break
done

[ -n "$provenance_bin" ] || die "the surface-provenance fence is not on this machine, so this deploy cannot be graded — and an
     ungraded deploy is how a front reaches a box without the apps it is supposed to draw.
     Looked, in order:
       \$FORGE_PROVENANCE_BIN                                       ${FORGE_PROVENANCE_BIN:-<unset>}
       node_modules/.bin/forge-lock-provenance                      (this repository's tools, at the release)
       storefront-coffee/node_modules/.bin/forge-lock-provenance    (the kit a forked front installs)
       totem/node_modules/.bin/forge-lock-provenance
     Install the release's tools at the root of this repository — they are pinned in package.json:
       npm ci"

note "fence     $provenance_bin"

# ⚠️ THE FENCE IS AN ESM TOOL AND IT RUNS ON THIS HOST'S NODE, so the floor the pin states is read BEFORE it
# is started — `bin/node-floor.guard.mjs` refuses any script here that starts node without asking first, and
# it caught this one. An old node does not fail politely on modern ESM: it fails somewhere inside the import
# graph, with a message about syntax, and the reader concludes the fence is broken.
# shellcheck source=bin/require-node.sh
. "$HERE/bin/require-node.sh"
require_node || exit 1

case "$provenance_bin" in
  *.js) fence_cmd=(node "$provenance_bin") ;;
  *)    fence_cmd=("$provenance_bin") ;;
esac

# ⚠️ THE OUTPUT IS NOT SWALLOWED EVEN WHEN IT PASSES. It prints which apps this box has and which build each
# of them compiles into; a fence that only speaks when it is angry is a fence nobody knows is running.
"${fence_cmd[@]}" --root "$HERE" --lock "$HERE/forge.lock" \
  || die "the fence refused this lock, and NOTHING has been sent to ${FORGE_DEPLOY_HOST}. The line(s) above name the
     surface and say which side to move: bake that image in this box's own oven, or take the app out of the
     composition list. Deploying past this puts a front on that host that cannot draw the app it declares."

# ── 2 · THE PIN ─────────────────────────────────────────────────────────────────────────────────────────────
say '2 · the pin: which images, by digest'

# `bin/images-from-lock.sh` is the ONE reader of the lock and it refuses a tag. It is sourced rather than
# re-implemented for the same reason the fence is invoked rather than copied.
# shellcheck disable=SC1091
. "$HERE/bin/images-from-lock.sh" || die "forge.lock is not usable — the line above says why."

# ★★ v032/C — THE TWO DEPLOYABLES THIS REPOSITORY OWNS ARE IN THE LOCK NOW, by digest like the four:
# `bin/images-from-lock.sh` exports them, and they ship by the same pull as everything else. They used to
# travel by a `:local` tag that nothing pinned (and that `ship_image` had to compare by content after one
# shipped 18 hours stale — measured 2026-09-18); `bin/bake.sh` writes all six, so that path is gone.
FORK_IMAGES=("$FORGE_STOREFRONT_COFFEE_IMAGE" "$FORGE_TOTEM_IMAGE")

# ── 3 · THE HOST ────────────────────────────────────────────────────────────────────────────────────────────
say '3 · the host'

# ⚠️ A REHEARSAL DOES NOT NEED THE HOST, AND THAT IS NOT A CONVENIENCE. The fence above is the only gesture
# `--plan` exists to exercise, it is entirely local, and a rehearsal that could only run when the VM happens
# to be up is a rehearsal nobody runs in the place it is most useful — a test, or a laptop on a train.
if ! "${SSH[@]}" true 2>/dev/null; then
  [ "$PLAN" = 'yes' ] || die "cannot reach ${SSH_TARGET} with ${SSH_KEY}. This script does not provision a host; if this
     one is new, run \`ssh ${SSH_TARGET} 'bash -s' < bin/provision-host.sh\` first."
  note 'host      unreachable — this is a PLAN, so it is described rather than asked'
  HOST_REACHED=no
else
  HOST_REACHED=yes
fi

host_name="${FORGE_DEPLOY_HOST}"
if [ "$HOST_REACHED" = 'yes' ]; then
  host_state="$("${SSH[@]}" '
    printf "%s\n" "$(uname -n)"
    command -v docker >/dev/null 2>&1 && docker compose version --short 2>/dev/null || printf "no-compose\n"
    df -Pk / | tail -1 | tr -s " " | cut -d" " -f4
  ' 2>/dev/null)" || die "the host answered ssh and then could not be asked what it is."

  host_name="$(printf '%s\n' "$host_state" | sed -n 1p)"
  host_compose="$(printf '%s\n' "$host_state" | sed -n 2p)"
  host_avail_kb="$(printf '%s\n' "$host_state" | sed -n 3p | tr -d ' ')"

  [ "$host_compose" != 'no-compose' ] || die "${host_name} has no \`docker compose\`. That is \`bin/provision-host.sh\`'s job and it has not run here:
       ssh ${SSH_TARGET} 'bash -s' < bin/provision-host.sh"

  note "host      ${host_name} · compose ${host_compose} · $(( host_avail_kb / 1024 / 1024 )) GiB free"
fi

# ── ★★ THE SECRETS ARE THE BOX'S AND THIS SCRIPT NEVER SEES THEM ───────────────────────────────────────────
#
# `env-source.sh` reads `.secrets` beside it, and that file is written ON THE HOST, once, by a human. This
# script does not send it, does not read it and does not print it — it only asks whether the names it needs
# are there. A deploy that carried a laptop's secrets to a public box would make every rotation a deploy.
missing_secrets=''
[ "$HOST_REACHED" = 'yes' ] && missing_secrets="$("${SSH[@]}" "
  f='${FORGE_DEPLOY_DIR}/.secrets'
  for n in forge-postgres-password forge-vault-key \
           forge-storage-endpoint forge-storage-access-key-id forge-storage-secret-access-key; do
    grep -q \"^\$n=\" \"\$f\" 2>/dev/null || printf '%s ' \"\$n\"
  done
" 2>/dev/null)"
if [ -n "${missing_secrets// /}" ]; then
  # ⚠️ A PLAN SAYS IT AND GOES ON. Finding out what a box is missing is exactly what a rehearsal is for, and
  # a rehearsal that stops at the first absence tells you about one absence.
  refuse=die; [ "$PLAN" = 'yes' ] && refuse=note
  $refuse "${FORGE_DEPLOY_DIR}/.secrets on ${host_name} does not carry: ${missing_secrets}
     None of them travel. Two are MINTED on the host, and three are COPIED from the object-storage account.
     On the host, once:
       install -d -m 700 ${FORGE_DEPLOY_DIR}
       umask 077
       printf 'forge-postgres-password=%s\\n' \"\$(openssl rand -hex 24)\" >> ${FORGE_DEPLOY_DIR}/.secrets
       printf 'forge-vault-key=%s\\n'         \"\$(openssl rand -base64 32)\" >> ${FORGE_DEPLOY_DIR}/.secrets
       printf 'forge-storage-endpoint=%s\\n'  'https://<account>.<provider>'   >> ${FORGE_DEPLOY_DIR}/.secrets
       printf 'forge-storage-access-key-id=%s\\n'     '<from the bucket credential>' >> ${FORGE_DEPLOY_DIR}/.secrets
       printf 'forge-storage-secret-access-key=%s\\n' '<from the bucket credential>' >> ${FORGE_DEPLOY_DIR}/.secrets
     ⚠️ \`forge-vault-key\` encrypts what apps store. Rotating it re-keys them; losing it means re-entering
     every connection this box holds. Back it up wherever this instance keeps its custody.
     ⚠️ THE THREE STORAGE NAMES ARE ASKED FOR BECAUSE \`deploy/box.env\` DECLARES \`FORGE_STORAGE_DRIVER=s3\`.
     The credential should reach ONE bucket and no other (this box's, per \`deploy/<env>.env\`), and the
     endpoint names the account, never a bucket. A box that starts without them does not degrade: the kernel
     refuses the driver at boot. ⛔ Asking here, before anything is delivered, is the whole point — the
     alternative is finding out from a container that will not stay up."
fi
[ "$HOST_REACHED" = 'yes' ] && note 'secrets   present on the host (names only — no value is read, sent or printed)'

# ── 4 · WHAT TRAVELS ────────────────────────────────────────────────────────────────────────────────────────
say '4 · the box'

# ★ THE LIST IS EXPLICIT, AND THE ABSENCES ARE THE POINT. `.env` is assembled below rather than copied;
# `.secrets` never travels; `caddy/Caddyfile.local`, `caddy/extra-local/` and `mail/` are the BENCH's edge and
# collector, and a deployed box that carried them would carry the two files that can turn TLS off.
DELIVER=(
  compose.yml
  compose.override.yml
  forge.lock
  composition.json
  env-source.sh
  caddy/Caddyfile
  caddy/certs
  caddy/extra
  extensions
  i18n
  themes
  bin/images-from-lock.sh
  bin/verify-composition.sh
)
for p in "${DELIVER[@]}"; do
  [ -e "$HERE/$p" ] || die "this repository has no '$p', and the box cannot be delivered without it."
done

# ── ★★★ THE DERIVED HALF — WHY A DEPLOY DOES NOT WRITE THE WHOLE `.env` ────────────────────────────────────
#
# A box's `.env` has two authors. `deploy/` states what a deploy DECIDES: where the box is, what it is called,
# which edge it runs. The BIRTH states what only a seeded box can know — the store ids the fronts are pointed
# at, the host → store map, the sibling admin list, the revalidation secret. `bin/box-up.sh` writes those with
# `put_env` (lines 1138-1157, 1690, 1766, 1803-1831) and `compose.override.yml` DEMANDS one of them
# (`FORGE_TOTEM_STORE_ID:?`, line 140): compose refuses to parse without it.
#
# ⇒ THE RULE IS MECHANICAL AND CANNOT ROT: a key the two `deploy/` files DECLARE is written by this deploy; a
# key only the box has is CARRIED ACROSS untouched. No list of "derived keys" is typed anywhere, because a
# typed list is a list that is missing the key the next slice adds.
say '4b · the .env: what this deploy declares, plus what the box already knew'

declared_keys="$(grep -hoE '^[A-Z_][A-Z0-9_]*=' "$COMMON_ENV" "$BOX_ENV" | tr -d '=' | sort -u)"
existing_env=''
[ "$HOST_REACHED" = 'yes' ] && existing_env="$("${SSH[@]}" "cat '${FORGE_DEPLOY_DIR}/.env' 2>/dev/null" || true)"

# ── ⛔⛔ THE ONE EXCEPTION TO "DECLARED WINS", AND THE BOX PROVED IT WAS NEEDED ──────────────────────────────
#
# `deploy/box.env` declares `FORGE_TOTEM_STORE_ID=sto_PENDING_SEED` because `compose.override.yml` REFUSES to
# interpolate without a value and only a seed can mint the real one. Its comment claimed «a deploy never
# replaces a real id with this»; MEASURED ON THE STAGING BOX 2026-09-16, THAT WAS FALSE. A declared key wins
# over a carried one, so a deploy against a box that HAD been born wrote the sentinel back over the counter's
# real store id and brought the box up with `--scale totem=0` — «its store id is still the sentinel», on a box
# whose counter had been serving. Nothing was deleted and the shop still lost a front on a pin bump, which is
# the whole reason a deploy is not allowed to undo a birth.
#
# ⇒ A DECLARED KEY WHOSE VALUE **IS** THE SENTINEL IS A PLACEHOLDER, NOT A DECISION. It loses to a real
# carried value, and the rule is about the VALUE rather than about a list of key names — so the day a second
# key needs the same treatment it gets it by declaring the same sentinel, and nothing here has to be edited.
NOT_PROVISIONED_SENTINEL='sto_PENDING_SEED'
adopted=''
for placeholder in $(grep -hoE "^[A-Z_][A-Z0-9_]*=${NOT_PROVISIONED_SENTINEL}\$" "$COMMON_ENV" "$BOX_ENV" | cut -d= -f1 | sort -u); do
  have="$(printf '%s\n' "$existing_env" | grep -m1 "^${placeholder}=" | cut -d= -f2-)"
  [ -n "$have" ] && [ "$have" != "$NOT_PROVISIONED_SENTINEL" ] || continue
  declared_keys="$(printf '%s\n' "$declared_keys" | grep -vx "$placeholder" || true)"
  adopted="$adopted $placeholder"
done
[ -z "${adopted// /}" ] || note "kept      $adopted — declared as \`${NOT_PROVISIONED_SENTINEL}\`, and this box has been born since"

carried="$(printf '%s\n' "$existing_env" \
  | grep -E '^[A-Z_][A-Z0-9_]*=' \
  | grep -vE "^($(printf '%s' "$declared_keys" | paste -sd'|' -))=" || true)"

# The declared half is written from the two files, MINUS whatever the box answered for real above.
declared_lines() { # <file>
  if [ -z "${adopted// /}" ]; then
    grep -vE '^\s*#' "$1" | grep -E '^[A-Z_][A-Z0-9_]*=' || true
  else
    grep -vE '^\s*#' "$1" | grep -E '^[A-Z_][A-Z0-9_]*=' \
      | grep -vE "^($(printf '%s' "${adopted# }" | tr ' ' '|'))=" || true
  fi
}

carried_names="$(printf '%s\n' "$carried" | grep -oE '^[A-Z_][A-Z0-9_]*' | paste -sd' ' - || true)"
if [ -n "${carried_names// /}" ]; then
  note "carried   $carried_names"
else
  note 'carried   nothing — this box has no `.env` of its own yet (it has never been born here)'
fi

assembled="$(mktemp)"
trap 'rm -f "$assembled"' EXIT
{
  printf '# ASSEMBLED BY bin/deploy.sh — do not edit by hand except through a birth.\n'
  printf '#   declared half : deploy/box.env + deploy/%s.env of this repository\n' "$ENV_NAME"
  printf '#   derived half  : whatever the birth on THIS host wrote and this deploy did not declare\n'
  printf '# A key you add by hand here survives exactly until it collides with a declared one.\n\n'
  declared_lines "$COMMON_ENV"
  printf '\n'
  declared_lines "$BOX_ENV"
  if [ -n "${carried_names// /}" ]; then
    printf '\n# ── carried across from the box (written by a birth, not by this deploy) ──\n'
    printf '%s\n' "$carried"
  fi
} > "$assembled"

# ★★ THE COUNTER IS THE ONE SERVICE A DEPLOY CANNOT START, AND THE BOX ALREADY HAD A WORD FOR THAT.
#
# `compose.override.yml:140` demands `FORGE_TOTEM_STORE_ID`, and a counter store is a ULID the SEED mints —
# nothing here can know it. `deploy/box.env` therefore declares the sentinel `sto_PENDING_SEED`, which is not
# an invention of this slice: `bin/box-up.sh:2024` reads exactly that value as «the counter has no store yet,
# so do not start the totem and SAY SO», and step 6 of the birth rewrites the line with the real id.
#
# ⇒ THIS SCRIPT READS IT THE SAME WAY. The whole box comes up — including the café's vitrine, whose own store
# id is SOFT and which serves the shared body without it — and the counter is held back by `--scale totem=0`
# rather than started against a shop that does not exist. `--scale 0` and not "a shorter service list": a
# list would have to be kept in step with the two compose files, which is the rot this repository has already
# paid for once.
TOTEM_SENTINEL='sto_PENDING_SEED'
totem_id="$(grep -m1 '^FORGE_TOTEM_STORE_ID=' "$assembled" | cut -d= -f2-)"
COMPOSE_FILES=(-f compose.yml -f compose.override.yml)
if [ -z "$totem_id" ] || [ "$totem_id" = "$TOTEM_SENTINEL" ]; then
  UP_ARGS='--scale totem=0'
  BRINGING='the box WITHOUT the counter (its store id is still the sentinel — this box has not been born here)'
  note "⚠️ the counter stays down: FORGE_TOTEM_STORE_ID is ${totem_id:-<empty>}, so there is no shop for it to be."
  note '   Everything else comes up. The counter is a front pointed at ONE store, and that store is made by'
  note '   the seed — see README §7, "A deploy is not a birth".'
else
  UP_ARGS=''
  BRINGING='the whole box (the product stack, the café vitrine and the counter)'
fi

if [ "$PLAN" = 'yes' ]; then
  say 'PLAN — nothing below this line was done'
  note "would deliver : ${DELIVER[*]}"
  note "would write   : ${FORGE_DEPLOY_DIR}/.env ($(grep -cE '^[A-Z_]' "$assembled") keys)"
  note "would carry   : ${carried_names:-<nothing>}"
  note "would ship    : $FORGE_IMAGE"
  note "                $FORGE_STOREFRONT_IMAGE"
  note "                $FORGE_CHECKOUT_IMAGE"
  note "                $FORGE_ADMIN_IMAGE"
  note "                ${FORK_IMAGES[*]}"
  note "would bring up: $BRINGING"
  printf '\n%s ✓ plan only. The fence above DID run, against the real lock.\n\n' "$TAG"
  exit 0
fi

"${SSH[@]}" "install -d -m 755 '${FORGE_DEPLOY_DIR}'" || die 'could not create the box directory on the host.'

# tar over ssh: one stream, permissions kept, and no dependency on rsync being installed anywhere.
tar -C "$HERE" -czf - "${DELIVER[@]}" \
  | "${SSH[@]}" "tar -C '${FORGE_DEPLOY_DIR}' -xzf -" \
  || die 'delivering the box failed.'
note "delivered ${#DELIVER[@]} path(s)"

"${SSH[@]}" "cat > '${FORGE_DEPLOY_DIR}/.env' && chmod 600 '${FORGE_DEPLOY_DIR}/.env'" < "$assembled" \
  || die 'writing the box .env failed.'
note "env       $(grep -cE '^[A-Z_]' "$assembled") keys"

# ── 5 · THE IMAGES ──────────────────────────────────────────────────────────────────────────────────────────
say '5 · the images'

# ★★★ v032/C — ONE TRANSPORT: THE HOST PULLS (spec v032, item 11). Until v0.3.2 a ref with no registry was
# carried over ssh (`docker save | docker load`), because the lock was a bench bake; and a tag-pinned fork was
# compared by CONTENT, because a `:local` tag existed on the far side from the first deploy that sent it and
# a freshly baked fork was silently never delivered (measured in production, 2026-09-18). Both paths ended
# with their cause: every image is in the lock by REGISTRY digest (the lock gate, step 0, refuses anything
# else for stag/prod), and a digest that resolves over there IS the bytes, by construction.
#
# ⚠️ THE PACKAGES MAY BE PRIVATE, and whether they are is the owner's call, not this script's. So the host
# logs in to ghcr.io only when ITS secret store holds `GHCR_PULL_TOKEN` (and `GHCR_PULL_USER`) — read on the
# host by the same accessor as every other secret, never sent from here, never printed. With no token the
# pull is anonymous, which is all a public package needs.
GHCR_LOGIN_DONE=no
ghcr_login() {
  [ "$GHCR_LOGIN_DONE" = no ] || return 0
  GHCR_LOGIN_DONE=yes
  local answer
  answer="$("${SSH[@]}" "cd '${FORGE_DEPLOY_DIR}' && . ./env-source.sh >/dev/null 2>&1; \
    t=\"\$(optional_secret GHCR_PULL_TOKEN)\"; u=\"\$(optional_secret GHCR_PULL_USER)\"; \
    if [ -z \"\$t\" ]; then echo anonymous; \
    elif [ -z \"\$u\" ]; then echo no-user; \
    else printf '%s' \"\$t\" | docker login ghcr.io -u \"\$u\" --password-stdin >/dev/null 2>&1 && echo logged-in || echo refused; fi" 2>/dev/null || echo unreachable)"
  case "$answer" in
    anonymous) note 'ghcr      no GHCR_PULL_TOKEN on the host — pulling anonymously (a public package needs nothing)' ;;
    logged-in) note 'ghcr      logged in on the host with its own GHCR_PULL_TOKEN (the value never left it)' ;;
    no-user)   die "the host holds GHCR_PULL_TOKEN and no GHCR_PULL_USER — add both to ${FORGE_DEPLOY_DIR}/.secrets, or neither." ;;
    *)         die "the host could not log in to ghcr.io with its GHCR_PULL_TOKEN ($answer). Nothing was pulled." ;;
  esac
}

ship_image() { # <ref>
  local ref="$1"
  case "$ref" in
    *@sha256:*) ;;
    *) die "$ref is not pinned by digest — bin/images-from-lock.sh should have refused it." ;;
  esac
  if "${SSH[@]}" "docker image inspect '$ref' >/dev/null 2>&1"; then
    note "have      $ref"
    return 0
  fi
  lock_gate_has_registry "$ref" || die "$ref names no registry and the host does not hold it. A lock like this goes only to a
     bench that already has the bytes (--allow-local); a box is fed by a bake that pushed."
  case "$ref" in ghcr.io/*) ghcr_login ;; esac
  note "pull      $ref"
  "${SSH[@]}" "docker pull -q '$ref'" >/dev/null \
    || die "the host could not pull $ref. If the package is private, the host needs GHCR_PULL_TOKEN and
     GHCR_PULL_USER in its .secrets (a read-only token, once) — names only; this script never carries the value."
}

for ref in "$FORGE_IMAGE" "$FORGE_STOREFRONT_IMAGE" "$FORGE_CHECKOUT_IMAGE" "$FORGE_ADMIN_IMAGE"; do
  ship_image "$ref"
done
# The two this repository owns — pinned in the same lock, pulled the same way.
for ref in "${FORK_IMAGES[@]}"; do
  ship_image "$ref"
done

# ── 6 · MIGRATE, THEN UP ────────────────────────────────────────────────────────────────────────────────────
say '6 · migrate, then up'

# ★ THE ORDER IS THE MODEL'S, AND MIGRATION IS A ONE-SHOT AND NEVER A BOOT HOOK — `templates/instance/`'s own
# compose says so in its header, for a reason that is about failure and not about tidiness: a migration that
# runs as a container starts runs again on every restart, and a half-applied one on a box that is restarting
# is the state nobody can reason about. `run --rm` is a gesture with an exit code.
#
# ⚠️ The database has to be up for it, and only for it — hence the two-step below rather than one `up`.
# ★ THE PROJECT IS NAMED, NEVER INFERRED. Compose would derive it from the directory, and the day somebody
# deploys into a differently-named directory the box comes up BESIDE the old one — two stacks, two Postgres
# volumes, one port. It is the same rule `bin/box-up.sh` keeps on the bench (`COMPOSE_PROJECT_NAME`, line 205).
#
# ⚠️ AND `env-source.sh` IS SOURCED ON THE BOX, PER COMMAND — see `remote_compose` in `bin/remote-box.sh`.
#
# ⚠️⚠️ AND THE ARGUMENTS ARE AN ARRAY NOW, NOT ONE STRING. The old shape flattened them with `$*`, which held
# for exactly as long as no caller needed a value with a space in it — the defect `bin/box-up.sh::dc` paid for
# on the bench of 2026-09-03 (`-e FORGE_REF_STORE_NAME=Forge Café` → `no such service: Café`). The birth sends
# precisely that value, so the shared vehicle re-quotes every argument and callers stop pre-flattening.
# shellcheck disable=SC2086 -- $UP_ARGS is deliberately unquoted: empty means "no extra argument".
remote_compose "${COMPOSE_FILES[@]}" up -d postgres redis >/dev/null \
  || die 'the database and cache did not come up. `docker compose ps` on the host says more.'
note 'up        postgres, redis'

remote_compose "${COMPOSE_FILES[@]}" run --rm kernel node dist/migrate.js \
  || die 'the migration failed. The stack was NOT brought up — a box whose schema is half-applied must not serve.'
note 'migrated'

# shellcheck disable=SC2086 -- deliberately unquoted: empty means "no extra argument", not an empty one.
remote_compose "${COMPOSE_FILES[@]}" up -d --remove-orphans $UP_ARGS >/dev/null \
  || die 'the stack did not come up. `docker compose ps` on the host says which container.'
note "up        $BRINGING"

# ── 6b · ⛔⛔ THE BIRTH, AND ONLY WHEN IT WAS ASKED FOR BY NAME ────────────────────────────────────────────
#
# ★ IT IS A HAND-OFF AND NOT A SECOND IMPLEMENTATION. `bin/birth-remote.sh` is the birth; this is the deploy
# saying «and now do that too», with the environment it just delivered. Everything above has already run, so
# the box the birth is handed is a box whose images, compose files and `.env` are the ones this deploy chose.
#
# ⚠️ AND IT EXITS WITH THE BIRTH'S STATUS, deliberately: a deploy that reported success over a birth that
# refused would be the exact shape this house keeps paying for — a summary derived from what was ASKED FOR
# instead of from what was DONE.
if [ "$BIRTH" = 'yes' ]; then
  say '6b · the birth — asked for with --birth, and it is a DIFFERENT gesture'
  note "handing over to bin/birth-remote.sh ${ENV_NAME}"
  bash "$HERE/bin/birth-remote.sh" "$ENV_NAME" "${BIRTH_ARGS[@]+"${BIRTH_ARGS[@]}"}"
  exit $?
fi

# ── 7 · THE VERDICT ─────────────────────────────────────────────────────────────────────────────────────────
say '7 · the verdict'

remote_compose "${COMPOSE_FILES[@]}" ps || true

# ★ THE FACES ARE ASKED FROM HERE AND NOT FROM THE BOX, because what is being graded is what the internet
# gets: DNS, the certificate, and the edge choosing the right container. A curl from inside the host proves
# none of the three.
#
# ⚠️ AND IT WAITS, BECAUSE A CERTIFICATE IS NOT INSTANT. Caddy asks Let's Encrypt for each hostname when it
# starts, and a first boot with six of them takes tens of seconds. MEASURED 2026-09-16 on the staging box: the
# verdict run four seconds after `up` saw SIX unreachable faces and the same six answered on a trusted
# certificate a minute later. A verdict taken before the state it grades has settled is not a verdict — this
# repository has paid for that sentence once already (bin/box-cycle.sh, gesture 5).
#
# ★★ THREE ANSWERS, NOT TWO, AND THE THIRD IS THE ONE THAT MATTERS ON A BOX THAT HAS NOT BEEN BORN.
#   trusted    — the certificate verified AND a container answered. The status is printed and NOT judged:
#                an unborn box honestly 404s, and calling that a failure would teach people to ignore this.
#   no-upstream— the certificate verified and the edge had nobody to hand the request to (502/503). That is
#                what the café and the counter look like until the birth brings their two fronts up.
#   unreachable— DNS, the firewall, or no certificate. This is the only one that is about the DEPLOY.
FACE_WAIT_SECONDS="${FORGE_DEPLOY_FACE_WAIT:-120}"
printf '\n%s   waiting up to %ss for the edge to hold a certificate for each face\n' "$TAG" "$FACE_WAIT_SECONDS"
printf '%s   face                                          code  edge\n' "$TAG"

faces_total=0
faces_trusted=0
faces_no_upstream=0
faces_unreachable=0
deadline=$(( $(date +%s) + FACE_WAIT_SECONDS ))

for var in FORGE_DOMAIN FORGE_OUTLET_DOMAIN FORGE_CAFE_DOMAIN FORGE_TOTEM_DOMAIN FORGE_ADMIN_DOMAIN FORGE_CAFE_ADMIN_DOMAIN; do
  eval "host=\${$var:-}"
  [ -n "$host" ] || continue
  faces_total=$(( faces_total + 1 ))
  while :; do
    probe="$(curl -s -o /dev/null -m 20 -w '%{http_code} %{ssl_verify_result}' "https://${host}/" 2>/dev/null || printf '000 -')"
    code="${probe%% *}"
    verify="${probe##* }"
    [ "$code" != '000' ] && break
    [ "$(date +%s)" -lt "$deadline" ] || break
    sleep 5
  done
  case "$code" in
    000)     edge='unreachable';  faces_unreachable=$(( faces_unreachable + 1 )) ;;
    502|503) edge='no-upstream';  faces_no_upstream=$(( faces_no_upstream + 1 )) ;;
    *)       if [ "$verify" = '0' ]; then edge='trusted'; faces_trusted=$(( faces_trusted + 1 ));
             else edge="verify=$verify"; faces_unreachable=$(( faces_unreachable + 1 )); fi ;;
  esac
  printf '%s   %-44s %s  %s\n' "$TAG" "$host" "$code" "$edge"
done

printf '\n%s %s of %s face(s) answered from their own container over a trusted certificate' "$TAG" "$faces_trusted" "$faces_total"
[ "$faces_no_upstream" = '0' ] || printf ', %s had no container behind the edge' "$faces_no_upstream"
printf '.\n'
printf '%s ⛔ This box is DEPLOYED, not BORN. Whether it has anything to sell is the seed'"'"'s question: a 404 here\n' "$TAG"
printf '%s    is a shop with no stores in it, which is the truth about a host nobody has seeded.\n\n' "$TAG"

# ⚠️ WHAT MAKES THIS EXIT NON-ZERO IS `unreachable` AND NOTHING ELSE. A 404 is an unborn box telling the truth
# and a 502 is a front the birth has not brought up — neither is a broken deploy, and a script that went red
# about them would be red on every first deploy there will ever be.
[ "$faces_unreachable" = '0' ] || exit 1
exit 0
