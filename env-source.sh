#!/usr/bin/env bash
# THE ONE FILE THAT KNOWS THIS BOX'S SECRETS. SOURCE it before every compose command:
#
#   source ./env-source.sh
#   docker compose up -d
#
# Secrets are EXPORTED INTO THE SHELL and never written to disk — that is the whole reason this file exists
# next to a `.env` that is checked in. Compose prefers a shell value over `.env`, so sourcing this is what
# makes the secrets reach the containers, and an edit to `.env` needs a re-source in the same shell.
#
# ⚠️ NEVER PUT A SECRET VALUE IN THIS FILE. Implement `secret` against wherever this box keeps them. The
# bench implementation below reads a gitignored `.secrets` file, which is the least bad thing for a laptop
# and the wrong thing for anything else — a cloud secret manager, Vault or a sops-encrypted file are the
# implementations `templates/instance/env-source.sh` carries in full, and this is where one of them goes.

set -u

# ── the accessor ────────────────────────────────────────────────────────────────────────────────────────────
# One name in, one value out. Everything below is written in terms of it, so swapping the backend is one
# function and no other line.
secret() { # <name>
  local name="$1"
  # BENCH IMPLEMENTATION: `.secrets` in this directory, `NAME=value` per line, gitignored.
  #   printf 'forge-vault-key=%s\n' "$(openssl rand -base64 32)" >> .secrets
  local file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.secrets"
  [ -f "$file" ] || return 1
  # ⚠️ THE **LAST** MATCH, NOT THE FIRST, AND THE DIFFERENCE IS A ROTATION. The one gesture this file
  # documents for adding a secret is `>>` — appending. So rotating one the same way leaves TWO lines with
  # that name, and `grep -m1` would hand the box the RETIRED value, silently, for as long as the old line
  # stayed in the file. Last wins: the newest line is the live one, exactly as an append reads.
  local line
  line="$(grep "^${name}=" "$file" 2>/dev/null | tail -n1)"
  [ -n "$line" ] || return 1
  printf '%s' "${line#*=}"
}

optional_secret() { secret "$1" 2>/dev/null || printf ''; }

