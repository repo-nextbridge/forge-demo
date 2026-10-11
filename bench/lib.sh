#!/usr/bin/env bash
# THE BENCH OF THIS INSTANCE — the shared half of `bench/up.sh`, `bench/down.sh` and `bench/compose.sh`.
# SOURCED by them; it starts nothing on its own.
#
# ── WHAT A BENCH IS HERE ─────────────────────────────────────────────────────────────────────────────────────
#
# Your box, on your laptop: the SAME `compose.yml` production runs, with the SAME images `forge.lock` pins, plus
# one overlay (`bench/compose.bench.yml`) that brings what a laptop does not have — a Postgres, a mailbox that
# keeps every message on this machine, and doors on loopback ports instead of 80/443 and two DNS names. It is
# not a second stack written for development; the overlay only ADDS and REPLACES, so the day production
# changes, the bench changes with it.
#
# ── ⛔ WHAT IT DOES NOT ASSUME: THAT ANY FRONT IS OURS ───────────────────────────────────────────────────────
#
# The storefront, the checkout and the admin are each DECLARED, one by one, in `bench/bench.env`:
#
#   image          the one forge.lock pins (the default — the reference implementation)
#   build:<dir>    built from a directory of THIS repository (your fork), with that directory's Dockerfile
#   external:<p>   a process YOU run on this machine (a dev server, another framework, your own admin) on port
#                  <p>, listening on 0.0.0.0; the bench only routes its door to it and hands it the kernel's
#                  address (`.forge-bench/fronts.env`). `external:<host>:<p>` names another host.
#   none           no front at all; its door answers 503 saying so
#
# So nothing here grades a front: no login, no page probe, no warm-up. What the bench proves is what it owns —
# the database, the mailbox, the kernel answering, the doors routed — and it says out loud what it does NOT
# prove. The kernel is the one fixed consumer: the kernel is never forked.
#
# ── WHY IT LIVES IN THIS DIRECTORY AND NOWHERE ELSE ──────────────────────────────────────────────────────────
#
# This directory is COPIED into your repository and becomes yours. So the bench may not lean on anything outside
# it — no clone of the Forge repository, no `pnpm`, no Node on the host: Docker, `jq`, `curl` and bash, the same
# four the production path already asks for. The Forge repository keeps its own bench for the product (built
# from its tree); the two share VOCABULARY (the variable names), not code — their port layouts differ on purpose
# so a product bench and an instance bench can share a block number on one machine.

# The instance root: the directory holding compose.yml and forge.lock. Every path below is relative to it.
BENCH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Where the bench keeps what it MINTS (secrets, the mail certificate, the generated fronts overlay). Git-ignored
# by the .gitignore beside compose.yml, and removed by `bench/down.sh -v`.
BENCH_STATE="$BENCH_ROOT/.forge-bench"

bench_say() { echo "[bench] $*" >&2; }
bench_die() {
  echo "[bench] ⛔ $*" >&2
  exit 1
}

