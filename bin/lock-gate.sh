# ★★ THE LOCK GATE — a `forge.lock` that only THIS machine can run is refused for a box anyone else reaches.
# SOURCE it; it defines one function and runs nothing.
#
#   . bin/lock-gate.sh && lock_gate <forge.lock> <env name> <allow-local: yes|no>
#
# It is spec v032 decision 9, which turns a sentence into a mechanism. Until v0.3.2 the obligation lived in
# prose — `forge.lock`'s own `provenance.restamp` ("OBLIGATION, NOT A REMINDER: the first real deploy …
# replaces every ref below with a registry digest") and `README.md` — and nothing executed it. A lock baked on
# a bench names images by THIS daemon's ids (`forge-demo-kernel@sha256:<image id>`): honest about bytes, and
# unreproducible by anybody else. On `stag` or `prod` that is a box nobody can rebuild.
#
# REFUSED, for the public environments:
#   · `provenance.origin == "local build"` — the shape every lock before v0.3.2 had;
#   · any `images.<name>.origin == "local build"` — what `bin/bake.sh` writes without `--registry`;
#   · any `images.<name>` ref that names no registry host — whatever its origin says, a ref with no host
#     can only be resolved by the daemon that built it.
#
# `--allow-local` (the third argument) lets a BENCH environment through, and says why; it is refused outright
# for `stag` and `prod`, because a switch that turns the gate off on the day it matters is no gate. It is
# shared by `bin/deploy.sh` (which calls it before anything else is read) and `bin/lock-is-not-local.guard.mjs`
# (which runs it over planted locks), so the rule exists once.

# The environments a stranger can reach. A bench env is any other `deploy/<name>.env`.
LOCK_GATE_PUBLIC='stag prod'