# ★ WHAT `.env` DECLARES, read from HERE. `.env` is compose's file, not this shell's, so a value a container
# is interpolated from is invisible to a script until somebody reads it — and two of the blocks below are
# decisions `.env` makes about what this shell must export. Quotes are stripped the way both `source` and
# compose see them. Defined up here because the mailbox block needs it long before the purge block does.
_forge_env_declares() { # <VAR>
  local file line
  file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.env"
  [ -f "$file" ] || return 1
  # The LAST match, because compose reads this file the same way: `bin/deploy.sh` assembles `.env` from
  # `deploy/box.env` and then `deploy/<env>.env`, so a key declared in both appears twice and the box's own
  # value is the second one. A first-match read here would answer a different question than the containers do.
  line="$(grep "^$1=" "$file" 2>/dev/null | tail -n1)"
  [ -n "$line" ] || return 1
  line="${line#*=}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

require() { # <VAR> <secret name>
  local var="$1" name="$2" value
  if ! value="$(secret "$name")" || [ -z "$value" ]; then
    echo "[env-source] missing required secret '${name}'. Add it to your secret store (see the accessor" >&2
    echo "[env-source]   above) and source this file again. Nothing was exported." >&2
    return 1
  fi
  printf -v "$var" '%s' "$value"
  export "${var?}"
}

# ── what this box needs to start ────────────────────────────────────────────────────────────────────────────

# The database. On the bench it is the `postgres` service in compose.yml, reached by service name; the
# password is a secret even here, because a default password is the one nobody changes later.
require POSTGRES_PASSWORD forge-postgres-password || return 1
export POSTGRES_USER="${POSTGRES_USER:-forge}"
export POSTGRES_DB="${POSTGRES_DB:-forge}"
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

# Encrypts the credentials apps store (a payment provider's keys, an ERP's). Rotating it re-keys them; losing
# it means re-entering every one. `openssl rand -base64 32`.
require FORGE_VAULT_KEY forge-vault-key || return 1

# Minted by `provision-ref` at bootstrap and shown ONCE. Without it the admin boots and nobody can log in.
#
# ⚠️ ON THIS BOX IT IS NOW INERT, AND THAT IS DELIBERATE — read before "fixing" it. This is the SINGULAR
# service token, and `loginTarget()` (apps/admin/src/lib/login-command-client.ts) consults it ONLY on the
# PINNED branch, i.e. when `FORGE_ADMIN_TENANT` has a value. This box runs in HOST mode with that variable
# EMPTY, so the singular is never read; host mode looks at the PLURAL map `FORGE_ADMIN_SERVICE_TOKENS` and,
# finding nothing, mints a driver per hostname from the platform credential below. Left exported because a box
# that goes back to pinning one tenant needs it, and because deleting it would make the next reader think host
# mode requires deleting it.
export FORGE_ADMIN_SERVICE_TOKEN="$(optional_secret forge-admin-service-token)"

# ★★ THE BOX'S OWN PLATFORM CREDENTIAL — what makes ONE admin container serve BOTH tenants (PRE-SEED · P-A).
#
# Minted by `docker compose run --rm kernel node dist/admin-platform-token.js`, which prints it once on stdout;
# capture it into `.secrets` as `forge-admin-platform-token`. It holds exactly ONE scope
# (`platform.admin_driver.mint`) — deliberately NOT `platform.iam.write`, so it cannot reach generic credential
# issuance, and NOT `platform.read`, so it cannot read another tenant's rows.
#
# WITHOUT IT, HOST MODE IS A MODE THAT LOOKS CONFIGURED AND IS NOT: the compose declares the variable with an
# empty default, the admin boots, and every login answers `not_configured` — measured on this box before this
# line existed. That is the shape this file's whole doctrine is against, so it is `optional_secret` (a box
# that pins one tenant needs none) with the failure named here rather than discovered at a login screen.
export FORGE_ADMIN_PLATFORM_TOKEN="$(optional_secret forge-admin-platform-token)"

# The SECOND tenant's login-driver, for symmetry with its seed token. ⚠️ HOST MODE DOES NOT USE EITHER OF THE
# LOGIN-DRIVER SECRETS — it mints one per hostname from the platform credential above — so this is here for a
# box that goes back to pinning, and for a script that wants to drive `operator.request_otp` directly instead
# of going through the admin's login screen. Its absence was invisible until exactly such a script asked for
# it: T1's happened to be exported and T2's was not.
export FORGE_ADMIN_SERVICE_TOKEN_FORGECAFE="$(optional_secret forge-admin-service-token-forgecafe)"

# ★★★ WHICH MAILBOX THIS BOX HAS, AND IT IS ONE FACT IN `.env` — `FORGE_BENCH_MAILBOX`.
#
# ⛔ THE DEFECT, MEASURED ON BOTH BENCHES 2026-09-13: zero mail containers, `FORGE_SMTP_*` on Resend, and the
# only deliverable address on the box a single personal mailbox (it is in the dataset). So nobody else could
# log in, anywhere, as anyone. The escape a developer expects does not exist here: the transport that PRINTS
# the code is constructible only under `!production` (apps/api/src/smtp-channel-driver.ts) and this compose
# declares `NODE_ENV: production`. ⇒ a collector in the compose, which weakens nothing.
#
# ★★ ONE FACT, THREE EXPORTS, AND THAT IS DELIBERATE. Declaring the profile in `.env` and the addresses here
# would be two declarations that can disagree, and the way they disagree is the worst one available: a box
# that SENDS REAL MAIL while an operator believes it is being captured. So `.env` says only whether this box
# has a collector, and this block derives everything the answer implies — the compose profile that creates
# the container, the four addresses that reach it, and the certificate the kernel has to trust.
#
# ⛔ AND A DEPLOYMENT DECLARES NOTHING, so it takes the `else` below and keeps the real provider. The
# collector's service carries `profiles:`, so it is not even created unless this block asks for it.
if [ -n "$(_forge_env_declares FORGE_BENCH_MAILBOX || printf '')" ]; then
  # ⚠️ `FORGE_SMTP_PORT` IS NOT ONE OF THE FOUR the kernel demands together (it defaults to 587), but it is
  # the one that decides the handshake: `secure` is `port === 465`, and anything else is STARTTLS. 1025 is
  # mailpit's submission port, reached by SERVICE NAME on the compose network — the SMTP port is not
  # published to the host, because the kernel is the only thing that speaks it.
  export FORGE_SMTP_HOST='mailpit'
  export FORGE_SMTP_PORT='1025'
  # Any credential is accepted by the collector (`--smtp-auth-accept-any`), and one has to be sent: the four
  # travel together and the driver always offers `AUTH`. Nothing here is a secret and nothing here protects
  # anything — which is exactly why it is written in the open instead of taken from the secret store.
  export FORGE_SMTP_USER='forge'
  export FORGE_SMTP_PASS='forge'
  export FORGE_SMTP_FROM="${FORGE_SMTP_FROM:-hi@forgecommerce.pro}"
  # ★★ THE HALF THAT IS NOT ABOUT ADDRESSES. The driver forces `STARTTLS` and nodemailer refuses to deliver
  # if the upgrade fails, so the collector offers a self-signed certificate and the kernel is told to trust
  # THAT ONE FILE. Measured 2026-09-14 (nodemailer 9.0.3, the pinned image's): without this the send dies
  # `ESOCKET self-signed certificate`; with it, `250 2.0.0 Ok: queued`. The path is the container's — see the
  # kernel's `./mail:/mail:ro` mount and mail/README.md.
  export FORGE_MAIL_CA='/mail/bench-collector.crt'
  # The profile that makes the service exist at all. Appended rather than assigned: a box that already asked
  # for another profile keeps it.
  case ",${COMPOSE_PROFILES:-}," in
  *,bench-mailbox,*) ;;
  *) export COMPOSE_PROFILES="${COMPOSE_PROFILES:+$COMPOSE_PROFILES,}bench-mailbox" ;;
  esac
  echo "[env-source] ✉️  BENCH MAILBOX — every message this box sends is captured by the \`mailpit\`" >&2
  echo "[env-source]     container and NOTHING leaves this machine. Read it (and the login codes) at" >&2
  echo "[env-source]     http://\${FORGE_BENCH_BIND}:\${FORGE_MAIL_HTTP_PORT} — see mail/README.md." >&2
  echo "[env-source]     ⛔ The Resend key, if this box has one, is NOT used while FORGE_BENCH_MAILBOX is set." >&2
