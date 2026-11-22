// T5.2 · vínculo explícito: "É pagamento de fatura" / "Transferi pra outra conta minha" (detalhe do lançamento).
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { CreateManualAccountUseCase } from './create-manual-account.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { DeleteTransactionUseCase } from './delete-transaction.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { TransferLinkUseCase } from './transfer-link.js';
import { UpdateTransactionUseCase } from './update-transaction.js';

const NOW = new Date('2026-11-20T15:00:00Z');

async function setup() {
  const repos = makeInMemoryRepositories();
  const mk = new CreateManualAccountUseCase(repos);
  const { account: bank } = await mk.execute({ userId: 'u1', name: 'Conta', type: 'BANK', balanceInCents: 1000_00 });
  const { account: savings } = await mk.execute({
    userId: 'u1',
    name: 'Poupança',
    type: 'BANK',
    balanceInCents: 500_00,
  });
  const { account: card } = await mk.execute({ userId: 'u1', name: 'Cartão', type: 'CREDIT', balanceInCents: 400_00 }); // fatura -400
  const create = new CreateManualTransactionUseCase(repos, () => NOW);
  const link = new TransferLinkUseCase(repos, () => NOW);
  const bal = async (id: string) => (await repos.accounts.listByUser('u1')).find((a) => a.id === id)!.balanceInCents;
  const payment = async (over: Record<string, unknown> = {}) =>
    (
      await create.execute({
        userId: 'u1',
        description: 'PAG FATURA',
        amountInCents: 400_00,
        kind: 'saida',
        occurredAt: NOW,
        accountId: bank.id,
        ...over,
      })
    ).transaction;
  return { repos, bank, savings, card, create, link, bal, payment };
}

