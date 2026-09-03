// ⛔ p2-4 — THE 404's BROWSER TAB, and it is an ELEMENT rather than a `metadata` export because on this page
// the metadata pipeline resolves the title correctly and then never puts it anywhere a person can see.
//
// ── WHAT WAS MEASURED (bench, 2026-09-03, headless Chromium, `waitUntil: 'networkidle'` + 1.2s) ───────────
//   404  document.title = ""   /s/<cafe>/p/cafe-que-nao-existe-xyz
//   404  document.title = ""   /s/<cafe>/pagina-que-nao-existe-xyz
//   200  document.title = "Forge Café"   /s/<cafe>
// Every 404 of this shop — store-scoped and store-less alike — arrives with a nameless tab.
//
// ── AND THE TITLE IS NOT MISSING; IT IS STRANDED ────────────────────────────────────────────────────────
// The same response carries it. In the RSC payload of that 404:
//     14:{"metadata":[["$","title","0",{"children":"Loja"}], ...]}
// which is `rootMetadata` from `lib/site-metadata`, resolved exactly as it should be. It never reaches the
// document because Next 15.2 STREAMS metadata to browsers (it is inlined only for "HTML-limited bots"), and
// this page's shell is `<html id="__next_error__">` with an EMPTY body — a `notFound()` render — where the
// client applies the streamed metadata to nothing. Proven by asking for the same URL twice:
//     User-Agent: Mozilla/5.0        → <html id="__next_error__">   (no <title> at all)
//     User-Agent: Twitterbot/1.0     → <html id="__next_error__"> <title>Loja</title>
// One is a bot, the other is a shopper; the bot is the one that gets a tab.
//
// ⇒ SO THE TITLE IS RENDERED AS PART OF THE PAGE. React 19 hoists a `<title>` from anywhere in the tree into
// the head, and this tree DOES render in the browser — the 404's links and copy are in the DOM, which is how
// the shots were taken. It therefore travels by the one channel this page has proven it uses.
//
// ⚠️ IT NAMES NO SHOP, AND THAT IS THE SAME LIMIT `NotFoundContent`'s `base` documents. A tab reading
// "Página não encontrada — Forge Café" needs the store, and App Router hands `not-found.tsx` no route params
// while `headers()` here de-opts the whole route group (see the two boundaries). Typing the shop's name in
// would also make this file a SECOND AUTHOR for a fact the kernel owns — the store's `name`, which the home
// page renders from the port. A neutral, true tab beats a named, duplicated one.

import { NOT_FOUND_TITLE } from '@/lib/site-metadata';

export function NotFoundTitle() {
  return <title>{NOT_FOUND_TITLE}</title>;
}
