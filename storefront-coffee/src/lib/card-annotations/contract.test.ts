// THE POINT'S OWN TEST (F2) — two things, and the first one is not a runtime test at all.
//
// 1. THE SHAPE. `CardAnnotationsContribution` is what makes a wrong implementation a RED BUILD in the
//    storefront, so the shape itself has to be graded — and a type erases, so the grading has to happen at
//    typecheck time. Each `@ts-expect-error` below is a real assertion: `tsc` fails when the line it marks
//    STOPS erroring, so a contract that quietly widened (a stray `any`, an optional turned loose, a return
//    type softened to `Promise<unknown>`) turns every one of them into "unused '@ts-expect-error' directive"
//    and `pnpm typecheck` goes red. That is the negative control of the mechanism, kept permanently rather
//    than run once: this file must be able to prove refusal, or the design is unproven.
//
//    ⚠️ These cases are the app's real failure modes, written as the app would get them wrong: the export is
//    not a function, it is synchronous, it returns the wrong payload, or its parameters do not accept what
//    the aggregator passes.
//
// 2. ZERO CONTRIBUTORS. The state an instance is in when its list carries no contributing app — which is the
//    removability DoD stated as a unit test: the registry is `[]`, the aggregate is `{}`, and the card renders
//    with no annotation instead of breaking. `cardRatings.test.ts` covers 1..n; this covers 0, because a
//    module's mock is per-file and the two cannot live in one.

import { expect, test, vi } from 'vitest';
import type { CardAnnotation, CardAnnotations, CardAnnotationsContribution } from './contract';

vi.mock('@/lib/card-annotations/generated/registry', () => ({ composedCardAnnotations: [] }));

const { cardRatings } = await import('@/lib/cardRatings');

// ── 1. the shape (typecheck-time assertions) ───────────────────────────────────────────────────────────────

/** What a CONFORMING app exports — written the way `extensions/reviews/ratings.ts` writes it, with no import
 * of this contract anywhere in it. Structural typing is the whole mechanism: the app must not have to know
 * the consumer exists. */
const conforming = async (
  store: string,
  productIds?: readonly string[],
): Promise<Record<string, { average: number; count: number }>> => {
  if (!store) return {};
  const ids = productIds ?? ['prod_1'];
  return Object.fromEntries(ids.map((id) => [id, { average: 4.5, count: 3 }]));
};

test('★ a conforming export satisfies the point — structurally, with no import of the contract', () => {
  const accepted: CardAnnotationsContribution = conforming;
  expect(typeof accepted).toBe('function');
});

test('★ an app may ignore `productIds` — narrowing is an optimisation, not an obligation', () => {
  const wholeStore = async (_store: string): Promise<CardAnnotations> => ({});
  const accepted: CardAnnotationsContribution = wholeStore;
  expect(typeof accepted).toBe('function');
});

test('★★ THE REFUSALS — each line below must fail to compile, and `tsc` fails if one stops', () => {
  // Not a function at all: the app named a constant in `forge.wiring.contributions.export`.
  // @ts-expect-error a value is not a contribution
  const notAFunction: CardAnnotationsContribution = { average: 4.5, count: 3 };

  // Synchronous: the aggregator awaits every contributor, and a sync export cannot be one.
  // @ts-expect-error a contribution returns a Promise
  const sync: CardAnnotationsContribution = (_store: string) => ({});

  // The right container, the WRONG payload — the exact shape a rename inside the app produces.
  // @ts-expect-error `{ stars, total }` is not a CardAnnotation
  const wrongPayload: CardAnnotationsContribution = async (_store: string) => ({
    prod_1: { stars: 4.5, total: 3 },
  });

  // A payload missing half the annotation.
  // @ts-expect-error `count` is not optional
  const partialPayload: CardAnnotationsContribution = async (_store: string) => ({
    prod_1: { average: 4.5 },
  });

  // Not a batch: one product's annotation where a map of them belongs.
  // @ts-expect-error a contribution answers for the whole visible set, never one product
  const notABatch: CardAnnotationsContribution = async (_store: string) => ({
    average: 4.5,
    count: 3,
  });

  // A parameter the aggregator cannot satisfy: it passes a store id, never a number.
  // @ts-expect-error the store is a string
  const wrongParam: CardAnnotationsContribution = async (_store: number) => ({});

  expect([notAFunction, sync, wrongPayload, partialPayload, notABatch, wrongParam]).toHaveLength(6);
});

test('★ an annotation is exactly average + count — nothing else rides on the card', () => {
  const annotation: CardAnnotation = { average: 4.5, count: 3 };
  expect(Object.keys(annotation).sort()).toEqual(['average', 'count']);
});

// ── 2. zero contributors ───────────────────────────────────────────────────────────────────────────────────

test('★★ ZERO contributors → {} — the state an instance whose list carries no annotating app is in', async () => {
  // This is the removability DoD as a unit test: take `reviews` off the composition list and the generated
  // registry is `[]`. The aggregate must then be an empty map, which every card site already reads as "no
  // annotation" — not an error, not undefined, and nothing for a card to crash on.
  expect(await cardRatings('acme')).toEqual({});
});
