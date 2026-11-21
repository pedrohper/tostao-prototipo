// T1.4 contra Postgres REAL. O repositório em memória não consegue provar nada sobre FK, CHECK, índices únicos,
// BIGINT, timestamptz nem transações: aqui é o banco que responde. Só roda com TEST_DATABASE_URL (um banco
// DESCARTÁVEL com as migrations aplicadas, NUNCA o de produção); sem ela, fica "skipped".
//   docker run -d --rm --name pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16
//   DATABASE_URL=<url> pnpm --filter @tostao/api db:deploy
//   TEST_DATABASE_URL=<url> pnpm --filter @tostao/api test prisma-repositories
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeBankGateway } from '../../gateways/fake-bank-gateway.js';
import type { BankGateway } from '../../gateways/bank-gateway.js';
import { BankConnectionError, ConflictError } from '../../domain/errors.js';
import { processOutbox } from '../../jobs/outbox.js';
import { hashPassword } from '../../lib/password.js';
import { CreateManualTransactionUseCase } from '../../use-cases/create-manual-transaction.js';
import { DeleteAccountUseCase } from '../../use-cases/delete-account.js';
import { DeleteCategoryUseCase } from '../../use-cases/categories.js';
import { DisconnectBankUseCase } from '../../use-cases/disconnect-bank.js';
import { GoalDepositUseCase, SetGoalUseCase } from '../../use-cases/financial-plan.js';
import { RegisterUserUseCase } from '../../use-cases/register-user.js';
import { SetAiConsentUseCase } from '../../use-cases/ai-consent.js';
import { makePrismaRepositories } from './index.js';

const url = process.env.TEST_DATABASE_URL;
const uniq = () => randomUUID().slice(0, 8);

