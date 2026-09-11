// THE COFFEE STORE'S BIRTH DATA — the part `seed/catalog.json` cannot express, driven through the port.
//
// A MODULE AND NOT MORE LINES IN `bin/seed.mjs`, for the same reason `seed/outlet.mjs` is one: two slices
// filling two stores in two worktrees, and one file between them is a conflict with a stopwatch on it. It
// receives the port the seed already built and knows nothing about transport.
//
// ── WHAT THE CATALOGUE FILE COULD NOT SAY, AND WHY EACH OF THESE IS HERE ─────────────────────────────────
//
// `catalog.json` creates six coffees with their custom fields, their options and their SKUs. Three things
// the coffee store's two screens need are NOT product fields, and each one is a different mechanism:
//
//   1. THE SUBSCRIPTION MARK, on the SKU. Not decoration — it is the whole proof of curation-by-SKU that
//      was asked for in these words: *"default nasce falso e o lojista faz a curadoria manual… se eu compro
//      sku, o que eu assino é o sku também"*. Five coffees are marked and the Edição do Produtor is NOT, and
//      the consequence is that the storefront draws no subscription control on its page — with NOT ONE LINE
//      OF `if` IN THE FORK. The vitrine asks `sku.metadata.sub_enabled === true` and that is the entire
//      rule. A product falls out of the offer by not being marked, which is what makes the boundary real.
//
//   2. WHAT A SUBSCRIBER GETS, as PROMOTIONS TARGETING THE LINE'S OWN FIELD. The design shows a struck
//      price AND free freight on the subscription option; the checkout has to actually take both off. They
//      are written here as promotions whose target is `{ kind: 'custom_field', field: 'sub_plan', operator:
//      'exists' }` — the target the kernel learned in this same stack — so the chain is proven end to end:
//      the app DECLARES the line field, the shopper's choice WRITES it, and the promotion engine PRICES on
//      it. See `COFFEE_PROMOTIONS`.
//      ⚠️ ORDER MATTERS AND THE KERNEL ENFORCES IT: `promotion.create` refuses a custom-field target whose
//      key is not an active `cart_line` declaration ("custom field not declared: sub_plan"). The app must be
//      installed first — installing is what materializes its declaration. That refusal is a feature and this
//      module depends on it rather than working around it.
//
//   3. THE REVIEWS — and they are NOT here. See the block at the bottom: there is no minimal door for them
//      that is not a hole somebody intends to close, and inventing one inside a seed is how a shortcut
//      becomes a dependency. It is reported, not smuggled.
//
// IDEMPOTENT BY CONSTRUCTION, like its sibling: everything is keyed by something this file chooses, the read
// face is asked first, and what is already there is skipped. Re-running converges and never deletes.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unresolved } from './minted.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));

/** The store this module touches, and the only one. Its handle is the catalogue's own. */
const STORE_HANDLE = 'cafe';

/** The apps this TENANT needs INSTALLED. All are on this box's composition list, which is what puts them in
 *  the image; installing is a separate, per-tenant gesture — the operator's clicks in the admin, spelled as
 *  a command so a clone comes up the same way.
 *
 * ⚠️ `payment-pos` IS HERE AND IT IS NOT FOR THIS STORE — it is the counter's, and the counter is the other
 * store of this same tenant. It sits on this list because INSTALLING IS PER TENANT, not per store, and this
 * is the only file that installs anything for `forgecafe`. Measured on the bench of 02/09: the app was
 * COMPOSED into the image (it shows up in the kernel's own `composition.json`) and never installed, so
 * `read.payment_methods` for the counter answered reference/mercadopago/zero and the totem could not
 * charge — `checkout.place_order` refused with `payment_app_unavailable` AFTER `cart.set_payment_method`
 * had answered 200. Composed is not installed, and the admin's "Available / Install" was telling the
 * truth nobody read.
 *
 * ★★★ pk33 — `demo-gate` JOINED THIS LIST, and it is HIS decision rather than a tidy-up (11/09): *"sim a
 * portaria vem instalada no nascimento da demo"*, and *"sapatos, outlet, café, totem"* — the whole demo, the
 * counter included. Until this slice NOTHING in the birth installed it: not `bin/seed-box.mjs`, not
 * `seed/vitrine.mjs`, not `seed/outlet.mjs`, not this file. The app's own README said "Install the app for the
 * tenant", i.e. a HAND GESTURE somebody had to remember, and on the bench of 11/09 nobody had — the demo had
 * been served with its front door wide open for days with every birth green underneath.
 *
 * ⚠️ IT IS HERE AND NOT IN `seed/box.json` FOR THE REASON `payment-pos` IS: installing is per TENANT, this is
 * the only file that installs for `forgecafe`, and the gesture that follows it (`dropGateOnTheCafe`) has to
 * be able to run in the same breath — a placement removed by a different file, in a different phase, from the
 * install that created it is two owners for one decision. */
