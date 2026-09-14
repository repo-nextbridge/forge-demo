// THE COFFEE PHASE'S TESTS — `bash bin/test.sh`, the same plain `node --test` the rest of this repo uses.
//
// ── WHAT IS WORTH TESTING HERE, and it is emphatically NOT "the coffee store is seeded" ──────────────────
//
// A run against a box proves the box. What a run CANNOT prove is the class of defect this slice exists to
// remove, because that class is invisible to a run: **a write the seed announced and never made, on a phase
// that exited zero**. Two of them shipped together (A46 · A47) and neither left a mark anywhere:
//
//   · the subscription mark — the phase said "0 sku(s) marked" and returned; no PDP drew a subscription;
//   · the nine custom fields — created correctly, then erased 540 ms later by a merge into an assumed `{}`.
//
// Both had the SAME cause, measured on the pre-seed box on 2026-09-02 by joining `event_delivery` to
// `event_outbox`: the phase asks a PROJECTION about products the same run just created, and the projection
// was 620 ms behind. So every test below runs the phase against a fake box WHERE THE PROJECTION IS EMPTY,
// which is the state a real fresh box is in for exactly as long as it takes to lose.
//
// ⚠️ AND THE CONTROL IS THE POINT OF THE FILE. It is not enough for the fixed phase to be green: the test
// has to be able to go RED. Each guard is exercised twice — once with the fix, once with the fix taken away
// — because a guard that has never been seen to fail is a guard nobody has measured.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  COFFEE_PROMOTIONS,
  coffeePages,
  expectedCoffee,
  expectedCoffees,
  expectedMetadata,
  expectedPhotos,
  markSubscribable,
  SUB_ENABLED_FIELD,
  SUBSCRIBABLE_HANDLES,
  subscriberPromotions,
} from './coffee.mjs';
import { photoListFor, placeholderForPhoto, planMediaList, resolvePhoto, STORY_SHOTS } from './media.mjs';
import { createMinted } from './minted.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));
const product = (handle) => catalog.products.find((p) => p.handle === handle);

/** The nine rows the fork's "Características" panel draws, from its own table
 *  (`storefront-coffee/src/lib/coffee/product-view.ts` → SPEC_LABELS). Written here so a rename in the fork
 *  turns into a red line rather than into a panel that quietly loses a row. */
const NINE = ['notas', 'regiao', 'produtor', 'fazenda', 'altitude', 'variedade', 'processo', 'torra', 'sca'];

// ── a fake box ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * A port whose PROJECTION IS EMPTY — the state of a real box for the ~620 ms after a product is created.
 * Every command it receives is recorded, and nothing else happens.
 */
function fakeBox({ published = [] } = {}) {
  const sent = [];
  return {
    sent,
    port: {
      command: async (name, input) => {
        sent.push({ name, input });
        return {};
      },
      readAll: async () => published,
      log: () => {},
    },
  };
}

/** The registry as `bin/seed.mjs` fills it during the run that creates the six coffees. */
function registryOfAFreshRun() {
  const minted = createMinted();
  for (const p of catalog.products) {
    minted.rememberProduct(p.handle, `prod_${p.handle}`, expectedMetadata(p));
    minted.rememberSkusOf(
      p.handle,
      p.skus.map((_, i) => ({ code: `${p.handle}-${i}`, id: `sku_${p.handle}_${i}`, metadata: {} })),
    );
  }
  return minted;
}

// ── 1 · THE SUBSCRIPTION MARK (A46) ─────────────────────────────────────────────────────────────────────

test('★★ A46 — the mark is written even when the projection has not caught up', async () => {
  // The exact box the defect happened on: the six coffees exist, the store read answers NOTHING about them.
  const { port, sent } = fakeBox({ published: [] });
  await markSubscribable({ ...port, minted: registryOfAFreshRun() }, { id: 'sto_cafe' });

  const marks = sent.filter((c) => c.name === 'catalog.sku.update');
  const skusOfCurated = catalog.products
    .filter((p) => SUBSCRIBABLE_HANDLES.includes(p.handle))
    .reduce((n, p) => n + p.skus.length, 0);
  assert.equal(marks.length, skusOfCurated, 'not every sku of the five curated coffees was marked');
  for (const mark of marks) assert.equal(mark.input.metadata[SUB_ENABLED_FIELD], true);
});

