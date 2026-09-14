// The gate block's PAGE — the header row (wordmark, headline, lede), the foot (notice, language selector),
// the way back, and the switch into the architecture screen. jsdom smoke test; the visual fidelity is the human
// gate (screenshots vs design-base/gate.dc.html).
//
// ★ pk35/d1 — THE DESTINATIONS THEMSELVES ARE `hub.test.tsx`'s, not this file's. What used to be asserted here
// ("Abrir a loja", "Abrir o admin", the `/enter` href) was the two-card screen that PRECEDED the hub; those
// statements moved WITH the cards, and they are stronger there because they are held against `seed/box.json`
// instead of against strings. This file keeps what wraps the hub.
//
// ★★★ pk38/d7 — AND THE FIRST GROUP BELOW IS THE SLICE'S OWN RULE: THE HUB *IS* THE FIRST SCREEN. The hub was
// added to a hero instead of replacing it, so a test that only looked for the hub stayed green over both. Each
// assertion here names what must be GONE — the eyebrow, the "Loja demo." heading, the intro paragraph, the
// second frame, the "carry on in this window" button — beside what must be there. The same shape as the
// screen-switch test below, and for the same reason.
//
// ⚠️ AND THE LANGUAGE LIST IS NEVER TYPED: the per-language cases walk `LANGS` and take their expected words from
// `STRINGS`/`ARCH`/`HUB`.

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { GATE_FACES, GATE_TENANTS } from '../faces.generated';
import { ARCH, HUB, LANGS, STRINGS } from '../i18n';
import { GateBlock } from './gate';
import { hubTally } from './hub';

const noop = async () => {};
const tally = hubTally();
/** The heading's accessible name: the three clauses, as the browser reads one block per line. */
const headline = (lang: 'pt' | 'en' | 'es') =>
  HUB[lang].counts(tally.tenants, tally.shops, tally.admins).join(' ');

test('★★★ the first screen IS the hub — the hero it replaced is not drawn anywhere', () => {
  const { container } = render(
    <GateBlock
      siteUrl="https://forgecommerce.pro"
      adminUrl="https://admin.demo.example"
      initialLang="pt"
      dismiss={noop}
    />,
  );
  // What the design puts there: the wordmark, the count as the headline, the lede, the cards, the notice.
  expect(screen.getByRole('heading', { name: headline('pt') })).toBeTruthy();
  expect(screen.getByText(HUB.pt.notice)).toBeTruthy();
  expect(screen.getByText('← voltar para forgecommerce.pro')).toBeTruthy();
  expect(
    container.querySelectorAll('[data-face]').length,
    'the gate rendered no destination at all — the hub is not mounted',
  ).toBe(GATE_FACES.length);

  // ⛔ And what the 10/09 layout replaced. Held by TEXT, because the hero's strings are the only trace it can
  // leave once its CSS classes are gone: a screen that drew it again would print one of these three.
  for (const dead of ['Ambiente de demonstração', 'Demo environment', 'Entorno de demostración']) {
    expect(screen.queryByText(dead), `the eyebrow "${dead}" is back above the hub`).toBeNull();
  }
  expect(
    screen.queryByRole('heading', { name: /^(Loja|Demo store|Tienda) demo\.$/ }),
    'the hero heading is back above the hub',
  ).toBeNull();
});

test('★★ ONE frame on the screen, and it belongs to the tenant card', () => {
  // The page used to wear a border of its own with the cards' borders inside it. The wrapper that carried it
  // was `.frame`, and this runner keeps CSS-module class names unscoped (`vitest.config.ts`), so the element
  // is nameable: a page that grows a second frame again is named here rather than found in a screenshot.
  const { container } = render(
    <GateBlock siteUrl="https://x" adminUrl="https://a" initialLang="pt" dismiss={noop} />,
  );
  expect(
    container.querySelectorAll('[data-tenant]').length,
    'no tenant card drawn — this rule has no subject',
  ).toBe(GATE_TENANTS.length);
  expect(
    container.querySelector('[class*="frame"]'),
    'the page wears a frame of its own again, with the cards’ frames inside it',
  ).toBeNull();
});

test('⛔ there is no "carry on in this window" button on a face the box publishes', () => {
  // The cards ARE the choice: the one the visitor is standing on is a dismiss form, and a seventh button
  // offering the same thing in words is what this slice took away.
  const here = GATE_FACES.find((face) => face.kind === 'shop' && face.host)?.host as string;
  const { container } = render(
    <GateBlock siteUrl="https://x" here={here} initialLang="pt" dismiss={noop} />,
  );
  expect(container.querySelector('[data-here-row]')).toBeNull();
  expect(screen.queryByRole('button', { name: /continuar nesta janela/i })).toBeNull();
});

