import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeAiGateway } from '../gateways/ai-gateway.js';
import { AutoCategorizeUseCase } from './auto-categorize.js';

function setup() {
  const repos = makeInMemoryRepositories();
  const ai = new FakeAiGateway();
  const add = (description: string, amountInCents: number, extra: { categoryId?: string; isInternalTransfer?: boolean } = {}) =>
    repos.transactions.create({ userId: 'u1', accountId: 'a1', externalId: null, description, amountInCents, occurredAt: new Date('2026-11-10T12:00:00Z'), categoryId: extra.categoryId ?? null, isInternalTransfer: extra.isInternalTransfer ?? false });
  return { repos, ai, add, uc: new AutoCategorizeUseCase(repos, ai) };
}

describe('Categoria automática com IA', () => {
  it('categoriza o que a IA sabe e deixa pendente nome de pessoa', async () => {
    const { repos, ai, add, uc } = setup();
    const ifood = await add('IFOOD *RESTAURANTE', -4590);
    const pix = await add('PIX ENVIADO JOAO DA SILVA', -2000);
    const uber = await add('UBER *TRIP', -1890);
    // ordem: mais recente primeiro; todas na mesma data, então a ordem segue a da lista
    const order = (await repos.transactions.findUncategorized('u1')).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).map((t) => t.id);
    const map: Record<string, string | null> = {};
    map[String(order.indexOf(ifood.id))] = 'delivery';
    map[String(order.indexOf(pix.id))] = null;
    map[String(order.indexOf(uber.id))] = 'transporte';
    ai.next = JSON.stringify({ t: map });

    const r = await uc.execute({ userId: 'u1' });
    expect(r).toEqual({ categorized: 2, asked: 3 });
    expect((await repos.transactions.findById(ifood.id))!.categoryId).toBe('delivery');
    expect((await repos.transactions.findById(uber.id))!.categoryId).toBe('transporte');
    expect((await repos.transactions.findById(pix.id))!.categoryId).toBeNull();
  });

  it('ignora categoria inventada, "Não conta" e sinal trocado', async () => {
    const { repos, ai, add, uc } = setup();
    const a = await add('LOJA X', -1000);
    ai.next = JSON.stringify({ t: { '0': 'salario' } }); // saída em categoria de entrada
    expect((await uc.execute({ userId: 'u1' })).categorized).toBe(0);
    ai.next = JSON.stringify({ t: { '0': 'nao-conta' } });
    expect((await uc.execute({ userId: 'u1' })).categorized).toBe(0);
    ai.next = JSON.stringify({ t: { '0': 'categoria-que-nao-existe' } });
    expect((await uc.execute({ userId: 'u1' })).categorized).toBe(0);
    ai.next = 'isso não é json';
    expect((await uc.execute({ userId: 'u1' })).categorized).toBe(0);
    expect((await repos.transactions.findById(a.id))!.categoryId).toBeNull();
  });

  it('mesma descrição recebe a mesma categoria, numa pergunta só', async () => {
    const { repos, ai, add, uc } = setup();
    const a = await add('MP*MELIMAIS 10/11', -1990);
    const b = await add('MP*MELIMAIS 10/10', -1990);
    ai.next = JSON.stringify({ t: { '0': 'assinaturas' } });
    expect(await uc.execute({ userId: 'u1' })).toEqual({ categorized: 2, asked: 2 });
    expect(ai.calls[0]![1]!.content.match(/MELIMAIS/g)).toHaveLength(1);
    expect((await repos.transactions.findById(a.id))!.categoryId).toBe('assinaturas');
    expect((await repos.transactions.findById(b.id))!.categoryId).toBe('assinaturas');
  });

  it('não mexe em transferência interna e não roda sem IA', async () => {
    const { ai, add, uc } = setup();
    await add('TRANSF ENTRE CONTAS', -5000, { isInternalTransfer: true });
    expect(await uc.execute({ userId: 'u1' })).toEqual({ categorized: 0, asked: 0 });
    ai.next = JSON.stringify({ t: {} });
    expect(await uc.execute({ userId: 'u1' })).toEqual({ categorized: 0, asked: 0 });
  });
});