# ── 1. the declarations ──────────────────────────────────────────────────────────────────────────────────────
#
# `bench/bench.env` is the instance's declaration of its bench (checked in, no secret in it). The SHELL wins over
# it, so a developer moves their own bench (`FORGE_BENCH_PORT_BLOCK=71 bash bench/up.sh`) without editing a
# tracked file. ⚠️ The production `.env` is NEVER read: it names your public hostnames, your bucket and your CDN,
# and a bench that inherited them would point at production. Compose is given `--env-file bench/bench.env`
# explicitly, which is also what stops it from reading `.env` on its own.
#
# ⚠️ AND A SHELL THAT SOURCED env-source.sh CARRIES PRODUCTION: its DATABASE_URL, its bucket keys, its SMTP. Shell
# values win over compose's files, so a bench started from that shell would write into production's database
# and bucket. So the shell is honoured only for what a BENCH declares — names bench/bench.env carries, the
# FORGE_BENCH_* family, the four door ports, FORGE_LOCK — and every other FORGE_* (plus DATABASE_URL and the
# Google pair) is dropped from this process before compose can read it, and the run says how many.
BENCH_SHELL_DROPPED=''
BENCH_SHELL_ADDRESS=''
# The names bench/bench.env gave a value that REFERS to another (`FORGE_PUBLIC_ORIGIN=${FORGE_BENCH_ORIGIN}`),
# expanded once the bench has derived what they refer to (section 1c).
BENCH_DERIVED_NAMES=''
bench_load_declarations() {
  local file="$BENCH_ROOT/bench/bench.env" line name value declared=' ' doors entry
  [ -f "$file" ] || bench_die "no bench/bench.env — it is the file that declares this bench (copy it from the template)."
  # The address is the one name with THREE sources (section 3): what the shell says has to be told apart from
  # what bench/bench.env says, so it is remembered before the file is folded in.
  BENCH_SHELL_ADDRESS="${FORGE_BENCH_ADDRESS:-}"
  while IFS= read -r line || [ -n "$line" ]; do
    name="${line%%=*}"
    [[ "$name" =~ ^[A-Z_][A-Z0-9_]*$ ]] && declared="$declared$name "
  done <"$file"
  # A door the instance declares (FORGE_BENCH_DOORS, section 2) is named by a variable of its own, and this shell
  # may set that variable to move the door — so those names are the bench's too, not production's.
  if [ -n "${FORGE_BENCH_DOORS+set}" ]; then
    doors="$FORGE_BENCH_DOORS"
  else
    doors="$(sed -n 's/^FORGE_BENCH_DOORS=//p' "$file" | tail -1 | tr -d "\"'")"
  fi
  for entry in $doors; do declared="$declared${entry%%:*} "; done
  BENCH_SHELL_DROPPED=''
  for name in $(compgen -e); do
    case "$name" in
      FORGE_BENCH_* | FORGE_HTTP_PORT | FORGE_ADMIN_HTTP_PORT | FORGE_MAIL_HTTP_PORT | FORGE_KERNEL_PORT | FORGE_LOCK) continue ;;
      # The promotion's names (section 3): the https doors and the tailnet this machine is on. None of them is
      # production's — production's edge listens on 80/443 and never on a tailnet.
      FORGE_HTTPS_PORT | FORGE_ADMIN_HTTPS_PORT | FORGE_TAILNET_HOST | FORGE_TAILNET_IP) continue ;;
      FORGE_* | DATABASE_URL | GOOGLE_CLIENT_ID | GOOGLE_CLIENT_SECRET) ;;
      *) continue ;;
    esac
    case "$declared" in *" $name "*) continue ;; esac
    unset "$name"
    BENCH_SHELL_DROPPED="${BENCH_SHELL_DROPPED}${BENCH_SHELL_DROPPED:+ }$name"
  done
  # Inside the bench's own seed hook (which calls `bash bench/compose.sh …` to start what it needs) this shell
  # is the bench's: what it carries was derived by `up` and is derived again here — dropped all the same, but
  # not announced as production's (measured on the reference instance's hook: 17 names, every one the bench's).
  # @env FORGE_BENCH_HOOK_ENV_FILE optional — Set by an instance bench for its seed hook: the file (.forge-bench/hook.env) where the hook writes, NAME=value per line, what it learned (a store id that exists only after the seed); every later compose call of the bench reads it.
  [ -z "$BENCH_SHELL_DROPPED" ] || [ -n "${FORGE_BENCH_HOOK_ENV_FILE:-}" ] ||
    bench_say "ignored $(wc -w <<<"$BENCH_SHELL_DROPPED" | tr -d ' ') variable(s) of this shell the bench does not declare (production's, most likely): $BENCH_SHELL_DROPPED"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | '#'*) continue ;; esac
    name="${line%%=*}"
    value="${line#*=}"
    [[ "$name" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    # One layer of matching quotes, as compose reads them.
    case "$value" in \"*\") value="${value:1:${#value}-2}" ;; \'*\') value="${value:1:${#value}-2}" ;; esac
    # The shell already spoke (even to say "empty") — keep it.
    [ -n "${!name+set}" ] && continue
    export "$name=$value"
    case "$value" in *'${'*) BENCH_DERIVED_NAMES="${BENCH_DERIVED_NAMES}${BENCH_DERIVED_NAMES:+ }$name" ;; esac
  done <"$file"
}

# ── 1b. the tenants ──────────────────────────────────────────────────────────────────────────────────────────
#
# One tenant is the default, and it is the one FORGE_REF_TENANT / FORGE_REF_STORE_HANDLE / FORGE_REF_STORE_NAME
# name — a bench.env that never heard of this section is born exactly as before. A box that carries MORE than one
# brand (the reference instance: a shoe shop and a café, two tenants) lists them all, the first being the one the
# shop's door serves:
#
#   FORGE_BENCH_TENANTS=<id>:<store handle>:<store name>; <id>:<store handle>:<store name>; …
#
# Each one is provisioned by production's own one-shot, gets an operator credential of its own (filed, never
# printed — .forge-bench/tenants/<id>.token) and an admin door of its own. With more than one, the admin of
# forge.lock runs as production runs a multi-brand box: ONE container in HOST MODE (FORGE_ADMIN_TENANT empty),
# the tenant decided by the address the browser opened, with a platform credential the bench mints for it —
# and the bench claims each tenant's admin address in the kernel's admin directory, on every `up` (a promotion
# moves the addresses).
# @env FORGE_BENCH_TENANTS optional — The tenants an instance bench is born with, when more than one: `<id>:<store handle>:<store name>` entries separated by `;`, the first one served by the shop's door. Unset: the one tenant FORGE_REF_TENANT names.
BENCH_TENANTS=()
BENCH_TENANT_HANDLES=()
BENCH_TENANT_NAMES=()
bench_tenants() {
  local entries entry id rest handle name i
  BENCH_TENANTS=() BENCH_TENANT_HANDLES=() BENCH_TENANT_NAMES=()
  if [ -z "${FORGE_BENCH_TENANTS:-}" ]; then
    BENCH_TENANTS=("${FORGE_REF_TENANT:-}")
    BENCH_TENANT_HANDLES=("${FORGE_REF_STORE_HANDLE:-}")
    BENCH_TENANT_NAMES=("${FORGE_REF_STORE_NAME:-}")
    return 0
  fi
  IFS=';' read -ra entries <<<"$FORGE_BENCH_TENANTS"
  for entry in "${entries[@]}"; do
    entry="$(printf '%s' "$entry" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [ -n "$entry" ] || continue
    id="${entry%%:*}"
    rest="${entry#*:}"
    handle="${rest%%:*}"
    name="${rest#*:}"
    if [ "$rest" = "$entry" ] || [ "$name" = "$rest" ] || [ -z "$name" ] ||
      ! [[ "$id" =~ ^[a-z][a-z0-9_]*$ ]] || ! [[ "$handle" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
      bench_die "FORGE_BENCH_TENANTS: '$entry' is not <id>:<store handle>:<store name> (an id is lowercase letters, digits and _, starting with a letter; a handle lowercase letters, digits and -). Nothing was started."
    fi
    for i in "${!BENCH_TENANTS[@]}"; do
      [ "${BENCH_TENANTS[$i]}" != "$id" ] || bench_die "FORGE_BENCH_TENANTS names the tenant '$id' twice. Nothing was started."
    done
    BENCH_TENANTS+=("$id")
    BENCH_TENANT_HANDLES+=("$handle")
    BENCH_TENANT_NAMES+=("$name")
  done
  [ "${#BENCH_TENANTS[@]}" -gt 0 ] || bench_die 'FORGE_BENCH_TENANTS is set and lists no tenant. Nothing was started.'
  # Each further tenant's admin door is a suffix of the block (section 2): 21–29 and, promoted, 81–89.
  [ "${#BENCH_TENANTS[@]}" -le 10 ] || bench_die "FORGE_BENCH_TENANTS lists ${#BENCH_TENANTS[@]} tenants; a bench serves at most 10 (each one's admin door is a suffix of the port block). Nothing was started."
}
# bench_multi_tenant — true when the admin of this bench serves more than one tenant (host mode).
bench_multi_tenant() { [ "${#BENCH_TENANTS[@]}" -gt 1 ]; }

# ── 1c. values derived from what the bench derives ───────────────────────────────────────────────────────────
#
# A compose file of this instance that names its OWN variables for what the bench computes (its production
# compose reads FORGE_PUBLIC_ORIGIN; the bench calls the same address FORGE_BENCH_ORIGIN) says so in
# bench/bench.env by REFERENCE, and the bench expands it once the address, the ports and the tenants exist:
#
#   FORGE_PUBLIC_ORIGIN=${FORGE_BENCH_ORIGIN}
#
# So a promotion moves it too. Only `${NAME}` is expanded, and a reference to something unset is refused rather
# than expanded to nothing — an empty origin is a box that answers and links nowhere. The bench's own secrets are
# not referable: a secret copied into a declared name leaves the place it is kept.
bench_expand_declarations() {
  local name value out ref
  for name in $BENCH_DERIVED_NAMES; do
    value="${!name-}"
    out=''
    while [[ "$value" =~ ^([^$]*)\$\{([A-Za-z_][A-Za-z0-9_]*)\}(.*)$ ]]; do
      ref="${BASH_REMATCH[2]}"
      out="$out${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[3]}"
      case "$ref" in
        FORGE_BENCH_POSTGRES_PASSWORD | FORGE_VAULT_KEY | FORGE_BENCH_OPERATOR_TOKEN* | FORGE_ADMIN_SERVICE_TOKEN | FORGE_ADMIN_PLATFORM_TOKEN | DATABASE_URL)
          bench_die "bench/bench.env: $name refers to \${$ref}, one of the bench's own secrets — they stay in .forge-bench/secrets.env. Nothing was started." ;;
      esac
      [ -n "${!ref+set}" ] ||
        bench_die "bench/bench.env: $name refers to \${$ref}, which nothing has set by the time the bench derives its values (the address, the ports, the tenants, bench/bench.env itself). Nothing was started."
      out="$out${!ref}"
    done
    case "$value" in *'${'*) bench_die "bench/bench.env: $name=… holds a reference the bench does not expand (only \${NAME} is). Nothing was started." ;; esac
    export "$name=$out$value"
  done
}

# ── 2. the port block ────────────────────────────────────────────────────────────────────────────────────────
#
# `FORGE_BENCH_PORT_BLOCK=NN` (11–99) puts every door of this bench at `NNxx`: the same name and the same shape
# the Forge repository's bench and the reference instance use. The suffixes are the reference instance's
# (00 shop · 01 admin · 04 mail · 43 https shop) plus the doors only this bench publishes (05, the kernel — for
# the fronts you run yourself; 41, the admin's https door). Unset → the block 82 the reference instance ships.
# An individual port set in the shell or in bench/bench.env wins, and the run names it.
# The two https doors exist only on a PROMOTED bench (section 3); on `localhost` nothing listens on them.
# NAME:suffix
# @env FORGE_HTTP_PORT optional — The host port of an instance bench's shop door (storefront + checkout behind the edge). Unset: <block>00.
# @env FORGE_ADMIN_HTTP_PORT optional — The host port of an instance bench's admin door. Unset: <block>01.
# @env FORGE_MAIL_HTTP_PORT optional — The host port of an instance bench's mailbox web face, where login codes are read. Unset: <block>04.
# @env FORGE_HTTPS_PORT optional — The https door of the shop: on an instance bench promoted to a host, IP or tailnet (`bash bench/promote.sh`), the port a browser opens on that address. Unset: <block>43 — the reference instance's suffix for its https door.
BENCH_PORT_LAYOUT=(
  FORGE_HTTP_PORT:00        # the shop: storefront + checkout behind the edge, split by path as in production
  FORGE_ADMIN_HTTP_PORT:01  # the admin's door
  FORGE_MAIL_HTTP_PORT:04   # the mailbox's web face — where the login codes are read
  FORGE_KERNEL_PORT:05      # the kernel itself, for a front you run on this machine and for your own scripts
  FORGE_HTTPS_PORT:43       # the shop's https door, when promoted
  FORGE_ADMIN_HTTPS_PORT:41 # the admin's https door, when promoted
)
BENCH_PORTS_KEPT=''
#
# ── 2b. the doors beyond the six ─────────────────────────────────────────────────────────────────────────────
#
# Every door the bench publishes on the edge is in ONE list the bench writes into the edge's `ports:` itself —
# the edge's ports are REPLACED by the bench (`ports: !override`, compose.bench.yml), and a port another file
# adds to the edge would be dropped by that replacement without a word (measured on the reference instance,
# 2026-10-10: its counter's door, `127.0.0.1:<NN03>:82` in its own compose, absent from the merged bench). So a
# door is never smuggled in through a compose file — it is DECLARED here, and section 7 refuses the smuggled one
# by name. Two kinds:
#
#   · each further tenant's admin door (section 1b): tenant n ≥ 2 → NN2<n-1> on loopback, NN8<n-1> https when
#     promoted, both onto the admin's site of the edge — the same admin container, told apart by the address;
#   · the instance's own: FORGE_BENCH_DOORS="<NAME>:<suffix>:<edge port> …", e.g. a totem the instance's
#     Caddyfile serves on the edge's :82 — `FORGE_TOTEM_HTTP_PORT:03:82` publishes it on <block>03 as
#     FORGE_TOTEM_HTTP_PORT, which the shell may set to move it like any other door.
#
# A declared door is a LOOPBACK door: promoted, it keeps serving this machine; it gets no https door of its own.
# Entries "<NAME>:<suffix>:<service>:<container port>".
# @env FORGE_BENCH_DOORS optional — Doors of an instance bench beyond its own (a totem, a second front the instance's Caddyfile serves on another edge port): `<NAME>:<suffix>:<edge port>` entries, space separated — published on <block><suffix> as NAME, on loopback.
BENCH_DOORS=()
bench_ports() {
  # FORGE_BENCH_PORT_BLOCK is described once, where the Forge repository's own bench reads it.
  local block="${FORGE_BENCH_PORT_BLOCK:-82}" entry name suffix i seen=' ' names=' '
  case "$block" in
    1[1-9] | [2-9][0-9]) ;;
    *) bench_die "FORGE_BENCH_PORT_BLOCK=$block is not a port block. It is two digits, 11 to 99 (10xx and below are privileged): every door of this bench lands on <block>xx. Nothing was started." ;;
  esac
  bench_tenants
  BENCH_DOORS=()
  for ((i = 1; i < ${#BENCH_TENANTS[@]}; i++)); do
    BENCH_DOORS+=("FORGE_BENCH_ADMIN_HTTP_PORT_$((i + 1)):2$i:caddy:81" "FORGE_BENCH_ADMIN_HTTPS_PORT_$((i + 1)):8$i:edge-tls:444")
  done
  for entry in ${FORGE_BENCH_DOORS:-}; do
    [[ "$entry" =~ ^(FORGE_[A-Z0-9_]+_PORT):([0-9][0-9]):([1-9][0-9]{0,4})$ ]] ||
      bench_die "FORGE_BENCH_DOORS: '$entry' is not <NAME>:<suffix>:<edge port> — e.g. FORGE_TOTEM_HTTP_PORT:03:82 (a FORGE_…_PORT name, two digits, the port the edge's Caddyfile listens on). Nothing was started."
    case "${BASH_REMATCH[3]}" in
      80 | 81) bench_die "FORGE_BENCH_DOORS: '$entry' — the edge's :${BASH_REMATCH[3]} is the bench's own (the shop's and the admin's door). Nothing was started." ;;
    esac
    BENCH_DOORS+=("${BASH_REMATCH[1]}:${BASH_REMATCH[2]}:caddy:${BASH_REMATCH[3]}")
  done
  BENCH_PORTS_KEPT=''
  for entry in "${BENCH_PORT_LAYOUT[@]}" ${BENCH_DOORS[@]+"${BENCH_DOORS[@]}"}; do
    name="${entry%%:*}"
    suffix="${entry#*:}"
    suffix="${suffix%%:*}"
    # Two doors on one suffix would be one port published twice — compose would refuse it half-way through `up`.
    case "$seen" in *" $suffix "*) bench_die "two doors of this bench land on the suffix $suffix ($name and another) — FORGE_BENCH_DOORS must pick a suffix none of the bench's doors uses (00 01 04 05 41 43, 2x/8x for further tenants). Nothing was started." ;; esac
    case "$names" in *" $name "*) bench_die "two doors of this bench are named $name. Nothing was started." ;; esac
    seen="$seen$suffix "
    names="$names$name "
    if [ -n "${!name:-}" ]; then
      BENCH_PORTS_KEPT="${BENCH_PORTS_KEPT}${BENCH_PORTS_KEPT:+ }$name=${!name}"
      continue
    fi
    export "$name=$block$suffix"
  done
}

