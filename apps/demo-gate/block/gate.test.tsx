// The gate block renders the three languages and the two paths, and SWITCHES to the architecture screen. jsdom
// smoke test — the visual fidelity is the human gate (screenshots vs design-base/gate.dc.html); this proves the
// structure + i18n + the admin handoff href + that the two screens trade places.
//
// ⚠️ THE SWITCH IS PROVED BY MUTUAL EXCLUSION, not by "the new title is somewhere". A test that only looked for
// the architecture title would stay green with the gate still rendered underneath it, and a test that only looked
// for the gate's would stay green with the second screen empty. Each assertion below names what must be gone.
//
// ⚠️ AND THE LANGUAGE LIST IS NEVER TYPED: the per-language cases walk `LANGS` and take their expected words from
// `STRINGS`/`ARCH`.

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ARCH, LANGS, STRINGS } from '../i18n';
import { GateBlock } from './gate';

const noop = async () => {};

test('renders the PT screen with both paths and the back link', () => {
  render(
    <GateBlock
      siteUrl="https://forgecommerce.pro"
      adminUrl="https://admin.demo.example"
      initialLang="pt"
      dismiss={noop}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Loja demo.' })).toBeTruthy();
  expect(screen.getByText('Abrir a loja')).toBeTruthy();
  expect(screen.getByText('Abrir o admin')).toBeTruthy();
  expect(screen.getByText('Storefront')).toBeTruthy();
  expect(screen.getByText('Admin')).toBeTruthy();
  expect(screen.getByText('← voltar para forgecommerce.pro')).toBeTruthy();
});

test('the footer selector switches the copy live (PT → EN → ES)', () => {
  render(<GateBlock siteUrl="https://x" adminUrl="https://a" initialLang="pt" dismiss={noop} />);
  expect(screen.getByRole('heading', { name: 'Loja demo.' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'en' }));
  expect(screen.getByRole('heading', { name: 'Demo store.' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'es' }));
  expect(screen.getByRole('heading', { name: 'Tienda demo.' })).toBeTruthy();
});

test('"Open the admin" points at the admin origin /enter route (the redeem handoff)', () => {
  render(
    <GateBlock
      siteUrl="https://x"
      adminUrl="https://admin.demo.example/"
      initialLang="en"
      dismiss={noop}
    />,
  );
  const link = screen.getByText('Open the admin').closest('a');
  expect(link?.getAttribute('href')).toBe('https://admin.demo.example/enter');
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

  // On the gate: its own title is there and the architecture's is NOT (the control, before any click).
  expect(screen.getByRole('heading', { name: STRINGS.pt.title })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: ARCH.pt.title })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: ARCH.pt.open }));
  expect(screen.getByRole('heading', { name: ARCH.pt.title })).toBeTruthy();
  expect(
    screen.queryByRole('heading', { name: STRINGS.pt.title }),
    'the gate is still rendered under the architecture screen',
  ).toBeNull();
  // The second screen is a whole page tall: it has to start at its own top.
  expect(scrollTo, 'the switch did not scroll back to the top').toHaveBeenCalledWith(0, 0);

  // And it knows the way back.
  fireEvent.click(screen.getByRole('button', { name: ARCH.pt.back }));
  expect(screen.getByRole('heading', { name: STRINGS.pt.title })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: ARCH.pt.title })).toBeNull();
  expect(scrollTo).toHaveBeenCalledTimes(2);
});

for (const lang of LANGS) {
  test(`[${lang}] the architecture screen opens in the language the gate is in`, () => {
    // The selector is the GATE's language (the owner's decision, 10/09: the shops stay PT-BR) — so the second
    // screen has to travel in whichever language the visitor chose, and it has no selector of its own.
    window.scrollTo = vi.fn();
    render(
      <GateBlock siteUrl="https://x" adminUrl="https://a" initialLang={lang} dismiss={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: ARCH[lang].open }));
    expect(screen.getByRole('heading', { name: ARCH[lang].title })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: STRINGS[lang].title })).toBeNull();
  });
}
