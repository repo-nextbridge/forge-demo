#!/usr/bin/env bash
# BRING UP THIS INSTANCE'S BENCH — your box, on this machine, running the images forge.lock pins.
#
#   bash bench/up.sh                                        the bench declared in bench/bench.env
#   COMPOSE_PROJECT_NAME=shop-b FORGE_BENCH_PORT_BLOCK=71 bash bench/up.sh   a second one beside it
#   bash bench/promote.sh <host or IP | tailnet | localhost>  where it is reached (re-runs this when it is up)
#
# Needs Docker with compose 2.24+ (the `!override`/`!reset` merge tags), `jq` and `curl` — nothing from the Forge repository, no Node on this machine.
# It returns when the box is up; the containers keep running. `bash bench/down.sh` takes it down.
#
# The steps, each idempotent (a second `up` converges on the same box):
#   1. the bench's own secrets and the mailbox certificate (minted once, kept in .forge-bench/)
#   2. postgres + redis + the mailbox
#   3. migrate — the one-shot production runs before every `up`
#   4. provision — the tenant, its store and the first operator, by production's own one-shot (`provision-ref`);
#      the credentials it prints once are filed in .forge-bench/secrets.env and never printed
#   5. everything else: the kernel, the edge, and each front AS DECLARED (image · build · external · none) —
#      and, on a promoted bench, its https doors (edge-tls for a host or IP, `tailscale serve` for the tailnet)
#   6. proofs of what the bench OWNS: the kernel answers, the doors are routed (https too, when promoted), the
#      mailbox is up
#   7. the seed hook this instance declares (FORGE_BENCH_SEED_HOOK), if any
set -euo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

for arg in "$@"; do
  case "$arg" in
    -h | --help)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) bench_die "unknown argument '$arg' (bench/up.sh takes none; the bench is declared in bench/bench.env)" ;;
  esac
done

started_at="$(date +%s)"
# A destination this run cannot serve (a tailnet with no name) is refused, not guessed.
BENCH_STRICT_ADDRESS=1
bench_prepare
# Every front declaration is read, and refused if malformed, BEFORE the first side effect.
for front in "${BENCH_FRONTS[@]}"; do bench_front_mode "$front" >/dev/null || exit 1; done
bench_refuse_foreign_project
[ -n "$FORGE_ADMIN_TENANT" ] || bench_die "bench/bench.env names no FORGE_REF_TENANT — the bench is born with one tenant and the admin serves it."
# The tailnet's doors are read, and a door somebody else holds refused, before anything is started.
[ "$BENCH_DESTINATION" != tailnet ] || bench_tailnet_check

bench_say "project '$COMPOSE_PROJECT_NAME' · port block ${FORGE_BENCH_PORT_BLOCK:-82}xx · ${FORGE_KERNEL_VERSION} × ${FORGE_COMPOSITION_ID}"
if [ "$BENCH_DESTINATION" = localhost ]; then
  bench_say "address: localhost — from $BENCH_ADDRESS_SOURCE"
else
  bench_say "address: $BENCH_HOST ($BENCH_DESTINATION) — from $BENCH_ADDRESS_SOURCE"
fi
[ -z "$BENCH_PORTS_KEPT" ] || bench_say "  kept as overrides (set in the shell or bench/bench.env): $BENCH_PORTS_KEPT"
# What the previous run served, read before this one overwrites it: the destination it left, and the address
# a front YOU run was handed.
previous_destination="${BENCH_LAST_DESTINATION:-}"
previous_origin="$(sed -n 's/^FORGE_BENCH_ORIGIN=//p' "$BENCH_STATE/fronts.env" 2>/dev/null || true)"
previous_admin_origin="$(sed -n 's/^FORGE_BENCH_ADMIN_ORIGIN=//p' "$BENCH_STATE/fronts.env" 2>/dev/null || true)"

