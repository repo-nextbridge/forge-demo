// The home, rendered against data that is DELIBERATELY UNEVEN — which is the only interesting state.
//
// The catalogue this shop ships with has a coffee with an SCA score and four without, a coffee sold in one
// size and others in six, and (today) no reviews at all. A page asserted against the fullest product looks
// correct in review and breaks on the seventh coffee somebody adds.

import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { WallReview } from '@/lib/coffee/reviews-view';
import { HomeCoffee } from './HomeCoffee';

const EMPTY_SLOTS = {
  hero: null,
  bannerStrip: null,
  belowShelf: null,
  belowCategories: null,
  belowBrands: null,
};

const product = (over: Partial<ProductDoc> = {}): ProductDoc => ({
  product_id: 'prod_1',
  title: 'Forge Alvorada',
  description: null,
  handle: 'forge-alvorada',
  status: 'active',
  metadata: {},
  options: [],
  skus: [
    {
      id: 'sku_1',
      code: 'ALV',
      amount: 4290,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [],
      media: [],
    },
  ],
  categories: [],
  media: [],
  ...over,
});

const draw = (over: Partial<Parameters<typeof HomeCoffee>[0]> = {}) =>
  render(
    <HomeCoffee
      base="/s/cafe"
      products={[product()]}
      reviews={[]}
      rating={null}
      slots={EMPTY_SLOTS}
      {...over}
    />,
  );

describe('the card says only what the merchant filled in', () => {
  test('a coffee WITH an SCA score wears the badge', () => {
    draw({ products: [product({ metadata: { sca: '86' } })] });
    expect(screen.getByText('SCA 86')).toBeTruthy();
  });

  test('★ a coffee WITHOUT one wears no badge — and no dash, and no empty box', () => {
    const { container } = draw({ products: [product({ metadata: {} })] });
    // ⚠️ ANCHORED. A bare /SCA/ matches the hero's own manifesto copy ("…e pontuação SCA — tudo à vista"),
    // so the loose version of this assertion FAILED against a correct page — and would equally have PASSED
    // against a broken one on a page whose copy did not happen to contain the word.
    expect(screen.queryByText(/^SCA\s/)).toBeNull();
    // The stronger half: not merely "the text is absent" but "the element is not there". A rule written as
    // `SCA {sca}` renders the label with nothing after it, which passes a text query for the number and
    // still puts a naked "SCA" on the card.
    expect(container.querySelector('[class*="cardSca"]')).toBeNull();
  });

  test('a coffee with no notes draws no chip row', () => {
    const { container } = draw({ products: [product({ metadata: {} })] });
    expect(container.querySelector('[class*="notes"]')).toBeNull();
  });

  test('the card links to the PDP under the store base', () => {
    draw();
    expect(screen.getByRole('link', { name: /Forge Alvorada/ }).getAttribute('href')).toBe(
      '/s/cafe/p/forge-alvorada',
    );
  });
});

describe('★ the review wall is ABSENT when there is nothing to show, not empty', () => {
  test('no reviews: the section, its heading and its rating line are all gone', () => {
    draw({ reviews: [] });
    // A shop with no reviews must not advertise the absence: a heading over no cards is worse than no
    // section, and a rating line would be a number nobody gave.
    expect(screen.queryByText('Quem provou, voltou.')).toBeNull();
    expect(screen.queryByText(/de 5 ·/)).toBeNull();
  });

  test('with reviews, the wall draws and the rating line prints what was actually given', () => {
    const reviews: WallReview[] = [
      {
        id: 'rev_1',
        body: 'Chega sempre com data de torra da semana.',
        author: 'Marina S.',
        initials: 'MS',
        stars: 5,
        productTitle: 'Alvorada',
        verified: true,
      },
    ];
    draw({ reviews, rating: { average: 4.9, count: 1284 } });
    expect(screen.getByText('Quem provou, voltou.')).toBeTruthy();
    expect(screen.getByText('Chega sempre com data de torra da semana.')).toBeTruthy();
    // The product name is a JOIN this page does — the app serves `product_id` and nothing else.
    expect(screen.getByText(/Marina S\. · Alvorada/)).toBeTruthy();
    expect(screen.getByText(/4,9 de 5 · 1\.284 avaliações/)).toBeTruthy();
  });

  test('a review whose author gave no stars draws no dots rather than five or zero', () => {
    const reviews: WallReview[] = [
      { id: 'r', body: 'Bom.', author: 'Ana L.', initials: 'AL', stars: null, verified: false },
    ];
    const { container } = draw({ reviews, rating: { average: 5, count: 1 } });
    expect(container.querySelector('[class*="reviewDot"]')).toBeNull();
  });
});

