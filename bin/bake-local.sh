#!/usr/bin/env bash
# THE BENCH'S BAKE — the same recipe as this repository's CI, into this daemon, and `forge.lock` rewritten from
# what came out. EXECUTE it (it builds images and writes a file); do not source it.
#
#   OVEN_IMAGE=<an oven stamped with the release the forks pin> bash bin/bake-local.sh
#
# ★ v032/C — IT IS `bin/bake.sh` WITHOUT A REGISTRY, AND NOTHING ELSE. It replaced `bin/build-local.sh`, which
# copied this repository's apps INTO a Forge checkout and baked from there. There is no checkout now: the
# release is its oven (`images.oven` of the release's forge.lock, or one a bench built and stamped with the
# product's `infra/cicd/stamp-oven.sh`), and the recipe, the list and the apps are the ones CI bakes with
# (spec v032, decision 6: "mesma receita, FROM local").
#
# ⚠️ dx-i4 — THE OVEN NEEDS GCP TODAY, MEASURED 2026-10-10. The only oven is in the product's Artifact Registry
# and an anonymous pull is refused (`Unauthenticated requests do not have permission
# "artifactregistry.repositories.downloadArtifacts"`); there is no public copy. Without that access you cannot
# bake — but you do not need to in order to RUN the box: the committed forge.lock's six images are public on
# GHCR. README §1, "Without GCP".
#
# ⚠️ THE LOCK IT WRITES IS A BENCH LOCK, AND SAYS SO IN EVERY REF: each one is this daemon's image id, with no
# registry host (`origin` stays `own build` — the product's fence knows no other word for a box's own bake).
# `bin/deploy.sh` refuses it for stag and prod (bin/lock-gate.sh) — a box anybody else reaches runs the lock of
# a bake that pushed (`.github/workflows/bake.yml`). Commit it only on a branch that
# says why.

set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$here/bin/bake.sh" --lock "${FORGE_LOCK_OUT:-$here/forge.lock}" "$@"
