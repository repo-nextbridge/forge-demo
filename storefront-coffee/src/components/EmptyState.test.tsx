// Empty-state renders a heading + message (the list's not-blank fallback).
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { EmptyState } from './EmptyState';

test('renders the title and message', () => {
  const { getByTestId } = render(<EmptyState title="Nada por aqui" message="Sem produtos." />);
  const el = getByTestId('empty-state');
  expect(el.textContent).toContain('Nada por aqui');
  expect(el.textContent).toContain('Sem produtos.');
});
