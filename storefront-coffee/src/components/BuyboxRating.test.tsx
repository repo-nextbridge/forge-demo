// S7-SF-PDP — the buybox rating line reveals stars + "Ler N avaliações" ONLY when the reviews extension publishes
// an aggregate over the neutral channel (a CustomEvent / a global). No publish → the line stays empty (reserved,
// no hole). The anchor scrolls to the reviews section.
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { PDP_RATING_EVENT, PDP_RATING_GLOBAL } from '@/lib/pdp-rating';
import { BuyboxRating } from './BuyboxRating';

afterEach(() => {
  cleanup();
  (window as unknown as Record<string, unknown>)[PDP_RATING_GLOBAL] = undefined;
});

function publish(average: number, count: number) {
  act(() => {
    window.dispatchEvent(new CustomEvent(PDP_RATING_EVENT, { detail: { average, count } }));
  });
}

test('no rating published → the line renders but is EMPTY (reserved, no stars, no hole)', () => {
  const { getByTestId, queryByTestId } = render(<BuyboxRating />);
  expect(getByTestId('buybox-rating')).toBeTruthy(); // the row is always present (reserved height)
  expect(queryByTestId('buybox-rating-link')).toBeNull(); // but nothing inside it
});

test('a published aggregate reveals the stars + "Ler N avaliações", anchored to the reviews section', () => {
  const { getByTestId } = render(<BuyboxRating />);
  publish(4.7, 128);
  const link = getByTestId('buybox-rating-link');
  expect(link.getAttribute('href')).toBe('#avaliacoes');
  expect(link.textContent).toContain('4,7');
  expect(link.textContent).toContain('Ler 128 avaliações');
});

test('the stars are the canonical SVG glyph (not a unicode ★) — a gray row + a clipped gold overlay', () => {
  const { getByTestId } = render(<BuyboxRating />);
  publish(4.7, 128);
  const link = getByTestId('buybox-rating-link');
  // 5 base stars + 5 in the fractional-fill overlay = 10 canonical <Star> SVGs; zero unicode glyphs.
  expect(link.querySelectorAll('svg').length).toBe(10);
  expect(link.textContent).not.toContain('★');
  expect(link.textContent).not.toContain('☆');
});

test('a rating already published BEFORE the buybox mounts is still picked up (mount-order safe)', () => {
  (window as unknown as Record<string, unknown>)[PDP_RATING_GLOBAL] = { average: 5, count: 1 };
  const { getByTestId } = render(<BuyboxRating />);
  const link = getByTestId('buybox-rating-link');
  expect(link.textContent).toContain('Ler 1 avaliação'); // singular
});

test('clicking the anchor scrolls to the reviews section when present', () => {
  const section = document.createElement('section');
  section.id = 'avaliacoes';
  let scrolled = false;
  section.scrollIntoView = () => {
    scrolled = true;
  };
  document.body.appendChild(section);

  const { getByTestId } = render(<BuyboxRating />);
  publish(4.0, 10);
  fireEvent.click(getByTestId('buybox-rating-link'));
  expect(scrolled).toBe(true);

  document.body.removeChild(section);
});