else

# ★ THE MAILBOX (PRE-SEED · P-A) — Resend, the same account Staging uses, so a local test is the real test.
#
# ⚠️ ALL FOUR OR NONE. `FORGE_SMTP_HOST`, `USER` and `FROM` are not secrets and live in `.env`; only the
# password is here. A PARTIAL set is a FATAL BOOT ERROR by design (smtp-channel-driver.ts) — the driver names
# the missing one, which is the whole reason a half-configured mailer refuses instead of limping.
#
# ⚠️ AND WITHOUT ANY OF THEM THIS BOX HAS NO MAIL AT ALL — it does NOT fall back to printing the code. This
# compose declares `NODE_ENV: production`, and under production the transport that writes to the terminal is
# never constructed; what is built instead FAILS BY NAME on every message. No OTP reaches anyone and nobody
# logs in. `optional_secret` keeps a box without mail bootable; it does not make it loginable.
FORGE_SMTP_PASS="$(optional_secret forge-smtp-pass)"

# ★★ THE FOUR TRAVEL TOGETHER, FROM HERE, AND THAT IS THE WHOLE POINT OF THIS BLOCK.
#
# The kernel's rule is ALL FOUR OR NONE, enforced as a FATAL BOOT ERROR naming the missing one. Putting the
# three non-secret halves in `.env` and the password here looked tidier and was a trap: `.env` is static, the
# password is conditional, so a box whose owner had not added the key yet declared three of four and REFUSED
# TO BOOT — measured on this box, exactly that:
#
#     Error: refusing to boot: FORGE_SMTP_* is partially configured — missing FORGE_SMTP_PASS.
#
# The set is therefore assembled in ONE place, and the presence of the password is what decides whether the
# set exists at all. A box with no key boots with no mail; a box with a key boots with all four.
if [ -n "$FORGE_SMTP_PASS" ]; then
  export FORGE_SMTP_PASS
  export FORGE_SMTP_HOST="${FORGE_SMTP_HOST:-smtp.resend.com}"
  export FORGE_SMTP_USER="${FORGE_SMTP_USER:-resend}"
  export FORGE_SMTP_FROM="${FORGE_SMTP_FROM:-hi@forgecommerce.pro}"
