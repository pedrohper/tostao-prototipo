import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Funções puras de lib/ (defesas de segurança, parsing, regras de tela) e markup de componentes sem estado de
// roteador (renderToString, sem jsdom): o que precisa de navegador de verdade fica pra o teste manual/E2E.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  // O tsconfig do Next usa jsx: preserve; no vitest o esbuild precisa transformar o JSX dos .spec.tsx.
  esbuild: { jsx: 'automatic' },
  test: { include: ['lib/**/*.spec.ts', 'components/**/*.spec.tsx'], environment: 'node' },
});