# A ref whose first path segment is a registry host — `ghcr.io/…`, `host:5000/…`, `localhost/…` — the
# same test `bin/deploy.sh`'s pull path has always used.
lock_gate_has_registry() { # <ref>
  local leaf="${1%@*}"
  case "$leaf" in
    *.*/*|*:*/*|localhost/*) return 0 ;;
    *) return 1 ;;
  esac
}

lock_gate() { # <lock> <env> <allow-local yes|no>
  local lock="$1" env="$2" allow="${3:-no}" public=no e findings='' name ref origin
  for e in $LOCK_GATE_PUBLIC; do [ "$env" = "$e" ] && public=yes; done

  command -v jq >/dev/null 2>&1 || { printf '[lock-gate] `jq` is required to read %s.\n' "$lock" >&2; return 2; }
  jq -e . "$lock" >/dev/null 2>&1 || { printf '[lock-gate] %s is not valid JSON.\n' "$lock" >&2; return 2; }

  [ "$(jq -r '.provenance.origin // ""' "$lock")" = 'local build' ] \
    && findings+="  provenance.origin is \"local build\" ($(jq -r '.provenance.built_from // "?"' "$lock"))"$'\n'
  while IFS=$'\t' read -r name ref origin; do
    [ -n "$name" ] || continue
    [ "$origin" = 'local build' ] && findings+="  images.$name is origin \"local build\""$'\n'
    lock_gate_has_registry "$ref" || findings+="  images.$name names no registry: $ref"$'\n'
  done < <(jq -r '.images // {} | to_entries[]
    | [.key, (if (.value | type) == "object" then (.value.ref // "") else (.value // "") end),
       (if (.value | type) == "object" then (.value.origin // "") else "" end)] | @tsv' "$lock")

  if [ -z "$findings" ]; then
    printf '[lock-gate] %s: every image is pinned by a registry digest — a box anybody can rebuild.\n' "$env"
    return 0
  fi

  if [ "$public" = yes ]; then
    printf '[lock-gate] ⛔ %s is a PUBLIC box and %s can only run on the machine that baked it:\n%s' "$env" "$lock" "$findings" >&2
    printf '[lock-gate]    Bring back the lock of a bake that PUSHED (.github/workflows/bake.yml on main — README §"How this\n' >&2
    printf '[lock-gate]    box is baked"). --allow-local does not apply to %s, by design: it is a bench switch.\n' "$env" >&2
    return 1
  fi
  if [ "$allow" = yes ]; then
    printf '[lock-gate] ⚠️ %s is a BENCH environment and --allow-local was given, so this lock goes through:\n%s' "$env" "$findings" >&2
    printf '[lock-gate]    these refs resolve only where they were baked — the host has to hold them already.\n' >&2
    return 0
  fi
  printf '[lock-gate] ⛔ %s: this lock names images only the baking machine has:\n%s' "$env" "$findings" >&2
  printf '[lock-gate]    For a bench box that already holds them, say so: --allow-local.\n' >&2
  return 1
}

# ── ★★ KP-D1 — WHICH IMAGES OF THE LOCK NEED A LOGIN TO BE PULLED, AND AS WHOM ─────────────────────────────
#
# One line per image whose registry will not answer a stranger: `<image>\t<host>\t<service account or empty>`.
# A host needs a login when `registry-access.json` lists it, OR when it is an Artifact Registry host
# (`*-docker.pkg.dev`): measured 2026-10-10 (README, dx-i4), an anonymous pull there is refused, so a lock that
# pins one with no declared way in is a deploy that would die at `docker pull`, after the box was touched. The
# empty third column is that case, and `bin/deploy.sh` refuses it by name, before delivering anything.
lock_gate_pull_logins() { # <lock> <registry-access.json (may be absent)>
  local lock="$1" access="$2" registries='{}'
  [ -f "$access" ] && registries="$(jq -c '.registries // {}' "$access")"
  jq -r --argjson reg "$registries" '.images // {} | to_entries[]
    | [.key, (if (.value | type) == "object" then (.value.ref // "") else (.value // "") end)]
    | .[1] as $ref | ($ref | split("/")[0]) as $host
    | select(($ref | contains("/")) and (($reg | has($host)) or ($host | test("-docker\\.pkg\\.dev$"))))
    | [.[0], $host, ($reg[$host].serviceAccount // "")] | @tsv' "$lock"
}

# ── ★★ KP-D2 — DOES THE LOCK SAY WHICH APPS THE KERNEL RECEIVES MOUNTED, AND THE SAME ONES THE LIST DECLARES? ──
#
# From v0.3.4 an app of `instanceApps` declared `"kernel": "mounted"` reaches the PULLED kernel as
# `extensions/<id>`, and the lock says so in `composition.mounted` (the shape `bin/bake.sh` writes, the product's
# templates/instance/README.md step 4). The product's fence grades the artifact and the kernel's origin — it does
# NOT read `composition.mounted` (measured 2026-10-22 on @forgeco/surface-codegen 0.3.4: green on a lock without
# the key). And `bin/verify-composition.sh` reads such a lock as the image MISSING both apps — on the box, after
# the deploy. So it is asked HERE, before anything is touched: the two sets must be the same, and a lock without
# the key while the list mounts something is refused by name. Applies to every environment, bench included:
# a box whose lock and list disagree about what is mounted is one no `verify-composition.sh` can grade.
lock_gate_mounted() { # <lock> <composition.json>
  local lock="$1" list="$2" want got
  command -v jq >/dev/null 2>&1 || { printf '[lock-gate] `jq` is required to read %s.\n' "$lock" >&2; return 2; }
  jq -e . "$list" >/dev/null 2>&1 || { printf '[lock-gate] %s is not valid JSON.\n' "$list" >&2; return 2; }
  want="$(jq -r '[.instanceApps // [] | .[] | select(.kernel == "mounted") | .id] | sort | join(" ")' "$list")"
  if [ "$(jq -r '.composition | type == "object" and has("mounted")' "$lock")" != 'true' ]; then
    [ -n "$want" ] || return 0
    printf '[lock-gate] ⛔ %s carries no composition.mounted, and composition.json declares %s "kernel": "mounted".\n' "$lock" "$want" >&2
    printf '[lock-gate]    A lock of a bake that predates the mount: the box would run a kernel that never heard of them, or\n' >&2
    printf '[lock-gate]    one that composes them AND finds them mounted. Adopt the lock of a bake of this list (bin/bake.sh).\n' >&2
    return 1
  fi
  got="$(jq -r '.composition.mounted | if type == "array" then sort | join(" ") else "NOT-AN-ARRAY" end' "$lock")"
  [ "$want" = "$got" ] && return 0
  printf '[lock-gate] ⛔ %s mounts [%s], and composition.json declares [%s] "kernel": "mounted" — the lock was baked from another list.\n' "$lock" "$got" "$want" >&2
  return 1
}
