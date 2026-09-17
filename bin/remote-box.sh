#!/usr/bin/env bash
# ★★★ THE VEHICLE — how a gesture on this machine reaches the box on a host that is not this laptop.
#
# ⛔ SOURCE IT, DO NOT EXECUTE IT. It defines functions and exports nothing a caller did not ask for.
#
#   . bin/remote-box.sh
#   remote_box_load stag        read deploy/box.env + deploy/stag.env, build the ssh command
#   remote_compose -f compose.yml -f compose.override.yml up -d postgres redis
#   remote_env_put FORGE_COFFEE_STORE_ID sto_01J…
#   remote_secret_put forge-operator-token "$value"
#
# ── ★★ WHY THIS FILE EXISTS AT ALL, WHICH IS THE ONLY INTERESTING THING ABOUT IT ────────────────────────────
#
# `bin/deploy.sh` grew the whole of it first, because a deploy was the first gesture this repository had that
# touched a machine which is not the operator's. `bin/birth-remote.sh` is the second, and the two need exactly
# the same four things: the environment's declaration, an ssh command built from it, `docker compose` run ON
# the box with its own secrets exported there, and the ability to write one line into the box's `.env` or
# `.secrets` without that line ever appearing in a command line.
#
# ⛔ A SECOND COPY WOULD BE THE SECOND TRUTH, and the copy is the one that ages: the day the box's directory
# moves, or the day `env-source.sh` needs a second argument, the deploy would learn it and the birth would
# not — and the birth is the gesture that writes data. So the vehicle has ONE author and both drive it.
#
# ── ★★★ THE QUOTING, AND IT IS THE ONE THING IN HERE THAT HAS ALREADY COST THIS HOUSE A DAY ────────────────
#
# `remote_compose` used to take its arguments as ONE string and interpolate them with `$*`. Every caller it
# had passed words with no spaces in them, so it worked — and it worked for exactly as long as nothing needed
# to send a value with a space. `bin/box-up.sh` paid for this on the bench of 2026-09-03, in its own `dc()`:
#
#     -e FORGE_REF_STORE_NAME=Forge Café   →  arrives at the inner shell as two words
#                                          →  `docker compose` answers `no such service: Café`
#
# and the tenant whose store is called "Forge" provisioned while the one called "Forge Café" did not — a
# defect that exists for SOME of the data, which is the kind that ships. The birth sends exactly that value,
# so this vehicle re-quotes EVERY argument with `printf %q` before it goes down the pipe, the same way `dc()`
# does. ⚠️ Which means callers pass `"${COMPOSE_FILES[@]}" up -d`, never `"${COMPOSE_FILES[*]} up -d"`: a
# single argument with spaces in it is now one token, on purpose.

# ⚠️ NOT `set -u`/`set -e` HERE. This file is SOURCED into scripts that set their own options; changing a
# caller's shell options from a library is how a script starts failing in a place it does not name.

