import { defineConfig } from 'vitest/config';
// 15 s por teste: o bcrypt (custo 12, ~250 ms por hash) faz os testes de fluxo completo passarem de 4 s
// com folga mínima no limite padrão de 5 s, e estouram em runner de CI mais lento.
export default defineConfig({ test: { include: ['src/**/*.spec.ts'], testTimeout: 15_000 } });
