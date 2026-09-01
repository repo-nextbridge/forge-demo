#!/usr/bin/env bash
# ★ PRE-RELEASE MODE — build the four images from a Forge CHECKOUT on this machine and write `forge.lock`
# from what came out. EXECUTE it (it writes a file); do not source it.
#
#   bash bin/build-local.sh ~/nextbridge/projetos/forge
#   bash bin/build-local.sh ~/path/to/forge v0.3.0-pre
#
# ⚠️ WHY THIS EXISTS AT ALL, AND WHEN IT SHOULD STOP EXISTING.
#
# The normal way to fill `forge.lock` is to download the one published with a Forge release: the digests are
# read back FROM the registry, so what the lock names is what a `docker pull` gets. That is what
# `templates/instance/README.md` §1 tells a customer to do, and it is right.
#
# This demo cannot do that YET. The features it is built on — the store's own vocabulary, the theme's fonts,
# the anonymous list face's publication rule, the subscriptions app — live on a branch that has not been
# merged or promoted, so the digests in the registry belong to an older `main` and do NOT contain them. A
# lock pinning the registry today would be honest about bytes and useless as a demo: it would come up and
# not be able to run the thing it exists to show. (Decision of 2026-08-31, recorded in the epic's
# `_DECISOES.md`: build locally, and SAY SO.)
#
# So the lock this writes carries a `provenance` block naming the branch and commit it was built from, and
# `README.md` carries the obligation: THE FIRST REAL DEPLOY RE-STAMPS IT with registry digests. That is not a
# reminder, it is part of that deploy's definition of done.
#
# WHAT DOES NOT BEND: the images are still pinned BY DIGEST. `bin/images-from-lock.sh` refuses a tag-pinned
# lock, and it is not relaxed here — measured on this daemon, `<repo>@sha256:<local image id>` resolves and
# runs for a locally built image exactly as a registry digest does. The pre-release mode costs a paragraph of
# honesty and zero weakening of the pin.

set -euo pipefail

forge="${1:?usage: build-local.sh <path to the forge monorepo checkout> [version label]}"
version="${2:-}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lock="$here/forge.lock"

command -v jq >/dev/null || {
  echo '[build-local] `jq` is required to write the lock as valid JSON.' >&2
  exit 1
}
[ -d "$forge/infra" ] || {
  echo "[build-local] '$forge' does not look like the Forge monorepo (no infra/)." >&2
  exit 1
}

# THE LIST THE IMAGES ARE BAKED FROM. It is `composition.json` in THIS repo — and the build reads the COPY of
# it that lives in the monorepo, because `apply-composition.ts` runs inside the build context and can only
# see paths under it. That copy is `infra/fleet/lists/demo-instance.json`, and the `fleet-oven` job bakes it
# on every push to main so this combination is proven before a release is offered.
#
# ⚠️ THE TWO COPIES ARE KEPT IN STEP BY HAND. Nothing crosses repositories. This check is the cheap half —
# it compares the app sets and refuses to build images from a list that is not the one this repo maintains.
composition_id='demo-instance'
composition_path='infra/fleet/lists/demo-instance.json'
mine="$(jq -S '[.apps[] | {id, package}]' "$here/composition.json")"
theirs="$(jq -S '[.apps[] | {id, package}]' "$forge/$composition_path" 2>/dev/null || echo 'null')"
if [ "$mine" != "$theirs" ]; then
  echo "[build-local] THE LIST IN THE MONOREPO IS NOT THE LIST THIS REPO MAINTAINS." >&2
  echo "[build-local]   here:  composition.json" >&2
  echo "[build-local]   there: $forge/$composition_path" >&2
  echo "[build-local] They are two copies of one decision and CI cannot compare them — it does not cross" >&2
  echo "[build-local] repositories. Copy this repo's list over that one (and commit it there), or fix this" >&2
  echo "[build-local] one if the monorepo's is the newer. Building now would bake apps this box never asked" >&2
  echo "[build-local] for, and \`bin/verify-composition.sh\` would only tell you after the fact." >&2
  exit 1
fi

