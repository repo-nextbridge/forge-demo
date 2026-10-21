# Extra hostnames (normally empty)

`caddy/Caddyfile` ends with `import /etc/caddy/extra/*.caddy` — **at top level**, so every file here is a
whole **site block** (`hostname { … }`). Leave it empty and nothing changes — Caddy accepts a pattern that
matches no files (it writes one `warn` line and carries on). This README is not a `.caddy` file, so it is
never imported.

> ⚠️ **The BENCH's fragments live next door, in `caddy/extra-local/`** — `caddy/Caddyfile.local` imports them
> from *inside* its `:80` site block, so they are bare `handle` blocks, not site blocks. They shared this
> folder once, under the name `*.local.caddy`, on the theory that it was a narrower glob: `*.caddy` matches
> `coffee.local.caddy`, so production parsed a fragment as a site address and refused the whole file — store,
> checkout and admin down together. **One folder, one reader** (A10); `bin/caddy-extra-door.guard.mjs` holds it.

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
	import forwarded_client
	import forge_noindex
	import access_log
	reverse_proxy admin:3000
}
```

`import forge_noindex` is the demo's `X-Robots-Tag: noindex, nofollow` (MZ-9): every hostname of this box
stays out of search engines, and a file here is imported after `caddy/Caddyfile` defined the snippet, so it
resolves (measured with `caddy:2` v2.11.4). Leave it out and that hostname is the one face a crawler indexes.

`import forwarded_client` is what the admin is told the caller's address is (FI-BORDA): the one the edge
resolved through `trusted_proxies` — behind Cloudflare, the shopper or operator rather than Cloudflare's edge —
replacing whatever the caller wrote into `X-Forwarded-For`. Leave it out and that hostname passes a forgeable
header along. `bin/trusted-proxies-edge.guard.mjs` holds this recipe to it.

`import access_log` is the edge's access log (Forge v0.3.3, VC-2): one line per request in
`/var/log/caddy/access.log`, rolled at 100 MiB, five gzipped files kept, `email`/`code`/`state` and `Referer`
redacted. Same rule, same reason it resolves: leave it out and that hostname is the one face nobody can audit
the day the box fills up. `bin/access-log-edge.guard.mjs` holds this recipe to it.

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
