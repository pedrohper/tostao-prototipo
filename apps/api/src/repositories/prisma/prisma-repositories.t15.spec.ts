// T1.5/T1.6 contra Postgres REAL: decisão manual de transferência, saldo atômico, pedidos de amizade, voto por semana
// e falhas seguidas do sync. Só roda com TEST_DATABASE_URL (banco descartável com as migrations aplicadas).
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeBankGateway } from '../../gateways/fake-bank-gateway.js';
import { CreateManualAccountUseCase } from '../../use-cases/create-manual-account.js';
import { CreateManualTransactionUseCase } from '../../use-cases/create-manual-transaction.js';
import { EngagementUseCase } from '../../use-cases/engagement.js';
import { SyncBankConnectionUseCase } from '../../use-cases/sync-bank-connection.js';
import { ConnectBankUseCase } from '../../use-cases/connect-bank.js';
import { makePrismaRepositories } from './index.js';

const url = process.env.TEST_DATABASE_URL;
const uniq = () => randomUUID().slice(0, 8);

describe.skipIf(!url)('T1.5/T1.6 no Postgres real', () => {
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

  it('internalTransferManual: null por padrão, true/false gravados e relidos; save() sem o campo não apaga a decisão', async () => {
    const u = await newUser();
    const t = await repos.transactions.create({
      userId: u.id,
      accountId: null,
      externalId: null,
      description: 'x',
      amountInCents: -10_00,
      occurredAt: new Date(),
      categoryId: null,
      isInternalTransfer: false,
      seriesId: null,
    });
    expect((await repos.transactions.findById(t.id))!.internalTransferManual).toBeNull();
    await repos.transactions.save({ ...t, isInternalTransfer: true, internalTransferManual: true });
    expect(await repos.transactions.findById(t.id)).toMatchObject({
      isInternalTransfer: true,
      internalTransferManual: true,
    });
    await repos.transactions.save({ ...t, isInternalTransfer: false, internalTransferManual: false });
    expect(await repos.transactions.findById(t.id)).toMatchObject({
      isInternalTransfer: false,
      internalTransferManual: false,
    });
    const { internalTransferManual: _omit, ...semCampo } = (await repos.transactions.findById(t.id))!;
    void _omit;
    await repos.transactions.save({ ...semCampo, description: 'só mudei o texto' } as never);
    expect((await repos.transactions.findById(t.id))!.internalTransferManual).toBe(false);
  });

  it('adjustBalance é atômico: 25 lançamentos simultâneos numa conta manual somam EXATAMENTE', async () => {
    const u = await newUser();
    const { account } = await new CreateManualAccountUseCase(repos).execute({
      userId: u.id,
      name: 'Cofre',
      type: 'BANK',
      balanceInCents: 1_000_00,
    });
    const create = new CreateManualTransactionUseCase(repos);
    await Promise.all(
      Array.from({ length: 25 }, () =>
        create.execute({
          userId: u.id,
          description: 'g',
          amountInCents: 10_00,
          kind: 'saida',
          occurredAt: new Date(Date.now() - 3600_000),
          accountId: account.id,
        }),
      ),
    );
    expect((await repos.accounts.listByUser(u.id))[0]!.balanceInCents).toBe(1_000_00 - 25 * 10_00);
    expect(await db.transaction.count({ where: { userId: u.id } })).toBe(25);
  });

  it('parcelado com parcela de 0 centavo é recusado ANTES de gravar (e o CHECK do banco é a segunda barreira)', async () => {
    const u = await newUser();
    await expect(
      new CreateManualTransactionUseCase(repos).execute({
        userId: u.id,
        description: 'bala',
        amountInCents: 5,
        kind: 'saida',
        occurredAt: new Date(),
        repeat: 'parcelado',
        times: 12,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await db.transaction.count({ where: { userId: u.id } })).toBe(0);
  });

  describe('pedidos de amizade', () => {
    it('único por par: 6 pedidos simultâneos criam um só; o CHECK barra pedido pra si mesmo', async () => {
      const a = await newUser('Aa');
      const b = await newUser('Bb');
      const results = await Promise.all(
        Array.from({ length: 6 }, () => repos.engagement.createFriendRequest(a.id, b.id)),
      );
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(await db.friendRequest.count({ where: { requesterId: a.id, addresseeId: b.id } })).toBe(1);
      await expect(db.friendRequest.create({ data: { requesterId: a.id, addresseeId: a.id } })).rejects.toThrow(
        /friend_requests_not_self|check constraint/i,
      );
    });

    it('aceitar duas vezes ao mesmo tempo: uma ganha, a amizade vira 2 linhas (nos dois sentidos) e nada duplica', async () => {
      const a = await newUser('Ca');
      const b = await newUser('Cb');
      const { request } = await repos.engagement.createFriendRequest(a.id, b.id);
      const r = await Promise.all([
        repos.engagement.respondFriendRequest(request.id, b.id, true, new Date()),
        repos.engagement.respondFriendRequest(request.id, b.id, true, new Date()),
      ]);
      expect(r.filter(Boolean)).toHaveLength(1);
      expect(
        await db.friendship.count({
          where: {
            OR: [
              { userId: a.id, friendId: b.id },
              { userId: b.id, friendId: a.id },
            ],
          },
        }),
      ).toBe(2);
      expect((await db.friendRequest.findUnique({ where: { id: request.id } }))!.status).toBe('ACCEPTED');
    });

    it('só o destinatário responde; recusado pode ser pedido de novo; apagar a conta leva os pedidos', async () => {
      const a = await newUser('Da');
      const b = await newUser('Db');
      const c = await newUser('Dc');
      const { request } = await repos.engagement.createFriendRequest(a.id, b.id);
      expect(await repos.engagement.respondFriendRequest(request.id, c.id, true, new Date())).toBeNull();
      expect(await repos.engagement.respondFriendRequest(request.id, a.id, true, new Date())).toBeNull(); // quem pediu não aceita
      await repos.engagement.respondFriendRequest(request.id, b.id, false, new Date());
      expect(await db.friendship.count({ where: { userId: a.id } })).toBe(0);
      const again = await repos.engagement.createFriendRequest(a.id, b.id);
      expect(again).toMatchObject({ created: true, request: { status: 'PENDING' } });
      await db.user.delete({ where: { id: a.id } });
      expect(await db.friendRequest.count({ where: { requesterId: a.id } })).toBe(0);
    });

    it('o fluxo todo pelo EngagementUseCase com repositórios do Postgres', async () => {
      const a = await newUser('Ea');
      const b = await newUser('Eb');
      const eng = new EngagementUseCase(repos);
      const code = (await eng.friends(b.id)).code;
      expect((await eng.addFriend(a.id, code)).requests.outgoing).toHaveLength(1);
      const incoming = (await eng.friends(b.id)).requests.incoming[0]!;
      const done = await eng.respondRequest(b.id, incoming.id, true);
      expect(done.ranking).toHaveLength(2);
    });
  });

  describe('Tribunal por semana', () => {
    it('INSERT ... ON CONFLICT DO NOTHING: segundo voto na mesma semana é recusado, outra semana vale, e a contagem é por semana', async () => {
      const u = await newUser();
      const caso = `caso-${uniq()}`; // caso novo a cada execução: a contagem é global, não pode herdar voto de rodada anterior
      expect(await repos.games.vote(u.id, caso, '2026-11-16', 0)).toBe(true);
      expect(await repos.games.vote(u.id, caso, '2026-11-16', 1)).toBe(false);
      expect(await repos.games.vote(u.id, caso, '2026-11-23', 1)).toBe(true);
      expect((await repos.games.findVote(u.id, caso, '2026-11-16'))!.choice).toBe(0);
      expect(await repos.games.countVotes(caso, '2026-11-23')).toEqual([0, 1]);
    });

    it('votos simultâneos da mesma pessoa: um só entra', async () => {
      const u = await newUser();
      const caso = `caso-${uniq()}`;
      const r = await Promise.all([0, 1, 0, 1].map((c) => repos.games.vote(u.id, caso, '2026-11-16', c)));
      expect(r.filter(Boolean)).toHaveLength(1);
      expect(await db.tribunalVote.count({ where: { userId: u.id } })).toBe(1);
    });
  });

  describe('falhas seguidas do sync no banco', () => {
    it('errorCount/lastErrorAt e o status RECONNECT_REQUIRED (enum novo) vão e voltam; listRetryable só pega ERROR com 24h+', async () => {
      const u = await newUser();
      const mk = async (
        status: 'ERROR' | 'RECONNECT_REQUIRED' | 'ACTIVE',
        lastErrorAt: Date | null,
        errorCount: number,
      ) => {
        const c = await repos.connections.create({ userId: u.id, itemId: `it-${uniq()}`, institution: null });
        await repos.connections.save({ ...c, status, lastErrorAt, errorCount });
        return c.id;
      };
      const old = await mk('ERROR', new Date(Date.now() - 25 * 3600_000), 2);
      const recent = await mk('ERROR', new Date(Date.now() - 3600_000), 1);
      const dead = await mk('RECONNECT_REQUIRED', new Date(Date.now() - 90 * 24 * 3600_000), 3);
      await mk('ACTIVE', null, 0);
      expect(await repos.connections.findById(dead)).toMatchObject({ status: 'RECONNECT_REQUIRED', errorCount: 3 });
      const retry = (await repos.connections.listRetryable(new Date(Date.now() - 24 * 3600_000)))
        .filter((c) => c.userId === u.id)
        .map((c) => c.id);
      expect(retry).toEqual([old]);
      expect(retry).not.toContain(recent);
    });

    it('3 falhas do banco de verdade viram RECONNECT_REQUIRED e um sucesso zera', async () => {
      const u = await newUser();
      const bank = new FakeBankGateway();
      let fail = true;
      bank.fetchAccounts = async () => {
        if (fail) throw new Error('fora do ar');
        return [];
      };
      const sync = new SyncBankConnectionUseCase({ ...repos, bank });
      const conn = await repos.connections.create({ userId: u.id, itemId: `it-${uniq()}`, institution: null });
      for (let i = 0; i < 3; i++) await expect(sync.execute({ connectionId: conn.id })).rejects.toThrow();
      expect(await repos.connections.findById(conn.id)).toMatchObject({ status: 'RECONNECT_REQUIRED', errorCount: 3 });
      fail = false;
      await sync.execute({ connectionId: conn.id });
      expect(await repos.connections.findById(conn.id)).toMatchObject({
        status: 'ACTIVE',
        errorCount: 0,
        lastErrorAt: null,
      });
      void ConnectBankUseCase;
    });
  });
});
