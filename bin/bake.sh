#!/usr/bin/env bash
# ★★★ THE DEMO'S BAKE — the four images this box bakes out of a Forge RELEASE's oven, the two it pulls from that
# release, and the `forge.lock` that pins all six. EXECUTE it (it builds images and writes a file); do not source it.
#
#   OVEN_IMAGE=<images.oven of the release's forge.lock> bash bin/bake.sh --release-lock <release forge.lock> --lock <out>   (bench)
#   OVEN_IMAGE=… bash bin/bake.sh --release-lock <…> --registry ghcr.io/<org> --tag <tag> --lock <out>                     (CI: pushes)
#
# ONE SCRIPT, TWO CALLERS, and that is the point (spec v032, decision 6): `.github/workflows/bake.yml` runs it
# with `--registry` on every push to `main` that changes one of its inputs (not `forge.lock`, `docs/`, the root
# README — v032/E), and `bin/bake-local.sh` runs it on a bench without. The recipe, the list, the apps and the
# lock it writes are the same in both; what differs is where the bytes end up —
# and that difference is WRITTEN in the lock (`origin`), so `bin/deploy.sh` can refuse a bench bake on a
# public box (decision 9).
#
# WHAT GOES IN, and nothing else — no Forge checkout, no git of the product (templates/instance/README.md §5b):
#   · the RELEASE   — `OVEN_IMAGE`, the release's published oven by digest. It must be STAMPED with the
#                     release the forks pin (`/forge-oven/release`), or this refuses before baking anything.
#   · the RECIPE    — `/app/infra/oven/Dockerfile`, copied OUT of that oven, so it always matches it.
#   · the LIST      — `composition.json` of this repository, as is (`"axis": "instance"` declared in it).
#   · OUR APPS      — `instanceApps[].source`, copied without `node_modules` into the `apps` build context.
#   · the FORKS     — `storefront-coffee/` and `totem/`, which install `@forgeco/*@<release>` from npm.
#   · the RELEASE'S LOCK — `--release-lock`, the `forge.lock` asset of that Release, for what this box PULLS.
#
# WHAT COMES OUT: storefront, checkout (two of the recipe's four targets) + storefront-coffee and totem (the
# forks' thin Dockerfiles), and a lock: `{ ref, origin: "own build", built_from: <release> }` per baked image, no
# `provenance` block — and `kernel` and `admin` as `{ ref, origin: "release" }`, copied from the release's lock,
# with `composition.mounted` naming the apps the pulled kernel receives on its mount.
#
# ★★ KP-D2 (2026-10-22, Forge v0.3.4) — THE KERNEL IS PULLED TOO, AND OUR APPS REACH IT MOUNTED. Until v0.3.4 an
# app of this box with a kernel half (`demo-setup`'s manifest, `payment-pos`'s driver) could reach the kernel
# only by being COMPOSED into it, so this box baked a kernel of its own. v0.3.4 loads an instance app from a
# packed directory: `composition.json` declares both apps `"kernel": "mounted"`, `bin/pack-apps.sh` packs them
# into `extensions/<id>` (committed), and the kernel here is the release's, by digest, exactly like the admin.
# ⛔ DO NOT PUT `kernel` BACK IN THE LOOP BELOW while the list says `mounted`: a kernel baked from this list
# composes both apps AND finds them on the mount, and the boot dies on a duplicate id (the product's fence says
# so before anything ships — `forge-lock-provenance`, red on `own build` + `mounted`). To bake it again, drop
# `"kernel": "mounted"` from composition.json in the same change. The fronts still compile both apps — a React
# block reaches a front only by being built into it — and the oven records the mount in their composition.json.
#
# ★★ KP-D1 (2026-10-21) — THE ADMIN IS PULLED, NOT BAKED. The product's doctrine: pull by digest what does not
# differentiate the box, bake what carries an app that draws a screen. No app of this box draws in the admin
# (`demo-setup` → storefront, `payment-pos` → checkout), and the product's fence says so: with
# `admin: release` it stays green, and it turns red the day an instance app declares an admin block
# (bin/deploy.guard.mjs, the sabotage). The ref is READ from the release's own lock — never typed — and it
# lives in the product's PRIVATE Artifact Registry: the box pulls it at deploy time with a 1-hour token minted
# by impersonating a read-only account with no key (registry-access.json; bin/deploy.sh, step 3b). This
# script never pulls it. Put `admin` back in the loop below and the lock says `own build` again; nothing
# else has to change. With `--registry` the ref is the digest read back from the registry after the push;
# without, it is this daemon's image id with NO registry host — the shape `bin/deploy.sh` refuses for stag
# and prod (bin/lock-gate.sh). ⚠️ `origin` is `own build` in both: measured 2026-10-09, the product's fence
# (`forge-lock-provenance`, run by bin/deploy.sh) has a CLOSED vocabulary — `release` | `own build` — and
# refuses `"local build"` on an image outright, so a bench lock saying it could not even be fenced. Where the
# bytes live is said by the ref, which is the fact the gate reads.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG_='[bake]'
say() { printf '%s %s\n' "$TAG_" "$*" >&2; }
die() { printf '%s ⛔ %s\n' "$TAG_" "$*" >&2; exit 1; }

