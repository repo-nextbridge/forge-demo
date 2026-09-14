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
  local line
  line="$(grep -m1 "^${name}=" "$file" 2>/dev/null)" || return 1
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
  line="$(grep -m1 "^$1=" "$file" 2>/dev/null)" || return 1
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
# only deliverable address on the box the owner's own (it is in the dataset). So nobody else could log in,
# anywhere, as anyone. The escape a developer expects does not exist here: the transport that PRINTS the code
# is constructible only under `!production` (apps/api/src/smtp-channel-driver.ts) and this compose declares
# `NODE_ENV: production`. ⇒ a collector in the compose, which weakens nothing.
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
# `media.write`, and more). Capture it here as `forge-seed-token` and nothing else has to be minted.
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
export FORGE_SEED_TOKEN="$(optional_secret forge-seed-token)"

# ★★ AND THE SECOND TENANT'S (PRE-SEED · P-A). A credential belongs to ONE tenant and the cross-tenant guard
# refuses it against any other — that refusal is the boundary working, not a misconfiguration. So a box with
# two tenants has two seed credentials, and a seeding run names which it is:
#
#   node bin/seed-box.mjs --tenant forgeco
#   FORGE_SEED_TOKEN="$FORGE_SEED_TOKEN_FORGECAFE" node bin/seed-box.mjs --tenant forgecafe
#
# Both are printed once by their own `provision-ref` run and captured into `.secrets`; neither is ever echoed.
export FORGE_SEED_TOKEN_FORGECAFE="$(optional_secret forge-seed-token-forgecafe)"

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

echo "[env-source] secrets exported into this shell. Now: source bin/images-from-lock.sh && docker compose up -d" >&2
