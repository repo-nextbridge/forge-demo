// What the three marks of the SHOP WINDOW draw, and the four things that go wrong silently when they stop.
//
// ★ THE FOURTH MARK LEFT IN pk28: the login box is the CHECKOUT's screen, which we host and nobody forks, so
// its mark is the product's to configure and not an instance app's. Nothing else about these three changed.
//
// ★★ EVERY RULE HERE IS ABOUT A FAILURE THAT LEAVES NO TRACE. A mark that stops rendering is a header with
// no name on it; a logo that lands beside a wordmark deletes the wordmark; a tagline that leaks out of the
// footer is a sentence in a bar that has no room for it; and a bare `/` on the anchor walks a shopper out of
// the store they are in. None of the four throws, and none of the four is visible in a diff.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DrawerBrand, FooterBrand, HeaderBrand } from './marks';

/** The surface's injected helper, in its honest shape: a store-scoped prefix. */
const storeHref = (url: string | null | undefined) => `/s/forge${url ?? '/'}`;

const MARKS = [
  ['HeaderBrand', HeaderBrand, 'header'],
  ['DrawerBrand', DrawerBrand, 'drawer'],
  ['FooterBrand', FooterBrand, 'footer'],
] as const;

describe('the three marks', () => {
  it('★★ each export draws in its OWN place — three components, three positions', () => {
    // ⇒ SABOTAGE: point two of the three at the same implementation with the same `place` and this names them.
    //   The seed places one component per slot; if two of them were the same drawing under one name, the
    //   kernel would refuse the second placement with `conflict` and one place would silently lose its mark.
    const places = new Set<string>();
    for (const [name, Mark, place] of MARKS) {
      const { container, unmount } = render(<Mark config={{ text: 'forge', tail: '.store' }} storeHref={storeHref} />);
      const node = container.querySelector('[data-place]');
      expect(node, `${name} drew nothing at all`).toBeTruthy();
      expect(node?.getAttribute('data-place'), `${name} draws in the wrong place`).toBe(place);
      places.add(place);
      unmount();
    }
    expect(places.size, 'two of the three marks claim the same place').toBe(3);
    // ⛔ AND NO EXPORT DRAWS IN THE CHECKOUT'S PLACE. `account` was this app's fourth mark until pk28; a
    // component still claiming it would be an instance app drawing on a screen the product now owns.
    expect(places.has('account'), 'the login box is the checkout’s, not the vitrine’s').toBe(false);
  });

  it('★★ the wordmark is the word plus a tail painted with the THEME accent', () => {
    // The tail is a `<span>` of its own because that is the only thing that can carry `--color-accent`. One
    // config, two shops, two colours — which is the sentence this whole app exists to demonstrate.
    const { container } = render(<HeaderBrand config={{ text: 'forge', tail: '.outlet' }} storeHref={storeHref} />);
    expect(container.textContent).toBe('forge.outlet');
    expect(container.querySelector('.tail')?.textContent).toBe('.outlet');
  });

  it('⛔ a logo REPLACES the words, and the word becomes the picture’s accessible name', () => {
    // ⇒ SABOTAGE: draw both and the mark reads "forge.co" twice, once as a picture and once as text.
    //   The café is the store this matters for: it has art, and its `text` is the alt a screen reader gets.
    render(
      <HeaderBrand
        config={{ logo: 'ast_1', logo_url: 'https://media.example/forge-co.png', text: 'forge.co' }}
        storeHref={storeHref}
      />,
    );
    const img = screen.getByRole('img');
    // ★ pk35/d7 — no `logo_provider_key` in this config, so there is no door to go through and the kernel's
    // own url is the only address there is. The rule below is the other half.
    expect(img.getAttribute('src')).toBe('https://media.example/forge-co.png');
    expect(img.getAttribute('alt')).toBe('forge.co');
    expect(screen.queryByText('forge.co', { selector: 'span' })).toBeNull();
  });

  it.each(MARKS)(
    '★★★ %s draws through the front\u2019s OWN DOOR when the kernel stamped a key, never the master url',
    (name, Mark) => {
      // ⛔ THE SPECIES, NOT THE CASE. `packages/core/src/read/media.ts` stamps three sidecars beside a
      // `type:'id'` ref and the third one — `<field>_provider_key` — exists, in that file's own words, "so a
      // consumer can route the MASTER through its own `/api/media/<key>` door … instead of pointing an
      // `<img>` at the raw bucket url". This block read the first and ignored the third, which is the same
      // cause repaired four times elsewhere (banners D2-F3, the theme K3-M2, the shelf banner pk34/p5, the
      // whole `chrome` app pk35/p2) with nothing red in between.
      //
      // What the master costs, measured on the demo bench 2026-09-13: it answers with NO `Cache-Control`
      // while the same object through the door answers `public, max-age=31536000, immutable`, and
      // `/v1/media/` is on no door the warmer knows — so the first shopper of every page pays for it.
      //
      // ⇒ SABOTAGE: make `assetSrc` read `<field>_url` alone and all three of these name the app, the field
      //   and the absolute address they drew instead of the path.
      const { container } = render(
        <Mark
          config={{
            logo: 'ast_1',
            logo_url: 'https://ms-s1.example.ts.net/v1/media/local/tenant_x/01-forge-co-logo.png',
            logo_provider_key: 'tenant_x/01-forge-co-logo.png',
            logo_kind: 'image',
            text: 'forge.co',
          }}
          storeHref={storeHref}
        />,
      );
      const src = container.querySelector('img')?.getAttribute('src');
      expect(src, `${name} drew no picture at all`).toBeTruthy();
      expect(
        src,
        `${name} painted the kernel's MASTER address for \`logo\` instead of routing the key it was handed ` +
          'through the front\u2019s own media door. An absolute url has an origin to be wrong about, carries no ' +
          'cache headers, and the warmer has no door for it.',
      ).not.toMatch(/^https?:\/\//);
      expect(src).toContain('01-forge-co-logo.png');
    },
  );

  it('⛔ a ref the kernel could not stamp a url for draws NOTHING — never a broken image', () => {
    // An asset that has gone away is the one case where the config is complete and the picture is not.
    const { container } = render(<HeaderBrand config={{ logo: 'ast_gone' }} storeHref={storeHref} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('⛔ NOTHING CONFIGURED ⇒ NOTHING DRAWN — a fallback here would print Forge in somebody else’s shop', () => {
    // These slots REPLACE the front's own wordmark. A block that fell back to ours would put the Forge mark
    // inside a client's header, which is the exact outcome this app exists to remove.
    for (const [name, Mark] of MARKS) {
      const { container, unmount } = render(<Mark config={{}} storeHref={storeHref} />);
      expect(container.innerHTML, `${name} drew something out of an empty config`).toBe('');
      unmount();
    }
  });

  it('★ whitespace is ABSENCE, and a space can never be the separator between the two halves', () => {
    // ⛔ THE MEASURED BUG THIS BOX ALREADY PAID FOR: the outlet's mark was `text: "Forge"` + `tail: " Outlet"`
    //   and its header read `ForgeOutlet`, glued — every word is trimmed and the two halves are concatenated
    //   with nothing between them. The separator has to be a printable character, which is why every mark
    //   here is `nome` + `.terminação`.
    const { container } = render(<HeaderBrand config={{ text: 'forge', tail: ' Outlet' }} storeHref={storeHref} />);
    expect(container.textContent).toBe('forgeOutlet');
    const blank = render(<DrawerBrand config={{ text: '   ', tail: '  ' }} storeHref={storeHref} />);
    expect(blank.container.innerHTML, 'blank words are absence, not an empty label').toBe('');
  });

  it('★★ the mark links into the STORE the shopper is in, never to a bare `/`', () => {
    // MULTISTORE — a bare `/` under `/s/<id>` walks a shopper out of their store, and the mark is the one
    // link every one of these places has.
    for (const [name, Mark] of MARKS) {
      const { container, unmount } = render(<Mark config={{ text: 'forge' }} storeHref={storeHref} />);
      expect(container.querySelector('a')?.getAttribute('href'), `${name}`).toBe('/s/forge/');
      unmount();
    }
  });
});

describe('the footer’s tagline', () => {
  it('★★★ the FOOTER is the only block that draws a tagline — and it draws it under the mark', () => {
    // ★ WHY THIS ASYMMETRY IS THE POINT. `footer.brand`'s Forge fallback cedes its node as a UNIT — the
    // wordmark AND «Leve. Inteligente. Sua.» — deliberately, because that sentence is Forge's and leaving it
    // standing under somebody else's logo would be the same defect one element to the right. So placing a
    // mark in the footer DELETES the sentence, and `tagline` is how a shop says one of its own.
    //
    // ⇒ SABOTAGE: give the tagline to `HeaderBrand` too and this goes red naming the block — a sentence in a
    //   header bar has no room and no fallback to replace.
    const config = { text: 'forge', tail: '.store', tagline: 'Leve. Inteligente. Sua.' };
    const footer = render(<FooterBrand config={config} storeHref={storeHref} />);
    const line = footer.getByTestId('demo-setup-tagline');
    expect(line.textContent).toBe('Leve. Inteligente. Sua.');
    // …under the mark, not beside it: the anchor comes first in the same node.
    const mark = footer.container.querySelector('[data-place="footer"]');
    expect(mark?.firstElementChild?.tagName).toBe('A');
    expect(mark?.lastElementChild).toBe(line);
    footer.unmount();

    for (const [name, Mark] of MARKS.filter(([, , place]) => place !== 'footer')) {
      const other = render(<Mark config={config} storeHref={storeHref} />);
      expect(
        other.queryByTestId('demo-setup-tagline'),
        `${name} drew the footer's tagline — that sentence has one home`,
      ).toBeNull();
      other.unmount();
    }
  });

  it('⛔ a tagline is NEVER drawn without a mark above it — the same defect, one element to the right', () => {
    // The render cannot draw one: with no logo and no word the whole node is absent, tagline included. The
    // seed refuses the same shape earlier and louder (`markless()` in seed/demo-setup.mjs), which is where a
    // declaration is caught before a birth writes it.
    const { container } = render(
      <FooterBrand config={{ tagline: 'Leve. Inteligente. Sua.' }} storeHref={storeHref} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('a footer that configured no tagline draws the mark alone — silence is not a default sentence', () => {
    const { container, queryByTestId } = render(
      <FooterBrand config={{ logo: 'ast_1', logo_url: 'https://media.example/co.png', text: 'forge.co' }} storeHref={storeHref} />,
    );
    expect(container.querySelector('img')).toBeTruthy();
    expect(queryByTestId('demo-setup-tagline')).toBeNull();
  });
});