export const APPS = ['subscriptions', 'reviews', 'payment-pos', 'demo-gate'];

/** ★★★ THE GATE'S SLOT, and the store whose fork cannot draw what fills it — see `dropGateOnTheCafe`. */
const GATE_TARGET = 'storefront:gate';
const GATE_APP = 'demo-gate';

/** ★ THE CURATION. Five in, one out, and the one that is out is out ON PURPOSE (`seed/catalog.json` calls it
 *  a rotating lot). Written as the handles that ARE subscribable rather than as the one that is not: a
 *  seventh coffee added tomorrow is NOT subscribable until a human says so, which is the default the mark
 *  exists to defend. */
export const SUBSCRIBABLE_HANDLES = [
  'forge-alvorada',
  'forge-serra-do-caparao',
  'forge-cerrado-mineiro',
  'forge-noturno',
  'forge-descafeinado',
];

/**
 * ★★ THE SEVEN INSTITUTIONAL PAGES OF THE COFFEE SHOP — and it published ZERO of them.
 *
 * MEASURED (`bin/verify-seed.mjs`, section 3b, 05/09): the `forge` store publishes seven and the Outlet
 * gained its seven in pk12; `cafe` and `balcao` declared none, and the section reported the number without
 * judging it. The sidebar the storefront draws on an institutional page is HARDCODED with all seven links
 * (`storefront-coffee/src/templates/cms/PageView.tsx`), and so is the footer — so a shop with no cards is a
 * shop drawing seven links into its own 404. That is the whole reason all seven are here and not just the
 * one this slice wrote a body for: seeding `sobre` alone would trade one dead link for six.
 *
 * ── ⚠️ WHAT A CARD CAN AND CANNOT CARRY, WHICH IS WHAT MADE THE METAS HARD ───────────────────────────────
 *
 * `content.page.create` takes `store_id, slug, title, template_key, meta_title, meta_description, published`
 * and has NO column for a body. So a card chooses the shop's `<h1>` (the title) and its `<head>` copy, and
 * the paragraphs come from a React component in the image. Two of these pages have the café's own body
 * (`about` → `CoffeeAbout`, via the registry's store overlay; `contact` → this fork's own channels) and five
 * render the body shared with the reference storefront.
 *
 * ⇒ EVERY `meta_description` BELOW IS WRITTEN CLAUSE BY CLAUSE AGAINST THE TEMPLATE THAT WILL RENDER, and
 * for the five shared ones that means promising nothing the shared paragraphs do not say. The trap is real
 * and specific: `Shipping.tsx` offers "frete grátis acima do valor indicado", and on THIS store the only
 * rule that zeroes the freight is the subscription (the seal in `CoffeeChrome.tsx` says exactly that, from
 * the same measurement). A meta repeating the threshold would be the shop promising in Google what its own
 * page does not say. This is the same rule `seed/outlet.json` states for the Outlet's seven.
 *
 * IDEMPOTENT like everything else here: keyed by the slug, existing cards skipped, nothing ever updated or
 * removed. A title an operator edited in the admin is the operator's.
 */
