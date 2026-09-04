#!/usr/bin/env bash
# THE HOST'S NODE FLOOR. SOURCE it; do not execute it.
#
#   . "$HERE/bin/require-node.sh"
#   require_node || exit 1        # first line of the script, before it reads or writes anything
#
# ── WHY A BOX NEEDS THIS AT ALL ─────────────────────────────────────────────────────────────────────────
#
# This box runs half its birth on the HOST. `bin/seed-box.mjs`, `bin/seed.mjs`, `bin/verify-seed.mjs` and
# `bin/dataset-provenance.mjs` are node processes on the operator's machine, not in a container — so the
# node the operator happens to have is a real input of the install, as much as `.env` is.
#
# F13 of the from-zero install rehearsal (2026-09-04) is what put this here. Two `node` binaries live on
# that machine and the interactive PATH resolves to the SMALLER one:
#
#     the shell resolves   ->  ~/.local/bin/node                        v22.22.3
#     nvm holds            ->  ~/.nvm/versions/node/v24.18.0/bin/node   v24.18.0  (+ pnpm 11.5.0)
#     the product declares ->  the Forge monorepo's package.json: "node": ">=24"
#
# Every birth of that night ran on v22 — under the floor — and every one of them WORKED. That is exactly
# why it is worth refusing: *it ran* is not *it is supported*, and nothing on the box could tell those two
# apart. The next release that uses a Node 24 API would fail somewhere deep in a seeder, at minute nine of
# a nineteen-minute birth, naming a syntax error instead of naming the real cause.
#
# ⚠️ AND IN A CRON THERE IS NO NODE AT ALL. `env -i` with a minimal PATH finds neither `node` nor `pnpm` on
# that machine — only the nvm directory holds the compatible pair. The scheduled reset of this demo runs in
# exactly that environment, so "no node on PATH" is a first-class answer here, not an edge case.
#
# ── ⚠️ WHY THE NUMBER IS TYPED HERE, WHICH IS THE PART TO DISLIKE ───────────────────────────────────────
#
# One number in two files is two truths that age apart in silence, so deriving it was tried first. It is
# not reachable from this repository. Measured on 2026-09-04, against the monorepo at `pk7/integra`:
#
#   * `"engines": { "node": ">=24" }` exists in the monorepo's ROOT package.json and NOWHERE else — zero
#     hits across every package.json under `packages/` and `apps/`. So no published `@forgecommerce/*`
#     package carries it, and the vendored tarballs this repo installs cannot answer the question either.
#   * `forge.lock` — the file this box PINS the product with — has no node field, and it is not ours to
#     add one to: it is written by the product (`infra/cicd/write-forge-lock.sh`) and verified by it
#     (`infra/cicd/verify-forge-lock.sh`). A lock stamped by a promoted release would simply not have it.
#   * `templates/instance/` — the shape a real instance ships as — has no `.nvmrc`, no `.node-version` and
#     no `package.json`. There is nothing in an instance's own files that states a node version.
#   * This repository's four package.json files (`totem/`, `storefront-coffee/`, `apps/*`) declare no
#     `engines` either.
#
# ⇒ So it is declared HERE, once, and tied back to the product in the one place where this repository
#   genuinely holds it: `bin/build-local.sh` takes the monorepo checkout as its argument, and it now reads
#   `engines.node` from there and REFUSES to bake images if that number and this one have drifted apart.
#   `bin/node-floor.guard.mjs` proves both halves — the refusal, by running it against fake node binaries
#   in both directions, and the single truth, by grepping every tracked file for a second copy.
#
# ★ THE RIGHT FIX IS UPSTREAM, and it belongs to the product, not here: if `forge.lock` carried the node
#   floor of the release it pins, this file would read it and the declaration below would be deleted. That
#   is a change to `infra/cicd/write-forge-lock.sh` and `templates/instance/`, in the monorepo.

# The floor. MAJOR only: `>=24` is a floor on the major, and this box has no opinion about the minor.
FORGE_DEMO_NODE_MIN_MAJOR=24

# The refusal. It names the version, WHERE that version came from, and the floor — because on the bench
# that produced this file, the answer to "which node?" was a PATH question, not a version question.
require_node() {
  local floor="$FORGE_DEMO_NODE_MIN_MAJOR" path found major

  path="$(command -v node 2>/dev/null || true)"
  if [ -z "$path" ]; then
    printf '\n[node] refusing to start: there is no `node` on PATH, and this box runs seeders on the HOST.\n' >&2
    printf '       PATH      %s\n' "${PATH:-<empty>}" >&2
    printf '       required  node major >= %s  (bin/require-node.sh)\n' "$floor" >&2
    printf '       Nothing has been read, started or written.\n' >&2
    printf '       A cron or a systemd unit inherits a minimal PATH and usually has neither `node` nor\n' >&2
    printf '       `pnpm`. Give it the directory that holds Node %s — under nvm that is\n' "$floor" >&2
    printf '       ~/.nvm/versions/node/v%s.*/bin — before it runs this.\n\n' "$floor" >&2
    return 1
  fi

  found="$("$path" -v 2>/dev/null)"
  major="${found#v}"
  major="${major%%.*}"
  case "$major" in
    '' | *[!0-9]*)
      printf '\n[node] refusing to start: `node -v` answered something this check cannot read.\n' >&2
      printf '       answered  %s\n' "${found:-<nothing>}" >&2
      printf '       from      %s\n' "$path" >&2
      printf '       required  node major >= %s  (bin/require-node.sh)\n' "$floor" >&2
      printf '       Nothing has been read, started or written. A version this script cannot grade is not\n' >&2
      printf '       a version it may assume is fine — put a known Node %s on PATH (`nvm use %s`).\n\n' "$floor" "$floor" >&2
      return 1
      ;;
  esac

  if [ "$major" -lt "$floor" ]; then
    printf '\n[node] refusing to start: the node on this PATH is older than the Forge kernel supports.\n' >&2
    printf '       found     %s\n' "$found" >&2
    printf '       from      %s\n' "$path" >&2
    printf '       required  node major >= %s  (bin/require-node.sh)\n' "$floor" >&2
    printf '       Nothing has been read, started or written — this is the first thing the script does.\n' >&2
    printf '       Put a Node %s on PATH and run it again:  nvm use %s\n' "$floor" "$floor" >&2
    printf '       (or prepend the directory that holds it, e.g. ~/.nvm/versions/node/v%s.*/bin).\n' "$floor" >&2
    printf '       ⚠️ An older node may well APPEAR to work. Every birth of 2026-09-03 ran on v22 and\n' >&2
    printf '       finished green; that is the reason this refusal exists rather than a warning.\n\n' >&2
    return 1
  fi

  return 0
}