# ── 1 ──────────────────────────────────────────────────────────────────────────────────────────────────────
bench_say '1/7 the bench secrets and the mailbox certificate'
bench_secrets
mkdir -p "$BENCH_STATE/mail"
if [ ! -s "$BENCH_STATE/mail/bench-mail.crt" ]; then
  # Minted with the openssl INSIDE the postgres image the bench pulls anyway — no openssl needed on this machine.
  # Dated far out so it cannot expire into a mystery; it is trusted by one kernel, on this machine only.
  docker run --rm --user "$(id -u):$(id -g)" -v "$BENCH_STATE/mail:/out" postgres:18 \
    openssl req -x509 -newkey rsa:2048 -nodes -days 36500 -subj /CN=mailpit \
    -addext subjectAltName=DNS:mailpit -keyout /out/bench-mail.key -out /out/bench-mail.crt >/dev/null 2>&1 ||
    bench_die 'could not mint the mailbox certificate (docker run postgres:18 openssl).'
  chmod 644 "$BENCH_STATE/mail/bench-mail.key" "$BENCH_STATE/mail/bench-mail.crt"
fi
# The fronts as declared — written now so every compose call below sees the same services.
bench_fronts_overlay

# ── 2 ──────────────────────────────────────────────────────────────────────────────────────────────────────
bench_say '2/7 postgres + redis + the mailbox'
bench_compose up -d --wait postgres redis mailpit

# ── 3 ──────────────────────────────────────────────────────────────────────────────────────────────────────
bench_say '3/7 migrate'
bench_compose run --rm --no-deps kernel node dist/migrate.js >&2

# ── 4 ──────────────────────────────────────────────────────────────────────────────────────────────────────
bench_say "4/7 provision — tenant '$FORGE_REF_TENANT', store '${FORGE_REF_STORE_HANDLE:-}', operator ${FORGE_ADMIN_SEED_EMAIL:-(none)}"
out="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "$out" "$err"' EXIT
if ! bench_compose run --rm --no-deps kernel node dist/provision-ref.js >"$out" 2>"$err"; then
  # The output may carry credentials, each on the line after a label naming a token: those lines are dropped.
  awk 'skip { skip = 0; next } /token/ { skip = 1 } { print }' "$err" >&2 || true
  bench_die 'provisioning failed (above).'
fi
store_id="$(tail -1 "$out" | tr -d '\r\n[:space:]')"
[ -n "$store_id" ] || bench_die 'provisioning returned no store id.'
# The two credentials ride out on stderr, each on the line after its label. Read here, filed, never echoed.
# @env FORGE_BENCH_OPERATOR_TOKEN optional — The operator credential an instance bench's provisioning minted, filed in .forge-bench/secrets.env (never printed) for an admin or a script of your own.
operator_token="$(sed -n '/operator token/{n;s/^[[:space:]]*//;p;q;}' "$err")"
driver_token="$(sed -n '/login-driver token/{n;s/^[[:space:]]*//;p;q;}' "$err")"
bench_put_secret FORGE_BENCH_OPERATOR_TOKEN "$operator_token"
bench_put_secret FORGE_ADMIN_SERVICE_TOKEN "$driver_token"
# The counts are worth seeing (every `up` re-mints, so the previous pair is retired); the advice that follows
# them in the one-shot's output ("capture the one above") is not this run's — the bench already filed them.
grep -E 'retired|hostname claimed' "$err" | sed -e 's/ — any .*$/ (re-minted and filed by the bench)/' \
  -e 's/^[[:space:]]*/[bench]   /' >&2 || true
rm -f "$out" "$err"
bench_source_secrets
[ -n "${FORGE_ADMIN_SERVICE_TOKEN:-}" ] ||
  bench_say "  ⚠️ no admin login-driver was minted (FORGE_ADMIN_SEED_EMAIL is empty?) — an admin from forge.lock will not let anyone in."