const PAGES = [
  {
    slug: 'sobre',
    template_key: 'about',
    title: 'Sobre a Forge Café',
    meta_title: 'Sobre · Forge Café',
    meta_description:
      'Uma torrefação pequena: seis cafés de produtores que conseguimos nomear, torrados na semana do ' +
      'envio, e uma assinatura sem fidelidade. Conheça as origens e como a curadoria é feita.',
  },
  {
    slug: 'contato',
    template_key: 'contact',
    title: 'Fale com a Forge Café',
    meta_title: 'Fale conosco · Forge Café',
    meta_description:
      'Os canais de atendimento da Forge Café: e-mail, WhatsApp e o horário em que respondemos. Dúvidas ' +
      'sobre um pedido, uma assinatura ou uma moagem passam por aqui.',
  },
  {
    slug: 'entrega',
    template_key: 'shipping',
    title: 'Entrega e rastreio',
    meta_title: 'Prazos de entrega · Forge Café',
    // ⛔ NOT A WORD ABOUT FREE FREIGHT: the shared template ties it to a cart threshold and this store's
    //    only rule that zeroes it is the subscription. Promising it here would be a meta the page denies.
    meta_description:
      'Entregamos para todo o Brasil. O prazo e o valor do frete são calculados no checkout a partir do seu ' +
      'CEP, e o código de rastreio fica na sua conta assim que o pedido é despachado.',
  },
  {
    slug: 'trocas-e-devolucoes',
    template_key: 'returns',
    title: 'Trocas e devoluções',
    meta_title: 'Trocas e devoluções · Forge Café',
    meta_description:
      'Até 7 dias corridos após o recebimento para solicitar a troca ou a devolução, com o produto sem ' +
      'sinais de uso e na embalagem original. O reembolso volta pelo mesmo meio de pagamento do pedido.',
  },
  {
    slug: 'faq',
    template_key: 'faq',
    title: 'Perguntas frequentes',
    meta_title: 'Perguntas frequentes · Forge Café',
    meta_description:
      'As respostas rápidas: como o prazo de entrega é calculado, como pedir uma troca em até 7 dias e ' +
      'onde as formas de pagamento aparecem.',
  },
  {
    slug: 'privacidade',
    template_key: 'privacy',
    title: 'Privacidade',
    meta_title: 'Privacidade · Forge Café',
    meta_description:
      'Quais dados a loja coleta ao processar um pedido, para que os usa e como pedir acesso, correção ou ' +
      'exclusão. Um resumo em linha com a LGPD — não vendemos os seus dados.',
  },
  {
    slug: 'termos',
    template_key: 'terms',
    title: 'Termos de uso',
    meta_title: 'Termos de uso · Forge Café',
    meta_description:
      'As regras de compra e de uso do site: preços e condições valem os exibidos no momento da compra, e ' +
      'um pedido é confirmado após a aprovação do pagamento.',
  },
];

/** The seven cards this store publishes, as this repository declares them. Exported so the verifier grades
 *  the SAME list the seed writes — a second copy of these slugs is a second copy that goes stale, which is
 *  the failure `bin/verify-seed.mjs` was written against. */
export function coffeePages() {
  return PAGES;
}

/** This app's key on the SKU bag. It belongs to `@forgecommerce/ext-subscriptions` (`subscribable.ts`) and
 *  is repeated here because a seed script may not import an app's source — the app lives in the image. */
export const SUB_ENABLED_FIELD = 'sub_enabled';

/** The subscriber discount, in basis points. 1000 = 10.00%.
 *
 * ⚠️ THIS NUMBER HAS A TWIN IN THE VITRINE (`storefront-coffee/src/lib/coffee/subscription.ts`) and the two
 * MUST agree: the shop prints "10% OFF" beside the subscription option, and this is what the checkout
 * actually takes off. They cannot be one constant — one lives in a container, the other in a database — so
 * the vitrine's copy names this file and this file names the vitrine's. Change one and change both. */
const SUBSCRIBER_PERCENT_BP = 1000;

/**
 * ★ WHAT A SUBSCRIBED LINE IS, AS A TARGET — written once because two promotions below aim at it.
 *
 * `operator: 'exists'` and not `eq`: the benefit is for subscribing, not for one rhythm. A shopper on the
 * weekly plan and one on the monthly plan are both subscribers, and an `eq` per rhythm would be three
 * promotions somebody has to keep equal by hand.
 *
 * ⚠️ ORDER MATTERS AND THE KERNEL ENFORCES IT: `promotion.create` refuses a custom-field target whose key is
 * not an active `cart_line` declaration ("custom field not declared: sub_plan"). Installing the app is what
 * materializes the declaration, which is why `installApps()` runs first.
 */
const SUBSCRIBED_LINE = { kind: 'custom_field', field: 'sub_plan', operator: 'exists' };

