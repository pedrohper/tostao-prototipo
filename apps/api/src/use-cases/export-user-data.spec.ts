// T2.5 · GET /me/export (LGPD, art. 18, V): exporta TUDO da pessoa e SÓ dela, sem segredos, e deixa trilha no AuditLog.
import { financialPlanBody } from '@tostao/contracts';
import { describe, expect, it } from 'vitest';
import { ResourceNotFoundError } from '../domain/errors.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ExportUserDataUseCase } from './export-user-data.js';

const HASH_A = '$2b$12$HASH.DA.PESSOA.A.NAO.PODE.VAZAR.0123456789abcdefghijk';
const HASH_B = '$2b$12$HASH.DA.PESSOA.B.NAO.PODE.VAZAR.0123456789abcdefghijk';

type Repos = ReturnType<typeof makeInMemoryRepositories>;

async function seed(repos: Repos, who: 'A' | 'B') {
  const user = await repos.users.create({
    name: `Pessoa ${who}`,
    email: `pessoa-${who.toLowerCase()}@exemplo.test`,
    passwordHash: who === 'A' ? HASH_A : HASH_B,
    termsAcceptedAt: new Date('2026-01-10T12:00:00Z'),
    termsVersion: '2026-11',
  });
  const account = await repos.accounts.upsertByExternalId({
    userId: user.id,
    connectionId: `conn-${who}`,
    externalId: `ext-acc-${who}`,
    name: `Conta ${who}`,
    type: 'BANK',
    balanceInCents: who === 'A' ? 123_45 : 999_99,
    fingerprint: null,
  });
  const category = await repos.categories.create({
    name: `Pets ${who}`,
    emoji: '🐶',
    color: '#FF5A36',
    kind: 'saida',
    userId: user.id,
  });
  await repos.rules.upsert({ userId: user.id, pattern: `PETZ-${who}`, categoryId: category.id });
  await repos.budgets.upsert({ userId: user.id, categoryId: category.id, limitInCents: who === 'A' ? 30_000 : 77_777 });
  const person = await repos.people.create({ userId: user.id, name: `Amigo de ${who}` });
  await repos.transactions.create({
    userId: user.id,
    accountId: account.id,
    externalId: `ext-tx-${who}`,
    description: `PETZ LOJA ${who}`,
    amountInCents: -8990,
    occurredAt: new Date('2026-11-10T12:00:00Z'),
    categoryId: category.id,
    isInternalTransfer: false,
    note: `nota secreta ${who}`,
  });
  // parcela futura anotada à mão: também é da pessoa
  await repos.transactions.create({
    userId: user.id,
    accountId: null,
    externalId: null,
    description: `Sofá ${who} (2/3)`,
    amountInCents: -50_000,
    occurredAt: new Date('2027-02-10T12:00:00Z'),
    categoryId: null,
    isInternalTransfer: false,
    seriesId: `serie-${who}`,
    personId: person.id,
    customDescription: `Sofá novo ${who}`,
  });
  await repos.plans.save(
    user.id,
    financialPlanBody.parse({ salary: { amountInCents: who === 'A' ? 450_000 : 888_888, payday: 5 } }),
  );
  await repos.lessons.markDone(user.id, who === 'A' ? 'm1-l1' : 'm9-l5');
  await repos.chat.create({ userId: user.id, role: 'user', content: `pergunta privada ${who}`, channel: 'app' });
  await repos.chat.create({ userId: user.id, role: 'assistant', content: `resposta privada ${who}`, channel: 'app' });
  await repos.consents.grant({
    userId: user.id,
    type: 'privacy',
    version: '2026-11',
    at: new Date('2026-01-10T12:00:00Z'),
  });
  await repos.whatsapp.link(user.id, who === 'A' ? '5511911111111' : '5511922222222', new Date('2026-02-01T12:00:00Z'));
  return { user, account, category, person };
}

function setup() {
  const repos = makeInMemoryRepositories();
  return { repos, useCase: new ExportUserDataUseCase(repos) };
}

