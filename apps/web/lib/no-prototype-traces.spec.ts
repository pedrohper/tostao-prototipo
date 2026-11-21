// T2.5 · zero vestígios de versão de rascunho/infra caseira no código do produto (apps/web e apps/api). Varre os
// arquivos de verdade, inclusive os testes. As palavras proibidas são montadas em pedaços pra este arquivo não se denunciar.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(__dirname, '..', '..', '..');
const j = (...parts: string[]) => parts.join('');

const FORBIDDEN: [label: string, needle: string][] = [
  ['frase de contato pessoal', j('Fala com o ', 'Pedro')],
  ['nome da rede privada da infra', j('Tail', 'scale')],
  ['comando de desenvolvedor', j('pnpm', ' ', 'dev')],
  ['palavra de versão de rascunho', j('prot', 'ótipo')],
  ['e-mail pessoal', j('pedrohper.business', '@', 'gmail.com')],
  ['chave do banner de rascunho', j('prototype', 'Banner')],
  ['flag de banco falso na UI', j('BANK_GATEWAY', '=', 'fake')],
  ['chave do aviso de simulador em construção', j('simulator', 'Wip')],
];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', 'generated']);
const TEXT = /\.(tsx?|mjs|cjs|js|json|css|md|mdx|html|webmanifest|example|prisma|sql|yml|yaml)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    // .env, .env.local... são do ambiente de cada máquina (não vão pro git). Só o .env.example é código.
    if (name.startsWith('.env') && name !== '.env.example') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (TEXT.test(name) || name === '.env.example') out.push(full);
  }
  return out;
}

const files = [...walk(join(repoRoot, 'apps', 'web')), ...walk(join(repoRoot, 'apps', 'api'))].filter(
  (f) => !f.endsWith('.tsbuildinfo') && !/art-manifest\.json$/.test(f),
);

describe('zero vestígios de rascunho (apps/web + apps/api)', () => {
  it('varre uma quantidade razoável de arquivos (o teste não pode passar varrendo nada)', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it.each(FORBIDDEN)('nenhuma ocorrência de: %s', (label, needle) => {
    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.includes(needle)) hits.push(`${relative(repoRoot, file)}:${i + 1}`);
      });
    }
    expect(hits, `"${label}" ainda aparece`).toEqual([]);
  });
});

describe('o que substituiu os vestígios', () => {
  const read = (...p: string[]) => readFileSync(join(repoRoot, 'apps', 'web', ...p), 'utf8');

  it('a mensagem de API fora do ar fala com a pessoa, não com o desenvolvedor', () => {
    const src = read('lib', 'api.ts');
    expect(src).toContain('Não consegui falar com o servidor agora');
  });

  it('a landing lista os 9 módulos do currículo (incluindo a Batalha contra a dívida)', () => {
    const src = read('app', '(site)', 'landing.tsx');
    const block = src.slice(src.indexOf('const MODULOS = ['), src.indexOf('];', src.indexOf('const MODULOS = [')));
    expect(block.match(/^\s+'.+',$/gm)).toHaveLength(9);
    expect(block).toContain('Batalha contra a dívida');
    expect(src).toContain('em 9 módulos');
  });

  it('o desafio semanal não promete acompanhamento que não existe', () => {
    const src = read('lib', 'i18n-locales', 'pt-br.ts');
    expect(src).not.toContain('Eu te aviso como você está indo');
    expect(src).not.toContain('O Caramelo já anotou pra acompanhar');
    expect(src).toContain('ainda não confere o desafio no seu extrato');
  });
});