# The store the shop's door serves. Host routing is DATA in production (the store's public URL, set in the
# admin); on the bench the fronts' override map says it, keyed on the host a browser sends — every host this
# bench is reached at (the promoted one, the tailnet IP, and localhost for this machine's own browser).
hosts_json=''
for host in $(bench_store_hosts); do hosts_json="${hosts_json}${hosts_json:+,}\"$host\":\"$store_id\""; done
export FORGE_STORE_HOSTS="{$hosts_json}"
{
  printf 'FORGE_BENCH_STORE_ID=%s\n' "$store_id"
  printf "FORGE_STORE_HOSTS='%s'\n" "$FORGE_STORE_HOSTS"
  printf 'BENCH_LAST_DESTINATION=%s\n' "$BENCH_DESTINATION"
} >"$BENCH_STATE/state.env"

# What a front YOU run on this machine reads to reach this kernel — the same names the fronts in forge.lock
# are given by compose. Credentials are not in it: the operator credential stays in secrets.env.
cat >"$BENCH_STATE/fronts.env" <<EOF
# GENERATED by bench/up.sh — the kernel this bench runs, for a front declared external. Source it:  set -a; . .forge-bench/fronts.env; set +a
FORGE_READ_BASE_URL=$FORGE_BENCH_KERNEL_URL
FORGE_COMMAND_BASE_URL=$FORGE_BENCH_KERNEL_URL
FORGE_API_BASE_URL=$FORGE_BENCH_KERNEL_URL
FORGE_STORE_HOSTS='$FORGE_STORE_HOSTS'
FORGE_STORE_ID=$store_id
FORGE_ADMIN_TENANT=$FORGE_ADMIN_TENANT
FORGE_MEDIA_BASE_URL=$FORGE_MEDIA_BASE_URL
FORGE_REVALIDATE_SECRET=${FORGE_REVALIDATE_SECRET:-}
FORGE_BENCH_ORIGIN=$FORGE_BENCH_ORIGIN
FORGE_BENCH_ADMIN_ORIGIN=$FORGE_BENCH_ADMIN_ORIGIN
EOF

# ── 5 ──────────────────────────────────────────────────────────────────────────────────────────────────────
bench_say '5/7 the kernel, the edge and the fronts as declared'
for front in "${BENCH_FRONTS[@]}"; do bench_say "  $front: $(bench_front_mode "$front")"; done
bench_compose up -d --wait --remove-orphans
case "$BENCH_DESTINATION" in
  host)
    bench_say "  the https edge (edge-tls) for $BENCH_HOST — :$FORGE_HTTPS_PORT shop · :$FORGE_ADMIN_HTTPS_PORT admin"
    bench_tls_edge_up
    ;;
  tailnet)
    bench_tls_edge_down
    bench_say "  tailscale serve for $BENCH_HOST — :$FORGE_HTTPS_PORT shop · :$FORGE_ADMIN_HTTPS_PORT admin"
    bench_tailnet_publish
    ;;
  *) bench_tls_edge_down ;;
esac
[ "$previous_destination" != tailnet ] || [ "$BENCH_DESTINATION" = tailnet ] || bench_tailnet_release_notice

