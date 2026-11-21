import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Só funções puras de lib/ (sem React/Next): o runner existe pra testar defesas de segurança e parsing.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { include: ['lib/**/*.spec.ts'], environment: 'node' },
});