# ── THE ENVIRONMENT, WHICH IS A FILE AND NOT A CASE STATEMENT ───────────────────────────────────────────────
#
# `deploy/<env>.env` is the whole definition of an environment — its host, its six hostnames, its bucket — so
# a third box costs one file and no edit to any script. A script carrying an address is a script that has to
# be edited to add a customer, which is the shape this whole repository exists to disprove.
remote_box_load() { # <env> <root> <die-fn>
  local env_name="$1" root="$2" fail="${3:-remote_box_die}"
  local common="$root/deploy/box.env" box="$root/deploy/$env_name.env"

  [ -f "$common" ] || { $fail "no deploy/box.env — the half every deployed box of this instance shares is missing."; return 1; }
  [ -f "$box" ] || { $fail "no deploy/$env_name.env. An environment IS that file; there is nothing here called '$env_name'."; return 1; }

  # ⚠️ `set -a` and not `source` alone: these are `.env` lines, and the values have to reach `ssh`/`docker` as
  # variables of this process rather than as shell locals.
  set -a
  # shellcheck disable=SC1090
  . "$common" || { $fail "deploy/box.env could not be read."; return 1; }
  # shellcheck disable=SC1090
  . "$box" || { $fail "deploy/$env_name.env could not be read."; return 1; }
  set +a

  local required v
  for required in FORGE_DEPLOY_HOST FORGE_DEPLOY_USER FORGE_DEPLOY_DIR FORGE_DOMAIN FORGE_ADMIN_DOMAIN FORGE_PUBLIC_ORIGIN; do
    eval "v=\${$required:-}"
    [ -n "$v" ] || { $fail "deploy/$env_name.env does not declare $required. An environment is a host plus its faces; this one is missing one of them."; return 1; }
  done

  REMOTE_BOX_ENV="$env_name"
  REMOTE_BOX_KEY="$(eval echo "${FORGE_DEPLOY_KEY:-~/.ssh/forge-demo-deploy}")"
  REMOTE_BOX_TARGET="${FORGE_DEPLOY_USER}@${FORGE_DEPLOY_HOST}"
  REMOTE_BOX_DIR="$FORGE_DEPLOY_DIR"
  # ⚠️ THE CONNECT TIMEOUT IS THE ENVIRONMENT'S, NOT THIS FILE'S. A box behind a firewall that DROPS rather
  # than refuses makes every gesture wait the full timeout, and how long that is worth waiting is a fact about
  # where the box lives. Default 20 s — long enough for a VM that is cold, short enough that a wrong address
  # is a wrong address within half a minute.
  #
  # ── ⛔⛔ AND IT KEEPS THE CONNECTION AWAKE, WHICH THE BIRTH IS WHAT TAUGHT THIS FILE ────────────────────
  #
  # MEASURED ON THE STAGING BOX, 2026-09-16, TWICE WITH THE SAME SHAPE. The massive seed is a one-shot that
  # prints nothing for ten to thirty minutes while it writes the catalogue. Both times it FINISHED on the box
  # — its own summary line came through, the container was gone and no `docker compose` process remained —
  # and the local `ssh` stayed open afterwards, forever, with the caller waiting on an EOF that never came.
  # A three-second one-shot through this same function returns in three seconds, so it is not the vehicle
  # being wrong about compose: it is a TCP session that nothing spoke on for a quarter of an hour.
  #
  # ⇒ `ServerAliveInterval` is traffic, and that is both halves of the repair: it keeps a NAT or a stateful
  # firewall from dropping an idle session, and when a session IS dead it makes `ssh` say so with an exit code
  # instead of blocking. ⚠️ A hang is the worst possible ending for a birth — every refusal in
  # `bin/birth-remote.sh` is written so that a step which fails STOPS the run, and a step that neither fails
  # nor returns escapes that discipline entirely.
  #
  # THE NUMBERS ARE DERIVED: 15 s × 40 = ten minutes of unanswered probes before giving up, which is longer
  # than any pause a loaded one-vCPU box has shown here and far shorter than "forever".
  REMOTE_SSH=(ssh -C -i "$REMOTE_BOX_KEY" -o StrictHostKeyChecking=accept-new \
    -o "ConnectTimeout=${FORGE_DEPLOY_SSH_TIMEOUT:-20}" \
    -o "ServerAliveInterval=${FORGE_DEPLOY_SSH_KEEPALIVE:-15}" \
    -o "ServerAliveCountMax=${FORGE_DEPLOY_SSH_KEEPALIVE_TRIES:-40}" \
    "$REMOTE_BOX_TARGET")
  return 0
}

remote_box_die() { printf '\n[remote-box] ⛔ %s\n\n' "$*" >&2; exit 1; }

# ── ONE COMMAND ON THE BOX, and stdin belongs to the CALLER ────────────────────────────────────────────────
#
# ⚠️ `-n` IS NOT USED HERE ON PURPOSE, because two callers feed this one on stdin (writing `.env` and
# `.secrets`, below) and a value that reached the box in a command line would be visible to `ps` on that host.
# Callers that must not inherit a here-doc close their own stdin — the trap `bin/box-up.sh` documents in
# `dc()`, where an attached stdin DRAINED a here-doc and ended a loop after one pass.
remote_run() { # <shell script text>
  "${REMOTE_SSH[@]}" "$1"
}

# ── `docker compose` ON THE BOX, with the box's own secrets, exported THERE ────────────────────────────────
#
# ★ THE PROJECT IS NAMED, NEVER INFERRED. Compose would derive it from the directory, and the day somebody
# deploys into a differently-named directory the box comes up BESIDE the old one — two stacks, two Postgres
# volumes, one port. It is the same rule `bin/box-up.sh` keeps on the bench (`COMPOSE_PROJECT_NAME`).
#
# ⚠️ AND `env-source.sh` IS SOURCED ON THE BOX, PER COMMAND. It exports the secrets into that shell and never
# writes them anywhere; a variable exported here would have to travel over the wire in a command line, where
# `ps` on the host would show it.
remote_compose() { # <docker compose args…>
  local quoted='' a
  for a in "$@"; do quoted+=" $(printf '%q' "$a")"; done
  "${REMOTE_SSH[@]}" "cd $(printf '%q' "$REMOTE_BOX_DIR") \
    && export COMPOSE_PROJECT_NAME=${REMOTE_BOX_PROJECT:-forge-demo} \
    && set -a && . ./env-source.sh >/dev/null && . ./bin/images-from-lock.sh >/dev/null && set +a \
    && docker compose$quoted"
}

