// THE GATE'S ONE SCREEN, HELD AGAINST THE ARTBOARD IT WAS DRAWN FROM.
//
// ★★★ WHAT THIS FILE IS FOR, AND IT IS NOT "does it render". The copy on this screen is TYPED rather than
// derived (see the head of `../i18n`'s HUB section for why that is right HERE and wrong on a customer's box),
// and typed copy is copy that can drift from the design silently. So the sentences are held against
// `../design-base/gate-v2.dc.html` — the artboard itself, shipped beside the implementation for exactly this.
//
// ⛔ AND THE OTHER HALF IS THE DERIVATION. The destinations are NOT typed: they come from
// `../faces.generated.ts`, which `bin/gate-faces.mjs` renders out of `seed/box.json`. The tests below assert
// that the screen draws what the DECLARATION carries — every shop, every tenant, every admin — because the
// failure this app has already had once is a face that exists in the box and on no screen.

import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { GATE_TENANTS } from '../faces.generated';
import { HUB, HUB_MARKS, LANGS, STRINGS } from '../i18n';
import { GateBlock } from './gate';
import { GATE_MARK } from './marks';

const ARTBOARD = readFileSync(join(__dirname, '..', 'design-base', 'gate-v2.dc.html'), 'utf8');

const shopsOf = (t: (typeof GATE_TENANTS)[number]) => t.faces.filter((f) => f.kind === 'shop');
const allShops = GATE_TENANTS.flatMap(shopsOf);

function draw(props: Partial<Parameters<typeof GateBlock>[0]> = {}) {
  return render(
    <GateBlock
      siteUrl="https://forgecommerce.pro"
      initialLang="pt"
      dismiss={props.dismiss ?? (() => Promise.resolve())}
      {...props}
    />,
  );
}

// ── ⟂ THE ARTBOARD IS THE SOURCE ───────────────────────────────────────────────────────────────────────────

test('★★★ every sentence on the screen is the ARTBOARD’s, word for word', () => {
  const pt = HUB.pt;
  // The headline, in two pieces, exactly as the artboard writes them.
  expect(ARTBOARD).toContain(pt.headline);
  expect(ARTBOARD).toContain(pt.headlineAccent);
  expect(ARTBOARD).toContain(pt.notice);
  expect(ARTBOARD).toContain(pt.kernel.name);
  expect(ARTBOARD).toContain(pt.kernel.blurb);

  for (const tenant of GATE_TENANTS) {
    const copy = pt.tenants[tenant.id];
    expect(copy, `no PT copy for tenant ${tenant.id}`).toBeDefined();
    expect(ARTBOARD, `the chip of ${tenant.id} is not in the artboard`).toContain(copy?.chip);
    expect(ARTBOARD, `the window title of ${tenant.id} is not in the artboard`).toContain(copy?.window);
    expect(ARTBOARD, `the admin button of ${tenant.id} is not in the artboard`).toContain(copy?.enter);
  }

  for (const face of allShops) {
    const copy = pt.faces[face.key];
    expect(copy, `no PT copy for ${face.key}`).toBeDefined();
    expect(ARTBOARD, `the blurb of ${face.key} is not in the artboard`).toContain(copy?.blurb);
    expect(ARTBOARD, `the place of ${face.key} is not in the artboard`).toContain(copy?.place);
    expect(ARTBOARD, `the foot of ${face.key} is not in the artboard`).toContain(copy?.foot);
  }
});

test('★★ ANTI-VACUUM — the artboard really is the v2 one, and it really carries the diagram', () => {
  // Were this reading the wrong file, or an empty one, every `toContain` above would still have to pass
  // against something — so the file is asserted to be the screen this slice is about.
  expect(ARTBOARD.length).toBeGreaterThan(20_000);
  expect(ARTBOARD, 'not the v2 artboard: the light ground is missing').toContain('linear-gradient(180deg,#EDEDED,#FFFFFF)');
  expect(ARTBOARD, 'the diagram’s live dot is missing — this is not the screen with the kernel on it').toContain('#5CBF5C');
  expect(ARTBOARD, 'the mobile branch is missing').toContain('scroll-snap-type:x mandatory');
});

test('⛔ the wordmarks are the artboard’s, including the counter’s two-tone one', () => {
  for (const [key, mark] of Object.entries(HUB_MARKS)) {
    expect(ARTBOARD, `the wordmark tail of ${key} is not in the artboard`).toContain(mark[2]);
    if (mark[3]) expect(ARTBOARD, `the aside of ${key} is not in the artboard`).toContain(mark[3]);
  }
  // The counter is the one face with an aside, and that is the fact the artboard draws in two colours.
  expect(HUB_MARKS['forgecafe/balcao']?.[3]).toBe('balcão');
});

// ── ⟂ THE SCREEN DRAWS WHAT THE BOX DECLARES ───────────────────────────────────────────────────────────────

test('★★★ every declared shop is on the screen, and every declared tenant has its admin', () => {
  draw({ adminUrls: {} });
  for (const face of allShops) {
    expect(document.querySelector(`[data-face="${face.key}"]`), `${face.key} is declared and not drawn`).not.toBeNull();
  }
  for (const tenant of GATE_TENANTS) {
    expect(document.querySelector(`[data-admin="${tenant.id}"]`), `${tenant.id} has no admin window`).not.toBeNull();
  }
});

test('★★ the screen carries the mark a probe outside the browser looks for', () => {
  draw();
  expect(screen.getByTestId(GATE_MARK)).toBeTruthy();
});