test('⛔ A46 — THE CONTROL: take the registry away and the phase DIES instead of marking zero in silence', async () => {
  // ★★ THIS IS THE PROOF THE DoD ASKS FOR. `minted: undefined` is exactly the code that shipped: the phase
  // had only the read, the read was behind the projection, and `for (…of []) {}` marked nothing and returned
  // a log line. Now the same box is a thrown error naming the five coffees.
  const { port, sent } = fakeBox({ published: [] });
  await assert.rejects(
    () => markSubscribable({ ...port, minted: undefined }, { id: 'sto_cafe' }),
    (error) => {
      for (const handle of SUBSCRIBABLE_HANDLES) {
        assert.match(error.message, new RegExp(handle), `the error does not name ${handle}`);
      }
      return true;
    },
  );
  assert.equal(sent.length, 0, 'it wrote something before refusing');
});

test('A46 — a coffee the read DOES serve is marked from the read, and one already marked costs no command', async () => {
  // The other half of the same window: a product an EARLIER run made is not in the registry and there is no
  // race to lose. And idempotence is by VALUE — a re-run writes nothing.
  const alreadyMarked = catalog.products
    .filter((p) => SUBSCRIBABLE_HANDLES.includes(p.handle))
    .map((p) => ({
      handle: p.handle,
      skus: p.skus.map((_, i) => ({ id: `sku_${p.handle}_${i}`, metadata: { [SUB_ENABLED_FIELD]: true } })),
    }));
  const { port, sent } = fakeBox({ published: alreadyMarked });
  await markSubscribable({ ...port, minted: createMinted() }, { id: 'sto_cafe' });
  assert.equal(sent.length, 0, 'a second run must spend no command and write no audit row');
});

test('A46 — the mark MERGES: a sku bag that already holds something keeps it', async () => {
  // `catalog.sku.update` validates the bag and then COALESCES the column: a literal `{sub_enabled:true}`
  // would erase whatever a merchant had typed. Nothing holds anything today; the merge is for the day it does.
  const published = catalog.products
    .filter((p) => p.handle === 'forge-alvorada')
    .map((p) => ({ handle: p.handle, skus: [{ id: 'sku_x', metadata: { lote: 'A-12' } }] }));
  const { port, sent } = fakeBox({ published });
  await assert.rejects(() => markSubscribable({ ...port, minted: createMinted() }, { id: 'sto_cafe' }));
  // …the other four are unresolved and it refuses — but the one it DID reach was merged, not replaced.
  const mark = sent.find((c) => c.name === 'catalog.sku.update');
  assert.deepEqual(mark.input.metadata, { lote: 'A-12', [SUB_ENABLED_FIELD]: true });
});

test('★ A46 — the curation is FIVE IN, ONE OUT, and the sixth is out on purpose', async () => {
  const { port, sent } = fakeBox({ published: [] });
  await markSubscribable({ ...port, minted: registryOfAFreshRun() }, { id: 'sto_cafe' });
  const touched = new Set(sent.map((c) => c.input.sku_id.replace(/^sku_/, '').replace(/_\d+$/, '')));
  assert.equal(touched.has('forge-edicao-do-produtor'), false, 'the rotating lot must NOT be subscribable');
  assert.equal(touched.size, SUBSCRIBABLE_HANDLES.length);
});

// ── 2 · THE NINE CUSTOM FIELDS (A47) ────────────────────────────────────────────────────────────────────

