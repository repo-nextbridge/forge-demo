// ★★★ pk32/d3 — EVERY ERROR BOUNDARY OF THIS FORK IS *RENDERED* WITH A CEILING REFUSAL, AND GRADED ON ITS BODY.
//
// ── WHY A RENDER AND NOT A GREP ───────────────────────────────────────────────────────────────────────────
//
// Because the grep was already tried upstream and it went GREEN over the sabotage. pk31/p1's first version of
// this rule read the boundaries' SOURCE for the two kit functions; deleting the whole busy BRANCH from one of
// them left the IMPORT behind, and the rule passed. A guard an unused import satisfies asserts that somebody
// typed a name, not that the page behaves. So this file imports each boundary the sweep finds on disk and
// renders it — twice — and demands the two answers differ in the way that matters.
//
// ⛔ AND IT IS NOT A LIST. The boundaries come off `src/app/**/error.tsx`, so a route group added next month is
// graded the day it ships and one renamed stops existing rather than stops being watched. The anti-vacuum
// assertion below is what makes that honest: a sweep that found nothing would otherwise pass forever, which is
// exactly the state this fork was in until today (three `not-found.tsx`, zero `error.tsx`).
//
// ⚠️ WHAT IT DELIBERATELY DOES NOT GRADE: the copy. It asks for the WAIT SENTENCE, which is the kit's own string
// and the only line on the page that is a published fact rather than a choice of words. The café words the rest
// in its own voice on purpose ("Muita gente no café agora", "Buscar cafés"), and a guard reading that prose
// would be noise the first time somebody improves it.

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  ceilingRefusalDigest,
  ceilingWaitSentence,
} from '@forgecommerce/storefront-kit/ceiling-digest';
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const APP = join(import.meta.dirname, 'app');

/** Every `error.tsx` of this fork's route tree, as absolute paths. */
function errorBoundaries(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      errorBoundaries(full, out);
      continue;
    }
    if (entry.name === 'error.tsx') out.push(full);
  }
  return out;
}

/** Each boundary with the name a red should print. */
const allBoundaries = () =>
  errorBoundaries(APP)
    .map((file) => ({ where: relative(APP, file).split(sep).join('/'), file }))
    .sort((a, b) => a.where.localeCompare(b.where));

type Boundary = ComponentType<{ error: Error & { digest?: string }; reset: () => void }>;

/** A ceiling refusal exactly as the kit's read client builds one, and an ordinary failure with Next's digest. */
const refused = (retryAfter: string | null): Error & { digest?: string } =>
  Object.assign(new Error('read products failed: 429'), {
    digest: ceilingRefusalDigest(retryAfter),
  });
const broken = (): Error & { digest?: string } =>
  Object.assign(new Error('read products failed: 503'), { digest: '1928374655' });

// The store-scoped boundaries mount `ErrorWayOut`, which asks `/api/store` which store this request is
// about. That is the NETWORK and nothing else is stubbed: every branch, marker and word below is the real one.
// ⚠️ It must resolve rather than reject, because a rejected fetch inside an effect is a red about this harness.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ store: null }), { status: 200 })),
  );
});

