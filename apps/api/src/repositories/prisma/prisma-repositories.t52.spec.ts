// T5.2/T5.3 contra Postgres REAL: tokens (limite sob corrida, hash único), webhook idempotente sob corrida,
// ajuste de saldo e vínculo de fatura/transferência com saldos conferidos no banco.
// Só roda com TEST_DATABASE_URL (banco descartável com as migrations e o seed).
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePrismaRepositories } from './index.js';
import { CreateManualAccountUseCase } from '../../use-cases/create-manual-account.js';
import { CreateManualTransactionUseCase } from '../../use-cases/create-manual-transaction.js';
import { AutomationTokensUseCase, ShortcutWebhookUseCase, hashToken } from '../../use-cases/automation.js';
import { DeleteTransactionUseCase } from '../../use-cases/delete-transaction.js';
import { GetMonthSummaryUseCase } from '../../use-cases/get-month-summary.js';
import { ReconcileBalanceUseCase } from '../../use-cases/reconcile-balance.js';
import { TransferLinkUseCase } from '../../use-cases/transfer-link.js';

const url = process.env.TEST_DATABASE_URL;
const uniq = () => randomUUID().slice(0, 8);
const NOW = new Date('2026-11-22T15:00:00Z');

describe.skipIf(!url)('T5.2 / T5.3 no Postgres real', () => {
  let db: PrismaClient;
  let repos: ReturnType<typeof makePrismaRepositories>;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
    repos = makePrismaRepositories(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  const newUser = () => db.user.create({ data: { name: 'Pessoa', email: `p-${uniq()}@x.com`, passwordHash: 'x' } });
  const balanceOf = async (id: string) =>
    Number((await db.account.findUniqueOrThrow({ where: { id } })).balanceInCents);

  describe('automation_tokens', () => {
    it('10 criações SIMULTÂNEAS: nunca passa de 3 ativos (a linha da pessoa é trancada)', async () => {
      const u = await newUser();
      const uc = new AutomationTokensUseCase(repos, () => NOW);
      const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => uc.create(u.id, `t${i}`)));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
      expect(await db.automationToken.count({ where: { userId: u.id, revokedAt: null } })).toBe(3);
      for (const r of results.filter((x) => x.status === 'rejected'))
        expect((r as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 });
    });

    it('só o hash fica no banco e é único; revogar libera vaga; pessoas diferentes não se afetam', async () => {
      const a = await newUser();
      const b = await newUser();
      const uc = new AutomationTokensUseCase(repos, () => NOW);
      const t = await uc.create(a.id, 'meu');
      const row = await db.automationToken.findUniqueOrThrow({ where: { id: t.item.id } });
      expect(row.tokenHash).toBe(hashToken(t.token));
      expect(JSON.stringify(row)).not.toContain(t.token);
      await expect(
        db.automationToken.create({ data: { userId: b.id, label: 'x', tokenHash: row.tokenHash } }),
      ).rejects.toThrow(); // UNIQUE(token_hash)
      await uc.create(a.id, '2');
      await uc.create(a.id, '3');
      await expect(uc.create(a.id, '4')).rejects.toMatchObject({ statusCode: 409 });
      await uc.revoke(a.id, t.item.id);
      await uc.revoke(a.id, t.item.id); // idempotente
      await uc.create(a.id, '4');
      await uc.create(b.id, 'do b');
      await expect(uc.revoke(b.id, t.item.id)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('apagar a conta (LGPD) leva os tokens junto (CASCADE)', async () => {
      const u = await newUser();
      await new AutomationTokensUseCase(repos, () => NOW).create(u.id, 'x');
      await db.user.delete({ where: { id: u.id } });
      expect(await db.automationToken.count({ where: { userId: u.id } })).toBe(0);
    });

    it('rótulo vazio ou > 60 caracteres: barrado pelo CHECK do banco', async () => {
      const u = await newUser();
      await expect(
        db.automationToken.create({ data: { userId: u.id, label: '', tokenHash: uniq() } }),
      ).rejects.toThrow();
      await expect(
        db.automationToken.create({ data: { userId: u.id, label: 'x'.repeat(61), tokenHash: uniq() } }),
      ).rejects.toThrow();
    });
  });

  describe('POST /webhooks/shortcuts (use case)', () => {
    it('8 entregas SIMULTÂNEAS do mesmo eventId: 1 lançamento, 1 baixa no saldo, todas devolvem o mesmo id', async () => {
      const u = await newUser();
      const { account } = await new CreateManualAccountUseCase(repos).execute({
        userId: u.id,
        name: 'Carteira',
        type: 'BANK',
        balanceInCents: 100_00,
      });
      const tokens = new AutomationTokensUseCase(repos, () => NOW);
      const token = await tokens.authenticate(`Bearer ${(await tokens.create(u.id, 'x')).token}`);
      const hook = new ShortcutWebhookUseCase(repos, new CreateManualTransactionUseCase(repos, () => NOW), () => NOW);
      const rs = await Promise.all(
        Array.from({ length: 8 }, () =>
          hook.execute(token, { source: 'apple_pay', amount: 25, accountId: account.id, eventId: 'evt-corrida' }),
        ),
      );
      expect(new Set(rs.map((r) => r.id)).size).toBe(1);
      expect(rs.filter((r) => !r.duplicate)).toHaveLength(1);
      expect(await db.transaction.count({ where: { userId: u.id } })).toBe(1);
      expect(await balanceOf(account.id)).toBe(75_00);
      const row = await db.transaction.findFirstOrThrow({ where: { userId: u.id } });
      expect(row.externalId).toBe(`shortcut:${token.id}:evt-corrida`);
      expect(Number(row.amountInCents)).toBe(-25_00);
      expect(row.occurredAt.toISOString()).toBe('2026-11-22T15:00:00.000Z'); // meio-dia de Brasília
    });

    it('o seed de regras categoriza: "IFOOD" cai em delivery', async () => {
      const u = await newUser();
      const tokens = new AutomationTokensUseCase(repos, () => NOW);
      const token = await tokens.authenticate(`Bearer ${(await tokens.create(u.id, 'x')).token}`);
      const hook = new ShortcutWebhookUseCase(repos, new CreateManualTransactionUseCase(repos, () => NOW), () => NOW);
      const r = await hook.execute(token, { source: 'apple_pay', text: 'Compra aprovada R$ 30,00 em IFOOD *PEDIDO' });
      const row = await db.transaction.findUniqueOrThrow({ where: { id: r.id } });
      expect(row.categoryId).not.toBeNull();
    });
  });

  describe('ajuste de saldo', () => {
    it('o saldo no BANCO fica exatamente no valor informado; o ajuste é transferência interna e não pesa no mês', async () => {
      const u = await newUser();
      const { account } = await new CreateManualAccountUseCase(repos).execute({
        userId: u.id,
        name: 'Cofre',
        type: 'BANK',
        balanceInCents: 1000_00,
      });
      await new CreateManualTransactionUseCase(repos, () => NOW).execute({
        userId: u.id,
        description: 'Mercado',
        amountInCents: 100_00,
        kind: 'saida',
        occurredAt: NOW,
        accountId: account.id,
      });
      const r = await new ReconcileBalanceUseCase(repos, () => NOW).execute({
        userId: u.id,
        accountId: account.id,
        targetBalanceInCents: 887_33,
      });
      expect(await balanceOf(account.id)).toBe(887_33);
      expect(r.deltaInCents).toBe(-12_67);
      const adj = await db.transaction.findUniqueOrThrow({ where: { id: r.transactionId! } });
      expect(adj).toMatchObject({
        isInternalTransfer: true,
        internalTransferManual: true,
        description: 'Ajuste de saldo',
      });
      expect(Number(adj.amountInCents)).toBe(-12_67);
      const s = await new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId: u.id, month: '2026-11' });
      expect(s.outcomeInCents).toBe(100_00);
      expect(s.incomeInCents).toBe(0);
    });

    it('conta de outra pessoa: 404 e o saldo dela não muda', async () => {
      const a = await newUser();
      const b = await newUser();
      const { account } = await new CreateManualAccountUseCase(repos).execute({
        userId: a.id,
        name: 'Cofre',
        type: 'BANK',
        balanceInCents: 50_00,
      });
      await expect(
        new ReconcileBalanceUseCase(repos, () => NOW).execute({
          userId: b.id,
          accountId: account.id,
          targetBalanceInCents: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(await balanceOf(account.id)).toBe(50_00);
    });
  });

  describe('vínculo de fatura / transferência', () => {
    async function scene() {
      const u = await newUser();
      const mk = new CreateManualAccountUseCase(repos);
      const { account: bank } = await mk.execute({
        userId: u.id,
        name: 'Conta',
        type: 'BANK',
        balanceInCents: 1000_00,
      });
      const { account: card } = await mk.execute({
        userId: u.id,
        name: 'Cartão',
        type: 'CREDIT',
        balanceInCents: 400_00,
      });
      const pay = (
        await new CreateManualTransactionUseCase(repos, () => NOW).execute({
          userId: u.id,
          description: 'PAG FATURA',
          amountInCents: 400_00,
          kind: 'saida',
          occurredAt: NOW,
          accountId: bank.id,
        })
      ).transaction;
      return { u, bank, card, pay };
    }

    it('pagamento de fatura: cartão zera, conta já tinha descido, sai dos gastos; contrapartida link:<id>', async () => {
      const { u, bank, card, pay } = await scene();
      const link = new TransferLinkUseCase(repos, () => NOW);
      await link.execute({ userId: u.id, transactionId: pay.id, kind: 'card_payment', targetAccountId: card.id });
      expect(await balanceOf(card.id)).toBe(0);
      expect(await balanceOf(bank.id)).toBe(600_00);
      const row = await db.transaction.findUniqueOrThrow({ where: { id: pay.id } });
      expect(row).toMatchObject({
        isInternalTransfer: true,
        internalTransferManual: true,
        linkedAccountId: card.id,
        linkKind: 'card_payment',
      });
      const mirror = await db.transaction.findFirstOrThrow({ where: { userId: u.id, externalId: `link:${pay.id}` } });
      expect(Number(mirror.amountInCents)).toBe(400_00);
      expect(mirror.accountId).toBe(card.id);
      const s = await new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId: u.id, month: '2026-11' });
      expect(s.outcomeInCents).toBe(0);
      // vincular de novo (corrida de dois toques) não duplica nem move saldo
      await Promise.allSettled([
        link.execute({ userId: u.id, transactionId: pay.id, kind: 'card_payment', targetAccountId: card.id }),
        link.execute({ userId: u.id, transactionId: pay.id, kind: 'card_payment', targetAccountId: card.id }),
      ]);
      const mirrors = await db.transaction.count({ where: { userId: u.id, externalId: `link:${pay.id}` } });
      expect(mirrors).toBe(1); // o UNIQUE(userId, externalId) barra a segunda contrapartida
      expect(await balanceOf(card.id)).toBe(0); // e a transação que perdeu foi desfeita por inteiro (saldo não andou em dobro)
      expect(await balanceOf(bank.id)).toBe(600_00);
    });

    it('desfazer devolve tudo; apagar o original leva a contrapartida e o saldo do cartão volta', async () => {
      const { u, bank, card, pay } = await scene();
      const link = new TransferLinkUseCase(repos, () => NOW);
      await link.execute({ userId: u.id, transactionId: pay.id, kind: 'card_payment', targetAccountId: card.id });
      await link.execute({ userId: u.id, transactionId: pay.id, kind: 'none' });
      expect(await balanceOf(card.id)).toBe(-400_00);
      expect(await db.transaction.count({ where: { userId: u.id, externalId: `link:${pay.id}` } })).toBe(0);
      await link.execute({ userId: u.id, transactionId: pay.id, kind: 'card_payment', targetAccountId: card.id });
      await new DeleteTransactionUseCase(repos, () => NOW).execute({ userId: u.id, transactionId: pay.id });
      expect(await balanceOf(card.id)).toBe(-400_00);
      expect(await balanceOf(bank.id)).toBe(1000_00);
      expect(await db.transaction.count({ where: { userId: u.id } })).toBe(0);
    });

    it('apagar a conta do outro lado zera o vínculo (SET NULL) sem apagar o lançamento', async () => {
      const { u, card, pay } = await scene();
      await new TransferLinkUseCase(repos, () => NOW).execute({
        userId: u.id,
        transactionId: pay.id,
        kind: 'card_payment',
        targetAccountId: card.id,
      });
      await repos.accounts.delete(card.id);
      const row = await db.transaction.findUniqueOrThrow({ where: { id: pay.id } });
      expect(row.linkedAccountId).toBeNull();
      expect(row.isInternalTransfer).toBe(true);
    });

    it('CHECK do banco: link_kind só aceita card_payment ou transfer', async () => {
      const { u, pay } = await scene();
      await expect(
        db.transaction.update({ where: { id: pay.id }, data: { linkKind: 'qualquer-coisa' } }),
      ).rejects.toThrow();
      void u;
    });
  });
});
