// The gate block renders the three languages and the two paths. jsdom smoke test — the visual fidelity is the
// human gate (screenshots vs the .dc.html); this proves the structure + i18n + the admin handoff href.

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
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
