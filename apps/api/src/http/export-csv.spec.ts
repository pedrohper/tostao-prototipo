// T6.21 · GET /me/export.csv: formato pro Excel, CSV injection, isolamento, período, limite e AuditLog.
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { csvAmount, csvText } from '../services/csv.js';

let ipCounter = 0;
const freshIp = () => `10.21.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

async function boot() {
  const repos = makeInMemoryRepositories();
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
    webOrigin: 'https://tostao.test',
  });
  const register = async (email: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'x-forwarded-for': freshIp() },
      payload: { name: 'Pessoa', email, password: '12345678', acceptedTerms: true },
    });
    const user = (await repos.users.findByEmail(email))!;
    return { user, auth: { authorization: `Bearer ${(res.json() as { accessToken: string }).accessToken}` } };
  };
  const add = (userId: string, description: string, amountInCents: number, when: string, over: object = {}) =>
    repos.transactions.create({
      userId,
      accountId: null,
      externalId: null,
      description,
      amountInCents,
      occurredAt: new Date(when),
      categoryId: null,
      isInternalTransfer: false,
      ...over,
    });
  const download = (auth: Record<string, string>, query = '') =>
    app.inject({ method: 'GET', url: `/me/export.csv${query}`, headers: auth });
  return { app, repos, register, add, download };
}

describe('células', () => {
  it.each(['=1+1', '+55 11', '-desconto', '@SUM(A1)', '\t=1', '\r=1', '\n=1', '  =1', '\uff1d1', '\uff20x'])(
    'começo perigoso ganha apóstrofo: %j',
    (value) => expect(csvText(value).startsWith(`"'`)).toBe(true),
  );

  it('texto comum fica igual; aspas dobram e quebra de linha vira espaço', () => {
    expect(csvText('Mercado = barato')).toBe('"Mercado = barato"');
    expect(csvText('Loja "do Zé"; 2\r\nlinhas')).toBe('"Loja ""do Zé""; 2 linhas"');
    expect(csvText('=HYPERLINK("http://x";"y")')).toBe(`"'=HYPERLINK(""http://x"";""y"")"`);
  });

  it('valor em reais com vírgula, sem milhar, e negativo continua número', () => {
    expect(csvAmount(-1250)).toBe('-12,50');
    expect(csvAmount(5)).toBe('0,05');
    expect(csvAmount(-5)).toBe('-0,05');
    expect(csvAmount(123456789)).toBe('1234567,89');
    expect(csvAmount(0)).toBe('0,00');
  });
});

describe('GET /me/export.csv', () => {
  it('exige login e não gera AuditLog', async () => {
    const { download, repos } = await boot();
    expect((await download({})).statusCode).toBe(401);
    expect(repos.audit.items.filter((l) => l.action === 'data_exported')).toHaveLength(0);
  });

  it('BOM, `;`, data civil, conta e categoria; só os lançamentos de quem pediu', async () => {
    const { register, add, download, repos } = await boot();
    const a = await register('csv-a@exemplo.test');
    const b = await register('csv-b@exemplo.test');
    const connection = await repos.connections.create({ userId: a.user.id, itemId: 'i', institution: 'Banco' });
    const account = await repos.accounts.upsertByExternalId({
      userId: a.user.id,
      connectionId: connection.id,
      externalId: 'x',
      name: '=Conta; da casa',
      type: 'BANK',
      balanceInCents: 0,
      fingerprint: null,
    });
    const category = await repos.categories.create({
      name: '@Pets',
      emoji: '🐶',
      color: '#FF5A36',
      kind: 'saida',
      userId: a.user.id,
    });
    // 22h de Brasília do dia 10 = 01h UTC do dia 11
    await add(a.user.id, 'PAÇOCA & CAFÉ', -1250, '2026-11-11T01:00:00Z');
    await add(a.user.id, '=2+5+cmd', 300000, '2026-11-12T15:00:00Z', {
      accountId: account.id,
      categoryId: category.id,
    });
    await add(a.user.id, 'NOME DO BANCO', -100, '2026-11-13T15:00:00Z', { customDescription: 'Padaria' });
    await add(b.user.id, 'SEGREDO DA PESSOA B', -777, '2026-11-12T15:00:00Z');

    const res = await download({ ...a.auth, 'x-forwarded-for': freshIp() }, `?userId=${b.user.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="tostao-lancamentos-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.headers['cache-control']).toBe('no-store, private');
    expect([...res.rawPayload.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(res.rawPayload.subarray(3).toString('utf8').split('\r\n')).toEqual([
      'Data;Descrição;Categoria;Conta;Valor',
      '10/11/2026;"PAÇOCA & CAFÉ";"Sem categoria";"Anotado à mão";-12,50',
      `12/11/2026;"'=2+5+cmd";"'@Pets";"'=Conta; da casa";3000,00`,
      '13/11/2026;"Padaria";"Sem categoria";"Anotado à mão";-1,00',
      '',
    ]);
    expect(res.body).not.toContain('SEGREDO');

    const logs = repos.audit.items.filter((l) => l.action === 'data_exported');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ userId: a.user.id, metadata: { format: 'csv', transactions: 3 } });
    expect(JSON.stringify(logs[0])).not.toContain('PAÇOCA');
  });

  it('período inclui o dia inteiro das duas pontas, no fuso da pessoa', async () => {
    const { register, add, download } = await boot();
    const a = await register('csv-periodo@exemplo.test');
    await add(a.user.id, 'ANTES', -1, '2026-11-01T02:59:59Z'); // 31/10 23h59 em Brasília
    await add(a.user.id, 'PRIMEIRO', -1, '2026-11-01T03:00:00Z');
    await add(a.user.id, 'ULTIMO', -1, '2026-12-01T02:59:59Z');
    await add(a.user.id, 'DEPOIS', -1, '2026-12-01T03:00:00Z');
    const res = await download(a.auth, '?from=2026-11-01&to=2026-11-30');
    expect(res.headers['content-disposition']).toContain('tostao-lancamentos-2026-11-01_a_2026-11-30.csv');
    expect(res.body).toContain('PRIMEIRO');
    expect(res.body).toContain('ULTIMO');
    expect(res.body).not.toContain('ANTES');
    expect(res.body).not.toContain('DEPOIS');
  });

  it('data inválida: 400 sem gastar a cota', async () => {
    const { register, download } = await boot();
    const a = await register('csv-datas@exemplo.test');
    for (const query of ['?from=ontem', '?from=2026-02-31', '?to=2026-13-01', '?from=2026-12-01&to=2026-01-01'])
      expect((await download(a.auth, query)).statusCode, query).toBe(400);
    expect((await download(a.auth, '?from=&to=')).statusCode).toBe(200);
    expect((await download(a.auth)).statusCode).toBe(200);
  });

  it('o limite é o MESMO do JSON: 2 por dia somando os dois, e o de outra pessoa não é afetado', async () => {
    const { app, register, download, repos } = await boot();
    const a = await register('csv-limite@exemplo.test');
    const b = await register('csv-outra@exemplo.test');
    expect((await app.inject({ method: 'GET', url: '/me/export', headers: a.auth })).statusCode).toBe(200);
    expect((await download(a.auth)).statusCode).toBe(200);
    expect((await download(a.auth)).statusCode).toBe(429);
    expect((await app.inject({ method: 'GET', url: '/me/export', headers: a.auth })).statusCode).toBe(429);
    expect((await download(b.auth)).statusCode).toBe(200);
    expect(repos.audit.items.filter((l) => l.userId === a.user.id && l.action === 'data_exported')).toHaveLength(2);
  });
});
