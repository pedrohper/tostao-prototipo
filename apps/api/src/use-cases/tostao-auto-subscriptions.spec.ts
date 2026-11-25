// T6.18 · achados "assinatura subiu de preço" e "vai cobrar em N dias": uma vez cada, sem duplicar com o "vence em".
import { beforeEach, describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { runPeriodicTostaoChecks } from '../jobs/tostao-checks.js';
import { FakePushGateway } from '../gateways/push-gateway.js';
import { DismissTostaoInsightUseCase, RunTostaoChecksUseCase } from './tostao-auto.js';

let repos: ReturnType<typeof makeInMemoryRepositories>;
let now: Date;

beforeEach(() => {
  repos = makeInMemoryRepositories();
  now = new Date('2026-11-16T15:00:00Z');
});

const makeUser = (email = 'ana@x.com') => repos.users.create({ name: 'Ana', email, passwordHash: 'x' });
const charge = (userId: string, description: string, cents: number, day: string) =>
  repos.transactions.create({
    userId,
    accountId: null,
    externalId: null,
    description,
    amountInCents: -cents,
    occurredAt: new Date(`${day}T12:00:00Z`),
    categoryId: 'assinaturas',
    isInternalTransfer: false,
  });
const run = (userId: string) => new RunTostaoChecksUseCase(repos, () => now).execute({ userId });
const rows = async (userId: string, kind: string) =>
  (await repos.tostaoAuto.listByUser(userId)).filter((i) => i.kind === kind);

describe('assinatura que subiu de preço', () => {
  const seed = async () => {
    const u = await makeUser();
    await charge(u.id, 'Spotify', 2190, '2026-09-10');
    await charge(u.id, 'Spotify', 2190, '2026-10-10');
    await charge(u.id, 'Spotify', 2390, '2026-11-10');
    return u;
  };

  it('avisa uma vez, com os dois valores, e não repete nas próximas checagens', async () => {
    const u = await seed();
    const first = await run(u.id);
    const found = first.insights.filter((i) => i.kind === 'subscription_price_up');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      severity: 'warning',
      routine: 'caramelo_extrato',
      actionHref: '/assinaturas?voltar=/tostao?aba=automatico',
    });
    // o formatador pt-BR usa espaço inseparável entre "R$" e o número
    expect(found[0]!.title.replace(/\s/g, ' ')).toBe('Spotify subiu de R$ 21,90 para R$ 23,90');
    expect(found[0]!.body).toContain('10/11');
    expect(found[0]!.body).toContain('9%');

    now = new Date('2026-11-17T15:00:00Z');
    await run(u.id);
    expect(await rows(u.id, 'subscription_price_up')).toHaveLength(1);
  });

  it('dispensado continua dispensado', async () => {
    const u = await seed();
    const [found] = (await run(u.id)).insights.filter((i) => i.kind === 'subscription_price_up');
    await new DismissTostaoInsightUseCase(repos, () => now).execute({ userId: u.id, insightId: found!.id });
    await run(u.id);
    expect((await rows(u.id, 'subscription_price_up')).map((i) => i.status)).toEqual(['DISMISSED']);
  });

  it('resolve sozinho quando a cobrança seguinte vem no mesmo preço', async () => {
    const u = await seed();
    await run(u.id);
    await charge(u.id, 'Spotify', 2390, '2026-12-10');
    now = new Date('2026-12-11T15:00:00Z');
    await run(u.id);
    expect((await rows(u.id, 'subscription_price_up')).map((i) => i.status)).toEqual(['APPLIED']);
  });

  it('respeita "não é assinatura", a rotina desligada e não vaza pra outra pessoa', async () => {
    const u = await seed();
    const other = await makeUser('bia@x.com');
    expect((await run(other.id)).insights).toEqual([]);

    await repos.tostaoAuto.updateConfig(u.id, { carameloExtrato: false });
    await run(u.id);
    expect(await rows(u.id, 'subscription_price_up')).toHaveLength(0);

    await repos.tostaoAuto.updateConfig(u.id, { carameloExtrato: true });
    await repos.ignoredSubscriptions.set(u.id, 'SPOTIFY', true);
    await run(u.id);
    expect(await rows(u.id, 'subscription_price_up')).toHaveLength(0);
  });
});

