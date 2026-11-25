// T6.17 · o texto do cartão: diz o que foi descontado, mostra o que falta quando fica negativo e fecha a conta.
import type { ThisMonthForecast } from '@tostao/contracts';
import { describe, expect, it } from 'vitest';
import { money } from './format';
import { getDictionary } from './i18n';
import { safeToSpendView } from './safe-to-spend';

const texts = getDictionary('pt-BR').home.safeToSpend;
const math = {
  availableInCents: 1345_00,
  daysIncludingToday: 15,
  fixedInCents: 900_00,
  subscriptionsInCents: 55_00,
  scheduledInCents: 0,
  goalInCents: 300_00,
};
const month = (over: Partial<ThisMonthForecast> = {}): ThisMonthForecast => ({
  month: '2026-11',
  daysLeft: 14,
  incomeInCents: 3000_00,
  spentInCents: 400_00,
  fixedLeftInCents: 900_00,
  subscriptionsLeftInCents: 55_00,
  dailyLeftInCents: 0,
  leftInCents: 0,
  safeToSpendTodayInCents: 89_66,
  safeToSpend: math,
  ...over,
});
const view = (over: Partial<ThisMonthForecast> = {}) => safeToSpendView(month(over), texts, money)!;

describe('safeToSpendView()', () => {
  it('número por dia, explicação só com o que foi descontado e a conta aberta que fecha', () => {
    const v = view();
    expect(v.amount).toBe(money(89_66));
    expect(v.short).toBe(false);
    expect(v.caption).toBe('por dia, nos 15 dias que faltam (contando hoje)');
    expect(v.explanation).toBe('Já tirei o que saiu, os fixos, as assinaturas e a sua meta.');
    expect(v.rows.map((r) => [r.label, r.value])).toEqual([
      ['Renda do mês', money(3000_00)],
      ['Já saiu', money(400_00)],
      ['Fixos que faltam', money(900_00)],
      ['Assinaturas que faltam', money(55_00)],
      ['Pra meta neste mês', money(300_00)],
      ['Sobra pra 15 dias', money(1345_00)],
    ]);
  });

  it('sem meta nem contas, não diz que tirou o que não tirou', () => {
    const bare = { ...math, fixedInCents: 0, subscriptionsInCents: 0, goalInCents: 0 };
    expect(view({ safeToSpend: bare }).explanation).toBe('Já tirei o que saiu.');
    expect(view({ safeToSpend: bare, spentInCents: 0 }).explanation).toBe('');
  });

  it('negativo: o número grande é o total que falta, sem "por dia"', () => {
    const v = view({ safeToSpend: { ...math, availableInCents: -100_00 }, safeToSpendTodayInCents: -6_67 });
    expect(v.short).toBe(true);
    expect(v.amount).toBe(money(-100_00));
    expect(v.caption).toBe(texts.shortfall);
    expect(v.rows.at(-1)).toEqual({ label: 'Falta', value: money(100_00), total: true });
  });

  it('último dia e zerado têm frase própria', () => {
    expect(view({ safeToSpend: { ...math, daysIncludingToday: 1 } }).caption).toBe(texts.lastDay);
    expect(view({ safeToSpend: { ...math, availableInCents: 0 }, safeToSpendTodayInCents: 0 }).caption).toBe(
      texts.nothingLeft,
    );
  });

  it('API antiga (sem a conta): não desenha número', () => {
    expect(safeToSpendView(month({ safeToSpend: undefined }), texts, money)).toBeNull();
  });

  it('o texto não promete o que a conta não garante', () => {
    const all = JSON.stringify(view());
    expect(all).toContain('estimativa');
    expect(all).not.toMatch(/pode gastar sem medo|garant|com certeza/i);
  });
});
