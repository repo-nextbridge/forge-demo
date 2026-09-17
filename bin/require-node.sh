#!/usr/bin/env bash
# THE HOST'S NODE FLOOR, READ FROM THE PIN. SOURCE it; do not execute it.
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
#     the product declared ->  the Forge monorepo's package.json: "node": ">=24"
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
# ── ★★ WHERE THE NUMBER COMES FROM: THE LOCK, BECAUSE THE FLOOR IS A PROPERTY OF THE RELEASE ─────────────
#
# The first version of this file TYPED the floor, and said at length why it had to: the number lived in the
# monorepo's root package.json and in no artifact this box receives — not in a published `@forgeco/*`
# package, not in `templates/instance/`, and not in `forge.lock`. One number in two repositories is two
# truths that age apart in silence, on the day the product raises its floor and nobody edits the other side.
#
# The product closed that (pk8/p4): `forge.lock` — the file this box PINS the product with — now carries
#
#     "node": { "minMajor": 24, "engines": ">=24" }
#
# stamped by `infra/cicd/write-forge-lock.sh` (and by `bin/build-local.sh` here, for a pre-release build),
# both through the one derivation `infra/cicd/node-floor.sh`. `minMajor` is the integer ALREADY RESOLVED,
# because everything that acts on the floor is a shell and a shell has no semver; `engines` is the range
# verbatim, the evidence the integer came from somewhere. This file reads `minMajor` and nothing else:
# re-resolving the range here would be a second derivation, which is the disease, not the cure. (The
# product's own `infra/cicd/verify-forge-lock.sh` is what holds the two against each other.)
#
# ⚠️ A LOCK WITHOUT THE FIELD IS A VALID PIN, AND THAT IS DELIBERATE. The field is an ADDITION to an
# artifact that has already left the product's hands, and the lifecycle is forward-only: every lock stamped
# before it exists has no `node` key. Refusing those would turn a box pinned on an older release red over a
# field its release could not possibly carry. So the answer is the product's own, in the product's own
# words — this box has no floor to check and must not invent one — printed rather than swallowed, because
# silence there is how a box goes back to being born on whatever the shell resolved.

# The lock is the pin. Same variable and same default as `bin/images-from-lock.sh` and
# `bin/verify-composition.sh`, so the floor and the images are read out of ONE file: an operator who points
# FORGE_LOCK at another lock moves both together, and cannot end up grading node against one release while
# running the images of another.
: "${FORGE_LOCK:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/forge.lock}"

# The floor, out of the pin. Prints the major on stdout and returns 0 when the lock states one; returns 1
# with nothing on stdout when the lock states none (an absence, not a fault); returns 2 — after saying why
# on stderr — when the lock CLAIMS a floor this cannot be trusted to grade. The three are different answers
# and the caller treats them differently.
_forge_node_floor() {
  local raw type node_path="${1:-}"

  # ★★ THE REFUSAL IS ABOUT `jq`, AND IT MAY NOT WEAR THE `[node]` TAG. C6 (04/09), measured on a machine
  # without jq: the box refused under `[node]`, an operator reads the TAG before the paragraph, and the errand
  # it sends them on is a node they cannot fix because nothing is wrong with it. `box-up.sh` has its own
  # `command -v jq || die 'jq is required.'` and never reaches it — the floor is deliberately graded first
  # (see `require_node` below), so this is the sentence a jq-less machine actually gets. The ORDER stays; the
  # SUBJECT of the sentence is what was wrong. `bin/node-floor.guard.mjs` holds both halves against each
  # other: this one must name jq and must not say `[node]`, and the cron case (no node at all) must keep
  # saying nothing about jq.
  if ! command -v jq >/dev/null 2>&1; then
    printf '\n[jq] refusing to start: `jq` is not installed, and this box cannot read its own pin without it.\n' >&2
    printf '     missing   jq   <- install THIS; it is the only thing wrong here\n' >&2
    if [ -n "$node_path" ]; then
      printf '     node      %s  (%s)\n' "$("$node_path" -v 2>/dev/null || echo '<unreadable>')" "$node_path" >&2
      printf '               ^ found, and NOT what refused you: the floor was never graded, this stopped first\n' >&2
    fi
    printf '     lock      %s\n' "$FORGE_LOCK" >&2
    printf '     The floor this box must run travels in `forge.lock`, which is JSON; without jq nothing\n' >&2
    printf '     here can read it, and guessing is the one thing this check exists not to do.\n' >&2
    printf '     Install it (apt install jq / brew install jq) and run this again.\n' >&2
    printf '     Nothing has been read, started or written.\n\n' >&2
    return 2
  fi

  [ -f "$FORGE_LOCK" ] || return 1

  if ! jq -e . "$FORGE_LOCK" >/dev/null 2>&1; then
    printf '\n[node] refusing to start: the pin is not valid JSON, so nothing here can be read out of it.\n' >&2
    printf '       lock      %s\n' "$FORGE_LOCK" >&2
    printf '       A lock this box cannot parse is not a lock without a floor — it is a lock whose every\n' >&2
    printf '       answer is unknown, including which images to run. Nothing has been read, started or written.\n\n' >&2
    return 2
  fi

  # ★ THE ABSENCE IS DECIDED ON THE `node` KEY, exactly as the product's own verifier decides it: a lock
  # written before releases carried the floor has no key at all, and that is the one shape that proceeds.
  # A lock that HAS the key is making a claim, and every claim below is graded rather than shrugged off.
  [ "$(jq -r 'has("node")' "$FORGE_LOCK" 2>/dev/null)" = 'true' ] || return 1
  raw="$(jq -r '.node.minMajor' "$FORGE_LOCK" 2>/dev/null)"

  # A whole number, and a JSON number — not the string "24", and not 24.5. A shell would happily compare
  # either of those and mean something different by each, which is precisely how a hand-edited lock lies
  # quietly. The pin claiming a floor is a claim to honour or to refuse; it may not become the absent case.
  type="$(jq -r '.node.minMajor | type' "$FORGE_LOCK" 2>/dev/null)"
  case "$raw" in
    '' | *[!0-9]*) type='not-a-major' ;;
  esac
  if [ "$type" != 'number' ]; then
    printf '\n[node] refusing to start: the pin states a node floor this check cannot grade.\n' >&2
    printf '       lock      %s\n' "$FORGE_LOCK" >&2
    printf '       node.minMajor  %s\n' "$raw" >&2
    printf '       The floor is a whole major version, as a JSON number — it exists in that shape precisely\n' >&2
    printf '       so a shell can compare it without a semver implementation. A lock that states one this\n' >&2
    printf '       cannot read has been edited by hand; re-stamp it from a release rather than round it here.\n' >&2
    printf '       Nothing has been read, started or written.\n\n' >&2
    return 2
  fi

  printf '%s' "$raw"
}

