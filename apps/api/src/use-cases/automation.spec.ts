// T5.3 · tokens de automação (hash, limite de 3, revogação) e o webhook dos Atalhos do iOS (idempotência, fuso, sinal).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { CreateManualAccountUseCase } from './create-manual-account.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { AutomationTokensUseCase, ShortcutWebhookUseCase, TOKEN_PREFIX } from './automation.js';

const NOW = new Date('2026-11-22T15:00:00Z');

async function setup() {
  const repos = makeInMemoryRepositories();
  const user = await repos.users.create({ name: 'Ana', email: 'ana@x.com', passwordHash: 'x' });
  const tokens = new AutomationTokensUseCase(repos, () => NOW);
  const hook = new ShortcutWebhookUseCase(repos, new CreateManualTransactionUseCase(repos, () => NOW), () => NOW);
  return { repos, user, tokens, hook };
}

describe('tokens', () => {
  it('o token em claro só existe na resposta; no banco fica o SHA-256', async () => {
    const { repos, user, tokens } = await setup();
    const { token, item } = await tokens.create(user.id, 'Apple Pay');
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    const stored = repos.automationTokens.items[0]!;
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(repos.automationTokens.items)).not.toContain(token);
    expect(JSON.stringify(await tokens.list(user.id))).not.toContain(token);
    expect(item).toMatchObject({ label: 'Apple Pay', lastUsedAt: null, revokedAt: null });
  });

  it('dois tokens nunca saem iguais', async () => {
    const { user, tokens } = await setup();
    const a = await tokens.create(user.id, 'a');
    const b = await tokens.create(user.id, 'b');
    expect(a.token).not.toBe(b.token);
  });

  it('máximo de 3 ATIVOS por pessoa (409); revogar libera uma vaga; o limite é por pessoa', async () => {
    const { repos, user, tokens } = await setup();
    const t1 = await tokens.create(user.id, '1');
    await tokens.create(user.id, '2');
    await tokens.create(user.id, '3');
    await expect(tokens.create(user.id, '4')).rejects.toMatchObject({
      statusCode: 409,
      code: 'AUTOMATION_TOKEN_LIMIT',
    });
    await tokens.revoke(user.id, t1.item.id);
    await tokens.create(user.id, '4');
    const other = await repos.users.create({ name: 'Bia', email: 'b@x.com', passwordHash: 'x' });
    await tokens.create(other.id, 'da Bia'); // a Bia não é afetada
    expect((await tokens.list(user.id)).tokens).toHaveLength(4); // o revogado continua listado (histórico)
  });

  it('revogar token de OUTRA pessoa dá 404 e não revoga', async () => {
    const { repos, user, tokens } = await setup();
    const mine = await tokens.create(user.id, 'meu');
    const other = await repos.users.create({ name: 'Bia', email: 'b@x.com', passwordHash: 'x' });
    await expect(tokens.revoke(other.id, mine.item.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(repos.automationTokens.items[0]!.revokedAt).toBeNull();
  });

  it('autenticação: token válido passa e marca o uso; ausente, malformado, desconhecido ou revogado = o MESMO 401', async () => {
    const { user, tokens } = await setup();
    const { token, item } = await tokens.create(user.id, 'x');
    expect((await tokens.authenticate(`Bearer ${token}`)).id).toBe(item.id);
    expect((await tokens.list(user.id)).tokens[0]!.lastUsedAt).toBe(NOW.toISOString());
    const bad = [
      undefined,
      '',
      token,
      `Bearer ${token}x`,
      'Bearer tst_curto',
      `Bearer ${TOKEN_PREFIX}${'a'.repeat(43)}`,
      `bearer ${token}`,
      'Basic abc',
    ];
    for (const h of bad)
      await expect(tokens.authenticate(h)).rejects.toMatchObject({ statusCode: 401, message: 'Token inválido.' });
    await tokens.revoke(user.id, item.id);
    await expect(tokens.authenticate(`Bearer ${token}`)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token inválido.',
    });
  });
});

