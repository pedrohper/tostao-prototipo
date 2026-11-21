// T2.3 · mutação financeira invalida só as telas de dinheiro, nunca o layout raiz (que derruba o cache do site todo).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { revalidateFinance } from './revalidate';

const root = fileURLToPath(new URL('../', import.meta.url));
const walk = (dir: string, out: string[] = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !e.endsWith('.spec.ts')) out.push(p);
  }
  return out;
};

describe('revalidateFinance()', () => {
  it('invalida Início, Carteira (com sub-rotas), previsão, limites, acertos, metas e assinaturas', () => {
    revalidateFinance();
    const calls = revalidatePath.mock.calls as [string, string][];
    const paths = calls.map(([p]) => p);
    for (const p of ['/inicio', '/carteira', '/previsao', '/limites', '/acertos', '/meta', '/assinaturas'])
      expect(paths).toContain(p);
    expect(calls.every(([, type]) => type === 'layout')).toBe(true); // 'layout' no prefixo cobre /carteira/[id] etc.
  });

  it('nunca invalida o layout raiz nem telas sem dinheiro (Aprender, Perfil, Amigos)', () => {
    revalidatePath.mockClear();
    revalidateFinance();
    const paths = (revalidatePath.mock.calls as [string][]).map(([p]) => p);
    expect(paths).not.toContain('/');
    for (const p of ['/aprender', '/perfil', '/amigos', '/batalha', '/tribunal']) expect(paths).not.toContain(p);
  });
});

describe('ninguém mais usa revalidatePath("/", "layout") fora de tema, idioma e consentimento', () => {
  it('só lib/theme-actions, lib/i18n-actions e lib/consent-actions (efeito global de verdade)', () => {
    const offenders = walk(root)
      .filter((f) => /revalidatePath\(\s*'\/'\s*,\s*'layout'\s*\)/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(root.length))
      .filter((f) => f !== 'lib/revalidate.ts') // só o comentário que explica o "antes"
      .sort();
    expect(offenders).toEqual(['lib/consent-actions.ts', 'lib/i18n-actions.ts', 'lib/theme-actions.ts']);
  });
});
