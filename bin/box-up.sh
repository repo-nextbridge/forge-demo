#!/usr/bin/env bash
# ★★ THE ONE COMMAND — a virgin box becomes this demo's bench. EXECUTE it; do not source it.
#
#   bash bin/box-up.sh                birth: the fifteen steps below, on `localhost`
#   bash bin/box-up.sh --tailnet      PROMOTION: point the born box at this machine's tailnet (A15)
#   bash bin/box-up.sh --localhost    the promotion, undone
#
# The two modes are not steps of the birth and section 0b says at length why: the box is born on `localhost`
# by Renan's decision, and the addresses of a private network may not live in a versioned file.
#
# WHAT "ONE COMMAND" PROMISES, AND WHAT IT DOES NOT. It promises that a human types ONE thing and gets a
# working bench — not that there is only one step underneath. There are fifteen, they are listed below in the
# order they must happen, and each one is here because the step before it produced something it needs. That
# order IS the map of how this box is born, so it is written out rather than hidden behind a single verb:
#
#   1. postgres + redis          the box needs somewhere to put a schema before it can migrate one
#   2. migrate                   system schema first; tenants have none yet, and that is not an error
#   3. provision-ref  × TENANT   tenant + its FIRST store + FIRST operator + login driver + admin-host claim
#   4. admin-platform-token      the ONE box credential that lets one admin container serve both tenants
#   5. kernel + edge + fronts    now that a tenant exists for them to serve (INCLUDING the coffee fork)
#   6. seed-box.mjs   × TENANT   the remaining stores, the settings every screen inherits, and — for a
#                                tenant the dataset is not about — its apps, its freight, its checkout flag
#   7. totem                     LAST of the six images: it needs the counter store id step 6 resolved
#   8. seed.mjs       × TENANT   the CURATED data — what a human wrote, and what the assortment publishes
#   9. seed-demo      × DATASET  the MASSIVE catalogue — run ONLY for the tenant the mounted dataset is
#                                about. A dataset belongs to a brand; see $DATASET_TENANTS below.
#  10. seed-history  × TENANT   the PAST — 180 days of it, and it runs INSIDE the mail silence, never after
#  11. seed.mjs       × TENANT   the WINDOW (--phase window): promotions, blocks, cache bust, and the RE-ARM
#  12. verify-seed   × TENANT   the verdict over the DATA — does the box HOLD what this repository declares?
#  13. online-only               the edge and the bucket: what only exists online. AFTER the rebirth (13–15
#                                are the reset's own tail, and purging BEFORE it refills from a dying origin)
#  14. warm-box      × TENANT    every SERVABLE store, warmed and MEASURED. A cold box is a red box.
#  15. verify-config             the verdict over the CONFIGURATION — is the box WHAT it declares? This is
#                                the one a rebirth eats: it comes back half promoted and used to exit 0.
#
# ⚠️ 8, 9 AND 10 ARE ONE DIRECTION AND NOT A CYCLE, and it only looks circular if you read 8 and 10 as one
# step. The window promotes products of the MASSIVE catalogue, so it must follow 9; 9 publishes an assortment
# naming CURATED handles, so it must follow 8. They are three moments because the massive is another PROCESS
# — the one-shot in the container — not a line in the curated script.
#
# ⚠️ SIX IMAGES, NOT FOUR. Four are pinned by digest in `forge.lock` (kernel, storefront, checkout, admin);
# TWO are built here and carry this box's own front code — `forge-demo-storefront-coffee:local` (the coffee
# shop's forked vitrine) and `forge-demo-totem:local` (the counter). A box that comes up with four of them is
# missing exactly the two screens this demo exists to show, and it comes up GREEN, which is why they are
# named in this list rather than left to `docker compose up`.
#
# ⚠️ 3, 6, 8, 10 AND 11 ARE EACH RUN ONCE PER TENANT, AND THAT IS THE SHAPE RATHER THAN A WORKAROUND.
# ⛔ 9 IS THE ONE THAT IS NOT, and the difference is the whole of the 02/09 defect: those five apply what the
# BOX declares about a tenant, so every tenant has an answer for them. Step 9 applies what a DATASET declares,
# and a dataset is one brand's catalogue — so it has an answer for exactly the tenant it is about.
# `provision-ref` and `seed-demo` both read `referenceOptionsFromEnv()` — ONE tenant, ONE store, from the
# environment — and a credential belongs to ONE tenant, which the write face enforces with a 403. So "seed two
# tenants" is two runs with two environments and two tokens, in the same way and in the same place. Widening
# either entrypoint to take N tenants would move a boundary the kernel exists to hold into a script.
#
# ⚠️ NO TOKEN IS EVER PRINTED. `provision-ref` and `admin-platform-token` each emit a secret exactly once, on
# stderr/stdout; this script captures them straight into `.secrets` through a temp file it shreds. A token that
# reaches a terminal reaches a scrollback, a log and anything reading either.
#
# IDEMPOTENT. Every step converges on a second run: migrate is a no-op, `provision-ref` returns the same store
# id (retiring the login driver it minted last time — the count is printed), the box seeder creates nothing,
# and `seed-demo` is documented as converging. Re-running is the supported way to repair a half-built box.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

# ── THE ONE ARGUMENT, AND IT SELECTS A MODE RATHER THAN A STEP ──────────────────────────────────────────────
# No argument = birth, which is everything below. `--tailnet` / `--localhost` run the PROMOTION block and
# nothing else; it lives just after step 0 (it needs the environment sourced and the topology read) and exits
# there. See its own header for why promotion is not a step of the birth.
MODE=birth
case "${1:-}" in
  '')          ;;
  --tailnet)   MODE=tailnet ;;
  --localhost) MODE=localhost ;;
  *) printf '\n[box-up] unknown argument "%s".\n  usage: bash bin/box-up.sh [--tailnet|--localhost]\n\n' "$1" >&2; exit 1 ;;
esac

: "${COMPOSE_PROJECT_NAME:=forge-preseed}"
export COMPOSE_PROJECT_NAME

# `docker` needs a group shim on this box, and that shim takes ONE STRING — which is the whole hazard here.
#
# ⚠️ EVERY ARGUMENT IS RE-QUOTED, because `"$*"` is not the same as `"$@"` once a value contains a space. The
# first version flattened the arguments into the string this shim runs, so `-e FORGE_REF_STORE_NAME=Forge Café`
# arrived at the inner shell as two words and compose answered `no such service: Café`. The tenant whose store
# is called "Forge" provisioned fine and the one called "Forge Café" did not — a bug that only exists for
# SOME of the data, which is the kind that ships. `printf %q` makes the round trip lossless.
DOCKER_SH="${FORGE_DOCKER_SH:-sg docker -c}"
# ⚠️ STDIN IS CLOSED, AND THAT IS THE WHOLE POINT OF THIS LINE. `docker compose run` ATTACHES stdin by
# default, so a `dc run` inside a `while read … <<EOF` loop DRAINS THE HERE-DOC on its first iteration and the
# loop ends after one pass. Measured on the birth of 2026-09-03: the tailnet promotion claimed the admin door
# of ONE tenant out of two, counted 1 honestly, and then printed BOTH doors — because the block that prints
# them re-reads the same here-doc from the start. The café's admin would have opened a login page and refused
# the POST with `unknown_admin_host`, which is the silent failure the promotion slice exists to kill.
# Nothing here needs an interactive stdin; every `dc` call is a one-shot command.
dc() {
  local quoted='' a
  for a in "$@"; do quoted+=" $(printf '%q' "$a")"; done
  $DOCKER_SH "cd $(printf '%q' "$HERE") && docker compose$quoted" </dev/null
}

