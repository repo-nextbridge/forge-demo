// The CMS template registry (CMS-1): known keys resolve to their component; an unknown key falls back to the
// default template AND warns (DoD: unknown template_key → default with a notice, never a 500).
import { expect, test, vi } from 'vitest';
import { Contact } from './Contact';
import { Faq } from './Faq';
import { InstitutionalDefault } from './InstitutionalDefault';
import { DEFAULT_TEMPLATE_KEY, resolvePageTemplate } from './registry';

test('known template_keys resolve to their component (no fallback, no warn)', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(resolvePageTemplate('institutional-default')).toEqual({
    template: InstitutionalDefault,
    fallback: false,
  });
  expect(resolvePageTemplate('faq')).toEqual({ template: Faq, fallback: false });
  expect(resolvePageTemplate('contact')).toEqual({ template: Contact, fallback: false });
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test('an unknown template_key falls back to the default template and warns', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const resolved = resolvePageTemplate('totally-unknown');
  expect(resolved.fallback).toBe(true);
  expect(resolved.template).toBe(InstitutionalDefault);
  expect(DEFAULT_TEMPLATE_KEY).toBe('institutional-default');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('totally-unknown'));
  warn.mockRestore();
});