registry=''
image_tag='local'
lock_out=''
release_lock=''
while [ $# -gt 0 ]; do
  case "$1" in
    --registry) registry="${2:?--registry needs a value, e.g. ghcr.io/<org>}"; shift ;;
    --tag)      image_tag="${2:?--tag needs a value}"; shift ;;
    --lock)     lock_out="${2:?--lock needs a path}"; shift ;;
    --release-lock) release_lock="${2:?--release-lock needs a path}"; shift ;;
    -h|--help)  sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)          die "unknown argument '$1' (see --help)" ;;
  esac
  shift
done
[ -n "$lock_out" ] || die 'name the lock to write: --lock <path>. The bench writes forge.lock; CI writes an artifact.'
[ -n "$release_lock" ] || die 'name the release'"'"'s forge.lock: --release-lock <path>. The kernel and the admin are PULLED from it (gh release download <tag> -R repo-nextbridge/forge -p forge.lock).'

# The host's node first: the forks' `npm run build` and the provenance check are host node processes.
# shellcheck source=bin/require-node.sh
. "$here/bin/require-node.sh"
require_node || exit 1
# shellcheck source=bin/docker-retry.sh
. "$here/bin/docker-retry.sh"
command -v jq >/dev/null || die '`jq` is required to read the list and write the lock.'
[ -n "${OVEN_IMAGE:-}" ] || die 'OVEN_IMAGE is not set. It is `images.oven` of the release'"'"'s forge.lock, by digest (§5b step 1).'

