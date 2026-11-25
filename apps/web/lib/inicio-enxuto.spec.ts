// T6.10 · "Jogos e amigos" mora em /mais: a Home não tem atalho avulso pra eles. Guardas lendo o código-fonte.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const GAMES = ['tribunal', 'batalha', 'ofensiva', 'amigos'];

const homeFiles = readdirSync(join(root, 'app/(app)/inicio'), { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => join('app/(app)/inicio', f));

describe('Home sem atalhos de jogos', () => {
  it('nenhum arquivo da Home aponta pra Tribunal, Batalha, Ofensiva ou Amigos', () => {
    expect(homeFiles.length).toBeGreaterThan(15);
    for (const file of homeFiles) {
      for (const game of [...GAMES, 'compensa']) expect(read(file), `${file} → /${game}`).not.toContain(`/${game}`);
    }
  });

  it('"quanto posso gastar hoje" (T6.17) fica acima do saldo, só no mês atual e dentro de um bloco com Suspense', () => {
    const page = read('app/(app)/inicio/page.tsx');
    const block = /\{month === hoje && \(\s*<Block skeleton="[^"]+">\s*<SafeToSpendSection \/>/.exec(page);
    expect(block).not.toBeNull();
    expect(block!.index).toBeLessThan(page.indexOf('<MobileBalanceCard'));
    expect(block!.index).toBeLessThan(page.indexOf('<DesktopBalanceRow'));
  });
});

describe('/mais agrupa os jogos', () => {
  it('o menu de /mais leva a "Jogos e amigos"', () => {
    const mais = read('app/(app)/mais/page.tsx');
    expect(mais).toContain('href="/mais/jogos"');
    expect(mais).toContain("'Jogos e amigos'");
  });

  it('a tela tem os quatro e deixa a calculadora "Compensa" de fora', () => {
    const jogos = read('app/(app)/mais/jogos/page.tsx');
    for (const game of GAMES) expect(jogos).toContain(`id: '${game}'`);
    expect(jogos).not.toContain("id: 'compensa'");
  });
});