/**
 * ★★ WHAT A SUBSCRIBER GETS, DECLARED — the promotions this store is BORN with.
 *
 * ⛔ D14, MEASURED ON THE BENCH OF 2026-09-03: the fork promises three perks beside the subscription option
 * (`storefront-coffee/src/templates/pdp/CoffeeBuyBox.tsx:190`) — *"Frete grátis · 10% OFF sempre · Pause
 * quando quiser"* — and the tenant held FOUR promotions, none of them `free_shipping`. The 10% was real; the
 * freight was a sentence. A subscriber reached the payment step and paid the R$ 19,90 the shop had just told
 * them they would not pay.
 *
 * ⇒ THE DATA IS MADE TRUE RATHER THAN THE SENTENCE MADE SMALLER (Renan, 2026-09-03: *"Dataset com promoção,
 * é justamente pra mostrar para o prospect essa possibilidade"*). The perk line is a constant of the FORK —
 * the shop's own chrome — and what a seed can honestly do about a promise a shop makes is make the shop able
 * to keep it. Same reasoning, and the same words, as the coupon in `seed/commerce.mjs`.
 *
 * ⚠️ THE FREIGHT PROMOTION NAMES NO DELIVERY METHOD (`shipping_method_ids` absent = every method, which is
 * the contract's own default: `packages/contracts/src/promotion.ts:82`). The kernel offers the narrower
 * shape and warns that free freight on the express modality is how a merchant bleeds margin — but the
 * sentence this promotion exists to keep carries NO qualifier, and a promotion that silently excluded
 * "Entrega Expressa" would be the same lie in the other direction. If the shop ever wants to qualify it, the
 * sentence in the fork changes first and this follows.
 *
 * ⚠️ `stackable: true` ON BOTH, and it is NOT what lets them co-exist. The engine runs ONE CONTEST PER CLASS
 * (`packages/core/src/promo/engine.ts:41`, `CLASS_ORDER = ['item','order','shipping']`) and the class is
 * DERIVED from the benefit — `percentage` → `item`, `free_shipping` → `shipping` — so these two never meet
 * in a pool and would both apply even at `false`. The flag is for the day a SECOND promotion of the same
 * class exists: stacking is bilateral in this kernel, so a promotion born unstackable silently switches the
 * next one off.
 */
export const COFFEE_PROMOTIONS = [
  {
    name: 'Assinante 10% OFF',
    label: 'Assinante 10% OFF',
    // `scope: 'each_item'` because the design prints the discount PER BAG, next to the bag. An order-level
    // percentage would total the same and would be unable to say what the page says.
    benefit: { kind: 'percentage', percent_bp: SUBSCRIBER_PERCENT_BP, scope: 'each_item' },
    why: 'The struck price the product page prints beside the subscription option, actually taken off at the till.',
  },
  {
    name: 'Assinante frete grátis',
    label: 'Assinante · frete grátis',
    benefit: { kind: 'free_shipping' },
    why: 'The first of the three perks the buy box promises, and the one that did not exist (D14).',
  },
];

// ── ★★ THE EXPECTATIONS, AS FUNCTIONS — the thing every guard in this repository is derived from ─────────
//
// ⚠️ THEY LIVE HERE AND NOT IN `bin/seed.mjs` FOR THE SAME REASON `seed/media.mjs` gives: that file runs on
// import (it validates the env and then seeds), so nothing can import it to check its reasoning — and a
// verifier that re-typed the nine keys would go stale the day somebody edited the catalogue, SILENTLY. One
// function, two readers: the seed that WRITES and the guard that MEASURES.

/**
 * The metadata bag a coffee is BORN with — the declared custom fields plus the subtitle, which rides the
 * same bag (`product-view.ts` reads `field(product,'subtitle')` for the kicker above the title).
 */
export function expectedMetadata(product) {
  return { ...product.custom_fields, ...(product.subtitle ? { subtitle: product.subtitle } : {}) };
}

/**
 * ★ THE PHOTOGRAPHS ONE PRODUCT DECLARES, IN ORDER — the list, not the picture.
 *
 * `photos` (a list) is what the coffee page reads BY POSITION — `PdpCoffee.tsx:5`: `[0]` is the bag,
 * `[1..3]` are the story. `photo` (singular) is the bag and remains the fallback for a product that declares
 * no list, so nothing regressed on the day the list arrived.
 */
export function expectedPhotos(product) {
  if (Array.isArray(product.photos) && product.photos.length > 0) return product.photos;
  return product.photo ? [product.photo] : [];
}

/** What the dataset says a coffee's page should be able to draw — one object, so the seed and the verifier
 *  cannot disagree about what "complete" means. */
