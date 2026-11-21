import { describe, expect, it, vi } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { SearchTransactionsUseCase } from './search-transactions.js';

const NOW = new Date('2026-11-12T12:00:00Z');

async function setup() {
  const repos = makeInMemoryRepositories();
  const add = (
    description: string,
    amountInCents: number,
    date: string,
    extra: { categoryId?: string; isInternalTransfer?: boolean } = {},
  ) =>
    repos.transactions.create({
      userId: 'u1',
      accountId: null,
      externalId: null,
      description,
      amountInCents,
      occurredAt: new Date(`${date}T12:00:00Z`),
      categoryId: extra.categoryId ?? null,
      isInternalTransfer: extra.isInternalTransfer ?? false,
    });
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

  it('acha pela categoria e pelo texto (maiúscula não importa; o ACENTO vale); período corta o antigo', async () => {
    const { uc } = await setup();
    expect((await uc.execute({ userId: 'u1', q: 'açaí', period: '12m', kind: 'todas' })).count).toBe(1);
    expect((await uc.execute({ userId: 'u1', q: 'AÇAÍ do zé', period: '12m', kind: 'todas' })).count).toBe(1);
    // Mudança da T2.2: a busca é ILIKE no Postgres (acelerada por pg_trgm), que não ignora acento: "acai" não acha "Açaí".
    expect((await uc.execute({ userId: 'u1', q: 'acai', period: '12m', kind: 'todas' })).count).toBe(0);
    expect((await uc.execute({ userId: 'u1', q: 'delivery', period: '12m', kind: 'todas' })).count).toBe(1);
    expect((await uc.execute({ userId: 'u1', q: 'delivery', period: 'tudo', kind: 'todas' })).count).toBe(2);
    expect((await uc.execute({ userId: 'u1', q: 'dani', period: '30d', kind: 'saida' })).count).toBe(1);
  });

  it('transferência interna aparece mas não soma', async () => {
    const { uc } = await setup();
    const r = await uc.execute({ userId: 'u1', q: 'fatura', period: '12m', kind: 'todas' });
    expect(r.count).toBe(1);
    expect(r.outInCents).toBe(0);

    const hidden = await uc.execute({
      userId: 'u1',
      q: 'fatura',
      period: '12m',
      kind: 'todas',
      excludeTransfers: true,
    });
    expect(hidden.count).toBe(0);
    expect(hidden.transactions).toHaveLength(0);
  });

  it('oculta rendimentos quando excludeYields=true sem esconder Banco Rendimento', async () => {
    const { repos, uc } = await setup();
    await repos.transactions.create({
      userId: 'u1',
      accountId: null,
      externalId: null,
      description: 'Rendimentos',
      amountInCents: 17,
      occurredAt: new Date('2026-11-10T12:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });
    await repos.transactions.create({
      userId: 'u1',
      accountId: null,
      externalId: null,
      description: 'PIX RECEBIDO BANCO RENDIMENTO',
      amountInCents: 5000,
      occurredAt: new Date('2026-11-10T12:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });

    const visible = await uc.execute({ userId: 'u1', q: 'rendimento', period: '12m', kind: 'todas' });
    expect(visible.count).toBe(2);

    const hidden = await uc.execute({
      userId: 'u1',
      q: 'rendimento',
      period: '12m',
      kind: 'todas',
      excludeYields: true,
    });
    expect(hidden.count).toBe(1);
    expect(hidden.transactions[0]!.description).toBe('PIX RECEBIDO BANCO RENDIMENTO');
  });

  describe('paginação e delegação ao repositório (T2.2)', () => {
    it('quem filtra e pagina é o repositório: o use case não carrega o histórico (findManyInRange nem é chamado)', async () => {
      const { repos, uc } = await setup();
      const range = vi.spyOn(repos.transactions, 'findManyInRange');
      const search = vi.spyOn(repos.transactions, 'search');
      await uc.execute({ userId: 'u1', q: 'dani', period: 'tudo', kind: 'todas', limit: 2 });
      expect(range).not.toHaveBeenCalled();
      expect(search).toHaveBeenCalledTimes(1);
      const [userId, filter] = search.mock.calls[0]!;
      expect(userId).toBe('u1');
      expect(filter).toMatchObject({ words: ['dani'], kind: 'todas', limit: 2, from: null });
      expect(filter.to.getTime()).toBe(NOW.getTime() + 24 * 3600 * 1000);
    });

    it('período vira o intervalo no banco (30d/3m/12m/tudo)', async () => {
      const { repos, uc } = await setup();
      const search = vi.spyOn(repos.transactions, 'search');
      for (const [period, days] of [
        ['30d', 30],
        ['3m', 92],
        ['12m', 366],
      ] as const) {
        await uc.execute({ userId: 'u1', q: '', period, kind: 'todas' });
        expect(search.mock.lastCall![1].from!.getTime()).toBe(NOW.getTime() - days * 24 * 3600 * 1000);
      }
      await uc.execute({ userId: 'u1', q: '', period: 'tudo', kind: 'todas' });
      expect(search.mock.lastCall![1].from).toBeNull();
    });

    it('respeita limit + nextCursor: páginas em ordem, sem repetir nem pular, e o total é do resultado TODO', async () => {
      const { uc } = await setup();
      const base = { userId: 'u1', q: 'dani', period: 'tudo', kind: 'todas' } as const;
      const p1 = await uc.execute({ ...base, limit: 2 });
      expect(p1.transactions.map((t) => t.description)).toEqual([
        'PIX ENVIADO DANIELA SOUZA',
        'PIX RECEBIDO DANIELA SOUZA',
      ]);
      expect(p1.nextCursor).toBeTruthy();
      // totais cobrem as 3 linhas, não só as 2 da página
      expect(p1).toMatchObject({ count: 3, outInCents: 7500, inInCents: 1000 });

      const p2 = await uc.execute({ ...base, limit: 2, cursor: p1.nextCursor! });
      expect(p2.transactions.map((t) => t.description)).toEqual(['Pix enviado - Daniela Souza']);
      expect(p2.nextCursor).toBeNull(); // acabou
      expect(p2).toMatchObject({ count: 3, outInCents: 7500, inInCents: 1000 });

      const all = await uc.execute({ ...base, limit: 50 });
      expect(all.nextCursor).toBeNull();
      expect([...p1.transactions, ...p2.transactions].map((t) => t.id)).toEqual(all.transactions.map((t) => t.id));
    });

    it('cursor que não é nosso (inventado ou adulterado) é 400', async () => {
      const { uc } = await setup();
      const base = { userId: 'u1', q: '', period: 'tudo', kind: 'todas' } as const;
      for (const cursor of [
        'abc',
        Buffer.from('lixo|x').toString('base64url'),
        Buffer.from('2026-13-45|abc12345').toString('base64url'),
      ])
        await expect(uc.execute({ ...base, cursor })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('sem limite pedido usa o padrão (50)', async () => {
      const { repos, uc } = await setup();
      const search = vi.spyOn(repos.transactions, 'search');
      await uc.execute({ userId: 'u1', q: '', period: 'tudo', kind: 'todas' });
      expect(search.mock.lastCall![1].limit).toBe(50);
    });
  });
});