# ★★ A CONTAINER PATH MAY NEVER REACH A HOST PROCESS — enforced, not remembered.
#
# THE DEFECT THIS EXISTS FOR, TWICE IN ONE EVENING. `FORGE_SEED_DATASET_DIR=/app/seed-dataset` and
# `FORGE_SEED_PHOTOS_DIR=/data/seed-photos` are TRUE for the kernel and FALSE for anything running on this
# machine. This script sources `.env`, so every host process it starts INHERITS both — and a seeder that
# reads them dies with `does not exist` or `ENOENT`, naming a path that genuinely exists three metres away
# inside a container. The `..._DIR` / `..._HOST_DIR` pair exists precisely for this, and the two names are
# far too similar to trust anyone's attention with, mine included.
#
# So a host process is started through `host_node`, which (1) REPLACES each known container path with its
# host counterpart, and (2) REFUSES to launch if any FORGE_* variable still holds a value under /app or
# /data — naming every offender. A new variable of that shape added later is caught by (2) on its first run,
# which is the half that keeps this from going stale: the list in (1) is what I know, (2) is what I do not.
CONTAINER_PATH_VARS='FORGE_SEED_DATASET_DIR:FORGE_SEED_DATASET_HOST_DIR FORGE_SEED_PHOTOS_DIR:'
host_node() { # <script> [args…]
  local pair name host_name value overrides='' blanked=''
  # (1) THE KNOWN PAIRS — remapped to their host sibling. A pair whose sibling is EMPTY is the one case that
  #     is genuinely fatal: something has declared it needs this on the host, and there is no host value to
  #     give it. Guessing one is how a seeder ends up writing into the wrong place instead of failing.
  for pair in $CONTAINER_PATH_VARS; do
    name="${pair%%:*}"; host_name="${pair#*:}"
    if [ -n "$host_name" ]; then
      eval "value=\${$host_name:-}"
      eval "cur=\${$name:-}"
      case "$cur" in
        /app|/app/*|/data|/data/*)
          [ -n "$value" ] || { die "$name is a container path ($cur) and its host sibling $host_name is EMPTY.
     A host process cannot be given either. Set $host_name, or take $name out of CONTAINER_PATH_VARS."; return 1; }
          ;;
      esac
      overrides="$overrides $name=$(printf '%q' "$value")"
    else
      # No host counterpart can exist (a named volume has no honest host address). Blank it: a host process
      # that needs it must fail saying UNSET, never chase a path into /data.
      overrides="$overrides $name="
    fi
  done
  # (2) EVERYTHING ELSE THAT LOOKS LIKE A CONTAINER PATH IS BLANKED, NOT REFUSED — and this is the correction
  #     that the box itself taught. The first version REFUSED on any FORGE_* under /app or /data, and the run
  #     died on `FORGE_THEMES_DIR=/app/themes-instance` and `FORGE_EXTENSIONS_DIR=/app/extensions` — container
  #     paths that are perfectly correct for the kernel and that NO host script reads. The rule was stated one
  #     notch too wide: what must never happen is a host process RECEIVING a container path, not one EXISTING
  #     in the environment. Blanking is strictly stronger than the old refusal (it covers every such variable
  #     rather than the two named above) and it stops nothing that does not need stopping. A host process that
  #     genuinely wanted one now fails with UNSET, which names itself.
  while IFS='=' read -r name value; do
    case "$name" in FORGE_*) ;; *) continue;; esac
    case " ${overrides} " in *" $name="*) continue;; esac
    case "$value" in
      /app|/app/*|/data|/data/*)
        overrides="$overrides $name="
        blanked="$blanked $name" ;;
    esac
  done < <(env)
  [ -z "$blanked" ] || note "host run: blanked container path(s) —$blanked"
  env $overrides node "$@"
}

say() { printf '\n\033[1m── %s\033[0m\n' "$*" >&2; }
note() { printf '   %s\n' "$*" >&2; }
die() { printf '\n[box-up] %s\n' "$*" >&2; exit 1; }

# ── ⚠️ 0a · THE HOST'S NODE, AND IT IS THE FIRST THING THIS SCRIPT DOES ─────────────────────────────────────
# Steps 6, 8, 11, 12, 13, 14 and 15 are node processes on THIS machine (see `host_node` above), so the
# operator's node is an input of the install. F13 of the install rehearsal: this bench has two of them and the interactive PATH
# resolves to v22.22.3, under the floor the product declared — every birth of 2026-09-03 ran there and
# finished green, which is precisely why a refusal and not a warning. It is placed ABOVE the `jq` check
# because a birth that is going to be refused must be refused before it reads a file, starts a container or
# writes a secret. `bin/require-node.sh` READS the number out of `forge.lock` — the floor is a property of
# the release this box pins, not of this repository; `bin/node-floor.guard.mjs` proves this line is first.
# shellcheck source=bin/require-node.sh
. "$HERE/bin/require-node.sh"
require_node || exit 1

command -v jq >/dev/null || die 'jq is required.'
[ -f "$HERE/.env" ] || die 'no .env — copy .env.example to .env first.'

# ── THE TOPOLOGY, read from the ONE file that states it ─────────────────────────────────────────────────────
# `seed/box.json` is where the tenants, their stores and their settings are declared. Reading it here rather
# than repeating the ids means the sequence below cannot drift from what the seeder applies.
BOX="$HERE/seed/box.json"
[ -f "$BOX" ] || die "no seed/box.json — this script has no topology to build."
TENANTS="$(jq -r '.tenants[].id' "$BOX")"
# ── ★★ WHOSE CATALOGUE THE MOUNTED DATASET IS — and this one line is a whole class of defect ────────────────
#
# ⛔ MEASURED ON THE BENCH OF 02/09. Step 9 used to run `for t in $TENANTS`, and step 9 is `dist/seed-demo.js`:
# it fills the tenant it is POINTED AT from whatever dataset the box mounts. This box mounts ONE, the FOOTWEAR
# catalogue. So the coffee tenant was handed 2 790 footwear products, 44 427 SKUs, 351 footwear brands, 33
# footwear categories and eleven footwear custom fields (AMORTECIMENTO, CANO, DROP MM, PISADA, SOLADO, …) on
# top of its own 21 — and the admin's stock alert, category tree and brand filter became a shoe shop's.
#
# ★ THE KERNEL WAS INNOCENT, and that is what decided the repair belongs HERE. The same handles carry
# DIFFERENT product ids in the two schemas (`adidas-golf-braided-stretch-belt` is prod_01M1FRFC9D… in forgeco
# at 00:32:03 and prod_01M1FS95MQ… in forgecafe at 00:46:08): two independent, correctly-scoped writes, not
# one crossing a boundary. The entrypoint filled exactly the tenant this loop named. The loop was the defect.
DATASET_TENANTS="$(jq -r '.tenants[]|select(.dataset == true)|.id' "$BOX")"
[ -n "$DATASET_TENANTS" ] || die "seed/box.json declares no tenant with \`dataset: true\`, so nothing owns the
     example catalogue this box mounts. Step 9 would fill nobody and the sports shop would be born empty.
     Mark the tenant the dataset is ABOUT — see the file's own \`_readme\`."

secret_name_for() { # <tenant> <kind: seed|driver>
  # T1 keeps the unsuffixed names the box was born with, so nothing that already refers to them has to move.
  local t="$1" kind="$2" base
  base="$([ "$kind" = seed ] && echo forge-seed-token || echo forge-admin-service-token)"
  if [ "$t" = "$(echo "$TENANTS" | head -1)" ]; then printf '%s' "$base"; else printf '%s-%s' "$base" "$t"; fi
}

put_secret() { # <name> <value>  — never echoes the value
  local name="$1" value="$2" file="$HERE/.secrets"
  [ -n "$value" ] || return 1
  touch "$file"
  local tmp; tmp="$(mktemp)"
  grep -v "^${name}=" "$file" > "$tmp" 2>/dev/null || true
  printf '%s=%s\n' "$name" "$value" >> "$tmp"
  mv "$tmp" "$file"
  chmod 600 "$file"
}

# ONE VARIABLE INTO `.env` — rewritten in place if it is there, appended if it is not. Never echoes a value:
# every caller here writes a hostname or a store id, but the file it edits also holds addresses of a private
# network, and a helper that printed what it wrote would put them in a scrollback and a log.
#
# ⚠️ THE VALUE IS PASSED THROUGH PYTHON, NOT `sed`, AND THE REASON IS STATED HONESTLY. `sed -i "s|^X=.*|X=$v|"`
# is the shape already on this box (the totem's store id, a ULID — where it is provably safe), and MEASURED,
# it also survives today's two JSON values: neither a host map nor a sibling list happens to contain a `|`,
# an `&` or a backslash, which are the three characters sed's replacement side treats as syntax (`&` alone is
# the quiet one — it expands to the whole matched line).
#
# So this is not a bug being fixed; it is a class being closed. The values here are GENERATED — from a store
# id, from `seed/box.json`, from a hostname somebody types into `.env` — and "no `&` in any of them, ever" is
# a property nobody is checking and nobody would notice losing. Python takes the value as an argv string and
# writes it verbatim, so the property does not have to hold. The guard proves that by writing a value that
# carries all three.
put_env() { # <name> <value>   — value written verbatim, one line
  python3 - "$HERE/.env" "$1" "$2" <<'PYEOF'
import sys
path, name, value = sys.argv[1], sys.argv[2], sys.argv[3]
line = f'{name}={value}\n'
seen = False
out = []
for existing in open(path, encoding='utf-8'):
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
}

# THE ADMIN'S SIBLING SWITCHER, DERIVED FROM `seed/box.json` (A44).
#
# ★ WHY IT IS DERIVED AND NOT WRITTEN DOWN. `FORGE_ADMIN_SIBLINGS` is the dropdown that lets an operator jump
# from one brand's admin to the other's — `[{ "name": …, "url": … }]`, read by `apps/admin/src/lib/config.ts`.
# It is ENV, so on the bench it was typed in by hand, and every rebirth wiped it: the switcher simply stopped
# appearing, which is the least diagnosable failure this feature can have (an empty list renders the shell
# EXACTLY as it did before the feature existed — `siblings.ts` says so, by design). Both facts it needs are
# already declared in `seed/box.json`: `settings.tenant_name` and `admin_host`. So it is built from the file
# that states the topology, and a third tenant added there arrives in the dropdown with no second edit.
#
# ⚠️ NOT SSO, AND THAT IS THE POINT. Each admin is its own host and the session cookie is host-only, so
# switching brands means logging in again. Renan named that as correct rather than as a limitation: it is
# what stops an operator acting on the wrong tenant while believing they are on the other.
#
# ⚠️ SINGLE-QUOTED FOR THE SAME REASON `FORGE_STORE_HOSTS` IS (see step 3b): `.env` is read by TWO parsers,
# compose's and bash's, and a bare JSON value loses its inner double quotes to `source`.
#
# $1 = an optional host to use INSTEAD of each tenant's `admin_host` HOSTNAME, keeping that entry's PORT —
#      which is how the tailnet promotion re-points the same two doors without a second copy of this logic.
# $2 = an optional JSON object `{tenant_id: absolute-url}` that WINS over $1 for the tenants it names. The
#      tailnet promotion fills it, because over there neither half of the box.json address survives: the door
#      a browser really opens is on another PORT (`tailscale serve` publishes its own) and another SCHEME
#      (TLS terminates there). Keeping $1 for everything it does not name means a third tenant added to
#      seed/box.json still arrives with no second edit.
admin_siblings_json() { # [host] [overrides-json]
  local host="${1:-}" overrides="${2:-}"
  [ -n "$overrides" ] || overrides='{}'
  jq -c --arg host "$host" --argjson ov "$overrides" '[ .tenants[]
      | { name: (.settings.tenant_name // .id)
        , url: ( $ov[.id]
                 // ("http://" + (if $host == "" then .admin_host
                                  else ($host + (.admin_host | capture("(?<port>:[0-9]+)?$").port // "")) end)) ) } ]' "$BOX"
}

# ── ★★ WHAT THE TAILNET ACTUALLY PUBLISHES — READ, NEVER ASSUMED (pk6·D2) ───────────────────────────────────
#
# ⛔ THE DEFECT, MEASURED ON THE BENCH OF 03/09. The promotion below used to take each door's INTERNAL port
# and glue this machine's tailnet name in front of it — `http://<tailnet>:8201` for the first tenant's admin,
# `http://<tailnet>:8202` for the second. Neither address is the one a browser uses, and BOTH failed silently:
#
#   http://<tailnet>:8201/apps   → the login page. The admin's session cookie is minted `Secure` (the image
#                                  runs NODE_ENV=production), and a browser REFUSES to store a `Secure`
#                                  cookie over plain http on anything but `localhost`. So the login succeeds,
#                                  the jar keeps nothing, and the next request bounces:
#                                  `[admin-auth] no session cookie on /apps … Jar: forge_gate_lang`.
#                                  It reads as "it logged me out by itself".
#   https://<tailnet>:8443/…     → the address `tailscale serve` really answers on, and the directory had no
#                                  claim for it. Measured: `read.admin.by_host?host=<tailnet>:8443` → 404,
#                                  `<tailnet>:8201` → 200. Login refuses with `unknown_admin_host`.
#
# ★ SO THE PORT HAS TO COME FROM WHAT IS PUBLISHED, NOT FROM WHAT THIS BOX LISTENS ON. `tailscale serve`
# terminates TLS on ports of its own choosing and forwards plain http to `127.0.0.1:<internal>`; that mapping
# is the only thing tying an address a browser can type back to a service of this box, and it is READABLE.
# Deriving beats asking — the same reason the scheme below is probed rather than configured.
#
# ⚠️ READING IS NOT CONFIGURING, and A15's hard line survives intact: this still never runs `tailscale serve`,
# `tailscale up` or anything else that CHANGES that machine's network. Getting on the tailnet stays the
# operator's gesture; knowing what the gesture produced is this box's job.
#
# ⚠️ AND IT DEGRADES TO EXACTLY THE OLD BEHAVIOUR. No `tailscale` on the box, no permission to ask it, or a
# machine reached by plain tailnet IP with no `serve` at all: the table comes back EMPTY and every caller
# falls back to the internal port over http — which is what `--tailnet` has always written.
#
# Emits one line per published door, for the host asked about: "<local-port> <scheme> <public-port>".
tailnet_published_ports() { # <tailnet-host>
  command -v tailscale >/dev/null 2>&1 || return 0
  # ⚠️ THE DOCUMENT TRAVELS AS AN ARGUMENT, NOT DOWN A PIPE, and that is not a style choice: `python3 - …`
  # takes its PROGRAM from stdin, so the `<<'PYEOF'` below already owns it. Piped in, the JSON is silently
  # thrown away and this function returns EMPTY — which every caller reads as "nothing is published" and
  # falls back to the internal port. Measured: the first version of this did exactly that, and the guard's
  # published-door test failed with the internal-port claims it exists to forbid.
  local doc
  doc="$(tailscale serve status --json 2>/dev/null)" || return 0
  [ -n "$doc" ] || return 0
  python3 - "$1" "$doc" <<'PYEOF'
import json, sys
host = sys.argv[1].strip().lower()
try:
    doc = json.loads(sys.argv[2])
except Exception:
    raise SystemExit(0)           # no serve config at all prints `{}` on some versions and nothing on others
tcp = doc.get('TCP') or {}
for authority, site in (doc.get('Web') or {}).items():
    name, _, public = authority.rpartition(':')
    if name.strip().lower() != host or not public.isdigit():
        continue
    # Only the ROOT handler: a door published under a path prefix is not an origin, and this box has no
    # service that would survive being mounted under one (the admin is a Next app with no `basePath` —
    # caddy/Caddyfile.local carries that measurement).
    proxy = ((site.get('Handlers') or {}).get('/') or {}).get('Proxy') or ''
    local = proxy.rpartition(':')[2].split('/')[0]
    if not local.isdigit():
        continue
    print(local, 'https' if (tcp.get(public) or {}).get('HTTPS') else 'http', public)
PYEOF
}

# One field of that table, or empty when nothing publishes this box's port. <field>: 1 = scheme, 2 = public port.
serve_field() { # <table> <local-port> <field>
  printf '%s\n' "$1" | awk -v l="$2" -v f="$3" '$1 == l { print (f == 1 ? $2 : $3); exit }'
}

# The `host:port` a browser sends as `Host` — which is the key `read.admin.by_host` and `FORGE_STORE_HOSTS`
# both resolve on. The default port of the scheme is OMITTED, because a browser omits it.
authority_for() { # <host> <published-scheme> <published-port> <fallback-port>
  case "$2:$3" in
    https:443|http:80) printf '%s' "$1" ;;
    ?*:?*)             printf '%s:%s' "$1" "$3" ;;
    *)                 printf '%s:%s' "$1" "$4" ;;
  esac
}

# …and the same address as an absolute origin.
origin_for() { # <host> <published-scheme> <published-port> <fallback-port>
  printf '%s://%s' "${2:-http}" "$(authority_for "$1" "$2" "$3" "$4")"
}

# ── 0 · the environment ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ BEFORE STEP 1, AND THE VIRGIN-BOX TEST IS WHAT PUT IT HERE. This was sourced at step 5, on the reasoning
# that the tokens it exports are only minted at step 3 — and the very first `docker compose` call died on
# `required variable DATABASE_URL is missing a value`. Compose interpolates the WHOLE file on every command,
# so every variable any service needs must exist before the first one runs, not before the service that uses
# it starts. It is sourced AGAIN after step 4 to pick up what steps 3 and 4 minted.
#
# ⚠️ AND `.env` IS READ INTO THIS SHELL TOO, WHICH IS NOT THE SAME AS COMPOSE READING IT. Compose loads `.env`
# by itself for interpolation, so the CONTAINERS were always right — but this script's own `curl`s and its
# calls to `bin/seed-box.mjs` run on the HOST, where those variables did not exist. Measured on a virgin box:
# `FORGE_PUBLIC_ORIGIN` was unset here, the health check fell through to its `:-http://localhost:8200` default,
# and it cheerfully got a 200 FROM A DIFFERENT BOX that happened to be running on that port. A green that
# proves another machine is healthy is worse than a red.
# shellcheck disable=SC1091
set -a
. "$HERE/env-source.sh" >/dev/null 2>&1
[ -f "$HERE/.env" ] && . "$HERE/.env"
. "$HERE/bin/images-from-lock.sh" >/dev/null 2>&1
set +a
[ -n "${DATABASE_URL:-}" ] || die 'env-source.sh exported no DATABASE_URL — is .secrets missing forge-postgres-password?'
[ -n "${FORGE_PUBLIC_ORIGIN:-}" ] || die 'no FORGE_PUBLIC_ORIGIN in .env — this script would otherwise probe a default port that may belong to another box.'

# ── 0b · THE PROMOTION: THIS BOX ON THE TAILNET, AND WHY IT IS NOT A STEP OF THE BIRTH (A15) ────────────────
#
# ★★ THE BOX IS BORN ON `localhost`. Renan decided it, in those words: *"faz sentido nascer localhost sim e
# só quando eu pedir subir pra tailscale"*. A birth that depended on somebody's private network would stop
# proving the product and start proving the network — and the addresses of that network are HIS, so they may
# not live in a versioned file. Both halves of that are why this is a MODE and not step 3b·2.
#
# WHAT IT REPAIRS. On 01/09 the bench was moved onto the tailnet BY HAND: four host keys added to
# `FORGE_STORE_HOSTS`, the public origin and the gate's admin URL re-pointed, and four admin hostnames
# claimed through the port. Every one of those is `.env` or data written at birth — so the next
# `bash bin/box-up.sh` put the box back on `localhost` and the tailnet answered 404 again. The arrangement was
# real work and nothing in the repository remembered it. Now it does.
#
# WHAT IT IS NOT, AND THIS IS THE HARD LINE. It does not CONFIGURE `tailscale serve`, it does not run
# `tailscale up`, and it changes no state of that machine's network. It assumes the machine is ALREADY
# reachable on the tailnet and wires the BOX to that fact. Getting on the network is the operator's gesture;
# knowing about it is this box's job.
#
# ⚠️ AND KNOWING ABOUT IT MEANS ASKING (pk6·D2, and this line USED to say the opposite). The first version
# assumed the published ports were this box's own — `FORGE_HTTP_PORT`, `FORGE_ADMIN_HTTP_PORT`,
# `FORGE_ADMIN2_HTTP_PORT` — and that assumption is false wherever `tailscale serve` is what does the
# publishing: it terminates TLS on ports IT chooses (443, 8443, 8444 on this bench) and forwards to the
# box's. So the promotion now READS `tailscale serve status --json` and derives every address from it. That
# is still not configuring anything — see `tailnet_published_ports` for the measurement that forced it, and
# `bin/box-config.guard.mjs` for the check that keeps the read read-only.
#
#   bash bin/box-up.sh --tailnet      point this box at the tailnet
#   bash bin/box-up.sh --localhost    put it back
#
# ⚠️ THE ADDRESSES COME FROM THE ENVIRONMENT, NEVER FROM A COMMITTED FILE. Two variables, and `.env` is
# gitignored:
#
#   FORGE_TAILNET_HOST   the MagicDNS name this machine answers to. Required.
#   FORGE_TAILNET_IP     its tailnet address. Optional, and it is the safety net for the case that actually
#                        happened — a phone on the tailnet with MagicDNS off resolves the name to nothing.
#
# IDEMPOTENT, twice over: every `.env` value is REWRITTEN rather than appended to (`put_env`), and the host →
# store map is rebuilt from scratch each run rather than added to, so running it three times leaves what
# running it once leaves. REVERSIBLE: `--localhost` writes the same three values back and releases the
# hostnames it claimed. Neither direction touches a store, a product or an order.
if [ "$MODE" != birth ]; then
  say "promotion · $MODE"

  # THE HOSTNAMES, and the refusal is the first thing that happens. A run with nothing to promote to would
  # otherwise write `http://:8200` into the origin every front derives its image URLs from.
  # ⚠️ BOTH DIRECTIONS NEED THE NAMES, and `--localhost` needs them for the less obvious reason: releasing a
  # hostname means naming it. A reverse that could run without them would leave the admin directory holding
  # claims for a network the box no longer serves — a stale front door is worse than no front door.
  [ -n "${FORGE_TAILNET_HOST:-}" ] || die "FORGE_TAILNET_HOST is unset, so this run has no hostname to $([ "$MODE" = tailnet ] && echo 'claim' || echo 'release').
     Put this machine's tailnet name in .env (or export it for this run) — it is deliberately not in the repository."
  net_hosts="$FORGE_TAILNET_HOST"
  [ -n "${FORGE_TAILNET_IP:-}" ] && net_hosts="$net_hosts $FORGE_TAILNET_IP"

  # ── WHAT THIS MACHINE PUBLISHES, READ ONCE ──────────────────────────────────────────────────────────────
  # BOTH directions need it, and `--localhost` for the sharper reason: releasing a door means naming it, and
  # after this change the name of a tenant's tailnet door is the PUBLISHED port. A reverse that could not
  # read the table would leave exactly the claim it exists to remove.
  serve_table="$(tailnet_published_ports "$FORGE_TAILNET_HOST")"
  if [ -n "$serve_table" ]; then
    note "read from tailscale serve: $(printf '%s\n' "$serve_table" | wc -l) published door(s) on this machine — this box's addresses derive from them"
  else
    note '⚠️ tailscale publishes nothing for this host (or is not readable here) — falling back to the direct ports'
  fi

  # ── the host → store map ────────────────────────────────────────────────────────────────────────────────
  # ★ THE STORE ID IS READ BACK FROM THE MAP THAT IS ALREADY THERE, not resolved again. `provision-ref`
  # returns it at birth and nothing but a rebirth changes it; asking the port for it here would need a
  # credential this mode has no reason to hold, and re-running `provision-ref` to learn a value is a write to
  # answer a read. If the map is empty the box was never born, and saying so is better than guessing.
  root_store="$(python3 - "$HERE/.env" <<'PYEOF'
import json, sys
raw = ''
for line in open(sys.argv[1], encoding='utf-8'):
    if line.startswith('FORGE_STORE_HOSTS='):
        raw = line.split('=', 1)[1].strip().strip("'")
try:
    mapping = json.loads(raw) if raw else {}
except ValueError:
    mapping = {}
# `localhost` is the key step 3b always writes first, and the root store is what it points at.
print(mapping.get('localhost') or next(iter(mapping.values()), ''))
PYEOF
)"
  [ -n "$root_store" ] || die 'FORGE_STORE_HOSTS holds no store id — this box has not been born yet. Run `bash bin/box-up.sh` first.'

  hport="${FORGE_HTTP_PORT:-8200}"
  store_scheme="$(serve_field "$serve_table" "$hport" 1)"
  store_port="$(serve_field "$serve_table" "$hport" 2)"

  hosts="localhost 127.0.0.1 $(hostname 2>/dev/null)"
  [ "$MODE" = tailnet ] && hosts="$hosts $net_hosts"
  map=''
  for h in $hosts; do
    [ -n "$h" ] || continue
    map="$map\"$h\":\"$root_store\",\"$h:$hport\":\"$root_store\","
    # ★ AND THE SPELLING `tailscale serve` PUBLISHES, when it differs. The vitrine's published door is 443 on
    # this bench, and a browser sends the bare host for 443 — already a key above. It is added anyway because
    # the operator chooses those ports, and a vitrine published on `:8446` would otherwise resolve to no
    # store and 404 with nothing saying why. Extra keys cost nothing: every one of them really reaches here.
    if [ "$MODE" = tailnet ]; then
      case " $net_hosts " in
        *" $h "*)
          pub="$(authority_for "$h" "$store_scheme" "$store_port" "$hport")"
          case "$pub" in "$h"|"$h:$hport") ;; *) map="$map\"$pub\":\"$root_store\"," ;; esac ;;
      esac
    fi
  done
  # ⚠️ COMPUTED HERE, WRITTEN LOWER DOWN — with the other three, AFTER the doors are claimed. Everything
  # above this point is a read, and the claim below is the first thing that can prove this box was never
  # born. If `.env` were already rewritten by then, the refusal would leave the box pointed at a tailnet it
  # cannot serve: BIRTH rewrites FORGE_STORE_HOSTS but never FORGE_PUBLIC_ORIGIN, so the next
  # `bash bin/box-up.sh` would mint every product-image URL on an origin no page is opened at — the exact
  # mixed-content evening this file's own comment above records. A refusal has to leave nothing behind.
  store_hosts_value="'{${map%,}}'"
  store_hosts_count="$(echo "$hosts" | wc -w)"

  # ── the origin every front derives an address from ──────────────────────────────────────────────────────
  # ⚠️ THIS ONE IS NOT COSMETIC. The kernel's local media driver mints every product-image URL from
  # `FORGE_PUBLIC_ORIGIN`, so a box reached over the tailnet with `http://localhost:8200` here serves a
  # catalogue of images a phone cannot fetch — and nothing logs an error, which is how it cost an evening.
  #
  # ⚠️ AND THE SCHEME IS PART OF IT, which cost a second evening on 2026-09-02. A tailnet reached through
  # `tailscale serve` answers TLS on 443, so every page a phone opens is `https://` — and an origin of
  # `http://<host>:8200` makes the kernel mint image URLs on another scheme AND another port. That is MIXED
  # CONTENT: the browser drops each request with no network error, no console line a casual look finds and
  # nothing in any log. Measured on the bench: the shelf banners, the category icons, the minicart and the
  # whole checkout went blank on the phone while the images that went through the vitrine's door were fine.
  #
  # So the scheme is PROBED rather than configured. A box behind a TLS edge answers `/health` on 443; one
  # served plainly does not, and falls back to the port it really listens on. Deriving beats asking: a second
  # variable would be a second thing to get wrong, and it would be wrong exactly on the box nobody re-reads.
  #
  # ★ THE PROBE IS NOW THE FALLBACK, NOT THE ANSWER (pk6·D2). `tailscale serve` states the scheme AND the
  # port, so when it answers there is nothing left to guess; the probe only runs when the table is empty. It
  # is kept because it is the one thing that still works on a box behind some OTHER TLS edge.
  probe_origin() { # <host> — echo the origin a browser will actually use
    if curl -fsS -o /dev/null --max-time 6 "https://$1/health" 2>/dev/null; then
      echo "https://$1"
    else
      echo "http://$1:${FORGE_HTTP_PORT:-8200}"
    fi
  }

  # ── ★ THE ADMIN DOORS, ONE LINE PER TENANT, DERIVED ONCE ────────────────────────────────────────────────
  # "<tenant> <internal-port> <published-scheme|-> <published-port|->". The dashes keep the field positions
  # when nothing is published, so `read` below never has to guess which column it is looking at.
  admin_doors=''
  for t in $TENANTS; do
    lport="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.admin_host // empty' "$BOX" | sed -n 's/.*:\([0-9][0-9]*\)$/\1/p')"
    [ -n "$lport" ] || { note "⚠️ $t has no port in its admin_host — skipping its door"; continue; }
    admin_doors="$admin_doors$t $lport $(serve_field "$serve_table" "$lport" 1 | grep . || echo -) $(serve_field "$serve_table" "$lport" 2 | grep . || echo -)
"
  done

  if [ "$MODE" = tailnet ]; then
    if [ -n "$store_port" ]; then
      origin="$(origin_for "$FORGE_TAILNET_HOST" "$store_scheme" "$store_port" "$hport")"
      note "the vitrine is published as $origin (images follow the page's scheme)"
    else
      origin="$(probe_origin "$FORGE_TAILNET_HOST")"
      note "nothing publishes :$hport — probed instead, and the origin is $origin"
    fi
    # ★ THE GATE'S LINK TO THE ADMIN IS THE FIRST TENANT'S DOOR, spelled the way a browser opens it.
    gate_admin=''
    sib_overrides='{}'
    while read -r t lport sch prt; do
      [ -n "${t:-}" ] || continue
      [ "$sch" = '-' ] && sch=''
      [ "$prt" = '-' ] && prt=''
      door="$(origin_for "$FORGE_TAILNET_HOST" "$sch" "$prt" "$lport")"
      sib_overrides="$(printf '%s' "$sib_overrides" | jq -c --arg t "$t" --arg u "$door" '. + {($t): $u}')"
      [ -n "$gate_admin" ] || gate_admin="$door"
    done <<EOF
$admin_doors
EOF
    sib_host="$FORGE_TAILNET_HOST"
  else
    origin="http://localhost:${FORGE_HTTP_PORT:-8200}"
    gate_admin=''
    sib_host=''
    sib_overrides='{}'
  fi
  # ── the admin front doors, claimed THROUGH THE PORT ─────────────────────────────────────────────────────
  # `read.admin.by_host` keys on `host:port`, so each tenant's admin needs its own claim for each spelling of
  # the machine. `admin-host.js` drives the two platform commands `provision-ref` drives — it is not a second
  # write path, and it prints identifiers only.
  #
  # ⚠️ THE PORT CLAIMED IS THE PUBLISHED ONE, AND THE SUPERSEDED SPELLING IS RELEASED IN THE SAME PASS. Both
  # halves matter and the second is the less obvious: a box promoted by the OLD script holds `<tailnet>:8201`,
  # an address that opens the login page and then cannot keep the session — the silent failure this slice
  # exists for. A stale front door is worse than no front door, so `--tailnet` removes every spelling it is
  # not claiming, and `--localhost` removes them all.
  #
  # ★★ AND WHAT IS RECORDED HERE IS WHAT THE DIRECTORY ACCEPTED — the block below prints from this list and
  # from nothing else. Two defects of the birth of 03/09 (F2 and F7) are one defect of FORM: everything that
  # SPOKE at the end of this promotion re-read `seed/box.json`, so the screen described what the box was
  # ASKED to become instead of what it became. Measured on the bench, with the box torn down five minutes
  # earlier: `0 claim(s) set`, both admin doors announced by tenant name, `edge → 200`, exit 0. The names came
  # from the file; the directory held nothing. Then, with the box up but the loop reaching one tenant of two:
  # `1 claim(s) set` — an honest count nobody compared with the two it expected — and both doors printed
  # again, the second of which answers `unknown_admin_host` to the operator who types it.
  claimed=0
  expected=0
  released=0
  # "<tenant> <origin>", one line per door the directory really took, for the hostname a human types.
  claimed_doors=''
  # "<tenant> <authority>", one line per claim that did NOT take. Silence about these is what F7 was.
  refused_doors=''
  # ⚠️ THE COUNT MEANS SOMETHING ONLY IF IT COUNTS REMOVALS. `admin-host.js remove` on a hostname nobody
  # claimed is not an error — it prints `<host>\tabsent` and exits 0 — so counting the EXIT STATUS would
  # report "4 released" on a virgin box that had nothing to release, which is the shape of a green that
  # proves nothing. The verb on stdout is the real answer.
  release_door() { # <host:port> — true only when a claim was actually there
    case "$(dc run --rm kernel node dist/admin-host.js remove "$1" 2>/dev/null | tr -d '\r' | tail -1)" in
      *removed) return 0 ;;
      *) return 1 ;;
    esac
  }
  while read -r t lport sch prt; do
    [ -n "${t:-}" ] || continue
    [ "$sch" = '-' ] && sch=''
    [ "$prt" = '-' ] && prt=''
    for h in $net_hosts; do
      keep="$(authority_for "$h" "$sch" "$prt" "$lport")"
      doors="$keep"
      [ "$keep" = "$h:$lport" ] || doors="$doors $h:$lport"
      if [ "$MODE" = tailnet ]; then
        expected=$((expected + 1))
        if dc run --rm kernel node dist/admin-host.js set "$keep" "$t" >/dev/null 2>&1; then
          claimed=$((claimed + 1))
          # Only the hostname is printed below: the tailnet IP is the same door by another name, and a
          # second line for it would read as a second admin.
          if [ "$h" = "$FORGE_TAILNET_HOST" ]; then
            claimed_doors="$claimed_doors$t $(origin_for "$h" "$sch" "$prt" "$lport")
"
          fi
        else
          refused_doors="$refused_doors$t $keep
"
        fi
        for a in $doors; do
          [ "$a" = "$keep" ] && continue
          release_door "$a" && released=$((released + 1))
        done
      else
        for a in $doors; do
          release_door "$a" && released=$((released + 1))
        done
      fi
    done
  done <<EOF
$admin_doors
EOF
  if [ "$MODE" = tailnet ]; then
    # ⚠️ "OF $expected" IS THE WHOLE REPAIR OF THE COUNT. `1 claim(s) set` and `2 claim(s) set` read the same
    # to a human scrolling past; a number is only gradeable next to the number it was supposed to be.
    note "admin directory · $claimed of $expected claim(s) set · $released released"
  else
    note "admin directory · $claimed claim(s) set · $released released"
  fi

  # ── ★★ ZERO OF N IS A REFUSAL, NOT A SUCCESS (F2) ────────────────────────────────────────────────────────
  # The promotion cannot claim a door for a tenant that does not exist, so "not one of them took" has exactly
  # one common cause: this box was never born. Everything below this line — the doors, the recreate, the
  # health check — would go on describing a box that is not there, and `edge → 200` only proves the KERNEL is
  # up, which it is on a box with no tenants at all. That green is what sent an operator away believing the
  # promotion happened.
  if [ "$MODE" = tailnet ] && [ "$expected" -gt 0 ] && [ "$claimed" -eq 0 ]; then
    die "not one of the $expected admin door(s) could be claimed — this box has not been born yet.
     Run \`bash bin/box-up.sh\` first, then promote it with \`bash bin/box-up.sh --tailnet\`.
     (The tenant names this script knows come from seed/box.json, which is what the box is MEANT to hold.
     The admin directory is what it really holds, and it holds none of them — so nothing was printed.
     Nothing was WRITTEN either: this box's .env is exactly as it was before this command.)"
  fi

  # ── the four values a front reads at BOOT, written now that the claims have answered ─────────────────────
  # ⚠️ THEY ARE THE LAST WRITE OF THE PROMOTION AND THAT ORDER IS DELIBERATE (see the map above): everything
  # before this line is a read or a claim, so the refusal a few lines up is atomic.
  put_env FORGE_STORE_HOSTS "$store_hosts_value"
  put_env FORGE_PUBLIC_ORIGIN "$origin"
  put_env FORGE_GATE_ADMIN_URL "$gate_admin"
  put_env FORGE_ADMIN_SIBLINGS "'$(admin_siblings_json "$sib_host" "$sib_overrides")'"
  note "host → store map rebuilt · $store_hosts_count hostname(s)"
  note 'FORGE_PUBLIC_ORIGIN · FORGE_GATE_ADMIN_URL · FORGE_ADMIN_SIBLINGS rewritten'

  # ── ★ THE DOORS, PRINTED — because the port an operator has to type CHANGED ──────────────────────────────
  # The promotion already prints `$origin` a few lines down, so this adds no class of value to a scrollback
  # that the block below does not. What it adds is the one fact nobody can derive by looking: after this
  # change the admin is NOT on `:${FORGE_ADMIN_HTTP_PORT:-8201}` over the tailnet, it is wherever `tailscale
  # serve` publishes it — and an operator who types yesterday's address gets a login page that refuses.
  #
  # ⛔ AND IT PRINTS `$claimed_doors`, NOT `$admin_doors`. It used to re-read the same here-doc the claim loop
  # read, from the start — so it listed every door `seed/box.json` DECLARES whatever the directory answered.
  # A door in this list is a promise that a browser opening it reaches an admin that will hold a session; the
  # only thing that can make that promise true is the claim having been accepted, so the claim is what speaks.
  promotion_status=0
  if [ "$MODE" = tailnet ]; then
    say 'the doors, as a browser opens them'
    note "vitrine   $origin"
    while read -r t door; do
      [ -n "${t:-}" ] || continue
      note "admin     $door   ($t)"
    done <<EOF
$claimed_doors
EOF
    tsch="$(serve_field "$serve_table" "${FORGE_TOTEM_HTTP_PORT:-8203}" 1)"
    tprt="$(serve_field "$serve_table" "${FORGE_TOTEM_HTTP_PORT:-8203}" 2)"
    note "totem     $(origin_for "$FORGE_TAILNET_HOST" "$tsch" "$tprt" "${FORGE_TOTEM_HTTP_PORT:-8203}")"

    # ── ★★ AND WHAT IS MISSING FROM THAT LIST IS SAID OUT LOUD (F7) ───────────────────────────────────────
    # A tenant simply absent from the block above is not a message: nobody counts admins in a terminal. The
    # refused doors get their own heading and their own names, and the run does not exit 0 — a promotion that
    # left one brand's admin unreachable is not a promotion that worked, and every wrapper reads the status
    # before it reads the prose.
    if [ -n "$refused_doors" ]; then
      promotion_status=1
      say "⚠️ INCOMPLETE — $claimed of $expected admin door(s) claimed"
      while read -r t door; do
        [ -n "${t:-}" ] || continue
        note "REFUSED   $door   ($t) — its admin will answer \`unknown_admin_host\` to a login"
      done <<EOF
$refused_doors
EOF
      note 'Re-run the promotion once the box is whole; `bash bin/box-up.sh` is idempotent.'
    fi
  fi

  # ── the containers that read all of the above at BOOT ───────────────────────────────────────────────────
  # Every variable touched here is read once, at process start. Without the recreate the files are right and
  # the running box is not — which reads exactly like the change having done nothing.
  say 'recreating the services that read the environment'
  dc up -d --force-recreate kernel caddy admin storefront checkout storefront-coffee totem >/dev/null 2>&1 \
    || note '⚠️ some service did not come back — `docker compose ps`'
  for i in $(seq 1 30); do
    code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$origin/health" || true)"
    [ "$code" = 200 ] && break
    sleep 2
  done
  [ "${code:-}" = 200 ] || die "the kernel never answered $origin/health (last: ${code:-none})."
  note "edge $origin/health → 200"
  # ⚠️ `edge → 200` IS THE LAST GREEN LINE AND IT PROVES THE LEAST — the kernel answers `/health` on a box
  # with no tenant at all. So the run repeats its own verdict here, where the eye lands, and carries it in the
  # STATUS: a promotion that could not claim every door exits 1 even though every other step worked.
  if [ "$promotion_status" -ne 0 ]; then
    printf '\n[box-up] the promotion is INCOMPLETE: %s of %s admin door(s) claimed. See the REFUSED line(s) above.\n' \
      "$claimed" "$expected" >&2
  fi
  printf '\n' >&2
  exit "$promotion_status"
fi

# ── 0c · ★★ THE DATASET THIS BOX WOULD SEED FROM IS THE ONE ITS IMAGES WERE BUILT WITH (pk7·D2) ────────────
#
# ⛔ MEASURED ON THE BIRTH OF 2026-09-03. `.env` pointed at `…/wt-v03/t-forno/instances/demo/dataset`, a
# worktree 166 COMMITS BEHIND the tree the four images were baked from. The box came up GREEN and the admin's
# stock panel was born empty — the idle shelf existed in the code, in the image and in the tests, and did NOT
# exist in the data the box read. It was not one panel: 2 790 products, the categories and the brands all came
# from yesterday's checkout, and BOXUP was 0.
#
# ⚠️ EVERY OTHER INPUT OF THIS BOX IS PINNED. Four images by digest, and `bin/images-from-lock.sh` refuses
# even a tag. The dataset is the one that is not — deliberately: baking one instance's catalogue into the
# kernel image is the defect the platform's own `instance-content.guard.test.ts` exists to forbid. So it is
# RECORDED in `forge.lock` at bake time and CHECKED here, and a host path in a `.env` finally ages loudly.
#
# ★ HERE, and not at step 9. The answer costs milliseconds; being wrong costs the ~74 minutes step 9 spends
# filling a whole store with the wrong catalogue. It is also AFTER the promotion block above on purpose —
# `--tailnet` does not seed anything, and a promotion that refuses over the seed's input would be nonsense.
say '0c · the dataset (is it the one these images were built with?)'
provenance="$(host_node "$HERE/bin/dataset-provenance.mjs" "$HERE/forge.lock" 2>&1)"
provenance_rc=$?
if [ "$provenance_rc" -eq 0 ]; then
  while IFS= read -r line; do note "$line"; done <<EOF
$provenance
EOF
else
  printf '%s\n' "$provenance" >&2
  die 'refusing to seed. Both stamps are named above — one of them is the tree you meant.'
fi

# ── 1 · the data tier ───────────────────────────────────────────────────────────────────────────────────────
say '1 · postgres + redis'
dc up -d postgres redis >/dev/null 2>&1 || die 'could not start postgres/redis.'
note 'up'

# ── 2 · migrate ─────────────────────────────────────────────────────────────────────────────────────────────
say '2 · migrate'
dc run --rm kernel node dist/migrate.js 2>&1 | grep -E '^\[migrate\]' >&2 || die 'migrate failed.'

# ── 3 · provision-ref, once per tenant ──────────────────────────────────────────────────────────────────────
say '3 · provision-ref (once per tenant)'
for t in $TENANTS; do
  handle="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' "$BOX")"
  name="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.name' "$BOX")"
  ahost="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.admin_host // empty' "$BOX")"
  [ -n "$handle" ] || die "seed/box.json declares no bootstrap store for tenant \"$t\"."

  out="$(mktemp)"; err="$(mktemp)"
  dc run --rm \
    -e "FORGE_REF_TENANT=$t" -e "FORGE_REF_STORE_HANDLE=$handle" -e "FORGE_REF_STORE_NAME=$name" \
    ${ahost:+-e "FORGE_ADMIN_HOST=$ahost"} \
    kernel node dist/provision-ref.js > "$out" 2> "$err"

  # The two secrets ride out on stderr, each on the line after its label. Read them here and nowhere else.
  op="$(sed -n '/operator token/{n;s/^[[:space:]]*//;p;q;}' "$err")"
  drv="$(sed -n '/login-driver token/{n;s/^[[:space:]]*//;p;q;}' "$err")"
  store="$(tail -1 "$out" | tr -d '\r\n')"
  if [ -z "$store" ]; then
    # The run produced no store id, so something refused. Print the reason BEFORE shredding: a provisioning
    # failure that leaves only "store = ?" is the shape that sends somebody reading the wrong file.
    note "⚠️ provision-ref produced no store id for \"$t\" — its output follows:"
    sed 's/^/     /' "$err" >&2
    shred -u "$out" "$err" 2>/dev/null || rm -f "$out" "$err"
    die "provisioning \"$t\" failed."
  fi
  put_secret "$(secret_name_for "$t" seed)" "$op"   && s1=filed || s1='ABSENT'
  put_secret "$(secret_name_for "$t" driver)" "$drv" && s2=filed || s2='ABSENT'
  note "$t · store $handle = ${store:-?} · $(secret_name_for "$t" seed): $s1 · $(secret_name_for "$t" driver): $s2"
  # The ROOT store: the first tenant's bootstrap store. See the host-map block after this loop.
  [ "$t" = "$(echo "$TENANTS" | head -1)" ] && ROOT_STORE="$store"
  # The café's store id — the coffee fork's edge rule is generated from it below (3c).
  [ "$t" = "$(echo "$TENANTS" | tail -1)" ] && CAFE_STORE="$store"
  grep -E 'retired|hostname claimed' "$err" | sed 's/^[[:space:]]*/   /' >&2
  shred -u "$out" "$err" 2>/dev/null || rm -f "$out" "$err"
