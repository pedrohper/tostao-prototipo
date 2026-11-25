// O layout do app não espera a API pra desenhar: os números do menu chegam por trás de um <Suspense>.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(__dirname, '..', file), 'utf8');

describe('menu', () => {
  const layout = read('app/(app)/layout.tsx');

  it('o layout só confere a sessão e o idioma antes de desenhar', () => {
    expect(layout).not.toMatch(/getProgress|getMissions|getTostaoAuto|api-queries/);
    expect(layout).toMatch(/<Suspense fallback={<MenuCarregando locale={locale} \/>}>\s*<MenuComDados/);
  });

  it('as leituras do menu continuam deixando o redirect de sessão vencida passar', () => {
    const menu = read('components/menu-com-dados.tsx');
    expect(menu.match(/\.catch\(orFallback\(/g)).toHaveLength(3);
    expect(menu).not.toMatch(/\.catch\(\s*\(\)\s*=>/);
  });
});
