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
import { describe, expect, test, vi } from 'vitest';
import { GATE_FACES, GATE_TENANTS } from '../faces.generated';
import { HUB, HUB_MARKS, LANGS } from '../i18n';
import { GateHub, adminHrefOf, hubTally, isHere, urlOf } from './hub';

const BOX_PATH = join(process.cwd(), '..', '..', 'seed', 'box.json');
const DESIGN_PATH = join(process.cwd(), 'design-base', 'gate.dc.html');
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
    // ⚠️ THE HOST IS THE RULE, AND THE QUERY IS NOT. This used to compare the whole string, and the day the
    // card started carrying the visitor's language (`?lang=`, so it survives the jump to another ORIGIN) the
    // comparison called a correct link wrong. What must never drift is the HOSTNAME — so that is what is
    // asserted, and the only thing allowed after it is the language parameter.
    const asked = new URL(String(href));
    expect(asked.origin, `${face.key} opens the wrong host`).toBe(`https://${face.host}`);
    expect([...asked.searchParams.keys()], `${face.key} carries a parameter nobody declared`).toStrictEqual(
      asked.search ? ['lang'] : [],
    );
    expect(asked.pathname, `${face.key} opens a path instead of the shop's root`).toBe('/');
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

test('★★ FORGE_GATE_ADMIN_URLS wins PER TENANT — the bench door, never the other brand’s', () => {
  // The map is keyed by tenant id, so an override written for one tenant must not reach the other's card:
  // a tenant absent from it keeps the address `seed/box.json` declares.
  const firstTenant = must(GATE_TENANTS[0], 'a first tenant');
  const { container } = render(
    <GateHub
      lang="pt"
      here="x"
      adminUrls={{ [firstTenant.id]: 'https://bench.example:8443/' }}
      dismiss={noop}
    />,
  );
  const first = must(
    firstTenant.faces.find((f) => f.kind === 'admin'),
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

test('★ the tally the screen publishes is DERIVED from the faces, never typed', () => {
  // `data-hub-faces` is the one number a probe on the other side of the wire can count the cards against;
  // the headline beside it is the design's sentence, not this arithmetic (see the artboard rules above).
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

// ★★★ THE SENTENCES ON THIS SCREEN ARE THE ARTBOARD'S, WORD FOR WORD — held against the design FILE, not
// against a copy of it typed here. The numbers ("2 777 produtos → 44 399 SKUs", "55 produtos") are fixed on
// purpose: this gate is the public demo's own front door rather than an app a customer installs, so its
// truth is the design and a different one is a FORK. See the head of the `HUB` section in `../i18n`.
//
// ⚠️ THE EXPECTATION IS READ OFF `design-base/gate.dc.html`. A drawing that is redrawn with other numbers
// makes this red naming the sentence that no longer appears, which is the only thing that keeps "word for
// word" true six slices from now.
const design = readFileSync(DESIGN_PATH, 'utf8');

test('⛔ the design this rule grades against is really the gate artboard', () => {
  // Anti-vacuum: every assertion below is a substring search, and a search over the wrong file — or an empty
  // one — passes for nothing. The artboard is named by the screen it draws.
  expect(design.length, `${DESIGN_PATH} is empty`).toBeGreaterThan(2000);
  expect(design, 'this is not the gate artboard').toContain('Duas lojas, um único banco.');
});

test('★★★ every PT sentence on a shop card is the DESIGN’s, word for word', () => {
  for (const face of shops) {
    const copy = must(HUB.pt.faces[face.key], `copy for the declared shop ${face.key}`);
    expect(
      design.includes(copy.blurb),
      `the design does not carry "${copy.blurb}" — the card for ${face.key} drifted from the artboard`,
    ).toBe(true);
    expect(
      design.includes(copy.cta),
      `the design does not carry the button "${copy.cta}" (${face.key})`,
    ).toBe(true);
  }
  // …and the sizes really are in there, which is what a rewrite that quietly drops them would lose.
  expect(
    Object.values(HUB.pt.faces).some((copy) => /\d/.test(copy.blurb)),
    'no shop sentence carries a number any more — the design writes two of them',
  ).toBe(true);
});

// ★ THE TENANT CARD'S OWN TWO SENTENCES ARE THE ARTBOARD'S TOO, and this rule was the half that was missing:
// only the shop cards were held against the file, so the card's headline and the sentence under it could be
// rewritten on either side alone. They are what says what a tenant IS, now that the masthead's lede is gone.
test('★★★ and so is every PT sentence on a TENANT card', () => {
  for (const tenant of GATE_TENANTS) {
    const copy = must(HUB.pt.tenants[tenant.id], `copy for the declared tenant ${tenant.id}`);
    for (const said of [copy.eyebrow, copy.badge, copy.headline, copy.blurb]) {
      expect(
        design.includes(said),
        `the design does not carry "${said}" — the card for ${tenant.id} drifted from the artboard`,
      ).toBe(true);
    }
  }
});

/** The declarations of one rule of a stylesheet, by selector — so a colour is asserted WHERE it is set rather
 *  than anywhere in the file. A selector that is not there THROWS: an absent rule must never read as an absent
 *  colour. ⚠️ `arch.test.tsx` carries the same five lines rather than importing them: importing a test module
 *  re-registers its tests inside the importer, which is a suite counting the same cases twice. */
function rule(sheet: string, selector: string): string {
  const at = sheet.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`${selector} is not a rule of this stylesheet`);
  return sheet.slice(at, sheet.indexOf('}', at));
}

// ★★★ AND THE COLOURS ARE GRADED THE SAME WAY THE WORDS ARE. Every rule above holds a SENTENCE against the
// artboard, which is why a pass that recoloured the screen could change one side alone and stay green. The
// tenant chip is the piece this one moved: an orange outline became a solid light ground.
test('★★ the tenant chip is the artboard’s chip, on BOTH sides — and the outline it replaced is on neither', () => {
  const css = readFileSync(join(process.cwd(), 'block', 'hub.module.css'), 'utf8');
  expect(design, 'the artboard does not draw the first tenant’s chip').toContain(
    'color:#0F1011;background:#E7E4DE;padding:4px 9px">Tenant 1<',
  );
  const badge = rule(css, '.badge');
  expect(badge).toContain('color: #0f1011;');
  expect(badge).toContain('background: #e7e4de;');
  expect(badge, 'the chip is an outline again').not.toContain('border');
  expect(css.includes('rgba(194, 65, 12, 0.4)'), 'the stylesheet still draws the outline').toBe(
    false,
  );
  expect(design.includes('rgba(194,65,12,.4)'), 'the artboard still draws the outline').toBe(false);
  // ⚠️ THE LIGHT CARD KEEPS ITS OUTLINE, and that is not an oversight: a near-white chip on `#F3EDE3` would
  // be a chip nobody can see. The rule follows the card's TONE, exactly like every other rule in this sheet.
  expect(rule(css, '.tenantLight .badge')).toContain('border: 1px solid rgba(47, 59, 48, 0.35);');
  expect(design).toContain('border:1px solid rgba(47,59,48,.35);padding:4px 9px">Tenant 2<');
});

test('★★ the headline is the design’s sentence too — four clauses, three declared lines', () => {
  // ⚠️ LINE BY LINE, not as one joined string: the artboard draws the break the screen declares (three
  // `display:block` spans), so a join would only match a drawing that had left the break to a measure.
  for (const line of HUB.pt.headline) expect(design).toContain(line);
  expect(design).toContain(HUB.pt.headlineAccent);
  // …and the fourth clause is the accented one THERE as well, not merely present somewhere on the artboard.
  expect(
    design.includes(
      `<strong style="color:#C2410C;font-weight:700">${HUB.pt.headlineAccent}</strong>`,
    ),
    'the design does not draw the fourth clause in the accent',
  ).toBe(true);
});

test('⛔ what the second pass took off this screen is gone from BOTH sides, in all three languages', () => {
  // The screen was read as too crowded, and three things went: the masthead's lede, the four shop chips, and
  // the orange outline of the tenant chip. A slice that changed the code and left the artboard — or the other
  // way round — would leave this screen and its truth disagreeing in silence, which is the whole reason the
  // rules above grade one against the other. So each of the three is named on BOTH sides here.
  const dead = [
    'Cada tenant é uma conta isolada',
    'Each tenant is an isolated account',
    'Cada tenant es una cuenta aislada',
    'Referência',
    'Segunda loja',
    'Storefront forkado',
    'Reference',
    'Second shop',
    'Forked storefront',
    'Referencia',
    'Segunda tienda',
    'Storefront forkeado',
  ];
  for (const line of dead) {
    expect(design.includes(line), `the artboard still draws "${line}"`).toBe(false);
  }
  const { container } = render(<GateHub lang="pt" here="x" dismiss={noop} />);
  expect(
    container.querySelector('[class*="faceBadge"]'),
    'a shop card grew its chip back',
  ).toBeNull();
  // ⚠️ AND THE CHIP IS GONE FROM THE COPY, not merely unrendered: a key nobody prints is a key somebody puts
  // back on a screen. The type no longer has one, so this walks what the copy really carries.
  for (const lang of LANGS) {
    for (const [key, copy] of Object.entries(HUB[lang].faces)) {
      expect(
        Object.keys(copy).sort(),
        `[${lang}] ${key} carries more than the sentence and the button`,
      ).toEqual(['blurb', 'cta']);
    }
  }
});

test('★ the card prints that sentence, and asks nothing to get it', () => {
  const first = must(shops[0], 'a first shop');
  const { container } = render(<GateHub lang="pt" here="x" dismiss={noop} />);
  const said = container.querySelector(`[data-face="${first.key}"] p`);
  expect(said?.textContent).toBe(must(HUB.pt.faces[first.key], 'copy').blurb);
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
    expect(screen.getByText(copy.blurb)).toBeTruthy();
    expect(container.querySelectorAll('[data-face]').length).toBe(GATE_FACES.length);
  });
}

// ── ★★ THE CHOSEN LANGUAGE TRAVELS BETWEEN THE SIX ORIGINS ──────────────────────────────────────────────────
//
// ⛔ MEASURED 2026-09-17 on the live box: pick English here, open the outlet, and the gate greets you in
// Portuguese. `forge_gate_lang` is written with no `domain`, so it belongs to the origin that wrote it, and
// the six faces are six origins. The link is the only thing that crosses.
describe('★★ a store link carries the language the visitor chose', () => {
  test('the shop link carries ?lang, so the next origin opens in the same language', () => {
    const face = { key: 'forge', host: 'store.example.test' } as never;
    expect(urlOf(face, 'en')).toBe('https://store.example.test?lang=en');
    expect(urlOf(face, 'es')).toBe('https://store.example.test?lang=es');
  });

  test('⛔ CONTROL — without a language it is the bare address, unchanged', () => {
    const face = { key: 'forge', host: 'store.example.test' } as never;
    expect(urlOf(face)).toBe('https://store.example.test');
  });

  test('⛔ CONTROL — a face the box declares no address for is still null, not a bare ?lang', () => {
    expect(urlOf({ key: 'forge', host: null } as never, 'en')).toBe(null);
  });
});

// ── ★★★ THE CARD IS THE WAY THROUGH, NOT JUST A LINK ────────────────────────────────────────────────────────
//
// ⛔ MEASURED 2026-09-17 on the live box: dismissing here and THEN opening the outlet worked; pressing the
// outlet's own card inside this screen opened it STILL GATED. The dismissal was written only by the card the
// visitor was standing on. These hold the repair — and the modifier-click, which is the browser's to handle.
describe('★★★ pressing another face dismisses before it leaves', () => {
  const firstAway = () => {
    const shops = GATE_FACES.filter((f) => f.kind === 'shop' && f.host);
    return must(
      shops.find((f) => !isHere(f, 'elsewhere.example')),
      'a shop the visitor is not standing on',
    );
  };

  test('a plain click calls dismiss, and only then navigates', async () => {
    const calls: string[] = [];
    const dismiss = () => {
      calls.push('dismiss');
      return Promise.resolve();
    };
    const assign = vi.fn((url: string) => calls.push(`go:${url}`));
    vi.stubGlobal('location', { ...window.location, assign });

    const { container } = render(<GateHub lang="pt" here="elsewhere.example" dismiss={dismiss} />);
    const link = container.querySelector(`[data-face="${firstAway().key}"] a`) as HTMLAnchorElement;
    expect(link, 'the away card has no link to press').toBeTruthy();
    link.click();
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());

    expect(calls[0], 'it navigated before dismissing — the next origin will still greet').toBe('dismiss');
    expect(calls[1]).toBe(`go:${link.getAttribute('href')}`);
    vi.unstubAllGlobals();
  });

  test('⛔ CONTROL — a modifier-click is left to the browser, and still dismisses', () => {
    let dismissed = 0;
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    const { container } = render(
      <GateHub
        lang="pt"
        here="elsewhere.example"
        dismiss={() => {
          dismissed += 1;
          return Promise.resolve();
        }}
      />,
    );
    const link = container.querySelector(`[data-face="${firstAway().key}"] a`) as HTMLAnchorElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    link.dispatchEvent(event);

    expect(dismissed, 'a modifier-click should still record the choice').toBe(1);
    expect(assign, 'the browser opens the new tab; this file must not').not.toHaveBeenCalled();
    expect(event.defaultPrevented, 'a modifier-click was cancelled — ctrl/cmd-click is broken').toBe(false);
    vi.unstubAllGlobals();
  });
});