done

# ── 3b · THE HOST → STORE MAP, and it is why `http://localhost:<port>/` is a shop and not a 404 ─────────────
#
# ★ THE FIRST CLICK. The edge sends `/` to the VANILLA storefront, and that front asks the kernel which store
# this hostname is. With no map the answer is nothing and the root answers 404 — reported on the old bench
# ("localhost:8080 gives a 404, it should go to the main shop") and reproduced here the moment the ports
# moved, because the map had been written for the OLD ports and OLD store ids.
#
# ⚠️ SO IT IS DERIVED, NEVER COPIED. The ids are fresh ULIDs on every birth; a map carried over from another
# box points at stores that do not exist. It is built HERE, from the id `provision-ref` just returned, and
# BEFORE step 5 — the fronts read it at boot, so writing it later would need a restart.
#
# ★★ WHICH STORE THE ROOT SERVES, AND WHY IT IS THE SHOE SHOP. With two tenants this is a real question, and
# the answer comes from what the edge does rather than from the demo's story:
#   · `/` is served by the VANILLA storefront container, and the shoe shop is the one store with NO fork — it
#     IS the reference storefront's store. Putting the café here would serve it through the wrong front, and
#     that fork exists precisely to present it differently.
#   · the café already has a door (`/s/cafe` → the coffee fork) and the counter has the totem on its own
#     port. The shoe shop is the ONLY store with no other way in, so it is the one that loses an address.
#   · the counter could never be the root: it is a device's store, not a browser's.
say '3b · the host → store map (the root of the shop)'
if [ -n "${ROOT_STORE:-}" ]; then
  # Every spelling a browser on this machine (or on the tailnet) might use, with and without the port. A host
  # key is matched EXACTLY, so `localhost` and `localhost:8200` are two entries and both are needed.
  hosts="localhost 127.0.0.1 $(hostname 2>/dev/null)"
  [ -n "${FORGE_TAILNET_HOST:-}" ] && hosts="$hosts $FORGE_TAILNET_HOST"
  map=''
  for h in $hosts; do
    [ -n "$h" ] || continue
    map="$map\"$h\":\"$ROOT_STORE\",\"$h:${FORGE_HTTP_PORT:-8200}\":\"$ROOT_STORE\","
  done
  # ⚠️ SINGLE-QUOTED, AND THE QUOTES ARE THE WHOLE FIX. `.env` is read by TWO parsers: compose's own, and
  # bash, because this script sources the file to get its host-side values. Written bare, bash's `source`
  # eats the JSON's double quotes — `{"a":"b"}` arrives as `{a:b}` — and that mangled value is exported, so
  # it WINS over the correct one compose would have read. Measured: the file was right and the container had
  # `{localhost:sto_…}`. Single quotes survive both: bash keeps the inner double quotes, compose strips the
  # outer pair and keeps the content literal.
  map="'{${map%,}}'"
  if grep -q '^FORGE_STORE_HOSTS=' "$HERE/.env"; then
    python3 - "$HERE/.env" "$map" <<'PYEOF'
