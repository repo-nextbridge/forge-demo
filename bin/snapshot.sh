#!/usr/bin/env bash
# ★★★ A SNAPSHOT OF A BORN BOX, AND THE WAY BACK TO IT — generic: it knows what STATE is, never what the data is.
#
#   bash bin/snapshot.sh take    [--env <env>] [--label <l>] [--no-copy]   snapshot this box (and copy it off the box)
#   bash bin/snapshot.sh restore [--env <env>] [--label <l>] [--plan] [--no-start]
#   bash bin/snapshot.sh list    [--env <env>]                             the snapshots on the box, and off it
#   bash bin/snapshot.sh pull    --env <env> [--label <l>]                 copy one off the box (to $FORGE_GOLD_HOME)
#   bash bin/snapshot.sh push    --env <env> [--label <l>]                 put the off-box copy back on the box
#
# Without `--env` it acts on THIS checkout's bench (project ${COMPOSE_PROJECT_NAME:-forge-preseed}, like
# `bin/box-down.sh`); with it, on the box `deploy/<env>.env` names, over the same vehicle (`bin/remote-box.sh`).
#
# ── ⛔⛔ THIS FILE IS THE MECHANISM, NOT A POLICY — AND THE SEPARATION IS THE POINT ───────────────────────────
#
# Nothing here may assume the data is disposable. The same two gestures are what a customer's box needs to
# recover from a lost disk or a bad migration, where restoring is DISASTER RECOVERY and not a reset; this file
# is meant to be read as the model for that. "The demo goes back to its gold every so often because its admin
# is public" is a POLICY, and it lives in `bin/demo-reset.sh` — which proves the box before it takes a gold,
# and busts the vitrine and runs the verdicts after it restores one. Neither belongs here.
#
# ── ★★ WHAT A SNAPSHOT IS — the answer has two authors, and neither of them is this file ──────────────────
#
#   · WHICH VOLUMES ARE STATE is `bin/box-down.sh`'s (STATE=). This file reads that list and only says HOW each
#     comes back (`bin/snapshot-pair.mjs` STATE_DISPOSITION): the database as a logical dump, Redis discarded
#     (derived from the database), media as an archive. A STATE volume nobody decided is a refusal to take.
#   · WHAT THE BIRTH MINTED OUTSIDE THE DATABASE is the birth's (`remote_env_put` / `remote_secret_put` in
#     `bin/birth-remote.sh`, `put_env` / `put_secret` in `bin/box-up.sh`). Those lines of `.env` and `.secrets`
#     travel WITH the dump as one PAIR, because the dump references them — see `bin/snapshot-pair.mjs`.
#
# Plus a stamp: the forge.lock the box ran (`forgeVersion`, kernel ref), the migrations its database had
# applied, and an exact row count of every table — so a restore can refuse a gold NEWER than its kernel, and
# can prove it put back what it took instead of saying so.
#
# ── ★★ WHERE THE GOLD LIVES — TWO PLACES, AND WHY THE SECOND ONE IS THE OPERATOR'S MACHINE ────────────────
#
#   · ON THE BOX, `<deploy dir>/gold/<label>/` (mode 700): the restore reads it without moving a byte over the
#     network, which is what makes it minutes. `bin/deploy.sh` delivers by `tar -x` and never deletes, and
#     `bin/box-down.sh` touches only volumes, so neither gesture can reach it.
#   · OFF THE BOX, `$FORGE_GOLD_HOME/<env>/<label>/` (default `~/.forge-gold`), copied by `take` and verified
#     against the gold's own SHA256SUMS. A gold that dies with the disk is not a gold.
#
# ⛔ NOT THE BUCKET, although the box already has one. `deploy/stag.env` says it in so many words: the bucket is
# served PUBLICLY under the media domain (objects public, listing refused). A gold carries the operator tokens
# and the vault key IN CLEAR — the pair is the point of it — and an object whose name is guessable or leaks
# once is then readable by anybody, forever. The R2 keys are also the owner's identity, not this tool's to use.
# The operator's machine already holds the one credential that reaches the box (the deploy key), so it adds
# no new place a secret lives.
#
# ── ⚠️ WHAT RESTORE DOES, IN ORDER, AND WHERE IT IS ALLOWED TO STOP ────────────────────────────────────────
#
#   1. JUDGE (touches nothing): the gold exists; its files match their SHA256SUMS; it carries the pair; its
#      migrations are all known to the kernel image this box runs. Any refusal ends the run HERE — a refusal
#      after step 2 would be a box with no state and no gold.
#   2. `bin/box-down.sh` — the state dies by the same hand that kills it on a rebirth. Identity (TLS) and cache
#      (the photo payload) live, exactly as there.
#   3. postgres up on an empty volume → `pg_restore` → each archived volume back → COUNT every table and
#      compare with the gold. A mismatch stops here, before anything serves.
#   4. the pair back into `.env` / `.secrets`, name by name; nothing else in either file is touched.
#   5. `migrate` — always: a gold older than the kernel gets the migrations it lacks, a current one gets none.
#   6. the whole stack recreated (`--force-recreate`: every front's own render cache dies with its container,
#      which is the only lever for the ones without a revalidate hook), then wait for health.
#
# `--no-start` stops after 5 (inspect before serving — the disaster-recovery reflex). `--plan` stops after 1.

