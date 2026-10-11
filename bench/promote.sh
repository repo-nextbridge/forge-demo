#!/usr/bin/env bash
# POINT THIS INSTANCE'S BENCH AT AN ADDRESS, OR BACK AT `localhost`. ONE GESTURE.
#
#   bash bench/promote.sh <host or IP>   any address this machine is really reachable at (a LAN IP, a VPN address,
#                                        a DNS name): https by the bench's own Caddy (edge-tls), with its local CA
#                                        (.forge-bench/ca.crt) or your certificates (FORGE_BENCH_TLS_CERT_DIR)
#   bash bench/promote.sh tailnet        this machine on its tailnet: https by `tailscale serve`
#                                        (FORGE_TAILNET_HOST, or the name `tailscale status` reports)
#   bash bench/promote.sh localhost      the promotion undone — the bench back on this machine only
#   … --no-restart                       only declare it; the next `bash bench/up.sh` is born there
#
# The same verb and the same three destinations as the Forge repository's bench (`pnpm bench:promote`) and the
# reference instance (`bin/box-up.sh --promote`): the bench is BORN on `localhost`; the tailnet is one
# destination, not the definition.
#
# What it does:
#   1. resolves the destination exactly as `bench/up.sh` will, and refuses one it could not serve — before
#      writing anything (for the tailnet, that includes a door another bench already holds there);
#   2. writes it to .forge-bench/address.env (git-ignored, this copy only; `bench/down.sh -v` forgets it);
#   3. re-runs `bench/up.sh` when this bench is up, because EVERY address-dependent value is derived there and
#      nowhere else — the store's hosts, the media base, the admin's public URLs, the doors proven, which https
#      edge exists. A front YOU run (external) is not restarted: the run names the address it has to learn.
#
# ⚠️ IT NEVER CONFIGURES THE NETWORK. It does not `tailscale up`, open a firewall or touch DNS — getting this
# machine onto the network is yours. It never executes `tailscale` for a destination that is not `tailnet`, and
# leaving the tailnet it PRINTS the lines that release the bench's doors there rather than running them.
set -euo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

usage() { sed -n '2,11p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; }

where=''
restart=1
for arg in "$@"; do
  case "$arg" in
    --no-restart) restart=0 ;;
    -h | --help) usage && exit 0 ;;
    -*) usage && bench_die "unknown option '$arg'" ;;
    *)
      [ -z "$where" ] || bench_die "one destination, not two ('$where', '$arg')."
      where="$arg"
      ;;
  esac
done
[ -n "$where" ] || { usage; bench_die 'bench/promote.sh needs a DESTINATION, and it will not guess one.'; }

# ⚠️ EVERYTHING BELOW RUNS IN SUBSHELLS, so this process keeps the environment it was started with: the
# bring-up it re-runs reads the shell to tell a developer's own values from the bench's derived ones, and a
# promotion that handed it its own exports had every port "kept as an override" and fifteen derived names
# reported as production's (measured on the first live run, 2026-10-10).

# 1+2. Resolve it the way the bring-up will — a destination it would refuse is refused HERE, nothing written —
# and declare it.
(
  BENCH_STRICT_ADDRESS=1
  bench_load_declarations
  bench_ports
  # Where the bench is declared today, read before the new destination is written.
  bench_declared_address
  previous="$BENCH_DECLARED"
  previous_source="$BENCH_ADDRESS_SOURCE"
  if [ -n "$BENCH_SHELL_ADDRESS" ] && [ "$BENCH_SHELL_ADDRESS" != "$where" ]; then
    bench_say "note: this shell exports FORGE_BENCH_ADDRESS=$BENCH_SHELL_ADDRESS, and the shell wins over a promotion — every"
    bench_say "      later \`bash bench/up.sh\` from this shell would go back there. \`unset FORGE_BENCH_ADDRESS\` to keep this one."
  fi
  bench_resolve_address "$where" || exit 1
  [ "$BENCH_DESTINATION" != tailnet ] || bench_tailnet_check
  # The file is rewritten whole: run it three times, it is what running it once left.
  mkdir -p "$BENCH_STATE"
  {
    echo '# WRITTEN by bench/promote.sh — where this bench is reached. `bash bench/promote.sh localhost` to go back.'
    printf 'FORGE_BENCH_ADDRESS=%s\n' "$where"
    # A tailnet name read from `tailscale status` is kept, so the later runs of this bench need not ask again.
    [ "$BENCH_DESTINATION" != tailnet ] || [ -n "${FORGE_TAILNET_HOST:-}" ] || printf 'FORGE_TAILNET_HOST=%s\n' "$BENCH_HOST"
  } >"$BENCH_ADDRESS_FILE.tmp"
  mv "$BENCH_ADDRESS_FILE.tmp" "$BENCH_ADDRESS_FILE"
  bench_say "FORGE_BENCH_ADDRESS=$where written to .forge-bench/address.env (was: $previous, from $previous_source)"
  printf '%s' "$previous" >"$BENCH_STATE/.promote-previous"
) || exit 1
previous="$(cat "$BENCH_STATE/.promote-previous")"
rm -f "$BENCH_STATE/.promote-previous"

# The bench as the bring-up will see it, in a subshell: is it up (owned by this copy), and the closing notes.
bench_with_promotion() {
  BENCH_STRICT_ADDRESS=1
  FORGE_BENCH_ADDRESS='' # the promotion — not this shell — names the address
  bench_prepare
  : "${FORGE_BENCH_POSTGRES_PASSWORD:=not-minted}" "${FORGE_VAULT_KEY:=not-minted}"
  export FORGE_BENCH_POSTGRES_PASSWORD FORGE_VAULT_KEY
}

if [ "$restart" = 1 ]; then
  state="$(
    bench_with_promotion
    bench_refuse_foreign_project
    if [ -n "$(docker ps --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --filter status=running -q 2>/dev/null)" ]; then
      printf 'up %s' "$COMPOSE_PROJECT_NAME"
    else
      printf 'down %s' "$COMPOSE_PROJECT_NAME"
    fi
  )" || exit 1
  if [ "${state%% *}" = up ]; then
    bench_say "the bench '${state#* }' is up — re-running bench/up.sh at '$where'"
    # An EMPTY FORGE_BENCH_ADDRESS is "the shell did not say": the bring-up reads the promotion just written.
    FORGE_BENCH_ADDRESS='' exec bash "$BENCH_ROOT/bench/up.sh"
  fi
fi
(
  bench_with_promotion
  if [ "$restart" = 1 ]; then
    # Nothing to re-run: still bring the https edge in line, so a demoted bench stops answering on the old address.
    [ "$BENCH_DESTINATION" = host ] || bench_tls_edge_down
    bench_say "the bench '$COMPOSE_PROJECT_NAME' is not up. Declared: the next \`bash bench/up.sh\` is born at '$where'."
  else
    bench_say "--no-restart: nothing was re-run. The next \`bash bench/up.sh\` is born at '$where'."
  fi
  [ "$previous" != tailnet ] || [ "$BENCH_DESTINATION" = tailnet ] || bench_tailnet_release_notice
  for front in "${BENCH_FRONTS[@]}"; do
    case "$(bench_front_mode "$front")" in
      external:*)
        if [ "$front" = admin ]; then origin="$FORGE_BENCH_ADMIN_ORIGIN"; else origin="$FORGE_BENCH_ORIGIN"; fi
        bench_say "⚠️ your $front is EXTERNAL: from the next \`up\` on it is reached at $origin — it re-reads .forge-bench/fronts.env when you restart it."
        ;;
    esac
  done
)
