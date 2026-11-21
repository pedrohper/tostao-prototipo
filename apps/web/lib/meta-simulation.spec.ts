// T4.2 · presets e simulação ao vivo da meta: "guardando R$ X/mês você chega lá em MMM/AAAA".
import { describe, expect, it } from 'vitest';
import {
  GOAL_PRESETS,
  MAX_PROJECTION_MONTHS,
  monthlyNeeded,
  monthsToReach,
  projectedMonth,
  projectionLabel,
} from './meta-simulation';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

describe('GOAL_PRESETS', () => {
  it('tem os 4 atalhos da spec, com valor e mensalidade positivos', () => {
    expect(GOAL_PRESETS.map((p) => p.id)).toEqual(['reserva-3-meses', 'quitar-cartao', 'viagem', 'equipamento']);
    for (const p of GOAL_PRESETS) {
      expect(p.amountInCents).toBeGreaterThan(0);
      expect(p.monthlyInCents).toBeGreaterThan(0);
      expect(p.monthlyInCents).toBeLessThanOrEqual(p.amountInCents);
    }
  });
});

describe('monthsToReach()', () => {
  it('arredonda pra cima: R$ 1.000 a R$ 300/mês são 4 meses, não 3,3', () => {
    expect(monthsToReach({ targetCents: 100_000, monthlyCents: 30_000 })).toBe(4);
  });

  it('valor exato não ganha mês a mais', () => {
    expect(monthsToReach({ targetCents: 90_000, monthlyCents: 30_000 })).toBe(3);
  });

  it('desconta o que já foi guardado; meta já batida dá 0', () => {
    expect(monthsToReach({ targetCents: 100_000, monthlyCents: 30_000, savedCents: 70_000 })).toBe(1);
    expect(monthsToReach({ targetCents: 100_000, monthlyCents: 0, savedCents: 100_000 })).toBe(0);
  });

  it('sem valor da meta ou sem quanto guarda por mês não dá pra projetar', () => {
    expect(monthsToReach({ targetCents: 0, monthlyCents: 30_000 })).toBeNull();
    expect(monthsToReach({ targetCents: 100_000, monthlyCents: 0 })).toBeNull();
    expect(monthsToReach({ targetCents: 100_000, monthlyCents: -5 })).toBeNull();
    expect(monthsToReach({ targetCents: Number.NaN, monthlyCents: 100 })).toBeNull();
  });

  it(`passou de ${MAX_PROJECTION_MONTHS} meses a projeção deixa de ser útil (null)`, () => {
    expect(monthsToReach({ targetCents: 100_000_000, monthlyCents: 100 })).toBeNull();
  });
});

describe('projectedMonth() · o mês atual é o 1º depósito', () => {
  const nov2026 = new Date(2026, 10, 21);

  it('1 mês = o mês corrente', () => {
    expect(projectedMonth(nov2026, 1)).toBe('2026-11');
  });

  it('vira o ano certo', () => {
    expect(projectedMonth(nov2026, 2)).toBe('2026-12');
    expect(projectedMonth(nov2026, 3)).toBe('2027-01');
    expect(projectedMonth(nov2026, 14)).toBe('2027-12');
    expect(projectedMonth(nov2026, 15)).toBe('2028-01');
  });

  it('0 ou negativo não volta no tempo', () => {
    expect(projectedMonth(nov2026, 0)).toBe('2026-11');
    expect(projectedMonth(nov2026, -4)).toBe('2026-11');
  });
});

describe('projectionLabel()', () => {
  it('"dez/2026" com 3 letras minúsculas do nome do mês', () => {
    expect(projectionLabel('2026-12', MONTHS)).toBe('dez/2026');
    expect(projectionLabel('2027-03', MONTHS)).toBe('mar/2027');
  });

  it('formato inválido vira string vazia (a UI não mostra lixo)', () => {
    expect(projectionLabel('2026-13', MONTHS)).toBe('');
    expect(projectionLabel('dez/2026', MONTHS)).toBe('');
    expect(projectionLabel('', MONTHS)).toBe('');
  });
});

describe('monthlyNeeded() · quanto guardar pra um prazo', () => {
  const nov2026 = new Date(2026, 10, 21);

  it('divide pelo número de meses até o prazo, contando o atual', () => {
    // nov, dez, jan, fev = 4 meses
    expect(monthlyNeeded({ targetCents: 100_000, deadline: '2027-02', now: nov2026 })).toBe(25_000);
  });

  it('arredonda pra cima e desconta o já guardado', () => {
    expect(monthlyNeeded({ targetCents: 100_000, deadline: '2027-01', now: nov2026 })).toBe(33_334);
    expect(monthlyNeeded({ targetCents: 100_000, deadline: '2027-02', now: nov2026, savedCents: 60_000 })).toBe(10_000);
  });

  it('prazo no mês atual = tudo agora; prazo passado ou inválido = null', () => {
    expect(monthlyNeeded({ targetCents: 100_000, deadline: '2026-11', now: nov2026 })).toBe(100_000);
    expect(monthlyNeeded({ targetCents: 100_000, deadline: '2026-10', now: nov2026 })).toBeNull();
    expect(monthlyNeeded({ targetCents: 100_000, deadline: 'amanhã', now: nov2026 })).toBeNull();
    expect(monthlyNeeded({ targetCents: 0, deadline: '2027-02', now: nov2026 })).toBeNull();
  });
});
