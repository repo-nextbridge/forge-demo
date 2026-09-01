// gateWiring — the DEMO-GATE instance links. The compose passes FORGE_GATE_* as EMPTY strings when no secret is
// set (`${VAR:-}`), so the fallback must use `||` (empty → default), not `??` (empty would slip through). This
// pins the empty-string case that made the "← back" link reload the gate itself.
//
// It moved here from the storefront with the function it covers (DEMO-OUT): the reference storefront reads no
// FORGE_GATE_* env, because it renders no particular gate.

import { afterEach, expect, it } from 'vitest';
import { gateWiring } from './wiring';

afterEach(() => {
  process.env.FORGE_GATE_SITE_URL = undefined;
  process.env.FORGE_GATE_ADMIN_URL = undefined;
  delete process.env.FORGE_GATE_SITE_URL;
  delete process.env.FORGE_GATE_ADMIN_URL;
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

it('normalises an empty FORGE_GATE_ADMIN_URL to undefined (not an empty origin)', () => {
  process.env.FORGE_GATE_ADMIN_URL = '';
  expect(gateWiring().adminUrl).toBeUndefined();
});

it('honours a configured FORGE_GATE_ADMIN_URL', () => {
  process.env.FORGE_GATE_ADMIN_URL = 'https://admin.example.com';
  expect(gateWiring().adminUrl).toBe('https://admin.example.com');
});
