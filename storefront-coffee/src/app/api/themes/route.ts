// GET /api/themes — the storefront PUBLISHES the themes it can actually resolve. The admin reads this
// server-side to offer a dropdown of REAL themes when an operator picks a store's skin (never a hardcode,
// never a list typed by hand somewhere else).
//
// ★ WHY IT LIVES HERE AND NOT IN THE KERNEL. A theme is a FOLDER on the storefront's disk (`themes/<key>/`,
// resolved by lib/theme/resolve.ts). The kernel stores only the store's `theme_key` — a free string it
// deliberately does not validate, because it cannot: it has no idea what the front that serves this store
// ships. So the source of truth is the front, and the front is the only thing that can answer. Exactly the
// shape of `/api/slots`, for exactly the same reason.
//
// ★ THE LIST IS A CONVENIENCE, NEVER A GATE. `theme_key` stays a free string end to end: an operator may
// still be shown a value that is not here (a theme removed after it was chosen), the kernel still accepts a
// key this route never listed, and the storefront still falls back silently when a key resolves to nothing.
// This route makes the common case one click; it does not make the uncommon one impossible.
//
// Public, like /api/slots: the names of the skins a shop can wear are implied by the rendered page, and the
// admin proxies this server-side anyway.

import { availableThemeKeys } from '@forgeco/storefront-kit/theme/resolve';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  // A theme dropped into the folder appears here on the next request — no restart, no registry to edit. The
  // reference theme is always present, because the shell always has something to fall back to.
  return NextResponse.json({ themes: availableThemeKeys() });
}
