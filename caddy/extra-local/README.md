# The BENCH's routing fragments (`caddy/Caddyfile.local` only)

`caddy/Caddyfile.local` imports `/etc/caddy/extra-local/*.caddy` **from inside its `:80` site block**, so
every file here is a **FRAGMENT** — bare `handle` blocks, legal inside a site block and meaningless outside
one. Leave the folder empty and nothing changes: Caddy accepts a pattern that matches no files (one `warn`
line). This README is not a `.caddy` file, so it is never imported.

The real files here are **GENERATED** — `bin/box-up.sh` (step 3c) writes `coffee.caddy` from the café store
id provisioning has just minted — and they are gitignored. `coffee.caddy.example` shows the shape without a
running box; its name does not end in `.caddy`, so the import does not pick it up.

## ⚠️ Why this is a SEPARATE FOLDER from `caddy/extra/`, and never a narrower suffix (A10)

The production edge (`caddy/Caddyfile`) ends with `import /etc/caddy/extra/*.caddy`, at **top level**, so
every file it matches is parsed as a **site block**. These two shapes cannot share a directory.

This folder used to be `caddy/extra/`, and the file was called `coffee.local.caddy` on the theory that
`*.local.caddy` was narrower than `*.caddy`. **It is not — it is a strict subset.** The production Caddyfile
imported the bench's fragment at top level and answered:

```
caddy validate → Error: … /etc/caddy/extra/coffee.local.caddy:62: parsed 'handle' as a site address
```

An invalid Caddyfile is **not a broken extra host — it is a dead edge**: nothing on the box answers, not the
store, not the checkout, not the admin. The bench never showed it, because the bench reads a different
top-level file; it was waiting for the first production load of this instance.

`bin/caddy-extra-door.guard.mjs` is the rule now: **one reader per directory**, every imported directory
mounted, every generated fragment paired with exactly one import, and nothing a generator writes committed.
It executes the subset fact against a real matcher rather than believing it.

| folder | read by | at | file shape | who writes the files |
|---|---|---|---|---|
| `caddy/extra/` | `caddy/Caddyfile` | top level | **site blocks** (`host { … }`) | a human, per box — see that folder's README |
| `caddy/extra-local/` | `caddy/Caddyfile.local` | inside `:80` | **fragments** (`handle … { … }`) | `bin/box-up.sh`, step 3c |

Point `FORGE_CADDY_EXTRA_LOCAL_DIR` (in `.env`) somewhere else if you want these files outside the instance
directory — the same knob `FORGE_CADDY_EXTRA_DIR` gives the production folder.