# ★★ THE APPS THIS REPOSITORY WROTE, HANDED TO THE OVEN (Forge P1).
#
# `composition.json` has two lists and they answer two different questions. `apps` is what the PLATFORM offers
# and this box chose — that is the list the monorepo mirrors and the fleet oven bakes over there. `instanceApps`
# is OUR OWN CODE, which no release of theirs has ever seen; it cannot be on the mirrored list, and the check
# above deliberately compares only `apps`.
#
# It reaches the bake by being COPIED INTO THE BUILD CONTEXT, because `docker build` cannot see a path outside
# it. `.instance-apps/` in the Forge checkout is the landing strip (gitignored there, and NOT in
# `.dockerignore` — being in the context is its whole reason to exist), and the oven adopts what it finds with
# `--instance-apps`: it checks each app declares `forge.origin: "instance"`, copies it under `extensions/`,
# takes it OUT of the pnpm workspace so no install is triggered, and links its dependencies from what the image
# already carries. No resolver runs and `pnpm install --frozen-lockfile` upstream stays frozen.
#
# ⚠️ THE IMAGE THAT COMES OUT IS STAMPED NOT-OFFERABLE, and that is the point rather than a side effect: an
# image carrying one box's app may never be promoted as a Forge release artifact.
staging="$forge/.instance-apps"
rm -rf "$staging"
mkdir -p "$staging"
instance_count="$(jq '.instanceApps | length' "$here/composition.json")"
if [ "$instance_count" -gt 0 ]; then
  while read -r src; do
    [ -d "$here/$src" ] || {
      echo "[build-local] composition.json names an instance app at '$src', which is not a directory here." >&2
      exit 1
    }
    # `node_modules` is deliberately not copied: the oven links what the app needs from what the image already
    # has, and a stale local install would shadow it.
    rsync -a --exclude node_modules --exclude 'design-base' "$here/$src/" "$staging/$(basename "$src")/" 2>/dev/null \
      || { mkdir -p "$staging/$(basename "$src")" && (cd "$here/$src" && tar --exclude=node_modules --exclude=design-base -cf - .) | (cd "$staging/$(basename "$src")" && tar -xf -); }
  done < <(jq -r '.instanceApps[].source' "$here/composition.json")
fi

# THE LIST THE OVEN READS is the mirrored one PLUS this box's own apps, written into the context next to them.
# It is generated rather than committed: the platform half must stay byte-comparable with the monorepo's copy
# (that is what the check above is for), and the instance half is this file's to add.
composition_arg="$composition_path"
if [ "$instance_count" -gt 0 ]; then
  jq -s '{version: 1, apps: (.[1].instanceApps | map({id, package})) + .[0].apps}' \
    "$forge/$composition_path" "$here/composition.json" > "$staging/composition.json"
  composition_arg='.instance-apps/composition.json'
fi

echo "[build-local] instance apps: $(jq -r '[.instanceApps[].id] | join(", ") // "(none)"' "$here/composition.json")" >&2

# The release the images report. Read from the monorepo's contracts package, with the same `v` convention the
# platform's own tooling uses, and marked as a pre-release build of a branch.
branch="$(git -C "$forge" rev-parse --abbrev-ref HEAD)"
sha="$(git -C "$forge" rev-parse --short HEAD)"
dirty=''
git -C "$forge" diff --quiet || dirty=' (working tree DIRTY — this build is not reproducible from any commit)'

# ★★ C3 — THE PROVENANCE IS COMPUTED ONCE, HERE, AND READ TWICE: it is stamped INTO each image as a build-arg
# and written INTO the lock as `provenance`. Two `git rev-parse` calls would be two facts that agree today and
# drift the first time somebody edits one of them — so there is exactly one, above, and everything downstream
# reads these variables.
#
# ⚠️ THAT MAKES DIVERGENCE IMPOSSIBLE TO AUTHOR, NOT IMPOSSIBLE TO INTRODUCE — a future edit could still add a
# second source. So the single assignment is backed by a CHECK: after each image is built, the stamp is read
# back OUT of it and compared to what is about to be written in the lock (see `build()`), and a mismatch
# refuses the build. The property is enforced by the artifact, not by this comment.
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BUILT_FROM="${branch}@${sha}${dirty}"

# ⚠️ AND THE STAMP CARRIES THE DIRT, because the first run of this feature caught itself lying: the lock said
# `d2/d1-repo@06b716546 (working tree DIRTY)` and the four images said `FORGE_KERNEL_SHA=06b716546` — a clean
# commit they were NOT built from. An image that names a commit is claiming to be reproducible from it; when
# the tree had uncommitted changes, that claim is false and the cheapest honest thing is to say so IN the
# value. `-dirty` is git's own convention (`git describe`), so it stays one token and one field.
STAMP_SHA="${sha}${dirty:+-dirty}"
if [ -z "$version" ]; then
  version="v$(jq -r '.version' "$forge/packages/contracts/package.json")-pre.${sha}"
fi

echo "[build-local] forge:       $forge" >&2
echo "[build-local] branch:      ${branch}@${sha}${dirty}" >&2
echo "[build-local] version:     $version" >&2
echo "[build-local] composition: $composition_id ($composition_path)" >&2
echo >&2

