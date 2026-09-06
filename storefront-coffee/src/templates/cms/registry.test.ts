// The CMS template registry: known keys resolve to their component; an unknown key falls back to the default
// template AND warns (CMS-1 DoD: unknown template_key → default with a notice, never a 500).
//
// ★★ AND THE LOOKUP HAS A STORE AXIS. Its DoD is a NEGATIVE: a store that declares no template of its own
// must land on the SHARED one, never on the default and never on a 404. So the sabotage this file is written
// against is "the overlay swallowed the store that has no entry in it".
//
// ⚠️ THIS FORK FILLS THE OVERLAY, WHICH IS THE HALF UPSTREAM CANNOT HAVE — and it fills it from the
// ENVIRONMENT, because the key is a store id and a store id is a fresh ULID on every birth. That makes two
// distinct things gradeable here and they are kept apart on purpose:
//
//   · the RULES of the axis, proved over a resolver built on fixtures (they must hold whatever the box did);
//   · the WIRING of this image, proved over `coffeeStoreOverlay(env)` with a populated env and with each
//     rotted one — because an overlay that reaches no store is green under every rule above while the shop
//     serves somebody else's words.
//
// Neither can cover for the other, and the anti-vacuum tests at the bottom are what say so.
import { expect, test, vi } from 'vitest';
import { OWN_STORE_ENV, PENDING_STORE_SENTINEL } from '@/lib/own-store';
import { About } from './About';
import { CoffeeAbout } from './CoffeeAbout';
import { Contact } from './Contact';
import { Faq } from './Faq';
import { InstitutionalDefault } from './InstitutionalDefault';
import {
  coffeeStoreOverlay,
  createPageTemplateResolver,
  DEFAULT_TEMPLATE_KEY,
  OWN,
  type PageTemplate,
  resolvePageTemplate,
  SHARED,
  storeTemplateAxis,
} from './registry';

/** The café — the store this image is the fork of. A ULID, as `provision-ref` mints them. */
const CAFE = 'sto_01M1JS22WZ4RN8PGH9GG56PJPW';
/** The counter, the OTHER store of this same tenant. It declares no template of its own, and that is the
 *  store the "falls back to the shared one" rule is actually about on this box. */
const BALCAO = 'sto_01M1EWQFH253ZE5WKJDAEZ6PNJ';

const PAGE = {
  slug: 'sobre',
  title: 'Sobre',
  template_key: 'about',
  meta_title: null,
  meta_description: null,
};

/** A store's OWN `about`, standing in for the component an instance ships for one of its stores. */
const StandInOwnAbout: PageTemplate = () => InstitutionalDefault({ page: PAGE });

/** The resolver the RULES run on: the same code path the module-level one uses, over a populated fixture. */
const resolve = createPageTemplateResolver({
  shared: { 'institutional-default': InstitutionalDefault, about: About, faq: Faq },
  overlay: { [CAFE]: { about: StandInOwnAbout } },
});

test('known template_keys resolve to their component (no fallback, no warn)', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(resolvePageTemplate('institutional-default', storeTemplateAxis(BALCAO))).toEqual({
    template: InstitutionalDefault,
    fallback: false,
    scope: 'shared',
  });
  expect(resolvePageTemplate('faq', storeTemplateAxis(BALCAO)).template).toBe(Faq);
  expect(resolvePageTemplate('contact', storeTemplateAxis(BALCAO)).template).toBe(Contact);
  warn.mockRestore();
});

test('an unknown template_key falls back to the default template and warns', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const resolved = resolvePageTemplate('totally-unknown', storeTemplateAxis(BALCAO));
  expect(resolved.fallback).toBe(true);
  expect(resolved.scope).toBe('default');
  expect(resolved.template).toBe(InstitutionalDefault);
  expect(DEFAULT_TEMPLATE_KEY).toBe('institutional-default');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('totally-unknown'));
  warn.mockRestore();
});

// ── the store axis ──────────────────────────────────────────────────────────────────────────────────────