test('the footer selector switches the copy live (PT → EN → ES)', () => {
  render(<GateBlock siteUrl="https://x" adminUrl="https://a" initialLang="pt" dismiss={noop} />);
  expect(screen.getByRole('heading', { name: headline('pt') })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'en' }));
  expect(screen.getByText(HUB.en.notice)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'es' }));
  expect(screen.getByText(HUB.es.notice)).toBeTruthy();
});

test('★★ the headline is COUNTED off the declaration, never written in the copy', () => {
  render(<GateBlock siteUrl="https://x" initialLang="pt" dismiss={noop} />);
  const heading = screen.getByRole('heading', { level: 1 });
  const clauses = HUB.pt.counts(tally.tenants, tally.shops, tally.admins);
  expect(heading.textContent).toBe(clauses.join(''));
  // ⛔ ONE ELEMENT PER CLAUSE — the design's headline is three lines, and leaving that to a character measure
  // is what broke it into "2 tenants. 4 / lojas. 2 admins." in a real render.
  expect([...heading.children].map((line) => line.textContent)).toEqual([...clauses]);
  // …and the counts really are the box's: a fifth store rewrites this heading with no edit here.
  expect(heading.textContent).toContain(String(GATE_TENANTS.length));
  expect(tally.shops + tally.admins, 'the declaration carries no face at all').toBeGreaterThan(1);
});

test('the admin origin this box was promoted to reaches the hub, and lands on /enter', () => {
  const { container } = render(
    <GateBlock
      siteUrl="https://x"
      adminUrl="https://admin.demo.example/"
      initialLang="en"
      dismiss={noop}
    />,
  );
  // Which face it applies to, and why only the first, is hub.test.tsx's. Here: the wiring reaches the screen.
  const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  expect(hrefs).toContain('https://admin.demo.example/enter');
});

test("the footer selector is the app's own language list, not a copy of it", () => {
  // `LANGS` is the one list; the screen used to transcribe it as `['pt','en','es']` beside it.
  render(<GateBlock siteUrl="https://x" adminUrl="https://a" initialLang="pt" dismiss={noop} />);
  for (const code of LANGS) expect(screen.getByRole('button', { name: code })).toBeTruthy();
  expect(LANGS.length, 'a one-language app would make the loop above vacuous').toBeGreaterThan(2);
});

test('the gate switches to the architecture screen and back, and each screen HIDES the other', () => {
  const scrollTo = vi.fn();
  window.scrollTo = scrollTo;
  render(<GateBlock siteUrl="https://x" adminUrl="https://a" initialLang="pt" dismiss={noop} />);

  // On the gate: its own headline is there and the architecture's is NOT (the control, before any click).
  expect(screen.getByRole('heading', { name: headline('pt') })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: ARCH.pt.title })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: ARCH.pt.open }));
  expect(screen.getByRole('heading', { name: ARCH.pt.title })).toBeTruthy();
  expect(
    screen.queryByRole('heading', { name: headline('pt') }),
    'the gate is still rendered under the architecture screen',
  ).toBeNull();
  // The second screen is a whole page tall: it has to start at its own top.
  expect(scrollTo, 'the switch did not scroll back to the top').toHaveBeenCalledWith(0, 0);

  // And it knows the way back.
  fireEvent.click(screen.getByRole('button', { name: ARCH.pt.back }));
  expect(screen.getByRole('heading', { name: headline('pt') })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: ARCH.pt.title })).toBeNull();
  expect(scrollTo).toHaveBeenCalledTimes(2);
});

for (const lang of LANGS) {
  test(`[${lang}] the architecture screen opens in the language the gate is in`, () => {
    // The selector is the GATE's language and the shops stay PT-BR, so the second screen has to travel in
    // whichever language the visitor chose, and it has no selector of its own.
    window.scrollTo = vi.fn();
    render(
      <GateBlock siteUrl="https://x" adminUrl="https://a" initialLang={lang} dismiss={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: ARCH[lang].open }));
    expect(screen.getByRole('heading', { name: ARCH[lang].title })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: headline(lang) })).toBeNull();
  });
}

// ⚠️ `STRINGS` still carries the way back and the ribbon; if it ever stops, the line above that asserts the
// back link would be asserting a string typed in two places.
test('the way back is the app’s own string', () => {
  render(<GateBlock siteUrl="https://x" initialLang="es" dismiss={noop} />);
  expect(screen.getByText(STRINGS.es.back)).toBeTruthy();
});
