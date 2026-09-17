// ★★ s3-7 — EVERY PHOTOGRAPH THE PORT SERVES REACHES THE COFFEE PAGE, AND THE COUNT IS THE ASSERTION.
//
// ── WHAT WAS REPORTED, AND WHAT THE MEASUREMENT SAID ─────────────────────────────────────────────────────
//
// Reported: "1 foto por café em 5 dos 6; só o Alvorada tem +3". Measured against the bench on 2026-09-03,
// through the whole chain rather than through the page:
//
//   · `media_ref`         — 4 rows per coffee, positions 0..3, on all six.
//   · `product_projection`— `doc->'media'` has 4 entries on all six (the read serves the projection).
//   · the 24 media URLs   — all 200 through the port.
//   · the six live PDPs   — 4 `<img src=…/v1/media/local/…>` each, counted in the served HTML.
//
// So nothing is lost between the port and the page, and no line of code was the defect. `command_log` gives
// the reason: the 18 `catalog.media.attach` commands (6 coffees × 3 story frames) ran ONCE, at 20:18 UTC on
// 2026-09-02, and there is no earlier run and no detach. Before that instant every coffee had exactly one
// photograph — which is what the report describes. The probe straddled the seed run.
//
// ── SO WHY A TEST, IF NOTHING WAS BROKEN ─────────────────────────────────────────────────────────────────
//
// Because the report was PLAUSIBLE, and it was plausible for a reason: there was no test anywhere that could
// have answered it. `PdpCoffee` is the one template in this fork with no test file, its media contract is a
// COUNT ("the convention is position, which means it is by count too" — its own header), and a template that
// drops photographs silently is indistinguishable from a dataset that never had them. Half a day went into
// telling those two apart by hand, twice, on two different days. That is the cost this file removes.
//
// It is deliberately about the COUNT and the ORDER and nothing else: this page is not a swap gallery and has
// no thumbnails — the approved artboard draws all four at once (the bag beside the buy box, then a wide frame
// and two squares in the story grid), which is why every photograph is on screen without a click.

import type { MediaRef, ProductDoc } from '@forgeco/storefront-kit/read-client';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { EMPTY_SNAPSHOT } from '@forgeco/storefront-kit/minicart-types';
import { MinicartProvider } from '@/components/minicart/MinicartProvider';
import { makeProduct } from '@/test/fixtures';
import { PdpCoffee } from './PdpCoffee';

/** The buy box reads the minicart context, so the page cannot be rendered outside a provider. Its actions are
 *  never called here — this file is about what is DRAWN, and a stub keeps that the only variable. */
const CART = {
  readCart: async () => EMPTY_SNAPSHOT,
  addLine: async () => {},
  updateLine: async () => {},
  removeLine: async () => {},
};

/** The dataset's own shape: the bag at 0, then the three story frames (`seed/media.mjs` → STORY_SHOTS). */
const photos = (n: number): MediaRef[] =>
  Array.from({ length: n }, (_, position) => ({
    provider_key: `cdn/coffee-${position}.png`,
    kind: 'image' as const,
    role: position === 0 ? null : 'gallery',
    position,
    url: `https://media.test/cdn/coffee-${position}.png`,
  }));

const coffee = (media: MediaRef[]): ProductDoc =>
  makeProduct({ title: 'Forge Alvorada', handle: 'forge-alvorada', media });

const html = (media: MediaRef[]) =>
  renderToString(
    <MinicartProvider actions={CART}>
      <PdpCoffee product={coffee(media)} reviews={[]} rating={null} addLine={async () => {}} />
    </MinicartProvider>,
  );

/** The `src` of every `<img>` on the page, in document order. */
const srcs = (out: string) => [...out.matchAll(/<img[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]);

test('★★ four photographs in the doc are FOUR on the page — the bag first, then the three story frames', () => {
  const out = html(photos(4));
  const drawn = srcs(out);
  expect(drawn, `the page drew ${drawn.length} of the 4 photographs the doc carries`).toHaveLength(4);
  // ORDER, not membership: the buy box takes `media[0]`, so a list that merely CONTAINS the bag is not the
  // same page. This is the assertion `planMediaList` in the seed exists to keep true from the other side.
  expect(drawn[0]).toContain('coffee-0.png');
  expect(drawn.slice(1)).toEqual([
    expect.stringContaining('coffee-1.png'),
    expect.stringContaining('coffee-2.png'),
    expect.stringContaining('coffee-3.png'),
  ]);
});

test('★ ABSENT, not empty: one photograph draws the bag and NO story grid', () => {
  // The state every coffee was in before 2026-09-02 20:18 UTC, and the one the header promises degrades
  // cleanly. The failure this guards is the opposite of a missing photo: three reserved frames with nothing
  // in them, which is what a grid rendered from a fixed count would give.
  const out = html(photos(1));
  expect(srcs(out)).toHaveLength(1);
  expect(out).not.toContain('galleryWide');
  expect(out).not.toContain('gallerySquare');
});

test('★ the grid grows with the data — two and three photographs each draw all of themselves', () => {
  // A page whose gallery is written for exactly four is a page that breaks the day a merchant uploads three.
  expect(srcs(html(photos(2)))).toHaveLength(2);
  expect(srcs(html(photos(3)))).toHaveLength(3);
});

test('★★ a NON-image media ref is not counted as a photograph — the split is by kind, then by position', () => {
  // The story grid draws `media[1..]`. If a document or an external video were left in that list it would be
  // rendered as a picture (a broken frame), and it would also PUSH a real photograph out of the bag slot when
  // it sorted first. `imagesOf` is what prevents both; this is the test that says so.
  const mixed: MediaRef[] = [
    ...photos(2),
    { provider_key: 'cdn/spec.pdf', kind: 'document', role: 'Ficha técnica', position: 2, url: 'https://media.test/cdn/spec.pdf' },
    { provider_key: 'https://youtu.be/x', kind: 'video_external', role: null, position: 3, url: 'https://youtu.be/x' },
  ];
  const drawn = srcs(html(mixed));
  expect(drawn).toHaveLength(2);
  expect(drawn.join(' ')).not.toContain('spec.pdf');
  expect(drawn.join(' ')).not.toContain('youtu.be');
});

test('a product with no photograph at all renders — a dataset error must not be a blank page', () => {
  const out = html([]);
  expect(srcs(out)).toHaveLength(0);
  expect(out).toContain('Forge Alvorada');
});
