// The shared paginated walk. Geometry only — how many requests, in what order, how much overlap. Never time:
// a wall-clock assertion on a box running eight agents measures the queue, not the code.

import { expect, test, vi } from 'vitest';
import { CONCURRENCY, collectAllParallel, PAGE } from './collect-pages';

const list = <T>(
  items: T[],
  over: Partial<{ page: number; limit: number; total: number }> = {},
) => ({
  items,
  page: 1,
  limit: PAGE,
  total: items.length,
  ...over,
});

const rows = (n: number, tag = 'x') => Array.from({ length: n }, (_, i) => `${tag}${i}`);

test('★ pages after the first OVERLAP — the serial walk is what cost the sitemap seconds', async () => {
  let inFlight = 0;
  let peak = 0;
  const fetchPage = vi.fn(async (page: number) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return list(rows(PAGE, `p${page}_`), { page, total: 500 });
  });

  const out = await collectAllParallel(fetchPage);

  expect(out.items).toHaveLength(500);
  expect(fetchPage).toHaveBeenCalledTimes(5); // 500 / PAGE
  expect(peak, 'pages after the first must be in flight together').toBeGreaterThan(1);
});

test('the first page is ALONE — `total` is a dependency, so it cannot ride in a batch', async () => {
  const seen: number[][] = [];
  let inFlight: number[] = [];
  const fetchPage = vi.fn(async (page: number) => {
    inFlight.push(page);
    await new Promise((r) => setTimeout(r, 5));
    seen.push([...inFlight]);
    inFlight = inFlight.filter((p) => p !== page);
    return list(rows(PAGE), { page, total: 300 });
  });

  await collectAllParallel(fetchPage);
  expect(seen[0], 'page 1 must resolve before any other is asked for').toEqual([1]);
});

test('concurrency is BOUNDED — a 10k catalog does not open a socket per page', async () => {
  let inFlight = 0;
  let peak = 0;
  const fetchPage = vi.fn(async (page: number) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
    return list(rows(PAGE), { page, total: PAGE * 40 });
  });

  await collectAllParallel(fetchPage);
  expect(peak).toBeLessThanOrEqual(CONCURRENCY);
});

// ---- ★ the page size is the PORT's, not ours ------------------------------------------------------

test('★ the page count divides by the page the PORT served, not by our PAGE constant', async () => {
  // `read.pages.published` is walked with NO `limit`, so the port applies its own default (24). Dividing 30 by
  // our 100 computes ONE page and drops the tail in silence — which is exactly the bug this guards.
  const fetchPage = vi.fn(async (page: number) =>
    list(rows(page === 1 ? 24 : 6, `page${page}_`), { page, limit: 24, total: 30 }),
  );

  const out = await collectAllParallel(fetchPage);

  expect(fetchPage).toHaveBeenCalledTimes(2);
  expect(out.items).toHaveLength(30);
  expect(out.complete).toBe(true);
});

test('a port that omits `limit` still cannot divide by zero', async () => {
  const fetchPage = vi.fn(async (page: number) => ({
    items: rows(10, `p${page}_`),
    page,
    limit: 0,
    total: 30,
  }));

  const out = await collectAllParallel(fetchPage);
  expect(fetchPage).toHaveBeenCalledTimes(3); // 30 / 10 served
  expect(out.items).toHaveLength(30);
});

// ---- completeness: the caller has to be able to tell -----------------------------------------------

test('★ a page that fails makes the walk INCOMPLETE — silence is what the caller must not get', async () => {
  const fetchPage = vi.fn(async (page: number) =>
    page === 3 ? null : list(rows(PAGE), { page, total: 500 }),
  );

  const out = await collectAllParallel(fetchPage);

  expect(out.complete).toBe(false);
  expect(out.total).toBe(500);
  expect(out.items).toHaveLength(400); // what it DID get is still returned
});

test('a null first page is an empty, incomplete walk — never a throw', async () => {
  const out = await collectAllParallel(async () => null);
  expect(out).toEqual({ items: [], total: 0, complete: false, stop: { kind: 'no_answer' } });
});

test('a store with nothing in it is COMPLETE — empty is an answer, not a failure', async () => {
  const out = await collectAllParallel(async (page) => list([], { page, total: 0 }));
  expect(out).toEqual({ items: [], total: 0, complete: true });
});