test('★★★ every error boundary RENDERS a ceiling refusal as busy, with the wait the port published', async () => {
  const boundaries = allBoundaries();
  // ⛔ ANTI-VACUUM. Three route segments of this fork own a `not-found.tsx` — the store-less root, the cacheable
  // tree, the dynamic tree — and each one is a place a customer can land. A sweep that finds fewer than three
  // `error.tsx` is grading a subset and reporting clean, which is the state measured on 2026-09-10: zero.
  expect(
    boundaries.map((b) => b.where),
    'this fork has a dead end with no body. Every segment with a `not-found.tsx` needs the `error.tsx` beside ' +
      'it, or a throw there reaches the customer as Next’s white "Application error" — no chrome, no café, ' +
      'no Portuguese.',
  ).toEqual(['c/[store]/error.tsx', 'error.tsx', 's/[store]/(storefront)/error.tsx']);

  for (const { where, file } of boundaries) {
    const Boundary = ((await import(file)) as { default: Boundary }).default;

    const busy = render(<Boundary error={refused('40')} reset={() => {}} />);
    const busyHtml = busy.container.innerHTML;
    expect(
      busyHtml,
      `${where} does not say WHEN to come back. The port published \`Retry-After: 40\` and this page dropped ` +
        'it — which leaves the customer with the same "try again" they had when nobody knew anything.',
    ).toContain(ceilingWaitSentence(40));
    expect(
      busyHtml,
      `${where} prints the refusal digest at the customer. Here the digest is a WAIT, not a correlation id: ` +
        '"Código: forge.read.ceiling;40" teaches nobody anything.',
    ).not.toContain('forge.read.ceiling');
    busy.unmount();

    // …and with no Retry-After it says so instead of inventing a number the shop cannot keep.
    const vague = render(<Boundary error={refused(null)} reset={() => {}} />);
    expect(
      vague.container.innerHTML,
      `${where} invented a wait the port never published — a promise the shop cannot keep`,
    ).toContain(ceilingWaitSentence(null));
    vague.unmount();

    // ★ THE NEGATIVE CONTROL, PER BOUNDARY. A 503 is not "come back in a moment": sending a customer away for
    // a defect that will still be there is the same lie in the other direction. It must apologise AND keep the
    // code, which is the only thing on that page worth anything to whoever reads a screenshot.
    const down = render(<Boundary error={broken()} reset={() => {}} />);
    const downHtml = down.container.innerHTML;
    expect(
      downHtml,
      `${where} tells a customer the shop is merely busy when the port answered 503 — it is treating every ` +
        'failure as transient',
    ).not.toContain(ceilingWaitSentence(40));
    expect(
      downHtml,
      `${where} renders the same body for a ceiling refusal and for a broken port, so the branch it appears ` +
        'to have does nothing',
    ).not.toBe(busyHtml);
    expect(
      down.getByTestId('error-digest').textContent,
      `${where} swallowed the digest, so nobody reading a screenshot of this page can find the line in the log`,
    ).toContain('1928374655');
    down.unmount();
  }
});

test('★ the retry re-renders the refused segment — which, once the window rolls, is the whole fix', async () => {
  for (const { where, file } of allBoundaries()) {
    const Boundary = ((await import(file)) as { default: Boundary }).default;
    const reset = vi.fn();
    const busy = render(<Boundary error={refused('40')} reset={reset} />);
    busy.getByTestId('busy-retry').click();
    expect(reset, `${where} draws a retry that does nothing`).toHaveBeenCalledTimes(1);
    busy.unmount();
  }
});

// ★★ THE CHAIN, NOT A RE-IMPLEMENTATION OF IT: the refusal the KIT builds from a real 429 response reaches the
// real boundary and is understood. This is the half that proves the digest TRAVELS to this fork at all — the
// fork installs the kit from a tarball, so "the kit labels a 429" and "this fork sees the label" are two facts.
test('★★ a 429 from the port, labelled by the vendored kit, lands on the café’s busy body', async () => {
  const { ReadPortError } = await import('@forgecommerce/storefront-kit/read-client');
  const thrown = new ReadPortError('products', 429, '40') as Error & { digest?: string };
  expect(
    thrown.digest,
    'the vendored kit stopped labelling a ceiling refusal, so nothing downstream of it can tell busy from ' +
      'broken — re-vendor against a tree whose kit labels a ceiling refusal and publishes `./ceiling-digest`',
  ).toBe('forge.read.ceiling;40');

  const StoreError = (await import('./app/s/[store]/(storefront)/error')).default;
  const { getByTestId, container } = render(<StoreError error={thrown} reset={() => {}} />);
  getByTestId('busy-boundary');
  expect(getByTestId('busy-wait').textContent).toBe('Tente de novo em cerca de 40 segundos.');
  expect(container.innerHTML).not.toContain('Application error');
  expect(container.querySelector('[data-testid="error-boundary"]')).toBeNull();
});