# bench_tenant_admin_port <index> [https] — the port of tenant <index>'s admin door (0 is the first tenant's).
bench_tenant_admin_port() {
  local var
  if [ "$1" = 0 ]; then
    if [ "${2:-}" = https ]; then var=FORGE_ADMIN_HTTPS_PORT; else var=FORGE_ADMIN_HTTP_PORT; fi
  elif [ "${2:-}" = https ]; then
    var="FORGE_BENCH_ADMIN_HTTPS_PORT_$(($1 + 1))"
  else
    var="FORGE_BENCH_ADMIN_HTTP_PORT_$(($1 + 1))"
  fi
  printf '%s' "${!var}"
}

# ── 3. the address: born on `localhost`, promoted to a host, an IP or a tailnet ──────────────────────────────
#
# ONE variable says where this bench is reached, and everything a browser is handed is derived from it here, in
# one place: the shop's and the admin's origins, the media base the kernel stamps into image URLs, the hosts the
# store answers for, and which https door exists. The model and the words are the Forge repository's bench
# (`pnpm bench:promote`) and the reference instance's (`bin/box-up.sh --promote`):
#
#   FORGE_BENCH_ADDRESS
#     localhost     the default — plain http on loopback; localhost is a secure context, so the fronts' `Secure`
#                   cookies are kept
#     <host or IP>  any address this machine is really reachable at (a LAN IP, a VPN address, a DNS name): the
#                   bench's own `edge-tls` Caddy (bench/compose.edge-tls.yml) terminates TLS on FORGE_HTTPS_PORT
#                   (shop) and FORGE_ADMIN_HTTPS_PORT (admin), with its LOCAL CA (exported to
#                   .forge-bench/ca.crt) or the certificates in FORGE_BENCH_TLS_CERT_DIR
#     tailnet       this machine on its tailnet: `tailscale serve` terminates TLS on the same two port numbers.
#                   The name is FORGE_TAILNET_HOST, or read from `tailscale status` — ONLY here, because only
#                   here was the tailnet asked for
#
#   ⚠️ WHY TLS AND NEVER PLAIN HTTP OFF LOCALHOST. The fronts and the admin run NODE_ENV=production, so every
#   cookie they set is `Secure`, and a browser drops a Secure cookie on a plain-http origin that is not
#   localhost: the login answers, and the click after it lands back on /login (measured by the Forge
#   repository's bench, DX-P8, 2026-10-10, and by the reference instance on its tailnet bench).
#
#   ⛔ `tailscale` IS EXECUTED ONLY WHEN THE DESTINATION IS `tailnet`. Not to publish, not to read the name for a
#   notice. A localhost or host bench does not touch it — on a machine where another bench holds the tailnet's
#   doors, a run that was not asked to publish there is a run that takes them.
#
# The sources, strongest first: the SHELL (FORGE_BENCH_ADDRESS=… bash bench/up.sh — this run only) · the
# PROMOTION (`bash bench/promote.sh <where>` writes .forge-bench/address.env, which stays with this copy until
# `bench/down.sh -v`: a bench born from zero is born on localhost) · bench/bench.env · `localhost`.
BENCH_DESTINATION=''    # localhost | host | tailnet
BENCH_HOST=''           # the host the doors carry: `localhost`, the declared host/IP, or the MagicDNS name
BENCH_ADDRESS_SOURCE='' # where the answer came from, for the run to say
BENCH_ADDRESS_FILE="$BENCH_STATE/address.env"

