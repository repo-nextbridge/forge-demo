// ★★ THE THREE MARKS OF THE SHOP WINDOW — one component per place the vitrine shows the shop's name, which
// is the whole point of this app.
//
// ★★ THERE WAS A FOURTH AND IT LEFT IN pk28, ON THE AXIS OF THE DEPLOYABLE. `account.brand` — the login box —
// is drawn by the CHECKOUT, which we host and nobody forks, so a mark there has to be configurable without a
// fork and is therefore the PRODUCT's job (the OOTB `chrome` app carries it now). The vitrine is the opposite:
// a customer forks it and makes it theirs, so identity there can live in an app of that customer's own. The
// owner, 09/09: «essas 3 são do storefront e a caixa de login é do checkout».
//
// ⛔ THREE EXPORTS AND NOT ONE COMPONENT PLACED THREE TIMES, and the kernel is what says so: `placement:
// 'single'` is enforced per (store, app, COMPONENT) — `assertSingleFree`,
// packages/core/src/commands/composition.ts:176 — so the same component dropped in a second slot is refused
// with `conflict`. That refusal is the contract the previous design broke: `chrome/brand` was ONE placement
// read in four renders, so an operator dragged one row and changed four places, and the Compose board could
// not say which. A component per place is what makes the board literal again.
//
// ★ THE DRAWING IS SHARED AND THE DECLARATION IS NOT. `Mark` below is the one implementation; the three
// exports differ only where the PLACE differs, which today is one thing: the footer's column is the one that
// also carries a sentence under the mark. Sharing the render is why «a logo virando outro» is a config change
// and not three maintenance jobs; declaring three is why the operator can see where each one lands.
//
// ★★ AND THE TAGLINE EXISTS BECAUSE THE FOOTER'S FALLBACK CEDES ITS WHOLE NODE. `footer.brand` draws, when
// nothing is placed, the Forge wordmark AND «Leve. Inteligente. Sua.» as ONE unit — deliberately, because
// that sentence is Forge's and leaving it standing under somebody else's logo would be the same defect one
// element to the right. So a shop that places a mark here LOSES the sentence unless it says one of its own.
// `tagline` is that field, and it is only on this block for exactly that reason.

import { mediaRenderSrc } from '@forgecommerce/storefront-kit/media/src';
import type { ReactNode } from 'react';
import styles from './marks.module.css';

/**
 * One `type:'id'` field as it arrives after the kernel's read, resolved to the address an `<img>` may carry.
 *
 * ★★ THE KERNEL STAMPS THREE SIDECARS, NOT ONE, and this read the first and ignored the third for as long as
 * it existed. `packages/core/src/read/media.ts` writes `<field>_url` (the MASTER's public address, minted
 * from the origin the KERNEL was configured with), `<field>_kind`, and `<field>_provider_key` — the opaque
 * catalog key, stamped, in that file's own words, "so a consumer can route the MASTER through its own
 * `/api/media/<key>` door for next/image derivatives + a 1-year cache, instead of pointing an `<img>` at the
 * raw bucket url". The key is the kernel saying, per field, «there is a door for this one».
 *
 * ⛔ AND IT IS A SPECIES, NOT A CASE. The same cause has been repaired four times, one block at a time —
 * `banners` (D2-F3), the theme's own images (K3-M2), the shelf banner (pk34/p5) and the whole `chrome` app
 * (pk35/p2) — and nothing went red in between. What the master costs, measured on the demo bench 2026-09-13:
 * it answers with NO `Cache-Control` at all while the same object through the door answers
 * `public, max-age=31536000, immutable`, and `/v1/media/` is on no door the warmer knows, so such an image
 * stays COLD for the first shopper of every page, forever. A raw absolute url is also the mixed-content
 * hazard K3-M2 photographed on this bench: a path has no origin to be wrong about, an absolute url minted by
 * another process does. `bin/config-media-door.guard.mjs` is what goes red when a NEW block is born this way.
 *
 * ⛔ `mediaRenderSrc` IS THE ONE PLACE THAT DECISION LIVES — never a private copy of `/api/media/<key>` here.
 * A mirrored path is exactly how `banners` drifted away from the door before D2-F3. This import reads no env:
 * the question is «did the kernel hand me a key», not «what is this box configured with».
 *
 * A ref with no url is an asset that has gone away — draw nothing rather than a broken image.
 */
