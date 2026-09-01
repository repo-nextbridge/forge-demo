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
export FORGE_ADMIN_SERVICE_TOKEN="$(optional_secret forge-admin-service-token)"

# ★ THE SEED'S CREDENTIAL — a TENANT API key, and it has to be minted by hand exactly once.
#
# ⚠️ THERE IS NO HEADLESS PATH, and the absence is deliberate rather than missing. `iam.api_key.create` is a
# TENANT command, so driving it already requires a credential — the chicken and its egg. The one command that
# could break the cycle, `platform.credential.issue`, is `system: true` AND off the CONTROL face's explicit
# allow-list, which is the platform saying that minting a tenant's credentials is not something a box does to
# itself over HTTP. So: create the key once in the admin (Developers ▸ API keys) with the scopes the seed
# needs, put it in your secret store under `forge-seed-token`, and never again.
#
# It is the same shape `templates/instance/compose.yml` already asks of an operator for FORGE_BULK_READ_TOKEN.
export FORGE_SEED_TOKEN="$(optional_secret forge-seed-token)"

# The tenant API key the storefront uses for WHOLE-CATALOGUE documents (the Google feed, the sitemap). Unset
# is safe — those are then built on the same budget shoppers' page views spend.
export FORGE_BULK_READ_TOKEN="$(optional_secret forge-bulk-read-token)"

# Busting the storefront's cache from a write. Shared by kernel, storefront and admin: with either side
# missing the POST answers 401 and every on-demand invalidation dies in silence.
export FORGE_REVALIDATE_SECRET="$(optional_secret forge-revalidate-secret)"

# The private half that signs the social login's factor assertion. ONLY the checkout container gets it.
export FORGE_CUSTOMER_ASSERTION_PRIVATE_KEY="$(optional_secret forge-customer-assertion-private-key)"

echo "[env-source] secrets exported into this shell. Now: source bin/images-from-lock.sh && docker compose up -d" >&2