set -uo pipefail
TAG='[snapshot]'
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

die() { printf '\n%s ⛔ %s\n\n' "$TAG" "$*" >&2; exit 1; }
note() { printf '   %s\n' "$*" >&2; }
say() { printf '\n\033[1m%s %s\033[0m  (+%ss)\n' "$TAG" "$*" "$SECONDS" >&2; }

USAGE='usage: bash bin/snapshot.sh take|restore|list|pull|push [--env <env>] [--label <l>] [--plan] [--no-start] [--no-copy]'
VERB="${1:-}"
[ -n "$VERB" ] && shift
ENV_NAME=''
LABEL=''
PLAN=0
NO_START=0
NO_COPY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV_NAME="${2:?--env needs an environment name (a file in deploy/)}"; shift ;;
    --label) LABEL="${2:?--label needs a name}"; shift ;;
    --plan) PLAN=1 ;;
    --no-start) NO_START=1 ;;
    --no-copy) NO_COPY=1 ;;
    -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option $1. $USAGE" ;;
  esac
  shift
done
case "$VERB" in take|restore|list|pull|push) ;; *) die "$USAGE" ;; esac
case "$LABEL" in ''|[A-Za-z0-9]*) ;; *) die "a label is letters, digits, '.', '-' and '_' — not \"$LABEL\"." ;; esac
case "$LABEL" in *[!A-Za-z0-9._-]*) die "a label is letters, digits, '.', '-' and '_' — not \"$LABEL\"." ;; esac

NODE="${FORGE_NODE:-node}"
DOCKER_SH="${FORGE_DOCKER_SH:-sg docker -c}"
GOLD_HOME="${FORGE_GOLD_HOME:-$HOME/.forge-gold}"

# ── THE DESTINATION — the same switch `bin/box-down.sh` makes, and the same project name it derives ─────────
if [ -n "$ENV_NAME" ]; then
  # shellcheck disable=SC1091
  . "$HERE/bin/remote-box.sh"
  remote_box_load "$ENV_NAME" "$HERE" die || exit 1
  BOX_DIR="$FORGE_DEPLOY_DIR"
  PROJECT="$(basename "$FORGE_DEPLOY_DIR")"
  BIRTH_AUTHOR='bin/birth-remote.sh'
  WHERE="${FORGE_DEPLOY_USER}@${FORGE_DEPLOY_HOST}:${BOX_DIR}"
else
  BOX_DIR="$HERE"
  # ★ DX-I3 — `.env` first, the way `bin/box-up.sh` and `bin/box-down.sh` read it: a bench named there was this
  # file's blind spot (read in the code 2026-10-10, not run): PROJECT fell to `forge-preseed` while the restore's
  # box-down, which sources `.env`, would tear down the bench `.env` names — two projects in one gesture.
  PROJECT="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$HERE/.env" 2>/dev/null | tail -1 | tr -d "'\"")"
  PROJECT="${PROJECT:-${COMPOSE_PROJECT_NAME:-forge-preseed}}"
  BIRTH_AUTHOR='bin/box-up.sh'
  WHERE="this bench ($PROJECT)"
fi
OFFBOX="$GOLD_HOME/${ENV_NAME:-bench-$PROJECT}"