test('★★ A47 — every coffee declares all NINE fields the PDP panel draws', () => {
  // The defect was seven declared on one coffee and four on another, and nothing at all landing. The panel
  // is `specsOf()`, which draws a row per key it finds and nothing for a key it does not.
  for (const p of catalog.products) {
    const bag = expectedMetadata(p);
    const missing = NINE.filter((k) => !bag[k] || String(bag[k]).trim() === '');
    assert.deepEqual(missing, [], `${p.handle} is missing: ${missing.join(', ')}`);
  }
});

test('A47 — the subtitle rides the same bag, because that is where the kicker reads it from', () => {
  // `PdpCoffee.tsx` draws `field(product,'subtitle')` above the title, and `field()` reads `metadata`.
  const bag = expectedMetadata(product('forge-alvorada'));
  assert.equal(bag.subtitle, 'O blend da casa');
});

test('★★ A50, CORRECTED — the "data is missing" marker NEVER travels inside a shopper-facing value', () => {
  // ⚠️ THIS TEST USED TO ASSERT THE OPPOSITE, and that is the finding worth keeping. It demanded that at
  // least one of the nine fields carry `(placeholder)` — reading A50 ("a hole must be recognisable") as if
  // the value were the place to say it. It is not: a product custom field is served by the ANONYMOUS read
  // face and printed in the shop's "Características" panel, so the marker's only reader was the SHOPPER, who
  // read the word "placeholder" in about six places on every coffee page — badge, five spec rows and the end
  // of "Quem plantou". A50's reader is the OPERATOR closing the hole; the value is the one channel that
  // cannot reach them and cannot avoid reaching the buyer.
  //
  // The marker's legitimate homes are the seed's own report, a field of its own, and a stand-in PICTURE the
  // merchant must replace (`seed/placeholder-media/`, deliberate — the merchant cannot write a
  // photograph, so the hole has no other way to be seen). A producer's name is not in that class: this is a
  // demonstration shop, so fictional content IS the content.
  //
  // The control is the file itself: this reads every value the port publishes, not a sample.
  const dirty = [];
  for (const p of catalog.products) {
    for (const [key, value] of Object.entries(expectedMetadata(p))) {
      if (/placeholder|a definir|\bTBD\b|preencher/i.test(String(value))) dirty.push(`${p.handle}.${key} = ${value}`);
    }
    for (const section of p.content_sections ?? []) {
      if (/placeholder|a definir|\bTBD\b|preencher/i.test(section.body)) dirty.push(`${p.handle} §${section.title}`);
    }
  }
  assert.deepEqual(dirty, [], `a provisional marker reaches the shop window in: ${dirty.join(' · ')}`);
  // …and the nine are still FILLED. "No marker" must not be reachable by emptying the field — the panel
  // draws a row per key it finds, and a blank row is the same hole with better manners.
  for (const p of catalog.products) {
    const bag = expectedMetadata(p);
    for (const key of NINE) assert.ok(String(bag[key] ?? '').trim().length > 0, `${p.handle}.${key} is empty`);
  }
  // The values that were always known are untouched by the rewrite.
  assert.equal(expectedMetadata(product('forge-serra-do-caparao')).sca, '86');
  assert.equal(expectedMetadata(product('forge-edicao-do-produtor')).produtor, 'Dona Cida');
});

test('★★ A47 — every coffee carries the "Quem plantou" section the page knows how to draw', () => {
  // `PdpCoffee.tsx:214` titles the card from `sections[0].title` and falls back to the literal. With zero
  // sections the whole card is absent — which is correct degradation and was, for six coffees, the state.
  for (const want of expectedCoffees()) {
    assert.equal(want.sections.length, 1, `${want.handle} declares ${want.sections.length} section(s)`);
    assert.equal(want.sections[0].title, 'Quem plantou');
    assert.ok(want.sections[0].body.length > 80, `${want.handle}'s story is a stub`);
  }
});

// ── 3 · THE FOUR PHOTOGRAPHS (A47 · A50) ────────────────────────────────────────────────────────────────