# ── THE RELEASE: what the forks pin, and the oven must agree ────────────────────────────────────────────────
#
# ★ ONE VERSION, READ FROM WHERE IT IS ALREADY DECLARED. The forks install `@forgeco/*` at an exact version from
# npm, and the root `package.json` installs the release's tools at one too; those pins ARE this repository's
# answer to "which release?". This reads them and refuses a disagreement instead of adding a fifth place.
pins="$(node -e '
const { readFileSync } = require("node:fs");
const out = [];
for (const file of process.argv.slice(1)) {
  const m = JSON.parse(readFileSync(file, "utf8"));
  for (const [name, spec] of Object.entries({ ...m.dependencies, ...m.devDependencies }))
    if (name.startsWith("@forgeco/")) out.push(`${file.replace(/^.*?\/(?=[^/]+\/package\.json$)/, "")} ${name} ${spec}`);
}
process.stdout.write(out.join("\n"));
' "$here/package.json" "$here/storefront-coffee/package.json" "$here/totem/package.json")"
versions="$(printf '%s\n' "$pins" | awk '{print $3}' | sort -u)"
[ "$(printf '%s\n' "$versions" | wc -l)" -eq 1 ] && [[ "$versions" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  printf '%s\n' "$pins" | sed "s/^/$TAG_   /" >&2
  die 'the @forgeco/* pins above do not name ONE exact release. Every one of them is that release, or nothing here is.'
}
release="v$versions"
if [ -n "${FORGE_RELEASE:-}" ] && [ "$FORGE_RELEASE" != "$release" ]; then
  die "FORGE_RELEASE=$FORGE_RELEASE, and this repository pins $release. Move the pins, or drop the variable."
fi

# ⛔ THE OVEN MUST SAY IT IS THAT RELEASE. The recipe itself refuses `FORGE_RELEASE` against an oven stamped
# with another tag — and lets an UNSTAMPED oven through, because our own CI bakes from one. A box's lock then
# writes `built_from: <release>`, and a claim the oven did not make is not one this script will write.
docker image inspect "$OVEN_IMAGE" >/dev/null 2>&1 || docker pull -q "$OVEN_IMAGE" >/dev/null \
  || die "the oven '$OVEN_IMAGE' is not on this daemon and could not be pulled."
stamp="$(docker run --rm --network none --entrypoint cat "$OVEN_IMAGE" /forge-oven/release 2>/dev/null || true)"
[ "$stamp" = "$release" ] || die "the oven is stamped '${stamp:-<nothing>}' at /forge-oven/release, and this repository pins $release.
     A release's published oven carries its tag; a bench oven gets one with the product's infra/cicd/stamp-oven.sh."
say "release   $release (the forks' and the tools' pin; the oven is stamped the same)"

# ── WHAT THIS BOX PULLS: the images of the release it does not bake, read from the release's own lock ──────
#
# ⚠️ BETWEEN MARKERS so `bin/bake-pulls-admin.guard.mjs` can run THIS block over fabricated release locks
# without docker. Every refusal names the file and the image, because a lock that pins a different release's
# admin beside this release's kernel is a mix no release ever shipped.
# >>> THE IMAGES THIS BOX PULLS FROM THE RELEASE
PULLED_FROM_RELEASE=(kernel admin)
[ -f "$release_lock" ] || die "the release's lock '$release_lock' does not exist."
jq -e . "$release_lock" >/dev/null 2>&1 || die "the release's lock '$release_lock' is not JSON."
release_lock_version="$(jq -r '.forgeVersion // ""' "$release_lock")"
[ "$release_lock_version" = "$release" ] \
  || die "the release's lock '$release_lock' is ${release_lock_version:-<no forgeVersion>}, and this repository pins $release."
declare -A PULLED=()
for target in "${PULLED_FROM_RELEASE[@]}"; do
  entry="$(jq -c --arg k "$target" '.images[$k] | if type == "object" then . elif type == "string" then {ref: ., origin: "release"} else null end' "$release_lock")"
  ref="$(jq -r '.ref // ""' <<<"$entry")"
  [ "$(jq -r '.origin // ""' <<<"$entry")" = 'release' ] \
    || die "the release's lock does not pin $target as origin \"release\" — it is not the release's own $target."
  [[ "$ref" =~ ^[^/@]+\.[^/@]+/[^@]+@sha256:[0-9a-f]{64}$ ]] \
    || die "the release's lock pins $target as '${ref:-<nothing>}', not a registry ref by digest."
  PULLED[$target]="$ref"
done
# <<< THE IMAGES THIS BOX PULLS FROM THE RELEASE
say "pulled    ${PULLED_FROM_RELEASE[*]} — from the $release release's lock, by digest (not baked here)"

# ★ KP-D2 — `composition.mounted`, the shape the product publishes (templates/instance/README.md, "An app of your
# own, MOUNTED into the pulled kernel", step 4): the ids of `instanceApps` declared `"kernel": "mounted"`, read
# from the list and never typed. `bin/verify-composition.sh` (v0.3.4) compares the running kernel with
# `apps − mounted` and asks it for the mount; a lock without the key reads both apps as MISSING from the image.
# ⚠️ BETWEEN MARKERS so `bin/bake-mounts-apps.guard.mjs` can run THIS block over a fabricated list without docker.
# >>> THE APPS THE PULLED KERNEL RECEIVES MOUNTED
mounted_json="$(jq -c '[.instanceApps // [] | .[] | select(.kernel == "mounted") | .id]' "$here/composition.json")"
composed_own="$(jq -r '[.instanceApps // [] | .[] | select(.kernel != "mounted") | .id] | join(", ")' "$here/composition.json")"
[ -z "$composed_own" ] || die "composition.json declares $composed_own as COMPOSED into the kernel, and this bake pulls the release's kernel,
     which has never seen that code. Declare it \"kernel\": \"mounted\" and pack it (bash bin/pack-apps.sh), or bake the kernel again."
for id in $(jq -r '.[]' <<<"$mounted_json"); do
  [ -f "$here/extensions/$id/forge-extension.json" ] \
    || die "composition.json declares \"$id\" mounted, and extensions/$id holds no packed manifest — run bash bin/pack-apps.sh and commit extensions/$id."
done
# ⚠️ AND THE PULLED KERNEL COMPOSES THE RELEASE'S WHOLE LIST, so `apps` here must be that list, entry for entry —
# the product's own limitation of v0.3.4 ("Composing fewer apps than the release and keeping the kernel pulled is
# not supported yet"). A box that dropped or added a platform app would be told EXTRA/MISSING by
# verify-composition.sh on the running box; this says it before anything is baked.
ours="$(jq -r '[.apps[].id] | sort | join(" ")' "$here/composition.json")"
theirs="$(jq -r '[.composition.apps // [] | .[]] | sort | join(" ")' "$release_lock")"
[ "$ours" = "$theirs" ] || die "composition.json's apps are not the $release release's list, and the pulled kernel composes exactly that one.
     ours:    $ours
     release: $theirs"
# <<< THE APPS THE PULLED KERNEL RECEIVES MOUNTED
say "mounted   $(jq -r 'join(", ")' <<<"$mounted_json") — packed in extensions/<id>, into the pulled kernel (not composed)"

# ── THE CONTEXTS: recipe, list, apps — one scratch directory, nothing of this repo beyond them ─────────────
work="$(mktemp -d -t forge-demo-bake.XXXXXX)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/context" "$work/list" "$work/apps"

# §5b step 2 — the recipe, from inside the oven, so it always matches it.
# And the release's node-floor derivation with the manifest it reads, for the lock (below).
mkdir -p "$work/release"
cid="$(docker create "$OVEN_IMAGE")"
docker cp "$cid:/app/infra/oven/Dockerfile" "$work/Dockerfile" >/dev/null
docker cp "$cid:/app/infra/cicd/node-floor.sh" "$work/release/node-floor.sh" >/dev/null
docker cp "$cid:/app/package.json" "$work/release/package.json" >/dev/null
docker rm "$cid" >/dev/null

# The list is handed over AS IS. It declares its own axis (`"axis": "instance"`) — the oven reads the axis from
# the list from v0.3.2 and refuses `instanceApps` without one, naming the key.
# ⚠️ BETWEEN MARKERS so `bin/bake-own-list.guard.mjs` can run THIS block over a fabricated list without docker.
# >>> THE LIST HANDED TO THE OVEN
[ "$(jq -r '.axis // ""' "$here/composition.json")" = 'instance' ] \
  || die 'composition.json carries instanceApps and does not declare "axis": "instance" — the oven would refuse it.'
cp "$here/composition.json" "$work/list/composition.json"
cmp -s "$here/composition.json" "$work/list/composition.json" \
  || die 'THE LIST HANDED TO THE OVEN IS NOT composition.json — this repository bakes its own list, byte for byte.'
# <<< THE LIST HANDED TO THE OVEN
composition_id='demo-instance'

# Our apps, one directory each, by the SOURCE the list names. `node_modules` never travels: the oven links what
# an app needs from the release it is baking, and a stale local install would shadow it.
while read -r src; do
  [ -d "$here/$src" ] || die "composition.json names an instance app at '$src', which is not a directory here."
  dest="$work/apps/$(basename "$src")"
  mkdir -p "$dest"
  ( cd "$here/$src" && tar --exclude=node_modules -cf - . ) | ( cd "$dest" && tar -xf - )
done < <(jq -r '.instanceApps[].source' "$here/composition.json")
say "apps      $(jq -r '[.instanceApps[].id] | join(", ")' "$here/composition.json") (from instanceApps[].source)"

demo_sha="$(git -C "$here" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
git -C "$here" diff --quiet 2>/dev/null || demo_sha="${demo_sha}-dirty"
built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
prefix="${registry:+$registry/}${BAKE_IMAGE_PREFIX:-forge-demo-}"

# ── THE IMAGES ──────────────────────────────────────────────────────────────────────────────────────────────
#
# ref_of: push when there is a registry and read the digest BACK from it (§5b step 6 — the registry names the
# bytes); otherwise this daemon's image id, which `<name>@sha256:<id>` resolves locally exactly as a registry
# digest does — and only here.
ref_of() { # <name:tag>
  local image="$1" digest
  if [ -n "$registry" ]; then
    docker push -q "$image" >/dev/null || die "pushing $image failed."
    digest="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$image" | grep -m1 "^${image%:*}@sha256:" || true)"
    [ -n "$digest" ] || die "$image was pushed and the registry handed back no digest for it."
    printf '%s' "$digest"
  else
    printf '%s@%s' "${image%:*}" "$(docker image inspect --format '{{.Id}}' "$image")"
  fi
}