describe('ExportUserDataUseCase', () => {
  it('exporta perfil, contas, categorias próprias, regras, orçamentos, plano, pessoas, lançamentos, lições, chat e consentimentos', async () => {
    const { repos, useCase } = setup();
    const a = await seed(repos, 'A');

    const { data, fileName } = await useCase.execute({ userId: a.user.id, now: new Date('2026-11-21T15:00:00Z') });

    expect(fileName).toBe('tostao-meus-dados-2026-11-21.json');
    expect(data.exportVersion).toBe(1);
    expect(data.profile).toMatchObject({
      id: a.user.id,
      name: 'Pessoa A',
      email: 'pessoa-a@exemplo.test',
      timezone: 'America/Sao_Paulo',
      termsVersion: '2026-11',
      hasPassword: true,
    });
    expect(data.consents).toEqual([
      { type: 'privacy', version: '2026-11', grantedAt: '2026-01-10T12:00:00.000Z', revokedAt: null },
    ]);
    expect(data.whatsapp).toEqual({ phone: '5511911111111', linkedAt: '2026-02-01T12:00:00.000Z' });
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0]).toMatchObject({ name: 'Conta A', balanceInCents: 12345, hidden: false });
    expect(data.categories.map((c) => c.name)).toEqual(['Pets A']); // só as criadas pela pessoa
    expect(data.categoryRules).toEqual([{ pattern: 'PETZ-A', categoryId: a.category.id }]);
    expect(data.budgets).toEqual([{ categoryId: a.category.id, limitInCents: 30_000 }]);
    expect(data.financialPlan).not.toBeNull();
    expect(data.people.map((p) => p.name)).toEqual(['Amigo de A']);
    expect(data.lessonProgress.map((l) => l.lessonId)).toEqual(['m1-l1']);
    expect(data.chatMessages.map((m) => m.content)).toEqual(['pergunta privada A', 'resposta privada A']);

    // lançamentos em ordem cronológica, com a parcela futura, dinheiro em centavos (número) e origem
    expect(data.transactions.map((t) => t.description)).toEqual(['PETZ LOJA A', 'Sofá A (2/3)']);
    expect(data.transactions[0]).toMatchObject({
      amountInCents: -8990,
      categoryName: 'Pets A',
      note: 'nota secreta A',
      source: 'banco',
    });
    expect(data.transactions[1]).toMatchObject({
      amountInCents: -50_000,
      customDescription: 'Sofá novo A',
      seriesId: 'serie-A',
      personId: a.person.id,
      source: 'manual',
    });
  });

  it('ISOLAMENTO CROSS-TENANT: nada da pessoa B aparece no arquivo da pessoa A (e vice-versa)', async () => {
    const { repos, useCase } = setup();
    const a = await seed(repos, 'A');
    const b = await seed(repos, 'B');

    const exportA = JSON.stringify((await useCase.execute({ userId: a.user.id })).data);
    const exportB = JSON.stringify((await useCase.execute({ userId: b.user.id })).data);

    for (const marker of [
      'Pessoa B',
      'pessoa-b@exemplo.test',
      'Conta B',
      'Pets B',
      'PETZ-B',
      'PETZ LOJA B',
      'Sofá B',
      'Sofá novo B',
      'nota secreta B',
      'Amigo de B',
      'pergunta privada B',
      'resposta privada B',
      'm9-l5',
      '5511922222222',
      '99999',
      '88888',
      '77777',
      b.user.id,
      b.account.id,
      b.category.id,
      b.person.id,
    ]) {
      expect(exportA, `A vazou "${marker}"`).not.toContain(marker);
    }
    for (const marker of ['Pessoa A', 'PETZ-A', 'pergunta privada A', a.user.id, a.account.id, '5511911111111']) {
      expect(exportB, `B vazou "${marker}"`).not.toContain(marker);
    }
    // e cada um recebe exatamente o seu
    expect(JSON.parse(exportA).transactions).toHaveLength(2);
    expect(JSON.parse(exportB).transactions).toHaveLength(2);
  });

  it('nunca exporta segredo: hash de senha, tokens, código do WhatsApp', async () => {
    const { repos, useCase } = setup();
    const a = await seed(repos, 'A');
    await repos.whatsapp.setCode(a.user.id, 'c0d1g0-hash-sha256', new Date('2030-01-01T00:00:00Z'));
    await repos.refreshTokens.create({
      userId: a.user.id,
      tokenHash: 'REFRESH-HASH-SECRETO',
      familyId: 'fam',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
      userAgent: 'x',
      ipAddress: '1.2.3.4',
    });

    const json = JSON.stringify((await useCase.execute({ userId: a.user.id })).data);

    for (const secret of [
      HASH_A,
      'passwordHash',
      'password_hash',
      'c0d1g0-hash-sha256',
      'REFRESH-HASH-SECRETO',
      'tokenHash',
      'codeHash',
    ]) {
      expect(json).not.toContain(secret);
    }
    expect(JSON.parse(json).profile.hasPassword).toBe(true);
  });

  it('cada exportação gera UM AuditLog `data_exported` com IP e só contagens (nunca o conteúdo)', async () => {
    const { repos, useCase } = setup();
    const a = await seed(repos, 'A');
    const b = await seed(repos, 'B');

    await useCase.execute({ userId: a.user.id, ipAddress: '203.0.113.7' });

    const logs = repos.audit.items.filter((l) => l.action === 'data_exported');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: a.user.id,
      entityType: 'user',
      entityId: a.user.id,
      ipAddress: '203.0.113.7',
      metadata: { formatVersion: 1, transactions: 2, accounts: 1, chatMessages: 2 },
    });
    expect(JSON.stringify(logs[0])).not.toContain('PETZ');
    expect(repos.audit.items.some((l) => l.userId === b.user.id)).toBe(false);
  });

  it('o nome do arquivo usa o dia civil da pessoa, não o dia UTC', async () => {
    const { repos, useCase } = setup();
    const a = await seed(repos, 'A'); // America/Sao_Paulo (UTC-3)
    // 22/11 01:30 UTC ainda é 21/11 22:30 em Brasília
    const { fileName } = await useCase.execute({ userId: a.user.id, now: new Date('2026-11-22T01:30:00Z') });
    expect(fileName).toBe('tostao-meus-dados-2026-11-21.json');
  });

  it('pessoa que não existe: 404 e nenhum AuditLog', async () => {
    const { repos, useCase } = setup();
    await expect(useCase.execute({ userId: 'nao-existe' })).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(repos.audit.items).toHaveLength(0);
  });

  it('conta nova e vazia exporta listas vazias (não quebra)', async () => {
    const { repos, useCase } = setup();
    const user = await repos.users.create({ name: 'Nova', email: 'nova@exemplo.test', passwordHash: null });
    const { data } = await useCase.execute({ userId: user.id });
    expect(data.transactions).toEqual([]);
    expect(data.chatMessages).toEqual([]);
    expect(data.financialPlan).toBeNull();
    expect(data.profile.hasPassword).toBe(false);
  });
});
