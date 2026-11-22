import { describe, expect, it, vi } from 'vitest';
import type { CategoryDTO } from '@tostao/contracts';
import {
  createAndClassify,
  filterCategories,
  mergeCategories,
  normalizeSearch,
  SEARCH_THRESHOLD,
  SOFT_COLORS,
  swallowEnter,
  visibleCategories,
} from './category-picker';

const cat = (id: string, name = id, kind: CategoryDTO['kind'] = 'saida'): CategoryDTO => ({
  id,
  name,
  emoji: '🏷️',
  color: '#FFE1E7',
  kind,
  custom: false,
});

describe('busca', () => {
  const list = [cat('saude', 'Saúde'), cat('mercado', 'Mercado'), cat('beleza', 'Beleza e cuidados')];
  it('ignora acento, maiúscula e espaço sobrando', () => {
    expect(normalizeSearch('  SAÚDE  ')).toBe('saude');
    expect(filterCategories(list, 'saude').map((c) => c.id)).toEqual(['saude']);
    expect(filterCategories(list, 'CUIDA').map((c) => c.id)).toEqual(['beleza']);
  });
  it('busca vazia devolve tudo; sem resultado devolve vazio', () => {
    expect(filterCategories(list, '   ')).toHaveLength(3);
    expect(filterCategories(list, 'xyz')).toEqual([]);
  });
  it('a barra de busca só entra com mais de 10 categorias', () => {
    expect(SEARCH_THRESHOLD).toBe(10);
  });
});

describe('lista', () => {
  it('visibleCategories: só o tipo, e a neutra ("Não conta") no fim quando pedida', () => {
    const all = [cat('a'), cat('nao-conta', 'Não conta', 'neutra'), cat('b'), cat('s', 'Salário', 'entrada')];
    expect(visibleCategories(all, 'saida', false).map((c) => c.id)).toEqual(['a', 'b']);
    expect(visibleCategories(all, 'saida', true).map((c) => c.id)).toEqual(['a', 'b', 'nao-conta']);
    expect(visibleCategories(all, 'entrada', false).map((c) => c.id)).toEqual(['s']);
  });
  it('mergeCategories não repete id (depois do refresh o servidor já traz a criada)', () => {
    const merged = mergeCategories([cat('a'), cat('nova', 'Nova (servidor)')], [cat('nova', 'Nova (local)'), cat('x')]);
    expect(merged.map((c) => c.id)).toEqual(['a', 'nova', 'x']);
    expect(merged.find((c) => c.id === 'nova')?.name).toBe('Nova (servidor)');
  });
  it('paleta: 6 cores #RRGGBB (as que a API aceita)', () => {
    expect(SOFT_COLORS).toHaveLength(6);
    for (const c of SOFT_COLORS) expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('createAndClassify ("+ Criar categoria")', () => {
  const input = { name: '  Mesada ', kind: 'entrada' as const, color: '#DDF6E8' };

  it('cria com o nome sem espaço sobrando e manda cor e tipo; do mesmo tipo da lista → selecionada', async () => {
    const onCreate = vi.fn().mockResolvedValue({ category: cat('c1', 'Mesada', 'entrada') });
    const out = await createAndClassify(onCreate, input, 'entrada', 'erro');
    expect(onCreate).toHaveBeenCalledWith({ name: 'Mesada', kind: 'entrada', color: '#DDF6E8' });
    expect(out).toEqual({ status: 'selected', category: cat('c1', 'Mesada', 'entrada') });
  });

  it('tipo diferente da lista: criada, mas não selecionada', async () => {
    const onCreate = vi.fn().mockResolvedValue({ category: cat('c2', 'Mesada', 'entrada') });
    const out = await createAndClassify(onCreate, input, 'saida', 'erro');
    expect(out.status).toBe('other-kind');
  });

  it('erro da API (ex.: nome repetido) vira mensagem, sem lançar', async () => {
    const onCreate = vi.fn().mockResolvedValue({ error: 'Já tem uma categoria com esse nome.' });
    expect(await createAndClassify(onCreate, input, 'entrada', 'erro')).toEqual({
      status: 'error',
      message: 'Já tem uma categoria com esse nome.',
    });
  });

  it('queda de rede (promessa rejeitada) e resposta vazia usam a mensagem padrão', async () => {
    const cai = vi.fn().mockRejectedValue(new Error('network'));
    expect(await createAndClassify(cai, input, 'entrada', 'Tenta de novo?')).toEqual({
      status: 'error',
      message: 'Tenta de novo?',
    });
    const vazio = vi.fn().mockResolvedValue({});
    expect((await createAndClassify(vazio, input, 'entrada', 'Tenta de novo?')).status).toBe('error');
  });
});

describe('swallowEnter (Enter não envia o formulário de fora)', () => {
  it('Enter: barra o envio e executa a ação', () => {
    const preventDefault = vi.fn();
    const then = vi.fn();
    swallowEnter({ key: 'Enter', preventDefault }, then);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(then).toHaveBeenCalledOnce();
  });
  it('outras teclas passam direto', () => {
    const preventDefault = vi.fn();
    const then = vi.fn();
    swallowEnter({ key: 'a', preventDefault }, then);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(then).not.toHaveBeenCalled();
  });
});