# name:dockerfile — the same four the platform's release builds and `bin/images-from-lock.sh` demands. A box
# that came up with three of the four serves a store whose "Finalizar compra" leads to a 404.
build() { # <lock key> <image name> <dockerfile>
  local key="$1" name="$2" dockerfile="$3"
  echo "[build-local] building $name …" >&2
  docker build \
    -f "$forge/$dockerfile" \
    --build-arg "FORGE_COMPOSITION=$composition_arg" \
    --build-arg "FORGE_COMPOSITION_ID=$composition_id" \
    --build-arg "FORGE_INSTANCE_APPS=$([ "$instance_count" -gt 0 ] && echo .instance-apps || echo '')" \
    --build-arg "FORGE_RELEASE=$version" \
    --build-arg "GIT_SHA=$STAMP_SHA" \
    --build-arg "BUILD_DATE=$BUILT_AT" \
    -t "$name:$composition_id" \
    "$forge" >&2

  # ★★ READ THE STAMP BACK OUT OF THE ARTIFACT. A build-arg a Dockerfile does not declare is accepted and
  # DISCARDED — docker does not error — which is exactly how the three front images shipped with an empty
  # `FORGE_KERNEL_SHA` while CI had been passing the arg all along. So the only trustworthy answer to "is this
  # image stamped?" comes from the image, and it is asked here rather than hoped for.
  local stamped
  stamped="$(docker image inspect "$name:$composition_id" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^FORGE_KERNEL_SHA=//p')"
  if [ "$stamped" != "$STAMP_SHA" ]; then
    echo "[build-local] $name came out of the oven stamped '${stamped:-<empty>}' and this build is '$STAMP_SHA'." >&2
    echo "[build-local]   Either $dockerfile does not declare \`ARG GIT_SHA\` + \`ENV FORGE_KERNEL_SHA\`" >&2
    echo "[build-local]   (a build-arg nobody declares is silently dropped), or a second source of the sha" >&2
    echo "[build-local]   has appeared. Refusing to write a lock whose provenance the image does not carry." >&2
    exit 1
  fi
  # The digest of what we just built. `docker image inspect .Id` is the content address of the image config —
  # the same string a registry digest carries, and the same one `<name>@sha256:…` resolves by locally.
  local id
  id="$(docker image inspect "$name:$composition_id" --format '{{.Id}}')"
  printf '%s' "$name@$id"
}

kernel_ref="$(build kernel forge-demo-kernel infra/Dockerfile)"
storefront_ref="$(build storefront forge-demo-storefront infra/storefront.Dockerfile)"
checkout_ref="$(build checkout forge-demo-checkout infra/checkout.Dockerfile)"
admin_ref="$(build admin forge-demo-admin infra/admin.Dockerfile)"

jq -n \
  --arg version "$version" \
  --arg id "$composition_id" \
  --argjson apps "$(jq '[(.instanceApps // [] | .[].id), (.apps[].id)]' "$here/composition.json")" \
  --arg kernel "$kernel_ref" \
  --arg storefront "$storefront_ref" \
  --arg checkout "$checkout_ref" \
  --arg admin "$admin_ref" \
  --arg origin "local build" \
  --arg built_from "$BUILT_FROM" \
  --arg built_at "$BUILT_AT" \
  --arg host "$(hostname)" \
  '{
    forgeVersion: $version,
    provenance: {
      origin: $origin,
      built_from: $built_from,
      built_at: $built_at,
      built_on: $host,
      why: "The branch these images carry has not been merged or promoted, so the registry digests for this release do not contain the features this demo exists to show. Building locally is the deliberate answer (decision of 2026-08-31); pinning the registry today would give a lock that is honest about bytes and unable to run the demo.",
      restamp: "OBLIGATION, NOT A REMINDER: the first real deploy of this instance replaces every ref below with a registry digest from a promoted Forge release, and this whole block goes with them. A lock that still says `local build` on a box anyone else can reach is a box nobody can reproduce.",
      how: "bash bin/build-local.sh <path to the forge monorepo> — rebuilds the four images here and rewrites this file."
    },
    composition: { id: $id, apps: $apps },
    images: { kernel: $kernel, storefront: $storefront, checkout: $checkout, admin: $admin },
    offerable: false,
    why_not_offerable: "This image composes an app that belongs to THIS box (see `instanceApps` in composition.json). Forge stamps such an image not-offerable and its release gate refuses to promote one: an image carrying one customer\u0027s app must never be handed to another. That is a property of what this box asked for, not a defect."
  }' > "$lock"

echo >&2
echo "[build-local] wrote $lock" >&2
jq -r '"[build-local] " + .forgeVersion + " × " + .composition.id + " — " + (.provenance.origin) + " from " + .provenance.built_from' "$lock" >&2
echo "[build-local] next: source ./env-source.sh && source bin/images-from-lock.sh && docker compose up -d" >&2