else
  # Explicitly EMPTY, not merely unset: a value inherited from the surrounding shell would rebuild the partial
  # set this block exists to prevent.
  export FORGE_SMTP_PASS='' FORGE_SMTP_HOST='' FORGE_SMTP_USER='' FORGE_SMTP_FROM=''
  echo "[env-source] ⚠️  no 'forge-smtp-pass' secret — this box boots WITHOUT e-mail." >&2
  echo "[env-source]     It does NOT fall back to printing the code: this compose runs NODE_ENV=production," >&2
  echo "[env-source]     where the terminal transport is never built and every message FAILS BY NAME. No OTP" >&2
  echo "[env-source]     is delivered and nobody can log in. Add the Resend key to .secrets as" >&2
  echo "[env-source]     'forge-smtp-pass' and re-source this file." >&2
fi
# ⛔ EMPTY, NOT UNSET — same reason as the four above. A box that ran with the collector and then declared
# nothing must not inherit the trust anchor from the old shell and go on trusting a certificate no container
# is presenting.
export FORGE_MAIL_CA=''
fi

# ★ THE SEED'S CREDENTIAL — and it already exists on this box.
#
# The `Reference Operator` credential that `provision-ref` prints at bootstrap holds every scope the seed
# needs (`tenant.store.write`, `catalog.product.write`, `catalog.sku.write`, `custom_fields.write`,
# `media.write`, and more). Capture it here as `forge-operator-token` and nothing else has to be minted.
#
# ⚠️ AND HERE IS THE PART THAT COST THIS SLICE AN EVENING. I reported that a tenant key could only be minted
# by a human in the admin, because that credential answered 403 on `/v1/commands/*`. THAT WAS THE WRONG
# CONCLUSION FROM A REAL REFUSAL: the write face takes the tenant as a HEADER (`x-forge-tenant`,
# apps/api/src/adapter.ts:42) and without it refuses with `forbidden: "tenant required"`
# (packages/core/src/dispatcher.ts:272) — while the SAME token answers the internal READ face with real
# data. A 403 next to a 200 is not proof that a credential cannot write.
#
# With the header, this credential drives the whole first day: the seed, `iam.api_key.create` (so a narrower
# key needs no admin either) and `extension.install`.
export FORGE_OPERATOR_TOKEN="$(optional_secret forge-operator-token)"

# ★★ AND THE SECOND TENANT'S (PRE-SEED · P-A). A credential belongs to ONE tenant and the cross-tenant guard
# refuses it against any other — that refusal is the boundary working, not a misconfiguration. So a box with
# two tenants has two seed credentials, and a seeding run names which it is:
#
#   node bin/seed-box.mjs --tenant forgeco
#   FORGE_OPERATOR_TOKEN="$FORGE_OPERATOR_TOKEN_FORGECAFE" node bin/seed-box.mjs --tenant forgecafe
#
# Both are printed once by their own `provision-ref` run and captured into `.secrets`; neither is ever echoed.
export FORGE_OPERATOR_TOKEN_FORGECAFE="$(optional_secret forge-operator-token-forgecafe)"