declare -A REFS=()
# ⚠️ `admin` and `kernel` are NOT here: both are pulled from the release (above — KP-D1, KP-D2).
for target in storefront checkout; do
  image="${prefix}${target}:${image_tag}"
  say "baking   $target → $image"
  docker_build_retry -f "$work/Dockerfile" --target "$target" \
    --build-arg "OVEN_IMAGE=$OVEN_IMAGE" \
    --build-context "list=$work/list" --build-arg FORGE_COMPOSITION=composition.json \
    --build-arg "FORGE_COMPOSITION_ID=$composition_id" \
    --build-context "apps=$work/apps" \
    --build-arg "FORGE_RELEASE=$release" \
    --build-arg "GIT_SHA=$demo_sha" --build-arg "BUILD_DATE=$built_at" \
    -t "$image" "$work/context" >&2
  REFS[$target]="$(ref_of "$image")"
done

# The forks: npm at the release, our apps linked from that same install, the standalone build, the thin image.
for fork in storefront-coffee totem; do
  app="$here/$fork"
  image="${prefix}${fork}:${image_tag}"
  say "baking   $fork → $image"
  ( cd "$app" && npm ci --no-audit --no-fund >&2 )
  node "$here/bin/link-instance-apps.mjs" "$app"
  ( cd "$app" && rm -rf .next && FORGE_BUILD_STANDALONE=1 npm run build >&2 )
  # The entry sits one directory down because the tracing root is the REPOSITORY (both forks compile
  # `apps/demo-setup`, one directory up) — the Dockerfiles' CMD says the same from the other side.
  [ -f "$app/.next/standalone/$fork/server.js" ] \
    || die "the $fork build produced no .next/standalone/$fork/server.js — the image would fail to copy it."
  ( cd "$app" && docker_build_retry -t "$image" . >&2 )
  REFS[$fork]="$(ref_of "$image")"
