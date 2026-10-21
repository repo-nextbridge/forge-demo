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
#   remote_refresh_stale_mounts -f compose.yml -f compose.override.yml    recreate what serves a stale mount
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

# ── ⛔⛔ AND THE ONE READ-BACK, WITH THE REASON IT EXISTS ────────────────────────────────────────────────────
#
# The block above says `.secrets` is WRITTEN AND NEVER READ BACK, and that was true while the only gesture
# that needed a tenant's operator token was the birth that had just MINTED it. `bin/birth-remote.sh --warm-only`
# and `--verdict-only` broke that: they are asked of a box that is ALREADY BORN, by a scheduler, on a machine
# that minted nothing. The token they need is that box's own, and the only place it lives is that box.
#
# ⇒ So the read-back exists, and it keeps the SAME custody the birth keeps for the token it holds: the value
# crosses ssh into a shell VARIABLE and stops there. It never lands on this machine's disk, never reaches a
# command line (`FORGE_OPERATOR_TOKEN=… node …` is an environment, which `ps` does not show), and is never
# printed. The caller that echoes it is the bug; this function is not.
#
# ⚠️ IT ANSWERS EMPTY FOR A SECRET THE BOX DOES NOT CARRY, and a caller must tell that from a token — an empty
# credential does not fail loudly at the port, it fails as "unauthorized", which reads like a broken box.
remote_secret_get() { # <name>   → the value, or empty
  "${REMOTE_SSH[@]}" "sed -n 's/^$1=//p' $(printf '%q' "$REMOTE_BOX_DIR/.secrets") 2>/dev/null | head -1" </dev/null
}

# ── ★★ KP-D1 — A REGISTRY LOGIN THAT LASTS ONE DEPLOY, AND WHOSE TOKEN NEVER TOUCHES A DISK HERE ─────────────
#
# The Forge release's images live in a PRIVATE Artifact Registry, and the GCP organization forbids
# service-account keys — so there is no credential to KEEP on the box, by policy, and none is kept. The caller
# mints a 1-hour token on the machine that deploys (impersonating the read-only account `registry-access.json`
# names) and pipes it here: it crosses on ssh's STDIN, straight into `docker login --password-stdin` on the
# box. ⛔ Never in a command line (`ps` on either host would show it), never printed, never in a file here.
# `remote_registry_logout` is the other half and the caller runs it after the pull: what docker writes to the
# box's config.json is a token that expires within the hour anyway, and logging out leaves nothing at all.
#
# Answers on stdout: `logged-in` or `refused` (docker's own message is dropped — it can echo the user, not the
# token, but a refusal reads better as a sentence of ours that names the host).
remote_registry_login() { # <host>   (the token on stdin)
  "${REMOTE_SSH[@]}" "docker login -u oauth2accesstoken --password-stdin $(printf '%q' "https://$1") >/dev/null 2>&1 \
    && echo logged-in || echo refused"
}

remote_registry_logout() { # <host>
  "${REMOTE_SSH[@]}" "docker logout $(printf '%q' "https://$1") >/dev/null 2>&1 || true" </dev/null
}

