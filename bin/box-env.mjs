// THE BOX'S DECLARATION ON DISK — `.env` — AND THE ONE QUESTION TWO STEPS ASK OF IT.
//
// ⚠️ THE FILE, NOT THIS PROCESS'S ENVIRONMENT, and that distinction is the whole reason this module exists.
// `bin/box-up.sh` sources `.env` before it calls either step, so both would usually agree — but the file is
// what the next `docker compose up` interpolates and what the next birth rewrites, so the file is the
// declaration. A step that read `process.env` would grade the shell it was started from.
//
// ★★ AND THE SECOND EXPORT IS A RULE, NOT A LOOKUP. `FORGE_STORE_HOSTS` is the host → store OVERRIDE the
// FRONTS obey (`packages/storefront-kit/src/resolve-store.ts` checks it before it asks the port), so it is
// what decides which store a shopper typing this box's address lands on. Asking it "who is at the root of
// this authority?" is a question `bin/warm-box.mjs` and `bin/box-up.sh --promote` both have, and it has to
// be answered the way the KERNEL answers it or the two would disagree about the same box:
// `read.store.by_host` tries «the exact host WITH its port» first and falls back to the bare host
// (docs/reference/read.store.by_host.md). This does the same, so a map written for `localhost:8200` answers
// a box published at `http://localhost:8200` and a map written for `loja.com` answers `loja.com:443`.

import { readFileSync } from 'node:fs';

/**
 * `.env` as it stands on disk, as a flat object.
 *
 * Single quotes are stripped the way bash's `source` and compose both end up seeing the value — `box-up.sh`
 * writes the JSON values quoted on purpose (see `put_env`'s note on why), and a reader that kept the quotes
 * would fail to parse exactly the two variables that carry the box's addresses.
 *
 * Throws whatever `readFileSync` throws: a caller that cannot read the declaration has no declaration to
 * grade, and that is a different sentence from "the declaration is wrong".
 */
export function readDeclaration(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))
      .map((l) => {
        const at = l.indexOf('=');
        const value = l.slice(at + 1).trim();
        const unquoted = /^'.*'$/s.test(value) ? value.slice(1, -1) : value;
        return [l.slice(0, at), unquoted];
      }),
  );
}

/** `FORGE_STORE_HOSTS` parsed, or `{}` when it is absent or is not JSON. */
export function storeHosts(declared) {
  try {
    const map = JSON.parse(declared?.FORGE_STORE_HOSTS || '{}');
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

/**
 * The store THIS BOX serves at the root of `authority` (`host` or `host:port`), or `null`.
 *
 * The kernel's own matching rule, mirrored: exact authority first, then the bare host. Keys are compared
 * case-insensitively because a `Host:` header is.
 */
export function storeAtRoot(declared, authority) {
  const map = storeHosts(declared);
  const wanted = String(authority ?? '').toLowerCase();
  if (!wanted) return null;
  const bare = wanted.replace(/:\d+$/, '');
  for (const key of [wanted, bare]) {
    const hit = Object.entries(map).find(([k]) => k.toLowerCase() === key);
    if (hit?.[1]) return hit[1];
  }
  return null;
}
