// ★★★ THE HUB DRAWS WHAT THE BOX DECLARES — held against `seed/box.json`, in BOTH directions.
//
// The screen imports `../faces.generated.ts`, which `bin/gate-faces.mjs` renders from that file and
// `bin/gate-faces.guard.mjs` refuses to let drift. This file is the other end of the same sentence, and it is
// a separate one on purpose: the guard proves the MODULE is the declaration, and these prove the SCREEN is
// the module — a card per face, an address per card, and a name where there is no address.
//
// ⚠️ THE EXPECTATION IS NEVER A NUMBER TYPED HERE. Six is counted off `seed/box.json`; a fifth store declared
// tomorrow makes this file expect five shops without an edit, and a store that loses its `domain` makes it
// demand the `unaddressed` state by name.

import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { GATE_FACES, GATE_TENANTS } from '../faces.generated';
import { HUB, HUB_MARKS, LANGS, LOCALES } from '../i18n';
import { GateHub, adminHrefOf, hubTally, isHere, urlOf } from './hub';

const BOX_PATH = join(process.cwd(), '..', '..', 'seed', 'box.json');
const box = JSON.parse(readFileSync(BOX_PATH, 'utf8')) as {
  tenants: {
    id: string;
    admin_domain?: { host: string; env: string };
    stores?: { handle: string; domain?: { host: string; env: string } }[];
  }[];
};

const noop = async () => {};
const shops = GATE_FACES.filter((f) => f.kind === 'shop');
const admins = GATE_FACES.filter((f) => f.kind === 'admin');