describe('webhook', () => {
  const auth = async (s: Awaited<ReturnType<typeof setup>>) =>
    s.tokens.authenticate(`Bearer ${(await s.tokens.create(s.user.id, 'x')).token}`);

  it('cria o gasto: sinal de saída, categoria pelas regras, nota com a origem', async () => {
    const s = await setup();
    const token = await auth(s);
    const r = await s.hook.execute(token, { source: 'apple_pay', text: 'Compra aprovada R$ 32,90 em IFOOD' });
    expect(r.duplicate).toBe(false);
    const t = (await s.repos.transactions.findById(r.id))!;
    expect(t).toMatchObject({ userId: s.user.id, amountInCents: -32_90, description: 'IFOOD' });
    expect(t.note).toMatch(/Apple Pay/);
  });

  it('idempotência: o MESMO eventId não duplica (devolve o mesmo id); eventId diferente cria outro', async () => {
    const s = await setup();
    const token = await auth(s);
    const a = await s.hook.execute(token, { source: 'shortcut', amount: 10, eventId: 'evt-1' });
    const b = await s.hook.execute(token, { source: 'shortcut', amount: 10, eventId: 'evt-1' });
    const c = await s.hook.execute(token, { source: 'shortcut', amount: 10, eventId: 'evt-2' });
    expect(b).toEqual({ id: a.id, duplicate: true });
    expect(c.id).not.toBe(a.id);
    expect(s.repos.transactions.items).toHaveLength(2);
    expect(s.repos.transactions.items[0]!.externalId).toBe(`shortcut:${token.id}:evt-1`);
  });

  it('o eventId é por TOKEN: outro token com o mesmo eventId cria o seu', async () => {
    const s = await setup();
    const t1 = await auth(s);
    const t2 = await auth(s);
    await s.hook.execute(t1, { source: 'shortcut', amount: 10, eventId: 'e' });
    const r = await s.hook.execute(t2, { source: 'shortcut', amount: 10, eventId: 'e' });
    expect(r.duplicate).toBe(false);
  });

  it('sem eventId, cada chamada cria um lançamento (idempotência é opcional)', async () => {
    const s = await setup();
    const token = await auth(s);
    await s.hook.execute(token, { source: 'shortcut', amount: 10 });
    await s.hook.execute(token, { source: 'shortcut', amount: 10 });
    expect(s.repos.transactions.items).toHaveLength(2);
  });

  it('fuso: 22/11 às 01:30 UTC é 21/11 22:30 em Brasília e 21/11 21:30 em Manaus; vira o dia civil da pessoa ao meio-dia', async () => {
    const s = await setup();
    (s.user as { timezone: string }).timezone = 'America/Manaus';
    const token = await auth(s);
    const r = await s.hook.execute(token, { source: 'apple_pay', amount: 10, occurredAt: '2026-11-22T01:30:00Z' });
    expect((await s.repos.transactions.findById(r.id))!.occurredAt.toISOString()).toBe('2026-11-21T16:00:00.000Z'); // 12:00 em Manaus
  });

  it('sem data: hoje no fuso da pessoa; data inválida ou muito no futuro também caem em hoje', async () => {
    const s = await setup(); // NOW = 22/11 12:00 em Brasília
    const token = await auth(s);
    for (const occurredAt of [undefined, 'não é data', '2030-01-01T00:00:00Z']) {
      const r = await s.hook.execute(token, { source: 'shortcut', amount: 1, ...(occurredAt ? { occurredAt } : {}) });
      expect((await s.repos.transactions.findById(r.id))!.occurredAt.toISOString()).toBe('2026-11-22T15:00:00.000Z');
    }
  });

  it('data de ontem é respeitada (compra offline que o iPhone só mandou depois)', async () => {
    const s = await setup();
    const token = await auth(s);
    const r = await s.hook.execute(token, { source: 'apple_pay', amount: 5, occurredAt: '2026-11-20T18:00:00-03:00' });
    expect((await s.repos.transactions.findById(r.id))!.occurredAt.toISOString()).toBe('2026-11-20T15:00:00.000Z');
  });

  it('conta manual: o saldo desce; conta de outra pessoa = 404; conta ligada ao banco = 400', async () => {
    const s = await setup();
    const token = await auth(s);
    const { account } = await new CreateManualAccountUseCase(s.repos).execute({
      userId: s.user.id,
      name: 'Carteira',
      type: 'BANK',
      balanceInCents: 100_00,
    });
    await s.hook.execute(token, { source: 'apple_pay', amount: 30, accountId: account.id });
    expect((await s.repos.accounts.listByUser(s.user.id)).find((a) => a.id === account.id)!.balanceInCents).toBe(70_00);

    const other = await s.repos.users.create({ name: 'Bia', email: 'b@x.com', passwordHash: 'x' });
    const { account: theirs } = await new CreateManualAccountUseCase(s.repos).execute({
      userId: other.id,
      name: 'Da Bia',
      type: 'BANK',
      balanceInCents: 1,
    });
    await expect(s.hook.execute(token, { source: 'shortcut', amount: 1, accountId: theirs.id })).rejects.toMatchObject({
      statusCode: 404,
    });

    const conn = await s.repos.connections.create({ userId: s.user.id, itemId: 'item-real', institution: 'Banco' });
    const real = await s.repos.accounts.upsertByExternalId({
      userId: s.user.id,
      connectionId: conn.id,
      externalId: 'pl-1',
      name: 'Real',
      type: 'BANK',
      balanceInCents: 0,
      fingerprint: null,
    });
    await expect(s.hook.execute(token, { source: 'shortcut', amount: 1, accountId: real.id })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('o lançamento sempre vai pro dono do TOKEN, nunca pra outra pessoa', async () => {
    const s = await setup();
    const other = await s.repos.users.create({ name: 'Bia', email: 'b@x.com', passwordHash: 'x' });
    const token = await auth(s);
    await s.hook.execute(token, { source: 'shortcut', amount: 10 });
    expect(s.repos.transactions.items.every((t) => t.userId === s.user.id)).toBe(true);
    expect(s.repos.transactions.items.some((t) => t.userId === other.id)).toBe(false);
  });

  it('sem valor: 400', async () => {
    const s = await setup();
    const token = await auth(s);
    await expect(s.hook.execute(token, { source: 'shortcut', text: 'oi' })).rejects.toMatchObject({ statusCode: 400 });
  });
});
