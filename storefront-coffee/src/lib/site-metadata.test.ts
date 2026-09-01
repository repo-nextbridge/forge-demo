// ★ PK2-I18N (the sweep's other half) — THE COPY THE THEME FALLS BACK TO IS COPY THE SHOPPER READS.
//
// The locale defect was a missing ARGUMENT. This is the classic other kind, found by the same sweep: a raw
// English literal in the vitrine. `app/layout.tsx` declared `title: 'Forge Storefront'` and an English
// description of the codebase, and Next serves that to every page that declares no metadata of its own —
// measured on this tree: the cart, the CHECKOUT, /account, /account/login and the order detail. Five shopper
// screens of a store whose own <html> says `lang="pt-BR"`, with the developer's words in the browser tab and
// in whatever a shopper pastes into a chat.
//
// The house had already answered this question once for the home page (QA-PACK-1 C3, `homeMetadata`), where a
// store with no readable name degrades to a neutral Portuguese title. The root fallback is the same question
// one level down, so it gets the same answer from the same constant rather than a second opinion — which is
// the half of this that is not merely copy: two fallbacks for one situation is how a store ends up named two
// things on two screens.

import { STOREFRONT_LOCALE } from '@forgecommerce/storefront-kit/datetime';
import { describe, expect, test } from 'vitest';
import { NEUTRAL_STORE_TITLE, rootMetadata } from './site-metadata';

describe('the theme’s last-resort metadata', () => {
  test('★ it is written in the language the theme ships in, not in the source language', () => {
    expect(STOREFRONT_LOCALE).toBe('pt-BR');
    expect(NEUTRAL_STORE_TITLE).toBe('Loja');
    expect(rootMetadata.title).toBe(NEUTRAL_STORE_TITLE);
    expect(rootMetadata.description).toBe('Loja online.');
  });

  test('the specimen, kept — the exact pair five shopper screens used to render', () => {
    // A negative control rather than a rule about names: it is red the day somebody restores the developer's
    // English by hand, and it is the only line in this file that names what the defect looked like.
    expect(rootMetadata.title).not.toBe('Forge Storefront');
    expect(rootMetadata.description).not.toBe(
      'Forge storefront-base — the reference storefront consuming the read port.',
    );
  });
});