function assetSrc(config: Record<string, unknown> | undefined, name: string): string | null {
  const url = config?.[`${name}_url`];
  const key = config?.[`${name}_provider_key`];
  if (typeof url !== 'string' || url.length === 0) return null;
  return (
    mediaRenderSrc(typeof key === 'string' && key.length > 0 ? { url, providerKey: key } : { url }) ?? null
  );
}

/** A configured word, or `undefined` when the store wrote nothing. Blank and whitespace are ABSENCE, not an
 * empty label: `"  "` in a text field is somebody clearing it.
 *
 * ⚠️ THE TRIM IS LOAD-BEARING AND HAS ALREADY COST THIS BOX A BUG. `text` and `tail` are concatenated with
 * NOTHING between them, so a separator written as a leading space (`" Outlet"`) is deleted before it is drawn
 * and the header reads `ForgeOutlet`, glued. The separator has to be a printable character — which is why
 * every mark in this box is `nome` + `.terminação`. */
function word(config: Record<string, unknown> | undefined, name: string): string | undefined {
  const raw = config?.[name];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** "Place this URL in the store the shopper is in", injected by the surface. A bare `/` walks a shopper out
 * of their store under `/s/<id>`, and the mark is the one link every one of these places has. */
export type StoreHref = (url: string | null | undefined) => string | undefined;

export type MarkProps = {
  config?: Record<string, unknown>;
  storeHref: StoreHref;
};

/**
 * The mark itself: a PICTURE when the store has one, otherwise the word and its accent-painted tail.
 *
 * ⛔ THE TWO ARE EXCLUSIVE, and that is a decision this box has already reversed once by accident. A logo
 * dropped beside a wordmark DELETES the wordmark — so the shops that want to re-tint with their theme keep
 * TEXT (`.tail` is `var(--color-accent)`, one of the six tokens a theme redefines; a raster re-tints with
 * nothing), and the shop that has art keeps the art, with its word as the picture's accessible name.
 *
 * ⛔ NOTHING CONFIGURED ⇒ NOTHING DRAWN, and that is the decision rather than an oversight. These slots
 * REPLACE the front's own wordmark, so a block that fell back to ours would print the Forge mark inside
 * somebody else's shop — the exact outcome this app exists to remove. An operator mid-configuration sees no
 * mark for as long as they have written none, and `seed/demo-setup.mjs` refuses to place an empty one.
 */
function Mark({
  config,
  storeHref,
  place,
  children,
}: MarkProps & { place: string; children?: ReactNode }): ReactNode {
  const logo = assetSrc(config, 'logo');
  const text = word(config, 'text');
  const tail = word(config, 'tail');
  if (!logo && !text && !tail) return null;
  const home = storeHref('/') ?? '/';

  return (
    <div className={styles.mark} data-testid={`demo-setup-${place}`} data-place={place}>
      <a className={styles.link} href={home}>
        {logo ? (
          // The `alt` is the store's own word when it wrote one: a logo IS the store's name to a screen
          // reader, and an empty alt on the only mark in a header leaves the anchor unnamed.
          // biome-ignore lint/performance/noImgElement: the kit resolved this address; an app knows no next/image config.
          <img className={styles.logo} src={logo} alt={text ?? ''} />
        ) : (
          <>
            {text}
            {tail ? <span className={styles.tail}>{tail}</span> : null}
          </>
        )}
      </a>
      {children}
    </div>
  );
}

/** The shop's top bar. */
export function HeaderBrand({ config, storeHref }: MarkProps): ReactNode {
  return <Mark config={config} storeHref={storeHref} place="header" />;
}

/** The head of the mobile drawer — the same mark, in the one place a phone shows it. */
export function DrawerBrand({ config, storeHref }: MarkProps): ReactNode {
  return <Mark config={config} storeHref={storeHref} place="drawer" />;
}

/**
 * The footer's brand column — the mark AND the shop's own sentence under it.
 *
 * ★ THE SENTENCE IS THE HALF THAT DID NOT EXIST BEFORE THIS APP. It is drawn only when configured: a footer
 * that inherits nothing and says nothing is a shop that has not written one yet, which is honest. What must
 * never happen is a sentence with no mark above it, and `markless()` in the seed refuses exactly that.
 */
export function FooterBrand({ config, storeHref }: MarkProps): ReactNode {
  const tagline = word(config, 'tagline');
  return (
    <Mark config={config} storeHref={storeHref} place="footer">
      {tagline ? (
        <p className={styles.tagline} data-testid="demo-setup-tagline">
          {tagline}
        </p>
      ) : null}
    </Mark>
  );
}