# ── 6 ──────────────────────────────────────────────────────────────────────────────────────────────────────
# Only what the bench OWNS. A front's page is the front's business: a vanilla storefront, a fork and a Vue app
# answer `/` differently and all correctly, so grading it here would be grading OUR front.
bench_say '6/7 proving what the bench owns'
http_code() {
  local trust=()
  # A promoted door answers with the bench's local CA or your certificates (bench_tls_edge_up wrote both into
  # trust.pem); a tailnet door with a public one, which this machine already trusts.
  case "$1" in https://*) [ -s "$BENCH_STATE/trust.pem" ] && trust=(--cacert "$BENCH_STATE/trust.pem") ;; esac
  curl -s ${trust[@]+"${trust[@]}"} -o /dev/null -m 10 -w '%{http_code}' "$1" 2>/dev/null || true
}
proved=0
check() { # <what> <url> <want>
  local got
  got="$(http_code "$2")"
  if [ "$got" = "$3" ]; then
    bench_say "  ✅ $1 — $2 → $got"
  else
    bench_say "  ❌ $1 — $2 → ${got:-no answer} (want $3)"
    proved=1
  fi
}
check 'the kernel answers' "$FORGE_BENCH_KERNEL_URL/health" 200
check 'the mailbox answers' "http://127.0.0.1:$FORGE_MAIL_HTTP_PORT/api/v1/info" 200
# The admin's door is routed when the edge answers on it at all; WHAT it answers is the admin's.
admin_door() { # <origin>
  local code
  code="$(http_code "$1/")"
  case "$code" in
    '' | 000) bench_say "  ❌ the admin's door — $1/ does not answer" && proved=1 ;;
    *) bench_say "  ✅ the admin's door is routed — $1/ answers $code (what it answers is the admin's, not graded)" ;;
  esac
}
loopback_origin="http://localhost:$FORGE_HTTP_PORT"
loopback_admin_origin="http://localhost:$FORGE_ADMIN_HTTP_PORT"
if [ "$BENCH_DESTINATION" = localhost ]; then
  check "the shop's door routes to the kernel" "$FORGE_BENCH_ORIGIN/health" 200
  admin_door "$FORGE_BENCH_ADMIN_ORIGIN"
else
  # Promoted: the loopback doors keep serving this machine, and the https doors are the promotion's.
  check "the shop's loopback door routes to the kernel" "$loopback_origin/health" 200
  admin_door "$loopback_admin_origin"
  check "the shop's https door routes to the kernel" "$FORGE_BENCH_ORIGIN/health" 200
  admin_door "$FORGE_BENCH_ADMIN_ORIGIN"
fi
[ "$proved" = 0 ] || bench_die 'the bench is up but something it owns is not answering (above).'

# ── 7 ──────────────────────────────────────────────────────────────────────────────────────────────────────
# @env FORGE_BENCH_SEED_HOOK optional — A command of the instance an instance bench runs after the box is up, to seed it (bench/bench.env). Empty: the store is born with nothing in it.
if [ -n "${FORGE_BENCH_SEED_HOOK:-}" ]; then
  bench_say "7/7 the seed hook: $FORGE_BENCH_SEED_HOOK"
  token_file="$BENCH_STATE/operator.token"
  (umask 077 && printf '%s' "${FORGE_BENCH_OPERATOR_TOKEN:-}" >"$token_file")
  # The hook gets the credential as a FILE, and none of the bench's secrets in its environment.
  (cd "$BENCH_ROOT" && env -u FORGE_BENCH_OPERATOR_TOKEN -u FORGE_ADMIN_SERVICE_TOKEN -u FORGE_VAULT_KEY \
    -u FORGE_BENCH_POSTGRES_PASSWORD FORGE_BENCH_TENANT="$FORGE_REF_TENANT" FORGE_BENCH_STORE_ID="$store_id" \
    FORGE_BENCH_OPERATOR_TOKEN_FILE="$token_file" bash -c "$FORGE_BENCH_SEED_HOOK") ||
    bench_die "the seed hook failed: $FORGE_BENCH_SEED_HOOK"
else
  bench_say '7/7 no seed hook declared (FORGE_BENCH_SEED_HOOK) — the store is born empty'
fi

# ── the doors, and what the bench did NOT prove ──────────────────────────────────────────────────────────────
echo >&2
if [ "$BENCH_DESTINATION" = localhost ]; then
  bench_say "up in $(($(date +%s) - started_at)) s. Doors (loopback):"
else
  bench_say "up in $(($(date +%s) - started_at)) s. Doors — promoted to $BENCH_HOST ($BENCH_DESTINATION):"