# ── ON THE BOX — one bash, in the box's directory, with the box's own secrets exported THERE ────────────────
#
# The script arrives on STDIN, never in a command line: `ps` on the host would show a command line, and a
# here-doc carrying SQL and python through two layers of quoting is how a quote goes missing. The prelude is
# what `remote_compose` does per command (bin/remote-box.sh), written once for a whole phase.
on_box() { # stdin: the phase's bash
  local prelude
  prelude="set -uo pipefail
umask 077
cd $(printf '%q' "$BOX_DIR") || { echo '$TAG the box directory $(printf '%q' "$BOX_DIR") does not exist' >&2; exit 1; }
set -a
. ./env-source.sh >/dev/null 2>&1 || { echo '$TAG env-source.sh refused on the box — its own message names the missing secret' >&2; exit 1; }
. ./bin/images-from-lock.sh >/dev/null 2>&1 || { echo '$TAG bin/images-from-lock.sh refused on the box' >&2; exit 1; }
set +a
export COMPOSE_PROJECT_NAME=$(printf '%q' "$PROJECT")
dc() { docker compose -f compose.yml -f compose.override.yml \"\$@\"; }
psql_box() { dc exec -T postgres psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -X -At -v ON_ERROR_STOP=1 -f -; }
"
  # ⛔⛔ AND IT IS LANDED IN A FILE BEFORE IT RUNS — NEVER `bash -s`. Measured on the first take (2026-10-09): a
  # script read from stdin SHARES that stdin with every command in it, and `docker compose exec -T` forwards
  # its stdin into the container — so the first `exec` swallowed the rest of the phase and the run carried on
  # as if it had finished. The phase runs with stdin CLOSED; a command that wants input says where from.
  local runner='f=$(mktemp) && cat > "$f" && { bash "$f" </dev/null; rc=$?; rm -f "$f"; exit $rc; }'
  { printf '%s\n' "$prelude"; cat; } | if [ -n "$ENV_NAME" ]; then "${REMOTE_SSH[@]}" "$runner"; else $DOCKER_SH "$runner"; fi
}

# ── THE TWO QUESTIONS ASKED OF THE DATABASE, AT THE TAKE AND AFTER THE RESTORE ────────────────────────────────
# ★ EXACT COUNTS, ONE STATEMENT. `pg_stat_user_tables.n_live_tup` is an estimate and is ZERO right after a
# restore until ANALYZE runs — a comparison on it would be red on every healthy restore, or green on any.
# shellcheck disable=SC2016
COUNTS_SQL="select table_schema || '.' || table_name || E'\t' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')
order by 1;"
# The two ledgers of `packages/db/src/migrate.ts` (product): forge_control._system_migrations, and one
# `_migrations` per tenant schema registered in forge_control.tenant.
MIGRATIONS_SQL="select 'system/' || name from forge_control._system_migrations
union
select 'tenant/' || x::text from forge_control.tenant t,
  lateral unnest(xpath('/table/row/name/text()', query_to_xml(format('select name from %I._migrations', t.schema_name), false, false, ''))) x
order by 1;"
# The migrations the KERNEL IMAGE carries, by the same two names. Read from the image this box runs, because
# that — and not a version string — is what decides whether a schema is one this kernel has heard of.
KERNEL_MIGRATIONS_SH="dc run --rm --no-deps -T --entrypoint sh kernel -c 'find / -xdev -path \"*/db/migrations/*\" -name \"*.sql\" 2>/dev/null' 2>/dev/null \
  | sed -nE 's#.*/migrations/(system|tenant)/([^/]+[.]sql)\$#\\1/\\2#p' | sort -u"

# >>> THE PAIR
# ★ THE TWO HALVES OF THE PAIR'S CUSTODY, RUN ON THE BOX (the box has python3 and no node — bin/remote-box.sh).
# `bin/snapshot.guard.mjs` extracts both programs from between these markers and runs them against
# `bin/snapshot-pair.mjs::selectPair`, so the membership rule here and there cannot drift apart unseen.
#
# TAKE: <names.json> <.env> <.secrets> <out pair.env> <out pair.secrets> — copies the member lines, prints
# only how many. ⛔ No value is ever printed, by either program.
PAIR_TAKE_PY='
import json, os, re, sys
names = json.load(open(sys.argv[1]))
KEY = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*)=")
def secret_member(n):
    if n in names["secrets"]:
        return True
    return any(n == b or (n.startswith(b + "-") and re.fullmatch(r"[a-z0-9-]+", n[len(b) + 1:])) for b in names["secretFamilies"])
def env_member(n):
    return n in names["env"]
def select(src, member, out):
    try:
        lines = open(src, encoding="utf-8").read().split("\n")
    except FileNotFoundError:
        lines = []
    keep = [l for l in lines if KEY.match(l) and member(KEY.match(l).group(1))]
    old = os.umask(0o077)
    with open(out, "w", encoding="utf-8") as f:
        f.write("".join(l + "\n" for l in keep))
    os.umask(old)
    return len(keep)