# ★★★ THE TWO ADMINS' FRONT DOOR — ONE REDEEMABLE KEY PER TENANT (pk38/d8).
#
# `FORGE_ADMIN_ACCESS_KEYS` is `{"<tenant id>": {"store": "<store id>", "key": "<key>"}}`, and the admin's
# `/enter` route redeems the entry for the tenant the request's hostname resolves to (`read.admin.by_host`):
# an operator who clicks "abrir o admin" on the gate lands SIGNED IN, with no login screen and no code in an
# inbox. The key never reaches a browser — `/enter` redeems it server-side and sets the session cookie
# itself. The `store` rides along because the kernel's redeem face is PUBLIC: it takes a store instead of a
# credential, and the store is what fixes which tenant the key is checked against.
#
# ⛔ WHY IT IS A MAP AND NOT A KEY. One admin container serves BOTH brands here, by hostname; a single key
# belongs to ONE tenant and is redeemed store-scoped, so handing one value to that container would sign a
# visitor on hostname B into tenant A. That is the front-door leak the product's route refuses to guess its
# way around, and the answer is per-tenant configuration rather than a relaxed refusal.
#
# ★ IT IS ASSEMBLED BY `bin/admin-access-key.mjs --declare` RATHER THAN HERE, so the rule for where a
# tenant's key is filed (`forge-admin-access-key`, and `-<tenant>` for every tenant after the first — the
# same shape as the seed tokens above) has ONE author. That script merges the secret half with the store ids
# `.env` declares (`FORGE_ADMIN_STORE_IDS`, written by the birth).
#
# ★★★ AN ENTRY IS WHOLE OR ABSENT, NEVER BORROWED. A tenant missing a key or a store is dropped from the map
# and its admin behaves exactly as an unconfigured instance always did — it shows its login screen. It must
# never take the neighbour's entry: that is the front-door leak this whole shape exists to prevent.
#
# ⚠️ EMPTY OBJECT, NEVER EMPTY STRING, and never an error. This is sourced on machines mid-setup, on a box
# with no `.secrets` yet, and by a shell with no node on PATH; each of those is "this box declares no door",
# which is a state — not a reason to refuse to export the rest of the environment.
_forge_admin_access_keys() {
  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  command -v node >/dev/null 2>&1 || { printf '{}'; return 0; }
  node "$dir/bin/admin-access-key.mjs" --declare 2>/dev/null || printf '{}'
}
export FORGE_ADMIN_ACCESS_KEYS="$(_forge_admin_access_keys)"

# WHICH TENANT the seed writes to. It is NOT a secret and it already lives in `.env` — but `.env` is read by
# COMPOSE and not by your shell, so a script you run by hand would not see it. One line, so `node
# bin/seed.mjs` works in the same shell that just sourced this file.
export FORGE_SEED_TENANT="${FORGE_SEED_TENANT:-$(grep -m1 '^FORGE_REF_TENANT=' "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.env" 2>/dev/null | cut -d= -f2-)}"

# The tenant API key the storefront uses for WHOLE-CATALOGUE documents (the Google feed, the sitemap). Unset
# is safe — those are then built on the same budget shoppers' page views spend.
export FORGE_BULK_READ_TOKEN="$(optional_secret forge-bulk-read-token)"

