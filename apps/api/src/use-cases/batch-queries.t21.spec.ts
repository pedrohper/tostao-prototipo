// T2.1 · Operações em lote: sync, importação, pessoas, amigos, convites, auto-categorizar e avisos não fazem mais uma
// consulta por linha. Espiões nos repositórios em memória provam QUE caminho cada use case usa; o comportamento
// (valores, contagens, o que fica pendente) tem que continuar o mesmo.
import { describe, expect, it, vi } from 'vitest';
import type { BankAccountData, BankTransactionData } from '../gateways/bank-gateway.js';
import { FakeAiGateway } from '../gateways/ai-gateway.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { FakePushGateway } from '../gateways/push-gateway.js';
import { FakeWhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { runNotifications } from '../jobs/notifications.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { AutoCategorizeUseCase } from './auto-categorize.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { EngagementUseCase } from './engagement.js';
import { ImportStatementUseCase } from './import-statement.js';
import { ListInvitesUseCase } from './invites.js';
import { ListPeopleUseCase } from './people.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';

const brt = (iso: string) => new Date(`${iso}-03:00`);
const NOW = brt('2026-11-20T10:00:00');

class Scripted extends FakeBankGateway {
  accounts: BankAccountData[] = [{ externalId: 'cc', name: 'Corrente', type: 'BANK', balanceInCents: 100_00 }];
  txs: Record<string, BankTransactionData[]> = {};
  override async fetchAccounts() {
    return this.accounts;
  }
  override async fetchTransactions(id: string) {
    return this.txs[id] ?? [];
  }
}
const bankTx = (externalId: string, over: Partial<BankTransactionData> = {}): BankTransactionData => ({
  externalId,
  description: `COMPRA ${externalId}`,
  amountInCents: -10_00,
  occurredAt: brt('2026-11-18T12:00:00'),
  ...over,
});

describe('sync do banco em lote', () => {
  async function setup(gw = new Scripted()) {
    const repos = makeInMemoryRepositories();
    const sync = new SyncBankConnectionUseCase({ ...repos, bank: gw, now: () => NOW });
    const { connection } = await new ConnectBankUseCase(repos.connections, gw, sync).execute({
      userId: 'u1',
      itemId: 'item-1',
    });
    return { repos, gw, sync, connection };
  }

  it('não consulta nem insere lançamento por lançamento: 1 busca dos existentes + 1 INSERT em lote que pula duplicata', async () => {
    const gw = new Scripted();
    gw.txs.cc = Array.from({ length: 30 }, (_, i) => bankTx(`t${i}`));
    const { repos, sync, connection } = await setup(gw);
    expect(repos.transactions.items).toHaveLength(30);

    const one = vi.spyOn(repos.transactions, 'findByExternalId');
    const create = vi.spyOn(repos.transactions, 'create');
    const many = vi.spyOn(repos.transactions, 'findByExternalIds');
    const insert = vi.spyOn(repos.transactions, 'createMany');
    gw.txs.cc = [...gw.txs.cc!, bankTx('novo-1'), bankTx('novo-2')];
    const r = await sync.execute({ connectionId: connection.id });

    expect(r.importedCount).toBe(2); // só os 2 novos
    expect(one).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(many).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]![1]).toEqual({ skipDuplicates: true });
    expect(insert.mock.calls[0]![0]).toHaveLength(2);
    expect(repos.transactions.items).toHaveLength(32);
  });

  it('contas e conexões são lidas uma vez por sync, não uma vez por conta/cartão', async () => {
    const gw = new Scripted();
    gw.accounts = [
      { externalId: 'cc', name: 'Corrente', type: 'BANK', balanceInCents: 1 },
      { externalId: 'c1', name: 'Cartão 1', type: 'CREDIT', balanceInCents: -1, fingerprint: 'CREDIT:VISA:1' },
      { externalId: 'c2', name: 'Cartão 2', type: 'CREDIT', balanceInCents: -1, fingerprint: 'CREDIT:VISA:2' },
    ];
    const { repos, sync, connection } = await setup(gw);
    const list = vi.spyOn(repos.accounts, 'listByUser');
    const conns = vi.spyOn(repos.connections, 'listByUser');
    const fp = vi.spyOn(repos.accounts, 'findByFingerprint');
    await sync.execute({ connectionId: connection.id });
    // 1 leitura inicial (a mesma serve pras ocultas na conciliação); nada de findByFingerprint/findById por cartão.
    expect(list.mock.calls.length).toBeLessThanOrEqual(2);
    expect(conns).toHaveBeenCalledTimes(1);
    expect(fp).not.toHaveBeenCalled();
  });

  it('o mesmo lançamento duas vezes na mesma resposta do banco entra uma vez só', async () => {
    const gw = new Scripted();
    gw.txs.cc = [bankTx('dup'), bankTx('dup'), bankTx('outro')];
    const { repos } = await setup(gw);
    expect(repos.transactions.items.map((t) => t.externalId).sort()).toEqual(['dup', 'outro']);
  });

  it('o banco corrigiu o valor de um lançamento que já existe: acompanha (e só esse é salvo)', async () => {
    const gw = new Scripted();
    gw.txs.cc = [bankTx('a', { amountInCents: -10_00 }), bankTx('b', { amountInCents: -20_00 })];
    const { repos, sync, connection } = await setup(gw);
    const save = vi.spyOn(repos.transactions, 'save');
    gw.txs.cc = [bankTx('a', { amountInCents: -99_00 }), bankTx('b', { amountInCents: -20_00 })];
    const r = await sync.execute({ connectionId: connection.id });
    expect(r.importedCount).toBe(0);
    expect(repos.transactions.items.find((t) => t.externalId === 'a')!.amountInCents).toBe(-99_00);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('transferência entre contas é marcada em lote (setInternalTransfer), sem um save por lançamento', async () => {
    const gw = new Scripted();
    gw.accounts = [
      { externalId: 'cc', name: 'Corrente', type: 'BANK', balanceInCents: 1 },
      { externalId: 'cp', name: 'Poupança', type: 'BANK', balanceInCents: 1 },
    ];
    gw.txs.cc = [bankTx('saida', { description: 'PIX ENVIADO', amountInCents: -500_00 })];
    gw.txs.cp = [bankTx('entrada', { description: 'PIX RECEBIDO', amountInCents: 500_00 })];
    const { repos } = await setup(gw);
    const internal = repos.transactions.items.filter((t) => t.isInternalTransfer).map((t) => t.externalId);
    expect(internal.sort()).toEqual(['entrada', 'saida']);
  });
});

describe('importação de extrato em lote', () => {
  const CSV = (n: number) =>
    'Data,Valor,Identificador,Descrição\n' +
    Array.from({ length: n }, (_, i) => `03/11/2026,-${10 + i}.00,id${i},LOJA ${i}`).join('\n');

  it('1 busca dos existentes + 1 INSERT em lote; importar de novo pula tudo e as contas são lidas uma vez', async () => {
    const repos = makeInMemoryRepositories();
    const imp = new ImportStatementUseCase(repos);
    const first = await imp.execute({ userId: 'u1', accountName: 'Itaú', fileName: 'a.csv', content: CSV(40) });
    expect(first).toMatchObject({ importedCount: 40, skipped: 0 });

    const one = vi.spyOn(repos.transactions, 'findByExternalId');
    const create = vi.spyOn(repos.transactions, 'create');
    const list = vi.spyOn(repos.accounts, 'listByUser');
    const again = await imp.execute({ userId: 'u1', accountName: 'Itaú', fileName: 'a.csv', content: CSV(40) });
    expect(again).toMatchObject({ importedCount: 0, skipped: 40 });
    expect(one).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
    expect(repos.transactions.items).toHaveLength(40);

    // arquivo maior: só as linhas novas entram, e `skipped` conta as repetidas
    const bigger = await imp.execute({ userId: 'u1', accountName: 'Itaú', fileName: 'b.csv', content: CSV(55) });
    expect(bigger).toMatchObject({ importedCount: 15, skipped: 40 });
  });
});

describe('caderninho, amigos e convites sem N+1', () => {
  it('ListPeople agrega no banco: saldo, contagem e último acerto sem ler os lançamentos de cada pessoa', async () => {
    const repos = makeInMemoryRepositories();
    const ana = await repos.people.create({ userId: 'u1', name: 'Ana' });
    const bia = await repos.people.create({ userId: 'u1', name: 'Bia' });
    await repos.people.create({ userId: 'u1', name: 'Caio' }); // sem acertos
    const add = (personId: string, cents: number, at: string) =>
      repos.transactions.create({
        userId: 'u1',
        accountId: null,
        externalId: null,
        description: 'acerto',
        amountInCents: cents,
        occurredAt: new Date(at),
        categoryId: null,
        isInternalTransfer: true,
        seriesId: null,
        personId,
      });
    await add(ana.id, -50_00, '2026-11-01T12:00:00Z');
    await add(ana.id, 20_00, '2026-11-05T12:00:00Z');
    await add(bia.id, 10_00, '2026-11-03T12:00:00Z');
    const byPerson = vi.spyOn(repos.transactions, 'findByPerson');

    const r = await new ListPeopleUseCase(repos).execute({ userId: 'u1' });
    expect(byPerson).not.toHaveBeenCalled();
    expect(r.people.map((p) => [p.name, p.balanceInCents, p.count, p.lastAt])).toEqual([
      ['Ana', 30_00, 2, '2026-11-05T12:00:00.000Z'],
      ['Bia', -10_00, 1, '2026-11-03T12:00:00.000Z'],
      ['Caio', 0, 0, null],
    ]);
    expect(r.owedToYouInCents).toBe(30_00);
    expect(r.youOweInCents).toBe(10_00);
  });

  it('ranking de amigos: pessoas, atividade e lições vêm de uma vez (3 consultas), e o resultado é o mesmo', async () => {
    const repos = makeInMemoryRepositories();
    const eng = new EngagementUseCase(repos, () => NOW);
    const me = await repos.users.create({ name: 'Ana Souza', email: 'a@x.com', passwordHash: 'x' });
    const friends = [];
    for (const [i, name] of ['Bia Lima', 'Caio Reis', 'Dani Luz'].entries()) {
      const f = await repos.users.create({ name, email: `f${i}@x.com`, passwordHash: 'x' });
      friends.push(f);
      const req = await eng.addFriend(f.id, (await eng.friends(me.id)).code);
      const incoming = (await eng.friends(me.id)).requests.incoming.find((r) => r.name === name.split(' ')[0]);
      void req;
      void incoming;
    }
    // aceita os pedidos pelo lado de quem recebe (a Ana) e dá atividade diferente a cada amigo
    for (const r of (await eng.friends(me.id)).requests.incoming) await eng.respondRequest(me.id, r.id, true);
    await eng.track(me.id, 'visita:inicio');
    await eng.track(friends[0]!.id, 'visita:inicio');
    await eng.track(friends[0]!.id, 'visita:previsao');
    await eng.track(friends[1]!.id, 'visita:inicio');
    await repos.lessons.markDone(friends[2]!.id, 'm1l1');

    const activity = vi.spyOn(repos.engagement, 'listActivity');
    const lessons = vi.spyOn(repos.lessons, 'listByUser');
    const findOne = vi.spyOn(repos.users, 'findById');
    const manyUsers = vi.spyOn(repos.users, 'findManyByIds');
    const many = vi.spyOn(repos.engagement, 'listActivityForUsers');

    const res = await eng.friends(me.id);
    expect(res.ranking.map((p) => p.name)).toHaveLength(me.id ? 4 : 0);
    expect(res.ranking.find((p) => p.me)!.name).toBe('Ana');
    expect(new Set(res.ranking.map((p) => p.name))).toEqual(new Set(['Ana', 'Bia', 'Caio', 'Dani']));
    expect(res.ranking.find((p) => p.name === 'Bia')!.weekScore).toBeGreaterThanOrEqual(
      res.ranking.find((p) => p.name === 'Caio')!.weekScore,
    );
    // nada por amigo: nenhuma consulta de atividade/lição individual, e as pessoas numa query só
    expect(activity).not.toHaveBeenCalled();
    expect(lessons).not.toHaveBeenCalled();
    expect(many).toHaveBeenCalledTimes(1);
    expect(manyUsers).toHaveBeenCalledTimes(1);
    expect(findOne.mock.calls.length).toBeLessThanOrEqual(1); // só o fuso de quem pediu
  });

  it('o ranking de amigos dá o MESMO placar que o de cada pessoa sozinha (score)', async () => {
    const repos = makeInMemoryRepositories();
    const eng = new EngagementUseCase(repos, () => NOW);
    const me = await repos.users.create({ name: 'Ana Souza', email: 'a@x.com', passwordHash: 'x' });
    const bia = await repos.users.create({ name: 'Bia Lima', email: 'b@x.com', passwordHash: 'x' });
    await eng.addFriend(bia.id, (await eng.friends(me.id)).code);
    const incoming = (await eng.friends(me.id)).requests.incoming[0]!;
    await eng.respondRequest(me.id, incoming.id, true);
    for (const kind of ['visita:inicio', 'visita:previsao', 'visita:limites']) await eng.track(bia.id, kind);
    await repos.lessons.markDone(bia.id, 'm1l1');
    const solo = await eng.score(bia.id);
    const biaInRanking = (await eng.friends(me.id)).ranking.find((p) => p.id === bia.id)!;
    expect(biaInRanking).toMatchObject({ streakDays: solo.streakDays, weekScore: solo.weekScore });
  });

  it('ListInvites resolve quem usou cada convite numa query só', async () => {
    const repos = makeInMemoryRepositories();
    const owner = await repos.users.create({ name: 'Dona', email: 'd@x.com', passwordHash: 'x' });
    const u1 = await repos.users.create({ name: 'Uso Um', email: '1@x.com', passwordHash: 'x' });
    const u2 = await repos.users.create({ name: 'Uso Dois', email: '2@x.com', passwordHash: 'x' });
    const i1 = await repos.invites.create({ code: 'TOST-AAAA-1111', createdById: owner.id });
    const i2 = await repos.invites.create({ code: 'TOST-AAAA-2222', createdById: owner.id });
    await repos.invites.create({ code: 'TOST-AAAA-3333', createdById: owner.id }); // ainda sem uso
    await repos.invites.markUsed(i1.code, u1.id);
    await repos.invites.markUsed(i2.code, u2.id);
    const findOne = vi.spyOn(repos.users, 'findById');
    const many = vi.spyOn(repos.users, 'findManyByIds');

    const { invites } = await new ListInvitesUseCase(repos).execute({ userId: owner.id });
    expect(findOne).not.toHaveBeenCalled();
    expect(many).toHaveBeenCalledTimes(1);
    expect(many.mock.calls[0]![0].sort()).toEqual([u1.id, u2.id].sort());
    expect(invites.map((i) => [i.code, i.usedBy]).sort()).toEqual([
      ['TOST-AAAA-1111', 'Uso Um'],
      ['TOST-AAAA-2222', 'Uso Dois'],
      ['TOST-AAAA-3333', null],
    ]);
  });
});

describe('categorização automática em lote', () => {
  async function setup() {
    const repos = makeInMemoryRepositories();
    const user = await repos.users.create({ name: 'Pedro', email: 'p@x.com', passwordHash: 'x' });
    await repos.users.setAiConsent(user.id, new Date());
    const ai = new FakeAiGateway();
    const add = (description: string, amountInCents: number) =>
      repos.transactions.create({
        userId: user.id,
        accountId: 'a1',
        externalId: null,
        description,
        amountInCents,
        occurredAt: new Date('2026-11-10T12:00:00Z'),
        categoryId: null,
        isInternalTransfer: false,
      });
    return {
      repos,
      ai,
      add,
      uid: user.id,
      uc: new AutoCategorizeUseCase(repos, ai, new MemoryKeyValueStore(), vi.fn()),
    };
  }

  it('um UPDATE por grupo (descrições iguais), sem findById/save por lançamento', async () => {
    const { repos, ai, add, uid, uc } = await setup();
    await add('IFOOD *RESTAURANTE 1', -45_00);
    await add('IFOOD *RESTAURANTE 2', -30_00);
    await add('IFOOD *RESTAURANTE 3', -20_00);
    ai.next = JSON.stringify({ t: { '0': 'delivery' } }); // as 3 viram UMA pergunta (mesma descrição sem o código)
    const byId = vi.spyOn(repos.transactions, 'findById');
    const save = vi.spyOn(repos.transactions, 'save');
    const batch = vi.spyOn(repos.transactions, 'categorizeUncategorized');

    const r = await uc.execute({ userId: uid });
    expect(r).toEqual({ categorized: 3, asked: 3 });
    expect(byId).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(batch).toHaveBeenCalledTimes(1);
    expect(repos.transactions.items.every((t) => t.categoryId === 'delivery')).toBe(true);
  });

  it('se a pessoa categorizou um deles enquanto a IA pensava, a escolha dela fica e não conta', async () => {
    const { repos, ai, add, uid, uc } = await setup();
    const a = await add('IFOOD *RESTAURANTE 1', -45_00);
    await add('IFOOD *RESTAURANTE 2', -30_00);
    ai.next = JSON.stringify({ t: { '0': 'delivery' } });
    const reply = ai.reply.bind(ai);
    ai.reply = async (...args) => {
      repos.transactions.items.find((t) => t.id === a.id)!.categoryId = 'mercado'; // a pessoa mexeu no meio
      return reply(...args);
    };
    const r = await uc.execute({ userId: uid });
    expect(r.categorized).toBe(1);
    expect(repos.transactions.items.find((t) => t.id === a.id)!.categoryId).toBe('mercado');
  });
});

describe('avisos: só quem pode receber', () => {
  const WED_7H = new Date('2026-11-18T10:00:00Z'); // quarta, 07h de Brasília: nenhum aviso dispara, só a varredura roda

  it('não varre todos os usuários: pagina só quem ligou o WhatsApp (todas as páginas são visitadas)', async () => {
    const repos = makeInMemoryRepositories();
    for (let i = 0; i < 1203; i++) {
      const id = `u${String(i).padStart(5, '0')}`;
      repos.tostaoAuto.configs.set(id, {
        userId: id,
        carameloExtrato: true,
        tostaoPrevisao: true,
        guardiaoLimites: true,
        olheiroAcertos: true,
        notifyPush: true,
        notifyWhatsapp: true,
        notifySafeToSpend: false,
        lastCheckedAt: null,
        updatedAt: WED_7H,
      });
    }
    repos.tostaoAuto.configs.set('ninguem', {
      ...repos.tostaoAuto.configs.get('u00000')!,
      userId: 'ninguem',
      notifyWhatsapp: false,
      notifySafeToSpend: false,
    });
    const all = vi.spyOn(repos.users, 'listAllIds');
    const page = vi.spyOn(repos.tostaoAuto, 'listWhatsappNotifiableUserIds');
    const config = vi.spyOn(repos.tostaoAuto, 'getConfig');

    await runNotifications(repos, new FakePushGateway(), WED_7H, new FakeWhatsAppGateway(true));
    expect(all).not.toHaveBeenCalled();
    expect(page.mock.calls.length).toBe(3); // 500 + 500 + 203
    expect(page.mock.calls.map((c) => c[0].after)).toEqual([null, 'u00499', 'u00999']);
    expect(config).toHaveBeenCalledTimes(1203); // todos os elegíveis, uma vez cada; "ninguem" (desligado) não entra
  });

  it('com o WhatsApp desligado, nem consulta a lista de elegíveis', async () => {
    const repos = makeInMemoryRepositories();
    const page = vi.spyOn(repos.tostaoAuto, 'listWhatsappNotifiableUserIds');
    await runNotifications(repos, new FakePushGateway(), WED_7H, new FakeWhatsAppGateway(false));
    expect(page).not.toHaveBeenCalled();
  });
});