test('★★ the dataset declares FOUR photographs per coffee, and the bag is still first', () => {
  // The convention is POSITION (`PdpCoffee.tsx:5`): [0] is the bag the buy box draws, [1..3] are the story.
  for (const p of catalog.products) {
    const photos = expectedPhotos(p);
    assert.equal(photos.length, 4, `${p.handle} declares ${photos.length} photograph(s)`);
    assert.equal(photos[0], p.photo, `${p.handle}'s list does not open with its bag photograph`);
    assert.deepEqual(photos, photoListFor(p.photo), `${p.handle}'s list is not the derived one`);
  }
});

test('the singular `photo` is still a working fallback — nothing regressed when the list arrived', () => {
  assert.deepEqual(expectedPhotos({ photo: 'x.png' }), ['x.png']);
  assert.deepEqual(expectedPhotos({ photo: 'x.png', photos: [] }), ['x.png']);
  assert.deepEqual(expectedPhotos({}), []);
});

test('★ A50 — every story frame resolves to something: the real file, else its committed stand-in', () => {
  // The eighteen story photographs do not exist yet. The rule is that the shop is born with four pictures
  // anyway, one of which visibly says it is a placeholder — a hole nobody can see is indistinguishable from
  // a decision nobody took.
  const disk = {
    photos: new Set(readdirSync(join(SEED, 'photos'))),
    placeholders: new Set(readdirSync(join(SEED, 'placeholder-media'))),
  };
  for (const p of catalog.products) {
    for (const name of expectedPhotos(p)) {
      const found = resolvePhoto(name, disk);
      assert.ok(found, `${p.handle} declares "${name}" and neither it nor a stand-in is on disk`);
    }
  }
});

test('★ the stand-in stops being used THE MOMENT the real file lands — no dataset edit', () => {
  // This is what makes the hand-over one gesture: the dataset already names the final file, so the merchant
  // drops it into seed/photos/ and the next run re-points the picture.
  const disk = { photos: new Set(['alvorada-historia-1.png']), placeholders: new Set(['placeholder-alvorada-historia-1-1208x906.png']) };
  assert.deepEqual(resolvePhoto('alvorada-historia-1.png', disk), {
    file: 'alvorada-historia-1.png',
    dir: 'photos',
    placeholder: false,
  });
  const empty = { photos: new Set(), placeholders: disk.placeholders };
  assert.equal(resolvePhoto('alvorada-historia-1.png', empty).placeholder, true);
});

test('the bag photograph has NO stand-in — a coffee with no picture is a dataset error, not a hole', () => {
  assert.equal(placeholderForPhoto('alvorada.png'), null);
  assert.equal(resolvePhoto('alvorada.png', { photos: new Set(), placeholders: new Set() }), null);
});

test('the three story slots keep the ratios the grid draws — one wide 4:3 and two squares', () => {
  // `coffee.module.css`: `.galleryWide` is `aspect-ratio: 4/3` spanning both columns; `.gallerySquare` is 1/1.
  // A stand-in in the wrong ratio teaches a layout that does not exist, and the page moves when it is replaced.
  assert.equal(STORY_SHOTS.length, 3);
  assert.equal(STORY_SHOTS[0].width / STORY_SHOTS[0].height, 4 / 3);
  for (const shot of STORY_SHOTS.slice(1)) assert.equal(shot.width, shot.height);
});

// ── 4 · THE MEDIA LIST PLAN — the half `planRepoint` could not do ───────────────────────────────────────

test('★★ planMediaList treats a picture at the WRONG POSITION as work, not as present', () => {
  // The buy box takes `photos[0]`. A list that merely CONTAINS the bag is not the same as a list that starts
  // with it — matching on the key alone would let a re-ordered dataset silently keep the old page.
  const refs = [
    { id: 'm1', provider_key: 'k/story', kind: 'image', position: 0 },
    { id: 'm2', provider_key: 'k/bag', kind: 'image', position: 1 },
  ];
  const plan = planMediaList(refs, ['k/bag', 'k/story']);
  assert.deepEqual(plan.attach, [
    { provider_key: 'k/bag', position: 0 },
    { provider_key: 'k/story', position: 1 },
  ]);
  assert.deepEqual(plan.detach.sort(), ['m1', 'm2']);
});

