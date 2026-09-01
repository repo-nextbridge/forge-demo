#!/usr/bin/env bash
# forge.lock → the image refs the compose runs. SOURCE it (it exports); do not execute it.
#
#   source bin/images-from-lock.sh
#
# This is the whole mechanism behind "the compose references the images from the lock": compose cannot read
# JSON, so one small, portable, cloud-free step turns the lock into the variables compose interpolates.
# Bumping your Forge version is editing forge.lock and running this again — there is no second place to change.
#
# It refuses a lock whose images are pinned by TAG. That refusal belongs HERE, in the piece your box actually
# runs, and not only in the platform's CI: a tag is a label whose owner can repoint it, so `:v0.4.2` would let
# the bytes under your instance change without a single file of yours changing. A pin names the artifact.

: "${FORGE_LOCK:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/forge.lock}"

if ! command -v jq >/dev/null 2>&1; then
  echo "[forge-lock] \`jq\` is required to read ${FORGE_LOCK} (apt install jq / brew install jq)." >&2
  return 1
fi

[ -f "$FORGE_LOCK" ] || {
  echo "[forge-lock] no lock file at ${FORGE_LOCK}. Download the forge.lock asset from the Forge release you" >&2
  echo "[forge-lock]   intend to run, or set FORGE_LOCK to point at yours." >&2
  return 1
}

jq -e . "$FORGE_LOCK" >/dev/null 2>&1 || {
  echo "[forge-lock] ${FORGE_LOCK} is not valid JSON." >&2
  return 1
}

# One reader, used four times: read the ref, and prove it is a pin before letting it reach the compose.
_forge_lock_ref() { # <kernel|storefront|checkout|admin>
  local key="$1" ref digest
  ref="$(jq -r --arg k "$key" '.images[$k] // ""' "$FORGE_LOCK")"
  [ -n "$ref" ] || {
    echo "[forge-lock] ${FORGE_LOCK} does not pin the ${key} image. The images are released as one set —" >&2
    echo "[forge-lock]   running a mix that no release ever shipped is not a supported configuration." >&2
    return 1
  }
  case "$ref" in
    *@sha256:*) ;;
    *)
      echo "[forge-lock] the ${key} image is pinned by TAG, not by digest: '${ref}'." >&2
      echo "[forge-lock]   A tag is a label its owner can repoint — that is not a pin. Copy the refs from the" >&2
      echo "[forge-lock]   forge.lock published with the release." >&2
      return 1
      ;;
  esac
  digest="${ref##*@}"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || {
    echo "[forge-lock] the ${key} image's digest is malformed: '${digest}'." >&2
    return 1
  }
  printf '%s' "$ref"
}

# ★★ CHECKOUT-APP (C3) — FOUR IMAGES, NOT THREE, and the checkout is not optional to resolve. Your shop's
# front is TWO containers on one hostname (the storefront, and the checkout for `/checkout`, `/account` and
# `/.well-known/`), and they share the shopper's cart and session cookies. A box that came up with three of
# the four would serve a store whose "Finalizar compra" button leads to a 404 — so a lock missing one is
# refused here rather than resolved into a stack that boots and cannot sell.
FORGE_IMAGE="$(_forge_lock_ref kernel)" || return 1
FORGE_STOREFRONT_IMAGE="$(_forge_lock_ref storefront)" || return 1
FORGE_CHECKOUT_IMAGE="$(_forge_lock_ref checkout)" || return 1
FORGE_ADMIN_IMAGE="$(_forge_lock_ref admin)" || return 1
export FORGE_IMAGE FORGE_STOREFRONT_IMAGE FORGE_CHECKOUT_IMAGE FORGE_ADMIN_IMAGE

# The version the running kernel REPORTS (read.platform_info). It comes from the lock, so "what am I running?"
# has exactly one answer and it is the one you pinned.
FORGE_KERNEL_VERSION="$(jq -r '.forgeVersion // ""' "$FORGE_LOCK")"
[ -n "$FORGE_KERNEL_VERSION" ] || {
  echo "[forge-lock] ${FORGE_LOCK} has no forgeVersion — a pin that does not say what it is a pin OF." >&2
  return 1
}
export FORGE_KERNEL_VERSION

# WHICH APPS those images compose. The version alone stopped being an answer the day the image build started
# taking the list as an input: two boxes on the same release can carry different apps, both truthfully. This is
# the half of the pin that says which of them yours is, and `bin/verify-composition.sh` is what compares it to
# what the container you are actually running declares.
FORGE_COMPOSITION_ID="$(jq -r '.composition.id // ""' "$FORGE_LOCK")"
FORGE_COMPOSITION_APPS="$(jq -r '.composition.apps // [] | join(" ")' "$FORGE_LOCK")"
if [ -z "$FORGE_COMPOSITION_ID" ] || [ -z "$FORGE_COMPOSITION_APPS" ]; then
  echo "[forge-lock] ${FORGE_LOCK} pins images but names no composition. Your box runs \`release × list\`, and" >&2
  echo "[forge-lock]   this lock only states the release. Copy the forge.lock published with the release you" >&2
  echo "[forge-lock]   intend to run — it carries both halves." >&2
  return 1
fi
export FORGE_COMPOSITION_ID FORGE_COMPOSITION_APPS

unset -f _forge_lock_ref
echo "[forge-lock] ${FORGE_KERNEL_VERSION} × ${FORGE_COMPOSITION_ID} [${FORGE_COMPOSITION_APPS}] — images pinned by digest from ${FORGE_LOCK}" >&2