# Busting the storefront's cache from a write. Shared by kernel, storefront and admin: with either side
# missing the POST answers 401 and every on-demand invalidation dies in silence.
#
# ★★ AND THIS ONE'S HOME IS `.env`, NOT THE SECRET STORE — the ONLY variable in this file that is read back
# from there, and the reason is that this box MINTS it rather than being given it: `bin/box-up.sh` step
# 3c-bis writes it into `.env` and never into a secret store.
#
# ⛔ THE TRAP THAT MADE THIS EXPLICIT, MEASURED ON THE BENCH 2026-09-08. `.env` held one value and `.secrets`
# held ANOTHER, and both were live at once:
#
#   · `bin/box-up.sh` sources this file and THEN `.env` (bin/box-up.sh:587-589), so the birth's own shell —
#     and every container it starts — carries `.env`'s value;
#   · a human who runs `source env-source.sh` and stops there carries the secret store's, and compose PREFERS
#     a shell value over the file (see this file's header) — so the next `docker compose up` from that shell
#     would put a THIRD state on the box. Measured symptom: `node bin/warm-box.mjs` answered 401 against a
#     storefront that held the other value, and nothing anywhere said the two disagreed.
#
# Two homes for one value is two answers, and the one the containers were interpolated from wins. The secret
# store is still read for a box that keeps it there; when both answer and they DIFFER, this says so out loud
# rather than shadowing one of them.
_forge_revalidate_env="$(_forge_env_declares FORGE_REVALIDATE_SECRET || printf '')"
_forge_revalidate_store="$(optional_secret forge-revalidate-secret)"
if [ -n "$_forge_revalidate_env" ] && [ -n "$_forge_revalidate_store" ] &&
  [ "$_forge_revalidate_env" != "$_forge_revalidate_store" ]; then
  echo "[env-source] ⚠️  FORGE_REVALIDATE_SECRET is declared in TWO places with DIFFERENT values." >&2
  echo "[env-source]     .env holds one (it is what the running containers were interpolated from) and the" >&2
  echo "[env-source]     secret store holds another as 'forge-revalidate-secret'. Exporting .env's, so this" >&2
  echo "[env-source]     shell agrees with the box. Delete the secret-store copy: bin/box-up.sh mints this" >&2
  echo "[env-source]     value into .env and nothing ever writes it back." >&2
fi
export FORGE_REVALIDATE_SECRET="${_forge_revalidate_env:-$_forge_revalidate_store}"
unset _forge_revalidate_env _forge_revalidate_store

# The private half that signs the social login's factor assertion. ONLY the checkout container gets it.
export FORGE_CUSTOMER_ASSERTION_PRIVATE_KEY="$(optional_secret forge-customer-assertion-private-key)"