/** Indexed access under `noUncheckedIndexedAccess`: a missing element is a RED that names what was expected,
 *  never a `!` that turns the vacuum into a runtime `undefined` three assertions later. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`the declaration carries no ${what} — this file has no subject`);
  }
  return value;
}

test('⛔ the declaration this whole file grades against is not empty', () => {
  expect(box.tenants.length, `${BOX_PATH} declares no tenant`).toBeGreaterThan(1);
  expect(
    shops.length,
    'the box declares no shop, so every rule below has no subject',
  ).toBeGreaterThan(1);
  expect(admins.length).toBe(box.tenants.length);
});

test('★★★ the hub draws one card per face the box DECLARES — counted off seed/box.json, never typed', () => {
  const declared =
    box.tenants.reduce((n, t) => n + (t.stores ?? []).length, 0) + box.tenants.length;
  const { container } = render(<GateHub lang="pt" here="store.forgecommerce.pro" dismiss={noop} />);
  const drawn = container.querySelectorAll('[data-face]');
  expect(
    drawn.length,
    `seed/box.json declares ${declared} face(s) and the hub drew ${drawn.length}`,
  ).toBe(declared);
  for (const face of GATE_FACES) {
    expect(
      container.querySelector(`[data-face="${face.key}"]`),
      `the hub drew no card for ${face.key}, which seed/box.json declares`,
    ).toBeTruthy();
  }
});

test('★ every shop card opens the hostname the box declares for it, and no other', () => {
  const { container } = render(<GateHub lang="pt" here="nothing.example" dismiss={noop} />);
  for (const face of shops) {
    const card = container.querySelector(`[data-face="${face.key}"]`);
    const href = card?.querySelector('a')?.getAttribute('href');
    expect(href, `${face.key} has no link`).toBe(`https://${face.host}`);
  }
});

test("★ every admin row opens its own host's /enter — the server-side redeem handoff", () => {
  const { container } = render(<GateHub lang="pt" here="nothing.example" dismiss={noop} />);
  for (const face of admins) {
    const row = container.querySelector(`[data-face="${face.key}"]`);
    expect(row?.getAttribute('href'), `${face.key} does not open /enter`).toBe(
      `https://${face.host}/enter`,
    );
  }
});

test('★★ FORGE_GATE_ADMIN_URL wins for the FIRST tenant only — the bench door, never the other brand’s', () => {
  // `bin/box-up.sh` fills that variable from the first admin door the directory accepted, so handing it to
  // both cards would point the second tenant's admin at the first tenant's.
  const { container } = render(
    <GateHub lang="pt" here="x" adminUrl="https://bench.example:8443/" dismiss={noop} />,
  );
  const first = must(
    must(GATE_TENANTS[0], 'a first tenant').faces.find((f) => f.kind === 'admin'),
    "the first tenant's admin",
  );
  const second = must(
    must(GATE_TENANTS[1], 'a second tenant').faces.find((f) => f.kind === 'admin'),
    "the second tenant's admin",
  );
  expect(container.querySelector(`[data-face="${first.key}"]`)?.getAttribute('href')).toBe(
    'https://bench.example:8443/enter',
  );
  expect(container.querySelector(`[data-face="${second.key}"]`)?.getAttribute('href')).toBe(
    `https://${second.host}/enter`,
  );
});

test('★★★ the face the visitor is ON is a dismiss FORM, not a link — the deep link survives', () => {
  const first = must(shops[0], 'a first shop');
  const here = must(first.host, `an address for ${first.key}`);
  const { container } = render(<GateHub lang="pt" here={`${here}:8200`} dismiss={noop} />);
  const card = container.querySelector(`[data-face="${first.key}"]`);
  expect(
    within(card as HTMLElement).queryByRole('button'),
    'no dismiss button on the current face',
  ).toBeTruthy();
  expect(
    card?.querySelector('a'),
    'the current face is still a link, so the visitor leaves and comes back',
  ).toBeNull();
  // …and the OTHER shops stay links, which is what makes the one above a statement.
  for (const face of shops.slice(1)) {
    expect(
      container.querySelector(`[data-face="${face.key}"] a`),
      `${face.key} lost its link`,
    ).toBeTruthy();
  }
  // The visitor is standing on a declared face, so the hub's own door is NOT drawn a second time.
  expect(container.querySelector('[data-here-row]')).toBeNull();
});

test('★★★ ON A HOST THE BOX DOES NOT DECLARE THERE IS STILL A WAY IN, and it names the host', () => {
  // ⛔ THE ONE THIS SLICE MUST NOT BREAK: the box is born on `localhost` and promoted later, so on a bench no
  // card matches. A hub made only of links would be a gate with no door — every birth would end with a shop
  // nobody can enter.
  //
  // ★ pk38/d7 — WHAT CHANGED IS WHAT IT SAYS, NOT WHETHER IT EXISTS. It used to be a button reading "carry on
  // in this window", offered as if it were a seventh destination; now it states the CONDITION — this window is
  // on an address the box does not publish — with the door beside it. The two halves are asserted separately
  // so a rewrite that drops the condition and keeps the button is red.
  const { container } = render(<GateHub lang="pt" here="localhost:8200" dismiss={noop} />);
  const row = container.querySelector('[data-here-row]');
  expect(row, 'a bench host matched no face and the hub offered no way in').toBeTruthy();
  expect(row?.textContent, 'the row does not SAY why it is there').toContain(HUB.pt.hereNote);
  expect(within(row as HTMLElement).getByRole('button').textContent).toContain(HUB.pt.hereCta);
  expect(row?.textContent, 'the row does not say WHICH host it is talking about').toContain(
    'localhost:8200',
  );
});

test('⛔ and the words "continuar nesta janela" are gone from every language', () => {
  // The contract is about the SENTENCE, not about one string constant: a copy edit that reintroduced it in
  // any of the three would put a seventh choice back on the screen.
  for (const lang of LANGS) {
    const t = HUB[lang];
    const said = [t.hereNote, t.hereCta, t.notice, ...Object.values(t.faces).map((f) => f.cta)];
    for (const line of said) {
      expect(
        /continuar nesta janela|carry on in this window|continuar en esta ventana/i.test(line),
        `[${lang}] "${line}" offers carrying on in this window`,
      ).toBe(false);
    }
  }
});

// ★★★ THE «NO ADDRESS DECLARED» STATE LIVES IN `hub.unaddressed.test.tsx`, and it is a FILE of its own for a
// reason: proving it needs the generated module to carry a face with no host, and this tree declares six
// addresses. Asserting it here — against a healthy tree — is the green that proves nothing.
test('★ this tree declares an address for every face, so nothing is drawn unaddressed', () => {
  const { container } = render(<GateHub lang="pt" here="x" dismiss={noop} />);
  expect(
    container.querySelector('[data-unaddressed]'),
    'a face of seed/box.json lost its `domain` — the screen says so, and so does bin/gate-faces.guard.mjs',
  ).toBeNull();
  expect(urlOf({ ...must(shops[1], 'a second shop'), host: null, env: null })).toBeNull();
  expect(adminHrefOf({ ...must(admins[0], 'an admin'), host: null, env: null })).toBeNull();
});

test('★★ the copy is keyed by the BOX’s keys — no orphan copy, no unwritten face', () => {
  for (const lang of LANGS) {
    const t = HUB[lang];
    for (const face of shops) {
      expect(t.faces[face.key], `[${lang}] no copy for the declared face ${face.key}`).toBeTruthy();
    }
    for (const key of Object.keys(t.faces)) {
      expect(
        GATE_FACES.some((f) => f.key === key),
        `[${lang}] HUB.faces carries copy for "${key}", which seed/box.json no longer declares`,
      ).toBeTruthy();
    }
    for (const tenant of GATE_TENANTS) {
      expect(
        t.tenants[tenant.id],
        `[${lang}] no copy for the declared tenant ${tenant.id}`,
      ).toBeTruthy();
    }
    for (const id of Object.keys(t.tenants)) {
      expect(
        GATE_TENANTS.some((tt) => tt.id === id),
        `[${lang}] HUB.tenants carries copy for "${id}", which seed/box.json no longer declares`,
      ).toBeTruthy();
    }
  }
  for (const key of Object.keys(HUB_MARKS)) {
    expect(
      shops.some((f) => f.key === key),
      `HUB_MARKS carries a wordmark for "${key}", which is not a declared shop`,
    ).toBeTruthy();
  }
  for (const face of shops) {
    expect(HUB_MARKS[face.key], `no wordmark for the declared shop ${face.key}`).toBeTruthy();
  }
});

test('★ the tally the headline is written from is DERIVED from the faces, never typed', () => {
  // The sentence itself is drawn by `./gate` (the design puts it in the page's header row, beside the
  // wordmark); what lives here is the arithmetic, and `gate.test.tsx` holds that the heading prints it.
  const { container } = render(<GateHub lang="pt" here="x" dismiss={noop} />);
  expect(container.querySelector('[data-hub-faces]')?.getAttribute('data-hub-faces')).toBe(
    String(GATE_FACES.length),
  );
  expect(hubTally()).toEqual({
    tenants: GATE_TENANTS.length,
    shops: shops.length,
    admins: admins.length,
    faces: GATE_FACES.length,
  });
});

test('★★★ the number on a shop card is the PORT’s, and a missing answer is a sentence — never a zero', () => {
  const first = must(shops[0], 'a first shop');
  const withCount = render(
    <GateHub lang="pt" here="x" counts={{ [first.key]: 2777 }} dismiss={noop} />,
  );
  const said = withCount.container.querySelector(`[data-face="${first.key}"] [data-products]`);
  expect(said?.getAttribute('data-products')).toBe('2777');
  expect(said?.textContent, 'the count the port answered is not on the card').toContain(
    new Intl.NumberFormat(LOCALES.pt).format(2777),
  );
  expect(said?.textContent).toBe(must(HUB.pt.faces[first.key], 'copy').blurb(2777));
  withCount.unmount();

  // ⛔ THE FAILURE MODE, DECIDED AND HELD. No counts at all is what a bench, a refused read or a timeout looks
  // like from here: the card keeps a complete sentence, and it must not contain a number for a shop whose size
  // nobody could state.
  const { container } = render(<GateHub lang="pt" here="x" dismiss={noop} />);
  const quiet = container.querySelector(`[data-face="${first.key}"] [data-products]`);
  expect(quiet?.getAttribute('data-products')).toBe('unknown');
  expect(quiet?.textContent).toBe(must(HUB.pt.faces[first.key], 'copy').blurb(null));
  expect(quiet?.textContent, 'the unanswered case prints a number').not.toMatch(/\d/);
});

test('⛔ a count of ZERO is drawn as zero, and never as the no-number sentence', () => {
  // The two states are different facts — "this shop publishes nothing" and "nobody could say" — and the one
  // way to collapse them is to treat 0 as falsy. A shop emptied by a bad seed has to be visible as empty.
  const first = must(shops[0], 'a first shop');
  const { container } = render(
    <GateHub lang="pt" here="x" counts={{ [first.key]: 0 }} dismiss={noop} />,
  );
  const said = container.querySelector(`[data-face="${first.key}"] [data-products]`);
  expect(said?.getAttribute('data-products')).toBe('0');
  expect(said?.textContent).toBe(must(HUB.pt.faces[first.key], 'copy').blurb(0));
});

test('⚠️ "you are here" is ANCHORED on the host — a lookalike domain is not this box', () => {
  const face = must(shops[0], 'a first shop');
  const host = must(face.host, `an address for ${face.key}`);
  expect(isHere(face, host)).toBe(true);
  expect(isHere(face, `https://${host}:8200/anything`)).toBe(true);
  expect(isHere(face, `not${host}`)).toBe(false);
  expect(isHere(face, `${host}.evil.example`)).toBe(false);
  expect(isHere(face, undefined)).toBe(false);
});

for (const lang of LANGS) {
  test(`[${lang}] the hub speaks the gate's language`, () => {
    const { container } = render(<GateHub lang={lang} here="x" dismiss={noop} />);
    const copy = must(
      HUB[lang].faces[must(shops[0], 'a first shop').key],
      'copy for the first shop',
    );
    expect(screen.getByText(copy.blurb(null))).toBeTruthy();
    expect(container.querySelectorAll('[data-face]').length).toBe(GATE_FACES.length);
  });
}
