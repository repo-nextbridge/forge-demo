#!/usr/bin/env bash
# ★★ `docker build`, WITH A CEILING AND A CONSCIENCE. SOURCE it; do not execute it.
#
#   . "$here/bin/docker-retry.sh"
#   docker_build_retry <every argument you would have passed to `docker build`>
#
# ── WHY (caderno §B2, measured 2026-09-07) ───────────────────────────────────────────────────────────────
#
# Docker Hub answered **500** to the HEAD request for `node:24-slim` while this box was being baked. The
# admin image did not rebuild and `bin/build-local.sh` refused to write the lock — correctly; that refusal
# is the heart of the design and nothing here weakens it. What was missing is that a human then ran
# `docker pull` and repeated the command. In a pipeline that is a red build with no cause of its own, and
# the habit it teaches — re-run CI without reading it — costs more than the outage did.
#
# ⚠️ AND A RETRY IS NOT `|| true`. The verdict comes from `bin/registry-transient.mjs`, which is tested
# against buildkit output measured on this workstation, and its rule is structural: a failure INSIDE a build
# step is never repeated (that is how a one-in-three defect becomes a green), a registry ANSWERING (404,
# unauthorized, unknown manifest) is never repeated, and anything it does not recognise is not repeated
# either. Only transport and registry-side illness — 5xx, 429, TLS/timeout/reset/EOF/DNS — buys an attempt.
#
# ★ IT SAYS EVERY REPEAT OUT LOUD, with the reason and the wait. A silent retry hides a sick registry: the
# builds go green, nobody learns the mirror has been failing one call in five, and the day it fails five in
# five there is no history. The lines go to stderr under `[docker-retry]`, next to everything else these
# scripts say.
#
# ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────────────────────────────────
#
# It does not `docker pull` for you. The operator's manual fix was `docker pull` + re-run, and the pull is
# the part that was never necessary: `docker build` resolves and fetches what it needs on its own, and a
# pull inserted here would be a second place that decides which base image this build uses.
#
# ⚠️ THE OUTPUT IS TEED, NOT SWALLOWED. buildkit's progress goes to stderr and an operator watching a bake
# needs to keep seeing it, so every attempt streams as before AND lands in a file the classifier reads. A
# capture that replaced the stream would trade a registry blip for a four-minute silence.

# ⚠️ IT RUNS NODE ON THE HOST — the classifier is a node process out here, not in a container — so this file
# checks the floor itself instead of trusting whoever sourced it. `bin/node-floor.guard.mjs` derives that
# rule from every `bin/*.sh` that starts node, and it caught this file the first time it existed. The three
# bake scripts already refuse before they source this, so the second call is a silent no-op; a fourth caller
# that forgets gets the refusal here, which is the whole point of not keeping a list.
#
# `return 1` and not `exit 1` because this file is SOURCED: killing the caller's shell from inside a library
# is the wrong verb. The caller then fails at `docker_build_retry: command not found`, one line under a
# refusal that already named the node it found and the floor it needed.
# shellcheck source=bin/require-node.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/require-node.sh"
require_node || return 1

# The ceiling and the waits. Three attempts, 5 s and 20 s between them: long enough for a registry to finish
# a deploy or a rate-limit window to move, short enough that a genuinely dead mirror fails the build inside a
# minute instead of holding a runner. They are variables so a pipeline can lower them for a smoke run; they
# are NOT read from a file nobody edits.
FORGE_DOCKER_RETRY_ATTEMPTS="${FORGE_DOCKER_RETRY_ATTEMPTS:-3}"
FORGE_DOCKER_RETRY_WAITS="${FORGE_DOCKER_RETRY_WAITS:-5 20}"

docker_build_retry() {
  local here attempt=1 status log wait_for reason transient
  local -a waits
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  read -r -a waits <<<"$FORGE_DOCKER_RETRY_WAITS"
  log="$(mktemp -t forge-docker-build.XXXXXX)"

  while :; do
    : >"$log"
    # `2>&1 | tee` puts the build's own exit status in PIPESTATUS[0]. It is read explicitly rather than
    # trusted to `set -o pipefail`, because this file is SOURCED and cannot assume the caller set it.
    docker build "$@" 2>&1 | tee "$log" >&2
    status="${PIPESTATUS[0]}"
    if [ "$status" -eq 0 ]; then
      rm -f "$log"
      return 0
    fi

    # One question, one answer, and both halves of it are used: the exit code is the verdict, the stdout is
    # the sentence the operator reads.
    if reason="$(node "$here/bin/registry-transient.mjs" "$log")"; then transient=yes; else transient=no; fi

    if [ "$transient" = no ]; then
      # Red NOW, on the first answer. This is the half that makes the retry a decision instead of `|| true`.
      echo "[docker-retry] NOT retrying — $reason." >&2
      rm -f "$log"
      return "$status"
    fi

    if [ "$attempt" -ge "$FORGE_DOCKER_RETRY_ATTEMPTS" ]; then
      # The ceiling. Said out loud even though the failure WAS transient: "we ran out of attempts" and "this
      # was never going to work" are different sentences, and the reader has to be told which one this was.
      echo "[docker-retry] GIVING UP after $attempt attempt(s) — $reason." >&2
      echo "[docker-retry]   Every attempt failed the same transitory way. That points at the registry, not" >&2
      echo "[docker-retry]   at this tree: the red above has no cause of its own here." >&2
      rm -f "$log"
      return "$status"
    fi

    wait_for="${waits[attempt - 1]:-${waits[-1]:-5}}"
    echo "[docker-retry] attempt $attempt of $FORGE_DOCKER_RETRY_ATTEMPTS failed: $reason." >&2
    echo "[docker-retry]   That is not this tree's fault, so it is being repeated in ${wait_for}s." >&2
    echo "[docker-retry]   ⚠️ If you read this often, the registry is sick — and THAT is the finding." >&2
    sleep "$wait_for"
    attempt=$((attempt + 1))
  done
}