describe('"É pagamento de fatura"', () => {
  it('liga ao cartão: sai dos gastos, a fatura cai e a conta cai (saldos coerentes)', async () => {
    const { repos, bank, card, link, bal, payment } = await setup();
    const t = await payment();
    expect(await bal(bank.id)).toBe(600_00);
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: card.id });
    const after = (await repos.transactions.findById(t.id))!;
    expect(after).toMatchObject({
      isInternalTransfer: true,
      internalTransferManual: true,
      linkedAccountId: card.id,
      linkKind: 'card_payment',
    });
    expect(await bal(card.id)).toBe(0); // fatura -400 + pagamento 400
    expect(await bal(bank.id)).toBe(600_00); // a conta não é debitada duas vezes
    // contrapartida no cartão
    const mirror = await repos.transactions.findByExternalId('u1', `link:${t.id}`);
    expect(mirror).toMatchObject({
      accountId: card.id,
      amountInCents: 400_00,
      isInternalTransfer: true,
      linkKind: 'card_payment',
    });
    // não é gasto do mês
    const s = await new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId: 'u1', month: '2026-11' });
    expect(s.outcomeInCents).toBe(0);
  });

  it('trocar de cartão move a contrapartida e devolve o saldo do primeiro', async () => {
    const { repos, bank, card, link, bal, payment } = await setup();
    const { account: card2 } = await new CreateManualAccountUseCase(repos).execute({
      userId: 'u1',
      name: 'Cartão 2',
      type: 'CREDIT',
      balanceInCents: 100_00,
    });
    const t = await payment();
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: card.id });
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: card2.id });
    expect(await bal(card.id)).toBe(-400_00); // voltou
    expect(await bal(card2.id)).toBe(300_00); // -100 + 400
    expect(await bal(bank.id)).toBe(600_00);
    const mirrors = (
      await repos.transactions.findManyInRange('u1', new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'))
    ).filter((x) => x.externalId === `link:${t.id}`);
    expect(mirrors).toHaveLength(1); // nunca duas
  });

  it('refazer o mesmo vínculo é idempotente (saldo não anda de novo)', async () => {
    const { card, link, bal, payment } = await setup();
    const t = await payment();
    for (let i = 0; i < 3; i++)
      await link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: card.id });
    expect(await bal(card.id)).toBe(0);
  });

  it('desfazer (none): remove a contrapartida, devolve o saldo e volta a ser gasto', async () => {
    const { repos, bank, card, link, bal, payment } = await setup();
    const t = await payment();
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: card.id });
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'none' });
    expect(await bal(card.id)).toBe(-400_00);
    expect(await bal(bank.id)).toBe(600_00);
    expect(await repos.transactions.findByExternalId('u1', `link:${t.id}`)).toBeNull();
    const after = (await repos.transactions.findById(t.id))!;
    expect(after).toMatchObject({ isInternalTransfer: false, linkedAccountId: null, linkKind: null });
  });

  it('apagar o lançamento original leva a contrapartida junto e devolve o saldo do cartão', async () => {
    const { repos, bank, card, link, bal, payment } = await setup();
    const t = await payment();
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: card.id });
    await new DeleteTransactionUseCase(repos, () => NOW).execute({ userId: 'u1', transactionId: t.id });
    expect(await bal(card.id)).toBe(-400_00);
    expect(await bal(bank.id)).toBe(1000_00);
    expect(await repos.transactions.findByExternalId('u1', `link:${t.id}`)).toBeNull();
  });

  it('a contrapartida não pode ser apagada sozinha (desfaça o vínculo)', async () => {
    const { repos, card, link, payment } = await setup();
    const t = await payment();
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: card.id });
    const mirror = (await repos.transactions.findByExternalId('u1', `link:${t.id}`))!;
    await expect(
      new DeleteTransactionUseCase(repos, () => NOW).execute({ userId: 'u1', transactionId: mirror.id }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(link.execute({ userId: 'u1', transactionId: mirror.id, kind: 'none' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('desmarcar "transferência" direto num lançamento LIGADO é recusado (senão a contrapartida e o saldo ficam soltos)', async () => {
    const { repos, card, link, bal, payment } = await setup();
    const t = await payment();
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: card.id });
    await expect(
      new UpdateTransactionUseCase(repos, () => NOW).execute({
        userId: 'u1',
        transactionId: t.id,
        isInternalTransfer: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await bal(card.id)).toBe(0);
    expect((await repos.transactions.findById(t.id))!.isInternalTransfer).toBe(true);
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'none' }); // o caminho certo
    await new UpdateTransactionUseCase(repos, () => NOW).execute({
      userId: 'u1',
      transactionId: t.id,
      isInternalTransfer: true,
    }); // e remarcar sem link continua valendo
  });

  it('exige um cartão: ligar a outra conta comum dá 400', async () => {
    const { savings, link, payment } = await setup();
    const t = await payment();
    await expect(
      link.execute({ userId: 'u1', transactionId: t.id, kind: 'card_payment', targetAccountId: savings.id }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('"Transferi pra outra conta minha"', () => {
  it('conta → poupança: a poupança sobe, a conta já desceu, nada vira gasto', async () => {
    const { repos, bank, savings, link, bal, payment } = await setup();
    const t = await payment({ description: 'Pix pra poupança', amountInCents: 200_00 });
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'transfer', targetAccountId: savings.id });
    expect(await bal(bank.id)).toBe(800_00);
    expect(await bal(savings.id)).toBe(700_00);
    const s = await new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId: 'u1', month: '2026-11' });
    expect(s.outcomeInCents).toBe(0);
    expect(s.incomeInCents).toBe(0);
  });

  it('mesma conta de origem é recusada; cartão no "transferi" também', async () => {
    const { bank, card, link, payment } = await setup();
    const t = await payment();
    await expect(
      link.execute({ userId: 'u1', transactionId: t.id, kind: 'transfer', targetAccountId: bank.id }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      link.execute({ userId: 'u1', transactionId: t.id, kind: 'transfer', targetAccountId: card.id }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('destino conectado ao banco: só marca (o banco traz o outro lado), sem contrapartida nem saldo', async () => {
    const { repos, bank, link, payment } = await setup();
    const conn = await repos.connections.create({ userId: 'u1', itemId: 'item-real', institution: 'Banco' });
    const real = await repos.accounts.upsertByExternalId({
      userId: 'u1',
      connectionId: conn.id,
      externalId: 'pl-1',
      name: 'Real',
      type: 'BANK',
      balanceInCents: 50_00,
      fingerprint: null,
    });
    const t = await payment({ amountInCents: 30_00 });
    await link.execute({ userId: 'u1', transactionId: t.id, kind: 'transfer', targetAccountId: real.id });
    expect(await repos.transactions.findByExternalId('u1', `link:${t.id}`)).toBeNull();
    expect((await repos.accounts.listByUser('u1')).find((a) => a.id === real.id)!.balanceInCents).toBe(50_00);
    expect((await repos.transactions.findById(t.id))!.isInternalTransfer).toBe(true);
    void bank;
  });

  it('lançamento de outra pessoa e conta de outra pessoa: 404', async () => {
    const { repos, savings, link, payment } = await setup();
    const t = await payment();
    await expect(
      link.execute({ userId: 'intruso', transactionId: t.id, kind: 'transfer', targetAccountId: savings.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      link.execute({ userId: 'u1', transactionId: t.id, kind: 'transfer', targetAccountId: 'nao-minha' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    void repos;
  });
});