import sys
p, m = sys.argv[1], sys.argv[2]
out = []
for line in open(p, encoding='utf-8'):
    out.append(f'FORGE_STORE_HOSTS={m}\n' if line.startswith('FORGE_STORE_HOSTS=') else line)
open(p, 'w', encoding='utf-8').write(''.join(out))
PYEOF
  else
    printf 'FORGE_STORE_HOSTS=%s\n' "$map" >> "$HERE/.env"
  fi
  note "root → $ROOT_STORE ($(echo "$hosts" | wc -w) hostname(s), with and without :${FORGE_HTTP_PORT:-8200})"
else
  note '⚠️ no root store id — the shop root will answer 404'
fi

# ── 3c · THE COFFEE FORK'S EDGE RULE, generated from the id that was just provisioned ───────────────────────
#
# ⚠️ THIS FILE USED TO CARRY A STORE ID WRITTEN BY HAND, from a bench that no longer exists. On a new box the
# ULIDs are different, the rule matches nothing, and every request for the café falls through to the VANILLA
# storefront — which resolves the store and paints it with the café's theme, so the page looks right and the
# fork is not serving it. That is the failure this generation exists to prevent, and it fooled two of us:
# `data-forge-theme="coffee-store"` proves the THEME, never WHO SERVED.
#
# Same technique as FORGE_TOTEM_STORE_ID, second consumer: resolve the id, generate the wiring.
#
# ★ AND EVERY ROUTE STAMPS WHO IT PROXIED TO (`X-Forge-Served-By`), because without a distinctive marker this
# is not provable at all — by anyone, today or in a year. The header is set by the ROUTE, so it answers
# exactly the question that matters here: which front did the edge choose.
say '3c · the coffee fork edge rule'
if [ -n "${CAFE_STORE:-}" ]; then
  cat > "$HERE/caddy/extra/coffee.local.caddy" <<CADDY
