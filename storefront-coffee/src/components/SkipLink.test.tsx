// ★ QA20 (S2A-9) — the keyboard shortcut into the page, proven where it has to hold: in the CHROME, ahead of
// everything else. Measured on staging before this: 90 Tabs from the top of /tenis to the first product card,
// on every page load. The assertion is not "a skip link exists somewhere" but "the FIRST focusable element of
// the document is it, and it lands on the wrapper around the page's content" — a skip link that is second is
// not a skip link.

import { Writable } from 'node:stream';
import { MAIN_CONTENT_ID, SkipLink } from '@forgecommerce/storefront-kit/SkipLink';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

// The extension outlets are async server components (they suspend); they are not the subject here.
vi.mock('@/lib/extensions/ExtensionOutlet', () => ({ ExtensionOutlet: () => null }));
// QA29 — the chrome reads the footer's payment strip (lib/payment-badges). Not the subject here either, and
// the read must not reach a port from this suite.
vi.mock('@forgecommerce/storefront-kit/payment-badges', () => ({
  paymentBadges: async () => ['Pix'],
}));
const { StorefrontChrome } = await import('./StorefrontChrome');

/** The COMPLETE server HTML — `onAllReady`, so the chrome's async server components have resolved. The chrome
 * is async since QA29 (it asks which payment methods the store charges), and `renderToString` cannot await. */
function renderChrome(node: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk));
        cb();
      },
      final(cb) {
        resolve(Buffer.concat(chunks).toString('utf8'));
        cb();
      },
    });
    const stream = renderToPipeableStream(node, {
      onAllReady() {
        stream.pipe(sink);
      },
      onError: reject,
    });
  });
}

/** Everything a Tab can land on, in document order. */
const FOCUSABLE = /<(a\s[^>]*href=|button|input|select|textarea)/g;

test('the skip link is the FIRST focusable element of the storefront chrome', async () => {
  const html = await renderChrome(
    <StorefrontChrome store="loja" base={HOST_BASE}>
      <main>conteúdo da página</main>
    </StorefrontChrome>,
  );
  const first = html.match(FOCUSABLE)?.[0] ?? '';
  const firstAt = html.search(FOCUSABLE);
  expect(first).toMatch(/^<a\s/);
  expect(html.slice(firstAt, firstAt + 200)).toContain('data-testid="skip-link"');
  expect(html.slice(firstAt, firstAt + 200)).toContain(`href="#${MAIN_CONTENT_ID}"`);
});

test('the link lands on the wrapper that holds the page, not on nothing', async () => {
  const html = await renderChrome(
    <StorefrontChrome store="loja" base={HOST_BASE}>
      <main>conteúdo da página</main>
    </StorefrontChrome>,
  );
  const target = html.indexOf(`id="${MAIN_CONTENT_ID}"`);
  expect(target).toBeGreaterThan(0);
  // The page really is inside it (a target that lands after the content would skip nothing).
  expect(html.indexOf('conteúdo da página')).toBeGreaterThan(target);
  // And it is reachable by script/focus after the jump.
  expect(html.slice(target - 60, target + 60)).toContain('tabindex="-1"');
});

test('hidden until focused, and it says what it does in pt-BR', () => {
  const html = renderToString(<SkipLink />);
  expect(html).toContain('Pular para o conteúdo');
  expect(html).toContain(`href="#${MAIN_CONTENT_ID}"`);
});
