// T2.3 · lançamento só em PT-BR: flag NEXT_PUBLIC_ENABLE_I18N desligada ignora o cookie, só PT-BR no cliente, en/es fora
// de qualquer arquivo que o navegador alcance.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const walk = (dir: string, out: string[] = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('flag NEXT_PUBLIC_ENABLE_I18N', () => {
  it('desligada (padrão): qualquer cookie vira PT-BR e o dicionário é o PT-BR', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_I18N', '');
    const { normalizeLocale, getDictionary } = await import('./i18n');
    for (const raw of ['en', 'es', 'pt-BR', 'fr', null, undefined]) expect(normalizeLocale(raw)).toBe('pt-BR');
    expect(getDictionary('en').locale).toBe('pt-BR');
    expect(getDictionary('es').nav.home).toBe(getDictionary('pt-BR').nav.home);
  });

  it('"false" também desliga; só "true" liga', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_I18N', 'false');
    expect((await import('./i18n-flag')).I18N_ENABLED).toBe(false);
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_ENABLE_I18N', 'true');
    expect((await import('./i18n-flag')).I18N_ENABLED).toBe(true);
  });

  it('ligada: respeita o cookie e o servidor carrega en/es sob demanda', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_I18N', 'true');
    const { normalizeLocale } = await import('./i18n');
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('es')).toBe('es');
    expect(normalizeLocale('xx')).toBe('pt-BR');
    vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
    const { loadDictionary } = await import('./i18n-server');
    expect((await loadDictionary('en')).locale).toBe('en');
    expect((await loadDictionary('es')).locale).toBe('es');
    expect((await loadDictionary('pt-BR')).locale).toBe('pt-BR');
  });

  it('desligada, o servidor também só entrega PT-BR (en/es nem são importados)', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_I18N', '');
    vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
    const { loadDictionary } = await import('./i18n-server');
    expect((await loadDictionary('en')).locale).toBe('pt-BR');
  });
});

describe('o navegador nunca alcança en/es', () => {
  it('só lib/i18n-server.ts (servidor, import dinâmico) referencia i18n-locales/en e es', () => {
    const offenders = walk(root)
      .filter((f) => !f.includes('/i18n-locales/') && !f.endsWith('.spec.ts'))
      .filter((f) => /i18n-locales\/(en|es)\b/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(root.length));
    expect(offenders).toEqual(['lib/i18n-server.ts']);
    expect(readFileSync(join(root, 'lib/i18n-server.ts'), 'utf8')).toMatch(
      /await import\('\.\/i18n-locales\/(en|es)'\)/,
    );
  });

  it('nenhum Client Component importa lib/i18n-server (que carrega next/headers e os outros idiomas)', () => {
    const bad = walk(root)
      .filter((f) => /^['"]use client['"]/.test(readFileSync(f, 'utf8').trimStart()))
      .filter((f) => /i18n-server/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(root.length));
    expect(bad).toEqual([]);
  });
});