test('★ a store that declares its own template gets ITS component for that key', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(resolve('about', storeTemplateAxis(CAFE))).toEqual({
    template: StandInOwnAbout,
    fallback: false,
    scope: 'store',
  });
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test('★★ THE DoD — a store with NO template of its own falls to the shared one, never to the default', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // The sabotage: give the axis a store the overlay has never heard of and ask for a key the overlay
  // OVERRIDES for somebody else. A resolver that read the overlay as a REPLACEMENT would answer the default
  // template here — the visible symptom being that every unclaimed store loses its `about` the day one
  // store gains one.
  const resolved = resolve('about', storeTemplateAxis(BALCAO));
  expect(resolved.template).toBe(About);
  expect(resolved.scope).toBe('shared');
  expect(resolved.fallback).toBe(false);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test('★ an overlay is a DIFF, not a replacement: the overriding store keeps the shared keys it did not claim', () => {
  expect(resolve('faq', storeTemplateAxis(CAFE)).template).toBe(Faq);
  expect(resolve('faq', storeTemplateAxis(CAFE)).scope).toBe('shared');
});

test('a key NO map claims still degrades to the default, overlay or not', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  for (const store of [CAFE, BALCAO]) {
    const resolved = resolve('nobody-registered-this', storeTemplateAxis(store));
    expect(resolved.template).toBe(InstitutionalDefault);
    expect(resolved.fallback).toBe(true);
  }
  warn.mockRestore();
});

test('the axis is matched MOST SPECIFIC FIRST — the first identity that claims the key wins', () => {
  const first: PageTemplate = () => InstitutionalDefault({ page: PAGE });
  const second: PageTemplate = () => InstitutionalDefault({ page: PAGE });
  const r = createPageTemplateResolver({
    shared: { about: About },
    overlay: { a: { about: first }, b: { about: second } },
  });
  expect(r('about', ['a', 'b']).template).toBe(first);
  expect(r('about', ['b', 'a']).template).toBe(second);
});

test('the axis of a request is the store segment itself — the store ID the read port answered for', () => {
  expect(storeTemplateAxis(CAFE)).toEqual([CAFE]);
});

// ── ★★ THE WIRING: this image's overlay is keyed on an id it is GIVEN, never one it was written with ─────

test('★★ the overlay reaches the café when the box hands it the id', () => {
  const overlay = coffeeStoreOverlay({ [OWN_STORE_ENV]: CAFE });
  expect(Object.keys(overlay)).toEqual([CAFE]);
  expect(overlay[CAFE]?.about).toBe(CoffeeAbout);
});

test('★★ THE ROT — every shape of a dead id leaves the overlay reaching NO store', () => {
  // This is the failure the whole mechanism exists against, and it is silent: the shop keeps answering 200
  // and serves the body it shared with the reference vitrine. Each case is a real one.
  const dead: [string, Record<string, string | undefined>][] = [
    ['the variable never arrived (compose does not pass it)', {}],
    ['it arrived empty', { [OWN_STORE_ENV]: '' }],
    ['the box was never born — .env.example ships the sentinel', {
      [OWN_STORE_ENV]: PENDING_STORE_SENTINEL,
    }],
    ['somebody pasted the HANDLE, which the read port refuses too', { [OWN_STORE_ENV]: 'cafe' }],
  ];
  for (const [why, env] of dead) {
    expect(Object.keys(coffeeStoreOverlay(env)), why).toEqual([]);
  }
});

test('★★ a rotted id costs the café its OWN words and nothing else — it is a degradation, not a 404', () => {
  const rotted = createPageTemplateResolver({ shared: SHARED, overlay: coffeeStoreOverlay({}) });
  const resolved = rotted('about', storeTemplateAxis(CAFE));
  expect(resolved.scope).toBe('shared');
  expect(resolved.fallback).toBe(false);
  expect(resolved.template).toBe(About);
  expect(resolved.template).not.toBe(CoffeeAbout);
});

// ── the guards that keep every rule above from being about nothing ───────────────────────────────────────

test('★ the fixture the axis rules run on is actually populated (else every rule above is vacuous)', () => {
  // "Falls back to the shared one" is a sentence about a resolver that never had an overlay to fall out of
  // unless the overlay CLAIMS something. Proved by the one answer only a populated overlay can give.
  expect(resolve('about', storeTemplateAxis(CAFE)).scope).toBe('store');
  expect(resolve('about', storeTemplateAxis(CAFE)).template).not.toBe(About);
});

test('★★ AGAINST THE VACUUM — this fork DECLARES a body of its own, and it is not the shared one', () => {
  // The whole slice can be undone by emptying `OWN`, and nothing above would go red: an empty overlay
  // satisfies "a store with no template falls to the shared one" perfectly. So the claim is asserted head
  // on — this image gives at least one store at least one template that is ITS OWN.
  const keys = Object.keys(OWN);
  expect(
    keys.length,
    'templates/cms/registry.ts OWN is empty — this fork has stopped giving the café any page of its own, ' +
      'and every institutional page is once again the reference vitrine\'s shoe-shop copy under a coffee theme.',
  ).toBeGreaterThan(0);
  for (const key of keys) {
    expect(OWN[key], `OWN["${key}"] is the shared template — an override that overrides nothing`).not.toBe(
      SHARED[key],
    );
  }
});