# bench_declared_address — the destination as declared, before it is resolved: sets BENCH_DECLARED and
# BENCH_ADDRESS_SOURCE.
BENCH_DECLARED=''
bench_declared_address() {
  local promoted=''
  [ -f "$BENCH_ADDRESS_FILE" ] && promoted="$(sed -n 's/^FORGE_BENCH_ADDRESS=//p' "$BENCH_ADDRESS_FILE" | tail -1)"
  if [ -n "$BENCH_SHELL_ADDRESS" ]; then
    BENCH_DECLARED="$BENCH_SHELL_ADDRESS" BENCH_ADDRESS_SOURCE='this shell'
  elif [ -n "$promoted" ]; then
    BENCH_DECLARED="$promoted" BENCH_ADDRESS_SOURCE='bench/promote.sh (.forge-bench/address.env)'
  elif [ -n "${FORGE_BENCH_ADDRESS:-}" ]; then
    BENCH_DECLARED="$FORGE_BENCH_ADDRESS" BENCH_ADDRESS_SOURCE='bench/bench.env'
  else
    BENCH_DECLARED="${FORGE_BENCH_ADDRESS:-localhost}" BENCH_ADDRESS_SOURCE='default'
  fi
}

# bench_tailnet_name — this machine's MagicDNS name, from `tailscale status`. Called for `tailnet` only.
bench_tailnet_name() {
  command -v tailscale >/dev/null 2>&1 || return 0
  tailscale status --json 2>/dev/null | jq -r '.Self.DNSName // empty' 2>/dev/null | sed 's/\.$//' || true
}

# bench_resolve_address <raw> — validate and resolve a destination. Returns 1, saying why, on one this bench
# cannot serve. With BENCH_STRICT_ADDRESS unset (down, compose) a tailnet with no name readable is a note, not a
# refusal: taking a bench down must not depend on the tailnet being up.
bench_resolve_address() {
  local raw="$1" tailnet_host=''
  BENCH_DESTINATION=''
  BENCH_HOST=''
  case "$raw" in
    localhost | 127.0.0.1)
      BENCH_DESTINATION=localhost
      BENCH_HOST=localhost
      ;;
    tailnet)
      BENCH_DESTINATION=tailnet
      [ -f "$BENCH_ADDRESS_FILE" ] && tailnet_host="$(sed -n 's/^FORGE_TAILNET_HOST=//p' "$BENCH_ADDRESS_FILE" | tail -1)"
      BENCH_HOST="${FORGE_TAILNET_HOST:-$tailnet_host}"
      # The tailnet was ASKED for, so asking tailscale its name is answering the request, not guessing.
      [ -n "$BENCH_HOST" ] || BENCH_HOST="$(bench_tailnet_name)"
      if [ -z "$BENCH_HOST" ]; then
        if [ -n "${BENCH_STRICT_ADDRESS:-}" ]; then
          echo "[bench] ⛔ the destination is 'tailnet' and this run has no tailnet name: FORGE_TAILNET_HOST is unset and" >&2
          echo "[bench]    \`tailscale status\` named no node (no tailscale, or the tailnet is down). Nothing was started." >&2
          echo "[bench]    Bring the tailnet up, or declare FORGE_TAILNET_HOST=<this machine's MagicDNS name> in bench/bench.env." >&2
          return 1
        fi
        bench_say "note: the destination is 'tailnet' and no tailnet name is readable — the addresses below say localhost."
        BENCH_HOST=localhost
      fi
      ;;
    *)
      # A HOST, not a URL: the scheme and the ports are this bench's to decide (https, the two *_HTTPS_PORTs).
      case "$raw" in
        *[!A-Za-z0-9.-]* | .* | *. | -* | '')
          echo "[bench] ⛔ '$raw' is not a destination this bench can serve. It is one of: localhost · tailnet ·" >&2
          echo "[bench]    a bare hostname or IPv4 address (no scheme, no port, no path), e.g. 192.168.1.20 or bench.example.com." >&2
          return 1
          ;;
      esac
      BENCH_DESTINATION=host
      BENCH_HOST="$raw"
      ;;
  esac
}

# bench_store_hosts — the hosts the store answers for, space separated, each once: the destination's host, the
# tailnet IP on a tailnet, and always `localhost` (the loopback doors keep serving this machine's browser).
bench_store_hosts() {
  local host seen=''
  for host in "$BENCH_HOST" "$([ "$BENCH_DESTINATION" = tailnet ] && printf '%s' "${FORGE_TAILNET_IP:-}")" localhost; do
    [ -n "$host" ] || continue
    case " $seen " in *" $host "*) continue ;; esac
    seen="${seen}${seen:+ }${host}"
  done
  printf '%s' "$seen"
}

bench_address() {
  bench_declared_address
  bench_resolve_address "$BENCH_DECLARED" || exit 1
  export FORGE_BENCH_ADDRESS="$BENCH_DECLARED"
  export FORGE_BENCH_BIND="${FORGE_BENCH_BIND:-127.0.0.1}"
  local shop_origin admin_origin
  if [ "$BENCH_DESTINATION" = localhost ]; then
    shop_origin="http://localhost:$FORGE_HTTP_PORT"
    admin_origin="http://localhost:$FORGE_ADMIN_HTTP_PORT"
  else
    shop_origin="https://$BENCH_HOST:$FORGE_HTTPS_PORT"
    admin_origin="https://$BENCH_HOST:$FORGE_ADMIN_HTTPS_PORT"
  fi
  # @env FORGE_BENCH_ORIGIN required — The shop's origin as a browser opens it on a local bench (an instance bench derives it from the address and the port block before compose reads it; set it only to override).
  export FORGE_BENCH_ORIGIN="${FORGE_BENCH_ORIGIN:-$shop_origin}"
  # @env FORGE_BENCH_ADMIN_ORIGIN optional — The admin's origin as a browser opens it on a local bench (derived like the shop's).
  export FORGE_BENCH_ADMIN_ORIGIN="${FORGE_BENCH_ADMIN_ORIGIN:-$admin_origin}"
  # The host the https edge answers for — only a host destination runs one (bench/compose.edge-tls.yml).
  export FORGE_BENCH_TLS_HOST="$BENCH_HOST"
  # @env FORGE_BENCH_KERNEL_URL required — The kernel's address as a process on this machine reaches it on an instance bench; derived from the port block, and handed to the seed hook.
  export FORGE_BENCH_KERNEL_URL="${FORGE_BENCH_KERNEL_URL:-http://127.0.0.1:$FORGE_KERNEL_PORT}"
  # The production edge (caddy/Caddyfile) serves the bench UNCHANGED: a site address of `http://:80` is "any host,
  # plain http, this port", so the path split between storefront and checkout is the one production runs.
  export FORGE_DOMAIN='http://:80' FORGE_ADMIN_DOMAIN='http://:81'
  # Media is served by the kernel through the shop's own door (/v1/* → kernel), so a browser needs no third origin.
  export FORGE_MEDIA_BASE_URL="${FORGE_MEDIA_BASE_URL:-$FORGE_BENCH_ORIGIN/v1/media/local}"
  # ⚠️ BEHIND THE https EDGE, the production edge is the SECOND proxy a request crosses, and it trusts no proxy
  # unless told (FORGE_TRUSTED_PROXY_CIDRS, empty in production without a CDN): it would overwrite the
  # `X-Forwarded-Proto: https` the bench's edge set with `http`, and the admin builds the links it mails (an
  # invitation's door) from that header. The edge-tls container sits on the bench's own compose network, a
  # private range; nothing else reaches the production edge's port but loopback. Only a host destination.
  if [ "$BENCH_DESTINATION" = host ]; then
    export FORGE_TRUSTED_PROXY_CIDRS=private_ranges
  else
    export FORGE_TRUSTED_PROXY_CIDRS=''
  fi
}

