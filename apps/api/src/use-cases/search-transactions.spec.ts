import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { SearchTransactionsUseCase } from './search-transactions.js';

const NOW = new Date('2026-11-12T12:00:00Z');

async function setup() {
  const repos = makeInMemoryRepositories();
  const add = (description: string, amountInCents: number, date: string, extra: { categoryId?: string; isInternalTransfer?: boolean } = {}) =>
    repos.transactions.create({ userId: 'u1', accountId: null, externalId: null, description, amountInCents, occurredAt: new Date(`${date}T12:00:00Z`), categoryId: extra.categoryId ?? null, isInternalTransfer: extra.isInternalTransfer ?? false });
  await add('PIX ENVIADO DANIELA SOUZA', -5000, '2026-11-01');
  await add('Pix enviado - Daniela Souza', -2500, '2026-08-01');
  await add('PIX RECEBIDO DANIELA SOUZA', 1000, '2026-10-01');
  await add('IFD*Açaí do Zé', -3200, '2026-11-05', { categoryId: 'delivery' });
  await add('PAGAMENTO DE FATURA', -9000, '2026-11-06', { isInternalTransfer: true });
  await add('IFOOD antigo', -1000, '2024-01-01', { categoryId: 'delivery' });
  return { repos, uc: new SearchTransactionsUseCase(repos, () => NOW) };
}

describe('Busca de transações', () => {
  it('acha Pix por nome e soma quanto saiu e entrou', async () => {
    const { uc } = await setup();
    const r = await uc.execute({ userId: 'u1', q: 'dani', period: '12m', kind: 'todas' });
    expect(r.count).toBe(3);
    expect(r.outInCents).toBe(7500);
    expect(r.inInCents).toBe(1000);
    expect(r.transactions[0]!.description).toBe('PIX ENVIADO DANIELA SOUZA'); // mais recente primeiro
  });

  it('ignora acento e acha pela categoria; período corta o antigo', async () => {
    const { uc } = await setup();
    expect((await uc.execute({ userId: 'u1', q: 'acai', period: '12m', kind: 'todas' })).count).toBe(1);
    expect((await uc.execute({ userId: 'u1', q: 'delivery', period: '12m', kind: 'todas' })).count).toBe(1);
    expect((await uc.execute({ userId: 'u1', q: 'delivery', period: 'tudo', kind: 'todas' })).count).toBe(2);
    expect((await uc.execute({ userId: 'u1', q: 'dani', period: '30d', kind: 'saida' })).count).toBe(1);
  });

  it('transferência interna aparece mas não soma', async () => {
    const { uc } = await setup();
    const r = await uc.execute({ userId: 'u1', q: 'fatura', period: '12m', kind: 'todas' });
    expect(r.count).toBe(1);
    expect(r.outInCents).toBe(0);
  });
});