describe.skipIf(!url)('T1.4 no Postgres real', () => {
  let db: PrismaClient;
  let repos: ReturnType<typeof makePrismaRepositories>;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
    repos = makePrismaRepositories(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const newUser = (name = 'Pessoa') =>
    db.user.create({ data: { name, email: `${name.toLowerCase()}-${uniq()}@x.com`, passwordHash: 'x' } });
  const rejects = async (p: Promise<unknown>, pattern: RegExp) => {
    await expect(p).rejects.toThrow(pattern);
  };

  describe('esquema: tipos, constraints e índices', () => {
    it('dinheiro é BIGINT, datas são timestamptz(3), day é date, e os enums existem', async () => {
      const cols = await db.$queryRaw<{ table_name: string; column_name: string; data_type: string }[]>`
        SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'`;
      const type = (t: string, c: string) => cols.find((x) => x.table_name === t && x.column_name === c)?.data_type;
      for (const [t, c] of [
        ['accounts', 'balance_in_cents'],
        ['accounts', 'credit_limit_in_cents'],
        ['transactions', 'amount_in_cents'],
        ['category_budgets', 'limit_in_cents'],
        ['reconciled_notes', 'amount_in_cents'],
      ] as const)
        expect(type(t, c), `${t}.${c}`).toBe('bigint');
      expect(cols.filter((c) => c.data_type === 'timestamp without time zone')).toEqual([]);
      expect(type('transactions', 'occurred_at')).toBe('timestamp with time zone');
      expect(type('user_activities', 'day')).toBe('date');
      expect(type('users', 'timezone')).toBe('text');
      const enums = await db.$queryRaw<{ typname: string }[]>`SELECT typname FROM pg_type WHERE typtype = 'e'`;
      expect(enums.map((e) => e.typname).sort()).toEqual(
        [
          'AccountType',
          'BattleKind',
          'BattleStatus',
          'CategoryKind',
          'ChatChannel',
          'ChatRole',
          'ConnectionStatus',
          'InsightSeverity',
          'InsightStatus',
          'OAuthProvider',
          'OutboxStatus',
          'FriendRequestStatus',
        ].sort(),
      );
    });

    it('User.timezone nasce America/Sao_Paulo e currency nasce BRL', async () => {
      const u = await newUser();
      expect(u.timezone).toBe('America/Sao_Paulo');
      const conn = await db.bankConnection.create({ data: { userId: u.id, itemId: `m-${uniq()}` } });
      const acc = await db.account.create({
        data: { userId: u.id, connectionId: conn.id, externalId: uniq(), name: 'C', type: 'BANK', balanceInCents: 1n },
      });
      expect(acc.currency).toBe('BRL');
      const tx = await db.transaction.create({
        data: { userId: u.id, description: 'x', amountInCents: 1n, occurredAt: new Date() },
      });
      expect(tx.currency).toBe('BRL');
    });

    it('enum recusa valor fora da lista', async () => {
      const u = await newUser();
      await rejects(
        db.$executeRawUnsafe(
          `INSERT INTO bank_connections (id, user_id, item_id, status) VALUES ('${uniq()}', '${u.id}', 'x-${uniq()}', 'QUEBRADO')`,
        ),
        /invalid input value for enum/i,
      );
    });

    it('CHECK: orçamento <= 0, lançamento de valor 0, amizade consigo mesmo e voto negativo são recusados', async () => {
      const u = await newUser();
      await rejects(
        db.categoryBudget.create({ data: { userId: u.id, categoryId: 'mercado', limitInCents: 0n } }),
        /category_budgets_limit_positive|check constraint/i,
      );
      await rejects(
        db.transaction.create({
          data: { userId: u.id, description: 'zero', amountInCents: 0n, occurredAt: new Date() },
        }),
        /transactions_amount_nonzero|check constraint/i,
      );
      await rejects(
        db.friendship.create({ data: { userId: u.id, friendId: u.id } }),
        /friendships_not_self|check constraint/i,
      );
      await rejects(
        db.tribunalVote.create({ data: { userId: u.id, caseId: 'c', weekKey: '2026-11-16', choice: -1 } }),
        /tribunal_votes_choice_nonnegative|check constraint/i,
      );
      // e o caso válido passa
      await db.categoryBudget.create({ data: { userId: u.id, categoryId: 'mercado', limitInCents: 1n } });
    });

    it('únicos case-insensitive: e-mail, nome de pessoa por dono, categoria por dono e regra do sistema (NULLS NOT DISTINCT)', async () => {
      const tag = uniq();
      const u = await db.user.create({ data: { name: 'A', email: `Ana-${tag}@X.com`, passwordHash: 'x' } });
      await rejects(
        db.user.create({ data: { name: 'B', email: `ana-${tag}@x.com`, passwordHash: 'x' } }),
        /users_email_lower_key|Unique constraint/i,
      );

      await db.person.create({ data: { userId: u.id, name: 'João' } });
      await rejects(
        db.person.create({ data: { userId: u.id, name: 'JOÃO' } }),
        /people_user_id_name_lower_key|Unique constraint/i,
      );
      const other = await newUser('Outra');
      await db.person.create({ data: { userId: other.id, name: 'João' } }); // outro dono pode

      await db.category.create({
        data: { id: `u-${uniq()}`, name: `Mesada ${tag}`, emoji: '💸', color: '#fff', kind: 'entrada', userId: u.id },
      });
      await rejects(
        db.category.create({
          data: { id: `u-${uniq()}`, name: `MESADA ${tag}`, emoji: '💸', color: '#fff', kind: 'entrada', userId: u.id },
        }),
        /categories_owner_name_lower_key|Unique constraint/i,
      );
      await db.category.create({
        data: { id: `s-${uniq()}`, name: `Sistema ${tag}`, emoji: '⚙️', color: '#fff', kind: 'saida' },
      });
      await rejects(
        db.category.create({
          data: { id: `s-${uniq()}`, name: `SISTEMA ${tag}`, emoji: '⚙️', color: '#fff', kind: 'saida' },
        }),
        /categories_owner_name_lower_key|Unique constraint/i,
      );

      await db.categoryRule.create({ data: { userId: null, pattern: `REGRA-${tag}`, categoryId: 'mercado' } });
      await rejects(
        db.categoryRule.create({ data: { userId: null, pattern: `REGRA-${tag}`, categoryId: 'mercado' } }),
        /category_rules_user_pattern_nn_key|Unique constraint/i,
      );
    });
  });

  describe('BIGINT: ida e volta pelos repositórios', () => {
    it('R$ 100 milhões e saldo negativo grande voltam idênticos como number; timestamptz guarda o instante exato', async () => {
      const u = await newUser();
      const conn = await repos.connections.create({ userId: u.id, itemId: `big-${uniq()}`, institution: null });
      const acc = await repos.accounts.upsertByExternalId({
        userId: u.id,
        connectionId: conn.id,
        externalId: `a-${uniq()}`,
        name: 'Cofre',
        type: 'BANK',
        balanceInCents: -9_999_999_999_999,
        fingerprint: null,
        creditLimitInCents: 10_000_000_000,
        dueDate: null,
      });
      expect(acc.balanceInCents).toBe(-9_999_999_999_999);
      expect(typeof acc.balanceInCents).toBe('number');
      expect(acc.creditLimitInCents).toBe(10_000_000_000);

      const at = new Date('2026-11-21T03:04:05.678Z');
      const tx = await repos.transactions.create({
        userId: u.id,
        accountId: acc.id,
        externalId: `t-${uniq()}`,
        description: 'Mansão',
        amountInCents: 10_000_000_000,
        occurredAt: at,
        categoryId: null,
        isInternalTransfer: false,
        seriesId: null,
      });
      const back = await repos.transactions.findById(tx.id);
      expect(back!.amountInCents).toBe(10_000_000_000);
      expect(back!.occurredAt.toISOString()).toBe(at.toISOString());
      await repos.transactions.save({ ...back!, amountInCents: -10_000_000_000 });
      expect((await repos.transactions.findById(tx.id))!.amountInCents).toBe(-10_000_000_000);

      const budget = await repos.budgets.upsert({ userId: u.id, categoryId: 'mercado', limitInCents: 10_000_000_000 });
      expect(budget.limitInCents).toBe(10_000_000_000);
      expect((await repos.budgets.listByUser(u.id))[0]!.limitInCents).toBe(10_000_000_000);
    });

    it('número que não é inteiro seguro nunca chega ao banco', async () => {
      const u = await newUser();
      await expect(
        repos.transactions.create({
          userId: u.id,
          accountId: null,
          externalId: null,
          description: 'x',
          amountInCents: 2 ** 53,
          occurredAt: new Date(),
          categoryId: null,
          isInternalTransfer: false,
          seriesId: null,
        }),
      ).rejects.toThrow(RangeError);
    });

    it('user_activities.day (date) volta como AAAA-MM-DD', async () => {
      const u = await newUser();
      await repos.engagement.markActivity(u.id, '2026-11-20', 'lesson');
      await repos.engagement.markActivity(u.id, '2026-11-20', 'lesson'); // idempotente
      await repos.engagement.markActivity(u.id, '2026-11-21', 'visita:inicio');
      const rows = await repos.engagement.listActivity(u.id, '2026-11-20');
      expect(rows.map((r) => r.day).sort()).toEqual(['2026-11-20', '2026-11-21']);
      expect(await repos.engagement.listActivity(u.id, '2026-11-21')).toEqual([
        { day: '2026-11-21', kind: 'visita:inicio' },
      ]);
    });
  });

  describe('desconectar banco preserva o que foi anotado à mão', () => {
    async function seedBank(userId: string) {
      const conn = await repos.connections.create({ userId, itemId: `it-${uniq()}`, institution: 'Banco' });
      const acc = await repos.accounts.upsertByExternalId({
        userId,
        connectionId: conn.id,
        externalId: `ac-${uniq()}`,
        name: 'Corrente',
        type: 'BANK',
        balanceInCents: 100_00,
        fingerprint: null,
      });
      const mk = (description: string, externalId: string | null, amount: number) =>
        repos.transactions.create({
          userId,
          accountId: acc.id,
          externalId,
          description,
          amountInCents: amount,
          occurredAt: new Date('2026-11-10T15:00:00Z'),
          categoryId: null,
          isInternalTransfer: false,
          seriesId: null,
        });
      const bank1 = await mk('PIX BANCO 1', `ext-${uniq()}`, -10_00);
      const bank2 = await mk('PIX BANCO 2', `ext-${uniq()}`, -20_00);
      const manual = await mk('Cafezinho anotado', null, -5_00); // ligado à conta, sem external_id
      const cash = await repos.transactions.create({
        userId,
        accountId: null,
        externalId: null,
        description: 'Dinheiro vivo',
        amountInCents: -7_00,
        occurredAt: new Date('2026-11-10T15:00:00Z'),
        categoryId: null,
        isInternalTransfer: false,
        seriesId: null,
      });
      return { conn, acc, bank1, bank2, manual, cash };
    }

    it('apaga só os lançamentos do banco; os manuais ficam com accountId = null', async () => {
      const u = await newUser();
      const { conn, acc, bank1, bank2, manual, cash } = await seedBank(u.id);
      const bank: BankGateway = new FakeBankGateway();
      const r = await new DisconnectBankUseCase(repos, bank).execute({ userId: u.id, connectionId: conn.id });
      expect(r).toEqual({ providerDeleted: true });

      expect(await repos.transactions.findById(bank1.id)).toBeNull();
      expect(await repos.transactions.findById(bank2.id)).toBeNull();
      const keptManual = await repos.transactions.findById(manual.id);
      expect(keptManual).not.toBeNull();
      expect(keptManual!.accountId).toBeNull();
      expect(keptManual!.amountInCents).toBe(-5_00);
      expect(await repos.transactions.findById(cash.id)).not.toBeNull();
      expect(await db.account.findUnique({ where: { id: acc.id } })).toBeNull();
      expect(await db.bankConnection.findUnique({ where: { id: conn.id } })).toBeNull();
    });

    it('não toca nos lançamentos de OUTRA pessoa', async () => {
      const a = await newUser('Aa');
      const b = await newUser('Bb');
      const seedA = await seedBank(a.id);
      const seedB = await seedBank(b.id);
      await new DisconnectBankUseCase(repos, new FakeBankGateway()).execute({
        userId: a.id,
        connectionId: seedA.conn.id,
      });
      expect(await repos.transactions.findById(seedB.bank1.id)).not.toBeNull();
      expect(await repos.transactions.findById(seedB.manual.id)).not.toBeNull();
      expect((await repos.transactions.findById(seedB.manual.id))!.accountId).toBe(seedB.acc.id);
    });

    it('provedor fora do ar: desconecta mesmo assim e deixa o desligamento do Item na fila', async () => {
      const u = await newUser();
      const { conn } = await seedBank(u.id);
      const bank: BankGateway = new FakeBankGateway();
      bank.deleteItem = async () => {
        throw new BankConnectionError('Pluggy 503');
      };
      expect(await new DisconnectBankUseCase(repos, bank).execute({ userId: u.id, connectionId: conn.id })).toEqual({
        providerDeleted: false,
      });
      const job = await db.outboxJob.findFirst({
        where: { type: 'pluggy.deleteItem', payload: { path: ['itemId'], equals: conn.itemId } },
      });
      expect(job?.status).toBe('PENDING');
      // e o worker conclui quando o provedor volta
      const calls: string[] = [];
      const back: BankGateway = new FakeBankGateway();
      back.deleteItem = async (id: string) => void calls.push(id);
      await db.outboxJob.update({ where: { id: job!.id }, data: { runAt: new Date(Date.now() - 1000) } });
      await processOutbox(repos, back, { log: { info: () => {}, error: () => {} } });
      expect(calls).toContain(conn.itemId);
      expect((await db.outboxJob.findUnique({ where: { id: job!.id } }))!.status).toBe('DONE');
    });
  });

  describe('convite usado nunca reabre', () => {
    it('convidado apaga a conta: usedById vira NULL mas used_at segue; o código não vale de novo e não vira amizade', async () => {
      const owner = await newUser('Dono');
      const code = `TOST-${uniq().toUpperCase()}`;
      await repos.invites.create({ code, createdById: owner.id });
      const register = new RegisterUserUseCase(repos);
      const first = await register.execute({
        name: 'Convidado',
        email: `c-${uniq()}@x.com`,
        password: '12345678',
        inviteCode: code,
      });
      expect((await db.invite.findUnique({ where: { code } }))!.usedById).toBe(first.user.id);
      expect(await repos.engagement.listFriendIds(owner.id)).toContain(first.user.id);

      // o convidado apaga a conta (cascata leva a amizade; o convite fica como histórico)
      await new DeleteAccountUseCase(repos, new FakeBankGateway()).execute({
        userId: first.user.id,
        password: '12345678',
      });
      const used = await db.invite.findUnique({ where: { code } });
      expect(used!.usedById).toBeNull();
      expect(used!.usedAt).not.toBeNull();

      // outra pessoa tenta o mesmo código: entra, mas SEM consumir o convite e SEM virar amiga do dono
      const second = await register.execute({
        name: 'Segundo',
        email: `s-${uniq()}@x.com`,
        password: '12345678',
        inviteCode: code,
      });
      const after = await db.invite.findUnique({ where: { code } });
      expect(after!.usedById).toBeNull();
      expect(after!.usedAt!.getTime()).toBe(used!.usedAt!.getTime());
      expect(await repos.engagement.listFriendIds(owner.id)).not.toContain(second.user.id);
    });

    it('cadastros simultâneos com o mesmo convite: só um consome', async () => {
      const owner = await newUser('Dono2');
      const code = `TOST-${uniq().toUpperCase()}`;
      await repos.invites.create({ code, createdById: owner.id });
      const register = new RegisterUserUseCase(repos);
      const results = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          register.execute({
            name: `P${i}`,
            email: `race-${i}-${uniq()}@x.com`,
            password: '12345678',
            inviteCode: code,
          }),
        ),
      );
      expect(results).toHaveLength(4); // todo mundo entra (convite é opcional)...
      const friends = await repos.engagement.listFriendIds(owner.id);
      expect(results.filter((r) => friends.includes(r.user.id))).toHaveLength(1); // ...mas só um "usa" o convite
      const row = await db.invite.findUnique({ where: { code } });
      expect(results.map((r) => r.user.id)).toContain(row!.usedById);
    });

    it('criador do convite apaga a conta: o convite continua existindo (created_by NULL)', async () => {
      const owner = await newUser('Dono3');
      const code = `TOST-${uniq().toUpperCase()}`;
      await repos.invites.create({ code, createdById: owner.id });
      await db.user.delete({ where: { id: owner.id } });
      const row = await db.invite.findUnique({ where: { code } });
      expect(row).not.toBeNull();
      expect(row!.createdById).toBeNull();
    });
  });

  describe('$transaction: tudo ou nada', () => {
    it('erro no meio do tx desfaz tudo (conta + consentimento)', async () => {
      const email = `tx-${uniq()}@x.com`;
      await expect(
        repos.tx(async (r) => {
          const u = await r.users.create({ name: 'Fantasma', email, passwordHash: 'x' });
          await r.consents.grant({ userId: u.id, type: 'terms', version: 'v', at: new Date() });
          throw new Error('falhou no meio');
        }),
      ).rejects.toThrow('falhou no meio');
      expect(await db.user.findUnique({ where: { email } })).toBeNull();
    });

    it('cadastro grava conta, aceite dos termos e da privacidade juntos', async () => {
      const { user } = await new RegisterUserUseCase(repos).execute({
        name: 'Nova',
        email: `n-${uniq()}@x.com`,
        password: '12345678',
      });
      const consents = await db.userConsent.findMany({ where: { userId: user.id } });
      expect(consents.map((c) => c.type).sort()).toEqual(['privacy', 'terms']);
      expect((await db.user.findUnique({ where: { id: user.id } }))!.termsAcceptedAt).not.toBeNull();
    });

    it('e-mail repetido só com maiúscula/minúscula diferente: o segundo cadastro falha limpo (409), sem conta pela metade', async () => {
      const tag = uniq();
      const register = new RegisterUserUseCase(repos);
      await register.execute({ name: 'Um', email: `dup-${tag}@x.com`, password: '12345678' });
      const before = await db.user.count();
      await expect(
        register.execute({ name: 'Dois', email: `DUP-${tag}@X.COM`, password: '12345678' }),
      ).rejects.toMatchObject({ statusCode: 409 });
      // corrida real: dois ao mesmo tempo com o mesmo e-mail
      const email = `race-${tag}@x.com`;
      const settled = await Promise.allSettled([
        register.execute({ name: 'R1', email, password: '12345678' }),
        register.execute({ name: 'R2', email, password: '12345678' }),
      ]);
      expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
      expect((settled.find((s) => s.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({
        statusCode: 409,
      });
      expect(await db.user.count()).toBe(before + 1);
    });

    it('lançamento parcelado entra inteiro ou não entra (createMany): um valor 0 no meio derruba tudo', async () => {
      const u = await newUser();
      const useCase = new CreateManualTransactionUseCase(repos);
      const ok = await useCase.execute({
        userId: u.id,
        description: 'Geladeira',
        amountInCents: 1200_00,
        kind: 'saida',
        occurredAt: new Date('2026-11-05T15:00:00Z'),
        repeat: 'parcelado',
        times: 12,
      });
      expect(ok.count).toBe(12);
      expect(await db.transaction.count({ where: { userId: u.id } })).toBe(12);
      // total 5 centavos em 12 parcelas: as parcelas 2..12 dão 0 centavos -> CHECK barra -> nada entra
      await expect(
        useCase.execute({
          userId: u.id,
          description: 'Bala',
          amountInCents: 5,
          kind: 'saida',
          occurredAt: new Date('2026-11-05T15:00:00Z'),
          repeat: 'parcelado',
          times: 12,
        }),
      ).rejects.toThrow();
      expect(await db.transaction.count({ where: { userId: u.id, description: { startsWith: 'Bala' } } })).toBe(0);
    });

    it('apagar categoria própria limpa só o que é dessa pessoa, tudo junto', async () => {
      const a = await newUser('Ca');
      const b = await newUser('Cb');
      const cat = await repos.categories.create({
        userId: a.id,
        name: `Pets ${uniq()}`,
        emoji: '🐶',
        color: '#fff',
        kind: 'saida',
      });
      await repos.rules.upsert({ userId: a.id, pattern: `PETZ${uniq()}`, categoryId: cat.id });
      await repos.budgets.upsert({ userId: a.id, categoryId: cat.id, limitInCents: 300_00 });
      const ta = await repos.transactions.create({
        userId: a.id,
        accountId: null,
        externalId: null,
        description: 'ração',
        amountInCents: -50_00,
        occurredAt: new Date(),
        categoryId: cat.id,
        isInternalTransfer: false,
        seriesId: null,
      });
      // outra pessoa com lançamento na categoria do SISTEMA "mercado": não pode ser afetada por nada daqui
      const tb = await repos.transactions.create({
        userId: b.id,
        accountId: null,
        externalId: null,
        description: 'mercado',
        amountInCents: -80_00,
        occurredAt: new Date(),
        categoryId: 'mercado',
        isInternalTransfer: false,
        seriesId: null,
      });
      await repos.transactions.clearCategory(a.id, 'mercado'); // escopado: não mexe em b
      expect((await repos.transactions.findById(tb.id))!.categoryId).toBe('mercado');

      await new DeleteCategoryUseCase(repos).execute({ userId: a.id, categoryId: cat.id });
      expect((await repos.transactions.findById(ta.id))!.categoryId).toBeNull();
      expect(await db.categoryRule.count({ where: { categoryId: cat.id } })).toBe(0);
      expect(await db.categoryBudget.count({ where: { categoryId: cat.id } })).toBe(0);
      expect(await db.category.findUnique({ where: { id: cat.id } })).toBeNull();
    });
  });

  describe('lock otimista (version) e upserts atômicos', () => {
    it('3 depósitos simultâneos na meta: nenhum se perde', async () => {
      const u = await newUser();
      await new SetGoalUseCase(repos).execute({
        userId: u.id,
        goal: { kind: 'reserva', label: 'Reserva', amountInCents: 100_000_00, deadline: null, savedInCents: 0 },
      });
      const deposit = new GoalDepositUseCase(repos);
      await Promise.all([1, 2, 3].map(() => deposit.execute({ userId: u.id, amountInCents: 10_00 })));
      const row = await db.financialPlan.findUnique({ where: { userId: u.id } });
      const goals = (row!.data as { goals: { savedInCents: number }[] }).goals;
      expect(goals[0]!.savedInCents).toBe(30_00);
      expect(row!.version).toBeGreaterThanOrEqual(4); // 1 criação + 3 depósitos (cada gravação sobe a version)
    });

    it('20 depósitos simultâneos: quem não conseguiu leva 409 e o total é EXATAMENTE a soma dos que conseguiram', async () => {
      const u = await newUser();
      await new SetGoalUseCase(repos).execute({
        userId: u.id,
        goal: { kind: 'reserva', label: 'R', amountInCents: 100_000_00, deadline: null, savedInCents: 0 },
      });
      const deposit = new GoalDepositUseCase(repos);
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => deposit.execute({ userId: u.id, amountInCents: 1_00 })),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(ok).toBeGreaterThanOrEqual(3);
      for (const f of failed) expect(f.reason).toBeInstanceOf(ConflictError);
      const goals = (
        (await db.financialPlan.findUnique({ where: { userId: u.id } }))!.data as { goals: { savedInCents: number }[] }
      ).goals;
      expect(goals[0]!.savedInCents).toBe(ok * 1_00); // sem escrita perdida
    });

    it('batalha do Urubu: marcar passos em paralelo não apaga nenhum', async () => {
      const u = await newUser();
      await db.battle.create({
        data: {
          userId: u.id,
          kind: 'tigrinho',
          status: 'vencida',
          startedAt: new Date(),
          endedAt: new Date(),
          steps: [],
        },
      });
      const { GamesUseCase, URUBU_STEPS } = await import('../../use-cases/games.js');
      const games = new GamesUseCase(repos);
      const ids = URUBU_STEPS.slice(0, 3).map((s) => s.id);
      await Promise.all(ids.map((id) => games.toggleUrubuStep(u.id, id, true)));
      const row = await db.battle.findUnique({ where: { userId_kind: { userId: u.id, kind: 'urubu' } } });
      expect([...row!.steps].sort()).toEqual([...ids].sort());
      expect(row!.version).toBeGreaterThanOrEqual(2);
    });

    it('upsertPending concorrente: um achado só, e só um "created: true"', async () => {
      const u = await newUser();
      const data = {
        userId: u.id,
        routine: 'caramelo_extrato' as const,
        kind: 'uncategorized_batch',
        severity: 'info' as const,
        title: 't',
        body: 'b',
        payload: { latestTxId: 'x' },
        dedupeKey: `k-${uniq()}`,
      };
      const results = await Promise.all(Array.from({ length: 6 }, () => repos.tostaoAuto.upsertPending(data)));
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(await db.tostaoInsight.count({ where: { userId: u.id } })).toBe(1);
    });

    it('rules.upsert concorrente na mesma regra: uma linha só, sem erro', async () => {
      const u = await newUser();
      const pattern = `PADRAO-${uniq()}`;
      await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          repos.rules.upsert({ userId: u.id, pattern, categoryId: i % 2 ? 'mercado' : 'delivery' }),
        ),
      );
      expect(await db.categoryRule.count({ where: { userId: u.id, pattern } })).toBe(1);
    });
  });

  describe('exclusão de conta, consentimento e auditoria', () => {
    it('provedor fora do ar: a conta some, as sessões morrem, o job do Pluggy fica na fila e o log de auditoria perde só a identidade', async () => {
      const { user } = await new RegisterUserUseCase(repos).execute({
        name: 'Sai',
        email: `sai-${uniq()}@x.com`,
        password: '12345678',
      });
      await repos.connections.create({ userId: user.id, itemId: `it-${uniq()}`, institution: 'X' });
      await db.refreshToken.create({
        data: { userId: user.id, tokenHash: uniq() + uniq(), familyId: uniq(), expiresAt: new Date(Date.now() + 1e9) },
      });
      await repos.audit.record({ userId: user.id, action: 'consent_changed', entityType: 'consent', entityId: 'ai' });
      const bank: BankGateway = new FakeBankGateway();
      bank.deleteItem = async () => {
        throw new BankConnectionError('fora do ar');
      };
      const r = await new DeleteAccountUseCase(repos, bank).execute({ userId: user.id, password: '12345678' });
      expect(r.providerFailures).toBe(1);
      expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
      expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
      expect(
        await db.outboxJob.count({ where: { status: 'PENDING', type: 'pluggy.deleteItem' } }),
      ).toBeGreaterThanOrEqual(1);
      expect(await db.auditLog.count({ where: { userId: user.id } })).toBe(0); // userId virou NULL
      expect(await db.auditLog.count({ where: { action: 'account_deleted', userId: null } })).toBeGreaterThanOrEqual(1);
      expect(await db.userConsent.count({ where: { userId: user.id } })).toBe(0); // cascade
    });

    it('consentimento de IA: aceitar grava histórico + auditoria; revogar fecha o aceite aberto', async () => {
      const u = await newUser();
      const useCase = new SetAiConsentUseCase(repos);
      await useCase.execute({ userId: u.id, accepted: true });
      await useCase.execute({ userId: u.id, accepted: true }); // não duplica
      let rows = await db.userConsent.findMany({ where: { userId: u.id, type: 'ai' } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.revokedAt).toBeNull();
      await useCase.execute({ userId: u.id, accepted: false });
      rows = await db.userConsent.findMany({ where: { userId: u.id, type: 'ai' } });
      expect(rows[0]!.revokedAt).not.toBeNull();
      expect((await db.user.findUnique({ where: { id: u.id } }))!.aiConsentAt).toBeNull();
      expect(await db.auditLog.count({ where: { userId: u.id, action: 'consent_changed' } })).toBe(2);
    });
  });

  it('hashPassword/senha: usuário criado por repositório consegue o ciclo completo (sanidade do banco migrado)', async () => {
    const hash = await hashPassword('12345678');
    const u = await repos.users.create({ name: 'Ciclo', email: `ciclo-${uniq()}@x.com`, passwordHash: hash });
    expect((await repos.users.findByEmail(u.email))!.id).toBe(u.id);
    expect(u.timezone).toBe('America/Sao_Paulo');
  });
});