done

# ── THE LOCK ────────────────────────────────────────────────────────────────────────────────────────────────
#
# The host node floor is the RELEASE's, derived by the product's one derivation (`infra/cicd/node-floor.sh`)
# over the release's own `package.json` — both copied out of the oven above. It runs HERE because it needs
# `jq`, which the oven (node:24-slim) does not carry; this repository never re-reads `engines.node` itself.
# shellcheck source=/dev/null
. "$work/release/node-floor.sh"
node_range="$(forge_node_engines "$work/release/package.json")" || die "the release states no node floor."
node_major="$(forge_node_min_major "$node_range")" || die "the release's node floor is not a shape this can grade."

# The dataset rides beside the images, not in them: recorded from this repository's own pointer.
dataset_pointer="$here/seed/dataset/forge-seed-dataset.json"
if [ -f "$dataset_pointer" ]; then
  dataset_json="$(jq --arg source 'seed/dataset' \
    '{source: $source, id, catalog: {version: .catalog.version, totalBytes: .catalog.totalBytes},
      photos: {version: .photos.version, totalBytes: .photos.totalBytes}}' "$dataset_pointer")"
else
  dataset_json='null'
fi

origin='own build'
image_entry() { jq -n --arg ref "$1" --arg origin "$origin" --arg from "$release" '{ref: $ref, origin: $origin, built_from: $from}'; }
# A pulled image carries what the release's lock says and nothing else: no `built_from`, nothing was built.
pulled_entry() { jq -n --arg ref "$1" '{ref: $ref, origin: "release"}'; }

jq -n \
  --arg version "$release" \
  --arg nodeEngines "$node_range" \
  --argjson nodeMinMajor "$node_major" \
  --arg id "$composition_id" \
  --argjson apps "$(jq '[(.instanceApps // [] | .[].id), (.apps[].id)]' "$here/composition.json")" \
  --argjson mounted "$mounted_json" \
  --argjson kernel "$(pulled_entry "${PULLED[kernel]}")" \
  --argjson storefront "$(image_entry "${REFS[storefront]}")" \
  --argjson checkout "$(image_entry "${REFS[checkout]}")" \
  --argjson admin "$(pulled_entry "${PULLED[admin]}")" \
  --argjson coffee "$(image_entry "${REFS[storefront-coffee]}")" \
  --argjson totem "$(image_entry "${REFS[totem]}")" \
  --argjson dataset "$dataset_json" \
  '{
    forgeVersion: $version,
    node: { minMajor: $nodeMinMajor, engines: $nodeEngines },
    composition: { id: $id, apps: $apps, mounted: $mounted },
    images: {
      kernel: $kernel, storefront: $storefront, checkout: $checkout, admin: $admin,
      "storefront-coffee": $coffee, totem: $totem
    },
    extensions: [],
    dataset: $dataset,
    offerable: false,
    why_not_offerable: "This image composes an app that belongs to THIS box (see `instanceApps` in composition.json). Forge stamps such an image not-offerable and its release gate refuses to promote one: an image carrying one customer\u0027s app must never be handed to another. That is a property of what this box asked for, not a defect."
  }' > "$lock_out"

say "wrote     $lock_out — $release × $composition_id, four images baked + ${PULLED_FROM_RELEASE[*]} from the release, $(jq -r 'join(", ")' <<<"$mounted_json") mounted, ${registry:+in $registry}${registry:-ONLY in this daemon (no registry host: bin/deploy.sh refuses it for stag/prod)}"
jq -r '.images | to_entries[] | "[bake]   \(.key): \(.value.ref)"' "$lock_out" >&2