export function expectedCoffee(product) {
  return {
    handle: product.handle,
    metadata: expectedMetadata(product),
    photos: expectedPhotos(product),
    sections: (product.content_sections ?? []).map((x) => ({ title: x.title, body: x.body })),
    subscribable: SUBSCRIBABLE_HANDLES.includes(product.handle),
  };
}

/** Every coffee the catalogue declares, as expectations. The verifier's whole input. */
export function expectedCoffees() {
  return catalog.products.map(expectedCoffee);
}

/**
 * @param port {{ api: string, token: string, tenant: string, command: Function, read: Function,
 *                rows: Function, log: Function, fail: Function }}
 */
export async function seedCoffee(port) {
  const { read, rows, log, fail } = port;

  // By HANDLE here and by ID everywhere after: `store` in a command is the id (`sto_…`), and passing a
  // handle is a 404 that names the store rather than the mistake.
  const store = rows(await read('stores')).find((s) => s.handle === STORE_HANDLE);
  if (!store) {
    fail(
      `the store "${STORE_HANDLE}" does not exist yet. It is created by the catalogue step of bin/seed.mjs —\n` +
        '  run this module after it, never before.',
    );
  }
  log(`coffee — store ${store.handle} (${store.id}), theme "${store.theme_key ?? 'vanilla'}"`);

  await installApps(port);
  await dropGateOnTheCafe(port, store);
  await markSubscribable(port, store);
  await subscriberPromotions(port, store);
  await seedPages(port, store);

  log('coffee — done. Re-running this is a no-op.');
}

// ── 1. the apps ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ THE SUBSCRIPTIONS INSTALL IS A PRECONDITION OF STEP 3, not merely a nicety: installing is what
// materializes the app's `sub_plan` declaration, and the promotion below is REFUSED without it.
async function installApps({ command, read, rows, log }) {
  const installed = new Set(
    rows(await read('installed_extensions')).map((e) => e.extension_id ?? e.id),
  );
  for (const id of APPS) {
    if (installed.has(id)) {
      log(`coffee — app ${id} already installed`);
      continue;
    }
    await command('extension.install', { extension_id: id });
    log(`coffee — app ${id} installed`);
  }
}

// ── 1-bis. the gate this store's fork cannot draw ───────────────────────────────────────────────────────
/**
 * ★★★ THE INSTALL ABOVE FANS OUT TO EVERY STORE OF THIS TENANT, AND ONE OF THE TWO CANNOT DRAW WHAT IT PLACED.
 * This removes the gate's placement from the CAFÉ and leaves the counter's alone. It is a DECLARATION, not a
 * workaround, and the owner's own rule is what it spells (11/09): *"o fork é do cliente, 100% liberdade"* — an
 * instance whose fork does not draw a block REMOVES the placement, so that the port, the admin and the screen
 * all say the same thing. The pattern already exists and is in use one file away (`seed/outlet.mjs`, which
 * removes the shelf `extension.install` drops into the PLP because he asked for a clean one).
 *
 * ── WHY THE CAFÉ AND NOT THE COUNTER, MEASURED ──────────────────────────────────────────────────────────
 *
 * `extension.install` is TENANT-wide and `seedDefaultPlacements` writes one `hook_placement` row per STORE for
 * every storefront hook a manifest declares (`packages/core/src/commands/extension.ts`), so installing for
 * `forgecafe` places the gate on `cafe` AND on `balcao`. The two stores have different fronts and only one of
 * them owns a gate registry:
 *
 *   · `balcao` — the totem, `totem/src/lib/gate/registry.tsx`: a real entry for `demo-gate`. It DRAWS.
 *   · `cafe`   — the forked vitrine, whose layout resolves through the KIT's registry, which is `{}` by
 *                design and held empty by the kit's own guard. It CANNOT.
 *
 * ⚠️ AND SINCE pk32 "cannot" NO LONGER MEANS "serves the shop quietly". `storefront:gate` is a STRUCTURAL
 * target, so a fork that finds the slot filled and resolves no implementation REFUSES THE PAGE, visibly
 * (`CompositionGapNotice` — "Esta loja está temporariamente indisponível"). That refusal is right and it is
 * the improvement that slice made; what it is NOT is a working café. Leaving the placement on this store would
 * hand the owner a coffee shop whose every page is a refusal screen, on the bench he is about to test.
 *
 * ⇒ so the café is born WITHOUT the gate, ON PURPOSE and ON THE RECORD, and the reason is not this file's
 * secret: `bin/front-app-reach.guard.mjs` carries `{ fork: 'storefront-coffee', app: 'demo-gate' }` as a
 * DECLARED DIVERGENCE, printed on every run, and a waiver that stops matching a finding goes RED. The day the
 * café's fork can regenerate its registry, that entry goes and this function goes with it.
 *
 * ⛔ IT REMOVES AND NEVER RE-PLACES. A reinstall does not put the row back either: the kernel remembers an
 * offered default in `default_placement_seed`, so this is convergent rather than a tug of war.
 */
