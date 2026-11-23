// T1.5 · lançamentos manuais: saldo de conta manual atômico, parcelamento de 0 centavo, marca manual de transferência,
// acerto com pessoa que não vira gasto.
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { NEUTRAL_CATEGORY_ID } from '../domain/entities.js';
import { CategorizeTransactionUseCase } from './categorize-transaction.js';
import { CreateManualAccountUseCase } from './create-manual-account.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { DeleteTransactionUseCase } from './delete-transaction.js';
import { UpdateTransactionUseCase } from './update-transaction.js';

const NOW = new Date('2026-11-20T15:00:00Z');
const TODAY = new Date('2026-11-18T15:00:00Z');
const FUTURE = new Date('2026-12-18T15:00:00Z');

async function setup() {
  const repos = makeInMemoryRepositories();
  const { account } = await new CreateManualAccountUseCase(repos).execute({
    userId: 'u1',
    name: 'Cofre',
    type: 'BANK',
    balanceInCents: 1000_00,
  });
  return {
    repos,
    account,
    create: new CreateManualTransactionUseCase(repos, () => NOW),
    update: new UpdateTransactionUseCase(repos, () => NOW),
    remove: new DeleteTransactionUseCase(repos, () => NOW),
    balance: async () => (await repos.accounts.listByUser('u1'))[0]!.balanceInCents,
  };
}
const spend = (o: Record<string, unknown>) => ({
  userId: 'u1',
  description: 'Gasto',
  amountInCents: 100_00,
  kind: 'saida' as const,
  occurredAt: TODAY,
  ...o,
});

describe('saldo de conta manual acompanha os lançamentos', () => {
  it('criar saída/entrada ajusta o saldo; lançamento futuro NÃO mexe no saldo de hoje', async () => {
    const s = await setup();
    await s.create.execute(spend({ accountId: s.account.id }));
    expect(await s.balance()).toBe(900_00);
    await s.create.execute(
      spend({ accountId: s.account.id, kind: 'entrada', amountInCents: 250_00, description: 'Mesada' }),
    );
    expect(await s.balance()).toBe(1150_00);
    await s.create.execute(spend({ accountId: s.account.id, occurredAt: FUTURE, amountInCents: 300_00 }));
    expect(await s.balance()).toBe(1150_00);
  });

  it('série "todo mês": só as ocorrências que já aconteceram entram no saldo', async () => {
    const s = await setup();
    await s.create.execute(spend({ accountId: s.account.id, repeat: 'mensal', amountInCents: 50_00 }));
    expect(await s.balance()).toBe(950_00); // só a de hoje; as 11 seguintes são futuras
  });

  it('editar valor e mover a data pro futuro ajusta pelo que mudou de peso', async () => {
    const s = await setup();
    const { transaction } = await s.create.execute(spend({ accountId: s.account.id }));
    await s.update.execute({ userId: 'u1', transactionId: transaction.id, amountInCents: -250_00 });
    expect(await s.balance()).toBe(750_00);
    await s.update.execute({ userId: 'u1', transactionId: transaction.id, occurredAt: '2026-12-25' }); // vira futuro: devolve
    expect(await s.balance()).toBe(1000_00);
    await s.update.execute({ userId: 'u1', transactionId: transaction.id, occurredAt: '2026-11-19' }); // volta ao passado
    expect(await s.balance()).toBe(750_00);
  });

  it('excluir devolve o valor; excluir a série devolve só o que já tinha pesado', async () => {
    const s = await setup();
    const one = await s.create.execute(spend({ accountId: s.account.id }));
    await s.remove.execute({ userId: 'u1', transactionId: one.transaction.id });
    expect(await s.balance()).toBe(1000_00);
    const serie = await s.create.execute(spend({ accountId: s.account.id, repeat: 'mensal', amountInCents: 40_00 }));
    expect(await s.balance()).toBe(960_00);
    const r = await s.remove.execute({ userId: 'u1', transactionId: serie.transaction.id, series: true });
    expect(r.deleted).toBe(12);
    expect(await s.balance()).toBe(1000_00);
  });

  it('dois lançamentos ao mesmo tempo não se perdem (ajuste atômico balance = balance + delta)', async () => {
    const s = await setup();
    await Promise.all(
      Array.from({ length: 5 }, () => s.create.execute(spend({ accountId: s.account.id, amountInCents: 10_00 }))),
    );
    expect(await s.balance()).toBe(950_00);
  });

  it('conta CONECTADA (banco) não é mexida por anotação à mão: o saldo vem do banco', async () => {
    const s = await setup();
    const conn = await s.repos.connections.create({ userId: 'u1', itemId: 'item-banco', institution: 'B' });
    const acc = await s.repos.accounts.upsertByExternalId({
      userId: 'u1',
      connectionId: conn.id,
      externalId: 'item-banco:cc',
      name: 'C',
      type: 'BANK',
      balanceInCents: 500_00,
      fingerprint: null,
    });
    await s.create.execute(spend({ accountId: acc.id }));
    expect((await s.repos.accounts.listByUser('u1')).find((a) => a.id === acc.id)!.balanceInCents).toBe(500_00);
  });
});