e = select(sys.argv[2], env_member, sys.argv[4])
s = select(sys.argv[3], secret_member, sys.argv[5])
print(str(e) + " .env line(s) · " + str(s) + " .secrets line(s)")
'
# PUT: <names.json> <pair file> <target file> <env|secrets> — every NAME the gold carries is replaced by the
# gold's line(s); every line the gold does not name is left byte for byte where it was.
#
# ⛔ REPLACE BY NAME, NOT MIRROR — AND THE GUARD IS WHAT TAUGHT IT. The first version deleted every pair-covered
# line the gold lacked, so a box minted by a later birth would lose its strays. Fabricated in the guard, it
# deleted FORGE_PUBLIC_ORIGIN (the bench birth writes it, so it is "covered") from a box whose gold did not carry
# it — and compose refuses to interpolate without it (`${FORGE_PUBLIC_ORIGIN:?}`): a restore that leaves a box
# that cannot start. A stray left behind is harmless by comparison — a token for a tenant the restored database
# does not have authenticates nothing — so strays are KEPT and NAMED (never valued), for a human to judge.
PAIR_PUT_PY='
import json, os, re, sys
names = json.load(open(sys.argv[1]))
pair_path, target, kind = sys.argv[2], sys.argv[3], sys.argv[4]
KEY = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*)=")
def member(n):
    if kind == "env":
        return n in names["env"]
    if n in names["secrets"]:
        return True
    return any(n == b or (n.startswith(b + "-") and re.fullmatch(r"[a-z0-9-]+", n[len(b) + 1:])) for b in names["secretFamilies"])
pair = [l for l in open(pair_path, encoding="utf-8").read().split("\n") if l]
for l in pair:
    if not (KEY.match(l) and member(KEY.match(l).group(1))):
        sys.exit("the pair carries a line its own rule does not cover (" + (KEY.match(l).group(1) if KEY.match(l) else "?") + ") — refusing to write it")
try:
    current = open(target, encoding="utf-8").read().split("\n")
except FileNotFoundError:
    current = []
if current and current[-1] == "":
    current = current[:-1]
gold_names = {KEY.match(l).group(1) for l in pair}
kept = [l for l in current if not (KEY.match(l) and KEY.match(l).group(1) in gold_names)]
strays = sorted({KEY.match(l).group(1) for l in kept if KEY.match(l) and member(KEY.match(l).group(1))})
old = os.umask(0o077)
tmp = target + ".snapshot-tmp"
with open(tmp, "w", encoding="utf-8") as f:
    f.write("".join(l + "\n" for l in kept + pair))
os.umask(old)
if kind == "secrets":
    os.chmod(tmp, 0o600)
elif os.path.exists(target):
    os.chmod(tmp, os.stat(target).st_mode & 0o777)
os.replace(tmp, target)
note = (" · ⚠️ kept, not in the gold: " + ", ".join(strays)) if strays else ""
print(str(len(pair)) + " line(s) put back · " + str(len(current) - len(kept)) + " replaced" + note)
'
# <<< THE PAIR

gold_label_on_box() { # → the label to act on: --label, or the box's LATEST
  if [ -n "$LABEL" ]; then printf '%s' "$LABEL"; return 0; fi
  printf 'cat gold/LATEST 2>/dev/null || true\n' | on_box 2>/dev/null | tr -d '\r\n'
}

