import { describe, expect, it } from 'vitest';
import { createCategoryBody } from '@tostao/contracts';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { CreateCategoryUseCase } from './categories.js';

describe('criar categoria (seletor "+ Criar categoria")', () => {
  it('usa a cor escolhida e devolve a categoria da pessoa', async () => {
    const repos = makeInMemoryRepositories();
    const { category } = await new CreateCategoryUseCase(repos).execute({
      userId: 'u1',
      name: 'Mesada',
      emoji: '🪙',
      kind: 'entrada',
      color: '#DCEBFF',
    });
    expect(category.color).toBe('#DCEBFF');
    expect(category.userId).toBe('u1');
    expect(category.kind).toBe('entrada');
  });

  it('sem cor, mantém o tom padrão do tipo (compatível com quem já chamava sem color)', async () => {
    const repos = makeInMemoryRepositories();
    const uc = new CreateCategoryUseCase(repos);
    const out = await uc.execute({ userId: 'u1', name: 'Rifa', emoji: '', kind: 'saida' });
    const inn = await uc.execute({ userId: 'u1', name: 'Bico', emoji: '', kind: 'entrada' });
    expect(out.category.color).toBe('#FFE3D6');
    expect(inn.category.color).toBe('#D8F7EC');
  });

  it('não deixa criar com o nome de uma categoria nova do sistema', async () => {
    const repos = makeInMemoryRepositories();
    await expect(
      new CreateCategoryUseCase(repos).execute({ userId: 'u1', name: 'pets', emoji: '', kind: 'saida' }),
    ).rejects.toThrow('Já tem');
  });
});

describe('createCategoryBody (contrato)', () => {
  const base = { name: 'Viagem de fim de ano', kind: 'saida' as const };
  it('aceita #RRGGBB e deixa a cor opcional', () => {
    expect(createCategoryBody.parse({ ...base, color: '#FFE1E7' }).color).toBe('#FFE1E7');
    expect(createCategoryBody.parse(base).color).toBeUndefined();
  });
  it('recusa cor que não é #RRGGBB (nada de CSS arbitrário vindo do cliente)', () => {
    for (const color of ['red', '#FFF', 'url(javascript:1)', '#GGGGGG', '#FFE1E7;x'])
      expect(createCategoryBody.safeParse({ ...base, color }).success, color).toBe(false);
  });
});