# ── THE BOX'S `.env`, READ AND WRITTEN ONE KEY AT A TIME ───────────────────────────────────────────────────
#
# ★ THE BIRTH IS THE OTHER AUTHOR OF THAT FILE, and `bin/deploy.sh` already knows it: a key the two `deploy/`
# files DECLARE is written by a deploy, a key only the box has is CARRIED ACROSS. These two functions are what
# put a key in the second class — the store ids, the host map, the sibling list.
#
# ⚠️ THE VALUE TRAVELS ON STDIN, NEVER IN THE COMMAND LINE. `.env` holds no secret today, but the same two
# functions are the ones a later slice will reach for, and `ps` on a shared host is not a place to learn that
# distinction. python3 rather than `sed`, for the reason `bin/box-up.sh::put_env` states in full: `&` and `\`
# are syntax on sed's replacement side and every value here is GENERATED, so "no `&` in any of them, ever" is
# a property nobody is checking and nobody would notice losing.
#
# ⚠️⚠️ THE VALUE GOES INTO A FILE ON THE BOX FIRST, AND THAT IS NOT A FLOURISH — IT IS THE ONLY WAY BOTH CAN
# TRAVEL ON STDIN. `python3 -` reads the PROGRAM from stdin, so a here-doc carrying the program and a pipe
# carrying the value are the same channel and the second one wins nothing: `sys.stdin.read()` after a
# here-doc returns the empty string, which would write `NAME=` over a real value and look like it worked.
# Caught here, before this function had ever run. So `cat` drains the pipe into a temp file, THEN the
# here-doc becomes python's stdin, and the value is read from a path.
remote_env_put() { # <name> <value>
  printf '%s' "$2" | "${REMOTE_SSH[@]}" "
    vf=\$(mktemp) && cat > \"\$vf\" || exit 1
    python3 - $(printf '%q' "$REMOTE_BOX_DIR/.env") $(printf '%q' "$1") \"\$vf\" <<'PYEOF'
import sys
path, name = sys.argv[1], sys.argv[2]
value = open(sys.argv[3], encoding='utf-8').read()
line = f'{name}={value}\n'
seen = False
out = []
try:
    existing_lines = open(path, encoding='utf-8').readlines()
except FileNotFoundError:
    existing_lines = []
for existing in existing_lines:
    if existing.startswith(f'{name}='):
        out.append(line); seen = True
    else:
        out.append(existing)
if not seen:
    if out and not out[-1].endswith('\n'):
        out.append('\n')
    out.append(line)
open(path, 'w', encoding='utf-8').write(''.join(out))
PYEOF
    rc=\$?
    rm -f \"\$vf\"
    exit \$rc
"
}

remote_env_get() { # <name>   → the value, or empty
  "${REMOTE_SSH[@]}" "grep -m1 '^$1=' $(printf '%q' "$REMOTE_BOX_DIR/.env") 2>/dev/null | cut -d= -f2-" </dev/null
}

# ── THE BOX'S `.secrets`, WRITTEN AND NEVER READ BACK ──────────────────────────────────────────────────────
#
# ⛔ NO VALUE IS EVER PRINTED, HERE OR ANYWHERE. The birth captures a token straight out of a container's
# stderr into a shell variable and pipes it here; it reaches the far side on stdin, lands in a file with mode
# 600, and this function answers with nothing. A token that reaches a terminal reaches a scrollback, a log and
# anything reading either.
remote_secret_put() { # <name> <value>
  [ -n "$2" ] || return 1
  printf '%s' "$2" | "${REMOTE_SSH[@]}" "
    umask 077
    install -d -m 700 $(printf '%q' "$REMOTE_BOX_DIR")
    f=$(printf '%q' "$REMOTE_BOX_DIR/.secrets")
    touch \"\$f\"
    v=\$(cat)
    tmp=\$(mktemp)
    grep -v '^$1=' \"\$f\" > \"\$tmp\" 2>/dev/null || true
    printf '%s=%s\n' $(printf '%q' "$1") \"\$v\" >> \"\$tmp\"
    mv \"\$tmp\" \"\$f\"
    chmod 600 \"\$f\"
  "
}

# ★★ DOES THE BOX'S OWN `.env` DECLARE THIS NAME? — the read half of `remote_env_put`, and the same shape as
# `remote_secret_has` below: it answers about the NAME and never reads the value. A caller that needs to know
# whether a box has been TOLD something (rather than what it was told) asks here.
#
# ⚠️ A NAME DECLARED EMPTY COUNTS AS ABSENT, deliberately. `.env` is full of keys whose emptiness is a real
# decision (`FORGE_ADMIN_TENANT=` is host mode), but nobody asks THIS question about those — they ask it about
# a value the box was supposed to be given, and `NAME=` is exactly what "was never given" looks like there.
remote_env_has() { # <name>   → 0 when the box's .env declares it with a non-empty value
  "${REMOTE_SSH[@]}" "grep -qE '^$1=.+' $(printf '%q' "$REMOTE_BOX_DIR/.env") 2>/dev/null" </dev/null
}

remote_secret_has() { # <name>   → 0 when the box carries it
  "${REMOTE_SSH[@]}" "grep -q '^$1=' $(printf '%q' "$REMOTE_BOX_DIR/.secrets") 2>/dev/null" </dev/null
}