describe('parcelamento sem parcela de 0 centavo', () => {
  it('R$ 0,05 em 12x é recusado com 400 e NADA é gravado', async () => {
    const s = await setup();
    await expect(s.create.execute(spend({ amountInCents: 5, repeat: 'parcelado', times: 12 }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(s.repos.transactions.items).toHaveLength(0);
  });
  it('o mínimo que divide (12 centavos em 12x) passa; 11 centavos em 12x não', async () => {
    const s = await setup();
    await expect(s.create.execute(spend({ amountInCents: 12, repeat: 'parcelado', times: 12 }))).resolves.toMatchObject(
      { count: 12 },
    );
    await expect(s.create.execute(spend({ amountInCents: 11, repeat: 'parcelado', times: 12 }))).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('transferência: a palavra da pessoa fica registrada', () => {
  it('marcar/desmarcar grava internalTransferManual (true/false); editar outro campo não mexe nele', async () => {
    const s = await setup();
    const { transaction } = await s.create.execute(spend({}));
    expect(transaction.internalTransferManual ?? null).toBeNull();
    await s.update.execute({ userId: 'u1', transactionId: transaction.id, isInternalTransfer: true });
    expect(await s.repos.transactions.findById(transaction.id)).toMatchObject({
      isInternalTransfer: true,
      internalTransferManual: true,
    });
    await s.update.execute({ userId: 'u1', transactionId: transaction.id, isInternalTransfer: false });
    expect(await s.repos.transactions.findById(transaction.id)).toMatchObject({
      isInternalTransfer: false,
      internalTransferManual: false,
    });
    await s.update.execute({ userId: 'u1', transactionId: transaction.id, note: 'só uma nota' });
    expect((await s.repos.transactions.findById(transaction.id))!.internalTransferManual).toBe(false);
  });
});

describe('T4.4 · apelido (customDescription) não toca na descrição original', () => {
  it('em lançamento do banco: grava só o apelido, a descrição do banco e o externalId ficam intactos', async () => {
    const s = await setup();
    const bank = await s.repos.transactions.create({
      userId: 'u1',
      accountId: null,
      externalId: 'pluggy-1',
      description: 'PIX ENVIADO 12.345.678/0001-90',
      amountInCents: -42_00,
      occurredAt: TODAY,
      categoryId: null,
      isInternalTransfer: false,
    });
    await s.update.execute({ userId: 'u1', transactionId: bank.id, customDescription: '  Mercado da esquina  ' });
    expect(await s.repos.transactions.findById(bank.id)).toMatchObject({
      description: 'PIX ENVIADO 12.345.678/0001-90',
      customDescription: 'Mercado da esquina',
      externalId: 'pluggy-1',
    });
    // Editar a descrição de lançamento do banco continua proibido (é a base da conciliação).
    await expect(
      s.update.execute({ userId: 'u1', transactionId: bank.id, description: 'outra' }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('vazio ou null apaga o apelido; limite de 80 caracteres no contrato', async () => {
    const s = await setup();
    const { transaction } = await s.create.execute(spend({}));
    await s.update.execute({ userId: 'u1', transactionId: transaction.id, customDescription: 'Apelido' });
    expect((await s.repos.transactions.findById(transaction.id))!.customDescription).toBe('Apelido');
    await s.update.execute({ userId: 'u1', transactionId: transaction.id, customDescription: '' });
    expect((await s.repos.transactions.findById(transaction.id))!.customDescription).toBeNull();
    const { updateTransactionBody } = await import('@tostao/contracts');
    expect(updateTransactionBody.safeParse({ customDescription: 'x'.repeat(81) }).success).toBe(false);
    expect(updateTransactionBody.safeParse({ customDescription: 'x'.repeat(80) }).success).toBe(true);
  });

  it('não dá pra apelidar o lançamento de outra pessoa', async () => {
    const s = await setup();
    const { transaction } = await s.create.execute(spend({}));
    await expect(
      s.update.execute({ userId: 'outra', transactionId: transaction.id, customDescription: 'meu' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('acerto com pessoa nunca vira gasto', () => {
  it('sair de "Não conta" preserva isInternalTransfer quando há personId; sem pessoa, volta a ser gasto', async () => {
    const s = await setup();
    const cat = new CategorizeTransactionUseCase(s.repos);
    const person = await s.repos.people.create({ userId: 'u1', name: 'João' });
    const base = {
      userId: 'u1',
      accountId: null,
      externalId: null,
      description: 'emprestei',
      amountInCents: -80_00,
      occurredAt: TODAY,
      categoryId: NEUTRAL_CATEGORY_ID,
      isInternalTransfer: true,
      seriesId: null,
    };
    const withPerson = await s.repos.transactions.create({ ...base, personId: person.id });
    const without = await s.repos.transactions.create({ ...base, personId: null });
    await cat.execute({ userId: 'u1', transactionId: withPerson.id, categoryId: 'mercado', remember: false });
    await cat.execute({ userId: 'u1', transactionId: without.id, categoryId: 'mercado', remember: false });
    expect((await s.repos.transactions.findById(withPerson.id))!.isInternalTransfer).toBe(true);
    expect((await s.repos.transactions.findById(without.id))!.isInternalTransfer).toBe(false);
  });
});

describe('pendências (pago / recebido)', () => {
  it('lançamento criado com settled=false fica fora do saldo manual até marcar como pago e soma em pendências do mês', async () => {
    const s = await setup();
    const { summarizeMonth } = await import('./month-aggregation.js');
    const created = await s.create.execute(
      spend({ accountId: s.account.id, amountInCents: 200_00, description: 'Aluguel', settled: false }),
    );
    await s.create.execute(
      spend({
        accountId: s.account.id,
        kind: 'entrada',
        amountInCents: 500_00,
        description: 'Freela',
        settled: false,
      }),
    );
    // Ainda não foi pago/recebido: saldo da conta manual não mudou.
    expect(await s.balance()).toBe(1000_00);

    const before = summarizeMonth(
      {
        tz: 'America/Sao_Paulo',
        accounts: await s.repos.accounts.listByUser('u1'),
        categories: [],
        txs: s.repos.transactions.items,
      },
      '2026-11',
      NOW,
    );
    expect(before.pendingExpensesCount).toBe(1);
    expect(before.pendingExpensesInCents).toBe(200_00);
    expect(before.pendingIncomesCount).toBe(1);
    expect(before.pendingIncomesInCents).toBe(500_00);

    await s.update.execute({ userId: 'u1', transactionId: created.transaction.id, settled: true });
    expect(await s.balance()).toBe(800_00);

    const after = summarizeMonth(
      {
        tz: 'America/Sao_Paulo',
        accounts: await s.repos.accounts.listByUser('u1'),
        categories: [],
        txs: s.repos.transactions.items,
      },
      '2026-11',
      NOW,
    );
    expect(after.pendingExpensesCount).toBe(0);
    expect(after.pendingExpensesInCents).toBe(0);
  });
});
