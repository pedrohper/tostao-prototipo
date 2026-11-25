// Aviso diário "quanto posso gastar hoje": só pra quem ligou, de manhã, uma vez por dia, e com o mesmo número da Início.
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePushGateway } from '../gateways/push-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ForecastUseCase } from '../use-cases/financial-plan.js';
import { runNotifications, safeToSpendNotice } from './notifications.js';

/** Horário de Brasília no dia 12/11/2026 (quinta, sem domingo nem noite pra não disparar os outros avisos). */
const as = (hora: string) => new Date(`2026-11-12T${hora}:00-03:00`);

let repos: ReturnType<typeof makeInMemoryRepositories>;
let push: FakePushGateway;
beforeEach(() => {
  repos = makeInMemoryRepositories();
  push = new FakePushGateway();
});

async function pessoa({ renda, ligado = true }: { renda: number | null; ligado?: boolean }) {
  const user = await repos.users.create({ name: 'Ana', email: 'ana@x.com', passwordHash: 'x' });
  await repos.engagement.savePush({ endpoint: 'https://push.exemplo/ana', userId: user.id, p256dh: 'p', auth: 'a' });
  await repos.tostaoAuto.updateConfig(user.id, { notifySafeToSpend: ligado });
  if (renda !== null) {
    await repos.plans.save(user.id, {
      salary: { amountInCents: renda, payday: 5, varies: false, bank: null, advance: null, pattern: null },
      otherIncomes: [],
      fixedExpenses: [],
      benefits: [],
      goal: null,
    });
  }
  return user;
}

const diarios = () => push.sent.filter((s) => s.payload.tag === 'hoje');

describe('quando sai', () => {
  it('às 9h, uma vez por dia, com o mesmo número da Início', async () => {
    const user = await pessoa({ renda: 190_000 });
    await runNotifications(repos, push, as('09:00'));
    await runNotifications(repos, push, as('09:15'));
    await runNotifications(repos, push, as('11:45'));
    expect(diarios()).toHaveLength(1);

    const { thisMonth } = await new ForecastUseCase(repos, () => as('09:00')).execute({ userId: user.id });
    // 190.000 em 19 dias (12 a 30) = R$ 100,00 por dia.
    expect(thisMonth!.safeToSpendTodayInCents).toBe(10_000);
    expect(diarios()[0]!.payload).toEqual(safeToSpendNotice(10_000, thisMonth!.safeToSpend!.availableInCents));
    expect(diarios()[0]!.payload.url).toBe('/inicio');
  });

  it('antes das 9h e do meio-dia em diante não manda', async () => {
    await pessoa({ renda: 190_000 });
    await runNotifications(repos, push, as('08:45'));
    await runNotifications(repos, push, as('12:00'));
    await runNotifications(repos, push, as('18:00'));
    expect(diarios()).toEqual([]);
  });

  it('desligado (o padrão) não manda', async () => {
    const user = await pessoa({ renda: 190_000, ligado: false });
    await runNotifications(repos, push, as('09:00'));
    expect(diarios()).toEqual([]);
    const other = await repos.users.create({ name: 'Bia', email: 'bia@x.com', passwordHash: 'x' });
    expect((await repos.tostaoAuto.getConfig(other.id)).notifySafeToSpend).toBe(false);
    expect((await repos.tostaoAuto.getConfig(user.id)).notifySafeToSpend).toBe(false);
  });

  it('sem renda informada não inventa número', async () => {
    await pessoa({ renda: null });
    await runNotifications(repos, push, as('09:00'));
    expect(diarios()).toEqual([]);
  });

  it('tem interruptor próprio: vale mesmo com os avisos urgentes desligados, e não liga os outros', async () => {
    const user = await pessoa({ renda: 190_000 });
    await repos.tostaoAuto.updateConfig(user.id, { notifyPush: false });
    await runNotifications(repos, push, as('09:00'));
    expect(push.sent.map((s) => s.payload.tag)).toEqual(['hoje']);
  });
});

describe('o texto', () => {
  it('sobra, zero e falta', () => {
    expect(safeToSpendNotice(10_000, 190_000).title).toMatch(/^Hoje dá pra gastar R\$\s100,00$/);
    expect(safeToSpendNotice(0, 5).title).toBe('Hoje o ideal é não gastar');
    const falta = safeToSpendNotice(-527, -10_000);
    expect(falta.title).toMatch(/^Falta R\$\s100,00 pro mês fechar$/);
    expect(falta.title).not.toContain('-');
  });
});

describe('a conta não depende de quantos meses se pede', () => {
  it('1 e 3 meses dão o mesmo "este mês"', async () => {
    const user = await pessoa({ renda: 190_000 });
    const forecast = new ForecastUseCase(repos, () => as('09:00'));
    const [um, tres] = await Promise.all([
      forecast.execute({ userId: user.id, months: 1 }),
      forecast.execute({ userId: user.id, months: 3 }),
    ]);
    expect(um.thisMonth).toEqual(tres.thisMonth);
  });
});