// ---- ★★ B2: the backstop is counted in ITEMS, and every stop NAMES itself -------------------------
//
// ★ THE DEFECT IT REPLACES. The backstop was `MAX_PAGES = 100` — 100 pages of 100 is 10.000 items — with a
// `PATHS_MAX_PAGES = 10` over it for the 10× wider paths page, so the sitemap's catalog stopped dead at 10.000
// products and the caller published a shorter store than the merchant has. A constant in REQUESTS was never
// what guaranteed termination; the port's own answers are, and they cost nothing on a healthy catalog.

test('★ a `total` past the caller ceiling is CUT, and the cut carries both numbers', async () => {
  const fetchPage = vi.fn(async (page: number) =>
    list(rows(PAGE, `p${page}_`), { page, total: 5_000 }),
  );

  const out = await collectAllParallel(fetchPage, { maxItems: 1_000 });

  expect(out.items).toHaveLength(1_000);
  expect(out.complete).toBe(false);
  expect(out.stop, 'a cut that does not say what it dropped is a silent truncation').toEqual({
    kind: 'cut',
    declared: 5_000,
    fits: 1_000,
  });
  // 1.000 / 100 = 10 pages asked for, not the 50 the port declared: the ceiling bounds the WALK too.
  expect(fetchPage).toHaveBeenCalledTimes(10);
});

test('★ a catalog under the ceiling is untouched by it — the cut is an exception, not a policy', async () => {
  const fetchPage = vi.fn(async (page: number) =>
    list(rows(PAGE, `p${page}_`), { page, total: 500 }),
  );

  const out = await collectAllParallel(fetchPage, { maxItems: 50_000 });

  expect(out).toMatchObject({ total: 500, complete: true });
  expect(out.items).toHaveLength(500);
  expect(out.stop).toBeUndefined();
});

test('★ a port that reports a `total` it never delivers is stopped by the SHORT PAGE, in one call', async () => {
  // A billion is a safe integer, so no sanity check catches it. What catches it is that the port answered 1 row
  // for a page it says holds 100: a page under the port's own `limit` is the last page, and there is nothing to
  // ask for after it. This is the backstop the 100-page constant used to be, at 1 request instead of 100.
  const fetchPage = vi.fn(async (page: number) => list(rows(1), { page, total: 999_999 }));

  const out = await collectAllParallel(fetchPage);

  expect(fetchPage).toHaveBeenCalledTimes(1);
  expect(out.complete).toBe(false); // it never delivered what it promised, and it says so
  expect(out.stop).toEqual({ kind: 'short', declared: 999_999, collected: 1 });
});

test('★ a `total` that is not a count is refused on the FIRST answer — never divided into a loop', async () => {
  for (const total of [Number.POSITIVE_INFINITY, Number.NaN, -1, 1e30]) {
    const fetchPage = vi.fn(async (page: number) => list(rows(PAGE), { page, total }));
    const out = await collectAllParallel(fetchPage);
    expect(fetchPage, `total=${total} must cost exactly one request`).toHaveBeenCalledTimes(1);
    expect(out.stop).toEqual({ kind: 'unusable_total', declared: total });
  }
});

test('★ a page that answers NULL is a HOLE, not an end — the walk keeps its remaining pages', async () => {
  // The difference matters: a short page is EVIDENCE about what comes after it, a failed request is not. If a
  // null ended the walk, one hiccup on page 2 would silently drop pages 3..5 and the caller would be told the
  // catalog is 100 items long.
  const fetchPage = vi.fn(async (page: number) =>
    page === 2 ? null : list(rows(PAGE, `p${page}_`), { page, total: 500 }),
  );

  const out = await collectAllParallel(fetchPage);

  expect(fetchPage).toHaveBeenCalledTimes(5); // every page the answer implied was still asked for
  expect(out.items).toHaveLength(400);
  expect(out.stop).toEqual({ kind: 'short', declared: 500, collected: 400 });
});

test('★ `stop` is present exactly when the walk is INCOMPLETE — the pair cannot drift', async () => {
  const whole = await collectAllParallel(async (page) => list(rows(10), { page, total: 10 }));
  expect(whole.complete).toBe(true);
  expect(whole.stop).toBeUndefined();

  const shortWalk = await collectAllParallel(async (page) => list(rows(1), { page, total: 10 }));
  expect(shortWalk.complete).toBe(false);
  expect(shortWalk.stop).toBeDefined();
});