# ═════════════════════════════════════════════════════════════════════════════════════════════════════════
# TAKE
# ═════════════════════════════════════════════════════════════════════════════════════════════════════════
take() {
  local label="${LABEL:-$(date -u +%Y%m%dT%H%M%SZ)}" facts names_json state
  facts="$(mktemp -d)"; trap 'rm -rf "$facts"' RETURN
  say "take · $label · from $WHERE"

  # Refused HERE, before a byte is written: a STATE volume box-down knows and this tool does not.
  state="$("$NODE" "$HERE/bin/snapshot-pair.mjs" state)" || die 'the snapshot does not know how to carry every STATE volume — the line above names it.'
  names_json="$("$NODE" "$HERE/bin/snapshot-pair.mjs" names --author "$BIRTH_AUTHOR")" || die "could not read the pair's names out of $BIRTH_AUTHOR."
  note "state   $(printf '%s' "$state" | awk '{printf "%s=%s ", $1, $2}')"
  note "pair    $(printf '%s' "$names_json" | jq -r '"\(.env|length) .env key(s) · \(.secrets|length) secret(s) + \(.secretFamilies|length) per-tenant famil(ies)"') — named by $BIRTH_AUTHOR"

  local G="gold/$label.partial"
  {
    printf 'G=%q\nNAMES=%q\nSTATE=%q\n' "$G" "$names_json" "$state"
    printf 'PAIR_TAKE_PY=%q\nCOUNTS_SQL=%q\nMIGRATIONS_SQL=%q\n' "$PAIR_TAKE_PY" "$COUNTS_SQL" "$MIGRATIONS_SQL"
    cat <<'BOX'
rm -rf "$G"
[ -d "${G%.partial}" ] && { echo "[snapshot] ⛔ ${G%.partial} already exists on the box — pick another --label." >&2; exit 1; }
umask 077; mkdir -p gold "$G" && chmod 700 gold "$G" || exit 1
printf '%s' "$NAMES" > "$G/pair-names.json"
cp forge.lock "$G/forge.lock" || { echo '[snapshot] ⛔ no forge.lock on the box — a gold must say what it was taken under.' >&2; exit 1; }
while read -r vol how service <&3; do
  [ -n "$vol" ] || continue
  case "$how" in
    dump)
      dc exec -T "$service" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$G/db.dump" \
        || { echo "[snapshot] ⛔ pg_dump failed — is $service up? Nothing was kept." >&2; rm -rf "$G"; exit 1; }
      printf '%s\n' "$COUNTS_SQL" | psql_box > "$G/counts.tsv" || { echo '[snapshot] ⛔ the tables could not be counted.' >&2; rm -rf "$G"; exit 1; }
      printf '%s\n' "$MIGRATIONS_SQL" | psql_box > "$G/migrations.txt" || { echo '[snapshot] ⛔ the migration ledger could not be read — not a migrated Forge database?' >&2; rm -rf "$G"; exit 1; }
      echo "   $vol · dump $(du -h "$G/db.dump" | cut -f1) · $(wc -l < "$G/counts.tsv") table(s) counted · $(wc -l < "$G/migrations.txt") migration(s) applied" >&2
      echo yes > "$G/present-$vol" ;;
    archive)
      if docker volume inspect "${COMPOSE_PROJECT_NAME}_$vol" >/dev/null 2>&1; then
        docker run --rm -v "${COMPOSE_PROJECT_NAME}_$vol:/v:ro" -v "$PWD/$G:/g" alpine tar -C /v -cf "/g/vol-$vol.tar" . \
          || { echo "[snapshot] ⛔ could not archive $vol." >&2; rm -rf "$G"; exit 1; }
        echo yes > "$G/present-$vol"
        echo "   $vol · archive $(du -h "$G/vol-$vol.tar" | cut -f1)" >&2
      else
        echo "   $vol · absent on this box — recorded as absent" >&2
      fi ;;
    discard) echo "   $vol · not carried (derived from the database)" >&2 ;;
  esac
done 3<<EOF
$STATE
EOF
out="$(python3 -c "$PAIR_TAKE_PY" "$G/pair-names.json" .env .secrets "$G/pair.env" "$G/pair.secrets")" \
  || { echo '[snapshot] ⛔ the pair could not be read.' >&2; rm -rf "$G"; exit 1; }
echo "   pair · $out" >&2
cut -d= -f1 "$G/pair.secrets" > "$G/pair-secret-names"
BOX
  } | on_box || die "the take failed on the box; nothing was kept (the partial directory is removed on every refusal above)."

  # The facts come home — names, counts, ledgers; never the pair — and the manifest is written HERE, by node,
  # so the box needs nothing it does not already have.
  printf 'G=%q\n%s\n' "$G" 'cd "$G" && for f in forge.lock counts.tsv migrations.txt pair-names.json pair-secret-names present-*; do [ -f "$f" ] && printf "%s\0" "$f" && cat "$f" && printf "\0"; done' \
    | on_box | "$NODE" -e '
      const fs = require("node:fs"); const dir = process.argv[1];
      const parts = fs.readFileSync(0).toString("utf8").split("\0");
      for (let i = 0; i + 1 < parts.length; i += 2) fs.writeFileSync(`${dir}/${parts[i]}`, parts[i + 1]);
    ' "$facts" || die 'could not read the facts back from the box.'
  printf '%s' "${ENV_NAME:-bench}:$PROJECT" > "$facts/origin"
  "$NODE" "$HERE/bin/snapshot-pair.mjs" manifest --dir "$facts" > "$facts/manifest.json" || die 'could not write the manifest.'
  # ⛔ THE PAIR IS JUDGED AT THE TAKE TOO: a gold the restore would refuse is not worth the disk.
  printf 'OK\n' > "$facts/sums"
  printf '%s\n' "$(cat "$facts/migrations.txt")" > "$facts/kernel-migrations.txt"
  "$NODE" "$HERE/bin/snapshot-pair.mjs" judge --dir "$facts" >/dev/null || {
    printf 'rm -rf %q\n' "$G" | on_box
    die 'this box would make a gold the restore refuses (the reason is above) — nothing was kept.'
  }

  {
    printf 'G=%q\nLABEL=%q\nMANIFEST=%q\n' "$G" "$label" "$(cat "$facts/manifest.json")"
    cat <<'BOX'
printf '%s\n' "$MANIFEST" > "$G/manifest.json"
rm -f "$G/present-"*
(cd "$G" && sha256sum -- * | grep -v ' SHA256SUMS$' > SHA256SUMS) || exit 1
mv "$G" "gold/$LABEL" && printf '%s\n' "$LABEL" > gold/LATEST
echo "   gold/$LABEL · $(du -sh "gold/$LABEL" | cut -f1) · LATEST → $LABEL" >&2
BOX
  } | on_box || die 'could not seal the gold on the box.'

  if [ -n "$ENV_NAME" ] && [ "$NO_COPY" = 0 ]; then
    LABEL="$label" pull
  elif [ -n "$ENV_NAME" ]; then
    note "⚠️ --no-copy: this gold lives ONLY on the box. \`bash bin/snapshot.sh pull --env $ENV_NAME --label $label\` copies it off."
  else
    note "bench: the gold is in $BOX_DIR/gold/$label — on this machine's disk, which is the box's."
  fi
  say "take · done · $label"
}

