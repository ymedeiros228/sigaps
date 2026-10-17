import { defineConfig } from 'vitest/config';

// Testes unitários de funções puras. Os testes de tela ficam no Playwright (e2e/).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