# bench_tenant_admin_origin <index> [loopback] — the origin a browser opens for tenant <index>'s admin: the
# promoted https door, or (on localhost, or asked for `loopback`) the loopback one.
bench_tenant_admin_origin() {
  if [ "$1" = 0 ] && [ "${2:-}" != loopback ]; then
    printf '%s' "$FORGE_BENCH_ADMIN_ORIGIN"
  elif [ "$BENCH_DESTINATION" = localhost ] || [ "${2:-}" = loopback ]; then
    printf 'http://localhost:%s' "$(bench_tenant_admin_port "$1")"
  else
    printf 'https://%s:%s' "$BENCH_HOST" "$(bench_tenant_admin_port "$1" https)"
  fi
}

# bench_admin_claims <index> — every `host:port` a browser sends for tenant <index>'s admin, which the kernel's
# admin directory has to map to that tenant in host mode (it keys on the authority, port included): the loopback
# door as `localhost`, and, promoted, the https door under each host the store answers for.
bench_admin_claims() {
  local host claims="localhost:$(bench_tenant_admin_port "$1")"
  if [ "$BENCH_DESTINATION" != localhost ]; then
    for host in $(bench_store_hosts); do
      [ "$host" = localhost ] || claims="$claims $host:$(bench_tenant_admin_port "$1" https)"
    done
  fi
  printf '%s' "$claims"
}

# ── 3b. the https doors of a promoted bench ──────────────────────────────────────────────────────────────────
#
# Two publishers, one per destination, and each runs ONLY for its own: the host destination brings up the
# bench's `edge-tls` (a Caddy of its own, bench/compose.edge-tls.yml, profile `edge-tls`), the tailnet
# destination asks `tailscale serve`. Every other destination REMOVES a leftover edge-tls, so a bench sent back
# to localhost stops answering on the address it left.