# The refusal. It names the version, WHERE that version came from, the floor and WHICH FILE the floor came
# from — because on the bench that produced this file, the answer to "which node?" was a PATH question, not
# a version question, and the answer to "which floor?" must never be "the one somebody typed in here".
require_node() {
  local floor status path found major

  # ⚠️ THE PATH IS DECIDED FIRST, BEFORE THE PIN IS EVEN OPENED. A box with no node cannot be born whatever
  # the lock says, and the cron case (`env -i`) has no `jq` either — reading the lock first would answer a
  # missing node with a paragraph about a JSON tool.
  path="$(command -v node 2>/dev/null || true)"
  if [ -z "$path" ]; then
    printf '\n[node] refusing to start: there is no `node` on PATH, and this box runs seeders on the HOST.\n' >&2
    printf '       PATH      %s\n' "${PATH:-<empty>}" >&2
    printf '       Nothing has been read, started or written.\n' >&2
    printf '       A cron or a systemd unit inherits a minimal PATH and usually has neither `node` nor\n' >&2
    printf '       `pnpm`. Give it the directory that holds the Node this release pins — under nvm that is\n' >&2
    printf '       ~/.nvm/versions/node/v<major>.*/bin — before it runs this.\n\n' >&2
    return 1
  fi

  # The node path is HANDED OVER rather than re-resolved: the jq refusal above prints it to say "this is not
  # the problem", and a second `command -v node` there could name a different binary than the one graded here.
  floor="$(_forge_node_floor "$path")"
  status=$?
  if [ "$status" -eq 2 ]; then
    return 1
  fi
  if [ "$status" -ne 0 ]; then
    printf '\n[node] this pin states no host node floor, so there is no floor to check and none to invent.\n' >&2
    printf '       lock      %s\n' "$FORGE_LOCK" >&2
    printf '       node      %s  (%s)\n' "$("$path" -v 2>/dev/null || echo '<unreadable>')" "$path" >&2
    printf '       The floor is a property of the release the lock pins, and it is stamped into the lock by\n' >&2
    printf '       the release that carries it. A lock written before that existed simply does not answer\n' >&2
    printf '       the question — that is not an error, and this box will not answer it for the lock.\n' >&2
    printf '       Re-stamp the pin (`bash bin/build-local.sh <forge monorepo>`) to get the check back.\n\n' >&2
    return 0
  fi

  found="$("$path" -v 2>/dev/null)"
  major="${found#v}"
  major="${major%%.*}"
  case "$major" in
    '' | *[!0-9]*)
      printf '\n[node] refusing to start: `node -v` answered something this check cannot read.\n' >&2
      printf '       answered  %s\n' "${found:-<nothing>}" >&2
      printf '       from      %s\n' "$path" >&2
      printf '       required  node major >= %s  (%s: node.minMajor)\n' "$floor" "$FORGE_LOCK" >&2
      printf '       Nothing has been read, started or written. A version this script cannot grade is not\n' >&2
      printf '       a version it may assume is fine — put a known Node %s on PATH (`nvm use %s`).\n\n' "$floor" "$floor" >&2
      return 1
      ;;
  esac

  if [ "$major" -lt "$floor" ]; then
    printf '\n[node] refusing to start: the node on this PATH is older than the Forge release this box pins.\n' >&2
    printf '       found     %s\n' "$found" >&2
    printf '       from      %s\n' "$path" >&2
    printf '       required  node major >= %s  (%s: node.minMajor)\n' "$floor" "$FORGE_LOCK" >&2
    printf '       Nothing has been read, started or written — this is the first thing the script does.\n' >&2
    printf '       Put a Node %s on PATH and run it again:  nvm use %s\n' "$floor" "$floor" >&2
    printf '       (or prepend the directory that holds it, e.g. ~/.nvm/versions/node/v%s.*/bin).\n' "$floor" >&2
    printf '       ⚠️ An older node may well APPEAR to work. Every birth of 2026-09-03 ran under the floor\n' >&2
    printf '       and finished green; that is the reason this refusal exists rather than a warning.\n\n' >&2
    return 1
  fi

  return 0
}
