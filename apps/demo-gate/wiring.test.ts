// gateWiring — the DEMO-GATE instance links. The compose passes FORGE_GATE_* as EMPTY strings when no secret is
// set (`${VAR:-}`), so the fallback must use `||` (empty → default), not `??` (empty would slip through). This
// pins the empty-string case that made the "← back" link reload the gate itself.
//
// It moved here from the storefront with the function it covers (DEMO-OUT): the reference storefront reads no
// FORGE_GATE_* env, because it renders no particular gate.
//
// ★ AND THE ADMIN SIDE IS A MAP NOW. `FORGE_GATE_ADMIN_URLS` carries one origin per tenant, so the cases below
// are about a DOCUMENT rather than a string: a malformed one must yield an empty map (the hub then draws the
// declared hostnames), never a throw — a variable a human typed must not be able to take the storefront down.

import { afterEach, expect, it } from 'vitest';
import { gateWiring } from './wiring';

afterEach(() => {
  delete process.env.FORGE_GATE_SITE_URL;
  delete process.env.FORGE_GATE_ADMIN_URLS;
});

it('falls back to the canonical site when FORGE_GATE_SITE_URL is unset', () => {
  delete process.env.FORGE_GATE_SITE_URL;
  expect(gateWiring().siteUrl).toBe('https://forgecommerce.pro');
});

it('falls back to the canonical site when FORGE_GATE_SITE_URL is EMPTY (compose `:-` default)', () => {
  process.env.FORGE_GATE_SITE_URL = '';
  expect(gateWiring().siteUrl).toBe('https://forgecommerce.pro');
});

it('honours a configured FORGE_GATE_SITE_URL', () => {
  process.env.FORGE_GATE_SITE_URL = 'https://demo.forgecommerce.pro';
  expect(gateWiring().siteUrl).toBe('https://demo.forgecommerce.pro');
});

it('normalises an empty FORGE_GATE_ADMIN_URLS to an empty map (not an empty origin)', () => {
  process.env.FORGE_GATE_ADMIN_URLS = '';
  expect(gateWiring().adminUrls).toEqual({});
});

it('reads ONE origin PER TENANT — the whole reason this variable is plural', () => {
  process.env.FORGE_GATE_ADMIN_URLS = JSON.stringify({
    brand_a: 'https://a.example:8443',
    brand_b: 'https://b.example:8444',
  });
  expect(gateWiring().adminUrls).toEqual({
    brand_a: 'https://a.example:8443',
    brand_b: 'https://b.example:8444',
  });
});

it('yields an empty map — never a throw — for a value that is not JSON', () => {
  process.env.FORGE_GATE_ADMIN_URLS = 'https://admin.example.com';
  expect(gateWiring().adminUrls).toEqual({});
});

it('yields an empty map for JSON that is not an object of origins', () => {
  process.env.FORGE_GATE_ADMIN_URLS = '["https://admin.example.com"]';
  expect(gateWiring().adminUrls).toEqual({});
});

it('drops an entry whose origin is empty, and keeps the rest', () => {
  // A tenant whose door the directory refused reaches this file as an empty string; the hub must fall back to
  // the declared hostname for that one face, and go on overriding the others.
  process.env.FORGE_GATE_ADMIN_URLS = JSON.stringify({ brand_a: '', brand_b: 'https://b.example' });
  expect(gateWiring().adminUrls).toEqual({ brand_b: 'https://b.example' });
});
