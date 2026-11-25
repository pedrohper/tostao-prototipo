// T6.12 · guardas da escala de design, lendo o código-fonte: texto nunca abaixo de 12 px, tokens definidos e em uso nas
// telas que já migraram.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const sources = (dir: string) =>
  readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.spec\./.test(f))
    .map((f) => join(dir, f));
const all = [...sources('app'), ...sources('components')];

/** Todas as formas de escrever um tamanho de fonte à mão: classe do Tailwind (px ou rem), CSS e style em JSX. */
const HANDWRITTEN = [
  { re: /text-\[(?:length:)?(\d*\.?\d+)px\]/g, px: 1 },
  { re: /text-\[(?:length:)?(\d*\.?\d+)r?em\]/g, px: 16 },
  { re: /font-size:\s*(\d*\.?\d+)px/g, px: 1 },
  { re: /font-size:\s*(\d*\.?\d+)r?em/g, px: 16 },
  { re: /fontSize[:=]\s*[{'"]*(\d*\.?\d+)(?:px)?['"}]*(?=\s*[,}\n/])/g, px: 1 },
];
const tooSmall = (source: string) =>
  HANDWRITTEN.flatMap(({ re, px }) => [...source.matchAll(re)].filter((m) => Number(m[1]) * px < 12).map((m) => m[0]));

describe('texto mínimo de 12 px', () => {
  it('a própria guarda enxerga os tamanhos proibidos', () => {
    for (const bad of [
      'text-[10px]',
      'lg:text-[11px]',
      'text-[0.7rem]',
      'font-size: 11px;',
      'style={{ fontSize: 9 }}',
    ]) {
      expect(tooSmall(`${bad}\n`), bad).toHaveLength(1);
    }
    expect(tooSmall('text-[12px] text-[#101010] font-size: 12px; fontSize: 13,')).toEqual([]);
  });

  it('nada menor que 12 px em app/ e components/ (inclusive text-[10px] e text-[11px])', () => {
    expect(all.length).toBeGreaterThan(150);
    const found = all.flatMap((file) => tooSmall(read(file)).map((size) => `${file}: ${size}`));
    expect(found).toEqual([]);
  });

  it('dinheiro nunca abaixo de 13 px: nenhuma linha escreve um valor num texto de 12 px', () => {
    const found = all.flatMap((file) =>
      read(file)
        .split('\n')
        .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
        .filter(({ line }) => /(?<![\w-])(text-xs|text-mini|text-\[12px\])(?![\w-])/.test(line))
        .filter(({ line }) => /\b(money|formatCompactMoney|compacto)\(|R\$ ?\d/.test(line))
        .map(({ at }) => at),
    );
    expect(found).toEqual([]);
  });
});

describe('tokens', () => {
  const css = read('app/globals.css');
  const theme = css.slice(css.indexOf('@theme {'), css.indexOf('@custom-variant'));

  it.each([
    ['--text-mini', '12px'],
    ['--text-small', '13px'],
    ['--text-body', '15px'],
    ['--text-title', '22px'],
    ['--text-hero', '28px'],
    ['--radius-card', '22px'],
    ['--radius-control', '14px'],
  ])('%s vale %s', (token, value) => {
    expect(theme).toContain(`${token}: ${value};`);
    if (token.startsWith('--text-')) expect(theme).toContain(`${token}--line-height:`);
  });

  it('Home, Carteira, Anotar e navegação não escrevem à mão um valor que já tem token', () => {
    const migrated = [
      ...sources('app/(app)/inicio'),
      ...sources('app/(app)/carteira'),
      ...sources('app/(app)/anotar'),
      ...['nav', 'lateral', 'quick-add-sheet', 'quick-add-fields'].map((name) => `components/${name}.tsx`),
    ];
    expect(migrated.length).toBeGreaterThan(40);
    const found = migrated.flatMap((file) =>
      [...read(file).matchAll(/text-\[(?:12|13|15|22|28)px\]|rounded(?:-[a-z]{1,2})?-\[(?:14|22)px\]/g)].map(
        (m) => `${file}: ${m[0]}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