# bench_tls_cert_dir — the certificates folder as a path the bench can read (relative to the instance root).
bench_tls_cert_dir() {
  local dir="${FORGE_BENCH_TLS_CERT_DIR:-./bench/certs}"
  case "$dir" in /*) printf '%s' "$dir" ;; *) printf '%s/%s' "$BENCH_ROOT" "${dir#./}" ;; esac
}

# bench_tls_edge_up — the host destination's edge: up (re-created when the host moved or the certificates
# changed), the local CA exported, and the trust file the proofs use written.
bench_tls_edge_up() {
  local ca="$BENCH_STATE/ca.crt" trust="$BENCH_STATE/trust.pem" dir tries=0
  dir="$(bench_tls_cert_dir)"
  # (An empty folder is the normal state: `cat` of an unmatched glob fails, and under pipefail that failure
  # would end the run with no message — measured on the first re-promotion after removing a certificate.)
  BENCH_TLS_CERTS_SUM="$({ cat "$dir"/*.pem 2>/dev/null || true; } | cksum | tr -d ' ')"
  export BENCH_TLS_CERTS_SUM
  # --no-deps: the production edge it forwards to is already up (step 5), and following the dependency chain
  # would rebuild and recreate a front declared `build:` a second time (measured on the fork's bench).
  bench_compose --profile edge-tls up -d --wait --no-deps edge-tls >&2
  # The root exists once Caddy issued its first certificate — moments after start, never before it. With
  # certificates of your own (FORGE_BENCH_TLS_CERT_DIR) covering the host, no local CA may ever be minted.
  until bench_compose --profile edge-tls cp edge-tls:/data/caddy/pki/authorities/local/root.crt "$ca" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -ge 15 ]; then
      rm -f "$ca"
      bench_say "  note: the edge's local CA was not readable after ${tries} s — certificates of your own are in use, or it is still starting."
      break
    fi
    sleep 1
  done
  [ -f "$ca" ] && chmod 644 "$ca"
  # What the proofs below trust: exactly what this edge can serve — the certificates you gave it (their
  # CERTIFICATE blocks only; curl accepts a leaf as an anchor) and its local CA, for a name they do not cover.
  { sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' "$dir"/*.pem 2>/dev/null; cat "$ca" 2>/dev/null; } >"$trust" || true
}

# bench_tls_edge_down — any other destination: a leftover edge is removed. (`--remove-orphans` does not do it:
# MEASURED 2026-10-10, compose 5.3.1, a profiled service's container is not an orphan of a run without the
# profile, and survives both `up --remove-orphans` and `down -v` — so `down` names the profile too.)
bench_tls_edge_down() {
  [ -n "$(bench_compose --profile edge-tls ps -a -q edge-tls 2>/dev/null)" ] || return 0
  bench_say "  the https edge of a previous promotion is still up — removing it (this bench is '$BENCH_DESTINATION' now)"
  bench_compose --profile edge-tls rm -sf edge-tls >&2
  rm -f "$BENCH_STATE/ca.crt" "$BENCH_STATE/trust.pem"
}

# The doors `tailscale serve` publishes for this bench: "<https port> <loopback target>", one per line.
bench_tailnet_doors() {
  local i
  printf '%s http://127.0.0.1:%s\n' "$FORGE_HTTPS_PORT" "$FORGE_HTTP_PORT" "$FORGE_ADMIN_HTTPS_PORT" "$FORGE_ADMIN_HTTP_PORT"
  # …and each further tenant's admin door (section 1b).
  for ((i = 1; i < ${#BENCH_TENANTS[@]}; i++)); do
    printf '%s http://127.0.0.1:%s\n' "$(bench_tenant_admin_port "$i" https)" "$(bench_tenant_admin_port "$i")"
  done
}

# bench_tailnet_door_target <https-port> — what `tailscale serve` proxies <port>'s root to today, or nothing.
bench_tailnet_door_target() {
  tailscale serve status --json 2>/dev/null | jq -r --arg p "$1" '
    (.Web // {}) | to_entries[] | select(.key | endswith(":" + $p)) | .value.Handlers["/"].Proxy // empty' 2>/dev/null |
    head -1 | sed 's:/*$::' || true
}

# bench_tailnet_check — BEFORE anything is started: every door this bench would publish is free or already
# ours. `tailscale serve` is last-writer-wins, and one machine's tailnet carries the doors of every bench on it;
# a door already proxied somewhere else is refused BY NAME, never re-pointed.
bench_tailnet_check() {
  local port target current refused=0
  command -v tailscale >/dev/null 2>&1 ||
    bench_die "the destination is 'tailnet' and there is no \`tailscale\` on this machine. Nothing was started."
  while read -r port target; do
    current="$(bench_tailnet_door_target "$port")"
    [ -z "$current" ] || [ "$current" = "$target" ] && continue
    bench_say "⛔ tailnet :$port is already published to $current, not to this bench's $target."
    refused=1
  done < <(bench_tailnet_doors)
  [ "$refused" = 0 ] && return 0
  bench_say "   \`tailscale serve\` is last-writer-wins: publishing would take that door from whoever holds it. Nothing was"
  bench_say "   started. Move this bench (FORGE_BENCH_PORT_BLOCK=NN, or FORGE_HTTPS_PORT / FORGE_ADMIN_HTTPS_PORT), or free"
  bench_say "   the door yourself if it is a dead one: tailscale serve --https=<port> off"
  exit 1
}

# bench_tailnet_publish — the doors, published (each only if it is not ours already).
bench_tailnet_publish() {
  local port target
  while read -r port target; do
    [ "$(bench_tailnet_door_target "$port")" = "$target" ] && continue
    tailscale serve --bg --https="$port" "$target" >/dev/null ||
      bench_die "\`tailscale serve --https=$port $target\` failed (above)."
  done < <(bench_tailnet_doors)
}

# bench_tailnet_release_notice — leaving the tailnet: SAY which doors to release, never run it. Releasing a
# door is configuring the network, on a run whose destination is not the tailnet.
bench_tailnet_release_notice() {
  local port target
  bench_say "this bench left the tailnet. If its doors are still published there, release them yourself:"
  while read -r port target; do
    printf '[bench]   tailscale serve --https=%s off      (was → %s)\n' "$port" "$target" >&2
  done < <(bench_tailnet_doors)
}

# bench_tls_notice — what the browser will say about the certificate, and how to make it stop.
# @env FORGE_BENCH_TLS_CERT_DIR optional — Certificates of your own for an instance bench promoted to a host or IP (one PEM per file, chain then key; mkcert, an ACME client's output, a company CA): served by the bench's https edge instead of its local CA. Default `./bench/certs`. The production edge's FORGE_TLS_CERT_DIR is never read by the bench.
bench_tls_notice() {
  [ "$BENCH_DESTINATION" = host ] || return 0
  local dir="${FORGE_BENCH_TLS_CERT_DIR:-./bench/certs}"
  if compgen -G "$(bench_tls_cert_dir)/*.pem" >/dev/null 2>&1; then
    bench_say "  🔒 TLS on $BENCH_HOST: the certificate(s) in $dir (FORGE_BENCH_TLS_CERT_DIR); a name none covers falls back to the local CA."
  else
    bench_say "  🔒 TLS on $BENCH_HOST: the bench's LOCAL CA — the first visit shows a certificate warning. Accept it, or trust"
    bench_say "     the CA once per device (it lives in the edge-tls volume and survives restarts and re-promotions):"
    bench_say "       $BENCH_STATE/ca.crt"
    bench_say "     or hand the edge certificates of your own: one PEM per file (chain + key) in $dir, then promote again."
  fi
}

# ── 4. the images ────────────────────────────────────────────────────────────────────────────────────────────
# The SAME step production runs (bin/images-from-lock.sh): the bench runs what forge.lock pins, by digest.
bench_images() {
  command -v jq >/dev/null 2>&1 || bench_die '`jq` is required (apt install jq / brew install jq).'
  # shellcheck source=../bin/images-from-lock.sh
  source "$BENCH_ROOT/bin/images-from-lock.sh" || bench_die "forge.lock did not resolve into four pinned images (above)."
}

# ── 5. the bench's own secrets ───────────────────────────────────────────────────────────────────────────────
#
# A bench mints its own: a database password and a vault key that mean nothing outside this machine, written
# once (0600) and kept until `bench/down.sh -v` drops the database they belong to. Production's secrets
# (env-source.sh) are never read. Values are never printed.
bench_secrets() {
  local file="$BENCH_STATE/secrets.env"
  mkdir -p "$BENCH_STATE"
  # @env FORGE_BENCH_POSTGRES_PASSWORD required — An instance bench's own database password, minted once by bench/up.sh into .forge-bench/secrets.env; never production's.
  if [ ! -s "$file" ]; then
    (
      umask 077
      printf 'FORGE_BENCH_POSTGRES_PASSWORD=%s\n' "$(bench_random)"
      printf 'FORGE_VAULT_KEY=%s\n' "$(bench_random)"
    ) >"$file"
    chmod 600 "$file"
  fi
  bench_source_secrets
}
bench_random() { od -An -tx1 -N24 /dev/urandom | tr -d ' \n'; }
# …and what the last `up` learned (the store id, the host map), so `bench/compose.sh` recreates a container
# with the same values `up` gave it.
bench_source_secrets() {
  local file
  for file in "$BENCH_STATE/secrets.env" "$BENCH_STATE/state.env"; do
    [ -f "$file" ] || continue
    set -a
    # shellcheck disable=SC1090
    . "$file"
    set +a
  done
  # The base compose interpolates `${DATABASE_URL:?}` before the overlay is merged, so it is SET here, to the
  # bench's own database — never inherited (see bench_load_declarations).
  export DATABASE_URL="postgres://forge:${FORGE_BENCH_POSTGRES_PASSWORD:-not-minted}@postgres:5432/forge"
  bench_hook_state
}

# ── 5b. what the seed hook learned ───────────────────────────────────────────────────────────────────────────
#
# Some values exist only AFTER the seed: the id of a store the hook created, a counter's store a totem serves.
# The hook writes them, one `NAME=value` per line, into the file it is handed (FORGE_BENCH_HOOK_ENV_FILE =
# .forge-bench/hook.env), and from then on every compose call of this bench sees them — the services declared
# in FORGE_BENCH_AFTER_HOOK are started after the hook for exactly this reason (bench/up.sh, step 8). Read as
# DATA, never sourced: a line is a name and a value, nothing in it runs. The names the bench derives itself are
# refused — a hook may teach the box something new, not move its database or its doors.
BENCH_HOOK_ENV="$BENCH_STATE/hook.env"
bench_hook_state() {
  local line name value
  [ -f "$BENCH_HOOK_ENV" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | '#'*) continue ;; esac
    name="${line%%=*}"
    value="${line#*=}"
    [[ "$name" =~ ^[A-Z_][A-Z0-9_]*$ ]] && [ "$name" != "$line" ] ||
      bench_die ".forge-bench/hook.env (written by the seed hook) carries a line that is not NAME=value: '$line'"
    case "$name" in
      FORGE_BENCH_* | DATABASE_URL | FORGE_VAULT_KEY | FORGE_ADMIN_SERVICE_TOKEN | FORGE_ADMIN_PLATFORM_TOKEN | FORGE_ADMIN_TENANT | \
        COMPOSE_PROJECT_NAME | FORGE_DOMAIN | FORGE_ADMIN_DOMAIN | FORGE_MEDIA_BASE_URL | FORGE_STORE_HOSTS | *_IMAGE)
        bench_die ".forge-bench/hook.env sets $name, which the bench derives itself — a hook teaches the box new values, it does not move the bench's own." ;;
    esac
    case " $(bench_door_names) " in *" $name "*) bench_die ".forge-bench/hook.env sets $name, one of the bench's doors — doors are declared in bench/bench.env." ;; esac
    case "$value" in \"*\") value="${value:1:${#value}-2}" ;; \'*\') value="${value:1:${#value}-2}" ;; esac
    export "$name=$value"
  done <"$BENCH_HOOK_ENV"
}
# bench_door_names — the name of every door this bench publishes.
bench_door_names() {
  local entry
  for entry in "${BENCH_PORT_LAYOUT[@]}" ${BENCH_DOORS[@]+"${BENCH_DOORS[@]}"}; do printf '%s ' "${entry%%:*}"; done
}
# bench_put_secret NAME VALUE — replace one line of secrets.env without ever echoing the value.
bench_put_secret() {
  local file="$BENCH_STATE/secrets.env" tmp
  tmp="$(mktemp "$BENCH_STATE/.secrets.XXXXXX")"
  chmod 600 "$tmp"
  { grep -v "^$1=" "$file" 2>/dev/null || true; printf '%s=%s\n' "$1" "$2"; } >"$tmp"
  mv "$tmp" "$file"
}

# ── 6. the fronts ────────────────────────────────────────────────────────────────────────────────────────────
#
# Each front's declaration becomes, at most, one service REPLACEMENT in a generated overlay
# (.forge-bench/fronts.compose.yml). `image` writes nothing — the service stays exactly the one production runs.
# The other three keep the service NAME, so the production edge routes to them without a line of it changing:
#
#   build:<dir>   the same service, built from <dir> instead of pulled
#   external:<p>  a `caddy:2` stand-in that forwards to host.docker.internal:<p> (the edge still talks to
#                 `storefront:3000`; the stand-in is the only thing that knows your process exists)
#   none          a `caddy:2` stand-in that answers 503 naming the declaration
BENCH_FRONTS=(storefront checkout admin)

# bench_front_mode <front> — the declaration of one front, validated. Prints `image`, `build:<dir>`,
# `external:<host>:<port>` or `none`.
bench_front_mode() {
  local front="$1" var value rest host port
  var="FORGE_BENCH_$(printf '%s' "$front" | tr '[:lower:]' '[:upper:]')"
  value="${!var:-image}"
  case "$value" in
    image | none) printf '%s' "$value" ;;
    build:?*)
      rest="${value#build:}"
      [ -d "$BENCH_ROOT/$rest" ] || bench_die "$var=$value — there is no directory '$rest' in this instance to build the $front from."
      [ -f "$BENCH_ROOT/$rest/Dockerfile" ] || bench_die "$var=$value — '$rest' has no Dockerfile; a front built by the bench is built by \`docker build $rest\`."
      printf 'build:%s' "$rest"
      ;;
    external:?*)
      rest="${value#external:}"
      case "$rest" in
        *:*) host="${rest%:*}" port="${rest##*:}" ;;
        *) host=host.docker.internal port="$rest" ;;
      esac
      [[ "$port" =~ ^[0-9]+$ ]] && [ -n "$host" ] ||
        bench_die "$var=$value — an external front is \`external:<port>\` (a process on this machine) or \`external:<host>:<port>\`."
      printf 'external:%s:%s' "$host" "$port"
      ;;
    *) bench_die "$var=$value — a front is declared as one of: image · build:<dir> · external:<port> · none." ;;
  esac
}

# bench_front_door <front> — the address a browser opens to reach that front, through the edge.
bench_front_door() {
  case "$1" in
    storefront) printf '%s/' "$FORGE_BENCH_ORIGIN" ;;
    checkout) printf '%s/checkout' "$FORGE_BENCH_ORIGIN" ;;
    admin) printf '%s/' "$FORGE_BENCH_ADMIN_ORIGIN" ;;
  esac
}

# bench_fronts_overlay — write .forge-bench/fronts.compose.yml from the declarations. The name does not start
# with `compose` on purpose: a gitignored file that walks like a compose file is graded like one by tooling
# that looks for them. Always written (an empty
# `services: {}` when every front is the image), so the compose command line never changes shape.
bench_fronts_overlay() {
  local out="$BENCH_STATE/fronts.compose.yml" front mode target body
  mkdir -p "$BENCH_STATE"
  {
    echo '# GENERATED by bench/up.sh from the FORGE_BENCH_<FRONT> declarations in bench/bench.env — do not edit.'
    echo 'services:'
    for front in "${BENCH_FRONTS[@]}"; do
      mode="$(bench_front_mode "$front")" || exit 1
      case "$mode" in
        image) ;;
        build:*)
          echo "  $front:"
          echo "    image: forge-bench-${front}:${COMPOSE_PROJECT_NAME}"
          echo '    pull_policy: build'
          echo '    build:'
          echo "      context: ./${mode#build:}"
          ;;
        external:*)
          target="${mode#external:}"
          echo "  $front:"
          echo '    image: caddy:2'
          # The stand-in is a THIRD proxy (production's edge, then this) and trusts nobody, so on its own it would
          # rewrite the scheme the request arrived with to `http` — on a promoted bench, the `https` the bench's
          # edge terminated. Your front builds its own links from that header (the admin builds the door an
          # invitation mails). Measured 2026-10-10 on a promoted bench: `x-forwarded-proto: http` without this.
          echo "    command: [\"caddy\", \"reverse-proxy\", \"--from\", \":3000\", \"--to\", \"$target\", \"--header-up\", \"X-Forwarded-Proto: {http.request.header.X-Forwarded-Proto}\"]"
          echo '    environment: !reset {}'
          echo '    volumes: !reset []'
          echo '    extra_hosts: ["host.docker.internal:host-gateway"]'
          echo '    healthcheck:'
          echo '      test: ["CMD", "nc", "-z", "127.0.0.1", "3000"]'
          echo '      interval: 5s'
          echo '      timeout: 3s'
          echo '      retries: 5'
          ;;
        none)
          # No variable name in the generated file: it lives under this directory, where the tooling that reads
          # configuration names out of compose files would take one for a read.
          body="this bench serves no $front: it is declared none in bench/bench.env"
          echo "  $front:"
          echo '    image: caddy:2'
          echo "    command: [\"caddy\", \"respond\", \"--listen\", \":3000\", \"--status\", \"503\", \"--body\", \"$body\"]"
          echo '    environment: !reset {}'
          echo '    volumes: !reset []'
          echo '    healthcheck:'
          echo '      test: ["CMD", "nc", "-z", "127.0.0.1", "3000"]'
          echo '      interval: 5s'
          echo '      timeout: 3s'
          echo '      retries: 5'
          ;;
      esac
    done
    bench_doors_overlay
  } >"$out.tmp" || exit 1
  # An empty map, so the file is a valid overlay when every front is the image.
  grep -q '^  [a-z]' "$out.tmp" || sed -i.bak 's/^services:$/services: {}/' "$out.tmp"
  rm -f "$out.tmp.bak"
  mv "$out.tmp" "$out"
}

# bench_doors_overlay — the edge's ports, written WHOLE when the bench has doors beyond the six (section 2b):
# the bench's own two plus every further one, replacing the list compose.bench.yml gives (this file is merged
# after it). With no further door nothing is written, and the edge is exactly compose.bench.yml's. Literal
# values, like everything in this generated file, and regenerated on every `up`.
bench_doors_overlay() {
  local entry name rest service target caddy='' edge=''
  for entry in ${BENCH_DOORS[@]+"${BENCH_DOORS[@]}"}; do
    name="${entry%%:*}"
    rest="${entry#*:}"
    rest="${rest#*:}"
    service="${rest%%:*}"
    target="${rest#*:}"
    case "$service" in
      caddy) caddy="$caddy      - '${FORGE_BENCH_BIND:-127.0.0.1}:${!name}:$target'"$'\n' ;;
      edge-tls) edge="$edge      - '${FORGE_BENCH_TLS_BIND:-0.0.0.0}:${!name}:$target'"$'\n' ;;
    esac
  done
  if [ -n "$caddy" ]; then
    echo '  caddy:'
    echo '    ports: !override'
    echo "      - '${FORGE_BENCH_BIND:-127.0.0.1}:$FORGE_HTTP_PORT:80'"
    echo "      - '${FORGE_BENCH_BIND:-127.0.0.1}:$FORGE_ADMIN_HTTP_PORT:81'"
    printf '%s' "$caddy"
  fi
  if [ -n "$edge" ]; then
    echo '  edge-tls:'
    echo '    ports: !override'
    echo "      - '${FORGE_BENCH_TLS_BIND:-0.0.0.0}:$FORGE_HTTPS_PORT:443'"
    echo "      - '${FORGE_BENCH_TLS_BIND:-0.0.0.0}:$FORGE_ADMIN_HTTPS_PORT:444'"
    printf '%s' "$edge"
  fi
}

# ── 7. compose, the one way this bench calls it ──────────────────────────────────────────────────────────────
#
# Every docker compose call of the bench goes through here, so the file list and the env file cannot drift
# between `up`, `down` and a human typing `bash bench/compose.sh logs kernel`. Your own `compose.override.yml`
# is included when it exists (compose does that by itself only when no `-f` is given, and the bench gives
# three), and so is every file named in FORGE_BENCH_COMPOSE_FILES — which is where a front of your own beyond the
# three (a totem, a second vitrine) is declared, the same seam it uses in production.
bench_compose() {
  local args=(-f "$BENCH_ROOT/compose.yml") extra
  [ -f "$BENCH_ROOT/compose.override.yml" ] && args+=(-f "$BENCH_ROOT/compose.override.yml")
  # @env FORGE_BENCH_COMPOSE_FILES optional — Extra compose files (relative to the instance root, space-separated) a local bench merges before its own overlay (so the overlay's guarantees — its database, its mailbox, the edge's ports — hold over them), for a front or a service the instance adds.
  for extra in ${FORGE_BENCH_COMPOSE_FILES:-}; do args+=(-f "$BENCH_ROOT/$extra"); done
  args+=(-f "$BENCH_ROOT/bench/compose.bench.yml" -f "$BENCH_ROOT/bench/compose.edge-tls.yml")
  [ -f "$BENCH_STATE/fronts.compose.yml" ] && args+=(-f "$BENCH_STATE/fronts.compose.yml")
  docker compose --project-directory "$BENCH_ROOT" --env-file "$BENCH_ROOT/bench/bench.env" "${args[@]}" "$@"
}

# bench_compose_read … — compose asked a QUESTION (config), which only has to read the files: before step 1 a
# virgin bench has no secrets yet, and the base compose refuses to interpolate without them.
bench_compose_read() {
  (
    export FORGE_BENCH_POSTGRES_PASSWORD="${FORGE_BENCH_POSTGRES_PASSWORD:-not-minted}" FORGE_VAULT_KEY="${FORGE_VAULT_KEY:-not-minted}"
    bench_compose "$@"
  )
}

# bench_seam_doors — ⛔ A DOOR NEVER VANISHES WITHOUT A WORD. The files merged BEFORE the bench's overlay (your
# compose.override.yml, FORGE_BENCH_COMPOSE_FILES) may publish ports on the edge — production's way of adding a
# door — and the overlay REPLACES the edge's ports after them, so on the bench each such port would simply not
# be there. Asked of compose itself (the edge's published container ports with those files, against
# compose.yml's alone): a container port they add that no door of the bench covers (80, 81, FORGE_BENCH_DOORS)
# is refused by name, before anything is started. Why declared doors and not a later merge of those files:
# the bench's overlay is what points the box at the bench's own database and mailbox, and a file merged after
# it could undo that by accident; and a declared door moves with the block, appears in the summary and is
# refused when it collides — a port in a compose file does none of that.
bench_seam_doors() {
  local seams=() names='' extra base all target covered=' 80 81 ' entry missing=''
  [ -f "$BENCH_ROOT/compose.override.yml" ] && seams+=(-f "$BENCH_ROOT/compose.override.yml") && names='compose.override.yml'
  for extra in ${FORGE_BENCH_COMPOSE_FILES:-}; do
    seams+=(-f "$BENCH_ROOT/$extra")
    names="${names}${names:+, }$extra"
  done
  [ "${#seams[@]}" -gt 0 ] || return 0
  edge_targets() {
    local json
    # Before step 1 a virgin bench has no secrets yet; compose only has to READ the files here (bench_compose_read).
    json="$(export FORGE_BENCH_POSTGRES_PASSWORD="${FORGE_BENCH_POSTGRES_PASSWORD:-not-minted}" FORGE_VAULT_KEY="${FORGE_VAULT_KEY:-not-minted}"
      docker compose --project-directory "$BENCH_ROOT" --env-file "$BENCH_ROOT/bench/bench.env" -f "$BENCH_ROOT/compose.yml" "$@" \
      config --format json 2>"$BENCH_STATE/.seam-doors.err")" || {
      cat "$BENCH_STATE/.seam-doors.err" >&2
      bench_die "could not read the edge's ports from compose.yml${1:+ with $names} (above) — refusing rather than guessing whether a door would vanish."
    }
    rm -f "$BENCH_STATE/.seam-doors.err"
    printf '%s' "$json" | jq -r '.services.caddy.ports[]?.target' | sort -u
  }
  mkdir -p "$BENCH_STATE"
  base=" $(edge_targets | tr '\n' ' ') "
  all="$(edge_targets "${seams[@]}")"
  for entry in ${BENCH_DOORS[@]+"${BENCH_DOORS[@]}"}; do
    case "$entry" in *:caddy:*) covered="$covered${entry##*:} " ;; esac
  done
  for target in $all; do
    case "$base" in *" $target "*) continue ;; esac
    case "$covered" in *" $target "*) continue ;; esac
    missing="$missing $target"
  done
  [ -n "$missing" ] || return 0
  echo "[bench] ⛔ the edge's port(s)${missing} are published by a file merged before the bench's overlay" >&2
  echo "[bench]    ($names). The bench REPLACES the edge's ports, so on this bench those doors would not exist —" >&2
  echo "[bench]    and nothing would say so. Declare each one as a door of the bench, in bench/bench.env:" >&2
  for target in $missing; do echo "[bench]      FORGE_BENCH_DOORS=… FORGE_<NAME>_PORT:<two-digit suffix>:$target" >&2; done
  echo "[bench]    Nothing was started." >&2
  exit 1
}

# bench_profiles — every profile this instance's compose declares, as `--profile <p>` arguments, the bench's own
# `edge-tls` last. ⚠️ A profiled service's container survives `down` (and `down -v`) when its profile is not
# named — measured 2026-10-10, compose 5.3.1 — so taking a bench down names them all.
bench_profiles() {
  local p
  for p in $(bench_compose_read config --profiles 2>/dev/null); do
    [ "$p" = edge-tls ] || printf -- '--profile\n%s\n' "$p"
  done
  printf -- '--profile\nedge-tls\n'
}

# ── 8. one project per checkout ──────────────────────────────────────────────────────────────────────────────
#
# Two copies of this instance on one machine are two benches only if their compose projects differ. Compose
# derives the name from the DIRECTORY's basename when nobody names it, so `~/a/shop` and `~/b/shop` would be ONE
# project: the second `up` would recreate the first one's containers from its own files and adopt its database.
# Compose stamps the directory it ran from on every container (`com.docker.compose.project.working_dir`), so a
# project can say which copy owns it, and `up` and `down` refuse one another copy owns — before any side effect.
# ⚠️ It sees containers. After `down` a project has at most volumes, which carry no directory.
bench_project() {
  if [ -z "${COMPOSE_PROJECT_NAME:-}" ]; then
    COMPOSE_PROJECT_NAME="$(bench_compose config --no-interpolate --format json 2>/dev/null | jq -r '.name // empty')" || true
    [ -n "$COMPOSE_PROJECT_NAME" ] ||
      bench_die "could not ask \`docker compose\` which project this bench is. Refusing rather than guessing: an unanswered question here is how one bench recreates another."
  fi
  export COMPOSE_PROJECT_NAME
}

bench_refuse_foreign_project() {
  local here owners dir dir_real foreign=''
  here="$(cd "$BENCH_ROOT" && pwd -P)"
  owners="$(docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
    --format '{{.Label "com.docker.compose.project.working_dir"}}' 2>/dev/null)" ||
    bench_die "could not ask docker which copy owns the compose project '$COMPOSE_PROJECT_NAME'. Nothing was touched."
  while IFS= read -r dir; do
    [ -n "$dir" ] || continue
    dir_real="$(cd "$dir" 2>/dev/null && pwd -P || printf '%s' "$dir")"
    [ "$dir_real" = "$here" ] || foreign="${foreign}${foreign:+ }$dir"
  done < <(printf '%s\n' "$owners" | sort -u)
  [ -z "$foreign" ] && return 0
  echo "[bench] ⛔ the compose project '$COMPOSE_PROJECT_NAME' belongs to ANOTHER copy of this instance: $foreign" >&2
  echo "[bench]    this copy is $here. Under one project name the two are ONE bench: this run would recreate its" >&2
  echo "[bench]    containers from these files and adopt its database. Nothing was touched." >&2
  echo "[bench]    Give this copy a bench of its own:" >&2
  echo "[bench]      COMPOSE_PROJECT_NAME=<a name of its own>  FORGE_BENCH_PORT_BLOCK=<NN nothing listens on>" >&2
  exit 1
}

# bench_prepare — everything `up`, `down` and `compose` share, in the order that makes each step's refusal speak
# before anything is touched.
bench_prepare() {
  bench_load_declarations
  bench_ports
  bench_address
  bench_images
  bench_source_secrets
  if bench_multi_tenant; then
    # More than one tenant: the admin runs in HOST MODE, as production runs a multi-brand box — no tenant
    # pinned, no per-tenant login-driver (it would win over the platform credential), the tenant decided by
    # the admin address the browser opened (section 1b).
    export FORGE_ADMIN_TENANT='' FORGE_ADMIN_SERVICE_TOKEN=''
  else
    # The admin serves the bench's one tenant.
    export FORGE_ADMIN_TENANT="${FORGE_ADMIN_TENANT-${FORGE_REF_TENANT:-}}"
  fi
  bench_expand_declarations
  bench_project
}