# GENERATED by bin/box-up.sh (step 3c) — do not edit; the store id is a fresh ULID on every birth.
# The café's storefront is a FORK of its own, in its own container. Its checkout and account stay with the
# shared checkout app, exactly as the vanilla store's do.
handle /s/${CAFE_STORE}/checkout* {
	header X-Forge-Served-By "checkout"
	reverse_proxy checkout:3000
}
handle /s/${CAFE_STORE}/account* {
	header X-Forge-Served-By "checkout"
	reverse_proxy checkout:3000
}
handle /s/cafe/checkout* {
	header X-Forge-Served-By "checkout"
	reverse_proxy checkout:3000
}
handle /s/cafe/account* {
	header X-Forge-Served-By "checkout"
	reverse_proxy checkout:3000
}
handle /s/${CAFE_STORE}* {
	header X-Forge-Served-By "storefront-coffee"
	reverse_proxy storefront-coffee:3000
}
handle /s/cafe* {
	header X-Forge-Served-By "storefront-coffee"
	reverse_proxy storefront-coffee:3000
}
handle_path /_coffee/* {
	header X-Forge-Served-By "storefront-coffee"
	reverse_proxy storefront-coffee:3000
}
CADDY
  note "coffee fork → /s/$CAFE_STORE (rule generated, routes stamped X-Forge-Served-By)"
else
  note '⚠️ no café store id — the coffee fork will not receive its store'
fi

# ── 3d · THE ADMIN'S SIBLING SWITCHER (A44) ─────────────────────────────────────────────────────────────────
#
# ★ IT IS WRITTEN AT BIRTH BECAUSE IT DIES AT BIRTH. `FORGE_ADMIN_SIBLINGS` is the dropdown that carries an
# operator from one brand's admin to the other's, and it is ENV — so it was hand-typed on the bench and every
# rebirth erased it. The switcher then simply did not appear, and an absent switcher is indistinguishable
# from a box that never had the feature (`siblings.ts` guarantees exactly that, on purpose).
#
# BEFORE STEP 5, and that is forced: the admin reads this at boot, so a value written after `dc up -d admin`
# is a value the running container does not have.
#
# ⚠️ THE BENCH'S OWN VALUE IS `localhost`, WHICH IS NOT USELESS. A44 says the two doors are needed "when it
# goes up"; born pointing at `localhost:8201` / `:8202` the switcher works on this laptop AND it is provably
# there — an env that is only ever correct on a machine nobody has yet is an env nobody notices is broken.
# `--tailnet` rewrites the same two entries against the tailnet name.
# ── 3c-bis · THE PURGE SECRET, MINTED RATHER THAN REMEMBERED ────────────────────────────────────────────────
#
# ⚠️ WHAT AN EMPTY ONE COSTS, MEASURED ON THE BENCH OF 2026-09-02. `FORGE_REVALIDATE_SECRET` was the empty
# string in the kernel, the admin and the vitrine while `FORGE_STOREFRONT_URL` named a vitrine, so the kernel
# logged `storefront cache invalidation OFF` at boot and every purge was silently refused. The effect reached
# the operator as a defect with a different shape: unpublishing a product left it selling for the whole TTL,
# and the QA probe that found it polled for 157 s inside a 300 s window and concluded the unpublish event was
# broken. It was not. Nothing was broken; nothing was configured.
#
# ★ AND THE SAME COMMENT EXISTS UPSTREAM, dated: `storefront-purge.ts` records the secret "measured empty on
# Staging for a full day, with every bust silently refused". A hole that is written down and not closed is a
# hole that gets rediscovered by whoever is unlucky, so this box stops depending on somebody remembering.
#
# Minted here, not asked for: the value is meaningless to a human (it only has to match between the kernel
# that purges and the front that accepts), it never leaves this machine, and `.env` is gitignored. A box that
# already carries one keeps it — rotating it would only invalidate nothing.
if ! grep -q '^FORGE_REVALIDATE_SECRET=.\+' "$HERE/.env" 2>/dev/null; then
  put_env FORGE_REVALIDATE_SECRET "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  note 'purge secret minted (the kernel can now bust the vitrine instead of waiting out the TTL)'
else
  note 'purge secret already present'
fi

say '3d · the admin sibling switcher'
if siblings="$(admin_siblings_json)" && [ -n "$siblings" ] && [ "$siblings" != '[]' ]; then
  put_env FORGE_ADMIN_SIBLINGS "'$siblings'"
  note "$(echo "$TENANTS" | wc -w) admin door(s), from seed/box.json"
else
  note '⚠️ seed/box.json yielded no sibling list — the admin shell renders without the switcher'
fi

# ── 4 · the box's own platform credential ───────────────────────────────────────────────────────────────────
say '4 · admin-platform-token (the box credential that serves every tenant)'
out="$(mktemp)"
dc run --rm kernel node dist/admin-platform-token.js > "$out" 2>/dev/null
tok="$(grep -oE '^fo[a-z]{2}_[A-Za-z0-9_-]+' "$out" | tail -1)"
put_secret forge-admin-platform-token "$tok" && note 'forge-admin-platform-token: filed' \
  || note '⚠️ forge-admin-platform-token: ABSENT — host mode will answer not_configured on every login'
shred -u "$out" 2>/dev/null || rm -f "$out"

# ── 5 · the rest of the tier ────────────────────────────────────────────────────────────────────────────────
say '5 · kernel + edge + fronts'
# RE-read here, after steps 3 and 4 wrote to `.secrets`: the tokens they minted have to reach the containers
# this step starts, and the copy loaded at step 0 predates them.
# shellcheck disable=SC1091
set -a; . "$HERE/env-source.sh" >/dev/null 2>&1; [ -f "$HERE/.env" ] && . "$HERE/.env"; . "$HERE/bin/images-from-lock.sh" >/dev/null 2>&1; set +a
dc up -d kernel caddy admin storefront checkout storefront-coffee >/dev/null 2>&1 || die 'could not start the tier.'
for i in $(seq 1 30); do
  code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}/health" || true)"
  [ "$code" = 200 ] && break
  sleep 2
done
[ "${code:-}" = 200 ] || die "the kernel never answered /health (last: ${code:-none}). \`docker compose logs kernel\`."
note "edge ${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}/health → 200"

# ── 6 · the terrain, once per tenant ────────────────────────────────────────────────────────────────────────
say '6 · seed-box (stores + settings, plus apps and freight for a non-dataset tenant, once per tenant)'
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"   # forge-seed-token → FORGE_SEED_TOKEN
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no \$$tokvar in the environment — step 3 filed it into .secrets; re-source env-source.sh."
  FORGE_SEED_TOKEN="$tokval" host_node "$HERE/bin/seed-box.mjs" --tenant "$t" || die "seed-box failed for $t."
done

# The counter's store id is only knowable now, and `compose.override.yml` refuses to interpolate without it.
balcao="$(jq -r '.tenants[]|.stores[]|select(.handle=="balcao")|.handle' "$BOX")"
if [ -n "$balcao" ]; then
  cafe_tok="$(secret_name_for "$(echo "$TENANTS" | tail -1)" seed | tr 'a-z-' 'A-Z_')"
  eval "cafe_tokval=\${$cafe_tok:-}"
  id="$(curl -s -m 10 "${FORGE_PUBLIC_ORIGIN}/v1/read/internal/stores" \
        -H "authorization: Bearer $cafe_tokval" -H "x-forge-tenant: $(echo "$TENANTS" | tail -1)" \
        | jq -r '.[]|select(.handle=="balcao")|.id' 2>/dev/null)"
  if [ -n "$id" ] && [ "$id" != null ]; then
    if grep -q '^FORGE_TOTEM_STORE_ID=' "$HERE/.env"; then
      sed -i "s|^FORGE_TOTEM_STORE_ID=.*|FORGE_TOTEM_STORE_ID=$id|" "$HERE/.env"
    else
      printf 'FORGE_TOTEM_STORE_ID=%s\n' "$id" >> "$HERE/.env"
    fi
    note "FORGE_TOTEM_STORE_ID → $id (written into .env)"
  fi
fi

# ── 7 · THE COUNTER'S TOTEM — and it could not have started at step 5 ───────────────────────────────────────
#
# ★ THE ORDER IS FORCED, not chosen. `compose.override.yml` declares
# `FORGE_TOTEM_STORE_ID: ${FORGE_TOTEM_STORE_ID:?…}` — a hard requirement, and the counter store does not
# exist until step 6 creates it. On a virgin box the id is a fresh ULID, so it cannot be written down
# anywhere in advance: step 6 RESOLVES it by reading the tenant's stores for the `balcao` handle and writes
# it into `.env`, and only then is there something for this service to start with. Starting it beside the
# other fronts is what left the first build of this box with four of the instance's six images.
say '7 · the totem (needs the counter store id that step 6 just resolved)'
set -a; [ -f "$HERE/.env" ] && . "$HERE/.env"; set +a
# ★★ 04/09 — THIS STEP RECORDS WHAT HAPPENED, because the bench block below used to print the totem's
# address unconditionally. A birth where the totem never started still ended with `totem http://…:8203` in
# the summary and exit 0, with the ⚠️ four hundred lines above where nobody scrolls. It is the same shape as
# the promotion that announced two admin doors having claimed one: the summary derived from what was ASKED
# FOR (the port variable) instead of from what was DONE.
TOTEM_UP=''
TOTEM_WHY=''
if [ -n "${FORGE_TOTEM_STORE_ID:-}" ] && [ "${FORGE_TOTEM_STORE_ID}" != 'sto_PENDING_SEED' ]; then
  if dc up -d totem >/dev/null 2>&1; then
    TOTEM_UP=1
    note "totem up · store ${FORGE_TOTEM_STORE_ID}"
  else
    TOTEM_WHY='it did not start — `docker compose logs totem`'
    note "⚠️ the totem did not start — \`docker compose logs totem\`"
  fi
else
  TOTEM_WHY='step 6 resolved no counter store id'
  note '⚠️ no counter store id — skipping the totem (step 6 should have resolved it)'
fi

# ── 8 · THE CURATED DATA — and it must precede the massive one-shot ─────────────────────────────────────────
#
# ★ THE ORDER IS FORCED, NOT CHOSEN — the same trap as the totem, so it is written the same way. The wave's
# boundary is CURATED × MASSIVE: `bin/seed.mjs` owns what a HUMAN wrote (the six coffees, the counter's menu,
# the outlet's eight) and the dataset owns the generated volume AND THE ASSORTMENT. An assortment PUBLISHES a
# handle it did not define — so if the curated products are not there yet, the publish step has nothing to
# point at and refuses BY NAME:
#
#   populate refused (unknown_product): store "cafe" declares product "forge-alvorada" in its assortment,
#   and no such product exists — neither in this dataset nor in this tenant.
#
# That refusal is the guard SPEC §3.3 promised, and it is what caught this step missing. Anyone who moves the
# curated seed after the one-shot, or merges the two "because both fill data", brings that red straight back.
#
# BOTH TENANTS, EACH WITH ITS OWN TOKEN. The shoe tenant passed WITHOUT this once, by an accident of shape —
# its assortment selects by category regex rather than by handle — but the outlet's eight products are
# curated and belong here, so running it only where the red appeared would leave that store quietly different
# from what the demo expects.
say '8 · the curated data (once per tenant)'
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no \$$tokvar in the environment for the curated seed."
  # ⚠️ THE DATASET PATH IS REMAPPED HERE, AND IT IS NOT A DETAIL. `FORGE_SEED_DATASET_DIR` is the CONTAINER's
  # path (`/app/seed-dataset`) because the kernel is what reads it — but THIS script runs on the HOST, where
  # that path does not exist. Handing it through unchanged is how the curated seed died with
  # `FORGE_SEED_DATASET_DIR=/app/seed-dataset does not exist`: one variable name serving two filesystems.
  # The host's copy of the same directory is `FORGE_SEED_DATASET_HOST_DIR`, and that is what a host process
  # must be given.
  FORGE_SEED_TOKEN="$tokval" host_node "$HERE/bin/seed.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN" \
    || die "the curated seed failed for \"$t\". Its own output is above; nothing further has run."
done

# ── 9 · the catalogue, once per tenant ──────────────────────────────────────────────────────────────────────
say '9 · seed-demo (the catalogue, once per DATASET tenant)'
# ⛔ `$DATASET_TENANTS`, NEVER `$TENANTS` — the derivation above carries the measurement. A tenant the mounted
# dataset is not about is NAMED here rather than silently skipped, because "the coffee shop has 23 products"
# and "the coffee shop was forgotten" look identical in a log that says nothing.
for t in $TENANTS; do
  case " $DATASET_TENANTS " in
    *" $t "*) ;;
    *) note "\"$t\" does not carry this box's example dataset (seed/box.json: dataset != true) — the massive
     catalogue is NOT its own and is not filled here. What it needed from this step it already has: its apps,
     its freight and its checkout flag were applied at step 6 from seed/box.json."
       continue ;;
  esac
  handle="$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.stores[]|select(.bootstrap)|.handle' "$BOX")"
  # FORGE_SEED_DEMO=1 is the entrypoint's own opt-in: the in-process runner bypasses the type-to-confirm, so it
  # demands an explicit one. POPULATE-only; the destructive `wipe` is not on this path.
  # ★★ THE ACTION CEILING IS LIFTED HERE AND NOWHERE ELSE — on THIS invocation, never on the kernel service.
  #
  # `DEFAULT_ACTION_TIMEOUT_MS` is 300_000 (5 minutes) and it is a LIVENESS guard for whoever CALLS: it exists
  # so an operator who fires an action is not left with a spinner forever. A bulk import one-shot is not an
  # interactive action — nobody is watching a screen, and the process exists in order to finish. So the
  # ceiling is raised for THIS RUN and the standing kernel keeps its default.
  #
  # THE NUMBER IS DERIVED, NOT GUESSED. Measured on the run that failed: 1,287 products written in 300s, so
  # 2,790 need ~650s. 1,800,000 (30 min) is nearly 3x that — head-room because the FIRST run also hydrates
  # media, and because a ceiling you have to revisit in a fortnight is not a ceiling.
  #
  # ⚠️ AND WHY THE ANSWER IS NOT TO LET IT BLOW. The timeout does NOT cancel the action (`timeout.ts` says so
  # in its own words: the caller stops waiting, the writer does not stop), and this entrypoint's `finally`
  # then closes the pool underneath that abandoned writer. What comes out is a HALF-WRITTEN catalogue and an
  # error naming the POOL instead of the ceiling. There is no one-line repair for an abandoned bulk write.
  dc run --rm -e "FORGE_REF_TENANT=$t" -e "FORGE_REF_STORE_HANDLE=$handle" -e FORGE_SEED_DEMO=1 \
    -e "FORGE_EXTENSION_ACTION_TIMEOUT_MS=${FORGE_SEED_ACTION_TIMEOUT_MS:-1800000}" \
    kernel node dist/seed-demo.js 2>&1 | tail -6 >&2 \
    || note "⚠️ seed-demo failed for \"$t\". The kernel's own words are the six lines above — read those, not this.
     ⛔ I DO NOT KNOW WHETHER RE-RUNNING FIXES IT, and saying so is the honest answer: of the three ways this
     step has failed so far, NONE was repaired by repetition (an action ceiling, a missing step before it, and
     a curated product that did not exist yet). A default of \"just run it again\" is right for the failure
     somebody imagined and wrong for the one that happened.
     What IS known: steps 1-8 completed, so the box and its curated data are standing; only this fill did not."
done

# ── 10 · THE PAST — and it is TWO halves, because the refusal is about an INSTANT, not about the box ─────────
#
# ★ WHY THIS STEP EXISTS. Without it the box has 39 orders per tenant and every one of them is stamped TODAY:
# all the statuses of the lifecycle, one single day. The admin dashboard then draws a spike on one date and
# calls it a business. `seed-history` travels the clock (`deps.clock.travel`) and spreads a real past —
# 180 days ending today — which is the whole point of §9 of the spec.
#
# ★★ THE REFUSAL, AND WHY WE MOVE THE INSTANT INSTEAD OF THE BOX. `seed-history` stops dead when a tenant has
# more than one ACTIVE delivery method:
#
#     history: this tenant has 2 active delivery shipping methods ("Entrega Expressa", "Entrega Padrão")
#     and nothing to choose between them by — [it] will not pick one at random. Leave one active.
#
# ⇒ AND IT IS RIGHT. Step 9 had the identical fork — two delivery methods, nothing to choose by — and chose
# SILENTLY with `order by id limit 1`. In `forgecafe` the oldest id belonged to "Retirar no balcão", born in
# the totem wave, so the seeder picked PICKUP, wrote a delivery address, never set a pickup location, and the
# kernel refused the order. Same data, same junction, two opposite behaviours: one guessed and was wrong for
# a whole afternoon, one stops and names the ambiguity. This step is written to keep the second kind.
#
# So we do NOT satisfy the seeder by impoverishing the box. Two delivery options is something the demo WANTS
# to show; dropping one permanently is the tail wagging the dog. The refusal is about the MOMENT this script
# runs, not about the box's final state — so the moment is what we change: SILENCE the extra method, seed the
# past, RE-ARM it. Exactly the pattern the curated seed already uses for notification channels.
#
# ⚠️ THE RE-ARM IS IN A `finally`, NOT ON THE HAPPY PATH. A box left with one delivery method because this
# step died halfway is a defect nobody would ever connect back to a seed — they would find it weeks later in
# a checkout. The EXIT/INT/TERM trap below restores whatever was silenced no matter how we leave: a `die`, a
# Ctrl-C, or success. `rearm_history` clears its own list, so it is idempotent and the normal path's explicit
# call makes the trap a no-op.
#
# ⚠️ AND IT IS A WORKAROUND, NAMED AS ONE. The durable answer is for the history to SPREAD across the methods
# available — a real past has a mix — which kills the ambiguity by enriching the plan instead of narrowing
# the data. That lives in the monorepo and is not this slice's to write. Recorded so the next reader knows
# this block is a bridge and not a design.
#
# ── PLACEMENT — AND IT IS LOAD-BEARING, WHICH I LEARNED THE EXPENSIVE WAY ────────────────────────────────
#
# ⛔ THIS STEP MUST RUN INSIDE THE SILENCE: after 8, before 11. Not a preference — a mailbox.
#
# `seed/commerce.mjs` silences the buyer's order mail in the CURATED phase (8) and re-arms it in the WINDOW
# (11), and its own comment names this script: *"The one-shots are what create the demo's ORDERS —
# `seed-history` writes dozens of them, dated. So a silencing that ran in the window would run AFTER those
# orders were emitted, and the decision to send is taken at EMIT. Silencing late is silencing nothing."*
# This box speaks real SMTP, and `customers.json` carries one real address among seventeen at example.com.
# A past seeded after the re-arm mails a person, and mail cannot be un-sent.
#
# ★ HOW IT WAS WRONG FIRST, because the reason is worth more than the rule. This step was originally written
# AFTER the window, and the comment here said, honestly: MEASURED that it runs after 10; STATED (by the tech
# lead) that it only needs the catalogue and the logistics. Both halves were true and the placement was still
# wrong, because the fact that decided it was in neither: the mail silence. **Measuring well is not measuring
# the right thing — the measurement proved it WORKS, not that it is SAFE.** The step now sits where it is
# safe, and the guard below is what makes that independent of whoever edits this file next.
say '10 · the past (seed-history — 180 days, once per tenant)'

HISTORY_KEEP="${FORGE_HISTORY_KEEP_METHOD:-Entrega Padrão}"
SILENCED=''; REARM_TENANT=''; REARM_TOKEN=''

# `internal/shipping_methods_admin` is the read face that answers with `active` and `kind`; the box asks the
# kernel rather than the database, so this step works against any box it can reach.
history_methods() { # <tenant> <token>  →  id \t name \t active   (delivery only)
  curl -fsS -m 15 "$FORGE_PUBLIC_ORIGIN/v1/read/internal/shipping_methods_admin" \
    -H "authorization: Bearer $2" -H "x-forge-tenant: $1" \
    | jq -r '.[] | select(.kind=="delivery") | [.id, .name, (.active|tostring)] | @tsv'
}

# ⚠️ THE FIELD IS `method_id`, NOT `id` — measured against the running kernel, which answered
# `validation_failed · method_id (expected string, received undefined)` when asked with `id`.
set_method_active() { # <tenant> <token> <method_id> <true|false>
  curl -fsS -m 15 -X POST "$FORGE_PUBLIC_ORIGIN/v1/commands/shipping.method.update" \
    -H "authorization: Bearer $2" -H "x-forge-tenant: $1" -H 'content-type: application/json' \
    -d "{\"method_id\":\"$3\",\"active\":$4}" >/dev/null
}

rearm_history() {
  local id
  for id in $SILENCED; do
    if set_method_active "$REARM_TENANT" "$REARM_TOKEN" "$id" true; then
      note "re-armed $id in $REARM_TENANT"
    else
      # This is the one failure this step cannot repair for you, so it must be impossible to miss.
      printf '\n[box-up] ⛔ COULD NOT RE-ARM shipping method %s in tenant %s.\n   That tenant is left with fewer delivery methods than it started with. Re-arm it by hand:\n   POST %s/v1/commands/shipping.method.update  {"method_id":"%s","active":true}\n\n' \
        "$id" "$REARM_TENANT" "$FORGE_PUBLIC_ORIGIN" "$id" >&2
    fi
  done
  SILENCED=''
}
trap 'rearm_history' EXIT INT TERM

for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no \$$tokvar in the environment for the history step."
  REARM_TENANT="$t"; REARM_TOKEN="$tokval"

  # ⛔ THE MAILBOX GUARD — this step REFUSES to seed a past into a tenant whose buyer mail is armed.
  #
  # The order above is load-bearing, so it must not depend on the order surviving in this file. If somebody
  # moves this step after the window again, they get a refusal instead of somebody's inbox.
  #
  # ⚠️ AND THE PARAMETER NAME IS `store`, NOT `store_id` — measured, because the kernel IGNORES the wrong one
  # SILENTLY and answers with the tenant's DEFAULTS. A guard asking with `store_id` reads "everything is
  # armed" on a silenced box and refuses forever, and — far worse — would read a default of "enabled" as the
  # truth about a store. It was caught by asking the same question with a deliberately BOGUS store id: the
  # answer came back byte-identical, which is how you learn a filter is not being applied.
  armed="$(curl -fsS -m 15 "$FORGE_PUBLIC_ORIGIN/v1/read/internal/stores" \
             -H "authorization: Bearer $tokval" -H "x-forge-tenant: $t" \
           | jq -r '.[].id' \
           | while read -r sid; do
               curl -fsS -m 15 "$FORGE_PUBLIC_ORIGIN/v1/read/internal/notification_types?store=$sid" \
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
    set_method_active "$t" "$tokval" "$id" false \
      || die "could not silence delivery method \"$name\" ($id) in \"$t\"."
    SILENCED="$SILENCED $id"
    note "silenced \"$name\" for the history run"
  done < <(history_methods "$t" "$tokval")

  # If the method we meant to keep is not there, we have silenced things toward a state nobody chose. Say so
  # and let the trap put them back, rather than seed a past through whatever happens to be left.
  [ "$keep_seen" = 1 ] || die "tenant \"$t\" has no active delivery method named \"$HISTORY_KEEP\" — set
     \$FORGE_HISTORY_KEEP_METHOD to the one the past should sell through. Nothing was seeded; the trap is
     restoring what this step silenced."

  during="$(history_methods "$t" "$tokval" | awk -F'\t' '$3=="true"' | wc -l)"
  note "$t · active delivery methods: $before → $during (seeding the past through \"$HISTORY_KEEP\")"

  # The same ceiling reasoning as step 9: this is a bulk write nobody is watching, not an interactive action.
  #
  # ⚠️⚠️ AND THE OUTPUT IS INSPECTED, NOT JUST ITS EXIT CODE — because THIS step has a green that means nothing
  # happened. `seed-history` is RESET+SEED by nature: if the tenant already holds one order older than half the
  # window (90 of the 180 days), it prints "SKIPPING", writes NOTHING, and exits 0 with `"skipped":true` in its
  # summary. Measured, not assumed: run twice against a tenant left with 7 past orders by a failed run, the
  # second run changed 46 rows to 46 rows and returned success. A step that treated that as done would report
  # a past this box does not have — the exact false green this script was already caught by once, when a health
  # check answered 200 from somebody else's box.
  hlog="$(mktemp)"
  dc run --rm -e "FORGE_EXTENSION_ACTION_TIMEOUT_MS=${FORGE_SEED_ACTION_TIMEOUT_MS:-1800000}" \
    kernel node dist/seed-history.js --tenant "$t" >"$hlog" 2>&1
  hrc=$?
  tail -6 "$hlog" >&2
  if [ "$hrc" != 0 ]; then
    note "⚠️ the past failed for \"$t\" — the kernel's own words are the six lines above. The box and its
     catalogue are standing; only the history did not land. The delivery methods are restored either way."
  elif grep -q '"skipped":true' "$hlog"; then
    note "⛔ THE PAST WAS SKIPPED FOR \"$t\", AND THAT IS NOT A SUCCESS — it exited 0 having written nothing.
     This step is reset+seed: it refuses to add a past to a tenant that already has one. The tenant keeps
     whatever history it had, INCLUDING a partial one left by an earlier failed run. To rebuild it, the
     history's own remedy is the only one it offers: wipe the tenant and run this again."
  fi
  rm -f "$hlog"

  rearm_history
  after="$(history_methods "$t" "$tokval" | awk -F'\t' '$3=="true"' | wc -l)"
  [ "$after" = "$before" ] || note "⚠️ $t ended with $after active delivery methods, not the $before it began with."
done
trap - EXIT INT TERM

# ── 10b · WAIT FOR THE DISPATCHER, BECAUSE THE SILENCE ONLY HOLDS WHILE THE QUEUE IS BEHIND IT ──────────────
#
# ⛔ THE PATTERN silence → seed → re-arm HAS A SCALE LIMIT, and this step is what found it. `seed/commerce.mjs`
# cites a measurement: an order placed while silenced produced no notification even after the channel was
# re-armed and the dispatcher had 70 further seconds. That was true — for DOZENS of orders. This step writes
# ~1,466, and dispatch is ASYNCHRONOUS: on the birth that first ran it, step 11 re-armed while the dispatcher
# was still draining, and the tail went out through the door that had just been opened. 88 messages were
# attempted. They failed only because every address in the dataset is `@example.com` and the provider
# answered `550 Invalid "to" field` — **the fix is this wait, not the luck of an undeliverable domain.**
#
# The assumption "the queue empties before the next step" is not wrong; it stops holding when somebody makes
# the queue big, and the step that made it big is this one. So this one waits for its own consequences.
#
# ★ N IS DERIVED, NOT GUESSED. Measured on that birth: the dispatcher's longest gap between two consecutive
# emissions was 2.1s, and a notification's whole life is 2.1s (`attempts = 1` — a 550 is terminal, there is
# no retry backoff to outlast). 30s is ~14x both. The ceiling is 10 minutes.
#
# ⚠️ AND IT DIES RATHER THAN CONTINUES. A box whose window never ran is mute and one command from fixed;
# a box that mailed a real person cannot be un-mailed. That is the same trade `commerce.mjs` already took.
say '10b · waiting for the dispatcher to drain (the silence only holds while it is behind us)'
QUIET_S=30; DRAIN_CEILING_S=600
notif_total() { # <tenant> <token> [status]
  curl -fsS -m 15 "$FORGE_PUBLIC_ORIGIN/v1/read/internal/notifications?limit=1${3:+&status=$3}" \
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
     window re-arms the buyer's mail and this queue would drain through it. The box and its past are standing."
  sleep 5
done
note "queue quiet for ${QUIET_S}s —$last_fingerprint · safe for the window to re-arm"

# ── 11 · THE SHOP WINDOW — AFTER the one-shot, and the order is what broke to reveal itself ────────────────
#
# ★ THE CIRCLE, AND THE SENTENCE THAT DISARMS IT. The window seeds the dataset's CURATED PROMOTIONS, and it
# resolves each target through the PUBLIC read on purpose — that is the only read that answers "is this on
# sale in THIS store?", and a promotion on something nobody can buy never fires. Those targets are products
# of the MASSIVE catalogue. So the window needs step 9, while step 9 needs step 8's curated handles to
# publish the counter's assortment. Run as one, that is a circle.
#
# It is not a circle in three moments, and it never was a new one: until the sports catalogue retired from
# the curated seed, that script created the 2 790 itself, moments before the window ran. THE CRUTCH WAS
# HIDING THE DEPENDENCY — REMOVING IT DID NOT CREATE IT. What the red exposed had been true all along and
# was simply being paid for by accident.
#
# ⚠️ So this is a PHASE and not a reordering, because the massive is not a line in that script — it is
# ANOTHER PROCESS, the one-shot inside the container. One direction, three moments, no cycle:
#   8 · curated (silence + terrain)  →  9 · massive  →  10 · the past  →  11 · the window (re-arm)
#
# The revalidate lands here, at the END, which is where a cache bust belongs: it invalidates a store that is
# finished rather than one with a step still to come.
say '11 · the shop window (after the massive, per tenant)'
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no \$$tokvar in the environment for the window phase."
  FORGE_SEED_TOKEN="$tokval" host_node "$HERE/bin/seed.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN" --phase window \
    || die "the window phase failed for \"$t\". Its own output is above; the box and its catalogue are standing."
done

# ── 12 · ★★★ THE VERDICT — the box is graded on what it HOLDS, not on what it was told to build ────────────
#
# ⛔ WHY A BIRTH THAT FINISHES IS NOT A BIRTH THAT WORKED, and this step is the answer measured on 02/09. Every
# step above returned success and the box came up with the FOOTWEAR catalogue inside the COFFEE tenant: 2 811
# products where 21 belonged, 44 490 SKUs, 351 brands nobody sells, and the shoe vocabulary in the form of
# every café. Nothing was red, because nothing was asking.
#
# ★ AND IT ASKS THE BOX, NOT THIS FILE. A check that re-read `seed/box.json` here would be the input grading
# the input: green through any road back to the same state — a one-shot run by hand, a second dataset, an app
# installed by mistake. `bin/verify-seed.mjs` goes through the DOOR, per tenant, with that tenant's own
# credential, and every expectation in it is derived from the seed declarations rather than typed.
#
# ⚠️ IT RUNS AFTER THE WINDOW, AND IT DOES NOT STOP THE SCRIPT WHERE IT FAILS. The box is fully standing by
# now, so there is nothing to protect by dying early — and the addresses below are what an operator needs even
# (especially) when a tenant did not settle. So the verdict is collected here, the bench is printed, and the
# script exits non-zero at the very end naming the tenants that came out wrong.
say '12 · the verdict (verify-seed, once per tenant)'
UNSETTLED=''
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no \$$tokvar in the environment for the verdict."
  if FORGE_SEED_TOKEN="$tokval" host_node "$HERE/bin/verify-seed.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN"; then
    note "$t settled"
  else
    UNSETTLED="$UNSETTLED $t"
    note "⛔ $t did NOT settle — the ✗ lines above say which check, and each one names what to look at."
  fi
done

# ── 13 · ★★ WHAT ONLY EXISTS ONLINE — AND IT RUNS AFTER THE REBIRTH, WHICH IS THE COUNTER-INTUITIVE HALF ────
#
# Renan, 04/09: *"ele precisaria também garantir que ligue tudo que só tem online, exemplo cdn se tiver na
# demo… ou qualquer coisa assim que morre no reset."*
#
# ⚠️ PURGING FIRST IS THE OBVIOUS ORDER AND IT IS THE WRONG ONE. A CDN purged before the teardown spends the
# ~17 minutes of the birth refilling itself from the origin being destroyed, and comes out of the reset
# holding exactly what the purge was for. So the sequence is REBORN → PURGE → WARM → VERDICT: step 14 below
# is what refills the edge, with the new box's answers.
#
# The facilities are DECLARED in `seed/box.json` and every declared one gets a line, including the ones with
# nothing to do — see the script's own header for why a list of things to re-enable is the wrong shape.
say '13 · the edge and the bucket (what only exists online) — after the rebirth, on purpose'
ONLINE_ONLY_FAILED=''
host_node "$HERE/bin/online-only.mjs" --phase after-birth || ONLINE_ONLY_FAILED=1

# ── 14 · ★★ THE BOX IS NOT DONE UNTIL IT IS WARM ────────────────────────────────────────────────────────────
#
# ★ THE ARGUMENT IS COMMERCIAL AND IT RAISES THE BAR (Renan, 04/09): *"ele também vai ser testado por exemplo
# performance e tal, se ele falhar em um teste de performance é prejudicial ao meu comercial"*. A box handed
# over cold makes the FIRST VISITOR pay for every cache this box could have filled by itself — and on this box
# that visitor is whoever is evaluating it. So warming is part of the definition of done and it has an exit
# code, exactly like a tenant that did not settle.
#
# ONCE PER TENANT, with that tenant's own token, for the same reason steps 3, 6, 8 and 11 are: the read face
# that lists a tenant's stores resolves the tenant from the CREDENTIAL. The store this box declares
# `servable: false` — the counter, served by the totem, which has no store in its URLs — is SKIPPED and the
# skip is announced with its declared reason.
say '14 · warming every servable store (a birth is not done until the box is warm)'
COLD=''
for t in $TENANTS; do
  tokvar="$(secret_name_for "$t" seed | tr 'a-z-' 'A-Z_')"
  eval "tokval=\${$tokvar:-}"
  [ -n "$tokval" ] || die "no \$$tokvar in the environment for the warming step."
  if FORGE_SEED_TOKEN="$tokval" host_node "$HERE/bin/warm-box.mjs" --tenant "$t" --api "$FORGE_PUBLIC_ORIGIN"; then
    note "$t warm"
  else
    COLD="$COLD $t"
    note "⛔ $t did NOT come out warm — the ✗ lines above name the store and the reason."
  fi
done

# ── 15 · ★★★ THE VERDICT OVER THE CONFIGURATION, which is the half a rebirth eats ───────────────────────────
#
# Step 12 grades the DATA. This grades what the box IS: the address it publishes itself at, the hostnames its
# shop answers, the admin door of each tenant, the link the gate sends an operator to, and every FORGE_*
# address on this box that a promotion would not move.
#
# ★ IT EXISTS BECAUSE A REBIRTH DE-PROMOTES THE ADMIN AND NOTHING SAID SO. The database dies, so the directory
# comes back holding only `seed/box.json`'s `localhost` doors; step 3d rewrites the sibling list back to
# `localhost`; step 3b rewrites the host map and KEEPS $FORGE_TAILNET_HOST, so the shop still answers on the
# network. The box ends up HALF PROMOTED — shop reachable, admin refusing `unknown_admin_host` — and the run
# exited 0. A verdict catches that; a sentence in the last line of a four-hundred-line scrollback does not.
say '15 · the verdict over the configuration (verify-config)'
MISCONFIGURED=''
host_node "$HERE/bin/verify-config.mjs" --api "$FORGE_PUBLIC_ORIGIN" || MISCONFIGURED=1

say 'the bench'
note "shop      ${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}"
for t in $TENANTS; do
  note "admin     http://$(jq -r --arg t "$t" '.tenants[]|select(.id==$t)|.admin_host' "$BOX")   → $t"
done
# ★ The café's id is RESOLVED by now (step 3c sets `CAFE_STORE`), so print it instead of a placeholder that
# nobody can paste.
if [ -n "${CAFE_STORE:-}" ]; then
  note "café      ${FORGE_PUBLIC_ORIGIN:-http://localhost:8200}/s/${CAFE_STORE}   (the forked vitrine)"
else
  note "café      ⚠️ no store id resolved for the forked vitrine"
fi
if [ -n "${TOTEM_UP:-}" ]; then
  note "totem     http://localhost:${FORGE_TOTEM_HTTP_PORT:-8203}"
else
  note "totem     ⚠️ NOT RUNNING — ${TOTEM_WHY:-unknown}"
  UNSETTLED_EXTRA='the totem'
fi
note ''
note 'off the laptop: set FORGE_TAILNET_HOST (and FORGE_TAILNET_IP) in .env, then `bash bin/box-up.sh --tailnet`.'
printf '\n' >&2

# ⛔ LAST LINE, AND IT IS NON-ZERO ON PURPOSE. A birth that leaves a tenant holding another brand's catalogue
# has to be RED, or the next person reads "the bench" above and believes it.
#
# ★ THE THREE REASONS STEPS 13–15 CAN ADD ARE PRINTED HERE, ABOVE THE TWO EXITS BELOW, because those exit
# where they print: a cold tenant discovered after an unsettled one would otherwise never reach the screen.
# Each is its own sentence — "the box is cold" and "the box is misconfigured" are different repairs.
if [ -n "${COLD:-}" ]; then
  printf '[box-up] ⛔ THE BOX IS UP AND%s CAME OUT COLD. Warming is part of done, not a courtesy: the first
         visitor pays for every cache this birth could have filled. Re-read step 14.

' "$COLD" >&2
fi
if [ -n "${MISCONFIGURED:-}" ]; then
  printf '[box-up] ⛔ THE CONFIGURATION IS NOT WHAT THIS BOX DECLARES. Step 15 names the face that disagrees;
         a box reborn while promoted lands here with its admin on localhost and its shop on the network.

' >&2
fi
if [ -n "${ONLINE_ONLY_FAILED:-}" ]; then
  printf '[box-up] ⛔ A FACILITY THAT ONLY EXISTS ONLINE WAS CONFIGURED AND COULD NOT RUN. Step 13 names it.

' >&2
fi
if [ -n "${UNSETTLED_EXTRA:-}" ] && [ -z "$UNSETTLED" ]; then
  printf '[box-up] ⛔ THE BOX IS UP AND %s IS NOT. The summary above says so where the address would be;\n         this line is here because an exit code is what a script downstream reads.\n\n' "$UNSETTLED_EXTRA" >&2
  exit 1
fi
if [ -n "$UNSETTLED" ]; then
  printf '[box-up] ⛔ THE BOX IS UP AND%s DID NOT SETTLE. Everything above is standing; what it HOLDS is not\n         what this repository declares. Re-read the ✗ lines of the verdict — they name the check.\n\n' "$UNSETTLED" >&2
  exit 1
fi
# The three above are reasons of their own, and reaching this line means the tenants settled — so a run that
# is cold or misconfigured still ends non-zero, which is what every wrapper reads before it reads the prose.
if [ -n "${COLD:-}" ] || [ -n "${MISCONFIGURED:-}" ] || [ -n "${ONLINE_ONLY_FAILED:-}" ]; then
  exit 1
fi
