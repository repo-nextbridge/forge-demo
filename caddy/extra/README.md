# Extra hostnames (normally empty)

`caddy/Caddyfile` ends with `import /etc/caddy/extra/*.caddy`, and this folder is what gets mounted there.
Leave it empty and nothing changes — Caddy accepts a pattern that matches no files (it writes one `warn`
line and carries on). This README is not a `.caddy` file, so it is never imported.

Put a file here when this box has to serve a hostname the two in `.env` do not cover.

## The case this exists for: a second tenant on this box

One instance can hold more than one tenant — a second brand, a second company — and the storefront already
serves them all (host → store is data: set the store's public URL in the admin). The **admin** serves them
all too, from ONE container, when it runs in **host mode**: it resolves which tenant to manage from the
request `Host`. So a second tenant costs a hostname here, not a second container.

**1. Put the admin in host mode** — in `.env`, leave the pin EMPTY and give it the box credential:

```dotenv
FORGE_ADMIN_TENANT=
FORGE_ADMIN_PLATFORM_TOKEN=<mint it with: docker compose run --rm kernel node dist/admin-platform-token.js>
```

`FORGE_ADMIN_TENANT` set to a value keeps the old pinned behaviour; EMPTY is the declaration, and UNSET is
refused — the mode a container ends up in can never disagree with the mode you asked for.

**2. Claim each hostname** for its tenant, so the admin knows which one the `Host` means. A hostname nobody
claimed is refused rather than guessed:

```bash
docker compose run --rm kernel node dist/admin-host.js set admin.marca-dois.exemplo.com.br <tenant-id>
```

**3. Add the hostname here**, one file, pointing at the SAME `admin` container — and point the DNS at this
box:

```caddy
admin.marca-dois.exemplo.com.br {
	reverse_proxy admin:3000
}
```

**4. Reload the edge.** Caddy reads its configuration when it starts, so a new file here does not reach a
running container on its own:

```bash
docker compose up -d
docker compose up -d --force-recreate caddy
```

Caddy issues that hostname's certificate automatically, like the other two.

## Notes

- **A file pointing at a container that is not running is not an outage.** That hostname answers 502; every
  other hostname on this box keeps serving. So the order above is safe either way.
- Caddy matches site blocks by how specific they are, not by where they appear, so a hostname added here
  behaves exactly like the ones written directly in `caddy/Caddyfile`.
- Prefer to keep these files outside the instance directory? Point `FORGE_CADDY_EXTRA_DIR` (in `.env`)
  wherever you want — the same knob `FORGE_TLS_CERT_DIR` gives you for certificates.
- **"Sign in with Google" on an extra admin hostname** needs its callback
  (`https://<that host>/login/google/callback`) added to the same OAuth client. Without it the button simply
  hides and e-mail login works as usual.