async function dropGateOnTheCafe({ command, read, rows, log }, store) {
  const placed = rows(await read('extension_composition', { store: store.id })).filter(
    (row) => row.extension_id === GATE_APP && row.target === GATE_TARGET,
  );
  if (placed.length === 0) {
    log(`coffee — ${GATE_APP} has no ${GATE_TARGET} placement on "${store.handle}" (nothing to remove)`);
    return;
  }
  for (const row of placed) {
    await command('composition.remove', { store: store.id, placement_id: row.placement_id });
    log(
      `coffee — removed the ${GATE_TARGET} placement of ${GATE_APP} from "${store.handle}": this fork has no ` +
        'gate registry, and a structural slot it cannot draw REFUSES the page. The counter keeps its gate.',
    );
  }
}

// ── 2. the curation mark ────────────────────────────────────────────────────────────────────────────────
/**
 * ⛔⛔ WHAT WAS WRONG HERE, MEASURED, BECAUSE THE FIX IS UNREADABLE WITHOUT IT (A46).
 *
 * This step asked `readAll('products', {store})` for the six coffees and marked every SKU of the five it
 * curated. On the pre-seed box it marked **zero, in silence**, and the storefront drew no subscription
 * control on any coffee page. The kernel was innocent and so was the app; the mark had never been written.
 *
 * The read is served by a PROJECTION, and the projection had not received the products yet. Measured on the
 * box (2026-09-02, `event_delivery` joined to `event_outbox`):
 *
 *     catalog.product.created  forge-alvorada   emitted 00:31:44.469955
 *     catalog.projection       applied it at            00:31:45.090644   ← 620 ms later
 *     this step ran between the publish (00:31:44.58) and the counter's seal (00:31:45.012)
 *
 * So the loop walked twenty-nine pages of a catalogue that did not contain the thing it was looking for, and
 * `for (…of []) {}` is not an error. `sku.updated_at === sku.created_at` on all nineteen coffee SKUs; not one
 * `catalog.sku.updated` event exists for any of them.
 *
 * ⚠️ AND THE GUARD THAT EXISTED WATCHED THE WRONG END. It refused a curated handle that `catalog.json` does
 * not declare — a check on the INPUT, which cannot fail as long as the two lists in this file agree — and
 * said nothing at all about the RESULT. A guard on the input is a guard that can only catch a typo.
 *
 * ★ THE FIX IS BOTH HALVES, and neither alone is enough:
 *
 *   1. ASK THE RUN'S OWN REGISTRY FIRST (`seed/minted.mjs`), which covers exactly the window where the race
 *      exists and has no timeout that can still be wrong. The read remains the authority for everything an
 *      EARLIER run made, where there is nothing to race.
 *   2. FAIL ON THE RESULT. Every curated handle must end this function with at least one SKU carrying the
 *      mark. "I was asked to mark five coffees and I marked none" is a sentence, not a log line.
 *
 * ⚠️ THE MARK IS WRITTEN WITH `catalog.sku.update`, AND `metadata` IS REPLACED WHOLESALE. The command
 * validates declared `sku` fields and then COALESCES the bag, so writing `{sub_enabled:true}` over a SKU
 * that already holds something would erase the something. The bag is therefore merged, and for a SKU this
 * run just minted the bag comes from the registry — which knows what was SENT — rather than from a guess.
 */
