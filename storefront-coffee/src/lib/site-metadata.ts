// The theme's LAST-RESORT metadata: what Next serves for any page that declares none of its own.
//
// It lives here, not inline in `app/layout.tsx`, because it is COPY — the shopper reads it in the browser tab
// and in every link they paste — and copy in a file that imports `next/font/local` is copy no test can open.
// The root layout is above `[store]`, so there is nothing store-specific to say here: the honest fallback is
// neutral and in the theme's own language (`<html lang="pt-BR">` is declared two lines from where this is
// used). A page that CAN name the store says so itself, and the home page does.

import type { Metadata } from 'next';

/** What the theme calls a store it cannot name. ONE constant, shared with `homeMetadata`'s own fallback: the
 * root layout and the home page answer the same question, and a shopper who sees two different answers on two
 * screens of one store is reading a bug. */
export const NEUTRAL_STORE_TITLE = 'Loja';

/** The root layout's `metadata` export — the inherited default for the pages that set none (today: the cart,
 * the checkout, /account, /account/login and the order detail). */
export const rootMetadata: Metadata = {
  title: NEUTRAL_STORE_TITLE,
  description: 'Loja online.',
};