# ── MEDIA STORAGE — THE BUCKET THIS BOX WRITES ITS PHOTOGRAPHS TO ───────────────────────────────────────────
#
# ★★ WHY THIS BLOCK EXISTS, AND IT IS A MEASUREMENT OF 2026-09-16 RATHER THAN A PRECAUTION. The staging box
# answered 200 on every door with a home page of 72 KB where the bench serves 280 KB: no photograph, no
# banner, no shelf. Nothing was red anywhere, because EMPTY IS A LEGAL STATE — with no driver the kernel
# keeps media on its own disk, and with no public base it serves every image "as refs only" behind one log
# line (`storage-connector.ts`, the line that says placeholder everywhere). A shop with no photograph is
# still a 200. ⇒ AN HTTP CODE PROVES THE BOX IS UP. IT NEVER PROVES THE SHOP EXISTS.
#
# ── WHAT LIVES WHERE, AND WHY THE SPLIT IS NOT ARBITRARY ────────────────────────────────────────────────────
# The bucket's NAME and the address a browser fetches bytes from are public by construction — a browser reads
# them off every page — so they are declared in `.env` (`deploy/box.env` + `deploy/<env>.env`). The two
# CREDENTIALS are secrets. The ENDPOINT is the third one here and it is not a credential: it names the
# object-storage ACCOUNT, and this repository is public, so it is kept beside the keys rather than committed.
# A fork that does not mind naming its own account may move it to `deploy/box.env` and delete it here.
#
# ⚠️ AND THIS BLOCK REFUSES WHERE THE SOCIAL ONES BELOW STAY SILENT. A half-configured social login hides a
# button, which is kind to the shopper; a half-configured bucket gives a kernel that throws at boot, or —
# worse, and this is the measured case — one that comes up green serving a catalogue of placeholders. So an
# `s3` driver whose credentials are absent exports NOTHING and says both names out loud.
_forge_storage() {
  local driver bucket endpoint base id secret
  driver="$(_forge_env_declares FORGE_STORAGE_DRIVER || printf '')"
  case "$driver" in
    '' | local)
      # The bench, and every box that keeps its media on its own disk. Nothing to export, nothing to warn
      # about: this is a posture, not an omission (`.env` says so where it declares the empty driver).
      unset FORGE_STORAGE_ENDPOINT FORGE_STORAGE_ACCESS_KEY_ID FORGE_STORAGE_SECRET_ACCESS_KEY
      return 0
      ;;
    s3) ;;
    *)
      echo "[env-source] ⚠️  FORGE_STORAGE_DRIVER=${driver} — this file fills the credentials of 's3' only." >&2
      echo "[env-source]    Whatever that driver signs with has to reach the shell some other way." >&2
      return 0
      ;;
  esac

  endpoint="$(optional_secret forge-storage-endpoint)"
  id="$(optional_secret forge-storage-access-key-id)"
  secret="$(optional_secret forge-storage-secret-access-key)"
  if [ -z "$endpoint" ] || [ -z "$id" ] || [ -z "$secret" ]; then
    unset FORGE_STORAGE_ENDPOINT FORGE_STORAGE_ACCESS_KEY_ID FORGE_STORAGE_SECRET_ACCESS_KEY
    echo "[env-source] ⛔ FORGE_STORAGE_DRIVER=s3 and this box cannot reach the bucket. The secret store must" >&2
    echo "[env-source]    carry all three; nothing was exported and the kernel WILL refuse to start:" >&2
    [ -n "$endpoint" ] || echo "[env-source]      forge-storage-endpoint            (https://<account>.<provider> — the account, never one bucket)" >&2
    [ -n "$id" ]       || echo "[env-source]      forge-storage-access-key-id" >&2
    [ -n "$secret" ]   || echo "[env-source]      forge-storage-secret-access-key" >&2
    return 1
  fi
  export FORGE_STORAGE_ENDPOINT="$endpoint" FORGE_STORAGE_ACCESS_KEY_ID="$id" \
    FORGE_STORAGE_SECRET_ACCESS_KEY="$secret"

  # The two addresses `.env` owes this driver. A missing BUCKET is a boot error the kernel names itself; a
  # missing public base is THE SILENT ONE, so it is the one said loudly here — it is the 72 KB home page, and
  # it also makes the seed refuse to repair a single media ref (`seed-media.ts`).
  bucket="$(_forge_env_declares FORGE_STORAGE_BUCKET || printf '')"
  base="$(_forge_env_declares FORGE_MEDIA_BASE_URL || printf '')"
  [ -n "$bucket" ] \
    || echo "[env-source] ⚠️  FORGE_STORAGE_BUCKET is not declared in .env — the kernel refuses to start without it." >&2
  [ -n "$base" ] \
    || echo "[env-source] ⚠️  FORGE_MEDIA_BASE_URL is not declared in .env — this box will come up GREEN with a placeholder in place of every photograph, and the seed will repair no media ref at all." >&2

  echo "[env-source] media storage: s3 → ${bucket:-<no bucket>} @ ${endpoint}" >&2
}
_forge_storage; unset -f _forge_storage

# ── SOCIAL LOGIN — GOOGLE (operator and shopper) AND APPLE (shopper) ────────────────────────────────────────
#
# ★★ WHY THIS BLOCK DID NOT EXIST UNTIL 16/09, MEASURED. `compose.yml:258-266` and `:311` already hand all nine
# variables to the checkout and the admin — the wiring was complete. What was missing was anybody FILLING them:
# this file mentioned neither provider, so every container got the empty string and `config.ts` hid both
# buttons. Nothing was red, because an incomplete set hiding a button is the DESIGNED behaviour, not a fault.
# ⇒ A box can be wired end to end for a capability and simply never be told the capability exists.
#
# ⚠️ ALL-OR-NOTHING, PER PROVIDER, AND THAT IS THE POINT. `packages/storefront-kit/src/config.ts` returns
# `undefined` unless the whole set is present, and the front hides the button rather than offering one that
# fails. So a half-filled group is SILENT — which is kind to the shopper and cruel to whoever is configuring.
# The `[env-source]` lines below are the only thing that tells you which half you have.
#
# ⛔ THE REDIRECT URIs ARE NOT SET HERE, AND MUST NOT BE. The product derives them from the request's host and
# refuses a host its own directory does not claim (pk43/s3). A value written here would either be ignored or
# disagree with what the route actually serves — the same reason `infra/env-source.sh` derives rather than
# stores them. What you register with the provider is the list of hosts this box serves; nothing more.
#
# ⚠️ AND THEY ONLY WORK OVER https, ON A HOST THE PROVIDER KNOWS. On this bench (a tailnet hostname nobody
# registered) the handshake would come back `redirect_uri_mismatch`, so leaving the secret store EMPTY here is
# the right state for a bench: no values, no group, no button, nothing broken.