export async function markSubscribable({ command, readAll, minted, log }, store) {
  const wanted = new Set(SUBSCRIBABLE_HANDLES);
  const known = new Set(catalog.products.map((p) => p.handle));
  const orphans = [...wanted].filter((handle) => !known.has(handle));
  if (orphans.length > 0) {
    // A curated handle that is not in the catalogue is ALWAYS a curation bug, and silence would make a PDP
    // quietly miss its subscription control. Name them and stop. (A check on the INPUT — kept, but it is
    // NOT the guard: see the result check at the bottom.)
    throw new Error(
      `coffee — these handles are marked subscribable but are not in seed/catalog.json: ${orphans.join(', ')}`,
    );
  }

  // ⚠️ `store` IS REQUIRED BY THIS READ even though the internal face answers the whole TENANT catalogue
  // regardless of it (measured by D1, and the note is in bin/seed.mjs). Omitting it is a refusal, not a
  // wider answer — so it is passed, and the filtering below is by handle rather than by trusting it.
  // ★ S1 — AND IT PAGES. With the sports store seeded this read answers 2811 products over 29 pages; one
  // page of 100 would filter six coffees out of a window they are not in, and mark nothing, in silence.
  const fromRead = new Map();
  for (const product of await readAll('products', { store: store.id })) {
    if (wanted.has(product.handle)) fromRead.set(product.handle, product.skus ?? []);
  }

  let marked = 0;
  let already = 0;
  /** handle -> how many of its SKUs now carry the mark. THE thing this function is judged on. */
  const carrying = new Map();
  const unseen = [];
  for (const handle of SUBSCRIBABLE_HANDLES) {
    // ★★ THE REGISTRY FIRST. Only something created by THIS run can be missing from the read, and that is
    // precisely what the registry holds — with the bag it was created with, so the merge below is honest.
    const skus = minted?.skusOf(handle) ?? fromRead.get(handle) ?? null;
    if (!skus || skus.length === 0) {
      unseen.push(handle);
      continue;
    }
    let mine = 0;
    for (const sku of skus) {
      const bag = sku.metadata && typeof sku.metadata === 'object' ? sku.metadata : {};
      mine += 1;
      if (bag[SUB_ENABLED_FIELD] === true) {
        already += 1;
        continue;
      }
      await command('catalog.sku.update', {
        sku_id: sku.id,
        metadata: { ...bag, [SUB_ENABLED_FIELD]: true },
      });
      marked += 1;
    }
    carrying.set(handle, mine);
  }

  // ── ★★ THE GUARD, AND IT IS ON THE RESULT ───────────────────────────────────────────────────────────
  // "Asked to mark five and marked zero" must be a death. This is the check whose absence let A46 ship: the
  // old version logged `0 sku(s) marked` and returned 0 as if it were an answer.
  if (unseen.length > 0) {
    throw new Error(
      unresolved({
        what: 'subscribable coffee(s)',
        names: unseen,
        measured:
          `the store read answered ${fromRead.size} of the ${SUBSCRIBABLE_HANDLES.length} curated handles ` +
          `and this run's registry holds ${minted?.counts?.products ?? 0} product(s); ` +
          `${marked} sku(s) were marked and ${already} already carried the mark`,
        andThen:
          'the catalogue step did not create them — `catalog.product.create` is what mints them and\n' +
          '  `minted.rememberSkusOf` is what makes them findable here before the projection catches up.',
      }),
    );
  }
  const empty = SUBSCRIBABLE_HANDLES.filter((h) => (carrying.get(h) ?? 0) === 0);
  if (empty.length > 0) {
    throw new Error(
      `coffee — ${empty.length} curated coffee(s) resolved but carry NO sku to mark: ${empty.join(', ')}.\n` +
        '  The subscription control on their product page is drawn from `sku.metadata.sub_enabled` and\n' +
        '  nothing else, so a coffee with no marked sku is a coffee nobody can subscribe to — silently.',
    );
  }

  log(
    `coffee — subscription mark: ${marked} sku(s) marked, ${already} already marked, across ` +
      `${carrying.size} coffee(s); ` +
      `${catalog.products.length - SUBSCRIBABLE_HANDLES.length} coffee(s) deliberately left out`,
  );
}

// ── 3. what a subscribed line gets ──────────────────────────────────────────────────────────────────────
/**
 * Every promotion of `COFFEE_PROMOTIONS`, as an item/shipping promotion targeting the LINE'S OWN declared
 * field. The chain the store exists to prove, end to end: the app DECLARES `sub_plan` on the cart line, the
 * shopper's choice WRITES it, and the promotion engine PRICES on it.
 *
 * Scoped to this store: the Outlet and the control store share this box, and a tenant-wide subscriber
 * benefit would be a promotion the other shops never asked for.
 *
 * Idempotent by NAME, which is this repository's key for a promotion in three other places
 * (`seed/commerce.mjs`, `seed/totem.mjs`, `demo-data`'s history executor) — so a re-run converges and a
 * promotion a human renamed on the bench is left alone rather than duplicated.
 */
