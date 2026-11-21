// T2.1 contra Postgres REAL: os métodos em lote dos repositórios (no lugar dos N+1) e os índices novos.
// Só roda com TEST_DATABASE_URL (banco descartável com as migrations e o seed).
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePrismaRepositories } from './index.js';

const url = process.env.TEST_DATABASE_URL;
const uniq = () => randomUUID().slice(0, 8);
const DAY = 86_400_000;

describe.skipIf(!url)('T2.1 no Postgres real', () => {
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
  const tx = (userId: string, over: Record<string, unknown> = {}) => ({
    userId,
    accountId: null,
    externalId: null,
    description: 'x',
    amountInCents: -10_00,
    occurredAt: new Date(),
    categoryId: null,
    isInternalTransfer: false,
    seriesId: null,
    ...over,
  });

  describe('índices da migration 20261123100000_t21_indexes', () => {
    it('os parciais, o GIN de trigrama e os índices das FKs existem', async () => {
      const rows = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`
        SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`;
      const defs = new Map(rows.map((r) => [r.indexname, r.indexdef]));
      for (const name of [
        'transactions_account_id_idx',
        'transactions_category_id_idx',
        'transactions_user_id_account_id_occurred_at_idx',
        'transactions_user_id_person_id_occurred_at_idx',
        'transactions_user_id_series_id_occurred_at_idx',
        'transactions_uncategorized_idx',
        'transactions_manual_idx',
        'transactions_description_trgm_idx',
        'accounts_connection_id_idx',
        'bank_connections_status_idx',
        'categories_user_id_idx',
        'category_rules_category_id_idx',
        'category_budgets_category_id_idx',
        'password_resets_user_id_idx',
        'password_resets_expires_at_idx',
        'friendships_friend_id_idx',
        'chat_messages_user_id_role_created_at_idx',
        'sent_notifications_sent_at_idx',
        'tostao_insights_expires_at_idx',
      ])
        expect(defs.has(name), name).toBe(true);
      expect(defs.get('transactions_uncategorized_idx')).toMatch(
        /WHERE.*category_id IS NULL.*is_internal_transfer = false/,
      );
      expect(defs.get('transactions_manual_idx')).toMatch(/WHERE.*external_id IS NULL/);
      expect(defs.get('transactions_description_trgm_idx')).toMatch(/USING gin.*gin_trgm_ops/);
    });

    it('o ILIKE da busca usa o GIN de trigrama (e os índices parciais atendem as consultas de pendentes e manuais)', async () => {
      const u = await newUser();
      // Volume suficiente pro planejador preferir índice a varredura sequencial.
      await db.transaction.createMany({
        data: Array.from({ length: 6000 }, (_, i) => ({
          userId: u.id,
          description: `COMPRA ${i} LOJA ${i % 97}`,
          amountInCents: -100n,
          occurredAt: new Date(Date.now() - i * 60_000),
        })),
      });
      await db.$executeRawUnsafe('ANALYZE transactions');
      // Numa tabela de teste pequena o planejador (com razão) prefere varrer tudo. Desligando o seq scan só nesta
      // transação, o plano mostra se o índice SERVE pra consulta: é o que importa quando a tabela crescer.
      const plan = (sql: string) =>
        db.$transaction(async (t) => {
          await t.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
          return (await t.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(`EXPLAIN ${sql}`))
            .map((r) => r['QUERY PLAN'])
            .join('\n');
        });
      expect(await plan(`SELECT id FROM transactions WHERE description ILIKE '%loja 42%'`)).toMatch(
        /Bitmap Index Scan on transactions_description_trgm_idx/,
      );
      // Sem categoria, de uma pessoa específica: sai de índice (o parcial de pendentes ou o de usuário+data).
      expect(
        await plan(
          `SELECT id FROM transactions WHERE user_id = '${u.id}' AND category_id IS NULL AND is_internal_transfer = false ORDER BY occurred_at DESC LIMIT 20`,
        ),
      ).toMatch(/Index[\s\S]*transactions_(uncategorized|user_id_occurred_at)_idx/);
      // Anotações à mão (sem external_id): resolvidas por índice (o parcial ou o único de usuário+external_id), sem varrer tudo.
      expect(
        await plan(
          `SELECT id FROM transactions WHERE user_id = '${u.id}' AND external_id IS NULL ORDER BY occurred_at DESC`,
        ),
      ).not.toMatch(/Seq Scan/);
    });
  });

  describe('transactions em lote', () => {
    it('findByExternalIds: só os da pessoa, em lotes (mais de 1000 ids)', async () => {
      const a = await newUser('A');
      const b = await newUser('B');
      await repos.transactions.createMany([
        tx(a.id, { externalId: 'e1' }),
        tx(a.id, { externalId: 'e2' }),
        tx(b.id, { externalId: 'e1' }),
      ]);
      const ids = ['e1', 'e2', 'e3', ...Array.from({ length: 1500 }, (_, i) => `nope-${i}`)];
      const found = await repos.transactions.findByExternalIds(a.id, ids);
      expect(found.map((t) => t.externalId).sort()).toEqual(['e1', 'e2']);
      expect(found.every((t) => t.userId === a.id)).toBe(true);
      expect(await repos.transactions.findByExternalIds(a.id, [])).toEqual([]);
    });

    it('createMany com skipDuplicates: pula o que já existe, conta só os novos, e a corrida não duplica', async () => {
      const u = await newUser();
      expect(await repos.transactions.createMany([tx(u.id, { externalId: 'a' })])).toBe(1);
      const created = await repos.transactions.createMany(
        [tx(u.id, { externalId: 'a' }), tx(u.id, { externalId: 'b' }), tx(u.id, { externalId: 'b' })],
        { skipDuplicates: true },
      );
      expect(created).toBe(1); // 'a' já existia; o 'b' repetido no mesmo lote entra uma vez só
      // Dois imports simultâneos do mesmo arquivo: nenhum estoura e o total é exato.
      const rows = Array.from({ length: 50 }, (_, i) => tx(u.id, { externalId: `race-${i}` }));
      const [x, y] = await Promise.all([
        repos.transactions.createMany(rows, { skipDuplicates: true }),
        repos.transactions.createMany(rows, { skipDuplicates: true }),
      ]);
      expect(x + y).toBe(50);
      expect(await db.transaction.count({ where: { userId: u.id, externalId: { startsWith: 'race-' } } })).toBe(50);
      // Lote grande (passa de 1 INSERT): tudo entra.
      const big = Array.from({ length: 2500 }, (_, i) => tx(u.id, { externalId: `big-${i}` }));
      expect(await repos.transactions.createMany(big, { skipDuplicates: true })).toBe(2500);
      expect(await repos.transactions.createMany(big, { skipDuplicates: true })).toBe(0);
    });

    it('createMany sem a opção continua "tudo ou nada": duplicata derruba o lote inteiro', async () => {
      const u = await newUser();
      await repos.transactions.createMany([tx(u.id, { externalId: 'dup' })]);
      await expect(
        repos.transactions.createMany([tx(u.id, { externalId: 'novo' }), tx(u.id, { externalId: 'dup' })]),
      ).rejects.toThrow();
      expect(await db.transaction.count({ where: { userId: u.id, externalId: 'novo' } })).toBe(0);
    });

    it('setInternalTransfer: só os ids pedidos, só da pessoa, e não mexe na decisão manual', async () => {
      const a = await newUser('A');
      const b = await newUser('B');
      const t1 = await repos.transactions.create(tx(a.id));
      const t2 = await repos.transactions.create(tx(a.id, { internalTransferManual: false }));
      const t3 = await repos.transactions.create(tx(a.id));
      const other = await repos.transactions.create(tx(b.id));
      expect(await repos.transactions.setInternalTransfer(a.id, [t1.id, t2.id, other.id], true)).toBe(2);
      expect((await repos.transactions.findById(t1.id))!.isInternalTransfer).toBe(true);
      expect((await repos.transactions.findById(t2.id))!.internalTransferManual).toBe(false); // intacta
      expect((await repos.transactions.findById(t3.id))!.isInternalTransfer).toBe(false);
      expect((await repos.transactions.findById(other.id))!.isInternalTransfer).toBe(false); // de outra pessoa
      expect(await repos.transactions.setInternalTransfer(a.id, [], true)).toBe(0);
    });

    it('categorizeUncategorized: não sobrescreve quem a pessoa categorizou no meio do caminho', async () => {
      const u = await newUser();
      const cat = `c-${uniq()}`;
      await db.category.create({ data: { id: cat, name: 'Mercado', emoji: '🛒', color: '#111', userId: u.id } });
      const free = await repos.transactions.create(tx(u.id));
      const taken = await repos.transactions.create(tx(u.id, { categoryId: 'transporte' }));
      expect(await repos.transactions.categorizeUncategorized(u.id, [free.id, taken.id], cat)).toBe(1);
      expect((await repos.transactions.findById(free.id))!.categoryId).toBe(cat);
      expect((await repos.transactions.findById(taken.id))!.categoryId).toBe('transporte');
      expect(await repos.transactions.categorizeUncategorized(u.id, [], cat)).toBe(0);
    });

    it('summarizeByPerson: saldo, contagem e último acerto por pessoa, numa query, sem vazar de outro usuário', async () => {
      const a = await newUser('A');
      const b = await newUser('B');
      const ana = await db.person.create({ data: { userId: a.id, name: 'Ana' } });
      const bia = await db.person.create({ data: { userId: a.id, name: 'Bia' } });
      const t0 = new Date(Date.UTC(2026, 9, 1));
      const t1 = new Date(Date.UTC(2026, 9, 5));
      await repos.transactions.createMany([
        tx(a.id, { personId: ana.id, amountInCents: -50_00, occurredAt: t0 }), // emprestei: ela me deve
        tx(a.id, { personId: ana.id, amountInCents: 20_00, occurredAt: t1 }), // ela pagou parte
        tx(a.id, { personId: bia.id, amountInCents: 10_00, occurredAt: t0 }), // peguei emprestado: devo
        tx(a.id, { amountInCents: -999 }), // sem pessoa: fora
        tx(b.id, { amountInCents: -777 }),
      ]);
      const by = new Map((await repos.transactions.summarizeByPerson(a.id)).map((r) => [r.personId, r]));
      expect(by.size).toBe(2);
      expect(by.get(ana.id)).toEqual({ personId: ana.id, balanceInCents: 30_00, count: 2, lastAt: t1 });
      expect(by.get(bia.id)).toMatchObject({ balanceInCents: -10_00, count: 1 });
      expect(await repos.transactions.summarizeByPerson(b.id)).toEqual([]);
    });
  });

  it('users.findManyByIds traz só os pedidos (e vazio não vai ao banco)', async () => {
    const [a, b, c] = await Promise.all([newUser('A'), newUser('B'), newUser('C')]);
    const got = await repos.users.findManyByIds([a.id, c.id, randomUUID()]);
    expect(got.map((u) => u.id).sort()).toEqual([a.id, c.id].sort());
    expect(b.id).not.toBe(a.id);
    expect(await repos.users.findManyByIds([])).toEqual([]);
  });

  it('atividade e lições de vários usuários numa query só, cada linha com o dono', async () => {
    const [a, b, c] = await Promise.all([newUser('A'), newUser('B'), newUser('C')]);
    await db.userActivity.createMany({
      data: [
        { userId: a.id, day: new Date('2026-11-18'), kind: 'visita:inicio' },
        { userId: b.id, day: new Date('2026-11-19'), kind: 'licao' },
        { userId: b.id, day: new Date('2026-01-01'), kind: 'licao' }, // antes do corte
        { userId: c.id, day: new Date('2026-11-19'), kind: 'licao' }, // não pedido
      ],
    });
    const rows = await repos.engagement.listActivityForUsers([a.id, b.id], '2026-11-01');
    expect(rows.map((r) => `${r.userId === a.id ? 'a' : 'b'}:${r.day}:${r.kind}`).sort()).toEqual([
      'a:2026-11-18:visita:inicio',
      'b:2026-11-19:licao',
    ]);
    await repos.lessons.markDone(a.id, 'm1l1');
    await repos.lessons.markDone(b.id, 'm1l2');
    await repos.lessons.markDone(c.id, 'm1l3');
    const lessons = await repos.lessons.listByUsers([a.id, b.id]);
    expect(lessons.map((l) => l.lessonId).sort()).toEqual(['m1l1', 'm1l2']);
    expect(await repos.lessons.listByUsers([])).toEqual([]);
    expect(await repos.engagement.listActivityForUsers([], '2026-01-01')).toEqual([]);
  });

  describe('Tostão Auto', () => {
    it('listByUser: sem achado vencido, mais novos primeiro e no máximo 50', async () => {
      const u = await newUser();
      const now = new Date();
      await db.tostaoInsight.createMany({
        data: [
          ...Array.from({ length: 55 }, (_, i) => ({
            userId: u.id,
            routine: 'caramelo_extrato',
            kind: 'k',
            title: `t${i}`,
            body: 'b',
            payload: {},
            dedupeKey: `d${i}`,
            createdAt: new Date(now.getTime() - i * 1000),
          })),
          {
            userId: u.id,
            routine: 'caramelo_extrato',
            kind: 'k',
            title: 'vencido',
            body: 'b',
            payload: {},
            dedupeKey: 'old',
            createdAt: now,
            expiresAt: new Date(now.getTime() - DAY),
          },
          {
            userId: u.id,
            routine: 'caramelo_extrato',
            kind: 'k',
            title: 'vivo',
            body: 'b',
            payload: {},
            dedupeKey: 'live',
            createdAt: new Date(now.getTime() + 1000),
            expiresAt: new Date(now.getTime() + DAY),
          },
        ],
      });
      const list = await repos.tostaoAuto.listByUser(u.id, { now });
      expect(list).toHaveLength(50);
      expect(list[0]!.title).toBe('vivo'); // o mais novo
      expect(list.some((i) => i.title === 'vencido')).toBe(false);
      expect((await repos.tostaoAuto.listByUser(u.id, { now, limit: 3 })).map((i) => i.title)).toEqual([
        'vivo',
        't0',
        't1',
      ]);
    });

    it('listWhatsappNotifiableUserIds: só quem ligou o aviso E tem número vinculado, em páginas por id', async () => {
      const users = await Promise.all([newUser('N1'), newUser('N2'), newUser('N3'), newUser('N4'), newUser('N5')]);
      const [linked1, linked2, linked3, noPhone, off] = users;
      for (const u of [linked1!, linked2!, linked3!, noPhone!])
        await repos.tostaoAuto.updateConfig(u.id, { notifyWhatsapp: true });
      await repos.tostaoAuto.updateConfig(off!.id, { notifyWhatsapp: false });
      for (const u of [linked1!, linked2!, linked3!, off!])
        await db.whatsappLink.create({ data: { userId: u.id, phone: `55${uniq()}${uniq()}` } });
      await db.whatsappLink.create({ data: { userId: noPhone!.id } }); // só o código, sem número
      const mine = new Set([linked1!.id, linked2!.id, linked3!.id]);
      const all: string[] = [];
      for (let after: string | null = null; ;) {
        const page: string[] = await repos.tostaoAuto.listWhatsappNotifiableUserIds({ after, limit: 2 });
        all.push(...page);
        if (page.length < 2) break;
        after = page[page.length - 1]!;
      }
      expect([...mine].every((id) => all.includes(id))).toBe(true);
      expect(all.includes(noPhone!.id)).toBe(false);
      expect(all.includes(off!.id)).toBe(false);
      expect(new Set(all).size).toBe(all.length); // sem repetir entre páginas
      expect([...all]).toEqual([...all].sort()); // em ordem de id
    });
  });
});
