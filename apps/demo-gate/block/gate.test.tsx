// The gate block's CHROME — the header, the footer, the language selector and the switch into the architecture
// screen. jsdom smoke test; the visual fidelity is the human gate (screenshots vs design-base/gate.dc.html).
//
// ★ pk35/d1 — THE DESTINATIONS THEMSELVES ARE `hub.test.tsx`'s, not this file's. What used to be asserted here
// ("Abrir a loja", "Abrir o admin", the `/enter` href) was the two-card screen that PRECEDED the hub; those
// statements moved WITH the cards, and they are stronger there because they are held against `seed/box.json`
// instead of against strings. This file keeps what wraps the hub.
//
// ⚠️ THE SWITCH IS PROVED BY MUTUAL EXCLUSION, not by "the new title is somewhere". A test that only looked for
// the architecture title would stay green with the gate still rendered underneath it, and a test that only looked
// for the gate's would stay green with the second screen empty. Each assertion below names what must be gone.
//
// ⚠️ AND THE LANGUAGE LIST IS NEVER TYPED: the per-language cases walk `LANGS` and take their expected words from
// `STRINGS`/`ARCH`.

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { GATE_TENANTS } from '../faces.generated';
import { ARCH, LANGS, STRINGS } from '../i18n';
import { GateBlock } from './gate';

const noop = async () => {};

/** The declaration's own first tenant, named rather than typed — the ids live in `seed/box.json`. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`seed/box.json declares no ${what}`);
  return value;
}

test('renders the PT chrome, the back link, and the hub inside it', () => {
  const { container } = render(
    <GateBlock
      siteUrl="https://forgecommerce.pro"
      adminUrls={{}}
      initialLang="pt"
      dismiss={noop}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Loja demo.' })).toBeTruthy();
  expect(screen.getByText('← voltar para forgecommerce.pro')).toBeTruthy();
  // The hub is MOUNTED, not re-asserted: one card per face the box declares (hub.test.tsx grades which).
  expect(
    container.querySelectorAll('[data-face]').length,
    'the gate rendered no destination at all — the hub is not mounted',
  ).toBeGreaterThan(1);
});

test('the footer selector switches the copy live (PT → EN → ES)', () => {
  render(<GateBlock siteUrl="https://x" adminUrls={{}} initialLang="pt" dismiss={noop} />);
  expect(screen.getByRole('heading', { name: 'Loja demo.' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'en' }));
  expect(screen.getByRole('heading', { name: 'Demo store.' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'es' }));
  expect(screen.getByRole('heading', { name: 'Tienda demo.' })).toBeTruthy();
});

test('the admin origins this box was promoted to reach the hub, and land on /enter', () => {
  const tenant = must(GATE_TENANTS[0], 'a first tenant');
  const { container } = render(
    <GateBlock
      siteUrl="https://x"
      adminUrls={{ [tenant.id]: 'https://admin.demo.example/' }}
      initialLang="en"
      dismiss={noop}
    />,
  );
  // Which face each origin applies to is hub.test.tsx's. Here: the wiring reaches the screen.
  const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  expect(hrefs).toContain('https://admin.demo.example/enter');
});

test("the footer selector is the app's own language list, not a copy of it", () => {
  // `LANGS` is the one list; the screen used to transcribe it as `['pt','en','es']` beside it.
  render(<GateBlock siteUrl="https://x" adminUrls={{}} initialLang="pt" dismiss={noop} />);
  for (const code of LANGS) expect(screen.getByRole('button', { name: code })).toBeTruthy();
  expect(LANGS.length, 'a one-language app would make the loop above vacuous').toBeGreaterThan(2);
});

test('the gate switches to the architecture screen and back, and each screen HIDES the other', () => {
  const scrollTo = vi.fn();
  window.scrollTo = scrollTo;
  render(<GateBlock siteUrl="https://x" adminUrls={{}} initialLang="pt" dismiss={noop} />);

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
      <GateBlock siteUrl="https://x" adminUrls={{}} initialLang={lang} dismiss={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: ARCH[lang].open }));
    expect(screen.getByRole('heading', { name: ARCH[lang].title })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: STRINGS[lang].title })).toBeNull();
  });
}