test('planMediaList is a no-op when every picture is already in its place', () => {
  const refs = [
    { id: 'm1', provider_key: 'k/bag', kind: 'image', position: 0 },
    { id: 'm2', provider_key: 'k/story', kind: 'image', position: 1 },
  ];
  const plan = planMediaList(refs, ['k/bag', 'k/story']);
  assert.deepEqual(plan, { attach: [], detach: [] });
});

test('planMediaList attaches what is new and drops only what is left over', () => {
  const refs = [{ id: 'm1', provider_key: 'k/bag', kind: 'image', position: 0 }];
  const plan = planMediaList(refs, ['k/bag', 'k/s1', 'k/s2', 'k/s3']);
  assert.equal(plan.attach.length, 3);
  assert.deepEqual(plan.detach, []);
});

// ── 5 · the expectation object the verifier reads ───────────────────────────────────────────────────────

test('★ expectedCoffee names the curation, so a verifier can measure the NEGATIVE too', () => {
  // "Everything is marked" is as wrong as "nothing is marked", and only a verifier that knows which coffee
  // is deliberately out can tell the difference.
  assert.equal(expectedCoffee(product('forge-alvorada')).subscribable, true);
  assert.equal(expectedCoffee(product('forge-edicao-do-produtor')).subscribable, false);
  assert.equal(expectedCoffees().length, catalog.products.length);
});

// ── 6 · WHAT A SUBSCRIBER GETS (D14) ────────────────────────────────────────────────────────────────────
//
// ⛔ THE DEFECT, MEASURED ON THE BENCH OF 2026-09-03 (`select name, benefit from promotion` in the coffee
// tenant's schema): FOUR promotions — Assinante 10% OFF · Primeiro café 10% · Combo da manhã · Primeira
// xícara 10% — and NOT ONE with a `free_shipping` benefit. The buy box promised freight it could not give.

/** The perk line of the FORK, read off disk rather than re-typed: this is the sentence the data below has to
 *  keep, and a slice that edits the sentence must meet this file. */
const BUY_BOX = readFileSync(
  join(SEED, '..', 'storefront-coffee', 'src', 'templates', 'pdp', 'CoffeeBuyBox.tsx'),
  'utf8',
);

test('★★ D14 — a subscribed line gets BOTH perks the buy box prints: the 10% AND the freight', async () => {
  const { port, sent } = fakeBox({ published: [] });
  await subscriberPromotions(port, { id: 'sto_cafe' });

  const created = sent.filter((c) => c.name === 'promotion.create').map((c) => c.input);
  assert.equal(created.length, 2, 'the store is not born with two subscriber promotions');
  const kinds = created.map((p) => p.benefit.kind).sort();
  assert.deepEqual(kinds, ['free_shipping', 'percentage']);
  for (const promotion of created) {
    // The whole chain in one assertion: the app declares the field, the shopper writes it, this prices on it.
    assert.deepEqual(promotion.target, {
      kind: 'custom_field',
      field: 'sub_plan',
      operator: 'exists',
    });
    assert.equal(promotion.status, 'active', 'a draft perk is a shop that charges what it says it will not');
    assert.equal(promotion.store_id, 'sto_cafe', 'the other shops of this box never asked for it');
    assert.equal(promotion.stackable, true);
  }
});

test('⛔ D14 — THE CONTROL: the fork PRINTS "Frete grátis", so the dataset must carry a free_shipping', () => {
  // ★ THIS IS THE TIE, and it is what makes the guard fail for the right reason. The sentence is a constant
  // of the fork; the benefit is a row in a database. Neither half can see the other, so this test holds
  // them together: delete the promotion and this goes red, delete the sentence and it goes red too.
  assert.match(BUY_BOX, /Frete grátis/, 'the buy box no longer promises free freight — then delete the promotion');
  assert.ok(
    COFFEE_PROMOTIONS.some((p) => p.benefit.kind === 'free_shipping'),
    'the buy box promises "Frete grátis" and no promotion of this store delivers it (D14)',
  );
});

