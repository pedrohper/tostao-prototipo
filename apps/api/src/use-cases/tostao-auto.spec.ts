import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeAiGateway } from '../gateways/ai-gateway.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { FakePushGateway } from '../gateways/push-gateway.js';
import { FakeWhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { runNotifications } from '../jobs/notifications.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { AutoCategorizeUseCase } from './auto-categorize.js';
import { ApplyTostaoInsightUseCase, RunTostaoChecksUseCase } from './tostao-auto.js';

let repos: ReturnType<typeof makeInMemoryRepositories>;
let now: Date;

async function setupUser(email = 'ana@x.com') {
  return repos.users.create({ name: 'Ana', email, passwordHash: 'x' });
}

beforeEach(() => {
  repos = makeInMemoryRepositories();
  now = new Date('2026-11-16T15:00:00Z');
});

describe('funções automáticas do Tostão & Caramelo', () => {
  it('avisa quando uma anotada parece igual a mais de uma cobrança do banco (ambíguo) e some quando resolvida', async () => {
    const u = await setupUser('amb@x.com');
    const conn = await repos.connections.create({ userId: u.id, itemId: 'item-amb', institution: 'Nubank' });
    const acc = await repos.accounts.upsertByExternalId({
      userId: u.id,
      connectionId: conn.id,
      externalId: 'a1',
      name: 'Nubank',
      type: 'BANK',
      balanceInCents: 0,
      fingerprint: null,
    });
    const bankTx = (externalId: string) =>
      repos.transactions.create({
        userId: u.id,
        accountId: acc.id,
        externalId,
        description: 'SPOTIFY',
        amountInCents: -2190,
        occurredAt: new Date('2026-11-14T14:00:00Z'),
        categoryId: 'assinaturas',
        isInternalTransfer: false,
      });
    await bankTx('s1');
    await bankTx('s2');
    const manual = await repos.transactions.create({
      userId: u.id,
      accountId: null,
      externalId: null,
      description: 'Spotify',
      amountInCents: -2190,
      occurredAt: new Date('2026-11-14T14:00:00Z'),
      categoryId: 'assinaturas',
      isInternalTransfer: false,
    });

    const runner = new RunTostaoChecksUseCase(repos, () => now);
    const first = await runner.execute({ userId: u.id });
    const found = first.insights.find((i) => i.kind === 'possible_duplicate_manual');
    expect(found).toBeDefined();
    expect(found!.actionHref).toBe(`/carteira/${manual.id}`);

    // A pessoa apaga a anotação: o aviso se resolve sozinho na próxima checagem.
    await repos.transactions.delete(manual.id);
    const second = await runner.execute({ userId: u.id });
    expect(second.insights.some((i) => i.kind === 'possible_duplicate_manual' && i.status === 'PENDING')).toBe(false);
  });

  it('detecta pendentes, fatura/transferência, limites, acertos e aposta sem duplicar', async () => {
    const u = await setupUser();
    const conn = await repos.connections.create({ userId: u.id, itemId: 'item-1', institution: 'Nubank' });
    const card = await repos.accounts.upsertByExternalId({
      userId: u.id,
      connectionId: conn.id,
      externalId: 'c1',
      name: 'Nubank Crédito',
      type: 'CREDIT',
      balanceInCents: -45000,
      fingerprint: null,
      creditLimitInCents: 200000,
      dueDate: new Date('2026-11-16T00:00:00Z'),
    });

    await repos.transactions.create({
      userId: u.id,
      accountId: card.id,
      externalId: 'e1',
      description: 'IFOOD RESTAURANTE',
      amountInCents: -4200,
      occurredAt: new Date('2026-11-14T14:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });
    await repos.transactions.create({
      userId: u.id,
      accountId: card.id,
      externalId: 'e2',
      description: 'PAGAMENTO DE FATURA',
      amountInCents: -30000,
      occurredAt: new Date('2026-11-13T14:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });
    await repos.transactions.create({
      userId: u.id,
      accountId: null,
      externalId: null,
      description: 'Pix racha churrasco Lucas',
      amountInCents: -8500,
      occurredAt: new Date('2026-11-12T14:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });
    await repos.transactions.create({
      userId: u.id,
      accountId: null,
      externalId: null,
      description: 'PIX BETANO',
      amountInCents: -10000,
      occurredAt: new Date('2026-11-11T14:00:00Z'),
      categoryId: 'apostas',
      isInternalTransfer: false,
    });
    await repos.transactions.create({
      userId: u.id,
      accountId: card.id,
      externalId: 'e3',
      description: 'ZÉ DELIVERY',
      amountInCents: -19000,
      occurredAt: new Date('2026-11-10T14:00:00Z'),
      categoryId: 'delivery',
      isInternalTransfer: false,
    });
    await repos.budgets.upsert({ userId: u.id, categoryId: 'delivery', limitInCents: 20000 });

    const runner = new RunTostaoChecksUseCase(repos, () => now);
    const first = await runner.execute({ userId: u.id });
    expect(first.generated).toBeGreaterThanOrEqual(5);

    const kinds = first.insights.map((i) => i.kind);
    expect(kinds).toContain('uncategorized_batch');
    expect(kinds).toContain('possible_internal_transfer');
    expect(kinds).toContain('due_soon');
    expect(kinds).toContain('budget_alert');
    expect(kinds).toContain('possible_split');
    expect(kinds).toContain('tigrinho_bet_risk');

    // Rodar de novo sem mudanças é idempotente
    const second = await runner.execute({ userId: u.id });
    expect(second.generated).toBe(0);
    expect(second.insights).toHaveLength(first.insights.length);
  });

  it('aplica ações em 1 clique, limpa resolvidos e respeita toggles/dispensas', async () => {
    const u = await setupUser();
    const ai = new FakeAiGateway();
    const conn = await repos.connections.create({ userId: u.id, itemId: 'i2', institution: 'Itaú' });
    const acc = await repos.accounts.upsertByExternalId({
      userId: u.id,
      connectionId: conn.id,
      externalId: 'cc1',
      name: 'Itaú Conta',
      type: 'BANK',
      balanceInCents: 100000,
      fingerprint: null,
    });
    const t1 = await repos.transactions.create({
      userId: u.id,
      accountId: acc.id,
      externalId: 'ex-fat',
      description: 'PAGAMENTO DE FATURA CARTAO',
      amountInCents: -15000,
      occurredAt: new Date('2026-11-12T12:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });
    await repos.transactions.create({
      userId: u.id,
      accountId: acc.id,
      externalId: 'ex-mer',
      description: 'MERCADINHO DA ESQUINA',
      amountInCents: -3500,
      occurredAt: new Date('2026-11-12T12:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });

    const runner = new RunTostaoChecksUseCase(repos, () => now);
    const res = await runner.execute({ userId: u.id });
    const transferInsight = res.insights.find((i) => i.kind === 'possible_internal_transfer')!;
    expect(transferInsight).toBeDefined();

    const applyUc = new ApplyTostaoInsightUseCase(repos, new AutoCategorizeUseCase(repos, ai), () => now);
    const applied = await applyUc.execute({ userId: u.id, insightId: transferInsight.id });
    expect(applied.insight.status).toBe('APPLIED');
    expect((await repos.transactions.findById(t1.id))?.isInternalTransfer).toBe(true);

    // Desativar rotina oculta achados dessa rotina
    await repos.tostaoAuto.updateConfig(u.id, { carameloExtrato: false });
    const afterOff = await runner.execute({ userId: u.id });
    expect(afterOff.insights.some((i) => i.routine === 'caramelo_extrato')).toBe(false);
  });

  it('respeita notifyPush e notifyWhatsapp no disparo de avisos', async () => {
    const u = await setupUser();
    const conn = await repos.connections.create({ userId: u.id, itemId: 'i1', institution: 'Nubank' });
    await repos.accounts.upsertByExternalId({
      userId: u.id,
      connectionId: conn.id,
      externalId: 'card',
      name: 'Nubank',
      type: 'CREDIT',
      balanceInCents: -25000,
      fingerprint: null,
      creditLimitInCents: 100000,
      dueDate: new Date('2026-11-16T00:00:00Z'),
    });
    await repos.engagement.savePush({ endpoint: 'https://push/1', userId: u.id, p256dh: 'p', auth: 'a' });
    await repos.whatsapp.link(u.id, '5511999998888', now);
    await repos.tostaoAuto.updateConfig(u.id, { notifyPush: false, notifyWhatsapp: true });

    const push = new FakePushGateway();
    const wa = new FakeWhatsAppGateway(true);
    await runNotifications(repos, push, new Date('2026-11-16T13:00:00Z'), wa);

    expect(push.sent).toHaveLength(0);
    expect(wa.sent).toHaveLength(1);
    expect(wa.sent[0]!.text).toContain('Vence hoje');
  });

  it('rotas HTTP /tostao/auto respondem e protegem por usuário', async () => {
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });
    const r1 = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Ana', email: 'a@x.com', password: '12345678' },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Bia', email: 'b@x.com', password: '12345678' },
    });
    const auth1 = { authorization: `Bearer ${r1.json().token}` };
    const auth2 = { authorization: `Bearer ${r2.json().token}` };

    const cfgRes = await app.inject({
      method: 'PUT',
      url: '/tostao/auto/config',
      headers: auth1,
      payload: { olheiroAcertos: false, notifyWhatsapp: true },
    });
    expect(cfgRes.statusCode).toBe(200);
    expect(cfgRes.json()).toMatchObject({ olheiroAcertos: false, notifyWhatsapp: true });

    await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: auth1,
      payload: { description: 'Mercado do bairro', amountInCents: 4500, kind: 'saida', occurredAt: '2026-11-16' },
    });

    const checkRes = await app.inject({ method: 'POST', url: '/tostao/auto/check', headers: auth1 });
    expect(checkRes.statusCode).toBe(200);
    const insights = checkRes.json().insights as { id: string; kind: string }[];
    expect(insights.some((i) => i.kind === 'uncategorized_batch')).toBe(true);

    const targetId = insights[0]!.id;
    // Outro usuário não consegue dispensar ou aplicar
    expect(
      (await app.inject({ method: 'POST', url: `/tostao/insights/${targetId}/dismiss`, headers: auth2 })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'POST', url: `/tostao/insights/${targetId}/dismiss`, headers: auth1 })).statusCode,
    ).toBe(200);

    const listAfter = await app.inject({ method: 'GET', url: '/tostao/auto', headers: auth1 });
    expect(listAfter.json().insights).toHaveLength(0);
    expect(listAfter.json().history).toHaveLength(1);
  });
});