# ═════════════════════════════════════════════════════════════════════════════════════════════════════════
# PULL / PUSH — the off-box copy, verified against the gold's own sums on arrival
# ═════════════════════════════════════════════════════════════════════════════════════════════════════════
pull() {
  [ -n "$ENV_NAME" ] || die 'pull needs --env: a bench gold is already on this machine.'
  local label; label="$(gold_label_on_box)"
  [ -n "$label" ] || die "the box has no gold to copy (no --label and no gold/LATEST on $WHERE)."
  say "pull · $label → $OFFBOX/$label"
  mkdir -p "$OFFBOX" && chmod 700 "$GOLD_HOME" "$OFFBOX" || die "cannot write $OFFBOX."
  rm -rf "$OFFBOX/$label.partial"; mkdir -m 700 "$OFFBOX/$label.partial"
  "${REMOTE_SSH[@]}" "tar -C $(printf '%q' "$BOX_DIR/gold/$label") -cf - ." </dev/null | tar -C "$OFFBOX/$label.partial" -xf - \
    || die 'the copy did not arrive whole.'
  (cd "$OFFBOX/$label.partial" && sha256sum --quiet -c SHA256SUMS) || die "the copy does not match the gold's SHA256SUMS — not kept."
  rm -rf "$OFFBOX/$label"; mv "$OFFBOX/$label.partial" "$OFFBOX/$label"
  note "copied and verified · $(du -sh "$OFFBOX/$label" | cut -f1) · $OFFBOX/$label"
}

push() {
  [ -n "$ENV_NAME" ] || die 'push needs --env.'
  local label="$LABEL"
  [ -n "$label" ] || label="$(ls -1 "$OFFBOX" 2>/dev/null | grep -v '\.partial$' | sort | tail -1)"
  [ -n "$label" ] && [ -f "$OFFBOX/$label/manifest.json" ] || die "no off-box gold to push in $OFFBOX."
  (cd "$OFFBOX/$label" && sha256sum --quiet -c SHA256SUMS) || die "the off-box copy no longer matches its own SHA256SUMS."
  say "push · $OFFBOX/$label → $WHERE/gold/$label"
  "${REMOTE_SSH[@]}" "umask 077; mkdir -p $(printf '%q' "$BOX_DIR/gold/$label.partial")" </dev/null || die 'cannot write on the box.'
  tar -C "$OFFBOX/$label" -cf - . | "${REMOTE_SSH[@]}" "tar -C $(printf '%q' "$BOX_DIR/gold/$label.partial") -xf - \
    && cd $(printf '%q' "$BOX_DIR/gold/$label.partial") && sha256sum --quiet -c SHA256SUMS \
    && cd .. && rm -rf $(printf '%q' "$label") && mv $(printf '%q' "$label.partial") $(printf '%q' "$label") \
    && printf '%s\n' $(printf '%q' "$label") > LATEST" || die 'the gold did not arrive whole on the box.'
  note "on the box and verified · LATEST → $label"
}

list() {
  say "gold on $WHERE"
  printf '%s\n' 'for d in gold/*/; do [ -f "$d/manifest.json" ] || continue; l="$(basename "$d")"; printf "   %-22s %6s  %s  %s\n" "$l" "$(du -sh "$d" | cut -f1)" "$(jq -r ".forgeVersion" "$d/manifest.json" 2>/dev/null)" "$(jq -r ".takenAt" "$d/manifest.json" 2>/dev/null)"; done; printf "   LATEST → %s\n" "$(cat gold/LATEST 2>/dev/null || echo none)"' | on_box
  say "off the box ($OFFBOX)"
  ls -1 "$OFFBOX" 2>/dev/null | grep -v '\.partial$' | sed 's/^/   /' || true
}