_forge_social_google() {
  local id secret
  id="$(optional_secret forge-storefront-google-client-id)"
  secret="$(optional_secret forge-storefront-google-client-secret)"
  if [ -n "$id" ] && [ -n "$secret" ]; then
    export FORGE_GOOGLE_CLIENT_ID="$id" FORGE_GOOGLE_CLIENT_SECRET="$secret"
    echo "[env-source] shopper Google login: ON" >&2
  else
    unset FORGE_GOOGLE_CLIENT_ID FORGE_GOOGLE_CLIENT_SECRET
    [ -n "$id$secret" ] && echo "[env-source] ⚠️  shopper Google login: HALF configured — the button stays hidden." >&2
  fi
}
_forge_social_google; unset -f _forge_social_google

_forge_admin_google() {
  local id secret
  id="$(optional_secret forge-google-client-id)"
  secret="$(optional_secret forge-google-client-secret)"
  if [ -n "$id" ] && [ -n "$secret" ]; then
    export GOOGLE_CLIENT_ID="$id" GOOGLE_CLIENT_SECRET="$secret"
    echo "[env-source] operator Google login: ON" >&2
  else
    unset GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
    [ -n "$id$secret" ] && echo "[env-source] ⚠️  operator Google login: HALF configured — the button stays hidden." >&2
  fi
}
_forge_admin_google; unset -f _forge_admin_google

# Apple needs FOUR to mint the client secret at login time (the .p8 plus the two ids that name it), and the
# domain association is a FIFTH that is optional-on-top: without it `/.well-known/apple-developer-domain-
# association.txt` answers 404 and Apple never trusts the Services ID — a button that asks for the password
# and comes back without signing anybody in. ⚠️ The .p8 may carry `\n`-encoded newlines; config.ts:45 undoes
# that, so paste it either way.
_forge_social_apple() {
  local svc team key pem
  svc="$(optional_secret forge-apple-service-id)"
  team="$(optional_secret forge-apple-team-id)"
  key="$(optional_secret forge-apple-key-id)"
  pem="$(optional_secret forge-apple-private-key)"
  if [ -n "$svc" ] && [ -n "$team" ] && [ -n "$key" ] && [ -n "$pem" ]; then
    export FORGE_APPLE_SERVICE_ID="$svc" FORGE_APPLE_TEAM_ID="$team"
    export FORGE_APPLE_KEY_ID="$key" FORGE_APPLE_PRIVATE_KEY="$pem"
    export FORGE_APPLE_DOMAIN_ASSOCIATION="$(optional_secret forge-apple-domain-association)"
    [ -n "${FORGE_APPLE_DOMAIN_ASSOCIATION:-}" ] \
      || echo "[env-source] ⚠️  Sign in with Apple: ON, but NO domain association — Apple will not trust this Services ID." >&2
    echo "[env-source] Sign in with Apple: ON" >&2
  else
    unset FORGE_APPLE_SERVICE_ID FORGE_APPLE_TEAM_ID FORGE_APPLE_KEY_ID \
      FORGE_APPLE_PRIVATE_KEY FORGE_APPLE_DOMAIN_ASSOCIATION
    [ -n "$svc$team$key$pem" ] \
      && echo "[env-source] ⚠️  Sign in with Apple: INCOMPLETE — all four are required; the button stays hidden." >&2
  fi
}
_forge_social_apple; unset -f _forge_social_apple

echo "[env-source] secrets exported into this shell. Now: source bin/images-from-lock.sh && docker compose up -d" >&2
