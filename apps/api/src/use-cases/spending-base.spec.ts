import { describe, expect, it } from 'vitest';
import { spendingBase } from './financial-plan.js';

const R = (n: number) => n * 100;

describe('spendingBase', () => {
  it('gasto pago com o acerto sai da base e vira exceção, não aperto', () => {
    const b = spendingBase([
      { month: '2026-08', incomeInCents: R(2391), outcomeInCents: R(2249) },
      { month: '2026-09', incomeInCents: R(4641), outcomeInCents: R(4962) }, // entrou o acerto
      { month: '2026-10', incomeInCents: R(5410), outcomeInCents: R(4013) }, // outra entrada grande cobre o mês
    ], R(2000));
    expect(b.status).toBe('excecao');
    expect(b.months[1]!.paidWithExtraInCents).toBe(R(2641));
    expect(b.typicalInCents).toBe(R(2249));
  });

  it('gastar mais que a renda sem dinheiro extra, mês após mês, é aperto', () => {
    const b = spendingBase([
      { month: '2026-08', incomeInCents: R(2000), outcomeInCents: R(2600) },
      { month: '2026-09', incomeInCents: R(2000), outcomeInCents: R(2700) },
      { month: '2026-10', incomeInCents: R(2000), outcomeInCents: R(1900) },
    ], R(2000));
    expect(b.status).toBe('aperto');
    expect(b.typicalInCents).toBe(R(2600));
  });

  it('usa mediana: um mês fora da curva não estraga a conta', () => {
    const b = spendingBase([
      { month: '2026-08', incomeInCents: R(3000), outcomeInCents: R(1500) },
      { month: '2026-09', incomeInCents: R(3000), outcomeInCents: R(1600) },
      { month: '2026-10', incomeInCents: R(3000), outcomeInCents: R(2900) },
    ], R(3000));
    expect(b.status).toBe('ok');
    expect(b.typicalInCents).toBe(R(1600));
  });

  it('meses sem dados ficam de fora', () => {
    const b = spendingBase([
      { month: '2026-06', incomeInCents: 0, outcomeInCents: 0 },
      { month: '2026-07', incomeInCents: R(2000), outcomeInCents: R(1000) },
    ], R(2000));
    expect(b.months).toHaveLength(1);
    expect(b.typicalInCents).toBe(R(1000));
  });
});

import { recurringMonthly } from './financial-plan.js';
describe('recurringMonthly', () => {
  it('adiantamento + resto do salário somam, o acerto que veio uma vez fica de fora', () => {
    const t = (d: string, v: number) => ({ id: d, userId: 'u', accountId: 'b', externalId: d, description: 'TRANSF SALDO C/SAL P/CC', amountInCents: v * 100, occurredAt: new Date(`${d}T12:00:00Z`), categoryId: 'salario', isInternalTransfer: false, createdAt: new Date() });
    const list = [t('2026-08-15', 648.4), t('2026-09-11', 3701.8), t('2026-09-30', 1150), t('2026-10-01', 1250.55), t('2026-10-16', 1000), t('2026-10-31', 1159.23), t('2026-11-13', 1000)];
    expect(recurringMonthly(list, 4)).toBe(100000 + 115923);
  });
});