# ── ★★★ STALE MOUNTS — DOES THE RUNNING CONTAINER STILL SERVE WHAT THE DEPLOY JUST DELIVERED? ──────────────
#
# ⛔ MEASURED ON THE STAGING BOX, 2026-10-19 (deploy of main 1f1146a, rc=0, every face 200/307). MZ-9 put
# `import forge_noindex` in every site of `caddy/Caddyfile`. After the deploy the HOST's
# `/opt/forge-demo/caddy/Caddyfile` held the snippet (`grep -c forge_noindex` → 7), the edge's
# `/etc/caddy/Caddyfile` did not (`docker exec forge-demo-caddy-1 grep -c forge_noindex` → 0), the container
# dated from 10/10, and no face answered `X-Robots-Tag`. A green deploy, serving last week's edge.
#
# ★ THE CLASS. A bind mount of a FILE pins the INODE, not the path. `bin/deploy.sh` delivers with `tar -x`,
# and GNU tar replaces an existing file with a NEW inode — measured with tar 1.35: same path, inode
# 7845134 → 7845137, even when the bytes are identical. The container keeps the old, now-unlinked inode
# mapped at its destination. `docker compose up -d` does not recreate it (the service definition did not
# change), and `caddy reload` re-reads that same dead inode. Only a RECREATE re-resolves the mount.
#
# ★ SO THE QUESTION IS ASKED BY CONTENT, from inside the container's mount namespace, for every bind mount
# the containers REALLY have (`docker inspect`, never a list kept here — a config file added to compose next
# month is covered the day it is added):
#   · a FILE: sha256 of the host side vs `docker exec … cat` of the container side. ⚠️ NEVER `docker cp`: for a
#     bind mount it resolves the path on the HOST and would compare host against host forever (the product's
#     `infra/cicd/config-mount-selftest.sh` caught exactly that). And never the inode: tar gives every file a
#     new one on every deploy, so an inode rule would recreate the whole box on every push.
#   · a DIRECTORY: the same class, a different measure — the directory's inode (`stat -c %i`, host vs
#     container) and then a digest of its top-level names, because a recycled inode number can make a replaced
#     directory answer with the old one's. tar keeps an existing directory's inode (measured: 7845133/7845135
#     unchanged across two deliveries), so for a deploy this is a check that normally finds nothing — it is
#     here for the folder someone replaced by hand (`rm -rf` + recreate, `mv`), which goes stale the same way.
#   Different ⇒ that service is recreated (`up -d --force-recreate --no-deps`, only the ones that diverged).
#   Equal ⇒ nothing happens, so a deploy that changes no config costs no downtime.
#
# ⚠️ AN UNREADABLE SIDE COUNTS AS DIFFERENT. No `cat` in an image, a destination gone: the hash is empty or a
# sentinel and compares unequal. The failure direction is "make it current", never "assume it already is" — a
# needless recreate costs seconds, and the miss above shipped a whole edge that nobody was serving.
#
# ⚠️ AND A `docker` THAT CANNOT RUN IS RED, NOT QUIET. Every read below tolerates failure, so a dead docker
# would yield no mounts, no findings and a reassuring "nothing stale" — the one answer this must never give by
# accident. Hence the preflight, and the `checked` line the caller reads to know a measure was taken at all.
#
# The design is the product's (`infra/cicd/refresh-stale-mounts.sh` + `probe-live-mounts.sh`, which close this
# class for the product's own deploy); this is the instance's own copy, because the product does not ship it.
#
# Usage: box_refresh_stale_mounts <compose command…>      (runs where the containers are; DOCKER_CMD overrides
#                                                          `docker` with an ARRAY, e.g. DOCKER_CMD=(sudo docker))
# stdout, one finding per line, for the caller to report:
#   stale <service> file|dir <container path> <host path> <why>
#   recreated <service>
#   checked <files> <dirs>
# Returns 1 when docker cannot run or a recreate failed.
box_refresh_stale_mounts() {
  local -a compose_cmd=("$@")
  local -a docker_cmd=("${DOCKER_CMD[@]:-docker}")
  local svc cid mounts src dst host_side cont_side why stale='' files=0 dirs=0 attempt

  if ! "${docker_cmd[@]}" version >/dev/null 2>&1; then
    echo "stale-mounts: cannot run \`${docker_cmd[*]}\` — nothing was measured, so this is a failure and not a pass" >&2
    return 1
  fi

  for svc in $("${compose_cmd[@]}" config --services 2>/dev/null); do
    cid="$("${compose_cmd[@]}" ps -q "$svc" 2>/dev/null || true)"
    [ -n "$cid" ] || continue
    mounts="$("${docker_cmd[@]}" inspect -f \
      '{{range .Mounts}}{{if eq .Type "bind"}}{{.Source}}|{{.Destination}}{{println}}{{end}}{{end}}' \
      "$cid" 2>/dev/null || true)"

    while IFS='|' read -r src dst; do
      [ -n "${src:-}" ] && [ -n "${dst:-}" ] || continue
      why=''
      if [ -f "$src" ]; then
        files=$((files + 1))
        host_side="$(sha256sum <"$src" | cut -d' ' -f1)"
        cont_side="$("${docker_cmd[@]}" exec "$cid" cat "$dst" 2>/dev/null | sha256sum | cut -d' ' -f1)"
        [ "$host_side" = "$cont_side" ] || why='content differs (the container holds the file this path named before the delivery)'
      elif [ -d "$src" ]; then
        dirs=$((dirs + 1))
        host_side="$(stat -c '%i' "$src" 2>/dev/null || echo host-unreadable)"
        cont_side="$("${docker_cmd[@]}" exec "$cid" stat -c '%i' "$dst" 2>/dev/null || echo container-unreadable)"
        if [ "$host_side" != "$cont_side" ]; then
          why="directory inode differs (host $host_side, container $cont_side)"
        else
          # Two attempts: a write into a live folder between the two listings is a real race, not a finding.
          for attempt in 1 2; do
            host_side="$({ ls -A -- "$src" 2>/dev/null || true; } | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
            cont_side="$({ "${docker_cmd[@]}" exec "$cid" ls -A "$dst" 2>/dev/null || true; } | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
            [ "$host_side" != "$cont_side" ] || break
          done
          [ "$host_side" = "$cont_side" ] || why='directory entries differ (same inode number, a different directory)'
        fi
      else
        continue
      fi
      [ -n "$why" ] || continue
      echo "stale $svc $([ -f "$src" ] && echo file || echo dir) $dst $src $why"
      case " $stale " in *" $svc "*) ;; *) stale="$stale $svc" ;; esac
    done <<MOUNTS
