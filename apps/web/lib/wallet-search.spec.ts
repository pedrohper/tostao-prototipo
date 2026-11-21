// T4.4 · busca instantânea da Carteira: acento, várias palavras, URL limpa.
import { describe, expect, it } from 'vitest';
import { cleanQuery, matchesQuery, searchTokens, withQuery } from './wallet-search';

const tx = {
  description: 'PIX ENVIADO MERCADO SÃO JOÃO',
  customDescription: 'Mercado da esquina',
  categoryName: 'Mercado',
  accountName: 'Nubank',
  note: 'compra do mês',
};

describe('searchTokens()', () => {
  it('só letras e números, sem acento, sem repetir', () => {
    expect(searchTokens('  Pizza do Zé! pizza')).toEqual(['pizza', 'do', 'ze']);
  });

  it('vazio e só símbolo não geram termo', () => {
    expect(searchTokens('')).toEqual([]);
    expect(searchTokens('%%% --')).toEqual([]);
  });

  it('limita a quantidade de termos', () => {
    expect(searchTokens('a b c d e f g h')).toHaveLength(6);
  });
});

describe('matchesQuery()', () => {
  it('acha por descrição do banco, apelido, categoria, conta ou nota', () => {
    for (const q of ['sao joao', 'esquina', 'mercado', 'nubank', 'do mes']) expect(matchesQuery(tx, q), q).toBe(true);
  });

  it('ignora acento e caixa nos dois lados', () => {
    expect(matchesQuery(tx, 'SÃO JOÃO')).toBe(true);
    expect(matchesQuery({ description: 'Açaí' }, 'acai')).toBe(true);
  });

  it('todas as palavras precisam aparecer (E), mesmo em campos diferentes', () => {
    expect(matchesQuery(tx, 'esquina nubank')).toBe(true);
    expect(matchesQuery(tx, 'esquina itau')).toBe(false);
  });

  it('busca vazia não filtra nada', () => {
    expect(matchesQuery(tx, '')).toBe(true);
    expect(matchesQuery(tx, '   ')).toBe(true);
  });

  it('campos nulos não quebram', () => {
    expect(matchesQuery({ description: 'Uber', customDescription: null, categoryName: null }, 'uber')).toBe(true);
  });
});

describe('cleanQuery() / withQuery()', () => {
  it('apara, junta espaços e limita o tamanho', () => {
    expect(cleanQuery('  oi   mundo ')).toBe('oi mundo');
    expect(cleanQuery('x'.repeat(200))).toHaveLength(80);
    expect(cleanQuery(null)).toBe('');
  });

  it('troca só o `q` e preserva o resto da URL (mês, filtro, conta...)', () => {
    expect(withQuery('mes=2026-11&filtro=saidas', 'pizza')).toBe('?mes=2026-11&filtro=saidas&q=pizza');
    expect(withQuery('mes=2026-11&q=velho', 'novo')).toBe('?mes=2026-11&q=novo');
  });

  it('busca vazia remove o `q` (e sem mais nada sobra "?")', () => {
    expect(withQuery('mes=2026-11&q=velho', '  ')).toBe('?mes=2026-11');
    expect(withQuery('q=velho', '')).toBe('?');
  });

  it('caracteres especiais são codificados (não quebram a URL)', () => {
    expect(withQuery('', 'pão & café')).toBe('?q=p%C3%A3o+%26+caf%C3%A9');
  });
});