export async function subscriberPromotions({ command, readAll, log }, store) {
  const existing = new Map((await readAll('promotions_admin')).map((p) => [p.name, p]));
  for (const spec of COFFEE_PROMOTIONS) {
    if (existing.has(spec.name)) {
      log(`coffee — promotion "${spec.name}" already exists (${existing.get(spec.name).id})`);
      continue;
    }
    const out = await command('promotion.create', {
      name: spec.name,
      label: spec.label,
      store_id: store.id,
      benefit: spec.benefit,
      target: SUBSCRIBED_LINE,
      // Born ACTIVE, deliberately, unlike the command's own default: a draft subscriber benefit is a shop
      // that prints "10% OFF · Frete grátis" on the product page and charges both at the till.
      status: 'active',
      stackable: true,
    });
    log(`coffee — promotion "${spec.name}" created (${out.promotion_id ?? '?'}) — ${spec.why}`);
  }
}

// ── ⚠️ THE REVIEWS ARE NOT SEEDED, AND THIS IS WHY ──────────────────────────────────────────────────────
//
// The review wall is one of the two dynamic pieces the design marked with a hole, and it is the consumer of
// the `fetchPublishedReviews` export. It is NOT filled here, because every door measured is wrong in a
// different way and picking one quietly would bake a shortcut into this instance's birth data:
//
//   · `POST /apps/reviews/submit` — the shopper's own path. Requires a customer SESSION and an ORDER the
//     session owns (the app asks the kernel "is this order yours?" under the shopper's cookie). A seed has
//     neither, and manufacturing them would be a seed that logs in as somebody.
//   · the app's `seed_demo` ACTION, reachable through `POST /v1/internal/extension/action` with a tenant
//     credential — the right-shaped door. But its data source is INJECTED by the platform from
//     `FORGE_SEED_DATASET_DIR`, i.e. the Forge demo's own dataset, whose handles are a shoe shop's. Pointed
//     at this box it would seed nothing, and making it work means this repository shipping a dataset
//     directory in the platform's format — real work, and not "the minimum that closes the journey".
//   · the app's PUBLIC create face, with `status: 'approved'` in the body. It works. It works because of a
//     hole the app's own source names and deliberately leaves open ("a caller can still write
//     `status: 'approved'` and skip the queue… a separate hole, deliberately not closed"). A seed that
//     depends on it becomes a reason not to close it.
//
// So the wall renders EMPTY against this seed, and the storefront draws nothing rather than a broken
// section — which is the degradation the pages were written for anyway. Named here rather than silently
// missing, exactly like the three supporting products the catalogue promises and does not list.

// ── 4. the institutional pages ──────────────────────────────────────────────────────────────────────────
//
// ⚠️⚠️ THE PARAM IS `store_id`, AND SPELLING IT `store` IS A SILENT WHOLE-TENANT READ. `read.internal.pages`
// declares `store_id` and its Zod object STRIPS what it does not know — so `{ store: <id> }` is not a
// narrower question that gets ignored, it is NO question, and the answer is every page of the tenant. That
// matters here the day the counter gets cards of its own: the `have` set would already hold these slugs
// before this store had one, every slug would be skipped as "already there", and the step would report
// success having created NOTHING. The filter is asked of the read AND re-asserted on the row, because a read
// that answers a different question than the one asked is a species this repository has met three times.
async function seedPages({ command, readAll, log }, store) {
  const pages = coffeePages();
  const have = new Set(
    (await readAll('pages', { store_id: store.id }))
      .filter((page) => page.store_id === store.id)
      .map((page) => page.slug),
  );
  let created = 0;
  for (const page of pages) {
    if (have.has(page.slug)) continue;
    await command('content.page.create', {
      store_id: store.id,
      slug: page.slug,
      title: page.title,
      template_key: page.template_key,
      meta_title: page.meta_title,
      meta_description: page.meta_description,
      published: true,
    });
    created += 1;
  }
  log(`coffee — pages: ${created} created, ${pages.length - created} already there`);
}

/** The step above, reachable from the suite. Exported apart from the phase so `seedCoffee` keeps ONE entry
 *  point for the seed and the test still grades the step that actually writes. */
export const seedCoffeePagesForTest = seedPages;