$mounts
MOUNTS
  done

  local rc=0
  if [ -n "$stale" ]; then
    # `--no-deps`: the stale service and NOTHING else. Measured with compose 5.3.1 on 2026-10-19: without it,
    # `up -d --force-recreate edge` STARTS a dependency that was stopped (it does not recreate a running one),
    # so repairing a stale edge would bring back a front somebody stopped on purpose, and wait on its health.
    # shellcheck disable=SC2086 # deliberate word splitting: the list is service names built above.
    if "${compose_cmd[@]}" up -d --force-recreate --no-deps $stale >&2; then
      for svc in $stale; do echo "recreated $svc"; done
    else
      echo "stale-mounts: recreating${stale} FAILED" >&2
      rc=1
    fi
  fi
  echo "checked $files $dirs"
  return "$rc"
}

# ── … AND THE SAME, ON THE BOX: the function above travels on stdin and runs THERE, in one ssh session ──────
#
# ★ ON THE BOX, because both halves of the comparison live there — the host file and the container — and a
# walk driven from here would cost an ssh round trip per mount. The function's TEXT is what travels
# (`declare -f`), so the box needs no file of this repository beyond what the deploy already delivers, and
# there is one author of the rule. Same project name and same `env-source.sh` as `remote_compose`, so it walks
# exactly the containers that `remote_compose … up` just brought up.
remote_refresh_stale_mounts() { # <docker compose args…>   → box_refresh_stale_mounts' report on stdout
  local quoted='' a
  for a in "$@"; do quoted+=" $(printf '%q' "$a")"; done
  "${REMOTE_SSH[@]}" "cd $(printf '%q' "$REMOTE_BOX_DIR") \
    && export COMPOSE_PROJECT_NAME=${REMOTE_BOX_PROJECT:-forge-demo} \
    && set -a && . ./env-source.sh >/dev/null && . ./bin/images-from-lock.sh >/dev/null && set +a \
    && bash -s -- docker compose$quoted" \
    <<<"$(declare -f box_refresh_stale_mounts)
box_refresh_stale_mounts \"\$@\""
}
