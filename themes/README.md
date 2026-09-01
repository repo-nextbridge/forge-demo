# `themes/` — this instance's own themes

A store names its theme with `theme_key`, and both fronts look for `<FORGE_THEMES_DIR>/<key>` — mounted here
from this folder, into the **storefront and the checkout** (a themes mount on the vitrine alone gives a shop
that changes clothes at the "Finalizar compra" button).

A theme is **the visual identity layer and nothing else**: tokens, colour, typography, radius, the logo file.
It is not a place for text. The store's words — its name, its menu, its announcement bar, its logo choice —
are **data of the store**, and a theme that starts carrying copy has become a second database nobody can
edit without a deploy. (Same rule, in the other direction: a font is the theme's and never the store's.)

A key nothing here answers resolves to the base theme. It never 500s, and that is deliberate: a typo in a
`theme_key` costs a plain-looking shop, not an outage.

## What arrives here, and when

| folder | store | slice |
|---|---|---|
| `outlet/` | Forge Outlet | **D2** — tokens only (accent `#BE123C`, rounded radius against the base's square corners). Its whole thesis is that a theme + data + composition needs no code. |
| `coffee-store/` | Forge Café | **C2** — tokens (`--accent #B0793C`, `--r 10px`, `--ri 9px`) plus the display font, which travels as a file beside the tokens. |

## Making one

Copy the reference theme out of the Forge monorepo (`themes/storefront-vanilla`) and change token values.
Nothing else: if a theme needs a structural change to a template, that is a signal the change belongs in the
composition or in the front, not in the palette.

⚠️ **A font is a FILE, not a URL.** A theme that names a webfont it does not ship depends on a third party
being up and on the shopper's network reaching it. Put the `.woff2` in the theme folder next to `tokens.css`.