# ═════════════════════════════════════════════════════════════════════════════════════════════════════════
# RESTORE
# ═════════════════════════════════════════════════════════════════════════════════════════════════════════
restore() {
  local label facts verdict
  facts="$(mktemp -d)"; trap 'rm -rf "$facts"' RETURN
  label="$(gold_label_on_box)"
  say "restore · ${label:-<no gold>} · onto $WHERE"

  # ── 1 · THE JUDGEMENT — nothing below this block runs unless every refusal said no ────────────────────
  if [ -n "$label" ]; then
    {
      printf 'G=%q\n' "gold/$label"
      cat <<'BOX'
[ -f "$G/manifest.json" ] || exit 0
printf 'manifest.json\0'; cat "$G/manifest.json"; printf '\0'
printf 'sums\0'; (cd "$G" && sha256sum --quiet -c SHA256SUMS >/dev/null 2>&1 && echo OK || echo BAD); printf '\0'
printf 'pair-secret-names\0'; [ -f "$G/pair.secrets" ] && cut -d= -f1 "$G/pair.secrets"; printf '\0'
BOX
      printf 'printf "kernel-migrations.txt\\0"; %s; printf "\\0"\n' "$KERNEL_MIGRATIONS_SH"
    } | on_box | "$NODE" -e '
      const fs = require("node:fs"); const dir = process.argv[1];
      const parts = fs.readFileSync(0).toString("utf8").split("\0");
      for (let i = 0; i + 1 < parts.length; i += 2) fs.writeFileSync(`${dir}/${parts[i]}`, parts[i + 1]);
    ' "$facts"
  fi
  verdict="$("$NODE" "$HERE/bin/snapshot-pair.mjs" judge --dir "$facts")" \
    || die "REFUSED — nothing on $WHERE was touched."
  note "judged · the gold is whole, carries its pair, and every migration in it is one this kernel knows"
  local pending; pending="$(printf '%s' "$verdict" | jq -r '.pending | length')"
  note "the kernel is ahead of the gold by $pending migration(s) — migrate applies them after the restore"
  note "gold: $(jq -r '"\(.forgeVersion) · taken \(.takenAt) · \(.counts|length) table(s)"' "$facts/manifest.json")"

  if [ "$PLAN" = 1 ]; then
    say 'PLAN — what the restore would destroy'
    if [ -n "$ENV_NAME" ]; then bash "$HERE/bin/box-down.sh" --env "$ENV_NAME" --plan; else COMPOSE_PROJECT_NAME="$PROJECT" bash "$HERE/bin/box-down.sh" --plan; fi
    note "then: pg_restore, the archived volumes, the pair, migrate$([ "$NO_START" = 1 ] || printf ', the stack recreated')"
    return 0
  fi

  # ── 2 · THE STATE DIES, BY THE HAND THAT KILLS IT ON A REBIRTH ────────────────────────────────────────
  say '2 · box-down — state dies; identity and cache live'
  if [ -n "$ENV_NAME" ]; then bash "$HERE/bin/box-down.sh" --env "$ENV_NAME"; else COMPOSE_PROJECT_NAME="$PROJECT" bash "$HERE/bin/box-down.sh"; fi \
    || die 'box-down failed. Nothing was restored; the gold is untouched — run this again.'

  # ── 3 · THE DATA BACK, AND COUNTED ─────────────────────────────────────────────────────────────────────
  say '3 · the database and the archived volumes'
  local state; state="$("$NODE" "$HERE/bin/snapshot-pair.mjs" state)" || die 'the STATE list is unreadable.'
  {
    printf 'G=%q\nSTATE=%q\nCOUNTS_SQL=%q\nJOBS=%q\n' "gold/$label" "$state" "$COUNTS_SQL" "${FORGE_SNAPSHOT_JOBS:-2}"
    cat <<'BOX'
while read -r vol how service <&3; do
  [ -n "$vol" ] || continue
  case "$how" in
    dump)
      dc up -d "$service" >/dev/null 2>&1 || { echo "[snapshot] ⛔ $service did not start." >&2; exit 1; }
      # ⚠️ OVER TCP, NOT THE SOCKET: the image's first boot runs initdb on a TEMPORARY server that listens on the
      # socket only and is then restarted. A restore that started on the socket's "ready" would be cut off by
      # that restart — the TCP listener only exists on the real one.
      for _ in $(seq 1 90); do dc exec -T "$service" pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && break; sleep 2; done
      dc exec -T "$service" pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 || { echo "[snapshot] ⛔ $service never became ready." >&2; exit 1; }
      dc exec -T "$service" sh -c 'cat > /tmp/gold.dump' < "$G/db.dump" || exit 1
      dc exec -T "$service" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error -j "$JOBS" /tmp/gold.dump \
        || { echo '[snapshot] ⛔ pg_restore failed — the box is DOWN with a partial database. Run the restore again (it starts from box-down).' >&2; exit 1; }
      dc exec -T "$service" rm -f /tmp/gold.dump
      echo "   $vol · restored" >&2 ;;
    archive)
      if [ -f "$G/vol-$vol.tar" ]; then
        # The labels are what compose checks before adopting a volume it did not create; without them `up` warns
        # «already exists but was not created by Docker Compose» on every start.
        docker volume create --label "com.docker.compose.project=$COMPOSE_PROJECT_NAME" --label "com.docker.compose.volume=$vol" \
          "${COMPOSE_PROJECT_NAME}_$vol" >/dev/null || exit 1
        docker run --rm -v "${COMPOSE_PROJECT_NAME}_$vol:/v" -v "$PWD/$G:/g:ro" alpine tar -C /v -xpf "/g/vol-$vol.tar" --numeric-owner || exit 1
        echo "   $vol · restored from its archive" >&2
      else
        echo "   $vol · absent in the gold — left absent" >&2
      fi ;;
    discard) echo "   $vol · left empty: derived, it re-derives from the database" >&2 ;;
  esac
