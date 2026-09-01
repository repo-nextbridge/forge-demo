import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { TIMEOUTS } from '../../vitest.shared';

export default defineConfig({
  plugins: [react()],
  test: {
    ...TIMEOUTS,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    include: ['**/*.test.{ts,tsx}'],
  },
});