describe('cobrança chegando', () => {
  // 20/09 e 20/10: ciclo de 30 dias, próxima prevista pra 19/11.
  const seed = async () => {
    const u = await makeUser();
    await charge(u.id, 'Netflix', 4490, '2026-09-20');
    await charge(u.id, 'Netflix', 4490, '2026-10-20');
    return u;
  };

  it('aparece 3 dias antes, se atualiza no mesmo achado até o dia e não duplica com o "vence em"', async () => {
    const u = await seed();
    now = new Date('2026-11-15T15:00:00Z'); // 4 dias antes
    expect((await run(u.id)).insights.filter((i) => i.kind === 'subscription_charge_soon')).toHaveLength(0);

    const seen: [string, string][] = [];
    for (const day of ['16', '17', '18', '19']) {
      now = new Date(`2026-11-${day}T15:00:00Z`);
      const res = await run(u.id);
      expect(res.insights.filter((i) => i.kind === 'due_soon')).toEqual([]);
      const [found] = res.insights.filter((i) => i.kind === 'subscription_charge_soon');
      seen.push([found!.title.replace(/\s/g, ' '), found!.severity]);
    }
    expect(seen).toEqual([
      ['Netflix vai cobrar R$ 44,90 em 3 dias', 'info'],
      ['Netflix vai cobrar R$ 44,90 em 2 dias', 'warning'],
      ['Netflix vai cobrar R$ 44,90 amanhã', 'warning'],
      ['Netflix vai cobrar R$ 44,90 hoje', 'urgent'],
    ]);
    expect(await rows(u.id, 'subscription_charge_soon')).toHaveLength(1);
  });

  it('some depois do dia, e o ciclo seguinte gera um aviso novo mesmo se o anterior foi dispensado', async () => {
    const u = await seed();
    const [found] = (await run(u.id)).insights.filter((i) => i.kind === 'subscription_charge_soon');
    await new DismissTostaoInsightUseCase(repos, () => now).execute({ userId: u.id, insightId: found!.id });
    now = new Date('2026-11-18T15:00:00Z');
    await run(u.id);
    expect((await rows(u.id, 'subscription_charge_soon')).map((i) => i.status)).toEqual(['DISMISSED']);

    await charge(u.id, 'Netflix', 4490, '2026-11-19');
    now = new Date('2026-12-17T15:00:00Z');
    await run(u.id);
    expect((await rows(u.id, 'subscription_charge_soon')).map((i) => i.status).sort()).toEqual([
      'DISMISSED',
      'PENDING',
    ]);
  });

  it('com a previsão desligada não avisa', async () => {
    const u = await seed();
    await repos.tostaoAuto.updateConfig(u.id, { tostaoPrevisao: false });
    await run(u.id);
    expect(await rows(u.id, 'subscription_charge_soon')).toHaveLength(0);
  });

  it('no dia da cobrança o aviso urgente sai uma vez no push, apontando pras assinaturas', async () => {
    const u = await seed();
    await repos.tostaoAuto.updateConfig(u.id, { notifyPush: true });
    await repos.engagement.savePush({
      userId: u.id,
      endpoint: 'https://push.exemplo.test/ana',
      p256dh: 'chave',
      auth: 'segredo',
    });
    const push = new FakePushGateway();
    now = new Date('2026-11-19T15:00:00Z');
    await runPeriodicTostaoChecks(repos, { push, now: () => now });
    await runPeriodicTostaoChecks(repos, { push, now: () => now });
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]!.payload.url).toBe('/assinaturas');
  });
});