test('★ D14 — the freight promotion names NO delivery method, because the sentence carries no qualifier', () => {
  // `shipping_method_ids` absent = every method (packages/contracts/src/promotion.ts:82, the contract's own
  // default). The kernel offers the narrower shape; the shop's sentence is what decides not to use it.
  const freight = COFFEE_PROMOTIONS.find((p) => p.benefit.kind === 'free_shipping');
  assert.equal(freight.benefit.shipping_method_ids, undefined);
  assert.equal(freight.benefit.max_covered_amount, undefined, 'a capped perk needs the sentence to say so');
});

test('D14 — a box that already holds both spends no command', async () => {
  const published = COFFEE_PROMOTIONS.map((p, i) => ({ id: `promo_${i}`, name: p.name }));
  const { port, sent } = fakeBox({ published });
  await subscriberPromotions(port, { id: 'sto_cafe' });
  assert.equal(sent.length, 0, 'a re-run must create nothing — the name is the idempotence key');
});

// ── ★★ THE INSTITUTIONAL PAGES — seven cards, and the one page whose BODY is this shop's ─────────────────
//
// The shop published ZERO of these while its sidebar and its footer drew all seven links, which made every
// one of them a link into the shop's own 404 (`bin/verify-seed.mjs`, section 3b, 05/09).

const FORK_CMS = join(SEED, '..', 'storefront-coffee', 'src', 'templates', 'cms');

/** The sidebar's links, read off the component that draws them — never a second list of the same slugs. */
function navSlugs() {
  const source = readFileSync(join(FORK_CMS, 'PageView.tsx'), 'utf8');
  const nav = /const NAV[^=]*=\s*\[([\s\S]*?)\];/.exec(source);
  assert.ok(nav, 'no NAV literal in the fork PageView — the derivation this test rests on is gone');
  const slugs = [...nav[1].matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(slugs.length > 0, 'the NAV literal parsed to zero slugs — the shape changed under this regex');
  return slugs;
}

/** The template keys this image can resolve: the shared map plus the café's own overlay. */
function registeredKeys() {
  const source = readFileSync(join(FORK_CMS, 'registry.ts'), 'utf8');
  const keys = [];
  for (const name of ['SHARED', 'OWN']) {
    const block = new RegExp(`const ${name}: Record<string, PageTemplate> = \\{([^}]*)\\}`).exec(source);
    assert.ok(block, `no ${name} map in the fork registry — the derivation is gone`);
    keys.push(...[...block[1].matchAll(/^\s*'?([a-z-]+)'?:/gm)].map((m) => m[1]));
  }
  assert.ok(keys.includes('institutional-default'), keys.join(', '));
  return keys;
}

test('★★ the café declares a page for EVERY link its institutional sidebar draws — a gap is a dead link', () => {
  const declared = coffeePages().map((p) => p.slug);
  const missing = navSlugs().filter((slug) => !declared.includes(slug));
  assert.deepEqual(
    missing,
    [],
    `the storefront links ${missing.join(', ')} and this shop declares no page for it. The sidebar is ` +
      'hardcoded, so a slug it draws and the shop does not publish is a 404 the shop links to itself.',
  );
});

test('★ every card asks for a template this image can actually resolve', () => {
  const known = registeredKeys();
  for (const page of coffeePages()) {
    assert.ok(
      known.includes(page.template_key),
      `page "${page.slug}" asks for template "${page.template_key}", which this storefront does not ` +
        `register (${known.join(', ')}). Unknown keys fall back to the placeholder template, silently.`,
    );
  }
});

test('★ the shop speaks for itself in every field a card CAN carry, and no two say the same thing', () => {
  const seen = new Set();
  for (const page of coffeePages()) {
    for (const key of ['title', 'meta_title', 'meta_description']) {
      assert.equal(typeof page[key], 'string', `page "${page.slug}" has no ${key}`);
      assert.ok(page[key].trim().length > 0, `page "${page.slug}" has an empty ${key}`);
    }
    assert.ok(!seen.has(page.meta_description), `two pages share one description: ${page.slug}`);
    seen.add(page.meta_description);
  }
});

test('⛔ no meta promises FREE FREIGHT — on this store the only rule that zeroes it is the subscription', () => {
  // The trap named in `PAGES`: `Shipping.tsx` offers "frete grátis acima do valor indicado", which is the
  // reference store's rule and not this one's. A meta repeating it would be the shop promising in a search
  // result what its own page does not say — the species of prose this repository keeps paying for.
  for (const page of coffeePages()) {
    assert.doesNotMatch(
      page.meta_description,
      /frete gr[áa]tis/i,
      `page "${page.slug}" promises free freight in its meta. This store's only free-freight rule is the ` +
        'subscription perk, and the shared shipping template ties it to a cart threshold instead.',
    );
  }
});

test('★★ AND ONE OF THEM HAS A BODY OF ITS OWN — the card alone would be the shoe shop under a coffee theme', () => {
  // The whole point of the slice: `sobre` is the café's, resolved through the store overlay. Without this,
  // seven cards could be published over seven shared bodies and every check above would still be green.
  const about = coffeePages().find((p) => p.template_key === 'about');
  assert.ok(about, 'no card asks for the `about` template — the one page this shop wrote for itself');
  const registry = readFileSync(join(FORK_CMS, 'registry.ts'), 'utf8');
  const own = /const OWN: Record<string, PageTemplate> = \{([^}]*)\}/.exec(registry);
  assert.ok(own, 'the fork registry no longer exports an OWN overlay');
  assert.match(
    own[1],
    /\babout:\s*CoffeeAbout\b/,
    'the café stopped overriding `about`, so /sobre serves the body shared with the reference vitrine — ' +
      'which opens "Somos uma loja de calçados".',
  );
});