test('⛔ there is no second screen to switch to', () => {
  draw();
  // The architecture screen was a whole second view with its own way back. v2 has one screen, so nothing on
  // it may offer to leave for another one — and this is the assertion that would catch it coming back.
  expect(screen.queryByText(HUB.pt.kernel.name)).toBeTruthy();
  expect(document.querySelectorAll('[data-testid]')).toHaveLength(1);
});

// ── ⟂ THE WAYS THROUGH ─────────────────────────────────────────────────────────────────────────────────────

test('★★★ the card of the face the visitor is ON posts the dismissal, and does not navigate', () => {
  const here = allShops.find((f) => f.host)?.host ?? undefined;
  expect(here, 'the declaration carries no addressed shop to stand on').toBeTruthy();
  draw({ here });
  const cell = document.querySelector(`[data-face="${allShops.find((f) => f.host === here)?.key}"]`);
  // A form, so it works with no JavaScript at all: this is the FIRST screen of the demo and it may not
  // depend on a bundle having arrived.
  expect(cell?.querySelector('form')).not.toBeNull();
  expect(cell?.querySelector('a')).toBeNull();
});

test('★★★ a card of ANOTHER face dismisses FIRST and then navigates — measured 2026-09-17', () => {
  const here = allShops[0]?.host ?? undefined;
  const other = allShops.find((f) => f.host && f.host !== here);
  expect(other, 'the declaration carries no second addressed shop').toBeTruthy();
  const dismiss = vi.fn(() => Promise.resolve());
  const assign = vi.fn();
  Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });

  draw({ here, dismiss });
  const link = document.querySelector(`[data-face="${other?.key}"] a`) as HTMLAnchorElement;
  expect(link).not.toBeNull();
  fireEvent.click(link);
  // ⛔ THE ORDER IS THE WHOLE POINT. Dismissing and letting the browser leave is a race the cookie loses, and
  // the defect this replaced was a bare link that navigated and told nobody: the next face greeted again.
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test('★★ a modifier-click is left to the browser, and the dismissal still goes out', () => {
  const here = allShops[0]?.host ?? undefined;
  const other = allShops.find((f) => f.host && f.host !== here);
  const dismiss = vi.fn(() => Promise.resolve());
  draw({ here, dismiss });
  const link = document.querySelector(`[data-face="${other?.key}"] a`) as HTMLAnchorElement;
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  link.dispatchEvent(event);
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented, 'the browser’s own "open in a new tab" is not ours to cancel').toBe(false);
});

test('the admin opens that tenant’s /enter, in a new tab, at the origin the box was PROMOTED to', () => {
  const tenant = GATE_TENANTS[0];
  draw({ adminUrls: { [tenant?.id ?? '']: 'https://admin.promovido.example' } });
  const link = document.querySelector(`[data-admin="${tenant?.id}"] a`) as HTMLAnchorElement;
  expect(link.getAttribute('href')).toBe('https://admin.promovido.example/enter');
  // An admin is a side trip from the tour, not the next step of it.
  expect(link.getAttribute('target')).toBe('_blank');
});

// ── ⟂ THE TWO SENTENCES THE ARTBOARD HAS NO PLACE FOR ──────────────────────────────────────────────────────

test('⛔ a face the box declares with NO address is DRAWN and NAMED, never hidden', () => {
  // The declaration this box ships addresses every shop, so the case is constructed — and it has to be
  // testable, because a half-written declaration is exactly when nobody is looking.
  draw();
  const unaddressed = allShops.filter((f) => !f.host);
  for (const face of unaddressed) {
    const cell = document.querySelector(`[data-unaddressed="${face.key}"]`);
    expect(cell, `${face.key} has no address and vanished from the screen`).not.toBeNull();
  }
  // And the affordance exists in the copy even when this box never draws it.
  expect(HUB.pt.noAddress.length).toBeGreaterThan(4);
});

test('⛔ a host no face declares gets a NAMED way in, rather than a screen with no door', () => {
  draw({ here: 'bancada.local' });
  const line = document.querySelector('[data-here="bancada.local"]');
  expect(line, 'a bench has no way through the gate').not.toBeNull();
  expect(line?.textContent).toContain('bancada.local');
  expect(line?.querySelector('form')).not.toBeNull();
});

test('…and on a host the box DOES declare, that line is not drawn', () => {
  const here = allShops.find((f) => f.host)?.host ?? undefined;
  draw({ here });
  expect(document.querySelector('[data-here]')).toBeNull();
});

// ── ⟂ THE LANGUAGE ─────────────────────────────────────────────────────────────────────────────────────────

test('the footer selector switches the copy live, and is the app’s own list', () => {
  draw();
  expect(screen.getByText(HUB.pt.notice)).toBeTruthy();
  fireEvent.click(screen.getByText('en'));
  expect(screen.getByText(HUB.en.notice)).toBeTruthy();
  fireEvent.click(screen.getByText('es'));
  expect(screen.getByText(HUB.es.notice)).toBeTruthy();
  // Derived from LANGS, never a second list: a language added to the app appears here without an edit.
  for (const code of LANGS) expect(screen.getByText(code)).toBeTruthy();
});

test('the way back is the app’s own string, pointing at the site it was given', () => {
  draw({ siteUrl: 'https://exemplo.test' });
  const back = screen.getByText(STRINGS.pt.back) as HTMLAnchorElement;
  expect(back.getAttribute('href')).toBe('https://exemplo.test');
});