fi
bench_say "  shop      $FORGE_BENCH_ORIGIN/            (storefront; /checkout and /account go to the checkout)"
bench_say "  admin     $FORGE_BENCH_ADMIN_ORIGIN/"
[ "$BENCH_DESTINATION" = localhost ] ||
  bench_say "  …and on this machine, still: $loopback_origin/ · $loopback_admin_origin/   (back: bash bench/promote.sh localhost)"
bench_say "  mailbox   http://127.0.0.1:$FORGE_MAIL_HTTP_PORT/     (every message this bench sends — the login codes are here)"
bench_say "  kernel    $FORGE_BENCH_KERNEL_URL     (the API; for a front or a script on this machine)"
bench_tls_notice
bench_say "  store $store_id · tenant $FORGE_REF_TENANT · operator ${FORGE_ADMIN_SEED_EMAIL:-(none)}"
bench_say "  the operator credential is filed in .forge-bench/secrets.env (FORGE_BENCH_OPERATOR_TOKEN) — never printed"
for front in "${BENCH_FRONTS[@]}"; do
  mode="$(bench_front_mode "$front")"
  case "$mode" in
    image) bench_say "  $front: the image forge.lock pins — its container is healthy; what it serves is not graded here" ;;
    build:*) bench_say "  $front: built from ./${mode#build:} — its container is healthy; what it serves is not graded here" ;;
    external:*)
      bench_say "  $front: EXTERNAL (${mode#external:}) — the door is routed; your process is yours to run and the bench does not prove it."
      bench_say "    it reads the kernel from:  set -a; . .forge-bench/fronts.env; set +a   and listens on 0.0.0.0:${mode##*:}"
      bench_say "    until it listens, its door answers 502 (the edge reaching nothing) — $(bench_front_door "$front")"
      # ★ THE ADDRESS IS THE ONE THING A FRONT OF YOURS CANNOT DERIVE: the bench recomputed it, and a process it
      # does not run keeps the value it read at start. Said every time the address moved, naming the new one.
      case "$front" in
        admin) old="$previous_admin_origin" new="$FORGE_BENCH_ADMIN_ORIGIN" ;;
        *) old="$previous_origin" new="$FORGE_BENCH_ORIGIN" ;;
      esac
      if [ -n "$old" ] && [ "$old" != "$new" ]; then
        bench_say "    ⚠️ THE ADDRESS MOVED: $old → $new. Your $front still has the old one until it re-reads"
        bench_say "       .forge-bench/fronts.env (FORGE_BENCH_ORIGIN, FORGE_BENCH_ADMIN_ORIGIN, FORGE_STORE_HOSTS) — restart it."
      elif [ "$BENCH_DESTINATION" != localhost ]; then
        bench_say "    it is reached at $new — the public origin it has to use (FORGE_BENCH_ORIGIN / FORGE_BENCH_ADMIN_ORIGIN in fronts.env)."
      fi
      ;;
    none) bench_say "  $front: NONE — its door answers 503 by declaration" ;;
  esac
done
case "$(bench_front_mode admin)" in
  image) bench_say "  sign in: $FORGE_BENCH_ADMIN_ORIGIN/login as ${FORGE_ADMIN_SEED_EMAIL:-?}; the code is in the mailbox (or: bash bench/mail.sh)" ;;
  *)
    bench_say "  NOT PROVED: any admin login — this bench runs no admin of forge.lock's. An admin of your own reaches"
    bench_say "  the kernel at $FORGE_BENCH_KERNEL_URL with the operator credential (FORGE_BENCH_OPERATOR_TOKEN in"
    bench_say "  .forge-bench/secrets.env) and the header x-forge-tenant: $FORGE_REF_TENANT."
    ;;
esac
bench_say "  logs: bash bench/compose.sh logs -f kernel · down: bash bench/down.sh (keeps the data) · bash bench/down.sh -v (drops it)"
