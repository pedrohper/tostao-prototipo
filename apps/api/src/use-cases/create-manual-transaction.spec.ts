import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';

describe('CreateManualTransactionUseCase', () => {
  it('permite registrar despesa com data futura (e.g. 2027) com valor negativo', async () => {
    const repos = makeInMemoryRepositories();
    const uc = new CreateManualTransactionUseCase(repos);

    const futureDate = new Date('2027-06-15T12:00:00Z');
    const result = await uc.execute({
      userId: 'user-1',
      description: 'Ingresso show no futuro',
      amountInCents: 15000,
      kind: 'saida',
      occurredAt: futureDate,
      repeat: 'nao',
    });

    expect(result.count).toBe(1);
    expect(result.transaction.amountInCents).toBe(-15000);
    expect(result.transaction.description).toBe('Ingresso show no futuro');
    expect(result.transaction.occurredAt.toISOString()).toBe(futureDate.toISOString());
  });

  it('permite registrar entrada com data futura com valor positivo', async () => {
    const repos = makeInMemoryRepositories();
    const uc = new CreateManualTransactionUseCase(repos);

    const futureDate = new Date('2027-01-10T12:00:00Z');
    const result = await uc.execute({
      userId: 'user-1',
      description: 'Bônus futuro prometido',
      amountInCents: 50000,
      kind: 'entrada',
      occurredAt: futureDate,
      repeat: 'nao',
    });

    expect(result.count).toBe(1);
    expect(result.transaction.amountInCents).toBe(50000);
    expect(result.transaction.description).toBe('Bônus futuro prometido');
    expect(result.transaction.occurredAt.toISOString()).toBe(futureDate.toISOString());
  });

  it('preserva accountId e gera parcelas futuras a partir da data informada', async () => {
    const repos = makeInMemoryRepositories();
    // Criamos conta no repositório em memória para o usuário
    const account = await repos.accounts.upsertByExternalId({
      userId: 'user-1',
      name: 'Mercado Pago Cartão',
      type: 'CREDIT',
      balanceInCents: 0,
      connectionId: 'conn-1',
      externalId: 'ext-mp-1',
      fingerprint: 'fp-mp-1',
    });

    const uc = new CreateManualTransactionUseCase(repos);
    const startDate = new Date('2027-03-01T12:00:00Z');

    const result = await uc.execute({
      userId: 'user-1',
      description: 'Notebook novo',
      amountInCents: 300000,
      kind: 'saida',
      occurredAt: startDate,
      accountId: account.id,
      repeat: 'parcelado',
      times: 3,
    });

    expect(result.count).toBe(3);
    const all = await repos.transactions.findManyInRange(
      'user-1',
      new Date('2027-01-01T00:00:00Z'),
      new Date('2028-01-01T00:00:00Z'),
    );
    expect(all.length).toBe(3);
    expect(all.every((t) => t.accountId === account.id)).toBe(true);
    // Ordenados do mais recente pro mais antigo por findManyInRange:
    expect(all[2]?.description).toBe('Notebook novo (1/3)');
    expect(all[1]?.description).toBe('Notebook novo (2/3)');
    expect(all[0]?.description).toBe('Notebook novo (3/3)');
    expect(all[2]?.occurredAt.getUTCMonth()).toBe(2); // Março (0-indexed 2)
    expect(all[1]?.occurredAt.getUTCMonth()).toBe(3); // Abril
    expect(all[0]?.occurredAt.getUTCMonth()).toBe(4); // Maio
  });
});
