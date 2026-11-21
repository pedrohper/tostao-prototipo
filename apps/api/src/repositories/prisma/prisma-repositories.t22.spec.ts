// T2.2 contra Postgres REAL: a busca (`transactions.search`) filtra, ordena, pagina e soma no banco.
// Só roda com TEST_DATABASE_URL (banco descartável com as migrations e o seed).
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { isYieldTransaction } from '@tostao/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePrismaRepositories } from './index.js';
import { makeInMemoryRepositories } from '../in-memory/index.js';
import type { TransactionSearchFilter } from '../types.js';
import { SearchTransactionsUseCase } from '../../use-cases/search-transactions.js';
import { searchWords } from '../../lib/text.js';

const url = process.env.TEST_DATABASE_URL;
const uniq = () => randomUUID().slice(0, 8);
const DAY = 86_400_000;
const NOW = new Date(Date.UTC(2026, 10, 20, 18));
const at = (daysAgo: number, hour = 12) => new Date(Date.UTC(2026, 10, 20 - daysAgo, hour));

describe.skipIf(!url)('T2.2 busca no Postgres real', () => {
  let db: PrismaClient;
  let repos: ReturnType<typeof makePrismaRepositories>;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
    repos = makePrismaRepositories(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  async function world() {
    const user = await db.user.create({ data: { name: 'Pessoa', email: `p-${uniq()}@x.com`, passwordHash: 'x' } });
    const other = await db.user.create({ data: { name: 'Outra', email: `o-${uniq()}@x.com`, passwordHash: 'x' } });
    const conn = await db.bankConnection.create({ data: { userId: user.id, itemId: `item-${uniq()}` } });
    const mkAccount = (name: string, hidden = false) =>
      db.account.create({
        data: {
          userId: user.id,
          connectionId: conn.id,
          externalId: `a-${uniq()}`,
          name,
          type: 'BANK',
          balanceInCents: 0,
          hidden,
        },
      });
    const nubank = await mkAccount('Nubank');
    const hiddenAcc = await mkAccount('Poupança Escondida', true);
    const catId = `c-${uniq()}`;
    await db.category.create({
      data: { id: catId, name: 'Supermercado', emoji: '🛒', color: '#111', userId: user.id },
    });
    const add = (description: string, amountInCents: number, when: Date, extra: Record<string, unknown> = {}) =>
      db.transaction.create({
        data: { userId: user.id, description, amountInCents: BigInt(amountInCents), occurredAt: when, ...extra },
      });
    return { user, other, nubank, hiddenAcc, catId, add };
  }

  const filter = (over: Partial<TransactionSearchFilter> = {}): TransactionSearchFilter => ({
    from: null,
    to: new Date(NOW.getTime() + DAY),
    words: [],
    kind: 'todas',
    limit: 50,
    ...over,
  });

  it('cada palavra casa com a descrição, o nome da categoria OU o nome da conta (AND entre as palavras)', async () => {
    const { user, nubank, catId, add } = await world();
    await add('PIX ENVIADO DANIELA', -50_00, at(1), { accountId: nubank.id });
    await add('Compra qualquer', -30_00, at(2), { categoryId: catId });
    await add('Outra coisa', -20_00, at(3));
    const ids = async (words: string[]) =>
      (await repos.transactions.search(user.id, filter({ words }))).transactions.map((t) => t.description);
    expect(await ids(['dani'])).toEqual(['PIX ENVIADO DANIELA']); // descrição, sem diferenciar maiúscula
    expect(await ids(['supermercado'])).toEqual(['Compra qualquer']); // nome da categoria
    expect(await ids(['nubank'])).toEqual(['PIX ENVIADO DANIELA']); // nome da conta
    expect(await ids(['pix', 'nubank'])).toEqual(['PIX ENVIADO DANIELA']); // descrição E conta
    expect(await ids(['pix', 'supermercado'])).toEqual([]); // AND: nenhuma tem os dois
    expect(await ids([])).toHaveLength(3); // sem palavra = tudo
    expect(await ids(['açaí'])).toEqual([]);
  });

  it('só os lançamentos da PESSOA, nunca de outra', async () => {
    const { user, other, add } = await world();
    await add('segredo da pessoa', -10_00, at(1));
    await db.transaction.create({
      data: { userId: other.id, description: 'segredo de outra', amountInCents: -99n, occurredAt: at(1) },
    });
    const r = await repos.transactions.search(user.id, filter({ words: ['segredo'] }));
    expect(r.transactions.map((t) => t.description)).toEqual(['segredo da pessoa']);
    expect(r.count).toBe(1);
  });

  it('conta oculta some da lista e da soma; lançamento sem conta continua', async () => {
    const { user, hiddenAcc, nubank, add } = await world();
    await add('na oculta', -100_00, at(1), { accountId: hiddenAcc.id });
    await add('na visivel', -10_00, at(2), { accountId: nubank.id });
    await add('sem conta', -5_00, at(3));
    const r = await repos.transactions.search(user.id, filter());
    expect(r.transactions.map((t) => t.description)).toEqual(['na visivel', 'sem conta']);
    expect(r).toMatchObject({ count: 2, outInCents: 15_00 });
  });

  it('kind, categoria ("sem"), período, transferência e rendimento filtram no banco', async () => {
    const { user, catId, add } = await world();
    await add('mercado', -40_00, at(1), { categoryId: catId });
    await add('sem categoria', -10_00, at(2));
    await add('salario', 3000_00, at(3));
    await add('PAGAMENTO FATURA', -500_00, at(4), { isInternalTransfer: true });
    await add('Rendimentos', 17, at(5));
    await add('antigo', -1_00, at(400));
    const d = async (f: Partial<TransactionSearchFilter>) =>
      (await repos.transactions.search(user.id, filter(f))).transactions.map((t) => t.description);

    expect(await d({ kind: 'entrada' })).toEqual(['salario', 'Rendimentos']);
    expect(await d({ kind: 'saida', from: new Date(NOW.getTime() - 30 * DAY) })).toEqual([
      'mercado',
      'sem categoria',
      'PAGAMENTO FATURA',
    ]);
    expect(await d({ categoryId: 'sem', from: new Date(NOW.getTime() - 30 * DAY) })).toEqual([
      'sem categoria',
      'salario',
      'PAGAMENTO FATURA',
      'Rendimentos',
    ]);
    expect(await d({ categoryId: catId })).toEqual(['mercado']);
    expect(await d({ excludeTransfers: true, from: new Date(NOW.getTime() - 30 * DAY) })).not.toContain(
      'PAGAMENTO FATURA',
    );
    expect(await d({ excludeYields: true, from: new Date(NOW.getTime() - 30 * DAY) })).not.toContain('Rendimentos');
    expect(await d({})).toContain('antigo');
    expect(await d({ from: new Date(NOW.getTime() - 366 * DAY) })).not.toContain('antigo');
  });

  it('transferência interna aparece na lista, entra no count, mas NÃO nas somas', async () => {
    const { user, add } = await world();
    await add('fatura paga', -90_00, at(1), { isInternalTransfer: true });
    await add('mercado', -10_00, at(2));
    await add('recebido', 5_00, at(3));
    expect(await repos.transactions.search(user.id, filter())).toMatchObject({
      count: 3,
      outInCents: 10_00,
      inInCents: 5_00,
    });
  });

  it('excludeYields em SQL dá o MESMO resultado que isYieldTransaction (paridade com o contrato)', async () => {
    const { user, add } = await world();
    const corpus: [string, number][] = [
      ['Rendimentos', 17],
      ['RENDIMENTO CDB', 120],
      ['REND PAGO APLIC AUT', 50],
      ['Dividendos PETR4', 300],
      ['Juros sobre capital próprio', 80],
      ['JCP VALE3', 90],
      ['Remuneração poupança', 12],
      ['REMUNERACAO APLICACAO', 13],
      ['PIX RECEBIDO BANCO RENDIMENTO', 5000],
      ['Banco Rendimento TED', 700],
      ['Rendimentos', -17], // saída nunca é rendimento
      ['salário empresa', 3000_00],
      ['PIX RECEBIDO JOAO', 100_00],
      ['Compra rendimentos de cdb', -5], // saída
      ['Rendimento líquido', 1],
    ];
    for (const [i, [description, cents]] of corpus.entries()) await add(description, cents, at(1 + i));
    const got = (await repos.transactions.search(user.id, filter({ excludeYields: true, limit: 100 }))).transactions
      .map((t) => t.description)
      .sort();
    const expected = corpus
      .filter(([description, cents]) => !isYieldTransaction({ description, amountInCents: cents }))
      .map(([d]) => d)
      .sort();
    expect(got).toEqual(expected);
  });

  describe('paginação por cursor (keyset)', () => {
    it('percorre tudo em ordem, sem repetir nem pular, e o último não tem próxima', async () => {
      const { user, add } = await world();
      for (let i = 0; i < 120; i++) await add(`lancamento ${i}`, -(1 + i), at(i % 90, i % 24));
      const seen: string[] = [];
      let cursor: TransactionSearchFilter['cursor'];
      let pages = 0;
      for (;;) {
        const r = await repos.transactions.search(user.id, filter({ limit: 50, cursor }));
        expect(r.count).toBe(120); // o total é sempre o do resultado todo
        expect(r.transactions.length).toBeLessThanOrEqual(50);
        seen.push(...r.transactions.map((t) => t.id));
        pages++;
        if (!r.nextCursor) break;
        cursor = r.nextCursor;
      }
      expect(pages).toBe(3);
      expect(seen).toHaveLength(120);
      expect(new Set(seen).size).toBe(120);
      const all = (await repos.transactions.search(user.id, filter({ limit: 200 }))).transactions;
      expect(seen).toEqual(all.map((t) => t.id));
      const times = all.map((t) => t.occurredAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a)); // mais recente primeiro
    });

    it('exatamente `limit` resultados não gera uma página vazia a mais (nextCursor null)', async () => {
      const { user, add } = await world();
      for (let i = 0; i < 5; i++) await add(`x${i}`, -100, at(i));
      expect((await repos.transactions.search(user.id, filter({ limit: 5 }))).nextCursor).toBeNull();
      expect((await repos.transactions.search(user.id, filter({ limit: 4 }))).nextCursor).not.toBeNull();
    });

    it('empate de data: o id desempata e nenhuma linha some entre páginas', async () => {
      const { user, add } = await world();
      const same = at(2, 10);
      for (let i = 0; i < 25; i++) await add(`empate ${i}`, -100, same);
      const seen: string[] = [];
      let cursor: TransactionSearchFilter['cursor'];
      do {
        const r = await repos.transactions.search(user.id, filter({ limit: 7, cursor }));
        seen.push(...r.transactions.map((t) => t.id));
        cursor = r.nextCursor ?? undefined;
      } while (cursor);
      expect(seen).toHaveLength(25);
      expect(new Set(seen).size).toBe(25);
    });

    it('apagar o lançamento do cursor (ou outros) entre as páginas não repete nem pula o que sobrou', async () => {
      const { user, add } = await world();
      const rows = [];
      for (let i = 0; i < 12; i++) rows.push(await add(`n${i}`, -100, at(i)));
      const p1 = await repos.transactions.search(user.id, filter({ limit: 5 }));
      expect(p1.transactions.map((t) => t.description)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
      // some a âncora do cursor e mais um da frente
      await db.transaction.deleteMany({ where: { id: { in: [rows[4]!.id, rows[7]!.id] } } });
      const p2 = await repos.transactions.search(user.id, filter({ limit: 5, cursor: p1.nextCursor! }));
      expect(p2.transactions.map((t) => t.description)).toEqual(['n5', 'n6', 'n8', 'n9', 'n10']);
      const p3 = await repos.transactions.search(user.id, filter({ limit: 5, cursor: p2.nextCursor! }));
      expect(p3.transactions.map((t) => t.description)).toEqual(['n11']);
    });

    it('lançamento novo no topo entre as páginas não empurra nem repete linhas já vistas', async () => {
      const { user, add } = await world();
      for (let i = 1; i <= 6; i++) await add(`v${i}`, -100, at(i));
      const p1 = await repos.transactions.search(user.id, filter({ limit: 3 }));
      await add('recém chegado', -100, at(0)); // mais novo que tudo
      const p2 = await repos.transactions.search(user.id, filter({ limit: 3, cursor: p1.nextCursor! }));
      expect(p2.transactions.map((t) => t.description)).toEqual(['v4', 'v5', 'v6']);
    });
  });

  it('a mesma busca no Postgres e em memória devolve o mesmo (os testes em memória valem pro banco)', async () => {
    const { user, nubank, catId, add } = await world();
    const mem = makeInMemoryRepositories();
    const memCat = (
      await mem.categories.create({ name: 'Supermercado', emoji: '🛒', color: '#111', kind: 'saida', userId: 'm1' })
    ).id;
    const memAcc = await mem.accounts.upsertByExternalId({
      userId: 'm1',
      connectionId: 'cn',
      externalId: 'a1',
      name: 'Nubank',
      type: 'BANK',
      balanceInCents: 0,
      fingerprint: null,
    });
    const data: [string, number, number, { cat?: boolean; acc?: boolean; internal?: boolean }][] = [
      ['PIX ENVIADO DANIELA', -50_00, 1, { acc: true }],
      ['Compra de mercado', -30_00, 2, { cat: true }],
      ['PAGAMENTO FATURA', -90_00, 3, { internal: true }],
      ['salario', 3000_00, 4, {}],
      ['Rendimentos', 17, 5, {}],
      ['outra', -5_00, 6, { acc: true }],
    ];
    for (const [d, cents, ago, o] of data) {
      await add(d, cents, at(ago), {
        accountId: o.acc ? nubank.id : null,
        categoryId: o.cat ? catId : null,
        isInternalTransfer: !!o.internal,
      });
      await mem.transactions.create({
        userId: 'm1',
        accountId: o.acc ? memAcc.id : null,
        externalId: null,
        description: d,
        amountInCents: cents,
        occurredAt: at(ago),
        categoryId: o.cat ? memCat : null,
        isInternalTransfer: !!o.internal,
      });
    }
    const q = { period: 'tudo', kind: 'todas' } as const;
    const pg = new SearchTransactionsUseCase(repos, () => NOW);
    const me = new SearchTransactionsUseCase(mem, () => NOW);
    for (const extra of [
      { q: '' },
      { q: 'dani' },
      { q: 'nubank' },
      { q: 'supermercado' },
      { q: 'pix nubank' },
      { q: '', kind: 'entrada' as const },
      { q: '', excludeTransfers: true },
      { q: '', excludeYields: true },
      { q: '', limit: 2 },
    ]) {
      const a = await pg.execute({ ...q, ...extra, userId: user.id });
      const b = await me.execute({ ...q, ...extra, userId: 'm1' });
      const shape = (r: typeof a) => ({
        d: r.transactions.map((t) => t.description),
        n: r.count,
        out: r.outInCents,
        inn: r.inInCents,
        more: r.nextCursor !== null,
        cat: r.transactions.map((t) => t.categoryName),
        acc: r.transactions.map((t) => t.accountName),
      });
      expect(shape(a), JSON.stringify(extra)).toEqual(shape(b));
    }
  });

  it('palavras viram só letras e números: "%", "_" e aspas não viram curinga nem quebram', async () => {
    const { user, add } = await world();
    await add('100% suco_natural', -10_00, at(1));
    await add('qualquer coisa', -10_00, at(2));
    expect(searchWords('100% suco_natural')).toEqual(['100', 'suco', 'natural']);
    for (const q of ['%', '_', "'; DROP TABLE transactions;--", '\\']) {
      const r = await repos.transactions.search(user.id, filter({ words: searchWords(q) }));
      expect(r.count).toBeLessThanOrEqual(2);
    }
    expect((await repos.transactions.search(user.id, filter({ words: searchWords('100% suco_natural') }))).count).toBe(
      1,
    );
    expect(await db.transaction.count({ where: { userId: user.id } })).toBe(2); // a tabela segue de pé
  });

  it('a busca usa o GIN de trigrama (plano do Postgres, seq scan desligado)', async () => {
    const { user, add } = await world();
    await add('IFOOD *RESTAURANTE', -10_00, at(1));
    await db.$executeRawUnsafe('ANALYZE transactions');
    const plan = await db.$transaction(async (t) => {
      await t.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
      return (
        await t.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
          `EXPLAIN SELECT id FROM transactions WHERE user_id = '${user.id}' AND description ILIKE '%ifood%'`,
        )
      )
        .map((r) => r['QUERY PLAN'])
        .join('\n');
    });
    expect(plan).toMatch(/transactions_description_trgm_idx|transactions_user_id/);
  });
});