describe('the page is the catalogue — there is no PLP behind it', () => {
  test('every coffee the read returned is drawn, not a fixed six', () => {
    const products = Array.from({ length: 7 }, (_, i) =>
      product({ product_id: `p${i}`, handle: `cafe-${i}`, title: `Café ${i}` }),
    );
    draw({ products });
    for (let i = 0; i < 7; i += 1) expect(screen.getByText(`Café ${i}`)).toBeTruthy();
  });

  test('an empty catalogue renders the page rather than throwing (the hero has no bag to float)', () => {
    expect(() => draw({ products: [] })).not.toThrow();
    // The headline is split by a <br>, so it is read off the heading rather than matched as one string.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Cafés que conectam');
  });
});

// ★★ A43 — THE HERO'S HEADLINE IS TWO LINES, AND THE GUARD IS THE MEASUREMENT RATHER THAN THE WORDS.
//
// The reported defect was "the hero says three lines". It was never the break that was wrong — the markup has
// authored two since the fork was cut — it was the SECOND one being 24 characters ("quem plantou a quem bebe")
// against a display that clamps to 88px, so it wrapped again on its own. Renan chose the replacement pair.
//
// ⚠️ SO THE ASSERTION IS THE LENGTH, NOT THE SENTENCE. A test that pinned the exact copy would be a
// transcription: it would go red on a wording change that is perfectly fine and stay green on the day
// somebody writes a fine-sounding 26-character second line, which is the failure that actually happened. The
// ceiling is the one the slice measured — ~18 characters is what fits the display at this size — and the
// chosen pair is 18/14, so the limit has no slack invented into it.
describe('A43 · the hero headline holds its two lines', () => {
  const headlineLines = () => {
    const h1 = screen.getByRole('heading', { level: 1 });
    // The break is authored as a <br>, so the browser's two lines are two text nodes here.
    return h1.innerHTML
      .split(/<br\s*\/?>/i)
      .map((part) => part.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim())
      .filter((part) => part.length > 0);
  };

  test('it is exactly two authored lines', () => {
    draw();
    expect(headlineLines()).toHaveLength(2);
  });

  test('★ neither line exceeds the width the display can hold — the defect was a line, not a break', () => {
    draw();
    const tooLong = headlineLines().filter((line) => line.length > 18);
    expect(
      tooLong,
      tooLong.length === 0
        ? ''
        : `these headline line(s) are longer than the 18 characters the display fits at ` +
          `clamp(34px, 6.4vw, 88px): ${tooLong.map((l) => `"${l}" (${l.length})`).join(', ')}.\n` +
          `  A line over the ceiling WRAPS, and a two-line hero renders as three — which is what was reported.\n` +
          `  Fix the copy, not this number: the ceiling is a property of the type scale.`,
    ).toEqual([]);
  });

  test('and it still names what the shop sells — the eyebrow and the lede do not say it for it', () => {
    draw();
    expect(headlineLines()[0]).toContain('Cafés');
  });
});

// ★★ A50 — "PLACEHOLDER RECONHECÍVEL > AUSÊNCIA", ON THE ONE PHOTOGRAPH THIS PAGE IS BUILT AROUND.
//
// The hero's right column is a single product photograph and used to be behind `heroMedia ? … : null`. With no
// cover photo it rendered NOTHING — and a hero with one column looks like a hero that was designed with one.
// That is the failure the rule is about: while this is a pre-Seed, an absence that reads as a decision is how
// a missing asset survives to the Seed. The kit's own `MediaImage` already draws a box carrying the NAME of
// the image it replaces; the ternary was intercepting it.
describe('A50 · the hero names the photograph it does not have', () => {
  test('★ a coffee with no cover renders a placeholder that says WHICH coffee is missing its photo', () => {
    const { container } = draw({ products: [product({ title: 'Forge Alvorada', media: [] })] });
    const hero = container.querySelector('section#top');
    expect(hero, 'no hero section — this guard is arguing about a section that moved').not.toBeNull();
    const stand_in = hero?.querySelector('[role="img"]');
    expect(
      stand_in,
      'the hero has neither a photograph nor anything standing in for one. An empty column is ' +
        'indistinguishable from a one-column design, which is exactly what A50 forbids while we are still ' +
        'finding out which assets have to be made.',
    ).not.toBeNull();
    // The name, not an English "no image" a screen reader would read out to a Portuguese shopper.
    expect(stand_in?.getAttribute('aria-label')).toBe('Forge Alvorada');
  });

  test('★ …and a hole with no name to give is not announced at all', () => {
    // No catalogue: there is no coffee to name, so a labelled box would be inventing an announcement.
    const { container } = draw({ products: [] });
    const hero = container.querySelector('section#top');
    expect(hero?.querySelector('[role="img"]')).toBeNull();
    expect(hero?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
