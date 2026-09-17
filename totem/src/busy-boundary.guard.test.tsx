// ★★★ pk32/d3 — THE COUNTER'S ERROR BOUNDARY IS *RENDERED*, AND THE WHOLE CHAIN BEHIND IT IS DRIVEN.
//
// ── WHY A RENDER AND NOT A GREP ───────────────────────────────────────────────────────────────────────────
//
// Because the grep was tried upstream and went GREEN over the sabotage: pk31/p1's first rule read the
// boundaries' SOURCE for the kit's two functions, and deleting the busy BRANCH left the IMPORT behind. A guard
// an unused import satisfies asserts that somebody typed a name, not that the screen behaves. So this imports
// the boundary off disk and renders it — busy, busy-with-no-number, and broken — and grades the BODY.
//
// ⛔ AND A STATUS PROVES NOTHING HERE. An App Router Server Component has no way to answer 429 (there is no
// `tooManyRequests()` beside `notFound()`), so the HTTP status is 500 in both worlds. What changes is what the
// glass SAYS, which is why the text is the subject.
//
// ★★ THE SECOND HALF IS THE CHAIN, AND IT IS THE ONE THAT MATTERS ON THIS FORK. `totemFetch` intercepts a 429
// before the kit can label it, so this counter's refusal is built by `PortRateLimited` and not by
// `ReadPortError` — which means "the kit labels a ceiling" says nothing about this screen. The test below drives
// the REAL `totemFetch` against a real 429 `Response` and hands what it threw to the REAL boundary.

import {
  ceilingRefusalDigest,
  ceilingWaitSentence,
  isCeilingRefusalDigest,
} from '@forgeco/storefront-kit/ceiling-digest';
import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import CounterError from './app/error';

/** A ceiling refusal the way a digest-carrying throw arrives, and an ordinary failure with Next's own digest. */
const refused = (retryAfter: string | null): Error & { digest?: string } =>
  Object.assign(new Error('read menu failed: 429'), { digest: ceilingRefusalDigest(retryAfter) });
const broken = (): Error & { digest?: string } =>
  Object.assign(new Error('read menu failed: 503'), { digest: '1928374655' });

test('★★★ a ceiling refusal renders the counter as BUSY, with the wait the port published', () => {
  const busy = render(<CounterError error={refused('40')} reset={() => {}} />);
  busy.getByTestId('busy-boundary');
  expect(
    busy.getByTestId('busy-wait').textContent,
    'the counter does not say WHEN to try again. The port published `Retry-After: 40` and this screen dropped ' +
      'it — on a kiosk that is the only actionable fact there is, because the person cannot go anywhere else.',
  ).toBe(ceilingWaitSentence(40));
  const html = busy.container.innerHTML;
  expect(html, 'Next’s own white page is what this file exists to replace').not.toContain(
    'Application error',
  );
  expect(html).not.toContain('Internal Server Error');
  // ⛔ The apology must NOT be on screen: a busy counter is not a broken one, and "chame um atendente" sends
  // somebody to the till for a queue that clears itself in forty seconds.
  expect(html).not.toContain('não conseguiu abrir');
  expect(
    html,
    'the refusal digest is a WAIT here, not a correlation id — printing it at a customer teaches nobody anything',
  ).not.toContain('forge.read.ceiling');
  expect(busy.container.querySelector('[data-testid="error-boundary"]')).toBeNull();
});

test('★ with no Retry-After the counter says so rather than inventing a number', () => {
  const vague = render(<CounterError error={refused(null)} reset={() => {}} />);
  expect(vague.getByTestId('busy-wait').textContent).toBe(ceilingWaitSentence(null));
});

test('⛔ THE NEGATIVE CONTROL: a 503 keeps the apology AND the code, and names the way out of a kiosk', () => {
  const down = render(<CounterError error={broken()} reset={() => {}} />);
  down.getByTestId('error-boundary');
  const html = down.container.innerHTML;
  expect(
    html,
    'the counter tells a customer to come back in a moment for a defect that will still be there',
  ).not.toContain(ceilingWaitSentence(40));
  expect(html, 'a screen that apologises without apologising').toContain('Desculpe');
  expect(
    down.getByTestId('error-digest').textContent,
    'the code is gone, so whoever is called to the counter has nothing to find in the log with',
  ).toContain('1928374655');
  expect(down.container.querySelector('[data-testid="busy-boundary"]')).toBeNull();
  // ★ A KIOSK'S WAY OUT IS A PERSON, and that is the one thing the vitrine's body cannot say for it.
  expect(html).toContain('atendente');
});

test('★ the retry re-renders the refused segment, which on a till is the whole fix', () => {
  const reset = vi.fn();
  const busy = render(<CounterError error={refused('40')} reset={reset} />);
  busy.getByTestId('busy-retry').click();
  expect(reset).toHaveBeenCalledTimes(1);
  const down = render(<CounterError error={broken()} reset={reset} />);
  down.getByTestId('error-retry').click();
  expect(reset).toHaveBeenCalledTimes(2);
});

// ★★★ THE CHAIN, NOT A RE-IMPLEMENTATION OF IT: the real `totemFetch`, a real 429 response, the real boundary.
//
// ⚠️ THIS IS THE TEST THAT WOULD HAVE CAUGHT THE GAP. Before `PortRateLimited` carried a digest, `totemFetch`
// threw a plain Error — and a plain Error reaching a boundary in production has lost its class, its name and
// its message. The counter would have apologised for a queue.
test('★★★ a 429 from the port, through the REAL totemFetch, reaches the counter as busy with the real number', async () => {
  const { PortRateLimited, totemFetch } = await import('@/lib/port');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"error":{"kind":"rate_limited"}}', {
      status: 429,
      headers: { 'retry-after': '37' },
    })),
  );

  const thrown = await totemFetch('http://kernel/v1/read/menu').then(
    () => {
      throw new Error('VACUOUS: a 429 response did not make totemFetch throw, so nothing below is about a 429');
    },
    (failure: Error & { digest?: string }) => failure,
  );
  expect(thrown).toBeInstanceOf(PortRateLimited);
  expect(
    isCeilingRefusalDigest(thrown.digest),
    'the counter’s own 429 interception produced a throw with no ceiling digest, so the boundary cannot tell ' +
      'a busy till from a dead kernel — see `lib/port.ts`, `PortRateLimited`',
  ).toBe(true);

  const { getByTestId } = render(<CounterError error={thrown} reset={() => {}} />);
  getByTestId('busy-boundary');
  expect(getByTestId('busy-wait').textContent).toBe(ceilingWaitSentence(37));
  vi.unstubAllGlobals();
});

test('★ and a 429 with NO Retry-After still carries the cap’s own declared window, not a blank', async () => {
  const { totemFetch } = await import('@/lib/port');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
  const thrown = await totemFetch('http://kernel/v1/read/menu').then(
    () => {
      throw new Error('VACUOUS: a 429 response did not make totemFetch throw');
    },
    (failure: Error & { digest?: string }) => failure,
  );
  // The oracle cap declares 60s and this counter has always reported that when the header is absent, so the
  // screen gets a figure rather than "em alguns instantes" — said out loud because it is a choice.
  const { getByTestId } = render(<CounterError error={thrown} reset={() => {}} />);
  expect(getByTestId('busy-wait').textContent).toBe(ceilingWaitSentence(60));
  vi.unstubAllGlobals();
});