done 3<<EOF
$STATE
EOF
printf '%s\n' "$COUNTS_SQL" | psql_box
BOX
  } | on_box > "$facts/counts-now.tsv" || die 'the data did not come back — the message above says where. The gold is untouched.'
  "$NODE" "$HERE/bin/snapshot-pair.mjs" counts-equal "$facts/manifest.json" "$facts/counts-now.tsv" >&2 \
    || die 'THE RESTORED DATABASE IS NOT THE GOLD — the tables above differ. The stack was NOT started.'

  # ── 4 · 5 · THE PAIR, THEN MIGRATE ─────────────────────────────────────────────────────────────────────
  say '4 · the pair back into .env / .secrets · 5 · migrate'
  {
    printf 'G=%q\nPAIR_PUT_PY=%q\n' "gold/$label" "$PAIR_PUT_PY"
    cat <<'BOX'
out="$(python3 -c "$PAIR_PUT_PY" "$G/pair-names.json" "$G/pair.env" .env env)" || exit 1; echo "   .env · $out" >&2
out="$(python3 -c "$PAIR_PUT_PY" "$G/pair-names.json" "$G/pair.secrets" .secrets secrets)" || exit 1; echo "   .secrets · $out" >&2
# The prelude exported the secrets as they were BEFORE the pair went back; migrate must run with the gold's.
set -a; . ./env-source.sh >/dev/null 2>&1; set +a
dc run --rm kernel node dist/migrate.js 2>&1 | grep -E '^\[migrate\]' | sed 's/^/   /' >&2
[ "${PIPESTATUS[0]}" = 0 ] || { echo '[snapshot] ⛔ migrate failed over the restored database.' >&2; exit 1; }
BOX
  } | on_box || die 'the pair or migrate failed — the database is restored, the stack is NOT started.'

  if [ "$NO_START" = 1 ]; then
    say "restore · done · --no-start: data, pair and schema are back; nothing is serving. \`docker compose up -d\` when ready."
    return 0
  fi

  # ── 6 · THE STACK, RECREATED, AND WAITED FOR ───────────────────────────────────────────────────────────
  say '6 · the stack recreated (every front starts with an empty render cache)'
  {
    printf 'WAIT=%q\n' "${FORGE_SNAPSHOT_HEALTH_WAIT:-240}"
    cat <<'BOX'
dc up -d --remove-orphans --force-recreate >/dev/null 2>&1 || { dc up -d --remove-orphans --force-recreate; exit 1; }
deadline=$(( $(date +%s) + WAIT ))
while :; do
  waiting="$(dc ps --format '{{.Service}} {{.Health}}' | awk '$2=="starting"{print $1}')"
  [ -z "$waiting" ] && break
  [ "$(date +%s)" -lt "$deadline" ] || break
  sleep 3
done
bad="$(dc ps -a --format '{{.Service}} {{.State}} {{.Health}}' | awk '$2!="running" || $3=="unhealthy" || $3=="starting"{print "   " $0}')"
if [ -n "$bad" ]; then echo '[snapshot] ⚠️ not every container is healthy:' >&2; echo "$bad" >&2; exit 1; fi
echo "   $(dc ps --format '{{.Service}}' | wc -l) container(s) running and healthy" >&2
BOX
  } | on_box || die 'the stack did not come back healthy — the data and the pair ARE restored; `docker compose ps` / logs on the box.'
  say "restore · done · $label"
}

"$VERB"