test('the page step is idempotent and asks the read the STORE\'S question, not the tenant\'s', async () => {
  // ⚠️ `read.internal.pages` declares `store_id` and Zod strips anything else, so a mis-spelled filter is
  // not a narrower question — it is no question, and the answer is the whole tenant. On this box that turns
  // "create the seven" into "skip the seven" the day another store of this tenant holds the same slugs.
  const { seedCoffeePagesForTest } = await import('./coffee.mjs');
  assert.equal(typeof seedCoffeePagesForTest, 'function');

  const asked = [];
  const sent = [];
  const other = coffeePages().map((spec) => ({ ...spec, store_id: 'sto_balcao' }));
  const port = {
    readAll: async (name, params) => {
      asked.push([name, params]);
      // A face that IGNORED store_id would answer these — the counter's cards, with this store's slugs.
      return params?.store_id === 'sto_cafe' ? [] : other;
    },
    command: async (name, input) => {
      sent.push([name, input]);
    },
    log: () => {},
  };
  await seedCoffeePagesForTest(port, { id: 'sto_cafe' });
  assert.deepEqual(asked, [['pages', { store_id: 'sto_cafe' }]]);
  assert.equal(sent.length, coffeePages().length, 'the seven were not created');
  assert.equal(sent[0][0], 'content.page.create');
  assert.equal(sent[0][1].store_id, 'sto_cafe');
  assert.equal(sent[0][1].published, true);

  // And a re-run creates nothing.
  const again = [];
  await seedCoffeePagesForTest(
    {
      readAll: async () => coffeePages().map((spec) => ({ ...spec, store_id: 'sto_cafe' })),
      command: async (name, input) => again.push([name, input]),
      log: () => {},
    },
    { id: 'sto_cafe' },
  );
  assert.deepEqual(again, [], 're-running the phase must create nothing');
});
